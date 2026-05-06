import { create } from 'zustand';

export type SyncStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

type SyncStore = {
  status: SyncStatus;
  setStatus: (status: SyncStatus) => void;
};

export const useSyncStore = create<SyncStore>((set) => ({
  status: 'idle',
  setStatus: (status) => set({ status }),
}));
