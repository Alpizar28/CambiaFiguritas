import { Platform } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { track } from './analytics';

const PRODUCT_ID = 'cf_premium_lifetime';

// Server now pins productId and packageName itself (see functions/src/playBilling.ts).
// Client only sends the purchase token; sending productId/packageName from a hostile
// client would otherwise let an attacker substitute any cheap Play purchase for Premium.
const verifyPlayPurchaseFn = httpsCallable<
  { purchaseToken: string },
  { granted: boolean }
>(functions, 'verifyPlayPurchase');

// Tipos lo más laxos posibles para no requerir react-native-iap en typecheck web.
// Solo se carga (require) en runtime Android dev build.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RNIap = any;

/**
 * Compra Premium vía Google Play Billing.
 * Solo Android dev build con react-native-iap linkeado.
 * Web/iOS: throws unsupported.
 */
export async function purchasePremium(): Promise<{ success: boolean }> {
  if (Platform.OS !== 'android') {
    throw new Error('play_billing_unavailable_on_platform');
  }

  let RNIap: RNIap;
  try {
    // Lazy require: si la librería no está linkeada (Expo Go, web build), evita crash.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RNIap = require('react-native-iap');
  } catch {
    track({ name: 'play_billing_init_failed', params: { reason: 'module_not_linked' } });
    throw new Error('play_billing_not_linked');
  }

  await RNIap.initConnection();

  const products = await RNIap.getProducts({ skus: [PRODUCT_ID] });
  if (!products || products.length === 0) {
    track({ name: 'play_billing_init_failed', params: { reason: 'product_not_found' } });
    throw new Error('play_billing_product_not_found');
  }

  return new Promise<{ success: boolean }>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const purchaseSub = RNIap.purchaseUpdatedListener(async (purchase: any) => {
      try {
        const purchaseToken: string | undefined = purchase?.purchaseToken;
        if (!purchaseToken) {
          reject(new Error('no_purchase_token'));
          return;
        }
        const result = await verifyPlayPurchaseFn({ purchaseToken });
        if (result.data.granted) {
          await RNIap.finishTransaction({ purchase, isConsumable: false });
          track({ name: 'premium_purchase_completed' });
          resolve({ success: true });
        } else {
          track({ name: 'premium_purchase_failed', params: { reason: 'verify_failed' } });
          resolve({ success: false });
        }
      } catch (err) {
        track({ name: 'premium_purchase_failed', params: { reason: 'verify_exception' } });
        reject(err);
      } finally {
        purchaseSub.remove();
        errorSub.remove();
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorSub = RNIap.purchaseErrorListener((err: any) => {
      track({ name: 'premium_purchase_failed', params: { reason: err?.code ?? 'unknown' } });
      purchaseSub.remove();
      errorSub.remove();
      reject(err);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RNIap.requestPurchase({ skus: [PRODUCT_ID] }).catch((err: any) => {
      purchaseSub.remove();
      errorSub.remove();
      reject(err);
    });
  });
}
