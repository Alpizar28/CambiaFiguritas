import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useUserStore } from '../../store/userStore';
import { useAlbumStore } from '../../store/albumStore';
import { deleteCurrentAccount } from '../../services/accountService';
import { showAdsPrivacyOptions } from '../../services/adsConsent';
import { LegalModal } from './LegalModal';
import { LEGAL_VERSION, PRIVACY_TEXT, TERMS_TEXT } from './legalContent';
import { colors, spacing, radii } from '../../constants/theme';

type LegalView = null | 'privacy' | 'terms';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);
  const getStats = useAlbumStore((s) => s.getStats);
  const { owned, repeated, missing, total } = getStats();
  const [legalView, setLegalView] = useState<LegalView>(null);
  const [deleting, setDeleting] = useState(false);

  const handleLogout = () => signOut(auth);

  const handleDelete = () => {
    confirm(
      'Eliminar cuenta',
      'Esto borra tu álbum, eventos creados y tu cuenta. No se puede deshacer.',
      async () => {
        setDeleting(true);
        const result = await deleteCurrentAccount();
        setDeleting(false);
        if (result.ok) {
          notify('Cuenta eliminada', 'Listo. Volvés a la pantalla de inicio.');
        } else if (result.reason === 'requires-recent-login') {
          notify('Necesitás reloguearte', result.message);
          await signOut(auth);
        } else {
          notify('Error', result.message);
        }
      },
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        {user?.photoUrl ? (
          <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{user?.name?.[0] ?? '?'}</Text>
          </View>
        )}
        <Text style={styles.name}>{user?.name ?? ''}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>
      </View>

      <View style={styles.stats}>
        <StatBox label="Obtenidas" value={owned} color={colors.owned} />
        <StatBox label="Repetidas" value={repeated} color={colors.repeated} />
        <StatBox label="Faltantes" value={missing} color={colors.textMuted} />
        <StatBox label="Total" value={total} color={colors.text} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacidad</Text>
        <RowButton label="Política de Privacidad" onPress={() => setLegalView('privacy')} />
        <RowButton label="Términos de uso" onPress={() => setLegalView('terms')} />
        {Platform.OS !== 'web' ? (
          <RowButton
            label="Configurar publicidad"
            onPress={() => {
              showAdsPrivacyOptions().catch(() => {});
            }}
          />
        ) : null}
        <Text style={styles.versionText}>Versión: {LEGAL_VERSION}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cuenta</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dangerButton, deleting && styles.disabled]}
          onPress={handleDelete}
          disabled={deleting}
        >
          <Text style={styles.dangerText}>{deleting ? 'Eliminando…' : 'Eliminar mi cuenta'}</Text>
        </TouchableOpacity>
      </View>

      <LegalModal
        visible={legalView === 'privacy'}
        title="Política de Privacidad"
        body={PRIVACY_TEXT}
        onClose={() => setLegalView(null)}
      />
      <LegalModal
        visible={legalView === 'terms'}
        title="Términos de uso"
        body={TERMS_TEXT}
        onClose={() => setLegalView(null)}
      />
    </ScrollView>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RowButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowChevron}>›</Text>
    </TouchableOpacity>
  );
}

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Eliminar', style: 'destructive', onPress: onConfirm },
  ]);
}

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarFallback: {
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '700',
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  email: {
    color: colors.textMuted,
    fontSize: 14,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statBox: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowChevron: {
    color: colors.textMuted,
    fontSize: 22,
  },
  versionText: {
    color: colors.textMuted,
    fontSize: 9,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  logoutButton: {
    borderColor: colors.textMuted,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  dangerButton: {
    backgroundColor: colors.danger,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  dangerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
});
