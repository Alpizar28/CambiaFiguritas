import { Platform, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../../../constants/theme';
import type { Country } from '../types';
import { getCountryAccent } from '../utils/countryAccent';

const IS_WEB = Platform.OS === 'web';
const noSelect = IS_WEB
  ? ({ userSelect: 'none', WebkitUserSelect: 'none' } as any)
  : null;

type CountryInfoSlotProps = {
  name: string;
  group: string;
  code: string;
  flag?: string;
};

export function CountryInfoSlot({ name, group, code, flag }: CountryInfoSlotProps) {
  const accentColor = getCountryAccent(code, colors.primary);

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

type GroupInfoSlotProps = {
  group: string;
  countries: Country[];
  activeCountryId?: string;
};

const localizeGroup = (group: string) => group.replace(/^Group\s/i, 'Grupo ');

export function GroupInfoSlot({ group, countries, activeCountryId }: GroupInfoSlotProps) {
  return (
    <View style={[styles.slot, styles.groupSlot]}>
      <View style={styles.groupHeader}>
        <Text style={[styles.groupLabel, noSelect]}>{localizeGroup(group)}</Text>
      </View>
      <View style={styles.groupBody}>
        {countries.map((c) => {
          const isActive = c.id === activeCountryId;
          return (
            <View
              key={c.id}
              style={[styles.groupRow, isActive && styles.groupRowActive]}
            >
              <Text style={[styles.groupRowFlag, noSelect]}>{c.flag}</Text>
              <Text style={[styles.groupRowCode, isActive && styles.groupRowCodeActive, noSelect]}>
                {c.code}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.groupRowName, isActive && styles.groupRowNameActive, noSelect]}
              >
                {c.name}
              </Text>
            </View>
          );
        })}
      </View>
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
    backgroundColor: '#FFFDF7',
    borderColor: '#A81E22',
    borderWidth: 2,
    flexBasis: '23.5%',
    minHeight: 150,
    overflow: 'hidden',
    padding: 0,
  },
  groupHeader: {
    alignItems: 'center',
    backgroundColor: '#D9272D',
    paddingVertical: 6,
  },
  groupBody: {
    flex: 1,
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  groupRow: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  groupRowActive: {
    backgroundColor: '#FFF4D6',
    borderColor: '#E8B400',
    borderWidth: 1,
  },
  groupRowFlag: {
    fontSize: 14,
    lineHeight: 16,
  },
  groupRowCode: {
    color: '#1A1A1A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
    minWidth: 22,
  },
  groupRowCodeActive: {
    color: '#A87600',
  },
  groupRowName: {
    color: '#3A352B',
    flex: 1,
    fontSize: 8,
    fontWeight: '700',
  },
  groupRowNameActive: {
    color: '#A87600',
    fontWeight: '900',
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
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});