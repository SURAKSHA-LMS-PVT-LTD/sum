/**
 * GlobalErrorOverlay — catches window-level errors that escape React's tree
 * (promise rejections, runtime errors outside components, etc.)
 * and shows a dismissable overlay instead of a silent white screen.
 */
import React, { useEffect, useState } from 'react';
import { isChunkLoadError } from '@/main';
import { classifyError, sendErrorReport, ErrorKind } from './ErrorBoundary';

type GlobalError = {
  id: number;
  message: string;
  kind: ErrorKind;
  stack?: string;
  reportSent?: boolean;
};

let nextId = 1;
type Listener = (err: GlobalError) => void;
const listeners = new Set<Listener>();

function emitError(err: GlobalError) {
  listeners.forEach(l => l(err));
}

// Installed once in main.tsx via installGlobalErrorHandlers()
let installed = false;
export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (e) => {
    const msg = e.message ?? '';
    if (isChunkLoadError(msg)) return; // already handled by chunk-reload logic
    if (!msg || msg === 'Script error.') return; // cross-origin noise

    const kind = classifyError(undefined, msg);
    const err: GlobalError = { id: nextId++, message: msg, kind, stack: (e.error as Error)?.stack };
    emitError(err);
    sendErrorReport({ errorMessage: err.message, errorStack: err.stack, pageUrl: location.href, userAgent: navigator.userAgent });
  }, true);

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason as any;
    const msg = reason?.message ?? String(reason ?? '');
    if (!msg || isChunkLoadError(msg)) return;

    const kind = classifyError(reason instanceof Error ? reason : undefined, msg);
    const err: GlobalError = { id: nextId++, message: msg, kind, stack: reason?.stack };
    emitError(err);
    sendErrorReport({ errorMessage: err.message, errorStack: err.stack, pageUrl: location.href, userAgent: navigator.userAgent });
  });
}

const KIND_LABELS: Record<ErrorKind, { title: string; color: string; bg: string; border: string }> = {
  'access-denied':     { title: 'Access Denied',        color: 'text-amber-800',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  'not-enrolled':      { title: 'Not Enrolled',          color: 'text-amber-800',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  'payment-required':  { title: 'Payment Required',      color: 'text-amber-800',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  'network':           { title: 'Connection Problem',    color: 'text-orange-800', bg: 'bg-orange-50',  border: 'border-orange-200' },
  'cache':             { title: 'App Update Required',   color: 'text-purple-800', bg: 'bg-purple-50',  border: 'border-purple-200' },
  'session-expired':   { title: 'Session Expired',       color: 'text-blue-800',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  'not-found':         { title: 'Not Found',             color: 'text-slate-700',  bg: 'bg-slate-50',   border: 'border-slate-200' },
  'generic':           { title: 'Something Went Wrong',  color: 'text-red-800',    bg: 'bg-red-50',     border: 'border-red-200' },
};

export function GlobalErrorOverlay() {
  const [errors, setErrors] = useState<GlobalError[]>([]);

  useEffect(() => {
    const handler = (err: GlobalError) => {
      setErrors(prev => {
        // deduplicate by message — don't spam
        if (prev.some(e => e.message === err.message)) return prev;
        return [...prev.slice(-2), err]; // keep at most 3
      });
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const dismiss = (id: number) => setErrors(prev => prev.filter(e => e.id !== id));

  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {errors.map(err => {
        const meta = KIND_LABELS[err.kind];
        return (
          <div
            key={err.id}
            className={`pointer-events-auto rounded-2xl border shadow-xl p-4 space-y-3 ${meta.bg} ${meta.border} animate-in slide-in-from-bottom-4 fade-in duration-300`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${meta.color}`}>{meta.title}</p>
                <p className={`text-xs mt-0.5 leading-relaxed ${meta.color} opacity-80`}>
                  {humanizeErrorMessage(err.message, err.kind)}
                </p>
              </div>
              <button
                onClick={() => dismiss(err.id)}
                className="shrink-0 text-slate-400 hover:text-slate-600 transition mt-0.5"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {(err.kind === 'network' || err.kind === 'generic') && (
                <button
                  onClick={() => window.location.reload()}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition opacity-70 hover:opacity-100 ${meta.color}`}
                >
                  Reload
                </button>
              )}
              {(err.kind === 'session-expired' || err.kind === 'access-denied') && (
                <button
                  onClick={() => { window.location.href = '/login'; }}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition opacity-70 hover:opacity-100 ${meta.color}`}
                >
                  Sign In
                </button>
              )}
              {err.kind === 'cache' && (
                <button
                  onClick={() => {
                    sessionStorage.clear();
                    localStorage.clear();
                    window.location.reload();
                  }}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition opacity-70 hover:opacity-100 ${meta.color}`}
                >
                  Clear Cache
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function humanizeErrorMessage(msg: string, kind: ErrorKind): string {
  const lower = msg.toLowerCase();
  if (kind === 'network' || lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Check your internet connection and try again.';
  }
  if (kind === 'session-expired' || lower.includes('401') || lower.includes('unauthorized')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (kind === 'access-denied' || lower.includes('403') || lower.includes('forbidden')) {
    return 'You don\'t have permission to perform this action.';
  }
  if (kind === 'cache' || lower.includes('chunk') || lower.includes('module')) {
    return 'A new version of the app is available. Please reload to update.';
  }
  if (kind === 'payment-required') {
    return 'A valid payment is required to access this content.';
  }
  if (kind === 'not-enrolled') {
    return 'You are not enrolled in this class. Contact your institute.';
  }
  if (kind === 'not-found') {
    return 'This content could not be found.';
  }
  // Generic — show a short version of the message, strip internal details
  if (msg.length > 100) return msg.slice(0, 100) + '…';
  return msg || 'An unexpected error occurred.';
}
