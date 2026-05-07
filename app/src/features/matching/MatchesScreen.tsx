import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useUserStore } from '../../store/userStore';
import { useAlbumStore } from '../../store/albumStore';
import { useMatchStore } from '../../store/matchStore';
import { findMatches, saveUserLocation } from '../../services/matchingService';
import { track } from '../../services/analytics';
import { Pressable } from 'react-native';
import { MatchCard } from './components/MatchCard';
import { AdBanner } from '../../components/AdBanner';
import { MatchCardSkeleton } from '../../components/Skeleton';
import { colors, spacing, radii } from '../../constants/theme';

const CACHE_MS = 60_000;

export function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const uid = useUserStore((s) => s.user?.uid);
  const statuses = useAlbumStore((s) => s.statuses);
  const { matches, loading, error, lastFetched, setMatches, setLoading, setError } = useMatchStore();
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);

  type MatchFilter = 'all' | 'nearby' | 'high_score';
  const [filter, setFilter] = useState<MatchFilter>('all');

  const filteredMatches = useMemo(() => {
    if (filter === 'nearby') {
      return matches.filter((m) => m.distanceKm != null && m.distanceKm <= 50);
    }
    if (filter === 'high_score') {
      return matches.filter((m) => m.score >= 5);
    }
    return matches;
  }, [matches, filter]);

  const handleFilterChange = (newFilter: MatchFilter) => {
    setFilter(newFilter);
    track({ name: 'matches_filter_changed', params: { filter: newFilter } });
  };

  const getLocation = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    if (coordsRef.current) return coordsRef.current;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      coordsRef.current = coords;
      if (uid) saveUserLocation(uid, coords.lat, coords.lng).catch(() => {});
      return coords;
    } catch {
      return null;
    }
  }, [uid]);

  const runFetch = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const coords = await getLocation();
      const result = await findMatches(uid, statuses, coords?.lat, coords?.lng);
      setMatches(result);
      track({ name: 'matches_searched', params: { matchesFound: result.length } });
    } catch (e) {
      setError('No se pudo cargar matches. Verificá tu conexión.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [uid, statuses, getLocation]);

  const fetch = useCallback(async () => {
    if (!uid) return;
    const now = Date.now();
    if (lastFetched && now - lastFetched < CACHE_MS) return;
    await runFetch();
  }, [uid, lastFetched, runFetch]);

  const refresh = useCallback(async () => {
    await runFetch();
  }, [runFetch]);

  const myRepeated = Object.values(statuses).filter((s) => s === 'repeated').length;
  const myMissing = Object.values(statuses).filter((s) => s === 'missing').length;
  const hasActivity = myRepeated > 0 || myMissing < Object.values(statuses).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Intercambios</Text>
        <Text style={styles.title}>Matches</Text>
      </View>

      {!hasActivity ? (
        <EmptyState
          icon="📋"
          message="Marcá figuritas en tu album para encontrar matches"
        />
      ) : matches.length === 0 && !loading && !lastFetched ? (
        <View style={styles.center}>
          <TouchableOpacity style={styles.fetchButton} onPress={fetch}>
            <Text style={styles.fetchButtonText}>Buscar matches</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredMatches}
          keyExtractor={(m) => m.user.uid}
          renderItem={({ item }) => <MatchCard match={item} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            lastFetched ? (
              <View>
                <View style={styles.listHeader}>
                  <Text style={styles.resultCount}>
                    {filteredMatches.length} {filteredMatches.length === 1 ? 'match' : 'matches'}
                    {filter !== 'all' && ` (de ${matches.length})`}
                  </Text>
                  <TouchableOpacity onPress={refresh} disabled={loading}>
                    <Text style={styles.refreshText}>{loading ? 'Buscando...' : 'Actualizar'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.filterRow}>
                  {([
                    { v: 'all' as const, label: 'Todos' },
                    { v: 'nearby' as const, label: 'Cerca (<50km)' },
                    { v: 'high_score' as const, label: 'Mejor match' },
                  ]).map((f) => (
                    <Pressable
                      key={f.v}
                      onPress={() => handleFilterChange(f.v)}
                      style={[styles.filterChip, filter === f.v && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, filter === f.v && styles.filterChipTextActive]}>
                        {f.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            loading ? (
              <View style={{ gap: spacing.md, padding: spacing.xl }}>
                <MatchCardSkeleton />
                <MatchCardSkeleton />
                <MatchCardSkeleton />
              </View>
            ) : error ? (
              <EmptyState icon="⚠️" message={error} />
            ) : lastFetched ? (
              <EmptyState
                icon="🔍"
                message="No hay matches por ahora. Marcá más figuritas o esperá que otros usuarios se sumen."
              />
            ) : null
          }
          ListFooterComponent={filteredMatches.length > 0 ? <AdBanner inline /> : null}
        />
      )}
    </View>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
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
  list: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  resultCount: {
    color: colors.textMuted,
    fontSize: 13,
  },
  refreshText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    minHeight: 300,
  },
  fetchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  fetchButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyMessage: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
});
