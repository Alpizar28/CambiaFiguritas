import { useEffect, useRef } from 'react';

/**
 * Convert a remote (Google avatar, etc.) photoUrl to a JPEG dataURL via an
 * offscreen canvas. Avoids canvas CORS taint when later drawing into share
 * cards. Returns a ref that becomes populated once conversion succeeds; null
 * if CORS denies or the image fails to load.
 *
 * Web-only — on native or SSR the ref stays null.
 */
export function useGooglePhotoDataUrl(photoUrl: string | null | undefined): React.MutableRefObject<string | null> {
  const ref = useRef<string | null>(null);

  useEffect(() => {
    if (!photoUrl || ref.current || typeof document === 'undefined') return;
    const offscreen = document.createElement('canvas');
    const img = new (window as unknown as { Image: new () => HTMLImageElement }).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      offscreen.width = img.naturalWidth;
      offscreen.height = img.naturalHeight;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      try {
        ref.current = offscreen.toDataURL('image/jpeg', 0.9);
      } catch {
        // CORS taint — leave null and fall back to original URL at draw time.
      }
    };
    img.src = photoUrl;
  }, [photoUrl]);

  return ref;
}
