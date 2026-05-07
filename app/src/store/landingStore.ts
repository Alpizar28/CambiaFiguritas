import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type LandingState = {
  seen: boolean;
  markSeen: () => void;
  reset: () => void;
};

export const useLandingStore = create<LandingState>()(
  persist(
    (set) => ({
      seen: false,
      markSeen: () => set({ seen: true }),
      reset: () => set({ seen: false }),
    }),
    {
      name: 'landing-seen-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
