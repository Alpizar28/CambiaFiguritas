import { useEffect, useRef } from 'react';
import { useAlbumStore } from '../store/albumStore';
import { useUserStore } from '../store/userStore';
import { useSyncStore } from '../store/syncStore';
import { saveUserAlbum } from '../services/albumSyncService';

const DEBOUNCE_MS = 1500;
const SAVED_INDICATOR_MS = 1500;

export function useAlbumSync() {
  const uid = useUserStore((s) => s.user?.uid);
  const statuses = useAlbumStore((s) => s.statuses);
  const repeatedCounts = useAlbumStore((s) => s.repeatedCounts);
  const setSyncStatus = useSyncStore((s) => s.setStatus);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    if (!uid) return;

    setSyncStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);

    timer.current = setTimeout(async () => {
      setSyncStatus('saving');
      try {
        await saveUserAlbum(uid, statuses, repeatedCounts);
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
  }, [statuses, repeatedCounts, uid, setSyncStatus]);
}
