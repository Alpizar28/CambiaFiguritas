import 'react-native-gesture-handler';

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from './src/services/firebase';
import { getOrCreateUser } from './src/services/userService';
import { loadUserAlbum } from './src/services/albumSyncService';
import { identify, track } from './src/services/analytics';
import { useUserStore } from './src/store/userStore';
import { useAlbumStore } from './src/store/albumStore';
import { useOnboardingStore } from './src/store/onboardingStore';
import { useAlbumSync } from './src/hooks/useAlbumSync';
import { AppNavigator } from './src/app/AppNavigator';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { OnboardingScreen } from './src/features/onboarding/OnboardingScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SyncIndicator } from './src/components/SyncIndicator';
import { colors } from './src/constants/theme';

function AppWithSync() {
  useAlbumSync();
  return (
    <>
      <AppNavigator />
      <SyncIndicator />
    </>
  );
}

export default function App() {
  const { user, loading, setUser, setLoading } = useUserStore();
  const loadState = useAlbumStore((s) => s.loadState);
  const resetAlbum = useAlbumStore((s) => s.resetAlbum);
  const hasLocalData = useAlbumStore((s) => s.hasLocalData);
  const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        identify(firebaseUser.uid);
        track({ name: 'login_completed', params: { method: 'google' } });
        try {
          // Esperar rehidratación de AsyncStorage antes de decidir.
          if (!useAlbumStore.persist.hasHydrated()) {
            await new Promise<void>((resolve) => {
              const unsubHydrate = useAlbumStore.persist.onFinishHydration(() => {
                unsubHydrate();
                resolve();
              });
            });
          }
          const [appUser, albumSnapshot] = await Promise.all([
            getOrCreateUser(
              firebaseUser.uid,
              firebaseUser.displayName ?? '',
              firebaseUser.email ?? '',
              firebaseUser.photoURL,
            ),
            loadUserAlbum(firebaseUser.uid),
          ]);
          // Local persiste siempre. Firestore solo hidrata si local vacio (primera vez en este device).
          if (albumSnapshot && !hasLocalData()) {
            loadState(albumSnapshot.statuses, albumSnapshot.repeatedCounts);
          }
          setUser(appUser);
        } catch {
          // Firestore offline: entrar con datos del token y album en blanco
          setUser({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName ?? '',
            email: firebaseUser.email ?? '',
            photoUrl: firebaseUser.photoURL,
            city: '',
            premium: false,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        track({ name: 'logout' });
        identify(null);
        resetAlbum();
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        {user
          ? hasCompletedOnboarding
            ? <AppWithSync />
            : <OnboardingScreen />
          : <LoginScreen />}
        <StatusBar style="light" />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
