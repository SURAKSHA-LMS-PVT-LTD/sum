# Suraksha LMS — Full Implementation Reference

## Overview

This document covers three major feature areas implemented across the backend (NestJS/TypeORM) and frontend (React/TypeScript):

1. **Dual Enrollment Methods** — Subject enrollment supports independent "By Key" and "By Payment" modes
2. **Class-Level Payment Gate** — Critical repository bug fix; payment-gated enrollment now checks the correct table
3. **Class Payment Matrix View** — Multi-payment × multi-student status grid in `ClassPayments.tsx`

---

## 1. Dual Enrollment Methods

### Problem

The original enrollment system had a single `enrollmentEnabled` boolean. This prevented offering two independent modes: enrollment-by-key and enrollment-by-payment simultaneously.

### Solution

Decompose into two independent booleans: `keyEnabled` and `payMethodEnabled`, with `enrollmentEnabled = keyEnabled || payMethodEnabled`.

---

### 1.1 Backend — `institute_class_subject_students.service.ts`

**File:** `lms-api-suraksha-lk/src/modules/institute_class_subject_modules/institute_class_subject_students/institute_class_subject_students.service.ts`

#### Key validation logic (self-enroll)

```typescript
// Determine effective method
const keyEnabled = !!classSubject.enrollmentKey;
const payMethodEnabled = !!classSubject.enrollmentPaymentRefId;

if (keyEnabled && enrollmentKey) {
  // Validate supplied key
  if (enrollmentKey !== classSubject.enrollmentKey) {
    throw new BadRequestException('Invalid enrollment key.');
  }
  // Key is valid — student can enroll immediately
} else if (payMethodEnabled && !enrollmentKey) {
  // Payment-gate path — no key required; payment check handled below
} else if (!keyEnabled && !payMethodEnabled) {
  throw new BadRequestException('Enrollment is not configured for this subject.');
} else if (keyEnabled && !enrollmentKey && !payMethodEnabled) {
  throw new BadRequestException('Enrollment key is required for this subject.');
}
```

#### Settings update

```typescript
// PATCH /enrollment-settings/:instituteId/:classId/:subjectId
const body = {
  enrollmentEnabled: keyEnabled || payMethodEnabled,   // true if either is on
  enrollmentKey:     keyEnabled ? key : null,          // null clears the key
  enrollmentPaymentRefId: payMethodEnabled ? paymentRefId : null,
  enrollmentPaymentStatuses: payMethodEnabled ? allowedStatuses : [],
};
```

---

### 1.2 Backend — `self-enroll.dto.ts`

**File:** `lms-api-suraksha-lk/src/modules/institute_class_subject_modules/institute_class_subject_students/dto/self-enroll.dto.ts`

```typescript
export class SelfEnrollDto {
  @IsOptional()          // was @IsNotEmpty() — breaks payment-only enrollment
  @IsString()
  enrollmentKey?: string;

  @IsOptional()
  @IsString()
  instituteId?: string;

  @IsOptional()
  @IsString()
  classId?: string;
}

export class SelfEnrollResponseDto {
  // ... existing fields ...

  @IsOptional()
  enrollmentPaymentTitle?: string;     // Payment gate title

  @IsOptional()
  enrollmentPaymentAmount?: number;    // Payment gate amount

  @IsOptional()
  enrollmentPaymentDueDate?: string;   // ISO date string
}
```

---

### 1.3 Backend — Module Registration (Critical Fix)

**File:** `lms-api-suraksha-lk/src/modules/institute_class_subject_modules/institute_class_subject_students/institute_class_subject_students.module.ts`

```typescript
import { InstituteClassPayment } from '../../payment/entities/institute-class-payment.entity';
import { InstituteClassPaymentSubmission } from '../../payment/entities/institute-class-payment-submission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InstituteClassSubjectStudent,
      InstituteClassSubjectPaymentSubmission,   // subject-level (existing)
      InstituteClassPayment,                    // ← NEW: class-level payment entity
      InstituteClassPaymentSubmission,          // ← NEW: class-level submission entity
    ]),
  ],
  // ...
})
```

Without registering `InstituteClassPayment` and `InstituteClassPaymentSubmission`, NestJS cannot inject their repositories and the payment gate check throws at runtime.

---

### 1.4 Backend — Payment Gate Check (Critical Bug Fix)

**File:** `institute_class_subject_students.service.ts`

#### Before (broken)

```typescript
// submissionRepository is InstituteClassSubjectPaymentSubmission
// → table: institute_class_subject_payment_submissions
// But enrollmentPaymentRefId references institute_class_payments (class-level)!
const submission = await this.submissionRepository.findOne({
  where: { paymentId: classSubject.enrollmentPaymentRefId, userId: studentId },
});
```

#### After (fixed)

```typescript
// Inject class-level repositories in constructor:
// @InjectRepository(InstituteClassPayment)
// private readonly classPaymentRepository: Repository<InstituteClassPayment>,
// @InjectRepository(InstituteClassPaymentSubmission)
// private readonly classPaymentSubmissionRepository: Repository<InstituteClassPaymentSubmission>,

let gatedPaymentRecord: InstituteClassPayment | null = null;
if (!isClassFreeCard && classSubject.enrollmentPaymentRefId) {
  const submission = await this.classPaymentSubmissionRepository.findOne({
    where: {
      paymentId: classSubject.enrollmentPaymentRefId,
      userId: studentId,
    },
  });
  const allowedStatuses = classSubject.enrollmentPaymentStatuses ?? ['VERIFIED'];
  if (submission && allowedStatuses.includes(submission.status)) {
    hasValidPayment = true;
  }
  // Also load the payment record for title/amount/due date to return to the client
  gatedPaymentRecord = await this.classPaymentRepository.findOne({
    where: { id: classSubject.enrollmentPaymentRefId },
  });
}

// In the return object:
return {
  // ...existing fields...
  enrollmentPaymentId:       classSubject.enrollmentPaymentRefId ?? undefined,
  enrollmentPaymentTitle:    gatedPaymentRecord?.title ?? undefined,
  enrollmentPaymentAmount:   gatedPaymentRecord?.amount ? Number(gatedPaymentRecord.amount) : undefined,
  enrollmentPaymentDueDate:  gatedPaymentRecord?.lastDate
                               ? new Date(gatedPaymentRecord.lastDate).toISOString()
                               : undefined,
};
```

---

## 2. Frontend — Enrollment API (`enrollment.api.ts`)

**File:** `lms user frotend/src/api/enrollment.api.ts`

### Updated `SelfEnrollResponse`

```typescript
export interface SelfEnrollResponse {
  message: string;
  instituteId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  className: string;
  enrollmentMethod: string;
  verificationStatus: 'verified' | 'pending' | 'rejected' | 'pending_payment' | 'payment_rejected' | 'enrolled_free_card';
  enrolledAt: string;
  paymentRequired?: boolean;
  feeAmount?: number;
  enrollmentPaymentId?: string;
  studentType?: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid';

  // Class-level payment gate details
  enrollmentPaymentTitle?: string;
  enrollmentPaymentAmount?: number;
  enrollmentPaymentDueDate?: string;
}
```

### Updated `selfEnroll()`

```typescript
async selfEnroll(
  enrollmentKey: string | undefined,
  params?: EnrollmentQueryParams
): Promise<SelfEnrollResponse> {
  const body: Record<string, any> = {};
  if (enrollmentKey) body.enrollmentKey = enrollmentKey;  // omit if undefined
  if (params?.instituteId) body.instituteId = params.instituteId;
  if (params?.classId)     body.classId     = params.classId;
  // ...
}
```

---

## 3. Frontend — `SelfEnrollmentForm.tsx`

**File:** `lms user frotend/src/components/enrollment/SelfEnrollmentForm.tsx`

### Enrollment key is optional

```tsx
<Input
  id="enrollmentKey"
  type="text"
  placeholder="Enter enrollment key (e.g., MATH-ABC123)"
  {...register('enrollmentKey', {
    maxLength: { value: 50, message: 'Key must not exceed 50 characters' },
    // No required validation — payment-only subjects don't use a key
  })}
/>
<p className="text-xs text-muted-foreground">
  Leave blank if your teacher uses payment-based enrollment.
</p>
```

### Payment-gated vs fee-based routing

```typescript
// Payment gate: has enrollmentPaymentId but no direct feeAmount
const isPaymentGated = !!enrollmentResult?.enrollmentPaymentId && !enrollmentResult?.feeAmount;
// Fee-based: old-style with feeAmount
const isFeeEnrollment = !isPaymentGated && !!enrollmentResult?.feeAmount;

const navigateToClassPayments = () => {
  const url = buildSidebarUrl('class-payments', {
    instituteId: enrollmentResult!.instituteId,
    classId:     enrollmentResult!.classId,
  });
  navigate(url);
};

const navigateToInstitutePayments = () => {
  const url = buildSidebarUrl('institute-payments', {
    instituteId: enrollmentResult?.instituteId ?? selectedInstitute?.id,
  });
  navigate(url);
};
```

### Payment-gated pending card (shows specific payment details)

```tsx
{enrollmentResult.verificationStatus === 'pending_payment' && isPaymentGated && !claimDone && (
  <div className="rounded-lg border border-orange-200 bg-orange-50 ... p-4 space-y-3">
    <div className="flex items-start gap-2">
      <CreditCard className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-orange-800">Class Payment Required</p>
        <p className="text-xs text-orange-700 mt-0.5">
          Submit the following payment to activate your enrollment:
        </p>
      </div>
    </div>

    <div className="bg-white/60 ... rounded-lg border ... p-3 space-y-2">
      {enrollmentResult.enrollmentPaymentTitle && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Payment</span>
          <span className="font-semibold">{enrollmentResult.enrollmentPaymentTitle}</span>
        </div>
      )}
      {enrollmentResult.enrollmentPaymentAmount != null && (
        <div className="flex justify-between text-sm items-center">
          <span className="text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" />Amount
          </span>
          <span className="font-bold text-orange-700">
            Rs {enrollmentResult.enrollmentPaymentAmount.toLocaleString()}
          </span>
        </div>
      )}
      {enrollmentResult.enrollmentPaymentDueDate && (
        <div className="flex justify-between text-sm items-center">
          <span className="text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />Due Date
          </span>
          <span className={
            new Date(enrollmentResult.enrollmentPaymentDueDate) < new Date()
              ? 'text-red-600 font-medium'
              : ''
          }>
            {new Date(enrollmentResult.enrollmentPaymentDueDate).toLocaleDateString()}
          </span>
        </div>
      )}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Button className="w-full gap-2" onClick={navigateToClassPayments}>
        <CreditCard className="h-4 w-4" />Pay Now <ArrowRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        className="w-full border-purple-300 text-purple-700 ..."
        onClick={handleClaimFreeCard}
        disabled={isClaiming}
      >
        {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
        {isClaiming ? 'Claiming…' : 'Claim Free Card'}
      </Button>
    </div>
  </div>
)}
```

---

## 4. Frontend — `TeacherEnrollmentManager.tsx`

**File:** `lms user frotend/src/components/enrollment/TeacherEnrollmentManager.tsx`

### Replace subject-level payments with class-level

```typescript
// BEFORE (wrong)
import { subjectPaymentsApi } from '@/api/subjectPayments.api';
const payments = await subjectPaymentsApi.getPaymentsByClass(instituteId, classId);

// AFTER (correct)
import { classPaymentsApi } from '@/api/classPayments.api';
const payments = await classPaymentsApi.getClassPayments(instituteId, classId, 1, 100);
```

### Dual method settings UI structure

```tsx
{/* Settings Tab */}

{/* ── Method 1: By Enrollment Key ── */}
<div className="rounded-lg border p-4 space-y-3">
  <div className="flex items-center justify-between">
    <div>
      <p className="font-medium text-sm">Method 1 — By Enrollment Key</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        Students enter a key you set to self-enroll
      </p>
    </div>
    <Switch
      checked={keyMethodEnabled}
      onCheckedChange={setKeyMethodEnabled}
    />
  </div>
  {keyMethodEnabled && (
    <div className="space-y-2">
      <Label>Enrollment Key</Label>
      <Input
        value={enrollmentKey}
        onChange={e => setEnrollmentKey(e.target.value)}
        placeholder="e.g., MATH-2024-A"
      />
    </div>
  )}
</div>

{/* ── Method 2: By Class Payment ── */}
<div className="rounded-lg border p-4 space-y-3">
  <div className="flex items-center justify-between">
    <div>
      <p className="font-medium text-sm">Method 2 — By Class Payment</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        Students must submit a specific class payment to enroll
      </p>
    </div>
    <Switch
      checked={payMethodEnabled}
      onCheckedChange={setPayMethodEnabled}
    />
  </div>
  {payMethodEnabled && (
    <>
      {/* Payment selector dropdown */}
      <Select value={selectedPaymentId} onValueChange={setSelectedPaymentId}>
        <SelectTrigger>
          <SelectValue placeholder="Select a class payment..." />
        </SelectTrigger>
        <SelectContent>
          {classPayments.map(p => (
            <SelectItem key={p.id} value={p.id}>
              {p.title} — Rs {Number(p.amount).toLocaleString()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Allowed payment tiers */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Accepted Payment Tiers</Label>
        {['VERIFIED', 'HALF_VERIFIED', 'QUARTER_VERIFIED'].map(tier => (
          <div key={tier} className="flex items-center gap-2">
            <Checkbox
              id={tier}
              checked={allowedStatuses.includes(tier)}
              onCheckedChange={checked => {
                setAllowedStatuses(prev =>
                  checked ? [...prev, tier] : prev.filter(s => s !== tier)
                );
              }}
            />
            <Label htmlFor={tier} className="text-sm font-normal">
              {tier.replace('_', ' ')}
            </Label>
          </div>
        ))}
      </div>
    </>
  )}
</div>

{/* Save */}
<Button onClick={saveEnrollmentConfig} disabled={saving}>
  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
  Save Enrollment Settings
</Button>
```

### `saveEnrollmentConfig` payload

```typescript
const saveEnrollmentConfig = async () => {
  await enrollmentApi.updateEnrollmentSettings(
    instituteId, classId, subjectId,
    keyMethodEnabled || payMethodEnabled,   // enrollmentEnabled
    keyMethodEnabled ? enrollmentKey : undefined,
    { userId: user?.id, role: instituteRole },
    {
      enrollmentPaymentRefId: payMethodEnabled ? selectedPaymentId : undefined,
      enrollmentPaymentStatuses: payMethodEnabled ? allowedStatuses : [],
    },
  );
};
```

---

## 5. Frontend — `AssignSubjectToClassForm.tsx`

**File:** `lms user frotend/src/components/forms/AssignSubjectToClassForm.tsx`

### `SubjectEnrollment` interface

```typescript
interface SubjectEnrollment {
  keyEnabled: boolean;
  key: string;
  payMethodEnabled: boolean;
  paymentRefId: string;
  allowedStatuses: string[];
}
```

### Per-subject dual switches

Each subject card renders two independent toggle sections:

```tsx
{/* Subject enrollment config */}
<div className="space-y-3 mt-3">
  {/* By Key */}
  <div className="rounded-lg border p-3 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">By Enrollment Key</span>
      <Switch
        checked={enrollment.keyEnabled}
        onCheckedChange={v => updateEnrollment(subjectId, 'keyEnabled', v)}
      />
    </div>
    {enrollment.keyEnabled && (
      <Input
        placeholder="Enrollment key"
        value={enrollment.key}
        onChange={e => updateEnrollment(subjectId, 'key', e.target.value)}
      />
    )}
  </div>

  <Separator />

  {/* By Payment */}
  <div className="rounded-lg border p-3 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium">By Class Payment</span>
      <Switch
        checked={enrollment.payMethodEnabled}
        onCheckedChange={v => updateEnrollment(subjectId, 'payMethodEnabled', v)}
      />
    </div>
    {enrollment.payMethodEnabled && (
      <>
        <Select
          value={enrollment.paymentRefId}
          onValueChange={v => updateEnrollment(subjectId, 'paymentRefId', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select payment..." />
          </SelectTrigger>
          <SelectContent>
            {classPayments.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.title} — Rs {Number(p.amount).toLocaleString()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tier checkboxes */}
        <div className="flex flex-wrap gap-2 mt-2">
          {['VERIFIED', 'HALF_VERIFIED', 'QUARTER_VERIFIED'].map(tier => (
            <label key={tier} className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox
                checked={enrollment.allowedStatuses.includes(tier)}
                onCheckedChange={checked => {
                  const next = checked
                    ? [...enrollment.allowedStatuses, tier]
                    : enrollment.allowedStatuses.filter(s => s !== tier);
                  updateEnrollment(subjectId, 'allowedStatuses', next);
                }}
              />
              {tier.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </>
    )}
  </div>
</div>
```

### Payload construction

```typescript
const buildEnrollmentPayload = (enrollment: SubjectEnrollment) => ({
  enrollmentEnabled: enrollment.keyEnabled || enrollment.payMethodEnabled,
  enrollmentKey:     enrollment.keyEnabled ? enrollment.key || undefined : undefined,
  enrollmentFeeRequired: false,
  enrollmentPaymentRefId:    enrollment.payMethodEnabled ? enrollment.paymentRefId || undefined : undefined,
  enrollmentPaymentStatuses: enrollment.payMethodEnabled ? enrollment.allowedStatuses : [],
});
```

### Layout fixes

Removed constraints that caused cramped/unscrollable UI:
- Removed `max-h-[80vh] overflow-hidden flex flex-col` from outer container
- Removed `<ScrollArea className="max-h-48">` wrapping enrollment settings
- Footer is `sticky bottom-0 bg-background pt-3 border-t`
- Dialog itself handles scrolling via `max-h-[90vh] overflow-y-auto`

---

## 6. Frontend — `AppContent.tsx` & Routing

**File:** `lms user frotend/src/components/AppContent.tsx`

```typescript
// Lazy import
const ClassPayments = React.lazy(() => import('@/pages/ClassPayments'));

// In each role section (Student, Parent, Teacher, InstituteAdmin):
case 'class-payments':
  return <ClassPayments />;

// Prevent redirect when no subject selected:
const pagesWithoutClassRequirement = [
  // ... existing ...
  'class-payments',
];
```

**File:** `lms user frotend/src/utils/pageNavigation.ts`

```typescript
const classScopedPages = new Set([
  // ... existing pages ...
  'class-payments',   // URL is /class-payments?instituteId=X&classId=Y (no subjectId)
]);
```

**File:** `lms user frotend/src/components/layout/Sidebar.tsx`

```typescript
// Already present for Student, Teacher, InstituteAdmin:
{ id: 'class-payments', label: 'Class Fees', icon: Banknote }
```

---

## 7. Frontend — Class Payment Matrix View

### New file: `ClassPaymentMatrix.tsx`

**File:** `lms user frotend/src/components/payments/ClassPaymentMatrix.tsx`

#### Architecture

```
ClassPaymentMatrix
  ├── Payment multi-select (pill chips, Select All / Clear / Refresh)
  ├── Student search input + counts badge
  ├── Scrollable matrix table
  │     ├── Sticky header row (corner + payment columns with mini-stats)
  │     ├── Sticky first column (student names)
  │     └── Status cells (color-coded badges)
  └── Legend row
```

#### Props

```typescript
interface ClassPaymentMatrixProps {
  payments: ClassPayment[];    // All loaded payments for this class
  instituteId: string;
  classId: string;
}
```

#### Data loading strategy

```typescript
const loadData = async () => {
  // 1. Fetch ALL submissions for this class in one call (limit 1000)
  const subsRes = await classPaymentsApi.getAllSubmissions(
    instituteId, classId, { limit: 1000 }
  );
  setAllSubmissions(subsRes.data);

  // 2. Union students from ALL payments in parallel
  //    (getStudentsForPayment returns enrolled students per payment target)
  const results = await Promise.allSettled(
    payments.map(p =>
      classPaymentsApi.getStudentsForPayment(instituteId, classId, p.id)
    )
  );
  const studentMap = new Map<string, MatrixStudent>();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const list = Array.isArray(result.value) ? result.value : (result.value?.data ?? []);
    for (const s of list) {
      const id = s.userId || s.id;
      if (id && !studentMap.has(id)) {
        studentMap.set(id, { userId: id, username: s.username || s.name || s.email || id });
      }
    }
  }
  setStudents([...studentMap.values()].sort((a, b) => a.username.localeCompare(b.username)));
};
```

> **Why this works for frontend-only filtering:** Loading all submissions once and all students once means payment selection changes are pure JS (no API calls). `submissionMap` and `paymentStats` recompute instantly via `useMemo`.

#### Status deduplication

A student may have multiple submissions for one payment (resubmissions). We keep the highest-priority status:

```typescript
const STATUS_PRIORITY: Record<string, number> = {
  VERIFIED: 5, HALF_VERIFIED: 4, QUARTER_VERIFIED: 3, PENDING: 2, REJECTED: 1,
};

// In useMemo:
const newPri = STATUS_PRIORITY[sub.status] ?? 0;
const oldPri = existing ? (STATUS_PRIORITY[existing] ?? 0) : -1;
if (newPri > oldPri) byPayment.set(sub.paymentId, sub.status);
```

#### Column header mini-stats

Each payment column header shows aggregated counts for quick scanning:

```tsx
<div className="flex justify-center gap-1 mt-1 flex-wrap">
  {!!stats.VERIFIED     && <span className="...green...">  {stats.VERIFIED}✓   </span>}
  {!!stats.PENDING      && <span className="...yellow..."> {stats.PENDING}⏱    </span>}
  {!!stats.HALF_VERIFIED && <span className="...orange...">{stats.HALF_VERIFIED}½</span>}
  {!!stats.QUARTER_VERIFIED && <span className="...purple...">{stats.QUARTER_VERIFIED}¼</span>}
  {!!stats.REJECTED     && <span className="...red...">    {stats.REJECTED}✗   </span>}
  {!!stats.NONE         && <span className="...muted...">  {stats.NONE}–        </span>}
</div>
```

#### Sticky layout

```css
/* Corner cell: sticky both axes */
position: sticky; left: 0; top: 0; z-index: 20;

/* Header row: sticky vertically */
position: sticky; top: 0; z-index: 10;

/* Student name column: sticky horizontally */
position: sticky; left: 0; z-index: 1;
```

#### Status colour map

| Status           | Background                    | Text                       |
|------------------|-------------------------------|----------------------------|
| VERIFIED         | `bg-green-100`                | `text-green-800`           |
| PENDING          | `bg-yellow-100`               | `text-yellow-800`          |
| HALF_VERIFIED    | `bg-orange-100`               | `text-orange-800`          |
| QUARTER_VERIFIED | `bg-purple-100`               | `text-purple-800`          |
| REJECTED         | `bg-red-100`                  | `text-red-800`             |
| None             | `bg-muted/40`                 | `text-muted-foreground`    |

All colours have dark-mode variants (`dark:bg-*/30`, `dark:text-*/200`).

---

### Integration in `ClassPayments.tsx`

**File:** `lms user frotend/src/pages/ClassPayments.tsx`

#### New imports

```typescript
import { Grid3x3 } from 'lucide-react';
import ClassPaymentMatrix from '@/components/payments/ClassPaymentMatrix';
```

#### New state

```typescript
const [matrixMode, setMatrixMode] = useState(false);
```

#### View toggle (three-button group; matrix only for admin/teacher)

```tsx
<div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
  <button
    onClick={() => { setViewMode('card'); setMatrixMode(false); }}
    className={`p-2 rounded-md transition-colors ${
      !matrixMode && viewMode === 'card'
        ? 'bg-background shadow-sm'
        : 'text-muted-foreground hover:text-foreground'
    }`}
    title="Card View"
  >
    <LayoutGrid className="h-4 w-4" />
  </button>
  <button
    onClick={() => { setViewMode('table'); setMatrixMode(false); }}
    className={`p-2 rounded-md transition-colors ${
      !matrixMode && viewMode === 'table'
        ? 'bg-background shadow-sm'
        : 'text-muted-foreground hover:text-foreground'
    }`}
    title="Table View"
  >
    <Table2 className="h-4 w-4" />
  </button>
  {isAdminRole && (
    <button
      onClick={() => setMatrixMode(true)}
      className={`p-2 rounded-md transition-colors ${
        matrixMode ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
      title="Matrix View"
    >
      <Grid3x3 className="h-4 w-4" />
    </button>
  )}
</div>
{!matrixMode && viewMode === 'table' && <ColumnConfigurator ... />}
```

#### Rendering switch

```tsx
<CardContent className="p-0">
  {matrixMode ? (
    <ClassPaymentMatrix
      payments={paymentsData?.data ?? []}   // always pass all, not filtered
      instituteId={selectedInstitute.id}
      classId={selectedClass.id}
    />
  ) : filteredPayments.length === 0 ? (
    <div>...empty state...</div>
  ) : viewMode === 'card' ? (
    <div>...card view...</div>
  ) : (
    <Paper>...MUI table...</Paper>
  )}
</CardContent>
```

> **Note:** Matrix receives `paymentsData?.data ?? []` (all payments), not `filteredPayments`, because the matrix has its own internal selection UI. The main search bar is irrelevant in matrix mode.

---

## 8. API Reference — Class Payments

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/institute-class-payments/institute/:iid/class/:cid` | Admin: all payments for class |
| `GET` | `/institute-class-payments/institute/:iid/class/:cid/my-payments` | Student/Parent: own payment status |
| `GET` | `/institute-class-payment-submissions/institute/:iid/class/:cid/all-submissions` | Admin: all submissions (matrix source) |
| `GET` | `/institute-class-payment-submissions/institute/:iid/class/:cid/payment/:pid/users/STUDENT` | Admin: student roster for a payment |
| `PATCH` | `/institute-class-subject-students/enrollment-settings/:iid/:cid/:sid` | Update enrollment method settings |
| `POST` | `/institute-class-subject-students/self-enroll` | Student self-enroll |
| `PATCH` | `/institute-class-subject-students/claim-free-card/:iid/:cid/:sid` | Student claims free-card status |

---

## 9. Entity Quick Reference

### `InstituteClassSubject` (relevant enrollment fields)

```typescript
enrollmentEnabled: boolean;
enrollmentKey?: string;             // null = no key method
enrollmentPaymentRefId?: string;    // FK → InstituteClassPayment.id
enrollmentPaymentStatuses?: string[]; // e.g. ['VERIFIED', 'HALF_VERIFIED']
enrollmentFeeRequired?: boolean;
enrollmentFeeAmount?: number;
```

### `InstituteClassPayment`

```typescript
id: string;
instituteId: string;
classId: string;
title: string;
amount: Decimal;
lastDate: Date;
status: 'ACTIVE' | 'INACTIVE';
priority: 'MANDATORY' | 'OPTIONAL' | 'DONATION';
targetType: 'STUDENTS' | 'PARENTS' | 'BOTH';
```

### `InstituteClassPaymentSubmission`

```typescript
id: string;
paymentId: string;       // FK → InstituteClassPayment.id
userId: string;
status: 'PENDING' | 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED';
submittedAmount: Decimal;
uploadedAt: Date;
```

---

## 10. Checklist

### Backend
- [x] `InstituteClassPayment` + `InstituteClassPaymentSubmission` added to module `forFeature`
- [x] Repositories injected in service constructor
- [x] `classPaymentSubmissionRepository` used for payment gate check (not `submissionRepository`)
- [x] `gatedPaymentRecord` loaded and returned as `enrollmentPaymentTitle/Amount/DueDate`
- [x] `enrollmentKey` DTO field changed to `@IsOptional()`
- [x] Key validation skips when payment-only mode (no key set)

### Frontend
- [x] `SelfEnrollResponse` has new payment detail fields
- [x] `selfEnroll()` omits `enrollmentKey` if undefined
- [x] `SelfEnrollmentForm` routes `pending_payment` to correct page (class vs institute)
- [x] `TeacherEnrollmentManager` uses `classPaymentsApi.getClassPayments()` (not subject-level)
- [x] `AssignSubjectToClassForm` has two independent switches per subject
- [x] `AssignSubjectToClassForm` layout no longer cramped/unscrollable
- [x] `ClassPayments.tsx` has matrix view toggle (admin/teacher only)
- [x] `ClassPaymentMatrix.tsx` created with sticky headers, color-coded cells, legend
- [x] `AppContent.tsx` routes `class-payments` for all roles
- [x] `pageNavigation.ts` has `class-payments` in `classScopedPages`
