// src/utils/serviceWorkerRegistration.ts
import { Capacitor } from '@capacitor/core';

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase is configured
const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
);

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // Don't register service worker on native platforms - they use native push
  if (Capacitor.isNativePlatform()) {
    console.log('Native platform detected - skipping web service worker registration');
    return null;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported in this browser');
    return null;
  }

  if (!isFirebaseConfigured) {
    console.warn('Firebase not configured - skipping service worker registration for push notifications');
    return null;
  }

  try {
    // Register the service worker WITHOUT config in URL (prevents credentials leaking into logs)
    const swUrl = `/firebase-messaging-sw.js`;

    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: '/'
    });

    // Send config via postMessage — the only safe channel
    const sendConfig = (sw: ServiceWorker) => {
      sw.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });
    };

    if (registration.active) {
      sendConfig(registration.active);
    }

    // Also send once the SW becomes active (handles first install)
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) sendConfig(reg.active);
    });

    return registration;
  } catch (error: any) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const result = await registration.unregister();
    console.log('Service Worker unregistered:', result);
    return result;
  } catch (error: any) {
    console.error('Service Worker unregistration failed:', error);
    return false;
  }
}
