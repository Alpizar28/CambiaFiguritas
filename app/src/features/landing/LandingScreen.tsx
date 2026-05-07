import { useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/userStore';
import { useLandingStore } from '../../store/landingStore';
import { track } from '../../services/analytics';
import { colors, radii, spacing } from '../../constants/theme';

type Props = {
  onContinueToLogin: () => void;
};

const STEPS = [
  {
    icon: '📋',
    title: 'Marcá tu álbum',
    body: 'Tocá las figuritas que ya tenés y las que te faltan. Doble tap marca repes.',
  },
  {
    icon: '🤝',
    title: 'Encontrá matches',
    body: 'Te conectamos con usuarios que tienen lo que necesitás y necesitan tus repes.',
  },
  {
    icon: '💬',
    title: 'Coordiná por WhatsApp',
    body: 'Mensaje pre-armado con códigos de figuritas. Cero fricción para coordinar.',
  },
];

const FEATURES = [
  '🔍 Búsqueda por código (ARG12)',
  '⭐ Marcá prioridades para mejores matches',
  '📍 Ordenado por cercanía',
  '👍 Reputación de usuarios',
  '📤 Compartí tu progreso como imagen',
  '📱 Funciona offline en tu celular',
];

export function LandingScreen({ onContinueToLogin }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const enterDemo = useUserStore((s) => s.enterDemo);
  const markLandingSeen = useLandingStore((s) => s.markSeen);

  useEffect(() => {
    track({ name: 'landing_viewed' });
  }, []);

  const handleStart = () => {
    track({ name: 'landing_cta_clicked', params: { cta: 'start' } });
    onContinueToLogin();
  };

  const handleDemo = () => {
    track({ name: 'landing_cta_clicked', params: { cta: 'demo' } });
    markLandingSeen();
    enterDemo();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrow}>Mundial 2026</Text>
        </View>
        <Text style={styles.heroTitle}>
          Completá tu álbum,{'\n'}
          <Text style={styles.heroAccent}>encontrá tus matches.</Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          La forma inteligente de intercambiar figuritas con coleccionistas reales cerca tuyo.
        </Text>

        <View style={[styles.ctaRow, !isWide && styles.ctaColumn]}>
          <Pressable style={styles.primaryButton} onPress={handleStart}>
            <Text style={styles.primaryButtonText}>Empezar gratis</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleDemo}>
            <Text style={styles.secondaryButtonText}>Ver demo →</Text>
          </Pressable>
        </View>

        <Text style={styles.heroFootnote}>Sin tarjeta · 669 figuritas oficiales</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>Cómo funciona</Text>
        <Text style={styles.sectionTitle}>Tres pasos.{'\n'}Cero fricción.</Text>
        <View style={[styles.stepsRow, !isWide && styles.stepsColumn]}>
          {STEPS.map((step, idx) => (
            <View key={step.title} style={[styles.stepCard, isWide && styles.stepCardWide]}>
              <Text style={styles.stepNumber}>{String(idx + 1).padStart(2, '0')}</Text>
              <Text style={styles.stepIcon}>{step.icon}</Text>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.featuresBlock}>
        <Text style={styles.featuresTitle}>Todo lo que necesitás</Text>
        <View style={styles.featuresGrid}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureChip}>
              <Text style={styles.featureChipText}>{f}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.finalCta}>
        <Text style={styles.finalCtaTitle}>Listo para empezar</Text>
        <Text style={styles.finalCtaBody}>
          Sumate gratis. Tu álbum sincroniza entre todos tus dispositivos.
        </Text>
        <Pressable style={styles.primaryButton} onPress={handleStart}>
          <Text style={styles.primaryButtonText}>Crear mi álbum</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>
        Hecho por fanáticos del fútbol. CambiaFiguritas no está afiliado a Panini ni a la FIFA.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  hero: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'flex-start',
    gap: spacing.md,
    maxWidth: 800,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,215,0,0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD700',
  },
  eyebrow: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '900',
    lineHeight: 46,
    letterSpacing: -1,
  },
  heroAccent: {
    color: '#FFD700',
  },
  heroSubtitle: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 24,
    maxWidth: 460,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  ctaColumn: {
    flexDirection: 'column',
    alignSelf: 'stretch',
  },
  primaryButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.md,
    alignItems: 'center',
    minWidth: 180,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 180,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  heroFootnote: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  sectionEyebrow: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepsColumn: {
    flexDirection: 'column',
  },
  stepCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    minHeight: 180,
  },
  stepCardWide: {
    flexBasis: '32%',
  },
  stepNumber: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
  stepIcon: {
    fontSize: 36,
  },
  stepTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  stepBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  featuresBlock: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featuresTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  featureChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  finalCta: {
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.25)',
    alignItems: 'flex-start',
  },
  finalCtaTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  finalCtaBody: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    fontStyle: 'italic',
  },
});
