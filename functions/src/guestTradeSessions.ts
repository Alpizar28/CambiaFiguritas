import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFcmToken, sendPushSafe } from './notifications';

type StickerStatus = 'missing' | 'owned' | 'repeated' | 'special';

type AlbumDoc = {
  statuses?: Record<string, StickerStatus>;
  repeatedCounts?: Record<string, number>;
  wishlist?: Record<string, true>;
  updatedAt?: number;
};

type UserDoc = {
  name?: string;
  photoUrl?: string;
  privacyAnonymous?: boolean;
  privacyHideRepeated?: boolean;
};

type GuestStatus =
  | 'waiting_guest'
  | 'guest_submitted'
  | 'completed'
  | 'cancelled'
  | 'expired';

type GuestSubmission = {
  rawText: string;
  repeated: string[];
  missing: string[];
  contact: string | null;
  submittedAt: number;
  ip: string;
};

type MatchedExchange = {
  hostGives: string[];
  hostReceives: string[];
  computedAt: number;
};

type GuestSessionDoc = {
  token: string;
  hostUid: string;
  hostName: string;
  hostPhotoUrl: string | null;
  hostStickers: string[];
  hostNeeds: string[];
  status: GuestStatus;
  submissionCount: number;
  guestSubmission: GuestSubmission | null;
  matchedExchange: MatchedExchange | null;
  guestContactSnapshot: string | null;
  createdAt: number;
  expiresAt: number;
  completedAt: number | null;
  tradeId: string | null;
  failureReason: string | null;
};

const MAX_STICKERS_PER_SIDE = 200;
const MAX_RAW_TEXT_LEN = 20000;
const MAX_SUBMISSIONS_PER_TOKEN = 10;
const GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const TOKEN_REGEX = /^[A-Za-z0-9_-]{10,24}$/;
const STICKER_ID_REGEX = /^(?:00|FW(?:[1-9]|1[0-9])|CC(?:[1-9]|1[0-2])|[A-Z]{2,4}(?:[1-9]|1[0-9]|20))$/;

function assertAuth(uid: string | undefined): asserts uid is string {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Necesitás iniciar sesión.');
  }
}

function generateToken(len = 14): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require('node:crypto') as typeof import('node:crypto');
  return nodeCrypto.randomBytes(len).toString('base64url').slice(0, len);
}

function sanitizeStickerList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (out.length >= MAX_STICKERS_PER_SIDE) break;
    const s = String(item).trim();
    if (!STICKER_ID_REGEX.test(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function computeIntersection(
  hostOffers: string[],
  hostNeeds: string[],
  guestRepeated: string[],
  guestMissing: string[],
): MatchedExchange {
  const guestMissingSet = new Set(guestMissing);
  const hostNeedsSet = new Set(hostNeeds);
  const hostGives = hostOffers.filter((id) => guestMissingSet.has(id));
  const hostReceives = guestRepeated.filter((id) => hostNeedsSet.has(id));
  return {
    hostGives: hostGives.slice(0, MAX_STICKERS_PER_SIDE),
    hostReceives: hostReceives.slice(0, MAX_STICKERS_PER_SIDE),
    computedAt: Date.now(),
  };
}

function computeMissingFromAlbum(album: AlbumDoc): string[] {
  const statuses = album.statuses ?? {};
  return Object.entries(statuses)
    .filter(([, status]) => status === 'missing' || status === undefined)
    .map(([id]) => id);
}

function computeRepeatedFromAlbum(album: AlbumDoc): string[] {
  const counts = album.repeatedCounts ?? {};
  return Object.entries(counts)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([id]) => id);
}

// --- createGuestLink: host autenticado crea un link de intercambio asíncrono ---

type CreateGuestPayload = {
  hostStickers?: string[];
  hostNeeds?: string[];
};

export const createGuestLink = onCall<CreateGuestPayload>(
  { region: 'us-central1' },
  async (request) => {
    assertAuth(request.auth?.uid);
    const hostUid = request.auth!.uid;

    const offered = sanitizeStickerList(request.data?.hostStickers);
    const explicitNeeds = sanitizeStickerList(request.data?.hostNeeds);

    const db = getFirestore();
    const now = Date.now();

    const [userSnap, albumSnap] = await Promise.all([
      db.doc(`users/${hostUid}`).get(),
      db.doc(`userAlbums/${hostUid}`).get(),
    ]);
    if (!userSnap.exists) {
      throw new HttpsError('failed-precondition', 'Tu perfil no existe.');
    }
    const user = userSnap.data() as UserDoc;
    const album = albumSnap.exists ? (albumSnap.data() as AlbumDoc) : {};

    // Si host no mandó hostStickers explícitos, default = todas sus repetidas.
    // Idem hostNeeds = todos sus 'missing'.
    const hostOffers = offered.length > 0 ? offered : computeRepeatedFromAlbum(album);
    const hostNeeds = explicitNeeds.length > 0 ? explicitNeeds : computeMissingFromAlbum(album);

    if (hostOffers.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'No tenés repetidas para ofrecer en el intercambio.',
      );
    }

    // Generar token único con reintento mínimo (colisión astronómicamente improbable).
    let token = '';
    for (let i = 0; i < 5; i++) {
      const candidate = generateToken();
      const snap = await db.doc(`guestTradeSessions/${candidate}`).get();
      if (!snap.exists) {
        token = candidate;
        break;
      }
    }
    if (!token) {
      throw new HttpsError('resource-exhausted', 'No pudimos generar el link, probá de nuevo.');
    }

    const isAnonymous = user.privacyAnonymous === true;
    const isHideRepeated = user.privacyHideRepeated === true;

    const sessionDoc: GuestSessionDoc = {
      token,
      hostUid,
      hostName: isAnonymous ? 'Coleccionista' : (user.name ?? 'Coleccionista').slice(0, 80),
      hostPhotoUrl: isAnonymous ? null : user.photoUrl ?? null,
      hostStickers: isHideRepeated ? [] : hostOffers.slice(0, MAX_STICKERS_PER_SIDE),
      hostNeeds: hostNeeds.slice(0, MAX_STICKERS_PER_SIDE),
      status: 'waiting_guest',
      submissionCount: 0,
      guestSubmission: null,
      matchedExchange: null,
      guestContactSnapshot: null,
      createdAt: now,
      expiresAt: now + GUEST_TTL_MS,
      completedAt: null,
      tradeId: null,
      failureReason: null,
    };

    await db.doc(`guestTradeSessions/${token}`).create(sessionDoc);

    return { ok: true, token, url: buildGuestUrl(token) };
  },
);

function buildGuestUrl(token: string): string {
  // El dominio canonico del proyecto. Si el host es PWA, este link abre
  // /x/{token} sin requerir login.
  return `https://cambiafiguritas.online/x/${token}`;
}

// --- getGuestSession: HTTP público sin auth, payload limitado ---

export const getGuestSession = onRequest(
  { region: 'us-central1', memory: '256MiB', cors: true },
  async (req, res) => {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }
    const token = (typeof req.query.token === 'string' ? req.query.token : '').trim();
    if (!TOKEN_REGEX.test(token)) {
      res.status(400).json({ error: 'invalid_token' });
      return;
    }

    try {
      const db = getFirestore();
      const snap = await db.doc(`guestTradeSessions/${token}`).get();
      if (!snap.exists) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const session = snap.data() as GuestSessionDoc;
      const now = Date.now();
      if (session.expiresAt < now && session.status !== 'completed') {
        res.status(410).json({ error: 'expired' });
        return;
      }

      res.set('Cache-Control', 'public, max-age=30, s-maxage=30');
      res.status(200).json({
        token: session.token,
        host: {
          name: session.hostName,
          photoUrl: session.hostPhotoUrl,
        },
        hostStickers: session.hostStickers,
        hostNeeds: session.hostNeeds,
        status: session.status,
        expiresAt: session.expiresAt,
        matchedExchange: session.matchedExchange,
      });
    } catch (err) {
      logger.error(`[getGuestSession] failed for ${token}`, err);
      res.status(500).json({ error: 'internal' });
    }
  },
);

// --- submitGuestOffer: HTTP público sin auth, escribe propuesta del guest ---

type SubmitBody = {
  token?: string;
  rawText?: string;
  repeated?: string[];
  missing?: string[];
  contact?: string;
};

export const submitGuestOffer = onRequest(
  { region: 'us-central1', memory: '256MiB', cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }
    const body = (req.body ?? {}) as SubmitBody;
    const token = String(body.token ?? '').trim();
    if (!TOKEN_REGEX.test(token)) {
      res.status(400).json({ error: 'invalid_token' });
      return;
    }
    const rawText = String(body.rawText ?? '').slice(0, MAX_RAW_TEXT_LEN);
    const repeated = sanitizeStickerList(body.repeated);
    const missing = sanitizeStickerList(body.missing);
    const contact = String(body.contact ?? '').trim().slice(0, 120) || null;
    if (repeated.length === 0 && missing.length === 0) {
      res.status(400).json({ error: 'empty_offer' });
      return;
    }

    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      || req.ip
      || 'unknown';

    try {
      const db = getFirestore();
      const ref = db.doc(`guestTradeSessions/${token}`);
      const now = Date.now();

      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
          return { error: 'not_found' as const };
        }
        const session = snap.data() as GuestSessionDoc;
        if (session.expiresAt < now) {
          return { error: 'expired' as const };
        }
        if (session.status === 'completed' || session.status === 'cancelled') {
          return { error: 'closed' as const };
        }
        if ((session.submissionCount ?? 0) >= MAX_SUBMISSIONS_PER_TOKEN) {
          return { error: 'rate_limited' as const };
        }

        const matched = computeIntersection(
          session.hostStickers,
          session.hostNeeds,
          repeated,
          missing,
        );

        const submission: GuestSubmission = {
          rawText,
          repeated,
          missing,
          contact,
          submittedAt: now,
          ip,
        };

        tx.update(ref, {
          status: 'guest_submitted',
          guestSubmission: submission,
          guestContactSnapshot: contact,
          matchedExchange: matched,
          submissionCount: FieldValue.increment(1),
        });

        return {
          ok: true as const,
          hostUid: session.hostUid,
          hostName: session.hostName,
          matched,
        };
      });

      if ('error' in result) {
        const code = result.error === 'not_found' ? 404
          : result.error === 'expired' ? 410
          : result.error === 'rate_limited' ? 429
          : 409;
        res.status(code).json({ error: result.error });
        return;
      }

      // Best-effort push notification al host.
      try {
        const fcmToken = await readFcmToken(result.hostUid);
        if (fcmToken) {
          await sendPushSafe(result.hostUid, fcmToken, {
            notification: {
              title: 'Te respondieron tu link de intercambio',
              body: `${contact ?? 'Alguien'} te ofrece ${result.matched.hostReceives.length} figuritas que necesitás.`,
            },
            data: {
              type: 'guest_trade_offer',
              token,
            },
          });
        }
      } catch (err) {
        logger.warn(`[submitGuestOffer] push failed for ${result.hostUid}`, err);
      }

      res.status(200).json({
        ok: true,
        host: { name: result.hostName },
        matched: result.matched,
      });
    } catch (err) {
      logger.error(`[submitGuestOffer] failed for ${token}`, err);
      res.status(500).json({ error: 'internal' });
    }
  },
);

// --- commitGuestTrade: host confirma, actualiza solo su album ---

type CommitGuestPayload = { token: string };

export const commitGuestTrade = onCall<CommitGuestPayload>(
  { region: 'us-central1' },
  async (request) => {
    assertAuth(request.auth?.uid);
    const callerUid = request.auth!.uid;
    const token = (request.data?.token ?? '').toString().trim();
    if (!TOKEN_REGEX.test(token)) {
      throw new HttpsError('invalid-argument', 'Token inválido.');
    }

    const db = getFirestore();
    const sessionRef = db.doc(`guestTradeSessions/${token}`);
    const now = Date.now();

    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) {
        throw new HttpsError('not-found', 'Sesión no encontrada.');
      }
      const session = snap.data() as GuestSessionDoc;
      if (session.hostUid !== callerUid) {
        throw new HttpsError('permission-denied', 'No sos el dueño del link.');
      }
      if (session.status === 'completed' && session.tradeId) {
        return { ok: true, alreadyCompleted: true, tradeId: session.tradeId };
      }
      if (session.status !== 'guest_submitted' || !session.matchedExchange) {
        throw new HttpsError('failed-precondition', 'Sin propuesta del guest.');
      }
      if (session.expiresAt < now) {
        tx.update(sessionRef, { status: 'expired', failureReason: 'expired' });
        throw new HttpsError('deadline-exceeded', 'Sesión expirada.');
      }

      const matched = session.matchedExchange;
      const hostGives = Array.from(new Set(matched.hostGives));
      const hostReceives = Array.from(new Set(matched.hostReceives));
      if (hostGives.length === 0 && hostReceives.length === 0) {
        throw new HttpsError('failed-precondition', 'Sin stickers para intercambiar.');
      }
      if (
        hostGives.length > MAX_STICKERS_PER_SIDE ||
        hostReceives.length > MAX_STICKERS_PER_SIDE
      ) {
        throw new HttpsError('invalid-argument', 'Demasiados stickers.');
      }

      const albumRef = db.doc(`userAlbums/${callerUid}`);
      const albumSnap = await tx.get(albumRef);
      const album = (albumSnap.data() as AlbumDoc) ?? {};

      const counts = album.repeatedCounts ?? {};
      for (const id of hostGives) {
        if ((counts[id] ?? 0) <= 0) {
          tx.update(sessionRef, { status: 'cancelled', failureReason: 'stale_inventory' });
          throw new HttpsError(
            'failed-precondition',
            'Inventario desactualizado.',
            { stickerId: id },
          );
        }
      }

      const statuses: Record<string, StickerStatus> = { ...(album.statuses ?? {}) };
      const repeatedCounts: Record<string, number> = { ...counts };

      for (const id of hostGives) {
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
      for (const id of hostReceives) {
        const current = statuses[id] ?? 'missing';
        if (current === 'missing') {
          statuses[id] = 'owned';
        } else {
          statuses[id] = 'repeated';
          repeatedCounts[id] = (repeatedCounts[id] ?? 0) + 1;
        }
      }

      tx.set(
        albumRef,
        { ...album, statuses, repeatedCounts, updatedAt: now },
        { merge: false },
      );

      const tradeRef = db.collection('trades').doc();
      tx.set(tradeRef, {
        uidA: callerUid,
        uidB: null,
        guestContact: session.guestContactSnapshot,
        stickersAtoB: hostGives,
        stickersBtoA: hostReceives,
        guestSessionToken: token,
        completedAt: now,
      });

      tx.update(sessionRef, {
        status: 'completed',
        completedAt: now,
        tradeId: tradeRef.id,
        failureReason: null,
      });

      return { ok: true, tradeId: tradeRef.id };
    });
  },
);

// --- cancelGuestSession ---

type CancelGuestPayload = { token: string; reason?: string };

export const cancelGuestSession = onCall<CancelGuestPayload>(
  { region: 'us-central1' },
  async (request) => {
    assertAuth(request.auth?.uid);
    const callerUid = request.auth!.uid;
    const token = (request.data?.token ?? '').toString().trim();
    const reason = (request.data?.reason ?? 'user_cancelled').toString().slice(0, 60);
    if (!TOKEN_REGEX.test(token)) {
      throw new HttpsError('invalid-argument', 'Token inválido.');
    }

    const db = getFirestore();
    const ref = db.doc(`guestTradeSessions/${token}`);

    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new HttpsError('not-found', 'Sesión no encontrada.');
      }
      const session = snap.data() as GuestSessionDoc;
      if (session.hostUid !== callerUid) {
        throw new HttpsError('permission-denied', 'No sos el dueño del link.');
      }
      if (session.status === 'completed' || session.status === 'cancelled') {
        return { ok: true, alreadyTerminal: true };
      }
      tx.update(ref, { status: 'cancelled', failureReason: reason });
      return { ok: true };
    });
  },
);
