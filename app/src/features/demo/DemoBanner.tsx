import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useUserStore } from '../../store/userStore';
import { setDemoWriteHandler } from '../../store/albumStore';
import { track } from '../../services/analytics';
import { colors, radii, spacing } from '../../constants/theme';

type Props = {
  onLoginRequest: () => void;
};

export function DemoBanner({ onLoginRequest }: Props) {
  const demoMode = useUserStore((s) => s.demoMode);
  const [toastVisible, setToastVisible] = useState(false);
  const fade = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (!demoMode) {
      setDemoWriteHandler(null);
      return;
    }
    setDemoWriteHandler(() => {
      setToastVisible(true);
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
        Animated.delay(2000),
        Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
      ]).start(() => setToastVisible(false));
    });
    return () => setDemoWriteHandler(null);
  }, [demoMode, fade]);

  if (!demoMode) return null;

  const handleLogin = () => {
    track({ name: 'demo_login_clicked' });
    onLoginRequest();
  };

  return (
    <>
      <View style={styles.banner} pointerEvents="box-none">
        <Text style={styles.bannerText} numberOfLines={2}>
          Estás en modo demo · iniciá sesión para guardar tu álbum
        </Text>
        <Pressable style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Iniciar sesión</Text>
        </Pressable>
      </View>
      {toastVisible ? (
        <Animated.View style={[styles.toast, { opacity: fade }]} pointerEvents="none">
          <Text style={styles.toastText}>🔒 Iniciá sesión para marcar figuritas</Text>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFD700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    paddingTop: spacing.md + 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 9000,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  bannerText: {
    color: '#0A0A0A',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  loginButton: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  loginButtonText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '800',
  },
  toast: {
    position: 'absolute',
    top: '50%',
    left: '10%',
    right: '10%',
    backgroundColor: 'rgba(10,10,10,0.95)',
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  toastText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
  },
});
