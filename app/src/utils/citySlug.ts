/**
 * Aliases AR top: distintas formas escritas mapean al slug canónico.
 * Mantener corto: solo top variantes que el plan de zona necesita normalizar.
 */
const CITY_ALIASES: Record<string, string> = {
  caba: 'buenos-aires',
  'c-a-b-a': 'buenos-aires',
  'capital-federal': 'buenos-aires',
  'bs-as': 'buenos-aires',
  'bsas': 'buenos-aires',
  'ciudad-de-buenos-aires': 'buenos-aires',
  'ciudad-autonoma-de-buenos-aires': 'buenos-aires',
  cdmx: 'ciudad-de-mexico',
  'distrito-federal': 'ciudad-de-mexico',
};

const MAX_RAW_LENGTH = 80;
const MAX_SLUG_LENGTH = 60;

function rawSlug(city: string): string {
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, MAX_SLUG_LENGTH);
}

export function citySlug(raw: string): string {
  const base = rawSlug(raw);
  if (!base) return '';
  return CITY_ALIASES[base] ?? base;
}

export function isValidCity(raw: string): boolean {
  const trimmed = raw?.trim() ?? '';
  if (trimmed.length === 0 || trimmed.length > MAX_RAW_LENGTH) return false;
  return citySlug(trimmed).length > 0;
}
