import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/userStore';
import { useEventStore } from '../../store/eventStore';
import { fetchEvents, deleteEvent } from '../../services/eventService';
import { track } from '../../services/analytics';
import { EventCard } from './components/EventCard';
import { CreateEventModal } from './components/CreateEventModal';
import { EventsMap } from './components/EventsMap';
import { AdBanner } from '../../components/AdBanner';
import { EventCardSkeleton } from '../../components/Skeleton';
import { colors, spacing, radii } from '../../constants/theme';

type Tab = 'map' | 'list';

export function EventsScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);
  const { events, loading, error, setEvents, addEvent, removeEvent, setLoading, setError } =
    useEventStore();
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<Tab>(Platform.OS === 'web' ? 'list' : 'map');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchEvents()
      .then((evs) => { if (alive) setEvents(evs); })
      .catch(() => { if (alive) setError('No se pudieron cargar los eventos.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteEvent(id);
      removeEvent(id);
      track({ name: 'event_deleted' });
    } catch {
      setError('No se pudo eliminar el evento.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Cerca tuyo</Text>
          <Text style={styles.title}>Eventos</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowCreate(true)}>
          <Text style={styles.addButtonText}>+ Crear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TabBtn active={tab === 'map'} label="Mapa" onPress={() => setTab('map')} />
        <TabBtn active={tab === 'list'} label="Lista" onPress={() => setTab('list')} />
      </View>

      {loading && events.length === 0 ? (
        <View style={{ gap: spacing.md, padding: spacing.xl }}>
          <EventCardSkeleton />
          <EventCardSkeleton />
        </View>
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
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📍</Text>
              <Text style={styles.emptyText}>
                {error ?? 'No hay eventos por ahora. Creá el primero.'}
              </Text>
            </View>
          }
          ListFooterComponent={events.length > 0 ? <AdBanner inline /> : null}
        />
      )}

      {user && (
        <CreateEventModal
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={addEvent}
          uid={user.uid}
          userName={user.name}
        />
      )}
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
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  addButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 14,
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    minHeight: 300,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 280,
  },
});
