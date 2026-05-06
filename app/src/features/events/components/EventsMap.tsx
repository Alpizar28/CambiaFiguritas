import { Platform } from 'react-native';
import type { AppEvent } from '../types';
import { EventsMapNative } from './EventsMap.native';
import { EventsMapWeb } from './EventsMap.web';

type Props = { events: AppEvent[] };

export function EventsMap({ events }: Props) {
  if (Platform.OS === 'web') return <EventsMapWeb events={events} />;
  return <EventsMapNative events={events} />;
}
