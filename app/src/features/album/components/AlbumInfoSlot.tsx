import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { colors, radii, spacing } from '../../../constants/theme';
import type { Country } from '../types';
import { getCountryAccent, pickReadableTextOn, tintWithAlpha } from '../utils/countryAccent';

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
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const accentColor = getCountryAccent(code, colors.primary);
  const slotBg = tintWithAlpha(accentColor, 0.10);

  return (
    <View style={[
      styles.slot,
      styles.countrySlot,
      isMobile && styles.slotMobile,
      { borderColor: accentColor, backgroundColor: slotBg },
    ]}>
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
  onSelectCountry?: (countryId: string) => void;
  accentColor?: string;
};

const localizeGroup = (group: string) => group.replace(/^Group\s/i, 'Grupo ');

export function GroupInfoSlot({ group, countries, activeCountryId, onSelectCountry, accentColor }: GroupInfoSlotProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 900;
  const accent = accentColor ?? '#D9272D';
  const headerText = pickReadableTextOn(accent);
  const bodyBg = tintWithAlpha(accent, 0.10);

  return (
    <View style={[
      styles.slot,
      styles.groupSlot,
      isMobile && styles.slotMobile,
      { borderColor: accent, backgroundColor: bodyBg },
    ]}>
      <View style={[styles.groupHeader, { backgroundColor: accent }]}>
        <Text style={[styles.groupLabel, { color: headerText }, noSelect]}>{localizeGroup(group)}</Text>
      </View>
      <View style={styles.groupBody}>
        {countries.map((c) => {
          const isActive = c.id === activeCountryId;
          return (
            <Pressable
              key={c.id}
              accessibilityLabel={`Ir a ${c.name}`}
              onPress={() => onSelectCountry?.(c.id)}
              disabled={!onSelectCountry || isActive}
              style={({ pressed }) => [
                styles.groupRow,
                isActive && styles.groupRowActive,
                pressed && !isActive && styles.groupRowPressed,
              ]}
            >
              <Text style={[styles.groupRowFlag, noSelect]}>{c.flag}</Text>
              <Text style={[styles.groupRowCode, isActive && styles.groupRowCodeActive, noSelect]}>
                {c.code}
              </Text>
            </Pressable>
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
  slotMobile: {
    width: '100%',
    height: '100%',
    flexBasis: 'auto',
    marginBottom: 0,
    minHeight: 0,
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
    minHeight: 118,
    overflow: 'hidden',
    padding: 0,
  },
  groupHeader: {
    alignItems: 'center',
    backgroundColor: '#D9272D',
    paddingVertical: 4,
  },
  groupBody: {
    flex: 1,
    justifyContent: 'space-around',
    paddingHorizontal: 3,
    paddingVertical: 3,
  },
  groupRow: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  groupRowActive: {
    backgroundColor: '#FFF4D6',
    borderColor: '#E8B400',
    borderWidth: 1,
  },
  groupRowPressed: {
    backgroundColor: '#F0E8D8',
    transform: [{ scale: 0.96 }],
  },
  groupRowFlag: {
    fontSize: 15,
    lineHeight: 17,
  },
  groupRowCode: {
    color: '#1A1A1A',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  groupRowCodeActive: {
    color: '#A87600',
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
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});