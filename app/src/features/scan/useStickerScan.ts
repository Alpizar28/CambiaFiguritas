import { useCallback, useRef, useState } from 'react';
import type { CameraView } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';

import { useAlbumStore } from '../../store/albumStore';
import { track } from '../../services/analytics';
import { parseOCRBlocks, lookupStickerByCode } from './ocrParser';
import { recognizeText } from './ocrEngine';
import type { ScanState, ScannedCandidate } from './types';

const EMPTY_MESSAGE =
  'No detectamos figuritas. Probá con más luz o acercá la cámara al código.';
const ERROR_MESSAGE = 'No pudimos procesar la imagen. Volvé a intentar.';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return ERROR_MESSAGE;
}

async function deleteUriQuietly(uri: string | null) {
  if (!uri) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Best-effort cleanup. Ignore failures.
  }
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

export type UseStickerScanArgs = {
  cameraRef: React.RefObject<CameraView | null>;
  onAfterConfirm?: () => void;
};

export function useStickerScan({ cameraRef, onAfterConfirm }: UseStickerScanArgs) {
  const [state, setState] = useState<ScanState>({ kind: 'idle' });
  const inFlight = useRef(false);

  const reset = useCallback(() => {
    setState({ kind: 'idle' });
  }, []);

  const capture = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    let photoUri: string | null = null;
    setState({ kind: 'capturing' });
    track({ name: 'scan_capture_started' });

    try {
      const camera = cameraRef.current;
      if (!camera) {
        setState({ kind: 'error', message: ERROR_MESSAGE });
        track({ name: 'scan_capture_failed', params: { reason: 'no_camera_ref' } });
        return;
      }

      const photo = await camera.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
        exif: false,
      });

      if (!photo?.uri) {
        setState({ kind: 'error', message: ERROR_MESSAGE });
        track({ name: 'scan_capture_failed', params: { reason: 'no_uri' } });
        return;
      }

      photoUri = photo.uri;
      setState({ kind: 'recognizing' });

      const start = Date.now();
      const blocks = await recognizeText(photo.uri);
      const durationMs = Date.now() - start;

      await deleteUriQuietly(photoUri);
      photoUri = null;

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
    } catch (error) {
      track({
        name: 'scan_capture_failed',
        params: { reason: getErrorMessage(error).slice(0, 60) },
      });
      setState({ kind: 'error', message: ERROR_MESSAGE });
    } finally {
      await deleteUriQuietly(photoUri);
      inFlight.current = false;
    }
  }, [cameraRef]);

  const toggleSelected = useCallback((stickerId: string) => {
    setState((prev) => {
      if (prev.kind !== 'review') return prev;
      const next = new Set(prev.selected);
      if (next.has(stickerId)) {
        next.delete(stickerId);
      } else {
        next.add(stickerId);
      }
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
      for (const candidate of prev.candidates) {
        if (!prev.selected.has(candidate.stickerId)) continue;
        if (candidate.currentStatus === 'missing') {
          store.markOwned(candidate.stickerId);
          added++;
        } else {
          store.incrementRepeated(candidate.stickerId);
          incremented++;
        }
      }
      track({ name: 'scan_confirmed', params: { added, incremented } });
      return { kind: 'idle' };
    });
    onAfterConfirm?.();
  }, [onAfterConfirm]);

  const dismiss = useCallback(() => {
    setState((prev) => {
      if (prev.kind === 'review') {
        track({ name: 'scan_dismissed' });
      }
      return { kind: 'idle' };
    });
  }, []);

  return {
    state,
    capture,
    reset,
    toggleSelected,
    addManualCode,
    confirmSelected,
    dismiss,
  };
}
