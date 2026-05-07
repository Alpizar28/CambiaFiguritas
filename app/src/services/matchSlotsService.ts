import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export type ConsumeSlotResult = {
  ok: boolean;
  remaining: number;
  cap: number;
  premium: boolean;
  resetAt: number;
  reason?: string;
};

export type UnlockSlotResult = {
  granted: boolean;
  remaining: number;
  reason?: string;
  nextDurationMs?: number;
};

const consumeMatchSlotFn = httpsCallable<{ tz?: string }, ConsumeSlotResult>(functions, 'consumeMatchSlot');
const unlockMatchSlotFn = httpsCallable<{ tz?: string }, UnlockSlotResult>(functions, 'unlockMatchSlot');

function detectTz(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export async function consumeMatchSlot(): Promise<ConsumeSlotResult> {
  const result = await consumeMatchSlotFn({ tz: detectTz() });
  return result.data;
}

export async function unlockMatchSlot(): Promise<UnlockSlotResult> {
  const result = await unlockMatchSlotFn({ tz: detectTz() });
  return result.data;
}
