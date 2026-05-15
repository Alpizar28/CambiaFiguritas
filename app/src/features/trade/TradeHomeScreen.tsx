import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { shareTradeCard } from '../../utils/shareTradeCard';
import { buildRepeatedShareText } from './utils/listCompare';
import { useAlbumStore } from '../../store/albumStore';
import { allStickers } from '../album/data/albumCatalog';

import { useUserStore } from '../../store/userStore';
import { useTradeStore } from '../../store/tradeStore';
import { createSession, findActiveSessionForUser, TradeError } from '../../services/tradeSessionService';
import { track } from '../../services/analytics';
import { colors, radii, spacing } from '../../constants/theme';
import type { TradeStackParamList } from '../../types/navigation';
import { QRScanner } from './components/QRScanner';

type Step = 'root' | 'intercambiar' | 'presencial';

type OptionCard = {
  icon: string;
  title: string;
  sub: string;
  onPress: () => void;
  primary?: boolean;
  badge?: string;
};

function StepOptions({ options }: { options: OptionCard[] }) {
  return (
    <View style={styles.options}>
      {options.map((opt) => (
        <Pressable
          key={opt.title}
          onPress={opt.onPress}
          style={({ pressed }) => [
            styles.card,
            opt.primary && styles.cardPrimary,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>{opt.icon}</Text>
            {opt.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{opt.badge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.cardTitle, opt.primary && styles.cardTitlePrimary]}>{opt.title}</Text>
          <Text style={[styles.cardSub, opt.primary && styles.cardSubPrimary]}>{opt.sub}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function TradeHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<TradeStackParamList>>();
  const user = useUserStore((s) => s.user);
  const demoMode = useUserStore((s) => s.demoMode);
  const closeTradeModal = useTradeStore((s) => s.closeModal);
  const statuses = useAlbumStore((s) => s.statuses);
  const [step, setStep] = useState<Step>('root');
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleBack = useCallback(() => {
    if (step === 'presencial') { setStep('intercambiar'); return; }
    if (step === 'intercambiar') { setStep('root'); return; }
    closeTradeModal();
  }, [step, closeTradeModal]);

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

  const handleShareLink = useCallback(() => {
    if (!user || demoMode) {
      Alert.alert('Iniciá sesión', 'Necesitás una cuenta para generar un link de intercambio.');
      return;
    }
    navigation.navigate('TradeShare');
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

  const handleShareRepeated = useCallback(() => {
    const repeatedCodes = allStickers
      .filter((s) => statuses[s.id] === 'repeated')
      .map((s) => s.displayCode);
    const text = buildRepeatedShareText(statuses);
    shareTradeCard(repeatedCodes, text);
  }, [statuses]);

  const stepMeta: Record<Step, { eyebrow: string; question: string }> = {
    root: { eyebrow: 'Intercambio', question: '¿Qué querés hacer?' },
    intercambiar: { eyebrow: 'Intercambiar', question: '¿La otra persona tiene la app?' },
    presencial: { eyebrow: 'Con la app', question: '¿Cómo te conectás?' },
  };

  const rootOptions: OptionCard[] = [
    {
      icon: '📋',
      title: 'Ver qué me sirve',
      sub: 'Pegá la lista de otro coleccionista y ves cuáles te faltan.',
      onPress: () => navigation.navigate('TradeListCompare'),
    },
    {
      icon: '🔄',
      title: 'Intercambiar figus',
      sub: 'Acordá un cambio con alguien y actualizá tu álbum.',
      onPress: () => setStep('intercambiar'),
      primary: true,
    },
    {
      icon: '📤',
      title: 'Compartir mis repes',
      sub: 'Mandá tu lista de repetidas por WhatsApp.',
      onPress: handleShareRepeated,
    },
  ];

  const intercambiarOptions: OptionCard[] = [
    {
      icon: '📱',
      title: 'No tiene la app',
      sub: 'Le mandás un link. Pega su lista y ves el match sin instalar nada.',
      onPress: handleShareLink,
      badge: 'NUEVO',
    },
    {
      icon: '👥',
      title: 'Los dos tienen la app',
      sub: 'Intercambio presencial, cara a cara con QR o código.',
      onPress: () => setStep('presencial'),
      primary: true,
    },
  ];

  const presencialOptions: OptionCard[] = [
    {
      icon: '➕',
      title: 'Crear sesión',
      sub: 'Mostrás un QR para que el otro escanee.',
      onPress: handleCreate,
      primary: true,
    },
    {
      icon: '📷',
      title: 'Escanear QR',
      sub: 'Apuntás al QR del otro coleccionista.',
      onPress: handleScan,
    },
    {
      icon: '🔢',
      title: 'Tengo un código',
      sub: 'Ingresás el código de 6 caracteres.',
      onPress: handleJoin,
    },
  ];

  const currentOptions =
    step === 'root' ? rootOptions :
    step === 'intercambiar' ? intercambiarOptions :
    presencialOptions;

  const meta = stepMeta[step];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          hitSlop={10}
        >
          <Text style={styles.backBtnText}>‹ Volver</Text>
        </Pressable>

        {step !== 'root' && (
          <View style={styles.breadcrumb}>
            <Text style={styles.breadcrumbText}>
              {step === 'intercambiar' ? 'Intercambio' : 'Intercambio · Con la app'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>{meta.eyebrow}</Text>
        <Text style={styles.question}>{meta.question}</Text>
      </View>

      {busy && step === 'presencial' ? (
        <View style={styles.busyWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <StepOptions options={currentOptions} />
      )}

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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  backBtn: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
  },
  backBtnText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  breadcrumb: {
    flex: 1,
  },
  breadcrumbText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  question: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  options: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  cardPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardIcon: {
    fontSize: 24,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  badgeText: {
    color: '#001A0A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  cardTitlePrimary: {
    color: '#001A0A',
  },
  cardSub: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 4,
  },
  cardSubPrimary: {
    color: '#0A2E1A',
  },
  pressed: {
    opacity: 0.82,
  },
  busyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl * 2,
  },
});
