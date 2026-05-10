import type { AlbumSnapshot } from '../../../services/albumSyncService';

const MAX_SUGGESTION = 25;

/**
 * Sugiere stickers que `giver` puede entregar a `receiver`:
 * intersección de repetidas del giver con faltantes del receiver,
 * priorizando wishlist del receiver si está disponible.
 */
export function suggestGives(
  giver: AlbumSnapshot | null | undefined,
  receiver: AlbumSnapshot | null | undefined,
): string[] {
  const giverRepeats = giver?.repeatedCounts ?? {};
  const receiverStatuses = receiver?.statuses ?? {};
  const wishlist = receiver?.wishlist ?? {};

  const ids = Object.keys(giverRepeats).filter((id) => {
    if ((giverRepeats[id] ?? 0) <= 0) return false;
    const status = receiverStatuses[id];
    return !status || status === 'missing';
  });

  ids.sort((a, b) => {
    const aw = wishlist[a] ? 1 : 0;
    const bw = wishlist[b] ? 1 : 0;
    if (aw !== bw) return bw - aw;
    return a.localeCompare(b);
  });

  return ids.slice(0, MAX_SUGGESTION);
}
