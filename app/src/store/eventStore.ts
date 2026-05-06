import { create } from 'zustand';
import type { AppEvent } from '../features/events/types';

type EventStore = {
  events: AppEvent[];
  loading: boolean;
  error: string | null;
  setEvents: (events: AppEvent[]) => void;
  addEvent: (event: AppEvent) => void;
  removeEvent: (id: string) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
};

export const useEventStore = create<EventStore>((set) => ({
  events: [],
  loading: false,
  error: null,
  setEvents: (events) => set({ events }),
  addEvent: (event) => set((s) => ({ events: [...s.events, event] })),
  removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
