import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/userStore';
import { getRankings } from '../../services/rankingsService';
import type { RankingEntry, RankingScope } from '../../services/rankingsService';
import { track } from '../../services/analytics';
import { colors, radii, spacing } from '../../constants/theme';

const MEDALS: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

export function RankingsScreen() {
  const insets = useSafeAreaInsets();
  const userCity = useUserStore((s) => s.user?.city);
  const [scope, setScope] = useState<RankingScope>(userCity ? 'city' : 'global');
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    setError(null);
    try {
      const result = await getRankings(scope, userCity);
      setEntries(result);
      track({ name: 'rankings_viewed', params: { scope } });
    } catch (e) {
      setError('No se pudo cargar el ranking. Verificá tu conexión.');
    }
  }, [scope, userCity]);

  useEffect(() => {
    setLoading(true);
    fetchRankings().finally(() => setLoading(false));
  }, [fetchRankings]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRankings();
    setRefreshing(false);
  };

  const cityAvailable = Boolean(userCity);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Coleccionistas</Text>
        <Text style={styles.title}>Ranking</Text>
        <Text style={styles.subtitle}>Top 10 con más figuritas marcadas</Text>
      </View>

      <View style={styles.filterRow}>
        {cityAvailable ? (
          <Pressable
            onPress={() => setScope('city')}
            style={[styles.filter, scope === 'city' && styles.filterActive]}
          >
            <Text style={[styles.filterText, scope === 'city' && styles.filterTextActive]}>
              Mi ciudad
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => setScope('global')}
          style={[styles.filter, scope === 'global' && styles.filterActive]}
        >
          <Text style={[styles.filterText, scope === 'global' && styles.filterTextActive]}>
            Global
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={styles.emptyTitle}>Aún no hay ranking</Text>
          <Text style={styles.emptyMsg}>
            {scope === 'city'
              ? `No hay coleccionistas registrados en ${userCity}. Sé el primero compartiendo la app.`
              : 'Marcá tu álbum y aparecerá el ranking de mejores coleccionistas.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.uid}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          renderItem={({ item, index }) => (
            <RankingRow entry={item} position={index + 1} />
          )}
        />
      )}
    </View>
  );
}

function RankingRow({ entry, position }: { entry: RankingEntry; position: number }) {
  const isTop3 = position <= 3;
  const pct = Math.round((entry.ownedCount / entry.totalStickers) * 100);
  const repPercent =
    entry.reputationCount > 0
      ? Math.round((entry.reputationUp / entry.reputationCount) * 100)
      : null;

  return (
    <View style={[styles.row, isTop3 && styles.rowTop3]}>
      <View style={styles.positionBlock}>
        {MEDALS[position - 1] ? (
          <Text style={styles.medal}>{MEDALS[position - 1]}</Text>
        ) : (
          <Text style={styles.position}>#{position}</Text>
        )}
      </View>
      {entry.photoUrl ? (
        <Image source={{ uri: entry.photoUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarLetter}>{entry.name?.[0] ?? '?'}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{entry.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {entry.city || 'Sin ciudad'}
          {repPercent != null ? ` · 👍 ${repPercent}%` : ''}
        </Text>
      </View>
      <View style={styles.scoreBlock}>
        <Text style={styles.scoreNumber}>{entry.ownedCount}</Text>
        <Text style={styles.scoreLabel}>{pct}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextActive: {
    color: colors.background,
  },
  list: {
    padding: spacing.xl,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTop3: {
    backgroundColor: 'rgba(255,215,0,0.05)',
    borderColor: 'rgba(255,215,0,0.4)',
  },
  positionBlock: {
    width: 36,
    alignItems: 'center',
  },
  position: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  medal: {
    fontSize: 22,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  scoreBlock: {
    alignItems: 'flex-end',
    minWidth: 50,
  },
  scoreNumber: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  scoreLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyMsg: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});
