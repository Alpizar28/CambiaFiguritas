import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Location from 'expo-location';
import { useUserStore } from '../../store/userStore';
import { useAlbumStore } from '../../store/albumStore';
import { useMatchStore } from '../../store/matchStore';
import { useWishlistStore } from '../../store/wishlistStore';
import { findMatches, saveUserLocation } from '../../services/matchingService';
import { consumeMatchSlot, unlockMatchSlot } from '../../services/matchSlotsService';
import { saveMatchBatch } from '../../services/matchHistoryService';
import { citySlug } from '../../utils/citySlug';
import { track } from '../../services/analytics';
import { shareText } from '../../utils/share';
import { MatchRow } from './components/MatchRow';
import { MatchDetailModal } from './components/MatchDetailModal';
import { MatchHistoryScreen } from './MatchHistoryScreen';
import { MatchLockCard } from './components/MatchLockCard';
import { RewardedAdModal } from './components/RewardedAdModal';
import { PremiumCard } from '../profile/components/PremiumCard';
import { AdBanner } from '../../components/AdBanner';
import { MatchCardSkeleton } from '../../components/Skeleton';
import {
  applyZoneFilter,
  defaultZoneFilter,
  pickTopN,
  type ZoneFilter,
} from './utils/matchFilter';
import type { Match } from '../../services/matchingService';
import { colors, spacing, radii } from '../../constants/theme';
import type { RootTabParamList } from '../../types/navigation';
import { Modal } from 'react-native';

const CACHE_MS = 60_000;
const FILTER_STORAGE_KEY = '@cf:matches:zoneFilter';
const FREE_TOP_N = 5;
const PREMIUM_TOP_N = 10;

type LockState = {
  used: number;
  cap: number;
  resetAt: number;
} | null;

export function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const user = useUserStore((s) => s.user);
  const uid = user?.uid;
  const isPremium = user?.premium === true;
  const statuses = useAlbumStore((s) => s.statuses);
  const wishlist = useWishlistStore((s) => s.items);
  const { matches, loading, error, lastFetched, setMatches, setLoading, setError } = useMatchStore();
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const filterInitializedRef = useRef(false);

  const [filter, setFilter] = useState<ZoneFilter>('todos');
  const [hasGps, setHasGps] = useState(false);
  const [lockState, setLockState] = useState<LockState>(null);
  const [adModal, setAdModal] = useState<{ visible: boolean; durationMs: number }>({ visible: false, durationMs: 15000 });
  const [adLoading, setAdLoading] = useState(false);
  const [adReason, setAdReason] = useState<string | undefined>(undefined);
  const [detailMatch, setDetailMatch] = useState<Match | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const userCity = user?.city?.trim() ?? '';
  const userCitySlug = userCity ? citySlug(userCity) : null;
  const hasCity = Boolean(userCitySlug);

  // Restore filter persistido al primer mount
  useEffect(() => {
    if (filterInitializedRef.current) return;
    filterInitializedRef.current = true;
    AsyncStorage.getItem(FILTER_STORAGE_KEY)
      .then((stored) => {
        const valid: ZoneFilter[] = ['mi_ciudad', '15km', '50km', 'todos'];
        if (stored && (valid as string[]).includes(stored)) {
          setFilter(stored as ZoneFilter);
        } else {
          const def = defaultZoneFilter(hasGps, hasCity);
          setFilter(def);
          track({
            name: 'matches_filter_default_chosen',
            params: { filter: def, hasGps, hasCity },
          });
        }
      })
      .catch(() => {
        // silent: usar default sin persistencia
        setFilter(defaultZoneFilter(hasGps, hasCity));
      });
  }, [hasGps, hasCity]);

  const filteredMatches = useMemo(() => {
    const filtered = applyZoneFilter(matches, filter, userCitySlug);
    return pickTopN(filtered, isPremium ? PREMIUM_TOP_N : FREE_TOP_N);
  }, [matches, filter, userCitySlug, isPremium]);

  const handleFilterChange = (newFilter: ZoneFilter) => {
    setFilter(newFilter);
    AsyncStorage.setItem(FILTER_STORAGE_KEY, newFilter).catch(() => {});
    track({ name: 'matches_filter_changed', params: { filter: newFilter } });
  };

  const getLocation = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    if (coordsRef.current) {
      setHasGps(true);
      return coordsRef.current;
    }
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      const status =
        perm.status === 'granted'
          ? perm.status
          : perm.canAskAgain
            ? (await Location.requestForegroundPermissionsAsync()).status
            : 'denied';
      if (status !== 'granted') {
        setHasGps(false);
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      coordsRef.current = coords;
      setHasGps(true);
      if (uid) saveUserLocation(uid, coords.lat, coords.lng).catch(() => {});
      return coords;
    } catch {
      setHasGps(false);
      return null;
    }
  }, [uid]);

  const runFetch = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const slot = await consumeMatchSlot();
      if (!slot.ok) {
        setLockState({ used: slot.cap, cap: slot.cap, resetAt: slot.resetAt });
        track({ name: 'match_limit_reached', params: { used: slot.cap, cap: slot.cap } });
        setMatches([]);
        return;
      }
      setLockState(null);
      const coords = await getLocation();
      const result = await findMatches(uid, statuses, wishlist, coords?.lat, coords?.lng, isPremium);
      setMatches(result);
      track({ name: 'matches_searched', params: { matchesFound: result.length } });

      // Guardar batch en historial (top N filtrado, fire-and-forget)
      const batchToSave = pickTopN(
        applyZoneFilter(result, filter, userCitySlug),
        isPremium ? PREMIUM_TOP_N : FREE_TOP_N,
      );
      if (batchToSave.length > 0) {
        saveMatchBatch(uid, {
          createdAt: Date.now(),
          filterUsed: filter,
          userCity: userCity || null,
          userLat: coords?.lat ?? null,
          userLng: coords?.lng ?? null,
          matches: batchToSave.map((m) => ({
            uid: m.user.uid,
            name: m.user.name,
            photoUrl: m.user.photoUrl,
            city: m.user.city || null,
            score: m.score,
            distanceKm: m.distanceKm,
            iNeedFromThem: m.iNeedFromThem,
            theyNeedFromMe: m.theyNeedFromMe,
            iNeedIds: m.iNeedIds,
            theyNeedIds: m.theyNeedIds,
            iNeedPriorityIds: m.iNeedPriorityIds,
            premium: m.user.premium === true,
            whatsapp: m.user.whatsapp ?? '',
          })),
        }).catch(() => {});
        track({
          name: 'match_batch_saved',
          params: { size: batchToSave.length, filter },
        });
      }
    } catch (e) {
      setError('No se pudo cargar matches. Verificá tu conexión.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [uid, statuses, wishlist, getLocation, isPremium, filter, userCitySlug, userCity, setLoading, setError, setMatches]);

  const fetch = useCallback(async () => {
    if (!uid) return;
    const now = Date.now();
    if (lastFetched && now - lastFetched < CACHE_MS) return;
    await runFetch();
  }, [uid, lastFetched, runFetch]);

  const refresh = useCallback(async () => {
    await runFetch();
  }, [runFetch]);

  const handleWatchAd = useCallback(async () => {
    if (adLoading) return;
    setAdLoading(true);
    setAdReason(undefined);
    try {
      const baseDuration = 15000;
      setAdModal({ visible: true, durationMs: baseDuration });
      track({ name: 'ad_rewarded_started' });
    } catch {
      setAdReason('No se pudo cargar el anuncio');
    } finally {
      setAdLoading(false);
    }
  }, [adLoading]);

  const handleAdComplete = useCallback(async () => {
    setAdModal({ ...adModal, visible: false });
    try {
      const result = await unlockMatchSlot();
      if (!result.granted) {
        setAdReason(
          result.reason === 'too_fast'
            ? 'Esperá un poco más'
            : result.reason === 'daily_ad_cap'
              ? 'Llegaste al límite de anuncios diarios'
              : 'No se pudo desbloquear',
        );
        return;
      }
      track({ name: 'ad_rewarded_completed', params: { durationMs: adModal.durationMs } });
      track({ name: 'match_slot_unlocked_via_ad', params: { adsWatchedToday: 0 } });
      setLockState(null);
      await runFetch();
    } catch {
      setAdReason('Error al desbloquear');
    }
  }, [adModal, runFetch]);

  const handleGoPremium = useCallback(() => {
    track({ name: 'premium_checkout_started' });
    navigation.navigate('Profile');
  }, [navigation]);

  const goToHistory = useCallback(() => {
    setHistoryOpen(true);
  }, []);

  const myRepeated = Object.values(statuses).filter((s) => s === 'repeated').length;
  const myMissing = Object.values(statuses).filter((s) => s === 'missing').length;
  const myOwned = Object.values(statuses).filter(
    (s) => s === 'owned' || s === 'repeated' || s === 'special',
  ).length;
  const hasActivity = myRepeated > 0 || myMissing < Object.values(statuses).length;

  const goToAlbum = () => {
    track({ name: 'matches_empty_cta_clicked', params: { reason: 'go_album' } });
    navigation.navigate('Album');
  };

  const goToProfile = () => {
    navigation.navigate('Profile');
  };

  const handleShareInvite = async () => {
    track({ name: 'matches_empty_cta_clicked', params: { reason: 'invite' } });
    await shareText(
      '¡Sumate a CambiaFiguritas para intercambiar figuritas del Mundial 2026!',
      'https://cambiafiguritas.web.app',
    );
  };

  const renderFilterChip = (
    value: ZoneFilter,
    label: string,
    disabled: boolean,
    onDisabledTap?: () => void,
  ) => {
    const active = filter === value;
    return (
      <Pressable
        key={value}
        onPress={() => (disabled ? onDisabledTap?.() : handleFilterChange(value))}
        style={[
          styles.filterChip,
          active && styles.filterChipActive,
          disabled && styles.filterChipDisabled,
        ]}
      >
        <Text
          style={[
            styles.filterChipText,
            active && styles.filterChipTextActive,
            disabled && styles.filterChipTextDisabled,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Intercambios cerca tuyo</Text>
          <Text style={styles.title}>Matches</Text>
        </View>
        <TouchableOpacity onPress={goToHistory} style={styles.historyBtn}>
          <Text style={styles.historyBtnText}>📜 Historial</Text>
        </TouchableOpacity>
      </View>

      {!hasActivity ? (
        <EmptyState
          icon="📋"
          title="Empezá a marcar tu álbum"
          message="Para encontrar matches con otros usuarios, marcá las figuritas que ya tenés y las que te faltan."
          ctaLabel="Ir al álbum"
          onCta={goToAlbum}
        />
      ) : myRepeated === 0 ? (
        <EmptyState
          icon="🔁"
          title="Aún no tenés repetidas"
          message="Marcá las figuritas que tenés repetidas (toque doble) para que otros usuarios puedan intercambiarlas con vos."
          ctaLabel="Ir al álbum"
          onCta={goToAlbum}
        />
      ) : myOwned < 10 ? (
        <EmptyState
          icon="📈"
          title={`Marcaste ${myOwned} figuritas`}
          message="Mejorás tus matches marcando al menos 10 figuritas. Los algoritmos recomiendan mejor con más datos tuyos."
          ctaLabel="Seguir marcando"
          onCta={goToAlbum}
        />
      ) : lockState ? (
        <MatchLockCard
          used={lockState.used}
          cap={lockState.cap}
          resetAt={lockState.resetAt}
          onWatchAd={handleWatchAd}
          onGoPremium={handleGoPremium}
          adAvailable={!adLoading}
          adReason={adReason}
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
          renderItem={({ item }) => (
            <MatchRow match={item} onPress={() => setDetailMatch(item)} />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            <View>
              {!isPremium ? (
                <View style={styles.premiumBanner}>
                  <PremiumCard variant="compact" />
                </View>
              ) : null}
              {lastFetched ? (
                <>
                  <View style={styles.listHeader}>
                    <Text style={styles.resultCount}>
                      Top {filteredMatches.length} {isPremium ? '· premium' : ''}
                      {filter !== 'todos' && matches.length > filteredMatches.length
                        ? ` · de ${matches.length} totales`
                        : ''}
                    </Text>
                    <TouchableOpacity onPress={refresh} disabled={loading}>
                      <Text style={styles.refreshText}>{loading ? 'Buscando...' : 'Actualizar'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.filterRow}>
                    {renderFilterChip('mi_ciudad', 'Mi ciudad', !hasCity, goToProfile)}
                    {renderFilterChip('15km', '15 km', !hasGps, () => getLocation())}
                    {renderFilterChip('50km', '50 km', !hasGps, () => getLocation())}
                    {renderFilterChip('todos', 'Todos', false)}
                  </View>
                  {!hasGps && (filter === '15km' || filter === '50km') ? (
                    <Text style={styles.filterHint}>
                      💡 Permití ubicación para usar este filtro.
                    </Text>
                  ) : null}
                  {!hasCity && filter === 'mi_ciudad' ? (
                    <Text style={styles.filterHint}>
                      💡 Cargá tu ciudad en Perfil para usar este filtro.
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
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
            ) : lastFetched && matches.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="Aún no hay matches"
                message="Todavía no encontramos otros usuarios con figuritas que coincidan con las tuyas. Compartí la app con tus amigos para sumar más coleccionistas."
                ctaLabel="Compartir la app"
                onCta={handleShareInvite}
              />
            ) : matches.length > 0 && filteredMatches.length === 0 ? (
              <EmptyState
                icon="🎯"
                title="No hay matches en esta zona"
                message={
                  filter === 'mi_ciudad'
                    ? `No encontramos matches en ${userCity || 'tu ciudad'}. Probá ampliar el radio.`
                    : 'Probá ampliar el radio para ver más matches.'
                }
                ctaLabel="Ver todos"
                onCta={() => handleFilterChange('todos')}
              />
            ) : null
          }
          ListFooterComponent={
            filteredMatches.length > 0 && !isPremium ? <AdBanner inline /> : null
          }
        />
      )}

      <MatchDetailModal match={detailMatch} onClose={() => setDetailMatch(null)} />

      <Modal
        visible={historyOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <MatchHistoryScreen onClose={() => setHistoryOpen(false)} />
      </Modal>

      <RewardedAdModal
        visible={adModal.visible}
        durationMs={adModal.durationMs}
        onComplete={handleAdComplete}
        onDismiss={() => setAdModal({ ...adModal, visible: false })}
      />
    </View>
  );
}

function EmptyState({
  icon,
  title,
  message,
  ctaLabel,
  onCta,
}: {
  icon: string;
  title?: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      {title ? <Text style={styles.emptyTitle}>{title}</Text> : null}
      <Text style={styles.emptyMessage}>{message}</Text>
      {ctaLabel && onCta ? (
        <TouchableOpacity style={styles.ctaButton} onPress={onCta}>
          <Text style={styles.ctaButtonText}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
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
  historyBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    padding: spacing.xl,
  },
  premiumBanner: {
    marginBottom: spacing.md,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  resultCount: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  refreshText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
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
  filterChipDisabled: {
    opacity: 0.5,
  },
  filterChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: colors.background,
  },
  filterChipTextDisabled: {
    color: colors.textMuted,
  },
  filterHint: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
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
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyMessage: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  ctaButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 15,
  },
});
