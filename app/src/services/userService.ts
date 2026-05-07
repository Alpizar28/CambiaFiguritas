import { doc, getDoc, onSnapshot, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import type { AppUser } from '../types/user';

function detectTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export async function getOrCreateUser(
  uid: string,
  name: string,
  email: string,
  photoUrl: string | null,
): Promise<AppUser> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const tz = detectTimezone();

  if (snap.exists()) {
    const existing = snap.data() as AppUser;
    if (!existing.userTimezone && tz) {
      // Backfill timezone para users previos.
      await updateDoc(ref, { userTimezone: tz }).catch(() => {});
      return { ...existing, userTimezone: tz };
    }
    return existing;
  }

  const newUser: AppUser = {
    uid,
    name,
    email,
    photoUrl,
    city: '',
    premium: false,
    createdAt: new Date().toISOString(),
    ...(tz ? { userTimezone: tz } : {}),
  };

  await setDoc(ref, newUser);
  return newUser;
}

/**
 * Suscripción live al user doc. Permite que premium=true escrito por webhook
 * propague a todos los clientes en segundos.
 */
export function subscribeUserDoc(
  uid: string,
  callback: (user: AppUser | null) => void,
): Unsubscribe {
  const ref = doc(db, 'users', uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(snap.data() as AppUser);
    },
    (err) => {
      console.warn('[userService] subscribeUserDoc error', err);
    },
  );
}

export async function updateUser(
  uid: string,
  fields: Partial<Pick<AppUser, 'whatsapp' | 'city'>>,
): Promise<void> {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, fields);
}

export async function saveUserLocation(uid: string, lat: number, lng: number): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { lat, lng });
}

export async function setUserCity(uid: string, raw: string): Promise<void> {
  const trimmed = raw.trim().slice(0, 80);
  if (!trimmed) return;
  await updateDoc(doc(db, 'users', uid), { city: trimmed });
}

export type ReputationVote = 'up' | 'down';

const recordReputationVoteFn = httpsCallable<
  { targetUid: string; vote: ReputationVote },
  { ok: boolean; wasNew: boolean; reason?: string }
>(functions, 'recordReputationVote');

/**
 * Registra un voto de reputación vía Cloud Function callable.
 * Backend garantiza atomicidad, idempotencia y anti-self-vote.
 */
export async function recordReputationVote(
  targetUid: string,
  _voterUid: string,
  vote: ReputationVote,
): Promise<{ wasNew: boolean }> {
  const result = await recordReputationVoteFn({ targetUid, vote });
  return { wasNew: result.data.wasNew };
}

export async function getReputationVote(
  targetUid: string,
  voterUid: string,
): Promise<ReputationVote | null> {
  if (targetUid === voterUid) return null;
  const voteRef = doc(db, 'users', targetUid, 'votes', voterUid);
  const snap = await getDoc(voteRef);
  if (!snap.exists()) return null;
  return (snap.data() as { vote: ReputationVote }).vote;
}
