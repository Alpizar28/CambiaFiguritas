/**
 * Distancia Levenshtein (insertions/deletions/substitutions). Implementación
 * 2-row dinámica para mantener O(min(a,b)) memoria.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}

/**
 * True si `haystack` contiene `needle` por substring exacto, o si alguna
 * ventana del tamaño de `needle` (±maxDistance) tiene Levenshtein ≤ maxDistance.
 *
 * Skipea fuzzy si needle.length < 3 (substring fast path solo).
 */
export function fuzzyContains(
  haystack: string,
  needle: string,
  maxDistance = 2,
): boolean {
  if (!needle) return true;
  if (haystack.includes(needle)) return true;
  if (needle.length < 3) return false;

  const minWin = Math.max(1, needle.length - maxDistance);
  const maxWin = needle.length + maxDistance;

  for (let len = minWin; len <= maxWin; len++) {
    if (len > haystack.length) break;
    for (let start = 0; start + len <= haystack.length; start++) {
      const window = haystack.substring(start, start + len);
      if (levenshtein(window, needle) <= maxDistance) return true;
    }
  }
  return false;
}
