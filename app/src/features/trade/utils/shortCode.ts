import * as Crypto from 'expo-crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SHORT_CODE_REGEX = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

const ACCEPT_THRESHOLD = Math.floor(256 / ALPHABET.length) * ALPHABET.length;

export function generateShortCode(length = 6): string {
  let out = '';
  while (out.length < length) {
    const need = length - out.length;
    const buf = Crypto.getRandomBytes(need * 2);
    for (let i = 0; i < buf.length && out.length < length; i += 1) {
      const byte = buf[i];
      if (byte < ACCEPT_THRESHOLD) {
        out += ALPHABET[byte % ALPHABET.length];
      }
    }
  }
  return out;
}

export function isValidShortCode(code: string): boolean {
  return SHORT_CODE_REGEX.test(code);
}

export function normalizeShortCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}
