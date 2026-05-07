import { Platform } from 'react-native';

// Sentry stub. Cuando el usuario tenga DSN:
// 1) export EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
// 2) este servicio init Sentry browser real automáticamente.
//
// Sin DSN: no-op completo (loggea a console en dev).
// Solo web por ahora. Native Sentry vendría con sentry-expo + EAS build.

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
// Release injectado en build: el patch script reemplaza __SENTRY_RELEASE__ con bundle hash.
const RELEASE = '__SENTRY_RELEASE__';

let initialized = false;
let sentryRef: typeof import('@sentry/browser') | null = null;

export async function initSentry(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (Platform.OS !== 'web') return;
  if (!DSN) {
    if (__DEV__) console.log('[sentry] sin DSN, no-op');
    return;
  }

  try {
    const Sentry = await import('@sentry/browser');
    Sentry.init({
      dsn: DSN,
      release: RELEASE.startsWith('__') ? undefined : RELEASE,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
      environment: __DEV__ ? 'development' : 'production',
    });
    sentryRef = Sentry;
  } catch {
    // Silent fail. Sentry nunca debe romper UX.
  }
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (sentryRef) {
    try {
      sentryRef.captureException(error, { extra: context });
    } catch {
      // Silent fail.
    }
    return;
  }
  if (__DEV__) console.error('[sentry stub]', error, context);
}

export function setUser(user: { id?: string; email?: string } | null): void {
  if (!sentryRef) return;
  try {
    sentryRef.setUser(user);
  } catch {
    // Silent fail.
  }
}
