import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '../constants/theme';

type Props = {
  onPress: () => void;
  label?: string;
};

export function TradeFab({ onPress, label = 'Intercambiar' }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.fab,
        { bottom: insets.bottom + spacing.lg },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
    >
      <Text style={styles.icon}>⇄</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radii.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.85,
  },
  icon: {
    fontSize: 22,
    color: '#001A0A',
    fontWeight: '900',
  },
  label: {
    color: '#001A0A',
    fontSize: 14,
    fontWeight: '800',
  },
});
