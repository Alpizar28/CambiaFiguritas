import { create } from 'zustand';
import type { AppUser } from '../types/user';

type UserStore = {
  user: AppUser | null;
  loading: boolean;
  setUser: (user: AppUser | null) => void;
  setLoading: (loading: boolean) => void;
};

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
}));
