import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { ScreenShell } from '../../components/ScreenShell';
import { useUserStore } from '../../store/userStore';
import { createSession, findActiveSessionForUser, TradeError } from '../../services/tradeSessionService';
import { track } from '../../services/analytics';
import { colors, radii, spacing } from '../../constants/theme';
import type { TradeStackParamList } from '../../types/navigation';

export function TradeHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<TradeStackParamList>>();
  const user = useUserStore((s) => s.user);
  const demoMode = useUserStore((s) => s.demoMode);
  const [busy, setBusy] = useState(false);

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
      track({ name: 'trade_session_created', params: { shortCode: session.shortCode } });
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

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
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
          onPress={handleJoin}
          style={({ pressed }) => [styles.cta, styles.ctaSecondary, pressed && styles.pressed]}
        >
          <Text style={[styles.ctaTitle, styles.ctaTitleSecondary]}>Unirme con código</Text>
          <Text style={[styles.ctaSub, styles.ctaSubSecondary]}>Escaneá el QR o tipeá el código.</Text>
        </Pressable>
      </View>

      <View style={styles.howWrap}>
        <Text style={styles.howTitle}>Cómo funciona</Text>
        <Text style={styles.howStep}>1. Uno crea la sesión y muestra el QR.</Text>
        <Text style={styles.howStep}>2. El otro escanea o tipea el código.</Text>
        <Text style={styles.howStep}>3. Cada uno marca qué figu da y qué recibe.</Text>
        <Text style={styles.howStep}>4. Confirman los dos. Listo, ambos álbumes se actualizan.</Text>
      </View>
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
