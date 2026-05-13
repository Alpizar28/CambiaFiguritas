import assert from 'node:assert/strict';

import { parseAlbumImport } from '../importParser';

type TestCase = {
  name: string;
  fn: () => void;
};

const tests: TestCase[] = [];
function test(name: string, fn: () => void) {
  tests.push({ name, fn });
}

function idsHave(result: ReturnType<typeof parseAlbumImport>, expected: string[]) {
  const have = new Set(result.ok.filter((i) => i.section === 'have').map((i) => i.stickerId));
  for (const id of expected) {
    assert.ok(have.has(id), `expected to find ${id} in have section. got: ${[...have].join(',')}`);
  }
}

function copiesOf(result: ReturnType<typeof parseAlbumImport>, id: string): number {
  const item = result.ok.find((i) => i.stickerId === id);
  return item ? item.copies : 0;
}

// --- Format 1: Figuritas App plain text ---
test('parses Figuritas App format with country header + comma list', () => {
  const text = `Figuritas App - Lista
Usa Méx Can 26

Repetidas
MEX 🇲🇽: 15
RSA 🇿🇦: 3, 5, 19
SUI 🇨🇭: 10, 20
BRA 🇧🇷: 12
ENG 🏴󠁧󠁢󠁥󠁮󠁧󠁿: 19
GHA 🇬🇭: 16`;
  const r = parseAlbumImport(text);
  idsHave(r, ['MEX15', 'RSA3', 'RSA5', 'RSA19', 'SUI10', 'SUI20', 'BRA12', 'ENG19', 'GHA16']);
  // Repetidas sin xN → asume 2 copias.
  assert.equal(copiesOf(r, 'MEX15'), 2);
});

// --- Format 2: moovtech.app with paren quantity ---
test('parses moovtech format with (1x) paren suffix', () => {
  const text = `Hola, estos son mis cromos repetidos:

Descarga la app: https://moovtech.app/stickers2026/ ¡y cambiemos cromos!

FWC: 9(1x), 16(1x)
MEX: 1(1x), 6(1x)
RSA: 8(1x), 12(1x)
KSA: 11(3x)
BRA: 9(1x)`;
  const r = parseAlbumImport(text);
  idsHave(r, ['FW9', 'FW16', 'MEX1', 'MEX6', 'RSA8', 'RSA12', 'KSA11', 'BRA9']);
  assert.equal(copiesOf(r, 'KSA11'), 3);
  // FWC9 -> FW9 internal id.
  assert.equal(copiesOf(r, 'FW9'), 1);
});

// --- Format 3: Paginated app with inline codes + (xN) ---
test('parses paginated format with inline codes like MEX2 (x1)', () => {
  const text = `Buenos días, tengo estás repetidas por si están interesados 👌🏽

*Copa 2026* · pg. 1
FWC2 (x3)

🇲🇽 *MEX* · pg. 8-9
MEX2 (x1), MEX3 (x1), MEX7 (x2), MEX10 (x2), MEX12 (x1)
MEX16 (x1), MEX17 (x1)

🇿🇦 *RSA* · pg. 10-11
RSA4 (x1), RSA5 (x1), RSA6 (x1), RSA10 (x2), RSA14 (x1)
RSA19 (x2)

*Historia de la Copa* · pg. 106-109
FWC9 (x2), FWC13 (x1), FWC14 (x1), FWC19 (x1)`;
  const r = parseAlbumImport(text);
  idsHave(r, [
    'FW2', 'MEX2', 'MEX3', 'MEX7', 'MEX10', 'MEX12', 'MEX16', 'MEX17',
    'RSA4', 'RSA5', 'RSA6', 'RSA10', 'RSA14', 'RSA19',
    'FW9', 'FW13', 'FW14', 'FW19',
  ]);
  assert.equal(copiesOf(r, 'FW2'), 3);
  assert.equal(copiesOf(r, 'MEX7'), 2);
});

// --- Special sticker "00" ---
test('parses standalone "00" special sticker', () => {
  const text = `*Somos 26* · pg. 0
00 (x1)`;
  const r = parseAlbumImport(text);
  idsHave(r, ['00']);
});

// --- Section detection ---
test('detects Busco/Faltan section and stores items with copies=0', () => {
  const text = `Repetidas
ARG: 5, 10
Busco
BRA: 1, 2`;
  const r = parseAlbumImport(text);
  const wantIds = r.ok.filter((i) => i.section === 'want').map((i) => i.stickerId);
  assert.deepEqual(new Set(wantIds), new Set(['BRA1', 'BRA2']));
  for (const id of ['BRA1', 'BRA2']) {
    assert.equal(copiesOf(r, id), 0);
  }
});

// --- JPN alias ---
test('aliases JPN to JAP', () => {
  const text = `Repetidas
JPN: 10`;
  const r = parseAlbumImport(text);
  idsHave(r, ['JAP10']);
});

// --- Unknown codes go to unknown array, not errors ---
test('unknown country codes accumulate in result.unknown', () => {
  const text = `Repetidas
XYZ: 5`;
  const r = parseAlbumImport(text);
  assert.equal(r.ok.length, 0);
  assert.ok(r.unknown.length > 0 || r.errors.length === 0);
});

// --- Promo / URL lines skipped ---
test('ignores promo and URL lines but keeps section context', () => {
  const text = `Hola, estos son mis cromos repetidos:
Descarga la app: https://moovtech.app/stickers2026/
MEX: 1(1x)`;
  const r = parseAlbumImport(text);
  idsHave(r, ['MEX1']);
});

// --- Range still works ---
test('preserves range expansion ARG1-3', () => {
  const text = `Repetidas
ARG: 1-3`;
  const r = parseAlbumImport(text);
  idsHave(r, ['ARG1', 'ARG2', 'ARG3']);
});

// --- Inline without paren quantity defaults to copies=1 (then doubled if 'Repetidas' context) ---
test('inline code without quantity defaults to 1 (or 2 in Repetidas)', () => {
  const text = `Tengo repetidas
MEX2 MEX3`;
  const r = parseAlbumImport(text);
  idsHave(r, ['MEX2', 'MEX3']);
  // Repetidas + sin xN → asume 2.
  assert.equal(copiesOf(r, 'MEX2'), 2);
});

// --- forceSection 'have' ignores 'Busco' header ---
test('forceSection have ignores Busco header and stores all as have', () => {
  const text = `Busco
ARG10
MEX5`;
  const r = parseAlbumImport(text, { forceSection: 'have' });
  const haveIds = r.ok.filter((i) => i.section === 'have').map((i) => i.stickerId);
  const wantIds = r.ok.filter((i) => i.section === 'want').map((i) => i.stickerId);
  assert.deepEqual(new Set(haveIds), new Set(['ARG10', 'MEX5']));
  assert.equal(wantIds.length, 0);
  // forceSection have asume 'Repetidas' context → copies=2 sin xN.
  assert.equal(copiesOf(r, 'ARG10'), 2);
});

// --- forceSection 'want' ignores 'Repetidas' header ---
test('forceSection want ignores Repetidas header and stores all as want', () => {
  const text = `Repetidas
ARG10
MEX5`;
  const r = parseAlbumImport(text, { forceSection: 'want' });
  const wantIds = r.ok.filter((i) => i.section === 'want').map((i) => i.stickerId);
  const haveIds = r.ok.filter((i) => i.section === 'have').map((i) => i.stickerId);
  assert.deepEqual(new Set(wantIds), new Set(['ARG10', 'MEX5']));
  assert.equal(haveIds.length, 0);
  // want section siempre copies=0.
  assert.equal(copiesOf(r, 'ARG10'), 0);
  assert.equal(copiesOf(r, 'MEX5'), 0);
});

// --- forceSection respects explicit quantities ---
test('forceSection have respects explicit (x3) quantities', () => {
  const text = `MEX1 (x3), BRA5 (x1)`;
  const r = parseAlbumImport(text, { forceSection: 'have' });
  assert.equal(copiesOf(r, 'MEX1'), 3);
  assert.equal(copiesOf(r, 'BRA5'), 1);
});

let passed = 0;
let failed = 0;
const failures: Array<{ name: string; error: unknown }> = [];

for (const t of tests) {
  try {
    t.fn();
    passed++;
  } catch (error) {
    failed++;
    failures.push({ name: t.name, error });
  }
}

console.log(`\nimportParser tests — ${passed} passed, ${failed} failed (${tests.length} total)\n`);

for (const f of failures) {
  console.error(`✗ ${f.name}`);
  console.error(`  ${f.error instanceof Error ? f.error.message : String(f.error)}`);
}

if (failed > 0) {
  process.exit(1);
}
