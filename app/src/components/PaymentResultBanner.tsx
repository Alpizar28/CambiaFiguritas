import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePaymentResultStore } from '../store/paymentResultStore';

const COPY = {
  success: {
    title: '¡Pago recibido!',
    subtitle: 'Tu Premium se activa en segundos.',
    bg: '#16A34A',
  },
  failed: {
    title: 'Pago no completado',
    subtitle: 'No pudimos procesar el pago. Probá de nuevo.',
    bg: '#DC2626',
  },
} as const;

export function PaymentResultBanner() {
  const insets = useSafeAreaInsets();
  const kind = usePaymentResultStore((s) => s.kind);
  const dismiss = usePaymentResultStore((s) => s.dismiss);

  if (Platform.OS !== 'web') return null;
  if (!kind) return null;

  const { title, subtitle, bg } = COPY[kind];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bg, paddingTop: insets.top + 12 },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.row}>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Pressable onPress={dismiss} hitSlop={12} style={styles.closeBtn}>
          <Text style={styles.closeTxt}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.9,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  closeTxt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
