# Suraksha LMS — Multi-Tier Subdomain & Custom Domain System

## Complete Analysis: Issues, Bugs, Ideas, Cost Model, Scalability & Practicality

> **Context:** Migrating from single-domain `lms.suraksha.lk` to a multi-tier system where institutes can optionally get subdomains (`abc.suraksha.lk`), custom domains (`lms.abcinstitute.com`), or stay on the free shared platform.

---

## Table of Contents

1. [Tier Overview](#1-tier-overview)
2. [Detailed Tier Breakdown](#2-detailed-tier-breakdown)
3. [Login Flow Per Tier](#3-login-flow-per-tier)
4. [Database Schema Changes](#4-database-schema-changes)
5. [Backend Architecture Changes](#5-backend-architecture-changes)
6. [Frontend Architecture Changes](#6-frontend-architecture-changes)
7. [Mobile App Impact](#7-mobile-app-impact)
8. [Cost Model & Billing Engine](#8-cost-model--billing-engine)
9. [Known Issues & Bugs to Address](#9-known-issues--bugs-to-address)
10. [Scalability Analysis](#10-scalability-analysis)
11. [Security Concerns](#11-security-concerns)
12. [Ideas to Enhance](#12-ideas-to-enhance)
13. [Practicality Assessment](#13-practicality-assessment)
14. [Infrastructure Requirements](#14-infrastructure-requirements)
15. [Implementation Phases](#15-implementation-phases)
16. [Risk Register](#16-risk-register)

---

## 1. Tier Overview

| Tier | Domain | Cost | Branding | Login Page | Suraksha Visible? |
|------|--------|------|----------|------------|-------------------|
| **Free (Current)** | `lms.suraksha.lk` | Free | Suraksha branding | Shared login | Yes — always |
| **Subdomain** | `abc.suraksha.lk` | Low monthly + per-subdomain-login | Institute branding + Suraksha footer | Custom themed | Yes — "Powered by Suraksha" |
| **Custom Domain** | `lms.abcinstitute.com` | Higher monthly + per-user + per-login | Full white-label possible | Fully custom | Optional — can disable |
| **Isolated** | `lms.abcinstitute.com` (no Suraksha) | Highest — full custom pricing | Complete white-label | Fully custom + SMS masking | No — fully hidden |

### Key Principle: Current Free Floor Always Available
- Users who enrolled via `lms.suraksha.lk` can **always** log in there, regardless of institute tier
- The free flow is never removed — institutes **add** a subdomain/custom domain on top
- Students in the Suraksha mobile app always see institute selector unless the institute explicitly disables it (Isolated tier)

---

## 2. Detailed Tier Breakdown

### 2.1 Tier 0: Free (Current System — No Changes)

**How it works today:**
- All users go to `lms.suraksha.lk`
- Login with identifier (email / phone / 6-digit system ID / birth cert) + password
- After login, select institute from `InstituteSelector.tsx`
- JWT embeds all institute access in the `i` field

**What stays the same:**
- 100% free for institutes
- Suraksha branding everywhere
- Institute selection after login
- Standard `lmsapi.suraksha.lk` API
- Single frontend build

**No SMS masking, no custom login page, no subdomain.**

---

### 2.2 Tier 1: Subdomain (`institutename.suraksha.lk`)

**What the institute gets:**
- Custom login page at `institutename.suraksha.lk`
- Institute logo, colors (`primaryColorCode`, `secondaryColorCode` — already in DB), custom welcome text
- Optional: custom background image on login page
- Optional: custom SMS sender masking (e.g. OTP from "ABC Institute" instead of "Suraksha")
- Students can still log in via `lms.suraksha.lk` too (dual access)

**Billing model:**
- Base monthly fee (fixed, for the subdomain itself)
- Suraksha login (`lms.suraksha.lk`) — free, unlimited, no extra cost
- Subdomain login (`abc.suraksha.lk`) — counted per unique user per billing cycle
  - If a user logs in via `abc.suraksha.lk` **even once** in a month → that user is counted for the month
  - Multiple logins by the same user in the same month = 1 count
  - Cost = `base_fee + (subdomain_login_user_count × per_user_rate)`

**Why charge for subdomain logins?**
- Wildcard SSL, DNS, and CDN resources cost money
- Custom branding = value-added service
- Encourages institutes to grow revenue proportionally
- Free tier users aren't penalized

**Custom masking options:**
- **No masking (default):** Login page says "Powered by Suraksha LMS" in footer
- **Partial masking:** Institute can hide the "Powered by" text (extra charge)
- **SMS masking:** OTP/notification SMS comes from institute name instead of Suraksha (extra charge, requires SMS provider setup per institute)

**What institutes CANNOT do in this tier:**
- Cannot fully disable Suraksha login for their users
- Cannot use a custom domain (must be `*.suraksha.lk`)
- Cannot remove institute from Suraksha app's institute selector
- Cannot change the URL structure

---

### 2.3 Tier 2: Custom Domain (`lms.abcinstitute.com`)

**What the institute gets:**
- Everything in Tier 1, plus:
- Fully custom domain (e.g., `lms.abcinstitute.com`)
- Complete white-label login page (no Suraksha branding required)
- Custom SSL certificate (auto-provisioned via Let's Encrypt or institute-provided)
- Custom email sender domain (e.g., `noreply@abcinstitute.com`) if configured
- SMS masking included
- Users can **still login via Suraksha app/website** to the same account (unless disabled)

**Billing model:**
- Higher base monthly fee
- Per-user monthly fee (all active users, regardless of login method)
- Per-login tracking still applies for reporting
- Custom pricing set by system admin per institute (flexible)

**Options:**
- **Disable Suraksha login (optional):** Institute can request to hide their institute from the Suraksha app's institute selector. If disabled:
  - Students CANNOT see or select this institute in the Suraksha mobile app
  - Students MUST use the custom domain to log in
  - This is the "walled garden" option
  - **Requirement to enable:** Institute must have their own SMS masking set up (so users don't see Suraksha in OTP messages)

**What institutes CANNOT do in this tier:**
- Cannot modify the underlying API (it's still `lmsapi.suraksha.lk` behind the scenes, or a CNAME to it)
- Cannot access other institutes' data (same multi-tenant DB)

---

### 2.4 Tier 3: Isolated / Full White-Label

**What the institute gets:**
- Everything in Tier 2, plus:
- Complete removal from Suraksha ecosystem visibility
- Institute's students never see "Suraksha" anywhere
- Custom app branding (if they build their own app using the API)
- Dedicated support channel (instead of Suraksha community support)
- API access for custom integrations
- Option for dedicated database (for very large institutes, at premium cost)

**Billing model:**
- Fully custom pricing (negotiated per institute)
- Higher per-user fee
- Setup fee for initial configuration
- Monthly maintenance fee

**When Suraksha is disabled:**
- Institute does NOT appear in `GET /users/{id}/institutes` response for the generic app
- Institute's `isVisibleInApp` flag = `false`
- Institute's `isVisibleInWebSelector` flag = `false`
- Users associated with ONLY this institute see no institute selector — they go straight to the dashboard

---

## 3. Login Flow Per Tier

### 3.1 Free Tier Login (Current — No Change)

```
User → lms.suraksha.lk/login
     → Enter identifier + password
     → POST /v2/auth/login
     → JWT returned with institute access
     → Show InstituteSelector (if multiple institutes)
     → Select institute → Dashboard
```

### 3.2 Subdomain Login (Tier 1)

```
User → abc.suraksha.lk
     → Frontend detects subdomain via window.location.hostname
     → GET /v2/institutes/by-subdomain/abc (public endpoint, cached)
     → Returns: { id, name, logoUrl, primaryColorCode, secondaryColorCode, welcomeText, backgroundUrl }
     → Render custom-themed login page
     → User enters identifier + password
     → POST /v2/auth/login { identifier, password, instituteSubdomain: "abc" }
     → Backend validates user belongs to institute
     → JWT returned (same as before)
     → Skip institute selector (already selected) → Dashboard
     → BILLING: Record login event { userId, instituteId, loginMethod: "SUBDOMAIN", timestamp }
```

### 3.3 Custom Domain Login (Tier 2)

```
User → lms.abcinstitute.com
     → DNS: CNAME → lms.suraksha.lk (or proxy IP)
     → Frontend detects custom domain via window.location.hostname
     → GET /v2/institutes/by-domain/lms.abcinstitute.com (public endpoint, cached heavily)
     → Returns: full branding config + tier info + feature flags
     → Render fully custom login page
     → POST /v2/auth/login { identifier, password, instituteDomain: "lms.abcinstitute.com" }
     → Same JWT flow
     → Skip institute selector → Dashboard
     → BILLING: Record login event { userId, instituteId, loginMethod: "CUSTOM_DOMAIN", timestamp }
```

### 3.4 Isolated Login (Tier 3)

```
Same as Tier 2, except:
     → Institute NEVER appears in Suraksha app/web institute selector
     → If user tries lms.suraksha.lk → sees NO reference to this institute
     → All SMS/email from institute's own sender identity
```

### 3.5 Cross-Tier: Suraksha App Login for Subdomain/Custom Domain Users

```
User → Suraksha App (or lms.suraksha.lk)
     → Login as normal
     → JWT includes access to all institutes (including subdomain/custom ones)
     → Institute selector shows:
       - Free institutes: shown normally
       - Subdomain institutes: shown with "Also available at abc.suraksha.lk" badge
       - Custom domain institutes (if isVisibleInApp=true): shown normally
       - Custom domain institutes (if isVisibleInApp=false): HIDDEN from selector
     → Login counted as FREE (no subdomain billing)
```

---

## 4. Database Schema Changes

### 4.1 Institute Table — New Columns

```sql
ALTER TABLE institutes ADD COLUMN subdomain VARCHAR(63) UNIQUE DEFAULT NULL;
-- e.g., "royalcollege" → royalcollege.suraksha.lk

ALTER TABLE institutes ADD COLUMN custom_domain VARCHAR(255) UNIQUE DEFAULT NULL;
-- e.g., "lms.royalcollege.lk"

ALTER TABLE institutes ADD COLUMN tier ENUM('FREE', 'SUBDOMAIN', 'CUSTOM_DOMAIN', 'ISOLATED') DEFAULT 'FREE';

ALTER TABLE institutes ADD COLUMN custom_login_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE institutes ADD COLUMN login_background_url VARCHAR(500) DEFAULT NULL;
ALTER TABLE institutes ADD COLUMN login_welcome_text VARCHAR(500) DEFAULT NULL;
ALTER TABLE institutes ADD COLUMN login_footer_text VARCHAR(200) DEFAULT NULL;

-- Visibility controls
ALTER TABLE institutes ADD COLUMN is_visible_in_app BOOLEAN DEFAULT TRUE;
ALTER TABLE institutes ADD COLUMN is_visible_in_web_selector BOOLEAN DEFAULT TRUE;

-- SMS/Notification masking
ALTER TABLE institutes ADD COLUMN sms_sender_name VARCHAR(11) DEFAULT NULL;
-- SMS sender names are typically max 11 chars
ALTER TABLE institutes ADD COLUMN sms_provider_config JSON DEFAULT NULL;
-- Encrypted provider credentials per institute

ALTER TABLE institutes ADD COLUMN email_sender_address VARCHAR(255) DEFAULT NULL;
ALTER TABLE institutes ADD COLUMN email_sender_name VARCHAR(100) DEFAULT NULL;

-- Custom domain SSL
ALTER TABLE institutes ADD COLUMN custom_domain_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE institutes ADD COLUMN custom_domain_ssl_status ENUM('PENDING', 'ACTIVE', 'EXPIRED', 'FAILED') DEFAULT NULL;
ALTER TABLE institutes ADD COLUMN custom_domain_verified_at TIMESTAMP NULL;
```

### 4.2 New Table: `institute_billing_config`

```sql
CREATE TABLE institute_billing_config (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  institute_id BIGINT NOT NULL UNIQUE,
  tier ENUM('FREE', 'SUBDOMAIN', 'CUSTOM_DOMAIN', 'ISOLATED') DEFAULT 'FREE',
  
  -- Monthly base fees (in LKR or smallest currency unit)
  base_monthly_fee DECIMAL(10, 2) DEFAULT 0.00,
  per_user_monthly_fee DECIMAL(10, 2) DEFAULT 0.00,
  per_subdomain_login_fee DECIMAL(10, 2) DEFAULT 0.00,
  
  -- SMS masking cost
  sms_masking_monthly_fee DECIMAL(10, 2) DEFAULT 0.00,
  
  -- Custom pricing (for Isolated tier, system admin sets this)
  custom_pricing_json JSON DEFAULT NULL,
  
  -- Billing cycle
  billing_cycle_start_day INT DEFAULT 1, -- Day of month billing starts
  currency VARCHAR(3) DEFAULT 'LKR',
  
  -- Limits
  max_free_subdomain_logins INT DEFAULT 0, -- First N subdomain logins free per month
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (institute_id) REFERENCES institutes(id)
);
```

### 4.3 New Table: `login_events` (For Billing Tracking)

```sql
CREATE TABLE login_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  institute_id BIGINT NOT NULL,
  login_method ENUM('SURAKSHA_WEB', 'SURAKSHA_APP', 'SUBDOMAIN', 'CUSTOM_DOMAIN') NOT NULL,
  login_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45) DEFAULT NULL,  -- For audit, not billing
  user_agent VARCHAR(500) DEFAULT NULL,
  
  INDEX idx_billing (institute_id, login_method, login_timestamp),
  INDEX idx_user_month (user_id, institute_id, login_method, login_timestamp),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (institute_id) REFERENCES institutes(id)
);
```

### 4.4 New Table: `monthly_billing_summary`

```sql
CREATE TABLE monthly_billing_summary (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  institute_id BIGINT NOT NULL,
  billing_month DATE NOT NULL, -- First day of the month, e.g., 2026-04-01
  
  -- Counts
  total_logins INT DEFAULT 0,
  subdomain_logins INT DEFAULT 0,
  custom_domain_logins INT DEFAULT 0,
  unique_subdomain_users INT DEFAULT 0,
  unique_custom_domain_users INT DEFAULT 0,
  total_active_users INT DEFAULT 0,
  
  -- Calculated costs
  base_fee DECIMAL(10, 2) DEFAULT 0.00,
  user_fee DECIMAL(10, 2) DEFAULT 0.00,
  login_fee DECIMAL(10, 2) DEFAULT 0.00,
  sms_masking_fee DECIMAL(10, 2) DEFAULT 0.00,
  total_fee DECIMAL(10, 2) DEFAULT 0.00,
  
  -- Status
  status ENUM('PENDING', 'INVOICED', 'PAID', 'OVERDUE') DEFAULT 'PENDING',
  invoice_url VARCHAR(500) DEFAULT NULL,
  paid_at TIMESTAMP NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_institute_month (institute_id, billing_month),
  FOREIGN KEY (institute_id) REFERENCES institutes(id)
);
```

---

## 5. Backend Architecture Changes

### 5.1 New Modules Needed

| Module | Purpose |
|--------|---------|
| `SubdomainModule` | Resolve subdomains → institute, serve branding config |
| `CustomDomainModule` | Manage custom domains, DNS verification, SSL provisioning |
| `BillingModule` | Track logins, calculate monthly costs, generate invoices |
| `TenantModule` | Central multi-tenancy middleware and guards |
| `BrandingModule` | Serve custom login page configs (public, heavily cached) |

### 5.2 Auth Service Changes (`auth.service.ts`)

```typescript
// Current login method signature:
async login(identifier: string, password: string, rememberMe?: boolean)

// Proposed new signature:
async login(
  identifier: string, 
  password: string, 
  rememberMe?: boolean,
  tenantContext?: {
    subdomain?: string;       // "abc" from abc.suraksha.lk
    customDomain?: string;    // "lms.abcinstitute.com"
    loginMethod: 'SURAKSHA_WEB' | 'SURAKSHA_APP' | 'SUBDOMAIN' | 'CUSTOM_DOMAIN';
  }
)
```

**Logic changes:**
1. If `tenantContext.subdomain` is provided:
   - Look up institute by subdomain
   - After successful auth, verify user belongs to that institute
   - If user does NOT belong → return error: "You are not registered with this institute"
   - Record login event with `loginMethod: 'SUBDOMAIN'`
2. If `tenantContext.customDomain` is provided:
   - Look up institute by custom domain
   - Same validation + event recording
3. If neither → current flow (free tier), record as `SURAKSHA_WEB` or `SURAKSHA_APP`

### 5.3 New Public Endpoints

```typescript
// Subdomain resolution (heavily cached — 5 min TTL)
@Get('/v2/institutes/by-subdomain/:subdomain')
@Public()
async getBySubdomain(@Param('subdomain') subdomain: string): Promise<InstituteBrandingDto> {
  // Returns: { id, name, logoUrl, primaryColorCode, secondaryColorCode, 
  //           welcomeText, backgroundUrl, footerText, features }
}

// Custom domain resolution (heavily cached — 5 min TTL)
@Get('/v2/institutes/by-domain/:domain')
@Public()
async getByDomain(@Param('domain') domain: string): Promise<InstituteBrandingDto> {
  // Same response shape
}

// Domain verification (for custom domain setup)
@Post('/v2/institutes/:id/verify-domain')
@Roles(InstituteUserType.INSTITUTE_ADMIN)
async verifyDomain(@Param('id') id: number): Promise<DomainVerificationDto> {
  // Check DNS records, provision SSL
}
```

### 5.4 CORS Update (`main.ts`)

```typescript
// Current: hardcoded list
// Proposed: dynamic CORS with wildcard support

const corsOptions = {
  origin: (origin: string, callback: Function) => {
    // Allow known static origins
    if (STATIC_ORIGINS.includes(origin)) return callback(null, true);
    
    // Allow *.suraksha.lk subdomains
    if (origin && /^https:\/\/[a-z0-9-]+\.suraksha\.lk$/.test(origin)) {
      return callback(null, true);
    }
    
    // Allow verified custom domains (cache lookup)
    if (origin && isVerifiedCustomDomain(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};
```

### 5.5 Billing Calculation (Cron Job)

```typescript
// Run daily at midnight, aggregate monthly billing
@Cron('0 0 * * *')
async calculateDailyBilling() {
  const institutes = await this.instituteRepo.find({ 
    where: { tier: In(['SUBDOMAIN', 'CUSTOM_DOMAIN', 'ISOLATED']) } 
  });
  
  for (const institute of institutes) {
    const config = await this.billingConfigRepo.findOne({ 
      where: { instituteId: institute.id } 
    });
    
    const monthStart = startOfMonth(new Date());
    
    // Count unique users who logged in via subdomain this month
    const uniqueSubdomainUsers = await this.loginEventRepo
      .createQueryBuilder('le')
      .select('COUNT(DISTINCT le.user_id)', 'count')
      .where('le.institute_id = :id', { id: institute.id })
      .andWhere('le.login_method IN (:...methods)', { methods: ['SUBDOMAIN', 'CUSTOM_DOMAIN'] })
      .andWhere('le.login_timestamp >= :start', { start: monthStart })
      .getRawOne();
    
    // Calculate cost
    const loginFee = uniqueSubdomainUsers.count * config.perSubdomainLoginFee;
    const totalFee = config.baseMonthlyFee + loginFee + config.smsMaskingMonthlyFee;
    
    // Upsert monthly summary
    await this.monthlySummaryRepo.upsert({
      instituteId: institute.id,
      billingMonth: monthStart,
      uniqueSubdomainUsers: uniqueSubdomainUsers.count,
      loginFee,
      baseFee: config.baseMonthlyFee,
      smsMaskingFee: config.smsMaskingMonthlyFee,
      totalFee,
    }, ['institute_id', 'billing_month']);
  }
}
```

---

## 6. Frontend Architecture Changes

### 6.1 Single Build, Runtime Tenant Detection

**Critical decision: ONE frontend build, not per-institute builds.**

The same build deployed to CDN serves all domains. Tenant is detected at runtime:

```typescript
// src/utils/tenantDetection.ts
export function detectTenant(): TenantContext {
  const hostname = window.location.hostname;
  
  // Case 1: Main Suraksha domain
  if (hostname === 'lms.suraksha.lk' || hostname === 'localhost') {
    return { type: 'FREE', subdomain: null, customDomain: null };
  }
  
  // Case 2: Subdomain (*.suraksha.lk)
  const subdomainMatch = hostname.match(/^([a-z0-9-]+)\.suraksha\.lk$/);
  if (subdomainMatch && !['lms', 'api', 'admin', 'org', 'transport'].includes(subdomainMatch[1])) {
    return { type: 'SUBDOMAIN', subdomain: subdomainMatch[1], customDomain: null };
  }
  
  // Case 3: Custom domain
  return { type: 'CUSTOM_DOMAIN', subdomain: null, customDomain: hostname };
}
```

### 6.2 Login Page Changes (`Login.tsx`)

```tsx
// Current: Always shows Suraksha branding
// Proposed: Dynamic branding based on tenant

function Login() {
  const [tenantBranding, setTenantBranding] = useState<InstituteBranding | null>(null);
  const tenant = useTenant(); // from TenantContext
  
  useEffect(() => {
    if (tenant.type !== 'FREE') {
      // Fetch branding from public endpoint
      fetchBranding(tenant).then(setTenantBranding);
    }
  }, [tenant]);
  
  return (
    <div style={{
      background: tenantBranding?.backgroundUrl 
        ? `url(${tenantBranding.backgroundUrl})` 
        : 'default-gradient',
      '--primary': tenantBranding?.primaryColorCode || '#1E6FBF',
      '--secondary': tenantBranding?.secondaryColorCode || '#3B82F6',
    }}>
      {/* Logo: institute logo if tenant, else Suraksha logo */}
      <img src={tenantBranding?.logoUrl || '/suraksha-logo.png'} />
      
      {/* Welcome text */}
      <h1>{tenantBranding?.welcomeText || 'Welcome to Suraksha LMS'}</h1>
      
      {/* Login form - same for all tiers */}
      <LoginForm onLogin={handleLogin} />
      
      {/* Footer branding based on tier */}
      {tenant.type === 'FREE' && <SurakshaBranding />}
      {tenant.type === 'SUBDOMAIN' && !tenantBranding?.hidePoweredBy && (
        <span>Powered by Suraksha LMS</span>
      )}
      {/* Custom domain / Isolated: no Suraksha branding */}
    </div>
  );
}
```

### 6.3 Institute Selector Changes (`InstituteSelector.tsx`)

```tsx
// If user logged in via subdomain/custom domain:
//   → Skip institute selector, auto-select that institute
// If user logged in via lms.suraksha.lk:
//   → Show institute selector BUT filter out institutes where isVisibleInWebSelector=false

const visibleInstitutes = institutes.filter(inst => {
  if (loginMethod === 'SURAKSHA_WEB' || loginMethod === 'SURAKSHA_APP') {
    return inst.isVisibleInWebSelector !== false;
  }
  return true; // Subdomain/custom domain users see their institute
});
```

### 6.4 Vite / Build Configuration

```typescript
// vite.config.ts — No changes needed for multi-tenant
// The same build is used everywhere, deployed to CDN
// Wildcard DNS *.suraksha.lk points to the same CDN/server

// ONLY change: base URL for API might vary
// But we solve this by always pointing to lmsapi.suraksha.lk 
// (or a CNAME like api.abcinstitute.com → lmsapi.suraksha.lk)
```

---

## 7. Mobile App Impact

### 7.1 Suraksha App (Capacitor / Android)

The Suraksha mobile app (`lk.suraksha.lms`) should:
- Always connect to `lmsapi.suraksha.lk`
- Login events recorded as `SURAKSHA_APP` (free, no billing)
- Institute selector respects `isVisibleInApp` flag
- Hidden institutes don't appear in the app

### 7.2 Deep Links

```
suraksha://login?institute=abc
→ Opens app → pre-selects institute "abc"
→ Still uses SURAKSHA_APP login method (free)
```

### 7.3 Custom App (For Isolated Tier)

Institutes on Isolated tier who want their own app:
- Can use the same codebase with different `capacitor.config.json`
- Different app ID: `com.abcinstitute.lms`
- Points to their custom domain API
- Login events recorded as `CUSTOM_DOMAIN`
- **NOT a Suraksha responsibility** — the institute builds/maintains their app, we provide API access

---

## 8. Cost Model & Billing Engine

### 8.1 Recommended Pricing Structure (LKR)

| Feature | Free | Subdomain | Custom Domain | Isolated |
|---------|------|-----------|---------------|----------|
| Base Monthly Fee | 0 | 2,500 | 10,000 | Custom (25,000+) |
| Per User (monthly) | 0 | 0 | 50 | Custom (75+) |
| Per Subdomain Login User (monthly) | N/A | 25 | Included | Included |
| SMS Masking | N/A | +1,500/mo | Included | Included |
| Email Sender Domain | N/A | N/A | +2,000/mo | Included |
| First N Free Subdomain Users | N/A | 50 | N/A | N/A |
| Custom Domain SSL | N/A | N/A | Included | Included |
| Setup Fee | 0 | 0 | 5,000 | Custom (15,000+) |
| Hide from Suraksha App | N/A | N/A | +5,000/mo | Included |

> **Note:** All pricing should be configurable by system admin per institute via `institute_billing_config` table. The above are defaults/recommendations.

### 8.2 Billing Cycle Detail

**Monthly cycle definition:**
- Cycle runs from day 1 to last day of calendar month
- Even ONE subdomain login by a user in the cycle → user is counted
- Count is **unique users**, not login events
- Example: User A logs in 5 times via `abc.suraksha.lk` in April → billed for 1 user
- Same User A logs in 3 times via `lms.suraksha.lk` in April → 0 additional cost

**Billing event recording:**
```
User logs in via abc.suraksha.lk
→ Auth succeeds
→ INSERT INTO login_events (user_id, institute_id, login_method, login_timestamp)
→ Response returned to user (login event is async/non-blocking)
```

### 8.3 Cost Scenarios

**Scenario A: Small tuition institute, 100 students**
- Tier: Subdomain (`mathsmaster.suraksha.lk`)
- 60 students use subdomain login per month, 40 use Suraksha free login
- Cost: 2,500 (base) + max(0, 60-50) × 25 (per user over free tier) = 2,500 + 250 = **LKR 2,750/month**

**Scenario B: Medium school, 500 students**
- Tier: Custom Domain (`lms.royalcollege.lk`)
- 500 active users
- Cost: 10,000 (base) + 500 × 50 (per user) = **LKR 35,000/month**

**Scenario C: Large private school, 2000 students, wants full isolation**
- Tier: Isolated
- Custom pricing: 25,000 (base) + 2000 × 75 = **LKR 175,000/month** (negotiable)
- Includes: SMS masking, email sender, hidden from app, custom domain, SSL, priority support

---

## 9. Known Issues & Bugs to Address

### 9.1 Critical Issues (Must Fix Before Launch)

| # | Issue | Severity | Details |
|---|-------|----------|---------|
| 1 | **CORS hardcoded in `main.ts`** | 🔴 Critical | Current CORS is a static array. Must change to dynamic with wildcard `*.suraksha.lk` support + verified custom domain lookup. One bad regex = full CORS bypass. |
| 2 | **JWT doesn't include tenant context** | 🔴 Critical | Current JWT `i` field has institute access but no `loginMethod` or `subdomain`. Need to add for billing accuracy. If missing, we can't distinguish free vs. paid logins from the token alone. |
| 3 | **No rate limiting on subdomain resolution endpoint** | 🔴 Critical | `GET /v2/institutes/by-subdomain/:subdomain` is public. Without rate limiting, enumeration attacks can discover all institute subdomains. |
| 4 | **Login event recording must be non-blocking** | 🟠 High | If `INSERT INTO login_events` fails or is slow, it must NOT block the actual login response. Use async queue (Bull/BullMQ). |
| 5 | **Subdomain validation/sanitization** | 🟠 High | Subdomain must be validated: `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`. No special chars, no reserved words (`api`, `admin`, `www`, `mail`, `ftp`, `lms`, `org`, `transport`, `static`, `cdn`). |
| 6 | **Custom domain DNS verification is async** | 🟠 High | DNS propagation takes 24-48 hours. Need background job to check verification status. Can't block institute admin waiting for DNS. |
| 7 | **Billing race condition** | 🟠 High | If two logins happen simultaneously for the same user in the same month, unique count must still be 1. Use `INSERT ... ON DUPLICATE KEY` or unique constraint on `(user_id, institute_id, billing_month)` in a deduplicated summary table. |
| 8 | **Cache invalidation for branding** | 🟡 Medium | If an institute updates their logo/colors, the cached branding response must be invalidated. Need cache-busting strategy (e.g., version hash or TTL + manual invalidation endpoint). |
| 9 | **SSL certificate expiry for custom domains** | 🟡 Medium | Need automated renewal (Let's Encrypt certbot cron). Failed renewals should alert system admin. |
| 10 | **Mobile app backward compatibility** | 🟡 Medium | Older app versions won't understand `isVisibleInApp` flag. Need API versioning or graceful degradation. |

### 9.2 Existing Bugs in Current System (Found During Analysis)

| # | Bug | File | Details |
|---|-----|------|---------|
| 1 | `institue_user.entity.ts` misspelling | `institue_user/entities/institue_user.entity.ts` | File/folder named "institue" instead of "institute". Will cause confusion when adding subdomain logic. Consider renaming (breaking change). |
| 2 | CORS env override not regex-aware | `main.ts` | `CORS_ORIGINS` env variable splits by comma for exact origins, doesn't support wildcards. Need to support `*.suraksha.lk` pattern. |
| 3 | Refresh token cookie domain | `auth.v2.controller.ts` | Cookie domain is likely set to `lms.suraksha.lk`. For subdomains, cookie domain should be `.suraksha.lk` (with leading dot) so cookies work across `abc.suraksha.lk` and `lms.suraksha.lk`. But for custom domains, cookies need separate handling. |
| 4 | No institute-scoped login validation | `auth.service.ts` | Current login doesn't validate "does this user belong to the institute the subdomain represents?" — it just returns all institute access. Need to add validation for subdomain logins. |

---

## 10. Scalability Analysis

### 10.1 Database Scalability

| Concern | Analysis | Mitigation |
|---------|----------|------------|
| `login_events` table growth | 1000 users × 30 logins/month × 100 institutes = 3M rows/month | Partition by month. Archive old months. Use `login_timestamp` as partition key. |
| Unique user counting | `COUNT(DISTINCT user_id)` on large tables is slow | Maintain pre-aggregated `monthly_billing_summary`. Update via daily cron. |
| Subdomain/domain lookup | Every login hits this | Redis cache with 5-min TTL. Subdomain → institute_id mapping rarely changes. |
| Hot institutes | One large institute (5000+ students) logging in at 8am | Connection pooling, read replicas for login-event inserts (or async queue). |

### 10.2 CDN / Frontend Scalability

| Concern | Analysis | Mitigation |
|---------|----------|------------|
| Wildcard SSL | `*.suraksha.lk` cert covers all subdomains | One cert, easy. Use Cloudflare or AWS ACM. |
| Custom domain SSL | Each custom domain needs its own cert | Auto-provision via Let's Encrypt. Rate limit: 50 certs/week per registered domain. |
| CDN cache per domain | Same HTML/JS but different branding | Frontend is the same build. Branding is fetched dynamically via API call (not baked in). CDN caches static assets normally. |
| DNS management | Adding subdomains | Wildcard DNS `*.suraksha.lk` → same IP. No per-subdomain DNS changes needed. |

### 10.3 Projected Scale

| Year | Institutes (Paid) | Total Users | Monthly Login Events | DB Size (login_events) |
|------|-------------------|-------------|---------------------|----------------------|
| Year 1 | 20 | 10,000 | ~300,000 | ~50MB/month |
| Year 2 | 100 | 50,000 | ~1,500,000 | ~250MB/month |
| Year 3 | 500 | 250,000 | ~7,500,000 | ~1.2GB/month |

At Year 3 scale, monthly partitioning + 12-month retention policy keeps active data under 15GB.

---

## 11. Security Concerns

### 11.1 Critical Security Items

| # | Concern | Risk | Mitigation |
|---|---------|------|------------|
| 1 | **CORS wildcard bypass** | 🔴 High | Malicious `evil.suraksha.lk.attacker.com` could trick regex if poorly written. Use strict regex: `/^https:\/\/[a-z0-9-]+\.suraksha\.lk$/` (note the `$` anchor). |
| 2 | **Subdomain takeover** | 🔴 High | If institute deletes their account but subdomain DNS still points to us, another institute could claim it. Clear subdomain on deactivation + reservation period. |
| 3 | **Cross-tenant data leakage** | 🔴 High | A bug in institute-scoped queries could leak data between tenants. All queries must include `instituteId` filter. Add integration tests per tenant boundary. |
| 4 | **Cookie domain scope** | 🟠 Medium | Setting cookie domain to `.suraksha.lk` means ANY subdomain can read the cookie. Use distinct cookie names per subdomain or use `__Host-` prefix (restricts to exact domain). |
| 5 | **DNS rebinding for custom domains** | 🟠 Medium | An attacker could point their domain to our server, then change DNS to steal cookies. Validate `Host` header against verified custom domains. |
| 6 | **SMS masking abuse** | 🟡 Low | Institute could use SMS masking to send spam. Rate limit SMS per institute. Require approval for masking setup. |
| 7 | **Billing data integrity** | 🟡 Medium | If login events are tampered with (admin SQL access), billing is wrong. Use append-only log with checksums. |
| 8 | **Open redirect via subdomain** | 🟡 Medium | If login page accepts `?redirect=` parameter, ensure redirect targets are validated against the same tenant's domain. |

### 11.2 Authentication Security

- **Cookie strategy for multi-domain:**
  - `lms.suraksha.lk` → cookie domain: `lms.suraksha.lk` (as today)
  - `abc.suraksha.lk` → cookie domain: `abc.suraksha.lk` (NOT `.suraksha.lk`)
  - `lms.abcinstitute.com` → cookie domain: `lms.abcinstitute.com`
  - This prevents cross-subdomain cookie access (intentional isolation)
  - Trade-off: user must re-login when switching between `lms.suraksha.lk` and `abc.suraksha.lk`

- **Refresh token handling:**
  - Each domain gets its own refresh token cookie
  - Mobile app uses `SecureStorage` — unaffected by domain changes
  - Backend must accept refresh tokens from any valid origin (validated via CORS)

---

## 12. Ideas to Enhance

### 12.1 Revenue & Monetization Ideas

| # | Idea | Tier | Revenue Impact |
|---|------|------|----------------|
| 1 | **Free trial for Subdomain tier** — 30 days free, then monthly billing | Subdomain | Drives adoption. Low risk since infrastructure cost is minimal per subdomain. |
| 2 | **Annual billing discount** — 2 months free if paid annually | All paid | Improves cash flow predictability. |
| 3 | **Student-facing ads on Free tier** — Non-intrusive banner ads on free login page | Free | Generates revenue from free users. Must be tasteful. |
| 4 | **White-label report cards / certificates** — Branded PDFs with institute logo | Subdomain+ | Upsell to ID card system already built (`idCardService.mjs`). |
| 5 | **API access as add-on** — REST API access for custom integrations | Custom Domain+ | Developers at institutes pay for API docs + keys. |
| 6 | **Analytics dashboard** — Login analytics, user engagement metrics per institute | Subdomain+ | Premium feature, easy to build from `login_events` data. |
| 7 | **Multi-institute bundles** — Discount for institute chains (e.g., same owner, 5 branches) | Custom Domain+ | Higher contract value, stickier customers. |

### 12.2 User Experience Ideas

| # | Idea | Details |
|---|------|---------|
| 1 | **Remember last used domain** — If student used `abc.suraksha.lk`, suggest it on next visit to `lms.suraksha.lk` | Store in localStorage. Show "You also have access via abc.suraksha.lk" badge in institute selector. |
| 2 | **QR code login** — Institute generates QR at entrance, students scan to log in | Ties into existing QR code in ID card. Quick attendance + login. |
| 3 | **SSO (Single Sign-On) for Custom Domain** — Google/Microsoft SSO integration | High-value for schools using Google Workspace or Microsoft 365. Per-institute OAuth app registration. |
| 4 | **Subdomain preview in admin** — System admin can preview what `abc.suraksha.lk` looks like before publishing | Low effort, high confidence for institutes. |
| 5 | **Custom favicon per institute** — Show institute's favicon on subdomain tab | Small detail, big brand impact. Add `faviconUrl` to institute entity. |
| 6 | **Magic link login** — Email-based passwordless login for teachers/admins | Reduces password reset burden. Send link via institute's email sender. |
| 7 | **Gradual migration tool** — Institute starts on Free, preview Subdomain, one-click upgrade | Reduces friction. Auto-suggest subdomain from `code` field (already unique). |
| 8 | **Custom language per institute** — Some institutes may want Sinhala/Tamil-only login page | Locale config per institute. Frontend i18n already possible with react-i18next. |

### 12.3 Technical Enhancement Ideas

| # | Idea | Details |
|---|------|---------|
| 1 | **Edge-based branding** — Use Cloudflare Workers to inject branding at CDN edge, avoiding API call | Faster first paint. Worker reads from KV store. |
| 2 | **Pre-warm cache on subdomain creation** — When admin sets up subdomain, pre-cache the branding response | Eliminates cold-start delay for first visitor. |
| 3 | **WebSocket tenant isolation** — If using real-time features, namespace WebSocket connections by institute | Prevents cross-institute event leakage. |
| 4 | **Audit log per tenant** — Separate audit trails for each institute | Required for compliance. Already have `login_events`, extend to all actions. |
| 5 | **Automated domain health checks** — Cron job to verify custom domain DNS + SSL every 24h | Alert admin if domain breaks. Auto-disable if consistently failing. |
| 6 | **Feature flags per institute** — Fine-grained control over which features each tier gets | Use JSON config in `institute_billing_config.custom_pricing_json`. |
| 7 | **Subdomain auto-suggestion from institute code** — Institute code "RCOL" → suggest "rcol.suraksha.lk" | Reduces setup friction. |

---

## 13. Practicality Assessment

### 13.1 What's Realistic vs. Ambitious

| Feature | Practicality | Why |
|---------|-------------|-----|
| Wildcard subdomain (`*.suraksha.lk`) | ✅ Very practical | Cloudflare supports this natively. One DNS record + one SSL cert. |
| Runtime tenant detection in frontend | ✅ Very practical | Simple `window.location.hostname` check. Same build deployed everywhere. |
| Custom login branding | ✅ Very practical | Fields already exist in DB (`logoUrl`, `primaryColorCode`, `secondaryColorCode`). Just need to use them on login page. |
| Login event tracking for billing | ✅ Practical | Simple INSERT on login. Async queue prevents blocking. |
| Monthly billing calculation | ✅ Practical | Cron job with `COUNT(DISTINCT)`. Standard pattern. |
| Custom domain with auto-SSL | ⚠️ Moderate complexity | Requires Caddy/Traefik with ACME auto-cert or Cloudflare for SaaS. Operational overhead for cert monitoring. |
| SMS masking per institute | ⚠️ Moderate complexity | Depends on SMS provider (Dialog, Mobitel, etc.). May need per-institute API keys. Regulatory approvals for sender name. |
| Hiding from Suraksha app | ✅ Practical | Boolean flag + filter in query. Easy. |
| Isolated tier with custom app | ⚠️ Complex | Requires building + maintaining separate APKs (or teaching institutes to build). Support overhead. |
| Dedicated database per institute | ❌ Not practical yet | Over-engineering for current scale. Stick with shared DB + row-level isolation. Revisit at 1000+ institutes. |
| Full white-label email sender | ⚠️ Moderate | Requires SPF/DKIM/DMARC setup per domain. Deliverability risk. Use SES or SendGrid with verified domains. |

### 13.2 Minimum Viable Subdomain System (Recommended First Release)

**Phase 1 — Ship this first (4-6 weeks):**
1. Add `subdomain`, `custom_login_enabled`, `tier` columns to `institutes`
2. Add `login_background_url`, `login_welcome_text` columns
3. Create `GET /v2/institutes/by-subdomain/:subdomain` endpoint (cached)
4. Update CORS to allow `*.suraksha.lk`
5. Frontend: detect subdomain → fetch branding → themed login page
6. Backend: record `login_method` on auth (add column to existing login flow)
7. Admin panel: allow setting subdomain + branding for an institute
8. Skip billing for Phase 1 — manually track usage

**Phase 2 — Billing + Custom Domains (6-10 weeks after Phase 1):**
1. `login_events` table + async recording
2. `institute_billing_config` + `monthly_billing_summary` tables
3. Billing calculation cron job
4. Admin panel: billing dashboard, invoice generation
5. Custom domain support with DNS verification + auto-SSL
6. SMS masking integration

**Phase 3 — Isolation + Advanced Features (post-launch):**
1. `isVisibleInApp` / `isVisibleInWebSelector` flags
2. Isolated tier implementation
3. Analytics dashboard
4. Feature flags per institute
5. SSO integration

---

## 14. Infrastructure Requirements

### 14.1 DNS Setup

```
# Current
lms.suraksha.lk      → CDN / Server IP
lmsapi.suraksha.lk   → API Server IP
admin.suraksha.lk    → Admin CDN / Server IP

# Add
*.suraksha.lk         → CDN / Server IP (wildcard A record)
# This automatically covers abc.suraksha.lk, xyz.suraksha.lk, etc.

# For custom domains (institute sets this in their DNS)
lms.abcinstitute.com  → CNAME to lms.suraksha.lk (or our proxy IP)
```

### 14.2 SSL Certificates

| Domain | Certificate Type | Provider |
|--------|-----------------|----------|
| `*.suraksha.lk` | Wildcard | Cloudflare (free) or AWS ACM |
| `lms.abcinstitute.com` | Single domain | Let's Encrypt (auto-provisioned) |
| `lms.anotherinstitute.lk` | Single domain | Let's Encrypt (auto-provisioned) |

### 14.3 Web Server / Reverse Proxy

**Recommended: Caddy or Traefik**
- Both support automatic HTTPS with Let's Encrypt
- Both support on-demand TLS (provision cert when first request hits)
- Caddy example:

```caddyfile
# Wildcard for *.suraksha.lk
*.suraksha.lk {
  tls {
    dns cloudflare {env.CLOUDFLARE_API_TOKEN}
  }
  reverse_proxy frontend:3000
}

# On-demand TLS for custom domains
:443 {
  tls {
    on_demand
    ask http://lmsapi.suraksha.lk/internal/verify-domain
    # Backend endpoint returns 200 if domain is verified, 404 otherwise
  }
  reverse_proxy frontend:3000
}
```

### 14.4 Estimated Infrastructure Cost (Additional)

| Resource | Monthly Cost (USD) |
|----------|-------------------|
| Wildcard DNS (Cloudflare free plan) | $0 |
| Wildcard SSL (Cloudflare free plan) | $0 |
| Additional server resources for login event tracking | ~$20-50 |
| Redis cache for subdomain → institute mapping | ~$15-30 |
| Custom domain SSL (Let's Encrypt) | $0 |
| SMS masking provider fees (per institute, pass-through) | Variable |
| **Total additional infrastructure** | **~$35-80/month** |

---

## 15. Implementation Phases

### Phase 1: Subdomain Foundation (Weeks 1-6)

```
Week 1-2: Database changes + Backend endpoints
  ├── Add subdomain/domain/tier columns to institute entity
  ├── Create GET /v2/institutes/by-subdomain/:subdomain endpoint
  ├── Add loginMethod to auth flow + login DTO
  ├── Update CORS configuration for *.suraksha.lk
  └── Add subdomain validation (reserved words, format)

Week 3-4: Frontend tenant detection + themed login
  ├── Create TenantContext + detection logic
  ├── Modify Login.tsx to accept branding config
  ├── Create CustomLoginPage wrapper component
  ├── Test with localhost subdomain simulation
  └── Handle cookie domain per subdomain

Week 5-6: Admin panel + testing
  ├── Admin UI: set subdomain + preview branding
  ├── Integration testing across subdomains
  ├── DNS + SSL setup for *.suraksha.lk
  ├── Load testing
  └── Documentation
```

### Phase 2: Billing & Custom Domains (Weeks 7-14)

```
Week 7-8: Login event tracking
  ├── Create login_events table
  ├── Async event recording (BullMQ queue)
  ├── Login method determination logic
  └── Unit tests for billing scenarios

Week 9-10: Billing engine
  ├── institute_billing_config table + admin CRUD
  ├── monthly_billing_summary calculation cron
  ├── Admin billing dashboard
  └── Invoice generation (PDF, email)

Week 11-14: Custom domain support
  ├── DNS verification system (CNAME/TXT record check)
  ├── Auto-SSL provisioning (Caddy/Traefik on-demand TLS)
  ├── Custom domain health monitoring
  ├── Admin UI for domain management
  └── End-to-end testing with real custom domain
```

### Phase 3: Isolation & Advanced (Weeks 15-22)

```
Week 15-16: Visibility controls
  ├── isVisibleInApp / isVisibleInWebSelector flags
  ├── Institute selector filtering
  ├── Mobile app update to respect visibility flags
  └── Testing cross-tier scenarios

Week 17-19: SMS masking & email sender
  ├── SMS provider integration per institute
  ├── Email sender domain verification (SPF/DKIM)
  ├── Admin UI for masking configuration
  └── Regulatory compliance check

Week 20-22: Analytics & polish
  ├── Login analytics dashboard per institute
  ├── System admin overview dashboard
  ├── Feature flags system
  ├── Documentation & onboarding guide
  └── Performance optimization
```

---

## 16. Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|------|-------------|--------|------------|
| 1 | Institute doesn't understand billing model | High | Medium | Clear pricing page, calculator tool, usage dashboard |
| 2 | Custom domain SSL fails to provision | Medium | High | Fallback to HTTP with warning. Manual cert upload option. Health monitoring alerts. |
| 3 | Subdomain collision with system domains | Low | Critical | Reserved word list checked on creation. Validate against `api`, `admin`, `www`, `mail`, `lms`, `org`, `transport`, `static`, `cdn`, `ns1`, `ns2`. |
| 4 | Cross-tenant data leakage via caching | Medium | Critical | Cache keys must include tenant ID. Never cache authenticated responses across tenants. |
| 5 | Login event queue backup during peak | Medium | Medium | Auto-scaling queue workers. Dead letter queue for failed events. Alert on queue depth > threshold. |
| 6 | Institute disputes billing | High | Low | Provide detailed login logs accessible to institute admins. Transparent billing breakdown. |
| 7 | Cookie issues across domains | High | High | Test thoroughly. Use separate cookie names per domain. Clear documentation for users switching domains. |
| 8 | Existing users confused by new domain | Medium | Medium | Gradual rollout. Keep `lms.suraksha.lk` working exactly as today. Subdomain is additive, not replacing. |
| 9 | SMS sender name registration delays | High | Medium | 2-4 week approval process with carriers. Start early. Have fallback sender name. |
| 10 | Browser security blocking cross-domain flows | Medium | High | Test all flows: Chrome, Firefox, Safari, Samsung Browser. SameSite cookie issues on 3rd party context (custom domains). |

---

## Summary of Recommendations

1. **Start with Phase 1 (Subdomain only)** — lowest risk, highest value, least infrastructure change
2. **Keep the free tier exactly as-is** — no disruption to existing users
3. **Use `institute.code` as default subdomain suggestion** — already unique, familiar to institutes
4. **Don't over-build billing** — start with manual invoicing for Phase 1, automate in Phase 2
5. **Redis cache is mandatory** — subdomain → institute mapping is on every login's hot path
6. **Cookie domain strategy is the trickiest part** — get this right in Phase 1 or it'll haunt every phase
7. **Custom domains are Phase 2** — the complexity jump from subdomain to custom domain is significant
8. **Don't build the Isolated tier until you have paying customers** — it's complex and speculative
9. **Test on real subdomains early** — `*.localhost` doesn't behave like `*.suraksha.lk`
10. **Pre-compute billing daily, not at query time** — `login_events` table grows fast

---

*Generated: 2026-04-06 | Based on codebase analysis of `lms-api-suraksha-lk` backend + `lms user frotend` frontend*
