import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const DRIVE_DEEP_LINK_PREFIX = 'lk.suraksha.lms://drive-callback';

/**
 * Handle Google Drive OAuth callback.
 *
 * Web:    Backend redirects to /profile?tab=apps&drive_connected=true&google_email=...
 * Mobile: Backend redirects to lk.suraksha.lms://drive-callback?drive_connected=true&google_email=...
 */
export function useDriveCallback(
  onSuccess?: (email: string) => void,
  onError?: (error: string) => void,
) {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Web: read redirect query params ──────────────────────────────────────
  useEffect(() => {
    const driveConnected = searchParams.get('drive_connected');
    if (!driveConnected) return;

    const googleEmail = searchParams.get('google_email') ?? '';
    const error = searchParams.get('error') ?? 'Failed to connect Google Drive';

    if (driveConnected === 'true') {
      onSuccess?.(googleEmail);
    } else {
      onError?.(error);
    }

    // Clean up URL so params don't persist on refresh
    const cleaned = new URLSearchParams(searchParams);
    cleaned.delete('drive_connected');
    cleaned.delete('google_email');
    cleaned.delete('error');
    setSearchParams(cleaned, { replace: true });
  }, [searchParams]);

  // ── Mobile: Capacitor deep link listener ─────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => void } | null = null;

    App.addListener('appUrlOpen', (data: { url: string }) => {
      if (!data.url.startsWith(DRIVE_DEEP_LINK_PREFIX)) return;

      const query = data.url.split('?')[1] ?? '';
      const params = new URLSearchParams(query);
      const driveConnected = params.get('drive_connected');
      const googleEmail = params.get('google_email') ?? '';
      const error = params.get('error') ?? 'Failed to connect Google Drive';

      if (driveConnected === 'true') {
        onSuccess?.(googleEmail);
      } else {
        onError?.(error);
      }
    }).then((h) => { handle = h; });

    return () => { handle?.remove(); };
  }, []);
}
