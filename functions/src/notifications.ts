import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging, type Message } from 'firebase-admin/messaging';

type AlbumDoc = {
  statuses?: Record<string, string>;
  repeatedCounts?: Record<string, number>;
  wishlist?: Record<string, true>;
};

type UserDoc = {
  uid?: string;
  name?: string;
  notifyOnMatch?: boolean;
  lastNotifiedAt?: number;
};

const NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const MAX_TARGETS_PER_TRIGGER = 5;

/**
 * Lee el fcmToken desde la subcollection privada del usuario.
 * (Vive en `users/{uid}/private/notifications`; main doc ya no lo expone.)
 */
export async function readFcmToken(uid: string): Promise<string | null> {
  const db = getFirestore();
  const snap = await db.doc(`users/${uid}/private/notifications`).get();
  if (!snap.exists) return null;
  const token = (snap.data() as { fcmToken?: string }).fcmToken;
  return token ?? null;
}

/**
 * Envía push y limpia token inválido. Devuelve true si efectivamente envió.
 */
export async function sendPushSafe(
  targetUid: string,
  token: string,
  payload: Omit<Message, 'token'>,
): Promise<boolean> {
  const db = getFirestore();
  try {
    await getMessaging().send({ ...payload, token });
    await db.doc(`users/${targetUid}`).update({ lastNotifiedAt: Date.now() });
    return true;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    logger.warn(`[push] failed for ${targetUid}: ${e.message ?? 'unknown'}`);
    if (
      e.code === 'messaging/invalid-registration-token' ||
      e.code === 'messaging/registration-token-not-registered'
    ) {
      await db
        .doc(`users/${targetUid}/private/notifications`)
        .update({ fcmToken: FieldValue.delete() })
        .catch(() => {});
    }
    return false;
  }
}

function diffKeys<T>(prev: Record<string, T> = {}, next: Record<string, T> = {}): {
  added: string[];
  removed: string[];
} {
  const prevSet = new Set(Object.keys(prev));
  const nextSet = new Set(Object.keys(next));
  const added: string[] = [];
  const removed: string[] = [];
  nextSet.forEach((k) => { if (!prevSet.has(k)) added.push(k); });
  prevSet.forEach((k) => { if (!nextSet.has(k)) removed.push(k); });
  return { added, removed };
}

function repeatedSet(album: AlbumDoc): Set<string> {
  const out = new Set<string>();
  const statuses = album.statuses ?? {};
  for (const [id, status] of Object.entries(statuses)) {
    if (status === 'repeated') out.add(id);
  }
  return out;
}

/**
 * Trigger: cuando un user actualiza su userAlbum y agrega NUEVAS repetidas,
 * encontrar usuarios cuyo WISHLIST contenga esas repes y mandarles push.
 *
 * Cooldown 6h por destinatario para no spammear.
 * Cap 5 destinatarios por trigger para limitar costo.
 */
export const onAlbumUpdateNotify = onDocumentWritten(
  { document: 'userAlbums/{uid}', region: 'us-central1' },
  async (event) => {
    const before = (event.data?.before.data() ?? {}) as AlbumDoc;
    const after = (event.data?.after.data() ?? {}) as AlbumDoc;
    if (!event.data?.after.exists) return;

    const sourceUid = event.params.uid;
    const beforeRepes = repeatedSet(before);
    const afterRepes = repeatedSet(after);

    const newRepes: string[] = [];
    afterRepes.forEach((id) => {
      if (!beforeRepes.has(id)) newRepes.push(id);
    });
    if (newRepes.length === 0) return;

    logger.info(`[notifications] ${sourceUid} agregó ${newRepes.length} repes nuevas`, { newRepes });

    const db = getFirestore();
    const sourceUserSnap = await db.doc(`users/${sourceUid}`).get();
    const sourceUser = sourceUserSnap.exists ? (sourceUserSnap.data() as UserDoc) : null;
    const sourceName = sourceUser?.name?.split(' ')[0] ?? 'Alguien';

    const allAlbumsSnap = await db.collection('userAlbums').limit(200).get();
    const candidates: Array<{ uid: string; matchedRepes: string[]; wishlistSize: number }> = [];

    allAlbumsSnap.forEach((doc) => {
      if (doc.id === sourceUid) return;
      const album = doc.data() as AlbumDoc;
      const wishlist = album.wishlist ?? {};
      const matched = newRepes.filter((id) => wishlist[id]);
      if (matched.length === 0) return;
      candidates.push({
        uid: doc.id,
        matchedRepes: matched,
        wishlistSize: Object.keys(wishlist).length,
      });
    });

    if (candidates.length === 0) {
      logger.info('[notifications] No candidates con wishlist match');
      return;
    }

    candidates.sort((a, b) => {
      if (b.matchedRepes.length !== a.matchedRepes.length) {
        return b.matchedRepes.length - a.matchedRepes.length;
      }
      return a.wishlistSize - b.wishlistSize;
    });
    const top = candidates.slice(0, MAX_TARGETS_PER_TRIGGER);

    const now = Date.now();
    const sends: Promise<unknown>[] = [];

    for (const candidate of top) {
      const userSnap = await db.doc(`users/${candidate.uid}`).get();
      if (!userSnap.exists) continue;
      const user = userSnap.data() as UserDoc;
      if (user.notifyOnMatch === false) continue;
      if (user.lastNotifiedAt && now - user.lastNotifiedAt < NOTIFY_COOLDOWN_MS) continue;
      const fcmToken = await readFcmToken(candidate.uid);
      if (!fcmToken) continue;

      const matchCountText = candidate.matchedRepes.length === 1
        ? '1 figurita'
        : `${candidate.matchedRepes.length} figuritas`;

      sends.push(
        sendPushSafe(candidate.uid, fcmToken, {
          notification: {
            title: '¡Nuevo match en tu wishlist!',
            body: `${sourceName} subió ${matchCountText} que estás buscando.`,
          },
          webpush: {
            fcmOptions: { link: 'https://cambiafiguritas.online/' },
            notification: { icon: '/icon-192.png', badge: '/icon-192.png' },
          },
          data: {
            type: 'wishlist_match',
            sourceUid,
            stickerIds: candidate.matchedRepes.join(','),
          },
        }),
      );
    }

    await Promise.all(sends);
    logger.info(`[notifications] ${sends.length} pushes enviados`);
  },
);
