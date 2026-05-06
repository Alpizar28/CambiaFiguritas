import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { GoogleAuthProvider, signInWithPopup, signInWithCredential } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { colors, spacing, radii } from '../../constants/theme';

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = '1058576446766-r6ktjd5ptkg0h44trgc0a2lbab3001r8.apps.googleusercontent.com';

const redirectUri = makeRedirectUri({ scheme: 'cambiafiguritas' });

export function LoginScreen() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: WEB_CLIENT_ID,
    redirectUri,
  });

  // Solo usado en nativo
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (response?.type === 'success') {
      const { id_token } = response.params;
      if (!id_token) {
        setError('No se recibió token. Intentá de nuevo.');
        setSigningIn(false);
        return;
      }
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch((e) => {
        setError('Error al iniciar sesión. Intentá de nuevo.');
        setSigningIn(false);
        console.error(e);
      });
    } else if (response?.type === 'error') {
      setError('Error en autenticación con Google.');
      setSigningIn(false);
    }
  }, [response]);

  const handlePress = async () => {
    setError(null);
    setSigningIn(true);

    if (Platform.OS === 'web') {
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        // onAuthStateChanged en App.tsx maneja el resto
      } catch (e: any) {
        if (e?.code !== 'auth/popup-closed-by-user') {
          setError('Error al iniciar sesión. Intentá de nuevo.');
        }
        setSigningIn(false);
      }
    } else {
      promptAsync();
    }
  };

  const busy = signingIn || (Platform.OS !== 'web' && !request);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.flag}>⚽</Text>
        <Text style={styles.title}>Album Mundial 2026</Text>
        <Text style={styles.subtitle}>
          Gestioná tu album, encontrá intercambios y descubrí eventos cerca tuyo.
        </Text>
      </View>

      <View style={styles.actions}>
        {error && <Text style={styles.errorText}>{error}</Text>}
        <TouchableOpacity
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={handlePress}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>Continuar con Google</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  flag: {
    fontSize: 72,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  actions: {
    gap: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
});
