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

export async function fetchEvents(): Promise<AppEvent[]> {
  const q = query(collection(db, 'events'), orderBy('date', 'asc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppEvent));
}

export async function createEvent(params: CreateEventParams): Promise<AppEvent> {
  const ref = await addDoc(collection(db, 'events'), params);
  return { id: ref.id, ...params };
}

export async function deleteEvent(eventId: string): Promise<void> {
  await deleteDoc(doc(db, 'events', eventId));
}
