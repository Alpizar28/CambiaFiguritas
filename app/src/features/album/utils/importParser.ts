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

function isHaveSectionHeader(line: string): boolean {
  const lower = line.toLowerCase();
  return /\b(repetidas?|tenidas?|mi\s*album|tengo)\b/.test(lower);
}

function isWantSectionHeader(line: string): boolean {
  const lower = line.toLowerCase();
  return /\b(busco|me\s*faltan|wishlist|necesito|faltantes?)\b/.test(lower);
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

type SlotToken =
  | { kind: 'single'; slot: string; copies: number }
  | { kind: 'range'; from: number; to: number; copies: number };

// Parsea un slot string: "5", "5x3", "1-10", "1-10x2"
function parseSlotToken(raw: string): SlotToken | { kind: 'error'; raw: string } {
  const token = raw.trim();
  if (!token) return { kind: 'error', raw };

  // Extraer xN al final si existe.
  let copies = 1;
  let body = token;
  const xMatch = token.match(/^(.+?)\s*x\s*(\d+)$/i);
  if (xMatch) {
    const c = parseInt(xMatch[2], 10);
    if (Number.isNaN(c) || c < 1) return { kind: 'error', raw };
    copies = c;
    body = xMatch[1].trim();
  }

  // Rango: 1-10
  const rangeMatch = body.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const from = parseInt(rangeMatch[1], 10);
    const to = parseInt(rangeMatch[2], 10);
    if (Number.isNaN(from) || Number.isNaN(to) || from > to) return { kind: 'error', raw };
    return { kind: 'range', from, to, copies };
  }

  // Single: numero plano o "00"
  if (/^\d+$/.test(body)) {
    return { kind: 'single', slot: body, copies };
  }

  return { kind: 'error', raw };
}

export function parseAlbumImport(text: string, options: ImportOptions = {}): ImportResult {
  const assumeDouble = options.assumeRepeatedDoublesCount ?? true;
  const result: ImportResult = { ok: [], unknown: [], errors: [] };
  const byId = new Map<string, ImportItem>();

  let section: ImportSection = 'have';
  let inRepetidasSection = false;

  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = stripEmojis(rawLine);
    if (!line) continue;
    if (line.startsWith('#')) continue;

    // URLs / texto suelto con http: → siempre ignorar como contenido,
    // pero igual detectar headers "Busco" / "Repetidas" embebidos.
    const hasUrl = /\bhttps?:\/\//i.test(line);

    // Detectar cambios de seccion (busco/repetidas pueden venir embebidos en cualquier linea).
    if (isWantSectionHeader(line)) {
      section = 'want';
      inRepetidasSection = false;
      // Si la linea solo es header (no tiene prefix:slots de figus), continuar.
      // Si tiene mas, seguir parseando con la nueva seccion activa.
      if (hasUrl || /^[^:]*$/.test(line) || !/^[A-Za-z]{2,4}\s*:/.test(line)) {
        continue;
      }
    } else if (isHaveSectionHeader(line)) {
      section = 'have';
      inRepetidasSection = /\brepetidas?\b/i.test(line);
      if (hasUrl || /^[^:]*$/.test(line) || !/^[A-Za-z]{2,4}\s*:/.test(line)) {
        continue;
      }
    }

    if (hasUrl) continue;

    // Linea con prefix:slots
    const lineMatch = line.match(/^([A-Za-z]{2,4})\s*:\s*(.+)$/);
    if (!lineMatch) continue;

    const prefixRaw = lineMatch[1];
    const slotsRaw = lineMatch[2];

    const prefix = normalizePrefix(prefixRaw);

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

      for (const { slot, copies: explicitCopies } of slots) {
        const stickerId = buildStickerId(prefix, slot);
        if (!stickerId || !VALID_STICKER_IDS.has(stickerId)) {
          result.unknown.push(`${prefix}${slot}`);
          continue;
        }

        let copies = explicitCopies;
        // En seccion "Repetidas", si user no especifico xN, asumir 2 copias.
        if (section === 'have' && inRepetidasSection && explicitCopies === 1) {
          copies = assumeDouble ? 2 : 1;
        }
        if (section === 'want') {
          copies = 0;
        }

        // Dedup: ultimo gana.
        byId.set(stickerId, { stickerId, copies, section });
      }
    }
  }

  result.ok = Array.from(byId.values());
  return result;
}
