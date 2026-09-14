import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported as isMessagingSupported } from 'firebase/messaging';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { supabase } from './supabase';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAdNgCvhIQwvkBovNmlEzi9DYs3xrPkVKU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'collegemate-bit.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'collegemate-bit',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'collegemate-bit.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '234271373538',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:234271373538:web:2b702d431c67ee191686bb',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-SG9NJL88XE',
};

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Analytics if supported in browser environment
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  });
}

/**
 * Check current browser notification permission status
 */
export function getNotificationPermissionState(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Register FCM device token for web and native push notifications
 */
export async function registerPushNotificationToken(userId: string): Promise<{ token: string | null; error: string | null }> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { token: null, error: 'Push notifications are not supported on this browser.' };
    }

    const supported = await isMessagingSupported();
    if (!supported) {
      return { token: null, error: 'FCM messaging is not supported in this browser environment.' };
    }

    // Request browser permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { token: null, error: 'Notification permission was denied by the user.' };
    }

    // Register service worker if available
    let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } catch (swErr) {
        console.warn('Service worker registration notice:', swErr);
      }
    }

    const messaging = getMessaging(app);
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    
    const token = await getToken(messaging, {
      vapidKey: vapidKey || undefined,
      serviceWorkerRegistration,
    });

    if (token && userId) {
      // Upsert token in notification_tokens table in Supabase
      const { error: dbError } = await supabase.from('notification_tokens').upsert(
        {
          user_id: userId,
          token,
          device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'MOBILE' : 'WEB',
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
          },
        },
        { onConflict: 'user_id, token' }
      );

      if (dbError) {
        console.warn('Could not save device token to database:', dbError.message);
      }
    }

    return { token, error: null };
  } catch (err: any) {
    console.error('Error during FCM token registration:', err);
    return { token: null, error: err.message || 'Failed to obtain FCM device token.' };
  }
}

/**
 * Setup foreground push notification listener with in-app banner callback
 */
export async function setupForegroundNotificationListener(
  onNotificationReceived: (payload: any) => void
) {
  try {
    const supported = await isMessagingSupported();
    if (!supported) return;

    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      // Display native browser notification if app is in background or show banner
      if (Notification.permission === 'granted') {
        const title = payload.notification?.title || payload.data?.title || 'CampusMate Update';
        const options = {
          body: payload.notification?.body || payload.data?.body || 'You received a new campus notification.',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        };
        try {
          new Notification(title, options);
        } catch {
          // In environments where Notification constructor requires service worker
        }
      }
      onNotificationReceived(payload);
    });
  } catch (err) {
    console.error('Error in foreground message listener:', err);
  }
}

/**
 * Send an immediate browser notification directly to the user's device
 */
export function showLocalDeviceNotification(title: string, body: string, icon = '/favicon.ico') {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon,
      });
    } catch (err) {
      console.warn('Could not display local notification:', err);
    }
  }
}

