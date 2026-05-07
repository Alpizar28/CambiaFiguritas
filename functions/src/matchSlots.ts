import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const FREE_CAP = 3;
const AD_DAILY_CAP = 10;
const AD_BASE_SECONDS = 15;
const AD_INCREMENT_SECONDS = 5;
const AD_MAX_INCREMENT = 45;
const TZ_FALLBACK = 'America/Argentina/Buenos_Aires';

type UserDoc = {
  premium?: boolean;
  userTimezone?: string;
  adsWatchedToday?: number;
  adsWatchedDate?: string;
  lastAdUnlockAt?: number;
};

type SlotDoc = {
  consumed?: number;
  bonus?: number;
};

function dayKey(timezone: string | undefined): string {
  const tz = timezone || TZ_FALLBACK;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

function nextResetAt(timezone: string | undefined): number {
  const tz = timezone || TZ_FALLBACK;
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
  // Find midnight of next day in tz: parse today, add 1 day, ask back UTC.
  const [y, m, d] = today.split('-').map(Number);
  // Naive: tomorrow same UTC time + 24h is good enough for client UX hint.
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1, 3, 0, 0)); // ~midnight ART approx
  return tomorrow.getTime();
}

/**
 * Reservar slot de matches del día. Idempotente por user+día.
 * Premium → ok=true sin incremento.
 */
export const consumeMatchSlot = onCall<{ tz?: string }>(
  { region: 'us-central1' },
  async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'auth required');

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);

  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', 'user');
    const user = userSnap.data() as UserDoc;
    const tz = user.userTimezone || req.data?.tz || TZ_FALLBACK;
    const day = dayKey(tz);
    const resetAt = nextResetAt(tz);

    if (user.premium === true) {
      return { ok: true, remaining: Number.MAX_SAFE_INTEGER, cap: Number.MAX_SAFE_INTEGER, premium: true, resetAt };
    }

    const slotRef = db.doc(`users/${uid}/matchSlots/${day}`);
    const slotSnap = await tx.get(slotRef);
    const slot = (slotSnap.exists ? slotSnap.data() : {}) as SlotDoc;
    const consumed = slot.consumed ?? 0;
    const bonus = slot.bonus ?? 0;
    const cap = FREE_CAP + bonus;

    if (consumed >= cap) {
      return {
        ok: false,
        remaining: 0,
        cap,
        premium: false,
        resetAt,
        reason: 'cap_reached',
      };
    }

    tx.set(slotRef, {
      consumed: consumed + 1,
      bonus,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    if (!user.userTimezone && req.data?.tz) {
      tx.set(userRef, { userTimezone: req.data.tz }, { merge: true });
    }

    return {
      ok: true,
      remaining: cap - (consumed + 1),
      cap,
      premium: false,
      resetAt,
    };
  });
});

/**
 * Desbloquear +1 slot tras ver ad. Time-gated server-side.
 * Cliente solo dice "terminé"; server recomputa duración esperada.
 */
export const unlockMatchSlot = onCall<{ tz?: string }>(
  { region: 'us-central1' },
  async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'auth required');

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const now = Date.now();

  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new HttpsError('not-found', 'user');
    const user = userSnap.data() as UserDoc;
    const tz = user.userTimezone || req.data?.tz || TZ_FALLBACK;
    const day = dayKey(tz);

    if (user.premium === true) {
      // Premium no necesita ads. No-op.
      return { granted: false, remaining: Number.MAX_SAFE_INTEGER, reason: 'premium_no_ads_needed' };
    }

    // Reset adsWatchedToday si cambió el día.
    const adsWatched = user.adsWatchedDate === day ? (user.adsWatchedToday ?? 0) : 0;

    if (adsWatched >= AD_DAILY_CAP) {
      return { granted: false, remaining: 0, reason: 'daily_ad_cap' };
    }

    const expectedSec = AD_BASE_SECONDS + Math.min(adsWatched * AD_INCREMENT_SECONDS, AD_MAX_INCREMENT);
    const expectedMs = expectedSec * 1000;
    const lastAd = user.lastAdUnlockAt ?? 0;
    if (lastAd > 0 && now - lastAd < expectedMs) {
      return { granted: false, remaining: 0, reason: 'too_fast' };
    }

    const slotRef = db.doc(`users/${uid}/matchSlots/${day}`);
    const slotSnap = await tx.get(slotRef);
    const slot = (slotSnap.exists ? slotSnap.data() : {}) as SlotDoc;
    const newBonus = (slot.bonus ?? 0) + 1;
    const consumed = slot.consumed ?? 0;
    const cap = FREE_CAP + newBonus;

    tx.set(slotRef, {
      consumed,
      bonus: newBonus,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    tx.set(userRef, {
      adsWatchedToday: adsWatched + 1,
      adsWatchedDate: day,
      lastAdUnlockAt: now,
    }, { merge: true });

    const nextDurationMs = (AD_BASE_SECONDS + Math.min((adsWatched + 1) * AD_INCREMENT_SECONDS, AD_MAX_INCREMENT)) * 1000;

    logger.info(`[matchSlots] unlocked +1 for ${uid}, ads=${adsWatched + 1}, bonus=${newBonus}`);
    return {
      granted: true,
      remaining: cap - consumed,
      nextDurationMs,
    };
  });
});
