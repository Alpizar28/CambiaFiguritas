import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../../../constants/theme';
import { CheckIcon } from './TradeIcons';

type StickerCheckRowProps = {
  stickerId: string;
  displayCode: string;
  label: string;
  countryName?: string;
  selected: boolean;
  disabled?: boolean;
  onToggle: (stickerId: string) => void;
};

export function StickerCheckRow({
  stickerId,
  displayCode,
  label,
  countryName,
  selected,
  disabled,
  onToggle,
}: StickerCheckRowProps) {
  return (
    <Pressable
      onPress={() => !disabled && onToggle(stickerId)}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && !disabled && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: disabled ?? false }}
    >
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected ? <CheckIcon size={14} color="#001A0A" /> : null}
      </View>
      <View style={styles.codeBubble}>
        <Text style={styles.codeText}>{displayCode}</Text>
      </View>
      <View style={styles.labelWrap}>
        <Text style={styles.label} numberOfLines={1}>
          {label || 'Jugador'}
        </Text>
        {countryName ? (
          <Text style={styles.country} numberOfLines={1}>
            {countryName}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: '#0F2A1A',
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  codeBubble: {
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
  },
  codeText: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  labelWrap: {
    flex: 1,
  },
  label: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  country: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
