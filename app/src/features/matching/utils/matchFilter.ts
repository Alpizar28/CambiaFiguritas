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
  if (hasGps) return '15km';
  if (hasCity) return 'mi_ciudad';
  return 'todos';
}
