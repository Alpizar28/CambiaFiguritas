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

const EMPTY_MESSAGE =
  'No detectamos figuritas. Probá con más luz o acercá la cámara al código.';
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

export function ScanScreen({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<ScanState>({ kind: 'idle' });
  const inFlight = useRef(false);

  useEffect(() => {
    if (visible) {
      track({ name: 'scan_opened' });
    } else {
      setState({ kind: 'idle' });
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      void disposeOcrEngine();
    };
  }, []);

  const handlePickFile = useCallback((file: File) => {
    if (inFlight.current) return;
    inFlight.current = true;
    track({ name: 'scan_capture_started' });
    setState({ kind: 'recognizing' });

    const start = Date.now();
    recognizeText(file)
      .then((blocks) => {
        const durationMs = Date.now() - start;
        const parsed = parseOCRBlocks(blocks);
        track({
          name: 'scan_recognized',
          params: { candidates: parsed.length, durationMs },
        });
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
      })
      .catch((error) => {
        track({
          name: 'scan_capture_failed',
          params: { reason: getErrorMessage(error).slice(0, 60) },
        });
        setState({ kind: 'error', message: ERROR_MESSAGE });
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, []);

  const triggerCapture = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePickFile(file);
    e.target.value = '';
  };

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
        return {
          kind: 'review',
          candidates: [candidate],
          selected: new Set([sticker.id]),
        };
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
  }, []);

  const handleClose = () => {
    dismiss();
    onClose();
  };

  const isBusy = state.kind === 'recognizing';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
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
          <Text style={styles.title}>Escanear figurita</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.body}>
          <View style={styles.illustration}>
            <Text style={styles.bigIcon}>📷</Text>
          </View>
          <Text style={styles.heading}>Sacale una foto al dorso</Text>
          <Text style={styles.subheading}>
            Usamos OCR local en tu navegador para detectar el código
            (ARG17, BRA12, FWC1...). La foto no se sube a ningún lado.
          </Text>

          {state.kind === 'empty' || state.kind === 'error' ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{state.message}</Text>
            </View>
          ) : null}

          <input
            ref={inputRef as never}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange as never}
            style={{ display: 'none' } as never}
          />

          <Pressable
            style={[styles.captureBtn, isBusy && styles.captureBtnDisabled]}
            onPress={triggerCapture}
            disabled={isBusy}
            accessibilityRole="button"
          >
            {isBusy ? (
              <>
                <ActivityIndicator color={colors.background} />
                <Text style={styles.captureBtnText}>Procesando…</Text>
              </>
            ) : (
              <>
                <Text style={styles.captureIcon}>📸</Text>
                <Text style={styles.captureBtnText}>Tomar foto</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() =>
              setState({ kind: 'review', candidates: [], selected: new Set() })
            }
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>O ingresá el código manual</Text>
          </Pressable>

          <View style={styles.tipsBox}>
            <Text style={styles.tipsTitle}>💡 Para mejor detección</Text>
            <Text style={styles.tipText}>· Buena luz, sin reflejos</Text>
            <Text style={styles.tipText}>· Acercá hasta llenar la foto</Text>
            <Text style={styles.tipText}>· El código tiene que estar nítido</Text>
          </View>
        </View>

        {state.kind === 'review' ? (
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
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  iconText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  illustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  bigIcon: {
    fontSize: 56,
  },
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subheading: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
    maxWidth: 320,
  },
  errorCard: {
    backgroundColor: 'rgba(255,23,68,0.18)',
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,23,68,0.5)',
  },
  errorText: {
    color: colors.text,
    fontSize: 13,
    textAlign: 'center',
  },
  captureBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 240,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureIcon: {
    fontSize: 22,
  },
  captureBtnText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryBtn: {
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  secondaryBtnText: {
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  tipsBox: {
    marginTop: spacing.xl,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radii.sm,
    width: '100%',
    maxWidth: 360,
  },
  tipsTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  tipText: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
