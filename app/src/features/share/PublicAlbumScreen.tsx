import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchPublicAlbum, type PublicAlbumPayload, type PublicAlbumStatus } from '../../services/publicAlbumService';
import {
  countryStickerGroups,
  specialStickerGroup,
} from '../album/data/albumCatalog';
import type { CountryStickerGroup } from '../album/types';
import { colors, radii, spacing } from '../../constants/theme';

const APP_URL = 'https://cambiafiguritas.online';

type Props = {
  uid: string;
  onExitToApp: () => void;
};

type GroupSummary = {
  group: CountryStickerGroup;
  owned: number;
  total: number;
};

function summarize(
  groups: CountryStickerGroup[],
  statuses: Record<string, PublicAlbumStatus>,
): GroupSummary[] {
  return groups.map((g) => {
    const total = g.stickers.length;
    let owned = 0;
    for (const s of g.stickers) {
      const st = statuses[s.id];
      if (st === 'owned' || st === 'repeated' || st === 'special') owned += 1;
    }
    return { group: g, owned, total };
  });
}

function StickerDot({ status }: { status: PublicAlbumStatus }) {
  let bg: string = colors.missing;
  let border: string = colors.missingBorder;
  if (status === 'owned') {
    bg = colors.owned;
    border = colors.ownedBorder;
  } else if (status === 'repeated') {
    bg = colors.repeated;
    border = colors.repeatedBorder;
  } else if (status === 'special') {
    bg = colors.special;
    border = colors.specialBorder;
  }
  return <View style={[styles.dot, { backgroundColor: bg, borderColor: border }]} />;
}

function GroupBlock({
  summary,
  statuses,
  repeatedCounts,
  collapsed,
  onToggle,
}: {
  summary: GroupSummary;
  statuses: Record<string, PublicAlbumStatus>;
  repeatedCounts: Record<string, number>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pct = summary.total === 0 ? 0 : Math.round((summary.owned / summary.total) * 100);
  const isEmpty = summary.owned === 0;
  const subtitle = isEmpty
    ? `Sin figuritas · 0/${summary.total}`
    : `${summary.group.country.group} · ${summary.owned}/${summary.total} (${pct}%)`;

  return (
    <View style={styles.groupBlock}>
      <TouchableOpacity
        style={styles.groupHeader}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${summary.group.country.name}, ${collapsed ? 'expandir' : 'contraer'}`}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.groupTitle}>{summary.group.country.name}</Text>
          <Text style={styles.groupSubtitle}>{subtitle}</Text>
        </View>
        {summary.owned === summary.total && summary.total > 0 ? (
          <View style={styles.completeBadge}>
            <Text style={styles.completeBadgeText}>✓</Text>
          </View>
        ) : null}
        <Text style={styles.chevron}>{collapsed ? '▶' : '▼'}</Text>
      </TouchableOpacity>
      {!collapsed ? (
        <View style={styles.grid}>
          {summary.group.stickers.map((s) => {
            const status = statuses[s.id] ?? 'missing';
            const reps = repeatedCounts[s.id];
            return (
              <View key={s.id} style={styles.cell}>
                <StickerDot status={status} />
                <Text style={styles.cellLabel} numberOfLines={1}>
                  {s.displayCode}
                </Text>
                {status === 'repeated' && reps && reps > 1 ? (
                  <Text style={styles.repeatedTag}>×{reps}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Volver"
      >
        <Text style={styles.backChevron}>‹</Text>
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>
      <Text style={styles.brand}>cambiafiguritas.online</Text>
    </View>
  );
}

function StickyCta({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.stickyBar, { paddingBottom: spacing.md + insets.bottom }]}>
      <TouchableOpacity style={styles.stickyButton} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.stickyEmoji}>⚽</Text>
        <Text style={styles.stickyButtonText}>Crear mi álbum gratis</Text>
        <Text style={styles.stickyArrow}>→</Text>
      </TouchableOpacity>
    </View>
  );
}

export function PublicAlbumScreen({ uid, onExitToApp }: Props) {
  const [data, setData] = useState<PublicAlbumPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPublicAlbum(uid)
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'No se pudo cargar el álbum.';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const summaries = useMemo(() => {
    if (!data) return [] as GroupSummary[];
    const all = [specialStickerGroup as CountryStickerGroup, ...countryStickerGroups];
    return summarize(all, data.album.statuses);
  }, [data]);

  useEffect(() => {
    if (!summaries.length) return;
    const init: Record<string, boolean> = {};
    for (const s of summaries) {
      init[s.group.country.id] = s.owned === 0;
    }
    setCollapsed(init);
  }, [summaries]);

  const allCollapsed = useMemo(() => {
    if (!summaries.length) return false;
    return summaries.every((s) => collapsed[s.group.country.id]);
  }, [collapsed, summaries]);

  const toggleAll = () => {
    const next = !allCollapsed;
    setCollapsed(Object.fromEntries(summaries.map((s) => [s.group.country.id, next])));
  };

  const toggleOne = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCtaPress = () => {
    Linking.openURL(APP_URL).catch(() => undefined);
    onExitToApp();
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <TopBar onBack={onExitToApp} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <StickyCta onPress={handleCtaPress} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.root}>
        <TopBar onBack={onExitToApp} />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Álbum no disponible</Text>
          <Text style={styles.errorMsg}>{error ?? 'Usuario no encontrado.'}</Text>
        </View>
        <StickyCta onPress={handleCtaPress} />
      </View>
    );
  }

  const totalKnown = data.album.ownedCount + data.album.missingCount;
  const pct = totalKnown === 0 ? 0 : Math.round((data.album.ownedCount / totalKnown) * 100);
  const isHidden = data.album.hideProgress === true;

  return (
    <View style={styles.root}>
      <TopBar onBack={onExitToApp} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {data.user.photoUrl ? (
            <Image source={{ uri: data.user.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>
                {(data.user.name[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{data.user.name}</Text>
            {data.user.city ? <Text style={styles.city}>{data.user.city}</Text> : null}
            {isHidden ? (
              <Text style={styles.headerStats}>Progreso privado</Text>
            ) : (
              <>
                <Text style={styles.headerStats}>
                  {data.album.ownedCount} obtenidas
                  {data.album.repeatedCount > 0 ? ` · ${data.album.repeatedCount} repetidas` : ''}
                </Text>
                <Text style={styles.pct}>{pct}% del álbum</Text>
              </>
            )}
          </View>
        </View>

        {isHidden ? (
          <View style={styles.privateBlock}>
            <Text style={styles.privateTitle}>🔒 Progreso oculto</Text>
            <Text style={styles.privateBody}>
              {data.user.name} eligió no mostrar su álbum públicamente. Sumate a CambiaFiguritas
              para conectar y proponer intercambios.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.controlsRow}>
              <View style={styles.legend}>
                <LegendItem color={colors.owned} label="Obtenida" />
                {!data.album.hideRepeated ? (
                  <LegendItem color={colors.repeated} label="Repetida" />
                ) : null}
                <LegendItem color={colors.special} label="Especial" />
                <LegendItem color={colors.missing} label="Falta" />
              </View>
              <TouchableOpacity
                onPress={toggleAll}
                style={styles.toggleAllButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
              >
                <Text style={styles.toggleAllText}>
                  {allCollapsed ? 'Expandir todo' : 'Contraer todo'}
                </Text>
              </TouchableOpacity>
            </View>

            {summaries.map((s) => (
              <GroupBlock
                key={s.group.country.id}
                summary={s}
                statuses={data.album.statuses}
                repeatedCounts={data.album.repeatedCounts}
                collapsed={collapsed[s.group.country.id] ?? s.owned === 0}
                onToggle={() => toggleOne(s.group.country.id)}
              />
            ))}
          </>
        )}

        <Text style={styles.footer}>cambiafiguritas.online</Text>
      </ScrollView>
      <StickyCta onPress={handleCtaPress} />
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
    minHeight: 44,
  },
  backChevron: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 28,
    marginRight: 6,
    fontWeight: '600',
  },
  backText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  brand: { color: colors.textMuted, fontSize: 12 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  name: { color: colors.text, fontSize: 20, fontWeight: '700' },
  city: { color: colors.textMuted, fontSize: 14 },
  headerStats: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  pct: { color: colors.accent, fontSize: 16, fontWeight: '800', marginTop: 4 },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    flex: 1,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { color: colors.textMuted, fontSize: 12 },
  toggleAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  toggleAllText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  groupBlock: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  groupTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  groupSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  chevron: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  completeBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBadgeText: { color: '#000', fontSize: 14, fontWeight: '900' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  cell: {
    width: 56,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  cellLabel: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  repeatedTag: {
    color: colors.repeated,
    fontSize: 10,
    fontWeight: '700',
  },
  privateBlock: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  privateTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  privateBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  errorTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  errorMsg: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  stickyBar: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  stickyButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  stickyEmoji: { fontSize: 20 },
  stickyButtonText: { color: '#000', fontSize: 16, fontWeight: '800' },
  stickyArrow: { color: '#000', fontSize: 18, fontWeight: '800' },
  footer: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
