import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { allStickers } from '../features/album/data/mockAlbum';
import { track } from '../services/analytics';
import { haptic } from '../utils/haptics';
import type { StickerStatus, StickerStatusMap } from '../features/album/types';

const stickerById = new Map(allStickers.map((s) => [s.id, s]));

type AlbumStats = {
  total: number;
  owned: number;
  repeated: number;
  missing: number;
  progress: number;
};

type CountryStats = AlbumStats & {
  countryId: string;
};

type AlbumState = {
  statuses: StickerStatusMap;
  repeatedCounts: Record<string, number>;
  setStatus: (stickerId: string, status: StickerStatus) => void;
  markOwned: (stickerId: string) => void;
  markRepeated: (stickerId: string) => void;
  incrementRepeated: (stickerId: string) => void;
  decrementRepeated: (stickerId: string) => void;
  setRepeatedCount: (stickerId: string, count: number) => void;
  resetAlbum: () => void;
  loadState: (statuses: Partial<StickerStatusMap>, repeatedCounts: Partial<Record<string, number>>) => void;
  getStatus: (stickerId: string) => StickerStatus;
  getRepeatedCount: (stickerId: string) => number;
  getStats: () => AlbumStats;
  getCountryStats: (countryId: string) => CountryStats;
  hasLocalData: () => boolean;
};

const initialStatuses: StickerStatusMap = allStickers.reduce<StickerStatusMap>(
  (acc, sticker) => {
    acc[sticker.id] = 'missing';
    return acc;
  },
  {},
);

const initialRepeatedCounts: Record<string, number> = allStickers.reduce<Record<string, number>>(
  (acc, sticker) => {
    acc[sticker.id] = 0;
    return acc;
  },
  {},
);

export const useAlbumStore = create<AlbumState>()(
  persist(
    (set, get) => ({
  statuses: initialStatuses,
  repeatedCounts: initialRepeatedCounts,
  setStatus: (stickerId, status) => {
    set((state) => ({
      statuses: {
        ...state.statuses,
        [stickerId]: status,
      },
    }));
  },
  markOwned: (stickerId) => {
    const previous = get().statuses[stickerId];
    get().setStatus(stickerId, 'owned');
    if (previous !== 'owned') {
      haptic.tap();
      const sticker = stickerById.get(stickerId);
      track({
        name: 'sticker_marked_owned',
        params: { stickerId, countryId: sticker?.countryId },
      });
    }
  },
  markRepeated: (stickerId) => {
    const currentStatus = get().statuses[stickerId];
    if (currentStatus === 'missing') {
      get().setStatus(stickerId, 'owned');
      return;
    }
    const currentCount = get().repeatedCounts[stickerId] ?? 0;
    if (currentStatus !== 'repeated') {
      get().setStatus(stickerId, 'repeated');
    }
    if (currentCount === 0) {
      get().setRepeatedCount(stickerId, 1);
    }
  },
  incrementRepeated: (stickerId) => {
    const currentStatus = get().statuses[stickerId];
    if (currentStatus === 'missing') {
      return;
    }
    const currentCount = get().repeatedCounts[stickerId] ?? 0;
    const newCount = currentCount + 1;
    if (currentStatus === 'owned') {
      set((state) => ({
        statuses: { ...state.statuses, [stickerId]: 'repeated' },
        repeatedCounts: { ...state.repeatedCounts, [stickerId]: newCount },
      }));
    } else if (currentStatus === 'repeated' || currentStatus === 'special') {
      set((state) => ({
        repeatedCounts: { ...state.repeatedCounts, [stickerId]: newCount },
      }));
    }
    haptic.tap();
    const sticker = stickerById.get(stickerId);
    track({
      name: 'sticker_marked_repeated',
      params: { stickerId, countryId: sticker?.countryId, count: newCount },
    });
  },
  decrementRepeated: (stickerId) => {
    const currentStatus = get().statuses[stickerId];
    const currentCount = get().repeatedCounts[stickerId] ?? 0;
    if (currentStatus === 'missing' || currentCount <= 0) {
      return;
    }
    if (currentCount === 1) {
      if (currentStatus === 'special') {
        set((state) => ({
          repeatedCounts: {
            ...state.repeatedCounts,
            [stickerId]: 0,
          },
        }));
      } else {
        set((state) => ({
          statuses: {
            ...state.statuses,
            [stickerId]: 'owned',
          },
          repeatedCounts: {
            ...state.repeatedCounts,
            [stickerId]: 0,
          },
        }));
      }
    } else {
      set((state) => ({
        repeatedCounts: {
          ...state.repeatedCounts,
          [stickerId]: currentCount - 1,
        },
      }));
    }
  },
  setRepeatedCount: (stickerId, count) => {
    const currentStatus = get().statuses[stickerId];
    if (currentStatus === 'missing') {
      return;
    }
    if (count <= 0) {
      if (currentStatus === 'special') {
        set((state) => ({
          repeatedCounts: {
            ...state.repeatedCounts,
            [stickerId]: 0,
          },
        }));
      } else {
        set((state) => ({
          statuses: {
            ...state.statuses,
            [stickerId]: 'owned',
          },
          repeatedCounts: {
            ...state.repeatedCounts,
            [stickerId]: 0,
          },
        }));
      }
    } else {
      set((state) => ({
        statuses: {
          ...state.statuses,
          [stickerId]: 'repeated',
        },
        repeatedCounts: {
          ...state.repeatedCounts,
          [stickerId]: count,
        },
      }));
    }
  },
  resetAlbum: () => {
    set({ statuses: initialStatuses, repeatedCounts: initialRepeatedCounts });
  },
  loadState: (loadedStatuses, loadedCounts) => {
    set({
      statuses: { ...initialStatuses, ...(loadedStatuses as StickerStatusMap) },
      repeatedCounts: { ...initialRepeatedCounts, ...(loadedCounts as Record<string, number>) },
    });
  },
  getStatus: (stickerId) => get().statuses[stickerId] ?? 'missing',
  getRepeatedCount: (stickerId) => get().repeatedCounts[stickerId] ?? 0,
  getStats: () => {
    const stickers = allStickers;
    const statuses = get().statuses;
    const repeatedCounts = get().repeatedCounts;
    const owned = stickers.filter((sticker) => {
      const status = statuses[sticker.id];
      return status === 'owned' || status === 'repeated' || status === 'special';
    }).length;
    const repeated = Object.values(repeatedCounts).reduce((sum, count) => sum + count, 0);
    const total = stickers.length;
    const missing = total - owned;

    return {
      total,
      owned,
      repeated,
      missing,
      progress: total === 0 ? 0 : Math.round((owned / total) * 100),
    };
  },
  getCountryStats: (countryId) => {
    const stickers = allStickers.filter((sticker) => sticker.countryId === countryId);
    const statuses = get().statuses;
    const repeatedCounts = get().repeatedCounts;
    const owned = stickers.filter((sticker) => {
      const status = statuses[sticker.id];
      return status === 'owned' || status === 'repeated' || status === 'special';
    }).length;
    const repeated = stickers.reduce((sum, sticker) => {
      return sum + (repeatedCounts[sticker.id] ?? 0);
    }, 0);
    const total = stickers.length;
    const missing = total - owned;

    return {
      countryId,
      total,
      owned,
      repeated,
      missing,
      progress: total === 0 ? 0 : Math.round((owned / total) * 100),
    };
  },
  hasLocalData: () => {
    const statuses = get().statuses;
    for (const id in statuses) {
      if (statuses[id] && statuses[id] !== 'missing') return true;
    }
    return false;
  },
    }),
    {
      name: 'cambiafiguritas-album-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        statuses: state.statuses,
        repeatedCounts: state.repeatedCounts,
      }),
    },
  ),
);
