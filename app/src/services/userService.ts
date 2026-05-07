import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { AppUser } from '../types/user';

// El doc `users/{uid}` es de lectura pública para usuarios logueados (lo lee
// findMatches y MatchProfileScreen). No debe contener PII como email.
// El email vive solo en Firebase Auth — la UI propia lo lee de auth.currentUser.

export async function getOrCreateUser(
  uid: string,
  name: string,
  email: string,
  photoUrl: string | null,
): Promise<AppUser> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data() as Record<string, unknown>;
    if ('email' in data) {
      // Cleanup retroactivo: borrar email de docs viejos que sí lo guardaban.
      try {
        await updateDoc(ref, { email: deleteField() });
      } catch {
        // Si falla, no rompemos el login. Eventualmente otro intento limpiará.
      }
      delete data.email;
    }
    return { ...(data as Omit<AppUser, 'email'>), email } as AppUser;
  }

  const persisted = {
    uid,
    name,
    photoUrl,
    city: '',
    premium: false,
    createdAt: new Date().toISOString(),
  };

  await setDoc(ref, persisted);
  return { ...persisted, email };
}
