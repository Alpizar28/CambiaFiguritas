import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../constants/theme';

const STORAGE_KEY = 'install-prompt-dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  return (
    win.matchMedia?.('(display-mode: standalone)')?.matches ||
    win.navigator?.standalone === true
  );
}

function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSTip, setShowIOSTip] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (isStandalone()) return;

    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') {
        setDismissed(true);
        return;
      }
    } catch {}

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (isIOSSafari()) {
      const t = setTimeout(() => setShowIOSTip(true), 4000);
      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        clearTimeout(t);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (Platform.OS !== 'web') return null;
  if (dismissed) return null;
  if (!deferred && !showIOSTip) return null;

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      handleDismiss();
    }
    setDeferred(null);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setDismissed(true);
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.card}>
        {deferred ? (
          <>
            <Text style={styles.title}>📱 Instalá la app</Text>
            <Text style={styles.body}>
              Tenela en tu pantalla de inicio para acceso rápido y modo pantalla completa.
            </Text>
            <View style={styles.row}>
              <Pressable onPress={handleDismiss} style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnGhostText}>Ahora no</Text>
              </Pressable>
              <Pressable onPress={handleInstall} style={[styles.btn, styles.btnPrimary]}>
                <Text style={styles.btnPrimaryText}>Instalar</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.title}>📱 Agregá a inicio</Text>
            <Text style={styles.body}>
              En Safari: tocá el botón Compartir{' '}
              <Text style={styles.icon}>⎙</Text> y luego{' '}
              <Text style={styles.bold}>"Agregar a pantalla de inicio"</Text>.
            </Text>
            <View style={styles.row}>
              <Pressable onPress={handleDismiss} style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnGhostText}>Cerrar</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    zIndex: 9999,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%' as any,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  bold: {
    color: colors.text,
    fontWeight: '700',
  },
  icon: {
    color: colors.accent,
    fontWeight: '900',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  btn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnPrimaryText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 14,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGhostText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
});
