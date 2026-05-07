import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/userStore';
import { useEventStore } from '../../store/eventStore';
import { fetchEvents, deleteEvent, type EventFilter } from '../../services/eventService';
import { saveUserLocation, setUserCity } from '../../services/userService';
import { citySlug } from '../../utils/citySlug';
import { track } from '../../services/analytics';
import { EventCard } from './components/EventCard';
import { CreateEventModal } from './components/CreateEventModal';
import { EventsMap } from './components/EventsMap';
import { NoLocationBanner } from './components/NoLocationBanner';
import { EmptyZoneState } from './components/EmptyZoneState';
import { CreateEventFab } from './components/CreateEventFab';
import { CitySetterModal } from './components/CitySetterModal';
import { AdBanner } from '../../components/AdBanner';
import { EventCardSkeleton } from '../../components/Skeleton';
import { colors, spacing, radii } from '../../constants/theme';

type Tab = 'map' | 'list';

type ZoneState =
  | { kind: 'resolving' }
  | { kind: 'gps'; lat: number; lng: number; cityName?: string; userCitySlug?: string }
  | { kind: 'citySlug'; slug: string; cityName: string }
  | { kind: 'blocked'; canAskAgain: boolean };

const RADIUS_KM = 25;

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!results || results.length === 0) return null;
    const r = results[0];
    return r.city ?? r.subregion ?? r.region ?? null;
  } catch {
    return null;
  }
}

export function EventsScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);
  const { events, loading, error, setEvents, addEvent, removeEvent, setLoading, setError } =
    useEventStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showCitySetter, setShowCitySetter] = useState(false);
  const [tab, setTab] = useState<Tab>(Platform.OS === 'web' ? 'list' : 'map');
  const [zone, setZone] = useState<ZoneState>({ kind: 'resolving' });

  const userCity = user?.city?.trim();
  const userCitySlug = userCity ? citySlug(userCity) : undefined;

  const resolveZone = useCallback(async () => {
    if (!user?.uid) return;
    setZone({ kind: 'resolving' });

    // 1. Cached coords del user doc → render rápido, refresh background.
    if (user.lat != null && user.lng != null) {
      setZone({
        kind: 'gps',
        lat: user.lat,
        lng: user.lng,
        cityName: userCity,
        userCitySlug,
      });
      // refresh background (no await)
      refreshGpsSilently(user.uid);
      return;
    }

    // 2. Pedir GPS
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === 'granted' || perm.canAskAgain) {
        const req =
          perm.status === 'granted'
            ? perm
            : await Location.requestForegroundPermissionsAsync();
        if (req.status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          saveUserLocation(user.uid, lat, lng).catch(() => {});

          // Reverse geocode + persist city si user.city vacío
          let cityName = userCity;
          let slug = userCitySlug;
          if (!cityName) {
            const auto = await reverseGeocode(lat, lng);
            if (auto) {
              cityName = auto;
              slug = citySlug(auto);
              setUserCity(user.uid, auto).catch(() => {});
              track({ name: 'event_city_set', params: { source: 'reverse_geocode' } });
            }
          }

          setZone({ kind: 'gps', lat, lng, cityName, userCitySlug: slug });
          return;
        }
      }
      // 3. Fallback user.city
      if (userCitySlug && userCity) {
        setZone({ kind: 'citySlug', slug: userCitySlug, cityName: userCity });
        return;
      }
      // 4. Bloqueo
      setZone({ kind: 'blocked', canAskAgain: perm.canAskAgain });
      track({
        name: 'events_no_location_blocked',
        params: { canAskAgain: perm.canAskAgain },
      });
    } catch {
      // Permission API rota → fallback user.city
      if (userCitySlug && userCity) {
        setZone({ kind: 'citySlug', slug: userCitySlug, cityName: userCity });
      } else {
        setZone({ kind: 'blocked', canAskAgain: true });
      }
    }
  }, [user?.uid, user?.lat, user?.lng, userCity, userCitySlug]);

  // Refresh GPS en background sin bloquear UI
  const refreshGpsSilently = async (uid: string) => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      saveUserLocation(uid, pos.coords.latitude, pos.coords.longitude).catch(() => {});
    } catch {
      // silent
    }
  };

  useEffect(() => {
    resolveZone();
  }, [resolveZone]);

  // Track zone resolved (dispara una vez por cambio de kind)
  useEffect(() => {
    if (zone.kind === 'resolving') return;
    if (zone.kind === 'blocked') return;
    track({
      name: 'events_zone_resolved',
      params: {
        mode: zone.kind === 'gps' ? 'gps' : 'citySlug',
        hasCity: Boolean(userCity),
      },
    });
  }, [zone.kind, userCity]);

  // Fetch events según zone
  useEffect(() => {
    if (zone.kind === 'resolving' || zone.kind === 'blocked') return;
    let alive = true;
    setLoading(true);

    const filter: EventFilter =
      zone.kind === 'gps'
        ? {
            mode: 'gps',
            lat: zone.lat,
            lng: zone.lng,
            radiusKm: RADIUS_KM,
            userCitySlug: zone.userCitySlug,
          }
        : { mode: 'citySlug', citySlug: zone.slug };

    fetchEvents(filter)
      .then((evs) => {
        if (!alive) return;
        setEvents(evs);
        track({
          name: 'events_filtered_by_zone',
          params: { mode: zone.kind, resultCount: evs.length },
        });
      })
      .catch(() => {
        if (alive) setError('No se pudieron cargar los eventos.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [zone, setEvents, setError, setLoading]);

  const handleDelete = async (id: string) => {
    try {
      await deleteEvent(id);
      removeEvent(id);
      track({ name: 'event_deleted' });
    } catch {
      setError('No se pudo eliminar el evento.');
    }
  };

  const handleShareLocation = async () => {
    // Re-trigger zone resolve (que ahora intentará pedir permission de nuevo si canAskAgain)
    await resolveZone();
  };

  const handleSetCity = () => {
    setShowCitySetter(true);
  };

  const handleCitySaved = (city: string) => {
    // user store será actualizado por subscribeUserDoc (onSnapshot). Forzar re-resolve aquí también.
    const slug = citySlug(city);
    if (slug) {
      setZone({ kind: 'citySlug', slug, cityName: city });
    }
  };

  const handleCreateFromEmpty = () => {
    track({ name: 'events_zone_empty_create_clicked' });
    setShowCreate(true);
  };

  const cityNameForUI =
    zone.kind === 'gps' || zone.kind === 'citySlug' ? zone.cityName : undefined;
  const eyebrowText = cityNameForUI ? `En ${cityNameForUI}` : 'Cerca tuyo';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{eyebrowText}</Text>
          <Text style={styles.title}>Eventos</Text>
        </View>
      </View>

      {zone.kind === 'blocked' ? (
        <NoLocationBanner
          onShareLocation={handleShareLocation}
          onSetCity={handleSetCity}
          permissionPermanentlyDenied={!zone.canAskAgain}
        />
      ) : (
        <>
          <View style={styles.tabs}>
            <TabBtn active={tab === 'map'} label="Mapa" onPress={() => setTab('map')} />
            <TabBtn active={tab === 'list'} label="Lista" onPress={() => setTab('list')} />
          </View>

          {(loading || zone.kind === 'resolving') && events.length === 0 ? (
            <View style={{ gap: spacing.md, padding: spacing.xl }}>
              <EventCardSkeleton />
              <EventCardSkeleton />
            </View>
          ) : events.length === 0 ? (
            <EmptyZoneState cityName={cityNameForUI} onCreate={handleCreateFromEmpty} />
          ) : tab === 'map' ? (
            <EventsMap events={events} />
          ) : (
            <FlatList
              data={events}
              keyExtractor={(e) => e.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <EventCard event={item} currentUid={user?.uid} onDelete={handleDelete} />
              )}
              ListFooterComponent={events.length > 0 ? <AdBanner inline /> : null}
            />
          )}
        </>
      )}

      {zone.kind !== 'blocked' && zone.kind !== 'resolving' ? (
        <CreateEventFab onPress={() => setShowCreate(true)} bottomInset={insets.bottom} />
      ) : null}

      {user && (
        <CreateEventModal
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={addEvent}
          uid={user.uid}
          userName={user.name}
          currentCity={userCity}
        />
      )}

      {user && (
        <CitySetterModal
          visible={showCitySetter}
          initialValue={userCity}
          uid={user.uid}
          onClose={() => setShowCitySetter(false)}
          onSaved={handleCitySaved}
        />
      )}

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TabBtn({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  tabTextActive: {
    color: colors.background,
  },
  list: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.danger,
  },
  errorText: {
    color: colors.background,
    fontSize: 13,
    textAlign: 'center',
  },
});
