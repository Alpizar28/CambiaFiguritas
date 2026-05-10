import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

type StickerStatus = 'missing' | 'owned' | 'repeated' | 'special';

type AlbumDoc = {
  statuses?: Record<string, StickerStatus>;
  repeatedCounts?: Record<string, number>;
  wishlist?: Record<string, true>;
  updatedAt?: number;
};

type TradeSessionStatus =
  | 'waiting'
  | 'paired'
  | 'selecting'
  | 'host_confirmed'
  | 'guest_confirmed'
  | 'completed'
  | 'cancelled'
  | 'expired';

type TradeSessionDoc = {
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

const ACTIVE_STATUSES: TradeSessionStatus[] = [
  'waiting',
  'paired',
  'selecting',
  'host_confirmed',
  'guest_confirmed',
];

const MAX_STICKERS_PER_SIDE = 200;

function assertAuth(uid: string | undefined): asserts uid is string {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Necesitás iniciar sesión.');
  }
}

function isExpired(session: TradeSessionDoc, now: number): boolean {
  return session.expiresAt < now;
}

function intersectionRepeatedAndMissing(
  giver: AlbumDoc,
  receiver: AlbumDoc,
  receiverWishlist?: Record<string, true>,
): string[] {
  const giverRepeats = giver.repeatedCounts ?? {};
  const receiverStatuses = receiver.statuses ?? {};
  const ids = Object.keys(giverRepeats).filter((id) => {
    if ((giverRepeats[id] ?? 0) <= 0) return false;
    const status = receiverStatuses[id];
    return !status || status === 'missing';
  });
  if (receiverWishlist && Object.keys(receiverWishlist).length > 0) {
    ids.sort((a, b) => {
      const aw = receiverWishlist[a] ? 1 : 0;
      const bw = receiverWishlist[b] ? 1 : 0;
      return bw - aw;
    });
  }
  return ids.slice(0, 25);
}

type JoinPayload = { shortCode: string };

export const joinTradeSession = onCall<JoinPayload>(
  { region: 'us-central1' },
  async (request) => {
    assertAuth(request.auth?.uid);
    const guestUid = request.auth!.uid;
    const shortCode = (request.data?.shortCode ?? '').toString().trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(shortCode)) {
      throw new HttpsError('invalid-argument', 'Código inválido.');
    }

    const db = getFirestore();
    const now = Date.now();

    const activeAsHost = await db
      .collection('tradeSessions')
      .where('hostUid', '==', guestUid)
      .where('status', 'in', ACTIVE_STATUSES)
      .limit(1)
      .get();
    const activeAsGuest = await db
      .collection('tradeSessions')
      .where('guestUid', '==', guestUid)
      .where('status', 'in', ACTIVE_STATUSES)
      .limit(1)
      .get();
    const existing = !activeAsHost.empty
      ? activeAsHost.docs[0]
      : !activeAsGuest.empty
        ? activeAsGuest.docs[0]
        : null;
    if (existing) {
      const existingData = existing.data() as TradeSessionDoc;
      if (existingData.expiresAt > now) {
        throw new HttpsError(
          'failed-precondition',
          'Ya tenés un intercambio en curso.',
          { existingSessionId: existing.id },
        );
      }
    }

    const matching = await db
      .collection('tradeSessions')
      .where('shortCode', '==', shortCode)
      .where('status', '==', 'waiting')
      .limit(1)
      .get();
    if (matching.empty) {
      throw new HttpsError('not-found', 'Sesión no encontrada o ya emparejada.');
    }
    const sessionRef = matching.docs[0].ref;

    const guestUserSnap = await db.doc(`users/${guestUid}`).get();
    if (!guestUserSnap.exists) {
      throw new HttpsError('failed-precondition', 'Tu perfil no existe.');
    }
    const guestUser = guestUserSnap.data() as {
      name?: string;
      photoUrl?: string;
    };

    return await db.runTransaction(async (tx) => {
      const sessionSnap = await tx.get(sessionRef);
      if (!sessionSnap.exists) {
        throw new HttpsError('not-found', 'Sesión no encontrada.');
      }
      const session = sessionSnap.data() as TradeSessionDoc;
      if (session.status !== 'waiting' || session.guestUid !== null) {
        throw new HttpsError('failed-precondition', 'Sesión ya emparejada.');
      }
      if (isExpired(session, now)) {
        tx.update(sessionRef, { status: 'expired' });
        throw new HttpsError('deadline-exceeded', 'Sesión expirada.');
      }
      if (session.hostUid === guestUid) {
        throw new HttpsError(
          'failed-precondition',
          'No podés unirte a tu propia sesión.',
        );
      }

      const hostAlbumSnap = await tx.get(db.doc(`userAlbums/${session.hostUid}`));
      const guestAlbumSnap = await tx.get(db.doc(`userAlbums/${guestUid}`));
      const hostAlbum = (hostAlbumSnap.data() as AlbumDoc) ?? {};
      const guestAlbum = (guestAlbumSnap.data() as AlbumDoc) ?? {};

      const guestSuggestion = intersectionRepeatedAndMissing(
        guestAlbum,
        hostAlbum,
        hostAlbum.wishlist,
      );

      tx.update(sessionRef, {
        guestUid,
        guestName: guestUser.name ?? 'Usuario',
        guestPhotoUrl: guestUser.photoUrl ?? null,
        guestStickers: guestSuggestion,
        status: 'paired',
      });

      return {
        ok: true,
        sessionId: sessionRef.id,
      };
    });
  },
);

type CommitPayload = { sessionId: string };

export const commitTradeSession = onCall<CommitPayload>(
  { region: 'us-central1' },
  async (request) => {
    assertAuth(request.auth?.uid);
    const callerUid = request.auth!.uid;
    const sessionId = (request.data?.sessionId ?? '').toString().trim();
    if (!sessionId) {
      throw new HttpsError('invalid-argument', 'sessionId requerido.');
    }

    const db = getFirestore();
    const now = Date.now();
    const sessionRef = db.doc(`tradeSessions/${sessionId}`);
    const tradesCollection = db.collection('trades');

    return await db.runTransaction(async (tx) => {
      const sessionSnap = await tx.get(sessionRef);
      if (!sessionSnap.exists) {
        throw new HttpsError('not-found', 'Sesión no encontrada.');
      }
      const session = sessionSnap.data() as TradeSessionDoc;
      if (session.status === 'completed' && session.tradeId) {
        return { ok: true, alreadyCompleted: true, tradeId: session.tradeId };
      }
      if (callerUid !== session.hostUid && callerUid !== session.guestUid) {
        throw new HttpsError('permission-denied', 'No participás de esta sesión.');
      }
      if (!session.guestUid) {
        throw new HttpsError('failed-precondition', 'Sesión sin guest.');
      }
      if (!session.hostConfirmedAt || !session.guestConfirmedAt) {
        throw new HttpsError(
          'failed-precondition',
          'Falta la confirmación de algún lado.',
        );
      }
      if (session.status === 'cancelled') {
        throw new HttpsError('failed-precondition', 'Sesión cancelada.');
      }
      if (isExpired(session, now)) {
        tx.update(sessionRef, {
          status: 'cancelled',
          failureReason: 'expired',
        });
        throw new HttpsError('deadline-exceeded', 'Sesión expirada.');
      }

      const hostStickers = Array.from(new Set(session.hostStickers ?? []));
      const guestStickers = Array.from(new Set(session.guestStickers ?? []));
      if (hostStickers.length === 0 && guestStickers.length === 0) {
        throw new HttpsError('failed-precondition', 'No hay stickers para intercambiar.');
      }
      if (hostStickers.length > MAX_STICKERS_PER_SIDE || guestStickers.length > MAX_STICKERS_PER_SIDE) {
        throw new HttpsError('invalid-argument', 'Demasiados stickers.');
      }

      const hostAlbumRef = db.doc(`userAlbums/${session.hostUid}`);
      const guestAlbumRef = db.doc(`userAlbums/${session.guestUid}`);
      const [hostAlbumSnap, guestAlbumSnap] = await Promise.all([
        tx.get(hostAlbumRef),
        tx.get(guestAlbumRef),
      ]);
      const hostAlbum = (hostAlbumSnap.data() as AlbumDoc) ?? {};
      const guestAlbum = (guestAlbumSnap.data() as AlbumDoc) ?? {};

      const validateInventory = (album: AlbumDoc, ids: string[], who: 'host' | 'guest') => {
        const counts = album.repeatedCounts ?? {};
        for (const id of ids) {
          if ((counts[id] ?? 0) <= 0) {
            tx.update(sessionRef, {
              status: 'cancelled',
              failureReason: 'stale_inventory',
            });
            throw new HttpsError(
              'failed-precondition',
              `Inventario desactualizado (${who}).`,
              { who, stickerId: id },
            );
          }
        }
      };
      validateInventory(hostAlbum, hostStickers, 'host');
      validateInventory(guestAlbum, guestStickers, 'guest');

      const applyTrade = (
        album: AlbumDoc,
        gives: string[],
        receives: string[],
      ): AlbumDoc => {
        const statuses: Record<string, StickerStatus> = { ...(album.statuses ?? {}) };
        const repeatedCounts: Record<string, number> = { ...(album.repeatedCounts ?? {}) };

        for (const id of gives) {
          const next = (repeatedCounts[id] ?? 0) - 1;
          if (next <= 0) {
            delete repeatedCounts[id];
            if (statuses[id] === 'repeated') {
              statuses[id] = 'owned';
            }
          } else {
            repeatedCounts[id] = next;
          }
        }

        for (const id of receives) {
          const current = statuses[id] ?? 'missing';
          if (current === 'missing') {
            statuses[id] = 'owned';
          } else {
            statuses[id] = 'repeated';
            repeatedCounts[id] = (repeatedCounts[id] ?? 0) + 1;
          }
        }

        return {
          ...album,
          statuses,
          repeatedCounts,
          updatedAt: now,
        };
      };

      const hostNext = applyTrade(hostAlbum, hostStickers, guestStickers);
      const guestNext = applyTrade(guestAlbum, guestStickers, hostStickers);

      tx.set(hostAlbumRef, hostNext, { merge: false });
      tx.set(guestAlbumRef, guestNext, { merge: false });

      const tradeRef = tradesCollection.doc();
      tx.set(tradeRef, {
        uidA: session.hostUid,
        uidB: session.guestUid,
        stickersAtoB: hostStickers,
        stickersBtoA: guestStickers,
        sessionId,
        completedAt: now,
      });

      tx.update(sessionRef, {
        status: 'completed',
        completedAt: now,
        tradeId: tradeRef.id,
        failureReason: null,
      });

      tx.update(db.doc(`users/${session.hostUid}`), {
        reputationUp: FieldValue.increment(1),
        reputationCount: FieldValue.increment(1),
      });
      tx.update(db.doc(`users/${session.guestUid}`), {
        reputationUp: FieldValue.increment(1),
        reputationCount: FieldValue.increment(1),
      });

      return { ok: true, tradeId: tradeRef.id };
    });
  },
);

type CancelPayload = { sessionId: string; reason?: string };

export const cancelTradeSession = onCall<CancelPayload>(
  { region: 'us-central1' },
  async (request) => {
    assertAuth(request.auth?.uid);
    const callerUid = request.auth!.uid;
    const sessionId = (request.data?.sessionId ?? '').toString().trim();
    const reason = (request.data?.reason ?? 'user_cancelled').toString().slice(0, 60);
    if (!sessionId) {
      throw new HttpsError('invalid-argument', 'sessionId requerido.');
    }

    const db = getFirestore();
    const sessionRef = db.doc(`tradeSessions/${sessionId}`);

    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) {
        throw new HttpsError('not-found', 'Sesión no encontrada.');
      }
      const session = snap.data() as TradeSessionDoc;
      if (callerUid !== session.hostUid && callerUid !== session.guestUid) {
        throw new HttpsError('permission-denied', 'No participás de esta sesión.');
      }
      if (session.status === 'completed' || session.status === 'cancelled') {
        return { ok: true, alreadyTerminal: true };
      }
      tx.update(sessionRef, { status: 'cancelled', failureReason: reason });
      return { ok: true };
    });
  },
);
