import { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { AppEvent } from '../types';
import { colors, spacing } from '../../../constants/theme';

type Props = { events: AppEvent[] };

export function EventsMapNative({ events }: Props) {
  const region = useMemo(() => {
    if (events.length === 0) {
      return { latitude: -34.6037, longitude: -58.3816, latitudeDelta: 0.5, longitudeDelta: 0.5 };
    }
    const lats = events.map((e) => e.lat);
    const lngs = events.map((e) => e.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.05) * 1.5,
      longitudeDelta: Math.max(maxLng - minLng, 0.05) * 1.5,
    };
  }, [events]);

  return (
    <View style={styles.container}>
      <MapView style={styles.map} provider={PROVIDER_GOOGLE} initialRegion={region}>
        {events.map((e) => (
          <Marker
            key={e.id}
            coordinate={{ latitude: e.lat, longitude: e.lng }}
            title={e.title}
            description={`${e.type} · ${new Date(e.date).toLocaleDateString('es-AR')}`}
          />
        ))}
      </MapView>
      {events.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No hay eventos para mostrar.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  empty: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
  },
});
