// src/config/firebase.ts
import { initializeApp, FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { Capacitor } from '@capacitor/core';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Check if Firebase config is properly set
const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
);

// Initialize Firebase only if configured
let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

// Only initialize Firebase messaging on web browsers, not on native Capacitor apps
// Native apps will use Capacitor Push Notifications plugin instead
// Use a distinct name to avoid collision with the isNativePlatform() function
// exported from tokenStorageService.ts which is a callable function.
const ON_NATIVE_PLATFORM = Capacitor.isNativePlatform();

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);

    if (!ON_NATIVE_PLATFORM && typeof window !== 'undefined' && 'Notification' in window) {
      messaging = getMessaging(app);
    }
  } catch (error: any) {
    if (import.meta.env.DEV) console.warn('Firebase initialization failed:', error);
  }
}

// VAPID key for web push from environment variable
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export { app, messaging, getToken, onMessage, ON_NATIVE_PLATFORM, isFirebaseConfigured };
