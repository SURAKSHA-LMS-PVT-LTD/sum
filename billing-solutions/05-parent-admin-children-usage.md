# Solution 05 — Parent Admin Sees All Children's Usage

## Problem
An admin of Institute A (the group master) cannot see the credit consumption,
login counts, or billing status of B and C from one screen.
Each institute is a completely isolated view.

## Root Cause
- No parent/child institute relationship exists in the schema
- No API endpoint returns aggregate usage for a group
- `getBillingOverview` (superadmin only) returns all institutes flat; institute admins cannot call it
- The frontend institute selector shows each institute independently with no grouping

---

## Solution

### Step 1 — Prerequisite
This solution depends on the `group_lead_institute_id` column added in **Solution 04**
and the `pool_master_institute_id` column from **Solution 01**.
Run those migrations first.

---

### Step 2 — Backend: group usage query service method

**File:** `src/modules/tenant/tenant.service.ts`

```typescript
/**
 * Return usage summary for all institutes in a group.
 * Caller must be an admin of the master institute.
 */
async getGroupUsageSummary(
  masterInstituteId: string,
  year: number,
  month: number,
) {
  // Find all children
  const children = await this.instituteRepository.find({
    where: { groupLeadInstituteId: masterInstituteId, isActive: true },
    select: ['id', 'name', 'shortName', 'tier', 'logoUrl', 'subdomain', 'customDomain'],
  });
  const master = await this.instituteRepository.findOne({
    where: { id: masterInstituteId },
    select: ['id', 'name', 'shortName', 'tier', 'logoUrl', 'subdomain', 'customDomain'],
  });
  if (!master) throw new NotFoundException('Master institute not found');

  const memberIds = [masterInstituteId, ...children.map(c => c.id)];
  const billingMonthDate = new Date(`${year}-${String(month).padStart(2, '0')}-01`);

  // Monthly billing
  const summaries = await this.billingSummaryRepository.find({
    where: { instituteId: In(memberIds), billingMonth: billingMonthDate },
  });
  const summaryMap = new Map(summaries.map(s => [s.instituteId, s]));

  // Credit balances
  const creditRecords = await this.creditsRepository.find({
    where: { instituteId: In(memberIds), isActive: true },
  });
  const creditMap = new Map(creditRecords.map(c => [c.instituteId, c]));

  // Per-member stats
  const members = [master, ...children].map(inst => {
    const billing = summaryMap.get(inst.id);
    const credits = creditMap.get(inst.id);

    return {
      instituteId:   inst.id,
      instituteName: inst.name,
      shortName:     inst.shortName,
      tier:          inst.tier,
      logoUrl:       inst.logoUrl,
      subdomain:     inst.subdomain,
      customDomain:  inst.customDomain,
      isMaster:      inst.id === masterInstituteId,
      billing: {
        totalFee:          Number(billing?.totalFee ?? 0),
        baseFee:           Number(billing?.baseFee ?? 0),
        userFee:           Number(billing?.userFee ?? 0),
        loginFee:          Number(billing?.loginFee ?? 0),
        smsMaskingFee:     Number(billing?.smsMaskingFee ?? 0),
        totalLogins:       billing?.totalLogins ?? 0,
        subdomainLogins:   billing?.subdomainLogins ?? 0,
        customDomainLogins: billing?.customDomainLogins ?? 0,
        totalActiveUsers:  billing?.totalActiveUsers ?? 0,
        status:            billing?.status ?? BillingStatus.PENDING,
      },
      credits: {
        balance:       Number(credits?.balance ?? 0),
        totalPurchased: Number(credits?.totalPurchased ?? 0),
        totalUsed:     Number(credits?.totalUsed ?? 0),
        monthlyUsed:   Number(credits?.monthlyUsed ?? 0),
      },
    };
  });

  // Group totals
  const totals = members.reduce((acc, m) => ({
    totalFee:        acc.totalFee        + m.billing.totalFee,
    totalLogins:     acc.totalLogins     + m.billing.totalLogins,
    totalActiveUsers: acc.totalActiveUsers + m.billing.totalActiveUsers,
    totalCreditsUsed: acc.totalCreditsUsed + m.credits.monthlyUsed,
    totalBalance:    acc.totalBalance    + m.credits.balance,
  }), { totalFee: 0, totalLogins: 0, totalActiveUsers: 0, totalCreditsUsed: 0, totalBalance: 0 });

  return {
    billingMonth: `${year}-${String(month).padStart(2, '0')}`,
    masterInstituteId,
    memberCount: members.length,
    totals,
    members,
  };
}
```

---

### Step 3 — Authorization guard: must be admin of master institute

**File:** `src/modules/tenant/tenant.controller.ts`

```typescript
@Get('institutes/:masterId/group-usage/:year/:month')
@UseGuards(JwtAuthGuard, InstituteAdminGuard)  // InstituteAdminGuard checks req.user against masterId
async getGroupUsageSummary(
  @Param('masterId') masterId: string,
  @Param('year', ParseIntPipe) year: number,
  @Param('month', ParseIntPipe) month: number,
  @Req() req: any,
) {
  const userId = req.user?.s || req.user?.sub;
  // Verify caller is admin of master institute
  await this.tenantService.assertInstituteAdmin(userId, masterId);
  return this.tenantService.getGroupUsageSummary(masterId, year, month);
}
```

**TenantService helper:**

```typescript
async assertInstituteAdmin(userId: string, instituteId: string): Promise<void> {
  const membership = await this.instituteUserRepository.findOne({
    where: {
      userId,
      instituteId,
      status: 'ACTIVE',
      instituteUserType: In(['INSTITUTE_ADMIN']),
    },
  });
  if (!membership) {
    throw new ForbiddenException('You must be an admin of this institute to view group usage');
  }
}
```

---

### Step 4 — Frontend: Group Usage Dashboard

**New file:** `src/pages/GroupUsageDashboardPage.tsx`

```tsx
export default function GroupUsageDashboardPage() {
  const { selectedInstitute } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<GroupUsageSummary | null>(null);

  useEffect(() => {
    if (!selectedInstitute?.id) return;
    tenantApi.getGroupUsageSummary(selectedInstitute.id, year, month)
      .then(setData)
      .catch(() => setData(null));
  }, [selectedInstitute?.id, year, month]);

  if (!data) return <Skeleton />;

  return (
    <PageContainer title="Group Usage">
      {/* Summary cards: total fee, total logins, total credits used, total balance */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Total Fee" value={`LKR ${data.totals.totalFee.toFixed(2)}`} />
        <SummaryCard label="Total Logins" value={data.totals.totalLogins} />
        <SummaryCard label="Credits Used" value={data.totals.totalCreditsUsed} />
        <SummaryCard label="Pool Balance" value={data.totals.totalBalance} />
      </div>

      {/* Per-institute breakdown table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Institute</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Logins</TableHead>
            <TableHead>Active Users</TableHead>
            <TableHead>Credits Used</TableHead>
            <TableHead>Credit Balance</TableHead>
            <TableHead>Monthly Fee</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.members.map(m => (
            <TableRow key={m.instituteId}>
              <TableCell>
                {m.instituteName}
                {m.isMaster && <Badge className="ml-2">Master</Badge>}
              </TableCell>
              <TableCell><TierBadge tier={m.tier} /></TableCell>
              <TableCell>{m.billing.totalLogins}</TableCell>
              <TableCell>{m.billing.totalActiveUsers}</TableCell>
              <TableCell>{m.credits.monthlyUsed}</TableCell>
              <TableCell>{m.credits.balance}</TableCell>
              <TableCell>LKR {m.billing.totalFee.toFixed(2)}</TableCell>
              <TableCell><StatusBadge status={m.billing.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </PageContainer>
  );
}
```

**`src/api/tenant.api.ts`** — add:

```typescript
getGroupUsageSummary: (masterInstituteId: string, year: number, month: number) =>
  apiClient.get(`/v2/tenant/institutes/${masterInstituteId}/group-usage/${year}/${month}`),
```

---

### Step 5 — Sidebar navigation entry

**`src/components/layout/Sidebar.tsx`** — for INSTITUTE_ADMIN role, add entry when `selectedInstitute` has children:

```typescript
// In the admin navigation group:
if (hasGroupChildren) {
  groups.push({
    id: 'group-usage',
    label: 'Group Dashboard',
    icon: LayoutDashboard,
    items: [
      { id: 'group-usage-dashboard', label: 'Usage Overview', icon: BarChart3 },
      { id: 'group-billing',         label: 'Group Invoice',  icon: Receipt },
    ],
  });
}
```

**`src/components/AppContent.tsx`** — add cases:

```typescript
case 'group-usage-dashboard':
  return <GroupUsageDashboardPage />;
case 'group-billing':
  return <GroupBillingPage />;
```

---

## Tests to Write

```typescript
describe('Group Usage Summary', () => {
  it('returns data for master + all active children', async () => { ... });
  it('throws ForbiddenException for non-admin of master', async () => { ... });
  it('inactive children are excluded from the summary', async () => { ... });
  it('totals sum correctly across all members', async () => { ... });
  it('credit balance reflects pool master when shared pool is active', async () => { ... });
});
```

---

## Summary of Changes

| File | Change |
|---|---|
| `TenantService` | Add `getGroupUsageSummary()`, `assertInstituteAdmin()` |
| `TenantController` | 1 new endpoint `GET .../group-usage/:year/:month` |
| `tenant.api.ts` | Add `getGroupUsageSummary` |
| New `GroupUsageDashboardPage.tsx` | Full group usage table + summary cards |
| `AppContent.tsx` | Route `group-usage-dashboard` and `group-billing` |
| `Sidebar.tsx` | Group Dashboard nav group (conditional on having children) |
