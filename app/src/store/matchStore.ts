import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Match } from '../services/matchingService';

// Default igual al MATCH_MAX_KM hardcoded anterior. El usuario puede cambiarlo
// desde el chip selector y la elección persiste entre sesiones.
export const DEFAULT_RADIUS_KM = 100;

// Opciones disponibles en el selector. `null` = sin límite (ningún filtro por distancia).
export const RADIUS_OPTIONS: ReadonlyArray<{ value: number | null; label: string }> = [
  { value: 5, label: '5 km' },
  { value: 25, label: '25 km' },
  { value: 100, label: '100 km' },
  { value: 500, label: '500 km' },
  { value: null, label: 'Sin límite' },
];

type MatchStore = {
  matches: Match[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  radiusKm: number | null;
  setMatches: (matches: Match[]) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setRadiusKm: (km: number | null) => void;
  resetMatches: () => void;
};

export const useMatchStore = create<MatchStore>()(
  persist(
    (set) => ({
      matches: [],
      loading: false,
      error: null,
      lastFetched: null,
      radiusKm: DEFAULT_RADIUS_KM,
      setMatches: (matches) => set({ matches, lastFetched: Date.now() }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setRadiusKm: (radiusKm) => set({ radiusKm, lastFetched: null }),
      resetMatches: () =>
        set({ matches: [], loading: false, error: null, lastFetched: null }),
    }),
    {
      name: 'cambiafiguritas-matches-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo persistir lo que tiene sentido entre sesiones. loading/error son
      // efímeros; matches y lastFetched permiten ver resultados al reabrir;
      // radiusKm respeta la elección del usuario.
      partialize: (state) => ({
        matches: state.matches,
        lastFetched: state.lastFetched,
        radiusKm: state.radiusKm,
      }),
    },
  ),
);
