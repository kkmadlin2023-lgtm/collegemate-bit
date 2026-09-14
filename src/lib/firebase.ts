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

export type DeviceType = 'ANDROID' | 'IOS' | 'MOBILE' | 'TABLET' | 'DESKTOP' | 'WEB';

export interface DeviceMetadata {
  userAgent: string;
  platform: string;
  browser: string;
  os: string;
  deviceType: DeviceType;
  screenResolution: string;
  viewportSize: string;
  language: string;
  timezone: string;
  isStandalonePWA: boolean;
  isTouchDevice: boolean;
  online: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connectionType?: string;
  lastActiveAt: string;
}

/**
 * Extracts complete hardware, browser, and mobile environment details
 */
export function extractComprehensiveDeviceDetails(): { deviceType: DeviceType; metadata: DeviceMetadata } {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceType: 'WEB',
      metadata: {
        userAgent: 'SSR',
        platform: 'Server',
        browser: 'Node',
        os: 'Server',
        deviceType: 'WEB',
        screenResolution: '0x0',
        viewportSize: '0x0',
        language: 'en',
        timezone: 'UTC',
        isStandalonePWA: false,
        isTouchDevice: false,
        online: true,
        lastActiveAt: new Date().toISOString(),
      },
    };
  }

  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/i.test(ua);
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  let deviceType: DeviceType = 'WEB';
  if (isAndroid) deviceType = 'ANDROID';
  else if (isIOS) deviceType = 'IOS';
  else if (isTablet) deviceType = 'TABLET';
  else if (isMobile) deviceType = 'MOBILE';
  else deviceType = 'DESKTOP';

  let browser = 'Chrome';
  if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/CriOS|Chrome/i.test(ua)) browser = 'Chrome';
  else if (/FxiOS|Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';

  let os = 'Unknown OS';
  if (isAndroid) os = 'Android';
  else if (isIOS) os = 'iOS';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  const isStandalonePWA = Boolean(
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );

  const nav = navigator as any;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

  const metadata: DeviceMetadata = {
    userAgent: ua,
    platform: nav.platform || 'Unknown',
    browser,
    os,
    deviceType,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language || 'en-US',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    isStandalonePWA,
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    online: navigator.onLine,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    connectionType: connection?.effectiveType || connection?.type || 'unknown',
    lastActiveAt: new Date().toISOString(),
  };

  return { deviceType, metadata };
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
 * Register and collect FCM device token reliably on Mobile, Tablets, and Desktop
 */
export async function registerPushNotificationToken(
  userId: string,
  options?: { silent?: boolean }
): Promise<{ token: string | null; error: string | null; metadata?: DeviceMetadata }> {
  try {
    if (typeof window === 'undefined') {
      return { token: null, error: 'Cannot register notifications on server.' };
    }

    if (!('Notification' in window)) {
      return { token: null, error: 'Push notifications are not supported on this mobile/browser version.' };
    }

    if (!('serviceWorker' in navigator)) {
      return { token: null, error: 'Service workers are required for mobile push notifications.' };
    }

    const messagingSupported = await isMessagingSupported();
    if (!messagingSupported) {
      return { token: null, error: 'Firebase messaging is not supported in this browser context.' };
    }

    // Check permission state
    let permission = Notification.permission;
    if (permission === 'default') {
      if (options?.silent) {
        return { token: null, error: 'Permission not yet granted.' };
      }
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      return { token: null, error: 'Notification permission was not granted by user.' };
    }

    // Register service worker and await readiness
    let swRegistration: ServiceWorkerRegistration;
    try {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      await navigator.serviceWorker.ready;
    } catch (swErr: any) {
      console.warn('Service worker registration fallback:', swErr);
      swRegistration = await navigator.serviceWorker.ready;
    }

    const messaging = getMessaging(app);
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      return { token: null, error: 'FCM token returned empty.' };
    }

    // Extract exhaustive device hardware and browser environment
    const { deviceType, metadata } = extractComprehensiveDeviceDetails();

    if (userId) {
      // Upsert into Supabase notification_tokens with complete device diagnostics
      const { error: dbError } = await supabase.from('notification_tokens').upsert(
        {
          user_id: userId,
          token,
          device_type: deviceType,
          device_info: metadata,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'user_id, token' }
      );

      if (dbError) {
        console.warn('Could not persist FCM token in database:', dbError.message);
      } else {
        localStorage.setItem('cm_last_synced_token', token);
      }
    }

    return { token, error: null, metadata };
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
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const title = payload.notification?.title || payload.data?.title || 'CampusMate Update';
        const options = {
          body: payload.notification?.body || payload.data?.body || 'You received a new campus notification.',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        };
        try {
          new Notification(title, options);
        } catch {
          // Handled via Service Worker showNotification if constructor fails
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
    } catch {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, { body, icon });
        });
      }
    }
  }
}
