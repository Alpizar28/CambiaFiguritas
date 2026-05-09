import { Platform } from 'react-native';

import type { RecognizedTextBlock } from './types';

/**
 * Recognize text from an image source.
 *
 * - Native (iOS/Android): uses Google ML Kit on-device (gratis, ~200-400ms).
 * - Web: uses Tesseract.js loaded lazily (Spanish + English, slower ~2-4s).
 *
 * Both paths discard the image after recognition. No upload.
 */
export async function recognizeText(source: string | Blob): Promise<RecognizedTextBlock[]> {
  if (Platform.OS === 'web') {
    return recognizeWeb(source);
  }
  return recognizeNative(source as string);
}

async function recognizeNative(uri: string): Promise<RecognizedTextBlock[]> {
  const { default: TextRecognition } = await import('@react-native-ml-kit/text-recognition');
  const result = await TextRecognition.recognize(uri);
  return result.blocks.map((b) => ({
    text: b.text,
    lines: b.lines.map((l) => ({ text: l.text })),
  }));
}

let tesseractWorkerPromise: Promise<unknown> | null = null;

async function getTesseractWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = import('tesseract.js').then(async (mod) => {
      const worker = await mod.createWorker(['eng'], 1, {
        logger: () => {},
      });
      return worker;
    });
  }
  return tesseractWorkerPromise as Promise<{
    recognize: (img: string | Blob) => Promise<{ data: { text: string; lines?: Array<{ text: string }> } }>;
    terminate: () => Promise<void>;
  }>;
}

async function recognizeWeb(source: string | Blob): Promise<RecognizedTextBlock[]> {
  const worker = await getTesseractWorker();
  const { data } = await worker.recognize(source);
  const lines = (data.lines ?? []).map((l) => ({ text: l.text.trim() })).filter((l) => l.text);
  return [
    {
      text: data.text,
      lines: lines.length ? lines : [{ text: data.text }],
    },
  ];
}

export async function disposeOcrEngine() {
  if (!tesseractWorkerPromise) return;
  try {
    const w = await tesseractWorkerPromise;
    await (w as { terminate: () => Promise<void> }).terminate();
  } catch {
    // ignore
  }
  tesseractWorkerPromise = null;
}
