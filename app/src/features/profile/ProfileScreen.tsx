import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useUserStore } from '../../store/userStore';
import { useAlbumStore } from '../../store/albumStore';
import { colors, spacing, radii } from '../../constants/theme';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);
  const getStats = useAlbumStore((s) => s.getStats);
  const { owned, repeated, missing, total } = getStats();

  const handleLogout = () => signOut(auth);

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

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesion</Text>
      </TouchableOpacity>
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
  logoutButton: {
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 15,
  },
});
