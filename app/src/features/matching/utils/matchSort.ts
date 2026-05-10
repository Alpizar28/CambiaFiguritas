import type { Match } from '../../../services/matchingService';

export type MatchSort = 'recommended' | 'closest' | 'score' | 'perfect_first';

const distOrInfinity = (m: Match): number => m.distanceKm ?? Number.POSITIVE_INFINITY;

export function sortMatches(matches: Match[], sort: MatchSort): Match[] {
  const copy = matches.slice();
  if (sort === 'recommended') return copy;

  if (sort === 'closest') {
    return copy.sort((a, b) => {
      const da = distOrInfinity(a);
      const db = distOrInfinity(b);
      if (da !== db) return da - db;
      return b.score - a.score;
    });
  }

  if (sort === 'score') {
    return copy.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return distOrInfinity(a) - distOrInfinity(b);
    });
  }

  // perfect_first
  return copy.sort((a, b) => {
    const pa = a.isPerfectTrade ? 1 : 0;
    const pb = b.isPerfectTrade ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return b.score - a.score;
  });
}

export function isValidSort(value: unknown): value is MatchSort {
  return value === 'recommended' || value === 'closest' || value === 'score' || value === 'perfect_first';
}
