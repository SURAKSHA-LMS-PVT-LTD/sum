# Custom Institute Login System Analysis

## `abcinstitute.suraksha.lk` — Multi-Tenant White-Label Login

> Complete analysis of integrating custom subdomain-based logins for institutes  
> (e.g., `abcinstitute.suraksha.lk`, `royalcollege.suraksha.lk`)  
> Covers: Frontend, Backend, Mobile App, Advantages, Disadvantages, and Implementation Roadmap

---

## Table of Contents

1. [Current System Architecture](#1-current-system-architecture)
2. [Proposed Multi-Tenant Architecture](#2-proposed-multi-tenant-architecture)
3. [Backend Implementation](#3-backend-implementation)
4. [Frontend (Web) Implementation](#4-frontend-web-implementation)
5. [Mobile App (Capacitor/Android) Implementation](#5-mobile-app-implementation)
6. [System Admin Frontend](#6-system-admin-frontend)
7. [Infrastructure & DevOps](#7-infrastructure--devops)
8. [Security Considerations](#8-security-considerations)
9. [Advantages](#9-advantages)
10. [Disadvantages](#10-disadvantages)
11. [Cost Analysis](#11-cost-analysis)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Alternative Approaches](#13-alternative-approaches)
14. [Recommendation](#14-recommendation)

---

## 1. Current System Architecture

### 1.1 How It Works Today

| Component | Current Setup |
|-----------|---------------|
| **Frontend URL** | `https://lms.suraksha.lk` (single domain for all users) |
| **API URL** | `https://lmsapi.suraksha.lk` (single backend) |
| **Admin URL** | `https://admin.suraksha.lk` |
| **Mobile App** | `lk.suraksha.lms` — single APK, connects to `lmsapi.suraksha.lk` |
| **Auth Flow** | User logs in → selects institute → gets institute-scoped JWT |
| **Database** | Single MySQL/MariaDB database with `institutes` table |
| **Branding** | Institute entity has `logoUrl`, `loadingGifUrl`, `primaryColorCode`, `secondaryColorCode` — but **NOT used at login** |

### 1.2 Current Auth Flow (from codebase)

```
User → POST /v2/auth/login (identifier + password)
     → Returns: access_token + refresh_token + payload with institute access
     → Frontend shows institute selection
     → User selects institute → app applies institute context
```

**Key files:**
- Backend: `auth.service.ts`, `auth.v2.controller.ts`, `auth.mobile.controller.ts`
- Frontend: `AuthContext.tsx`, `Login.tsx`, `auth.api.ts`
- JWT: Enhanced payload with `i` (institute access array), `s` (userId), `u` (userType)

### 1.3 Current Institute Entity (Branding Fields Already Exist)

```typescript
// From institute.entity.ts — these fields ALREADY exist in the database
@Column({ name: 'logo_url' })           logoUrl?: string;
@Column({ name: 'loading_gif_url' })    loadingGifUrl?: string;
@Column({ name: 'primary_color_code' }) primaryColorCode?: string;    // e.g., "#1E40AF"
@Column({ name: 'secondary_color_code' }) secondaryColorCode?: string; // e.g., "#3B82F6"
@Column({ name: 'website_url' })        websiteUrl?: string;
@Column()                                name: string;
@Column()                                code: string;                  // Unique code like "RCOL"
```

### 1.4 Current CORS Configuration

```typescript
// From main.ts — hardcoded allowed origins
const allowedOrigins = [
  'https://lms.suraksha.lk',
  'https://org.suraksha.lk',
  'https://transport.suraksha.lk',
  'https://admin.suraksha.lk',
  // ... localhost entries for dev
];
```

---

## 2. Proposed Multi-Tenant Architecture

### 2.1 URL Scheme

```
https://abcinstitute.suraksha.lk     → Login page branded for ABC Institute
https://royalcollege.suraksha.lk     → Login page branded for Royal College
https://lms.suraksha.lk              → Generic login (current behavior)
https://lmsapi.suraksha.lk           → Single shared API (no change)
```

### 2.2 How It Would Work

```
┌──────────────────────────────────────────────────────┐
│  User visits: https://abcinstitute.suraksha.lk       │
│                                                      │
│  1. Frontend extracts subdomain: "abcinstitute"      │
│  2. Calls: GET /api/institutes/by-subdomain/         │
│            abcinstitute                              │
│  3. API returns: { id, name, logoUrl,                │
│     primaryColorCode, secondaryColorCode }           │
│  4. Frontend applies branding (logo, colors)         │
│  5. Login form shown with institute branding         │
│  6. User logs in → POST /v2/auth/login               │
│     with { identifier, password,                     │
│     instituteSubdomain: "abcinstitute" }             │
│  7. Backend validates user belongs to this institute  │
│  8. Returns scoped JWT (pre-selected institute)      │
│  9. User goes directly to dashboard (no institute    │
│     selection step)                                  │
└──────────────────────────────────────────────────────┘
```

---

## 3. Backend Implementation

### 3.1 Database Changes

#### New Column on `institutes` Table

```sql
ALTER TABLE institutes 
  ADD COLUMN subdomain VARCHAR(63) UNIQUE DEFAULT NULL 
    COMMENT 'Custom subdomain for institute login (e.g., "abcinstitute" → abcinstitute.suraksha.lk)',
  ADD COLUMN custom_login_enabled BOOLEAN DEFAULT FALSE
    COMMENT 'Whether this institute has a custom login page enabled',
  ADD COLUMN login_background_url VARCHAR(255) DEFAULT NULL
    COMMENT 'Custom login page background image',
  ADD COLUMN login_welcome_text VARCHAR(500) DEFAULT NULL
    COMMENT 'Custom welcome text shown on login page',
  ADD INDEX idx_institutes_subdomain (subdomain);
```

#### Updated Entity

```typescript
// Add to institute.entity.ts
@Column({ type: 'varchar', length: 63, unique: true, nullable: true })
@Index('idx_institutes_subdomain')
subdomain?: string;  // e.g., "abcinstitute", "royalcollege"

@Column({ name: 'custom_login_enabled', type: 'boolean', default: false })
customLoginEnabled: boolean;

@Column({ name: 'login_background_url', type: 'varchar', length: 255, nullable: true })
loginBackgroundUrl?: string;

@Column({ name: 'login_welcome_text', type: 'varchar', length: 500, nullable: true })
loginWelcomeText?: string;
```

### 3.2 New API Endpoint: Get Institute by Subdomain

```typescript
// New public endpoint — no auth required
@Public()
@Get('by-subdomain/:subdomain')
@ApiOperation({ summary: 'Get institute public info by subdomain (for custom login pages)' })
async getBySubdomain(@Param('subdomain') subdomain: string) {
  // Validate subdomain format (alphanumeric + hyphens, no special chars)
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
    throw new BadRequestException('Invalid subdomain format');
  }
  
  const institute = await this.institutesService.findBySubdomain(subdomain);
  if (!institute || !institute.customLoginEnabled) {
    throw new NotFoundException('Institute not found or custom login not enabled');
  }
  
  // Return ONLY public branding fields — never expose sensitive data
  return {
    id: institute.id,
    name: institute.name,
    shortName: institute.shortName,
    code: institute.code,
    logoUrl: institute.logoUrl,
    primaryColorCode: institute.primaryColorCode,
    secondaryColorCode: institute.secondaryColorCode,
    loginBackgroundUrl: institute.loginBackgroundUrl,
    loginWelcomeText: institute.loginWelcomeText,
    loadingGifUrl: institute.loadingGifUrl,
  };
}
```

### 3.3 Modified Login Endpoint

```typescript
// In LoginDto — add optional instituteSubdomain
@IsOptional()
@IsString()
@MaxLength(63)
@Matches(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/)
instituteSubdomain?: string;

// In auth.service.ts loginV2()
async loginV2(user, ip, ua, rememberMe, instituteSubdomain?: string) {
  const payload = await this.enhancedJwtService.buildPayload(user);
  
  // If logging in via custom subdomain, validate membership
  if (instituteSubdomain) {
    const institute = await this.instituteRepository.findOne({
      where: { subdomain: instituteSubdomain, customLoginEnabled: true }
    });
    
    if (!institute) {
      throw new UnauthorizedException('Institute not found');
    }
    
    // Verify user belongs to this institute
    const membership = await this.instituteUserRepository.findOne({
      where: { userId: user.id, instituteId: institute.id, status: InstituteUserStatus.ACTIVE }
    });
    
    if (!membership) {
      throw new UnauthorizedException('You are not a member of this institute');
    }
    
    // Add pre-selected institute flag to response
    return {
      ...result,
      preSelectedInstituteId: institute.id,
      instituteName: institute.name,
    };
  }
  
  return result;
}
```

### 3.4 CORS Configuration Update

```typescript
// In main.ts — dynamic CORS to support *.suraksha.lk
app.enableCors({
  origin: (origin, callback) => {
    if (isDevelopment) return callback(null, true);
    if (!origin) return callback(null, true);  // mobile apps / server-to-server
    
    // Allow any *.suraksha.lk subdomain
    const surakshaPattern = /^https:\/\/[a-z0-9-]+\.suraksha\.lk$/;
    if (allowedOrigins.includes(origin) || surakshaPattern.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  // ... rest unchanged
});
```

### 3.5 Rate Limiting for Subdomain Endpoint

```typescript
// Prevent subdomain enumeration attacks
@Throttle({ default: { limit: 20, ttl: 60000 } })  // 20 requests per minute
@Public()
@Get('by-subdomain/:subdomain')
```

---

## 4. Frontend (Web) Implementation

### 4.1 Subdomain Detection Utility

```typescript
// src/utils/subdomain.ts
export interface InstituteBranding {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  primaryColorCode?: string;
  secondaryColorCode?: string;
  loginBackgroundUrl?: string;
  loginWelcomeText?: string;
}

export function getInstituteSubdomain(): string | null {
  const hostname = window.location.hostname;
  
  // Match: <subdomain>.suraksha.lk — but NOT "lms", "admin", "org", "transport"
  const match = hostname.match(/^([a-z0-9-]+)\.suraksha\.lk$/);
  if (!match) return null;
  
  const reserved = ['lms', 'admin', 'org', 'transport', 'api', 'lmsapi', 'www'];
  const subdomain = match[1];
  
  if (reserved.includes(subdomain)) return null;
  return subdomain;
}

export async function fetchInstituteBranding(subdomain: string): Promise<InstituteBranding | null> {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_LMS_BASE_URL}/institutes/by-subdomain/${encodeURIComponent(subdomain)}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
```

### 4.2 Modified Login Component

```tsx
// In Login.tsx — wrap existing login with branding context
const Login: React.FC = () => {
  const [branding, setBranding] = useState<InstituteBranding | null>(null);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  
  useEffect(() => {
    const sub = getInstituteSubdomain();
    if (sub) {
      setSubdomain(sub);
      fetchInstituteBranding(sub).then(setBranding);
    }
  }, []);
  
  // Apply custom CSS variables for institute colors
  const brandingStyle = branding ? {
    '--primary': branding.primaryColorCode || undefined,
    '--secondary': branding.secondaryColorCode || undefined,
  } as React.CSSProperties : {};
  
  return (
    <div style={brandingStyle}>
      {/* Show institute logo instead of Suraksha logo */}
      <img src={branding?.logoUrl || surakshaLogo} alt="Logo" />
      
      {/* Show institute name */}
      <h1>{branding?.name || 'Suraksha LMS'}</h1>
      
      {/* Welcome text */}
      <p>{branding?.loginWelcomeText || 'Sign in to continue'}</p>
      
      {/* Login form — same as current, but pass subdomain to API */}
      <LoginForm instituteSubdomain={subdomain} />
    </div>
  );
};
```

### 4.3 Auto-Skip Institute Selection

```typescript
// In AuthContext.tsx — after login, if preSelectedInstituteId is returned
const handleLogin = async (credentials) => {
  const result = await loginUser(credentials);
  
  if (result.preSelectedInstituteId) {
    // Auto-select institute — skip the selection step
    const institute = user.institutes.find(i => i.id === result.preSelectedInstituteId);
    if (institute) {
      setSelectedInstitute(institute);
      navigate('/dashboard');  // Go directly to dashboard
      return;
    }
  }
  
  // Normal flow — show institute selection
  navigate('/institute-selection');
};
```

### 4.4 Build & Deployment Strategy

**Option A: Single Build, Runtime Subdomain Detection** (Recommended)

```
One build artifact → deployed to *.suraksha.lk wildcard
Subdomain detected at runtime via window.location.hostname
Branding fetched from API on page load
```

**Option B: Per-Institute Builds** (Not recommended)

```
Separate build per institute with hardcoded branding
Requires N deployments for N institutes
Does not scale
```

### 4.5 Vite Configuration (No Changes Needed)

The current `vite.config.ts` doesn't need changes. The subdomain detection is purely runtime. The env variable `VITE_LMS_BASE_URL` stays the same since all subdomains talk to the same API.

---

## 5. Mobile App Implementation

### 5.1 Current Mobile Setup

```json
// capacitor.config.json
{
  "appId": "lk.suraksha.lms",
  "appName": "Suraksha LMS",
  "server": {
    "url": "https://lms.suraksha.lk",
    "allowNavigation": ["lms.suraksha.lk"]
  }
}
```

### 5.2 Mobile App Challenges

| Challenge | Description | Severity |
|-----------|-------------|----------|
| **No subdomain in mobile** | Mobile apps don't have a URL bar — users can't visit `abcinstitute.suraksha.lk` in the native app | 🔴 Critical |
| **Single APK** | Currently one APK for all users | 🟡 Medium |
| **Deep links** | Need to handle `abcinstitute.suraksha.lk` deep links opening the app | 🟡 Medium |
| **Branding persistence** | Once a user logs in on a subdomain, their branding should persist | 🟢 Low |

### 5.3 Solution Options for Mobile

#### Option A: Deep Link → Branding (Recommended)

```
1. User receives link: https://abcinstitute.suraksha.lk/app
2. Android opens Suraksha LMS app via deep link
3. App extracts subdomain from deep link URL
4. App fetches branding from API
5. App shows branded login
6. After login, branding is cached in SecureStorage
```

**Implementation:**

```json
// capacitor.config.json — updated
{
  "server": {
    "allowNavigation": ["*.suraksha.lk"]
  }
}
```

```xml
<!-- android/app/src/main/AndroidManifest.xml → intent filter -->
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="*.suraksha.lk" />
</intent-filter>
```

```typescript
// In mobile app startup
import { App as CapacitorApp } from '@capacitor/app';

CapacitorApp.addListener('appUrlOpen', (event) => {
  const url = new URL(event.url);
  const subdomain = url.hostname.split('.')[0];
  
  if (subdomain && subdomain !== 'lms') {
    // Save subdomain, fetch branding, show branded login
    secureStorage.set('institute_subdomain', subdomain);
  }
});
```

#### Option B: Institute Selection with Branding (Simpler)

```
1. User opens app → generic Suraksha login
2. User logs in → sees institute list with logos/branding
3. User selects institute → app caches the selection + branding
4. Next launch → app shows cached branding on login screen
```

This doesn't require subdomain handling at all — just enhanced UI for institute selection.

#### Option C: Per-Institute APK (Expensive)

```
1. Build separate APK per institute
2. Each APK has hardcoded: appId, branding, API config
3. Published as separate apps: "Royal College LMS", "ABC Institute LMS"

⚠️ NOT RECOMMENDED: Extremely high maintenance cost
```

### 5.4 Mobile Recommendation

**Use Option A (deep links) + Option B (enhanced selection) together:**
- If user taps a subdomain link → branded login
- If user opens app normally → generic login with institute branding on selection screen
- Cache last-used institute's branding for personalized experience

---

## 6. System Admin Frontend

### 6.1 New Admin UI for Managing Subdomains

Add to the Institute management page in `sysstemadminfrotend`:

```typescript
// In InstitutePage.tsx — add subdomain management
interface InstituteSubdomainForm {
  subdomain: string;           // abcinstitute
  customLoginEnabled: boolean; // toggle
  loginWelcomeText: string;    // "Welcome to ABC Institute"
  loginBackgroundUrl: string;  // custom background image
}
```

**Admin workflow:**
1. Navigate to Institute → Settings
2. Enable "Custom Login Page"
3. Set subdomain: `abcinstitute` (auto-validates availability)
4. Upload login background image
5. Set welcome text
6. Preview the login page
7. Save → DNS automatically works via wildcard

### 6.2 Required API Endpoints for Admin

```
PATCH /institutes/:id/subdomain
  Body: { subdomain, customLoginEnabled, loginWelcomeText, loginBackgroundUrl }
  Access: SUPERADMIN only
  
GET /institutes/check-subdomain/:subdomain
  Returns: { available: boolean }
  Access: SUPERADMIN only
```

---

## 7. Infrastructure & DevOps

### 7.1 DNS Configuration

```
Type: CNAME
Name: *.suraksha.lk
Value: <load-balancer-or-cdn-endpoint>
TTL: 300

# This single wildcard record routes ALL subdomains to the same server
# No per-institute DNS changes needed
```

### 7.2 SSL/TLS Certificate

```
# Option 1: Wildcard SSL Certificate
Certificate: *.suraksha.lk
Provider: Let's Encrypt (free) or CloudFlare (managed)

# Option 2: CloudFlare Proxy (Recommended)
- Enable CloudFlare proxy for *.suraksha.lk
- Automatic SSL for all subdomains
- DDoS protection included
- CDN caching for static assets
```

### 7.3 Web Server Configuration (Nginx Example)

```nginx
server {
    listen 443 ssl;
    server_name *.suraksha.lk;
    
    ssl_certificate /etc/ssl/wildcard.suraksha.lk.crt;
    ssl_certificate_key /etc/ssl/wildcard.suraksha.lk.key;
    
    # All subdomains serve the same frontend build
    root /var/www/lms-frontend/dist;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy
    location /api/ {
        proxy_pass https://lmsapi.suraksha.lk/;
        proxy_set_header Host lmsapi.suraksha.lk;
        proxy_set_header X-Original-Host $host;
    }
}
```

### 7.4 Google Cloud Run (Current Hosting)

If using Cloud Run (as indicated by `cloudbuild.yaml`):

```yaml
# cloudbuild.yaml — no changes needed for backend
# Frontend: Deploy with domain mapping
steps:
  - name: 'gcr.io/cloud-builders/gcloud'
    args: ['run', 'services', 'update', 'lms-frontend', 
           '--region=europe-west1',
           '--set-env-vars=VITE_LMS_BASE_URL=https://lmsapi.suraksha.lk']

# Add wildcard domain mapping:
# gcloud run domain-mappings create --service lms-frontend --domain *.suraksha.lk
```

**Note:** Google Cloud Run supports wildcard domain mapping but requires domain verification.

---

## 8. Security Considerations

### 8.1 Threats & Mitigations

| Threat | Description | Mitigation |
|--------|-------------|-----------|
| **Subdomain Enumeration** | Attacker tries all subdomains to find active institutes | Rate limit `by-subdomain` endpoint (20/min), no error message distinction |
| **Phishing** | Attacker creates `royalcollege-suraksha.lk` (look-alike) | Only `*.suraksha.lk` is legitimate; educate users; HSTS preloading |
| **Cross-Tenant Data Leakage** | User on `abc.suraksha.lk` accesses data from `xyz` institute | Existing JWT institute access validation handles this (no change needed) |
| **Cookie Scope** | Cookies set on one subdomain accessible on another | Set cookie domain to the specific subdomain, NOT `.suraksha.lk` |
| **XSS via Branding Data** | Institute uploads malicious logo or injects XSS in welcome text | Sanitize all branding fields server-side; use `textContent` not `innerHTML` |
| **Token Reuse Across Subdomains** | Token from `abc.suraksha.lk` used on `xyz.suraksha.lk` | JWT already contains institute access bitmask — access is validated per-request |
| **CORS Bypass** | Malicious subdomain `evil.suraksha.lk` makes requests | Only allow subdomains that exist in the `institutes` table with `customLoginEnabled = true` |
| **DNS Takeover** | Abandoned subdomain points to attacker's server | Wildcard DNS eliminates this; only server responds |

### 8.2 Cookie Configuration Update

```typescript
// In auth.v2.controller.ts — scope cookies correctly
res.cookie('refresh_token', result.refresh_token, {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  maxAge: cookieMaxAge,
  path: '/',
  // CRITICAL: Don't set domain to .suraksha.lk (would leak to all subdomains)
  // Let browser default to the current subdomain
  domain: undefined,  // Browser auto-scopes to current hostname
});
```

### 8.3 CORS — Strict Validation

```typescript
// Enhanced CORS: Only allow known subdomains
origin: async (origin, callback) => {
  if (!origin) return callback(null, true);
  
  const match = origin.match(/^https:\/\/([a-z0-9-]+)\.suraksha\.lk$/);
  if (match) {
    const subdomain = match[1];
    const reserved = ['lms', 'admin', 'org', 'transport', 'lmsapi', 'www'];
    
    if (reserved.includes(subdomain)) {
      return callback(null, true);  // Known system subdomains
    }
    
    // Validate against database (with caching)
    const isValid = await instituteSubdomainCache.has(subdomain);
    return callback(isValid ? null : new Error('Not allowed'), isValid);
  }
  
  callback(new Error('Not allowed by CORS'));
};
```

---

## 9. Advantages

### 9.1 User Experience

| Advantage | Impact |
|-----------|--------|
| **Branded login page** | Institute members see their school's logo, colors, and name — builds trust and professionalism |
| **Skip institute selection** | Users go directly to their dashboard after login — 1 fewer step |
| **Shareable URL** | Institute can share `royalcollege.suraksha.lk` on their website, social media, and printed materials |
| **Professional appearance** | Each institute appears to have its own learning platform |
| **Familiarity** | Students/parents feel they're logging into "their school's system", not a generic platform |

### 9.2 Business Value

| Advantage | Impact |
|-----------|--------|
| **White-label potential** | Can charge premium for custom subdomain as a feature tier |
| **Institute marketing** | Each institute can promote their own URL, driving organic user acquisition |
| **Platform stickiness** | Institutes feel more invested in "their" platform |
| **Competitive edge** | Most LMS competitors in Sri Lanka don't offer this |
| **Partnership opportunities** | Institutes can list the URL on their official website |

### 9.3 Technical

| Advantage | Impact |
|-----------|--------|
| **Single codebase** | Same frontend code serves all subdomains — no per-institute builds |
| **Branding fields already exist** | `logoUrl`, `primaryColorCode`, `secondaryColorCode` already in database |
| **Existing JWT handles multi-tenancy** | Institute access validation is already in place — no new auth logic needed |
| **Progressive rollout** | Can enable subdomain per institute — no big bang migration |
| **Wildcard DNS** | One DNS record handles unlimited institutes |

---

## 10. Disadvantages

### 10.1 Technical Complexity

| Disadvantage | Severity | Description |
|-------------|----------|-------------|
| **Wildcard SSL management** | 🟡 Medium | Need wildcard certificate (`*.suraksha.lk`). Free with Let's Encrypt but requires DNS-01 challenge renewal every 90 days |
| **Cookie isolation** | 🟡 Medium | Must ensure cookies don't leak across subdomains. Currently sets `domain: 'localhost'` in dev — needs updating |
| **CORS complexity** | 🟡 Medium | Dynamic CORS validation instead of hardcoded whitelist. Need to cache valid subdomains |
| **Cache invalidation** | 🟢 Low | When admin changes branding, need to invalidate CDN/browser cache for that subdomain |
| **SEO fragmentation** | 🟢 Low | Multiple subdomains can fragment SEO (mitigate with `rel=canonical`) |

### 10.2 Mobile App Challenges

| Disadvantage | Severity | Description |
|-------------|----------|-------------|
| **No native subdomain support** | 🔴 High | Mobile apps can't visit subdomains natively — requires deep link handling or alternative UX |
| **Deep link configuration** | 🟡 Medium | Android App Links verification needed for wildcard domains |
| **Multiple APK risk** | 🔴 High | If institutes demand per-institute APKs, maintenance cost explodes (N builds, N Play Store listings) |
| **WebView URL bar** | 🟢 Low | Capacitor WebView doesn't show URL bar — subdomain branding must be fetched separately |

### 10.3 Operational

| Disadvantage | Severity | Description |
|-------------|----------|-------------|
| **Support complexity** | 🟡 Medium | Users may be confused about which URL to use. "Is it `abcinstitute.suraksha.lk` or `lms.suraksha.lk`?" |
| **Subdomain squatting** | 🟡 Medium | Need validation to prevent impersonation (e.g., someone claiming `royalcollege` subdomain) |
| **Monitoring** | 🟢 Low | Need to monitor all subdomains for uptime, not just `lms.suraksha.lk` |
| **DNS propagation** | 🟢 Low | Wildcard DNS handles this, but some ISPs may cache old DNS longer |
| **Admin training** | 🟢 Low | Admins need to learn subdomain management feature |

### 10.4 Cost

| Disadvantage | Severity | Description |
|-------------|----------|-------------|
| **SSL certificate cost** | 🟢 Low | Free with Let's Encrypt; or ~$100/year for commercial wildcard |
| **CDN cost increase** | 🟢 Low | Wildcard domains may require higher CDN tier (CloudFlare Pro: $20/month) |
| **Development time** | 🟡 Medium | Estimated ~40-60 hours of development for full implementation |
| **Testing overhead** | 🟡 Medium | Need to test branding, auth, cookies across multiple subdomains |

---

## 11. Cost Analysis

### 11.1 Infrastructure Costs

| Item | Free Tier | Production |
|------|-----------|-----------|
| Wildcard SSL (Let's Encrypt) | **$0** | $0 (auto-renewal) |
| Wildcard SSL (Commercial) | N/A | ~$100/year |
| CloudFlare Pro (wildcard) | $0 (partial) | $20/month |
| DNS (wildcard record) | Included | Included |
| Cloud Run (same backend) | No change | No change |
| Storage (branding images) | Minimal | ~$1-5/month |

### 11.2 Development Cost Estimate

| Task | Hours | Priority |
|------|-------|----------|
| Database migration (subdomain column) | 2 | P0 |
| Backend: by-subdomain endpoint | 4 | P0 |
| Backend: CORS wildcard update | 3 | P0 |
| Backend: Login with subdomain validation | 6 | P0 |
| Backend: Cookie scope fix | 2 | P0 |
| Frontend: Subdomain detection | 3 | P0 |
| Frontend: Branding application | 8 | P0 |
| Frontend: Auto-skip institute selection | 4 | P1 |
| Mobile: Deep link handling | 8 | P1 |
| Mobile: Branding cache | 4 | P1 |
| Admin: Subdomain management UI | 8 | P1 |
| Testing & QA | 10 | P0 |
| DevOps: DNS + SSL setup | 4 | P0 |
| **Total** | **~66 hours** | |

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

```
✅ Database migration — add subdomain, customLoginEnabled columns
✅ Backend — GET /institutes/by-subdomain/:subdomain endpoint
✅ Backend — CORS wildcard update for *.suraksha.lk
✅ Backend — Cookie domain fix (remove hardcoded 'localhost')
✅ DevOps — Wildcard DNS + SSL setup
```

### Phase 2: Frontend (Week 2-3)

```
✅ Frontend — Subdomain detection utility
✅ Frontend — Branded login page (logo, colors, welcome text)
✅ Frontend — Login with instituteSubdomain parameter
✅ Frontend — Auto-skip institute selection when pre-selected
✅ Testing — Cross-subdomain cookie isolation, branding, auth flow
```

### Phase 3: Mobile (Week 3-4)

```
✅ Mobile — Deep link handler for *.suraksha.lk
✅ Mobile — Branding fetch & cache via SecureStorage
✅ Mobile — Enhanced institute selection with logos/colors
✅ Android — App Links verification for wildcard domain
```

### Phase 4: Admin & Polish (Week 4-5)

```
✅ Admin — Subdomain management UI in system admin frontend
✅ Admin — Subdomain availability check
✅ Admin — Login page preview
✅ Rate limiting — Subdomain enumeration protection
✅ Monitoring — Health checks for custom subdomains
✅ Documentation — User guides for institutes
```

---

## 13. Alternative Approaches

### 13.1 Path-Based Instead of Subdomain-Based

```
https://lms.suraksha.lk/institute/abcinstitute/login
```

**Pros:** No DNS/SSL changes, simpler infrastructure  
**Cons:** Less professional looking, harder to share, doesn't look like "your own platform"

### 13.2 Custom Domain (CNAME) Support

```
https://lms.abcinstitute.edu.lk → CNAME to lms.suraksha.lk
```

**Pros:** Full white-label — institute uses their own domain  
**Cons:** Each institute needs to configure DNS, SSL per domain, very complex

### 13.3 Just Enhance Current Flow (No Subdomains)

```
https://lms.suraksha.lk → Login → Select institute (with branding) → Dashboard
```

**Pros:** Zero infrastructure changes, works on mobile natively  
**Cons:** No shareable branded URL, users still see generic Suraksha login

---

## 14. Recommendation

### Best Approach: **Hybrid (Phase-Based)**

| Phase | What | Effort | Value |
|-------|------|--------|-------|
| **Phase 0** (Now) | Enhance institute selection with logos/colors — uses EXISTING branding data | **Low (8-12 hrs)** | **High** — immediate visual improvement |
| **Phase 1** (Next) | Add subdomain-based login on web (`*.suraksha.lk`) | **Medium (30 hrs)** | **High** — professional white-label |
| **Phase 2** (Later) | Mobile deep linking for subdomains | **Medium (16 hrs)** | **Medium** — nice-to-have |
| **Phase 3** (Future) | Custom domain (CNAME) support | **High (40+ hrs)** | **Low** — only for premium institutes |

### Why This Order Works

1. **Phase 0 is free** — branding data already exists in the database. Just display `logoUrl` and `primaryColorCode` on the institute selection screen and login page. This gives institutes a branded feel with zero infrastructure changes.

2. **Phase 1 adds the professional URL** — once Phase 0 proves value, the subdomain feature becomes a premium upgrade. The branding fetch/render code from Phase 0 is reused.

3. **Mobile works without subdomains** — the mobile app can fetch branding based on cached institute ID. Deep links are a nice enhancement but not required.

4. **Custom domains are overkill for now** — very few institutes will need `lms.abcinstitute.edu.lk`. Park this for when a paying customer demands it.

### ⚠️ Critical Gotchas

1. **Never build per-institute APKs** — this does not scale and creates maintenance nightmares
2. **Always validate subdomain ownership server-side** — never trust the subdomain in the URL alone
3. **Cookie domain must NOT be `.suraksha.lk`** — this would leak auth cookies across all institutes
4. **Cache branding responses aggressively** — the `by-subdomain` endpoint will be hit on every page load
5. **Subdomain validation: `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`** — RFC-compliant, no underscores, no spaces

---

## Summary

Custom institute logins (`abcinstitute.suraksha.lk`) are **fully feasible** with the current architecture. The system already has:
- ✅ Institute branding fields in the database
- ✅ Multi-institute JWT with access validation
- ✅ Role-based access control per institute
- ✅ Separate mobile auth flow

**What's needed:**
- 🔧 1 new database column (`subdomain`)
- 🔧 1 new public API endpoint (`by-subdomain`)
- 🔧 Frontend subdomain detection + branding
- 🔧 Wildcard DNS + SSL
- 🔧 CORS and cookie domain updates

**Start with Phase 0** (enhanced institute selection with branding) for immediate value at near-zero cost, then proceed to subdomains when validated.
