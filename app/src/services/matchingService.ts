import { collection, doc, getDoc, getDocs, limit, query, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { allStickers } from '../features/album/data/mockAlbum';
import { haversineKm } from '../utils/distance';
import type { StickerStatusMap } from '../features/album/types';
import type { AppUser } from '../types/user';

export type Match = {
  user: AppUser;
  iNeedFromThem: number;
  theyNeedFromMe: number;
  score: number;
  distanceKm: number | null;
};

type AlbumSnapshot = {
  statuses: Record<string, string>;
  repeatedCounts: Record<string, number>;
};

const allIds = allStickers.map((s) => s.id);

function computeScore(
  myStatuses: StickerStatusMap,
  theirStatuses: Record<string, string>,
): { iNeedFromThem: number; theyNeedFromMe: number } {
  const myMissing = new Set(allIds.filter((id) => (myStatuses[id] ?? 'missing') === 'missing'));
  const myRepeated = new Set(Object.entries(myStatuses).filter(([, s]) => s === 'repeated').map(([id]) => id));
  const theirRepeated = new Set(Object.entries(theirStatuses).filter(([, s]) => s === 'repeated').map(([id]) => id));
  const theirMissing = new Set(allIds.filter((id) => (theirStatuses[id] ?? 'missing') === 'missing'));

  let iNeedFromThem = 0;
  theirRepeated.forEach((id) => { if (myMissing.has(id)) iNeedFromThem++; });

  let theyNeedFromMe = 0;
  myRepeated.forEach((id) => { if (theirMissing.has(id)) theyNeedFromMe++; });

  return { iNeedFromThem, theyNeedFromMe };
}

export async function saveUserLocation(uid: string, lat: number, lng: number): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { lat, lng });
}

export async function findMatches(
  currentUid: string,
  myStatuses: StickerStatusMap,
  myLat?: number,
  myLng?: number,
): Promise<Match[]> {
  const albumsRef = collection(db, 'userAlbums');
  const snap = await getDocs(query(albumsRef, limit(50)));

  const candidates: { uid: string; statuses: Record<string, string> }[] = [];
  snap.forEach((d) => {
    if (d.id === currentUid) return;
    const data = d.data() as AlbumSnapshot;
    candidates.push({ uid: d.id, statuses: data.statuses ?? {} });
  });

  const scored = candidates
    .map(({ uid, statuses }) => {
      const { iNeedFromThem, theyNeedFromMe } = computeScore(myStatuses, statuses);
      return { uid, iNeedFromThem, theyNeedFromMe, score: iNeedFromThem + theyNeedFromMe };
    })
    .filter((m) => m.score > 0)
    .slice(0, 20);

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
    matches.push({
      user,
      iNeedFromThem: m.iNeedFromThem,
      theyNeedFromMe: m.theyNeedFromMe,
      score: m.score,
      distanceKm,
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
