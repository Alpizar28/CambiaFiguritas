import type { Sticker, StickerStatus } from '../album/types';

export type ScannedCandidate = {
  stickerId: string;
  sticker: Sticker;
  currentStatus: StickerStatus;
  currentRepeatedCount: number;
  rawText: string;
};

export type ScanState =
  | { kind: 'idle' }
  | { kind: 'capturing' }
  | { kind: 'recognizing' }
  | { kind: 'review'; candidates: ScannedCandidate[]; selected: Set<string> }
  | { kind: 'empty'; message: string }
  | { kind: 'error'; message: string };

export type RecognizedTextLine = {
  text: string;
  confidence?: number;
};

export type RecognizedTextBlock = {
  text: string;
  lines: RecognizedTextLine[];
};
