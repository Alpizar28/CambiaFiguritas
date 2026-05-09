import { Platform } from 'react-native';

type GenerateInput = {
  userName: string;
  owned: number;
  total: number;
  repeated: number;
  missing: number;
};

type ShareImageResult = 'shared' | 'downloaded' | 'unsupported' | 'cancelled' | 'error';

const W = 1080;
const H = 1920;

function drawCard(ctx: CanvasRenderingContext2D, input: GenerateInput): void {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0A0A0A');
  bg.addColorStop(0.5, '#1A0F2E');
  bg.addColorStop(1, '#0A0A0A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255, 215, 0, 0.04)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 137) % W;
    const y = (i * 211) % H;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#FFD700';
  ctx.font = '700 56px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CAMBIAFIGURITAS', W / 2, 180);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '500 42px system-ui, sans-serif';
  ctx.fillText('Mundial 2026', W / 2, 250);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '600 56px system-ui, sans-serif';
  const greeting = input.userName ? `Mi álbum, ${input.userName.split(' ')[0]}` : 'Mi álbum';
  ctx.fillText(greeting, W / 2, 420);

  const pct = input.total > 0 ? Math.round((input.owned / input.total) * 100) : 0;
  ctx.fillStyle = '#22C55E';
  ctx.font = '900 320px system-ui, sans-serif';
  ctx.fillText(`${pct}%`, W / 2, 800);

  ctx.fillStyle = '#A0A0A0';
  ctx.font = '600 44px system-ui, sans-serif';
  ctx.fillText(`${input.owned} de ${input.total} figuritas`, W / 2, 880);

  const barX = 140;
  const barY = 980;
  const barW = W - 280;
  const barH = 40;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  (ctx as any).roundRect(barX, barY, barW, barH, 20);
  ctx.fill();
  const fillW = (barW * pct) / 100;
  const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
  grad.addColorStop(0, '#22C55E');
  grad.addColorStop(1, '#FFD700');
  ctx.fillStyle = grad;
  if (fillW > 0) {
    ctx.beginPath();
    (ctx as any).roundRect(barX, barY, fillW, barH, 20);
    ctx.fill();
  }

  const stats = [
    { label: 'Tengo', value: input.owned, color: '#22C55E' },
    { label: 'Repes', value: input.repeated, color: '#FFD700' },
    { label: 'Faltan', value: input.missing, color: '#A0A0A0' },
  ];
  const colW = W / 3;
  const statsY = 1240;
  stats.forEach((s, i) => {
    const cx = colW * i + colW / 2;
    ctx.fillStyle = s.color;
    ctx.font = '900 110px system-ui, sans-serif';
    ctx.fillText(String(s.value), cx, statsY);
    ctx.fillStyle = '#A0A0A0';
    ctx.font = '600 38px system-ui, sans-serif';
    ctx.fillText(s.label, cx, statsY + 70);
  });

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 50px system-ui, sans-serif';
  ctx.fillText('¿Te faltan? ¿Tenés repes?', W / 2, 1620);
  ctx.fillStyle = '#FFD700';
  ctx.font = '800 52px system-ui, sans-serif';
  ctx.fillText('cambiafiguritas.online', W / 2, 1700);

  ctx.fillStyle = '#666666';
  ctx.font = '500 28px system-ui, sans-serif';
  ctx.fillText('Encontrá matches e intercambiá', W / 2, 1800);
}

function ensureRoundRect(): void {
  if (typeof CanvasRenderingContext2D === 'undefined') return;
  const proto = CanvasRenderingContext2D.prototype as any;
  if (proto.roundRect) return;
  proto.roundRect = function (x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.min(r, w / 2, h / 2);
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    this.closePath();
  };
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png', 0.95));
}

export async function shareStatsImage(input: GenerateInput): Promise<ShareImageResult> {
  if (Platform.OS !== 'web') return 'unsupported';
  if (typeof document === 'undefined') return 'unsupported';

  ensureRoundRect();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'error';

  try {
    drawCard(ctx, input);
  } catch {
    return 'error';
  }

  const blob = await canvasToBlob(canvas);
  if (!blob) return 'error';

  const fileName = 'cambiafiguritas-progreso.png';
  const navAny = navigator as any;

  if (navAny?.canShare && navAny?.share) {
    try {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navAny.canShare({ files: [file] })) {
        await navAny.share({
          files: [file],
          title: 'Mi álbum del Mundial 2026',
          text: 'Mirá cómo voy con CambiaFiguritas',
        });
        return 'shared';
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelled';
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
