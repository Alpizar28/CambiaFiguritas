import { memo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { radii, spacing } from '../../../constants/theme';
import { formatStickerNumber } from '../data/albumCatalog';
import type { Sticker, StickerStatus } from '../types';

type StickerCardProps = {
  sticker: Sticker;
  status: StickerStatus;
  repeatedCount?: number;
  colSpan?: 1 | 2;
  onPress: () => void;
  onDoublePress: () => void;
  onLongPress: (event: { nativeEvent: { pageX: number; pageY: number } }) => void;
  onIncrementRepeated?: () => void;
  onDecrementRepeated?: () => void;
};

const STATUS_COPY: Record<StickerStatus, string> = {
  missing: 'FALTA',
  owned: 'OK',
  repeated: 'REPE',
  special: '★',
};

function StickerCardImpl({
  sticker,
  status,
  repeatedCount = 0,
  colSpan = 1,
  onPress,
  onDoublePress,
  onLongPress,
  onIncrementRepeated,
  onDecrementRepeated,
}: StickerCardProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const hasRepeated = status === 'repeated' || repeatedCount > 0;
  const isSpecial = sticker.rarity === 'special' || status === 'special';
  const pressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePress = () => {
    if (pressTimeoutRef.current) {
      clearTimeout(pressTimeoutRef.current);
      pressTimeoutRef.current = null;
      onDoublePress();
      return;
    }
    pressTimeoutRef.current = setTimeout(() => {
      pressTimeoutRef.current = null;
      onPress();
    }, 220);
  };

  const variantStyle =
    status === 'missing'
      ? styles.missing
      : isSpecial
      ? styles.special
      : status === 'repeated'
      ? styles.repeated
      : styles.owned;

  return (
    <Pressable
      accessibilityLabel={`Figurita ${sticker.displayCode}, ${sticker.label}, ${
        hasRepeated ? `repetida ${repeatedCount}` : STATUS_COPY[status]
      }`}
      onPress={handlePress}
      onLongPress={(event) => onLongPress(event)}
      style={({ pressed }) => [
        styles.card,
        colSpan === 2
          ? styles.doubleCard
          : isMobile
          ? styles.singleCardMobile
          : styles.singleCard,
        variantStyle,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={[styles.number, status === 'missing' && styles.numberMissing]}>
          {formatStickerNumber(sticker.displayCode)}
        </Text>
        <View style={[styles.statusChip, styles[`${status}Chip`]]}>
          <Text style={[styles.statusChipText, status === 'missing' && styles.statusChipTextMissing]}>
            {STATUS_COPY[status]}
          </Text>
        </View>
      </View>

      <Text numberOfLines={1} style={[styles.label, status === 'missing' && styles.labelMissing]}>
        {sticker.label}
      </Text>

      {isSpecial && <View style={styles.specialShine} pointerEvents="none" />}

      {hasRepeated && onIncrementRepeated && onDecrementRepeated && (
        <View style={styles.repeatedControls}>
          <Pressable accessibilityLabel="Reducir repetida" onPress={onDecrementRepeated} style={styles.repeatedButton}>
            <Text style={styles.repeatedButtonText}>−</Text>
          </Pressable>
          <Text style={styles.repeatedCount}>×{repeatedCount}</Text>
          <Pressable accessibilityLabel="Aumentar repetida" onPress={onIncrementRepeated} style={styles.repeatedButton}>
            <Text style={styles.repeatedButtonText}>+</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

export const StickerCard = memo(StickerCardImpl, (prev, next) =>
  prev.sticker.id === next.sticker.id &&
  prev.status === next.status &&
  prev.repeatedCount === next.repeatedCount &&
  prev.colSpan === next.colSpan &&
  prev.onPress === next.onPress &&
  prev.onDoublePress === next.onDoublePress &&
  prev.onLongPress === next.onLongPress &&
  prev.onIncrementRepeated === next.onIncrementRepeated &&
  prev.onDecrementRepeated === next.onDecrementRepeated,
);

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.sm,
    borderWidth: 2,
    minHeight: 78,
    padding: spacing.xs,
    paddingTop: spacing.sm,
    overflow: 'hidden',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  singleCard: { flexBasis: '23.5%' },
  singleCardMobile: { flexBasis: '31%', minHeight: 90 },
  doubleCard: { flexBasis: '49%' },

  // ---- Variant: MISSING (slot vacío con dashed) ----
  missing: {
    backgroundColor: '#EDE7DA',
    borderColor: '#C9BFA7',
    borderStyle: 'dashed',
  },
  // ---- Variant: OWNED (blanco crema, acento verde) ----
  owned: {
    backgroundColor: '#FFFDF7',
    borderColor: '#00B86B',
  },
  // ---- Variant: REPEATED (blanco crema, acento azul) ----
  repeated: {
    backgroundColor: '#FFFDF7',
    borderColor: '#1E66D6',
  },
  // ---- Variant: SPECIAL (dorado holográfico) ----
  special: {
    backgroundColor: '#FFF4D6',
    borderColor: '#E8B400',
  },

  pressed: {
    transform: [{ scale: 0.97 }],
    shadowOpacity: 0.04,
  },

  specialShine: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '60%',
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ skewX: '-20deg' }],
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  number: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  numberMissing: {
    color: '#9C9381',
  },

  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 22,
    alignItems: 'center',
  },
  statusChipText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusChipTextMissing: {
    color: '#7A7060',
  },
  missingChip: { backgroundColor: 'transparent' },
  ownedChip: { backgroundColor: '#00B86B' },
  repeatedChip: { backgroundColor: '#1E66D6' },
  specialChip: { backgroundColor: '#E8B400' },

  label: {
    color: '#3A352B',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: spacing.xs,
  },
  labelMissing: {
    color: '#9C9381',
  },

  repeatedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    gap: 6,
  },
  repeatedButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1E66D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatedButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 16,
  },
  repeatedCount: {
    color: '#1E66D6',
    fontSize: 11,
    fontWeight: '900',
    minWidth: 22,
    textAlign: 'center',
  },
});
