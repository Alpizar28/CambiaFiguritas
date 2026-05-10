export type TradeRole = 'host' | 'guest';

export type TradeSessionStatus =
  | 'waiting'
  | 'paired'
  | 'selecting'
  | 'host_confirmed'
  | 'guest_confirmed'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type TradeSession = {
  id: string;
  shortCode: string;
  hostUid: string;
  guestUid: string | null;
  hostName: string;
  guestName: string | null;
  hostPhotoUrl: string | null;
  guestPhotoUrl: string | null;
  status: TradeSessionStatus;
  hostStickers: string[];
  guestStickers: string[];
  hostConfirmedAt: number | null;
  guestConfirmedAt: number | null;
  createdAt: number;
  expiresAt: number;
  completedAt: number | null;
  tradeId: string | null;
  failureReason: string | null;
};

export const ACTIVE_TRADE_STATUSES: ReadonlySet<TradeSessionStatus> = new Set<TradeSessionStatus>(
  ['waiting', 'paired', 'selecting', 'host_confirmed', 'guest_confirmed'],
);
