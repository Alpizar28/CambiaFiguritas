import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radii } from '../constants/theme';
import { captureError } from '../services/sentry';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, info);
    }
    captureError(error, { componentStack: info.componentStack });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.message}>
            La app encontró un error inesperado. Tocá el botón para reintentar.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.errorDetails}>{this.state.error.message}</Text>
          )}
          <TouchableOpacity style={styles.button} onPress={this.reset}>
            <Text style={styles.buttonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  message: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  errorDetails: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  buttonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 15,
  },
});
