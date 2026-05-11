import { Platform } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { track } from './analytics';
import { usePaymentResultStore } from '../store/paymentResultStore';
import { navigateToTab } from '../app/navigationRef';

type ConfirmInput = {
  orderId: string;
  code?: string;
  auth?: string;
  tilopayTransaction?: string;
  orderHash?: string;
};

type ConfirmResult = { granted: boolean; alreadyGranted: boolean };

const confirmTilopayPaymentFn = httpsCallable<ConfirmInput, ConfirmResult>(
  functions,
  'confirmTilopayPayment',
);

function decodeReturnDataOrderId(returnData: string | null): string | null {
  if (!returnData) return null;
  try {
    const json = JSON.parse(
      typeof atob === 'function' ? atob(returnData) : Buffer.from(returnData, 'base64').toString('utf8'),
    );
    return typeof json?.orderId === 'string' ? json.orderId : null;
  } catch {
    return null;
  }
}

function cleanQueryParams(keys: string[]): void {
  if (typeof window === 'undefined' || !window.history) return;
  const params = new URLSearchParams(window.location.search);
  for (const k of keys) params.delete(k);
  const remaining = params.toString();
  const cleanUrl =
    window.location.pathname + (remaining ? `?${remaining}` : '') + window.location.hash;
  window.history.replaceState({}, '', cleanUrl);
}

export function handlePaymentReturnFromUrl(): void {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined' || !window.location) return;

  const params = new URLSearchParams(window.location.search);
  const paymentFlag = params.get('payment');
  const code = params.get('code');
  const isTilopayCallback = paymentFlag === 'callback' || code !== null;
  if (!isTilopayCallback) return;

  const orderIdFromQuery = params.get('orderId');
  const orderIdFromReturnData = decodeReturnDataOrderId(params.get('returnData'));
  const orderId = orderIdFromQuery || orderIdFromReturnData || params.get('order') || '';

  const allKeys = [
    'payment',
    'orderId',
    'code',
    'description',
    'auth',
    'order',
    'tpt',
    'crd',
    'tilopay-transaction',
    'OrderHash',
    'returnData',
    'form_update',
  ];

  if (!orderId) {
    cleanQueryParams(allKeys);
    return;
  }

  const input: ConfirmInput = {
    orderId,
    code: code ?? undefined,
    auth: params.get('auth') ?? undefined,
    tilopayTransaction: params.get('tilopay-transaction') ?? params.get('tpt') ?? undefined,
    orderHash: params.get('OrderHash') ?? undefined,
  };

  cleanQueryParams(allKeys);

  const ensureProfileTab = () => {
    setTimeout(() => navigateToTab('Profile'), 300);
  };

  void confirmTilopayPaymentFn(input)
    .then((res) => {
      if (res.data.granted || res.data.alreadyGranted) {
        track({ name: 'premium_purchase_completed' });
        usePaymentResultStore.getState().showSuccess();
        ensureProfileTab();
      } else {
        track({ name: 'premium_purchase_failed', params: { reason: 'declined' } });
        usePaymentResultStore.getState().showFailed();
        ensureProfileTab();
      }
    })
    .catch((err: unknown) => {
      const reason = err instanceof Error ? err.message : 'confirm_error';
      track({ name: 'premium_purchase_failed', params: { reason } });
      usePaymentResultStore.getState().showFailed();
      ensureProfileTab();
    });
}
