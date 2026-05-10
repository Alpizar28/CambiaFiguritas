import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTradeSession } from '../../hooks/useTradeSession';
import { cancelTradeSession } from '../../services/tradeSessionService';
import { useTradeStore } from '../../store/tradeStore';
import { useUserStore } from '../../store/userStore';
import { QRDisplay } from './components/QRDisplay';
import { colors, radii, spacing } from '../../constants/theme';
import { track } from '../../services/analytics';
import type { TradeStackParamList } from '../../types/navigation';

const QR_PREFIX = 'cambiafiguritas://trade/';

export function TradeHostScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<TradeStackParamList>>();
  const route = useRoute<RouteProp<TradeStackParamList, 'TradeHost'>>();
  const sessionId = route.params?.sessionId ?? null;
  const session = useTradeSession(sessionId);
  const setActive = useTradeStore((s) => s.setActive);
  const clearTrade = useTradeStore((s) => s.clear);
  const user = useUserStore((s) => s.user);
  const [now, setNow] = useState(Date.now());
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (sessionId) setActive(sessionId, 'host');
  }, [sessionId, setActive]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!session) return;
    if (session.status === 'paired' || session.status === 'selecting') {
      navigation.replace('TradeSelect', { sessionId: session.id, role: 'host' });
    } else if (session.status === 'cancelled' || session.status === 'expired') {
      Alert.alert('Sesión finalizada', session.failureReason ?? 'La sesión se canceló.');
      clearTrade();
      navigation.replace('TradeHome');
    } else if (session.status === 'completed') {
      navigation.replace('TradeComplete', { sessionId: session.id });
    }
  }, [session, navigation, clearTrade]);

  const handleCancel = useCallback(async () => {
    if (!sessionId) {
      navigation.replace('TradeHome');
      return;
    }
    setCancelling(true);
    try {
      await cancelTradeSession(sessionId, 'host_cancelled');
      track({ name: 'trade_cancelled', params: { sessionId, reason: 'host_cancelled' } });
      clearTrade();
      navigation.replace('TradeHome');
    } catch (e) {
      console.error('[trade] cancel failed', e);
      Alert.alert('Error', 'No pudimos cancelar. Probá de nuevo.');
    } finally {
      setCancelling(false);
    }
  }, [sessionId, navigation, clearTrade]);

  const handleCopy = useCallback(async () => {
    if (!session) return;
    await Clipboard.setStringAsync(session.shortCode);
    Alert.alert('Código copiado', `Compartí "${session.shortCode}" con tu compañero.`);
  }, [session]);

  const remainingSeconds = useMemo(() => {
    if (!session) return 0;
    return Math.max(0, Math.floor((session.expiresAt - now) / 1000));
  }, [session, now]);

  const isExpired = !!session && (remainingSeconds <= 0 || session.status === 'expired');

  useEffect(() => {
    if (!session || !sessionId) return;
    if (remainingSeconds > 0) return;
    if (session.status === 'expired' || session.status === 'cancelled' || session.status === 'completed') return;
    cancelTradeSession(sessionId, 'expired').catch((e) => {
      console.error('[trade] auto-expire failed', e);
    });
  }, [remainingSeconds, session, sessionId]);

  const mm = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
  const ss = (remainingSeconds % 60).toString().padStart(2, '0');

  if (!sessionId || !user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Cargando sesión…</Text>
      </View>
    );
  }

  const qrPayload = `${QR_PREFIX}${session.shortCode}`;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Esperando…</Text>
        <Text style={styles.title}>Compartí este código</Text>
        <Text style={styles.description}>
          Mostrale el QR a tu compañero o pasale el código. Cuando se una, las dos pantallas avanzan solas.
        </Text>
      </View>

      <View style={styles.qrCard}>
        {isExpired ? (
          <View style={styles.expiredBox}>
            <Text style={styles.expiredTitle}>Sesión expirada</Text>
            <Text style={styles.expiredText}>
              El código ya no es válido. Cancelá y armá una nueva sesión.
            </Text>
          </View>
        ) : (
          <>
            <QRDisplay value={qrPayload} size={220} />
            <Text style={styles.codeLabel}>Código</Text>
            <Pressable
              onPress={handleCopy}
              disabled={isExpired}
              style={({ pressed }) => [styles.codeBox, pressed && styles.pressed]}
            >
              <Text style={styles.codeText}>{session.shortCode}</Text>
              <Text style={styles.copyHint}>Tocá para copiar</Text>
            </Pressable>
            <Text style={styles.timer}>
              Expira en {mm}:{ss}
            </Text>
          </>
        )}
      </View>

      <Pressable
        onPress={handleCancel}
        disabled={cancelling}
        style={({ pressed }) => [styles.cancel, pressed && styles.pressed, cancelling && styles.disabled]}
      >
        <Text style={styles.cancelText}>{cancelling ? 'Cancelando…' : 'Cancelar sesión'}</Text>
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
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  muted: {
    color: colors.textMuted,
  },
  header: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
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
    fontSize: 26,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  qrCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  codeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  codeBox: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    minWidth: 200,
  },
  codeText: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 8,
  },
  copyHint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  timer: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  expiredBox: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  expiredTitle: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: '900',
  },
  expiredText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  cancel: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
});
