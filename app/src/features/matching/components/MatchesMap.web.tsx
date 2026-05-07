import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Match } from '../../../services/matchingService';
import { colors, radii, spacing } from '../../../constants/theme';

type Props = {
  matches: Match[];
  myLat: number | null;
  myLng: number | null;
  onSelect: (uid: string) => void;
  onRequestPermission?: () => void;
};

type MarkerData = {
  uid: string;
  lat: number;
  lng: number;
  name: string;
  photoUrl: string | null;
  score: number;
};

function buildSrcDoc(self: { lat: number; lng: number } | null, markers: MarkerData[]): string {
  const data = JSON.stringify({ self, markers });
  // Leaflet via unpkg CDN. divIcon HTML para avatar circular. Click → postMessage al parent.
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
    <style>
      html, body, #map { height: 100%; margin: 0; padding: 0; background: ${colors.background}; }
      .marker-self {
        width: 22px; height: 22px; border-radius: 11px;
        background: ${colors.primary}; border: 3px solid #ffffff;
        box-shadow: 0 0 0 2px ${colors.primary};
      }
      .marker-match {
        width: 44px; height: 44px; border-radius: 22px;
        border: 3px solid ${colors.repeated};
        background: ${colors.background};
        overflow: hidden; cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      }
      .marker-match img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .marker-match .fallback {
        width: 100%; height: 100%;
        display: flex; align-items: center; justify-content: center;
        color: ${colors.text}; font-weight: 800; font-size: 18px; background: ${colors.card};
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script>
      (function () {
        var data = ${data};
        var L = window.L;
        var map = L.map('map', { zoomControl: true, attributionControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        var bounds = [];

        if (data.self) {
          var selfIcon = L.divIcon({
            className: '',
            html: '<div class="marker-self"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });
          L.marker([data.self.lat, data.self.lng], { icon: selfIcon, interactive: false }).addTo(map);
          bounds.push([data.self.lat, data.self.lng]);
        }

        data.markers.forEach(function (m) {
          var inner = m.photoUrl
            ? '<img src="' + m.photoUrl + '" alt="" />'
            : '<div class="fallback">' + (m.name ? m.name.charAt(0).toUpperCase() : '?') + '</div>';
          var icon = L.divIcon({
            className: '',
            html: '<div class="marker-match">' + inner + '</div>',
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          });
          var marker = L.marker([m.lat, m.lng], { icon: icon, title: m.name }).addTo(map);
          marker.on('click', function () {
            parent.postMessage({ type: 'match-click', uid: m.uid }, '*');
          });
          bounds.push([m.lat, m.lng]);
        });

        if (bounds.length === 0) {
          map.setView([9.93, -84.08], 7);
        } else if (bounds.length === 1) {
          map.setView(bounds[0], 12);
        } else {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        }
      })();
    </script>
  </body>
</html>`;
}

export function MatchesMap({ matches, myLat, myLng, onSelect, onRequestPermission }: Props) {
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string; uid?: string } | undefined;
      if (data && data.type === 'match-click' && typeof data.uid === 'string') {
        onSelectRef.current(data.uid);
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('message', onMessage);
      return () => window.removeEventListener('message', onMessage);
    }
  }, []);

  const srcDoc = useMemo(() => {
    const self = myLat != null && myLng != null ? { lat: myLat, lng: myLng } : null;
    const markers: MarkerData[] = matches
      .filter((m) => m.user.lat != null && m.user.lng != null)
      .map((m) => ({
        uid: m.user.uid,
        lat: m.user.lat as number,
        lng: m.user.lng as number,
        name: m.user.name ?? '',
        photoUrl: m.user.photoUrl ?? null,
        score: m.score,
      }));
    return buildSrcDoc(self, markers);
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
      {/* @ts-ignore — iframe es un primitivo HTML válido en RN-Web. */}
      <iframe
        srcDoc={srcDoc}
        style={{ border: 0, width: '100%', height: '100%' }}
        title="Mapa de matches"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
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
