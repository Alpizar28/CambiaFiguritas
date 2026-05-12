import { Platform } from 'react-native';
import { getApps, getApp } from 'firebase/app';
import { doc } from 'firebase/firestore';
import { db } from './firebase';

// VAPID key pública. Generar en Firebase Console → Settings → Cloud Messaging → Web Push certificates.
// Sin EXPO_PUBLIC_FIREBASE_VAPID_KEY: no-op (push deshabilitado).
const VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;

let initialized = false;

export async function initPushNotifications(uid: string | null): Promise<void> {
  if (initialized) return;
  if (Platform.OS !== 'web') return;
  if (!uid) return;
  if (!VAPID_KEY) {
    if (__DEV__) console.log('[push] sin VAPID_KEY, no-op');
    return;
  }
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return;

  initialized = true;

  try {
    // Pedir permiso. Si denegado/no decidido, no fuerza.
    if (Notification.permission === 'default') {
      const granted = await Notification.requestPermission();
      if (granted !== 'granted') {
        if (__DEV__) console.log('[push] permiso denegado:', granted);
        return;
      }
    } else if (Notification.permission === 'denied') {
      return;
    }

    // Lazy import para no inflar bundle si no se usa.
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');
    const app = getApps().length > 0 ? getApp() : null;
    if (!app) return;
    const messaging = getMessaging(app);

    const swReg = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (!token) {
      if (__DEV__) console.log('[push] no se pudo obtener token');
      return;
    }

    // El FCM token es sensible (permite push targeted). Vive en una subcollection privada
    // legible solo por el dueño; las Cloud Functions lo leen vía admin SDK que bypassea rules.
    const { setDoc, serverTimestamp } = await import('firebase/firestore');
    await setDoc(
      doc(db, `users/${uid}/private/notifications`),
      { fcmToken: token, updatedAt: serverTimestamp() },
      { merge: true },
    );
    if (__DEV__) console.log('[push] token registrado');

    // Foreground messages: mostrar manualmente (FCM no las muestra cuando tab activa).
    onMessage(messaging, (payload) => {
      if (__DEV__) console.log('[push] foreground msg:', payload);
      const title = payload.notification?.title ?? 'CambiaFiguritas';
      const body = payload.notification?.body ?? '';
      try {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        });
      } catch {
        // Algunos browsers requieren SW registration para Notification API.
      }
    });
  } catch (e) {
    if (__DEV__) console.error('[push] init error:', e);
  }
}
