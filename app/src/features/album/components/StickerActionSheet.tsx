import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../../components/BottomSheet';
import { colors, radii, spacing } from '../../../constants/theme';
import type { Sticker, StickerStatus } from '../types';
import { haptic } from '../../../utils/haptics';

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
  if (!sticker) {
    return <BottomSheet visible={visible} onClose={onClose}><View /></BottomSheet>;
  }

  const setStatus = (s: StickerStatus) => {
    haptic.tap();
    onSelectStatus(s);
    onClose();
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
});
