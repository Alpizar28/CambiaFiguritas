import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUserStore } from '../../store/userStore';
import {
  cancelGuestSession,
  commitGuestTrade,
  createGuestLink,
  fetchGuestSession,
  type GuestMatchedExchange,
  type GuestSessionView,
} from '../../services/guestTradeService';
import { shareText } from '../../utils/share';
import { QRDisplay } from './components/QRDisplay';
import { colors, radii, spacing } from '../../constants/theme';
import type { TradeStackParamList } from '../../types/navigation';

const POLL_INTERVAL_MS = 8000;

export function TradeShareScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<TradeStackParamList>>();
  const user = useUserStore((s) => s.user);
  const demoMode = useUserStore((s) => s.demoMode);

  const [creating, setCreating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [session, setSession] = useState<GuestSessionView | null>(null);
  const [matched, setMatched] = useState<GuestMatchedExchange | null>(null);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const s = await fetchGuestSession(token);
        if (cancelled) return;
        setSession(s);
        if (s.matchedExchange) setMatched(s.matchedExchange);
      } catch (err) {
        console.warn('[trade-share] poll failed', err);
      }
    };
    tick();
    const t = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [token]);

  const handleCreate = useCallback(async () => {
    if (!user || demoMode) {
      Alert.alert('Iniciá sesión', 'Necesitás una cuenta para generar un link de intercambio.');
      return;
    }
    setCreating(true);
    try {
      const r = await createGuestLink({});
      setToken(r.token);
      setUrl(r.url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo crear el link.';
      Alert.alert('Error', msg);
    } finally {
      setCreating(false);
    }
  }, [user, demoMode]);

  const handleShare = useCallback(async () => {
    if (!url) return;
    const msg =
      'Te paso mi lista de repetidas y faltantes para intercambiar. Abrí el link y pegá tu lista (no necesitás cuenta):';
    await shareText(msg, url);
  }, [url]);

  const handleCopy = useCallback(async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    Alert.alert('Link copiado', 'Pegalo en WhatsApp o donde quieras.');
  }, [url]);

  const handleCommit = useCallback(async () => {
    if (!token) return;
    setCommitting(true);
    try {
      await commitGuestTrade(token);
      Alert.alert(
        'Intercambio registrado',
        'Tu álbum se actualizó. Mostrá la lista a la otra persona al verse.',
      );
      navigation.navigate('TradeHome');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo confirmar.';
      Alert.alert('Error', msg);
    } finally {
      setCommitting(false);
    }
  }, [token, navigation]);

  const handleCancel = useCallback(async () => {
    if (!token) {
      navigation.goBack();
      return;
    }
    try {
      await cancelGuestSession(token, 'host_cancelled');
    } catch {
      // best-effort
    }
    navigation.goBack();
  }, [token, navigation]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xl + insets.bottom }]}
    >
      <View style={styles.topBar}>
        <Pressable onPress={handleCancel} hitSlop={10}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
      </View>

      <Text style={styles.eyebrow}>Intercambio por link</Text>
      <Text style={styles.title}>Cambiá con quien no usa la app</Text>
      <Text style={styles.desc}>
        Generá un link con tu lista (repetidas y faltantes). La otra persona lo abre, pega su
        propia lista y ve qué pueden intercambiar. No necesita cuenta.
      </Text>

      {!token ? (
        <Pressable
          onPress={handleCreate}
          disabled={creating}
          style={({ pressed }) => [
            styles.cta,
            styles.ctaPrimary,
            pressed && styles.pressed,
            creating && styles.disabled,
          ]}
        >
          {creating ? (
            <ActivityIndicator color="#001A0A" />
          ) : (
            <>
              <Text style={styles.ctaTitle}>Generar mi link</Text>
              <Text style={styles.ctaSub}>Toma 2 segundos.</Text>
            </>
          )}
        </Pressable>
      ) : (
        <>
          <View style={styles.qrWrap}>
            {url ? <QRDisplay value={url} size={200} /> : null}
            <Text style={styles.urlText}>{url}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [styles.cta, styles.ctaPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.ctaTitle}>Compartir por WhatsApp</Text>
            </Pressable>
            <Pressable
              onPress={handleCopy}
              style={({ pressed }) => [styles.cta, styles.ctaSecondary, pressed && styles.pressed]}
            >
              <Text style={[styles.ctaTitle, styles.ctaTitleSecondary]}>Copiar link</Text>
            </Pressable>
          </View>

          <View style={styles.statusWrap}>
            <Text style={styles.statusLabel}>Estado</Text>
            <Text style={styles.statusValue}>
              {session?.status === 'guest_submitted'
                ? 'Te respondieron — revisá abajo'
                : session?.status === 'completed'
                  ? 'Intercambio completado'
                  : 'Esperando respuesta…'}
            </Text>
          </View>

          {matched && session?.status === 'guest_submitted' ? (
            <View style={styles.matchPanel}>
              <Text style={styles.matchTitle}>Propuesta recibida</Text>
              <Text style={styles.matchHeading}>Vos das ({matched.hostGives.length})</Text>
              <Text style={styles.matchList}>{matched.hostGives.join(', ') || '—'}</Text>
              <Text style={styles.matchHeading}>Vos recibís ({matched.hostReceives.length})</Text>
              <Text style={styles.matchList}>{matched.hostReceives.join(', ') || '—'}</Text>
              <Pressable
                onPress={handleCommit}
                disabled={committing}
                style={({ pressed }) => [
                  styles.cta,
                  styles.ctaPrimary,
                  pressed && styles.pressed,
                  committing && styles.disabled,
                ]}
              >
                {committing ? (
                  <ActivityIndicator color="#001A0A" />
                ) : (
                  <Text style={styles.ctaTitle}>Confirmar y actualizar mi álbum</Text>
                )}
              </Pressable>
              <Text style={styles.helpHint}>
                Confirmá sólo cuando hayan acordado el intercambio físico. Tu álbum se
                actualizará: las repetidas que entregaste bajan, las nuevas pasan a tenidas.
              </Text>
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  topBar: { marginBottom: spacing.sm },
  back: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '900' },
  desc: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  cta: {
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  ctaPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  ctaSecondary: { backgroundColor: colors.card, borderColor: colors.border },
  ctaTitle: { color: '#001A0A', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  ctaTitleSecondary: { color: colors.text },
  ctaSub: { color: '#0A2E1A', marginTop: 4, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  qrWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  urlText: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  actions: { gap: spacing.sm },
  statusWrap: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  statusLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusValue: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 4 },
  matchPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  matchTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  matchHeading: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  matchList: { color: colors.text, fontSize: 14, lineHeight: 20 },
  helpHint: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
});
