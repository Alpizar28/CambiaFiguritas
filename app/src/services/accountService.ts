import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { auth, db } from './firebase';

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: 'requires-recent-login' | 'unknown'; message: string };

/**
 * Borra todo el rastro del usuario actual:
 *  1. Eventos donde createdBy == uid.
 *  2. Doc en `userAlbums/{uid}`.
 *  3. Doc en `users/{uid}`.
 *  4. Cuenta en Firebase Auth.
 *
 * Si el step 4 requiere reautenticación reciente, se devuelve el motivo
 * para que la UI le pida al user que vuelva a loguearse.
 *
 * No borra reportes (`reports/`) — son evidencia de moderación y solo el
 * backend puede leerlos/borrarlos.
 */
export async function deleteCurrentAccount(): Promise<DeleteAccountResult> {
  const user = auth.currentUser;
  if (!user) {
    return { ok: false, reason: 'unknown', message: 'No hay sesión activa.' };
  }
  const uid = user.uid;

  try {
    const eventsQuery = query(collection(db, 'events'), where('createdBy', '==', uid));
    const eventsSnap = await getDocs(eventsQuery);
    await Promise.all(eventsSnap.docs.map((d) => deleteDoc(d.ref)));
  } catch {
    // Si falla, seguimos. El user puede borrar manualmente sus eventos primero.
  }

  try {
    await deleteDoc(doc(db, 'userAlbums', uid));
  } catch {}

  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch {}

  try {
    await deleteUser(user);
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/requires-recent-login') {
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
