import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, radii } from '../../constants/theme';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useUserStore } from '../../store/userStore';
import { track } from '../../services/analytics';
import { haptic } from '../../utils/haptics';
import { shareInviteWithRef } from '../../utils/share';
import { ImportAlbumModal } from '../album/components/ImportAlbumModal';

type Slide = {
  emoji: string;
  title: string;
  description: string;
  accent: string;
  secondaryCta?: string;
  secondaryAction?: 'import';
};

const SLIDES: Slide[] = [
  {
    emoji: '📒',
    title: 'Marcá tus figuritas',
    description: 'Tocá una figurita para marcarla como obtenida. Doble tap para repetida. Mantené presionado para más opciones.',
    accent: colors.owned,
  },
  {
    emoji: '📥',
    title: 'Importá tu lista',
    description: '¿Ya tenés tu colección anotada en otra app o en notas? Pegá la lista y marcamos todo de una.',
    accent: colors.accent,
    secondaryCta: 'Importar ahora',
    secondaryAction: 'import',
  },
  {
    emoji: '🤝',
    title: 'Encontrá matches',
    description: 'La app cruza tus repetidas con lo que les falta a otros usuarios cerca tuyo. Cuanto más completés, mejores matches.',
    accent: colors.repeated,
  },
  {
    emoji: '💬',
    title: 'Coordiná intercambios',
    description: 'Agregá tu WhatsApp en Perfil para que otros puedan contactarte cuando haya match.',
    accent: colors.accent,
  },
  {
    emoji: '📍',
    title: 'Eventos cerca tuyo',
    description: 'Mirá ferias y meetups en el mapa. Creá tu propio evento si organizás un intercambio.',
    accent: colors.special,
  },
];

export function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const uid = useUserStore((s) => s.user?.uid);
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    track({ name: 'onboarding_started' });
  }, []);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const handleSkip = () => {
    haptic.tap();
    track({ name: 'onboarding_skipped', params: { atSlide: currentIndex } });
    completeOnboarding();
  };

  const finishOnboarding = () => {
    track({ name: 'onboarding_completed' });
    completeOnboarding();
    track({ name: 'onboarding_invite_shown' });
    setShowInviteSheet(true);
  };

  const handleNext = () => {
    haptic.tap();
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setCurrentIndex(next);
    } else {
      finishOnboarding();
    }
  };

  const handleInvite = () => {
    track({ name: 'onboarding_invite_clicked' });
    shareInviteWithRef(uid ?? '');
    setShowInviteSheet(false);
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Modal visible={showInviteSheet} transparent animationType="slide" onRequestClose={() => setShowInviteSheet(false)}>
        <Pressable style={inviteStyles.backdrop} onPress={() => setShowInviteSheet(false)} />
        <View style={[inviteStyles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={inviteStyles.handle} />
          <Text style={inviteStyles.emoji}>🤝</Text>
          <Text style={inviteStyles.title}>Más amigos = más matches</Text>
          <Text style={inviteStyles.body}>
            Invitá a tus amigos con tu álbum para encontrar más intercambios cerca tuyo.
          </Text>
          <TouchableOpacity style={inviteStyles.primaryBtn} onPress={handleInvite}>
            <Text style={inviteStyles.primaryBtnText}>Invitar amigos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={inviteStyles.secondaryBtn} onPress={() => setShowInviteSheet(false)}>
            <Text style={inviteStyles.secondaryBtnText}>Ahora no</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <View style={styles.topBar}>
        {!isLast && (
          <Pressable onPress={handleSkip} hitSlop={12} style={styles.skipButton}>
            <Text style={styles.skipText}>Saltar</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScroll}
        style={styles.scroller}
      >
        {SLIDES.map((slide, index) => (
          <View key={index} style={[styles.slide, { width }]}>
            <View style={[styles.emojiCircle, { borderColor: slide.accent }]}>
              <Text style={styles.emoji}>{slide.emoji}</Text>
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
            {slide.secondaryAction === 'import' && slide.secondaryCta ? (
              <Pressable
                onPress={() => {
                  haptic.tap();
                  track({ name: 'album_import_opened', params: { source: 'profile' } });
                  setImportOpen(true);
                }}
                style={[styles.slideCta, { borderColor: slide.accent }]}
              >
                <Text style={[styles.slideCtaText, { color: slide.accent }]}>{slide.secondaryCta}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex && styles.dotActive,
              index === currentIndex && { backgroundColor: SLIDES[currentIndex].accent },
            ]}
          />
        ))}
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          onPress={handleNext}
          style={[styles.cta, { backgroundColor: SLIDES[currentIndex].accent }]}
        >
          <Text style={styles.ctaText}>{isLast ? 'Empezar' : 'Siguiente'}</Text>
        </Pressable>
      </View>

      <ImportAlbumModal visible={importOpen} onClose={() => setImportOpen(false)} source="profile" />
    </View>
  );
}

const inviteStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    width: '100%' as any,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.background,
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    height: 44,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  skipButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  skipText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  scroller: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  emojiCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emoji: {
    fontSize: 72,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 340,
  },
  slideCta: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
    borderWidth: 2,
  },
  slideCtaText: {
    fontSize: 15,
    fontWeight: '800',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
  },
  bottomBar: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  cta: {
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  ctaText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
});
