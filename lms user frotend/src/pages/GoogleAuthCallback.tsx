import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * Handles the /auth/google/callback route.
 *
 * The backend Drive OAuth flow redirects the browser directly to the returnUrl
 * (e.g. /profile?tab=apps&drive_connected=true) — so this page is only reached
 * if returnUrl was explicitly set to /auth/google/callback.
 *
 * Two sub-cases are handled:
 * 1. Query params:  ?drive_connected=true&google_email=... (server-side code flow)
 * 2. Legacy hash:   #access_token=... (implicit flow — Google deprecated this)
 */
const GoogleAuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const driveConnected = queryParams.get('drive_connected');

    // ── Server-side flow (current) ──────────────────────────────────────────
    if (driveConnected !== null) {
      const returnUrl = sessionStorage.getItem('google_oauth_return_url') || '/profile?tab=apps';
      sessionStorage.removeItem('google_oauth_return_url');

      // Forward drive_connected/google_email/error to the destination page
      // so useDriveCallback can pick them up.
      const dest = new URL(returnUrl, window.location.origin);
      dest.searchParams.set('drive_connected', driveConnected);
      const googleEmail = queryParams.get('google_email');
      const error = queryParams.get('error');
      if (googleEmail) dest.searchParams.set('google_email', googleEmail);
      if (error) dest.searchParams.set('error', error);

      navigate(dest.pathname + dest.search, { replace: true });
      return;
    }

    // ── Legacy implicit flow (deprecated / no longer used) ──────────────────
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get('access_token');
    const hashError = hashParams.get('error');

    const returnUrl = sessionStorage.getItem('google_oauth_return_url') || '/profile?tab=apps';
    sessionStorage.removeItem('google_oauth_return_url');

    if (accessToken || hashError) {
      navigate(returnUrl, { replace: true });
    } else {
      // Nothing recognisable — go back to profile
      navigate('/profile?tab=apps', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-sm text-muted-foreground">Connecting to Google Drive...</p>
      </div>
    </div>
  );
};

export default GoogleAuthCallback;
