import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { ScreenShell } from '../../components/ScreenShell';
import { useUserStore } from '../../store/userStore';
import { useTradeStore } from '../../store/tradeStore';
import { createSession, findActiveSessionForUser, TradeError } from '../../services/tradeSessionService';
import { track } from '../../services/analytics';
import { colors, radii, spacing } from '../../constants/theme';
import type { TradeStackParamList } from '../../types/navigation';
import { QRScanner } from './components/QRScanner';

export function TradeHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<TradeStackParamList>>();
  const user = useUserStore((s) => s.user);
  const demoMode = useUserStore((s) => s.demoMode);
  const closeTradeModal = useTradeStore((s) => s.closeModal);
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!user || demoMode) {
      Alert.alert('Iniciá sesión', 'Necesitás una cuenta para usar intercambio presencial.');
      return;
    }
    setBusy(true);
    try {
      const existing = await findActiveSessionForUser(user.uid);
      if (existing) {
        const role = existing.hostUid === user.uid ? 'host' : 'guest';
        if (existing.status === 'waiting') {
          navigation.navigate('TradeHost', { sessionId: existing.id });
        } else {
          navigation.navigate('TradeSelect', { sessionId: existing.id, role });
        }
        return;
      }
      const session = await createSession(user);
      track({ name: 'trade_session_created', params: { sessionId: session.id } });
      navigation.navigate('TradeHost', { sessionId: session.id });
    } catch (e) {
      const msg = e instanceof TradeError ? e.message : 'No se pudo crear la sesión.';
      console.error('[trade] create session failed', e);
      Alert.alert('Error', msg);
    } finally {
      setBusy(false);
    }
  }, [user, demoMode, navigation]);

  const handleJoin = useCallback(() => {
    if (!user || demoMode) {
      Alert.alert('Iniciá sesión', 'Necesitás una cuenta para usar intercambio presencial.');
      return;
    }
    navigation.navigate('TradeJoin', {});
  }, [user, demoMode, navigation]);

  const handleScan = useCallback(() => {
    if (!user || demoMode) {
      Alert.alert('Iniciá sesión', 'Necesitás una cuenta para usar intercambio presencial.');
      return;
    }
    setScannerOpen(true);
  }, [user, demoMode]);

  const handleScanResult = useCallback((raw: string) => {
    const match = raw.match(/\/trade\/([A-Z0-9]{6})/i);
    if (!match?.[1]) {
      Alert.alert('QR inválido', 'Escaneá el QR de intercambio de CambiaFiguritas.');
      return;
    }
    const code = match[1].toUpperCase();
    setScannerOpen(false);
    track({ name: 'trade_qr_scanned', params: { code } });
    navigation.navigate('TradeJoin', { prefilledCode: code });
  }, [navigation]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={closeTradeModal}
          accessibilityRole="button"
          accessibilityLabel="Cerrar y volver"
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          hitSlop={10}
        >
          <Text style={styles.backBtnText}>‹ Volver</Text>
        </Pressable>
      </View>

      <ScreenShell
        eyebrow="Intercambio presencial"
        title="Cambiá figus en persona"
        description="Pareá tu app con la del otro coleccionista, marcá las figus que se dan y confirmá juntos. Tu álbum se actualiza solo."
      />

      <View style={styles.actions}>
        <Pressable
          onPress={handleCreate}
          disabled={busy}
          style={({ pressed }) => [styles.cta, styles.ctaPrimary, pressed && styles.pressed, busy && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator color="#001A0A" />
          ) : (
            <>
              <Text style={styles.ctaTitle}>Iniciar intercambio</Text>
              <Text style={styles.ctaSub}>Generá un QR para que otro escanee.</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleScan}
          style={({ pressed }) => [styles.cta, styles.ctaSecondary, pressed && styles.pressed]}
        >
          <Text style={[styles.ctaTitle, styles.ctaTitleSecondary]}>Escanear QR</Text>
          <Text style={[styles.ctaSub, styles.ctaSubSecondary]}>Apuntá al QR del otro coleccionista.</Text>
        </Pressable>

        <Pressable
          onPress={handleJoin}
          style={({ pressed }) => [styles.cta, styles.ctaSecondary, pressed && styles.pressed]}
        >
          <Text style={[styles.ctaTitle, styles.ctaTitleSecondary]}>Unirme con código</Text>
          <Text style={[styles.ctaSub, styles.ctaSubSecondary]}>Tipeá el código de 6 caracteres.</Text>
        </Pressable>
      </View>

      <View style={styles.howWrap}>
        <Text style={styles.howTitle}>Cómo funciona</Text>
        <Text style={styles.howStep}>1. Uno crea la sesión y muestra el QR.</Text>
        <Text style={styles.howStep}>2. El otro escanea el QR o tipea el código.</Text>
        <Text style={styles.howStep}>3. Cada uno marca qué figu da y qué recibe.</Text>
        <Text style={styles.howStep}>4. Confirman los dos. Listo, ambos álbumes se actualizan.</Text>
      </View>

      {scannerOpen ? (
        <QRScanner onResult={handleScanResult} onClose={() => setScannerOpen(false)} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: spacing.lg,
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  actions: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  cta: {
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
  },
  ctaPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ctaSecondary: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  ctaTitle: {
    color: '#001A0A',
    fontSize: 18,
    fontWeight: '900',
  },
  ctaTitleSecondary: {
    color: colors.text,
  },
  ctaSub: {
    color: '#0A2E1A',
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  ctaSubSecondary: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  howWrap: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.lg,
  },
  howTitle: {
    color: colors.accent,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  howStep: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
});
