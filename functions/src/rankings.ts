import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

type AlbumDoc = {
  statuses?: Record<string, string>;
};
type UserDoc = {
  name?: string;
  photoUrl?: string | null;
  city?: string;
  reputationUp?: number;
  reputationCount?: number;
  premium?: boolean;
};

type RankingEntry = {
  uid: string;
  name: string;
  photoUrl: string | null;
  city: string;
  ownedCount: number;
  reputationUp: number;
  reputationCount: number;
  premium: boolean;
};

const TOP_N = 10;
const MAX_PER_CITY = 50;

function countOwned(statuses: Record<string, string> | undefined): number {
  if (!statuses) return 0;
  let n = 0;
  for (const v of Object.values(statuses)) {
    if (v === 'owned' || v === 'repeated' || v === 'special') n += 1;
  }
  return n;
}

function citySlug(city: string): string {
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function aggregate(): Promise<{ global: number; cities: number }> {
  const db = getFirestore();
  const albumsSnap = await db.collection('userAlbums').get();
  const counts: Array<{ uid: string; ownedCount: number }> = [];
  albumsSnap.forEach((doc) => {
    const data = doc.data() as AlbumDoc;
    const owned = countOwned(data.statuses);
    if (owned > 0) counts.push({ uid: doc.id, ownedCount: owned });
  });
  counts.sort((a, b) => b.ownedCount - a.ownedCount);

  // Hidratar perfiles solo para top 200 globales (cap costo).
  const candidates = counts.slice(0, 200);
  const userDocs = await Promise.all(
    candidates.map((c) => db.doc(`users/${c.uid}`).get()),
  );

  const allEntries: RankingEntry[] = [];
  candidates.forEach((c, i) => {
    const userSnap = userDocs[i];
    if (!userSnap.exists) return;
    const user = userSnap.data() as UserDoc;
    allEntries.push({
      uid: c.uid,
      name: user.name || 'Anónimo',
      photoUrl: user.photoUrl ?? null,
      city: user.city || '',
      ownedCount: c.ownedCount,
      reputationUp: user.reputationUp ?? 0,
      reputationCount: user.reputationCount ?? 0,
      premium: user.premium === true,
    });
  });

  // Global top 10
  const globalTop = allEntries.slice(0, TOP_N);
  await db.doc('rankings/global').set({
    entries: globalTop,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Por ciudad
  const byCity = new Map<string, RankingEntry[]>();
  for (const entry of allEntries) {
    if (!entry.city) continue;
    const slug = citySlug(entry.city);
    if (!slug) continue;
    let arr = byCity.get(slug);
    if (!arr) {
      arr = [];
      byCity.set(slug, arr);
    }
    if (arr.length < MAX_PER_CITY) arr.push(entry);
  }

  const writePromises: Promise<unknown>[] = [];
  for (const [slug, entries] of byCity.entries()) {
    const top = entries.slice(0, TOP_N);
    writePromises.push(
      db.doc(`rankings/cities/byCity/${slug}`).set({
        entries: top,
        cityName: entries[0]?.city ?? slug,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );
  }
  await Promise.all(writePromises);

  return { global: globalTop.length, cities: byCity.size };
}

/**
 * Trigger cada 1 hora. Pre-agrega rankings global + por ciudad.
 * Costo: ~1 read/album + 1 read/user + ~50-100 writes. Free tier sobra.
 */
export const aggregateRankings = onSchedule(
  { schedule: 'every 1 hours', region: 'us-central1', timeoutSeconds: 120 },
  async () => {
    const result = await aggregate();
    logger.info('[rankings] agregado', result);
  },
);

// On-demand refresh would otherwise be a read-amplification DoS vector: each call reads
// every userAlbums doc + up to 200 user docs. We honour the most recent scheduled run
// when it is fresh enough; only fall through to a real recomputation if the cache is
// staler than this window.
const REFRESH_CACHE_WINDOW_MS = 10 * 60 * 1000;

/**
 * On-demand: re-agrega ahora si la última corrida quedó vieja. Si no, devuelve el
 * resultado cacheado. Esto evita que un usuario invocando la callable repetidamente
 * agote la quota de lectura.
 */
export const refreshRankingsOnDemand = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth requerida.');
    }
    const db = getFirestore();
    const globalRef = db.doc('rankings/global');
    const globalSnap = await globalRef.get();
    if (globalSnap.exists) {
      const data = globalSnap.data() as { updatedAt?: FirebaseFirestore.Timestamp };
      const updatedAt = data.updatedAt?.toMillis?.() ?? 0;
      if (Date.now() - updatedAt < REFRESH_CACHE_WINDOW_MS) {
        logger.info('[rankings] refresh skipped — cache fresh');
        return { global: 0, cities: 0, cached: true };
      }
    }
    const result = await aggregate();
    return { ...result, cached: false };
  },
);
