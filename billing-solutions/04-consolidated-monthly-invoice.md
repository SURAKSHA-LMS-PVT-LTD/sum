# Solution 04 — Consolidated Monthly Invoice for a Group

## Problem
Institutes A, B, C each get a separate invoice.
The group owner wants one PDF/summary showing total fees across all three.

## Root Cause

### Unique constraint blocks group key
```typescript
// monthly-billing-summary.entity.ts
@Unique('uk_institute_month', ['instituteId', 'billingMonth'])
```
Every record is keyed by `(instituteId, billingMonth)`. There is no `parentInstituteId` column and no grouping concept.

### `getBillingOverview` returns a flat list
```typescript
// tenant.service.ts — getBillingOverview()
const institutes = await this.instituteRepository.find({ where: { isActive: true } });
// Returns one entry per institute with no parent grouping
```

---

## Solution

### Step 1 — Migration: add `group_institute_id` to `monthly_billing_summary`

```sql
-- 004_consolidated_invoice.sql
ALTER TABLE monthly_billing_summary
  ADD COLUMN group_institute_id BIGINT UNSIGNED NULL
    COMMENT 'If set, this record belongs to a billing group led by this institute'
    AFTER institute_id;

ALTER TABLE monthly_billing_summary
  ADD INDEX idx_mbs_group (group_institute_id, billing_month);

-- New: group-level summary row (one per group per month)
-- The group row has institute_id = group_institute_id and is_group_total = TRUE
ALTER TABLE monthly_billing_summary
  ADD COLUMN is_group_total BOOLEAN NOT NULL DEFAULT FALSE
    COMMENT 'TRUE for the aggregated group row, FALSE for per-institute rows';
```

> **Rollback:**
> ```sql
> ALTER TABLE monthly_billing_summary DROP COLUMN is_group_total;
> ALTER TABLE monthly_billing_summary DROP INDEX idx_mbs_group;
> ALTER TABLE monthly_billing_summary DROP COLUMN group_institute_id;
> ```

---

### Step 2 — Entity update

**File:** `src/modules/tenant/entities/monthly-billing-summary.entity.ts`

```typescript
// ADD after instituteId:
@Column({ name: 'group_institute_id', type: 'bigint', nullable: true,
  comment: 'Billing group leader. NULL = standalone institute' })
groupInstituteId?: string;

@Column({ name: 'is_group_total', type: 'boolean', default: false,
  comment: 'TRUE for the aggregated group-level row' })
isGroupTotal: boolean;
```

---

### Step 3 — New service method: `getGroupBillingOverview`

**File:** `src/modules/tenant/tenant.service.ts`

```typescript
/**
 * Return the consolidated billing overview for a group of institutes.
 * The group is defined by all institutes whose `groupInstituteId` = masterInstituteId,
 * plus the master institute itself.
 */
async getGroupBillingOverview(masterInstituteId: string, year: number, month: number) {
  const billingMonth = `${year}-${String(month).padStart(2, '0')}-01`;

  // Find all group members (master + children)
  const [master, children] = await Promise.all([
    this.instituteRepository.findOne({ where: { id: masterInstituteId } }),
    this.instituteRepository.find({
      where: { groupLeadInstituteId: masterInstituteId, isActive: true },
      select: ['id', 'name', 'shortName', 'tier', 'logoUrl'],
    }),
  ]);
  if (!master) throw new NotFoundException('Master institute not found');

  const memberIds = [masterInstituteId, ...children.map(c => c.id)];

  // Fetch per-institute billing summaries for the month
  const summaries = await this.billingSummaryRepository.find({
    where: { instituteId: In(memberIds), billingMonth: new Date(billingMonth) },
  });
  const summaryMap = new Map(summaries.map(s => [s.instituteId, s]));

  // Build per-member detail
  const members = [master, ...children].map(inst => {
    const s = summaryMap.get(inst.id);
    return {
      instituteId: inst.id,
      instituteName: inst.name,
      tier: inst.tier,
      baseFee:        Number(s?.baseFee ?? 0),
      userFee:        Number(s?.userFee ?? 0),
      loginFee:       Number(s?.loginFee ?? 0),
      smsMaskingFee:  Number(s?.smsMaskingFee ?? 0),
      totalFee:       Number(s?.totalFee ?? 0),
      status:         s?.status ?? BillingStatus.PENDING,
      totalLogins:    s?.totalLogins ?? 0,
      totalActiveUsers: s?.totalActiveUsers ?? 0,
    };
  });

  // Aggregate totals
  const groupTotal = members.reduce(
    (acc, m) => ({
      baseFee:       acc.baseFee       + m.baseFee,
      userFee:       acc.userFee       + m.userFee,
      loginFee:      acc.loginFee      + m.loginFee,
      smsMaskingFee: acc.smsMaskingFee + m.smsMaskingFee,
      totalFee:      acc.totalFee      + m.totalFee,
      totalLogins:   acc.totalLogins   + m.totalLogins,
      totalActiveUsers: acc.totalActiveUsers + m.totalActiveUsers,
    }),
    { baseFee: 0, userFee: 0, loginFee: 0, smsMaskingFee: 0,
      totalFee: 0, totalLogins: 0, totalActiveUsers: 0 },
  );

  const paidCount    = members.filter(m => m.status === BillingStatus.PAID).length;
  const pendingCount = members.length - paidCount;

  return {
    billingMonth,
    masterInstituteId,
    masterInstituteName: master.name,
    memberCount: members.length,
    paidCount,
    pendingCount,
    groupTotal,
    members,
  };
}
```

---

### Step 4 — Write and persist a group-total row

When the monthly billing job runs (cron or manual trigger), after computing per-institute rows, upsert a group-total row:

```typescript
// Called from billing calculation cron or manual trigger
async upsertGroupTotalRow(
  masterInstituteId: string,
  billingMonth: string,
  manager: EntityManager,
): Promise<void> {
  const members = await this.getGroupBillingOverview(masterInstituteId,
    parseInt(billingMonth.split('-')[0]),
    parseInt(billingMonth.split('-')[1]),
  );

  const existing = await manager.findOne(MonthlyBillingSummaryEntity, {
    where: { instituteId: masterInstituteId, billingMonth: new Date(billingMonth), isGroupTotal: true },
  });

  const row = existing ?? manager.create(MonthlyBillingSummaryEntity, {
    instituteId: masterInstituteId,
    groupInstituteId: masterInstituteId,
    billingMonth: new Date(billingMonth),
    isGroupTotal: true,
    createdAt: now(),
  });

  row.baseFee        = members.groupTotal.baseFee;
  row.userFee        = members.groupTotal.userFee;
  row.loginFee       = members.groupTotal.loginFee;
  row.smsMaskingFee  = members.groupTotal.smsMaskingFee;
  row.totalFee       = members.groupTotal.totalFee;
  row.totalLogins    = members.groupTotal.totalLogins;
  row.totalActiveUsers = members.groupTotal.totalActiveUsers;
  row.status         = members.paidCount === members.memberCount
    ? BillingStatus.PAID : BillingStatus.PENDING;
  row.updatedAt = now();

  await manager.save(MonthlyBillingSummaryEntity, row);
}
```

---

### Step 5 — Add `groupLeadInstituteId` to `InstituteEntity`

**File:** `src/modules/institute/entities/institute.entity.ts`

```typescript
@Column({ name: 'group_lead_institute_id', type: 'bigint', nullable: true,
  comment: 'Billing group leader for consolidated invoicing' })
groupLeadInstituteId?: string;
```

Migration:
```sql
ALTER TABLE institutes
  ADD COLUMN group_lead_institute_id BIGINT UNSIGNED NULL
    COMMENT 'Billing group leader for consolidated invoicing'
    AFTER pool_master_institute_id;
ALTER TABLE institutes
  ADD INDEX idx_institutes_group_lead (group_lead_institute_id);
```

---

### Step 6 — New API Endpoints

```typescript
// tenant.controller.ts

// Get consolidated invoice for a group
@Get('institutes/:masterId/group-billing/:year/:month')
@UseGuards(InstituteAdminGuard)
getGroupBillingOverview(
  @Param('masterId') masterId: string,
  @Param('year', ParseIntPipe) year: number,
  @Param('month', ParseIntPipe) month: number,
) {
  return this.tenantService.getGroupBillingOverview(masterId, year, month);
}

// Assign institute to a billing group
@Patch('institutes/:childId/billing-group/join/:masterId')
@UseGuards(SuperAdminGuard)
joinBillingGroup(
  @Param('childId') childId: string,
  @Param('masterId') masterId: string,
) {
  return this.tenantService.joinBillingGroup(childId, masterId);
}

// Remove from billing group
@Delete('institutes/:childId/billing-group')
@UseGuards(SuperAdminGuard)
leaveBillingGroup(@Param('childId') childId: string) {
  return this.tenantService.leaveBillingGroup(childId);
}
```

---

### Step 7 — Frontend

**`src/api/tenant.api.ts`** — add:

```typescript
getGroupBillingOverview: (masterInstituteId: string, year: number, month: number) =>
  apiClient.get(`/v2/tenant/institutes/${masterInstituteId}/group-billing/${year}/${month}`),
```

**New page: `src/pages/GroupBillingPage.tsx`**
- A table showing each member institute's monthly fees
- A summary row at the bottom showing group totals
- Export to PDF button (uses `window.print()` on a printable div)
- Status badges per institute (PAID / PENDING / OVERDUE)

**`InstituteBillingPage.tsx`** — when `planInfo.groupLeadInstituteId` is set:
- Show "Part of billing group" banner with link to group invoice

---

## Tests to Write

```typescript
describe('Consolidated Invoice', () => {
  it('getGroupBillingOverview sums fees for master + all children', async () => { ... });
  it('paidCount reflects only institutes with PAID status', async () => { ... });
  it('upsertGroupTotalRow creates group row correctly', async () => { ... });
  it('upsertGroupTotalRow updates existing group row on re-run', async () => { ... });
  it('member not in billing group returns empty groupInstituteId', async () => { ... });
});
```

---

## Summary of Changes

| File | Change |
|---|---|
| `monthly_billing_summary` table | Add `group_institute_id`, `is_group_total` |
| `institutes` table | Add `group_lead_institute_id` |
| `MonthlyBillingSummaryEntity` | Add `groupInstituteId`, `isGroupTotal` |
| `InstituteEntity` | Add `groupLeadInstituteId` |
| `TenantService` | Add `getGroupBillingOverview()`, `upsertGroupTotalRow()`, `joinBillingGroup()`, `leaveBillingGroup()` |
| `TenantController` | 3 new endpoints |
| `tenant.api.ts` | Add `getGroupBillingOverview` |
| New `GroupBillingPage.tsx` | Consolidated invoice UI |
| `InstituteBillingPage.tsx` | Group membership banner |
