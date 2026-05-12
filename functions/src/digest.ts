import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { sendPushSafe } from './notifications';

type AlbumDoc = {
  statuses?: Record<string, string>;
  repeatedCounts?: Record<string, number>;
  wishlist?: Record<string, true>;
  updatedAt?: number;
};

type UserDoc = {
  uid?: string;
  name?: string;
  notifyOnMatch?: boolean;
  lastNotifiedAt?: number;
};

const COOLDOWN_MS = 6 * 60 * 60 * 1000;
const MAX_USERS_PER_RUN = 500;
const MAX_CANDIDATE_ALBUMS = 200;

function repeatedSet(album: AlbumDoc): Set<string> {
  const out = new Set<string>();
  for (const [id, status] of Object.entries(album.statuses ?? {})) {
    if (status === 'repeated') out.add(id);
  }
  return out;
}

function missingSet(album: AlbumDoc, allIds?: Iterable<string>): Set<string> {
  // "missing" = no marcado o status === 'missing'. Aproximación: lo que NO está en statuses
  // como owned/repeated. Sin catálogo completo, derivar desde repes ajenas vs propio statuses.
  const out = new Set<string>();
  const statuses = album.statuses ?? {};
  if (allIds) {
    for (const id of allIds) {
      const s = statuses[id];
      if (!s || s === 'missing') out.add(id);
    }
  }
  return out;
}

/**
 * Daily digest: 09:00 ART. Para cada user activo con fcmToken,
 * cuenta cuántas figuritas que le faltan están como repe en otros albums
 * actualizados en las últimas 24h. Envía un push resumen si > 0.
 *
 * Cap 500 users/run, 200 albums candidatos por user. Reusa cooldown
 * de 6h para evitar duplicar con onAlbumUpdateNotify.
 */
export const dailyDigest = onSchedule(
  {
    schedule: '0 9 * * *',
    timeZone: 'America/Argentina/Buenos_Aires',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async () => {
    const db = getFirestore();
    const now = Date.now();
    const since = now - 24 * 60 * 60 * 1000;

    // Candidate albums: actualizados en las últimas 24h.
    const candidatesSnap = await db
      .collection('userAlbums')
      .where('updatedAt', '>=', since)
      .limit(MAX_CANDIDATE_ALBUMS)
      .get();
    const candidateRepes: Array<{ uid: string; repes: Set<string> }> = [];
    candidatesSnap.forEach((doc) => {
      const album = doc.data() as AlbumDoc;
      const repes = repeatedSet(album);
      if (repes.size > 0) candidateRepes.push({ uid: doc.id, repes });
    });

    if (candidateRepes.length === 0) {
      logger.info('[digest] No hay albums candidatos con repes recientes.');
      return;
    }

    // fcmToken vive en users/{uid}/private/notifications (path nuevo).
    // Durante la transición legacy también escaneamos main docs (`users` con
    // `fcmToken`) y de-duplicamos por uid. Quitar el segundo scan después de la
    // migración (ver functions/scripts/migrate-fcm-tokens.ts).
    const [privateSnap, legacySnap] = await Promise.all([
      db
        .collectionGroup('private')
        .where('fcmToken', '!=', null)
        .limit(MAX_USERS_PER_RUN)
        .get(),
      db
        .collection('users')
        .where('fcmToken', '!=', null)
        .limit(MAX_USERS_PER_RUN)
        .get(),
    ]);

    const candidates = new Map<string, string>();
    for (const privDoc of privateSnap.docs) {
      const uid = privDoc.ref.parent.parent?.id;
      if (!uid) continue;
      const fcmToken = (privDoc.data() as { fcmToken?: string }).fcmToken;
      if (fcmToken && !candidates.has(uid)) candidates.set(uid, fcmToken);
    }
    for (const legacyDoc of legacySnap.docs) {
      const uid = legacyDoc.id;
      if (candidates.has(uid)) continue; // prefer new path
      const fcmToken = (legacyDoc.data() as { fcmToken?: string }).fcmToken;
      if (fcmToken) candidates.set(uid, fcmToken);
    }

    let sentCount = 0;
    for (const [uid, fcmToken] of candidates) {
      const userSnap = await db.doc(`users/${uid}`).get();
      if (!userSnap.exists) continue;
      const user = userSnap.data() as UserDoc;
      if (user.notifyOnMatch === false) continue;
      if (user.lastNotifiedAt && now - user.lastNotifiedAt < COOLDOWN_MS) continue;

      const myAlbumSnap = await db.doc(`userAlbums/${uid}`).get();
      if (!myAlbumSnap.exists) continue;
      const myAlbum = myAlbumSnap.data() as AlbumDoc;
      const myStatuses = myAlbum.statuses ?? {};

      // Coincidencias = stickers que (a) yo NO tengo (status missing/sin marcar)
      //                  (b) están como repe en algún album candidato.
      const allCandidateRepes = new Set<string>();
      for (const c of candidateRepes) {
        if (c.uid === uid) continue;
        c.repes.forEach((r) => allCandidateRepes.add(r));
      }
      let matchCount = 0;
      allCandidateRepes.forEach((stickerId) => {
        const s = myStatuses[stickerId];
        if (!s || s === 'missing') matchCount += 1;
      });
      if (matchCount === 0) continue;

      const body = matchCount === 1
        ? '1 coincidencia nueva hoy'
        : `${matchCount} coincidencias nuevas hoy`;

      const ok = await sendPushSafe(uid, fcmToken, {
        notification: { title: 'Tu resumen diario 🎯', body },
        webpush: {
          fcmOptions: { link: 'https://cambiafiguritas.online/' },
          notification: { icon: '/icon-192.png', badge: '/icon-192.png' },
        },
        data: { type: 'daily_digest', count: String(matchCount) },
      });
      if (ok) sentCount += 1;
    }

    logger.info(`[digest] sent=${sentCount} candidates=${candidateRepes.length} users_scanned=${candidates.size}`);
  },
);
