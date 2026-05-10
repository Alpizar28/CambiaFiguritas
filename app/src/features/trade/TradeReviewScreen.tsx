import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTradeSession } from '../../hooks/useTradeSession';
import {
  cancelTradeSession,
  commitTradeSession,
  updateMySelection,
} from '../../services/tradeSessionService';
import { useTradeStore } from '../../store/tradeStore';
import { allStickers } from '../album/data/albumCatalog';
import { CheckIcon } from './components/TradeIcons';
import { colors, radii, spacing } from '../../constants/theme';
import { track } from '../../services/analytics';
import type { TradeStackParamList } from '../../types/navigation';

const stickerById = new Map(allStickers.map((s) => [s.id, s]));

function rowFor(stickerId: string) {
  const sticker = stickerById.get(stickerId);
  return {
    displayCode: sticker?.displayCode ?? stickerId,
    label: sticker?.label || sticker?.countryName || 'Jugador',
  };
}

export function TradeReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<TradeStackParamList>>();
  const route = useRoute<RouteProp<TradeStackParamList, 'TradeReview'>>();
  const { sessionId, role } = route.params;
  const session = useTradeSession(sessionId);
  const clearTrade = useTradeStore((s) => s.clear);
  const [committing, setCommitting] = useState(false);
  const committedRef = useRef(false);

  const myConfirmedAt = role === 'host' ? session?.hostConfirmedAt : session?.guestConfirmedAt;
  const peerConfirmedAt = role === 'host' ? session?.guestConfirmedAt : session?.hostConfirmedAt;
  const myStickers = role === 'host' ? session?.hostStickers ?? [] : session?.guestStickers ?? [];
  const peerStickers = role === 'host' ? session?.guestStickers ?? [] : session?.hostStickers ?? [];

  const tryCommit = useCallback(async () => {
    if (!sessionId) return;
    if (committedRef.current) return;
    committedRef.current = true;
    setCommitting(true);
    try {
      const res = await commitTradeSession(sessionId);
      track({
        name: 'trade_completed',
        params: {
          sessionId,
          tradeId: res.tradeId,
          givesCount: myStickers.length,
          receivesCount: peerStickers.length,
        },
      });
    } catch (e) {
      committedRef.current = false;
      console.error('[trade] commit failed', e);
      const msg = e instanceof Error ? e.message : 'Error al cerrar el intercambio.';
      track({ name: 'trade_commit_failed', params: { sessionId, reason: msg.slice(0, 60) } });
      Alert.alert('No pudimos cerrar el intercambio', msg);
    } finally {
      setCommitting(false);
    }
  }, [sessionId, myStickers.length, peerStickers.length]);

  useEffect(() => {
    if (!session) return;
    if (session.status === 'completed') {
      navigation.replace('TradeComplete', { sessionId: session.id });
      return;
    }
    if (session.status === 'cancelled' || session.status === 'expired') {
      Alert.alert('Sesión finalizada', session.failureReason ?? 'La sesión se canceló.');
      clearTrade();
      navigation.replace('TradeHome');
      return;
    }
    if (session.hostConfirmedAt && session.guestConfirmedAt && !committedRef.current) {
      tryCommit();
    }
  }, [session, navigation, clearTrade, tryCommit]);

  const handleEdit = useCallback(async () => {
    if (!sessionId) return;
    try {
      await updateMySelection(sessionId, role, myStickers);
    } catch (e) {
      console.error('[trade] reset confirm failed', e);
    }
    navigation.replace('TradeSelect', { sessionId, role });
  }, [sessionId, role, myStickers, navigation]);

  const handleCancel = useCallback(async () => {
    if (!sessionId) {
      navigation.replace('TradeHome');
      return;
    }
    try {
      await cancelTradeSession(sessionId, `${role}_cancelled_review`);
      track({ name: 'trade_cancelled', params: { sessionId, reason: `${role}_cancelled_review` } });
    } catch (e) {
      console.error('[trade] cancel failed', e);
    } finally {
      clearTrade();
      navigation.replace('TradeHome');
    }
  }, [sessionId, role, navigation, clearTrade]);

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const bothConfirmed = !!myConfirmedAt && !!peerConfirmedAt;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Confirmación</Text>
        <Text style={styles.title}>
          {bothConfirmed ? (committing ? 'Cerrando intercambio…' : 'Intercambio listo') : 'Esperando al otro…'}
        </Text>
        <Text style={styles.description}>
          {bothConfirmed
            ? 'Estamos actualizando los dos álbumes y registrando el intercambio.'
            : 'Vos ya confirmaste. Falta que la otra persona lo haga.'}
        </Text>
      </View>

      <View style={styles.statusGrid}>
        <View style={[styles.statusCell, !!myConfirmedAt && styles.statusOk]}>
          <Text style={styles.statusLabel}>Vos</Text>
          <View style={styles.statusValueRow}>
            <Text style={styles.statusValue}>{myConfirmedAt ? 'Confirmado' : 'Pendiente'}</Text>
            {myConfirmedAt ? <CheckIcon size={16} color={colors.primary} /> : null}
          </View>
        </View>
        <View style={[styles.statusCell, !!peerConfirmedAt && styles.statusOk]}>
          <Text style={styles.statusLabel}>El otro</Text>
          <View style={styles.statusValueRow}>
            <Text style={styles.statusValue}>{peerConfirmedAt ? 'Confirmado' : 'Pendiente'}</Text>
            {peerConfirmedAt ? <CheckIcon size={16} color={colors.primary} /> : null}
          </View>
        </View>
      </View>

      <View style={styles.sumCard}>
        <Text style={styles.sumTitle}>Doy ({myStickers.length})</Text>
        {myStickers.length === 0 ? (
          <Text style={styles.muted}>Sin figuritas.</Text>
        ) : (
          myStickers.map((id) => {
            const r = rowFor(id);
            return (
              <Text key={id} style={styles.line}>
                <Text style={styles.code}>{r.displayCode}</Text> {r.label}
              </Text>
            );
          })
        )}
      </View>

      <View style={styles.sumCard}>
        <Text style={styles.sumTitle}>Recibo ({peerStickers.length})</Text>
        {peerStickers.length === 0 ? (
          <Text style={styles.muted}>Sin figuritas.</Text>
        ) : (
          peerStickers.map((id) => {
            const r = rowFor(id);
            return (
              <Text key={id} style={styles.line}>
                <Text style={styles.code}>{r.displayCode}</Text> {r.label}
              </Text>
            );
          })
        )}
      </View>

      {!bothConfirmed ? (
        <Pressable
          onPress={handleEdit}
          style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed]}
        >
          <Text style={[styles.btnText, styles.btnTextSecondary]}>Editar mi selección</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={handleCancel}
        style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
      >
        <Text style={styles.cancelText}>Cancelar intercambio</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusCell: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  statusOk: {
    borderColor: colors.primary,
    backgroundColor: '#0F2A1A',
  },
  statusLabel: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statusValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusValue: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 14,
  },
  sumCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  sumTitle: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  line: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  code: {
    color: colors.accent,
    fontWeight: '900',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
  btn: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  btnText: {
    color: '#001A0A',
    fontWeight: '900',
    fontSize: 15,
  },
  btnTextSecondary: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.85,
  },
  cancelBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.danger,
    fontWeight: '700',
  },
});
