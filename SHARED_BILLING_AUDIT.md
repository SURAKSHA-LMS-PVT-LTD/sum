# Shared Billing Account Audit
## Can Multiple Institutes Share One Billing Account / Credit Pool?

**Scenario:** Institutes A, B, C all running under `abc.lk`, sharing one credit account and one billing plan.  
**Answer: NO — not supported in the current implementation.**  
Every institute is a fully isolated billing entity. Zero multi-institute billing infrastructure exists.

---

## Table of Contents
1. [Current Architecture](#1-current-architecture)
2. [Critical Gaps](#2-critical-gaps)
3. [Schema Mismatches](#3-schema-mismatches)
4. [Service Logic Bugs & Mismatches](#4-service-logic-bugs--mismatches)
5. [Frontend Gaps](#5-frontend-gaps)
6. [Custom Domain Constraint](#6-custom-domain-constraint)
7. [What Would Need to Change](#7-what-would-need-to-change)
8. [Migration SQL](#8-migration-sql)
9. [Phase Roadmap](#9-phase-roadmap)
10. [Summary Table](#10-summary-table)

---

## 1. Current Architecture

### Credit Wallet (`institute_credits`)
```
institute_credits
├── instituteId    UNIQUE ← hard-coded 1-to-1, cannot share
├── balance
├── totalPurchased
├── totalUsed
├── dailyUsed / monthlyUsed
├── dailyLimit / monthlyLimit
└── lastTopupAt
```
Each institute has exactly one credit wallet. The `UNIQUE` constraint on `instituteId` makes it physically impossible to have a shared pool at the DB level.

### Billing Config (`institute_billing_config`)
```
institute_billing_config
├── instituteId    UNIQUE ← per-institute, no parent concept
├── tier           (FREE | STARTER | PROFESSIONAL | ENTERPRISE | ISOLATED)
├── baseMonthlyFee
├── perUserMonthlyFee
├── perSubdomainLoginFee
└── smsMaskingMonthlyFee
```
Tier and fees are set independently per institute. There is no inheritance.

### Monthly Billing (`monthly_billing_summary`)
```
UNIQUE KEY uk_institute_month (instituteId, billingMonth)
```
Each institute gets its own monthly invoice. No consolidated/parent invoice exists.

### Institutes Table (`institutes`)
```
institutes
├── id
├── tier           ← per-institute copy of tier
├── subdomain      UNIQUE
├── customDomain   UNIQUE  ← one domain = one institute, blocks sharing abc.lk
└── (no parent_institute_id field)
```
No parent–child relationship between institutes exists anywhere in the schema.

### Organization (`org_organizations`)
The existing `org_organizations` table groups **users** within a single institute (for messaging, enrollment, causes). It has zero billing or credit fields and cannot serve as a billing parent.

---

## 2. Critical Gaps

### GAP-01 — No Parent/Master Institute Concept
There is no `parent_institute_id` column anywhere in the schema.  
You cannot say "institute B and C belong to institute A and inherit its billing."

### GAP-02 — Credit Pool Is Always Per-Institute
`InstituteCreditsService.deductCredits()` locks and deducts from a single `instituteId` record:
```typescript
// src/modules/notification-credits/services/institute-credits.service.ts
manager.findOne(InstituteCreditsEntity, {
  where: { instituteId, isActive: true },   // ← always one institute
  lock: { mode: 'pessimistic_write' },
})
```
No method exists for pooled or parent-level deduction.

### GAP-03 — Payment Top-Up Goes to Single Institute Only
When a payment is verified and credits are granted:
```typescript
// tenant.service.ts  ~line 945
await this.instituteCreditsService.grantCreditsWithManager(
  manager,
  payment.instituteId,   // ← always the paying institute, never a parent pool
  { amount: creditsToGrant, type: CreditTransactionType.TOP_UP }
);
```

### GAP-04 — Custom Domain Cannot Be Shared
`institutes.customDomain` has a `UNIQUE` index.  
If `abc.lk` is assigned to institute A, the DB will reject any attempt to assign it to B or C.  
There is no routing/proxy table to map one domain to multiple institutes.

### GAP-05 — Tier Is Per-Institute, No Inheritance
Feature gating (subdomain, custom domain, SMS masking, white-label, etc.) reads `institutes.tier` for exactly one institute.  
If A=ENTERPRISE and B=FREE, B gets FREE features even if they are meant to share A's plan.

### GAP-06 — No Consolidated Billing View
`getBillingOverview()` returns a list of per-institute summaries.  
There is no endpoint or service method that aggregates invoices across a parent + children group.

### GAP-07 — Transaction Ledger Is Siloed
`institute_credit_transactions` is always filtered by `instituteId`.  
You cannot see a unified transaction history for "abc group of institutes."

---

## 3. Schema Mismatches

| Table | Column / Constraint | Current State | Problem | Required Change |
|---|---|---|---|---|
| `institutes` | `customDomain` | `UNIQUE` index | Blocks sharing `abc.lk` across institutes | Remove UNIQUE, add routing table |
| `institutes` | — | No `parent_institute_id` | Cannot express A owns B, C | Add `parent_institute_id BIGINT NULL FK` |
| `institutes` | `tier` | Per-institute enum | No tier inheritance | Add `inherit_tier BOOLEAN DEFAULT FALSE` |
| `institute_credits` | `instituteId` | `UNIQUE` index | Enforces 1:1, no shared pool possible | Remove UNIQUE; add optional `parent_institute_id` |
| `institute_billing_config` | `instituteId` | `UNIQUE` index | One config per institute, no shared config | Remove UNIQUE; add `parent_institute_id` |
| `monthly_billing_summary` | `(instituteId, billingMonth)` | Unique key per institute | No consolidated invoice | Add `parent_institute_id` column for aggregation |
| `org_organizations` | — | No billing fields | Cannot serve as billing parent | Add `tier`, `creditPoolId` if org becomes billing owner |
| `tenant_service_payments` | `instituteId` | Per-institute | Payment attached only to one institute | Add optional `parent_institute_id` |

---

## 4. Service Logic Bugs & Mismatches

### BUG-01 — `deductCredits` has no pool fallback
```typescript
// Current — fails silently if institute has no credits but parent pool does
const credits = await manager.findOne(InstituteCreditsEntity, {
  where: { instituteId, isActive: true }
});
if (!credits || credits.balance < amount) throw new InsufficientCreditsException();
// ↑ Never checks a parent pool
```
**Impact:** Child institute runs out of credits even when the parent pool has balance.

### BUG-02 — `grantCredits` always creates a new per-institute record
```typescript
// Always creates or updates the CHILD's own credit record
let credits = await manager.findOne(InstituteCreditsEntity, {
  where: { instituteId, isActive: true }
});
if (!credits) {
  credits = manager.create(InstituteCreditsEntity, { instituteId, balance: 0, ... });
}
```
**Impact:** Topping up via the parent institute does not flow to children.

### BUG-03 — `getPlanInfo` reads tier from institute, never from parent
```typescript
// tenant.service.ts
const config = await this.billingConfigRepository.findOne({ where: { instituteId } });
const tier = config?.tier ?? institute.tier ?? InstituteTier.FREE;
// ↑ Never checks parentInstituteId for inherited tier
```
**Impact:** Child institute always shows FREE tier even if parent is ENTERPRISE.

### BUG-04 — `setCustomDomain` will throw unique-constraint error on shared domain
```typescript
// tenant.service.ts
await this.instituteRepository.update(instituteId, { customDomain: domain });
// ↑ DB unique constraint on customDomain will throw if abc.lk already used by sibling
```
**Impact:** Cannot point A, B, C all to `abc.lk`. Only one can claim it.

### BUG-05 — `getBillingOverview` has no parent aggregation
```typescript
const configs = await this.billingConfigRepository.find({ where: { isActive: true } });
// Returns flat list of all institutes individually — no parent/child grouping
```
**Impact:** Admin cannot see a single consolidated invoice for "abc group."

### BUG-06 — Credit daily/monthly reset runs per-institute
```typescript
// Cron job resets dailyUsed for each institute independently
```
**Impact:** If a shared pool is added later, the reset logic would double-count or reset incorrectly.

---

## 5. Frontend Gaps

### InstituteCreditsPage
- Calls `creditsApi.getBalance(instituteId)` — single institute only
- No UI to view a shared pool balance or child usage breakdown
- Top-up form only submits for the current `selectedInstitute`

### InstituteBillingPage
- Loads `planInfo` for exactly one institute
- Shows tier, features, fees per-institute
- No concept of parent plan or shared features

### Credits API (`credits.api.ts`)
All methods require `instituteId`:
```typescript
getBalance(instituteId: string)
purchaseCredits(instituteId: string, payload)
getTransactions(instituteId: string, params)
```
No methods exist for org-level or parent-level credit operations.

### Institute Selector
- Lists institutes the user belongs to individually
- No grouping of A, B, C under a "parent" or "group" heading
- No shared billing dashboard accessible from the selector

---

## 6. Custom Domain Constraint

### The Core Problem
```
abc.lk → can only point to ONE institute in the current schema
```

**What the user wants:**
```
abc.lk/instituteA  → Institute A (or just abc.lk with institute A as default)
abc.lk             → Institute B (different default)
abc.lk             → Institute C (via some routing)
```

**What currently happens:**
```sql
-- institutes table
ALTER TABLE institutes ADD UNIQUE INDEX idx_institutes_custom_domain (custom_domain);
-- ^ This means only ONE row can have custom_domain = 'abc.lk'
```

**Required addition: Domain Routing Table**
```sql
CREATE TABLE institute_domain_routing (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  domain       VARCHAR(255) NOT NULL,
  parent_institute_id BIGINT NOT NULL,
  default_child_institute_id BIGINT,
  routing_mode ENUM('DEFAULT_CHILD', 'PATH_BASED', 'SUBDOMAIN_BASED') DEFAULT 'DEFAULT_CHILD',
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_domain (domain),
  FOREIGN KEY (parent_institute_id) REFERENCES institutes(id) ON DELETE CASCADE,
  FOREIGN KEY (default_child_institute_id) REFERENCES institutes(id) ON DELETE SET NULL
);
```

---

## 7. What Would Need to Change

### 7.1 Schema (Breaking Changes)

```sql
-- 1. Parent institute reference
ALTER TABLE institutes
  ADD COLUMN parent_institute_id BIGINT NULL,
  ADD COLUMN inherit_tier        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD INDEX  idx_institutes_parent (parent_institute_id),
  ADD CONSTRAINT fk_institutes_parent
    FOREIGN KEY (parent_institute_id) REFERENCES institutes(id) ON DELETE SET NULL;

-- 2. Remove UNIQUE on customDomain (replace with domain routing table above)
ALTER TABLE institutes DROP INDEX idx_institutes_custom_domain;
ALTER TABLE institutes ADD INDEX idx_institutes_custom_domain (custom_domain);

-- 3. Shared credit pool option
ALTER TABLE institute_credits
  DROP INDEX UQ_institute_credits_instituteId,          -- remove UNIQUE
  ADD COLUMN parent_institute_id BIGINT NULL,
  ADD INDEX  idx_ic_parent (parent_institute_id),
  ADD CONSTRAINT fk_ic_parent
    FOREIGN KEY (parent_institute_id) REFERENCES institutes(id) ON DELETE SET NULL;

-- 4. Billing config — allow parent to own config for children
ALTER TABLE institute_billing_config
  DROP INDEX unique_institute_id,
  ADD COLUMN parent_institute_id BIGINT NULL,
  ADD INDEX  idx_ibc_parent (parent_institute_id);

-- 5. Monthly billing — add parent grouping
ALTER TABLE monthly_billing_summary
  ADD COLUMN parent_institute_id BIGINT NULL,
  ADD INDEX  idx_mbs_parent (parent_institute_id, billing_month);
```

### 7.2 New Service Methods (Backend)

```typescript
// Pool-aware credit deduction
async deductCreditsFromPool(instituteId: string, amount: number): Promise<void> {
  const institute = await this.instituteRepo.findOne({ where: { id: instituteId } });
  const targetId = institute.parentInstituteId ?? instituteId;
  return this.deductCredits(targetId, amount);
}

// Tier resolution with parent inheritance
async getEffectiveTier(instituteId: string): Promise<InstituteTier> {
  const institute = await this.instituteRepo.findOne({
    where: { id: instituteId },
    relations: ['parent'],
  });
  if (institute.inheritTier && institute.parent) {
    return institute.parent.tier;
  }
  return institute.tier ?? InstituteTier.FREE;
}

// Consolidated billing overview for a parent group
async getGroupBillingOverview(parentInstituteId: string, year: number, month: number) {
  const children = await this.instituteRepo.find({ where: { parentInstituteId } });
  const ids = [parentInstituteId, ...children.map(c => c.id)];
  // Aggregate monthly_billing_summary for all ids
}
```

### 7.3 New API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/v2/tenant/institutes/:id/set-parent` | Link institute as child of another |
| `DELETE` | `/v2/tenant/institutes/:id/unset-parent` | Remove parent link |
| `GET` | `/v2/tenant/institutes/:parentId/children` | List all children |
| `GET` | `/v2/tenant/institutes/:parentId/group-billing` | Consolidated billing |
| `GET` | `/v2/tenant/institutes/:parentId/group-credits` | Shared pool balance |
| `POST` | `/v2/tenant/institutes/:id/inherit-tier` | Enable tier inheritance |
| `POST` | `/v2/tenant/domain-routing` | Create domain routing rule |
| `GET` | `/v2/tenant/domain-routing/:domain` | Resolve domain to institute |

### 7.4 Frontend Changes

- **Institute selector**: Add parent/child grouping (accordion per parent)
- **Credits page**: Show shared pool balance, per-child usage breakdown
- **Billing page**: Show inherited tier badge; link to parent billing config
- **Admin dashboard**: New "Group Billing" section showing aggregate usage
- **Domain management**: New UI for routing rules (which child handles which path/subdomain)

---

## 8. Migration SQL

```sql
-- Run in this order (all reversible)

-- Step 1: Add parent link to institutes
ALTER TABLE institutes
  ADD COLUMN parent_institute_id BIGINT UNSIGNED NULL AFTER id,
  ADD COLUMN inherit_tier BOOLEAN NOT NULL DEFAULT FALSE AFTER tier;
ALTER TABLE institutes
  ADD INDEX idx_institutes_parent (parent_institute_id);

-- Step 2: Domain routing table
CREATE TABLE institute_domain_routing (
  id                        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  domain                    VARCHAR(255) NOT NULL,
  parent_institute_id       BIGINT UNSIGNED NOT NULL,
  default_child_institute_id BIGINT UNSIGNED NULL,
  routing_mode              ENUM('DEFAULT_CHILD','PATH_BASED','SUBDOMAIN_BASED')
                            NOT NULL DEFAULT 'DEFAULT_CHILD',
  path_prefix               VARCHAR(100) NULL COMMENT 'Used when routing_mode=PATH_BASED',
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_idr_domain (domain),
  INDEX idx_idr_parent (parent_institute_id),
  CONSTRAINT fk_idr_parent FOREIGN KEY (parent_institute_id)
    REFERENCES institutes(id) ON DELETE CASCADE,
  CONSTRAINT fk_idr_default_child FOREIGN KEY (default_child_institute_id)
    REFERENCES institutes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 3: Remove UNIQUE on customDomain (keep regular index)
ALTER TABLE institutes DROP INDEX idx_institutes_custom_domain;
ALTER TABLE institutes ADD INDEX idx_institutes_custom_domain (custom_domain);

-- Step 4: Add parent reference to credit pool
ALTER TABLE institute_credits
  ADD COLUMN parent_institute_id BIGINT UNSIGNED NULL AFTER institute_id;
ALTER TABLE institute_credits ADD INDEX idx_ic_parent (parent_institute_id);
-- NOTE: removing the UNIQUE index requires data migration first to ensure no conflicts
-- ALTER TABLE institute_credits DROP INDEX UQ_institute_credits_instituteId;

-- Step 5: Add parent reference to billing config
ALTER TABLE institute_billing_config
  ADD COLUMN parent_institute_id BIGINT UNSIGNED NULL AFTER institute_id;
ALTER TABLE institute_billing_config ADD INDEX idx_ibc_parent (parent_institute_id);

-- Step 6: Add parent reference to monthly billing summary
ALTER TABLE monthly_billing_summary
  ADD COLUMN parent_institute_id BIGINT UNSIGNED NULL AFTER institute_id;
ALTER TABLE monthly_billing_summary ADD INDEX idx_mbs_parent (parent_institute_id, billing_month);

-- Rollback script
-- ALTER TABLE institutes DROP COLUMN parent_institute_id, DROP COLUMN inherit_tier;
-- DROP TABLE institute_domain_routing;
-- ALTER TABLE institutes ADD UNIQUE INDEX idx_institutes_custom_domain (custom_domain);
-- ALTER TABLE institute_credits DROP COLUMN parent_institute_id;
-- ALTER TABLE institute_billing_config DROP COLUMN parent_institute_id;
-- ALTER TABLE monthly_billing_summary DROP COLUMN parent_institute_id;
```

---

## 9. Phase Roadmap

### Phase 1 — Foundation (Week 1–2)
- [ ] Add `parent_institute_id` to `institutes`, `institute_credits`, `institute_billing_config`, `monthly_billing_summary`
- [ ] Create `institute_domain_routing` table
- [ ] Run migration on staging; validate with `SHOW COLUMNS`
- [ ] Add `parentInstituteId` field to `InstituteEntity`, `InstituteCreditsEntity`, `InstituteBillingConfigEntity`
- [ ] Add FK relations in TypeORM entities

### Phase 2 — Service Logic (Week 2–3)
- [ ] `deductCreditsFromPool()` — follows parent chain before throwing InsufficientCreditsException
- [ ] `grantCreditsWithManager()` — detects parent and grants to shared pool
- [ ] `getEffectiveTier()` — reads `inheritTier` flag, walks up to parent tier
- [ ] `getPlanInfo()` — use `getEffectiveTier()` instead of direct tier read
- [ ] `verifyServicePayment()` — grant credits to parent pool when `parentInstituteId` set
- [ ] `getGroupBillingOverview(parentId)` — aggregate monthly summaries for group
- [ ] `DomainRoutingService` — CRUD + resolver for `institute_domain_routing`
- [ ] Update `resolveByCustomDomain()` to check routing table first

### Phase 3 — API Endpoints (Week 3)
- [ ] `POST /v2/tenant/institutes/:id/set-parent`
- [ ] `GET /v2/tenant/institutes/:parentId/children`
- [ ] `GET /v2/tenant/institutes/:parentId/group-billing`
- [ ] `GET /v2/tenant/institutes/:parentId/group-credits`
- [ ] `POST /v2/tenant/institutes/:id/inherit-tier`
- [ ] `POST /v2/tenant/domain-routing`
- [ ] `GET /v2/tenant/domain-routing/:domain`

### Phase 4 — Frontend (Week 4)
- [ ] Institute selector: group children under parent accordion
- [ ] Credits page: show shared pool balance + per-child usage bar chart
- [ ] Billing page: inherited tier badge; link to parent billing
- [ ] Group Billing dashboard page (aggregate usage, shared invoice)
- [ ] Domain routing UI (which child handles which path)

### Phase 5 — Testing & Hardening (Week 4–5)
- [ ] Race condition tests on shared pool deduction (concurrent deductions from A, B, C)
- [ ] Audit logs for cross-institute credit movements
- [ ] Alert when shared pool balance < 10% of threshold
- [ ] Integration tests: domain routing resolver

---

## 10. Summary Table

| Requirement | Supported Now | Issues | Effort to Add |
|---|---|---|---|
| Single credit pool for A + B + C | **NO** | `UNIQUE instituteId` blocks it; no pool logic | HIGH |
| One custom domain (`abc.lk`) for A + B + C | **NO** | `UNIQUE customDomain` allows only 1 owner | MEDIUM |
| Shared tier / plan | **NO** | Tier stored per-institute; no inheritance logic | MEDIUM |
| Consolidated monthly invoice | **NO** | `monthly_billing_summary` keyed per institute | MEDIUM |
| Parent admin sees all children's usage | **NO** | No aggregation endpoint or parent concept | MEDIUM |
| Child auto-deducts from parent pool | **NO** | `deductCredits()` is 1:1 with instituteId | HIGH |
| Link child institute to parent in UI | **NO** | No parent concept in frontend or API | MEDIUM |
| Payment top-up goes to shared pool | **NO** | `grantCredits` always targets paying institute | HIGH |
| Per-child usage breakdown within pool | **NO** | No child-level ledger within shared pool | MEDIUM |
| Domain routing (path/subdomain based) | **NO** | No routing table or resolver | MEDIUM |

**Total gaps: 10 / 10 requirements are unsupported.**  
**Minimum viable shared billing requires: Phase 1 + Phase 2 (≈ 3 weeks of backend work).**

---

*Generated: 2026-04-30*  
*Audited: backend `lms-api-suraksha-lk/src` + frontend `lms user frotend/src`*
