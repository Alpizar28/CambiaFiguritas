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
import { useTradeStore } from '../../store/tradeStore';
import { HistoryIcon, QRScanIcon } from '../trade/components/TradeIcons';
import { findMatches } from '../../services/matchingService';
import { saveUserLocation, touchLastSeen } from '../../services/userService';
import { reverseGeocode } from '../../utils/geocoding';
import { consumeMatchSlot, unlockMatchSlot } from '../../services/matchSlotsService';
import { saveMatchBatch } from '../../services/matchHistoryService';
import { citySlug } from '../../utils/citySlug';
import { track } from '../../services/analytics';
import { shareText } from '../../utils/share';
import { vsCardToBlob, type VsCardConfig } from '../../utils/shareCard';
import { useGooglePhotoDataUrl } from '../../utils/useGooglePhotoDataUrl';
import { allStickers } from '../album/data/albumCatalog';
import type { Sticker } from '../album/types';
import { MatchRow } from './components/MatchRow';
import { MatchDetailModal } from './components/MatchDetailModal';
import { MatchHistoryScreen } from './MatchHistoryScreen';
import { MatchLockCard } from './components/MatchLockCard';
import { RewardedAdModal } from './components/RewardedAdModal';
import { PremiumCard } from '../profile/components/PremiumCard';
import { AdBanner } from '../../components/AdBanner';
import { MatchCardSkeleton } from '../../components/Skeleton';
import {
  cascadeZoneFilter,
  defaultZoneFilter,
  pickTopN,
  type ZoneFilter,
} from './utils/matchFilter';
import { sortMatches, isValidSort, type MatchSort } from './utils/matchSort';
import type { Match } from '../../services/matchingService';
import { colors, spacing, radii } from '../../constants/theme';
import { ENABLE_PREMIUM_UI } from '../../constants/featureFlags';
import type { RootTabParamList } from '../../types/navigation';
import { Modal } from 'react-native';

const stickerIndex = new Map<string, Sticker>(allStickers.map((s) => [s.id, s]));

const CACHE_MS = 60_000;
const FILTER_STORAGE_KEY = '@cf:matches:zoneFilter';
const SORT_STORAGE_KEY = '@cf:matches:sort';
const FREE_TOP_N = 5;
const PREMIUM_TOP_N = 10;

function appliedFilterLabel(filter: ZoneFilter): string {
  switch (filter) {
    case 'mi_ciudad':
      return 'tu ciudad';
    case '15km':
      return 'a 15 km';
    case '50km':
      return 'a 50 km';
    case 'todos':
      return 'todos';
    default:
      return '';
  }
}

type LockState = {
  used: number;
  cap: number;
  resetAt: number;
} | null;

type ListRow =
  | { type: 'header'; label: string; count: number }
  | { type: 'match'; match: Match };

export function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const user = useUserStore((s) => s.user);
  const uid = user?.uid;
  const isPremium = ENABLE_PREMIUM_UI && user?.premium === true;
  const rawStatuses = useAlbumStore((s) => s.statuses);
  const includeCocaCola = useAlbumStore((s) => s.includeCocaCola);
  const rawWishlist = useWishlistStore((s) => s.items);

  // Si el user no incluye Coca-Cola, filtrar CC* de statuses y wishlist para
  // que el matching no use esos stickers en el scoring.
  const statuses = useMemo(() => {
    if (includeCocaCola) return rawStatuses;
    const filtered: typeof rawStatuses = {};
    for (const id in rawStatuses) {
      if (!id.startsWith('CC')) filtered[id] = rawStatuses[id];
    }
    return filtered;
  }, [rawStatuses, includeCocaCola]);

  const wishlist = useMemo(() => {
    if (includeCocaCola) return rawWishlist;
    const filtered: typeof rawWishlist = {};
    for (const id in rawWishlist) {
      if (!id.startsWith('CC')) filtered[id] = rawWishlist[id];
    }
    return filtered;
  }, [rawWishlist, includeCocaCola]);
  const { matches, loading, error, lastFetched, setMatches, setLoading, setError } = useMatchStore();
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const filterInitializedRef = useRef(false);

  const [filter, setFilter] = useState<ZoneFilter>('todos');
  const [sort, setSort] = useState<MatchSort>('recommended');
  const sortInitializedRef = useRef(false);
  const [hasGps, setHasGps] = useState(false);
  const [lockState, setLockState] = useState<LockState>(null);
  const [adModal, setAdModal] = useState<{ visible: boolean; durationMs: number }>({ visible: false, durationMs: 15000 });
  const [adLoading, setAdLoading] = useState(false);
  const [adReason, setAdReason] = useState<string | undefined>(undefined);
  const [detailMatch, setDetailMatch] = useState<Match | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [vsPreview, setVsPreview] = useState<{ blob: Blob; objectUrl: string; match: Match } | null>(null);
  const [vsGenerating, setVsGenerating] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const myPhotoDataUrlRef = useGooglePhotoDataUrl(user?.photoUrl);

  const userCity = user?.city?.trim() ?? '';
  const userCitySlug = userCity ? citySlug(userCity) : null;
  const hasCity = Boolean(userCitySlug);

  const openVsPreview = async (match: Match) => {
    if (vsGenerating) return;
    setVsGenerating(true);
    try {
      const m = match;
      const isAnonymous = !!m.user.privacyAnonymous;
      const cfg: VsCardConfig = {
        myUid: uid ?? '',
        myName: user?.name ?? 'Yo',
        myPhotoUrl: myPhotoDataUrlRef.current ?? user?.photoUrl ?? undefined,
        myCity: user?.city ?? undefined,
        theirName: isAnonymous ? 'Coleccionista' : m.user.name,
        theirPhotoUrl: isAnonymous ? undefined : (m.user.photoUrl ?? undefined),
        theirCity: isAnonymous ? undefined : (m.user.city ?? undefined),
        iGiveIds: m.theyNeedIds,
        iGiveTotal: m.theyNeedFromMe,
        iReceiveIds: m.iNeedIds,
        iReceiveTotal: m.iNeedFromThem,
        isPerfectTrade: !!m.isPerfectTrade,
      };
      const blob = await vsCardToBlob(cfg);
      if (!blob) return;
      const objectUrl = URL.createObjectURL(blob);
      setVsPreview({ blob, objectUrl, match });
      track({ name: 'match_share_clicked', params: { isPerfectTrade: !!m.isPerfectTrade, matchUid: m.user.uid } });
    } finally {
      setVsGenerating(false);
    }
  };

  const closeVsPreview = () => {
    if (vsPreview) URL.revokeObjectURL(vsPreview.objectUrl);
    setVsPreview(null);
  };

  const doVsShare = async () => {
    if (!vsPreview) return;
    const fileName = 'match-cambiafiguritas.png';
    const navAny = navigator as unknown as Record<string, unknown>;
    const isAnonymous = !!vsPreview.match.user.privacyAnonymous;
    const theirName = isAnonymous ? 'alguien' : (vsPreview.match.user.name?.split(' ')[0] ?? 'alguien');
    if (typeof navAny['canShare'] === 'function' && typeof navAny['share'] === 'function') {
      try {
        const file = new File([vsPreview.blob], fileName, { type: 'image/png' });
        if ((navAny['canShare'] as (d: unknown) => boolean)({ files: [file] })) {
          await (navAny['share'] as (d: unknown) => Promise<void>)({
            files: [file],
            text: `¡Match con ${theirName}! cambiafiguritas.online`,
          });
          closeVsPreview();
          return;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    const a = document.createElement('a');
    a.href = vsPreview.objectUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    closeVsPreview();
  };

  const copyMatchList = async () => {
    if (!vsPreview) return;
    const m = vsPreview.match;
    const toCode = (id: string) => stickerIndex.get(id)?.displayCode ?? id;
    const giveList = m.theyNeedIds.map(toCode).join(', ');
    const receiveList = m.iNeedIds.map(toCode).join(', ');
    const isAnonymous = !!m.user.privacyAnonymous;
    const theirName = isAnonymous ? 'el match' : (m.user.name?.split(' ')[0] ?? 'el match');
    const text = [
      `Intercambio con ${theirName} — CambiaFiguritas`,
      '',
      `YO DOY (${m.theyNeedFromMe}): ${giveList}`,
      '',
      `YO RECIBO (${m.iNeedFromThem}): ${receiveList}`,
      '',
      `cambiafiguritas.online/u/${uid}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch { /* clipboard not available */ }
  };

  // Touch lastSeen al abrir la pantalla (throttle 5min en el service).
  useEffect(() => {
    if (uid) touchLastSeen(uid).catch(() => {});
  }, [uid]);

  // Restore sort persistido al primer mount
  useEffect(() => {
    if (sortInitializedRef.current) return;
    sortInitializedRef.current = true;
    AsyncStorage.getItem(SORT_STORAGE_KEY)
      .then((stored) => {
        if (stored && isValidSort(stored)) setSort(stored);
      })
      .catch(() => {});
  }, []);

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

  const { filteredMatches, appliedFilter, fellBack } = useMemo(() => {
    const result = cascadeZoneFilter(matches, filter, userCitySlug, hasGps);
    const capped = pickTopN(result.matches, isPremium ? PREMIUM_TOP_N : FREE_TOP_N);
    return {
      filteredMatches: sortMatches(capped, sort),
      appliedFilter: result.appliedFilter,
      fellBack: result.fellBack,
    };
  }, [matches, filter, userCitySlug, hasGps, isPremium, sort]);

  // Cuando hay matches perfectos y el sort no es perfect_first, separar en buckets
  // para renderizar la sección "Perfectos" sobre "Otros matches".
  const { perfectMatches, otherMatches } = useMemo(() => {
    if (sort === 'perfect_first') {
      return { perfectMatches: [] as Match[], otherMatches: filteredMatches };
    }
    const perfect: Match[] = [];
    const rest: Match[] = [];
    for (const m of filteredMatches) {
      if (m.isPerfectTrade) perfect.push(m);
      else rest.push(m);
    }
    return { perfectMatches: perfect, otherMatches: rest };
  }, [filteredMatches, sort]);

  const lastFellBackRef = useRef<string>('');
  useEffect(() => {
    if (!fellBack) return;
    const key = `${filter}->${appliedFilter}`;
    if (lastFellBackRef.current === key) return;
    lastFellBackRef.current = key;
    track({
      name: 'matches_filter_fellback',
      params: { preferred: filter, applied: appliedFilter },
    });
  }, [fellBack, filter, appliedFilter]);

  const handleFilterChange = (newFilter: ZoneFilter) => {
    setFilter(newFilter);
    AsyncStorage.setItem(FILTER_STORAGE_KEY, newFilter).catch(() => {});
    track({ name: 'matches_filter_changed', params: { filter: newFilter } });
  };

  const handleSortChange = (newSort: MatchSort) => {
    setSort(newSort);
    AsyncStorage.setItem(SORT_STORAGE_KEY, newSort).catch(() => {});
    track({ name: 'matches_sort_changed', params: { sort: newSort } });
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
      if (uid) {
        // Resolver país en background (cacheado por bucket de 5km) y persistir junto a coords.
        reverseGeocode(coords.lat, coords.lng)
          .then((label) => saveUserLocation(uid, coords.lat, coords.lng, label.country ?? undefined))
          .catch(() => {
            saveUserLocation(uid, coords.lat, coords.lng).catch(() => {});
          });
      }
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

      // Guardar batch en historial (top N filtrado con cascada, fire-and-forget)
      const cascadeResult = cascadeZoneFilter(result, filter, userCitySlug, hasGps);
      const batchToSave = pickTopN(
        cascadeResult.matches,
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
    track({ name: 'matches_referral_shared', params: { uid: uid ?? '' } });
    const refUrl = uid
      ? `https://cambiafiguritas.online?ref=${uid}`
      : 'https://cambiafiguritas.online';
    await shareText(
      '¡Sumate a CambiaFiguritas! Yo ya encontré matches para intercambiar figuritas del Mundial 2026. Entrá acá:',
      refUrl,
    );
  };

  const renderSortChip = (value: MatchSort, label: string) => {
    const active = sort === value;
    return (
      <Pressable
        key={value}
        onPress={() => handleSortChange(value)}
        style={[styles.sortChip, active && styles.sortChipActive]}
      >
        <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{label}</Text>
      </Pressable>
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
        <TouchableOpacity
          onPress={() => useTradeStore.getState().openModal({ kind: 'home' })}
          style={[styles.historyBtn, styles.tradeBtn]}
          accessibilityRole="button"
          accessibilityLabel="Intercambio presencial por QR"
        >
          <QRScanIcon size={14} color={colors.primary} />
          <Text style={[styles.historyBtnText, styles.tradeBtnText]}>QR Intercambio</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goToHistory} style={styles.historyBtn}>
          <HistoryIcon size={14} color={colors.text} />
          <Text style={styles.historyBtnText}>Historial</Text>
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
          message="Marcá las figuritas repetidas (toque doble) para intercambiarlas. Cuantos más amigos tengan la app, más matches encontrás."
          ctaLabel="Ir al álbum"
          onCta={goToAlbum}
          secondaryLabel="Invitar amigos"
          onSecondaryCta={handleShareInvite}
        />
      ) : myOwned < 10 ? (
        <EmptyState
          icon="📈"
          title={`Marcaste ${myOwned} figuritas`}
          message="Mejorás tus matches marcando al menos 10 figuritas. También podés invitar amigos para sumar coleccionistas cerca tuyo."
          ctaLabel="Seguir marcando"
          onCta={goToAlbum}
          secondaryLabel="Invitar amigos"
          onSecondaryCta={handleShareInvite}
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
          data={
            perfectMatches.length > 0 && sort !== 'perfect_first'
              ? ([
                  { type: 'header', label: 'Perfectos', count: perfectMatches.length },
                  ...perfectMatches.map((m) => ({ type: 'match' as const, match: m })),
                  ...(otherMatches.length > 0
                    ? [{ type: 'header' as const, label: 'Otros matches', count: otherMatches.length }]
                    : []),
                  ...otherMatches.map((m) => ({ type: 'match' as const, match: m })),
                ] as ListRow[])
              : (filteredMatches.map((m) => ({ type: 'match' as const, match: m })) as ListRow[])
          }
          keyExtractor={(item, index) =>
            item.type === 'match' ? item.match.user.uid : `header-${item.label}-${index}`
          }
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <View style={styles.sectionHeader}>
                <Text
                  style={[
                    styles.sectionHeaderText,
                    item.label === 'Perfectos' && styles.sectionHeaderPerfect,
                  ]}
                >
                  {item.label === 'Perfectos' ? '⭐ Perfectos' : item.label} · {item.count}
                </Text>
              </View>
            ) : (
              <MatchRow match={item.match} onPress={() => openVsPreview(item.match)} />
            )
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            <View>
              {ENABLE_PREMIUM_UI && !isPremium ? (
                <View style={styles.premiumBanner}>
                  <PremiumCard variant="compact" />
                </View>
              ) : null}
              {lastFetched ? (
                <>
                  <View style={styles.listHeader}>
                    <Text style={styles.resultCount}>
                      Top {filteredMatches.length} {ENABLE_PREMIUM_UI && isPremium ? '· premium' : ''}
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
                  <View style={styles.sortRow}>
                    <Text style={styles.sortLabel}>Ordenar:</Text>
                    {renderSortChip('recommended', 'Recomendado')}
                    {renderSortChip('closest', 'Cercanía')}
                    {renderSortChip('score', 'Score')}
                    {renderSortChip('perfect_first', 'Perfectos')}
                  </View>
                  {fellBack && filteredMatches.length > 0 ? (
                    <View style={styles.fallbackBanner}>
                      <Text style={styles.fallbackBannerText}>
                        {filter === 'mi_ciudad'
                          ? `Sin matches en ${userCity || 'tu ciudad'}. Mostrando ${appliedFilterLabel(appliedFilter)}.`
                          : `Mostrando resultados ampliados (${appliedFilterLabel(appliedFilter)}).`}
                      </Text>
                    </View>
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
                title="No hay matches en tu zona"
                message={
                  filter === 'mi_ciudad' && !hasGps
                    ? `No encontramos matches en ${userCity || 'tu ciudad'}. Activá la ubicación para buscar más lejos.`
                    : 'Por ahora no hay coleccionistas con figuritas que coincidan en ninguna distancia.'
                }
                ctaLabel="Compartir la app"
                onCta={handleShareInvite}
              />
            ) : null
          }
          ListFooterComponent={
            filteredMatches.length > 0 && !isPremium ? <AdBanner inline /> : null
          }
        />
      )}

      <MatchDetailModal match={detailMatch} onClose={() => setDetailMatch(null)} />

      {/* VS Preview Modal */}
      <Modal visible={!!vsPreview} transparent animationType="slide" onRequestClose={closeVsPreview}>
        <Pressable style={vsStyles.backdrop} onPress={closeVsPreview} />
        <View style={vsStyles.sheet}>
          <View style={vsStyles.handle} />
          <Text style={vsStyles.title}>Tu tarjeta de match</Text>
          {vsPreview ? (
            <img
              src={vsPreview.objectUrl}
              alt="match"
              style={{ width: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 12 } as React.CSSProperties}
            />
          ) : null}
          <TouchableOpacity style={vsStyles.shareBtn} onPress={doVsShare}>
            <Text style={vsStyles.shareBtnText}>Compartir foto</Text>
          </TouchableOpacity>
          <View style={vsStyles.actions}>
            <TouchableOpacity style={vsStyles.detailBtn} onPress={copyMatchList}>
              <Text style={vsStyles.detailBtnText}>{copyFeedback ? '✓ Copiado' : 'Copiar lista'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={vsStyles.detailBtn} onPress={() => { if (vsPreview) { setDetailMatch(vsPreview.match); closeVsPreview(); } }}>
              <Text style={vsStyles.detailBtnText}>Ver detalle</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={closeVsPreview} style={vsStyles.closeBtn}>
            <Text style={vsStyles.closeBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Loading indicator while generating VS */}
      <Modal visible={vsGenerating} transparent animationType="fade">
        <View style={vsStyles.loadingOverlay}>
          <View style={vsStyles.loadingCard}>
            <Text style={vsStyles.loadingText}>Generando tarjeta…</Text>
          </View>
        </View>
      </Modal>

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
  secondaryLabel,
  onSecondaryCta,
}: {
  icon: string;
  title?: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
  secondaryLabel?: string;
  onSecondaryCta?: () => void;
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
      {secondaryLabel && onSecondaryCta ? (
        <TouchableOpacity style={styles.ctaSecondary} onPress={onSecondaryCta}>
          <Text style={styles.ctaSecondaryText}>{secondaryLabel}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginLeft: spacing.xs,
  },
  historyBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  tradeBtn: {
    borderColor: colors.primary,
    backgroundColor: '#0F2A1A',
  },
  tradeBtnText: {
    color: colors.primary,
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
  fallbackBanner: {
    backgroundColor: '#FFF4D6',
    borderColor: '#E8B400',
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  fallbackBannerText: {
    color: '#A87600',
    fontSize: 12,
    fontWeight: '600',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    flexWrap: 'wrap',
  },
  sortLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginRight: spacing.xs,
  },
  sortChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sortChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  sortChipText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: colors.background,
  },
  sectionHeader: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  sectionHeaderText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionHeaderPerfect: {
    color: '#B8860B',
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
  ctaSecondary: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaSecondaryText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
});

const vsStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  handle: {
    width: 36, height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shareBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareBtnText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '800',
  },
  detailBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  closeBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
