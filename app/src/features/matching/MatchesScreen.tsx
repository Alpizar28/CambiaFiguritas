import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useUserStore } from '../../store/userStore';
import { useAlbumStore } from '../../store/albumStore';
import { useMatchStore } from '../../store/matchStore';
import { findMatches, saveUserLocation } from '../../services/matchingService';
import { track } from '../../services/analytics';
import { MatchCard } from './components/MatchCard';
import { RadiusSelector } from './components/RadiusSelector';
// Metro elige automáticamente entre `MatchesMap.tsx` (native) y
// `MatchesMap.web.tsx` según la plataforma.
import { MatchesMap } from './components/MatchesMap';
import { AdBanner } from '../../components/AdBanner';
import { MatchCardSkeleton } from '../../components/Skeleton';
import { colors, radii, spacing } from '../../constants/theme';
import type { MatchesStackParamList } from '../../types/navigation';

const CACHE_MS = 60_000;

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchesList'>;
type Tab = 'list' | 'map';

export function MatchesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const uid = useUserStore((s) => s.user?.uid);
  const statuses = useAlbumStore((s) => s.statuses);
  const {
    matches,
    loading,
    error,
    lastFetched,
    radiusKm,
    setMatches,
    setLoading,
    setError,
    setRadiusKm,
  } = useMatchStore();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [tab, setTab] = useState<Tab>('list');

  const getLocation = useCallback(
    async (force = false): Promise<{ lat: number; lng: number } | null> => {
      if (!force && coordsRef.current) return coordsRef.current;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return null;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        coordsRef.current = next;
        setCoords(next);
        if (uid) saveUserLocation(uid, next.lat, next.lng).catch(() => {});
        return next;
      } catch {
        return null;
      }
    },
    [uid],
  );

  const runFetch = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const c = await getLocation();
      const result = await findMatches(uid, statuses, c?.lat, c?.lng, radiusKm);
      setMatches(result);
      track({ name: 'matches_searched', params: { matchesFound: result.length } });
    } catch (e) {
      setError('No se pudo cargar matches. Verificá tu conexión.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [uid, statuses, getLocation, radiusKm, setLoading, setError, setMatches]);

  const myRepeated = Object.values(statuses).filter((s) => s === 'repeated').length;
  const myMissing = Object.values(statuses).filter((s) => s === 'missing').length;
  const hasActivity = myRepeated > 0 || myMissing < Object.values(statuses).length;

  // Auto-fetch al montar y cuando cambia el radio. Respetar cache de 1 minuto.
  useEffect(() => {
    if (!uid || !hasActivity) return;
    const fresh = lastFetched && Date.now() - lastFetched < CACHE_MS;
    if (fresh && matches.length > 0) return;
    runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, hasActivity, radiusKm]);

  const refresh = useCallback(async () => {
    await runFetch();
  }, [runFetch]);

  const goToMatch = useCallback(
    (matchUid: string) => {
      const m = matches.find((x) => x.user.uid === matchUid);
      track({ name: 'match_opened', params: { matchUid, score: m?.score ?? 0 } });
      navigation.navigate('MatchProfile', { uid: matchUid });
    },
    [matches, navigation],
  );

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
      ) : (
        <View style={styles.tabsArea}>
          <View style={styles.tabsRow}>
            <TabBtn active={tab === 'list'} label="Lista" onPress={() => setTab('list')} />
            <TabBtn active={tab === 'map'} label="Mapa" onPress={() => setTab('map')} />
          </View>
          <RadiusSelector value={radiusKm} onChange={setRadiusKm} disabled={loading} />
          {lastFetched ? (
            <View style={styles.statusRow}>
              <Text style={styles.resultCount}>
                {matches.length} {matches.length === 1 ? 'match' : 'matches'}
              </Text>
              <TouchableOpacity onPress={refresh} disabled={loading}>
                <Text style={styles.refreshText}>{loading ? 'Buscando…' : 'Actualizar'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {tab === 'map' ? (
            <View style={styles.mapWrap}>
              <MatchesMap
                matches={matches}
                myLat={coords?.lat ?? null}
                myLng={coords?.lng ?? null}
                onSelect={goToMatch}
                onRequestPermission={() => {
                  getLocation(true);
                }}
              />
            </View>
          ) : (
            <FlatList
              data={matches}
              keyExtractor={(m) => m.user.uid}
              renderItem={({ item }) => (
                <MatchCard match={item} onPress={() => goToMatch(item.user.uid)} />
              )}
              contentContainerStyle={styles.list}
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
                    message={
                      radiusKm
                        ? `No hay matches a menos de ${radiusKm} km. Probá ampliar el radio o marcá más figuritas.`
                        : 'Aún no hay matches. Marcá más figuritas o esperá que se sumen coleccionistas.'
                    }
                  />
                ) : null
              }
              ListFooterComponent={matches.length > 0 ? <AdBanner inline /> : null}
            />
          )}
        </View>
      )}
    </View>
  );
}

function TabBtn({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
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
    paddingBottom: spacing.sm,
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
  tabsArea: {
    flex: 1,
    gap: spacing.md,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: colors.background,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
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
  list: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  mapWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    minHeight: 300,
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
