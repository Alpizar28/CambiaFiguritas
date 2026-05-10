import { StyleSheet, Text, View } from 'react-native';

import { colors, countryColors, radii, spacing } from '../../../constants/theme';

type CountryInfoSlotProps = {
  name: string;
  group: string;
  code: string;
  flag?: string;
};

export function CountryInfoSlot({ name, group, code, flag }: CountryInfoSlotProps) {
  const accentColor = countryColors[code] || colors.primary;

  return (
    <View style={[styles.slot, styles.countrySlot, { borderColor: accentColor }]}>
      <Text style={styles.kicker}>We are</Text>
      <Text numberOfLines={1} style={[styles.countryName, { color: accentColor }]}>{name}</Text>
      <View style={styles.flagRow}>
        {flag ? (
          <Text style={styles.flagEmoji}>{flag}</Text>
        ) : (
          <View style={[styles.flagMark, { borderColor: accentColor }]} />
        )}
        <Text style={styles.meta}>{code} / {group}</Text>
      </View>
    </View>
  );
}

export function GroupInfoSlot({ group }: { group: string }) {
  return (
    <View style={[styles.slot, styles.groupSlot]}>
      <Text style={styles.groupLabel}>{group}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    minHeight: 96,
    padding: spacing.sm,
  },
  countrySlot: {
    backgroundColor: '#FFFDF7',
    borderColor: colors.primary,
    borderWidth: 2,
    flexBasis: '49%',
    justifyContent: 'center',
  },
  groupSlot: {
    alignItems: 'center',
    backgroundColor: '#D9272D',
    borderColor: '#A81E22',
    borderWidth: 2,
    flexBasis: '23.5%',
    justifyContent: 'center',
  },
  kicker: {
    color: '#8B6F47',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: -0.3,
    textTransform: 'uppercase',
  },
  countryName: {
    color: '#1A1A1A',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.8,
    textTransform: 'uppercase',
  },
  flagRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  flagMark: {
    backgroundColor: '#FFFFFF',
    borderColor: '#1A1A1A',
    borderRadius: 2,
    borderWidth: 2,
    height: 16,
    width: 24,
  },
  flagEmoji: {
    fontSize: 22,
    lineHeight: 24,
  },
  meta: {
    color: '#5A4A3A',
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
  },
  groupLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});