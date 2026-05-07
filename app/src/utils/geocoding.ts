import * as Location from 'expo-location';

export type LocationLabel = {
  city: string | null;
  region: string | null;
  country: string | null;
};

// Cache en memoria. Clave = lat,lng bucketeados a 0.05° (~5km, igual al bucket
// que usamos al persistir coords). Esto evita pegarle al servicio de geocoding
// con cada render mientras el usuario no se mueva más de unos km.
const cache = new Map<string, LocationLabel>();

function bucket(n: number): number {
  return Math.round(n / 0.05) * 0.05;
}

function keyFor(lat: number, lng: number): string {
  return `${bucket(lat).toFixed(2)},${bucket(lng).toFixed(2)}`;
}

export function getCachedLabel(lat: number, lng: number): LocationLabel | null {
  return cache.get(keyFor(lat, lng)) ?? null;
}

export async function reverseGeocode(lat: number, lng: number): Promise<LocationLabel> {
  const key = keyFor(lat, lng);
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const first = results[0];
    const label: LocationLabel = first
      ? {
          city: first.city ?? first.subregion ?? null,
          region: first.region ?? null,
          country: first.country ?? null,
        }
      : { city: null, region: null, country: null };
    cache.set(key, label);
    return label;
  } catch {
    const empty: LocationLabel = { city: null, region: null, country: null };
    return empty;
  }
}

export function formatLocationLabel(label: LocationLabel): string {
  const parts = [label.city, label.region, label.country].filter(
    (p): p is string => !!p && p.trim().length > 0,
  );
  if (parts.length === 0) return 'Ubicación desconocida';
  // Evitar duplicados (region == city a veces).
  const unique: string[] = [];
  for (const p of parts) {
    if (!unique.includes(p)) unique.push(p);
  }
  return unique.slice(0, 2).join(', ');
}
