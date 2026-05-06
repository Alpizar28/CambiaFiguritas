import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Easing } from 'react-native';
import type { ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height = 16, borderRadius = radii.sm, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 800, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, easing: Easing.ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function MatchCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Skeleton width={44} height={44} borderRadius={22} />
        <View style={styles.col}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={60} height={40} borderRadius={radii.sm} />
      </View>
      <View style={[styles.row, { marginTop: spacing.sm }]}>
        <Skeleton width={90} height={26} borderRadius={radii.sm} />
        <Skeleton width={90} height={26} borderRadius={radii.sm} style={{ marginLeft: spacing.sm }} />
      </View>
    </View>
  );
}

export function EventCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={120} height={22} borderRadius={radii.sm} />
      <Skeleton width="80%" height={18} style={{ marginTop: spacing.sm }} />
      <Skeleton width="100%" height={14} style={{ marginTop: spacing.xs }} />
      <Skeleton width="60%" height={14} style={{ marginTop: 4 }} />
      <Skeleton width="100%" height={36} borderRadius={radii.sm} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  col: {
    flex: 1,
    marginLeft: spacing.sm,
  },
});
