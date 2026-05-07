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
import { useAlbumStore } from '../../store/albumStore';
import { CountryInfoSlot, GroupInfoSlot } from './components/AlbumInfoSlot';
import { AlbumProgress } from './components/AlbumProgress';
import { ContextMenu } from './components/ContextMenu';
import { RepeatCounterMenu } from './components/RepeatCounterMenu';
import { ConnectedStickerCard } from './components/ConnectedStickerCard';
import { StickerActionSheet } from './components/StickerActionSheet';
import { countryStickerGroups, specialStickerGroup } from './data/mockAlbum';
import { haptic } from '../../utils/haptics';
import type { AlbumSlot, CountryAlbumPage, Sticker, StickerStatus } from './types';

type AlbumFilter = 'all' | StickerStatus;

const filters: Array<{ label: string; value: AlbumFilter }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Faltan', value: 'missing' },
  { label: 'Tengo', value: 'owned' },
  { label: 'Repes', value: 'repeated' },
  { label: 'Especiales', value: 'special' },
];

const stickerGroups = countryStickerGroups.concat(specialStickerGroup);

const matchesQuery = (sticker: Sticker, normalizedQuery: string) =>
  normalizedQuery.length === 0 ||
  sticker.countryName?.toLowerCase().includes(normalizedQuery) ||
  sticker.group?.toLowerCase().includes(normalizedQuery) ||
  sticker.displayCode.toLowerCase().includes(normalizedQuery) ||
  sticker.label.toLowerCase().includes(normalizedQuery) ||
  sticker.kind.toLowerCase().includes(normalizedQuery) ||
  String(sticker.slotNumber).includes(normalizedQuery);

const getGroupStats = (stickers: Sticker[], statuses: Record<string, StickerStatus>) => {
  const owned = stickers.filter((sticker) => {
    const status = statuses[sticker.id];
    return status === 'owned' || status === 'repeated' || status === 'special';
  }).length;
  const repeated = stickers.filter((sticker) => statuses[sticker.id] === 'repeated').length;
  return { total: stickers.length, owned, repeated };
};

const COUNTRY_BTN_WIDTH = 70;

export function AlbumScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 900;

  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [activeCountryPage, setActiveCountryPage] = useState<1 | 2>(1);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<AlbumFilter>('all');

  // Para desktop (menú flotante)
  const [menuState, setMenuState] = useState<{
    open: boolean;
    stickerId: string;
    position: { x: number; y: number };
    type: 'context' | 'counter';
  } | null>(null);

  // Para mobile (bottom sheet)
  const [sheetStickerId, setSheetStickerId] = useState<string | null>(null);

  const countryScrollerRef = useRef<ScrollView>(null);
  const pagerRef = useRef<ScrollView>(null);

  const statuses = useAlbumStore((state) => state.statuses);
  const repeatedCounts = useAlbumStore((state) => state.repeatedCounts);
  const setStatus = useAlbumStore((state) => state.setStatus);
  const incrementRepeated = useAlbumStore((state) => state.incrementRepeated);
  const decrementRepeated = useAlbumStore((state) => state.decrementRepeated);
  const getStats = useAlbumStore((state) => state.getStats);

  const activeGroup = stickerGroups[activeGroupIndex];
  const stats = getStats();
  const activeStats = getGroupStats(activeGroup.stickers, statuses);
  const normalizedQuery = query.trim().toLowerCase();
  const isSpecials = activeGroup.country.id === 'especiales';

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
        const matchesFilter = activeFilter === 'all' || status === activeFilter;
        return matchesFilter && matchesQuery(sticker, normalizedQuery);
      }),
    [activeGroup, statuses, activeFilter, normalizedQuery],
  );

  // Auto-scroll al país activo
  useEffect(() => {
    countryScrollerRef.current?.scrollTo({
      x: Math.max(0, activeGroupIndex * (COUNTRY_BTN_WIDTH + spacing.xs) - width / 3),
      animated: true,
    });
  }, [activeGroupIndex, width]);

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
    (stickerId: string, event: { nativeEvent: { pageX: number; pageY: number } }) => {
      haptic.medium();
      if (isDesktop) {
        const state = useAlbumStore.getState();
        const status = state.statuses[stickerId] ?? 'missing';
        const repeatedCount = state.repeatedCounts[stickerId] ?? 0;
        const hasRepeated = status === 'repeated' || repeatedCount > 0;
        setMenuState({
          open: true,
          stickerId,
          position: { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY },
          type: hasRepeated ? 'counter' : 'context',
        });
      } else {
        setSheetStickerId(stickerId);
      }
    },
    [isDesktop],
  );

  const closeMenu = () => setMenuState(null);
  const closeSheet = () => setSheetStickerId(null);

  const handleSelectStatus = (stickerId: string, status: StickerStatus) => {
    setStatus(stickerId, status);
  };

  const shouldShowSticker = (sticker: Sticker) => {
    const status = statuses[sticker.id] ?? 'missing';
    const matchesFilter = activeFilter === 'all' || status === activeFilter;
    return matchesFilter && matchesQuery(sticker, normalizedQuery);
  };

  const renderSlot = (slot: AlbumSlot, index: number) => {
    if (slot.type === 'country_info') {
      return (
        <CountryInfoSlot
          key={`country-info-${index}`}
          code={activeGroup.country.code}
          group={activeGroup.country.group}
          name={activeGroup.country.name}
        />
      );
    }
    if (slot.type === 'group_info') {
      return <GroupInfoSlot key={`group-info-${index}`} group={activeGroup.country.group} />;
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
        {/* Header compacto sticky */}
        <View style={styles.mobileHeader}>
          <View style={styles.mobileTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.mobileKicker}>Album Mundial 2026</Text>
              <Text style={styles.mobileTitle} numberOfLines={1}>
                {activeGroup.country.name}
              </Text>
            </View>
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
            <View style={[styles.mobileProgressFill, { width: `${stats.progress}%` as any }]} />
          </View>

          {searchOpen && (
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
                return (
                  <Pressable
                    key={group.country.id}
                    onPress={() => { haptic.tap(); setActiveGroupIndex(index); }}
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
      </View>
    );
  }

  // ----- DESKTOP LAYOUT -----
  const pagesToRender = activeGroup.pages;
  const desktopContentWidth = Math.min(width, 1220) - spacing.lg * 2;
  const desktopPageWidth = (desktopContentWidth - spacing.sm * 3) / 2;
  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.workspace}>
          <View style={styles.toolbar}>
            <View style={styles.titleBlock}>
              <Text style={styles.kicker}>Album Mundial 2026</Text>
              <Text style={styles.title}>{activeGroup.country.name}</Text>
              <Text style={styles.subtitle}>
                {activeGroup.country.group} · {activeStats.owned}/{activeStats.total} ·{' '}
                {activeStats.repeated} repetidas
              </Text>
            </View>
            <View style={styles.progressWrap}>
              <AlbumProgress {...stats} />
            </View>
          </View>

          <View style={styles.controlsRow}>
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

          {menuState && menuState.type === 'context' && (
            <ContextMenu
              status={statuses[menuState.stickerId] ?? 'missing'}
              repeatedCount={repeatedCounts[menuState.stickerId] ?? 0}
              position={menuState.position}
              onSelectStatus={(status) => handleSelectStatus(menuState.stickerId, status)}
              onClose={closeMenu}
            />
          )}

          {menuState && menuState.type === 'counter' && (
            <RepeatCounterMenu
              repeatedCount={repeatedCounts[menuState.stickerId] ?? 0}
              onIncrement={() => incrementRepeated(menuState.stickerId)}
              onDecrement={() => decrementRepeated(menuState.stickerId)}
              onClose={closeMenu}
            />
          )}
        </View>
      </ScrollView>
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
