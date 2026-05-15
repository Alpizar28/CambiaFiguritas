import { allStickers, countryStickerGroups, specialStickerGroup, cocaColaStickerGroup } from '../../album/data/albumCatalog';
import { buildCountryCompare, type CountryCompare } from '../../matching/utils/countryComparison';
import type { ImportItem } from '../../album/utils/importParser';
import type { StickerStatusMap } from '../../album/types';

export type GiveCountryRow = {
  flag: string;
  code: string;
  codes: string[];
};

export type ListCompareResult = {
  iNeed: string[];
  needItems: ImportItem[];
  iCanGive: string[];
  iCanGiveByCountry: GiveCountryRow[];
  countryRows: CountryCompare[];
};

export function buildTheirStatusesFromImport(items: ImportItem[]): Record<string, string> {
  const map: Record<string, string> = {};
  const hasWantSection = items.some((i) => i.section === 'want');

  for (const item of items) {
    if (item.section === 'want') {
      map[item.stickerId] = 'missing';
    } else if (item.copies >= 2) {
      map[item.stickerId] = 'repeated';
    } else {
      map[item.stickerId] = 'owned';
    }
  }

  // Si hay sección "want", las figus ausentes de la lista no son buscadas —
  // marcamos como 'owned' para que iCanGive no se active con ellas.
  if (hasWantSection) {
    for (const sticker of allStickers) {
      if (!(sticker.id in map)) {
        map[sticker.id] = 'owned';
      }
    }
  }

  return map;
}

export function buildListCompareResult(
  items: ImportItem[],
  myStatuses: StickerStatusMap,
): ListCompareResult {
  const theirStatuses = buildTheirStatusesFromImport(items);

  const needItems: ImportItem[] = [];
  const iNeed: string[] = [];

  for (const sticker of allStickers) {
    const myStatus = myStatuses[sticker.id] ?? 'missing';
    const theirStatus = theirStatuses[sticker.id];
    if (myStatus === 'missing' && theirStatus === 'repeated') {
      const stickerId = sticker.id;
      iNeed.push(sticker.displayCode);
      needItems.push({ stickerId, copies: 1, section: 'have' });
    }
  }

  // Figuritas que ellos buscan (section='want') y yo tengo repetidas — agrupadas por país
  const iCanGive: string[] = [];
  const giveByCountry = new Map<string, GiveCountryRow>();

  const allGroups = [
    ...countryStickerGroups,
    { country: { ...specialStickerGroup.country, flag: '⚽' }, stickers: specialStickerGroup.stickers },
    { country: { ...cocaColaStickerGroup.country, flag: '🥤' }, stickers: cocaColaStickerGroup.stickers },
  ];

  for (const item of items) {
    if (item.section !== 'want') continue;
    const myStatus = myStatuses[item.stickerId] ?? 'missing';
    if (myStatus !== 'repeated') continue;
    const sticker = allStickers.find((s) => s.id === item.stickerId);
    if (!sticker) continue;
    iCanGive.push(sticker.displayCode);

    // Encontrar el grupo al que pertenece para agrupar por país
    const group = allGroups.find((g) => g.stickers.some((s) => s.id === sticker.id));
    if (group) {
      const code = group.country.code;
      if (!giveByCountry.has(code)) {
        const flag = (group.country as { flag?: string }).flag ?? '🏳️';
        giveByCountry.set(code, { flag, code, codes: [] });
      }
      giveByCountry.get(code)!.codes.push(sticker.displayCode);
    }
  }

  const iCanGiveByCountry = Array.from(giveByCountry.values());

  const countryRows = buildCountryCompare(myStatuses, theirStatuses).filter(
    (row) => row.relevance !== 'none',
  );

  return { iNeed, needItems, iCanGive, iCanGiveByCountry, countryRows };
}

export function buildRepeatedShareText(statuses: StickerStatusMap): string {
  const groups = [
    ...countryStickerGroups,
    { country: { ...specialStickerGroup.country, flag: '⚽' }, stickers: specialStickerGroup.stickers },
    { country: { ...cocaColaStickerGroup.country, flag: '🥤' }, stickers: cocaColaStickerGroup.stickers },
  ];

  const lines: string[] = [];
  for (const group of groups) {
    const repeated = group.stickers
      .filter((s) => statuses[s.id] === 'repeated')
      .map((s) => s.slotNumber);
    if (repeated.length === 0) continue;
    const flag = (group.country as { flag?: string }).flag ?? '🏳️';
    lines.push(`${flag} ${group.country.code}: ${repeated.join(', ')}`);
  }

  if (lines.length === 0) {
    return 'No tengo figuritas repetidas del Mundial 2026 todavía.\n\n¿Qué te sirve de mi lista? Descubrilo gratis en cambiafiguritas.online';
  }

  return `cambiafiguritas.online — Mis repetidas Mundial 2026\n\n${lines.join('\n')}\n\n¿Cuáles te sirven? Pegá tu lista y lo sabés gratis 👇\ncambiafiguritas.online`;
}

export function buildShareText(iNeed: string[], countryRows: CountryCompare[]): string {
  if (iNeed.length === 0) {
    return 'No me sirve ninguna de tu lista.\n\n¿Qué te sirve de la mía? Pegá tu lista en CambiaFiguritas y lo sabés en segundos 👇\ncambiafiguritas.online';
  }

  // Agrupar por país usando countryRows que ya tienen flag + código
  const lines: string[] = [];
  const coveredCodes = new Set<string>();
  for (const row of countryRows) {
    const codes = row.iNeedFromThem;
    if (codes.length === 0) continue;
    const flag = row.countryFlag ? `${row.countryFlag} ` : '';
    lines.push(`${flag}${row.code}: ${codes.join(', ')}`);
    codes.forEach((c) => coveredCodes.add(c));
  }

  // Figuritas sin país asignado (especiales/CC) que no están en countryRows
  const uncovered = iNeed.filter((c) => !coveredCodes.has(c));
  if (uncovered.length > 0) lines.push(`⚽ Especiales: ${uncovered.join(', ')}`);

  const body = lines.join('\n');
  return `cambiafiguritas.online — Me sirven de tu lista (${iNeed.length}):\n\n${body}\n\n¿Qué te sirve de la mía? Pegá tu lista y lo sabés gratis 👇\ncambiafiguritas.online`;
}
