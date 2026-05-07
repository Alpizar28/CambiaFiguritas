import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '../../../constants/theme';
import { RADIUS_OPTIONS } from '../../../store/matchStore';

type Props = {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
};

export function RadiusSelector({ value, onChange, disabled }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Radio</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {RADIUS_OPTIONS.map((opt) => {
          const active = opt.value === value;
          return (
            <TouchableOpacity
              key={opt.label}
              style={[styles.chip, active && styles.chipActive, disabled && styles.disabled]}
              onPress={() => !disabled && onChange(opt.value)}
              disabled={disabled}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.xl,
  },
  row: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.background,
  },
  disabled: {
    opacity: 0.4,
  },
});
