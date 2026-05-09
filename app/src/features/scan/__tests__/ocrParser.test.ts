import assert from 'node:assert/strict';

import { parseOCRBlocks, parseToken, lookupStickerByCode } from '../ocrParser';
import type { RecognizedTextBlock } from '../types';

type TestCase = {
  name: string;
  fn: () => void;
};

const tests: TestCase[] = [];
function test(name: string, fn: () => void) {
  tests.push({ name, fn });
}

function block(...lines: string[]): RecognizedTextBlock {
  return {
    text: lines.join('\n'),
    lines: lines.map((text) => ({ text, confidence: 0.9 })),
  };
}

test('parseToken accepts plain country code with slot number', () => {
  const r = parseToken('ARG17', 'ARG17', 0.9);
  assert.ok(r);
  assert.equal(r?.stickerId, 'ARG17');
});

test('parseToken accepts code with whitespace ("BRA 2")', () => {
  const r = parseToken('BRA 2', 'BRA 2', 0.9);
  assert.ok(r);
  assert.equal(r?.stickerId, 'BRA2');
});

test('parseToken maps print FWC1 -> internal FW1', () => {
  const r = parseToken('FWC1', 'FWC1', 0.9);
  assert.ok(r);
  assert.equal(r?.stickerId, 'FW1');
});

test('parseToken maps FIFA -> Fifa special', () => {
  const r = parseToken('FIFA', 'FIFA', 0.9);
  assert.ok(r);
  assert.equal(r?.stickerId, 'Fifa');
});

test('parseToken maps 00 -> Panini logo special', () => {
  const r = parseToken('00', '00', 0.9);
  assert.ok(r);
  assert.equal(r?.stickerId, '00');
});

test('parseToken maps CZE16 -> Che16 (special displayCode for Czech 16)', () => {
  const r = parseToken('CZE16', 'CZE16', 0.9);
  assert.ok(r);
  assert.equal(r?.stickerId, 'Che16');
});

test('parseToken normalizes O->0 in slot number ("ARG1O" -> ARG10)', () => {
  const r = parseToken('ARG1O', 'ARG1O', 0.9);
  assert.ok(r);
  assert.equal(r?.stickerId, 'ARG10');
});

test('parseToken rejects unknown country code (8RA17 stays unmapped)', () => {
  // 8 doesn't normalize, prefix invalid
  const r = parseToken('8RA17', '8RA17', 0.9);
  assert.equal(r, null);
});

test('parseToken rejects unknown 3-letter code (XYZ5)', () => {
  const r = parseToken('XYZ5', 'XYZ5', 0.9);
  assert.equal(r, null);
});

test('parseToken rejects out-of-range slot (ARG99)', () => {
  const r = parseToken('ARG99', 'ARG99', 0.9);
  assert.equal(r, null);
});

test('parseToken rejects empty / random text', () => {
  assert.equal(parseToken('', '', 0.9), null);
  assert.equal(parseToken('hello', 'hello', 0.9), null);
  assert.equal(parseToken('1234', '1234', 0.9), null);
});

test('parseOCRBlocks dedupes same sticker across blocks (keeps highest confidence)', () => {
  const blocks: RecognizedTextBlock[] = [
    {
      text: 'ARG17',
      lines: [{ text: 'ARG17', confidence: 0.6 }],
    },
    {
      text: 'ARG17',
      lines: [{ text: 'ARG17', confidence: 0.95 }],
    },
  ];
  const r = parseOCRBlocks(blocks);
  assert.equal(r.length, 1);
  assert.equal(r[0]?.stickerId, 'ARG17');
  assert.equal(r[0]?.confidence, 0.95);
});

test('parseOCRBlocks returns multiple stickers from a multi-figurita photo', () => {
  const blocks: RecognizedTextBlock[] = [
    block('ARG17', 'Lionel Messi', 'Panini'),
    block('BRA 2', 'Vinicius', 'Panini'),
    block('FWC1', 'Emblem'),
  ];
  const r = parseOCRBlocks(blocks);
  const ids = r.map((c) => c.stickerId).sort();
  assert.deepEqual(ids, ['ARG17', 'BRA2', 'FW1']);
});

test('parseOCRBlocks finds MEX5 amongst noise lines', () => {
  const blocks: RecognizedTextBlock[] = [
    block(
      'All rights reserved',
      'MEX5',
      'Made in Italy',
    ),
  ];
  const r = parseOCRBlocks(blocks);
  const ids = r.map((c) => c.stickerId);
  assert.ok(ids.includes('MEX5'));
});

test('parseOCRBlocks detects FIFA-only token as the Fifa special sticker', () => {
  const blocks: RecognizedTextBlock[] = [block('FIFA')];
  const r = parseOCRBlocks(blocks);
  assert.ok(r.some((c) => c.stickerId === 'Fifa'));
});

test('parseOCRBlocks handles tokens separated by punctuation', () => {
  const blocks: RecognizedTextBlock[] = [
    block('ESP-12 / POR-3'),
  ];
  const r = parseOCRBlocks(blocks);
  const ids = r.map((c) => c.stickerId).sort();
  assert.deepEqual(ids, ['ESP12', 'POR3']);
});

test('parseOCRBlocks returns empty array when no candidates found', () => {
  const blocks: RecognizedTextBlock[] = [block('Lorem ipsum dolor sit amet')];
  assert.deepEqual(parseOCRBlocks(blocks), []);
});

test('lookupStickerByCode helper accepts user manual entry "mex5"', () => {
  const s = lookupStickerByCode('mex5');
  assert.ok(s);
  assert.equal(s?.id, 'MEX5');
});

test('lookupStickerByCode handles uppercase + spaces ("BRA 2")', () => {
  const s = lookupStickerByCode('BRA 2');
  assert.ok(s);
  assert.equal(s?.id, 'BRA2');
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

console.log(`\nocrParser tests — ${passed} passed, ${failed} failed (${tests.length} total)\n`);

for (const f of failures) {
  console.error(`✗ ${f.name}`);
  console.error(`  ${f.error instanceof Error ? f.error.message : String(f.error)}`);
}

if (failed > 0) {
  process.exit(1);
}
