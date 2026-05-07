import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import type { AppEvent, EventType } from '../features/events/types';

type CreateEventParams = {
  title: string;
  type: EventType;
  description: string;
  lat: number;
  lng: number;
  date: string;
  createdBy: string;
  creatorName: string;
};

// Bucketea coordenadas a múltiplos de 0.05° (~5 km) por privacidad. Se aplica
// también a eventos para no revelar la ubicación exacta del organizador.
const COORD_BUCKET = 0.05;
function bucketCoord(n: number): number {
  return Math.round(n / COORD_BUCKET) * COORD_BUCKET;
}

export async function fetchEvents(): Promise<AppEvent[]> {
  const q = query(collection(db, 'events'), orderBy('date', 'asc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppEvent));
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
