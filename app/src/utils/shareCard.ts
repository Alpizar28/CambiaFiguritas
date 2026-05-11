import { Platform } from 'react-native';
import QRCode from 'qrcode';
import { LOGO_B64 } from './logoB64';

export type ShareCardConfig = {
  uid: string;
  userName: string;
  photoUrl?: string;
  city?: string;
  owned: number;
  total: number;
  repeated: number;
  missing: number;
  repeatedIds?: string[];
  repeatedTotal?: number;
  missingIds?: string[];
  missingTotal?: number;
  showName: boolean;
  showProgress: boolean;
  showRepeated: boolean;
  showMissing: boolean;
};

export type ShareCardResult = 'shared' | 'downloaded' | 'unsupported' | 'cancelled' | 'error';

const W = 1080;
const H = 1920;

const C = {
  bg0: '#06060F',
  bg1: '#0F0F22',
  bg2: '#060614',
  surface: '#12122A',
  surfaceHi: '#1C1C3A',
  gold: '#FFD700',
  goldLight: '#FFE566',
  goldDark: '#B8960C',
  green: '#22C55E',
  greenDark: '#15803D',
  orange: '#F97316',
  blue: '#3B82F6',
  white: '#FFFFFF',
  muted: '#94A3B8',
  dim: '#475569',
  qrBg: '#FFFFFF',
};

function ensureRoundRect(): void {
  if (typeof CanvasRenderingContext2D === 'undefined') return;
  const proto = CanvasRenderingContext2D.prototype as unknown as Record<string, unknown>;
  if (proto['roundRect']) return;
  proto['roundRect'] = function (
    this: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
  ) {
    const rad = Math.min(r, w / 2, h / 2);
    this.moveTo(x + rad, y);
    this.arcTo(x + w, y, x + w, y + h, rad);
    this.arcTo(x + w, y + h, x, y + h, rad);
    this.arcTo(x, y + h, x, y, rad);
    this.arcTo(x, y, x + w, y, rad);
    this.closePath();
  };
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  const fn = (ctx as unknown as Record<string, (...a: number[]) => void>)['roundRect'];
  fn.call(ctx, x, y, w, h, r);
}

function drawBg(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createRadialGradient(W / 2, 400, 0, W / 2, 400, 1100);
  bg.addColorStop(0, '#0F0F2E');
  bg.addColorStop(0.5, '#080818');
  bg.addColorStop(1, '#06060F');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.018)';
  for (let i = 0; i < 120; i++) {
    const x = (i * 179 + 37) % W;
    const y = (i * 293 + 71) % H;
    ctx.beginPath();
    ctx.arc(x, y, 1 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
  }

  const topGlow = ctx.createRadialGradient(W / 2, -60, 0, W / 2, -60, 600);
  topGlow.addColorStop(0, 'rgba(255,215,0,0.18)');
  topGlow.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, W, 600);

  const botGlow = ctx.createRadialGradient(W / 2, H + 80, 0, W / 2, H + 80, 500);
  botGlow.addColorStop(0, 'rgba(34,197,94,0.12)');
  botGlow.addColorStop(1, 'rgba(34,197,94,0)');
  ctx.fillStyle = botGlow;
  ctx.fillRect(0, H - 500, W, 500);
}

async function drawHeader(ctx: CanvasRenderingContext2D): Promise<void> {
  const logoSize = 120;
  const logoX = 72;
  const logoY = 48;

  let logoDrawn = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const img = new (window as unknown as { Image: new () => HTMLImageElement }).Image();
      img.onload = () => {
        ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
        logoDrawn = true;
        resolve();
      };
      img.onerror = reject;
      img.src = LOGO_B64;
    });
  } catch {
    logoDrawn = false;
  }

  if (logoDrawn) {
    ctx.textAlign = 'left';
    const tx = logoX + logoSize + 24;
    ctx.font = '900 52px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = C.gold;
    ctx.fillText('CAMBIA', tx, logoY + 70);
    const w1 = ctx.measureText('CAMBIA').width;
    ctx.fillStyle = C.white;
    ctx.fillText('FIGURITAS', tx + w1 + 6, logoY + 70);
    ctx.font = '500 28px system-ui, sans-serif';
    ctx.fillStyle = C.muted;
    ctx.fillText('⚽  Mundial 2026', tx, logoY + 112);
  } else {
    ctx.textAlign = 'left';
    ctx.font = '900 58px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = C.gold;
    ctx.fillText('CAMBIA', 72, 138);
    const w1 = ctx.measureText('CAMBIA').width;
    ctx.fillStyle = C.white;
    ctx.fillText('FIGURITAS', 72 + w1 + 8, 138);
    ctx.font = '500 30px system-ui, sans-serif';
    ctx.fillStyle = C.muted;
    ctx.fillText('⚽  Mundial 2026', 72, 184);
  }
}

function hline(ctx: CanvasRenderingContext2D, y: number, alpha = 0.2) {
  const grad = ctx.createLinearGradient(60, y, W - 60, y);
  grad.addColorStop(0, `rgba(255,215,0,0)`);
  grad.addColorStop(0.3, `rgba(255,215,0,${alpha})`);
  grad.addColorStop(0.7, `rgba(255,215,0,${alpha})`);
  grad.addColorStop(1, `rgba(255,215,0,0)`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, y);
  ctx.lineTo(W - 60, y);
  ctx.stroke();
}

async function drawHeroCard(
  ctx: CanvasRenderingContext2D,
  name: string,
  city: string,
  photoUrl: string | undefined,
  showName: boolean,
) {
  const cardX = 56, cardY = 220, cardW = W - 112, cardH = 260;

  const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  cardGrad.addColorStop(0, '#1A1A38');
  cardGrad.addColorStop(1, '#101024');
  ctx.fillStyle = cardGrad;
  rr(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,215,0,0.3)';
  ctx.lineWidth = 1.5;
  rr(ctx, cardX, cardY, cardW, cardH, 28);
  ctx.stroke();

  const avR = 108;
  const avCX = cardX + 40 + avR;
  const avCY = cardY + cardH / 2;

  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(avCX, avCY, avR + 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,215,0,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(avCX, avCY, avR + 16, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(avCX, avCY, avR, 0, Math.PI * 2);
  ctx.clip();

  let avatarDrawn = false;
  if (photoUrl) {
    // Blob URLs (file picker) don't need crossOrigin. Remote URLs may need it.
    const isBlob = photoUrl.startsWith('blob:') || photoUrl.startsWith('data:');
    const tryLoad = (useCors: boolean) =>
      new Promise<void>((resolve, reject) => {
        const img = new (window as unknown as { Image: new () => HTMLImageElement }).Image();
        if (useCors) img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            ctx.drawImage(img, avCX - avR, avCY - avR, avR * 2, avR * 2);
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = reject;
        img.src = photoUrl;
      });

    try {
      // For blob/data URLs: no CORS needed. For remote: try without first (some servers allow it).
      await tryLoad(false);
      avatarDrawn = true;
    } catch {
      if (!isBlob) {
        try {
          await tryLoad(true);
          avatarDrawn = true;
        } catch { /* fallback to initial */ }
      }
    }
  }

  if (!avatarDrawn) {
    const avGrad = ctx.createRadialGradient(avCX - 20, avCY - 20, 0, avCX, avCY, avR);
    avGrad.addColorStop(0, '#2A2A55');
    avGrad.addColorStop(1, '#111128');
    ctx.fillStyle = avGrad;
    ctx.fillRect(avCX - avR, avCY - avR, avR * 2, avR * 2);

    const initial = showName ? (name?.[0] ?? '?').toUpperCase() : '?';
    ctx.fillStyle = C.gold;
    ctx.font = `900 ${Math.round(avR)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, avCX, avCY);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  const textX = avCX + avR + 36;
  const textMaxW = cardX + cardW - textX - 24;
  const displayName = showName ? (name || 'Coleccionista') : 'Coleccionista anónimo';
  const displayCity = showName ? (city || '') : '';

  ctx.textAlign = 'left';
  ctx.fillStyle = C.white;
  ctx.font = '800 54px system-ui, sans-serif';
  let nameText = displayName;
  while (ctx.measureText(nameText).width > textMaxW && nameText.length > 2) {
    nameText = nameText.slice(0, -1);
  }
  if (nameText !== displayName) nameText += '…';
  ctx.fillText(nameText, textX, cardY + 108);

  if (displayCity) {
    ctx.fillStyle = C.muted;
    ctx.font = '500 32px system-ui, sans-serif';
    ctx.fillText(`📍 ${displayCity}`, textX, cardY + 156);
  }

  const badgeY = displayCity ? cardY + 194 : cardY + 156;
  const badgeTxt = '🏆  Coleccionista del Mundial 2026';
  ctx.font = '600 24px system-ui, sans-serif';
  const badgeW = ctx.measureText(badgeTxt).width + 28;
  ctx.fillStyle = 'rgba(255,215,0,0.12)';
  rr(ctx, textX, badgeY - 30, badgeW, 42, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,0,0.3)';
  ctx.lineWidth = 1;
  rr(ctx, textX, badgeY - 30, badgeW, 42, 10);
  ctx.stroke();
  ctx.fillStyle = C.gold;
  ctx.fillText(badgeTxt, textX + 14, badgeY - 2);
}

function drawProgress(
  ctx: CanvasRenderingContext2D,
  owned: number,
  total: number,
  startY: number,
): number {
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  const px = 60, pw = W - 120;

  const labelTxt = '  PROGRESO DEL ÁLBUM  ';
  ctx.font = '700 26px system-ui, sans-serif';
  const labelW = ctx.measureText(labelTxt).width;
  ctx.fillStyle = 'rgba(255,215,0,0.1)';
  rr(ctx, px, startY + 8, labelW, 44, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,0,0.2)';
  ctx.lineWidth = 1;
  rr(ctx, px, startY + 8, labelW, 44, 10);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = C.gold;
  ctx.fillText(labelTxt, px, startY + 38);

  const bigY = startY + 170;
  ctx.textAlign = 'center';
  ctx.font = '900 160px system-ui, sans-serif';
  ctx.fillStyle = C.gold;
  ctx.fillText(`${pct}%`, W / 2, bigY);

  ctx.fillStyle = C.muted;
  ctx.font = '600 34px system-ui, sans-serif';
  ctx.fillText(`${owned} de ${total} figuritas`, W / 2, bigY + 60);

  const barY = bigY + 100;
  const barH = 32;

  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  rr(ctx, px, barY, pw, barH, 16);
  ctx.fill();

  const fillW = Math.max(56, (pw * pct) / 100);
  const barGrad = ctx.createLinearGradient(px, 0, px + pw, 0);
  barGrad.addColorStop(0, C.green);
  barGrad.addColorStop(0.5, C.gold);
  barGrad.addColorStop(1, C.orange);
  ctx.fillStyle = barGrad;
  rr(ctx, px, barY, fillW, barH, 16);
  ctx.fill();

  const tipGlow = ctx.createRadialGradient(px + fillW, barY + barH / 2, 0, px + fillW, barY + barH / 2, 40);
  tipGlow.addColorStop(0, 'rgba(255,215,0,0.5)');
  tipGlow.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.fillStyle = tipGlow;
  ctx.fillRect(px + fillW - 40, barY - 20, 80, barH + 40);

  return barY + barH + 40;
}

function drawStatCards(
  ctx: CanvasRenderingContext2D,
  owned: number,
  repeated: number,
  missing: number,
  showProgress: boolean,
  showRepeated: boolean,
  showMissing: boolean,
  startY: number,
): number {
  const items: { label: string; value: number; color: string; accent: string; show: boolean }[] = [
    { label: 'TENGO', value: owned, color: C.green, accent: '#052e16', show: showProgress },
    { label: 'REPES', value: repeated, color: C.orange, accent: '#431407', show: showRepeated },
    { label: 'FALTAN', value: missing, color: C.muted, accent: '#0f172a', show: showMissing },
  ];

  const visible = items.filter((i) => i.show);
  if (!visible.length) return startY;

  const gap = 20;
  const cardW = Math.floor((W - 120 - gap * (visible.length - 1)) / visible.length);
  const cardH = 220;
  const cardY = startY + 20;

  visible.forEach((item, i) => {
    const cx = 60 + i * (cardW + gap);

    const cg = ctx.createLinearGradient(cx, cardY, cx, cardY + cardH);
    cg.addColorStop(0, item.accent);
    cg.addColorStop(1, C.surface);
    ctx.fillStyle = cg;
    rr(ctx, cx, cardY, cardW, cardH, 22);
    ctx.fill();

    ctx.fillStyle = item.color;
    rr(ctx, cx, cardY, cardW, 6, 4);
    ctx.fill();

    ctx.strokeStyle = `${item.color}40`;
    ctx.lineWidth = 1.5;
    rr(ctx, cx, cardY, cardW, cardH, 22);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = item.color;
    ctx.font = '900 100px system-ui, sans-serif';
    ctx.fillText(String(item.value), cx + cardW / 2, cardY + 140);

    ctx.fillStyle = C.muted;
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.fillText(item.label, cx + cardW / 2, cardY + 190);
  });

  return cardY + cardH + 20;
}

function drawStickerList(
  ctx: CanvasRenderingContext2D,
  label: string,
  color: string,
  ids: string[],
  y: number,
  totalCount?: number,
  maxRows = 1,
): number {
  if (!ids.length) return y;
  const px = 60, maxW = W - 120;
  const chipH = 52, chipGap = 10, rowGap = 8;

  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText(label, px, y + 34);

  ctx.font = '600 26px system-ui, sans-serif';

  const realTotal = totalCount ?? ids.length;
  let drawn = 0;
  let curY = y + 50;

  for (let row = 0; row < maxRows; row++) {
    const isLastRow = row === maxRows - 1;
    let chipX = px;
    let rowDrawn = 0;

    for (let i = drawn; i < ids.length; i++) {
      const id = ids[i];
      const tw = ctx.measureText(id).width;
      const cw = tw + 28;
      const remaining = realTotal - drawn - rowDrawn;
      const isLastSlot = isLastRow && remaining > 1;
      const badgeTxt = `+${remaining - 1}`;
      const badgeW = ctx.measureText(badgeTxt).width + 24;
      const spaceNeeded = isLastSlot ? cw + chipGap + badgeW : cw;
      if (chipX + spaceNeeded > px + maxW) break;

      ctx.fillStyle = `${color}22`;
      rr(ctx, chipX, curY, cw, chipH, 12);
      ctx.fill();
      ctx.strokeStyle = `${color}55`;
      ctx.lineWidth = 1;
      rr(ctx, chipX, curY, cw, chipH, 12);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(id, chipX + cw / 2, curY + 34);
      ctx.textAlign = 'left';

      chipX += cw + chipGap;
      rowDrawn++;
    }

    drawn += rowDrawn;

    // +N badge on last row if items remain
    if (isLastRow && drawn < realTotal) {
      const more = `+${realTotal - drawn}`;
      const mw = ctx.measureText(more).width + 24;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      rr(ctx, chipX, curY, mw, chipH, 12);
      ctx.fill();
      ctx.fillStyle = C.dim;
      ctx.textAlign = 'center';
      ctx.font = '600 24px system-ui, sans-serif';
      ctx.fillText(more, chipX + mw / 2, curY + 34);
      ctx.textAlign = 'left';
      ctx.font = '600 26px system-ui, sans-serif';
    }

    curY += chipH + rowGap;
    if (drawn >= ids.length && drawn >= realTotal) break;
  }

  return curY + 8;
}

async function drawFooter(ctx: CanvasRenderingContext2D, uid: string): Promise<void> {
  const footerH = 280;
  const footerY = H - footerH - 80;

  const fg = ctx.createLinearGradient(60, footerY, W - 60, footerY + footerH);
  fg.addColorStop(0, '#151530');
  fg.addColorStop(1, '#0D0D22');
  ctx.fillStyle = fg;
  rr(ctx, 56, footerY, W - 112, footerH, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,0,0.3)';
  ctx.lineWidth = 2;
  rr(ctx, 56, footerY, W - 112, footerH, 28);
  ctx.stroke();

  const qrSize = 200;
  const qrX = W - 88 - qrSize;
  const qrY = footerY + (footerH - qrSize) / 2;
  const profileUrl = `https://cambiafiguritas.online/u/${uid}`;

  ctx.fillStyle = C.qrBg;
  rr(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 18);
  ctx.fill();
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 4;
  rr(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 18);
  ctx.stroke();

  try {
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, profileUrl, {
      width: qrSize,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    });
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
  } catch {
    ctx.fillStyle = '#ddd';
    ctx.fillRect(qrX, qrY, qrSize, qrSize);
    ctx.fillStyle = '#333';
    ctx.font = '600 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QR', qrX + qrSize / 2, qrY + qrSize / 2 + 10);
  }

  const bx = 88, by = footerY + 24;
  const logoSz = 72;

  try {
    await new Promise<void>((resolve, reject) => {
      const li = new (window as unknown as { Image: new () => HTMLImageElement }).Image();
      li.onload = () => { ctx.drawImage(li, bx, by + 4, logoSz, logoSz); resolve(); };
      li.onerror = reject;
      li.src = LOGO_B64;
    });
  } catch { /* skip logo */ }

  ctx.textAlign = 'left';
  ctx.fillStyle = C.gold;
  ctx.font = '900 40px system-ui, sans-serif';
  ctx.fillText('CambiaFiguritas', bx + logoSz + 16, by + 52);

  ctx.fillStyle = C.muted;
  ctx.font = '500 28px system-ui, sans-serif';
  ctx.fillText('cambiafiguritas.online', bx, by + 104);

  ctx.fillStyle = C.white;
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.fillText('Escaneá para intercambiar →', bx, by + 148);
}

async function drawCard(ctx: CanvasRenderingContext2D, config: ShareCardConfig): Promise<void> {
  drawBg(ctx);
  await drawHeader(ctx);

  await drawHeroCard(ctx, config.userName, config.city ?? '', config.photoUrl, config.showName);

  hline(ctx, 510, 0.25);

  let y = 530;

  if (config.showProgress) {
    y = drawProgress(ctx, config.owned, config.total, y);
    hline(ctx, y, 0.2);
    y += 20;
  }

  y = drawStatCards(
    ctx,
    config.owned,
    config.repeated,
    config.missing,
    config.showProgress,
    config.showRepeated,
    config.showMissing,
    y,
  );

  if (config.showRepeated && config.repeatedIds?.length) {
    hline(ctx, y, 0.15);
    y += 20;
y = drawStickerList(ctx, 'REPETIDAS', C.orange, config.repeatedIds, y, config.repeatedTotal);
  }

  if (config.showMissing && config.missingIds?.length) {
    hline(ctx, y, 0.12);
    y += 16;
    y = drawStickerList(ctx, 'FALTANTES', C.muted, config.missingIds, y, config.missingTotal);
  }

  await drawFooter(ctx, config.uid);
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 0.95));
}

export async function generateShareCard(config: ShareCardConfig): Promise<ShareCardResult> {
  if (Platform.OS !== 'web') return 'unsupported';
  if (typeof document === 'undefined') return 'unsupported';

  ensureRoundRect();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'error';

  try {
    await drawCard(ctx, config);
  } catch {
    return 'error';
  }

  const blob = await canvasToBlob(canvas);
  if (!blob) return 'error';

  const fileName = 'cambiafiguritas-figurita.png';
  const navAny = navigator as unknown as Record<string, unknown>;

  if (typeof navAny['canShare'] === 'function' && typeof navAny['share'] === 'function') {
    try {
      const file = new File([blob], fileName, { type: 'image/png' });
      if ((navAny['canShare'] as (d: unknown) => boolean)({ files: [file] })) {
        await (navAny['share'] as (d: unknown) => Promise<void>)({
          files: [file],
          title: 'Mi álbum del Mundial 2026',
          text: `¡Mirá mi progreso! cambiafiguritas.online/u/${config.uid}`,
        });
        return 'shared';
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  } catch {
    return 'error';
  }
}

export async function renderShareCardToCanvas(
  canvas: HTMLCanvasElement,
  config: ShareCardConfig,
): Promise<void> {
  ensureRoundRect();
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  await drawCard(ctx, config);
}

export async function shareCardToBlob(config: ShareCardConfig): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  ensureRoundRect();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  await drawCard(ctx, config);
  return canvasToBlob(canvas);
}

// ─── VS Card ─────────────────────────────────────────────────────────────────

export type VsCardConfig = {
  myUid: string;
  myName: string;
  myPhotoUrl?: string;
  myCity?: string;
  myPremium?: boolean;
  theirName: string;
  theirPhotoUrl?: string;
  theirCity?: string;
  theirPremium?: boolean;
  iGiveIds: string[];
  iGiveTotal: number;
  iReceiveIds: string[];
  iReceiveTotal: number;
  isPerfectTrade: boolean;
};

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new (window as unknown as { Image: new () => HTMLImageElement }).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function drawVsAvatar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  photoUrl: string | undefined,
  name: string,
): Promise<void> {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  let drawn = false;
  if (photoUrl) {
    const img = await loadImage(photoUrl);
    if (img) {
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      drawn = true;
    }
  }
  if (!drawn) {
    const g = ctx.createRadialGradient(cx - 10, cy - 10, 0, cx, cy, r);
    g.addColorStop(0, '#2A2A55');
    g.addColorStop(1, '#111128');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = C.gold;
    ctx.font = `900 ${Math.round(r * 0.75)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((name?.[0] ?? '?').toUpperCase(), cx, cy);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCrownCanvas(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  // Estética del CrownIcon: 3 picos + base + 3 puntos. Color dorado.
  const s = size / 24;
  const x = cx - size / 2;
  const y = cy - size / 2;
  ctx.save();
  ctx.fillStyle = '#FFD700';
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 1.2 * s;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 3 * s, y + 8 * s);
  ctx.lineTo(x + 7 * s, y + 12 * s);
  ctx.lineTo(x + 12 * s, y + 5 * s);
  ctx.lineTo(x + 17 * s, y + 12 * s);
  ctx.lineTo(x + 21 * s, y + 8 * s);
  ctx.lineTo(x + 19 * s, y + 19 * s);
  ctx.lineTo(x + 5 * s, y + 19 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const dot = (dx: number, dy: number) => {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, 1.4 * s, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(3, 8);
  dot(21, 8);
  dot(12, 5);
  ctx.restore();
}

async function drawVsCard(ctx: CanvasRenderingContext2D, config: VsCardConfig): Promise<void> {
  const { myUid, myName, myCity, myPhotoUrl, myPremium, theirName, theirCity, theirPhotoUrl,
    theirPremium, iGiveIds, iGiveTotal, iReceiveIds, iReceiveTotal, isPerfectTrade } = config;

  // Background
  drawBg(ctx);
  await drawHeader(ctx);

  // Hero zone — two halves with tint
  const heroY = 220;
  const heroH = 420;
  const halfW = W / 2;

  const leftTint = ctx.createLinearGradient(0, heroY, halfW, heroY + heroH);
  leftTint.addColorStop(0, 'rgba(34,197,94,0.12)');
  leftTint.addColorStop(1, 'rgba(34,197,94,0.04)');
  ctx.fillStyle = leftTint;
  ctx.fillRect(0, heroY, halfW, heroH);

  const rightTint = ctx.createLinearGradient(halfW, heroY, W, heroY + heroH);
  rightTint.addColorStop(0, 'rgba(249,115,22,0.04)');
  rightTint.addColorStop(1, 'rgba(249,115,22,0.12)');
  ctx.fillStyle = rightTint;
  ctx.fillRect(halfW, heroY, halfW, heroH);

  // Vertical divider
  const divGrad = ctx.createLinearGradient(W / 2, heroY, W / 2, heroY + heroH);
  divGrad.addColorStop(0, 'rgba(255,215,0,0)');
  divGrad.addColorStop(0.3, 'rgba(255,215,0,0.4)');
  divGrad.addColorStop(0.7, 'rgba(255,215,0,0.4)');
  divGrad.addColorStop(1, 'rgba(255,215,0,0)');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, heroY + 20);
  ctx.lineTo(W / 2, heroY + heroH - 20);
  ctx.stroke();

  // Avatars
  const avR = 100;
  const avY = heroY + 130;
  await drawVsAvatar(ctx, halfW / 2, avY, avR, myPhotoUrl, myName);
  await drawVsAvatar(ctx, halfW + halfW / 2, avY, avR, theirPhotoUrl, theirName);

  // Names
  ctx.textAlign = 'center';
  ctx.font = '800 42px system-ui, sans-serif';

  const nameY = avY + avR + 60;
  const crownSize = 44;
  const crownGap = 12;
  const maxNameW = halfW - 80 - (crownSize + crownGap);

  let myNameTxt = myName || 'Yo';
  while (ctx.measureText(myNameTxt).width > maxNameW && myNameTxt.length > 2) myNameTxt = myNameTxt.slice(0, -1);
  if (myNameTxt !== (myName || 'Yo')) myNameTxt += '…';
  ctx.fillStyle = myPremium ? '#FFD700' : C.white;
  ctx.fillText(myNameTxt, halfW / 2, nameY);
  if (myPremium) {
    const myNameW = ctx.measureText(myNameTxt).width;
    drawCrownCanvas(ctx, halfW / 2 - myNameW / 2 - crownSize / 2 - crownGap, nameY - 18, crownSize);
  }

  let theirNameTxt = theirName || 'Match';
  while (ctx.measureText(theirNameTxt).width > maxNameW && theirNameTxt.length > 2) theirNameTxt = theirNameTxt.slice(0, -1);
  if (theirNameTxt !== (theirName || 'Match')) theirNameTxt += '…';
  ctx.fillStyle = theirPremium ? '#FFD700' : C.white;
  ctx.fillText(theirNameTxt, halfW + halfW / 2, nameY);
  if (theirPremium) {
    const theirNameW = ctx.measureText(theirNameTxt).width;
    drawCrownCanvas(ctx, halfW + halfW / 2 - theirNameW / 2 - crownSize / 2 - crownGap, nameY - 18, crownSize);
  }

  // Cities
  ctx.font = '500 30px system-ui, sans-serif';
  ctx.fillStyle = C.muted;
  if (myCity) ctx.fillText(myCity, halfW / 2, avY + avR + 106);
  if (theirCity) ctx.fillText(theirCity, halfW + halfW / 2, avY + avR + 106);

  // VS text
  const vsY = avY + 20;
  ctx.font = '900 110px system-ui, sans-serif';
  ctx.fillStyle = C.gold;
  ctx.shadowColor = C.gold;
  ctx.shadowBlur = 32;
  ctx.fillText('VS', W / 2, vsY + 60);
  ctx.shadowBlur = 0;

  // Stat bar — exchange summary
  const barY = heroY + heroH + 30;
  const barH2 = 180;

  // Background card
  ctx.fillStyle = C.surfaceHi;
  rr(ctx, 60, barY, W - 120, barH2, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,0,0.2)';
  ctx.lineWidth = 1.5;
  rr(ctx, 60, barY, W - 120, barH2, 20);
  ctx.stroke();

  // Left tint — green (yo doy)
  ctx.save();
  rr(ctx, 60, barY, (W - 120) / 2, barH2, 20);
  ctx.clip();
  ctx.fillStyle = 'rgba(34,197,94,0.08)';
  ctx.fillRect(60, barY, (W - 120) / 2, barH2);
  ctx.restore();

  // Right tint — orange (yo recibo)
  ctx.save();
  rr(ctx, W / 2, barY, (W - 120) / 2, barH2, 20);
  ctx.clip();
  ctx.fillStyle = 'rgba(249,115,22,0.08)';
  ctx.fillRect(W / 2, barY, (W - 120) / 2, barH2);
  ctx.restore();

  // Center divider + arrow
  ctx.strokeStyle = 'rgba(255,215,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W / 2, barY + 16);
  ctx.lineTo(W / 2, barY + barH2 - 16);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillStyle = C.gold;
  ctx.fillText('⇄', W / 2, barY + barH2 / 2 + 14);

  // LEFT — YO DOY
  const leftCX = 60 + (W - 120) / 4;

  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillStyle = C.green;
  ctx.fillText('YO DOY', leftCX, barY + 44);

  ctx.font = '900 76px system-ui, sans-serif';
  ctx.fillStyle = C.white;
  ctx.fillText(String(iGiveTotal), leftCX, barY + 130);

  ctx.font = '500 24px system-ui, sans-serif';
  ctx.fillStyle = C.muted;
  ctx.fillText('figuritas para él/ella', leftCX, barY + 164);

  // RIGHT — YO RECIBO
  const rightCX = W / 2 + (W - 120) / 4;

  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillStyle = C.orange;
  ctx.fillText('YO RECIBO', rightCX, barY + 44);

  ctx.font = '900 76px system-ui, sans-serif';
  ctx.fillStyle = C.white;
  ctx.fillText(String(iReceiveTotal), rightCX, barY + 130);

  ctx.font = '500 24px system-ui, sans-serif';
  ctx.fillStyle = C.muted;
  ctx.fillText('figuritas de él/ella', rightCX, barY + 164);

  // Sticker chip lists
  let y = barY + barH2 + 40;
  hline(ctx, y - 10, 0.15);

  if (iGiveIds.length > 0) {
    y = drawStickerList(ctx, 'LO QUE DOY  →', C.green, iGiveIds, y, iGiveTotal, 3);
    y += 10;
  }

  hline(ctx, y, 0.12);
  y += 20;

  if (iReceiveIds.length > 0) {
    y = drawStickerList(ctx, '←  LO QUE RECIBO', C.orange, iReceiveIds, y, iReceiveTotal, 3);
  }

  // Footer with QR
  const footerH = 220;
  const footerY = H - footerH - 60;
  const fg = ctx.createLinearGradient(60, footerY, W - 60, footerY + footerH);
  fg.addColorStop(0, '#151530');
  fg.addColorStop(1, '#0D0D22');
  ctx.fillStyle = fg;
  rr(ctx, 56, footerY, W - 112, footerH, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,0,0.3)';
  ctx.lineWidth = 2;
  rr(ctx, 56, footerY, W - 112, footerH, 28);
  ctx.stroke();

  const qrSize = 160;
  const qrX = W - 88 - qrSize;
  const qrY = footerY + (footerH - qrSize) / 2;
  const profileUrl = `https://cambiafiguritas.online/u/${myUid}`;

  ctx.fillStyle = C.qrBg;
  rr(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 14);
  ctx.fill();
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  rr(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 14);
  ctx.stroke();

  try {
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, profileUrl, {
      width: qrSize, margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    });
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
  } catch { /* skip */ }

  const bx = 88, by = footerY + 20;
  try {
    await new Promise<void>((resolve, reject) => {
      const li = new (window as unknown as { Image: new () => HTMLImageElement }).Image();
      li.onload = () => { ctx.drawImage(li, bx, by, 56, 56); resolve(); };
      li.onerror = reject;
      li.src = LOGO_B64;
    });
  } catch { /* skip */ }

  ctx.textAlign = 'left';
  ctx.fillStyle = C.gold;
  ctx.font = '900 34px system-ui, sans-serif';
  ctx.fillText('CambiaFiguritas', bx + 68, by + 38);

  ctx.fillStyle = C.white;
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.fillText('Escaneá para intercambiar →', bx, by + 90);

  ctx.fillStyle = C.muted;
  ctx.font = '500 24px system-ui, sans-serif';
  ctx.fillText('cambiafiguritas.online', bx, by + 128);
}

export async function vsCardToBlob(config: VsCardConfig): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  ensureRoundRect();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  await drawVsCard(ctx, config);
  return canvasToBlob(canvas);
}

export async function renderVsCardToCanvas(
  canvas: HTMLCanvasElement,
  config: VsCardConfig,
): Promise<void> {
  ensureRoundRect();
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  await drawVsCard(ctx, config);
}
