import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { loadUserAlbum } from './albumSyncService';
import { suggestGives } from '../features/trade/utils/tradeSuggestion';
import {
  ACTIVE_TRADE_STATUSES,
  type TradeRole,
  type TradeSession,
  type TradeSessionStatus,
} from '../features/trade/types';
import type { AppUser } from '../types/user';

function fromDoc(id: string, data: Record<string, unknown>): TradeSession {
  return {
    id,
    shortCode: String(data.shortCode ?? ''),
    hostUid: String(data.hostUid ?? ''),
    guestUid: (data.guestUid as string | null) ?? null,
    hostName: String(data.hostName ?? ''),
    guestName: (data.guestName as string | null) ?? null,
    hostPhotoUrl: (data.hostPhotoUrl as string | null) ?? null,
    guestPhotoUrl: (data.guestPhotoUrl as string | null) ?? null,
    status: (data.status as TradeSessionStatus) ?? 'waiting',
    hostStickers: Array.isArray(data.hostStickers) ? (data.hostStickers as string[]) : [],
    guestStickers: Array.isArray(data.guestStickers) ? (data.guestStickers as string[]) : [],
    hostConfirmedAt: (data.hostConfirmedAt as number | null) ?? null,
    guestConfirmedAt: (data.guestConfirmedAt as number | null) ?? null,
    createdAt: Number(data.createdAt ?? 0),
    expiresAt: Number(data.expiresAt ?? 0),
    completedAt: (data.completedAt as number | null) ?? null,
    tradeId: (data.tradeId as string | null) ?? null,
    failureReason: (data.failureReason as string | null) ?? null,
  };
}

export async function findActiveSessionForUser(
  uid: string,
): Promise<TradeSession | null> {
  const now = Date.now();
  const activeStatuses = Array.from(ACTIVE_TRADE_STATUSES);

  const [hostSnap, guestSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, 'tradeSessions'),
        where('hostUid', '==', uid),
        where('status', 'in', activeStatuses),
        limit(1),
      ),
    ),
    getDocs(
      query(
        collection(db, 'tradeSessions'),
        where('guestUid', '==', uid),
        where('status', 'in', activeStatuses),
        limit(1),
      ),
    ),
  ]);

  const docSnap = !hostSnap.empty ? hostSnap.docs[0] : !guestSnap.empty ? guestSnap.docs[0] : null;
  if (!docSnap) return null;
  const session = fromDoc(docSnap.id, docSnap.data());
  if (session.expiresAt < now) return null;
  return session;
}

export async function createSession(host: AppUser): Promise<TradeSession> {
  const myAlbum = await loadUserAlbum(host.uid);
  const initialHostStickers = Object.entries(myAlbum?.repeatedCounts ?? {})
    .filter(([, count]) => count > 0)
    .map(([id]) => id)
    .slice(0, 25);

  const callable = httpsCallable<
    { hostStickers: string[] },
    { ok: true; sessionId: string; shortCode: string }
  >(functions, 'createTradeSession');
  let res;
  try {
    res = await callable({ hostStickers: initialHostStickers });
  } catch (e) {
    const err = e as { code?: string; message?: string; details?: Record<string, unknown> };
    if (err?.code === 'functions/failed-precondition') {
      throw new TradeError('existing_session', err.message ?? 'Ya tenés un intercambio en curso.', err.details);
    }
    if (err?.code === 'functions/resource-exhausted') {
      throw new TradeError('shortcode_collision', 'No pudimos generar un código único, probá de nuevo.');
    }
    throw new TradeError('create_failed', err?.message ?? 'No se pudo crear la sesión.');
  }

  const snap = await getDoc(doc(db, 'tradeSessions', res.data.sessionId));
  if (!snap.exists()) {
    throw new TradeError('create_failed', 'No se pudo crear la sesión.');
  }
  return fromDoc(snap.id, snap.data());
}

export async function joinSession(shortCode: string): Promise<{ sessionId: string }> {
  const callable = httpsCallable<{ shortCode: string }, { ok: true; sessionId: string }>(
    functions,
    'joinTradeSession',
  );
  const res = await callable({ shortCode });
  return { sessionId: res.data.sessionId };
}

export function subscribeSession(
  sessionId: string,
  onChange: (session: TradeSession | null) => void,
): () => void {
  const ref = doc(db, 'tradeSessions', sessionId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(fromDoc(snap.id, snap.data()));
    },
    (error) => {
      console.error('[trade] subscribe error', error);
    },
  );
}

export async function loadSession(sessionId: string): Promise<TradeSession | null> {
  const snap = await getDoc(doc(db, 'tradeSessions', sessionId));
  if (!snap.exists()) return null;
  return fromDoc(snap.id, snap.data());
}

export async function updateMySelection(
  sessionId: string,
  role: TradeRole,
  stickerIds: string[],
): Promise<void> {
  const ref = doc(db, 'tradeSessions', sessionId);
  const dedup = Array.from(new Set(stickerIds));
  if (role === 'host') {
    await updateDoc(ref, {
      hostStickers: dedup,
      hostConfirmedAt: null,
      status: 'selecting',
    });
  } else {
    await updateDoc(ref, {
      guestStickers: dedup,
      guestConfirmedAt: null,
      status: 'selecting',
    });
  }
}

export async function confirmTrade(sessionId: string, role: TradeRole): Promise<void> {
  const ref = doc(db, 'tradeSessions', sessionId);
  const now = Date.now();
  if (role === 'host') {
    await updateDoc(ref, {
      hostConfirmedAt: now,
      status: 'host_confirmed',
    });
  } else {
    await updateDoc(ref, {
      guestConfirmedAt: now,
      status: 'guest_confirmed',
    });
  }
}

export async function commitTradeSession(sessionId: string): Promise<{ tradeId: string }> {
  const callable = httpsCallable<{ sessionId: string }, { ok: true; tradeId?: string; alreadyCompleted?: boolean }>(
    functions,
    'commitTradeSession',
  );
  const res = await callable({ sessionId });
  return { tradeId: res.data.tradeId ?? '' };
}

export async function cancelTradeSession(
  sessionId: string,
  reason: string = 'user_cancelled',
): Promise<void> {
  const callable = httpsCallable<{ sessionId: string; reason?: string }, { ok: true }>(
    functions,
    'cancelTradeSession',
  );
  await callable({ sessionId, reason });
}

export function computeSuggestionForGuest(
  guestAlbum: Awaited<ReturnType<typeof loadUserAlbum>>,
  hostAlbum: Awaited<ReturnType<typeof loadUserAlbum>>,
): string[] {
  return suggestGives(guestAlbum, hostAlbum);
}

export class TradeError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
