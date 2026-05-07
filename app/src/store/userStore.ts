import { create } from 'zustand';
import type { AppUser } from '../types/user';

type UserStore = {
  user: AppUser | null;
  loading: boolean;
  demoMode: boolean;
  setUser: (user: AppUser | null) => void;
  setLoading: (loading: boolean) => void;
  enterDemo: () => void;
  exitDemo: () => void;
};

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  loading: true,
  demoMode: false,
  setUser: (user) => set({ user, demoMode: user ? false : false }),
  setLoading: (loading) => set({ loading }),
  enterDemo: () => set({ demoMode: true }),
  exitDemo: () => set({ demoMode: false }),
}));

// Helper exportado para usar fuera de hooks (en stores de zustand).
export function isDemoMode(): boolean {
  return useUserStore.getState().demoMode;
}
