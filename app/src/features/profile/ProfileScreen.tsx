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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { updateUser } from '../../services/userService';
import { useUserStore } from '../../store/userStore';
import { useAlbumStore } from '../../store/albumStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import { shareText } from '../../utils/share';
import { shareStatsImage } from '../../utils/shareImage';
import { track } from '../../services/analytics';
import { StatsBreakdown } from './StatsBreakdown';
import { ProgressTimeline } from './components/ProgressTimeline';
import { PremiumCard } from './components/PremiumCard';
import { Tooltip } from '../../components/Tooltip';
import { colors, spacing, radii } from '../../constants/theme';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const getStats = useAlbumStore((s) => s.getStats);
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
  const { owned, repeated, missing, total } = getStats();

  const [whatsapp, setWhatsapp] = useState(user?.whatsapp ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [imageFeedback, setImageFeedback] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);

  const handleLogout = () => signOut(auth);

  const notify = (title: string, msg: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const handleShare = async () => {
    const stats = `${owned}/${total} figuritas (${repeated} repes)`;
    const message = `Estoy completando el album del Mundial 2026: ${stats}. Sumate a CambiaFiguritas para encontrar matches e intercambiar:`;
    const url = user?.uid
      ? `https://cambiafiguritas.web.app/u/${user.uid}`
      : 'https://cambiafiguritas.web.app';
    const result = await shareText(message, url);
    track({ name: 'share_album_clicked', params: { stats } });
    track({ name: 'og_share_clicked', params: { method: 'profile_link' } });
    if (result === 'shared') {
      setShareFeedback('✓ Compartido');
    } else if (result === 'copied') {
      setShareFeedback('✓ Link copiado al portapapeles');
    } else if (result === 'error') {
      notify('Error', 'No se pudo compartir. Intentá de nuevo.');
    }
    if (result === 'shared' || result === 'copied') {
      setTimeout(() => setShareFeedback(null), 2500);
    }
  };

  const handleShareImage = async () => {
    setGeneratingImage(true);
    setImageFeedback(null);
    try {
      const result = await shareStatsImage({
        userName: user?.name ?? '',
        owned,
        total,
        repeated,
        missing,
      });
      track({ name: 'share_image_generated', params: { result } });
      if (result === 'shared') setImageFeedback('✓ Compartido');
      else if (result === 'downloaded') setImageFeedback('✓ Descargado. Subilo a tu story');
      else if (result === 'unsupported') notify('No disponible', 'Por ahora la imagen sólo se genera en navegador. Probá desde el celular o desktop.');
      else if (result === 'error') notify('Error', 'No se pudo generar la imagen.');
    } finally {
      setGeneratingImage(false);
      setTimeout(() => setImageFeedback(null), 3000);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateUser(user.uid, { whatsapp, city });
      setUser({ ...user, whatsapp, city });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      notify('Error', 'No se pudo guardar. Verificá tu conexión.');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = whatsapp !== (user?.whatsapp ?? '') || city !== (user?.city ?? '');

  return (
    <View style={{ flex: 1 }}>
      <Tooltip
        id="profile-share-image"
        title="🖼 Compartí tu progreso"
        message="Generá una imagen lista para subir a tus stories y mostrar cómo va tu álbum."
        position="bottom"
      />
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
        {user?.premium ? (
          <View style={styles.premiumPill}>
            <Text style={styles.premiumPillText}>✨ Premium activo</Text>
          </View>
        ) : null}
      </View>

      {!user?.premium ? <PremiumCard /> : null}

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

      <StatsBreakdown />

      <ProgressTimeline />

      <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
        <Text style={styles.shareButtonText}>
          {shareFeedback ?? '📤 Compartir mi progreso'}
        </Text>
      </TouchableOpacity>

      {Platform.OS === 'web' ? (
        <TouchableOpacity
          style={[styles.shareImageButton, generatingImage && styles.saveButtonDisabled]}
          onPress={handleShareImage}
          disabled={generatingImage}
        >
          {generatingImage ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.shareImageButtonText}>
              {imageFeedback ?? '🖼 Compartir como imagen'}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.tutorialButton} onPress={resetOnboarding}>
        <Text style={styles.tutorialText}>Ver tutorial otra vez</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesion</Text>
      </TouchableOpacity>
    </ScrollView>
    </View>
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
  premiumPill: {
    backgroundColor: '#FFD700',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: spacing.sm,
  },
  premiumPillText: {
    color: '#0A0A0A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
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
  shareButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  shareButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 15,
  },
  shareImageButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  shareImageButtonText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 15,
  },
  tutorialButton: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  tutorialText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
  logoutButton: {
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 15,
  },
});
