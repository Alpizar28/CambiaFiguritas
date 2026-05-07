import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { track } from '../services/analytics';
import { isDemoMode } from './userStore';

type WishlistState = {
  items: Record<string, true>;
  toggle: (stickerId: string) => void;
  add: (stickerId: string) => void;
  remove: (stickerId: string) => void;
  isWishlisted: (stickerId: string) => boolean;
  count: () => number;
  load: (items: Record<string, true>) => void;
  reset: () => void;
};

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: {},
      toggle: (stickerId) => {
        if (isDemoMode()) return;
        const isCurrent = get().items[stickerId];
        if (isCurrent) {
          get().remove(stickerId);
        } else {
          get().add(stickerId);
        }
      },
      add: (stickerId) => {
        if (isDemoMode()) return;
        if (get().items[stickerId]) return;
        set((state) => ({ items: { ...state.items, [stickerId]: true } }));
        track({ name: 'wishlist_added', params: { stickerId } });
      },
      remove: (stickerId) => {
        if (isDemoMode()) return;
        if (!get().items[stickerId]) return;
        set((state) => {
          const next = { ...state.items };
          delete next[stickerId];
          return { items: next };
        });
        track({ name: 'wishlist_removed', params: { stickerId } });
      },
      isWishlisted: (stickerId) => Boolean(get().items[stickerId]),
      count: () => Object.keys(get().items).length,
      load: (items) => set({ items }),
      reset: () => set({ items: {} }),
    }),
    {
      name: 'wishlist-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
