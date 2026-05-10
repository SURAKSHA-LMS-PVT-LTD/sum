# Solution 03 — Shared Tier / Plan Across Multiple Institutes

## Problem
Institute A = ENTERPRISE, B = FREE, C = FREE.
B and C should inherit A's plan so they get ENTERPRISE features without buying three separate plans.

## Root Cause

### Tier stored per-institute, no inheritance
```typescript
// institute.entity.ts
@Column({ type: 'enum', enum: InstituteTier, default: InstituteTier.FREE })
tier: InstituteTier;
```

### getPlanInfo reads only one institute's tier
```typescript
// tenant.service.ts — getPlanInfo()
const institute = await this.instituteRepository.findOne({ where: { id: instituteId } });
const tier = institute.tier || InstituteTier.FREE;
// ↑ Never consults a parent or pool master
```

### setSubdomain and setCustomDomain check only local tier
```typescript
// setSubdomain
if (institute.tier === InstituteTier.FREE) {
  throw new BadRequestException('Subdomain requires STARTER tier or higher');
}
// setCustomDomain
if (institute.tier !== InstituteTier.ENTERPRISE && institute.tier !== InstituteTier.ISOLATED) {
  throw new BadRequestException('Custom domains require ENTERPRISE or ISOLATED tier');
}
```
If C inherits ENTERPRISE from A, these checks still fail because they read `c.tier = FREE`.

---

## Solution

### Step 1 — Migration: add `tier_inherit` to `institutes`

```sql
-- 003_tier_inheritance.sql
ALTER TABLE institutes
  ADD COLUMN tier_inherit_from_id BIGINT UNSIGNED NULL
    COMMENT 'If set, this institute uses the tier of the referenced institute'
    AFTER tier;

ALTER TABLE institutes
  ADD INDEX idx_institutes_tier_inherit (tier_inherit_from_id);
```

> **Rollback:**
> ```sql
> ALTER TABLE institutes DROP INDEX idx_institutes_tier_inherit;
> ALTER TABLE institutes DROP COLUMN tier_inherit_from_id;
> ```

---

### Step 2 — Entity update

**File:** `src/modules/institute/entities/institute.entity.ts`

```typescript
// ADD after the 'tier' column:
@Column({ name: 'tier_inherit_from_id', type: 'bigint', nullable: true,
  comment: 'Inherit tier from this institute. Null = own tier' })
tierInheritFromId?: string;
```

---

### Step 3 — New helper: `getEffectiveTier()`

**File:** `src/modules/tenant/tenant.service.ts`

```typescript
/**
 * Return the effective tier for an institute.
 * If tierInheritFromId is set, follow the chain (one level only — no circular chains).
 */
async getEffectiveTier(instituteId: string): Promise<InstituteTier> {
  const institute = await this.instituteRepository.findOne({
    where: { id: instituteId },
    select: ['id', 'tier', 'tierInheritFromId'],
  });
  if (!institute) return InstituteTier.FREE;

  if (institute.tierInheritFromId) {
    const parent = await this.instituteRepository.findOne({
      where: { id: institute.tierInheritFromId },
      select: ['id', 'tier'],
    });
    return parent?.tier ?? InstituteTier.FREE;
  }

  return institute.tier ?? InstituteTier.FREE;
}

/**
 * Manager-scoped version for use inside transactions.
 */
async getEffectiveTierWithManager(
  manager: EntityManager,
  instituteId: string,
): Promise<InstituteTier> {
  const institute = await manager.findOne(InstituteEntity, {
    where: { id: instituteId },
    select: ['id', 'tier', 'tierInheritFromId'],
  });
  if (!institute) return InstituteTier.FREE;

  if (institute.tierInheritFromId) {
    const parent = await manager.findOne(InstituteEntity, {
      where: { id: institute.tierInheritFromId },
      select: ['id', 'tier'],
    });
    return parent?.tier ?? InstituteTier.FREE;
  }

  return institute.tier ?? InstituteTier.FREE;
}
```

---

### Step 4 — Update `getPlanInfo` to use effective tier

```typescript
// tenant.service.ts — getPlanInfo()
async getPlanInfo(instituteId: string): Promise<PlanInfoResponse> {
  const institute = await this.instituteRepository.findOne({ where: { id: instituteId } });
  if (!institute) throw new NotFoundException('Institute not found');

  // ── CHANGED: use effective tier ──────────────────────────────────────────
  const tier = await this.getEffectiveTier(instituteId);
  const isInherited = !!institute.tierInheritFromId;
  // ─────────────────────────────────────────────────────────────────────────

  const billingConfig = await this.billingConfigRepository.findOne({ where: { instituteId } });

  return {
    tier,
    isInherited,                          // ← NEW: lets frontend show "Inherited from …"
    tierInheritFromId: institute.tierInheritFromId ?? null,
    subdomain: institute.subdomain || null,
    customDomain: institute.customDomain || null,
    customDomainVerified: institute.customDomainVerified || false,
    features: {
      subdomain:      tier !== InstituteTier.FREE,
      customDomain:   tier === InstituteTier.ENTERPRISE || tier === InstituteTier.ISOLATED,
      loginBranding:  tier !== InstituteTier.FREE,
      videoBackground: tier === InstituteTier.PROFESSIONAL || tier === InstituteTier.ENTERPRISE || tier === InstituteTier.ISOLATED,
      hidePoweredBy:  tier === InstituteTier.PROFESSIONAL || tier === InstituteTier.ENTERPRISE || tier === InstituteTier.ISOLATED,
      smsMasking:     tier !== InstituteTier.FREE,
      whiteLabel:     tier === InstituteTier.ISOLATED,
    },
    billing: billingConfig ? { ... } : null,
  };
}
```

---

### Step 5 — Update feature guards to use effective tier

Replace direct `institute.tier` checks in `setSubdomain` and `setCustomDomain`:

```typescript
// setSubdomain — BEFORE
if (institute.tier === InstituteTier.FREE) { throw ... }

// setSubdomain — AFTER
const effectiveTier = await this.getEffectiveTier(instituteId);
if (effectiveTier === InstituteTier.FREE) { throw ... }

// setCustomDomain — BEFORE
if (institute.tier !== InstituteTier.ENTERPRISE && institute.tier !== InstituteTier.ISOLATED) { throw ... }

// setCustomDomain — AFTER
const effectiveTier = await this.getEffectiveTier(instituteId);
if (effectiveTier !== InstituteTier.ENTERPRISE && effectiveTier !== InstituteTier.ISOLATED) { throw ... }
```

Apply the same pattern to **every** place in `tenant.service.ts` that reads `institute.tier` for a feature gate.

---

### Step 6 — New API Endpoints

```typescript
// tenant.controller.ts

// Set tier inheritance (admin only)
@Patch('institutes/:childId/tier/inherit-from/:parentId')
@UseGuards(SuperAdminGuard)
async setTierInheritance(
  @Param('childId') childId: string,
  @Param('parentId') parentId: string,
) {
  return this.tenantService.setTierInheritance(childId, parentId);
}

// Remove inheritance (child reverts to own tier)
@Delete('institutes/:childId/tier/inheritance')
@UseGuards(SuperAdminGuard)
async removeTierInheritance(@Param('childId') childId: string) {
  return this.tenantService.removeTierInheritance(childId);
}
```

**TenantService additions:**

```typescript
async setTierInheritance(childId: string, parentId: string): Promise<void> {
  if (childId === parentId) throw new BadRequestException('Cannot inherit from self');

  // Prevent chaining: parent must have its own tier
  const parent = await this.instituteRepository.findOne({
    where: { id: parentId },
    select: ['id', 'tier', 'tierInheritFromId'],
  });
  if (!parent) throw new NotFoundException('Parent institute not found');
  if (parent.tierInheritFromId) {
    throw new BadRequestException(
      'The parent itself inherits a tier — chains longer than one level are not allowed',
    );
  }

  await this.instituteRepository.update(childId, { tierInheritFromId: parentId });
  this.logger.log(`✅ Tier inheritance: institute ${childId} → inherits tier from ${parentId}`);
}

async removeTierInheritance(childId: string): Promise<void> {
  await this.instituteRepository.update(childId, { tierInheritFromId: null });
}
```

---

### Step 7 — Frontend: show inherited tier badge

**`src/pages/InstituteBillingPage.tsx`** — in the plan card header:

```tsx
{planInfo?.isInherited && (
  <Badge variant="outline" className="text-xs ml-2">
    Inherited from {parentInstituteName}
  </Badge>
)}
```

**`src/api/tenant.api.ts`** — extend `PlanInfoResponse`:

```typescript
export interface PlanInfoResponse {
  tier: string;
  isInherited: boolean;          // ← ADD
  tierInheritFromId: string | null; // ← ADD
  // ... rest unchanged
}
```

---

## Tests to Write

```typescript
describe('Tier Inheritance', () => {
  it('child with FREE tier gets ENTERPRISE features when parent is ENTERPRISE', async () => { ... });
  it('setSubdomain succeeds for FREE child if parent is STARTER+', async () => { ... });
  it('setCustomDomain succeeds for FREE child if parent is ENTERPRISE', async () => { ... });
  it('getPlanInfo returns isInherited=true when tier is inherited', async () => { ... });
  it('prevents chain: child → parent → grandparent', async () => { ... });
  it('removeTierInheritance reverts child to own FREE tier', async () => { ... });
  it('changing parent tier updates child effective tier immediately', async () => { ... });
});
```

---

## Summary of Changes

| File | Change |
|---|---|
| `institutes` table | Add `tier_inherit_from_id BIGINT NULL` |
| `InstituteEntity` | Add `tierInheritFromId?: string` |
| `TenantService` | Add `getEffectiveTier()` + `getEffectiveTierWithManager()` |
| `TenantService.getPlanInfo` | Use `getEffectiveTier()`, return `isInherited` flag |
| `TenantService.setSubdomain` | Use `getEffectiveTier()` for tier check |
| `TenantService.setCustomDomain` | Use `getEffectiveTier()` for tier check |
| `TenantService` | Add `setTierInheritance()`, `removeTierInheritance()` |
| `TenantController` | 2 new endpoints |
| `tenant.api.ts` | Extend `PlanInfoResponse` with `isInherited`, `tierInheritFromId` |
| `InstituteBillingPage.tsx` | Show "Inherited from …" badge |
