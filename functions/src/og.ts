import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { Resvg } from '@resvg/resvg-js';

const TOTAL_STICKERS = 645;
const APP_URL = 'https://cambiafiguritas.online';
const VALID_UID = /^[a-zA-Z0-9_-]{1,128}$/;

type AlbumDoc = {
  statuses?: Record<string, string>;
  repeatedCounts?: Record<string, number>;
};

type UserDoc = {
  name?: string;
  city?: string;
  privacyHideProgress?: boolean;
  privacyHideRepeated?: boolean;
  privacyAnonymous?: boolean;
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

function repeatedCount(album: AlbumDoc): number {
  let count = 0;
  for (const status of Object.values(album.statuses ?? {})) {
    if (status === 'repeated') count += 1;
  }
  return count;
}

function missingCount(album: AlbumDoc): number {
  let count = 0;
  for (const status of Object.values(album.statuses ?? {})) {
    if (status === 'missing') count += 1;
  }
  return count;
}

type ShareData = {
  name: string;
  city: string;
  owned: number;
  repeated: number;
  missing: number;
  pct: number;
};

async function loadShareData(uid: string): Promise<ShareData | null> {
  const db = getFirestore();
  const [userSnap, albumSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`userAlbums/${uid}`).get(),
  ]);
  if (!userSnap.exists) return null;
  const user = userSnap.data() as UserDoc;
  const album = albumSnap.exists ? (albumSnap.data() as AlbumDoc) : {};

  const anonymous = user.privacyAnonymous === true;
  const hideProgress = user.privacyHideProgress === true;
  const hideRepeated = user.privacyHideRepeated === true;

  const rawOwned = ownedCount(album);
  const rawRepeated = repeatedCount(album);
  const rawMissing = missingCount(album);
  const rawPct = Math.round((rawOwned / TOTAL_STICKERS) * 100);

  return {
    name: anonymous ? 'Coleccionista' : (user.name ?? 'Coleccionista').slice(0, 40),
    city: anonymous ? '' : (user.city ?? '').slice(0, 40),
    owned: hideProgress ? 0 : rawOwned,
    repeated: hideProgress || hideRepeated ? 0 : rawRepeated,
    missing: hideProgress ? 0 : rawMissing,
    pct: hideProgress ? 0 : rawPct,
  };
}

function buildSvg(data: ShareData): string {
  const safeName = escapeXml(data.name);
  const safeCity = escapeXml(data.city);
  const barWidth = Math.max(0, Math.min(100, data.pct)) * 8.4;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0D0D1A"/>
      <stop offset="100%" stop-color="#111128"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22C55E"/>
      <stop offset="60%" stop-color="#FFD700"/>
      <stop offset="100%" stop-color="#F97316"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="5" fill="#FFD700"/>
  <rect x="0" y="625" width="1200" height="5" fill="#FFD700"/>

  <!-- Header -->
  <text x="48" y="70" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="800" fill="#FFD700" letter-spacing="2">CAMBIA</text>
  <text x="166" y="70" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="800" fill="#FFFFFF" letter-spacing="2">FIGURITAS</text>
  <text x="48" y="96" font-family="system-ui, sans-serif" font-size="14" font-weight="500" fill="#6B7280">Mundial 2026</text>

  <!-- User name & city -->
  <text x="48" y="175" font-family="system-ui, sans-serif" font-size="52" font-weight="900" fill="#FFFFFF">${safeName}</text>
  ${safeCity ? `<text x="48" y="210" font-family="system-ui, sans-serif" font-size="20" font-weight="500" fill="#A0A0A0">📍 ${safeCity}</text>` : ''}

  <!-- Big percentage -->
  <text x="48" y="380" font-family="system-ui, sans-serif" font-size="180" font-weight="900" fill="#FFD700">${data.pct}%</text>

  <!-- Progress bar -->
  <rect x="48" y="400" width="700" height="16" rx="8" fill="#1E1E3A"/>
  <rect x="48" y="400" width="${barWidth * (700 / 840)}" height="16" rx="8" fill="url(#bar)"/>
  <text x="48" y="434" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#A0A0A0">${data.owned} de ${TOTAL_STICKERS} figuritas</text>

  <!-- Stat boxes -->
  <rect x="48" y="460" width="180" height="110" rx="12" fill="#1A1A2E"/>
  <text x="138" y="520" font-family="system-ui, sans-serif" font-size="48" font-weight="900" fill="#22C55E" text-anchor="middle">${data.owned}</text>
  <text x="138" y="548" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#6B7280" text-anchor="middle">Tengo</text>

  <rect x="248" y="460" width="180" height="110" rx="12" fill="#1A1A2E"/>
  <text x="338" y="520" font-family="system-ui, sans-serif" font-size="48" font-weight="900" fill="#F97316" text-anchor="middle">${data.repeated}</text>
  <text x="338" y="548" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#6B7280" text-anchor="middle">Repes</text>

  <rect x="448" y="460" width="180" height="110" rx="12" fill="#1A1A2E"/>
  <text x="538" y="520" font-family="system-ui, sans-serif" font-size="48" font-weight="900" fill="#6B7280" text-anchor="middle">${data.missing}</text>
  <text x="538" y="548" font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#6B7280" text-anchor="middle">Faltan</text>

  <!-- Right side branding -->
  <rect x="860" y="110" width="292" height="400" rx="16" fill="#1A1A2E"/>
  <text x="1006" y="230" font-family="system-ui, sans-serif" font-size="72" font-weight="900" fill="#FFD700" text-anchor="middle">⚽</text>
  <text x="1006" y="300" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="#FFFFFF" text-anchor="middle">CambiaFiguritas</text>
  <text x="1006" y="328" font-family="system-ui, sans-serif" font-size="13" font-weight="500" fill="#6B7280" text-anchor="middle">Encontrá matches e</text>
  <text x="1006" y="348" font-family="system-ui, sans-serif" font-size="13" font-weight="500" fill="#6B7280" text-anchor="middle">intercambiá figuritas</text>
  <text x="1006" y="400" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#FFD700" text-anchor="middle">cambiafiguritas.online</text>
  <text x="1006" y="490" font-family="system-ui, sans-serif" font-size="11" font-weight="500" fill="#4B5563" text-anchor="middle">Escaneá para intercambiar →</text>

  <!-- Footer -->
  <text x="48" y="600" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#4B5563">cambiafiguritas.online</text>
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
      const svg = buildSvg(data);
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
        description = `${data.owned}/${TOTAL_STICKERS} figuritas · ${data.repeated} repes · ${data.missing} faltantes. Encontrá matches en CambiaFiguritas.`;
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
