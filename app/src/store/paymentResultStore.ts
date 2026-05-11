import { create } from 'zustand';

type PaymentResultKind = 'success' | 'failed' | null;

type PaymentResultState = {
  kind: PaymentResultKind;
  showSuccess: () => void;
  showFailed: () => void;
  dismiss: () => void;
};

let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimer(): void {
  if (autoDismissTimer) {
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }
}

export const usePaymentResultStore = create<PaymentResultState>((set) => ({
  kind: null,
  showSuccess: () => {
    clearTimer();
    set({ kind: 'success' });
    autoDismissTimer = setTimeout(() => set({ kind: null }), 8000);
  },
  showFailed: () => {
    clearTimer();
    set({ kind: 'failed' });
    autoDismissTimer = setTimeout(() => set({ kind: null }), 8000);
  },
  dismiss: () => {
    clearTimer();
    set({ kind: null });
  },
}));
