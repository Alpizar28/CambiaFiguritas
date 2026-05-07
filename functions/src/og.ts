import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { Resvg } from '@resvg/resvg-js';

const TOTAL_STICKERS = 645;
const APP_URL = 'https://cambiafiguritas.web.app';
const VALID_UID = /^[a-zA-Z0-9_-]{1,128}$/;

type AlbumDoc = {
  statuses?: Record<string, string>;
};

type UserDoc = {
  name?: string;
  city?: string;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ownedCount(album: AlbumDoc): number {
  let count = 0;
  for (const status of Object.values(album.statuses ?? {})) {
    if (status === 'owned' || status === 'repeated' || status === 'special') count += 1;
  }
  return count;
}

async function loadShareData(uid: string): Promise<{ name: string; city: string; owned: number; pct: number } | null> {
  const db = getFirestore();
  const [userSnap, albumSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`userAlbums/${uid}`).get(),
  ]);
  if (!userSnap.exists) return null;
  const user = userSnap.data() as UserDoc;
  const album = albumSnap.exists ? (albumSnap.data() as AlbumDoc) : {};
  const owned = ownedCount(album);
  const pct = Math.round((owned / TOTAL_STICKERS) * 100);
  return {
    name: (user.name ?? 'Coleccionista').slice(0, 40),
    city: (user.city ?? '').slice(0, 40),
    owned,
    pct,
  };
}

function buildSvg(name: string, city: string, owned: number, pct: number): string {
  const safeName = escapeXml(name);
  const safeCity = escapeXml(city);
  const barWidth = Math.max(0, Math.min(100, pct)) * 8.4;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A0A0A"/>
      <stop offset="100%" stop-color="#1a1a1a"/>
    </linearGradient>
    <linearGradient id="goldText" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FFD700"/>
      <stop offset="100%" stop-color="#FFA500"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="6" fill="#FFD700"/>
  <text x="80" y="120" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="800" fill="#FFD700" letter-spacing="3">CAMBIAFIGURITAS</text>
  <text x="80" y="160" font-family="system-ui, sans-serif" font-size="20" font-weight="500" fill="#888">Mundial 2026</text>
  <text x="80" y="270" font-family="system-ui, sans-serif" font-size="44" font-weight="800" fill="#fff">${safeName}</text>
  ${safeCity ? `<text x="80" y="310" font-family="system-ui, sans-serif" font-size="22" font-weight="500" fill="#999">${safeCity}</text>` : ''}
  <text x="80" y="450" font-family="system-ui, sans-serif" font-size="180" font-weight="900" fill="url(#goldText)">${pct}%</text>
  <text x="80" y="490" font-family="system-ui, sans-serif" font-size="22" font-weight="600" fill="#fff">${owned} de ${TOTAL_STICKERS} figuritas</text>
  <rect x="80" y="520" width="840" height="14" rx="7" fill="#222"/>
  <rect x="80" y="520" width="${barWidth}" height="14" rx="7" fill="#FFD700"/>
  <text x="80" y="590" font-family="system-ui, sans-serif" font-size="18" font-weight="600" fill="#666">cambiafiguritas.web.app</text>
</svg>`;
}

function extractUidFromPath(req: { path: string; query: Record<string, unknown> }): string | null {
  const m = req.path.match(/\/og\/([^/.]+)\.png$/) || req.path.match(/\/og\/([^/.]+)$/);
  if (m) return m[1];
  const q = req.query.uid;
  if (typeof q === 'string') return q;
  return null;
}

/**
 * Renderiza un PNG OG (1200×630) con stats del usuario. Cacheado 1h en CDN.
 */
export const ogImage = onRequest(
  { region: 'us-central1', memory: '512MiB', cors: true },
  async (req, res) => {
    const start = Date.now();
    const uid = extractUidFromPath(req as unknown as { path: string; query: Record<string, unknown> });
    if (!uid || !VALID_UID.test(uid)) {
      res.status(400).send('invalid uid');
      return;
    }
    try {
      const data = await loadShareData(uid);
      if (!data) {
        res.status(404).send('user not found');
        return;
      }
      const svg = buildSvg(data.name, data.city, data.owned, data.pct);
      const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
      const png = resvg.render().asPng();
      res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      res.type('image/png').status(200).send(png);
      logger.info(`[og] rendered ${uid} in ${Date.now() - start}ms`);
    } catch (err) {
      logger.error(`[og] failed ${uid}`, err);
      res.status(500).send('render failed');
    }
  },
);

/**
 * Devuelve HTML mínimo con OG meta tags por usuario. Bots ven la preview rica;
 * humanos son redirigidos a la app.
 */
export const ogPage = onRequest(
  { region: 'us-central1', memory: '256MiB' },
  async (req, res) => {
    const m = req.path.match(/\/u\/([^/]+)$/);
    const uid = m?.[1];
    if (!uid || !VALID_UID.test(uid)) {
      res.redirect(302, APP_URL);
      return;
    }
    let title = 'CambiaFiguritas — Album Mundial 2026';
    let description = 'Tu album del Mundial 2026. Encontra matches e intercambia figuritas.';
    try {
      const data = await loadShareData(uid);
      if (data) {
        title = `${data.name} va ${data.pct}% del album Mundial 2026`;
        description = `${data.owned}/${TOTAL_STICKERS} figuritas. Encontrá matches en CambiaFiguritas.`;
      }
    } catch (err) {
      logger.warn(`[ogPage] data load failed for ${uid}`, err);
    }

    const imageUrl = `${APP_URL}/og/${encodeURIComponent(uid)}.png`;
    const appLink = `${APP_URL}/?u=${encodeURIComponent(uid)}`;
    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:image" content="${escapeHtml(imageUrl)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${escapeHtml(`${APP_URL}/u/${uid}`)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(description)}"/>
<meta name="twitter:image" content="${escapeHtml(imageUrl)}"/>
<meta http-equiv="refresh" content="0; url=${escapeHtml(appLink)}"/>
<link rel="canonical" href="${escapeHtml(appLink)}"/>
</head>
<body>
<p>Redirigiendo a <a href="${escapeHtml(appLink)}">CambiaFiguritas</a>...</p>
<script>location.replace(${JSON.stringify(appLink)});</script>
</body>
</html>`;
    res.set('Cache-Control', 'public, max-age=600, s-maxage=600');
    res.type('text/html').status(200).send(html);
  },
);
