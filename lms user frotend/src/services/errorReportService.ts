import { apiClient } from '@/api/client';

export const ERROR_REPORT_KINDS = {
  REACT_BOUNDARY: 'REACT_BOUNDARY',
  API_5XX:        'API_5XX',
  API_CLIENT:     'API_CLIENT',
  UNHANDLED_JS:   'UNHANDLED_JS',
} as const;

export type ErrorReportKind = typeof ERROR_REPORT_KINDS[keyof typeof ERROR_REPORT_KINDS];

export interface SubmitErrorReportPayload {
  kind: ErrorReportKind;
  errorMessage: string;
  errorStack?: string;
  componentStack?: string;
  httpStatus?: number;
  requestId?: string;
  apiPath?: string;
  pageUrl: string;
  userAgent: string;
  appVersion?: string;
  platform?: string;
  context?: Record<string, any>;
  screenshotDataUrl?: string;
}

async function submit(payload: SubmitErrorReportPayload): Promise<void> {
  try {
    await apiClient.post('/error-reports', payload);
  } catch {
    // Silently ignore — reporting failure must not cause further crashes
  }
}

export const errorReportService = { submit };
