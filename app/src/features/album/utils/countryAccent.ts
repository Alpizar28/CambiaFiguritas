import { colors, countryColors } from '../../../constants/theme';
import { countries } from '../data/countries';

const accentByCode: Map<string, string> = new Map(
  countries
    .filter((c) => c.colors?.primary)
    .map((c) => [c.code, c.colors!.primary] as const),
);

// Acento dorado para grupo de especiales (FW).
const SPECIAL_ACCENT = '#FFD600';

export function getCountryAccent(code: string | undefined, fallback: string = colors.primary): string {
  if (!code) return fallback;
  if (code === 'FW') return SPECIAL_ACCENT;
  return accentByCode.get(code) ?? countryColors[code] ?? fallback;
}

// Mezcla un hex con alfa para tinte sutil de fondo. RN soporta '#RRGGBBAA'.
export function tintWithAlpha(hex: string, alpha: number = 0.1): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const aa = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  // Si ya viene con alpha o no es hex 6, retornar como está.
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  return `${hex}${aa}`;
}

// Decide texto blanco o negro para mejor contraste sobre un fondo hex.
export function pickReadableTextOn(hex: string): '#000000' | '#FFFFFF' {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return '#FFFFFF';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 160 ? '#000000' : '#FFFFFF';
}
