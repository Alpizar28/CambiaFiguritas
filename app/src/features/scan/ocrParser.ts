import { allStickers } from '../album/data/albumCatalog';
import type { Sticker } from '../album/types';
import type { RecognizedTextBlock } from './types';

const stickerById: Map<string, Sticker> = new Map(allStickers.map((s) => [s.id, s]));

const PRINT_PREFIX_TO_INTERNAL: Record<string, string> = {
  FWC: 'FW',
};

const STANDALONE_SPECIALS: Record<string, string> = {
  FIFA: 'Fifa',
  '00': '00',
};

function basicNormalize(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');
}

// OCR commonly confuses these characters when the token is "letters then digits".
// We only fix DIGIT positions (suffix after the 3-letter prefix), never the prefix.
function fixOCRConfusables(token: string): string {
  // Match prefix (3-4 letters) + suffix (rest)
  const m = token.match(/^([A-Z]{3,4})(.+)$/);
  if (!m) return token;
  const [, prefix, suffix] = m;
  const digitsOnly = suffix
    .replace(/O/g, '0')
    .replace(/Q/g, '0')
    .replace(/D/g, '0')
    .replace(/I/g, '1')
    .replace(/L/g, '1')
    .replace(/T/g, '7')
    .replace(/Z/g, '2')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    .replace(/G/g, '6');
  return prefix + digitsOnly;
}

function lookupSticker(internalId: string): Sticker | null {
  if (internalId === 'CZE16') {
    return stickerById.get('Che16') ?? null;
  }
  return stickerById.get(internalId) ?? null;
}

export type ParsedToken = {
  stickerId: string;
  sticker: Sticker;
  rawText: string;
  confidence: number;
};

export function parseToken(rawToken: string, rawText: string, confidence: number): ParsedToken | null {
  const normalized = basicNormalize(rawToken);
  if (!normalized) return null;

  const standalone = STANDALONE_SPECIALS[normalized];
  if (standalone) {
    const sticker = stickerById.get(standalone);
    return sticker ? { stickerId: sticker.id, sticker, rawText, confidence } : null;
  }

  const fixed = fixOCRConfusables(normalized);
  const match = fixed.match(/^([A-Z]{3,4})(\d{1,2})$/);
  if (!match) return null;

  const [, prefix, num] = match;
  const internalPrefix = PRINT_PREFIX_TO_INTERNAL[prefix] ?? prefix;
  const candidateId = `${internalPrefix}${num}`;
  const sticker = lookupSticker(candidateId);
  return sticker ? { stickerId: sticker.id, sticker, rawText, confidence } : null;
}

function tokenizeLine(text: string): string[] {
  const splitTokens = text.split(/[\s/\\\-_,;:.()]+/).filter(Boolean);
  const candidates = new Set<string>();

  for (const token of splitTokens) {
    candidates.add(token);
  }

  for (let i = 0; i < splitTokens.length - 1; i++) {
    candidates.add(`${splitTokens[i]}${splitTokens[i + 1]}`);
  }

  candidates.add(text.replace(/\s+/g, ''));

  return Array.from(candidates);
}

export type ParserOutput = {
  stickerId: string;
  sticker: Sticker;
  rawText: string;
  confidence: number;
};

export function parseOCRBlocks(blocks: RecognizedTextBlock[]): ParserOutput[] {
  const found = new Map<string, ParserOutput>();
  for (const block of blocks) {
    for (const line of block.lines) {
      const text = line.text ?? '';
      if (!text) continue;
      const lineConfidence = line.confidence ?? 0.7;
      for (const token of tokenizeLine(text)) {
        const parsed = parseToken(token, text, lineConfidence);
        if (!parsed) continue;
        const existing = found.get(parsed.stickerId);
        if (!existing || parsed.confidence > existing.confidence) {
          found.set(parsed.stickerId, parsed);
        }
      }
    }
  }
  return Array.from(found.values()).sort((a, b) => b.confidence - a.confidence);
}

export function lookupStickerByCode(rawCode: string): Sticker | null {
  return parseToken(rawCode, rawCode, 1)?.sticker ?? null;
}
