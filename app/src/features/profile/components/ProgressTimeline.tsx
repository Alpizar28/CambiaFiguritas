import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useUserStore } from '../../../store/userStore';
import { useAlbumStore } from '../../../store/albumStore';
import {
  fetchLast14Days,
  recordDailyStatIfNeeded,
  type DailyStat,
} from '../../../services/dailyStatsService';
import { track } from '../../../services/analytics';
import { colors, radii, spacing } from '../../../constants/theme';

const BAR_COUNT = 14;

export function ProgressTimeline() {
  const uid = useUserStore((s) => s.user?.uid);
  const owned = useAlbumStore((s) => s.getStats().owned);
  const [stats, setStats] = useState<DailyStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!uid) return;
    (async () => {
      try {
        await recordDailyStatIfNeeded(uid, owned);
        const data = await fetchLast14Days(uid);
        if (!cancelled) {
          setStats(data);
          track({ name: 'progress_timeline_viewed' });
        }
      } catch (e) {
        if (!cancelled) setError('No se pudo cargar el histórico');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, owned]);

  if (!uid) return null;

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Tu progreso</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (stats === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Tu progreso</Text>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (stats.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Tu progreso</Text>
        <Text style={styles.empty}>
          Volvé mañana para ver tu evolución del álbum día a día.
        </Text>
      </View>
    );
  }

  const max = Math.max(...stats.map((s) => s.ownedCount), 1);
  const last = stats[stats.length - 1];
  const first = stats[0];
  const delta = last.ownedCount - first.ownedCount;
  const since = stats.length > 1 ? `${stats.length} días` : 'hoy';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Tu progreso</Text>
        <Text style={styles.delta}>
          {delta > 0 ? `+${delta}` : delta} en {since}
        </Text>
      </View>
      <View style={styles.chart}>
        {Array.from({ length: BAR_COUNT }).map((_, i) => {
          const stat = stats[stats.length - 1 - (BAR_COUNT - 1 - i)];
          if (!stat) {
            return (
              <View key={`empty-${i}`} style={styles.barColumn}>
                <View style={[styles.bar, { height: 4, opacity: 0.3 }]} />
              </View>
            );
          }
          const heightPct = (stat.ownedCount / max) * 100;
          return (
            <View key={stat.date} style={styles.barColumn}>
              <View
                style={[
                  styles.bar,
                  { height: `${Math.max(heightPct, 4)}%` as `${number}%` },
                ]}
              />
            </View>
          );
        })}
      </View>
      <Text style={styles.hint}>
        Hace {stats.length === 1 ? '1 día' : `${stats.length} días`} tenías {first.ownedCount}. Hoy: {last.ownedCount}.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  delta: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    gap: 4,
    width: '100%',
    overflow: 'hidden',
  },
  barColumn: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    backgroundColor: colors.primary,
    borderRadius: 2,
    width: '100%',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
});
