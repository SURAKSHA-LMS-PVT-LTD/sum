// Suraksha LMS - Main Entry Point

// ─── HTTP → HTTPS upgrade (production only) ───────────────────────────────────
// When users visit a subdomain (e.g. http://academy.suraksha.lk/) via plain HTTP
// the browser blocks the insecure load. Redirect to HTTPS immediately so the app
// always runs in a secure context. Skip on localhost / dev.
if (
  window.location.protocol === 'http:' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1'
) {
  window.location.replace('https:' + window.location.href.slice(5));
}
// ─────────────────────────────────────────────────────────────────────────────

import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ─── Stale-bundle / chunk-load recovery ──────────────────────────────────────
// On Capacitor Android, the WebView can cache an old index.html that references
// chunk hashes from a previous build. If those chunks are missing the WebView
// silently fails to boot and shows a white screen. Catch the error and reload
// so the fresh index.html (and its matching chunks) are served instead.
// We guard with a rate-limit flag so we never loop-reload on genuine errors.
const RELOAD_TS_KEY = '__lms_last_chunk_reload';
export const isChunkLoadError = (msg: string) =>
  msg.includes('Failed to fetch dynamically imported module') ||
  msg.includes('error loading dynamically imported module') ||
  msg.includes('ChunkLoadError') ||
  msg.includes('Loading chunk') ||
  msg.includes('Loading CSS chunk') ||
  msg.includes('Failed to load module script');

// Clean up cache-bust param left by a previous stale-bundle recovery
(function cleanCacheBustParam() {
  try {
    const url = new URL(location.href);
    if (url.searchParams.has('_lms_r')) {
      url.searchParams.delete('_lms_r');
      history.replaceState(null, '', url.pathname + (url.search === '?' ? '' : url.search) + url.hash);
    }
  } catch (_) { /* ignore */ }
})();

function tryReload() {
  const lastReload = Number(sessionStorage.getItem(RELOAD_TS_KEY) ?? 0);
  if (Date.now() - lastReload > 20_000) {
    sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
    // Use a cache-busting URL so CDN-cached custom domains are forced to re-fetch
    // index.html (plain reload() re-serves the same CDN-cached response).
    const url = new URL(location.href);
    url.searchParams.set('_lms_r', Date.now().toString());
    location.replace(url.toString());
    return true;
  }
  return false;
}

window.addEventListener('error', (e) => {
  // JS-level chunk error (message present)
  if (isChunkLoadError(e.message ?? '')) { tryReload(); return; }
  // Resource load error on a <script type="module"> element — e.message is empty;
  // event fires in capture phase with e.target pointing to the failing element.
  const target = e.target as HTMLElement | null;
  if (target?.tagName === 'SCRIPT' && (target as HTMLScriptElement).type === 'module') {
    tryReload();
  }
}, true);

window.addEventListener('unhandledrejection', (e) => {
  const msg = String((e.reason as Error)?.message ?? e.reason ?? '');
  if (isChunkLoadError(msg)) {
    e.preventDefault();
    tryReload();
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// ─── Keyboard / Input Scroll Fix (Capacitor Android) ────────────────────────
// On Android WebView the browser does not always auto-scroll to keep a focused
// input above the on-screen keyboard. We listen for focus on any input/textarea
// and manually call scrollIntoView so the field is always visible.
// A short delay lets the keyboard finish animating before we scroll.
window.addEventListener('focusin', (e) => {
  const el = e.target as HTMLElement | null;
  if (!el) return;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    setTimeout(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 400);
  }
}, true);
// ─────────────────────────────────────────────────────────────────────────────

// ─── Visual Viewport Tracking (keyboard-aware height) ───────────────────────
// Sets a CSS custom property --visual-vh that reflects the ACTUAL visible area.
// When the on-screen keyboard opens, visualViewport.height shrinks while
// window.innerHeight and dvh may not. Dialogs/sheets use this to stay visible.
const updateVisualVh = () => {
  const vh = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;
  document.documentElement.style.setProperty('--visual-vh', `${vh}px`);
};
updateVisualVh();
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateVisualVh);
  window.visualViewport.addEventListener('scroll', updateVisualVh);
} else {
  window.addEventListener('resize', updateVisualVh);
}
// ─────────────────────────────────────────────────────────────────────────────

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
