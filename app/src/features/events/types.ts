export type EventType = 'intercambio' | 'meetup' | 'tienda';

export type AppEvent = {
  id: string;
  title: string;
  type: EventType;
  description: string;
  lat: number;
  lng: number;
  date: string;
  createdBy: string;
  creatorName: string;
};
