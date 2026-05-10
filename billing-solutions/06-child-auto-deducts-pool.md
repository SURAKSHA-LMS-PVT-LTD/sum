# Solution 06 — Child Institute Auto-Deducts from Parent Pool

## Problem
When Institute B sends an SMS, it deducts from B's own wallet (which may be empty).
It should silently fall back to the shared pool at Institute A.

## Root Cause

### `deductCreditsWithManager` — no pool fallback
```typescript
// institute-credits.service.ts
const credits = await manager.findOne(InstituteCreditsEntity, {
  where: { instituteId, isActive: true },   // ← only B's wallet
  lock: { mode: 'pessimistic_write' },
});
if (!credits) {
  throw new ForbiddenException(`No credit account found for institute ${instituteId}`);
}
const balanceBefore = Number(credits.balance);
if (balanceBefore < dto.amount) {
  throw new ForbiddenException(`Insufficient credits...`);
}
```
When B has no wallet or zero balance, it throws immediately.
There is no code that checks a pool master.

### `deductCreditsAtomic` — fire-and-forget, also per-institute
```typescript
await this.creditsRepository
  .createQueryBuilder()
  .update(InstituteCreditsEntity)
  .set({ balance: () => `GREATEST(balance - :amt, 0)`, ... })
  .where('institute_id = :instituteId AND is_active = true', { instituteId })
  .execute();
```
Again, only targets the child's own row.

---

## Solution

### Step 1 — Prerequisite
Requires `pool_master_institute_id` on `institutes` (Solution 01, Step 4)
and the `resolvePoolId()` helper (Solution 01, Step 3).

---

### Step 2 — Update `deductCreditsWithManager` with tiered fallback

**File:** `src/modules/notification-credits/services/institute-credits.service.ts`

```typescript
async deductCreditsWithManager(
  manager: EntityManager,
  instituteId: string,
  dto: DeductCreditsDto,
  userId?: string,
): Promise<DeductCreditsResultDto> {
  // ── Step 1: resolve pool master ───────────────────────────────────────────
  const poolId = await this.resolvePoolIdWithManager(manager, instituteId);
  const isPooled = poolId !== instituteId;
  // ─────────────────────────────────────────────────────────────────────────

  // ── Step 2: try child's own wallet first (only when NOT using shared pool)
  //    When pooled, skip child wallet entirely — pool master is the only wallet
  let targetWalletId = poolId;  // default: always use pool master
  
  if (!isPooled) {
    // Standalone institute: check own wallet only
    targetWalletId = instituteId;
  }
  // If pooled, targetWalletId = poolId (master's wallet)

  // ── Step 3: lock and read the target wallet ───────────────────────────────
  const credits = await manager.findOne(InstituteCreditsEntity, {
    where: { instituteId: targetWalletId, isActive: true },
    lock: { mode: 'pessimistic_write' },
  });

  if (!credits) {
    throw new ForbiddenException(
      isPooled
        ? `Shared pool for institute ${poolId} has no credit account. Contact support.`
        : `No credit account for institute ${instituteId}. Contact support.`,
    );
  }

  const balanceBefore = Number(credits.balance);
  if (balanceBefore < dto.amount) {
    throw new ForbiddenException(
      `Insufficient credits. Required: ${dto.amount}, Available: ${balanceBefore}. ` +
      (isPooled ? `(Shared pool: ${poolId})` : 'Please top up.'),
    );
  }

  this.checkUsageLimits(credits, dto.amount);

  // ── Step 4: deduct ────────────────────────────────────────────────────────
  const timestamp = now();
  credits.balance     = Number(credits.balance)     - dto.amount;
  credits.totalUsed   = Number(credits.totalUsed)   + dto.amount;
  credits.dailyUsed   = Number(credits.dailyUsed)   + dto.amount;
  credits.monthlyUsed = Number(credits.monthlyUsed) + dto.amount;
  credits.updatedAt   = timestamp;
  await manager.save(InstituteCreditsEntity, credits);

  // ── Step 5: record transaction ───────────────────────────────────────────
  //    instituteId = originating child (for per-child ledger)
  //    poolInstituteId = pool master (for pool-level reporting)
  const txn = manager.create(InstituteCreditTransactionEntity, {
    instituteId,                                           // always the child
    poolInstituteId: isPooled ? poolId : undefined,        // pool master if pooled
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

  this.logger.log(
    `💳 Deducted: child=${instituteId} pool=${poolId} amount=${dto.amount} ` +
    `newBalance=${credits.balance}`,
  );

  return {
    success: true,
    creditsDeducted: dto.amount,
    balanceAfter:    Number(credits.balance),
    transactionId:   savedTxn.id,
  };
}
```

---

### Step 3 — Update `deductCreditsAtomic` with pool resolution

```typescript
async deductCreditsAtomic(instituteId: string, amount: number): Promise<void> {
  if (!amount || amount <= 0) {
    this.logger.error(`❌ Invalid atomic deduction: ${amount} for ${instituteId}`);
    return;
  }

  // ── Resolve pool master ──────────────────────────────────────────────────
  const poolId = await this.resolvePoolId(instituteId);
  // ────────────────────────────────────────────────────────────────────────

  const safeAmount = Math.abs(Number(amount));

  // Atomic UPDATE on the pool master's wallet
  const result = await this.creditsRepository
    .createQueryBuilder()
    .update(InstituteCreditsEntity)
    .set({
      balance:      () => `GREATEST(balance - :amt, 0)`,
      totalUsed:    () => `total_used + :amt`,
      dailyUsed:    () => `daily_used + :amt`,
      monthlyUsed:  () => `monthly_used + :amt`,
      updatedAt:    now(),
    })
    .where('institute_id = :poolId AND is_active = true', { poolId })   // ← poolId
    .setParameter('amt', safeAmount)
    .execute();

  if (result.affected === 0) {
    this.logger.error(
      `❌ Atomic deduction failed: pool=${poolId} child=${instituteId} amount=${amount}`,
    );
  }
}
```

---

### Step 4 — Update `validateSufficientCredits` and `hasSufficientCredits`

```typescript
async hasSufficientCredits(instituteId: string, required: number): Promise<boolean> {
  const poolId = await this.resolvePoolId(instituteId);  // ← ADD
  const credits = await this.creditsRepository.findOne({
    where: { instituteId: poolId, isActive: true },      // ← use poolId
    select: ['balance'],
  });
  return credits ? Number(credits.balance) >= required : false;
}

async validateSufficientCredits(instituteId: string, required: number): Promise<void> {
  const poolId = await this.resolvePoolId(instituteId);  // ← ADD
  const credits = await this.creditsRepository.findOne({
    where: { instituteId: poolId, isActive: true },      // ← use poolId
    select: ['balance'],
  });
  const available = credits ? Number(credits.balance) : 0;
  if (available < required) {
    throw new ForbiddenException(
      `Insufficient credits. Required: ${required}, Available: ${available}.`,
    );
  }
}
```

---

### Step 5 — Update `getBalance` to show pool info

```typescript
async getBalance(instituteId: string): Promise<CreditBalanceResponseDto> {
  const poolId = await this.resolvePoolId(instituteId);
  const isPooled = poolId !== instituteId;

  const credits = await this.getOrCreateCredits(poolId);  // ← use poolId

  return {
    instituteId: credits.instituteId,
    balance:        Number(credits.balance),
    totalPurchased: Number(credits.totalPurchased),
    totalUsed:      Number(credits.totalUsed),
    dailyUsed:      Number(credits.dailyUsed),
    monthlyUsed:    Number(credits.monthlyUsed),
    dailyLimit:     credits.dailyLimit  ? Number(credits.dailyLimit)  : undefined,
    monthlyLimit:   credits.monthlyLimit ? Number(credits.monthlyLimit) : undefined,
    isActive:       credits.isActive,
    // ── NEW: pool metadata ────────────────────────────────────────────────
    isSharedPool:   isPooled,
    poolMasterInstituteId: isPooled ? poolId : undefined,
  };
}
```

---

### Step 6 — Frontend: show pool balance in credits page

**`src/api/credits.api.ts`** — extend `CreditBalance`:

```typescript
export interface CreditBalance {
  instituteId: string;
  balance: number;
  // ... existing fields ...
  isSharedPool: boolean;                  // ← ADD
  poolMasterInstituteId?: string;        // ← ADD
}
```

**`src/pages/InstituteCreditsPage.tsx`** — show pool source when `isSharedPool = true`:

```tsx
{balance?.isSharedPool && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
    <Share2 className="h-4 w-4" />
    <span>Balance is from shared pool (master institute)</span>
  </div>
)}
```

---

## Tests to Write

```typescript
describe('Auto pool deduction', () => {
  it('child with own wallet deducts from own wallet', async () => { ... });
  it('child in pool deducts from pool master wallet', async () => { ... });
  it('child in pool records transaction with correct instituteId + poolInstituteId', async () => { ... });
  it('throws when pool master has insufficient balance', async () => { ... });
  it('two children deducting concurrently use pessimistic lock correctly', async () => { ... });
  it('atomic deduction targets pool master row', async () => { ... });
  it('hasSufficientCredits checks pool master balance', async () => { ... });
  it('getBalance returns isSharedPool=true for pool child', async () => { ... });
});
```

---

## Summary of Changes

| File | Change |
|---|---|
| `InstituteCreditsService.deductCreditsWithManager` | Resolve pool master; deduct from pool |
| `InstituteCreditsService.deductCreditsAtomic` | Resolve pool master; target pool wallet |
| `InstituteCreditsService.hasSufficientCredits` | Check pool master balance |
| `InstituteCreditsService.validateSufficientCredits` | Check pool master balance |
| `InstituteCreditsService.getBalance` | Return pool master balance + `isSharedPool` flag |
| `credits.api.ts` | Extend `CreditBalance` with `isSharedPool`, `poolMasterInstituteId` |
| `InstituteCreditsPage.tsx` | Show pool source banner |
