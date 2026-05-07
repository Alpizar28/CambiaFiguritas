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
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { updateUser, updatePrivacy } from '../../services/userService';
import { useUserStore } from '../../store/userStore';
import { useAlbumStore } from '../../store/albumStore';
import { deleteCurrentAccount } from '../../services/accountService';
import { showAdsPrivacyOptions } from '../../services/adsConsent';
import { LegalModal } from './LegalModal';
import { LEGAL_VERSION, PRIVACY_TEXT, TERMS_TEXT } from './legalContent';
import { useOnboardingStore } from '../../store/onboardingStore';
import { shareText } from '../../utils/share';
import { shareStatsImage } from '../../utils/shareImage';
import { track } from '../../services/analytics';
import { StatsBreakdown } from './StatsBreakdown';
import { PremiumCard } from './components/PremiumCard';
import { Tooltip } from '../../components/Tooltip';
import { colors, spacing, radii } from '../../constants/theme';

type LegalView = null | 'privacy' | 'terms';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const getStats = useAlbumStore((s) => s.getStats);
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
  const { owned, repeated, missing, total } = getStats();
  const [legalView, setLegalView] = useState<LegalView>(null);
  const [deleting, setDeleting] = useState(false);

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

  const confirm = (title: string, msg: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${msg}`)) onConfirm();
      return;
    }
    Alert.alert(title, msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: onConfirm },
    ]);
  };

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

  const handlePrivacyChange = async (flags: {
    privacyHideProgress?: boolean;
    privacyHideRepeated?: boolean;
    privacyAnonymous?: boolean;
  }) => {
    if (!user) return;
    // Optimistic update
    setUser({ ...user, ...flags });
    try {
      await updatePrivacy(user.uid, flags);
    } catch (e) {
      setUser({ ...user });
      console.error('[updatePrivacy] failed', e);
      notify('Error', 'No se pudo guardar el cambio de privacidad.');
    }
  };

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
            placeholder="+506..."
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
            placeholder="San José"
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacidad</Text>
        <Text style={styles.privacyHint}>
          Controlá qué ven otros usuarios cuando compartís tu link o aparecés en matches.
        </Text>

        <PrivacyToggle
          label="Ocultar mi progreso"
          hint="No muestra cuántas tenés ni cuántas te faltan en tu link público."
          value={!!user?.privacyHideProgress}
          onChange={(v) => handlePrivacyChange({ privacyHideProgress: v })}
        />
        <PrivacyToggle
          label="Ocultar mis repetidas"
          hint="No muestra cuáles repes específicas tenés. Otros igual ven matches potenciales."
          value={!!user?.privacyHideRepeated}
          onChange={(v) => handlePrivacyChange({ privacyHideRepeated: v })}
        />
        <PrivacyToggle
          label="Modo anónimo"
          hint="Tu link público muestra 'Coleccionista' sin nombre, ciudad ni foto."
          value={!!user?.privacyAnonymous}
          onChange={(v) => handlePrivacyChange({ privacyAnonymous: v })}
        />

        <View style={{ height: spacing.md }} />

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

      <TouchableOpacity style={styles.tutorialButton} onPress={resetOnboarding}>
        <Text style={styles.tutorialText}>Ver tutorial otra vez</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar sesion</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.dangerButton, deleting && styles.disabled]}
        onPress={handleDelete}
        disabled={deleting}
      >
        <Text style={styles.dangerText}>{deleting ? 'Eliminando…' : 'Eliminar mi cuenta'}</Text>
      </TouchableOpacity>

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

function PrivacyToggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.privacyRow}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={styles.privacyLabel}>{label}</Text>
        <Text style={styles.privacyToggleHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={value ? colors.background : colors.textMuted}
      />
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
  section: {
    gap: spacing.sm,
    marginTop: spacing.lg,
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
  privacyHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    gap: spacing.sm,
  },
  privacyLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  privacyToggleHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
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
    borderColor: colors.textMuted,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
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
