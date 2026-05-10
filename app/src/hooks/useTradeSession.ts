import { useEffect } from 'react';
import { useTradeStore } from '../store/tradeStore';
import { subscribeSession } from '../services/tradeSessionService';
import type { TradeSession } from '../features/trade/types';

export function useTradeSession(sessionId: string | null): TradeSession | null {
  const session = useTradeStore((s) => s.session);
  const setSession = useTradeStore((s) => s.setSession);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      return;
    }
    const unsub = subscribeSession(sessionId, (next) => {
      setSession(next);
    });
    return () => {
      unsub();
    };
  }, [sessionId, setSession]);

  if (!sessionId) return null;
  if (session?.id !== sessionId) return null;
  return session;
}
