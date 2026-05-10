import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radii, spacing } from '../../constants/theme';
import { getCountryAccent, pickReadableTextOn, tintWithAlpha } from './utils/countryAccent';
import { useAlbumStore } from '../../store/albumStore';
import { CountryInfoSlot, GroupInfoSlot } from './components/AlbumInfoSlot';
import { AlbumProgress } from './components/AlbumProgress';
import { ConnectedStickerCard } from './components/ConnectedStickerCard';
import { StickerActionSheet } from './components/StickerActionSheet';
import { allStickers, cocaColaStickerGroup, countryStickerGroups, specialStickerGroup } from './data/albumCatalog';
import { getGroupCountries } from './data/countries';
import { haptic } from '../../utils/haptics';
import { track } from '../../services/analytics';
import { Tooltip } from '../../components/Tooltip';
import { useUserStore } from '../../store/userStore';

import { ShareCardModal } from '../profile/components/ShareCardModal';
import { ScanFab } from '../../components/ScanFab';
import { ScanScreen } from '../scan/ScanScreen';
import type { AlbumSlot, CountryAlbumPage, Sticker, StickerStatus } from './types';
import { fuzzyContains } from './utils/fuzzyMatch';

type AlbumFilter = 'all' | StickerStatus;

const filters: Array<{ label: string; value: AlbumFilter }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Faltan', value: 'missing' },
  { label: 'Tengo', value: 'owned' },
  { label: 'Repes', value: 'repeated' },
  { label: 'Especiales', value: 'special' },
];

const baseStickerGroups = countryStickerGroups.concat(specialStickerGroup);

// parseDirectCode toma stickerGroups como param porque depende de includeCocaCola
// (el grupo CC solo aparece cuando el toggle esta on).
function makeParseDirectCode(
  stickerGroups: typeof baseStickerGroups,
  stickersByCode: Map<string, { sticker: Sticker; groupIndex: number }>,
) {
  // Detecta búsqueda por código directo: "ARG12", "FWC1", "12 argentina", "argentina 12"
  return function parseDirectCode(rawQuery: string): { sticker: Sticker; groupIndex: number } | null {
    const q = rawQuery.trim().toLowerCase();
    if (q.length < 2) return null;
    const direct = stickersByCode.get(q);
    if (direct) return direct;
    if (/^fw\d+$/.test(q)) {
      const aliased = stickersByCode.get(`fwc${q.slice(2)}`);
      if (aliased) return aliased;
    }
    const numMatch = q.match(/^(.+?)\s+(\d{1,3})$|^(\d{1,3})\s+(.+)$/);
    if (!numMatch) return null;
    const word = (numMatch[1] || numMatch[4] || '').trim();
    const num = numMatch[2] || numMatch[3];
    if (!word || !num) return null;
    const groupIdx = stickerGroups.findIndex(
      (g) =>
        g.country.name.toLowerCase().includes(word) ||
        g.country.code.toLowerCase() === word.toLowerCase(),
    );
    if (groupIdx < 0) return null;
    const group = stickerGroups[groupIdx];
    const numInt = parseInt(num, 10);
    const sticker = group.stickers.find((s) => s.slotNumber === numInt);
    if (!sticker) return null;
    return { sticker, groupIndex: groupIdx };
  };
}

const matchesQuery = (sticker: Sticker, normalizedQuery: string) => {
  if (normalizedQuery.length === 0) return true;
  const fields = [
    sticker.countryName ?? '',
    sticker.group ?? '',
    sticker.displayCode,
    sticker.label,
    sticker.kind,
  ];
  for (const f of fields) {
    if (fuzzyContains(f.toLowerCase(), normalizedQuery)) return true;
  }
  return String(sticker.slotNumber).includes(normalizedQuery);
};

const getGroupStats = (stickers: Sticker[], statuses: Record<string, StickerStatus>) => {
  const owned = stickers.filter((sticker) => {
    const status = statuses[sticker.id];
    return status === 'owned' || status === 'repeated' || status === 'special';
  }).length;
  const repeated = stickers.filter((sticker) => statuses[sticker.id] === 'repeated').length;
  return { total: stickers.length, owned, repeated };
};

// "Tengo" engloba owned + repeated + special: no se puede tener repetida sin
// poseer la base, así que el filtro debe coincidir con el contador de getGroupStats.
const matchesAlbumFilter = (status: StickerStatus, filter: AlbumFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'owned') {
    return status === 'owned' || status === 'repeated' || status === 'special';
  }
  return status === filter;
};

const COUNTRY_BTN_WIDTH = 70;

export function AlbumScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 900;
  const uid = useUserStore((s) => s.user?.uid);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [activeCountryPage, setActiveCountryPage] = useState<1 | 2>(1);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<AlbumFilter>('all');
  const [highlightedStickerId, setHighlightedStickerId] = useState<string | null>(null);

  // Bottom sheet unico para web y mobile.
  const [sheetStickerId, setSheetStickerId] = useState<string | null>(null);

  const countryScrollerRef = useRef<ScrollView>(null);
  const pagerRef = useRef<ScrollView>(null);

  const statuses = useAlbumStore((state) => state.statuses);
  const repeatedCounts = useAlbumStore((state) => state.repeatedCounts);
  const setStatus = useAlbumStore((state) => state.setStatus);
  const incrementRepeated = useAlbumStore((state) => state.incrementRepeated);
  const decrementRepeated = useAlbumStore((state) => state.decrementRepeated);
  const getStats = useAlbumStore((state) => state.getStats);
  const includeCocaCola = useAlbumStore((s) => s.includeCocaCola);
  const setIncludeCocaCola = useAlbumStore((s) => s.setIncludeCocaCola);

  const stickerGroups = useMemo(
    () => (includeCocaCola ? baseStickerGroups.concat(cocaColaStickerGroup) : baseStickerGroups),
    [includeCocaCola],
  );

  const stickersByCode = useMemo(() => {
    const map = new Map<string, { sticker: Sticker; groupIndex: number }>();
    stickerGroups.forEach((group, groupIndex) => {
      group.stickers.forEach((sticker) => {
        map.set(sticker.displayCode.toLowerCase(), { sticker, groupIndex });
      });
    });
    return map;
  }, [stickerGroups]);

  const parseDirectCode = useMemo(
    () => makeParseDirectCode(stickerGroups, stickersByCode),
    [stickerGroups, stickersByCode],
  );

  const safeActiveIndex = Math.min(activeGroupIndex, stickerGroups.length - 1);
  const activeGroup = stickerGroups[safeActiveIndex];
  const activeAccent = getCountryAccent(activeGroup.country.code);
  const activeAccentTint = tintWithAlpha(activeAccent, 0.12);
  const stats = getStats();
  const activeStats = getGroupStats(activeGroup.stickers, statuses);

  const handleShareCard = () => {
    haptic.tap();
    track({ name: 'share_album_clicked', params: { stats: 'header_card' } });
    setShareModalOpen(true);
  };
  const normalizedQuery = query.trim().toLowerCase();
  // 'especiales' (FW) y 'cocacola' (CC) usan grid plano, sin layout 2-paginas.
  const isSpecials = activeGroup.country.id === 'especiales' || activeGroup.country.id === 'cocacola';
  // Toggle Coca-Cola solo se ofrece desde la pestania Especiales (no desde CC).
  const showCocaToggle = activeGroup.country.id === 'especiales';

  // Si query matchea metadata del país activo (nombre/código/grupo),
  // mostrar todas las figuritas del país en vez de filtrar individualmente.
  const queryMatchesCountryMeta =
    normalizedQuery.length >= 2 &&
    (activeGroup.country.name.toLowerCase().includes(normalizedQuery) ||
      activeGroup.country.code.toLowerCase().includes(normalizedQuery) ||
      !!activeGroup.country.group?.toLowerCase().includes(normalizedQuery));
  const effectiveQuery = queryMatchesCountryMeta ? '' : normalizedQuery;

  const stickersById = useMemo(
    () =>
      activeGroup.stickers.reduce<Record<string, Sticker>>((acc, sticker) => {
        acc[sticker.id] = sticker;
        return acc;
      }, {}),
    [activeGroup],
  );

  const visibleStickers = useMemo(
    () =>
      activeGroup.stickers.filter((sticker) => {
        const status = statuses[sticker.id] ?? 'missing';
        return matchesAlbumFilter(status, activeFilter) && matchesQuery(sticker, effectiveQuery);
      }),
    [activeGroup, statuses, activeFilter, effectiveQuery],
  );

  // Auto-scroll al país activo
  useEffect(() => {
    countryScrollerRef.current?.scrollTo({
      x: Math.max(0, activeGroupIndex * (COUNTRY_BTN_WIDTH + spacing.xs) - width / 3),
      animated: true,
    });
  }, [activeGroupIndex, width]);

  // Búsqueda directa por código: "ARG12", "FWC1", "12 argentina"
  // Si hay match exacto: salta al país + highlight 2.5s
  useEffect(() => {
    const direct = parseDirectCode(normalizedQuery);
    if (!direct) {
      setHighlightedStickerId(null);
      return;
    }
    if (direct.groupIndex !== activeGroupIndex) {
      setActiveGroupIndex(direct.groupIndex);
    }
    setActiveFilter('all');
    setHighlightedStickerId(direct.sticker.id);
    track({
      name: 'sticker_searched_by_code',
      params: { code: direct.sticker.displayCode, matched: true },
    });
    const timer = setTimeout(() => setHighlightedStickerId(null), 2500);
    return () => clearTimeout(timer);
  }, [normalizedQuery]);

  // Auto-saltar al primer país que matchea cuando hay query (fallback no-código)
  useEffect(() => {
    if (normalizedQuery.length < 2) return;
    if (parseDirectCode(normalizedQuery)) return; // direct code maneja jump
    if (activeGroup.stickers.some((s) => matchesQuery(s, normalizedQuery))) return;
    const matchIndex = stickerGroups.findIndex((g) =>
      g.country.name.toLowerCase().includes(normalizedQuery) ||
      g.country.code.toLowerCase().includes(normalizedQuery) ||
      g.country.group?.toLowerCase().includes(normalizedQuery) ||
      g.stickers.some((s) => matchesQuery(s, normalizedQuery)),
    );
    if (matchIndex >= 0 && matchIndex !== activeGroupIndex) {
      setActiveGroupIndex(matchIndex);
    }
  }, [normalizedQuery]);

  // Sugerencias: países que matchean el query (para mostrar lista clickeable)
  const querySuggestions = useMemo(() => {
    if (normalizedQuery.length < 2) return [];
    return stickerGroups
      .map((group, index) => {
        const nameMatch = group.country.name.toLowerCase().includes(normalizedQuery);
        const codeMatch = group.country.code.toLowerCase().includes(normalizedQuery);
        const groupMatch = group.country.group?.toLowerCase().includes(normalizedQuery);
        const stickerMatches = group.stickers.filter((s) => matchesQuery(s, normalizedQuery)).length;
        const score = (nameMatch ? 100 : 0) + (codeMatch ? 50 : 0) + (groupMatch ? 30 : 0) + stickerMatches;
        return { group, index, score, stickerMatches };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [normalizedQuery]);

  // Reset page al cambiar de país
  useEffect(() => {
    setActiveCountryPage(1);
    pagerRef.current?.scrollTo({ x: 0, animated: false });
  }, [activeGroupIndex]);

  const moveCountry = (direction: -1 | 1) => {
    haptic.tap();
    setActiveGroupIndex((current) => {
      const total = stickerGroups.length;
      return (current + direction + total) % total;
    });
  };

  const handleLongPress = useCallback(
    (stickerId: string, _event: { nativeEvent: { pageX: number; pageY: number } }) => {
      haptic.medium();
      // Bottom sheet unico para web y mobile. Long-press y context-menu (web)
      // pasan por aca.
      setSheetStickerId(stickerId);
    },
    [],
  );

  const closeSheet = () => setSheetStickerId(null);

  const handleSelectStatus = (stickerId: string, status: StickerStatus) => {
    setStatus(stickerId, status);
  };

  const shouldShowSticker = (sticker: Sticker) => {
    const status = statuses[sticker.id] ?? 'missing';
    return matchesAlbumFilter(status, activeFilter) && matchesQuery(sticker, effectiveQuery);
  };

  const renderSlot = (slot: AlbumSlot, index: number) => {
    if (slot.type === 'country_info') {
      return (
        <CountryInfoSlot
          key={`country-info-${index}`}
          code={activeGroup.country.code}
          group={activeGroup.country.group}
          name={activeGroup.country.name}
          flag={activeGroup.country.flag}
        />
      );
    }
    if (slot.type === 'group_info') {
      return (
        <GroupInfoSlot
          key={`group-info-${index}`}
          group={activeGroup.country.group}
          countries={getGroupCountries(activeGroup.country.group)}
          activeCountryId={activeGroup.country.id}
        />
      );
    }
    const sticker = stickersById[slot.stickerId];
    if (!sticker || !shouldShowSticker(sticker)) {
      return (
        <View
          key={`empty-${slot.stickerId}`}
          style={slot.colSpan === 2 ? styles.emptyDoubleSlot : styles.emptySlot}
        />
      );
    }
    return (
      <ConnectedStickerCard
        key={sticker.id}
        sticker={sticker}
        colSpan={slot.colSpan}
        highlighted={highlightedStickerId === sticker.id}
        onLongPress={handleLongPress}
      />
    );
  };

  const renderAlbumPage = (page: CountryAlbumPage, pageWidth?: number) => (
    <View
      key={page.pageInCountry}
      style={[styles.albumPage, pageWidth != null ? { width: pageWidth } : { alignSelf: 'stretch' }]}
    >
      <View style={styles.pageTopline}>
        <Text style={styles.pageLabel}>Pagina {page.pageInCountry}</Text>
        <Text style={styles.pageCode}>{activeGroup.country.code}</Text>
      </View>
      <View style={styles.originalGrid}>{page.slots.map(renderSlot)}</View>
    </View>
  );

  const sheetSticker = sheetStickerId ? stickersById[sheetStickerId] ?? null : null;

  // ----- MOBILE LAYOUT -----
  if (!isDesktop) {
    const pageWidth = undefined; // móvil: ancho natural 100%
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Tooltip
          id="album-search"
          title="🔎 Buscá rápido"
          message="Escribí 'ARG12' o 'argentina 12' para saltar directo a esa figurita."
          position="top"
        />
        {/* Header compacto sticky */}
        <View
          style={[
            styles.mobileHeader,
            { backgroundColor: activeAccentTint, borderBottomColor: activeAccent, borderBottomWidth: 2 },
          ]}
        >
          <View style={styles.mobileTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mobileKicker, { color: activeAccent }]}>Album Mundial 2026</Text>
              <Text style={styles.mobileTitle} numberOfLines={1}>
                {activeGroup.country.flag ? `${activeGroup.country.flag} ` : ''}{activeGroup.country.name}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Compartir tu figurita"
              onPress={handleShareCard}
              style={styles.shareAlbumBtn}
            >
              <Text style={styles.shareAlbumIcon}>⬆</Text>
              <Text style={styles.shareAlbumText}>Compartir figurita</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Buscar"
              onPress={() => { haptic.tap(); setSearchOpen((v) => !v); }}
              style={styles.iconButton}
            >
              <Text style={styles.iconButtonText}>{searchOpen ? '×' : '⌕'}</Text>
            </Pressable>
          </View>

          <View style={styles.mobileStatsRow}>
            <Text style={styles.mobileStatsText}>
              {activeGroup.country.group} · {activeStats.owned}/{activeStats.total} ·{' '}
              {activeStats.repeated} repes
            </Text>
            <Text style={styles.mobileGlobalText}>
              Total: <Text style={styles.mobileGlobalNumber}>{stats.owned}/{stats.total}</Text>
            </Text>
          </View>

          {/* Barra de progreso compacta inline */}
          <View style={styles.mobileProgressBar}>
            <View style={[styles.mobileProgressFill, { width: `${Math.min(100, Math.max(0, stats.progress))}%` as any }]} />
          </View>

          {showCocaToggle && (
            <Pressable
              onPress={() => { haptic.tap(); setIncludeCocaCola(!includeCocaCola); }}
              style={styles.cocaToggleRow}
              accessibilityLabel="Incluir subcoleccion Coca-Cola"
            >
              <Text style={styles.cocaToggleText} numberOfLines={1}>
                Coca-Cola (12) — {includeCocaCola ? 'incluida' : 'no incluida'}
              </Text>
              <View style={[styles.cocaSwitch, includeCocaCola && styles.cocaSwitchOn]}>
                <View style={[styles.cocaSwitchKnob, includeCocaCola && styles.cocaSwitchKnobOn]} />
              </View>
            </Pressable>
          )}

          {searchOpen && (
            <View>
              <View style={styles.searchCardMobile}>
                <TextInput
                  accessibilityLabel="Buscar figuritas"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  onChangeText={setQuery}
                  placeholder="Buscar pais, grupo o codigo"
                  placeholderTextColor="#7C857F"
                  style={styles.searchInput}
                  value={query}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')} style={styles.clearButton}>
                    <Text style={styles.clearButtonText}>×</Text>
                  </Pressable>
                )}
              </View>
              {querySuggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {querySuggestions.map(({ group, index, stickerMatches }) => (
                    <Pressable
                      key={group.country.id}
                      onPress={() => {
                        haptic.tap();
                        setActiveGroupIndex(index);
                        setQuery('');
                        setSearchOpen(false);
                      }}
                      style={styles.suggestionRow}
                    >
                      <Text style={styles.suggestionCode}>{group.country.code}</Text>
                      <Text style={styles.suggestionName} numberOfLines={1}>
                        {group.country.flag ? `${group.country.flag} ` : ''}{group.country.name}
                      </Text>
                      {stickerMatches > 0 && (
                        <Text style={styles.suggestionMatches}>{stickerMatches} fig</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollerMobile}>
            <View style={styles.filterRow}>
              {filters.map((filter) => {
                const isActive = filter.value === activeFilter;
                return (
                  <Pressable
                    key={filter.value}
                    onPress={() => { haptic.tap(); setActiveFilter(filter.value); }}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Selector de país */}
          <View style={styles.countryNavigatorMobile}>
            <Pressable
              accessibilityLabel="Pais anterior"
              onPress={() => moveCountry(-1)}
              style={styles.countryNavButton}
            >
              <Text style={styles.countryNavText}>‹</Text>
            </Pressable>

            <ScrollView
              ref={countryScrollerRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.countryScroller}
              contentContainerStyle={styles.countryScrollerContent}
            >
              {stickerGroups.map((group, index) => {
                const isActive = index === activeGroupIndex;
                const groupStats = getGroupStats(group.stickers, statuses);
                const isComplete = groupStats.total > 0 && groupStats.owned === groupStats.total;
                const groupAccent = getCountryAccent(group.country.code);
                const activeText = pickReadableTextOn(groupAccent);
                return (
                  <Pressable
                    key={group.country.id}
                    onPress={() => { haptic.tap(); setActiveGroupIndex(index); }}
                    style={[
                      styles.countryButton,
                      isActive && styles.countryButtonActive,
                      isActive && { backgroundColor: groupAccent, borderColor: groupAccent },
                      isComplete && !isActive && styles.countryButtonComplete,
                    ]}
                  >
                    {isComplete && <Text style={styles.completeBadge}>✓</Text>}
                    <Text
                      style={[
                        styles.countryButtonText,
                        isActive && styles.countryButtonTextActive,
                        isActive && { color: activeText },
                      ]}
                    >
                      {group.country.code}
                    </Text>
                    <Text
                      style={[
                        styles.countryProgress,
                        isActive && styles.countryProgressActive,
                        isActive && { color: activeText, opacity: 0.85 },
                      ]}
                    >
                      {groupStats.owned}/{groupStats.total}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              accessibilityLabel="Pais siguiente"
              onPress={() => moveCountry(1)}
              style={styles.countryNavButton}
            >
              <Text style={styles.countryNavText}>›</Text>
            </Pressable>
          </View>
        </View>

        {/* Páginas — scroll vertical, una debajo de la otra */}
        <ScrollView
          style={styles.mobileScroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 120, gap: spacing.sm }}
          showsVerticalScrollIndicator={false}
        >
          {isSpecials ? (
            <View style={styles.mobilePage}>
              <View style={styles.originalGrid}>
                {visibleStickers.map((sticker) => (
                  <ConnectedStickerCard
                    key={sticker.id}
                    sticker={sticker}
                    highlighted={highlightedStickerId === sticker.id}
                    onLongPress={handleLongPress}
                  />
                ))}
              </View>
            </View>
          ) : (
            activeGroup.pages.map((item) => renderAlbumPage(item, pageWidth))
          )}
        </ScrollView>

        <StickerActionSheet
          visible={!!sheetSticker}
          sticker={sheetSticker}
          status={sheetStickerId ? statuses[sheetStickerId] ?? 'missing' : 'missing'}
          repeatedCount={sheetStickerId ? repeatedCounts[sheetStickerId] ?? 0 : 0}
          onSelectStatus={(s) => sheetStickerId && handleSelectStatus(sheetStickerId, s)}
          onIncrement={() => sheetStickerId && incrementRepeated(sheetStickerId)}
          onDecrement={() => sheetStickerId && decrementRepeated(sheetStickerId)}
          onClose={closeSheet}
        />
      <ShareCardModal visible={shareModalOpen} onClose={() => setShareModalOpen(false)} />
      {/* ScanFab oculto temporalmente */}
      <ScanScreen visible={scanOpen} onClose={() => setScanOpen(false)} />
      </View>
    );
  }

  // ----- DESKTOP LAYOUT -----
  const pagesToRender = activeGroup.pages;
  const desktopContentWidth = Math.min(width, 1220) - spacing.lg * 2;
  const desktopPageWidth = (desktopContentWidth - spacing.sm * 3) / 2;
  return (
    <View style={styles.screen}>
      <Tooltip
        id="album-search"
        title="🔎 Buscá rápido"
        message="Escribí 'ARG12' o 'argentina 12' para saltar directo a esa figurita."
        position="top"
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.workspace}>
          <View
            style={[
              styles.toolbar,
              { backgroundColor: activeAccentTint, borderLeftColor: activeAccent, borderLeftWidth: 4 },
            ]}
          >
            <View style={styles.titleBlock}>
              <Text style={[styles.kicker, { color: activeAccent }]}>Album Mundial 2026</Text>
              <Text style={styles.title}>{activeGroup.country.flag ? `${activeGroup.country.flag} ` : ''}{activeGroup.country.name}</Text>
              <Text style={styles.subtitle}>
                {activeGroup.country.group} · {activeStats.owned}/{activeStats.total} ·{' '}
                {activeStats.repeated} repetidas
              </Text>
              {showCocaToggle && (
                <Pressable
                  onPress={() => setIncludeCocaCola(!includeCocaCola)}
                  style={[styles.cocaToggleRow, styles.cocaToggleDesktop]}
                  accessibilityLabel="Incluir subcoleccion Coca-Cola"
                >
                  <Text style={styles.cocaToggleText} numberOfLines={1}>
                    Coca-Cola (12) — {includeCocaCola ? 'incluida' : 'no incluida'}
                  </Text>
                  <View style={[styles.cocaSwitch, includeCocaCola && styles.cocaSwitchOn]}>
                    <View style={[styles.cocaSwitchKnob, includeCocaCola && styles.cocaSwitchKnobOn]} />
                  </View>
                </Pressable>
              )}
            </View>
            <View style={styles.progressWrap}>
              <AlbumProgress {...stats} />
            </View>
          </View>

          <View style={[styles.controlsRow, { zIndex: 100 }]}>
            <View style={{ position: 'relative', flexBasis: 320, zIndex: 100 }}>
              <View style={styles.searchCard}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setQuery}
                  placeholder="Buscar pais, grupo o codigo"
                  placeholderTextColor="#7C857F"
                  style={styles.searchInput}
                  value={query}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')} style={styles.clearButton}>
                    <Text style={styles.clearButtonText}>Limpiar</Text>
                  </Pressable>
                )}
              </View>
              {querySuggestions.length > 0 && (
                <View style={[styles.suggestions, styles.suggestionsDesktop]}>
                  {querySuggestions.map(({ group, index, stickerMatches }) => (
                    <Pressable
                      key={group.country.id}
                      onPress={() => {
                        setActiveGroupIndex(index);
                        setQuery('');
                      }}
                      style={styles.suggestionRow}
                    >
                      <Text style={styles.suggestionCode}>{group.country.code}</Text>
                      <Text style={styles.suggestionName} numberOfLines={1}>
                        {group.country.flag ? `${group.country.flag} ` : ''}{group.country.name}
                      </Text>
                      {stickerMatches > 0 && (
                        <Text style={styles.suggestionMatches}>{stickerMatches} fig</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller}>
              <View style={styles.filterRow}>
                {filters.map((filter) => {
                  const isActive = filter.value === activeFilter;
                  return (
                    <Pressable
                      key={filter.value}
                      onPress={() => setActiveFilter(filter.value)}
                      style={[styles.filterChip, isActive && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                        {filter.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <View style={styles.countryNavigator}>
            <Pressable onPress={() => moveCountry(-1)} style={styles.countryNavButton}>
              <Text style={styles.countryNavText}>‹</Text>
            </Pressable>

            <ScrollView
              ref={countryScrollerRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.countryScroller}
            >
              <View style={styles.countryRow}>
                {stickerGroups.map((group, index) => {
                  const isActive = index === activeGroupIndex;
                  const groupStats = getGroupStats(group.stickers, statuses);
                  return (
                    <Pressable
                      key={group.country.id}
                      onPress={() => setActiveGroupIndex(index)}
                      style={[styles.countryButton, isActive && styles.countryButtonActive]}
                    >
                      <Text style={[styles.countryButtonText, isActive && styles.countryButtonTextActive]}>
                        {group.country.code}
                      </Text>
                      <Text style={[styles.countryProgress, isActive && styles.countryProgressActive]}>
                        {groupStats.owned}/{groupStats.total}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Pressable onPress={() => moveCountry(1)} style={styles.countryNavButton}>
              <Text style={styles.countryNavText}>›</Text>
            </Pressable>
          </View>

          {isSpecials ? (
            <View style={styles.specialPanel}>
              <View style={styles.specialGrid}>
                {visibleStickers.map((sticker) => (
                  <ConnectedStickerCard
                    key={sticker.id}
                    sticker={sticker}
                    highlighted={highlightedStickerId === sticker.id}
                    onLongPress={handleLongPress}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.desktopSpread}>
              {pagesToRender.map((p) => renderAlbumPage(p, desktopPageWidth))}
              <View pointerEvents="none" style={styles.bookFold} />
            </View>
          )}

        </View>
      </ScrollView>
      <ShareCardModal visible={shareModalOpen} onClose={() => setShareModalOpen(false)} />
      {/* ScanFab oculto temporalmente */}
      <ScanScreen visible={scanOpen} onClose={() => setScanOpen(false)} />
      <StickerActionSheet
        visible={!!sheetSticker}
        sticker={sheetSticker}
        status={sheetStickerId ? statuses[sheetStickerId] ?? 'missing' : 'missing'}
        repeatedCount={sheetStickerId ? repeatedCounts[sheetStickerId] ?? 0 : 0}
        onSelectStatus={(s) => sheetStickerId && handleSelectStatus(sheetStickerId, s)}
        onIncrement={() => sheetStickerId && incrementRepeated(sheetStickerId)}
        onDecrement={() => sheetStickerId && decrementRepeated(sheetStickerId)}
        onClose={closeSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#0A0A0A',
    flex: 1,
  },

  // ----- MOBILE -----
  mobileHeader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: '#0A0A0A',
    gap: spacing.md,
  },
  mobileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  mobileKicker: {
    color: '#FFD600',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  mobileTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  mobileStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  mobileStatsText: {
    color: '#B0B0B0',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  mobileGlobalText: {
    color: '#666666',
    fontSize: 11,
    fontWeight: '700',
  },
  mobileGlobalNumber: {
    color: '#FFD600',
    fontWeight: '900',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    borderColor: '#333',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  shareAlbumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,214,0,0.12)',
    borderColor: '#FFD600',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  shareAlbumIcon: {
    color: '#FFD600',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 16,
  },
  shareAlbumText: {
    color: '#FFD600',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  searchCardMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
  },
  suggestions: {
    backgroundColor: '#1A1A1A',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: radii.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  suggestionsDesktop: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    marginHorizontal: 0,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 1000,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    gap: spacing.sm,
  },
  suggestionCode: {
    color: '#FFD600',
    fontSize: 12,
    fontWeight: '900',
    minWidth: 40,
  },
  suggestionName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  suggestionMatches: {
    color: '#B0B0B0',
    fontSize: 11,
    fontWeight: '700',
  },
  filterScrollerMobile: {
    flexGrow: 0,
    paddingHorizontal: spacing.md,
  },
  countryNavigatorMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  countryScrollerContent: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  mobileProgressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    overflow: 'hidden',
    marginHorizontal: spacing.md,
  },
  mobileProgressFill: {
    height: 4,
    backgroundColor: '#FFD600',
    borderRadius: 2,
  },
  cocaToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    backgroundColor: 'rgba(244,0,9,0.10)',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(244,0,9,0.40)',
  },
  cocaToggleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  cocaSwitch: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    padding: 2,
    justifyContent: 'center',
  },
  cocaSwitchOn: {
    backgroundColor: '#F40009',
  },
  cocaSwitchKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  cocaSwitchKnobOn: {
    alignSelf: 'flex-end',
  },
  cocaToggleDesktop: {
    marginHorizontal: 0,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mobileScroll: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  mobilePage: {
    backgroundColor: '#FAF6E8',
    borderColor: '#E8DEC2',
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  // ----- COMPARTIDO -----
  workspace: {
    alignSelf: 'center',
    maxWidth: 1220,
    padding: spacing.lg,
    width: '100%',
  },
  toolbar: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    width: '100%',
  },
  titleBlock: { flex: 1 },
  kicker: {
    color: '#FFD600',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: '#B0B0B0',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  progressWrap: { flex: 1, maxWidth: 480, justifyContent: 'center' },
  controlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchCard: {
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderColor: '#333333',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: '#FFFFFF',
    flex: 1,
    fontSize: 15,
    minHeight: 44,
  },
  clearButton: {
    backgroundColor: '#333333',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 32,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  filterScroller: {
    flexGrow: 0,
    maxWidth: 460,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: 'rgba(51,51,51,0.5)',
    borderColor: '#333',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 38,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: '#FFD600',
    borderColor: '#FFD600',
  },
  filterText: {
    color: '#B0B0B0',
    fontSize: 12,
    fontWeight: '900',
  },
  filterTextActive: {
    color: '#0A0A0A',
  },
  countryNavigator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
    zIndex: 1,
  },
  countryNavButton: {
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderColor: '#333',
    borderRadius: radii.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  countryNavText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
  },
  countryScroller: {
    flex: 1,
  },
  countryRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingRight: spacing.lg,
  },
  countryButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(51,51,51,0.5)',
    borderColor: '#333',
    borderRadius: radii.md,
    borderWidth: 1,
    minWidth: COUNTRY_BTN_WIDTH,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  countryButtonActive: {
    backgroundColor: '#FFD600',
    borderColor: '#FFD600',
  },
  countryButtonComplete: {
    borderColor: '#00C853',
    backgroundColor: 'rgba(0,200,83,0.15)',
  },
  completeBadge: {
    position: 'absolute',
    top: 2,
    right: 4,
    color: '#00C853',
    fontSize: 10,
    fontWeight: '900',
  },
  countryButtonText: {
    color: '#B0B0B0',
    fontSize: 13,
    fontWeight: '900',
  },
  countryButtonTextActive: {
    color: '#0A0A0A',
  },
  countryProgress: {
    color: '#666',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 2,
  },
  countryProgressActive: {
    color: '#1A1A1A',
  },
  spread: {
    flex: 1,
    backgroundColor: '#3D2817',
    borderColor: '#2A1B0E',
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    padding: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    overflow: 'hidden',
  },
  desktopSpread: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    position: 'relative',
    zIndex: 1,
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: '#3D2817',
    borderColor: '#2A1B0E',
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  albumPage: {
    backgroundColor: '#FAF6E8',
    borderColor: '#E8DEC2',
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  desktopPage: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  pageTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#E8DEC2',
  },
  pageLabel: {
    color: '#8B6F47',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pageCode: {
    color: '#D9272D',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  originalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emptySlot: {
    flexBasis: '23.5%',
    marginBottom: spacing.sm,
    minHeight: 78,
  },
  emptyDoubleSlot: {
    flexBasis: '49%',
    marginBottom: spacing.sm,
    minHeight: 78,
  },
  bookFold: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.35)',
    bottom: spacing.md,
    left: '50%',
    position: 'absolute',
    top: spacing.md,
    width: 3,
  },
  specialPanel: {
    backgroundColor: '#FAF6E8',
    borderRadius: 16,
    padding: spacing.md,
    margin: spacing.xs,
  },
  specialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
