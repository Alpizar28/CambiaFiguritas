import 'react-native-gesture-handler';

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from './src/services/firebase';
import { getOrCreateUser, subscribeUserDoc } from './src/services/userService';
import { loadUserAlbum } from './src/services/albumSyncService';
import { identify, track } from './src/services/analytics';
import { initWebVitals } from './src/services/webVitals';
import { initSentry } from './src/services/sentry';
import { initPushNotifications } from './src/services/pushNotifications';
import { useUserStore } from './src/store/userStore';
import { useAlbumStore } from './src/store/albumStore';
import { useOnboardingStore } from './src/store/onboardingStore';
import { useWishlistStore } from './src/store/wishlistStore';
import { useLandingStore } from './src/store/landingStore';
import { LandingScreen } from './src/features/landing/LandingScreen';
import { useAlbumSync } from './src/hooks/useAlbumSync';
import { AppNavigator } from './src/app/AppNavigator';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { OnboardingScreen } from './src/features/onboarding/OnboardingScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SyncIndicator } from './src/components/SyncIndicator';
import { InstallPrompt } from './src/components/InstallPrompt';
import { DemoBanner } from './src/features/demo/DemoBanner';
import { buildDemoStatuses } from './src/features/demo/demoSampleData';
import { colors } from './src/constants/theme';

function AppWithSync() {
  useAlbumSync();
  return (
    <>
      <AppNavigator />
      <SyncIndicator />
      <InstallPrompt />
    </>
  );
}

function DemoApp({ onExit }: { onExit: () => void }) {
  return (
    <>
      <AppNavigator />
      <DemoBanner onLoginRequest={onExit} />
      <InstallPrompt />
    </>
  );
}

export default function App() {
  const { user, loading, setUser, setLoading } = useUserStore();
  const demoMode = useUserStore((s) => s.demoMode);
  const exitDemo = useUserStore((s) => s.exitDemo);
  const loadState = useAlbumStore((s) => s.loadState);
  const resetAlbum = useAlbumStore((s) => s.resetAlbum);
  const hasLocalData = useAlbumStore((s) => s.hasLocalData);
  const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);
  const loadWishlist = useWishlistStore((s) => s.load);
  const resetWishlist = useWishlistStore((s) => s.reset);
  const landingSeen = useLandingStore((s) => s.seen);
  const markLandingSeen = useLandingStore((s) => s.markSeen);

  useEffect(() => {
    initWebVitals();
    initSentry();
  }, []);

  useEffect(() => {
    if (!demoMode) return;
    const sample = buildDemoStatuses();
    loadState(sample.statuses, sample.repeatedCounts);
  }, [demoMode, loadState]);

  // Live subscription al user doc: premium=true escrito por webhook (TiloPay/Play)
  // se propaga a la UI sin reload.
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeUserDoc(user.uid, (updated) => {
      if (updated) setUser(updated);
    });
    return unsub;
  }, [user?.uid, setUser]);

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
          if (albumSnapshot?.wishlist) {
            loadWishlist(albumSnapshot.wishlist);
          }
          setUser(appUser);
          // Diferido para no bloquear render. Pide permiso push 4s después del login.
          setTimeout(() => initPushNotifications(appUser.uid), 4000);
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
        resetWishlist();
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

  const handleExitDemo = () => {
    exitDemo();
    resetAlbum();
  };

  const handleLandingContinue = () => {
    markLandingSeen();
  };

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        {user
          ? hasCompletedOnboarding
            ? <AppWithSync />
            : <OnboardingScreen />
          : demoMode
            ? <DemoApp onExit={handleExitDemo} />
            : !landingSeen
              ? <LandingScreen onContinueToLogin={handleLandingContinue} />
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
