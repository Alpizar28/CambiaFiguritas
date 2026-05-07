import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, radii } from '../../constants/theme';
import { useOnboardingStore } from '../../store/onboardingStore';
import { track } from '../../services/analytics';
import { haptic } from '../../utils/haptics';

type Slide = {
  emoji: string;
  title: string;
  description: string;
  accent: string;
};

const SLIDES: Slide[] = [
  {
    emoji: '📒',
    title: 'Marcá tus figuritas',
    description: 'Tocá una figurita para marcarla como obtenida. Doble tap para repetida. Mantené presionado para más opciones.',
    accent: colors.owned,
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
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

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

  const handleNext = () => {
    haptic.tap();
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setCurrentIndex(next);
    } else {
      track({ name: 'onboarding_completed' });
      completeOnboarding();
    }
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
    </View>
  );
}

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
