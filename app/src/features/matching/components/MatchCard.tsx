import { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking, Modal, Pressable } from 'react-native';
import type { Match } from '../../../services/matchingService';
import { formatDistance } from '../../../utils/distance';
import { track } from '../../../services/analytics';
import { allStickers } from '../../album/data/albumCatalog';
import type { Sticker } from '../../album/types';
import { recordReputationVote } from '../../../services/userService';
import { useUserStore } from '../../../store/userStore';
import { colors, spacing, radii } from '../../../constants/theme';

type Props = { match: Match };

const MAX_PREVIEW_PER_COUNTRY = 6;
const WHATSAPP_TOP_N = 5;

const stickerIndex: Map<string, Sticker> = new Map(allStickers.map((s) => [s.id, s]));

type CountryGroup = {
  countryName: string;
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
      group = { countryName, items: [], total: 0 };
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

export function MatchCard({ match }: Props) {
  const { user, iNeedFromThem, theyNeedFromMe, iNeedIds, theyNeedIds, iNeedPriorityIds, score, distanceKm, isPerfectTrade } = match;
  const [expanded, setExpanded] = useState(false);
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteFeedback, setVoteFeedback] = useState<string | null>(null);
  const currentUid = useUserStore((s) => s.user?.uid);
  const priorityIdSet = useMemo(() => new Set(iNeedPriorityIds), [iNeedPriorityIds]);

  const iNeedGrouped = useMemo(() => groupByCountry(iNeedIds, priorityIdSet), [iNeedIds, priorityIdSet]);
  const theyNeedGrouped = useMemo(() => groupByCountry(theyNeedIds), [theyNeedIds]);

  const repUp = user.reputationUp ?? 0;
  const repDown = user.reputationDown ?? 0;
  const repCount = user.reputationCount ?? 0;
  const repPercent = repCount > 0 ? Math.round((repUp / repCount) * 100) : null;
  const isVerified = repCount >= 20 && repUp / repCount >= 0.85;

  const openWhatsApp = () => {
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

  return (
    <View style={[styles.card, isPerfectTrade && styles.cardPerfect]}>
      {isPerfectTrade ? (
        <View style={styles.perfectBadge}>
          <Text style={styles.perfectBadgeText}>🤝 Intercambio perfecto</Text>
        </View>
      ) : null}
      <View style={styles.header}>
        {user.photoUrl ? (
          <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{user.name?.[0] ?? '?'}</Text>
          </View>
        )}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{user.name}</Text>
            {user.premium ? <Text style={styles.premiumStar}>⭐</Text> : null}
            {isVerified ? (
              <View style={styles.verifiedChip}>
                <Text style={styles.verifiedChipText}>✓ Verificado</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.city}>
            {[user.city, distanceKm != null ? formatDistance(distanceKm) : null]
              .filter(Boolean)
              .join(' · ') || 'Sin ubicación'}
          </Text>
          {repPercent != null ? (
            <Text style={styles.reputation}>
              👍 {repPercent}% · {repCount} {repCount === 1 ? 'valoración' : 'valoraciones'}
            </Text>
          ) : (
            <Text style={styles.reputationNew}>Sin valoraciones aún</Text>
          )}
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
        </View>
      ) : null}

      {user.whatsapp ? (
        <TouchableOpacity style={styles.waButton} onPress={openWhatsApp}>
          <Text style={styles.waText}>Contactar por WhatsApp</Text>
        </TouchableOpacity>
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
    </View>
  );
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
              <Text style={styles.countryName}>{g.countryName}</Text>
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
  cardPerfect: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  perfectBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderColor: '#FFD700',
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: 4,
  },
  perfectBadgeText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
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
