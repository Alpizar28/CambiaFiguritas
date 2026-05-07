import { memo, useCallback } from 'react';
import { useAlbumStore } from '../../../store/albumStore';
import { useWishlistStore } from '../../../store/wishlistStore';
import { StickerCard } from './StickerCard';
import type { Sticker } from '../types';

type Props = {
  sticker: Sticker;
  colSpan?: 1 | 2;
  highlighted?: boolean;
  onLongPress: (stickerId: string, event: { nativeEvent: { pageX: number; pageY: number } }) => void;
};

/**
 * Wrapper que conecta StickerCard al store directamente.
 * - Lee status y repeatedCount usando selectors específicos del sticker.
 * - Solo re-renderiza cuando cambia ESTE sticker (no toda la grilla).
 * - Estabiliza callbacks con useCallback para que React.memo del StickerCard funcione.
 */
function ConnectedStickerCardImpl({ sticker, colSpan, highlighted, onLongPress }: Props) {
  const stickerId = sticker.id;
  const status = useAlbumStore((s) => s.statuses[stickerId] ?? 'missing');
  const repeatedCount = useAlbumStore((s) => s.repeatedCounts[stickerId] ?? 0);
  const wishlisted = useWishlistStore((s) => Boolean(s.items[stickerId]));
  const markOwned = useAlbumStore((s) => s.markOwned);
  const markRepeated = useAlbumStore((s) => s.markRepeated);
  const incrementRepeated = useAlbumStore((s) => s.incrementRepeated);
  const decrementRepeated = useAlbumStore((s) => s.decrementRepeated);

  const handlePress = useCallback(() => markOwned(stickerId), [markOwned, stickerId]);
  const handleDoublePress = useCallback(() => markRepeated(stickerId), [markRepeated, stickerId]);
  const handleIncrement = useCallback(() => incrementRepeated(stickerId), [incrementRepeated, stickerId]);
  const handleDecrement = useCallback(() => decrementRepeated(stickerId), [decrementRepeated, stickerId]);
  const handleLongPress = useCallback(
    (event: { nativeEvent: { pageX: number; pageY: number } }) => onLongPress(stickerId, event),
    [onLongPress, stickerId],
  );

  return (
    <StickerCard
      sticker={sticker}
      status={status}
      repeatedCount={repeatedCount}
      colSpan={colSpan}
      highlighted={highlighted}
      wishlisted={wishlisted}
      onPress={handlePress}
      onDoublePress={handleDoublePress}
      onLongPress={handleLongPress}
      onIncrementRepeated={handleIncrement}
      onDecrementRepeated={handleDecrement}
    />
  );
}

export const ConnectedStickerCard = memo(ConnectedStickerCardImpl, (prev, next) =>
  prev.sticker.id === next.sticker.id &&
  prev.colSpan === next.colSpan &&
  prev.highlighted === next.highlighted &&
  prev.onLongPress === next.onLongPress,
);
// Nota: status, repeatedCount y wishlisted son consumidos via useAlbumStore/useWishlistStore
// con selectors específicos del sticker. Cada cambio de un sticker solo re-renderiza ese item.
