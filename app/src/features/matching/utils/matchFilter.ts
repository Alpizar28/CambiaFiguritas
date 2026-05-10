import type { Match } from '../../../services/matchingService';
import { citySlug } from '../../../utils/citySlug';

export type ZoneFilter = 'mi_ciudad' | '15km' | '50km' | 'todos';

const RADIUS_15 = 15;
const RADIUS_50 = 50;

export function applyZoneFilter(
  matches: Match[],
  filter: ZoneFilter,
  myCitySlug: string | null,
): Match[] {
  if (filter === 'todos') return matches;
  if (filter === '15km') {
    return matches.filter((m) => m.distanceKm != null && m.distanceKm <= RADIUS_15);
  }
  if (filter === '50km') {
    return matches.filter((m) => m.distanceKm != null && m.distanceKm <= RADIUS_50);
  }
  // mi_ciudad
  if (!myCitySlug) return [];
  return matches.filter((m) => {
    const otherSlug = m.user.city ? citySlug(m.user.city) : '';
    return otherSlug === myCitySlug;
  });
}

export function pickTopN(matches: Match[], n: number): Match[] {
  return matches.slice(0, Math.max(0, n));
}

export function defaultZoneFilter(hasGps: boolean, hasCity: boolean): ZoneFilter {
  if (hasCity) return 'mi_ciudad';
  if (hasGps) return '15km';
  return 'todos';
}

const FALLBACK_ORDER: ZoneFilter[] = ['mi_ciudad', '15km', '50km', 'todos'];

export type CascadeResult = {
  matches: Match[];
  appliedFilter: ZoneFilter;
  fellBack: boolean;
};

export function cascadeZoneFilter(
  matches: Match[],
  preferred: ZoneFilter,
  myCitySlug: string | null,
  hasGps: boolean,
): CascadeResult {
  const startIdx = FALLBACK_ORDER.indexOf(preferred);
  const order = startIdx >= 0 ? FALLBACK_ORDER.slice(startIdx) : (['todos'] as ZoneFilter[]);

  for (const zone of order) {
    if (zone === 'mi_ciudad' && !myCitySlug) continue;
    if ((zone === '15km' || zone === '50km') && !hasGps) continue;
    const filtered = applyZoneFilter(matches, zone, myCitySlug);
    if (filtered.length > 0 || zone === 'todos') {
      return {
        matches: filtered,
        appliedFilter: zone,
        fellBack: zone !== preferred,
      };
    }
  }

  return { matches: [], appliedFilter: preferred, fellBack: false };
}
