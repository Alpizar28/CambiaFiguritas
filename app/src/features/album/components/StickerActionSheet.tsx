import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../../components/BottomSheet';
import { colors, radii, spacing } from '../../../constants/theme';
import type { Sticker, StickerStatus } from '../types';
import { haptic } from '../../../utils/haptics';
import { useWishlistStore } from '../../../store/wishlistStore';
import { useTutorialStore } from '../../../store/tutorialStore';

type Props = {
  visible: boolean;
  sticker: Sticker | null;
  status: StickerStatus;
  repeatedCount: number;
  onSelectStatus: (status: StickerStatus) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onClose: () => void;
};

export function StickerActionSheet({
  visible,
  sticker,
  status,
  repeatedCount,
  onSelectStatus,
  onIncrement,
  onDecrement,
  onClose,
}: Props) {
  const isWishlisted = useWishlistStore((s) => (sticker ? s.isWishlisted(sticker.id) : false));
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const tutorialDone = useTutorialStore((s) => Boolean(s.completed['sticker-wishlist']));

  if (!sticker) {
    return <BottomSheet visible={visible} onClose={onClose}><View /></BottomSheet>;
  }

  const setStatus = (s: StickerStatus) => {
    haptic.tap();
    onSelectStatus(s);
    onClose();
  };

  const handleWishlistToggle = () => {
    haptic.tap();
    toggleWishlist(sticker.id);
    useTutorialStore.getState().complete('sticker-wishlist');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.code}>{sticker.displayCode}</Text>
        <Text style={styles.label}>{sticker.label}</Text>
      </View>

      <View style={styles.statusRow}>
        <StatusButton
          active={status === 'missing'}
          color={colors.textMuted}
          label="Falta"
          onPress={() => setStatus('missing')}
        />
        <StatusButton
          active={status === 'owned'}
          color="#00B86B"
          label="Tengo"
          onPress={() => setStatus('owned')}
        />
        <StatusButton
          active={status === 'repeated'}
          color="#1E66D6"
          label="Repe"
          onPress={() => setStatus('repeated')}
        />
      </View>

      {(status === 'repeated' || repeatedCount > 0) && (
        <View style={styles.counterSection}>
          <Text style={styles.counterLabel}>Cantidad de repetidas</Text>
          <View style={styles.counterRow}>
            <Pressable
              style={styles.counterButton}
              onPress={() => { haptic.tap(); onDecrement(); }}
            >
              <Text style={styles.counterButtonText}>−</Text>
            </Pressable>
            <Text style={styles.counterValue}>{repeatedCount}</Text>
            <Pressable
              style={styles.counterButton}
              onPress={() => { haptic.tap(); onIncrement(); }}
            >
              <Text style={styles.counterButtonText}>+</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Pressable
        style={[styles.wishlistRow, isWishlisted && styles.wishlistRowActive]}
        onPress={handleWishlistToggle}
      >
        <Text style={styles.wishlistIcon}>{isWishlisted ? '⭐' : '☆'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.wishlistTitle}>
            {isWishlisted ? 'Es prioridad' : 'Marcar como prioridad'}
            {!tutorialDone ? <Text style={styles.wishlistNew}>  · Nuevo</Text> : null}
          </Text>
          <Text style={styles.wishlistSubtitle}>
            Las prioridades pesan más al buscar matches.
          </Text>
        </View>
      </Pressable>
    </BottomSheet>
  );
}

function StatusButton({
  active,
  color,
  label,
  onPress,
}: {
  active: boolean;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.statusButton,
        { borderColor: color },
        active && { backgroundColor: color },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.statusButtonText, active && styles.statusButtonTextActive, !active && { color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: 4,
  },
  code: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  counterSection: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  counterLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  counterButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E66D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
  },
  counterValue: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
    minWidth: 60,
    textAlign: 'center',
  },
  wishlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  wishlistRowActive: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.08)',
  },
  wishlistIcon: {
    fontSize: 28,
    color: '#FFD700',
  },
  wishlistTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  wishlistNew: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
  },
  wishlistSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
