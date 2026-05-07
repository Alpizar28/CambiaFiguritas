import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, spacing } from '../../../constants/theme';

type Props = {
  used: number;
  cap: number;
  resetAt: number;
  onWatchAd: () => void;
  onGoPremium: () => void;
  adAvailable: boolean;
  adReason?: string;
};

function formatResetIn(resetAt: number): string {
  const ms = Math.max(0, resetAt - Date.now());
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function MatchLockCard({
  used,
  cap,
  resetAt,
  onWatchAd,
  onGoPremium,
  adAvailable,
  adReason,
}: Props) {
  const resetIn = formatResetIn(resetAt);

  return (
    <View style={styles.card}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Llegaste al límite diario</Text>
      <Text style={styles.subtitle}>
        Usaste {used} de {cap} búsquedas hoy. Se resetea en {resetIn}.
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.adButton, !adAvailable && styles.adButtonDisabled]}
          onPress={onWatchAd}
          disabled={!adAvailable}
        >
          <Text style={styles.adButtonText}>
            🎬 Mirá un anuncio (+1 match)
          </Text>
          {adReason ? <Text style={styles.adButtonHint}>{adReason}</Text> : null}
        </TouchableOpacity>

        <TouchableOpacity style={styles.premiumButton} onPress={onGoPremium}>
          <Text style={styles.premiumButtonText}>✨ Hacete Premium · Ilimitado</Text>
          <Text style={styles.premiumButtonHint}>USD 2.99 · pago único</Text>
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
    fontSize: 40,
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
  adButton: {
    backgroundColor: colors.card,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  adButtonDisabled: {
    opacity: 0.5,
  },
  adButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  adButtonHint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  premiumButton: {
    backgroundColor: '#FFD700',
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  premiumButtonText: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '800',
  },
  premiumButtonHint: {
    color: '#0A0A0A',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
    marginTop: 2,
  },
});
