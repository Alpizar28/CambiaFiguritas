import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';

export type DailyStat = {
  date: string;
  ownedCount: number;
};

const TZ_FALLBACK = 'America/Argentina/Buenos_Aires';

function todayKey(timezone?: string): string {
  const tz = timezone || resolveLocalTz() || TZ_FALLBACK;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

function resolveLocalTz(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function asyncKey(uid: string): string {
  return `dailyStats:lastWritten:${uid}`;
}

export async function recordDailyStatIfNeeded(
  uid: string,
  ownedCount: number,
  timezone?: string,
): Promise<void> {
  const date = todayKey(timezone);
  const stored = await AsyncStorage.getItem(asyncKey(uid));
  if (stored === date) return;

  const ref = doc(db, 'users', uid, 'dailyStats', date);
  await setDoc(ref, { date, ownedCount, at: serverTimestamp() }, { merge: true });
  await AsyncStorage.setItem(asyncKey(uid), date);
}

export async function fetchLast14Days(uid: string): Promise<DailyStat[]> {
  const q = query(
    collection(db, 'users', uid, 'dailyStats'),
    orderBy('date', 'desc'),
    limit(14),
  );
  const snap = await getDocs(q);
  const out: DailyStat[] = [];
  snap.forEach((d) => {
    const data = d.data() as { date?: string; ownedCount?: number };
    if (typeof data.date === 'string' && typeof data.ownedCount === 'number') {
      out.push({ date: data.date, ownedCount: data.ownedCount });
    }
  });
  return out.reverse();
}
