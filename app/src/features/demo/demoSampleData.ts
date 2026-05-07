import { allStickers, countryStickerGroups } from '../album/data/albumCatalog';
import type { StickerStatus } from '../album/types';

// Datos de muestra para demo: poblar 3 países con datos para que se vea la app "viva".
// Argentina: completo. Brasil: 80% + algunos repes. Francia: 50%. Resto: vacío.

const SAMPLE_FULL = ['ARG', 'ESP'];
const SAMPLE_PARTIAL = ['BRA', 'FRA'];
const SAMPLE_REPES = ['BRA12', 'BRA5', 'FRA8', 'ARG12'];

export function buildDemoStatuses(): {
  statuses: Record<string, StickerStatus>;
  repeatedCounts: Record<string, number>;
} {
  const statuses: Record<string, StickerStatus> = {};
  const repeatedCounts: Record<string, number> = {};

  for (const sticker of allStickers) {
    statuses[sticker.id] = 'missing';
    repeatedCounts[sticker.id] = 0;
  }

  for (const code of SAMPLE_FULL) {
    const group = countryStickerGroups.find((g) => g.country.code === code);
    if (!group) continue;
    for (const sticker of group.stickers) {
      statuses[sticker.id] = 'owned';
    }
  }

  for (const code of SAMPLE_PARTIAL) {
    const group = countryStickerGroups.find((g) => g.country.code === code);
    if (!group) continue;
    const ratio = code === 'BRA' ? 0.8 : 0.5;
    const cutoff = Math.floor(group.stickers.length * ratio);
    group.stickers.slice(0, cutoff).forEach((sticker) => {
      statuses[sticker.id] = 'owned';
    });
  }

  for (const displayCode of SAMPLE_REPES) {
    const sticker = allStickers.find((s) => s.displayCode === displayCode);
    if (!sticker) continue;
    statuses[sticker.id] = 'repeated';
    repeatedCounts[sticker.id] = displayCode === 'BRA12' ? 3 : 1;
  }

  return { statuses, repeatedCounts };
}
