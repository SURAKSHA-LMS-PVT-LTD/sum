import React from 'react';
import { isChunkLoadError } from '@/main';

const RELOAD_TS_KEY = '__lms_last_chunk_reload';

type ErrorBoundaryState = { hasError: boolean; error?: Error; info?: React.ErrorInfo };

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // React.lazy chunk load failure → force a cache-busting redirect instead of showing error UI
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
    if (import.meta.env.DEV) {
      console.error('App crashed with error:', error, info);
    }
    this.setState({ info });
  }

  handleReset = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-xl w-full rounded-lg border p-6 space-y-4">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm opacity-80">The app encountered an error and couldn't display this page.</p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-xs p-3 rounded bg-muted/30 overflow-auto max-h-48 whitespace-pre-wrap">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
