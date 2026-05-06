import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { StickerStatus, StickerStatusMap } from '../features/album/types';

type AlbumSnapshot = {
  statuses: Record<string, StickerStatus>;
  repeatedCounts: Record<string, number>;
};

export async function loadUserAlbum(uid: string): Promise<AlbumSnapshot | null> {
  const ref = doc(db, 'userAlbums', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as AlbumSnapshot;
}

export async function saveUserAlbum(
  uid: string,
  statuses: StickerStatusMap,
  repeatedCounts: Record<string, number>,
): Promise<void> {
  // Solo persistir estado no-default para mantener el documento pequeño
  const nonMissing = Object.fromEntries(
    Object.entries(statuses).filter(([, s]) => s !== 'missing'),
  );
  const nonZero = Object.fromEntries(
    Object.entries(repeatedCounts).filter(([, c]) => c > 0),
  );
  const ref = doc(db, 'userAlbums', uid);
  await setDoc(ref, { statuses: nonMissing, repeatedCounts: nonZero });
}
