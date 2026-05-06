import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import type { Match } from '../../../services/matchingService';
import { formatDistance } from '../../../utils/distance';
import { track } from '../../../services/analytics';
import { colors, spacing, radii } from '../../../constants/theme';

type Props = { match: Match };

export function MatchCard({ match }: Props) {
  const { user, iNeedFromThem, theyNeedFromMe, score, distanceKm } = match;

  const openWhatsApp = () => {
    const phone = user.whatsapp?.replace(/\D/g, '');
    const msg = encodeURIComponent('Hola! Te vi en CambiaFiguritas, ¿intercambiamos figuritas del Mundial?');
    track({ name: 'match_whatsapp_clicked', params: { matchUid: user.uid } });
    Linking.openURL(`https://wa.me/${phone}?text=${msg}`);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {user.photoUrl ? (
          <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{user.name?.[0] ?? '?'}</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{user.name}</Text>
          <Text style={styles.city}>
            {[user.city, distanceKm != null ? formatDistance(distanceKm) : null]
              .filter(Boolean)
              .join(' · ') || 'Sin ubicación'}
          </Text>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreNumber}>{score}</Text>
          <Text style={styles.scoreLabel}>matches</Text>
        </View>
      </View>

      <View style={styles.breakdown}>
        <Pill label={`${iNeedFromThem} necesito`} color={colors.owned} />
        <Pill label={`${theyNeedFromMe} necesitan`} color={colors.repeated} />
      </View>

      {user.whatsapp ? (
        <TouchableOpacity style={styles.waButton} onPress={openWhatsApp}>
          <Text style={styles.waText}>Contactar por WhatsApp</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  city: {
    color: colors.textMuted,
    fontSize: 13,
  },
  scoreBadge: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  scoreNumber: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  scoreLabel: {
    color: colors.textMuted,
    fontSize: 10,
  },
  breakdown: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  waButton: {
    backgroundColor: '#25D366',
    borderRadius: radii.sm,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  waText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
