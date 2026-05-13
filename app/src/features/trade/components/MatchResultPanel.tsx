import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GuestMatchedExchange } from '../../../services/guestTradeService';
import { shareText } from '../../../utils/share';
import { colors, radii, spacing } from '../../../constants/theme';

type MatchResultPanelProps = {
  hostName: string;
  matched: GuestMatchedExchange;
};

function buildWhatsAppMessage(hostName: string, matched: GuestMatchedExchange): string {
  const lines: string[] = [];
  lines.push(`¡Intercambio con ${hostName}!`);
  lines.push('');
  if (matched.hostGives.length > 0) {
    lines.push(`Te paso (${matched.hostGives.length}):`);
    lines.push(matched.hostGives.join(', '));
    lines.push('');
  }
  if (matched.hostReceives.length > 0) {
    lines.push(`Necesito de vos (${matched.hostReceives.length}):`);
    lines.push(matched.hostReceives.join(', '));
  }
  return lines.join('\n');
}

export function MatchResultPanel({ hostName, matched }: MatchResultPanelProps) {
  const gives = matched.hostGives;
  const receives = matched.hostReceives;
  const total = gives.length + receives.length;

  const handleShareWhatsApp = async () => {
    const msg = buildWhatsAppMessage(hostName, matched);
    await shareText(msg);
  };

  if (total === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>No encontramos coincidencias</Text>
        <Text style={styles.emptyText}>
          No hay figuritas en común entre lo que ofreces y lo que {hostName} necesita.
          Probá revisar tu lista o pedile a {hostName} otra lista.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Intercambio sugerido</Text>
      <Text style={styles.subtitle}>{total} figuritas en juego</Text>

      <View style={styles.row}>
        <Text style={styles.colHeading}>{hostName} te pasa</Text>
        <Text style={styles.colCount}>{gives.length}</Text>
      </View>
      <Text style={styles.list}>{gives.length > 0 ? gives.join(', ') : '—'}</Text>

      <View style={styles.row}>
        <Text style={styles.colHeading}>Vos le pasás</Text>
        <Text style={styles.colCount}>{receives.length}</Text>
      </View>
      <Text style={styles.list}>{receives.length > 0 ? receives.join(', ') : '—'}</Text>

      <Pressable
        onPress={handleShareWhatsApp}
        style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
      >
        <Text style={styles.shareLabel}>Compartir por WhatsApp</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '900' },
  subtitle: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  colHeading: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  colCount: { color: colors.accent, fontWeight: '900', fontSize: 18 },
  list: { color: colors.text, fontSize: 14, lineHeight: 20 },
  shareBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  shareLabel: { color: '#001A0A', fontSize: 16, fontWeight: '900' },
  pressed: { opacity: 0.85 },
  emptyWrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
});
