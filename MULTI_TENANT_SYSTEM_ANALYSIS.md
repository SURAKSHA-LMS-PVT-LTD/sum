# Multi-Tenant Subdomain & Custom Domain System — Complete Analysis

> **Date:** April 6, 2026  
> **Status:** Implementation Complete | TypeScript: Zero Errors (all 3 codebases)  
> **Codebases:** Backend (NestJS), User Frontend (React), System Admin Frontend (React)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE DNS                            │
│  *.suraksha.lk  →  CNAME → origin server                    │
│  lms.myschool.lk → CNAME → proxy.suraksha.lk               │
└────────────────────────┬─────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│ FRONTEND (React 19.2 + Vite)                                 │
│                                                              │
│  TenantContext → detectTenant() from hostname                │
│    ├── academy.suraksha.lk  →  SUBDOMAIN login               │
│    ├── lms.myschool.lk      →  CUSTOM_DOMAIN login           │
│    └── lms.suraksha.lk      →  SURAKSHA_WEB (default)        │
│                                                              │
│  Login.tsx → Dynamic branding from TenantContext              │
│  All routes use RELATIVE paths (stays on subdomain)          │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼─────────────────────────────────────┐
│ BACKEND (NestJS v11)                                         │
│                                                              │
│  main.ts CORS:                                               │
│    ├── Static whitelist (lms.suraksha.lk, etc.)              │
│    ├── Wildcard *.suraksha.lk regex                          │
│    └── Dynamic custom domain DB cache (5-min TTL)            │
│                                                              │
│  Auth Flow:                                                  │
│    1. POST /v2/auth/login (subdomain? customDomain?)         │
│    2. Resolve tenant institute from subdomain/domain          │
│    3. Validate user belongs to that institute                 │
│    4. Issue JWT + record login event for billing              │
│                                                              │
│  Tenant Module:                                              │
│    ├── TenantController (3 public + 13 guarded endpoints)    │
│    ├── TenantService (resolution, branding, billing)         │
│    └── Entities (LoginEvent, BillingConfig, BillingSummary)  │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Files Created / Modified

### Backend (`lms-api-suraksha-lk`)

| File | Type | Purpose |
|------|------|---------|
| `src/modules/tenant/tenant.module.ts` | NEW | Module registration |
| `src/modules/tenant/tenant.service.ts` | NEW | Core business logic — resolution, branding, billing, login events |
| `src/modules/tenant/tenant.controller.ts` | NEW | 16 REST endpoints (3 public, 13 admin-guarded) |
| `src/modules/tenant/dto/tenant.dto.ts` | NEW | DTOs with class-validator + RESERVED_SUBDOMAINS |
| `src/modules/tenant/entities/login-event.entity.ts` | NEW | Login event tracking for billing |
| `src/modules/tenant/entities/institute-billing-config.entity.ts` | NEW | Per-institute billing configuration |
| `src/modules/tenant/entities/monthly-billing-summary.entity.ts` | NEW | Pre-computed monthly billing aggregation |
| `src/modules/institute/entities/institute.entity.ts` | MODIFIED | +25 columns (subdomain, customDomain, branding, tier, visibility) |
| `src/modules/institute/enums/institute.enums.ts` | MODIFIED | +6 enums (InstituteTier, LoginBackgroundType, LoginMethod, etc.) |
| `src/auth/controllers/auth.v2.controller.ts` | MODIFIED | Multi-tenant login flow, cookie strategy, institute validation |
| `src/auth/auth.service.ts` | MODIFIED | loginV2() with loginMethod + tenantInstituteId, getUserInstituteIds() |
| `src/auth/dto/login.dto.ts` | MODIFIED | +subdomain, +customDomain, +loginMethod fields |
| `src/auth/auth.module.ts` | MODIFIED | Imports TenantModule |
| `src/app.module.ts` | MODIFIED | Registers TenantModule |
| `src/main.ts` | MODIFIED | Dynamic CORS for custom domains with DB cache |

### User Frontend (`lms user frotend`)

| File | Type | Purpose |
|------|------|---------|
| `src/contexts/TenantContext.tsx` | NEW | Hostname-based tenant detection + branding fetch |
| `src/contexts/types/auth.types.ts` | MODIFIED | +subdomain, +customDomain, +loginMethod in LoginCredentials |
| `src/contexts/utils/auth.api.ts` | MODIFIED | Passes tenant fields in login request |
| `src/components/Login.tsx` | MODIFIED | Dynamic branding (logo, title, background, "Powered by" badge) |
| `src/App.tsx` | MODIFIED | TenantProvider wraps AuthProvider |

### System Admin Frontend (`sysstemadminfrotend`)

| File | Type | Purpose |
|------|------|---------|
| `src/components/forms/TenantManagementDialog.tsx` | NEW | 4-tab management: Subdomain, Custom Domain, Tier, Visibility |
| `src/lib/api.ts` | MODIFIED | +10 tenant management API functions |
| `src/pages/InstitutePage.tsx` | MODIFIED | Tier badge column, Subdomain column, Tenant "Manage" button |

---

## 3. Security Measures Implemented

### Authentication & Authorization
| Measure | Details |
|---------|---------|
| **Global JWT Guard** | All endpoints require valid JWT (via `APP_GUARD`) unless `@Public()` |
| **Role-Based Access** | Admin endpoints use `@UseGuards(FlexibleAccessGuard)` + `@RequireAnyOfRoles` |
| **Tier/Billing: SuperAdmin only** | `updateTier`, `updateBillingConfig` locked to `UserType.SUPERADMIN` |
| **Other admin ops: SA + IA** | Subdomain/domain/branding/visibility allow SuperAdmin + InstituteAdmin |
| **Institute membership validation** | Login via subdomain validates user actually belongs to that institute |
| **Rate limiting** | Login: 5/15min, Subdomain check: 10/min, Global throttler on all routes |

### CORS Security
| Measure | Details |
|---------|---------|
| **Static whitelist** | Known origins (lms.suraksha.lk, admin panels) |
| **Wildcard regex** | `*.suraksha.lk` for subdomains |
| **Dynamic DB cache** | Custom domains verified from DB with 5-minute TTL |
| **Only verified domains** | CORS only accepts `custom_domain_verified = TRUE` records |

### Cookie Security
| Flag | Value | Reason |
|------|-------|--------|
| `httpOnly` | `true` | Prevents XSS from reading refresh token |
| `secure` | `true` (production) | HTTPS only |
| `sameSite` | `lax` | Allows same-site cross-origin (lms→lmsapi) |
| `domain` | `undefined` (prod) | Scoped to API origin; subdomain clients use body token |

### Input Validation & Injection Prevention
| Measure | Details |
|---------|---------|
| **Subdomain regex** | `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$` |
| **Reserved subdomains** | 30+ blocked (api, admin, www, mail, cdn, etc.) |
| **CSS sanitization** | Whitelist of 15 safe properties; blocks `url()`, `expression()`, `@import`, `javascript:`, `data:` |
| **Domain regex** | DNS-compliant validation with 255 char limit |
| **TypeORM parameterized queries** | All DB queries use parameterized values (no SQL injection) |

---

## 4. Package Tiers

| Tier | Monthly Price | Features |
|------|--------------|----------|
| **FREE** | LKR 0 | Default login via lms.suraksha.lk only |
| **STARTER** | LKR 2,500 | Subdomain + basic branding (logo, colors, welcome text) |
| **PROFESSIONAL** | LKR 5,000 | + Video backgrounds, "Powered by" badge removal |
| **ENTERPRISE** | LKR 15,000 | + Custom domain + full white-label branding |
| **ISOLATED** | LKR 30,000+ | Full white-label, dedicated infrastructure (future) |

### Tier-Based Business Logic Enforcement

```
├── FREE tier → Cannot enable custom login, no branding
├── STARTER → Subdomain enabled, auto-upgrade from FREE on setSubdomain()
│   ├── No video backgrounds
│   └── Cannot hide "Powered by" badge
├── PROFESSIONAL → Video backgrounds + badge removal allowed
├── ENTERPRISE → Custom domain allowed
│   └── Requires DNS CNAME to proxy.suraksha.lk + verification
└── ISOLATED → Full features (same as ENTERPRISE, future: dedicated DB)
```

---

## 5. API Endpoints Summary

### Public (no auth)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v2/tenant/branding/subdomain/:subdomain` | Get institute branding by subdomain |
| GET | `/v2/tenant/branding/domain/:domain` | Get institute branding by custom domain |
| GET | `/v2/tenant/subdomain/check/:subdomain` | Check subdomain availability (rate-limited) |

### Admin (JWT + FlexibleAccessGuard)
| Method | Path | Allowed Roles | Purpose |
|--------|------|---------------|---------|
| PATCH | `/v2/tenant/institutes/:id/subdomain` | SA, IA | Set/update subdomain |
| DELETE | `/v2/tenant/institutes/:id/subdomain` | SA, IA | Remove subdomain |
| PATCH | `/v2/tenant/institutes/:id/custom-domain` | SA, IA | Set custom domain |
| POST | `/v2/tenant/institutes/:id/verify-domain` | SA, IA | Verify custom domain DNS |
| PATCH | `/v2/tenant/institutes/:id/login-branding` | SA, IA | Update login page branding |
| PATCH | `/v2/tenant/institutes/:id/tier` | SA only | Update institute tier |
| PATCH | `/v2/tenant/institutes/:id/visibility` | SA, IA | Update app/web visibility |
| GET | `/v2/tenant/institutes/:id/billing-config` | SA, IA | Get billing configuration |
| PATCH | `/v2/tenant/institutes/:id/billing-config` | SA only | Update billing configuration |
| GET | `/v2/tenant/institutes/:id/billing-summary` | SA, IA | Get monthly billing summary |
| GET | `/v2/tenant/institutes/:id/login-stats` | SA, IA | Get login statistics |

---

## 6. Bugs Fixed (Across All Sessions)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | CRITICAL | Missing `isActive` column in `InstituteBillingConfigEntity` (migration had it, entity didn't) | Added column |
| 2 | CRITICAL | Cross-origin cookie rejection (lmsapi.suraksha.lk → academy.suraksha.lk) | Removed explicit domain; frontend uses body token |
| 3 | CRITICAL | Static CORS custom domain list (loaded at boot, stale after adding domains) | Dynamic DB cache with 5-min TTL |
| 4 | CRITICAL | Admin endpoints had NO role-based authorization (any authenticated user could call) | Added `FlexibleAccessGuard` + `RequireAnyOfRoles` to all 13 endpoints |
| 5 | HIGH | No tenant institute membership validation at login | Added `getUserInstituteIds()` check before accepting tenant login |
| 6 | HIGH | CSS injection via `loginCustomCss` | Property whitelist + blocks url()/expression()/@import/javascript:/data: |
| 7 | HIGH | Frontend `TenantBranding.loginBackgroundType` missing `GRADIENT` | Added to union type |
| 8 | IMPORTANT | `UpdateLoginBrandingDto` missing `loginCustomCss` field | Added with `@IsObject()` validator |
| 9 | IMPORTANT | No controller endpoint for `removeSubdomain()` | Added `DELETE /v2/tenant/institutes/:id/subdomain` |
| 10 | IMPORTANT | MySQL incompatible `@Index({ where: ... })` partial indexes | Removed PostgreSQL-only `where` clause |
| 11 | MEDIUM | No rate limiting on subdomain availability check | Added `@Throttle({ limit: 10, ttl: 60000 })` |
| 12 | MINOR | `null as any` type assertion in `removeSubdomain()` | QueryBuilder with `SET subdomain = NULL` |
| 13 | MINOR | Missing `@Unique` on `MonthlyBillingSummaryEntity` | Added `@Unique('uk_institute_month', ['instituteId', 'billingMonth'])` |
| 14 | MINOR | `getBillingSummary` date comparison fails on MySQL DATE column | String format `YYYY-MM-01` with QueryBuilder |
| 15 | MINOR | Unused TypeORM imports in 3 entity files | Removed |
| 16 | MINOR | `TenantManagementDialog` state not reset when switching institutes | Added `useEffect` on `institute?.id` |

---

## 7. Known Limitations & Pending Items

### DNS Verification (Stub)
The `verifyCustomDomain()` method currently returns `{ verified: false, message: 'DNS verification pending...' }`. Actual Cloudflare API verification requires:
- `CLOUDFLARE_API_TOKEN` environment variable
- Cloudflare Zone ID for `suraksha.lk`
- DNS lookup to verify CNAME points to `proxy.suraksha.lk`

**CORS is safe**: Only domains with `custom_domain_verified = TRUE` in DB are accepted. Since verification never sets this to `true`, no unverified domain can pass CORS until an admin manually updates the DB.

### Cookie Strategy for Subdomains
By design, the API (`lmsapi.suraksha.lk`) cannot set httpOnly cookies for tenant subdomains (`academy.suraksha.lk`). The frontend stores the refresh token from the response body for subdomain/custom-domain logins. This is the standard approach for cross-origin auth.

### Database Migration
The migration file adds 25+ columns to `institutes` and creates 3 new tables. It must be run before deploying:
```bash
npm run typeorm:migration:run
```

---

## 8. Suggestions for Future Enhancement

### 🔮 Short-Term (Before Production)

1. **Implement DNS verification with Cloudflare API**
   - Use `@cloudflare/node-dns` or Cloudflare REST API to verify CNAME records
   - Auto-provision SSL via Cloudflare for verified custom domains
   - Add a scheduled job to re-verify domains periodically (in case DNS changes)

2. **Add login branding preview endpoint**
   - `GET /v2/tenant/institutes/:id/branding-preview` — returns branding as it would appear to users
   - Allows admin to preview before publishing changes

3. **Add subdomain removal confirmation**
   - Frontend should show a confirmation dialog before removing a subdomain
   - Backend should log subdomain removal events for audit trail

4. **Implement billing cron job**
   - Scheduled task to compute `MonthlyBillingSummary` from `LoginEvent` records
   - Run on the 1st of each month to aggregate previous month's data
   - Generate invoice URLs and send billing notifications

5. **Add institute-scoped token validation**
   - When a user logs in via `academy.suraksha.lk`, consider limiting the JWT scope to that institute only
   - Prevents data access across institutes in multi-institute accounts

### 🔮 Medium-Term

6. **Cloudflare Workers for subdomain routing**
   - Deploy a Cloudflare Worker on `*.suraksha.lk` to serve the frontend SPA
   - Eliminates need for wildcard DNS A/CNAME to a single origin server
   - Enables edge-cached, per-subdomain page routing

7. **Custom domain SSL automation**
   - Cloudflare for SaaS (Enterprise) or Let's Encrypt with DNS-01 challenge
   - Auto-provision and renew SSL certificates for custom domains
   - Track SSL status via `CustomDomainSslStatus` enum (already defined)

8. **Tenant analytics dashboard**
   - Build a dashboard in the admin frontend showing:
     - Login counts per method (SURAKSHA_WEB vs SUBDOMAIN vs CUSTOM_DOMAIN)
     - Unique users per month per tenant
     - Revenue projection based on tier and usage
   - Uses the existing `getLoginStats()` and `getBillingSummary()` endpoints

9. **Branding theme editor in admin panel**
   - Visual editor for `loginCustomCss` with live preview
   - Color picker for `primaryColorCode` / `secondaryColorCode`
   - Image upload integration for logos, backgrounds, favicons
   - Preview component that renders the login page as it would appear

10. **Multi-tenant email branding**
    - Custom sender name per institute (e.g., "Royal College LMS" instead of "SurakshaLMS")
    - Custom email templates with institute branding
    - Requires institute-specific email configuration or shared sending infrastructure

### 🔮 Long-Term

11. **ISOLATED tier: Dedicated database**
    - For ISOLATED tier, provision a separate database per institute
    - Use TypeORM connection pooling with dynamic DataSource selection
    - Requires connection string management and migration orchestration

12. **White-label mobile app**
    - ISOLATED tier institutes get a custom-branded Capacitor build
    - Custom app icon, splash screen, and bundle ID
    - Automated CI/CD pipeline for building per-institute APK/IPA

13. **Marketplace for institute add-ons**
    - Institute admins can enable/disable features (SMS, attendance, payments)
    - Per-feature billing with separate pricing tiers
    - Feature flags stored per-institute in the billing configuration

14. **Self-service tier upgrade**
    - Allow institute admins to upgrade their tier directly from the frontend
    - Payment integration (Stripe/PayHere) for automated billing
    - Grace period for downgrades (keep features for current billing cycle)

---

## 9. Testing Checklist

### Local Development
- [ ] Start backend: `npm run start:dev`
- [ ] Start frontend: `npx vite --host --port 3000`
- [ ] Test default login: `http://localhost:3000` → should show SurakshaLMS branding
- [ ] Test subdomain simulation: `http://localhost:3000/?subdomain=academy` → should show tenant branding (or error if no institute in DB)
- [ ] Test login with subdomain → verify JWT is issued, user reaches dashboard
- [ ] Test 401 redirect → verify stays on same origin (relative `/login`)
- [ ] Test admin panel → Institutes page → Tenant "Manage" button → all 4 tabs functional

### API Verification (via Postman/curl)
- [ ] `GET /v2/tenant/branding/subdomain/academy` → 200 or 404
- [ ] `GET /v2/tenant/subdomain/check/academy` → `{ available: true/false }`
- [ ] `PATCH /v2/tenant/institutes/:id/subdomain` with student JWT → 403
- [ ] `PATCH /v2/tenant/institutes/:id/subdomain` with admin JWT → 200
- [ ] `PATCH /v2/tenant/institutes/:id/tier` with institute admin JWT → 403 (SuperAdmin only)
- [ ] `PATCH /v2/tenant/institutes/:id/login-branding` with CSS injection payload → 400

### Security Verification
- [ ] CORS: request from `https://evil.com` → should be blocked
- [ ] CORS: request from `https://academy.suraksha.lk` → should be allowed
- [ ] Login via subdomain of institute user does NOT belong to → 401
- [ ] Rate limit: 11th subdomain check within 1 minute → 429
- [ ] CSS injection: `loginCustomCss: { "background": "url(https://evil.com)" }` → 400

---

## 10. Database Schema Changes

### New Tables
```sql
-- Login events for billing and analytics
CREATE TABLE login_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  institute_id BIGINT,
  login_method ENUM('SURAKSHA_WEB','SURAKSHA_APP','SUBDOMAIN','CUSTOM_DOMAIN'),
  login_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  INDEX idx_login_billing (institute_id, login_method, login_timestamp),
  INDEX idx_login_user_month (user_id, institute_id, login_method, login_timestamp),
  INDEX idx_login_timestamp (login_timestamp)
);

-- Per-institute billing configuration
CREATE TABLE institute_billing_config (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  institute_id BIGINT NOT NULL UNIQUE,
  tier ENUM('FREE','STARTER','PROFESSIONAL','ENTERPRISE','ISOLATED'),
  base_monthly_fee DECIMAL(10,2) DEFAULT 0,
  per_user_monthly_fee DECIMAL(10,2) DEFAULT 0,
  per_subdomain_login_fee DECIMAL(10,2) DEFAULT 0,
  sms_masking_monthly_fee DECIMAL(10,2) DEFAULT 0,
  custom_pricing_json JSON,
  billing_cycle_start_day INT DEFAULT 1,
  currency VARCHAR(3) DEFAULT 'LKR',
  max_free_subdomain_logins INT DEFAULT 1000,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Pre-computed monthly billing summaries
CREATE TABLE monthly_billing_summary (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  institute_id BIGINT NOT NULL,
  billing_month DATE NOT NULL,
  total_logins INT DEFAULT 0,
  subdomain_logins INT DEFAULT 0,
  custom_domain_logins INT DEFAULT 0,
  unique_subdomain_users INT DEFAULT 0,
  unique_custom_domain_users INT DEFAULT 0,
  total_active_users INT DEFAULT 0,
  base_fee DECIMAL(10,2) DEFAULT 0,
  user_fee DECIMAL(10,2) DEFAULT 0,
  login_fee DECIMAL(10,2) DEFAULT 0,
  sms_masking_fee DECIMAL(10,2) DEFAULT 0,
  total_fee DECIMAL(10,2) DEFAULT 0,
  status ENUM('PENDING','INVOICED','PAID','OVERDUE') DEFAULT 'PENDING',
  invoice_url VARCHAR(500),
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE KEY uk_institute_month (institute_id, billing_month)
);
```

### Modified Table: `institutes`
```sql
ALTER TABLE institutes ADD COLUMN
  tier ENUM('FREE','STARTER','PROFESSIONAL','ENTERPRISE','ISOLATED') DEFAULT 'FREE',
  subdomain VARCHAR(63) NULL UNIQUE,
  custom_domain VARCHAR(255) NULL UNIQUE,
  custom_domain_verified BOOLEAN DEFAULT FALSE,
  custom_domain_ssl_status ENUM('PENDING','ACTIVE','FAILED','EXPIRED') DEFAULT 'PENDING',
  custom_login_enabled BOOLEAN DEFAULT FALSE,
  login_logo_url VARCHAR(500),
  login_background_type ENUM('COLOR','GRADIENT','IMAGE','VIDEO') DEFAULT 'COLOR',
  login_background_url VARCHAR(500),
  login_video_poster_url VARCHAR(500),
  login_illustration_url VARCHAR(500),
  login_welcome_title VARCHAR(200),
  login_welcome_subtitle VARCHAR(500),
  login_footer_text VARCHAR(200),
  login_custom_css JSON,
  favicon_url VARCHAR(500),
  custom_app_name VARCHAR(100),
  powered_by_visible BOOLEAN DEFAULT TRUE,
  is_visible_in_app BOOLEAN DEFAULT TRUE,
  is_visible_in_web_selector BOOLEAN DEFAULT TRUE,
  billing_status ENUM('ACTIVE','SUSPENDED','TRIAL','CANCELLED') DEFAULT 'ACTIVE',
  trial_ends_at TIMESTAMP NULL;
```
