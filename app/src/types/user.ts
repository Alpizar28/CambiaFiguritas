export type AppUser = {
  uid: string;
  name: string;
  // email vive solo en Firebase Auth, no en `users/{uid}` (que es lectura pública).
  // Se rellena en runtime para el dueño desde auth.currentUser; nunca para otros users.
  email?: string;
  photoUrl: string | null;
  city: string;
  whatsapp?: string;
  // lat/lng se guardan bucketeados a múltiplos de 0.05° (~5km) por privacidad.
  lat?: number;
  lng?: number;
  // País legible derivado de reverseGeocode al persistir ubicación.
  country?: string;
  // Epoch ms de la última vez que el dueño abrió la app (escrito con throttle).
  lastSeenAt?: number;
  premium: boolean;
  createdAt: string;
  reputationUp?: number;
  reputationDown?: number;
  reputationCount?: number;
  userTimezone?: string;
  adsWatchedToday?: number;
  adsWatchedDate?: string;
  lastAdUnlockAt?: number;
  // Controles de privacidad. Los aplican otros clientes al renderizar tu data.
  // Si están en true, ocultan información cuando otros usuarios te ven.
  privacyHideProgress?: boolean;
  privacyHideRepeated?: boolean;
  privacyAnonymous?: boolean;
};
