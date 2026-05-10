# Solution 01 — Shared Credit Pool for Multiple Institutes

## Problem
Institutes A, B, C each have their own isolated credit wallet.
You cannot top up once and share it across all three.

## Root Cause

### DB Constraint
```
institute_credits.institute_id  →  UNIQUE
```
`@Index('idx_ic_institute', ['instituteId'], { unique: true })` + `@Column({ unique: true })` in
`src/modules/notification-credits/entities/institute-credits.entity.ts`
forces exactly one wallet per institute. No parent concept exists.

### Service Lock is Per-Institute
```typescript
// institute-credits.service.ts — deductCreditsWithManager()
const credits = await manager.findOne(InstituteCreditsEntity, {
  where: { instituteId, isActive: true },   // ← always single institute
  lock: { mode: 'pessimistic_write' },
});
```
There is no code path that looks up a parent pool before throwing `InsufficientCreditsException`.

---

## Solution

### Step 1 — Migration: add `pool_institute_id` to `institute_credits`

```sql
-- 001_add_pool_to_credits.sql
ALTER TABLE institute_credits
  ADD COLUMN pool_institute_id BIGINT UNSIGNED NULL
    COMMENT 'If set, this row is owned by the pool master; deductions flow here'
    AFTER institute_id;

ALTER TABLE institute_credits
  ADD INDEX idx_ic_pool (pool_institute_id);

-- Remove the hard UNIQUE on institute_id (keep regular index for lookups)
-- First drop the composite index created by the entity decorator
ALTER TABLE institute_credits DROP INDEX idx_ic_institute;
ALTER TABLE institute_credits ADD INDEX idx_ic_institute (institute_id);

-- One active pool record per master institute
ALTER TABLE institute_credits
  ADD UNIQUE INDEX uk_ic_pool_active (pool_institute_id, is_active);
```

> **Rollback:**
> ```sql
> ALTER TABLE institute_credits DROP INDEX uk_ic_pool_active;
> ALTER TABLE institute_credits DROP INDEX idx_ic_pool;
> ALTER TABLE institute_credits DROP COLUMN pool_institute_id;
> ALTER TABLE institute_credits DROP INDEX idx_ic_institute;
> ALTER TABLE institute_credits ADD UNIQUE INDEX idx_ic_institute (institute_id);
> ```

---

### Step 2 — Entity: add `poolInstituteId`

**File:** `src/modules/notification-credits/entities/institute-credits.entity.ts`

```typescript
// ADD after the instituteId column:
@Column({ name: 'pool_institute_id', type: 'bigint', nullable: true })
poolInstituteId?: string;
```

Remove `{ unique: true }` from the `@Index` decorator and from the `@Column`:

```typescript
// BEFORE
@Index('idx_ic_institute', ['instituteId'], { unique: true })
...
@Column({ name: 'institute_id', type: 'bigint', unique: true })
instituteId: string;

// AFTER
@Index('idx_ic_institute', ['instituteId'])
...
@Column({ name: 'institute_id', type: 'bigint' })
instituteId: string;
```

---

### Step 3 — Service: add `resolvePoolId()` + update deduct/grant

**File:** `src/modules/notification-credits/services/institute-credits.service.ts`

Inject the institute repository:

```typescript
constructor(
  @InjectRepository(InstituteCreditsEntity)
  private readonly creditsRepository: Repository<InstituteCreditsEntity>,
  @InjectRepository(InstituteCreditTransactionEntity)
  private readonly transactionRepository: Repository<InstituteCreditTransactionEntity>,
  @InjectRepository(InstituteEntity)           // ← ADD
  private readonly instituteRepository: Repository<InstituteEntity>,
  private readonly dataSource: DataSource,
) {}
```

Add the pool resolver helper:

```typescript
/**
 * Return the institute ID that actually owns the credit balance.
 * If the institute belongs to a pool group, return the pool master's ID.
 */
private async resolvePoolId(instituteId: string): Promise<string> {
  const institute = await this.instituteRepository.findOne({
    where: { id: instituteId },
    select: ['id', 'poolMasterInstituteId'],
  });
  return institute?.poolMasterInstituteId ?? instituteId;
}

private async resolvePoolIdWithManager(
  manager: EntityManager,
  instituteId: string,
): Promise<string> {
  const institute = await manager.findOne(InstituteEntity, {
    where: { id: instituteId },
    select: ['id', 'poolMasterInstituteId'],
  });
  return institute?.poolMasterInstituteId ?? instituteId;
}
```

Update `deductCreditsWithManager` to follow the pool:

```typescript
async deductCreditsWithManager(
  manager: EntityManager,
  instituteId: string,
  dto: DeductCreditsDto,
  userId?: string,
): Promise<DeductCreditsResultDto> {
  // ── CHANGED: resolve pool master ──────────────────────────────
  const poolId = await this.resolvePoolIdWithManager(manager, instituteId);
  // ─────────────────────────────────────────────────────────────

  const credits = await manager.findOne(InstituteCreditsEntity, {
    where: { instituteId: poolId, isActive: true },  // ← use poolId
    lock: { mode: 'pessimistic_write' },
  });

  if (!credits) {
    throw new ForbiddenException(
      `No credit account found for institute ${poolId}. Please contact support.`,
    );
  }

  const balanceBefore = Number(credits.balance);
  if (balanceBefore < dto.amount) {
    throw new ForbiddenException(
      `Insufficient credits. Required: ${dto.amount}, Available: ${balanceBefore}.`,
    );
  }

  this.checkUsageLimits(credits, dto.amount);

  const timestamp = now();
  credits.balance    = Number(credits.balance)    - dto.amount;
  credits.totalUsed  = Number(credits.totalUsed)  + dto.amount;
  credits.dailyUsed  = Number(credits.dailyUsed)  + dto.amount;
  credits.monthlyUsed = Number(credits.monthlyUsed) + dto.amount;
  credits.updatedAt  = timestamp;
  await manager.save(InstituteCreditsEntity, credits);

  // Record transaction against the CHILD's instituteId so usage is traceable
  const txn = manager.create(InstituteCreditTransactionEntity, {
    instituteId,          // ← original child institute (for per-child reporting)
    poolInstituteId: poolId !== instituteId ? poolId : undefined,  // ← pool ref
    type: dto.type,
    amount: -dto.amount,
    balanceBefore,
    balanceAfter: Number(credits.balance),
    referenceType: dto.referenceType,
    referenceId:   dto.referenceId,
    description:   dto.description,
    createdBy:     userId,
    createdAt:     timestamp,
  });
  const savedTxn = await manager.save(InstituteCreditTransactionEntity, txn);

  return {
    success: true,
    creditsDeducted: dto.amount,
    balanceAfter: Number(credits.balance),
    transactionId: savedTxn.id,
  };
}
```

Update `grantCreditsWithManager` similarly:

```typescript
async grantCreditsWithManager(
  manager: EntityManager,
  instituteId: string,
  dto: GrantCreditsDto,
  userId?: string,
): Promise<GrantCreditsResultDto> {
  // Grants always go to the pool master if one exists
  const poolId = await this.resolvePoolIdWithManager(manager, instituteId);

  let credits = await manager.findOne(InstituteCreditsEntity, {
    where: { instituteId: poolId },
    lock: { mode: 'pessimistic_write' },
  });

  const timestamp  = now();
  const balanceBefore = credits ? Number(credits.balance) : 0;

  if (!credits) {
    credits = manager.create(InstituteCreditsEntity, {
      instituteId: poolId,
      balance: dto.amount,
      totalPurchased: dto.amount,
      totalUsed: 0, dailyUsed: 0, monthlyUsed: 0,
      isActive: true,
      lastTopupAmount: dto.amount,
      lastTopupAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } else {
    credits.balance        = Number(credits.balance)        + dto.amount;
    credits.totalPurchased = Number(credits.totalPurchased) + dto.amount;
    credits.lastTopupAmount = dto.amount;
    credits.lastTopupAt    = timestamp;
    credits.updatedAt      = timestamp;
  }
  await manager.save(InstituteCreditsEntity, credits);

  const txn = manager.create(InstituteCreditTransactionEntity, {
    instituteId: poolId,
    type: dto.type,
    amount: dto.amount,
    balanceBefore,
    balanceAfter: Number(credits.balance),
    referenceType: dto.referenceType,
    referenceId:   dto.referenceId,
    description:   dto.description,
    createdBy:     userId,
    createdAt:     timestamp,
  });
  const savedTxn = await manager.save(InstituteCreditTransactionEntity, txn);

  return {
    success: true,
    creditsGranted: dto.amount,
    balanceAfter: Number(credits.balance),
    transactionId: savedTxn.id,
  };
}
```

---

### Step 4 — Institute Entity: add `poolMasterInstituteId`

**File:** `src/modules/institute/entities/institute.entity.ts`

```typescript
// ADD alongside the other columns (after 'tier'):
@Column({ name: 'pool_master_institute_id', type: 'bigint', nullable: true,
  comment: 'If set, this institute shares the credit pool of the master institute' })
poolMasterInstituteId?: string;
```

Migration:
```sql
ALTER TABLE institutes
  ADD COLUMN pool_master_institute_id BIGINT UNSIGNED NULL
    COMMENT 'Shared credit pool master'
    AFTER tier;
ALTER TABLE institutes
  ADD INDEX idx_institutes_pool_master (pool_master_institute_id);
```

---

### Step 5 — New API Endpoints

**File:** `src/modules/tenant/tenant.controller.ts`

```typescript
// Link institute B under institute A's credit pool
@Patch('institutes/:childId/credit-pool/join/:masterInstituteId')
@UseGuards(SuperAdminGuard)
async joinCreditPool(
  @Param('childId') childId: string,
  @Param('masterInstituteId') masterId: string,
) {
  return this.tenantService.setPoolMaster(childId, masterId);
}

// Remove from pool (go back to isolated wallet)
@Delete('institutes/:childId/credit-pool')
@UseGuards(SuperAdminGuard)
async leaveCreditPool(@Param('childId') childId: string) {
  return this.tenantService.removeFromPool(childId);
}

// Get pool balance (master + all children's usage)
@Get('institutes/:masterId/credit-pool/balance')
@UseGuards(InstituteAdminGuard)
async getPoolBalance(@Param('masterId') masterId: string) {
  return this.tenantService.getPoolBalance(masterId);
}
```

**File:** `src/modules/tenant/tenant.service.ts`

```typescript
async setPoolMaster(childInstituteId: string, masterInstituteId: string): Promise<void> {
  if (childInstituteId === masterInstituteId) {
    throw new BadRequestException('An institute cannot be its own pool master');
  }
  // Prevent circular chains
  const master = await this.instituteRepository.findOne({ where: { id: masterInstituteId } });
  if (master?.poolMasterInstituteId) {
    throw new BadRequestException('The master institute itself belongs to another pool — chains are not supported');
  }
  await this.instituteRepository.update(childInstituteId, { poolMasterInstituteId: masterInstituteId });
}

async removeFromPool(childInstituteId: string): Promise<void> {
  await this.instituteRepository.update(childInstituteId, { poolMasterInstituteId: null });
}

async getPoolBalance(masterInstituteId: string): Promise<any> {
  const balance = await this.creditsRepository.findOne({
    where: { instituteId: masterInstituteId, isActive: true },
  });
  const children = await this.instituteRepository.find({
    where: { poolMasterInstituteId: masterInstituteId },
    select: ['id', 'name'],
  });
  return {
    masterInstituteId,
    balance: Number(balance?.balance ?? 0),
    totalPurchased: Number(balance?.totalPurchased ?? 0),
    totalUsed: Number(balance?.totalUsed ?? 0),
    childCount: children.length,
    children: children.map(c => ({ id: c.id, name: c.name })),
  };
}
```

---

### Step 6 — Transaction Entity: add `poolInstituteId`

**File:** `src/modules/notification-credits/entities/institute-credit-transaction.entity.ts`

```typescript
// ADD after instituteId:
@Column({ name: 'pool_institute_id', type: 'bigint', nullable: true,
  comment: 'Pool master when deduction was from a shared pool' })
poolInstituteId?: string;
```

Migration:
```sql
ALTER TABLE institute_credit_transactions
  ADD COLUMN pool_institute_id BIGINT UNSIGNED NULL
    COMMENT 'Pool master institute for this transaction'
    AFTER institute_id;
ALTER TABLE institute_credit_transactions
  ADD INDEX idx_ict_pool (pool_institute_id);
```

---

### Step 7 — Frontend: pool balance display

**File:** `src/api/credits.api.ts` — add new method:

```typescript
getPoolBalance: (masterInstituteId: string): Promise<{
  masterInstituteId: string;
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  childCount: number;
  children: { id: string; name: string }[];
}> => apiClient.get(`/v2/tenant/institutes/${masterInstituteId}/credit-pool/balance`),
```

**File:** `src/pages/InstituteCreditsPage.tsx` — add a "Shared Pool" banner when `selectedInstitute.poolMasterInstituteId` is set, showing pool master name and shared balance.

---

## Tests to Write

```typescript
describe('Shared Credit Pool', () => {
  it('deducts from master pool when child has no own wallet', async () => { ... });
  it('deducts from master pool when child deducts more than own balance', async () => { ... });
  it('throws when pool has insufficient credits', async () => { ... });
  it('grants credits to master pool regardless of which child submits payment', async () => { ... });
  it('prevents circular pool chain (master is already a child)', async () => { ... });
  it('concurrent deductions from two children are atomic (no negative balance)', async () => { ... });
  it('transaction record carries correct child instituteId AND poolInstituteId', async () => { ... });
});
```

---

## Summary of Changes

| File | Change |
|---|---|
| `institute_credits` table | Remove UNIQUE on `institute_id`; add `pool_institute_id` |
| `institute_credit_transactions` table | Add `pool_institute_id` |
| `institutes` table | Add `pool_master_institute_id` |
| `InstituteCreditsEntity` | Remove `unique: true`; add `poolInstituteId` |
| `InstituteCreditTransactionEntity` | Add `poolInstituteId` |
| `InstituteEntity` | Add `poolMasterInstituteId` |
| `InstituteCreditsService` | Add `resolvePoolId()`; update deduct + grant to follow pool |
| `TenantService` | Add `setPoolMaster`, `removeFromPool`, `getPoolBalance` |
| `TenantController` | 3 new endpoints |
| `credits.api.ts` | Add `getPoolBalance` |
| `InstituteCreditsPage.tsx` | Show shared pool banner |
