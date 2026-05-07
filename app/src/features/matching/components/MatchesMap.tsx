import { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Match } from '../../../services/matchingService';
import { colors, radii, spacing } from '../../../constants/theme';

type Props = {
  matches: Match[];
  myLat: number | null;
  myLng: number | null;
  onSelect: (uid: string) => void;
  onRequestPermission?: () => void;
};

export function MatchesMap({ matches, myLat, myLng, onSelect, onRequestPermission }: Props) {
  const region = useMemo(() => {
    const lats: number[] = [];
    const lngs: number[] = [];
    if (myLat != null && myLng != null) {
      lats.push(myLat);
      lngs.push(myLng);
    }
    for (const m of matches) {
      if (m.user.lat != null && m.user.lng != null) {
        lats.push(m.user.lat);
        lngs.push(m.user.lng);
      }
    }
    if (lats.length === 0) {
      // Default San José, Costa Rica.
      return { latitude: 9.93, longitude: -84.08, latitudeDelta: 0.5, longitudeDelta: 0.5 };
    }
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.05) * 1.5,
      longitudeDelta: Math.max(maxLng - minLng, 0.05) * 1.5,
    };
  }, [matches, myLat, myLng]);

  if (myLat == null || myLng == null) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionIcon}>📍</Text>
        <Text style={styles.permissionTitle}>Activá la ubicación</Text>
        <Text style={styles.permissionText}>
          Necesitamos tu ubicación para mostrarte el mapa con vos y los matches cercanos.
        </Text>
        {onRequestPermission ? (
          <TouchableOpacity style={styles.permissionButton} onPress={onRequestPermission}>
            <Text style={styles.permissionButtonText}>Permitir ubicación</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
      >
        <Marker coordinate={{ latitude: myLat, longitude: myLng }} title="Tú" anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.markerBase, styles.selfMarker]}>
            <View style={styles.selfDot} />
          </View>
        </Marker>

        {matches.map((m) =>
          m.user.lat != null && m.user.lng != null ? (
            <Marker
              key={m.user.uid}
              coordinate={{ latitude: m.user.lat, longitude: m.user.lng }}
              onPress={() => onSelect(m.user.uid)}
              title={m.user.name}
              description={`${m.score} figus para intercambiar`}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.markerBase, styles.matchMarker]}>
                {m.user.photoUrl ? (
                  <Image source={{ uri: m.user.photoUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarLetter}>{(m.user.name?.[0] ?? '?').toUpperCase()}</Text>
                  </View>
                )}
              </View>
            </Marker>
          ) : null,
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  markerBase: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfMarker: {
    borderColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  selfDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  matchMarker: {
    borderColor: colors.repeated,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  permissionIcon: {
    fontSize: 56,
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  permissionText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  permissionButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 14,
  },
});
