import { allStickersWithCocaCola } from '../data/albumCatalog';
import { countries } from '../data/countries';

export type ImportSection = 'have' | 'want';

export type ImportItem = {
  stickerId: string;
  copies: number;
  section: ImportSection;
};

export type ImportResult = {
  ok: ImportItem[];
  unknown: string[];
  errors: string[];
};

export type ImportOptions = {
  // Si true, items en seccion 'Repetidas' sin xN explicito se interpretan como copies=2.
  // Si false, copies=1 (solo pegada).
  assumeRepeatedDoublesCount?: boolean;
  // Si esta presente, fuerza toda la entrada a esa seccion ignorando los
  // encabezados 'Repetidas'/'Busco'. Usado cuando la UI tiene campos separados
  // y no necesita auto-deteccion.
  forceSection?: ImportSection;
};

const VALID_STICKER_IDS = new Set(allStickersWithCocaCola.map((s) => s.id));

const COUNTRY_CODES = new Set(countries.map((c) => c.code.toUpperCase()));

const COUNTRY_ALIAS: Record<string, string> = {
  JPN: 'JAP',
};

const STRIP_EMOJI =
  /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}️‍\u{E0020}-\u{E007F}\u{1F3F4}]/gu;

function stripEmojis(line: string): string {
  return line.replace(STRIP_EMOJI, '').replace(/\s+/g, ' ').trim();
}

// Convierte cantidad en parentesis a sufijo xN para uniformar tokens.
//   "MEX1 (x3)" -> "MEX1 x3"
//   "MEX1(1x)"  -> "MEX1 x1"
//   "11(3x)"    -> "11 x3"
function normalizeParenQuantity(line: string): string {
  return line.replace(/\(\s*x?\s*(\d+)\s*x?\s*\)/gi, ' x$1');
}

// Quita decoraciones markdown bold/italic que rodean codigos en algunos formatos.
function stripDecorations(line: string): string {
  return line.replace(/[*_`~]/g, '').trim();
}

function isHaveSectionHeader(line: string): boolean {
  const lower = line.toLowerCase();
  return /\b(repetidas?|repetidos?|tenidas?|mi\s*album|tengo)\b/.test(lower);
}

function isWantSectionHeader(line: string): boolean {
  const lower = line.toLowerCase();
  return /\b(busco|me\s*faltan|wishlist|necesito|faltantes?|faltan)\b/.test(lower);
}

function normalizePrefix(prefix: string): string {
  const upper = prefix.toUpperCase();
  return COUNTRY_ALIAS[upper] ?? upper;
}

// Construye el sticker id interno desde prefix + slot.
// FWC display -> FW internal. FWC00 -> "00". CC se mantiene. Country normal: ARG1, etc.
function buildStickerId(prefix: string, slot: string): string | null {
  const cleanSlot = slot.trim();
  if (prefix === 'FWC' || prefix === 'FW') {
    if (cleanSlot === '00' || cleanSlot === '0') return '00';
    const n = parseInt(cleanSlot, 10);
    if (Number.isNaN(n) || n < 1 || n > 19) return null;
    return `FW${n}`;
  }
  if (prefix === 'CC') {
    const n = parseInt(cleanSlot, 10);
    if (Number.isNaN(n) || n < 1 || n > 12) return null;
    return `CC${n}`;
  }
  if (COUNTRY_CODES.has(prefix)) {
    const n = parseInt(cleanSlot, 10);
    if (Number.isNaN(n) || n < 1 || n > 20) return null;
    // CZE16 caso especial: displayCode = "Che16" pero id interno = "CZE16"
    return `${prefix}${n}`;
  }
  return null;
}

function isKnownPrefix(prefix: string): boolean {
  return COUNTRY_CODES.has(prefix) || prefix === 'FWC' || prefix === 'FW' || prefix === 'CC';
}

type InlineToken = { prefix: string; slot: string; copies: number; explicit: boolean; raw: string };

// Extrae tokens completos inline: "MEX2", "MEX2 x3", "FWC9 x2", "00 x1".
// Solo emite tokens con prefijos conocidos para evitar falsos positivos
// como "Stickers2026" o "Copa2026".
function tokenizeInlineCodes(line: string): InlineToken[] {
  const out: InlineToken[] = [];
  const reCoded = /(?:^|[^A-Za-z0-9])([A-Z]{2,4})(\d{1,2})(?:\s*x\s*(\d+))?(?![A-Za-z0-9])/gi;
  let m: RegExpExecArray | null;
  while ((m = reCoded.exec(line)) !== null) {
    const prefix = m[1].toUpperCase();
    if (!isKnownPrefix(prefix)) continue;
    const explicit = m[3] !== undefined;
    const copies = explicit ? Math.max(1, parseInt(m[3]!, 10) || 1) : 1;
    out.push({ prefix, slot: m[2], copies, explicit, raw: `${prefix}${m[2]}` });
  }
  const reZero = /(?:^|[^A-Za-z0-9])(00)(?:\s*x\s*(\d+))?(?![A-Za-z0-9])/g;
  while ((m = reZero.exec(line)) !== null) {
    const explicit = m[2] !== undefined;
    const copies = explicit ? Math.max(1, parseInt(m[2]!, 10) || 1) : 1;
    out.push({ prefix: 'FW', slot: '00', copies, explicit, raw: '00' });
  }
  return out;
}

function isIgnorableLine(line: string): boolean {
  if (!line) return true;
  if (line.startsWith('#')) return true;
  if (/^[─-╿=\-_·•\s]+$/.test(line)) return true;
  if (/^(hola|buenas|buenos d[ií]as|buenas tardes|gracias|saludos)\b/i.test(line)) return true;
  if (/cambiemos cromos|estos son mis cromos|por si est[aá]n interesados/i.test(line)) {
    return true;
  }
  if (/^p[aá]?g\.?\s*\d+/i.test(line)) return true;
  return false;
}

type SlotToken =
  | { kind: 'single'; slot: string; copies: number; explicit: boolean }
  | { kind: 'range'; from: number; to: number; copies: number; explicit: boolean };

// Parsea un slot string: "5", "5x3", "1-10", "1-10x2"
function parseSlotToken(raw: string): SlotToken | { kind: 'error'; raw: string } {
  const token = raw.trim();
  if (!token) return { kind: 'error', raw };

  let copies = 1;
  let explicit = false;
  let body = token;
  const xMatch = token.match(/^(.+?)\s*x\s*(\d+)$/i);
  if (xMatch) {
    const c = parseInt(xMatch[2], 10);
    if (Number.isNaN(c) || c < 1) return { kind: 'error', raw };
    copies = c;
    explicit = true;
    body = xMatch[1].trim();
  }

  const rangeMatch = body.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const from = parseInt(rangeMatch[1], 10);
    const to = parseInt(rangeMatch[2], 10);
    if (Number.isNaN(from) || Number.isNaN(to) || from > to) return { kind: 'error', raw };
    return { kind: 'range', from, to, copies, explicit };
  }

  if (/^\d+$/.test(body)) {
    return { kind: 'single', slot: body, copies, explicit };
  }

  return { kind: 'error', raw };
}

export function parseAlbumImport(text: string, options: ImportOptions = {}): ImportResult {
  const assumeDouble = options.assumeRepeatedDoublesCount ?? true;
  const forceSection = options.forceSection;
  const result: ImportResult = { ok: [], unknown: [], errors: [] };
  const byId = new Map<string, ImportItem>();

  let section: ImportSection = forceSection ?? 'have';
  // Si esta forzado a 'have', asumimos repetidas (mismo contrato que header 'Repetidas').
  // Si esta forzado a 'want', no aplica repetidas (copies=0).
  let inRepetidasSection = forceSection === 'have';

  const recordSticker = (
    prefix: string,
    slot: string,
    copiesValue: number,
    isExplicit: boolean,
    rawLabel?: string,
  ): void => {
    const stickerId = buildStickerId(prefix, slot);
    if (!stickerId || !VALID_STICKER_IDS.has(stickerId)) {
      result.unknown.push(rawLabel ?? `${prefix}${slot}`);
      return;
    }
    let copies = copiesValue;
    // En seccion "Repetidas", si user no especifico cantidad, asumir 2 copias.
    // Si especifico (1x) → respetar el 1.
    if (section === 'have' && inRepetidasSection && !isExplicit) {
      copies = assumeDouble ? 2 : 1;
    }
    if (section === 'want') {
      copies = 0;
    }
    byId.set(stickerId, { stickerId, copies, section });
  };

  const rawLines = text.split(/\r?\n/);

  for (const rawLine of rawLines) {
    const stripped = stripDecorations(stripEmojis(rawLine));
    if (!stripped) continue;

    const hasUrl = /\bhttps?:\/\//i.test(stripped);

    // Si la UI fuerza la seccion, ignoramos detectores de encabezado.
    if (!forceSection) {
      if (isWantSectionHeader(stripped)) {
        section = 'want';
        inRepetidasSection = false;
      } else if (isHaveSectionHeader(stripped)) {
        section = 'have';
        inRepetidasSection = /\brepetid[ao]s?\b/i.test(stripped);
      }
    }

    if (hasUrl) continue;
    if (isIgnorableLine(stripped)) continue;

    const line = normalizeParenQuantity(stripped);

    // 1) Header-prefix pattern: "PREFIX: slot, slot, slot"
    const headerMatch = line.match(/^([A-Za-z]{2,4})\s*:\s*(.+)$/);
    if (headerMatch) {
      const prefix = normalizePrefix(headerMatch[1]);
      if (isKnownPrefix(prefix)) {
        const slotsRaw = headerMatch[2];
        const slotTokens = slotsRaw.split(',').map((s) => s.trim()).filter(Boolean);
        for (const slotRaw of slotTokens) {
          const token = parseSlotToken(slotRaw);
          if (token.kind === 'error') {
            result.errors.push(`${prefix}: ${slotRaw}`);
            continue;
          }
          const slots: { slot: string; copies: number }[] = [];
          if (token.kind === 'single') {
            slots.push({ slot: token.slot, copies: token.copies });
          } else {
            for (let n = token.from; n <= token.to; n++) {
              slots.push({ slot: String(n), copies: token.copies });
            }
          }
          for (const { slot, copies } of slots) {
            recordSticker(prefix, slot, copies, token.explicit);
          }
        }
        continue;
      }
      // Prefijo desconocido → caer al pipeline inline (la linea puede contener
      // codigos completos mezclados).
    }

    // 2) Inline tokens: "MEX2 x3", "FWC9", "00 x1" mezclados en la linea.
    const inlineTokens = tokenizeInlineCodes(line);
    for (const tok of inlineTokens) {
      recordSticker(tok.prefix, tok.slot, tok.copies, tok.explicit, tok.raw);
    }
  }

  result.ok = Array.from(byId.values());
  return result;
}
