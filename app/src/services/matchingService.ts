import { collection, doc, getDoc, getDocs, limit, query } from 'firebase/firestore';
import { db } from './firebase';
import { allStickers } from '../features/album/data/albumCatalog';
import { haversineKm } from '../utils/distance';
import type { StickerStatusMap } from '../features/album/types';
import type { AppUser } from '../types/user';

export type Match = {
  user: AppUser;
  iNeedFromThem: number;
  theyNeedFromMe: number;
  iNeedIds: string[];
  theyNeedIds: string[];
  iNeedPriorityIds: string[];
  score: number;
  distanceKm: number | null;
  isPerfectTrade: boolean;
};

const MAX_IDS_PER_SIDE = 60;
const WISHLIST_BOOST = 3;

type AlbumSnapshot = {
  statuses: Record<string, string>;
  repeatedCounts: Record<string, number>;
};

const allIds = allStickers.map((s) => s.id);

function computeScore(
  myStatuses: StickerStatusMap,
  theirStatuses: Record<string, string>,
  myWishlist: Record<string, true>,
): {
  iNeedFromThem: number;
  theyNeedFromMe: number;
  iNeedIds: string[];
  theyNeedIds: string[];
  iNeedPriorityIds: string[];
  weightedScore: number;
} {
  const myMissing = new Set(allIds.filter((id) => (myStatuses[id] ?? 'missing') === 'missing'));
  const myRepeated = new Set(Object.entries(myStatuses).filter(([, s]) => s === 'repeated').map(([id]) => id));
  const theirRepeated = new Set(Object.entries(theirStatuses).filter(([, s]) => s === 'repeated').map(([id]) => id));
  const theirMissing = new Set(allIds.filter((id) => (theirStatuses[id] ?? 'missing') === 'missing'));

  const iNeedIds: string[] = [];
  const iNeedPriorityIds: string[] = [];
  theirRepeated.forEach((id) => {
    if (myMissing.has(id)) {
      iNeedIds.push(id);
      if (myWishlist[id]) iNeedPriorityIds.push(id);
    }
  });
  // Wishlisted items first dentro de iNeedIds para mejor visualización del top.
  iNeedIds.sort((a, b) => Number(Boolean(myWishlist[b])) - Number(Boolean(myWishlist[a])));

  const theyNeedIds: string[] = [];
  myRepeated.forEach((id) => { if (theirMissing.has(id)) theyNeedIds.push(id); });

  const weightedScore = iNeedIds.length + theyNeedIds.length + iNeedPriorityIds.length * (WISHLIST_BOOST - 1);

  return {
    iNeedFromThem: iNeedIds.length,
    theyNeedFromMe: theyNeedIds.length,
    iNeedIds: iNeedIds.slice(0, MAX_IDS_PER_SIDE),
    theyNeedIds: theyNeedIds.slice(0, MAX_IDS_PER_SIDE),
    iNeedPriorityIds: iNeedPriorityIds.slice(0, MAX_IDS_PER_SIDE),
    weightedScore,
  };
}

// Default histórico de radio (100 km). Lo conserva matchStore. Si el llamador
// pasa `radiusKm = null` no aplica filtro por distancia. Si no se conoce la
// distancia (algún user sin GPS), el match se mantiene siempre.
export const MATCH_MAX_KM = 100;

export { saveUserLocation } from './userService';

const POOL_LIMIT = 200;

export async function findMatches(
  currentUid: string,
  myStatuses: StickerStatusMap,
  myWishlist: Record<string, true> = {},
  myLat?: number,
  myLng?: number,
  radiusKm?: number | null,
  _isPremium: boolean = false,
): Promise<Match[]> {
  const maxKm = radiusKm ?? Infinity;
  const albumsRef = collection(db, 'userAlbums');
  const snap = await getDocs(query(albumsRef, limit(POOL_LIMIT)));

  const candidates: { uid: string; statuses: Record<string, string> }[] = [];
  snap.forEach((d) => {
    if (d.id === currentUid) return;
    const data = d.data() as AlbumSnapshot;
    candidates.push({ uid: d.id, statuses: data.statuses ?? {} });
  });

  const scored = candidates
    .map(({ uid, statuses }) => {
      const { iNeedFromThem, theyNeedFromMe, iNeedIds, theyNeedIds, iNeedPriorityIds, weightedScore } =
        computeScore(myStatuses, statuses, myWishlist);
      return {
        uid,
        iNeedFromThem,
        theyNeedFromMe,
        iNeedIds,
        theyNeedIds,
        iNeedPriorityIds,
        rawScore: iNeedFromThem + theyNeedFromMe,
        weightedScore,
      };
    })
    .filter((m) => m.rawScore > 0)
    .sort((a, b) => b.weightedScore - a.weightedScore);

  if (scored.length === 0) return [];

  const userDocs = await Promise.all(
    scored.map(({ uid }) => getDoc(doc(db, 'users', uid))),
  );

  const matches: Match[] = [];
  scored.forEach((m, i) => {
    const userSnap = userDocs[i];
    if (!userSnap.exists()) return;
    const user = userSnap.data() as AppUser;
    const distanceKm =
      myLat != null && myLng != null && user.lat != null && user.lng != null
        ? haversineKm(myLat, myLng, user.lat, user.lng)
        : null;
    // Filtrar matches lejanos: si conocemos la distancia y supera el radio elegido, descartar.
    if (distanceKm != null && distanceKm > maxKm) return;
    const isPerfectTrade =
      m.iNeedFromThem > 0 &&
      m.theyNeedFromMe > 0 &&
      Math.abs(m.iNeedFromThem - m.theyNeedFromMe) <= 2;
    matches.push({
      user,
      iNeedFromThem: m.iNeedFromThem,
      theyNeedFromMe: m.theyNeedFromMe,
      iNeedIds: m.iNeedIds,
      theyNeedIds: m.theyNeedIds,
      iNeedPriorityIds: m.iNeedPriorityIds,
      score: m.weightedScore,
      distanceKm,
      isPerfectTrade,
    });
  });

  // Ordenar: si hay distancia disponible, combinar score y distancia
  // Priorizar score alto y distancia corta
  matches.sort((a, b) => {
    const hasDistA = a.distanceKm != null;
    const hasDistB = b.distanceKm != null;
    if (hasDistA && hasDistB) {
      // Score normalizado (0-1) + distancia inversa normalizada (0-1)
      const maxScore = Math.max(...matches.map((m) => m.score));
      const maxDist = Math.max(...matches.map((m) => m.distanceKm ?? 0)) || 1;
      const rankA = (a.score / maxScore) - (a.distanceKm! / maxDist) * 0.3;
      const rankB = (b.score / maxScore) - (b.distanceKm! / maxDist) * 0.3;
      return rankB - rankA;
    }
    return b.score - a.score;
  });

  return matches;
}
