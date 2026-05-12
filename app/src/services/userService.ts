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
      return { ...existing, userTimezone: tz, email };
    }
    return { ...existing, email };
  }

  // `email` no se persiste en `users/{uid}` (es lectura abierta a todos los autenticados).
  // Email vive en Firebase Auth para el dueño y se obtiene desde auth.currentUser en runtime.
  // Solo se devuelve in-memory en el AppUser del dueño.
  const persisted = {
    uid,
    name,
    photoUrl,
    city: '',
    premium: false,
    createdAt: new Date().toISOString(),
    ...(tz ? { userTimezone: tz } : {}),
  };

  await setDoc(ref, persisted);
  return { ...persisted, email } as AppUser;
}

/**
 * Suscripción live al user doc. Permite que premium=true escrito por webhook
 * propague a todos los clientes en segundos. `email` se inyecta in-memory desde
 * el caller (auth.currentUser); no vive en Firestore.
 */
export function subscribeUserDoc(
  uid: string,
  callback: (user: AppUser | null) => void,
  emailFromAuth?: string,
): Unsubscribe {
  const ref = doc(db, 'users', uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      const data = snap.data() as AppUser;
      callback(emailFromAuth ? { ...data, email: emailFromAuth } : data);
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

// Bucketea coordenadas a múltiplos de 0.05° (~5 km) por privacidad antes de
// persistirlas. Evita exponer la ubicación exacta del usuario.
const COORD_BUCKET = 0.05;
function bucketCoord(n: number): number {
  return Math.round(n / COORD_BUCKET) * COORD_BUCKET;
}

export async function saveUserLocation(
  uid: string,
  lat: number,
  lng: number,
  country?: string,
): Promise<void> {
  const payload: Record<string, unknown> = {
    lat: bucketCoord(lat),
    lng: bucketCoord(lng),
  };
  if (country && country.trim().length > 0) {
    payload.country = country.trim().slice(0, 60);
  }
  await updateDoc(doc(db, 'users', uid), payload);
}

// Throttle module-level: evitar ráfagas de writes a Firestore.
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;
let lastSeenWriteAt = 0;

export async function touchLastSeen(uid: string): Promise<void> {
  const now = Date.now();
  if (now - lastSeenWriteAt < LAST_SEEN_THROTTLE_MS) return;
  lastSeenWriteAt = now;
  try {
    await updateDoc(doc(db, 'users', uid), { lastSeenAt: now });
  } catch {
    // No bloquear UX si falla; reintenta en el próximo touch.
    lastSeenWriteAt = 0;
  }
}

export async function setUserCity(uid: string, raw: string): Promise<void> {
  const trimmed = raw.trim().slice(0, 80);
  if (!trimmed) return;
  await updateDoc(doc(db, 'users', uid), { city: trimmed });
}

export type PrivacyFlags = {
  privacyHideProgress?: boolean;
  privacyHideRepeated?: boolean;
  privacyAnonymous?: boolean;
};

export async function updatePrivacy(uid: string, flags: PrivacyFlags): Promise<void> {
  await updateDoc(doc(db, 'users', uid), flags);
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
