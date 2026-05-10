import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { joinSession, TradeError } from '../../services/tradeSessionService';
import { isValidShortCode, normalizeShortCode } from './utils/shortCode';
import { useTradeStore } from '../../store/tradeStore';
import { track } from '../../services/analytics';
import { colors, radii, spacing } from '../../constants/theme';
import type { TradeStackParamList } from '../../types/navigation';

export function TradeJoinScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<TradeStackParamList>>();
  const route = useRoute<RouteProp<TradeStackParamList, 'TradeJoin'>>();
  const initial = route.params?.prefilledCode ?? '';
  const [code, setCode] = useState(normalizeShortCode(initial));
  const [busy, setBusy] = useState(false);
  const setActive = useTradeStore((s) => s.setActive);
  const closeTradeModal = useTradeStore((s) => s.closeModal);

  const tryJoin = useCallback(
    async (rawCode: string) => {
      const normalized = normalizeShortCode(rawCode);
      if (!isValidShortCode(normalized)) {
        Alert.alert('Código inválido', 'Tiene que ser 6 caracteres (letras y números).');
        return;
      }
      setBusy(true);
      try {
        const { sessionId } = await joinSession(normalized);
        setActive(sessionId, 'guest');
        track({ name: 'trade_joined', params: { sessionId } });
        navigation.replace('TradeSelect', { sessionId, role: 'guest' });
      } catch (e) {
        const msg = e instanceof TradeError ? e.message : (e instanceof Error ? e.message : 'No se pudo unir.');
        console.error('[trade] join failed', e);
        Alert.alert('No pudimos unirte', msg);
      } finally {
        setBusy(false);
      }
    },
    [navigation, setActive],
  );

  useEffect(() => {
    if (initial && isValidShortCode(normalizeShortCode(initial))) {
      tryJoin(initial);
    }
  }, [initial, tryJoin]);

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
          style={({ pressed }) => [styles.backTopBtn, pressed && styles.pressed]}
          hitSlop={10}
        >
          <Text style={styles.backTopBtnText}>‹ Cerrar</Text>
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Unirse</Text>
        <Text style={styles.title}>Tipeá el código</Text>
        <Text style={styles.description}>
          Pediselo a la persona con la que vas a intercambiar. Es de 6 caracteres y dura 10 minutos.
        </Text>
      </View>

      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>Código</Text>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(normalizeShortCode(v).slice(0, 6))}
          placeholder="ABC234"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={styles.codeInput}
          editable={!busy}
        />
        <Pressable
          onPress={() => tryJoin(code)}
          disabled={busy || !isValidShortCode(code)}
          style={({ pressed }) => [
            styles.submit,
            pressed && styles.pressed,
            (busy || !isValidShortCode(code)) && styles.disabled,
          ]}
        >
          {busy ? <ActivityIndicator color="#001A0A" /> : <Text style={styles.submitText}>Unirme</Text>}
        </Pressable>
      </View>

      <Pressable
        onPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
          else closeTradeModal();
        }}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Text style={styles.backText}>Volver</Text>
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
  topBar: {
    paddingBottom: spacing.sm,
  },
  backTopBtn: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backTopBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
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
  scanButton: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonText: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  codeBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  codeLabel: {
    color: colors.accent,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  codeInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 2,
    borderRadius: radii.md,
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitText: {
    color: '#001A0A',
    fontSize: 16,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  back: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  backText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
