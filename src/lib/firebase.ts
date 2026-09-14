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
isAnalyticsSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});

/**
 * Register FCM device token for web and native push notifications
 */
export async function registerPushNotificationToken(userId: string): Promise<string | null> {
  try {
    const supported = await isMessagingSupported();
    if (!supported) {
      console.warn('Firebase Cloud Messaging is not supported on this browser/platform.');
      return null;
    }

    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission was denied by user.');
      return null;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, { vapidKey: vapidKey || undefined });

    if (token && userId) {
      // Upsert token in notification_tokens table
      await supabase.from('notification_tokens').upsert(
        {
          user_id: userId,
          token,
          device_type: 'WEB',
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
          },
        },
        { onConflict: 'user_id, token' }
      );
    }

    return token;
  } catch (err) {
    console.error('Error during FCM token registration:', err);
    return null;
  }
}

/**
 * Setup foreground push notification listener
 */
export async function setupForegroundNotificationListener(
  onNotificationReceived: (payload: any) => void
) {
  try {
    const supported = await isMessagingSupported();
    if (!supported) return;

    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      onNotificationReceived(payload);
    });
  } catch (err) {
    console.error('Error in foreground message listener:', err);
  }
}
