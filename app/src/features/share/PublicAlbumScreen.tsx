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
}: {
  summary: GroupSummary;
  statuses: Record<string, PublicAlbumStatus>;
  repeatedCounts: Record<string, number>;
}) {
  const pct = summary.total === 0 ? 0 : Math.round((summary.owned / summary.total) * 100);
  return (
    <View style={styles.groupBlock}>
      <View style={styles.groupHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.groupTitle}>{summary.group.country.name}</Text>
          <Text style={styles.groupSubtitle}>
            {summary.group.country.group} · {summary.owned}/{summary.total} ({pct}%)
          </Text>
        </View>
        {summary.owned === summary.total && summary.total > 0 ? (
          <View style={styles.completeBadge}>
            <Text style={styles.completeBadgeText}>✓</Text>
          </View>
        ) : null}
      </View>
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
    </View>
  );
}

export function PublicAlbumScreen({ uid, onExitToApp }: Props) {
  const [data, setData] = useState<PublicAlbumPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Álbum no disponible</Text>
        <Text style={styles.errorMsg}>{error ?? 'Usuario no encontrado.'}</Text>
        <TouchableOpacity style={styles.cta} onPress={onExitToApp}>
          <Text style={styles.ctaText}>Ir a CambiaFiguritas</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalKnown = data.album.ownedCount + data.album.missingCount;
  const pct = totalKnown === 0 ? 0 : Math.round((data.album.ownedCount / totalKnown) * 100);
  const isHidden = data.album.hideProgress === true;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
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
          <View style={styles.legend}>
            <LegendItem color={colors.owned} label="Obtenida" />
            {!data.album.hideRepeated ? (
              <LegendItem color={colors.repeated} label="Repetida" />
            ) : null}
            <LegendItem color={colors.special} label="Especial" />
            <LegendItem color={colors.missing} label="Falta" />
          </View>

          {summaries.map((s) => (
            <GroupBlock
              key={s.group.country.id}
              summary={s}
              statuses={data.album.statuses}
              repeatedCounts={data.album.repeatedCounts}
            />
          ))}
        </>
      )}

      <TouchableOpacity
        style={styles.cta}
        onPress={() => {
          Linking.openURL(APP_URL).catch(() => undefined);
          onExitToApp();
        }}
      >
        <Text style={styles.ctaText}>Crear mi álbum gratis</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>cambiafiguritas.online</Text>
    </ScrollView>
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
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { color: colors.textMuted, fontSize: 12 },
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
    marginBottom: spacing.sm,
  },
  groupTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  groupSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
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
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  ctaText: { color: '#000', fontSize: 16, fontWeight: '800' },
  footer: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
