import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { allStickers } from '../features/album/data/albumCatalog';
import { citySlug } from '../utils/citySlug';

export type RankingScope = 'global' | 'city' | 'country';

export type RankingEntry = {
  uid: string;
  name: string;
  photoUrl: string | null;
  city: string;
  ownedCount: number;
  totalStickers: number;
  reputationUp: number;
  reputationCount: number;
  premium: boolean;
};

const TOTAL_STICKERS = allStickers.length;

type AggregatedDoc = {
  entries: Array<{
    uid: string;
    name: string;
    photoUrl: string | null;
    city: string;
    ownedCount: number;
    reputationUp: number;
    reputationCount: number;
    premium?: boolean;
  }>;
};

/**
 * Lee ranking pre-agregado. Cloud Function lo refresca cada 1h.
 * Mucho más eficiente que iterar userAlbums (~1 read en lugar de 200+).
 */
export async function getRankings(
  scope: RankingScope,
  userCity: string | undefined,
): Promise<RankingEntry[]> {
  let docPath: string;
  if (scope === 'city' && userCity) {
    const slug = citySlug(userCity);
    if (!slug) return [];
    docPath = `rankings/cities/byCity/${slug}`;
  } else {
    docPath = 'rankings/global';
  }

  const snap = await getDoc(doc(db, docPath));
  if (!snap.exists()) return [];
  const data = snap.data() as AggregatedDoc;
  const entries = data.entries ?? [];
  return entries.map((e) => ({
    uid: e.uid,
    name: e.name,
    photoUrl: e.photoUrl,
    city: e.city,
    ownedCount: e.ownedCount,
    totalStickers: TOTAL_STICKERS,
    reputationUp: e.reputationUp,
    reputationCount: e.reputationCount,
    premium: e.premium === true,
  }));
}
