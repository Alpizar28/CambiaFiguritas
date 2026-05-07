import { useMemo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { useAlbumStore } from '../../store/albumStore';
import { countries } from '../album/data/countries';
import { colors, radii, spacing } from '../../constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CountryRow = {
  countryId: string;
  name: string;
  code: string;
  owned: number;
  total: number;
  progress: number;
};

export function StatsBreakdown() {
  const getCountryStats = useAlbumStore((s) => s.getCountryStats);
  const statuses = useAlbumStore((s) => s.statuses);
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo<CountryRow[]>(() => {
    return countries.map((c) => {
      const stats = getCountryStats(c.id);
      return {
        countryId: c.id,
        name: c.name,
        code: c.code,
        owned: stats.owned,
        total: stats.total,
        progress: stats.progress,
      };
    });
  }, [statuses, getCountryStats]);

  const completed = rows.filter((r) => r.progress === 100);
  const almostDone = rows
    .filter((r) => r.progress >= 70 && r.progress < 100)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);
  const inProgress = rows
    .filter((r) => r.progress > 0 && r.progress < 70)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);

  const totalAdvanced = completed.length + almostDone.length + inProgress.length;
  const isEmpty = totalAdvanced === 0;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={toggle} style={({ pressed }) => [styles.header, pressed && { opacity: 0.7 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Por país</Text>
          <Text style={styles.summary}>
            {isEmpty
              ? 'Marcá figuritas para ver el desglose'
              : `${completed.length} completos · ${almostDone.length} casi listos · ${inProgress.length} en progreso`}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {completed.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>✓ Completos ({completed.length})</Text>
              <View style={styles.chipRow}>
                {completed.map((r) => (
                  <View key={r.countryId} style={styles.completedChip}>
                    <Text style={styles.completedChipText}>{r.code}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {almostDone.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🔥 Casi listos</Text>
              {almostDone.map((r) => (
                <Row key={r.countryId} row={r} accentColor={colors.accent} />
              ))}
            </View>
          )}

          {inProgress.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📈 En progreso</Text>
              {inProgress.map((r) => (
                <Row key={r.countryId} row={r} accentColor={colors.repeated} />
              ))}
            </View>
          )}

          {isEmpty && (
            <Text style={styles.empty}>Marcá figuritas para ver el desglose por país.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Row({ row, accentColor }: { row: CountryRow; accentColor: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowName}>
          <Text style={styles.rowCode}>{row.code}</Text> {row.name}
        </Text>
        <Text style={styles.rowProgress}>{row.owned}/{row.total}</Text>
      </View>
      <View style={styles.bar}>
        <View
          style={[
            styles.barFill,
            { width: `${row.progress}%` as any, backgroundColor: accentColor },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  summary: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
    width: 16,
    textAlign: 'center',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  completedChip: {
    backgroundColor: colors.owned,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  completedChipText: {
    color: colors.background,
    fontSize: 11,
    fontWeight: '900',
  },
  row: {
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  rowCode: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  rowProgress: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  bar: {
    height: 6,
    backgroundColor: colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
});
