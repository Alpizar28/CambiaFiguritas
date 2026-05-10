import { useEffect, useState } from 'react';
import { subscribeUserAlbum, type AlbumSnapshot } from '../services/albumSyncService';

export function usePeerAlbum(peerUid: string | null): {
  album: AlbumSnapshot | null;
  loaded: boolean;
} {
  const [album, setAlbum] = useState<AlbumSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAlbum(null);
    setLoaded(false);
    if (!peerUid) {
      setLoaded(true);
      return;
    }
    const unsub = subscribeUserAlbum(peerUid, (snap) => {
      setAlbum(snap);
      setLoaded(true);
    });
    return () => unsub();
  }, [peerUid]);

  return { album, loaded };
}
