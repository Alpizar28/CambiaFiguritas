import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '../constants/theme';

type Props = {
  onPress: () => void;
  label?: string;
};

export function ScanFab({ onPress, label = 'Escanear' }: Props) {
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <Pressable
      style={[
        styles.fab,
        { bottom: insets.bottom + spacing.lg },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
    >
      <Text style={styles.icon}>📷</Text>
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
  icon: {
    fontSize: 18,
  },
  label: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
});
