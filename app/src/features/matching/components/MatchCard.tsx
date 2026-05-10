import { useMemo, useState, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking, Modal, Pressable } from 'react-native';
import type { Match } from '../../../services/matchingService';
import { formatDistance } from '../../../utils/distance';
import { track } from '../../../services/analytics';
import { allStickers } from '../../album/data/albumCatalog';
import type { Sticker } from '../../album/types';
import { recordReputationVote } from '../../../services/userService';
import { useUserStore } from '../../../store/userStore';
import { colors, spacing, radii } from '../../../constants/theme';
import { ENABLE_PREMIUM_UI } from '../../../constants/featureFlags';
import { vsCardToBlob, renderVsCardToCanvas, type VsCardConfig } from '../../../utils/shareCard';
import { useGooglePhotoDataUrl } from '../../../utils/useGooglePhotoDataUrl';

type Props = {
  match: Match;
  onPress?: () => void;
};

const MAX_PREVIEW_PER_COUNTRY = 6;
const WHATSAPP_TOP_N = 5;

const stickerIndex: Map<string, Sticker> = new Map(allStickers.map((s) => [s.id, s]));

type CountryGroup = {
  countryName: string;
  countryFlag?: string;
  items: { id: string; code: string; priority: boolean }[];
  total: number;
};

function groupByCountry(ids: string[], priorityIds: Set<string> = new Set()): CountryGroup[] {
  const map = new Map<string, CountryGroup>();
  ids.forEach((id) => {
    const sticker = stickerIndex.get(id);
    const countryName = sticker?.countryName ?? 'Especiales';
    let group = map.get(countryName);
    if (!group) {
      group = { countryName, countryFlag: sticker?.countryFlag, items: [], total: 0 };
      map.set(countryName, group);
    }
    group.total += 1;
    if (group.items.length < MAX_PREVIEW_PER_COUNTRY) {
      group.items.push({ id, code: sticker?.displayCode ?? id, priority: priorityIds.has(id) });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function topCodes(ids: string[], n: number): string {
  return ids
    .slice(0, n)
    .map((id) => stickerIndex.get(id)?.displayCode ?? id)
    .join(', ');
}

export function MatchCard({ match, onPress }: Props) {
  const { user, iNeedFromThem, theyNeedFromMe, iNeedIds, theyNeedIds, iNeedPriorityIds, score, distanceKm, isPerfectTrade } = match;
  const [expanded, setExpanded] = useState(false);
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteFeedback, setVoteFeedback] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [vsPreview, setVsPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const currentUser = useUserStore((s) => s.user);
  const currentUid = currentUser?.uid;
  const myPhotoDataUrl = useGooglePhotoDataUrl(currentUser?.photoUrl);
  const vsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const priorityIdSet = useMemo(() => new Set(iNeedPriorityIds), [iNeedPriorityIds]);

  const iNeedGrouped = useMemo(() => groupByCountry(iNeedIds, priorityIdSet), [iNeedIds, priorityIdSet]);
  const theyNeedGrouped = useMemo(() => groupByCountry(theyNeedIds), [theyNeedIds]);

  const repUp = user.reputationUp ?? 0;
  const repDown = user.reputationDown ?? 0;
  const repCount = user.reputationCount ?? 0;
  const repPercent = repCount > 0 ? Math.round((repUp / repCount) * 100) : null;
  const isVerified = repCount >= 20 && repUp / repCount >= 0.85;

  const openWhatsApp = (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    const phone = user.whatsapp?.replace(/\D/g, '');
    const myOffer = topCodes(theyNeedIds, WHATSAPP_TOP_N);
    const myAsk = topCodes(iNeedIds, WHATSAPP_TOP_N);
    const lines = [
      'Hola! Te vi en CambiaFiguritas, ¿intercambiamos?',
      myOffer ? `Te puedo dar: ${myOffer}${theyNeedFromMe > WHATSAPP_TOP_N ? ` (+${theyNeedFromMe - WHATSAPP_TOP_N})` : ''}` : '',
      myAsk ? `Necesito: ${myAsk}${iNeedFromThem > WHATSAPP_TOP_N ? ` (+${iNeedFromThem - WHATSAPP_TOP_N})` : ''}` : '',
    ].filter(Boolean);
    const msg = encodeURIComponent(lines.join('\n'));
    track({ name: 'match_whatsapp_clicked', params: { matchUid: user.uid, expanded } });
    Linking.openURL(`https://wa.me/${phone}?text=${msg}`);
    // Diferimos prompt de voto 30s para dar tiempo a coordinar
    setTimeout(() => setVoteModalOpen(true), 30_000);
  };

  const submitVote = async (vote: 'up' | 'down') => {
    if (!currentUid || voteSubmitting) return;
    setVoteSubmitting(true);
    try {
      await recordReputationVote(user.uid, currentUid, vote);
      track({ name: 'reputation_voted', params: { targetUid: user.uid, vote } });
      setVoteFeedback('¡Gracias por tu valoración!');
      setTimeout(() => {
        setVoteModalOpen(false);
        setVoteFeedback(null);
      }, 1500);
    } catch (e) {
      setVoteFeedback('No se pudo registrar el voto.');
    } finally {
      setVoteSubmitting(false);
    }
  };

  const toggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) track({ name: 'match_details_opened', params: { matchUid: user.uid } });
  };

  const buildVsConfig = (): VsCardConfig => ({
    myUid: currentUid ?? '',
    myName: currentUser?.name ?? 'Yo',
    myPhotoUrl: myPhotoDataUrl.current ?? currentUser?.photoUrl ?? undefined,
    myCity: currentUser?.city ?? undefined,
    theirName: displayName,
    theirPhotoUrl: displayPhoto ?? undefined,
    theirCity: displayCity ?? undefined,
    iGiveIds: theyNeedIds,
    iGiveTotal: theyNeedFromMe,
    iReceiveIds: iNeedIds,
    iReceiveTotal: iNeedFromThem,
    isPerfectTrade: !!isPerfectTrade,
  });

  const handleShareMatch = async (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    if (sharing) return;
    setSharing(true);
    track({ name: 'match_share_clicked', params: { isPerfectTrade: !!isPerfectTrade, matchUid: user.uid } });
    try {
      const blob = await vsCardToBlob(buildVsConfig());
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setVsPreview({ blob, url });
    } finally {
      setSharing(false);
    }
  };

  const closePreview = () => {
    if (vsPreview) URL.revokeObjectURL(vsPreview.url);
    setVsPreview(null);
  };

  const doShare = async () => {
    if (!vsPreview) return;
    const fileName = 'match-cambiafiguritas.png';
    const navAny = navigator as unknown as Record<string, unknown>;
    if (typeof navAny['canShare'] === 'function' && typeof navAny['share'] === 'function') {
      try {
        const file = new File([vsPreview.blob], fileName, { type: 'image/png' });
        if ((navAny['canShare'] as (d: unknown) => boolean)({ files: [file] })) {
          await (navAny['share'] as (d: unknown) => Promise<void>)({
            files: [file],
            text: `¡Match con ${displayName}! cambiafiguritas.online`,
          });
          closePreview();
          return;
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    // Fallback: download
    const a = document.createElement('a');
    a.href = vsPreview.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    closePreview();
  };

  // Privacidad aplicada al renderizar a OTRO user. Si tiene flags activos,
  // ocultamos identidad / repes específicos. El score y los counts agregados
  // siguen mostrándose para que el match sea funcional.
  const isAnonymous = !!user.privacyAnonymous;
  const hideRepeated = !!user.privacyHideRepeated;
  const displayName = isAnonymous ? 'Coleccionista' : user.name;
  const displayPhoto = isAnonymous ? null : user.photoUrl;
  const displayCity = isAnonymous ? null : user.city;

  const cardContent = (
    <>
      {isPerfectTrade ? (
        <TouchableOpacity style={styles.perfectBanner} onPress={handleShareMatch} activeOpacity={0.8}>
          <Text style={styles.perfectBannerText}>🤝 ¡Intercambio perfecto! Compartilo</Text>
          <Text style={styles.perfectBannerArrow}>→</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.header}>
        {displayPhoto ? (
          <Image source={{ uri: displayPhoto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{isAnonymous ? '?' : (user.name?.[0] ?? '?')}</Text>
          </View>
        )}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            {ENABLE_PREMIUM_UI && !isAnonymous && user.premium ? <Text style={styles.premiumStar}>⭐</Text> : null}
            {!isAnonymous && isVerified ? (
              <View style={styles.verifiedChip}>
                <Text style={styles.verifiedChipText}>✓ Verificado</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.city}>
            {[displayCity, distanceKm != null ? formatDistance(distanceKm) : null]
              .filter(Boolean)
              .join(' · ') || 'Sin ubicación'}
          </Text>
          {!isAnonymous && repPercent != null ? (
            <Text style={styles.reputation}>
              👍 {repPercent}% · {repCount} {repCount === 1 ? 'valoración' : 'valoraciones'}
            </Text>
          ) : !isAnonymous ? (
            <Text style={styles.reputationNew}>Sin valoraciones aún</Text>
          ) : null}
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreNumber}>{score}</Text>
          <Text style={styles.scoreLabel}>matches</Text>
        </View>
      </View>

      <View style={styles.breakdown}>
        <Pill label={`${iNeedFromThem} necesito`} color={colors.owned} />
        <Pill label={`${theyNeedFromMe} necesitan`} color={colors.repeated} />
      </View>

      <TouchableOpacity style={styles.detailsButton} onPress={toggleExpand}>
        <Text style={styles.detailsButtonText}>
          {expanded ? 'Ocultar intercambio ▲' : 'Ver intercambio ▼'}
        </Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.detailsBlock}>
          {hideRepeated ? (
            <Text style={styles.privacyNotice}>
              🔒 Este usuario eligió no mostrar las repes específicas. Los counts arriba siguen siendo reales.
            </Text>
          ) : (
            <>
              <DetailSection
                title="Te puedo dar (mis repes que necesitan)"
                color={colors.repeated}
                groups={theyNeedGrouped}
                totalShown={theyNeedIds.length}
                totalReal={theyNeedFromMe}
                emptyMsg="No tenés repes que les sirvan."
              />
              <DetailSection
                title="Necesito (sus repes que me faltan)"
                color={colors.owned}
                groups={iNeedGrouped}
                totalShown={iNeedIds.length}
                totalReal={iNeedFromThem}
                emptyMsg="No tienen repes que te sirvan."
              />
            </>
          )}
        </View>
      ) : null}

      <View style={styles.footerRow}>
        {user.whatsapp ? (
          <TouchableOpacity style={[styles.waButton, styles.footerBtnFlex]} onPress={openWhatsApp}>
            <Text style={styles.waText}>WhatsApp</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.shareButton, styles.footerBtnFlex, sharing && styles.disabled]} onPress={handleShareMatch} disabled={sharing}>
          <Text style={styles.shareButtonText}>{sharing ? 'Generando…' : 'Compartir match'}</Text>
        </TouchableOpacity>
      </View>

      {onPress ? (
        <View style={styles.viewMore}>
          <Text style={styles.viewMoreText}>Ver perfil y comparar →</Text>
        </View>
      ) : null}

      <Modal visible={voteModalOpen} transparent animationType="fade" onRequestClose={() => setVoteModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setVoteModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>¿Cumplió el intercambio?</Text>
            <Text style={styles.modalSubtitle}>
              Tu valoración ayuda a otros usuarios a confiar en {user.name?.split(' ')[0] ?? 'esta persona'}.
            </Text>
            {voteFeedback ? (
              <Text style={styles.modalFeedback}>{voteFeedback}</Text>
            ) : (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.voteButton, styles.voteDown]}
                  onPress={() => submitVote('down')}
                  disabled={voteSubmitting}
                >
                  <Text style={styles.voteButtonText}>👎 No cumplió</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.voteButton, styles.voteUp]}
                  onPress={() => submitVote('up')}
                  disabled={voteSubmitting}
                >
                  <Text style={styles.voteButtonText}>👍 Cumplió</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity onPress={() => setVoteModalOpen(false)} style={styles.modalLater}>
              <Text style={styles.modalLaterText}>Más tarde</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* VS Card Preview Modal */}
      <Modal visible={!!vsPreview} transparent animationType="slide" onRequestClose={closePreview}>
        <Pressable style={styles.modalBackdrop} onPress={closePreview} />
        <View style={styles.vsPreviewSheet}>
          <View style={styles.vsHandle} />
          <Text style={styles.vsPreviewTitle}>Tu tarjeta de match</Text>
          {vsPreview ? (
            <img
              src={vsPreview.url}
              alt="match"
              style={{ width: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 12 } as React.CSSProperties}
            />
          ) : null}
          <View style={styles.vsActions}>
            <TouchableOpacity style={styles.vsShareBtn} onPress={doShare}>
              <Text style={styles.vsShareBtnText}>Compartir</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.vsCloseBtn} onPress={closePreview}>
              <Text style={styles.vsCloseBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          isPerfectTrade && styles.cardPerfect,
          pressed && styles.cardPressed,
        ]}
      >
        {cardContent}
      </Pressable>
    );
  }

  return <View style={[styles.card, isPerfectTrade && styles.cardPerfect]}>{cardContent}</View>;
}

function DetailSection({
  title,
  color,
  groups,
  totalShown,
  totalReal,
  emptyMsg,
}: {
  title: string;
  color: string;
  groups: CountryGroup[];
  totalShown: number;
  totalReal: number;
  emptyMsg: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      {groups.length === 0 ? (
        <Text style={styles.emptyDetail}>{emptyMsg}</Text>
      ) : (
        <View style={{ gap: spacing.xs }}>
          {groups.map((g) => (
            <View key={g.countryName} style={styles.countryRow}>
              <Text style={styles.countryName}>
                {g.countryFlag ? `${g.countryFlag} ` : ''}{g.countryName}
              </Text>
              <View style={styles.codes}>
                {g.items.map((it) => (
                  <View
                    key={it.id}
                    style={[
                      styles.codeChip,
                      { borderColor: color },
                      it.priority && styles.codeChipPriority,
                    ]}
                  >
                    {it.priority ? <Text style={styles.codeChipStar}>★</Text> : null}
                    <Text style={[styles.codeChipText, { color }]}>{it.code}</Text>
                  </View>
                ))}
                {g.total > g.items.length ? (
                  <Text style={styles.moreText}>+{g.total - g.items.length}</Text>
                ) : null}
              </View>
            </View>
          ))}
          {totalReal > totalShown ? (
            <Text style={styles.truncatedNote}>
              Mostrando {totalShown} de {totalReal}. Coordiná el resto por WhatsApp.
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardPressed: {
    opacity: 0.85,
  },
  viewMore: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  viewMoreText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  cardPerfect: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  perfectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderColor: '#FFD700',
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginBottom: 4,
  },
  perfectBannerText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    flex: 1,
  },
  perfectBannerArrow: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 4,
  },
  footerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  footerBtnFlex: {
    flex: 1,
  },
  shareButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  disabled: {
    opacity: 0.5,
  },
  vsPreviewSheet: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  vsHandle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginBottom: spacing.xs,
  },
  vsPreviewTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center' as const,
  },
  vsActions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  vsShareBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  vsShareBtnText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '800',
  },
  vsCloseBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vsCloseBtnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  verifiedChip: {
    backgroundColor: '#16A34A22',
    borderColor: '#16A34A',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifiedChipText: {
    color: '#16A34A',
    fontSize: 10,
    fontWeight: '700',
  },
  premiumStar: {
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  city: {
    color: colors.textMuted,
    fontSize: 13,
  },
  reputation: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  reputationNew: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  scoreBadge: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  scoreNumber: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  scoreLabel: {
    color: colors.textMuted,
    fontSize: 10,
  },
  breakdown: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  detailsButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  detailsBlock: {
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyDetail: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  countryRow: {
    gap: 4,
  },
  countryName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  codes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  codeChipPriority: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderColor: '#FFD700',
  },
  codeChipStar: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
  },
  codeChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  moreText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  truncatedNote: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  privacyNotice: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
    paddingVertical: spacing.xs,
  },
  waButton: {
    backgroundColor: '#25D366',
    borderRadius: radii.sm,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  waText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    maxWidth: 400,
    width: '100%' as any,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  voteButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  voteUp: {
    backgroundColor: '#22C55E',
  },
  voteDown: {
    backgroundColor: '#444',
  },
  voteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalFeedback: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  modalLater: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  modalLaterText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
