import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// src/utils/versionChecker.ts
//
// Two-tier update strategy:
//
//  1. PATCH / MINOR update  (same major version, new S3 deploy)
//     → Auto-reload silently. User sees a brief "Updating..." banner, then the
//       page reloads with the latest code. No user action required.
//
//  2. MAJOR version bump  (e.g. 1.x.x → 2.x.x)
//     → Show a blocking "Please update from Play Store" screen.
//       This is for breaking native changes that require a new APK.

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // Poll every 5 minutes

// Injected at build time by Vite define config.
const CURRENT_HASH = typeof __APP_BUILD_HASH__ !== 'undefined' ? __APP_BUILD_HASH__ : '__DEV__';
const CURRENT_MAJOR = typeof __APP_MAJOR__ !== 'undefined' ? __APP_MAJOR__ : 1;

const VERSION_URL = '/version.json';

let checkIntervalId: ReturnType<typeof setInterval> | null = null;
let startupTimeoutId: ReturnType<typeof setTimeout> | null = null;
let appStateListenerHandle: { remove: () => Promise<void> } | null = null;
let visibilityListenerAttached = false;

export type UpdateKind = 'patch' | 'major';

export interface UpdateInfo {
  kind: UpdateKind;
  newSemver: string;
}

interface RemoteVersionJson {
  hash: string;
  semver: string;
  major: number;
  buildTime: string;
}

async function fetchRemoteVersion(): Promise<RemoteVersionJson | null> {
  try {
    // version.json is ~80 bytes, served with no-cache. The ONLY small request.
    const res = await fetch(`${VERSION_URL}?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // Offline — silently retry next interval
  }
}

export async function detectUpdate(): Promise<UpdateInfo | null> {
  if (CURRENT_HASH === '__DEV__') return null; // Skip in dev

  const remote = await fetchRemoteVersion();
  if (!remote) return null;

  // Same deploy hash → nothing changed
  if (remote.hash === CURRENT_HASH) return null;

  // Different major → requires Play Store APK update
  if (remote.major > CURRENT_MAJOR) {
    return { kind: 'major', newSemver: remote.semver };
  }

  // Same major, different hash → new S3 deploy (UI/features/images)
  return { kind: 'patch', newSemver: remote.semver };
}

/**
 * Start background version polling.
 *
 * @param onMajorUpdate  Called when a breaking major version is detected.
 *                       Show a "Go to Play Store" screen.
 * @param onPatchUpdate  Called when a silent patch/minor deploy is detected.
 *                       Auto-reload is handled here — show a brief banner.
 */
export function startVersionChecker(callbacks: {
  onMajorUpdate: (info: UpdateInfo) => void;
  onPatchUpdate: (info: UpdateInfo) => void;
}): void {
  if (checkIntervalId) return;

  const run = async () => {
    const update = await detectUpdate();
    if (!update) return;

    stopVersionChecker(); // Stop polling once we have a result

    if (update.kind === 'major') {
      callbacks.onMajorUpdate(update);
    } else {
      callbacks.onPatchUpdate(update);
    }
  };

  // First check shortly after startup so opened apps update quickly.
  startupTimeoutId = setTimeout(run, 10_000);
  checkIntervalId = setInterval(run, VERSION_CHECK_INTERVAL);

  if (!visibilityListenerAttached) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void run();
      }
    });
    visibilityListenerAttached = true;
  }

  if (Capacitor.isNativePlatform() && !appStateListenerHandle) {
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void run();
      }
    }).then((handle) => {
      appStateListenerHandle = handle;
    }).catch(() => {
      appStateListenerHandle = null;
    });
  }
}

export function stopVersionChecker(): void {
  if (startupTimeoutId) {
    clearTimeout(startupTimeoutId);
    startupTimeoutId = null;
  }

  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }

  if (appStateListenerHandle) {
    void appStateListenerHandle.remove();
    appStateListenerHandle = null;
  }
}

/** Forces the WebView / browser to hard-reload at the latest deployed build URL. */
export function forceRefreshToLatestBuild(): void {
  const url = new URL(window.location.href);
  url.searchParams.set('_app_update', Date.now().toString());
  window.location.replace(url.toString());
}

export type ManualCheckResult =
  | { status: 'up-to-date'; semver: string }
  | { status: 'offline' }
  | { status: 'patch'; info: UpdateInfo }
  | { status: 'major'; info: UpdateInfo };

/**
 * One-shot update check for the "Check for Updates" button in Settings.
 * Unlike startVersionChecker, this does NOT start any background polling.
 */
export async function checkForUpdateOnce(): Promise<ManualCheckResult> {
  const remote = await fetchRemoteVersion();
  if (!remote) return { status: 'offline' };

  // In dev builds there is no real hash to compare — treat as up-to-date.
  if (CURRENT_HASH === '__DEV__') {
    return { status: 'up-to-date', semver: remote.semver };
  }

  if (remote.hash === CURRENT_HASH) {
    return { status: 'up-to-date', semver: remote.semver };
  }

  // Major version jump → must update native APK via Play Store
  if (remote.major > CURRENT_MAJOR) {
    return { status: 'major', info: { kind: 'major', newSemver: remote.semver } };
  }

  // Same major, different hash → silent web-bundle refresh
  return { status: 'patch', info: { kind: 'patch', newSemver: remote.semver } };
}

export { CURRENT_HASH, CURRENT_MAJOR };
