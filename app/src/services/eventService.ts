import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
  where,
  type Query,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { haversineKm } from '../utils/distance';
import type { AppEvent, EventType } from '../features/events/types';

export type EventFilter =
  | { mode: 'gps'; lat: number; lng: number; radiusKm: number; userCitySlug?: string }
  | { mode: 'citySlug'; citySlug: string }
  | { mode: 'none' };

export type CreateEventParams = {
  title: string;
  type: EventType;
  description: string;
  lat: number;
  lng: number;
  date: string;
  createdBy: string;
  creatorName: string;
  cityName: string;
  citySlug: string;
};

const MAX_FETCH_LIMIT = 100;
const FALLBACK_FETCH_LIMIT = 200;

// Bucketea coordenadas a múltiplos de 0.05° (~5 km) por privacidad. Se aplica
// también a eventos para no revelar la ubicación exacta del organizador.
const COORD_BUCKET = 0.05;
function bucketCoord(n: number): number {
  return Math.round(n / COORD_BUCKET) * COORD_BUCKET;
}

function mapDocs(snapDocs: { id: string; data: () => DocumentData }[]): AppEvent[] {
  return snapDocs.map((d) => ({ id: d.id, ...(d.data() as Omit<AppEvent, 'id'>) }));
}

function withDistance(events: AppEvent[], lat: number, lng: number): AppEvent[] {
  return events.map((e) => ({
    ...e,
    distanceKm:
      e.lat != null && e.lng != null ? haversineKm(lat, lng, e.lat, e.lng) : undefined,
  }));
}

async function fetchByCitySlug(slug: string): Promise<AppEvent[]> {
  const q: Query = query(
    collection(db, 'events'),
    where('citySlug', '==', slug),
    orderBy('date', 'asc'),
    limit(MAX_FETCH_LIMIT),
  );
  const snap = await getDocs(q);
  return mapDocs(snap.docs);
}

async function fetchAllRecent(maxLimit = MAX_FETCH_LIMIT): Promise<AppEvent[]> {
  const q: Query = query(collection(db, 'events'), orderBy('date', 'asc'), limit(maxLimit));
  const snap = await getDocs(q);
  return mapDocs(snap.docs);
}

export async function fetchEvents(filter: EventFilter): Promise<AppEvent[]> {
  if (filter.mode === 'none') {
    return fetchAllRecent();
  }

  if (filter.mode === 'citySlug') {
    try {
      return await fetchByCitySlug(filter.citySlug);
    } catch (err) {
      // Index aún no propagado o filtro inválido. Fallback: traer recientes y filtrar client-side.
      const all = await fetchAllRecent(FALLBACK_FETCH_LIMIT);
      return all.filter((e) => e.citySlug === filter.citySlug);
    }
  }

  // mode === 'gps'
  if (filter.userCitySlug) {
    try {
      const events = await fetchByCitySlug(filter.userCitySlug);
      return withDistance(events, filter.lat, filter.lng);
    } catch (err) {
      const all = await fetchAllRecent(FALLBACK_FETCH_LIMIT);
      const sameSlug = all.filter((e) => e.citySlug === filter.userCitySlug);
      return withDistance(sameSlug, filter.lat, filter.lng);
    }
  }

  // GPS sin city: traemos pool grande y filtramos por radio cliente.
  const all = await fetchAllRecent(FALLBACK_FETCH_LIMIT);
  const withDist = withDistance(all, filter.lat, filter.lng);
  return withDist.filter((e) => e.distanceKm != null && e.distanceKm <= filter.radiusKm);
}

export async function createEvent(params: CreateEventParams): Promise<AppEvent> {
  const persisted = {
    ...params,
    lat: bucketCoord(params.lat),
    lng: bucketCoord(params.lng),
  };
  const ref = await addDoc(collection(db, 'events'), persisted);
  return { id: ref.id, ...persisted };
}

export async function deleteEvent(eventId: string): Promise<void> {
  await deleteDoc(doc(db, 'events', eventId));
}
