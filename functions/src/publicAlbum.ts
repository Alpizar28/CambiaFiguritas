import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

const VALID_UID = /^[a-zA-Z0-9_-]{1,128}$/;

type AlbumDoc = {
  statuses?: Record<string, string>;
  repeatedCounts?: Record<string, number>;
};

type UserDoc = {
  uid?: string;
  name?: string;
  city?: string;
  photoUrl?: string;
  privacyHideProgress?: boolean;
  privacyHideRepeated?: boolean;
  privacyAnonymous?: boolean;
  premium?: boolean;
};

type PublicAlbumResponse = {
  user: {
    uid: string;
    name: string;
    city: string;
    photoUrl: string | null;
    anonymous: boolean;
    premium: boolean;
  };
  album: {
    statuses: Record<string, 'missing' | 'owned' | 'repeated' | 'special'>;
    repeatedCounts: Record<string, number>;
    ownedCount: number;
    repeatedCount: number;
    missingCount: number;
    hideProgress: boolean;
    hideRepeated: boolean;
  };
};

const ALLOWED_STATUSES = new Set(['owned', 'repeated', 'special']);

function sanitizeStatuses(raw: Record<string, string> = {}): {
  statuses: Record<string, 'missing' | 'owned' | 'repeated' | 'special'>;
  ownedCount: number;
  repeatedCount: number;
} {
  const out: Record<string, 'missing' | 'owned' | 'repeated' | 'special'> = {};
  let ownedCount = 0;
  let repeatedCount = 0;
  for (const [id, status] of Object.entries(raw)) {
    if (!ALLOWED_STATUSES.has(status)) continue;
    out[id] = status as 'owned' | 'repeated' | 'special';
    if (status === 'owned' || status === 'special') ownedCount += 1;
    if (status === 'repeated') {
      ownedCount += 1;
      repeatedCount += 1;
    }
  }
  return { statuses: out, ownedCount, repeatedCount };
}

function sanitizeRepeatedCounts(
  raw: Record<string, number> = {},
  statuses: Record<string, string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, count] of Object.entries(raw)) {
    if (statuses[id] !== 'repeated') continue;
    if (typeof count !== 'number' || !Number.isFinite(count)) continue;
    if (count < 1 || count > 999) continue;
    out[id] = Math.floor(count);
  }
  return out;
}

/**
 * Public read-only álbum. Devuelve solo info pública + estados de stickers.
 * Sin auth requerida. Cache 5 min CDN.
 */
export const getPublicAlbum = onRequest(
  { region: 'us-central1', memory: '256MiB', cors: true },
  async (req, res) => {
    const uid = (typeof req.query.uid === 'string' ? req.query.uid : '').trim();
    if (!uid || !VALID_UID.test(uid)) {
      res.status(400).json({ error: 'invalid_uid' });
      return;
    }

    try {
      const db = getFirestore();
      const [userSnap, albumSnap] = await Promise.all([
        db.doc(`users/${uid}`).get(),
        db.doc(`userAlbums/${uid}`).get(),
      ]);

      if (!userSnap.exists) {
        res.status(404).json({ error: 'user_not_found' });
        return;
      }

      const user = userSnap.data() as UserDoc;
      const album = albumSnap.exists ? (albumSnap.data() as AlbumDoc) : {};

      const hideProgress = user.privacyHideProgress === true;
      const hideRepeated = user.privacyHideRepeated === true;
      const anonymous = user.privacyAnonymous === true;

      const sanitized = sanitizeStatuses(album.statuses);
      let { statuses } = sanitized;
      const { ownedCount, repeatedCount } = sanitized;

      // Si hideRepeated: convertir 'repeated' → 'owned' en payload (oculta cuáles repes hay).
      if (hideRepeated) {
        const masked: Record<string, 'missing' | 'owned' | 'repeated' | 'special'> = {};
        for (const [id, status] of Object.entries(statuses)) {
          masked[id] = status === 'repeated' ? 'owned' : status;
        }
        statuses = masked;
      }

      const repeatedCounts = hideRepeated
        ? {}
        : sanitizeRepeatedCounts(album.repeatedCounts, statuses);

      const totalKnown = Object.keys(statuses).length;
      const missingCount = Math.max(0, totalKnown - ownedCount);

      // hideProgress: ocultamos counts pero mantenemos statuses (puede verse el grid),
      // si quiere bloqueo total, anonymousMode + hideProgress + hideRepeated combo.
      const publicOwned = hideProgress ? 0 : ownedCount;
      const publicRepeated = hideProgress || hideRepeated ? 0 : repeatedCount;
      const publicMissing = hideProgress ? 0 : missingCount;

      const payload: PublicAlbumResponse = {
        user: {
          uid,
          name: anonymous ? 'Coleccionista' : (user.name ?? 'Coleccionista').slice(0, 80),
          city: anonymous ? '' : (user.city ?? '').slice(0, 80),
          photoUrl: anonymous ? null : (user.photoUrl ?? null),
          anonymous,
          premium: !anonymous && user.premium === true,
        },
        album: {
          statuses: hideProgress ? {} : statuses,
          repeatedCounts: hideProgress ? {} : repeatedCounts,
          ownedCount: publicOwned,
          repeatedCount: publicRepeated,
          missingCount: publicMissing,
          hideProgress,
          hideRepeated,
        },
      };

      res.set('Cache-Control', 'public, max-age=60, s-maxage=60');
      res.status(200).json(payload);
    } catch (err) {
      logger.error(`[getPublicAlbum] failed for ${uid}`, err);
      res.status(500).json({ error: 'internal' });
    }
  },
);
