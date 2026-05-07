import { Platform, Share } from 'react-native';

type ShareResult = 'shared' | 'copied' | 'cancelled' | 'error';

/**
 * Comparte texto cross-platform.
 * - Native: Share.share (sheet nativo).
 * - Web con navigator.share (mobile browsers): usa share sheet.
 * - Web sin navigator.share (desktop): copia al clipboard.
 */
export async function shareText(message: string, url?: string): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    const navAny = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (navAny?.share) {
      try {
        await navAny.share({ text: message, url });
        return 'shared';
      } catch (e: any) {
        if (e?.name === 'AbortError') return 'cancelled';
        return 'error';
      }
    }
    if (navAny?.clipboard?.writeText) {
      try {
        await navAny.clipboard.writeText(`${message}${url ? ' ' + url : ''}`);
        return 'copied';
      } catch {
        return 'error';
      }
    }
    return 'error';
  }

  try {
    const result = await Share.share({
      message: url ? `${message} ${url}` : message,
    });
    if (result.action === Share.dismissedAction) return 'cancelled';
    return 'shared';
  } catch {
    return 'error';
  }
}
