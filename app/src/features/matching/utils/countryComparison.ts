import { allStickers } from '../../album/data/albumCatalog';
import { countries } from '../../album/data/countries';
import type { StickerStatus, StickerStatusMap } from '../../album/types';

export type CompareRelevance = 'two_way' | 'i_need_only' | 'they_need_only' | 'none';

export type StickerCompare = {
  id: string;
  displayCode: string;
  myStatus: StickerStatus;
  theirStatus: StickerStatus;
  iCanGet: boolean;
  iCanGive: boolean;
};

export type CountryCompare = {
  countryId: string;
  countryName: string;
  countryFlag?: string;
  group?: string;
  code: string;
  total: number;
  iNeedFromThem: string[];
  theyNeedFromMe: string[];
  myOwnedCount: number;
  theirOwnedCount: number;
  relevance: CompareRelevance;
  stickers: StickerCompare[];
};

const SPECIAL_GROUP_ID = 'specials';
const SPECIAL_NAME = 'Especiales';

const RELEVANCE_ORDER: Record<CompareRelevance, number> = {
  two_way: 0,
  i_need_only: 1,
  they_need_only: 2,
  none: 3,
};

function statusOf(map: Record<string, string>, id: string): StickerStatus {
  const s = map[id];
  if (s === 'owned' || s === 'repeated' || s === 'special') return s;
  return 'missing';
}

function isOwned(s: StickerStatus): boolean {
  return s === 'owned' || s === 'repeated' || s === 'special';
}

function computeRelevance(iNeed: number, theyNeed: number): CompareRelevance {
  if (iNeed > 0 && theyNeed > 0) return 'two_way';
  if (iNeed > 0) return 'i_need_only';
  if (theyNeed > 0) return 'they_need_only';
  return 'none';
}

export function buildCountryCompare(
  myStatuses: StickerStatusMap,
  theirStatuses: Record<string, string>,
): CountryCompare[] {
  const groups = new Map<string, CountryCompare>();

  for (const country of countries) {
    groups.set(country.id, {
      countryId: country.id,
      countryName: country.name,
      countryFlag: country.flag,
      group: country.group,
      code: country.code,
      total: 0,
      iNeedFromThem: [],
      theyNeedFromMe: [],
      myOwnedCount: 0,
      theirOwnedCount: 0,
      relevance: 'none',
      stickers: [],
    });
  }

  groups.set(SPECIAL_GROUP_ID, {
    countryId: SPECIAL_GROUP_ID,
    countryName: SPECIAL_NAME,
    code: 'FW',
    total: 0,
    iNeedFromThem: [],
    theyNeedFromMe: [],
    myOwnedCount: 0,
    theirOwnedCount: 0,
    relevance: 'none',
    stickers: [],
  });

  for (const sticker of allStickers) {
    const groupId = sticker.kind === 'special' ? SPECIAL_GROUP_ID : sticker.countryId;
    if (!groupId) continue;
    const bucket = groups.get(groupId);
    if (!bucket) continue;

    const myStatus = statusOf(myStatuses, sticker.id);
    const theirStatus = statusOf(theirStatuses, sticker.id);

    const iCanGet = theirStatus === 'repeated' && myStatus === 'missing';
    const iCanGive = myStatus === 'repeated' && theirStatus === 'missing';

    bucket.total += 1;
    if (isOwned(myStatus)) bucket.myOwnedCount += 1;
    if (isOwned(theirStatus)) bucket.theirOwnedCount += 1;
    if (iCanGet) bucket.iNeedFromThem.push(sticker.displayCode);
    if (iCanGive) bucket.theyNeedFromMe.push(sticker.displayCode);

    bucket.stickers.push({
      id: sticker.id,
      displayCode: sticker.displayCode,
      myStatus,
      theirStatus,
      iCanGet,
      iCanGive,
    });
  }

  const list = Array.from(groups.values()).filter((g) => g.total > 0);
  list.forEach((g) => {
    g.relevance = computeRelevance(g.iNeedFromThem.length, g.theyNeedFromMe.length);
  });

  list.sort((a, b) => {
    const r = RELEVANCE_ORDER[a.relevance] - RELEVANCE_ORDER[b.relevance];
    if (r !== 0) return r;
    if (a.countryId === SPECIAL_GROUP_ID) return 1;
    if (b.countryId === SPECIAL_GROUP_ID) return -1;
    const totalA = a.iNeedFromThem.length + a.theyNeedFromMe.length;
    const totalB = b.iNeedFromThem.length + b.theyNeedFromMe.length;
    if (totalB !== totalA) return totalB - totalA;
    return a.countryName.localeCompare(b.countryName);
  });

  return list;
}

export function summarizeCompare(rows: CountryCompare[]) {
  let iNeedFromThem = 0;
  let theyNeedFromMe = 0;
  let total = 0;
  for (const row of rows) {
    iNeedFromThem += row.iNeedFromThem.length;
    theyNeedFromMe += row.theyNeedFromMe.length;
    total += row.total;
  }
  return { iNeedFromThem, theyNeedFromMe, total };
}
