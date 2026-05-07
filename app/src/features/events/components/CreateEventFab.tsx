import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radii } from '../../../constants/theme';

type Props = {
  onPress: () => void;
  bottomInset: number;
};

export function CreateEventFab({ onPress, bottomInset }: Props) {
  const bottom = Math.max(bottomInset, 16) + 80;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.fab, { bottom }]}
      onPress={onPress}
      accessibilityLabel="Crear evento"
      accessibilityRole="button"
    >
      <Text style={styles.icon}>+</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      },
      default: {
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
    }),
  } as object,
  icon: {
    color: colors.background,
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 36,
    marginTop: -2,
  },
});
