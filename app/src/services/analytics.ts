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
// Identificadores transitorios de trade (sessionId, tradeId, shortCode) también
// se hashean para no exponer códigos de pareo crudos al backend de analytics.
const HASH_KEYS = new Set(['matchUid', 'targetUid', 'sessionId', 'tradeId', 'shortCode']);
const hashCache = new Map<string, string>();

async function hashId(id: string): Promise<string> {
  const cached = hashCache.get(id);
  if (cached) return cached;
  try {
    const full = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, id);
    const short = full.slice(0, 12);
    hashCache.set(id, short);
    return short;
  } catch {
    return 'h_unknown';
  }
}

async function redactParams(params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (HASH_KEYS.has(key) && typeof value === 'string') {
      out[key] = await hashId(value);
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
  | { name: 'match_whatsapp_clicked'; params: { matchUid: string; expanded?: boolean } }
  | { name: 'match_details_opened'; params: { matchUid: string } }
  | { name: 'match_profile_opened'; params: { matchUid: string } }
  | { name: 'match_map_clicked'; params: { matchUid: string } }
  | { name: 'match_clipboard_copied'; params: { matchUid: string } }
  | { name: 'match_reported'; params: { targetUid: string } }
  | { name: 'event_created'; params: { type: string } }
  | { name: 'event_deleted' }
  | { name: 'event_maps_opened' }
  | { name: 'screen_view'; params: { screen: string } }
  | { name: 'onboarding_started' }
  | { name: 'onboarding_skipped'; params: { atSlide: number } }
  | { name: 'onboarding_completed' }
  | { name: 'share_album_clicked'; params: { stats: string } }
  | { name: 'share_image_generated'; params: { result: string } }
  | { name: 'share_card_generated'; params: { method: string; showName: boolean; showProgress: boolean; showRepeated: boolean; showMissing: boolean } }
  | { name: 'matches_filter_changed'; params: { filter: string } }
  | { name: 'matches_sort_changed'; params: { sort: string } }
  | { name: 'album_cocacola_toggled'; params: { enabled: boolean } }
  | { name: 'web_vital_reported'; params: { metric: string; value: number; rating: string } }
  | { name: 'sticker_searched_by_code'; params: { code: string; matched: boolean } }
  | { name: 'demo_entered' }
  | { name: 'demo_login_clicked' }
  | { name: 'matches_empty_cta_clicked'; params: { reason: string } }
  | { name: 'wishlist_added'; params: { stickerId: string } }
  | { name: 'wishlist_removed'; params: { stickerId: string } }
  | { name: 'reputation_voted'; params: { targetUid: string; vote: 'up' | 'down' } }
  | { name: 'tooltip_shown'; params: { stepId: string } }
  | { name: 'tooltip_dismissed'; params: { stepId: string } }
  | { name: 'landing_viewed' }
  | { name: 'landing_cta_clicked'; params: { cta: string } }
  | { name: 'rankings_viewed'; params: { scope: string } }
  | { name: 'progress_timeline_viewed' }
  | { name: 'album_search_fuzzy_hit'; params: { needleLen: number } }
  | { name: 'og_share_clicked'; params: { method: string } }
  | { name: 'match_limit_reached'; params: { used: number; cap: number } }
  | { name: 'match_slot_unlocked_via_ad'; params: { adsWatchedToday: number } }
  | { name: 'premium_checkout_started' }
  | { name: 'premium_purchase_completed' }
  | { name: 'premium_purchase_failed'; params: { reason: string } }
  | { name: 'ad_rewarded_started' }
  | { name: 'ad_rewarded_completed'; params: { durationMs: number } }
  | { name: 'premium_granted'; params: { source: 'tilopay' | 'play_billing'; alreadyGranted: boolean } }
  | { name: 'play_billing_init_failed'; params: { reason: string } }
  | { name: 'events_zone_resolved'; params: { mode: 'gps' | 'citySlug' | 'blocked'; hasCity: boolean } }
  | { name: 'events_zone_empty_create_clicked' }
  | { name: 'events_no_location_blocked'; params: { canAskAgain: boolean } }
  | { name: 'events_filtered_by_zone'; params: { mode: string; resultCount: number } }
  | { name: 'event_city_set'; params: { source: 'manual' | 'reverse_geocode' | 'gps_default' } }
  | { name: 'matches_filter_default_chosen'; params: { filter: string; hasGps: boolean; hasCity: boolean } }
  | { name: 'matches_filter_fellback'; params: { preferred: string; applied: string } }
  | { name: 'match_batch_saved'; params: { size: number; filter: string } }
  | { name: 'match_history_opened'; params: { batchCount: number } }
  | { name: 'match_history_paywall_shown' }
  | { name: 'match_history_batch_expanded'; params: { batchId: string; ageDays: number } }
  | { name: 'match_history_whatsapp_clicked'; params: { matchUid: string; ageDays: number } }
  | { name: 'match_share_clicked'; params: { isPerfectTrade: boolean; matchUid: string } }
  | { name: 'matches_referral_shared'; params: { uid: string } }
  | { name: 'onboarding_invite_shown' }
  | { name: 'onboarding_invite_clicked' }
  | { name: 'scan_opened' }
  | { name: 'scan_capture_started' }
  | { name: 'scan_capture_failed'; params: { reason: string } }
  | { name: 'scan_recognized'; params: { candidates: number; durationMs: number } }
  | { name: 'scan_no_match' }
  | { name: 'scan_confirmed'; params: { added: number; incremented: number } }
  | { name: 'scan_dismissed' }
  | { name: 'scan_manual_entry'; params: { matched: boolean } }
  | { name: 'trade_session_created'; params: { sessionId: string } }
  | { name: 'trade_qr_scanned'; params: { code: string } }
  | { name: 'album_import_opened'; params: { source: 'album' | 'profile' } }
  | { name: 'album_import_applied'; params: { mode: 'merge' | 'replace'; haveCount: number; wantCount: number; unknownCount: number; addedToWishlist: boolean } }
  | { name: 'match_trade_entrypoint_profile'; params: { matchUid: string } }
  | { name: 'trade_joined'; params: { sessionId: string } }
  | { name: 'trade_confirmed'; params: { sessionId: string; role: 'host' | 'guest'; givesCount: number; receivesCount: number } }
  | { name: 'trade_completed'; params: { sessionId: string; tradeId: string; givesCount: number; receivesCount: number } }
  | { name: 'trade_cancelled'; params: { sessionId: string; reason: string } }
  | { name: 'trade_commit_failed'; params: { sessionId: string; reason: string } }
  | { name: 'trade_list_compare_run'; params: { parsedCount: number; iNeedCount: number; unknownCount: number } }
  | { name: 'trade_list_compare_copied' }
  | { name: 'trade_list_compare_marked_received'; params: { count: number } };

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
