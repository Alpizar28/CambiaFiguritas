import { Platform } from 'react-native';
import { getAnalytics, isSupported, logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { getApps } from 'firebase/app';
import * as Crypto from 'expo-crypto';
import './firebase'; // ensure firebase app is initialized

// Por privacidad, los UIDs de OTROS usuarios (matchUid, targetUid) se hashean
// antes de mandarse a Analytics. Esto evita exponer identificadores cruzados.
// El UID propio del usuario logueado se manda con setUserId (es atribución
// first-party permitida por GA4).
const HASH_KEYS = new Set(['matchUid', 'targetUid']);
const hashCache = new Map<string, string>();

async function hashUid(uid: string): Promise<string> {
  const cached = hashCache.get(uid);
  if (cached) return cached;
  try {
    const full = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, uid);
    const short = full.slice(0, 12);
    hashCache.set(uid, short);
    return short;
  } catch {
    return 'h_unknown';
  }
}

async function redactParams(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (HASH_KEYS.has(key) && typeof value === 'string') {
      out[key] = await hashUid(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Catálogo de eventos. Tipado fuerte = no se introducen typos en los eventos.
type AnalyticsEvent =
  | { name: 'login_completed'; params: { method: 'google' } }
  | { name: 'logout' }
  | { name: 'sticker_marked_owned'; params: { stickerId: string; countryId?: string } }
  | { name: 'sticker_marked_repeated'; params: { stickerId: string; countryId?: string; count: number } }
  | { name: 'sticker_marked_special'; params: { stickerId: string } }
  | { name: 'album_filter_changed'; params: { filter: string } }
  | { name: 'matches_searched'; params: { matchesFound: number } }
  | { name: 'match_opened'; params: { matchUid: string; score: number } }
  | { name: 'match_whatsapp_clicked'; params: { matchUid: string } }
  | { name: 'match_profile_opened'; params: { matchUid: string } }
  | { name: 'match_map_clicked'; params: { matchUid: string } }
  | { name: 'match_clipboard_copied'; params: { matchUid: string } }
  | { name: 'match_reported'; params: { targetUid: string } }
  | { name: 'event_created'; params: { type: string } }
  | { name: 'event_deleted' }
  | { name: 'event_maps_opened' }
  | { name: 'screen_view'; params: { screen: string } };

let analyticsInstance: Analytics | null = null;
let initPromise: Promise<Analytics | null> | null = null;

async function ensureAnalytics(): Promise<Analytics | null> {
  if (analyticsInstance) return analyticsInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Analytics web SDK solo soporta browser. En nativo (Expo Go) no se inicializa.
      if (Platform.OS !== 'web') return null;
      const supported = await isSupported();
      if (!supported) return null;
      const app = getApps()[0];
      if (!app) return null;
      analyticsInstance = getAnalytics(app);
      return analyticsInstance;
    } catch {
      return null;
    }
  })();

  return initPromise;
}

/**
 * Loguea un evento. Nunca lanza, nunca bloquea, nunca crashea.
 * Si Analytics no está disponible (nativo, web sin soporte), es no-op.
 */
export async function track(event: AnalyticsEvent): Promise<void> {
  try {
    const rawParams = 'params' in event ? (event.params as Record<string, unknown>) : undefined;
    const params = rawParams ? await redactParams(rawParams) : undefined;
    const a = await ensureAnalytics();
    if (!a) {
      if (__DEV__) console.log('[analytics]', event.name, params ?? '');
      return;
    }
    logEvent(a, event.name as string, params);
  } catch {
    // Silent fail. Analytics nunca debe romper UX.
  }
}

export async function identify(uid: string | null): Promise<void> {
  try {
    const a = await ensureAnalytics();
    if (!a) return;
    setUserId(a, uid);
  } catch {
    // Silent fail.
  }
}

export async function setUserProps(props: Record<string, string | number | boolean>): Promise<void> {
  try {
    const a = await ensureAnalytics();
    if (!a) return;
    setUserProperties(a, props);
  } catch {
    // Silent fail.
  }
}
