import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import type { AppEvent } from '../types';
import { track } from '../../../services/analytics';
import { colors, spacing, radii } from '../../../constants/theme';

const TYPE_LABELS: Record<string, string> = {
  intercambio: '🔄 Intercambio',
  meetup: '🤝 Meetup',
  tienda: '🏪 Tienda',
};

const TYPE_COLORS: Record<string, string> = {
  intercambio: colors.primary,
  meetup: colors.secondary,
  tienda: colors.accent,
};

type Props = {
  event: AppEvent;
  currentUid?: string;
  onDelete?: (id: string) => void;
};

export function EventCard({ event, currentUid, onDelete }: Props) {
  const date = new Date(event.date);
  const isOwner = currentUid === event.createdBy;

  const openMaps = () => {
    track({ name: 'event_maps_opened' });
    Linking.openURL(`https://maps.google.com/?q=${event.lat},${event.lng}`);
  };

  const handleDelete = () => {
    Alert.alert('Eliminar evento', '¿Seguro que querés eliminar este evento?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => onDelete?.(event.id) },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.typeBadge, { borderColor: TYPE_COLORS[event.type] }]}>
          <Text style={[styles.typeText, { color: TYPE_COLORS[event.type] }]}>
            {TYPE_LABELS[event.type]}
          </Text>
        </View>
        {isOwner && (
          <TouchableOpacity onPress={handleDelete}>
            <Text style={styles.deleteText}>Eliminar</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title}>{event.title}</Text>
      {event.description ? (
        <Text style={styles.description}>{event.description}</Text>
      ) : null}

      <View style={styles.meta}>
        <Text style={styles.metaText}>
          📅 {date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          {' · '}
          {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text style={styles.metaText}>👤 {event.creatorName}</Text>
      </View>

      <TouchableOpacity style={styles.mapsButton} onPress={openMaps}>
        <Text style={styles.mapsText}>Ver en Google Maps</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteText: {
    color: colors.danger,
    fontSize: 13,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    gap: 2,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  mapsButton: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  mapsText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
