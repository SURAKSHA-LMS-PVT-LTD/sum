import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pushNotificationService, NotificationPayload } from '../services/pushNotificationService';
import { useAuth } from '@/contexts/AuthContext';
import { useNotificationStore } from '@/stores/useNotificationStore';

/** Own origins that should stay inside the app (must match useNotificationNavigation) */
const OWN_ORIGINS = [
  'https://lms.suraksha.lk',
  window.location.origin,
];

/** Returns true for any *.suraksha.lk subdomain so in-app notifications work on tenant subdomains */
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
 * Navigate to an actionUrl from push notification data.
 * - Internal/own-origin URLs → React Router (stays in-app, SPA navigation)
 * - External URLs → open in browser/custom tab
 */
function safeNavigate(actionUrl: string, navigate: ReturnType<typeof useNavigate>): void {
  if (!actionUrl) return;
  try {
    if (!actionUrl.startsWith('http')) {
      // Relative path — always internal
      navigate(actionUrl, { replace: false });
      return;
    }
    const { origin, pathname, search, hash } = new URL(actionUrl);
    if (OWN_ORIGINS.includes(origin) || isSurakshaOrigin(origin)) {
      // Same app — in-app navigation
      navigate(pathname + search + hash, { replace: false });
    } else {
      // External site — open in system browser
      window.open(actionUrl, '_blank', 'noopener,noreferrer');
    }
  } catch {
    // malformed URL — ignore
  }
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { incrementUnread } = useNotificationStore();
  const [latestNotification, setLatestNotification] = useState<NotificationPayload | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');

  // Check permission status on mount
  useEffect(() => {
    const checkPermission = async () => {
      const status = await pushNotificationService.getPermissionStatus();
      setPermissionStatus(status);
    };
    checkPermission();
  }, []);

  // Register push token when user is logged in
  useEffect(() => {
    if (!user?.id) {
      setIsRegistered(false);
      return;
    }

    const registerToken = async () => {
      try {
        const result = await pushNotificationService.registerToken(user.id);
        if (result) {
          setIsRegistered(true);
          setPermissionStatus('granted');
        }
      } catch (error: any) {
        if (import.meta.env.DEV) console.error('Failed to register push notifications:', error);
      }
    };

    // Only register if permission is granted or default (will prompt)
    if (permissionStatus !== 'denied' && permissionStatus !== 'unsupported') {
      registerToken();
    }
  }, [user?.id, permissionStatus]);

  // Listen for foreground messages
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = pushNotificationService.onForegroundMessage((payload) => {
      setLatestNotification(payload);
      setShowToast(true);
      incrementUnread(); // Update global badge count

      // Auto-hide toast after 5 seconds
      setTimeout(() => setShowToast(false), 5000);
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  // Listen for notification clicks (native)
  useEffect(() => {
    if (!user?.id || !pushNotificationService.isNative()) return;

    const unsubscribe = pushNotificationService.onNotificationClick((payload) => {
      if (payload.data?.actionUrl) {
        safeNavigate(payload.data.actionUrl, navigate);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  const dismissToast = useCallback(() => {
    setShowToast(false);
  }, []);

  const handleNotificationClick = useCallback(() => {
    if (latestNotification?.data?.actionUrl) {
      safeNavigate(latestNotification.data.actionUrl, navigate);
    }
    dismissToast();
  }, [latestNotification, dismissToast, navigate]);

  const requestPermission = useCallback(async () => {
    const granted = await pushNotificationService.requestPermission();
    setPermissionStatus(granted ? 'granted' : 'denied');
    return granted;
  }, []);

  return {
    latestNotification,
    showToast,
    dismissToast,
    handleNotificationClick,
    isRegistered,
    permissionStatus,
    requestPermission,
    isSupported: pushNotificationService.isSupported(),
    isNative: pushNotificationService.isNative(),
    platform: pushNotificationService.getPlatform()
  };
};
