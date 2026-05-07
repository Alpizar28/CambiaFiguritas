import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { sendPushSafe } from '../notifications';

export type EntitlementSource = 'tilopay' | 'play_billing';

export type GrantResult = {
  granted: boolean;
  alreadyGranted: boolean;
};

/**
 * Otorga premium a un user. Idempotente por (uid, source, externalId).
 * Single source of truth: users/{uid}.premium = true.
 * Audit: users/{uid}/entitlements/{source} con externalId + grantedAt.
 */
export async function grantPremium(
  uid: string,
  source: EntitlementSource,
  externalId: string,
  meta?: Record<string, unknown>,
): Promise<GrantResult> {
  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const entitlementRef = db.doc(`users/${uid}/entitlements/${source}`);

  const existing = await entitlementRef.get();
  if (existing.exists) {
    const data = existing.data();
    if (data?.externalId === externalId) {
      logger.info(`[entitlement] already granted ${source}/${externalId} for ${uid}`);
      return { granted: false, alreadyGranted: true };
    }
  }

  const batch = db.batch();
  batch.set(userRef, { premium: true }, { merge: true });
  batch.set(entitlementRef, {
    source,
    externalId,
    grantedAt: FieldValue.serverTimestamp(),
    ...(meta ?? {}),
  });
  await batch.commit();

  logger.info(`[entitlement] granted premium via ${source} for ${uid}`);

  // Thank-you push (best effort).
  try {
    const userSnap = await userRef.get();
    const fcmToken = (userSnap.data() as { fcmToken?: string } | undefined)?.fcmToken;
    if (fcmToken) {
      await sendPushSafe(uid, fcmToken, {
        notification: {
          title: '¡Bienvenido a Premium! ✨',
          body: 'Matches ilimitados activados. Sin anuncios. Gracias por apoyar la app.',
        },
        webpush: {
          fcmOptions: { link: 'https://cambiafiguritas.web.app/' },
          notification: { icon: '/icon-192.png', badge: '/icon-192.png' },
        },
        data: { type: 'premium_granted', source },
      });
    }
  } catch (err) {
    logger.warn(`[entitlement] thank-you push failed for ${uid}`, err);
  }

  return { granted: true, alreadyGranted: false };
}
