import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '../../../constants/theme';

type Props = {
  onShareLocation: () => void;
  onSetCity: () => void;
  permissionPermanentlyDenied?: boolean;
};

export function NoLocationBanner({
  onShareLocation,
  onSetCity,
  permissionPermanentlyDenied,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>📍</Text>
      <Text style={styles.title}>Necesitamos saber dónde estás</Text>
      <Text style={styles.subtitle}>
        Eventos se filtran por zona. Compartí tu ubicación o cargá tu ciudad para ver
        encuentros cerca tuyo.
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={onShareLocation}>
          <Text style={styles.primaryButtonText}>
            {permissionPermanentlyDenied
              ? '⚙️ Abrir ajustes para activar'
              : '📍 Compartir ubicación'}
          </Text>
          {permissionPermanentlyDenied ? (
            <Text style={styles.primaryButtonHint}>
              Permitir Ubicación en Ajustes del navegador
            </Text>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onSetCity}>
          <Text style={styles.secondaryButtonText}>🏙️ Cargar mi ciudad</Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 48,
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
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '800',
  },
  primaryButtonHint: {
    color: colors.background,
    fontSize: 11,
    opacity: 0.8,
    marginTop: 2,
  },
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
