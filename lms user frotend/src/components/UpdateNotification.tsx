// src/components/UpdateNotification.tsx
//
// Boot flow (runs BEFORE the user can interact with the app):
//   1. 'booting'  – Immediate version check on startup. A full-screen overlay
//                   blocks all interaction until the check resolves (≤ 6 s).
//      - major  → BLOCK permanently. User MUST update via Play Store.
//      - patch  → Auto-reload silently.
//      - null   → Check passed / offline. Release the app, start polling.
//
// Background polling (every 5 min, on app-resume, on tab-visible):
//   PATCH update → auto-reloads the app silently (brief "Updating app..." banner)
//   MAJOR update (native app) → blocking screen: "Please update from Play Store"
//   MAJOR update (web browser) → hard-reload: browser always has the new code
//     already (S3 deployed the new bundle); user just needs a full page reload.
import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { startVersionChecker, detectUpdate, UpdateInfo } from '@/utils/versionChecker';

// 'booting'  = startup version check in progress — app is BLOCKED
// 'idle'     = check passed, app runs normally
// 'reloading'= patch update detected, auto-reloading
// 'major'    = HARD BLOCK: major version bump, must update via Play Store
type State = 'booting' | 'idle' | 'reloading' | 'major';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=lk.suraksha.lms';

// How long to wait for the boot check before letting the user through (offline safety valve)
const BOOT_CHECK_TIMEOUT_MS = 6_000;

function forceRefreshToLatestBuild() {
  if (Capacitor.isNativePlatform()) {
    // Native WebView: append cache-buster so the WebView re-fetches from the
    // remote server URL (lms.suraksha.lk) instead of serving a cached page.
    const url = new URL(window.location.href);
    url.searchParams.set('_app_update', Date.now().toString());
    window.location.replace(url.toString());
  } else {
    // Web browser: a plain hard-reload is enough — the browser will re-fetch
    // index.html and pick up the new hashed bundle URLs from S3.
    window.location.reload();
  }
}

const UpdateNotification: React.FC = () => {
  // Start in 'booting' so the overlay blocks the app immediately on mount.
  const [state, setState] = useState<State>('booting');
  const [majorInfo, setMajorInfo] = useState<UpdateInfo | null>(null);
  const isNative = Capacitor.isNativePlatform();

  // ── STEP 1: Boot-time blocking check ─────────────────────────────────────
  // Runs immediately when the component mounts. The 'booting' overlay prevents
  // the user from interacting with the app until we know it is safe to proceed.
  useEffect(() => {
    let cancelled = false;

    const runBootCheck = async () => {
      // Race the real check against a timeout so offline users aren't stuck.
      const timeoutPromise = new Promise<null>(resolve =>
        setTimeout(() => resolve(null), BOOT_CHECK_TIMEOUT_MS)
      );

      try {
        const update = await Promise.race([detectUpdate(), timeoutPromise]);

        if (cancelled) return;

        if (update?.kind === 'major') {
          if (isNative) {
            setMajorInfo(update);
            setState('major'); // HARD BLOCK — stays until app is updated
          } else {
            // Web: new bundle already on S3 — just reload
            setState('reloading');
            setTimeout(() => forceRefreshToLatestBuild(), 1200);
          }
          return;
        }

        if (update?.kind === 'patch') {
          setState('reloading');
          setTimeout(() => forceRefreshToLatestBuild(), 1200);
          return;
        }

        // No update or offline/timeout → release the app
        setState('idle');
      } catch {
        if (!cancelled) setState('idle'); // Network error → allow through
      }
    };

    void runBootCheck();
    return () => { cancelled = true; };
  }, [isNative]);

  // ── STEP 2: Background polling (only after boot check passes) ────────────
  useEffect(() => {
    if (state !== 'idle') return;

    startVersionChecker({
      // PATCH / MINOR → show "Updating..." for 1.2s then reload (both platforms)
      onPatchUpdate: () => {
        setState('reloading');
        setTimeout(() => forceRefreshToLatestBuild(), 1200);
      },

      // MAJOR →
      //   Native app : block UI, user must go to Play Store for new APK
      //   Web browser: just reload — the new bundle is already on S3
      onMajorUpdate: (info) => {
        if (isNative) {
          setMajorInfo(info);
          setState('major');
        } else {
          setState('reloading');
          setTimeout(() => forceRefreshToLatestBuild(), 1200);
        }
      },
    });
  }, [state, isNative]);

  // ── Booting: brief blocking overlay while the version check runs ───────────
  if (state === 'booting') {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1976D2] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Starting…</p>
        </div>
      </div>
    );
  }

  // ── Patch: silent "Updating app..." banner ──────────────────────────────────
  if (state === 'reloading') {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1976D2] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-800 font-semibold text-sm">Updating app…</p>
          <p className="text-gray-400 text-xs">Loading latest version</p>
        </div>
      </div>
    );
  }

  // ── Major: blocking Play Store prompt ───────────────────────────────────────
  if (state === 'major' && majorInfo) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#0f172a]/80 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-5 text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-[#E3F2FD] flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1976D2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>

          <div>
            <h2 className="text-gray-900 font-bold text-lg mb-1">Update Required</h2>
            <p className="text-gray-500 text-sm">
              Version <span className="font-semibold text-[#1976D2]">{majorInfo.newSemver}</span> is
              available and requires a Play Store update to continue.
            </p>
          </div>

          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="w-full bg-[#1976D2] hover:bg-[#1565C0] text-white font-semibold py-3 px-6 rounded-xl text-sm transition-colors text-center block no-underline"
          >
            Update on Play Store
          </a>

          <p className="text-gray-400 text-xs">
            You must update to keep using Suraksha LMS.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default UpdateNotification;
