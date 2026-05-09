import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Match } from '../../../services/matchingService';
import { formatDistance } from '../../../utils/distance';
import { colors, radii, spacing } from '../../../constants/theme';
import { ENABLE_PREMIUM_UI } from '../../../constants/featureFlags';

type Props = {
  match: Match;
  onPress: () => void;
  compact?: boolean;
};

export function MatchRow({ match, onPress, compact }: Props) {
  const { user, score, distanceKm, isPerfectTrade, iNeedFromThem, theyNeedFromMe } = match;

  const repUp = user.reputationUp ?? 0;
  const repCount = user.reputationCount ?? 0;
  const isVerified = repCount >= 20 && repUp / repCount >= 0.85;

  const subtitleParts = [
    user.city || null,
    distanceKm != null ? `a ${formatDistance(distanceKm)}` : null,
  ].filter(Boolean);
  const subtitle = subtitleParts.join(' · ');

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
      {user.photoUrl ? (
        <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarLetter}>{user.name?.[0] ?? '?'}</Text>
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {user.name}
          </Text>
          {ENABLE_PREMIUM_UI && user.premium ? <Text style={styles.premiumStar}>⭐</Text> : null}
          {isVerified ? <Text style={styles.verifiedDot}>✓</Text> : null}
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle || 'Sin ubicación'}
        </Text>
        <Text style={styles.breakdownLine} numberOfLines={1}>
          🔁 {iNeedFromThem} pedís · {theyNeedFromMe} ofrecés
        </Text>
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
  premiumStar: {
    fontSize: 12,
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
