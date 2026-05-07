import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { AppUser } from '../types/user';

export async function getOrCreateUser(
  uid: string,
  name: string,
  email: string,
  photoUrl: string | null,
): Promise<AppUser> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data() as AppUser;
  }

  const newUser: AppUser = {
    uid,
    name,
    email,
    photoUrl,
    city: '',
    premium: false,
    createdAt: new Date().toISOString(),
  };

  await setDoc(ref, newUser);
  return newUser;
}

export async function updateUser(
  uid: string,
  fields: Partial<Pick<AppUser, 'whatsapp' | 'city'>>,
): Promise<void> {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, fields);
}
