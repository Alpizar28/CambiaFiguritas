import { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../services/firebase';
import { useUserStore } from '../../../store/userStore';
import { track } from '../../../services/analytics';
import { colors, radii, spacing } from '../../../constants/theme';
import { ENABLE_PREMIUM_UI } from '../../../constants/featureFlags';

type Props = {
  variant?: 'full' | 'compact';
};

const createTilopayCheckoutFn = httpsCallable<
  Record<string, never>,
  { checkoutUrl: string; orderId: string; stub?: boolean }
>(functions, 'createTilopayCheckout');

const devCompleteOrderFn = httpsCallable<
  { orderId: string },
  { granted: boolean; alreadyGranted: boolean }
>(functions, 'devCompleteOrder');

export function PremiumCard({ variant = 'full' }: Props) {
  const user = useUserStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [stubModal, setStubModal] = useState<{ orderId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!ENABLE_PREMIUM_UI) return null;
  if (user?.premium) return null;

  const isAndroid = Platform.OS === 'android';

  const handleUpgrade = async () => {
    if (loading) return;
    if (Platform.OS === 'android') {
      setError('Próximamente en Android. Por ahora podés hacerte Premium desde cambiafiguritas.online.');
      return;
    }
    setLoading(true);
    setError(null);
    track({ name: 'premium_checkout_started' });

    try {
      // Web (PWA / iOS) → TiloPay
      const result = await createTilopayCheckoutFn({});
      const { checkoutUrl, orderId, stub } = result.data;

      if (stub) {
        setStubModal({ orderId });
        return;
      }

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.location.href = checkoutUrl;
        }
      } else {
        await Linking.openURL(checkoutUrl);
      }
    } catch (e) {
      console.warn('[PremiumCard] checkout error', e);
      setError('No se pudo iniciar el pago. Probá de nuevo.');
      track({ name: 'premium_purchase_failed', params: { reason: 'checkout_error' } });
    } finally {
      setLoading(false);
    }
  };

  const confirmStubPayment = async () => {
    if (!stubModal) return;
    setLoading(true);
    try {
      const result = await devCompleteOrderFn({ orderId: stubModal.orderId });
      if (result.data.granted || result.data.alreadyGranted) {
        track({ name: 'premium_purchase_completed' });
      }
      setStubModal(null);
    } catch (e) {
      setError('No se pudo confirmar el pago de prueba');
      track({ name: 'premium_purchase_failed', params: { reason: 'stub_confirm_error' } });
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'compact') {
    return (
      <View style={styles.compactCard}>
        <View style={styles.compactInfo}>
          <Text style={styles.compactTitle}>✨ Hacete Premium</Text>
          <Text style={styles.compactSubtitle}>Matches ilimitados · Sin anuncios · USD 3.99</Text>
        </View>
        <TouchableOpacity
          style={[styles.compactBtn, isAndroid && styles.compactBtnDisabled]}
          onPress={handleUpgrade}
          disabled={loading || isAndroid}
        >
          {loading ? (
            <ActivityIndicator color="#0A0A0A" />
          ) : (
            <Text style={styles.compactBtnText}>{isAndroid ? 'Próximamente' : 'Comprar'}</Text>
          )}
        </TouchableOpacity>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <StubPaymentModal
          orderId={stubModal?.orderId ?? null}
          onConfirm={confirmStubPayment}
          onCancel={() => setStubModal(null)}
          loading={loading}
        />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Premium</Text>
      <Text style={styles.title}>Llevá tu álbum al siguiente nivel</Text>
      <View style={styles.benefits}>
        <Benefit icon="♾️" label="Matches ilimitados todos los días" />
        <Benefit icon="🎯" label="Mejores resultados (más candidatos)" />
        <Benefit icon="🚫" label="Sin banners de anuncios" />
        <Benefit icon="⭐" label="Estrella dorada en tu perfil" />
      </View>
      <TouchableOpacity
        style={[styles.upgradeBtn, isAndroid && styles.upgradeBtnDisabled]}
        onPress={handleUpgrade}
        disabled={loading || isAndroid}
      >
        {loading ? (
          <ActivityIndicator color="#0A0A0A" />
        ) : (
          <>
            <Text style={styles.upgradeBtnText}>{isAndroid ? 'Próximamente en Android' : 'Hacete Premium'}</Text>
            {!isAndroid ? <Text style={styles.upgradeBtnPrice}>USD 3.99 · pago único</Text> : null}
          </>
        )}
      </TouchableOpacity>
      <Text style={styles.fineprint}>
        {isAndroid
          ? 'Pronto vas a poder comprarlo desde Google Play. Por ahora, hacelo desde cambiafiguritas.online.'
          : 'Pago único de por vida del álbum. Sin renovaciones.'}
      </Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <StubPaymentModal
        orderId={stubModal?.orderId ?? null}
        onConfirm={confirmStubPayment}
        onCancel={() => setStubModal(null)}
        loading={loading}
      />
    </View>
  );
}

function Benefit({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.benefit}>
      <Text style={styles.benefitIcon}>{icon}</Text>
      <Text style={styles.benefitLabel}>{label}</Text>
    </View>
  );
}

function StubPaymentModal({
  orderId,
  onConfirm,
  onCancel,
  loading,
}: {
  orderId: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  if (!orderId) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Pago de prueba</Text>
          <Text style={styles.modalSubtitle}>
            TiloPay aún no está configurado. Confirmar simula un pago exitoso para probar la UX.
          </Text>
          <View style={styles.modalActions}>
            <TouchableOpacity onPress={onCancel} style={styles.modalCancel} disabled={loading}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={styles.modalConfirm} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={styles.modalConfirmText}>Confirmar pago de prueba</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: '#FFD700',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  eyebrow: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  benefits: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  benefitIcon: {
    fontSize: 20,
    width: 28,
  },
  benefitLabel: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  upgradeBtn: {
    backgroundColor: '#FFD700',
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  upgradeBtnDisabled: {
    opacity: 0.5,
  },
  upgradeBtnText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '800',
  },
  upgradeBtnPrice: {
    color: '#0A0A0A',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },
  fineprint: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // Compact variant (for MatchesScreen banner)
  compactCard: {
    backgroundColor: colors.surface,
    borderColor: '#FFD700',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  compactSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  compactBtn: {
    backgroundColor: '#FFD700',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 80,
    alignItems: 'center',
  },
  compactBtnDisabled: {
    opacity: 0.5,
  },
  compactBtnText: {
    color: '#0A0A0A',
    fontSize: 13,
    fontWeight: '800',
  },
  // Modal stub
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    maxWidth: 400,
    width: '100%' as `${number}%`,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalCancel: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirm: {
    flex: 1,
    backgroundColor: '#FFD700',
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radii.md,
  },
  modalConfirmText: {
    color: '#0A0A0A',
    fontSize: 14,
    fontWeight: '800',
  },
});
