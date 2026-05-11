import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Match } from '../../../services/matchingService';
import { formatDistance } from '../../../utils/distance';
import { colors, radii, spacing } from '../../../constants/theme';
import { ENABLE_PREMIUM_UI } from '../../../constants/featureFlags';
import { PremiumBadge } from '../../../components/PremiumBadge';

type Props = {
  match: Match;
  onPress: () => void;
  compact?: boolean;
};

const LAST_SEEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function formatLastSeen(ts?: number): string | null {
  if (!ts) return null;
  const diff = Date.now() - ts;
  if (diff < 0 || diff > LAST_SEEN_MAX_AGE_MS) return null;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 10) return 'Activo ahora';
  if (minutes < 60) return `Activo hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Activo hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

function buildLocationLine(city: string | undefined, country: string | undefined, distanceKm: number | null): string {
  const cityClean = city?.trim() || '';
  const countryClean = country?.trim() || '';
  if (cityClean) {
    return distanceKm != null ? `${cityClean} · a ${formatDistance(distanceKm)}` : cityClean;
  }
  if (countryClean) return countryClean;
  return 'Sin ubicación';
}

export function MatchRow({ match, onPress, compact }: Props) {
  const { user, score, distanceKm, isPerfectTrade, iNeedFromThem, theyNeedFromMe } = match;

  const repUp = user.reputationUp ?? 0;
  const repCount = user.reputationCount ?? 0;
  const isVerified = repCount >= 20 && repUp / repCount >= 0.85;

  const subtitle = buildLocationLine(user.city, user.country, distanceKm);
  const lastSeenLabel = formatLastSeen(user.lastSeenAt);
  const isOnline = lastSeenLabel === 'Activo ahora';

  return (
    <TouchableOpacity
      style={[
        styles.row,
        isPerfectTrade && styles.rowPerfect,
        compact && styles.rowCompact,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarWrap}>
        {user.photoUrl ? (
          <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{user.name?.[0] ?? '?'}</Text>
          </View>
        )}
        {isOnline ? <View style={styles.onlineDot} /> : null}
      </View>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text
            style={[
              styles.name,
              ENABLE_PREMIUM_UI && user.premium && styles.namePremium,
            ]}
            numberOfLines={1}
          >
            {user.name}
          </Text>
          {ENABLE_PREMIUM_UI && user.premium ? <PremiumBadge size="sm" /> : null}
          {isVerified ? <Text style={styles.verifiedDot}>✓</Text> : null}
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        <Text style={styles.breakdownLine} numberOfLines={1}>
          🔁 {iNeedFromThem} pedís · {theyNeedFromMe} ofrecés
        </Text>
        {lastSeenLabel ? (
          <Text style={styles.lastSeen} numberOfLines={1}>
            {lastSeenLabel}
          </Text>
        ) : null}
      </View>

      <View style={styles.scoreChip}>
        <Text style={styles.scoreNumber}>{score}</Text>
        <Text style={styles.scoreLabel}>match</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
    minHeight: 72,
  },
  rowCompact: {
    minHeight: 60,
    padding: spacing.xs,
  },
  rowPerfect: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  avatarWrap: {
    position: 'relative',
    width: 44,
    height: 44,
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
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: colors.surface,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  namePremium: {
    color: '#FFD700',
  },
  verifiedDot: {
    color: '#16A34A',
    fontSize: 12,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  breakdownLine: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  lastSeen: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  scoreChip: {
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    minWidth: 48,
  },
  scoreNumber: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  scoreLabel: {
    color: colors.textMuted,
    fontSize: 9,
  },
});
