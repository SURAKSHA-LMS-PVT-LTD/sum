import React from 'react';
import { isChunkLoadError } from '@/main';
import html2canvas from 'html2canvas';
import { errorReportService, ERROR_REPORT_KINDS } from '@/services/errorReportService';

const RELOAD_TS_KEY = '__lms_last_chunk_reload';

// ── Error classification ──────────────────────────────────────────────────────

type ErrorKind =
  | 'access-denied'
  | 'not-enrolled'
  | 'payment-required'
  | 'network'
  | 'cache'
  | 'session-expired'
  | 'not-found'
  | 'generic';

function classifyError(err: Error | undefined, message?: string): ErrorKind {
  const msg = ((err?.message ?? '') + ' ' + (message ?? '')).toLowerCase();
  if (msg.includes('unauthorized') || msg.includes('403') || msg.includes('access denied') || msg.includes('forbidden')) return 'access-denied';
  if (msg.includes('not enrolled') || msg.includes('enrollment')) return 'not-enrolled';
  if (msg.includes('payment') || msg.includes('paid') || msg.includes('subscription')) return 'payment-required';
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('offline') || msg.includes('failed to fetch')) return 'network';
  if (msg.includes('cache') || msg.includes('chunk') || msg.includes('module') || msg.includes('loading css')) return 'cache';
  if (msg.includes('401') || msg.includes('session') || msg.includes('token') || msg.includes('expired')) return 'session-expired';
  if (msg.includes('404') || msg.includes('not found')) return 'not-found';
  return 'generic';
}

const ERROR_CONTENT: Record<ErrorKind, { title: string; message: string; action: string }> = {
  'access-denied': {
    title: 'Access Denied',
    message: 'You don\'t have permission to view this content. Please make sure you\'re signed in with the correct account.',
    action: 'Go to Login',
  },
  'not-enrolled': {
    title: 'Not Enrolled',
    message: 'You\'re not enrolled in this class. Please contact your institute to get access.',
    action: 'Reload Page',
  },
  'payment-required': {
    title: 'Payment Required',
    message: 'This content requires a valid payment. Please check your payment status or contact your institute.',
    action: 'Reload Page',
  },
  'network': {
    title: 'Connection Problem',
    message: 'Unable to reach the server. Please check your internet connection and try again.',
    action: 'Try Again',
  },
  'cache': {
    title: 'App Update Required',
    message: 'A new version of the app is available. Please clear your browser cache or reload to get the latest version.',
    action: 'Clear Cache & Reload',
  },
  'session-expired': {
    title: 'Session Expired',
    message: 'Your session has expired. Please sign in again to continue.',
    action: 'Sign In Again',
  },
  'not-found': {
    title: 'Not Found',
    message: 'This page or content could not be found. It may have been moved or deleted.',
    action: 'Go Back',
  },
  'generic': {
    title: 'Something Went Wrong',
    message: 'The app encountered an unexpected error. Our team has been notified. Please try reloading the page.',
    action: 'Reload Page',
  },
};

// ── Screenshot & report ───────────────────────────────────────────────────────

async function captureScreenshot(): Promise<string | null> {
  try {
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: true,
      scale: 0.5,
      logging: false,
    });
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

// ── ErrorBoundary state UI ────────────────────────────────────────────────────

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
  screenshotDataUrl?: string | null;
  screenshotTaken: boolean;
  screenshotLoading: boolean;
  reportSent: boolean;
};

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false, screenshotTaken: false, screenshotLoading: false, reportSent: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (isChunkLoadError(error?.message ?? '')) {
      const lastReload = Number(sessionStorage.getItem(RELOAD_TS_KEY) ?? 0);
      if (Date.now() - lastReload > 20_000) {
        sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()));
        const url = new URL(location.href);
        url.searchParams.set('_lms_r', Date.now().toString());
        location.replace(url.toString());
        return;
      }
    }
    this.setState({ info });
    // Auto-capture screenshot after React renders the error UI (next tick)
    setTimeout(() => this.handleTakeScreenshot(), 500);
  }

  handleTakeScreenshot = async () => {
    if (this.state.screenshotLoading || this.state.screenshotTaken) return;
    this.setState({ screenshotLoading: true });
    const dataUrl = await captureScreenshot();
    this.setState({ screenshotDataUrl: dataUrl, screenshotTaken: true, screenshotLoading: false });
  };

  handleAction = (kind: ErrorKind) => {
    if (kind === 'access-denied' || kind === 'session-expired') {
      window.location.href = '/login';
    } else if (kind === 'cache') {
      sessionStorage.clear();
      localStorage.clear();
      const url = new URL(location.href);
      url.searchParams.set('_lms_r', Date.now().toString());
      location.replace(url.toString());
    } else if (kind === 'not-found') {
      history.back();
    } else {
      window.location.reload();
    }
  };

  handleSendReport = async () => {
    const { error, info, screenshotDataUrl } = this.state;
    const appVersion = typeof __APP_BUILD_HASH__ !== 'undefined' ? __APP_BUILD_HASH__.substring(0, 8) : undefined;
    await errorReportService.submit({
      kind: ERROR_REPORT_KINDS.REACT_BOUNDARY,
      errorMessage: (error?.message ?? 'Unknown error').slice(0, 500),
      errorStack: error?.stack,
      componentStack: info?.componentStack ?? undefined,
      screenshotDataUrl: screenshotDataUrl ?? undefined,
      pageUrl: location.href,
      userAgent: navigator.userAgent,
      appVersion,
      platform: typeof window !== 'undefined' && (window as any).__capacitor ? 'native' : 'web',
    });
    this.setState({ reportSent: true });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const kind = classifyError(this.state.error);
    const content = ERROR_CONTENT[kind];
    const { screenshotLoading, screenshotTaken, screenshotDataUrl, reportSent } = this.state;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          {/* Header bar by error kind */}
          <div className={`h-1.5 w-full ${
            kind === 'access-denied' || kind === 'payment-required' ? 'bg-amber-500' :
            kind === 'network' ? 'bg-orange-500' :
            kind === 'session-expired' ? 'bg-blue-500' :
            kind === 'cache' ? 'bg-purple-500' :
            'bg-red-500'
          }`} />

          <div className="p-6 space-y-5">
            {/* Icon + title */}
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                kind === 'access-denied' || kind === 'payment-required' ? 'bg-amber-100' :
                kind === 'network' ? 'bg-orange-100' :
                kind === 'session-expired' ? 'bg-blue-100' :
                kind === 'cache' ? 'bg-purple-100' :
                'bg-red-100'
              }`}>
                <ErrorIcon kind={kind} />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h1 className="text-lg font-bold text-slate-800">{content.title}</h1>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{content.message}</p>
              </div>
            </div>

            {/* Dev: stack trace */}
            {import.meta.env.DEV && this.state.error && (
              <details className="rounded-xl border border-slate-200 overflow-hidden">
                <summary className="px-3 py-2 text-xs font-semibold text-slate-500 cursor-pointer bg-slate-50 hover:bg-slate-100">
                  Technical details (dev only)
                </summary>
                <pre className="text-xs p-3 bg-slate-50 overflow-auto max-h-40 whitespace-pre-wrap text-slate-600">
                  {this.state.error.message}{'\n\n'}{this.state.error.stack}
                </pre>
              </details>
            )}

            {/* Screenshot preview */}
            {screenshotTaken && screenshotDataUrl && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-semibold text-slate-600">Screenshot captured</span>
                  <button
                    onClick={() => downloadDataUrl(screenshotDataUrl, `lms-error-${Date.now()}.jpg`)}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Download
                  </button>
                </div>
                <img src={screenshotDataUrl} alt="Error screenshot" className="w-full max-h-32 object-cover object-top" />
              </div>
            )}

            {screenshotLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Capturing screenshot…
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2.5">
              <button
                onClick={() => this.handleAction(kind)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-sm"
              >
                {content.action}
              </button>

              {/* Send report */}
              {!reportSent ? (
                <button
                  onClick={this.handleSendReport}
                  disabled={screenshotLoading}
                  className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {screenshotLoading ? 'Preparing…' : 'Send Error Report with Screenshot'}
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2.5 text-sm text-emerald-600 font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Report sent — thank you!
                </div>
              )}
            </div>

            <p className="text-center text-[10px] text-slate-400">
              Suraksha LMS · {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    );
  }
}

function ErrorIcon({ kind }: { kind: ErrorKind }) {
  const cls = `w-6 h-6 ${
    kind === 'access-denied' || kind === 'payment-required' ? 'text-amber-600' :
    kind === 'network' ? 'text-orange-600' :
    kind === 'session-expired' ? 'text-blue-600' :
    kind === 'cache' ? 'text-purple-600' :
    'text-red-600'
  }`;

  if (kind === 'network') return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M3 3l18 18" />
    </svg>
  );
  if (kind === 'access-denied' || kind === 'payment-required') return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
  if (kind === 'session-expired') return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (kind === 'cache') return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
  // generic / not-found / not-enrolled
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

export default ErrorBoundary;
export { classifyError, captureScreenshot };
export type { ErrorKind };
