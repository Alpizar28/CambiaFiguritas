import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { StickerStatus, StickerStatusMap } from '../features/album/types';

export type AlbumSnapshot = {
  statuses: Record<string, StickerStatus>;
  repeatedCounts: Record<string, number>;
  wishlist?: Record<string, true>;
  updatedAt?: number;
};

export function subscribeUserAlbum(
  uid: string,
  onChange: (snapshot: AlbumSnapshot | null) => void,
): () => void {
  const ref = doc(db, 'userAlbums', uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(snap.data() as AlbumSnapshot);
    },
    (error) => {
      console.error('[albumSync] subscribe error', error);
    },
  );
}

export async function loadUserAlbum(uid: string): Promise<AlbumSnapshot | null> {
  const ref = doc(db, 'userAlbums', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as AlbumSnapshot;
}

export async function loadOtherUserAlbum(uid: string): Promise<AlbumSnapshot | null> {
  return loadUserAlbum(uid);
}

export async function saveUserAlbum(
  uid: string,
  statuses: StickerStatusMap,
  repeatedCounts: Record<string, number>,
  wishlist?: Record<string, true>,
): Promise<void> {
  // Solo persistir estado no-default para mantener el documento pequeño
  const nonMissing = Object.fromEntries(
    Object.entries(statuses).filter(([, s]) => s !== 'missing'),
  );
  const nonZero = Object.fromEntries(
    Object.entries(repeatedCounts).filter(([, c]) => c > 0),
  );
  const payload: AlbumSnapshot & { updatedAt: number } = {
    statuses: nonMissing,
    repeatedCounts: nonZero,
    updatedAt: Date.now(),
  };
  if (wishlist && Object.keys(wishlist).length > 0) {
    payload.wishlist = wishlist;
  }
  const ref = doc(db, 'userAlbums', uid);
  await setDoc(ref, payload);
}
