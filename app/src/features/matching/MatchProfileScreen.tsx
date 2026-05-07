import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { db } from '../../services/firebase';
import { loadOtherUserAlbum } from '../../services/albumSyncService';
import { useUserStore } from '../../store/userStore';
import { useAlbumStore } from '../../store/albumStore';
import { track } from '../../services/analytics';
import { formatDistance, haversineKm } from '../../utils/distance';
import { colors, radii, spacing } from '../../constants/theme';
import { CompareBars } from './components/CompareBars';
import { CountryCompareRow } from './components/CountryCompareRow';
import { buildCountryCompare, summarizeCompare } from './utils/countryComparison';
import {
  buildClipboardText,
  buildWhatsAppMessage,
  copyToClipboard,
  openMapsForUser,
  openWhatsApp,
  promptReport,
} from './utils/profileActions';
import type { MatchesStackParamList } from '../../types/navigation';
import type { AppUser } from '../../types/user';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchProfile'>;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; user: AppUser; theirStatuses: Record<string, string> }
  | { kind: 'no_album'; user: AppUser }
  | { kind: 'error'; message: string };

export function MatchProfileScreen({ route, navigation }: Props) {
  const { uid } = route.params;
  const insets = useSafeAreaInsets();
  const me = useUserStore((s) => s.user);
  const myStatuses = useAlbumStore((s) => s.statuses);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [userSnap, albumSnap] = await Promise.all([
          getDoc(doc(db, 'users', uid)),
          loadOtherUserAlbum(uid),
        ]);
        if (cancelled) return;
        if (!userSnap.exists()) {
          setState({ kind: 'error', message: 'Usuario no encontrado' });
          return;
        }
        const user = userSnap.data() as AppUser;
        track({ name: 'match_profile_opened', params: { matchUid: uid } });
        if (!albumSnap || !albumSnap.statuses) {
          setState({ kind: 'no_album', user });
          return;
        }
        setState({ kind: 'ready', user, theirStatuses: albumSnap.statuses });
      } catch (e) {
        if (cancelled) return;
        setState({ kind: 'error', message: 'No se pudo cargar el perfil' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const compare = useMemo(() => {
    if (state.kind !== 'ready') return null;
    return buildCountryCompare(myStatuses, state.theirStatuses);
  }, [state, myStatuses]);

  const summary = useMemo(() => (compare ? summarizeCompare(compare) : null), [compare]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  if (state.kind === 'loading') {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.dim}>Cargando perfil…</Text>
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyIcon}>⚠️</Text>
        <Text style={styles.emptyMessage}>{state.message}</Text>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const user = state.user;
  const distanceKm =
    me?.lat != null && me?.lng != null && user.lat != null && user.lng != null
      ? haversineKm(me.lat, me.lng, user.lat, user.lng)
      : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={({ pressed }) => [styles.backHit, pressed && { opacity: 0.6 }]}>
          <Text style={styles.backText}>‹ Volver</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          {user.photoUrl ? (
            <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarLetter}>{user.name?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.city}>
            {[user.city, distanceKm != null ? formatDistance(distanceKm) : null]
              .filter(Boolean)
              .join(' · ') || 'Sin ubicación'}
          </Text>

          {summary ? (
            <View style={styles.barsWrap}>
              <CompareBars
                iNeedFromThem={summary.iNeedFromThem}
                theyNeedFromMe={summary.theyNeedFromMe}
                total={summary.total}
              />
            </View>
          ) : null}
        </View>

        {state.kind === 'no_album' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Este usuario aún no cargó su álbum.</Text>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <ActionButton
            label="WhatsApp"
            color="#25D366"
            disabled={!user.whatsapp || !compare}
            onPress={() => {
              if (!compare) return;
              const msg = buildWhatsAppMessage(me?.name, compare);
              openWhatsApp(user, msg);
            }}
          />
          <ActionButton
            label="Copiar"
            color={colors.primary}
            disabled={!compare || (summary?.iNeedFromThem === 0 && summary?.theyNeedFromMe === 0)}
            onPress={async () => {
              if (!compare) return;
              const text = buildClipboardText(compare);
              const ok = await copyToClipboard(text);
              if (ok) {
                track({ name: 'match_clipboard_copied', params: { matchUid: user.uid } });
                showToast('Lista copiada');
              } else {
                showToast('No se pudo copiar');
              }
            }}
          />
          <ActionButton
            label="Mapa"
            color={colors.secondary}
            disabled={user.lat == null && !user.city}
            onPress={() => {
              if (!openMapsForUser(user)) showToast('Sin ubicación');
            }}
          />
          <ActionButton
            label="Reportar"
            color={colors.danger}
            disabled={!me}
            onPress={() => {
              if (!me) return;
              promptReport(me.uid, user, (ok, message) => {
                if (ok) {
                  Alert.alert('Reporte enviado', message);
                } else {
                  Alert.alert('Reporte', message);
                }
              });
            }}
          />
        </View>

        {compare && compare.length > 0 ? (
          <View style={styles.list}>
            {compare.map((row) => (
              <CountryCompareRow
                key={row.countryId}
                data={row}
                defaultExpanded={row.relevance === 'two_way' && compare.indexOf(row) === 0}
              />
            ))}
          </View>
        ) : state.kind === 'ready' ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>Nada para intercambiar todavía.</Text>
          </View>
        ) : null}
      </ScrollView>

      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({
  label,
  color,
  onPress,
  disabled,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        { borderColor: color, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.fetchButton}>
      <Text style={styles.fetchButtonText}>Volver</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  topBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backHit: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
    alignSelf: 'flex-start',
  },
  backText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: spacing.sm,
  },
  avatarFallback: {
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  city: {
    color: colors.textMuted,
    fontSize: 13,
  },
  barsWrap: {
    width: '100%',
    marginTop: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 80,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  notice: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  noticeText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  list: {
    gap: spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyMessage: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  dim: {
    color: colors.textMuted,
    fontSize: 13,
  },
  fetchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  fetchButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
  toast: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 32,
    alignItems: 'center',
  },
  toastText: {
    backgroundColor: colors.text,
    color: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
});
