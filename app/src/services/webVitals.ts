import { Platform } from 'react-native';
import { track } from './analytics';

let started = false;

export function initWebVitals(): void {
  if (started) return;
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;
  started = true;

  // Lazy import: no se incluye en bundle native, y se difiere en web.
  import('web-vitals')
    .then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
      const report = (metric: { name: string; value: number; rating: string }) => {
        track({
          name: 'web_vital_reported',
          params: {
            metric: metric.name,
            value: Math.round(metric.value * 1000) / 1000,
            rating: metric.rating,
          },
        });
      };
      onCLS(report);
      onINP(report);
      onLCP(report);
      onFCP(report);
      onTTFB(report);
    })
    .catch(() => {
      // Silent fail. web-vitals nunca rompe UX.
    });
}
