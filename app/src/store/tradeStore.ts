import { create } from 'zustand';
import type { TradeRole, TradeSession } from '../features/trade/types';

type TradeModalIntent =
  | { kind: 'home' }
  | { kind: 'join'; prefilledCode?: string }
  | { kind: 'share' }
  | { kind: 'guest_web'; token: string };

type TradeStore = {
  activeSessionId: string | null;
  role: TradeRole | null;
  session: TradeSession | null;
  modalIntent: TradeModalIntent | null;
  setActive: (sessionId: string, role: TradeRole) => void;
  setSession: (session: TradeSession | null) => void;
  openModal: (intent?: TradeModalIntent) => void;
  closeModal: () => void;
  clear: () => void;
};

export const useTradeStore = create<TradeStore>((set) => ({
  activeSessionId: null,
  role: null,
  session: null,
  modalIntent: null,
  setActive: (sessionId, role) => set({ activeSessionId: sessionId, role }),
  setSession: (session) => set({ session }),
  openModal: (intent = { kind: 'home' }) => set({ modalIntent: intent }),
  closeModal: () => set({ modalIntent: null }),
  clear: () => set({ activeSessionId: null, role: null, session: null }),
}));
