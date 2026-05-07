import { Platform } from 'react-native';
import { getAnalytics, isSupported, logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { getApps } from 'firebase/app';
import './firebase'; // ensure firebase app is initialized

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
  | { name: 'event_created'; params: { type: string } }
  | { name: 'event_deleted' }
  | { name: 'event_maps_opened' }
  | { name: 'screen_view'; params: { screen: string } }
  | { name: 'onboarding_started' }
  | { name: 'onboarding_skipped'; params: { atSlide: number } }
  | { name: 'onboarding_completed' };

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
    const a = await ensureAnalytics();
    if (!a) {
      if (__DEV__) console.log('[analytics]', event.name, 'params' in event ? event.params : '');
      return;
    }
    logEvent(a, event.name as string, 'params' in event ? event.params : undefined);
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
