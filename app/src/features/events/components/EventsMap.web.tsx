import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AppEvent } from '../types';
import { colors, spacing } from '../../../constants/theme';

type Props = { events: AppEvent[] };

export function EventsMapWeb({ events }: Props) {
  const bbox = useMemo(() => {
    if (events.length === 0) {
      // Default San José, Costa Rica
      return '-84.18,9.83,-83.98,10.03';
    }
    const lats = events.map((e) => e.lat);
    const lngs = events.map((e) => e.lng);
    const padding = 0.05;
    return [
      Math.min(...lngs) - padding,
      Math.min(...lats) - padding,
      Math.max(...lngs) + padding,
      Math.max(...lats) + padding,
    ].join(',');
  }, [events]);

  const markers = events.map((e) => `${e.lat},${e.lng}`).join('|');
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${
    markers ? `&marker=${events[0].lat},${events[0].lng}` : ''
  }`;

  return (
    <View style={styles.container}>
      {/* @ts-ignore - iframe es válido en web */}
      <iframe
        src={src}
        style={{ width: '100%', height: '100%', border: 0 }}
        title="Mapa de eventos"
      />
      {events.length > 0 && (
        <View style={styles.legend}>
          <Text style={styles.legendText}>
            {events.length} {events.length === 1 ? 'evento' : 'eventos'} · ver en pestaña Lista para detalles
          </Text>
        </View>
      )}
      {events.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No hay eventos para mostrar.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  legend: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface + 'EE',
    padding: spacing.sm,
    borderRadius: 6,
  },
  legendText: {
    color: colors.text,
    fontSize: 12,
    textAlign: 'center',
  },
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
