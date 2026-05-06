import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../constants/theme';

type ScreenShellProps = PropsWithChildren<{
  title: string;
  eyebrow: string;
  description: string;
}>;

export function ScreenShell({
  title,
  eyebrow,
  description,
  children,
}: ScreenShellProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  header: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
});
