import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { allStickers, allStickersWithCocaCola } from '../features/album/data/albumCatalog';
import { track } from '../services/analytics';
import { haptic } from '../utils/haptics';
import { isDemoMode } from './userStore';
import type { StickerStatus, StickerStatusMap } from '../features/album/types';
import type { ImportItem } from '../features/album/utils/importParser';

let onDemoWriteAttempt: (() => void) | null = null;
export function setDemoWriteHandler(handler: (() => void) | null) {
  onDemoWriteAttempt = handler;
}

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
  includeCocaCola: boolean;
  setIncludeCocaCola: (value: boolean) => void;
  setStatus: (stickerId: string, status: StickerStatus) => void;
  markOwned: (stickerId: string) => void;
  markRepeated: (stickerId: string) => void;
  incrementRepeated: (stickerId: string) => void;
  decrementRepeated: (stickerId: string) => void;
  setRepeatedCount: (stickerId: string, count: number) => void;
  resetAlbum: () => void;
  applyImport: (items: ImportItem[], mode: 'merge' | 'replace') => void;
  loadState: (statuses: Partial<StickerStatusMap>, repeatedCounts: Partial<Record<string, number>>) => void;
  getStatus: (stickerId: string) => StickerStatus;
  getRepeatedCount: (stickerId: string) => number;
  getStats: () => AlbumStats;
  getCountryStats: (countryId: string) => CountryStats;
  hasLocalData: () => boolean;
};

// Init incluye Coca-Cola para que CC1..CC12 existan como 'missing' aunque el
// toggle este off. Cuando el user active el toggle, ya estan listos.
const initialStatuses: StickerStatusMap = allStickersWithCocaCola.reduce<StickerStatusMap>(
  (acc, sticker) => {
    acc[sticker.id] = 'missing';
    return acc;
  },
  {},
);

const initialRepeatedCounts: Record<string, number> = allStickersWithCocaCola.reduce<Record<string, number>>(
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
  includeCocaCola: false,
  setIncludeCocaCola: (value) => {
    if (isDemoMode()) {
      onDemoWriteAttempt?.();
      return;
    }
    set({ includeCocaCola: value });
    track({ name: 'album_cocacola_toggled', params: { enabled: value } });
  },
  setStatus: (stickerId, status) => {
    if (isDemoMode()) {
      onDemoWriteAttempt?.();
      return;
    }
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
    if (isDemoMode()) {
      onDemoWriteAttempt?.();
      return;
    }
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
    if (isDemoMode()) {
      onDemoWriteAttempt?.();
      return;
    }
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
  applyImport: (items, mode) => {
    if (isDemoMode()) {
      onDemoWriteAttempt?.();
      return;
    }
    set((state) => {
      const baseStatuses = mode === 'replace' ? { ...initialStatuses } : { ...state.statuses };
      const baseCounts = mode === 'replace' ? { ...initialRepeatedCounts } : { ...state.repeatedCounts };
      for (const item of items) {
        const sticker = stickerById.get(item.stickerId);
        if (item.section === 'want') {
          baseStatuses[item.stickerId] = 'missing';
          baseCounts[item.stickerId] = 0;
          continue;
        }
        // section have
        const isSpecial = sticker?.kind === 'special';
        if (isSpecial) {
          baseStatuses[item.stickerId] = 'special';
          baseCounts[item.stickerId] = Math.max(0, item.copies - 1);
        } else if (item.copies >= 2) {
          baseStatuses[item.stickerId] = 'repeated';
          baseCounts[item.stickerId] = item.copies - 1;
        } else {
          baseStatuses[item.stickerId] = 'owned';
          baseCounts[item.stickerId] = 0;
        }
      }
      return { statuses: baseStatuses, repeatedCounts: baseCounts };
    });
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
    const stickers = get().includeCocaCola ? allStickersWithCocaCola : allStickers;
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
