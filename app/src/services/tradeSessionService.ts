import {
  addDoc,
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
import { generateShortCode } from '../features/trade/utils/shortCode';
import { suggestGives } from '../features/trade/utils/tradeSuggestion';
import {
  ACTIVE_TRADE_STATUSES,
  type TradeRole,
  type TradeSession,
  type TradeSessionStatus,
} from '../features/trade/types';
import type { AppUser } from '../types/user';

const SESSION_TTL_MS = 10 * 60 * 1000;
const MAX_SHORT_CODE_RETRIES = 8;

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

async function shortCodeIsTaken(shortCode: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, 'tradeSessions'),
      where('shortCode', '==', shortCode),
      where('status', '==', 'waiting'),
      limit(1),
    ),
  );
  return !snap.empty;
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
  const existing = await findActiveSessionForUser(host.uid);
  if (existing) {
    throw new TradeError('existing_session', 'Ya tenés un intercambio en curso.', {
      sessionId: existing.id,
    });
  }

  const myAlbum = await loadUserAlbum(host.uid);

  let shortCode = '';
  for (let attempt = 0; attempt < MAX_SHORT_CODE_RETRIES; attempt += 1) {
    const candidate = generateShortCode();
    if (!(await shortCodeIsTaken(candidate))) {
      shortCode = candidate;
      break;
    }
  }
  if (!shortCode) {
    throw new TradeError('shortcode_collision', 'No pudimos generar un código único, probá de nuevo.');
  }

  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;

  const initialHostStickers = Object.entries(myAlbum?.repeatedCounts ?? {})
    .filter(([, count]) => count > 0)
    .map(([id]) => id)
    .slice(0, 25);

  const sessionRef = await addDoc(collection(db, 'tradeSessions'), {
    shortCode,
    hostUid: host.uid,
    guestUid: null,
    hostName: host.name,
    guestName: null,
    hostPhotoUrl: host.photoUrl ?? null,
    guestPhotoUrl: null,
    status: 'waiting' as TradeSessionStatus,
    hostStickers: initialHostStickers,
    guestStickers: [],
    hostConfirmedAt: null,
    guestConfirmedAt: null,
    createdAt: now,
    expiresAt,
    completedAt: null,
    tradeId: null,
    failureReason: null,
  });

  const snap = await getDoc(sessionRef);
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
