import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { grantPremium } from './payments/entitlement';

const PREMIUM_PRICE_USD = 2.99;
const APP_URL = 'https://cambiafiguritas.online';

const TILOPAY_API_KEY = defineSecret('TILOPAY_API_KEY');
const TILOPAY_MERCHANT_ID = defineSecret('TILOPAY_MERCHANT_ID');
const TILOPAY_WEBHOOK_SECRET = defineSecret('TILOPAY_WEBHOOK_SECRET');

type OrderDoc = {
  uid: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  source: 'tilopay';
  createdAt: FirebaseFirestore.FieldValue;
};

/**
 * Crea checkout en TiloPay (o stub si secrets no configurados).
 */
export const createTilopayCheckout = onCall<{}>(
  {
    region: 'us-central1',
    secrets: [TILOPAY_API_KEY, TILOPAY_MERCHANT_ID],
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'auth required');

    const db = getFirestore();
    const orderId = `${uid}_${Date.now()}`;
    const orderData: OrderDoc = {
      uid,
      amount: PREMIUM_PRICE_USD,
      currency: 'USD',
      status: 'pending',
      source: 'tilopay',
      createdAt: FieldValue.serverTimestamp(),
    };
    await db.doc(`orders/${orderId}`).set(orderData);

    const apiKey = TILOPAY_API_KEY.value();
    const merchantId = TILOPAY_MERCHANT_ID.value();

    // Stub mode: si secrets no configurados, retornar URL fake.
    // El cliente puede mostrar modal "Confirmar pago de prueba" → llama devCompleteOrder.
    if (!apiKey || !merchantId) {
      logger.warn('[tilopay] STUB MODE — secrets no configurados. Retornando URL de prueba.');
      return {
        checkoutUrl: `${APP_URL}/?stubPayment=1&orderId=${encodeURIComponent(orderId)}`,
        orderId,
        stub: true,
      };
    }

    // TODO: integración real con TiloPay API. Endpoint y payload exactos pendientes
    // de confirmar contra docs vigentes. Esqueleto:
    // const response = await fetch('https://api.tilopay.com/v1/checkout/create', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${apiKey}`,
    //   },
    //   body: JSON.stringify({
    //     merchantId,
    //     orderId,
    //     amount: PREMIUM_PRICE_USD,
    //     currency: 'USD',
    //     successUrl: `${APP_URL}/?premium=success&orderId=${orderId}`,
    //     cancelUrl: `${APP_URL}/?premium=cancel`,
    //     webhookUrl: `https://us-central1-cambiafiguritas.cloudfunctions.net/tilopayWebhook`,
    //     description: 'CambiaFiguritas Premium — pago único',
    //   }),
    // });
    // const data = await response.json() as { checkoutUrl: string };
    // return { checkoutUrl: data.checkoutUrl, orderId };

    // Por ahora hasta confirmar API exacta, retornamos stub aún con keys (logueamos warning).
    logger.warn('[tilopay] keys configured pero integración API pendiente. Usando stub.');
    return {
      checkoutUrl: `${APP_URL}/?stubPayment=1&orderId=${encodeURIComponent(orderId)}`,
      orderId,
      stub: true,
    };
  },
);

/**
 * Callable de desarrollo: completar orden manualmente sin TiloPay real.
 * Útil mientras se integra TiloPay; debe deshabilitarse en producción
 * (controlado por flag explícito en el doc orders).
 */
export const devCompleteOrder = onCall<{ orderId: string }>(
  { region: 'us-central1' },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'auth required');
    const { orderId } = req.data;
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId required');

    const db = getFirestore();
    const orderRef = db.doc(`orders/${orderId}`);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) throw new HttpsError('not-found', 'order');
    const order = orderSnap.data() as OrderDoc;
    if (order.uid !== uid) throw new HttpsError('permission-denied', 'not your order');

    const result = await grantPremium(uid, 'tilopay', orderId, {
      amount: order.amount,
      currency: order.currency,
      stub: true,
    });
    await orderRef.update({ status: 'completed' });
    logger.info(`[tilopay] devCompleteOrder ${orderId} → ${JSON.stringify(result)}`);
    return result;
  },
);

/**
 * Webhook de TiloPay. Valida HMAC, actualiza orden, otorga premium.
 */
export const tilopayWebhook = onRequest(
  {
    region: 'us-central1',
    secrets: [TILOPAY_WEBHOOK_SECRET],
    memory: '256MiB',
  },
  async (req, res) => {
    const secret = TILOPAY_WEBHOOK_SECRET.value();
    if (!secret) {
      logger.error('[tilopay] webhook secret no configurado');
      res.status(503).send('not configured');
      return;
    }

    const signature = String(req.header('x-tilopay-signature') ?? '');
    const rawBody: string = (req as unknown as { rawBody?: Buffer }).rawBody?.toString('utf8') ?? JSON.stringify(req.body);
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (signature.length !== expected.length ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      logger.warn('[tilopay] HMAC mismatch');
      res.status(401).send('invalid signature');
      return;
    }

    type WebhookPayload = {
      orderId?: string;
      status?: string;
      transactionId?: string;
    };
    const payload = req.body as WebhookPayload;
    const { orderId, status, transactionId } = payload;
    if (!orderId || !status) {
      res.status(400).send('missing fields');
      return;
    }

    const db = getFirestore();
    const orderRef = db.doc(`orders/${orderId}`);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      logger.warn(`[tilopay] webhook para orden inexistente ${orderId}`);
      res.status(200).send('ok'); // 200 para no reintentar
      return;
    }
    const order = orderSnap.data() as OrderDoc;

    if (status === 'approved' || status === 'completed' || status === 'success') {
      const externalId = transactionId || orderId;
      try {
        await grantPremium(order.uid, 'tilopay', externalId, {
          amount: order.amount,
          currency: order.currency,
          orderId,
        });
        await orderRef.update({ status: 'completed', transactionId: externalId });
        logger.info(`[tilopay] orden ${orderId} aprobada`);
      } catch (err) {
        logger.error(`[tilopay] grantPremium falló para ${orderId}`, err);
      }
    } else if (status === 'failed' || status === 'cancelled') {
      await orderRef.update({ status: 'failed' });
    }

    res.status(200).send('ok');
  },
);
