// En web no se sirven ads de AdMob, así que el flujo UMP es no-op.
// Mantenemos la firma para no romper imports en código compartido.

export async function initAdsConsent(): Promise<void> {
  return;
}

export async function showAdsPrivacyOptions(): Promise<void> {
  return;
}

export function isAdsConsentReady(): boolean {
  return true;
}

export function shouldRequestNonPersonalizedAdsOnly(): boolean {
  return true;
}
