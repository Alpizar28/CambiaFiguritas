import { countries } from './countries';
import type { AlbumPage, CountryAlbumPage, CountryStickerGroup, Sticker } from '../types';

const specialCodes = ['Fifa', '00'].concat(
  Array.from({ length: 19 }, (_, index) => `FW${index + 1}`),
);

const getStickerKind = (slotNumber: number): Sticker['kind'] => {
  if (slotNumber === 1) {
    return 'shield';
  }

  if (slotNumber === 2) {
    return 'goalkeeper';
  }

  if (slotNumber === 13) {
    return 'team_photo';
  }

  return 'player';
};

const getStickerLabel = (slotNumber: number) => {
  if (slotNumber === 1) {
    return 'Escudo';
  }

  if (slotNumber === 2) {
    return 'Portero';
  }

  if (slotNumber === 13) {
    return 'Foto grupal';
  }

  return '';
};

const getDisplayCode = (countryCode: string, slotNumber: number) => {
  if (countryCode === 'CZE' && slotNumber === 16) {
    return 'Che16';
  }

  return `${countryCode}${slotNumber}`;
};

const createCountryPages = (code: string): CountryAlbumPage[] => [
  {
    pageInCountry: 1,
    slots: [
      { type: 'country_info', colSpan: 2 },
      { type: 'sticker', stickerId: getDisplayCode(code, 1) },
      { type: 'sticker', stickerId: getDisplayCode(code, 2) },
      { type: 'sticker', stickerId: getDisplayCode(code, 3) },
      { type: 'sticker', stickerId: getDisplayCode(code, 4) },
      { type: 'sticker', stickerId: getDisplayCode(code, 5) },
      { type: 'sticker', stickerId: getDisplayCode(code, 6) },
      { type: 'sticker', stickerId: getDisplayCode(code, 7) },
      { type: 'sticker', stickerId: getDisplayCode(code, 8) },
      { type: 'sticker', stickerId: getDisplayCode(code, 9) },
      { type: 'sticker', stickerId: getDisplayCode(code, 10) },
    ],
  },
  {
    pageInCountry: 2,
    slots: [
      { type: 'sticker', stickerId: getDisplayCode(code, 11) },
      { type: 'sticker', stickerId: getDisplayCode(code, 12) },
      { type: 'sticker', stickerId: getDisplayCode(code, 13), colSpan: 2 },
      { type: 'sticker', stickerId: getDisplayCode(code, 14) },
      { type: 'sticker', stickerId: getDisplayCode(code, 15) },
      { type: 'sticker', stickerId: getDisplayCode(code, 16) },
      { type: 'sticker', stickerId: getDisplayCode(code, 17) },
      { type: 'group_info' },
      { type: 'sticker', stickerId: getDisplayCode(code, 18) },
      { type: 'sticker', stickerId: getDisplayCode(code, 19) },
      { type: 'sticker', stickerId: getDisplayCode(code, 20) },
    ],
  },
];

const countryStickers = countries.flatMap<Sticker>((country) =>
  Array.from({ length: 20 }, (_, index) => {
    const slotNumber = index + 1;
    const displayCode = getDisplayCode(country.code, slotNumber);

    return {
      id: displayCode,
      displayCode,
      slotNumber,
      countryId: country.id,
      countryName: country.name,
      group: country.group,
      kind: getStickerKind(slotNumber),
      playerNumber: slotNumber,
      label: getStickerLabel(slotNumber),
      rarity: slotNumber === 1 || slotNumber === 13 ? 'special' : 'normal',
    };
  }),
);

const specialStickers: Sticker[] = specialCodes.map((displayCode, index) => ({
  id: displayCode,
  displayCode,
  slotNumber: index,
  kind: 'special',
  label: displayCode === 'Fifa' ? 'FIFA' : `Especial ${displayCode}`,
  rarity: 'special',
}));

export const allStickers = specialStickers.concat(countryStickers);

export const countryStickerGroups: CountryStickerGroup[] = countries.map((country) => ({
  country,
  stickers: countryStickers.filter((sticker) => sticker.countryId === country.id),
  pages: createCountryPages(country.code),
}));

export const specialStickerGroup = {
  country: { id: 'especiales', name: 'Specials', group: 'Specials', code: 'FW' },
  stickers: specialStickers,
  pages: [] as CountryAlbumPage[],
};

export const albumPages: AlbumPage[] = [];

export const formatStickerNumber = (displayCode: string) => displayCode;
