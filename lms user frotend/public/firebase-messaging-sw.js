// public/firebase-messaging-sw.js
// Firebase Messaging Service Worker for background notifications (Web only)
// Note: This service worker is only used in web browsers, not in native Capacitor apps

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Firebase config will be injected at runtime via postMessage from the main app.
// NEVER pass credentials in the SW registration URL — they appear in access logs.
let firebaseInitialized = false;

// Listen for config message from main app — validate origin before accepting
self.addEventListener('message', (event) => {
  // Reject messages from unexpected origins
  if (event.origin !== self.location.origin) return;

  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    if (!firebaseInitialized) {
      try {
        firebase.initializeApp(event.data.config);
        firebaseInitialized = true;
        initializeMessaging();
      } catch (error) {
        // silent
      }
    }
  }
});

function initializeMessaging() {
  const messaging = firebase.messaging();

  // Handle background messages
  messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || 'New Notification';

    // Extract image from notification or data payload
    // FCM can send image in notification.image OR data.image OR data.imageUrl
    const imageUrl = payload.notification?.image
      || payload.data?.image
      || payload.data?.imageUrl
      || null;

    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: payload.notification?.icon || '/favicon.png',
      badge: '/favicon.png',
      data: payload.data,
      tag: payload.data?.notificationId || 'default',
      requireInteraction: true,
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    // Only add image if it exists and is a valid HTTPS URL
    // This prevents errors on devices that don't support notification images
    if (imageUrl && (imageUrl.startsWith('https://') || imageUrl.startsWith('http://'))) {
      notificationOptions.image = imageUrl;
    }

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const actionUrl = event.notification.data?.actionUrl || '/notifications';

  // Determine if actionUrl is external (different origin) or internal
  const appOrigin = self.location.origin;
  let isExternal = false;
  let targetAbsolute = actionUrl;

  if (actionUrl.startsWith('http')) {
    try {
      const parsed = new URL(actionUrl);
      isExternal = parsed.origin !== appOrigin;
      targetAbsolute = actionUrl;
    } catch (_) {
      // malformed URL — treat as internal path
    }
  } else {
    targetAbsolute = appOrigin + actionUrl;
  }

  if (isExternal) {
    // Open external site directly in a new tab — no in-app navigation
    event.waitUntil(
      clients.openWindow(actionUrl)
    );
    return;
  }

  // Internal — focus existing app tab and post message, or open new tab
  const targetPath = actionUrl.startsWith('http') ? new URL(actionUrl).pathname : actionUrl;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          // Pass full original URL so the hook can decide path+search+hash
          client.postMessage({ type: 'NAVIGATE_TO', url: actionUrl, path: targetPath });
          return;
        }
      }
      // App not open — open new tab
      if (clients.openWindow) {
        return clients.openWindow(targetAbsolute);
      }
    })
  );
});
