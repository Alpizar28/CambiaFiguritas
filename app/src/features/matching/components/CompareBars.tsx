import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../../../constants/theme';

type Props = {
  iNeedFromThem: number;
  theyNeedFromMe: number;
  total: number;
};

export function CompareBars({ iNeedFromThem, theyNeedFromMe, total }: Props) {
  const max = Math.max(iNeedFromThem, theyNeedFromMe, 1);
  const refTotal = total > 0 ? total : 1;

  return (
    <View style={styles.container}>
      <Row
        label="Te puede dar"
        count={iNeedFromThem}
        total={refTotal}
        max={max}
        color={colors.repeated}
      />
      <Row
        label="Le podés dar"
        count={theyNeedFromMe}
        total={refTotal}
        max={max}
        color={colors.primary}
      />
    </View>
  );
}

function Row({
  label,
  count,
  total,
  max,
  color,
}: {
  label: string;
  count: number;
  total: number;
  max: number;
  color: string;
}) {
  const widthPct = `${Math.round((count / max) * 100)}%` as const;
  const ofTotal = `${count}/${total}`;
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.count, { color }]}>{ofTotal}</Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              width: widthPct,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    width: '100%',
  },
  row: {
    gap: spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  count: {
    fontSize: 14,
    fontWeight: '800',
  },
  track: {
    height: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.sm,
  },
});
