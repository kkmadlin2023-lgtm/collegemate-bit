// Firebase Cloud Messaging Service Worker for CampusMate
// Handles push notifications even when the page is fully CLOSED
// Uses Firebase compat SDK for maximum browser compatibility
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: 'AIzaSyAdNgCvhIQwvkBovNmlEzi9DYs3xrPkVKU',
  authDomain: 'collegemate-bit.firebaseapp.com',
  projectId: 'collegemate-bit',
  storageBucket: 'collegemate-bit.firebasestorage.app',
  messagingSenderId: '234271373538',
  appId: '1:234271373538:web:2b702d431c67ee191686bb',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ── Handle messages when tab is OPEN but in background ──────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background FCM message:', payload);
  const title = payload.notification?.title || payload.data?.title || 'CampusMate';
  const body  = payload.notification?.body  || payload.data?.body  || 'New campus update.';
  const type  = payload.data?.type || 'GENERAL';
  const isAlarm = type === 'REMINDER_ALARM' || type === 'SCHEDULE_ALERT' || type === 'TASK_ALERT';

  return self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.tag || type,
    renotify: true,
    requireInteraction: isAlarm,
    vibrate: isAlarm ? [300, 100, 300, 100, 300, 100, 600] : [200, 100, 200],
    data: { ...(payload.data || {}), url: '/' },
    actions: isAlarm
      ? [{ action: 'open', title: '✅ View' }, { action: 'dismiss', title: '✖ Dismiss' }]
      : [{ action: 'open', title: '📱 Open App' }],
  });
});

// ── Handle raw push events (when page is FULLY CLOSED) ────────────────────────
// Firebase SW handles these via onBackgroundMessage above, but this catches any
// non-Firebase push payloads or malformed ones as a safety net.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { data: { title: 'CampusMate', body: event.data.text() } }; }

  const title = payload.notification?.title || payload.data?.title || 'CampusMate';
  const body  = payload.notification?.body  || payload.data?.body  || 'You have a new alert.';
  const type  = payload.data?.type || 'GENERAL';
  const isAlarm = type === 'REMINDER_ALARM' || type === 'SCHEDULE_ALERT' || type === 'TASK_ALERT';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: type,
      renotify: true,
      requireInteraction: isAlarm,
      vibrate: isAlarm ? [300, 100, 300, 100, 300, 100, 600] : [200, 100, 200],
      data: { url: '/', ...(payload.data || {}) },
    })
  );
});

// ── Notification click handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', data: event.notification.data });
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── Service Worker Install & Activate ────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
