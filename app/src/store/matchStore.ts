import { create } from 'zustand';
import type { Match } from '../services/matchingService';

type MatchStore = {
  matches: Match[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  setMatches: (matches: Match[]) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
};

export const useMatchStore = create<MatchStore>((set) => ({
  matches: [],
  loading: false,
  error: null,
  lastFetched: null,
  setMatches: (matches) => set({ matches, lastFetched: Date.now() }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
