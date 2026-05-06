import { Platform } from 'react-native';

// Test Unit IDs de Google. Reemplazar por los IDs reales de AdMob antes de release.
// Docs: https://developers.google.com/admob/android/test-ads
const TEST_BANNER_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_BANNER_IOS = 'ca-app-pub-3940256099942544/2934735716';
const TEST_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_INTERSTITIAL_IOS = 'ca-app-pub-3940256099942544/4411468910';

// Reemplazar por los IDs reales cuando se publique
const PROD_BANNER_ANDROID = '';
const PROD_BANNER_IOS = '';
const PROD_INTERSTITIAL_ANDROID = '';
const PROD_INTERSTITIAL_IOS = '';

const useProd = !__DEV__ && (Platform.OS === 'android' ? PROD_BANNER_ANDROID : PROD_BANNER_IOS);

export const adUnitIds = {
  banner: useProd
    ? Platform.OS === 'android' ? PROD_BANNER_ANDROID : PROD_BANNER_IOS
    : Platform.OS === 'android' ? TEST_BANNER_ANDROID : TEST_BANNER_IOS,
  interstitial: __DEV__
    ? Platform.OS === 'android' ? TEST_INTERSTITIAL_ANDROID : TEST_INTERSTITIAL_IOS
    : Platform.OS === 'android' ? PROD_INTERSTITIAL_ANDROID : PROD_INTERSTITIAL_IOS,
};

/**
 * Detecta si AdMob nativo está disponible.
 * En Expo Go / web esto devuelve false y los componentes de Ads no se renderizan.
 * En EAS build / dev build con react-native-google-mobile-ads enlazado, devuelve true.
 */
export function isAdMobAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    // El paquete carga aunque el módulo nativo no esté linkeado, pero crear componentes falla.
    // Detectamos presencia del módulo nativo Turbo:
    const mod = require('react-native-google-mobile-ads');
    return typeof mod?.default === 'function';
  } catch {
    return false;
  }
}
