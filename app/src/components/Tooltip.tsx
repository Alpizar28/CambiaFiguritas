import { useEffect } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTutorialStore } from '../store/tutorialStore';
import { colors, radii, spacing } from '../constants/theme';

type Props = {
  id: string;
  title: string;
  message: string;
  position?: 'top' | 'bottom';
  // Si autoShow=true, intenta mostrar este tooltip si nadie más está activo.
  autoShow?: boolean;
};

export function Tooltip({ id, title, message, position = 'top', autoShow = true }: Props) {
  const completed = useTutorialStore((s) => s.completed[id]);
  const active = useTutorialStore((s) => s.active);
  const show = useTutorialStore((s) => s.show);
  const complete = useTutorialStore((s) => s.complete);
  const fade = new Animated.Value(0);

  useEffect(() => {
    if (!autoShow || completed || active) return;
    const t = setTimeout(() => show(id), 800);
    return () => clearTimeout(t);
  }, [autoShow, completed, active, id, show]);

  useEffect(() => {
    if (active === id) {
      Animated.timing(fade, {
        toValue: 1,
        duration: 250,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    }
  }, [active, id]);

  if (active !== id) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top' ? styles.top : styles.bottom,
        { opacity: fade },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Pressable style={styles.button} onPress={() => complete(id)}>
          <Text style={styles.buttonText}>Entendido</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 8000,
    alignItems: 'center',
  },
  top: {
    top: 100,
  },
  bottom: {
    bottom: 100,
  },
  card: {
    backgroundColor: '#FFD700',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    maxWidth: 380,
    width: '100%' as any,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  title: {
    color: '#0A0A0A',
    fontSize: 15,
    fontWeight: '800',
  },
  message: {
    color: '#0A0A0A',
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#0A0A0A',
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
  },
  buttonText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
  },
});
