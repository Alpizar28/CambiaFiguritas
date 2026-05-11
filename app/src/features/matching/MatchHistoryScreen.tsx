import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/userStore';
import {
  defaultRetentionFor,
  listMatchBatches,
  pruneOldBatches,
  type MatchBatch,
  type MatchHistoryEntry,
} from '../../services/matchHistoryService';
import { formatDistance } from '../../utils/distance';
import { track } from '../../services/analytics';
import { colors, radii, spacing } from '../../constants/theme';
import { ENABLE_PREMIUM_UI } from '../../constants/featureFlags';
import { PremiumBadge } from '../../components/PremiumBadge';

const FILTER_LABELS: Record<string, string> = {
  mi_ciudad: 'Mi ciudad',
  '15km': '15 km',
  '50km': '50 km',
  todos: 'Todos',
};

function formatDate(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function ageDays(ms: number): number {
  if (!ms) return 0;
  return Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
}

type Props = { onClose: () => void };

export function MatchHistoryScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);
  const isPremium = ENABLE_PREMIUM_UI && user?.premium === true;
  const [batches, setBatches] = useState<MatchBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listMatchBatches(user.uid);
      setBatches(data);
      track({ name: 'match_history_opened', params: { batchCount: data.length } });
      // Prune background
      pruneOldBatches(user.uid, defaultRetentionFor(isPremium)).catch(() => {});
    } catch (e) {
      setError('No se pudo cargar el historial.');
      console.warn('[MatchHistory] load error', e);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, isPremium]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Text style={styles.back}>← Volver</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.eyebrow}>Tu historial</Text>
          <Text style={styles.title}>Búsquedas anteriores</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>⚠️</Text>
          <Text style={styles.emptyMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadBatches}>
            <Text style={styles.retryBtnText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : batches.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📜</Text>
          <Text style={styles.emptyTitle}>Aún no buscaste matches</Text>
          <Text style={styles.emptyMsg}>
            Cada vez que buscás matches, los guardamos acá para que puedas volver a contactarlos.
          </Text>
        </View>
      ) : (
        <FlatList
          data={batches}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <BatchSection batch={item} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xl }} />}
        />
      )}
    </View>
  );
}

function BatchSection({ batch }: { batch: MatchBatch }) {
  const dateStr = formatDate(batch.createdAt);
  const filterLabel = FILTER_LABELS[batch.filterUsed] ?? batch.filterUsed;
  const days = ageDays(batch.createdAt);

  return (
    <View>
      <Pressable
        onPress={() => track({ name: 'match_history_batch_expanded', params: { batchId: batch.id, ageDays: days } })}
      >
        <Text style={styles.batchHeader}>
          📅 {dateStr} · {filterLabel} · {batch.matches.length} resultado{batch.matches.length !== 1 ? 's' : ''}
        </Text>
      </Pressable>
      <View style={styles.batchEntries}>
        {batch.matches.map((entry) => (
          <HistoryRow key={entry.uid} entry={entry} batchAgeDays={days} batchDate={dateStr} />
        ))}
      </View>
    </View>
  );
}

function HistoryRow({
  entry,
  batchAgeDays,
  batchDate,
}: {
  entry: MatchHistoryEntry;
  batchAgeDays: number;
  batchDate: string;
}) {
  const handleWhatsApp = () => {
    const phone = (entry.whatsapp ?? '').replace(/\D/g, '');
    if (!phone) return;
    track({
      name: 'match_history_whatsapp_clicked',
      params: { matchUid: entry.uid, ageDays: batchAgeDays },
    });
    const msg = encodeURIComponent(
      `Hola! Te vi en CambiaFiguritas (de tu búsqueda del ${batchDate}), ¿intercambiamos?`,
    );
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    } else {
      Linking.openURL(`https://wa.me/${phone}?text=${msg}`);
    }
  };

  const subtitleParts = [
    entry.city || null,
    entry.distanceKm != null ? `a ${formatDistance(entry.distanceKm)}` : null,
  ].filter(Boolean);

  return (
    <View style={styles.historyRow}>
      {entry.photoUrl ? (
        <Image source={{ uri: entry.photoUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarLetter}>{entry.name?.[0] ?? '?'}</Text>
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text
            style={[
              styles.name,
              ENABLE_PREMIUM_UI && entry.premium && styles.namePremium,
            ]}
            numberOfLines={1}
          >
            {entry.name}
          </Text>
          {ENABLE_PREMIUM_UI && entry.premium ? <PremiumBadge size="sm" /> : null}
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitleParts.join(' · ') || 'Sin ubicación'}
        </Text>
        <Text style={styles.breakdown}>
          🔁 {entry.iNeedFromThem} pedís · {entry.theyNeedFromMe} ofrecés · {entry.score} score
        </Text>
      </View>
      {entry.whatsapp ? (
        <TouchableOpacity style={styles.waBtn} onPress={handleWhatsApp}>
          <Text style={styles.waText}>WhatsApp</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  back: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
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
    fontSize: 24,
    fontWeight: '800',
  },
  list: {
    padding: spacing.xl,
  },
  batchHeader: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  batchEntries: {
    gap: spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  namePremium: {
    color: '#FFD700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 11,
  },
  breakdown: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  waBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  waText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyMsg: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  retryBtnText: {
    color: colors.background,
    fontWeight: '700',
  },
});
