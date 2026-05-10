import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTradeSession } from '../../hooks/useTradeSession';
import { usePeerAlbum } from '../../hooks/usePeerAlbum';
import { peerNeedsSticker } from './utils/tradeSuggestion';
import { useUserStore } from '../../store/userStore';
import { useAlbumStore } from '../../store/albumStore';
import {
  cancelTradeSession,
  confirmTrade,
  updateMySelection,
} from '../../services/tradeSessionService';
import { useTradeStore } from '../../store/tradeStore';
import { allStickers } from '../album/data/albumCatalog';
import { StickerCheckRow } from './components/StickerCheckRow';
import { CheckIcon } from './components/TradeIcons';
import { colors, radii, spacing } from '../../constants/theme';
import { track } from '../../services/analytics';
import type { TradeStackParamList } from '../../types/navigation';
import type { TradeRole } from './types';

const stickerById = new Map(allStickers.map((s) => [s.id, s]));

function rowFor(stickerId: string) {
  const sticker = stickerById.get(stickerId);
  return {
    displayCode: sticker?.displayCode ?? stickerId,
    label: sticker?.label || sticker?.countryName || 'Jugador',
    countryName: sticker?.countryName,
    countryFlag: sticker?.countryFlag,
  };
}

function dedupSorted(ids: string[]): string[] {
  return Array.from(new Set(ids)).sort();
}

export function TradeSelectScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<TradeStackParamList>>();
  const route = useRoute<RouteProp<TradeStackParamList, 'TradeSelect'>>();
  const { sessionId, role } = route.params;
  const session = useTradeSession(sessionId);
  const repeatedCounts = useAlbumStore((s) => s.repeatedCounts);
  const statuses = useAlbumStore((s) => s.statuses);
  const setActive = useTradeStore((s) => s.setActive);
  const clearTrade = useTradeStore((s) => s.clear);
  const user = useUserStore((s) => s.user);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (sessionId) setActive(sessionId, role);
  }, [sessionId, role, setActive]);

  useEffect(() => {
    if (!session) return;
    if (session.status === 'completed') {
      navigation.replace('TradeComplete', { sessionId: session.id });
    } else if (session.status === 'cancelled' || session.status === 'expired') {
      Alert.alert('Sesión finalizada', session.failureReason ?? 'La sesión se canceló.');
      clearTrade();
      navigation.replace('TradeHome');
    }
  }, [session, navigation, clearTrade]);

  const myOffer = role === 'host' ? session?.hostStickers ?? [] : session?.guestStickers ?? [];
  const peerOffer = role === 'host' ? session?.guestStickers ?? [] : session?.hostStickers ?? [];
  const peerName = role === 'host' ? session?.guestName : session?.hostName;
  const peerUid = role === 'host' ? session?.guestUid ?? null : session?.hostUid ?? null;
  const myConfirmedAt = role === 'host' ? session?.hostConfirmedAt : session?.guestConfirmedAt;
  const peerConfirmedAt = role === 'host' ? session?.guestConfirmedAt : session?.hostConfirmedAt;
  const { album: peerAlbum, loaded: peerAlbumLoaded } = usePeerAlbum(peerUid);

  const [draftMine, setDraftMine] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched && session) {
      setDraftMine(dedupSorted(myOffer));
    }
  }, [session, myOffer, touched]);

  const myRepeatedIds = useMemo(
    () =>
      Object.entries(repeatedCounts)
        .filter(([, c]) => (c ?? 0) > 0)
        .map(([id]) => id)
        .sort(),
    [repeatedCounts],
  );

  // Solo se ofrecen repetidas que el peer realmente necesite.
  // Si el peer aún no tiene album cargado, asumimos que necesita todo
  // (peer nuevo / sin marcar) — mejor mostrar opciones que esconder todo.
  const myCandidates = useMemo(() => {
    if (!peerAlbumLoaded) return myRepeatedIds;
    if (!peerAlbum) return myRepeatedIds; // peer sin album → no podemos filtrar
    return myRepeatedIds.filter((id) => peerNeedsSticker(peerAlbum.statuses, id));
  }, [myRepeatedIds, peerAlbum, peerAlbumLoaded]);

  // Filtra lo que el otro ofrece por lo que yo realmente necesito.
  // Si mi statuses aun no cargo, fallback a la lista cruda.
  const peerOfferUseful = useMemo(() => {
    if (!statuses || Object.keys(statuses).length === 0) return peerOffer;
    return peerOffer.filter((id) => peerNeedsSticker(statuses, id));
  }, [peerOffer, statuses]);

  // Limpia draft de ids que dejaron de ser repetidas o que el peer ya no necesita.
  useEffect(() => {
    if (draftMine.length === 0) return;
    const candSet = new Set(myCandidates);
    const cleaned = draftMine.filter((id) => candSet.has(id));
    if (cleaned.length !== draftMine.length) {
      setDraftMine(cleaned);
      setTouched(true);
    }
  }, [myCandidates, draftMine]);

  const noMatchAtAll =
    peerAlbumLoaded &&
    !!peerAlbum &&
    myCandidates.length === 0 &&
    peerOfferUseful.length === 0;

  const handleToggleMine = useCallback((id: string) => {
    setTouched(true);
    setDraftMine((prev) => {
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set).sort();
    });
  }, []);

  const draftDiffersFromRemote = useMemo(() => {
    const a = dedupSorted(myOffer);
    const b = dedupSorted(draftMine);
    if (a.length !== b.length) return true;
    return a.some((id, i) => id !== b[i]);
  }, [myOffer, draftMine]);

  const handleSyncSelection = useCallback(async (): Promise<boolean> => {
    if (!sessionId) return false;
    setWorking(true);
    try {
      await updateMySelection(sessionId, role, draftMine);
      setTouched(false);
      return true;
    } catch (e) {
      console.error('[trade] update selection failed', e);
      Alert.alert('Error', 'No pudimos guardar tu selección. Probá de nuevo.');
      return false;
    } finally {
      setWorking(false);
    }
  }, [sessionId, role, draftMine]);

  const handleConfirm = useCallback(async () => {
    if (!sessionId) return;
    if (draftDiffersFromRemote) {
      const synced = await handleSyncSelection();
      if (!synced) return;
    }
    if (draftMine.length === 0 && peerOfferUseful.length === 0) {
      Alert.alert('Falta seleccionar', 'Marcá al menos una figu para intercambiar.');
      return;
    }
    setWorking(true);
    try {
      await confirmTrade(sessionId, role);
      track({
        name: 'trade_confirmed',
        params: { sessionId, role, givesCount: draftMine.length, receivesCount: peerOfferUseful.length },
      });
      navigation.replace('TradeReview', { sessionId, role });
    } catch (e) {
      console.error('[trade] confirm failed', e);
      Alert.alert('Error', 'No pudimos confirmar. Probá de nuevo.');
    } finally {
      setWorking(false);
    }
  }, [sessionId, role, draftMine, peerOfferUseful.length, draftDiffersFromRemote, handleSyncSelection, navigation]);

  const handleCancel = useCallback(async () => {
    if (!sessionId) {
      navigation.replace('TradeHome');
      return;
    }
    setWorking(true);
    try {
      await cancelTradeSession(sessionId, `${role}_cancelled`);
      track({ name: 'trade_cancelled', params: { sessionId, reason: `${role}_cancelled` } });
      clearTrade();
      navigation.replace('TradeHome');
    } catch (e) {
      console.error('[trade] cancel failed', e);
      Alert.alert('Error', 'No pudimos cancelar. Probá de nuevo.');
    } finally {
      setWorking(false);
    }
  }, [sessionId, role, navigation, clearTrade]);

  if (!user || !session) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const sessionExpired = session.expiresAt < Date.now();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Intercambio con {peerName ?? '…'}</Text>
        <Text style={styles.title}>Marcá las figus</Text>
        <Text style={styles.description}>
          A la izquierda, las que vos das. A la derecha, las que recibís. Confirmen los dos para cerrar.
        </Text>
      </View>

      {sessionExpired ? (
        <View style={styles.bannerWarn}>
          <Text style={styles.bannerWarnText}>La sesión expiró. Cancelá y armá una nueva.</Text>
        </View>
      ) : null}

      {!!myConfirmedAt && draftDiffersFromRemote ? (
        <View style={styles.bannerInfo}>
          <Text style={styles.bannerInfoText}>Tenés cambios sin guardar. Tocá "Confirmar" para reenviar.</Text>
        </View>
      ) : null}

      {noMatchAtAll ? (
        <View style={styles.bannerWarn}>
          <Text style={styles.bannerWarnText}>
            No hay figus útiles entre ustedes dos. Cancelá y probá con otra persona.
          </Text>
        </View>
      ) : null}

      <Section title="Lo que doy (útiles para el otro)" countSelected={draftMine.length}>
        {!peerAlbumLoaded ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
        ) : myRepeatedIds.length === 0 ? (
          <Text style={styles.emptyText}>No tenés repetidas todavía. Cargalas desde el álbum.</Text>
        ) : myCandidates.length === 0 ? (
          <Text style={styles.emptyText}>
            Ninguna de tus repetidas le sirve al otro. Probá con otra persona.
          </Text>
        ) : (
          myCandidates.map((id) => {
            const r = rowFor(id);
            return (
              <StickerCheckRow
                key={id}
                stickerId={id}
                displayCode={r.displayCode}
                label={r.label}
                countryName={r.countryName}
                countryFlag={r.countryFlag}
                selected={draftMine.includes(id)}
                onToggle={handleToggleMine}
              />
            );
          })
        )}
      </Section>

      <Section title="Lo que recibo" countSelected={peerOfferUseful.length}>
        {peerOffer.length === 0 ? (
          <Text style={styles.emptyText}>
            El otro todavía no eligió nada útil para vos.
          </Text>
        ) : peerOfferUseful.length === 0 ? (
          <Text style={styles.emptyText}>
            {peerOffer.length === 1
              ? 'La figu que eligió el otro ya la tenés.'
              : `Las ${peerOffer.length} figus que eligió el otro ya las tenés todas.`}
          </Text>
        ) : (
          peerOfferUseful.map((id) => {
            const r = rowFor(id);
            return (
              <StickerCheckRow
                key={id}
                stickerId={id}
                displayCode={r.displayCode}
                label={r.label}
                countryName={r.countryName}
                countryFlag={r.countryFlag}
                selected
                disabled
                onToggle={() => {}}
              />
            );
          })
        )}
      </Section>

      <View style={styles.summary}>
        <Text style={styles.summaryLine}>
          Doy: <Text style={styles.summaryStrong}>{draftMine.length}</Text>
        </Text>
        <Text style={styles.summaryLine}>
          Recibo: <Text style={styles.summaryStrong}>{peerOfferUseful.length}</Text>
        </Text>
      </View>

      <View style={styles.actions}>
        {draftDiffersFromRemote ? (
          <Pressable
            onPress={handleSyncSelection}
            disabled={working}
            style={({ pressed }) => [styles.cta, styles.ctaSecondary, pressed && styles.pressed, working && styles.disabled]}
          >
            <Text style={[styles.ctaText, styles.ctaTextSecondary]}>Guardar cambios</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={handleConfirm}
          disabled={working || sessionExpired}
          style={({ pressed }) => [
            styles.cta,
            styles.ctaPrimary,
            pressed && styles.pressed,
            (working || sessionExpired) && styles.disabled,
          ]}
        >
          {working ? <ActivityIndicator color="#001A0A" /> : (
            <Text style={styles.ctaText}>
              {myConfirmedAt && !draftDiffersFromRemote ? 'Ya confirmaste' : 'Confirmar'}
            </Text>
          )}
        </Pressable>

        <View style={styles.peerStatusRow}>
          {peerConfirmedAt ? <CheckIcon size={14} color={colors.primary} /> : null}
          <Text style={styles.peerStatus}>
            {peerConfirmedAt ? 'El otro ya confirmó' : 'El otro todavía no confirmó'}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={handleCancel}
        disabled={working}
        style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
      >
        <Text style={styles.cancelText}>Cancelar intercambio</Text>
      </Pressable>
    </ScrollView>
  );
}

type SectionProps = {
  title: string;
  countSelected: number;
  children: ReactNode;
};

function Section({ title, countSelected, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{countSelected}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  badge: {
    backgroundColor: colors.background,
    borderColor: colors.primary,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  badgeText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: spacing.sm,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  summaryLine: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  summaryStrong: {
    color: colors.accent,
    fontWeight: '900',
  },
  actions: {
    gap: spacing.sm,
  },
  cta: {
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  ctaPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ctaSecondary: {
    backgroundColor: colors.card,
    borderColor: colors.accent,
  },
  ctaText: {
    color: '#001A0A',
    fontSize: 16,
    fontWeight: '900',
  },
  ctaTextSecondary: {
    color: colors.accent,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.55,
  },
  peerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  peerStatus: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.danger,
    fontWeight: '700',
  },
  bannerWarn: {
    backgroundColor: '#3A1620',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  bannerWarnText: {
    color: colors.danger,
    fontWeight: '700',
  },
  bannerInfo: {
    backgroundColor: '#1F2A36',
    borderColor: colors.secondary,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  bannerInfoText: {
    color: colors.text,
    fontWeight: '600',
  },
});
