# Login Branding System — Complete Bug Analysis & Fix Guide

**Scope:** Three codebases — `lms-api-suraksha-lk` (backend), `lms user frotend` (institute admin UI), `sysstemadminfrotend` (system admin UI)

---

## Bug Map (Priority Order)

| # | Severity | Codebase | Root Cause |
|---|----------|----------|------------|
| 1 | 🔴 Critical | Backend | `institute-branding` upload folder not registered — every image upload rejected with 400 |
| 2 | 🔴 Critical | Sys Admin FE | `uploadFile(file, "institute-branding")` uses the unregistered folder name |
| 3 | 🔴 Critical | Sys Admin FE | Branding form never pre-loaded — every save wipes existing data |
| 4 | 🟠 High | User FE | After "Save Login Branding", the actual login page never refreshes (TenantContext stale) |
| 5 | 🟠 High | User FE | `verify-and-publish` hits wrong port locally (S3 upload succeeds, verify fails) |
| 6 | 🟡 Medium | User FE | Remove sets field to `''` instead of `null` — backend stores empty string, not NULL |
| 7 | 🟡 Medium | User FE | DOM nesting React warning in Login.tsx |

---

## Bug 1 — Backend: `institute-branding` folder is unknown

### Files
- `src/common/controllers/upload.controller.ts` — lines 12–13, 72, 166–168

### What happens
The system admin frontend (and the user frontend `verify-and-publish` path) call:
```
GET /upload/get-signed-url?folder=institute-branding&...
```
The backend validates the folder against a hardcoded `validFolders` array at line 166. `institute-branding` is not in that list, so every upload immediately fails:
```
400 Bad Request: Invalid folder. Must be one of: profile-images, student-images, ...
```

### Fix — `upload.controller.ts`

**Line 12-13** — add to `@IsEnum` array and union type:
```typescript
// Before (line 12–13):
@IsEnum(['profile-images', ..., 'lecture-thumbnails'])
folder: 'profile-images' | ... | 'lecture-thumbnails';

// After — add 'institute-branding' to both:
@IsEnum(['profile-images', ..., 'lecture-thumbnails', 'institute-branding'])
folder: 'profile-images' | ... | 'lecture-thumbnails' | 'institute-branding';
```

**Line 72** — add to `@ApiQuery` enum (Swagger docs only):
```typescript
@ApiQuery({ name: 'folder', enum: [...existing..., 'institute-branding'] })
```

**Line 166** — add to runtime validation array:
```typescript
const validFolders = [
  'profile-images', 'student-images', 'institute-images', 'institute-user-images',
  'subject-images', 'homework-files', 'correction-files', 'institute-payment-receipts',
  'subject-payment-receipts', 'enrollment-payment-receipts', 'class-payment-receipts',
  'id-documents', 'bookhire-vehicle-images', 'bookhire-owner-images',
  'service-payment-receipts', 'structured-lecture-covers', 'structured-lecture-documents',
  'lecture-thumbnails',
  'institute-branding',  // ← ADD THIS
];
```

**`validateFileExtension` method** — add a case for the new folder (find the existing switch/if-else pattern and add):
```typescript
// For institute-branding, allow same types as institute-images:
case 'institute-branding':
  allowedExtensions = ['jpg', 'jpeg', 'png', 'svg', 'webp', 'gif'];
  break;
```

**`getMaxFileSizeForFolder` method** — add:
```typescript
case 'institute-branding': return 5 * 1024 * 1024; // 5 MB
```

---

## Bug 2 — System Admin FE: wrong folder name + `uploadConfig.ts` missing entry

### Files
- `sysstemadminfrotend/src/components/forms/TenantManagementDialog.tsx` — line 80
- `sysstemadminfrotend/src/lib/uploadConfig.ts`

### What happens
`handleBrandingFileUpload` calls:
```typescript
const result = await uploadFile(file, "institute-branding");
```
- `uploadConfig.ts` has no entry for `institute-branding`, so `validateFile` falls through to the generic fallback (only `jpeg/png`). SVG, WebP, GIF fail even before hitting the API.
- The API then rejects the folder name (Bug 1).

### Fix — `uploadConfig.ts`

Add the missing folder config:
```typescript
// In UPLOAD_FOLDER_CONFIG object:
'institute-branding': {
  maxSizeMB: 5,
  acceptedTypes: ['JPEG', 'PNG', 'SVG', 'WebP', 'GIF'],
  mimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp', 'image/gif'],
},
```

No change needed in `TenantManagementDialog.tsx` — `"institute-branding"` is the correct folder name (once Bug 1 is fixed in backend).

---

## Bug 3 — System Admin FE: Branding form never pre-loaded from backend

### File
- `sysstemadminfrotend/src/components/forms/TenantManagementDialog.tsx`

### What happens
`brandingForm` state is initialized to all-empty strings (lines 53–65). There is no `useEffect` that calls `api.getLoginBranding(institute.id)` when the dialog opens. So:
1. Admin opens dialog → all fields are blank
2. Admin changes only "Welcome Title" → saves
3. Backend receives `PATCH` with `loginLogoUrl: ''`, `loginIllustrationUrl: ''`, etc. — **overwrites all existing images with empty strings**
4. Everything previously set is wiped

Also: the `useEffect` at line 100 that resets form state when `institute.id` changes does NOT load branding from the API.

### Fix — Add fetch on open

```typescript
// Add inside TenantManagementDialog, near other useEffect hooks:
useEffect(() => {
  if (!open || !institute?.id) return;

  const loadBranding = async () => {
    try {
      const data = await api.getLoginBranding(institute.id);
      setBrandingForm({
        loginLogoUrl: data.loginLogoUrl || '',
        loginBackgroundType: data.loginBackgroundType || 'COLOR',
        loginBackgroundUrl: data.loginBackgroundUrl || '',
        loginVideoPosterUrl: data.loginVideoPosterUrl || '',
        loginIllustrationUrl: data.loginIllustrationUrl || '',
        loginWelcomeTitle: data.loginWelcomeTitle || '',
        loginWelcomeSubtitle: data.loginWelcomeSubtitle || '',
        loginFooterText: data.loginFooterText || '',
        faviconUrl: data.faviconUrl || '',
        customAppName: data.customAppName || '',
        poweredByVisible: data.poweredByVisible ?? true,
      });
      // Pre-fill image previews
      const previews: Record<string, string> = {};
      if (data.loginLogoUrl) previews.loginLogoUrl = data.loginLogoUrl;
      if (data.loginIllustrationUrl) previews.loginIllustrationUrl = data.loginIllustrationUrl;
      if (data.loginBackgroundUrl) previews.loginBackgroundUrl = data.loginBackgroundUrl;
      if (data.faviconUrl) previews.faviconUrl = data.faviconUrl;
      if (data.loginVideoPosterUrl) previews.loginVideoPosterUrl = data.loginVideoPosterUrl;
      setBrandingPreviews(previews);
    } catch {
      // Non-fatal — form stays empty, user can still set values
    }
  };

  loadBranding();
}, [open, institute?.id]);
```

Also need `api.getLoginBranding` in `sysstemadminfrotend/src/lib/api.ts` (add it if missing):
```typescript
getLoginBranding: (id: string) =>
  apiRequest(`/v2/tenant/institutes/${id}/login-branding`, { method: "GET" }),
```

---

## Bug 4 — User FE: Login page does not refresh after "Save Login Branding"

### Files
- `lms user frotend/src/contexts/TenantContext.tsx`
- `lms user frotend/src/pages/InstituteSettingsPage.tsx` — `handleSaveBranding`

### What happens
`TenantContext` fetches branding **once on mount** and stores it in React state. After the institute admin saves new branding via `tenantApi.updateLoginBranding()`, the context has no way to know it should refetch. The login page keeps showing old data until the user hard-refreshes.

The user admin can see the text fields update in the form (because `brandingForm` state changes), but the live login page seen by students/staff still shows the stale branding from the initial fetch.

### Fix — Expose a `refetch` method in TenantContext

**`TenantContext.tsx`** — extract `fetchBranding` so it can be called again:

```typescript
// Change TenantContextType to add refetch:
export interface TenantContextType {
  // ...existing fields...
  refetch: () => void;
}

// Inside TenantProvider:
const [branding, setBranding] = useState<TenantBranding | null>(null);
const [isLoading, setIsLoading] = useState(detected.isTenantLogin);
const [error, setError] = useState<string | null>(null);
const [refreshKey, setRefreshKey] = useState(0);

const refetch = useCallback(() => setRefreshKey(k => k + 1), []);

useEffect(() => {
  if (!detected.isTenantLogin) return;
  // ... existing fetch logic, unchanged ...
}, [detected, refreshKey]);  // ← add refreshKey to deps

const value = useMemo(() => ({
  ...existing,
  refetch,
}), [detected, branding, isLoading, error, refetch]);
```

**`InstituteSettingsPage.tsx`** — call `refetch` after saving branding:

```typescript
const { refetch: refetchBranding } = useTenant();

const handleSaveBranding = async () => {
  if (!currentInstituteId) return;
  setTenantSaving(true);
  try {
    await tenantApi.updateLoginBranding(currentInstituteId, brandingForm);
    refetchBranding();  // ← re-fetch so login page shows new branding
    toast({ title: 'Saved', description: 'Login branding updated successfully.' });
  } catch (err: any) {
    toast({ title: 'Error', description: getErrorMessage(err, 'Failed to update branding'), variant: 'destructive' });
  } finally {
    setTenantSaving(false);
  }
};
```

---

## Bug 5 — User FE: `verify-and-publish` hits port 8080 locally (dev issue)

### File
- `lms user frotend/src/utils/signedUploadHelper.ts` — line 197–202

### What happens
```
S3 upload → success
POST :8080/upload/verify-and-publish → net::ERR_CONNECTION_REFUSED
```
The `uploadWithSignedUrl` function calls `getBaseUrl()` which returns the configured API base URL (e.g. `http://localhost:8080` in dev). If the backend is not running on port 8080, the verify step fails. The file is on S3 but marked private, and `onUploaded` is never called.

### Fix options (choose one)

**Option A (recommended):** Ensure the dev backend runs on the same port as `getBaseUrl()`. Usually set `VITE_API_URL=http://localhost:3000` (or whichever port NestJS uses) in `.env.local`.

**Option B:** Add a fallback to skip verify in dev:
```typescript
// In signedUploadHelper.ts, wrap verify step:
if (import.meta.env.PROD || import.meta.env.VITE_SKIP_VERIFY !== 'true') {
  const verifyResponse = await fetch(`${baseUrl}/upload/verify-and-publish`, { ... });
  // ... existing verify logic
}
// In dev with VITE_SKIP_VERIFY=true, just return relativePath directly
```

**Option C (best long-term):** Move the verify step to the backend automatically after S3 upload (webhook/event-driven), removing the need for the frontend to call verify separately.

---

## Bug 6 — User FE: Remove sets field to `''` instead of `null`

### File
- `lms user frotend/src/pages/InstituteSettingsPage.tsx` — lines 1032, 1041, 1076, 1088, 1099

### What happens
```typescript
onRemoved={() => setBrandingForm(prev => ({ ...prev, loginLogoUrl: '' }))}
```
The backend `UpdateLoginBrandingDto` accepts `string` (no `null`, no explicit empty check). The entity column stores an empty string `''` instead of `NULL`. When the public branding endpoint returns `loginLogoUrl: ""`, the login page checks:
```typescript
branding?.loginLogoUrl ? getImageUrl(branding.loginLogoUrl) : surakshaLogo
```
An empty string is **falsy**, so it actually falls back correctly in this case. However, storing `''` instead of `NULL` is semantically wrong and can break backend logic that checks `IS NOT NULL`.

### Fix — `InstituteSettingsPage.tsx`

Change all `onRemoved` callbacks from `''` to `null`:
```typescript
// All 5 instances — change '' to null:
onRemoved={() => setBrandingForm(prev => ({ ...prev, loginLogoUrl: null }))}
onRemoved={() => setBrandingForm(prev => ({ ...prev, faviconUrl: null }))}
onRemoved={() => setBrandingForm(prev => ({ ...prev, loginBackgroundUrl: null }))}
onRemoved={() => setBrandingForm(prev => ({ ...prev, loginVideoPosterUrl: null }))}
onRemoved={() => setBrandingForm(prev => ({ ...prev, loginIllustrationUrl: null }))}
```

Also update `LoginBrandingData` interface in `tenant.api.ts` to confirm all URL fields are `string | null` (they already are — just ensure `BrandingImageUploader.onRemoved` type allows `null`).

---

## Bug 7 — User FE: DOM nesting React warning

### File
- `lms user frotend/src/components/Login.tsx`

### What happens
React warns: `validateDOMNesting — cannot appear as a child of ...`

This is typically caused by:
- A `<p>` or `<span>` wrapping a `<div>`
- A `<button>` nested inside another `<button>`
- An `<a>` nested inside another `<a>`

The stack trace mentions `at App`, so it's a structural issue somewhere in the Login component's render tree.

### Fix
Search Login.tsx for `<p` elements that contain block-level children (`<div>`, `<section>`, etc.), and replace the outer `<p>` with `<div>`. Also check for any `<Button>` inside `<Label>` (which renders a `<label>` containing the button — valid HTML but React strict mode warns).

A common culprit:
```tsx
// Wrong — <p> cannot contain <div>:
<p className="text-sm">
  <div className="flex">...</div>
</p>

// Fix:
<div className="text-sm">
  <div className="flex">...</div>
</div>
```

---

## Data Flow Summary (for reference)

### How branding reaches the login page

```
User visits subdomain.suraksha.lk
  → TenantContext.detectTenant() identifies subdomain
  → TenantContext fetches: GET /v2/tenant/branding/subdomain/{sub}
    → TenantService.resolveBySubdomain()
    → Queries InstituteEntity (select: loginLogoUrl, loginIllustrationUrl, ...)
    → Returns InstituteBrandingResponse
  → Login.tsx receives branding via useTenant()
  → displayLogo = branding.loginLogoUrl ?? branding.logoUrl ?? surakshaLogo
  → displayIllustration = branding.loginIllustrationUrl ?? loginIllustration (default)
```

### How institute admin saves branding (user frontend)

```
InstituteSettingsPage
  → BrandingImageUploader: file selected
    → uploadWithSignedUrl(file, 'institute-images')
      → GET /upload/get-signed-url?folder=institute-images&...  ← uses institute-images, NOT institute-branding
      → PUT to S3 signed URL
      → POST /upload/verify-and-publish  ← fails locally if wrong port
    → onUploaded(relativePath) → setBrandingForm({ loginLogoUrl: relativePath })
  → "Save Login Branding" clicked → handleSaveBranding()
    → PATCH /v2/tenant/institutes/{id}/login-branding  { loginLogoUrl, ... }
    → TenantService.updateLoginBranding() → InstituteEntity.save()
    → [Bug 4] TenantContext NOT refetched → login page still shows old branding
```

### How system admin saves branding

```
TenantManagementDialog
  → [Bug 3] form starts empty — no GET /login-branding on open
  → Image upload: uploadFile(file, "institute-branding")
    → [Bug 1+2] 400 Bad Request — folder not registered
  → "Save Login Branding" → PATCH /v2/tenant/institutes/{id}/login-branding
    → sends all-empty fields → wipes existing data
```

---

## Fix Checklist

### Backend (`lms-api-suraksha-lk`)

- [ ] **`upload.controller.ts` line 12-13**: Add `'institute-branding'` to `@IsEnum` enum array and union type
- [ ] **`upload.controller.ts` line 72**: Add `'institute-branding'` to `@ApiQuery` enum (Swagger)
- [ ] **`upload.controller.ts` line 166**: Add `'institute-branding'` to `validFolders` runtime array
- [ ] **`upload.controller.ts` `validateFileExtension`**: Add case for `institute-branding` (allow jpg/png/svg/webp/gif)
- [ ] **`upload.controller.ts` `getMaxFileSizeForFolder`**: Add case for `institute-branding` (5 MB)

### System Admin Frontend (`sysstemadminfrotend`)

- [ ] **`uploadConfig.ts`**: Add `'institute-branding'` entry with correct MIME types
- [ ] **`api.ts`**: Add `getLoginBranding: (id) => apiRequest(...)` method if not present
- [ ] **`TenantManagementDialog.tsx`**: Add `useEffect` to load existing branding on dialog open
- [ ] **`TenantManagementDialog.tsx`**: Pre-populate `brandingPreviews` from loaded data

### User Frontend (`lms user frotend`)

- [ ] **`TenantContext.tsx`**: Add `refetch` to context — extract `refreshKey` state, expose `refetch` method
- [ ] **`InstituteSettingsPage.tsx` `handleSaveBranding`**: Call `refetchBranding()` after successful save
- [ ] **`InstituteSettingsPage.tsx` all `onRemoved`**: Change `''` → `null` (5 instances)
- [ ] **`.env.local`**: Ensure `VITE_API_URL` points to the correct local backend port to fix verify-and-publish
- [ ] **`Login.tsx`**: Find and fix DOM nesting violation (replace `<p>` wrapping block elements with `<div>`)

---

## Note on Upload Folders

The user frontend `BrandingImageUploader` already uses `'institute-images'` folder (not `'institute-branding'`). This is fine — `institute-images` is already registered. The folder name mismatch is only in the **system admin frontend**. Both frontends end up calling the same upload API, so fixing the backend + system admin frontend is sufficient.

After fixing Bug 1 in the backend, the system admin frontend will work with `"institute-branding"`. Alternatively, change the system admin frontend to use `"institute-images"` to avoid adding a new folder altogether — this is simpler but mixes institute logo images with branding images in the same bucket path.
