# Solution 07 — Link Child Institute to Parent (API + UI)

## Problem
There is no mechanism — no API endpoint and no UI — to say
"Institute B belongs to Institute A's group."
An admin cannot create or manage parent/child relationships.

## Root Cause
- No `parent`/`group_lead` column on `institutes` (no concept exists at all)
- No service method for linking institutes
- No controller endpoint
- Frontend has no UI — the institute selector shows every institute as a flat, equal entry

---

## Solution

### Step 1 — Prerequisites
Requires `group_lead_institute_id` (Solution 04),
`pool_master_institute_id` (Solution 01),
and `tier_inherit_from_id` (Solution 03) on `institutes`.

---

### Step 2 — Service: group management methods

**File:** `src/modules/tenant/tenant.service.ts`

```typescript
/**
 * Link a child institute into a group.
 * Optionally also join the credit pool and inherit the tier.
 */
async addInstituteToGroup(
  childId: string,
  masterId: string,
  options: {
    joinCreditPool?: boolean;
    inheritTier?: boolean;
  } = {},
): Promise<InstituteEntity> {
  if (childId === masterId) throw new BadRequestException('Cannot link an institute to itself');

  const [child, master] = await Promise.all([
    this.instituteRepository.findOne({ where: { id: childId } }),
    this.instituteRepository.findOne({ where: { id: masterId } }),
  ]);
  if (!child)  throw new NotFoundException(`Child institute ${childId} not found`);
  if (!master) throw new NotFoundException(`Master institute ${masterId} not found`);

  // Prevent circular chain: master must not itself be a child
  if (master.groupLeadInstituteId) {
    throw new BadRequestException(
      `Master institute ${masterId} is itself a child of ${master.groupLeadInstituteId}. ` +
      `Multi-level chains are not supported.`,
    );
  }

  child.groupLeadInstituteId = masterId;
  if (options.joinCreditPool)  child.poolMasterInstituteId  = masterId;
  if (options.inheritTier)     child.tierInheritFromId      = masterId;
  child.updatedAt = now();

  const saved = await this.instituteRepository.save(child);
  this.logger.log(
    `🔗 Institute ${childId} linked to master ${masterId} ` +
    `(pool=${options.joinCreditPool}, tier=${options.inheritTier})`,
  );
  return saved;
}

/**
 * Remove a child institute from its group (fully independent again).
 */
async removeInstituteFromGroup(childId: string): Promise<InstituteEntity> {
  const child = await this.instituteRepository.findOne({ where: { id: childId } });
  if (!child) throw new NotFoundException('Institute not found');
  if (!child.groupLeadInstituteId) throw new BadRequestException('Institute is not in any group');

  child.groupLeadInstituteId    = null;
  child.poolMasterInstituteId   = null;
  child.tierInheritFromId       = null;
  child.updatedAt               = now();

  return this.instituteRepository.save(child);
}

/**
 * List all groups: returns each master institute with its list of children.
 */
async listGroups(): Promise<any[]> {
  const masters = await this.instituteRepository.find({
    where: { groupLeadInstituteId: IsNull(), isActive: true },
    select: ['id', 'name', 'shortName', 'tier', 'logoUrl'],
    order: { name: 'ASC' },
  });

  const children = await this.instituteRepository.find({
    where: { groupLeadInstituteId: Not(IsNull()), isActive: true },
    select: ['id', 'name', 'shortName', 'tier', 'logoUrl', 'groupLeadInstituteId',
             'poolMasterInstituteId', 'tierInheritFromId'],
  });

  const childMap = new Map<string, typeof children>();
  for (const child of children) {
    const lead = child.groupLeadInstituteId!;
    if (!childMap.has(lead)) childMap.set(lead, []);
    childMap.get(lead)!.push(child);
  }

  return masters.map(m => ({
    ...m,
    children: (childMap.get(m.id) ?? []).map(c => ({
      ...c,
      isPooled:       c.poolMasterInstituteId === m.id,
      inheritsTier:   c.tierInheritFromId     === m.id,
    })),
  }));
}
```

---

### Step 3 — Controller endpoints

**File:** `src/modules/tenant/tenant.controller.ts`

```typescript
// Link child to master (SuperAdmin + Institute Admin of master)
@Post('institutes/:masterId/group/add/:childId')
@UseGuards(JwtAuthGuard, SuperAdminOrMasterAdminGuard)
async addInstituteToGroup(
  @Param('masterId') masterId: string,
  @Param('childId')  childId:  string,
  @Body() dto: AddToGroupDto,
) {
  return this.tenantService.addInstituteToGroup(childId, masterId, {
    joinCreditPool: dto.joinCreditPool ?? false,
    inheritTier:    dto.inheritTier    ?? false,
  });
}

// Remove child from group
@Delete('institutes/:childId/group')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
async removeInstituteFromGroup(@Param('childId') childId: string) {
  return this.tenantService.removeInstituteFromGroup(childId);
}

// List all groups (SuperAdmin view)
@Get('institute-groups')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
async listGroups() {
  return this.tenantService.listGroups();
}

// Get children of a master (admin of master can call)
@Get('institutes/:masterId/group/children')
@UseGuards(JwtAuthGuard)
async getGroupChildren(@Param('masterId') masterId: string, @Req() req: any) {
  await this.tenantService.assertInstituteAdmin(req.user?.s ?? req.user?.sub, masterId);
  return this.tenantService.getGroupChildren(masterId);
}
```

**DTOs:**

```typescript
// src/modules/tenant/dto/add-to-group.dto.ts
export class AddToGroupDto {
  @IsOptional()
  @IsBoolean()
  joinCreditPool?: boolean;

  @IsOptional()
  @IsBoolean()
  inheritTier?: boolean;
}
```

---

### Step 4 — Frontend: Institute Grouping Management Page

**New file:** `src/pages/InstituteGroupManagementPage.tsx`

```tsx
export default function InstituteGroupManagementPage() {
  const [groups, setGroups] = useState<GroupedInstitute[]>([]);
  const [linkDialog, setLinkDialog] = useState(false);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [selectedMaster, setSelectedMaster] = useState<string | null>(null);
  const [joinPool, setJoinPool] = useState(false);
  const [inheritTier, setInheritTier] = useState(false);

  const loadGroups = async () => {
    const data = await tenantApi.listGroups();
    setGroups(data);
  };

  const handleLink = async () => {
    if (!selectedChild || !selectedMaster) return;
    await tenantApi.addInstituteToGroup(selectedMaster, selectedChild, { joinPool, inheritTier });
    setLinkDialog(false);
    loadGroups();
  };

  const handleUnlink = async (childId: string) => {
    await tenantApi.removeInstituteFromGroup(childId);
    loadGroups();
  };

  return (
    <PageContainer title="Institute Groups">
      <Button onClick={() => setLinkDialog(true)}>Link Institute to Group</Button>

      {/* Group list */}
      {groups.map(group => (
        <Card key={group.id} className="mb-4">
          <CardHeader>
            <CardTitle>{group.name} <Badge>Master</Badge></CardTitle>
          </CardHeader>
          <CardContent>
            {group.children.length === 0 && (
              <p className="text-muted-foreground text-sm">No child institutes</p>
            )}
            <Table>
              <TableBody>
                {group.children.map(child => (
                  <TableRow key={child.id}>
                    <TableCell>{child.name}</TableCell>
                    <TableCell>
                      {child.isPooled    && <Badge variant="outline">Shared Pool</Badge>}
                      {child.inheritsTier && <Badge variant="outline">Inherited Tier</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="destructive"
                        onClick={() => handleUnlink(child.id)}>
                        Unlink
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Link dialog */}
      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link Institute to Group</DialogTitle></DialogHeader>
          <InstituteSelector label="Child Institute" onSelect={setSelectedChild} />
          <InstituteSelector label="Master Institute" onSelect={setSelectedMaster} />
          <div className="flex items-center gap-2">
            <Checkbox checked={joinPool} onCheckedChange={c => setJoinPool(!!c)} />
            <label>Share credit pool</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={inheritTier} onCheckedChange={c => setInheritTier(!!c)} />
            <label>Inherit plan/tier</label>
          </div>
          <DialogFooter>
            <Button onClick={handleLink}>Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
```

---

### Step 5 — Institute Selector: show group hierarchy

**`src/components/layout/Sidebar.tsx`** — when the user has multiple institutes, group them:

```tsx
// In the institute dropdown / selector
const masterInstitutes = institutes.filter(i => !i.groupLeadInstituteId);
const childrenMap = institutes.reduce((acc, i) => {
  if (i.groupLeadInstituteId) {
    acc[i.groupLeadInstituteId] = [...(acc[i.groupLeadInstituteId] ?? []), i];
  }
  return acc;
}, {} as Record<string, Institute[]>);

// Render as nested list
masterInstitutes.map(master => (
  <div key={master.id}>
    <InstituteItem institute={master} isSelected={selectedInstitute?.id === master.id} />
    {childrenMap[master.id]?.map(child => (
      <InstituteItem key={child.id} institute={child} indent
        isSelected={selectedInstitute?.id === child.id} />
    ))}
  </div>
));
```

---

### Step 6 — `tenant.api.ts` additions

```typescript
addInstituteToGroup: (masterId: string, childId: string,
  opts: { joinCreditPool?: boolean; inheritTier?: boolean }) =>
  apiClient.post(`/v2/tenant/institutes/${masterId}/group/add/${childId}`, opts),

removeInstituteFromGroup: (childId: string) =>
  apiClient.delete(`/v2/tenant/institutes/${childId}/group`),

listGroups: () =>
  apiClient.get('/v2/tenant/institute-groups'),

getGroupChildren: (masterId: string) =>
  apiClient.get(`/v2/tenant/institutes/${masterId}/group/children`),
```

---

## Tests to Write

```typescript
describe('Institute Group Linking', () => {
  it('addInstituteToGroup links child to master correctly', async () => { ... });
  it('addInstituteToGroup with joinPool sets poolMasterInstituteId', async () => { ... });
  it('addInstituteToGroup with inheritTier sets tierInheritFromId', async () => { ... });
  it('prevents linking master that is itself a child (circular chain)', async () => { ... });
  it('prevents linking institute to itself', async () => { ... });
  it('removeInstituteFromGroup clears all parent references', async () => { ... });
  it('listGroups returns nested master→children structure', async () => { ... });
  it('getGroupChildren requires admin of master', async () => { ... });
});
```

---

## Summary of Changes

| File | Change |
|---|---|
| `TenantService` | Add `addInstituteToGroup()`, `removeInstituteFromGroup()`, `listGroups()`, `getGroupChildren()` |
| `TenantController` | 4 new endpoints |
| New `AddToGroupDto` | `joinCreditPool`, `inheritTier` flags |
| `tenant.api.ts` | 4 new API methods |
| New `InstituteGroupManagementPage.tsx` | Full UI for linking/unlinking institutes |
| `AppContent.tsx` | Route `institute-group-management` |
| `Sidebar.tsx` | Nested institute dropdown (master → children) |
