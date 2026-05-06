import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Easing } from 'react-native';
import { useSyncStore } from '../store/syncStore';
import { colors, spacing, radii } from '../constants/theme';

const COPY: Record<string, { text: string; color: string }> = {
  pending: { text: '· Esperando…', color: colors.textMuted },
  saving: { text: '↑ Guardando…', color: colors.secondary },
  saved: { text: '✓ Guardado', color: colors.owned },
  error: { text: '⚠ Error', color: colors.danger },
};

export function SyncIndicator() {
  const status = useSyncStore((s) => s.status);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: status === 'idle' ? 0 : 1,
      duration: 200,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();
  }, [status, opacity]);

  if (status === 'idle') return null;
  const copy = COPY[status];
  if (!copy) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="none">
      <View style={styles.pill}>
        <Text style={[styles.text, { color: copy.color }]}>{copy.text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 100,
  },
  pill: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
