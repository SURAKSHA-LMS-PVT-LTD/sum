/**
 * Universal API Error Handling
 * 
 * All backend endpoints return errors in a consistent shape.
 * This module provides the error class, parser, and handler.
 */

// ============= Types =============

export interface ApiErrorDetails {
  actionHint?: string;
  field?: string;
  fields?: string[];
  retryAfter?: string;
  hint?: string;
  [key: string]: any;
}

export interface ApiErrorShape {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  requestId: string;
  timestamp: string;
  path?: string;
  method?: string;
  details?: ApiErrorDetails;
}

// ============= Message Sanitization =============

/**
 * Raw technical messages that should never be shown to users.
 * When detected, we replace them with a friendly status-based message.
 */
const RAW_MESSAGE_PATTERNS = [
  /^jwt\s/i,                    // "jwt expired", "jwt malformed", etc.
  /^No auth token/i,            // Passport error
  /^invalid.*token/i,           // "Invalid token payload"
  /^invalid.*signature/i,       // JWT signature errors
  /^Unexpected token/i,         // JSON parse errors leaked
  /^ECONNREFUSED/i,             // Node connection errors
  /^ENOTFOUND/i,                // DNS errors
  /^ETIMEDOUT/i,                // Timeout errors
  /^fetch failed/i,             // Network fetch failures
  /^Failed to fetch/i,          // Browser fetch failures
  /^NetworkError/i,             // Generic network errors
  /^Load failed/i,              // Safari fetch failures
  /^Request failed with status/i, // Generic status leaks
  /^HTTP \d{3}$/,               // "HTTP 429", "HTTP 500" etc
  /^User not found$/i,          // Auth guard internal message
  /^User account is inactive$/i, // Auth guard internal message
  /^Authentication failed$/i,   // Generic passport error
  /^Cannot read propert/i,      // JS runtime errors leaked
  /^undefined is not/i,         // JS runtime errors leaked
  /^\[object Object\]$/,        // Stringified objects
  /^Backend URL not configured/i, // Internal config error
  /^No API URL configured/i,     // Internal config error
  /^No authentication token/i,   // Internal auth error
  /^Rate limited/i,              // Internal rate limit message from client
];

function isRawTechnicalMessage(message: string): boolean {
  return RAW_MESSAGE_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Sanitize an error message to be user-friendly.
 * Used by the ApiError constructor so that `.message` is always safe to display.
 */
function sanitizeErrorMessage(
  raw: string,
  statusCode: number,
  details?: ApiErrorDetails
): string {
  // 1. If backend provided an actionHint, it's explicitly user-facing
  if (details?.actionHint) return details.actionHint;

  // 2. Status-specific friendly messages
  if (statusCode === 401) return 'Your session has expired. Please log in again.';
  if (statusCode === 403) return 'You do not have permission to perform this action.';
  if (statusCode === 429) return details?.hint ?? 'Too many requests. Please wait a moment and try again.';
  if (statusCode >= 500) return 'Something went wrong on our end. Please try again later.';

  // 3. If the raw message is technical, replace with status-based message
  if (isRawTechnicalMessage(raw)) {
    return statusCode > 0 ? getDefaultErrorMessage(statusCode) : 'An unexpected error occurred';
  }

  // 4. Message is user-friendly enough
  return raw;
}

// ============= ApiError Class =============

/**
 * Structured API error that preserves all backend error fields.
 * Thrown by API clients instead of plain Error.
 * The `message` property is always user-friendly (sanitized).
 * The original raw message is preserved in `rawMessage` for debugging.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly errorType: string;
  readonly requestId: string;
  readonly timestamp: string;
  readonly path?: string;
  readonly details?: ApiErrorDetails;
  /** Original unsanitized message from the backend (for logging/debugging only) */
  readonly rawMessage: string;

  constructor(shape: ApiErrorShape) {
    const raw = shape.details?.actionHint ?? shape.message;
    const friendly = sanitizeErrorMessage(raw, shape.statusCode, shape.details);
    super(friendly);
    this.name = 'ApiError';
    this.rawMessage = raw;
    this.statusCode = shape.statusCode;
    this.errorType = shape.error;
    this.requestId = shape.requestId;
    this.timestamp = shape.timestamp;
    this.path = shape.path;
    this.details = shape.details;
  }

  /** The primary user-facing message (always sanitized) */
  get userMessage(): string {
    return this.message;
  }

  /** Whether this is a server error (5xx) */
  get isServerError(): boolean {
    return this.statusCode >= 500;
  }

  /** Whether this is a validation error with field-level details */
  get hasFieldErrors(): boolean {
    return !!(this.details?.fields?.length || this.details?.field);
  }
}

// ============= Parser =============

/**
 * Parse an error response body (text) into an ApiError.
 * Falls back to a generic ApiError if the body isn't the expected shape.
 */
export function parseApiError(status: number, errorText: string, url?: string): ApiError {
  try {
    const json = JSON.parse(errorText);

    // Check if it matches the backend error shape
    if (json.message && json.statusCode) {
      return new ApiError({
        success: false,
        statusCode: json.statusCode ?? status,
        message: Array.isArray(json.message) ? json.message.join(', ') : json.message,
        error: json.error ?? 'UnknownError',
        requestId: json.requestId ?? 'unknown',
        timestamp: json.timestamp ?? new Date().toISOString(),
        path: json.path ?? url,
        method: json.method,
        details: json.details,
      });
    }

    // Partial shape — extract what we can
    return new ApiError({
      success: false,
      statusCode: status,
      message: json.message ?? json.error ?? `HTTP ${status}`,
      error: json.error ?? 'UnknownError',
      requestId: json.requestId ?? 'unknown',
      timestamp: json.timestamp ?? new Date().toISOString(),
      path: url,
      details: json.details,
    });
  } catch {
    // Not JSON at all
    return new ApiError({
      success: false,
      statusCode: status,
      message: errorText || getDefaultErrorMessage(status),
      error: 'UnknownError',
      requestId: 'unknown',
      timestamp: new Date().toISOString(),
      path: url,
    });
  }
}

// ============= Handler =============

export interface HandleApiErrorOptions {
  /** Highlight a specific form field with its error message */
  onField?: (fieldName: string, message: string) => void;
  /** Show a toast/notification */
  onToast?: (message: string, severity: 'error' | 'warning') => void;
  /** Called on 5xx errors with the requestId for logging */
  onServerError?: (requestId: string) => void;
}

/**
 * Universal error handler — call in any catch block.
 * Handles field-level validation, server errors, and general errors.
 * All messages shown to users are guaranteed to be friendly.
 */
export function handleApiError(err: unknown, options?: HandleApiErrorOptions): string {
  // Normalize to ApiError
  const apiErr = toApiError(err);

  // 1. Field-level validation errors — highlight individual fields
  if (apiErr.details?.fields?.length) {
    const userMessage = getErrorMessage(err, 'Validation failed. Please check your input.');
    apiErr.details.fields.forEach(fieldMsg => {
      const fieldName = fieldMsg.split(' ')[0];
      options?.onField?.(fieldName, fieldMsg);
    });
    options?.onToast?.(userMessage, 'error');
    return userMessage;
  }

  // 2. Single field error
  if (apiErr.details?.field) {
    const userMessage = getErrorMessage(err, 'Validation failed. Please check your input.');
    options?.onField?.(apiErr.details.field, userMessage);
    options?.onToast?.(userMessage, 'error');
    return userMessage;
  }

  // 3. Server error (500+) — generic message + requestId
  if (apiErr.isServerError) {
    const serverMsg = apiErr.requestId && apiErr.requestId !== 'unknown'
      ? `Something went wrong. Please try again. (Ref: ${apiErr.requestId})`
      : 'Something went wrong. Please try again later.';
    options?.onToast?.(serverMsg, 'error');
    options?.onServerError?.(apiErr.requestId);
    return serverMsg;
  }

  // 4. Rate limited (429)
  if (apiErr.statusCode === 429) {
    const rateMsg = apiErr.details?.hint ?? 'Too many requests. Please wait a moment and try again.';
    options?.onToast?.(rateMsg, 'warning');
    return rateMsg;
  }

  // 5. Unauthorized (401)
  if (apiErr.statusCode === 401) {
    const authMsg = 'Your session has expired. Please log in again.';
    options?.onToast?.(authMsg, 'warning');
    return authMsg;
  }

  // 6. Forbidden (403)
  if (apiErr.statusCode === 403) {
    const forbiddenMsg = 'You do not have permission to perform this action.';
    options?.onToast?.(forbiddenMsg, 'error');
    return forbiddenMsg;
  }

  // 7. Anything else — use getErrorMessage which filters raw technical strings
  const userMessage = getErrorMessage(err);
  options?.onToast?.(userMessage, 'error');
  return userMessage;
}

// ============= Utilities =============

/**
 * Convert any caught error to an ApiError instance.
 */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (err instanceof Error) {
    return new ApiError({
      success: false,
      statusCode: 0,
      message: err.message || 'An unexpected error occurred',
      error: 'UnknownError',
      requestId: 'unknown',
      timestamp: new Date().toISOString(),
    });
  }

  // Handle raw error objects (e.g. from axios response.data)
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const obj = err as any;
    return new ApiError({
      success: false,
      statusCode: obj.statusCode ?? 0,
      message: obj.message ?? 'An unexpected error occurred',
      error: obj.error ?? 'UnknownError',
      requestId: obj.requestId ?? 'unknown',
      timestamp: obj.timestamp ?? new Date().toISOString(),
      details: obj.details,
    });
  }

  return new ApiError({
    success: false,
    statusCode: 0,
    message: 'An unexpected error occurred',
    error: 'UnknownError',
    requestId: 'unknown',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Get user-friendly error message based on HTTP status code.
 */
export function getDefaultErrorMessage(status: number): string {
  const messages: Record<number, string> = {
    400: 'Invalid request. Please check your input.',
    401: 'Authentication required. Please login.',
    403: 'You do not have permission to access this resource.',
    404: 'The requested resource was not found.',
    409: 'Conflict. The resource already exists.',
    422: 'Validation failed. Please check your input.',
    429: 'Too many requests. Please try again later.',
    500: 'Server error. Please try again later.',
    502: 'Bad gateway. Please try again later.',
    503: 'Service unavailable. Please try again later.',
    504: 'Request timeout. Please try again later.',
  };
  return messages[status] || `Request failed with status ${status}`;
}

/**
 * Quick one-liner for catch blocks with toast.
 * Usage: catch (e) { showApiError(e, toast.error) }
 */
export function showApiError(err: unknown, toastFn: (msg: string) => void): void {
  handleApiError(err, {
    onToast: (msg) => toastFn(msg),
  });
}

/**
 * Extract the best user-facing message from any caught error.
 * Since ApiError.message is already sanitized by the constructor,
 * this mainly handles plain Error instances and unknown errors.
 * Usage: catch (e) { toast({ description: getErrorMessage(e, 'Failed to load') }) }
 */
export function getErrorMessage(err: unknown, fallback = 'An unexpected error occurred'): string {
  // For ApiError instances, .message is already sanitized by the constructor
  if (err instanceof ApiError) {
    return err.message || fallback;
  }

  // For plain Error or unknown — convert to ApiError (which sanitizes the message)
  const apiErr = toApiError(err);
  return apiErr.message || fallback;
}
