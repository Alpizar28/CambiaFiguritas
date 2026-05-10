export type StickerStatus = 'missing' | 'owned' | 'repeated' | 'special';

export type StickerRarity = 'normal' | 'special';

export type StickerKind = 'goalkeeper' | 'shield' | 'team_photo' | 'player' | 'special';

export type Country = {
  id: string;
  name: string;
  group: string;
  code: string;
  flag?: string;
};

export type Sticker = {
  id: string;
  displayCode: string;
  slotNumber?: number;
  countryId?: string;
  countryName?: string;
  countryFlag?: string;
  group?: string;
  kind: StickerKind;
  playerNumber?: number;
  label: string;
  rarity: StickerRarity;
};

export type AlbumPage = {
  page: number;
  title: string;
  subtitle: string;
  stickers: Sticker[];
};

export type StickerStatusMap = Record<string, StickerStatus>;

export type AlbumSlot =
  | {
      type: 'country_info';
      colSpan: 2;
    }
  | {
      type: 'group_info';
    }
  | {
      type: 'sticker';
      stickerId: string;
      colSpan?: 1 | 2;
    };

export type CountryAlbumPage = {
  pageInCountry: 1 | 2;
  slots: AlbumSlot[];
};

export type CountryStickerGroup = {
  country: Country;
  stickers: Sticker[];
  pages: CountryAlbumPage[];
};
