import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Estado en memoria del consentimiento. AdBanner lo lee para decidir si pedir
// ads personalizados o no. Se actualiza cuando el flujo UMP termina.
let nonPersonalizedOnly = true;
let consentInitialized = false;

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const isWeb = Platform.OS === 'web';

function loadModule() {
  if (isWeb || isExpoGo) return null;
  try {
    return require('react-native-google-mobile-ads');
  } catch {
    return null;
  }
}

/**
 * Inicia el flujo de consentimiento UMP (Google User Messaging Platform).
 * Si el user está en EU/EEA/UK la SDK le muestra un formulario; si está fuera
 * de esa zona, se considera consentido por default (políticas locales).
 *
 * Resultado: actualiza `nonPersonalizedOnly` para que AdBanner use el modo correcto.
 */
export async function initAdsConsent(): Promise<void> {
  const mod = loadModule();
  if (!mod) return;
  const AdsConsent = mod.AdsConsent;
  if (!AdsConsent) return;

  try {
    const info = await AdsConsent.requestInfoUpdate();
    if (info.isConsentFormAvailable) {
      const formResult = await AdsConsent.loadAndShowConsentFormIfRequired();
      // formResult.status puede ser OBTAINED, REQUIRED, NOT_REQUIRED, UNKNOWN
      // Si OBTAINED → consentido. Si NOT_REQUIRED → fuera de EU, ads personalizados OK.
      const choices = await AdsConsent.getUserChoices();
      // Si el user rechazó publicidad personalizada, requestNonPersonalizedAdsOnly = true.
      nonPersonalizedOnly = !choices.selectPersonalisedAds;
    } else {
      nonPersonalizedOnly = false;
    }
    consentInitialized = true;
  } catch {
    // Falla silenciosa: dejamos default (no personalizados) para estar del lado seguro.
    consentInitialized = true;
  }
}

/**
 * Permite al usuario re-abrir el formulario de consentimiento desde Profile.
 */
export async function showAdsPrivacyOptions(): Promise<void> {
  const mod = loadModule();
  if (!mod) return;
  const AdsConsent = mod.AdsConsent;
  if (!AdsConsent) return;
  try {
    await AdsConsent.showPrivacyOptionsForm();
    const choices = await AdsConsent.getUserChoices();
    nonPersonalizedOnly = !choices.selectPersonalisedAds;
  } catch {
    // Ignorar.
  }
}

export function isAdsConsentReady(): boolean {
  return consentInitialized;
}

export function shouldRequestNonPersonalizedAdsOnly(): boolean {
  return nonPersonalizedOnly;
}
