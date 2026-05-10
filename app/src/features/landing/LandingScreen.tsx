import { useEffect } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, Circle, Rect, Line, Polyline, Polygon } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/userStore';
import { useLandingStore } from '../../store/landingStore';
import { track } from '../../services/analytics';
import { radii, spacing } from '../../constants/theme';

// Paleta mundialista
const W = {
  black:      '#0A0A0A',
  surface:    '#141414',
  card:       '#1C1C1C',
  border:     '#2A2A2A',
  text:       '#FFFFFF',
  muted:      '#888888',
  dim:        '#444444',

  gold:       '#FFD700',   // trofeo
  grass:      '#00B341',   // césped
  red:        '#E8001C',   // FIFA red
  sky:        '#009FD4',   // cielo estadio
  white:      '#FFFFFF',

  goldBg:     'rgba(255,215,0,0.13)',
  grassBg:    'rgba(0,179,65,0.13)',
  redBg:      'rgba(232,0,28,0.13)',
  skyBg:      'rgba(0,159,212,0.13)',

  goldBorder: 'rgba(255,215,0,0.30)',
  grassBorder:'rgba(0,179,65,0.30)',
  redBorder:  'rgba(232,0,28,0.30)',
  skyBorder:  'rgba(0,159,212,0.30)',
} as const;

type Props = { onContinueToLogin: () => void };

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconBall({ size = 28, color = W.gold }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1.6" />
      <Polygon points="12,4 15.5,9 12,11 8.5,9" stroke={color} strokeWidth="1.2" fill="none" />
      <Path d="M8.5 9L4.5 11.5M15.5 9L19.5 11.5M12 11v3.5M8.5 14.5L12 14.5M12 14.5L15.5 14.5M4.5 11.5L8.5 14.5M19.5 11.5L15.5 14.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </Svg>
  );
}

function IconUsers({ size = 28, color = W.grass }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="7" r="3.5" stroke={color} strokeWidth="1.6" />
      <Path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <Circle cx="17" cy="8" r="2.5" stroke={color} strokeWidth="1.4" />
      <Path d="M21 20c0-2.761-1.79-5-4-5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}

function IconChat({ size = 28, color = W.sky }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
      <Path d="M8 9h8M8 13h5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

function IconSearch({ size = 18, color = W.gold }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="1.6" />
      <Path d="M16.5 16.5L21 21" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

function IconStar({ size = 18, color = W.gold }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconPin({ size = 18, color = W.grass }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth="1.6" />
    </Svg>
  );
}

function IconThumb({ size = 18, color = W.grass }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

function IconShare({ size = 18, color = W.sky }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="16,6 12,2 8,6" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="2" x2="12" y2="15" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

function IconWifi({ size = 18, color = W.sky }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M1 6s5-5 11-5 11 5 11 5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <Path d="M5 10s3.5-3.5 7-3.5 7 3.5 7 3.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <Path d="M8.5 14s1.8-2 3.5-2 3.5 2 3.5 2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <Circle cx="12" cy="18" r="1.5" fill={color} />
    </Svg>
  );
}

function IconArrowDark({ size = 15 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M12 5l7 7-7 7" stroke={W.black} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconArrowLight({ size = 15 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M12 5l7 7-7 7" stroke={W.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// decorative mini ball for hero
function IconBallSm({ size = 14, color = W.gold }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="2" />
      <Path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    Icon: IconBall,
    number: '01',
    title: 'Marcá tu álbum',
    body: 'Tocá las figuritas que ya tenés y las que te faltan. Doble tap marca repes.',
    color: W.gold,
    bg: W.goldBg,
    border: W.goldBorder,
    numColor: 'rgba(255,215,0,0.18)',
  },
  {
    Icon: IconUsers,
    number: '02',
    title: 'Encontrá matches',
    body: 'Te conectamos con usuarios que tienen lo que necesitás y necesitan tus repes.',
    color: W.grass,
    bg: W.grassBg,
    border: W.grassBorder,
    numColor: 'rgba(0,179,65,0.18)',
  },
  {
    Icon: IconChat,
    number: '03',
    title: 'Coordiná por WhatsApp',
    body: 'Mensaje pre-armado con códigos de figuritas. Cero fricción para coordinar.',
    color: W.sky,
    bg: W.skyBg,
    border: W.skyBorder,
    numColor: 'rgba(0,159,212,0.18)',
  },
] as const;

const FEATURES = [
  { Icon: IconSearch, label: 'Búsqueda por código',   color: W.gold,  bg: W.goldBg,  border: W.goldBorder  },
  { Icon: IconStar,   label: 'Prioridades de match',  color: W.gold,  bg: W.goldBg,  border: W.goldBorder  },
  { Icon: IconPin,    label: 'Por cercanía',           color: W.grass, bg: W.grassBg, border: W.grassBorder },
  { Icon: IconThumb,  label: 'Reputación',             color: W.grass, bg: W.grassBg, border: W.grassBorder },
  { Icon: IconShare,  label: 'Compartí tu progreso',   color: W.sky,   bg: W.skyBg,   border: W.skyBorder   },
  { Icon: IconWifi,   label: 'Funciona offline',        color: W.sky,   bg: W.skyBg,   border: W.skyBorder   },
] as const;

const STATS = [
  { value: '669', label: 'Figuritas', color: W.gold,  bg: W.goldBg  },
  { value: '32',  label: 'Selecciones', color: W.grass, bg: W.grassBg },
  { value: 'Free', label: '100% gratis', color: W.sky,   bg: W.skyBg  },
] as const;

const SHOWCASE = [
  {
    src: require('../../../assets/landing/album.png'),
    title: 'Tu álbum, ordenado',
    body: 'Marcá tenidas, faltantes y repetidas.',
    color: W.gold,
    bg: W.goldBg,
    border: W.goldBorder,
  },
  {
    src: require('../../../assets/landing/matches.png'),
    title: 'Encontrá quién las tiene',
    body: 'Matches inteligentes cerca tuyo.',
    color: W.grass,
    bg: W.grassBg,
    border: W.grassBorder,
  },
  {
    src: require('../../../assets/landing/ranking.png'),
    title: 'Competí con tu país',
    body: 'Ranking global de coleccionistas.',
    color: W.sky,
    bg: W.skyBg,
    border: W.skyBorder,
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function LandingScreen({ onContinueToLogin }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const enterDemo = useUserStore((s) => s.enterDemo);
  const markLandingSeen = useLandingStore((s) => s.markSeen);

  useEffect(() => { track({ name: 'landing_viewed' }); }, []);

  const handleStart = () => {
    track({ name: 'landing_cta_clicked', params: { cta: 'start' } });
    onContinueToLogin();
  };

  const handleDemo = () => {
    track({ name: 'landing_cta_clicked', params: { cta: 'demo' } });
    markLandingSeen();
    enterDemo();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── HERO ── */}
      <View style={styles.hero}>

        {/* pill badge */}
        <View style={styles.eyebrowRow}>
          <IconBallSm size={13} color={W.gold} />
          <Text style={styles.eyebrow}>Mundial FIFA 2026</Text>
          <View style={styles.eyebrowLive} />
        </View>

        {/* headline con colores mundialistas */}
        <Text style={styles.heroTitle}>
          <Text style={{ color: W.white }}>Completá{'\n'}</Text>
          <Text style={{ color: W.gold }}>tu álbum,{'\n'}</Text>
          <Text style={{ color: W.grass }}>encontrá </Text>
          <Text style={{ color: W.sky }}>matches.</Text>
        </Text>

        <Text style={styles.heroSubtitle}>
          La forma inteligente de intercambiar figuritas con coleccionistas reales cerca tuyo.
        </Text>

        <View style={[styles.ctaRow, !isWide && styles.ctaColumn]}>
          <Pressable style={styles.primaryButton} onPress={handleStart}>
            <Text style={styles.primaryButtonText}>Empezar gratis</Text>
            <IconArrowDark size={20} />
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleDemo}>
            <Text style={styles.secondaryButtonText}>Ver demo</Text>
            <IconArrowLight size={15} />
          </Pressable>
        </View>

        <Text style={styles.heroFootnote}>Sin tarjeta · 669 figuritas oficiales · Panini</Text>
      </View>

      {/* ── STATS BAR ── */}
      <View style={[styles.statsBar, isWide && styles.statsBarWide]}>
        {STATS.map((stat, i) => (
          <View
            key={stat.label}
            style={[
              styles.statItem,
              { backgroundColor: stat.bg },
              i < STATS.length - 1 && styles.statItemBorder,
            ]}
          >
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* ── SHOWCASE ── */}
      <View style={styles.section}>
        <View style={styles.sectionLabelRow}>
          <View style={[styles.sectionLabelDot, { backgroundColor: W.gold }]} />
          <Text style={[styles.sectionEyebrow, { color: W.gold }]}>La app</Text>
        </View>
        <Text style={styles.sectionTitle}>
          <Text style={{ color: W.white }}>Pensada para </Text>
          <Text style={{ color: W.gold }}>coleccionistas.</Text>
        </Text>
        <View style={[styles.showcaseRow, !isWide && styles.showcaseColumn]}>
          {SHOWCASE.map((item) => (
            <View
              key={item.title}
              style={[
                styles.showcaseCard,
                isWide && styles.showcaseCardWide,
                { borderColor: item.border, backgroundColor: item.bg },
              ]}
            >
              <View style={[styles.phoneFrame, { borderColor: item.border }]}>
                <Image
                  source={item.src}
                  style={styles.phoneImage}
                  resizeMode="cover"
                />
              </View>
              <Text style={[styles.showcaseTitle, { color: item.color }]}>
                {item.title}
              </Text>
              <Text style={styles.showcaseBody}>{item.body}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── STEPS ── */}
      <View style={styles.section}>
        <View style={styles.sectionLabelRow}>
          <View style={[styles.sectionLabelDot, { backgroundColor: W.grass }]} />
          <Text style={[styles.sectionEyebrow, { color: W.grass }]}>Cómo funciona</Text>
        </View>
        <Text style={styles.sectionTitle}>
          <Text style={{ color: W.white }}>Tres pasos. </Text>
          <Text style={{ color: W.gold }}>Cero fricción.</Text>
        </Text>
        <View style={[styles.stepsRow, !isWide && styles.stepsColumn]}>
          {STEPS.map((step) => (
            <View
              key={step.title}
              style={[
                styles.stepCard,
                isWide && styles.stepCardWide,
                { borderColor: step.border, backgroundColor: step.bg },
              ]}
            >
              <View style={styles.stepTopRow}>
                <Text style={[styles.stepNumber, { color: step.numColor }]}>{step.number}</Text>
                <View style={[styles.stepIconWrap, { borderColor: step.border }]}>
                  <step.Icon size={26} color={step.color} />
                </View>
              </View>
              <Text style={[styles.stepTitle, { color: step.color }]}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── FEATURES ── */}
      <View style={styles.featuresBlock}>
        <View style={styles.sectionLabelRow}>
          <View style={[styles.sectionLabelDot, { backgroundColor: W.gold }]} />
          <Text style={[styles.sectionEyebrow, { color: W.gold }]}>Funciones</Text>
        </View>
        <Text style={styles.featuresTitle}>Todo lo que necesitás</Text>
        <View style={styles.featuresGrid}>
          {FEATURES.map(({ Icon, label, color, bg, border }) => (
            <View key={label} style={[styles.featureChip, { borderColor: border, backgroundColor: bg }]}>
              <Icon size={16} color={color} />
              <Text style={[styles.featureChipText, { color }]}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── FINAL CTA ── */}
      <View style={styles.finalCta}>
        {/* tricolor top bar */}
        <View style={styles.tricolorBar} pointerEvents="none">
          <View style={[styles.tricolorSegment, { backgroundColor: W.gold }]} />
          <View style={[styles.tricolorSegment, { backgroundColor: W.grass }]} />
          <View style={[styles.tricolorSegment, { backgroundColor: W.sky }]} />
        </View>
        <Text style={styles.finalCtaTitle}>Listo para empezar</Text>
        <Text style={styles.finalCtaBody}>
          Sumate gratis. Tu álbum sincroniza entre todos tus dispositivos.
        </Text>
        <Pressable style={styles.primaryButton} onPress={handleStart}>
          <Text style={styles.primaryButtonText}>Crear mi álbum</Text>
          <IconArrowDark size={20} />
        </Pressable>
      </View>

      <Text style={styles.footer}>
        Hecho por fanáticos del fútbol · No afiliado a Panini ni a la FIFA
      </Text>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: W.black },
  content:   { paddingHorizontal: spacing.lg, gap: spacing.xl },

  // HERO
  hero: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'flex-start',
    gap: spacing.md,
    maxWidth: 800,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: W.goldBg,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: W.goldBorder,
  },
  eyebrow: {
    color: W.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  eyebrowLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: W.grass,
  },
  heroTitle: {
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 52,
    letterSpacing: -1.5,
  },
  heroSubtitle: {
    color: W.muted,
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 460,
  },
  ctaRow:    { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  ctaColumn: { flexDirection: 'column', alignSelf: 'stretch' },
  primaryButton: {
    backgroundColor: W.gold,
    paddingHorizontal: spacing.xl + 8,
    paddingVertical: spacing.lg + 2,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minWidth: 240,
    shadowColor: W.gold,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 26,
    elevation: 14,
  },
  primaryButtonText: { color: W.black, fontSize: 20, fontWeight: '900', letterSpacing: 0.3 },
  secondaryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minWidth: 180,
  },
  secondaryButtonText: { color: W.text, fontSize: 16, fontWeight: '700' },
  heroFootnote: { color: W.dim, fontSize: 12, marginTop: spacing.xs, letterSpacing: 0.2 },

  // STATS BAR
  statsBar: {
    flexDirection: 'row',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  statsBarWide: { alignSelf: 'flex-start', minWidth: 440 },
  statItem: {
    flex: 1,
    paddingVertical: spacing.md + 4,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statItemBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.07)' },
  statValue: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: {
    color: W.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // SECTION LABEL
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionLabelDot: { width: 8, height: 8, borderRadius: 4 },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // STEPS
  section: { gap: spacing.md },
  sectionTitle: {
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
    letterSpacing: -0.8,
    marginBottom: spacing.xs,
  },
  stepsRow:    { flexDirection: 'row', gap: spacing.md },
  stepsColumn: { flexDirection: 'column' },
  stepCard: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    minHeight: 190,
  },
  stepCardWide: { flexBasis: '32%' },
  stepTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  stepNumber: { fontSize: 40, fontWeight: '900', letterSpacing: -1, lineHeight: 40 },
  stepIconWrap: {
    width: 50,
    height: 50,
    borderRadius: radii.sm,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  stepBody:  { color: W.muted, fontSize: 14, lineHeight: 21 },

  // SHOWCASE
  showcaseRow:    { flexDirection: 'row', gap: spacing.md },
  showcaseColumn: { flexDirection: 'column' },
  showcaseCard: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  showcaseCardWide: { flexBasis: '32%' },
  phoneFrame: {
    borderWidth: 2,
    borderRadius: 28,
    padding: 6,
    backgroundColor: W.black,
    width: '100%',
    maxWidth: 260,
    aspectRatio: 9 / 16,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  phoneImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  showcaseTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  showcaseBody: {
    color: W.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },

  // FEATURES
  featuresBlock: {
    backgroundColor: W.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featuresTitle: { color: W.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  featuresGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  featureChipText: { fontSize: 13, fontWeight: '700' },

  // FINAL CTA
  finalCta: {
    backgroundColor: W.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    paddingTop: spacing.xl + 4,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  tricolorBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    flexDirection: 'row',
  },
  tricolorSegment: { flex: 1 },
  finalCtaTitle: { color: W.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
  finalCtaBody:  { color: W.muted, fontSize: 15, lineHeight: 22 },

  // FOOTER
  footer: {
    color: W.dim,
    fontSize: 11,
    textAlign: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    letterSpacing: 0.1,
  },
});
