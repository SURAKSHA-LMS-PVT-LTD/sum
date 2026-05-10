import { useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { refreshAccessToken, tokenStorageService } from '@/contexts/utils/auth.api';

/**
 * Keeps the user signed in by refreshing the access token shortly before expiry.
 *
 * Notes:
 * - Web refresh uses the server-managed httpOnly cookie.
 * - Mobile refresh uses refresh_token stored in native storage.
 * - If refresh fails, auth.api will clear tokens + dispatch auth:refresh-failed.
 */
export function useAuthAutoRefresh(enabled: boolean) {
  const timeoutRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const refreshNow = useCallback(async (reason: string) => {
    if (!enabled || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      console.log(`🔁 Auto-refreshing token (${reason})...`);
      await refreshAccessToken();
    } catch (e) {
      // refreshAccessToken already handles clearing + dispatching auth:refresh-failed
      console.warn('⚠️ Auto token refresh failed:', e);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [enabled]);

  const scheduleNext = useCallback(async () => {
    clearTimer();
    if (!enabled) return;

    const expiry = await tokenStorageService.getTokenExpiry();
    const now = Date.now();
    const isMobile = Capacitor.isNativePlatform();

    // If we don't know expiry, use aggressive fallback for mobile (5 min) vs web (10 min).
    if (!expiry) {
      const fallbackInterval = isMobile ? 5 * 60 * 1000 : 10 * 60 * 1000;
      timeoutRef.current = window.setTimeout(() => {
        void refreshNow('fallback').finally(() => void scheduleNext());
      }, fallbackInterval);
      return;
    }

    // Refresh 2 minutes before expiry on mobile, 60s on web
    const bufferMs = isMobile ? 2 * 60 * 1000 : 60_000;
    const refreshAt = expiry - bufferMs;

    if (now >= refreshAt) {
      await refreshNow('due');
      // After refresh, schedule again (new expiry should be stored)
      return scheduleNext();
    }

    const delay = Math.max(5_000, refreshAt - now);
    timeoutRef.current = window.setTimeout(() => {
      void refreshNow('scheduled').finally(() => {
        void scheduleNext();
      });
    }, delay);
  }, [clearTimer, enabled, refreshNow]);

  const checkOnResumeOrFocus = useCallback(async () => {
    if (!enabled) return;

    const expiry = await tokenStorageService.getTokenExpiry();
    const now = Date.now();
    const isMobile = Capacitor.isNativePlatform();
    const bufferMs = isMobile ? 2 * 60 * 1000 : 60_000;

    if (!expiry || now >= expiry - bufferMs) {
      // Token expired or near-expiry — refresh immediately
      await refreshNow('resume/focus');
    }

    void scheduleNext();
  }, [enabled, refreshNow, scheduleNext]);

  useEffect(() => {
    void scheduleNext();

    const onFocus = () => {
      void checkOnResumeOrFocus();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkOnResumeOrFocus();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    let appStateHandle: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          void checkOnResumeOrFocus();
        }
      }).then((handle) => {
        appStateHandle = handle;
      });
    }

    return () => {
      clearTimer();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      appStateHandle?.remove();
    };
  }, [checkOnResumeOrFocus, clearTimer, scheduleNext]);
}
