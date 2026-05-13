import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

const REGION = 'us-central1';
const PROJECT = 'cambiafiguritas';
const HTTP_BASE = `https://${REGION}-${PROJECT}.cloudfunctions.net`;

export type GuestSessionStatus =
  | 'waiting_guest'
  | 'guest_submitted'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type GuestMatchedExchange = {
  hostGives: string[];
  hostReceives: string[];
  computedAt: number;
};

export type GuestSessionView = {
  token: string;
  host: { name: string; photoUrl: string | null };
  hostStickers: string[];
  hostNeeds: string[];
  status: GuestSessionStatus;
  expiresAt: number;
  matchedExchange: GuestMatchedExchange | null;
};

export type CreateLinkResult = { ok: true; token: string; url: string };

export async function createGuestLink(input: {
  hostStickers?: string[];
  hostNeeds?: string[];
}): Promise<CreateLinkResult> {
  const callable = httpsCallable<typeof input, CreateLinkResult>(functions, 'createGuestLink');
  const res = await callable(input);
  return res.data;
}

export async function fetchGuestSession(token: string): Promise<GuestSessionView> {
  const url = `${HTTP_BASE}/getGuestSession?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`getGuestSession failed (${res.status}): ${body.error ?? 'unknown'}`);
  }
  return (await res.json()) as GuestSessionView;
}

export type SubmitGuestOfferInput = {
  token: string;
  rawText: string;
  repeated: string[];
  missing: string[];
  contact?: string;
};

export type SubmitGuestOfferResult = {
  ok: true;
  host: { name: string };
  matched: GuestMatchedExchange;
};

export async function submitGuestOffer(input: SubmitGuestOfferInput): Promise<SubmitGuestOfferResult> {
  const url = `${HTTP_BASE}/submitGuestOffer`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`submitGuestOffer failed (${res.status}): ${body.error ?? 'unknown'}`);
  }
  return (await res.json()) as SubmitGuestOfferResult;
}

export async function commitGuestTrade(token: string): Promise<{ ok: true; tradeId: string }> {
  const callable = httpsCallable<{ token: string }, { ok: true; tradeId: string }>(
    functions,
    'commitGuestTrade',
  );
  const res = await callable({ token });
  return res.data;
}

export async function cancelGuestSession(token: string, reason?: string): Promise<{ ok: true }> {
  const callable = httpsCallable<{ token: string; reason?: string }, { ok: true }>(
    functions,
    'cancelGuestSession',
  );
  const res = await callable({ token, reason });
  return res.data;
}
