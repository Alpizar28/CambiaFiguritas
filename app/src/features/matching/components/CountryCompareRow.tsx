import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { colors, countryColors, radii, spacing } from '../../../constants/theme';
import type { CompareRelevance, CountryCompare, StickerCompare } from '../utils/countryComparison';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  data: CountryCompare;
  defaultExpanded?: boolean;
};

const RELEVANCE_LABEL: Record<CompareRelevance, string> = {
  two_way: 'Intercambio',
  i_need_only: 'Te puede dar',
  they_need_only: 'Le podés dar',
  none: 'Sin overlap',
};

const RELEVANCE_COLOR: Record<CompareRelevance, string> = {
  two_way: colors.primary,
  i_need_only: colors.repeated,
  they_need_only: colors.accent,
  none: colors.textMuted,
};

export function CountryCompareRow({ data, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  const flagColor = countryColors[data.code] ?? colors.surface;
  const badgeColor = RELEVANCE_COLOR[data.relevance];

  return (
    <View style={styles.container}>
      <Pressable onPress={toggle} style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <View style={[styles.flag, { backgroundColor: flagColor }]}>
          <Text style={styles.flagText}>{data.code.slice(0, 3)}</Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {data.countryName}
          </Text>
          {data.group ? <Text style={styles.subtitle}>{data.group}</Text> : null}
        </View>
        <View style={[styles.badge, { borderColor: badgeColor }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{RELEVANCE_LABEL[data.relevance]}</Text>
        </View>
        <View style={styles.counters}>
          <Text style={[styles.counterText, { color: colors.repeated }]}>↓{data.iNeedFromThem.length}</Text>
          <Text style={[styles.counterText, { color: colors.primary }]}>↑{data.theyNeedFromMe.length}</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <ProgressLine
            label="Tu progreso aquí"
            count={data.myOwnedCount}
            total={data.total}
            color={colors.primary}
          />
          <ProgressLine
            label="Su progreso aquí"
            count={data.theirOwnedCount}
            total={data.total}
            color={colors.repeated}
          />

          {data.iNeedFromThem.length > 0 ? (
            <ChipsBlock
              title={`Te puede dar (${data.iNeedFromThem.length})`}
              titleColor={colors.repeated}
              stickers={data.stickers.filter((s) => s.iCanGet)}
              side="iCanGet"
            />
          ) : null}

          {data.theyNeedFromMe.length > 0 ? (
            <ChipsBlock
              title={`Le podés dar (${data.theyNeedFromMe.length})`}
              titleColor={colors.primary}
              stickers={data.stickers.filter((s) => s.iCanGive)}
              side="iCanGive"
            />
          ) : null}

          {data.iNeedFromThem.length === 0 && data.theyNeedFromMe.length === 0 ? (
            <Text style={styles.emptyText}>No hay figus para intercambiar en este grupo.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ProgressLine({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={styles.progressRow}>
      <Text style={styles.progressLabel}>{label}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.progressCount, { color }]}>
        {count}/{total}
      </Text>
    </View>
  );
}

function ChipsBlock({
  title,
  titleColor,
  stickers,
  side,
}: {
  title: string;
  titleColor: string;
  stickers: StickerCompare[];
  side: 'iCanGet' | 'iCanGive';
}) {
  return (
    <View style={styles.chipsBlock}>
      <Text style={[styles.chipsTitle, { color: titleColor }]}>{title}</Text>
      <View style={styles.chipsGrid}>
        {stickers.map((s) => (
          <Chip key={s.id} sticker={s} side={side} />
        ))}
      </View>
    </View>
  );
}

function Chip({ sticker, side }: { sticker: StickerCompare; side: 'iCanGet' | 'iCanGive' }) {
  const color = side === 'iCanGet' ? colors.repeated : colors.primary;
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <Text style={[styles.chipText, { color }]}>{sticker.displayCode}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  flag: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flagText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 11,
  },
  badge: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  counters: {
    flexDirection: 'row',
    gap: spacing.xs,
    minWidth: 64,
    justifyContent: 'flex-end',
  },
  counterText: {
    fontSize: 13,
    fontWeight: '800',
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 14,
    width: 16,
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 11,
    width: 110,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.sm,
  },
  progressCount: {
    fontSize: 11,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'right',
  },
  chipsBlock: {
    gap: spacing.sm,
  },
  chipsTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
