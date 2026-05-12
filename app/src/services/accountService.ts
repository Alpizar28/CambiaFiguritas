import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: 'requires-recent-login' | 'unknown'; message: string };

/**
 * Borra TODO el rastro del usuario actual vía Cloud Function `requestAccountDeletion`
 * (admin SDK, único contexto capaz de hacer recursive delete + tocar votos en
 * subcollections de otros usuarios). Cumple GDPR Art. 17 y Apple 5.1.1(v).
 *
 * Reports no se borran — son evidencia de moderación (base legal Art. 6(1)(f)).
 */
const requestAccountDeletionFn = httpsCallable<unknown, { ok: boolean }>(
  functions,
  'requestAccountDeletion',
);

export async function deleteCurrentAccount(): Promise<DeleteAccountResult> {
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, reason: 'unknown', message: 'No hay sesión activa.' };
  }
  try {
    await requestAccountDeletionFn({});
    // El callable también deletea la cuenta de Auth. Cliente puede recibir un onAuthStateChanged
    // a null inmediatamente después.
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'functions/unauthenticated' || code === 'auth/requires-recent-login') {
      return {
        ok: false,
        reason: 'requires-recent-login',
        message: 'Por seguridad, volvé a iniciar sesión y reintentá.',
      };
    }
    return {
      ok: false,
      reason: 'unknown',
      message: 'No se pudo eliminar la cuenta. Intentá de nuevo.',
    };
  }
}
