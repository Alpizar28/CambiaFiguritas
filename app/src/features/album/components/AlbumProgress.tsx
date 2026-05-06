import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../../../constants/theme';

type AlbumProgressProps = {
  total: number;
  owned: number;
  repeated: number;
  missing: number;
  progress: number;
};

export function AlbumProgress({
  total,
  owned,
  repeated,
  missing,
  progress,
}: AlbumProgressProps) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.label}>Progreso total</Text>
          <Text style={styles.value}>{progress}%</Text>
        </View>
        <Text style={styles.total}>{owned}/{total}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.statsRow}>
        <Text style={styles.stat}>Faltan {missing}</Text>
        <Text style={styles.stat}>Repetidas {repeated}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginVertical: spacing.md,
    padding: spacing.md,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  value: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  total: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  track: {
    backgroundColor: colors.card,
    borderRadius: 999,
    height: 8,
    marginVertical: spacing.md,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stat: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
