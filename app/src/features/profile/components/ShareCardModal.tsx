import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../../../store/userStore';
import { useAlbumStore } from '../../../store/albumStore';
import { useWishlistStore } from '../../../store/wishlistStore';
import { track } from '../../../services/analytics';
import { colors, spacing, radii } from '../../../constants/theme';
import { ShareConfigPanel, type ShareCardOptions } from './ShareConfigPanel';
import { SOCIAL_ICONS } from './socialIcons';
import {
  renderShareCardToCanvas,
  shareCardToBlob,
  type ShareCardConfig,
} from '../../../utils/shareCard';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const DEFAULT_OPTIONS: ShareCardOptions = {
  showName: true,
  showProgress: true,
  showRepeated: true,
  showMissing: true,
  showPhoto: true,
};

const PREVIEW_ASPECT = 1080 / 1920;

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function WebCanvas({ canvasRef }: { canvasRef: React.MutableRefObject<HTMLCanvasElement | null> }) {
  const mountRef = (el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
  };
  return (
    <canvas
      ref={mountRef}
      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
    />
  );
}

export function ShareCardModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);
  const { statuses, getStats } = useAlbumStore();
  const { owned, repeated, missing, total } = getStats();
  const wishlistItems = useWishlistStore((s) => s.items);

  const [options, setOptions] = useState<ShareCardOptions>(DEFAULT_OPTIONS);
  const [rendering, setRendering] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(null);
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | null>(null);
  const [shareSheet, setShareSheet] = useState<{ blob: Blob; url: string; profileUrl: string } | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleChangePhoto = () => {
    if (!fileInputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        if (customPhotoUrl) URL.revokeObjectURL(customPhotoUrl);
        setCustomPhotoUrl(url);
      };
      fileInputRef.current = input;
    }
    fileInputRef.current.click();
  };

  const handleResetPhoto = () => {
    if (customPhotoUrl) URL.revokeObjectURL(customPhotoUrl);
    setCustomPhotoUrl(null);
    // Reset the input so "Cambiar foto" triggers a fresh picker next time
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current = null;
    }
  };

  const buildConfig = useCallback((): ShareCardConfig => {
    const allRepeatedIds = Object.entries(statuses)
      .filter(([, s]) => s === 'repeated')
      .map(([id]) => id);
    const repeatedIds = allRepeatedIds.slice(0, 12);
    // repeated (from getStats) = total copies across all repeated stickers
    const repeatedTotalCount = repeated;

    // Wishlist (favoritas) first, then rest — pass total count separately for the +N badge
    const allMissingIds = Object.entries(statuses)
      .filter(([, s]) => s === 'missing')
      .map(([id]) => id)
      .sort((a, b) => (wishlistItems[b] ? 1 : 0) - (wishlistItems[a] ? 1 : 0));
    const missingIds = allMissingIds.slice(0, 12);

    const resolvedPhoto = options.showPhoto
      ? (customPhotoUrl ?? profilePhotoDataUrl ?? undefined)
      : undefined;

    return {
      uid: user?.uid ?? '',
      userName: user?.name ?? '',
      photoUrl: resolvedPhoto,
      city: user?.city ?? '',
      owned,
      total,
      repeated,
      missing,
      repeatedIds,
      repeatedTotal: repeatedTotalCount,
      missingIds,
      missingTotal: allMissingIds.length,
      showName: options.showName,
      showProgress: options.showProgress,
      showRepeated: options.showRepeated,
      showMissing: options.showMissing,
    };
  }, [user, owned, total, repeated, missing, statuses, options, customPhotoUrl, profilePhotoDataUrl, wishlistItems]);

  const renderPreview = useCallback(async () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    setRendering(true);
    try {
      if (!offscreenRef.current) {
        offscreenRef.current = document.createElement('canvas');
      }
      await renderShareCardToCanvas(offscreenRef.current, buildConfig());
      const preview = previewRef.current;
      const src = offscreenRef.current;
      if (preview && src) {
        preview.width = src.width;
        preview.height = src.height;
        preview.getContext('2d')?.drawImage(src, 0, 0);
      }
    } finally {
      setRendering(false);
    }
  }, [buildConfig]);

  // Convert remote profile photo to dataURL once on open to avoid canvas CORS taint
  useEffect(() => {
    if (!visible || !user?.photoUrl) return;
    const src = user.photoUrl;
    const offscreen = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      offscreen.width = img.naturalWidth;
      offscreen.height = img.naturalHeight;
      const c = offscreen.getContext('2d');
      if (!c) return;
      c.drawImage(img, 0, 0);
      try {
        setProfilePhotoDataUrl(offscreen.toDataURL('image/jpeg', 0.92));
      } catch {
        // CORS blocked — canvas tainted, dataURL not accessible. Leave null.
        setProfilePhotoDataUrl(null);
      }
    };
    img.onerror = () => setProfilePhotoDataUrl(null);
    img.src = src;
  }, [visible, user?.photoUrl]);

  // Re-render preview whenever inputs change while modal is open.
  useEffect(() => {
    if (!visible) return;
    renderPreview();
  }, [visible, options, profilePhotoDataUrl, customPhotoUrl, renderPreview]);

  // Cleanup once when modal closes.
  useEffect(() => {
    if (visible) return;
    setCustomPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current = null;
    }
  }, [visible]);

  const handleShare = async () => {
    setSharing(true);
    setFeedback(null);
    try {
      const config = buildConfig();
      const blob = await shareCardToBlob(config);
      if (!blob) { setFeedback('Error al generar imagen'); return; }

      const profileUrl = `https://cambiafiguritas.online/u/${config.uid}`;
      const fileName = 'cambiafiguritas-figurita.png';
      const navAny = navigator as unknown as Record<string, unknown>;

      // Try native share first (works on mobile browsers)
      if (typeof navAny['canShare'] === 'function' && typeof navAny['share'] === 'function') {
        try {
          const file = new File([blob], fileName, { type: 'image/png' });
          if ((navAny['canShare'] as (d: unknown) => boolean)({ files: [file] })) {
            await (navAny['share'] as (d: unknown) => Promise<void>)({
              files: [file],
              title: 'Mi álbum del Mundial 2026',
              text: `¡Mirá mi progreso! ${profileUrl}`,
            });
            track({ name: 'share_card_generated', params: { method: 'native', ...options } });
            return;
          }
        } catch (e: unknown) {
          if (e instanceof Error && e.name === 'AbortError') return;
        }
      }

      // Fallback: show custom share sheet
      const objectUrl = URL.createObjectURL(blob);
      setShareSheet({ blob, url: objectUrl, profileUrl });
      track({ name: 'share_card_generated', params: { method: 'sheet', ...options } });
    } finally {
      setSharing(false);
    }
  };

  const closeShareSheet = () => {
    if (shareSheet) URL.revokeObjectURL(shareSheet.url);
    setShareSheet(null);
  };

  const shareToUrl = (targetUrl: string) => {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const copyLink = async (profileUrl: string) => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setFeedback('✓ Link copiado');
      setTimeout(() => setFeedback(null), 2000);
    } catch {
      setFeedback(profileUrl);
    }
    closeShareSheet();
  };

  const handleDownload = async () => {
    setSharing(true);
    try {
      const blob = await shareCardToBlob(buildConfig());
      if (!blob) return;
      downloadBlob(blob, 'cambiafiguritas-figurita.png');
      setFeedback('✓ Descargada');
      track({ name: 'share_card_generated', params: { method: 'explicit_download', ...options } });
      setTimeout(() => setFeedback(null), 2500);
    } finally {
      setSharing(false);
    }
  };

  if (Platform.OS !== 'web') return null;

  return (
    <>
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backdropHit} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tu figurita</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body: preview izquierda + config derecha */}
          <View style={styles.body}>
            {/* Preview */}
            <View style={styles.previewCol}>
              <View style={styles.previewWrapper}>
                {rendering && (
                  <View style={styles.previewLoading}>
                    <ActivityIndicator color={colors.accent} size="small" />
                  </View>
                )}
                <WebCanvas canvasRef={previewRef} />
              </View>
              <Text style={styles.previewHint}>Vista previa</Text>
            </View>

            {/* Config */}
            <ScrollView style={styles.configCol} showsVerticalScrollIndicator={false}>
              <ShareConfigPanel
                options={options}
                onChange={setOptions}
                onChangePhoto={handleChangePhoto}
                hasCustomPhoto={!!customPhotoUrl}
                onResetPhoto={handleResetPhoto}
              />
            </ScrollView>
          </View>

          {/* Feedback */}
          {feedback ? (
            <View style={styles.feedbackBanner}>
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          ) : null}

          {/* Botones pegados al fondo */}
          <View style={[styles.actions, { paddingBottom: insets.bottom || spacing.md }]}>
            <TouchableOpacity
              style={[styles.shareBtn, (sharing || rendering) && styles.disabled]}
              onPress={handleShare}
              disabled={sharing || rendering}
            >
              {sharing ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.shareBtnText}>Compartir</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.downloadBtn, (sharing || rendering) && styles.disabled]}
              onPress={handleDownload}
              disabled={sharing || rendering}
            >
              <Text style={styles.downloadBtnText}>Descargar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {shareSheet ? (
      <ShareSheet
        sheet={shareSheet}
        onClose={closeShareSheet}
        onCopyLink={copyLink}
        onDownload={(blob) => downloadBlob(blob, 'cambiafiguritas-figurita.png')}
        onShareTo={shareToUrl}
      />
    ) : null}
    </>
  );
}

// ─── Social Icons (inlined SVG, no CDN dependency) ──────────────────────────
const SZ = 28;

function SocialImg({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={SZ}
      height={SZ}
      style={{ objectFit: 'contain' }}
    />
  );
}

function WhatsAppIcon() { return <SocialImg src={SOCIAL_ICONS.whatsapp} alt="WhatsApp" />; }
function InstagramIcon() { return <SocialImg src={SOCIAL_ICONS.instagram} alt="Instagram" />; }
function FacebookIcon() { return <SocialImg src={SOCIAL_ICONS.facebook} alt="Facebook" />; }
function TelegramIcon() { return <SocialImg src={SOCIAL_ICONS.telegram} alt="Telegram" />; }
function XIcon() { return <SocialImg src={SOCIAL_ICONS.x} alt="X" />; }
function CopyIcon() { return <SocialImg src={SOCIAL_ICONS.link} alt="Copiar" />; }

function ShareSheet({
  sheet,
  onClose,
  onCopyLink,
  onDownload,
  onShareTo,
}: {
  sheet: { blob: Blob; url: string; profileUrl: string };
  onClose: () => void;
  onCopyLink: (url: string) => void;
  onDownload: (blob: Blob) => void;
  onShareTo: (url: string) => void;
}) {
  const text = encodeURIComponent('¡Mirá mi álbum del Mundial 2026! ' + sheet.profileUrl);
  const encodedUrl = encodeURIComponent(sheet.profileUrl);

  // For apps that can't receive files via web, download image first then open app
  const downloadThenOpen = (url: string) => {
    onDownload(sheet.blob);
    setTimeout(() => onShareTo(url), 300);
  };

  const options: { label: string; icon: React.ReactNode; color: string; withImage: boolean; action: () => void }[] = [
    {
      label: 'WhatsApp',
      icon: <WhatsAppIcon />,
      color: '#25D366',
      withImage: true,
      action: () => downloadThenOpen(`https://wa.me/?text=${text}`),
    },
    {
      label: 'Instagram',
      icon: <InstagramIcon />,
      color: '#E1306C',
      withImage: true,
      action: () => { onDownload(sheet.blob); },
    },
    {
      label: 'Facebook',
      icon: <FacebookIcon />,
      color: '#1877F2',
      withImage: false,
      action: () => onShareTo(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`),
    },
    {
      label: 'Telegram',
      icon: <TelegramIcon />,
      color: '#229ED9',
      withImage: true,
      action: () => downloadThenOpen(`https://t.me/share/url?url=${encodedUrl}&text=${text}`),
    },
    {
      label: 'X / Twitter',
      icon: <XIcon />,
      color: '#000000',
      withImage: false,
      action: () => onShareTo(`https://twitter.com/intent/tweet?text=${text}`),
    },
    {
      label: 'Copiar link',
      icon: <CopyIcon />,
      color: colors.accent,
      withImage: false,
      action: () => onCopyLink(sheet.profileUrl),
    },
  ];

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={ssStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={ssStyles.sheet}>
        <View style={ssStyles.handle} />
        <Text style={ssStyles.title}>Compartir figurita</Text>

        {/* Preview + hint */}
        <View style={ssStyles.previewRow}>
          <img
            src={sheet.url}
            alt="figurita"
            style={{ width: 64, height: 114, objectFit: 'cover', borderRadius: 8 } as any}
          />
          <View style={ssStyles.hintBox}>
            <Text style={ssStyles.hintTitle}>💡 Sobre la foto</Text>
            <Text style={ssStyles.hintText}>
              WhatsApp, Instagram y Telegram descargan la imagen automáticamente. Adjuntala vos en el chat.
            </Text>
            <TouchableOpacity onPress={() => onDownload(sheet.blob)} style={ssStyles.downloadInline}>
              <Text style={ssStyles.downloadInlineText}>Descargar imagen</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Link */}
        <View style={ssStyles.linkRow}>
          <Text style={ssStyles.linkText} numberOfLines={1}>{sheet.profileUrl}</Text>
        </View>

        {/* Options grid */}
        <View style={ssStyles.grid}>
          {options.map((o) => (
            <TouchableOpacity key={o.label} style={ssStyles.optionBtn} onPress={o.action}>
              <View style={[ssStyles.optionIcon, { backgroundColor: o.color + '22', borderColor: o.color + '44' }]}>
                {o.icon}
                {o.withImage && <View style={ssStyles.imageBadge}><Text style={ssStyles.imageBadgeText}>+img</Text></View>}
              </View>
              <Text style={ssStyles.optionLabel}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={ssStyles.cancelBtn} onPress={onClose}>
          <Text style={ssStyles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const ssStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 36, height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  linkRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  linkText: {
    color: colors.accent,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  optionBtn: {
    alignItems: 'center',
    width: 88,
    gap: 6,
  },
  optionIcon: {
    width: 56, height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionEmoji: {
    fontSize: 26,
  },
  optionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  hintBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  hintTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  downloadInline: {
    marginTop: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  downloadInlineText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  imageBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  imageBadgeText: {
    color: colors.background,
    fontSize: 8,
    fontWeight: '800',
  },
  cancelBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.8)',
    position: 'relative',
  },
  backdropHit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.md,
    maxHeight: '90%' as any,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    flexDirection: 'row',
    gap: spacing.md,
    flex: 1,
    minHeight: 320,
    maxHeight: 420,
  },
  previewCol: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  previewWrapper: {
    height: 300,
    aspectRatio: PREVIEW_ASPECT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0D0D1A',
    borderWidth: 1.5,
    borderColor: colors.accent + '55',
    position: 'relative',
  },
  previewHint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  configCol: {
    flex: 1,
  },
  previewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  feedbackBanner: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  feedbackText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border + '44',
  },
  shareBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '800',
  },
  downloadBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.accent + '66',
    minHeight: 52,
  },
  downloadBtnText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});
