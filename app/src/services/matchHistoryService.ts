import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ZoneFilter } from '../features/matching/utils/matchFilter';

export type MatchHistoryEntry = {
  uid: string;
  name: string;
  photoUrl: string | null;
  city: string | null;
  score: number;
  distanceKm: number | null;
  iNeedFromThem: number;
  theyNeedFromMe: number;
  iNeedIds: string[];
  theyNeedIds: string[];
  iNeedPriorityIds: string[];
  premium: boolean;
  whatsapp?: string;
};

export type MatchBatch = {
  id: string;
  createdAt: number; // ms epoch
  filterUsed: ZoneFilter;
  userCity: string | null;
  userLat: number | null;
  userLng: number | null;
  matches: MatchHistoryEntry[];
};

const FREE_KEEP = 30;
const PREMIUM_KEEP = 90;
const MAX_LIST = 100;

function batchPath(uid: string): string {
  return `users/${uid}/matchHistory`;
}

export async function saveMatchBatch(
  uid: string,
  batch: Omit<MatchBatch, 'id'>,
): Promise<string> {
  const batchId = String(batch.createdAt || Date.now());
  const ref = doc(db, batchPath(uid), batchId);
  await setDoc(ref, {
    filterUsed: batch.filterUsed,
    userCity: batch.userCity,
    userLat: batch.userLat,
    userLng: batch.userLng,
    matches: batch.matches,
    createdAt: serverTimestamp(),
  });
  return batchId;
}

export async function listMatchBatches(uid: string, max: number = MAX_LIST): Promise<MatchBatch[]> {
  const q = query(collection(db, batchPath(uid)), orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Omit<MatchBatch, 'id' | 'createdAt'> & { createdAt?: Timestamp };
    const createdMs = data.createdAt
      ? data.createdAt.toMillis()
      : Number(d.id) || 0;
    return {
      id: d.id,
      createdAt: createdMs,
      filterUsed: data.filterUsed,
      userCity: data.userCity ?? null,
      userLat: data.userLat ?? null,
      userLng: data.userLng ?? null,
      matches: data.matches ?? [],
    };
  });
}

export async function pruneOldBatches(uid: string, keepN: number): Promise<void> {
  const all = await listMatchBatches(uid, MAX_LIST);
  const toDelete = all.slice(keepN);
  await Promise.all(toDelete.map((b) => deleteDoc(doc(db, batchPath(uid), b.id)).catch(() => {})));
}

export function defaultRetentionFor(isPremium: boolean): number {
  return isPremium ? PREMIUM_KEEP : FREE_KEEP;
}
