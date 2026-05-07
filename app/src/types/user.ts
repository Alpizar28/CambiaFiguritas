export type AppUser = {
  uid: string;
  name: string;
  email: string;
  photoUrl: string | null;
  city: string;
  whatsapp?: string;
  lat?: number;
  lng?: number;
  premium: boolean;
  createdAt: string;
  reputationUp?: number;
  reputationDown?: number;
  reputationCount?: number;
  userTimezone?: string;
  adsWatchedToday?: number;
  adsWatchedDate?: string;
  lastAdUnlockAt?: number;
};
