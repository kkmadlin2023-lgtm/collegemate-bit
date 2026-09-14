// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAdNgCvhIQwvkBovNmlEzi9DYs3xrPkVKU",
  authDomain: "collegemate-bit.firebaseapp.com",
  projectId: "collegemate-bit",
  storageBucket: "collegemate-bit.firebasestorage.app",
  messagingSenderId: "234271373538",
  appId: "1:234271373538:web:2b702d431c67ee191686bb"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'CampusMate Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new campus update.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    tag: payload.data?.tag || 'campusmate-notification',
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
 
