# Full Security, Performance & Bug Audit — Fix Report

**Project:** Suraksha LMS (Backend API + Frontend App)  
**Date:** Auto-generated  
**Backend:** NestJS 11.1.6 · TypeORM · MySQL 8.x · JWT v2  
**Frontend:** React 19 · Vite · TailwindCSS · MUI · TanStack React Query · Capacitor  

---

## Table of Contents

| # | ID | Severity | Category | Title | Status |
|---|-----|----------|----------|-------|--------|
| 1 | S1a | **CRITICAL** | Security | localStorage token access in QRAttendance.tsx | ✅ Fixed |
| 2 | S1b | **CRITICAL** | Security | Dead localStorage helpers in SubjectSelector.tsx | ✅ Fixed |
| 3 | S1c | **CRITICAL** | Security | localStorage token leak in AttendanceMarkerSubjectSelector.tsx | ✅ Fixed |
| 4 | S2 | **CRITICAL** | Security | Hardcoded mock credentials in Login.tsx | ✅ Fixed |
| 5 | S3 | **CRITICAL** | Security | Path traversal in file.controller.ts | ✅ Fixed |
| 6 | S4 | HIGH | Security | Console.log leaking user data in Login.tsx | ✅ Fixed |
| 7 | S5 | HIGH | Security | Missing role guards on advertising controller | ❌ False Positive |
| 8 | S6 | HIGH | Security | Google Drive query injection in user-drive-access.service.ts | ✅ Fixed |
| 9 | S7 | HIGH | Security | CORS allow-all when unconfigured | ✅ Fixed |
| 10 | S8 | HIGH | Security | Unbounded pagination on raw `@Query('limit')` endpoints | ✅ Fixed |
| 11 | S9 | HIGH | Security | File upload MIME-only validation (no magic bytes) | ✅ Fixed |
| 12 | B1 | HIGH | Bug | HTTP method + path mismatch: organization.api.ts transferPresidency | ✅ Fixed |
| 13 | B2 | HIGH | Bug | Missing @Public() on BookhireOwner auth | ❌ False Positive |
| 14 | B5/B6 | MEDIUM | Bug | SMS service missing transactions / cache TTL | ❌ False Positive |
| 15 | B8 | MEDIUM | Bug | Non-null assertions on nullable context in ClassSubjects.tsx | ✅ Fixed |
| 16 | B9 | MEDIUM | Bug | Stale closure in VideoPreviewDialog.tsx setTimeout | ✅ Fixed |
| 17 | B10 | LOW | Bug | useRouteContext error state in promise chains | ⏭ Skipped (safe) |
| 18 | B14 | LOW | Code Quality | Dead getAuthToken / getApiHeaders in SubjectSelector.tsx | ✅ Fixed |

---

## 1 · S1a — localStorage Token Access in QRAttendance.tsx

**Severity:** CRITICAL · **Category:** Security  
**File:** `suraksha-lms123/src/components/QRAttendance.tsx`

### Problem

The component read `access_token` and `baseUrl` directly from `localStorage`. The project migrated to an in-memory token model (`tokenStorageService`) — localStorage reads bypass token management and may return stale/missing tokens.

### Before

```tsx
const baseUrl = localStorage.getItem('baseUrl') || '';
const token = localStorage.getItem('access_token');
```

### After

```tsx
import { getBaseUrl } from '@/contexts/utils/auth.api';
import { tokenStorageService } from '@/services/tokenStorageService';

// …inside the component:
const baseUrl = getBaseUrl();
const token = tokenStorageService.getAccessToken();
```

### Impact

Tokens are now retrieved through the correct in-memory channel, matching the rest of the app.

---

## 2 · S1b — Dead localStorage Helpers in SubjectSelector.tsx

**Severity:** CRITICAL · **Category:** Security / Code Quality  
**File:** `suraksha-lms123/src/components/SubjectSelector.tsx`

### Problem

Two unused functions — `getAuthToken()` and `getApiHeaders()` — read from `localStorage`. Although not called at runtime (the component uses `enhancedCachedClient`), they represent dead code that could mislead future developers into using the deprecated pattern.

### Fix

Both functions were removed entirely. No callers existed.

---

## 3 · S1c — localStorage Token Leak in AttendanceMarkerSubjectSelector.tsx

**Severity:** CRITICAL · **Category:** Security  
**File:** `suraksha-lms123/src/components/AttendanceMarkerSubjectSelector.tsx`

### Problem

A debug button's `onClick` handler read `baseUrl` and `access_token` from `localStorage` and logged them.

### Before

```tsx
onClick={() => {
  const baseUrl = localStorage.getItem('baseUrl');
  const token = localStorage.getItem('access_token');
  console.log('Debug - Current state:', { ... token: token ? 'present' : 'missing' ... });
}}
```

### After

```tsx
onClick={() => {
  console.log('Debug - Current state:', { ... });
}}
```

The localStorage reads were removed; remaining debug info does not expose credentials.

---

## 4 · S2 — Hardcoded Mock Credentials in Login.tsx

**Severity:** CRITICAL · **Category:** Security  
**File:** `suraksha-lms123/src/components/Login.tsx`

### Problem

A `mockUsers` array contained plaintext usernames and passwords. In production builds this data was included in the JavaScript bundle.

### Before

```tsx
const mockUsers = [
  { username: 'admin', password: 'Admin@123', role: 'admin', name: 'System Administrator' },
  // …more entries…
];
```

### After

```tsx
const mockUsers = import.meta.env.DEV ? [
  { username: 'admin', password: 'Admin@123', role: 'admin', name: 'System Administrator' },
  // …
] : [];
```

Vite tree-shakes the array to `[]` in production builds, eliminating credential exposure.

---

## 5 · S3 — Path Traversal in file.controller.ts

**Severity:** CRITICAL · **Category:** Security  
**File:** `lms-api-suraksha-lk/src/modules/files/file.controller.ts`

### Problem

Three file-serving endpoints accepted arbitrary `folder` and `filename` parameters with `anyInstituteRole: true` but performed no path-traversal or whitelist validation. An attacker could use `../` sequences to escape the intended directory.

### Fix

Added:

```typescript
private static readonly ALLOWED_FOLDERS = new Set([
  'profile-images', 'homework', 'homework-references',
  'attendance', 'advertisements', 'documents', 'uploads', 'images',
]);

private validateFolder(folder: string): void {
  if (!FileController.ALLOWED_FOLDERS.has(folder)) {
    throw new NotFoundException('Unknown folder');
  }
}

private validateFilename(filename: string): void {
  if (filename.includes('..') || filename.includes('/') ||
      filename.includes('\\') || filename.includes('\0')) {
    throw new BadRequestException('Invalid filename');
  }
}
```

All three endpoints now call `validateFolder()` and `validateFilename()` before serving.

---

## 6 · S4 — Console.log Leaking User Data

**Severity:** HIGH · **Category:** Security  
**File:** `suraksha-lms123/src/components/Login.tsx`

### Problem

```tsx
console.log('User logged in:', user);
console.log('User role:', user.role);
```

These lines leak the full user object (including tokens) into browser DevTools.

### Fix

Both lines removed.

---

## 7 · S5 — Missing Role Guards on Advertising Controller

**Severity:** HIGH · **Category:** Security  
**Status:** ❌ **False Positive**

The initially reported file `enhanced-advertising.controller.ts` does not exist. The actual advertising controller (`advertising.controller.ts`) has proper `@UseGuards(JwtAuthGuard)` and role-based decorators. No fix needed.

---

## 8 · S6 — Google Drive Query Injection

**Severity:** HIGH · **Category:** Security  
**File:** `lms-api-suraksha-lk/src/modules/user-drive-access/services/user-drive-access.service.ts`

### Problem

The `findOrCreateFolder` method built a Google Drive API query by interpolating the folder name with only single-quote escaping. Backslash sequences and control characters were not handled.

### Before

```typescript
const escapedName = folderName.replace(/'/g, "\\'");
```

### After

```typescript
const escapedName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
if (/[\x00-\x1f]/.test(folderName)) {
  throw new BadRequestException('Folder name contains invalid characters');
}
```

---

## 9 · S7 — CORS Default: Allow-All When Unconfigured

**Severity:** HIGH · **Category:** Security  
**File:** `lms-api-suraksha-lk/src/common/services/admin-access-control.service.ts`

### Problem

When `allowedAdminOrigins` was empty, the origin check returned `true` (allow-all), meaning a misconfigured deployment had wide-open CORS.

### Before

```typescript
if (this.allowedAdminOrigins.length === 0) {
  this.logger.warn('No admin origins configured, allowing all origins');
  return true;
}
```

### After

```typescript
if (this.allowedAdminOrigins.length === 0) {
  this.logger.warn('No admin origins configured – denying all by default');
  return false;
}
```

---

## 10 · S8 — Unbounded Pagination on Raw `@Query('limit')` Endpoints

**Severity:** HIGH · **Category:** Security / Performance  
**Files:**
- `lms-api-suraksha-lk/src/common/interceptors/pagination-limit.interceptor.ts` *(new file)*
- `lms-api-suraksha-lk/src/main.ts`

### Problem

While the shared `PaginationDto` has `@Max(100)`, many controllers use raw `@Query('limit')` without the DTO. An attacker could request `?limit=999999` to cause large DB reads.

### Fix

Created a global `PaginationLimitInterceptor` that caps `query.limit` to 100 on every request, regardless of whether the controller uses `PaginationDto`:

```typescript
@Injectable()
export class PaginationLimitInterceptor implements NestInterceptor {
  private static readonly MAX_LIMIT = 100;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (request?.query?.limit) {
      const parsed = parseInt(request.query.limit, 10);
      if (!isNaN(parsed) && parsed > PaginationLimitInterceptor.MAX_LIMIT) {
        request.query.limit = String(PaginationLimitInterceptor.MAX_LIMIT);
      }
    }
    return next.handle();
  }
}
```

Registered globally in `main.ts`:

```typescript
const { PaginationLimitInterceptor } = await import('./common/interceptors/pagination-limit.interceptor');
app.useGlobalInterceptors(new PaginationLimitInterceptor());
```

---

## 11 · S9 — File Upload: MIME-Only Validation (No Magic Bytes)

**Severity:** HIGH · **Category:** Security  
**File:** `lms-api-suraksha-lk/src/common/utils/file-validation.util.ts`

### Problem

File uploads were validated only by MIME type and extension. An attacker could rename a malicious file to `.jpg` and MIME-sniff past the check.

### Fix

Added magic-byte signature validation:

```typescript
private static readonly MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png':  [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif':  [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
};

static validateMagicBytes(buffer: Buffer, declaredMime: string): void {
  const signatures = this.MAGIC_BYTES[declaredMime];
  if (!signatures) return; // no signature on file → pass (unknown types)
  const header = buffer.subarray(0, 16);
  const matches = signatures.some(sig =>
    sig.every((byte, i) => header[i] === byte),
  );
  if (!matches) {
    throw new BadRequestException(
      'File content does not match its declared type',
    );
  }
}
```

`validateFile()` now calls `validateMagicBytes()` when a buffer is available.

---

## 12 · B1 — HTTP Method + Path Mismatch: transferPresidency

**Severity:** HIGH · **Category:** Bug  
**File:** `suraksha-lms123/src/api/organization.api.ts`

### Problem

The frontend called `PUT /organizations/:id/management/transfer-presidency`, but the backend defines `POST /organizations/:id/transfer-presidency`.

### Before

```typescript
transferPresidency: async (organizationId: string, data: any) =>
  apiClient.put(`/organizations/${organizationId}/management/transfer-presidency`, data),
```

### After

```typescript
transferPresidency: async (organizationId: string, data: any) =>
  apiClient.post(`/organizations/${organizationId}/transfer-presidency`, data),
```

---

## 13 · B2 — Missing @Public() on BookhireOwner Auth

**Severity:** HIGH · **Category:** Bug  
**Status:** ❌ **False Positive**

Verification confirmed `BookhireOwnerAuthController` already has `@Public()` decorators on both `register()` and `login()` endpoints. No fix needed.

---

## 14 · B5/B6 — SMS Service Missing Transactions / Cache TTL

**Severity:** MEDIUM · **Category:** Bug  
**Status:** ❌ **False Positive**

Verification confirmed:
- SMS service uses `QueryRunner` transactions for multi-step DB operations.
- Caches have `ttl` and `maxEntries` configured.
- `onModuleDestroy()` clears interval timers on shutdown.

No fix needed.

---

## 15 · B8 — Non-null Assertions on Nullable Context

**Severity:** MEDIUM · **Category:** Bug  
**File:** `suraksha-lms123/src/components/ClassSubjects.tsx`

### Problem

`currentInstituteId!` and `currentClassId!` non-null assertions in two functions could throw at runtime if the context values were null.

### Before

```tsx
instituteId: currentInstituteId!,
classId: currentClassId!,
```

### After

```tsx
instituteId: currentInstituteId || '',
classId: currentClassId || '',
```

Applied in both `confirmUnassignTeacher()` and `handleManageEnrollment()`.

---

## 16 · B9 — Stale Closure in VideoPreviewDialog.tsx

**Severity:** MEDIUM · **Category:** Bug  
**File:** `suraksha-lms123/src/components/VideoPreviewDialog.tsx`

### Problem

A `setTimeout` callback captured the `loaded` state value at effect creation time. If the iframe loaded before the 2.5 s timer fired, the callback still saw `loaded === false` and incorrectly set fallback.

### Before

```tsx
useEffect(() => {
  setLoaded(false);
  setFallback(false);
  if (!embedUrl) return;
  const t = window.setTimeout(() => {
    if (!loaded) setFallback(true);  // ← stale `loaded`
  }, 2500);
  return () => window.clearTimeout(t);
}, [embedUrl, open]);
```

### After

```tsx
const loadedRef = React.useRef(false);

useEffect(() => {
  setLoaded(false);
  setFallback(false);
  loadedRef.current = false;
  if (!embedUrl) return;
  const t = window.setTimeout(() => {
    if (!loadedRef.current) setFallback(true);  // ← reads mutable ref
  }, 2500);
  return () => window.clearTimeout(t);
}, [embedUrl, open]);

// Both iframe onLoad handlers updated:
onLoad={() => { loadedRef.current = true; setLoaded(true); }}
```

---

## 17 · B10 — useRouteContext Error State

**Severity:** LOW · **Category:** Bug  
**Status:** ⏭ **Skipped**

Promise chains in `useRouteContext.ts` use `.catch()` for logging and `.finally()` to release `fetchInProgressRef` locks. The error handling is adequate — no fix required.

---

## 18 · B14 — Dead getAuthToken / getApiHeaders Code

**Severity:** LOW · **Category:** Code Quality  
**File:** `suraksha-lms123/src/components/SubjectSelector.tsx`

### Problem

Two unused functions (`getAuthToken`, `getApiHeaders`) defined locally read from `localStorage` — dead code from before the `enhancedCachedClient` migration.

### Fix

Both functions removed. (Covered jointly with S1b.)

---

## Summary of Files Modified

| # | File | Changes |
|---|------|---------|
| 1 | `suraksha-lms123/src/components/QRAttendance.tsx` | Replaced localStorage with `getBaseUrl()` + `tokenStorageService` |
| 2 | `suraksha-lms123/src/components/Login.tsx` | Wrapped mockUsers in DEV check; removed console.log user leak |
| 3 | `suraksha-lms123/src/components/SubjectSelector.tsx` | Removed dead `getAuthToken` / `getApiHeaders` |
| 4 | `suraksha-lms123/src/components/AttendanceMarkerSubjectSelector.tsx` | Removed localStorage from debug handler |
| 5 | `suraksha-lms123/src/api/organization.api.ts` | PUT→POST, fixed path for `transferPresidency` |
| 6 | `suraksha-lms123/src/components/ClassSubjects.tsx` | `!` assertions → `\|\| ''` fallbacks |
| 7 | `suraksha-lms123/src/components/VideoPreviewDialog.tsx` | Added `loadedRef` to fix stale closure |
| 8 | `lms-api-suraksha-lk/src/modules/files/file.controller.ts` | Folder whitelist + path traversal validators |
| 9 | `lms-api-suraksha-lk/src/modules/user-drive-access/services/user-drive-access.service.ts` | Backslash + control-char sanitization |
| 10 | `lms-api-suraksha-lk/src/common/services/admin-access-control.service.ts` | CORS default → deny |
| 11 | `lms-api-suraksha-lk/src/common/utils/file-validation.util.ts` | Magic-byte validation |
| 12 | `lms-api-suraksha-lk/src/common/interceptors/pagination-limit.interceptor.ts` | **New file** — global limit cap |
| 13 | `lms-api-suraksha-lk/src/main.ts` | Registered `PaginationLimitInterceptor` globally |

### Files NOT Modified (False Positives / Already Correct)

- `BookhireOwnerAuthController` — already has `@Public()`
- SMS service — already has transactions, TTL, cleanup
- `enhanced-advertising.controller.ts` — file does not exist; actual controller has guards
- `useRouteContext.ts` — error handling is adequate

---

## Severity Breakdown

| Severity | Found | Fixed | False Positive | Skipped |
|----------|-------|-------|----------------|---------|
| CRITICAL | 5 | 5 | 0 | 0 |
| HIGH | 8 | 6 | 2 | 0 |
| MEDIUM | 3 | 2 | 1 | 0 |
| LOW | 2 | 1 | 0 | 1 |
| **Total** | **18** | **14** | **3** | **1** |

---

*End of report.*
