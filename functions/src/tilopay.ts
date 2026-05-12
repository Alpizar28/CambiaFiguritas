import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { grantPremium } from './payments/entitlement';

const PREMIUM_PRICE_USD = 3.99;
const APP_URL = 'https://cambiafiguritas.online';
const TILOPAY_API_BASE = 'https://app.tilopay.com';
const TILOPAY_PLATFORM_TAG = 'cambiafiguritas-web';

const TILOPAY_API_USER = defineSecret('TILOPAY_API_USER');
const TILOPAY_API_PASSWORD = defineSecret('TILOPAY_API_PASSWORD');
const TILOPAY_KEY = defineSecret('TILOPAY_KEY');

type OrderStatus = 'pending' | 'completed' | 'failed';

type OrderDoc = {
  uid: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  source: 'tilopay';
  createdAt: FirebaseFirestore.FieldValue;
  transactionId?: string;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type ProcessPaymentResponse = {
  type: string;
  url?: string;
  html?: string;
  message?: string;
};

async function getTilopayToken(apiUser: string, password: string): Promise<string> {
  const resp = await fetch(`${TILOPAY_API_BASE}/api/v1/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiuser: apiUser, password }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`tilopay login failed: ${resp.status} ${body.slice(0, 200)}`);
  }
  const data = (await resp.json()) as LoginResponse;
  if (!data.access_token) throw new Error('tilopay login: no access_token');
  return data.access_token;
}

function buildRedirectUrl(orderId: string): string {
  return `${APP_URL}/?payment=callback&orderId=${encodeURIComponent(orderId)}`;
}

function encodeReturnData(orderId: string, uid: string): string {
  return Buffer.from(JSON.stringify({ orderId, uid })).toString('base64');
}

export const createTilopayCheckout = onCall<Record<string, never>>(
  {
    region: 'us-central1',
    secrets: [TILOPAY_API_USER, TILOPAY_API_PASSWORD, TILOPAY_KEY],
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'auth required');

    const apiUser = TILOPAY_API_USER.value();
    const password = TILOPAY_API_PASSWORD.value();
    const key = TILOPAY_KEY.value();

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

    if (!apiUser || !password || !key) {
      logger.warn('[tilopay] STUB — secrets faltantes. Devolviendo URL stub.');
      return {
        checkoutUrl: `${APP_URL}/?stubPayment=1&orderId=${encodeURIComponent(orderId)}`,
        orderId,
        stub: true,
      };
    }

    let token: string;
    try {
      token = await getTilopayToken(apiUser, password);
    } catch (err) {
      logger.error('[tilopay] login error', err);
      throw new HttpsError('internal', 'tilopay login failed');
    }

    const userEmail = req.auth?.token?.email ?? 'no-reply@cambiafiguritas.online';
    const userName = (req.auth?.token?.name as string | undefined) ?? 'CambiaFiguritas';
    const [firstName, ...rest] = userName.split(' ');
    const lastName = rest.join(' ') || firstName;

    const body = {
      redirect: buildRedirectUrl(orderId),
      key,
      amount: PREMIUM_PRICE_USD.toFixed(2),
      currency: 'USD',
      orderNumber: orderId,
      capture: '1',
      subscription: '0',
      platform: TILOPAY_PLATFORM_TAG,
      billToFirstName: firstName || 'Cliente',
      billToLastName: lastName || 'CambiaFiguritas',
      billToAddress: 'N/A',
      billToAddress2: 'N/A',
      billToCity: 'N/A',
      billToState: 'CR-SJ',
      billToZipPostCode: '10101',
      billToCountry: 'CR',
      billToTelephone: '00000000',
      billToEmail: userEmail,
      returnData: encodeReturnData(orderId, uid),
      hashVersion: 'V2',
      token_version: 'v2',
    };

    let resp: Response;
    try {
      resp = await fetch(`${TILOPAY_API_BASE}/api/v1/processPayment`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      logger.error('[tilopay] processPayment fetch error', err);
      throw new HttpsError('internal', 'tilopay request failed');
    }

    if (!resp.ok) {
      const errBody = await resp.text();
      logger.error(`[tilopay] processPayment ${resp.status}: ${errBody.slice(0, 300)}`);
      throw new HttpsError('internal', `tilopay error ${resp.status}`);
    }

    const data = (await resp.json()) as ProcessPaymentResponse;
    if (!data.url) {
      logger.error('[tilopay] processPayment no url', data);
      throw new HttpsError('internal', 'tilopay: no checkout url');
    }

    return { checkoutUrl: data.url, orderId, stub: false };
  },
);

type ConfirmInput = {
  orderId: string;
  code?: string;
  auth?: string;
  tilopayTransaction?: string;
  orderHash?: string;
};

type ConsultEntry = {
  id_tilopay?: number | string;
  orderNumber?: string;
  amount?: string | number;
  currency?: string;
  code?: string;
  response?: string;
  auth?: string;
};

type ConsultResponse = {
  type: string;
  message?: string;
  response?: ConsultEntry[];
};

async function consultTilopayTransaction(
  token: string,
  key: string,
  orderNumber: string,
): Promise<ConsultEntry | null> {
  const resp = await fetch(`${TILOPAY_API_BASE}/api/v1/consult`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `bearer ${token}`,
    },
    body: JSON.stringify({ key, orderNumber, merchantId: '' }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    logger.error(`[tilopay] consult ${resp.status}: ${body.slice(0, 200)}`);
    return null;
  }
  const data = (await resp.json()) as ConsultResponse;
  const entries = Array.isArray(data.response) ? data.response : [];
  if (entries.length === 0) return null;
  return entries[0];
}

export const confirmTilopayPayment = onCall<ConfirmInput>(
  {
    region: 'us-central1',
    secrets: [TILOPAY_API_USER, TILOPAY_API_PASSWORD, TILOPAY_KEY],
  },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'auth required');
    const { orderId } = req.data;
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId required');

    const db = getFirestore();
    const orderRef = db.doc(`orders/${orderId}`);
    const snap = await orderRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'order');
    const order = snap.data() as OrderDoc;
    if (order.uid !== uid) throw new HttpsError('permission-denied', 'not your order');

    if (order.status === 'completed') {
      return { granted: true, alreadyGranted: true };
    }

    const apiUser = TILOPAY_API_USER.value();
    const password = TILOPAY_API_PASSWORD.value();
    const key = TILOPAY_KEY.value();
    if (!apiUser || !password || !key) {
      throw new HttpsError('failed-precondition', 'tilopay secrets missing');
    }

    let token: string;
    try {
      token = await getTilopayToken(apiUser, password);
    } catch (err) {
      logger.error('[tilopay] confirm login error', err);
      throw new HttpsError('internal', 'tilopay login failed');
    }

    const entry = await consultTilopayTransaction(token, key, orderId);
    if (!entry) {
      logger.warn(`[tilopay] consult no entries for ${orderId}`);
      await orderRef.update({ status: 'failed' });
      return { granted: false, alreadyGranted: false };
    }

    if (entry.code !== '1') {
      logger.info(`[tilopay] order ${orderId} not approved (code=${entry.code})`);
      await orderRef.update({ status: 'failed' });
      return { granted: false, alreadyGranted: false };
    }

    const reportedAmount =
      typeof entry.amount === 'string' ? Number.parseFloat(entry.amount) : Number(entry.amount);
    const expectedAmount = Number(order.amount);
    if (!Number.isFinite(reportedAmount) || Math.abs(reportedAmount - expectedAmount) > 0.01) {
      logger.warn(
        `[tilopay] amount mismatch for ${orderId}: reported=${reportedAmount} expected=${expectedAmount}`,
      );
      throw new HttpsError('permission-denied', 'amount mismatch');
    }

    if (entry.currency && entry.currency.toUpperCase() !== order.currency.toUpperCase()) {
      logger.warn(
        `[tilopay] currency mismatch for ${orderId}: ${entry.currency} vs ${order.currency}`,
      );
      throw new HttpsError('permission-denied', 'currency mismatch');
    }

    const externalId =
      (entry.id_tilopay !== undefined ? String(entry.id_tilopay) : undefined) ||
      entry.auth ||
      orderId;
    const result = await grantPremium(order.uid, 'tilopay', externalId, {
      amount: order.amount,
      currency: order.currency,
      orderId,
    });
    await orderRef.update({ status: 'completed', transactionId: externalId });
    logger.info(`[tilopay] order ${orderId} completed via consult`);
    return result;
  },
);

export const devCompleteOrder = onCall<{ orderId: string }>(
  { region: 'us-central1' },
  async (req) => {
    if (process.env.FUNCTIONS_EMULATOR !== 'true') {
      throw new HttpsError('failed-precondition', 'devCompleteOrder only available in emulator');
    }
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'auth required');
    const { orderId } = req.data;
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId required');

    const db = getFirestore();
    const orderRef = db.doc(`orders/${orderId}`);
    const snap = await orderRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'order');
    const order = snap.data() as OrderDoc;
    if (order.uid !== uid) throw new HttpsError('permission-denied', 'not your order');

    const result = await grantPremium(uid, 'tilopay', orderId, {
      amount: order.amount,
      currency: order.currency,
      stub: true,
    });
    await orderRef.update({ status: 'completed' });
    return result;
  },
);
