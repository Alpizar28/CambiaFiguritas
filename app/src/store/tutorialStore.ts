import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { track } from '../services/analytics';

type TutorialState = {
  completed: Record<string, true>;
  active: string | null;
  show: (id: string) => void;
  complete: (id: string) => void;
  isCompleted: (id: string) => boolean;
  reset: () => void;
};

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      completed: {},
      active: null,
      show: (id) => {
        if (get().completed[id]) return;
        if (get().active && get().active !== id) return;
        set({ active: id });
        track({ name: 'tooltip_shown', params: { stepId: id } });
      },
      complete: (id) => {
        set((state) => ({
          completed: { ...state.completed, [id]: true },
          active: state.active === id ? null : state.active,
        }));
        track({ name: 'tooltip_dismissed', params: { stepId: id } });
      },
      isCompleted: (id) => Boolean(get().completed[id]),
      reset: () => set({ completed: {}, active: null }),
    }),
    {
      name: 'tutorial-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
