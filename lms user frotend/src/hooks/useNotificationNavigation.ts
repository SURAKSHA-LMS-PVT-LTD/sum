// src/hooks/useNotificationNavigation.ts
//
// Handles automatic navigation when a push notification is tapped.
//
// actionUrl can be:
//  - Internal route:  "/notifications", "/attendance"
//  - Internal full:   "https://lms.suraksha.lk/results"
//  - External site:   "https://hcc.lk", "https://anything-else.com"
//
// Internal  → navigate with React Router (stays in app)
// External  → open in system browser (window.open / Android Custom Tab)

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pushNotificationService } from '@/services/pushNotificationService';

/** Own origins that should stay inside the app */
const OWN_ORIGINS = [
  'https://lms.suraksha.lk',
  window.location.origin,
];

/** Returns true for any https://*.suraksha.lk subdomain so notifications work on tenant subdomains */
function isSurakshaOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin + '/');
    if (protocol !== 'https:') return false;
    return hostname === 'lms.suraksha.lk' || hostname.endsWith('.suraksha.lk');
  } catch {
    return false;
  }
}

/**
 * Returns true if the URL belongs to this app (route navigation).
 * Returns false if it's an external site (open in browser).
 */
function isInternalUrl(url: string): boolean {
  if (!url.startsWith('http')) return true; // relative path → always internal
  try {
    const { origin } = new URL(url);
    return OWN_ORIGINS.includes(origin) || isSurakshaOrigin(origin);
  } catch {
    return true;
  }
}

/**
 * Extract just the pathname from any URL so React Router can navigate.
 */
function toPath(url: string): string {
  if (!url.startsWith('http')) return url;
  try {
    const { pathname, search, hash } = new URL(url);
    return pathname + search + hash;
  } catch {
    return url;
  }
}

/**
 * Open an external URL in the system browser.
 * On Android/iOS Capacitor this opens a Custom Tab / SFSafariViewController.
 */
function openExternal(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function useNotificationNavigation(): void {
  const navigate = useNavigate();

  useEffect(() => {
    // --- Cold start: notification tapped while app was killed ---
    const pending = pushNotificationService.getPendingNavigationUrl();
    if (pending) {
      pushNotificationService.clearPendingNavigationUrl();
      setTimeout(() => {
        if (isInternalUrl(pending)) {
          navigate(toPath(pending), { replace: true });
        } else {
          openExternal(pending);
        }
      }, 300);
    }

    // --- Native: foreground / background tap ---
    const unsubscribeNative = pushNotificationService.onNotificationClick((payload) => {
      const url = payload.data?.actionUrl || '/notifications';
      if (isInternalUrl(url)) {
        navigate(toPath(url));
      } else {
        openExternal(url);
      }
    });

    // --- Web: service worker sends NAVIGATE_TO message when existing tab is focused ---
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE_TO') {
        const url: string = event.data.url || event.data.path || '/notifications';
        if (isInternalUrl(url)) {
          navigate(toPath(url));
        } else {
          openExternal(url);
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    return () => {
      unsubscribeNative();
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [navigate]);
}
