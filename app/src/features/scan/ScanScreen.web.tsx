import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing } from '../../constants/theme';
import { track } from '../../services/analytics';
import { useAlbumStore } from '../../store/albumStore';
import { recognizeText, disposeOcrEngine } from './ocrEngine';
import { parseOCRBlocks, lookupStickerByCode } from './ocrParser';
import { ScanResultSheet } from './ScanResultSheet';
import type { ScannedCandidate, ScanState } from './types';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const EMPTY_MESSAGE = 'No detectamos figuritas. Acercá la cámara y mejorá la luz.';
const ERROR_MESSAGE = 'No pudimos procesar la imagen. Volvé a intentar.';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return ERROR_MESSAGE;
}

function buildCandidates(
  parsed: ReturnType<typeof parseOCRBlocks>,
): ScannedCandidate[] {
  const store = useAlbumStore.getState();
  return parsed.map((p) => ({
    stickerId: p.stickerId,
    sticker: p.sticker,
    currentStatus: store.statuses[p.stickerId] ?? 'missing',
    currentRepeatedCount: store.repeatedCounts[p.stickerId] ?? 0,
    rawText: p.rawText,
  }));
}

function hasShapeDetection(): boolean {
  return typeof window !== 'undefined' && 'TextDetector' in window;
}

export function ScanScreen({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{ detect: (img: HTMLVideoElement | HTMLCanvasElement | ImageBitmap) => Promise<Array<{ rawValue: string }>> } | null>(null);
  const loopRef = useRef<number | null>(null);
  const detectingRef = useRef(false);

  const [state, setState] = useState<ScanState>({ kind: 'idle' });
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [supportsRealtime, setSupportsRealtime] = useState<boolean | null>(null);

  const stopStream = useCallback(() => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreamReady(false);
  }, []);

  const handleDetected = useCallback((rawText: string) => {
    const blocks = [{ text: rawText, lines: [{ text: rawText }] }];
    const parsed = parseOCRBlocks(blocks);
    if (!parsed.length) return false;
    track({ name: 'scan_recognized', params: { candidates: parsed.length, durationMs: 0 } });
    const candidates = buildCandidates(parsed);
    setState({
      kind: 'review',
      candidates,
      selected: new Set(candidates.map((c) => c.stickerId)),
    });
    return true;
  }, []);

  const tickRealtime = useCallback(async () => {
    if (detectingRef.current) {
      loopRef.current = requestAnimationFrame(tickRealtime);
      return;
    }
    const detector = detectorRef.current;
    const video = videoRef.current;
    if (!detector || !video || video.readyState < 2) {
      loopRef.current = requestAnimationFrame(tickRealtime);
      return;
    }
    detectingRef.current = true;
    try {
      const results = await detector.detect(video);
      for (const r of results) {
        if (handleDetected(r.rawValue)) {
          stopStream();
          return;
        }
      }
    } catch {
      // ignore single frame errors
    } finally {
      detectingRef.current = false;
    }
    loopRef.current = requestAnimationFrame(tickRealtime);
  }, [handleDetected, stopStream]);

  const startStream = useCallback(async () => {
    setPermissionDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play().catch(() => {});
        setStreamReady(true);
      }

      const realtime = hasShapeDetection();
      setSupportsRealtime(realtime);
      if (realtime) {
        // @ts-expect-error TextDetector is experimental DOM API
        detectorRef.current = new window.TextDetector();
        loopRef.current = requestAnimationFrame(tickRealtime);
      }
    } catch (error) {
      const msg = getErrorMessage(error).toLowerCase();
      if (msg.includes('denied') || msg.includes('not allowed')) {
        setPermissionDenied(true);
      } else {
        setState({ kind: 'error', message: 'No pudimos acceder a la cámara.' });
      }
    }
  }, [tickRealtime]);

  useEffect(() => {
    if (!visible) {
      stopStream();
      setState({ kind: 'idle' });
      return;
    }
    track({ name: 'scan_opened' });
    startStream();
    return () => {
      stopStream();
    };
  }, [visible, startStream, stopStream]);

  useEffect(() => {
    return () => {
      stopStream();
      void disposeOcrEngine();
    };
  }, [stopStream]);

  const captureFallback = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    track({ name: 'scan_capture_started' });
    setState({ kind: 'recognizing' });
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85),
      );
      if (!blob) throw new Error('No blob from canvas');

      const start = Date.now();
      const blocks = await recognizeText(blob);
      const durationMs = Date.now() - start;
      const parsed = parseOCRBlocks(blocks);
      track({ name: 'scan_recognized', params: { candidates: parsed.length, durationMs } });

      if (!parsed.length) {
        track({ name: 'scan_no_match' });
        setState({ kind: 'empty', message: EMPTY_MESSAGE });
        return;
      }
      const candidates = buildCandidates(parsed);
      setState({
        kind: 'review',
        candidates,
        selected: new Set(candidates.map((c) => c.stickerId)),
      });
      stopStream();
    } catch (error) {
      track({ name: 'scan_capture_failed', params: { reason: getErrorMessage(error).slice(0, 60) } });
      setState({ kind: 'error', message: ERROR_MESSAGE });
    }
  }, [stopStream]);

  const toggleSelected = useCallback((stickerId: string) => {
    setState((prev) => {
      if (prev.kind !== 'review') return prev;
      const next = new Set(prev.selected);
      if (next.has(stickerId)) next.delete(stickerId);
      else next.add(stickerId);
      return { ...prev, selected: next };
    });
  }, []);

  const addManualCode = useCallback((rawCode: string) => {
    const sticker = lookupStickerByCode(rawCode);
    track({ name: 'scan_manual_entry', params: { matched: !!sticker } });
    if (!sticker) return false;
    setState((prev) => {
      const store = useAlbumStore.getState();
      const candidate: ScannedCandidate = {
        stickerId: sticker.id,
        sticker,
        currentStatus: store.statuses[sticker.id] ?? 'missing',
        currentRepeatedCount: store.repeatedCounts[sticker.id] ?? 0,
        rawText: rawCode,
      };
      if (prev.kind !== 'review') {
        return { kind: 'review', candidates: [candidate], selected: new Set([sticker.id]) };
      }
      if (prev.candidates.some((c) => c.stickerId === sticker.id)) {
        const nextSelected = new Set(prev.selected);
        nextSelected.add(sticker.id);
        return { ...prev, selected: nextSelected };
      }
      return {
        ...prev,
        candidates: [candidate, ...prev.candidates],
        selected: new Set([sticker.id, ...prev.selected]),
      };
    });
    return true;
  }, []);

  const confirmSelected = useCallback(() => {
    setState((prev) => {
      if (prev.kind !== 'review') return prev;
      const store = useAlbumStore.getState();
      let added = 0;
      let incremented = 0;
      for (const c of prev.candidates) {
        if (!prev.selected.has(c.stickerId)) continue;
        if (c.currentStatus === 'missing') {
          store.markOwned(c.stickerId);
          added++;
        } else {
          store.incrementRepeated(c.stickerId);
          incremented++;
        }
      }
      track({ name: 'scan_confirmed', params: { added, incremented } });
      return { kind: 'idle' };
    });
    onClose();
  }, [onClose]);

  const dismiss = useCallback(() => {
    setState((prev) => {
      if (prev.kind === 'review') track({ name: 'scan_dismissed' });
      return { kind: 'idle' };
    });
    startStream();
  }, [startStream]);

  const handleClose = () => {
    stopStream();
    setState({ kind: 'idle' });
    onClose();
  };

  const isBusy = state.kind === 'recognizing';
  const isReview = state.kind === 'review';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Live video as RN-rendered HTML element */}
        {visible && !isReview ? (
          <video
            ref={videoRef as never}
            autoPlay
            playsInline
            muted
            style={
              {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                background: '#000',
              } as never
            }
          />
        ) : null}

        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            style={styles.iconButton}
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cerrar escáner"
          >
            <Text style={styles.iconText}>✕</Text>
          </Pressable>
          <Text style={styles.brand}>Escanear figurita</Text>
          <View style={{ width: 44 }} />
        </View>

        {permissionDenied ? (
          <View style={styles.permissionPrompt}>
            <Text style={styles.permTitle}>Necesitamos la cámara</Text>
            <Text style={styles.permBody}>
              Habilitá el permiso desde los ajustes del navegador y volvé a abrir el escáner.
            </Text>
            <Pressable style={styles.primaryBtn} onPress={handleClose}>
              <Text style={styles.primaryBtnText}>Cerrar</Text>
            </Pressable>
          </View>
        ) : !isReview ? (
          <>
            {/* Frame overlay */}
            <View style={styles.frameWrapper} pointerEvents="none">
              <View style={styles.frame} />
              <Text style={styles.hint}>
                {supportsRealtime
                  ? '🎯 Apuntá al código y mantené firme'
                  : '🎯 Centrá el código y tocá el botón'}
              </Text>
            </View>

            {/* Bottom bar */}
            <View
              style={[
                styles.bottomBar,
                { paddingBottom: insets.bottom + spacing.lg },
              ]}
            >
              {state.kind === 'empty' || state.kind === 'error' ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{state.message}</Text>
                </View>
              ) : null}

              {!streamReady ? (
                <View style={styles.loadingCard}>
                  <ActivityIndicator color={colors.text} />
                  <Text style={styles.loadingText}>Encendiendo cámara…</Text>
                </View>
              ) : supportsRealtime ? (
                <View style={styles.realtimeBadge}>
                  <View style={styles.dotPulse} />
                  <Text style={styles.realtimeText}>Detectando código…</Text>
                </View>
              ) : (
                <Pressable
                  style={[styles.captureBtn, isBusy && styles.captureBtnDisabled]}
                  onPress={captureFallback}
                  disabled={isBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Capturar"
                >
                  {isBusy ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <View style={styles.captureInner} />
                  )}
                </Pressable>
              )}

              <Pressable
                style={styles.manualToggle}
                onPress={() =>
                  setState({ kind: 'review', candidates: [], selected: new Set() })
                }
                accessibilityRole="button"
              >
                <Text style={styles.manualToggleText}>O ingresá el código manual</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {isReview && state.kind === 'review' ? (
          <ScanResultSheet
            visible
            candidates={state.candidates}
            selected={state.selected}
            onToggle={toggleSelected}
            onConfirm={confirmSelected}
            onDismiss={dismiss}
            onAddManual={addManualCode}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 5,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  iconText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  brand: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  frameWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '85%',
    aspectRatio: 1.4,
    borderWidth: 4,
    borderColor: colors.accent,
    borderRadius: radii.md,
    backgroundColor: 'transparent',
  },
  hint: {
    marginTop: spacing.lg,
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingText: {
    color: colors.text,
    fontSize: 14,
  },
  realtimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0, 200, 83, 0.2)',
    borderColor: 'rgba(0, 200, 83, 0.6)',
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    marginVertical: spacing.md,
  },
  dotPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  realtimeText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  captureBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    marginVertical: spacing.md,
  },
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
  },
  manualToggle: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  manualToggleText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  errorCard: {
    backgroundColor: 'rgba(255,23,68,0.85)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
    maxWidth: 320,
  },
  errorText: {
    color: colors.text,
    fontSize: 13,
    textAlign: 'center',
  },
  permissionPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  permTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  permBody: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  primaryBtnText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
