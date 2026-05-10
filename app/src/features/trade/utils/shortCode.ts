const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateShortCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function isValidShortCode(code: string): boolean {
  return /^[A-Z2-9]{6}$/.test(code);
}

export function normalizeShortCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}
