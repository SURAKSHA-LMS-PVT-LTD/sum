import React from 'react';
import { type LucideIcon, AlertCircle, RefreshCw, WifiOff, ShieldOff, SearchX, Inbox } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/api/apiError';

// ─── Loading skeleton ─────────────────────────────────────────────────────────

interface LoadingStateProps {
  rows?: number;
  message?: string;
}

export function LoadingState({ rows = 5, message }: LoadingStateProps) {
  return (
    <Card>
      <CardContent className="py-6 space-y-3">
        {message && (
          <p className="text-sm text-muted-foreground text-center mb-4">{message}</p>
        )}
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}

function pickIcon(error: unknown): LucideIcon {
  if (error instanceof ApiError) {
    if (error.statusCode === 403 || error.statusCode === 401) return ShieldOff;
    if (error.statusCode === 404) return SearchX;
    if (error.statusCode === 0) return WifiOff;
  }
  if (error instanceof Error && /network|fetch|offline/i.test(error.message)) return WifiOff;
  return AlertCircle;
}

function friendlyMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 404) return 'This data could not be found. It may have been removed or you may not have access.';
    if (error.statusCode === 403) return 'You do not have permission to view this content.';
    if (error.statusCode === 401) return 'Your session has expired. Please log in again.';
    if (error.statusCode === 0 || /network|fetch|offline/i.test(error.message))
      return 'Could not reach the server. Check your connection and try again.';
    if (error.statusCode >= 500) return 'Something went wrong on our end. Please try again later.';
    return error.message || 'An unexpected error occurred.';
  }
  if (error instanceof Error) return error.message || 'An unexpected error occurred.';
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export function ErrorState({ error, onRetry, title }: ErrorStateProps) {
  const Icon = pickIcon(error);
  const message = friendlyMessage(error);

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <Icon className="h-7 w-7 text-destructive" />
        </div>
        <h3 className="text-base font-semibold mb-1 text-destructive">
          {title ?? 'Failed to load'}
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

interface EmptyStateExtProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, title, description, children }: EmptyStateExtProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold mb-1">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
        )}
        {children && <div className="mt-4">{children}</div>}
      </CardContent>
    </Card>
  );
}

// ─── Combined helper: renders loading → error → empty → content ───────────────

interface PageStateProps<T> {
  loading: boolean;
  error: unknown;
  data: T[] | T | null | undefined;
  onRetry?: () => void;
  loadingRows?: number;
  loadingMessage?: string;
  errorTitle?: string;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  children: (data: NonNullable<T extends any[] ? T : T[]>) => React.ReactNode;
  /** Skip the empty check (useful when data shape isn't a simple array) */
  skipEmptyCheck?: boolean;
}

export function PageState<T>({
  loading,
  error,
  data,
  onRetry,
  loadingRows = 5,
  loadingMessage,
  errorTitle,
  emptyIcon,
  emptyTitle = 'No data found',
  emptyDescription,
  emptyAction,
  children,
  skipEmptyCheck = false,
}: PageStateProps<T>) {
  if (loading) return <LoadingState rows={loadingRows} message={loadingMessage} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} title={errorTitle} />;
  if (!skipEmptyCheck) {
    const isEmpty = data === null || data === undefined ||
      (Array.isArray(data) && data.length === 0);
    if (isEmpty) {
      return (
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription}>
          {emptyAction}
        </EmptyState>
      );
    }
  }
  return <>{children(data as any)}</>;
}
