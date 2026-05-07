import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '../../../constants/theme';

type Props = {
  cityName?: string;
  onCreate: () => void;
};

export function EmptyZoneState({ cityName, onCreate }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>🌟</Text>
      <Text style={styles.title}>¿Sos el primero en tu zona?</Text>
      <Text style={styles.subtitle}>
        {cityName
          ? `Todavía no hay eventos en ${cityName}. Creá uno y juntá a coleccionistas cerca tuyo.`
          : 'Todavía no hay eventos en tu zona. Creá uno y juntá a coleccionistas cerca tuyo.'}
      </Text>
      <TouchableOpacity style={styles.button} onPress={onCreate}>
        <Text style={styles.buttonText}>+ Crear evento</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.xl,
    margin: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    fontSize: 56,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  buttonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '800',
  },
});
