import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { updateUser } from '../../services/userService';
import { useUserStore } from '../../store/userStore';
import { useAlbumStore } from '../../store/albumStore';
import { colors, spacing, radii } from '../../constants/theme';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const getStats = useAlbumStore((s) => s.getStats);
  const { owned, repeated, missing, total } = getStats();

  const [whatsapp, setWhatsapp] = useState(user?.whatsapp ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleLogout = () => signOut(auth);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateUser(user.uid, { whatsapp, city });
      setUser({ ...user, whatsapp, city });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      Alert.alert('Error', 'No se pudo guardar. Verificá tu conexión.');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = whatsapp !== (user?.whatsapp ?? '') || city !== (user?.city ?? '');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
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

      <View style={styles.editSection}>
        <Text style={styles.editTitle}>Datos de contacto</Text>
        <Text style={styles.editHint}>
          Tu WhatsApp aparece cuando alguien encuentra un match con vos.
        </Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>WhatsApp</Text>
          <TextInput
            style={styles.fieldInput}
            value={whatsapp}
            onChangeText={setWhatsapp}
            placeholder="+54911..."
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            autoCorrect={false}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Ciudad</Text>
          <TextInput
            style={styles.fieldInput}
            value={city}
            onChangeText={setCity}
            placeholder="Buenos Aires"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (!isDirty || saving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!isDirty || saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.saveButtonText}>
              {saved ? '✓ Guardado' : 'Guardar cambios'}
            </Text>
          )}
        </TouchableOpacity>
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
  editSection: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  editTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  editHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 15,
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
