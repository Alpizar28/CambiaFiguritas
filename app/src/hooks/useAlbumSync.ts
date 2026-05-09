import { useEffect, useRef } from 'react';
import { useAlbumStore } from '../store/albumStore';
import { useUserStore } from '../store/userStore';
import { useSyncStore } from '../store/syncStore';
import { useWishlistStore } from '../store/wishlistStore';
import { saveUserAlbum, subscribeUserAlbum } from '../services/albumSyncService';

const DEBOUNCE_MS = 1500;
const SAVED_INDICATOR_MS = 1500;
// Después del primer pull desde Firestore, suprimimos saves por X ms
// para evitar que el load dispare un save inmediato.
const POST_LOAD_SUPPRESS_MS = 800;

export function useAlbumSync() {
  const uid = useUserStore((s) => s.user?.uid);
  const statuses = useAlbumStore((s) => s.statuses);
  const repeatedCounts = useAlbumStore((s) => s.repeatedCounts);
  const wishlist = useWishlistStore((s) => s.items);
  const setSyncStatus = useSyncStore((s) => s.setStatus);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRemoteUpdatedAt = useRef<number>(0);
  const suppressSaveUntil = useRef<number>(0);
  const skipFirstSave = useRef(true);

  // === SUBSCRIBE: pull from Firestore on login + listen realtime ===
  useEffect(() => {
    if (!uid) {
      lastRemoteUpdatedAt.current = 0;
      skipFirstSave.current = true;
      return;
    }

    const unsubscribe = subscribeUserAlbum(uid, (remote) => {
      if (!remote) return;

      // Si el snapshot es más nuevo que lo último que tenemos local, aplicar
      const remoteUpdated = remote.updatedAt ?? 0;
      if (remoteUpdated <= lastRemoteUpdatedAt.current) return;

      lastRemoteUpdatedAt.current = remoteUpdated;
      suppressSaveUntil.current = Date.now() + POST_LOAD_SUPPRESS_MS;

      useAlbumStore.getState().loadState(
        remote.statuses ?? {},
        remote.repeatedCounts ?? {},
      );

      if (remote.wishlist) {
        useWishlistStore.getState().load(remote.wishlist);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [uid]);

  // === DEBOUNCED SAVE on local changes ===
  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    if (!uid) return;
    if (Date.now() < suppressSaveUntil.current) return;

    setSyncStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);

    timer.current = setTimeout(async () => {
      setSyncStatus('saving');
      try {
        await saveUserAlbum(uid, statuses, repeatedCounts, wishlist);
        // Bumpea el timestamp local para no re-aplicar nuestro propio save
        lastRemoteUpdatedAt.current = Date.now();
        setSyncStatus('saved');
        savedTimer.current = setTimeout(() => setSyncStatus('idle'), SAVED_INDICATOR_MS);
      } catch (e) {
        console.error(e);
        setSyncStatus('error');
        savedTimer.current = setTimeout(() => setSyncStatus('idle'), SAVED_INDICATOR_MS * 2);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [statuses, repeatedCounts, wishlist, uid, setSyncStatus]);
}
