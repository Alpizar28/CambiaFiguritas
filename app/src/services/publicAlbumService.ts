export type PublicAlbumStatus = 'missing' | 'owned' | 'repeated' | 'special';

export type PublicAlbumPayload = {
  user: {
    uid: string;
    name: string;
    city: string;
    photoUrl: string | null;
    anonymous?: boolean;
  };
  album: {
    statuses: Record<string, PublicAlbumStatus>;
    repeatedCounts: Record<string, number>;
    ownedCount: number;
    repeatedCount: number;
    missingCount: number;
    hideProgress?: boolean;
    hideRepeated?: boolean;
  };
};

const ENDPOINT_DEFAULT = 'https://cambiafiguritas.online/api/publicAlbum';
const ENDPOINT = process.env.EXPO_PUBLIC_PUBLIC_ALBUM_URL || ENDPOINT_DEFAULT;

export async function fetchPublicAlbum(uid: string): Promise<PublicAlbumPayload> {
  const url = `${ENDPOINT}?uid=${encodeURIComponent(uid)}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`publicAlbum HTTP ${res.status}: ${body || 'unknown'}`);
  }
  const json = (await res.json()) as PublicAlbumPayload;
  if (!json?.user?.uid || !json?.album?.statuses) {
    throw new Error('publicAlbum: payload inválido');
  }
  return json;
}
