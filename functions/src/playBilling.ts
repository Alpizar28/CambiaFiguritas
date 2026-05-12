import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { google } from 'googleapis';
import { grantPremium } from './payments/entitlement';

const PLAY_SERVICE_ACCOUNT_JSON = defineSecret('PLAY_SERVICE_ACCOUNT_JSON');

// Server constants. Trusting the client to declare which product was purchased lets an
// attacker substitute any cheap Play purchase token for a Premium grant (purchase
// substitution). The server pins both values and verifies that Google echoes back the
// expected product id.
const ALLOWED_PACKAGE_NAME = 'com.cambiafiguritas.app';
const PREMIUM_PRODUCT_ID = 'cf_premium_lifetime';

type Payload = {
  purchaseToken: string;
};

/**
 * Verifica purchase token de Play Billing server-side. Idempotente vía grantPremium
 * (mismo purchaseToken = mismo entitlement doc).
 *
 * Setup manual requerido:
 * 1. Crear service account en Google Cloud Console con scope androidpublisher
 * 2. firebase functions:secrets:set PLAY_SERVICE_ACCOUNT_JSON < key.json
 * 3. Play Console → API access → linkear Cloud project → invitar SA email con
 *    'Manage orders and subscriptions' + 'Financial data, View-only'
 * 4. Esperar ~24h propagación antes del primer call
 */
export const verifyPlayPurchase = onCall<Payload>(
  {
    region: 'us-central1',
    secrets: [PLAY_SERVICE_ACCOUNT_JSON],
    memory: '256MiB',
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'auth required');

    const { purchaseToken } = req.data;
    if (!purchaseToken) {
      throw new HttpsError('invalid-argument', 'purchaseToken required');
    }
    const productId = PREMIUM_PRODUCT_ID;
    const packageName = ALLOWED_PACKAGE_NAME;

    const saJson = PLAY_SERVICE_ACCOUNT_JSON.value();
    if (!saJson) {
      throw new HttpsError('failed-precondition', 'service account not configured');
    }

    let credentials: Record<string, string>;
    try {
      credentials = JSON.parse(saJson);
    } catch {
      logger.error('[playBilling] PLAY_SERVICE_ACCOUNT_JSON inválido');
      throw new HttpsError('internal', 'invalid service account');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const publisher = google.androidpublisher({ version: 'v3', auth });

    try {
      const result = await publisher.purchases.products.get({
        packageName,
        productId,
        token: purchaseToken,
      });

      if (result.data.purchaseState !== 0) {
        logger.warn(`[playBilling] purchaseState=${result.data.purchaseState} para ${uid}`);
        throw new HttpsError('failed-precondition', 'purchase not in valid state');
      }

      const grantResult = await grantPremium(uid, 'play_billing', purchaseToken, {
        orderId: result.data.orderId ?? null,
        productId,
      });

      // Acknowledge si no estaba acknowledged (Play exige ack <3 días sino refund auto).
      if (result.data.acknowledgementState === 0) {
        try {
          await publisher.purchases.products.acknowledge({
            packageName,
            productId,
            token: purchaseToken,
          });
        } catch (err) {
          logger.warn(`[playBilling] acknowledge falló para ${uid}`, err);
        }
      }

      return { granted: grantResult.granted || grantResult.alreadyGranted };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error(`[playBilling] verify falló para ${uid}`, err);
      throw new HttpsError('internal', 'verify failed');
    }
  },
);
