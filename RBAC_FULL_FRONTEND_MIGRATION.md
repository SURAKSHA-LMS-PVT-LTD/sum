# RBAC Full Frontend Migration — Complete Component-by-Component Implementation
## Replace every hardcoded role check, enum dropdown, and "Students" label with dynamic permission-driven logic

> **Prerequisite:** Backend migrations from `RBAC_BACKEND_IMPLEMENTATION.md` must be run first.
> The key backend endpoint this document depends on is `GET /institutes/:id/my-context` which returns `{ userTypeId, userTypeName, permissions: PermissionMatrix }`.

---

## Table of Contents

- [Part 01 — Foundation Layer (do first, everything depends on this)](#part-01)
- [Part 02 — InstituteUsers.tsx — The biggest single file](#part-02)
- [Part 03 — CreateInstituteUserForm.tsx](#part-03)
- [Part 04 — AssignUserMethodsDialog.tsx](#part-04)
- [Part 05 — Sidebar.tsx](#part-05)
- [Part 06 — AppContent.tsx](#part-06)
- [Part 07 — Homework.tsx](#part-07)
- [Part 08 — Exams.tsx + UpdateExamForm.tsx + CreateExamForm.tsx](#part-08)
- [Part 09 — Lectures.tsx + CreateLectureForm.tsx + UpdateLectureForm.tsx + ClassLecturesPage.tsx](#part-09)
- [Part 10 — Results.tsx + Grades.tsx + Grading.tsx](#part-10)
- [Part 11 — Classes.tsx + ClassSubjects.tsx](#part-11)
- [Part 12 — SMS.tsx](#part-12)
- [Part 13 — Notifications (CreateNotificationButton, NotificationsPage, NotificationManagement)](#part-13)
- [Part 14 — Attendance components](#part-14)
- [Part 15 — Payment components](#part-15)
- [Part 16 — Dashboard components](#part-16)
- [Part 17 — StudyMaterials.tsx + HomeworkSubmissionsDialog.tsx + SubjectDashboard.tsx](#part-17)
- [Part 18 — InstituteSettingsPage.tsx](#part-18)
- [Part 19 — Students/Teachers/Parents rename → Users](#part-19)
- [Part 20 — API layer changes](#part-20)
- [Part 21 — Backend implementation gaps to close](#part-21)
- [Part 22 — Complete file change checklist](#part-22)

---

<a name="part-01"></a>
## Part 01 — Foundation Layer

These files must be done first. Every other part depends on them.

---

### 01-A: New hook `src/hooks/useMyRbacContext.ts`

Already specified in `RBAC_SYSTEM_ADMIN_FRONTEND.md`. This fetches `GET /institutes/:id/my-context` and caches it. Key output:

```typescript
const { can, context, loading } = useMyRbacContext();
// can('academics.homework', 'create') → boolean
// context.userTypeId, context.userTypeName, context.permissions
```

---

### 01-B: New hook `src/hooks/usePermission.ts`

Already specified in `RBAC_SYSTEM_ADMIN_FRONTEND.md`. Used in every component:

```typescript
const { canView, canCreate, canUpdate, canDelete, canReport, loading } = usePermission('academics.homework');
```

---

### 01-C: New hook `src/hooks/useUserTypes.ts`

Fetches the institute's user types list. Used anywhere a dropdown of user types is needed (replaces hardcoded STUDENT/TEACHER selects).

```typescript
// src/hooks/useUserTypes.ts
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userTypesApi, UserType } from '@/api/userTypes.api';

export const useUserTypes = () => {
  const { selectedInstitute } = useAuth();
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedInstitute?.id) { setUserTypes([]); setLoading(false); return; }
    setLoading(true);
    userTypesApi.list(selectedInstitute.id)
      .then(setUserTypes)
      .finally(() => setLoading(false));
  }, [selectedInstitute?.id]);

  return { userTypes, loading };
};
```

---

### 01-D: Update `src/hooks/useInstituteRole.ts` — add `legacyUserType` fallback

**Keep this hook working.** Do not delete it. Every component that still reads `userRole === 'InstituteAdmin'` continues to compile. Migrate components one by one.

Add a new export alongside the old one:

```typescript
// New: returns the userTypeSlug from RBAC context, falls back to legacy string
export const useInstituteUserTypeSlug = (): string | null => {
  const { context } = useMyRbacContext();
  return context?.userTypeSlug ?? null;
};
```

---

### 01-E: Feature key mapping

**File:** `src/config/feature-keys.ts` — verify these keys match what the backend seeds into `feature_catalog`. The permission matrix uses these same keys:

```
attendance.class          academics.classes
attendance.subject        academics.subjects
attendance.device         academics.homework
academics.lectures.class  academics.exams
academics.lectures.subject academics.results
academics.study_materials  academics.lectures.free
payments.class             payments.subject
payments.institute         payments.reports
communication.sms          communication.push
branding.logo              services.user_types
services.drive             services.houses
services.id_cards          services.calendar
services.features          transport.bookhire
```

---

<a name="part-02"></a>
## Part 02 — `InstituteUsers.tsx`

**Current problems:**
1. `type UserType = 'STUDENT' | 'TEACHER' | 'ATTENDANCE_MARKER' | 'INSTITUTE_ADMIN'` hardcoded (line 104)
2. API endpoints hardcoded: `/institute-users/institute/${id}/users/STUDENT` etc. (lines 297, 310, 320, 330)
3. Tab selects render `<SelectItem value="STUDENT">`, `<SelectItem value="TEACHER">` etc. (lines 1394–1412, 1448–1459, 2140–2143)
4. `userRole !== 'InstituteAdmin'` access gate (line 1253)
5. Column logic: `selectedUserType === 'STUDENT'` triggers different columns (line 1120)
6. Access guard: `if (userRole !== 'InstituteAdmin') return <AccessDenied>`

**Changes:**

#### Change 1 — Replace hardcoded UserType with dynamic types

```typescript
// REMOVE:
type UserType = 'STUDENT' | 'TEACHER' | 'ATTENDANCE_MARKER' | 'INSTITUTE_ADMIN';
const [selectedUserType, setSelectedUserType] = useState<UserType>('STUDENT');

// ADD:
import { useUserTypes } from '@/hooks/useUserTypes';
const { userTypes, loading: typesLoading } = useUserTypes();
const [selectedUserTypeId, setSelectedUserTypeId] = useState<string>('');
// Set default to first type once loaded
useEffect(() => {
  if (userTypes.length > 0 && !selectedUserTypeId) {
    setSelectedUserTypeId(userTypes[0].id);
  }
}, [userTypes]);
```

#### Change 2 — Replace hardcoded API endpoints

```typescript
// REMOVE the 4 hardcoded endpoint cases.
// NEW: single endpoint using userTypeId
const endpoint = `/institute-users/institute/${currentInstituteId}/users?userTypeId=${selectedUserTypeId}`;
```

**Backend must support:** `GET /institute-users/institute/:id/users?userTypeId=42`
(See Part 21 for backend changes needed)

#### Change 3 — Replace tab dropdowns with dynamic selects

```typescript
// REMOVE hardcoded SelectItems
// ADD:
{userTypes.map(ut => (
  <SelectItem key={ut.id} value={ut.id}>
    <div className="flex items-center gap-2">
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: ut.color ?? '#6B7280' }}
      />
      {ut.name}
    </div>
  </SelectItem>
))}
```

#### Change 4 — Replace access gate

```typescript
// REMOVE:
if (userRole !== 'InstituteAdmin') return <AccessDenied />;

// ADD:
const { canView } = usePermission('services.user_management');
if (!canView) return <AccessDenied />;
```

#### Change 5 — Replace `isStudentRow` logic

```typescript
// REMOVE:
const isStudentRow = activeView === 'USERS' && selectedUserType === 'STUDENT';

// ADD (check if selected type has slug 'student' or matches legacy):
const selectedType = userTypes.find(ut => ut.id === selectedUserTypeId);
const isStudentLikeRow = selectedType?.slug === 'student';
```

#### Change 6 — The pending user type dropdown for bulk actions

```typescript
// REMOVE lines 1448-1459 hardcoded Select
// ADD same dynamic userTypes map as Change 3
```

---

<a name="part-03"></a>
## Part 03 — `CreateInstituteUserForm.tsx`

**Current problems:**
1. `INSTITUTE_USER_TYPES` const array (lines 89–94) — hardcoded 4 types
2. `useState<InstituteUserType>('STUDENT')` default (line 216)
3. Role select renders from `INSTITUTE_USER_TYPES.map(...)` (lines 613–620)
4. Submit button shows `INSTITUTE_USER_TYPES.find(t => t.value === instituteUserType)?.label` (line 1574)
5. Student-specific form sections only visible when `instituteUserType === 'STUDENT'`
6. Parent sections shown when type is STUDENT (for family linking)

**Changes:**

#### Change 1 — Load user types dynamically

```typescript
// REMOVE: const INSTITUTE_USER_TYPES = [...]
// REMOVE: const [instituteUserType, setInstituteUserType] = useState<InstituteUserType>('STUDENT');

// ADD:
import { useUserTypes } from '@/hooks/useUserTypes';
const { userTypes, loading: typesLoading } = useUserTypes();
const [selectedUserTypeId, setSelectedUserTypeId] = useState<string>('');
const [selectedUserTypeFull, setSelectedUserTypeFull] = useState<UserType | null>(null);

useEffect(() => {
  if (userTypes.length > 0 && !selectedUserTypeId) {
    setSelectedUserTypeId(userTypes[0].id);
    setSelectedUserTypeFull(userTypes[0]);
  }
}, [userTypes, selectedUserTypeId]);

const handleTypeChange = (id: string) => {
  setSelectedUserTypeId(id);
  setSelectedUserTypeFull(userTypes.find(ut => ut.id === id) ?? null);
};
```

#### Change 2 — Replace role select dropdown

```typescript
// REMOVE: {INSTITUTE_USER_TYPES.map(t => <SelectItem ...>)}

// ADD:
{typesLoading ? (
  <SelectItem value="" disabled>Loading...</SelectItem>
) : userTypes.map(ut => (
  <SelectItem key={ut.id} value={ut.id}>
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ut.color ?? '#6B7280' }} />
      {ut.name}
    </div>
  </SelectItem>
))}
```

#### Change 3 — Student-specific fields visibility

Student-specific fields (blood group, emergency contact, parent links) should show based on the user type's **slug**, not the hardcoded enum:

```typescript
// REMOVE: if (instituteUserType === 'STUDENT') show student fields

// ADD: detect by slug (system-defined types have known slugs)
const showStudentFields = selectedUserTypeFull?.slug === 'student';
const showParentLinkSection = showStudentFields; // parent links only for student-like types
```

#### Change 4 — Submit payload

```typescript
// REMOVE: instituteUserType field in the API payload
// ADD: primaryUserTypeId
const payload = {
  ...formData,
  primaryUserTypeId: selectedUserTypeId,
  // Keep legacyUserType for backward compat until backend fully migrated:
  instituteUserType: selectedUserTypeFull?.slug?.toUpperCase() ?? 'STUDENT',
};
```

#### Change 5 — Submit button label

```typescript
// REMOVE: INSTITUTE_USER_TYPES.find(t => t.value === instituteUserType)?.label
// ADD:
{`Create ${selectedUserTypeFull?.name ?? 'User'}`}
```

---

<a name="part-04"></a>
## Part 04 — `AssignUserMethodsDialog.tsx`

**Current problems:**
- Lines 383–386: default state `instituteUserType: 'STUDENT'` in 4 form states
- Lines 624–627, 720–723, 812–815, 905–908: four identical hardcoded SelectItem blocks for INSTITUTE_ADMIN/TEACHER/STUDENT/ATTENDANCE_MARKER

**Changes:**

#### Change 1 — Replace all 4 form state defaults

```typescript
// In all 4 form state initialisations (idFormData, phoneFormData, rfidFormData, emailFormData):
// REMOVE: instituteUserType: 'STUDENT'
// ADD:    primaryUserTypeId: ''   (filled once userTypes load)
```

#### Change 2 — Create a shared `UserTypeSelect` component used in all 4 method tabs

```typescript
// New tiny component used 4 times in this dialog:
const UserTypeSelectField: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const { userTypes, loading } = useUserTypes();
  return (
    <Select value={value} onValueChange={onChange} disabled={loading}>
      <SelectTrigger><SelectValue placeholder={loading ? 'Loading…' : 'Select user type'} /></SelectTrigger>
      <SelectContent>
        {userTypes.map(ut => (
          <SelectItem key={ut.id} value={ut.id}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ut.color ?? '#6B7280' }} />
              {ut.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
```

Replace all 4 hardcoded SelectItem blocks (lines 624–627, 720–723, 812–815, 905–908) with:
```tsx
<UserTypeSelectField
  value={idFormData.primaryUserTypeId}
  onChange={v => setIdFormData(p => ({ ...p, primaryUserTypeId: v }))}
/>
```
(and equivalents for the other 3 form states)

---

<a name="part-05"></a>
## Part 05 — `Sidebar.tsx`

**Current problem:** The entire navigation is built inside 4 giant `if (userRole === 'Student')`, `if (userRole === 'Teacher')`, `if (userRole === 'InstituteAdmin')`, `if (userRole === 'Parent')` blocks (lines 343–706+).

**The correct approach:** Keep the role-based nav structure during migration but add permission guards to individual items. Full restructuring of the sidebar into data-driven rendering is a separate large task — scope it separately.

**Immediate changes (safe, non-breaking):**

#### Change 1 — Replace the permission filter function

Find line ~299:
```typescript
// REMOVE:
const hasPermission = AccessControl.hasPermission(userRole, item.permission as Permission);

// ADD:
const { can } = useMyRbacContext();
// Map old Permission strings to new feature key + action:
const hasPermission = item.featureKey
  ? can(item.featureKey, item.action ?? 'view')
  : item.permission
    ? AccessControl.hasPermission(userRole, item.permission as Permission) // legacy fallback
    : true;
```

Add `featureKey` and `action` optional fields to the `NavItem` interface:
```typescript
interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  permission?: string;          // old
  featureKey?: string;          // new RBAC key e.g. 'academics.homework'
  action?: 'view' | 'create';  // new
  alwaysShow?: boolean;
  locked?: boolean;
  badge?: number;
  path?: string;
}
```

#### Change 2 — Add featureKey to nav items that map directly to features

In the Teacher nav group (around line 480), add `featureKey` to each item:

```typescript
// Example — Teacher > Subject context:
{ id: FEATURE_KEYS.HOMEWORK,    label: 'Homework',       icon: Notebook,  featureKey: 'academics.homework',       action: 'view' },
{ id: FEATURE_KEYS.EXAMS,       label: 'Exams',          icon: Award,     featureKey: 'academics.exams',          action: 'view' },
{ id: FEATURE_KEYS.LECTURES,    label: 'Lectures',       icon: Video,     featureKey: 'academics.lectures.subject', action: 'view' },
{ id: FEATURE_KEYS.STUDY_MATERIALS, label: 'Study Materials', icon: FileText, featureKey: 'academics.study_materials', action: 'view' },
```

#### Change 3 — Add user type display to sidebar profile area

In the sidebar profile section (where name and tier are shown), add the user type name:

```typescript
import { useMyRbacContext } from '@/hooks/useMyRbacContext';
const { context } = useMyRbacContext();

// In the profile render area, after the user name:
{context?.userTypeName && (
  <span
    className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md font-medium"
    style={{
      backgroundColor: (context.userTypeColor ?? '#6B7280') + '20',
      color: context.userTypeColor ?? '#6B7280',
    }}
  >
    {context.userTypeName}
  </span>
)}
```

---

<a name="part-06"></a>
## Part 06 — `AppContent.tsx`

**Current problem:** Role-based page rendering — `userRole === 'Teacher'`, `userRole === 'Student'` etc. are used to decide which components to render.

**The approach:** These checks are about which *view* to show for a given route, not permissions. Keep the role routing during transition. Add a single permission layer on top.

#### Change — Add permission wrapper for sensitive routes

For pages that require a specific permission (create/edit resources), wrap with a permission check at the route level:

```typescript
import { usePermission } from '@/hooks/usePermission';

// Example — wrap the route that renders the user creation page:
const ProtectedUserCreation = () => {
  const { canCreate } = usePermission('services.user_management');
  if (!canCreate) return <AccessDenied featureName="User Management" />;
  return <CreateInstituteUserPage />;
};
```

Create a reusable `AccessDenied` component:

**New file:** `src/components/common/AccessDenied.tsx`

```tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Lock } from 'lucide-react';

export const AccessDenied: React.FC<{ featureName?: string }> = ({ featureName }) => (
  <Card className="m-4">
    <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Lock className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold">Access Restricted</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {featureName
          ? `You don't have permission to access ${featureName}.`
          : "You don't have permission to view this page."}
        Contact your institute admin to request access.
      </p>
    </CardContent>
  </Card>
);
```

---

<a name="part-07"></a>
## Part 07 — `Homework.tsx`

**Current hardcoded lines:**
- Line 125: `if (userRole === 'Teacher' && user?.id)`
- Line 130: `if (userRole === 'Student')`
- Line 133: `else if (userRole === 'InstituteAdmin' || userRole === 'Teacher')`
- Line 150–163: same patterns for loading logic
- Lines 299–302: `canAdd/canEdit/canDelete` using `AccessControl.hasPermission`
- Line 302: `const isStudent = instituteRole === 'Student'`
- Line 354: `instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher'` for Submissions column
- Line 357: same for Actions column
- Line 435: `if (isStudent)` different submission flow
- Line 585: `(instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher') && canAdd`

**Changes:**

```typescript
// REMOVE all the old patterns.
// ADD at the top of the component:
const { canView, canCreate, canUpdate, canDelete, canReport } = usePermission('academics.homework');
const { context } = useMyRbacContext();

// Replace isStudent detection:
const isStudentLike = context?.userTypeSlug === 'student';
const canSeeSubmissions = canReport; // replaces: instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher'

// Replace data loading role checks:
// REMOVE: if (userRole === 'Teacher') fetch teacher's homework
// REMOVE: if (userRole === 'Student') fetch student's homework
// ADD: single fetch — the backend filters by the user's role automatically
// The API already handles this server-side based on JWT claims

// Replace column visibility:
// REMOVE: ...((instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher') ? [submissionsCol] : [])
// ADD:    ...(canReport ? [submissionsCol] : [])

// REMOVE: ...((instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher') && (canEdit || canDelete) ? [actionsCol] : [])
// ADD:    ...((canUpdate || canDelete) ? [actionsCol] : [])

// Replace add button:
// REMOVE: (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher') && canAdd
// ADD:    canCreate

// Replace submit (student) button:
// REMOVE: if (isStudent) show submit button
// ADD:    the homework submission button is always shown if user has no canCreate but is enrolled
//         (keep legacy isStudentLike check here only as UX hint, not security gate)
```

---

<a name="part-08"></a>
## Part 08 — Exams + Exam Forms

**Files:** `Exams.tsx`, `CreateExamForm.tsx`, `UpdateExamForm.tsx`

**Pattern to replace in all three:**

```typescript
// REMOVE in Exams.tsx:
const isTeacher = userRole === 'Teacher';
const isInstituteAdmin = userRole === 'InstituteAdmin';
const canEdit = isTeacher || isInstituteAdmin;
// And: AccessControl.hasPermission(userRole, 'edit-exam')

// ADD:
const { canView, canCreate, canUpdate, canDelete, canReport } = usePermission('academics.exams');

// Replace all conditional renders:
// canAdd button:     canCreate
// canEdit button:    canUpdate
// canDelete button:  canDelete
// view results:      canReport
```

**In `CreateExamForm.tsx` and `UpdateExamForm.tsx`:**

```typescript
// REMOVE: if (instituteRole !== 'InstituteAdmin' && instituteRole !== 'Teacher') return null
// ADD:
const { canCreate } = usePermission('academics.exams');
if (!canCreate) return null;
```

---

<a name="part-09"></a>
## Part 09 — Lectures + Lecture Forms

**Files:** `Lectures.tsx`, `CreateLectureForm.tsx`, `UpdateLectureForm.tsx`, `ClassLecturesPage.tsx`, `InstituteLectures.tsx`, `FreeLectures.tsx`

**`FreeLectures.tsx` — specific fix (lines 58–59):**

```typescript
// REMOVE:
const isInstituteAdmin = instituteUserType === 'INSTITUTE_ADMIN' || instituteUserType === 'INSTITUTEADMIN';
const isTeacher = instituteUserType === 'TEACHER';

// ADD:
const { canCreate, canUpdate, canDelete } = usePermission('academics.lectures.subject');
// (or 'academics.lectures.class' depending on context)
```

**All other lecture files:**

```typescript
// REMOVE: userRole === 'Teacher' || userRole === 'InstituteAdmin' checks
// ADD:
const featureKey = selectedSubject
  ? 'academics.lectures.subject'
  : selectedClass
    ? 'academics.lectures.class'
    : 'academics.lectures.class';
const { canCreate, canUpdate, canDelete, canView } = usePermission(featureKey);
```

---

<a name="part-10"></a>
## Part 10 — Results.tsx + Grades.tsx + Grading.tsx

**Pattern in all three:**

```typescript
// REMOVE: AccessControl.hasPermission(userRole, 'create-result')
// REMOVE: AccessControl.hasPermission(userRole, 'edit-grade')
// REMOVE: AccessControl.hasPermission(userRole, 'grade-assignments')

// ADD:
const { canCreate, canUpdate, canDelete, canReport } = usePermission('academics.results');
// For Grades/Grading use 'academics.exams' or 'academics.results' (same feature scope)

// Replace all AccessControl calls:
// 'create-result'      → canCreate
// 'edit-result'        → canUpdate
// 'delete-result'      → canDelete
// 'view-results'       → canView
// 'grade-assignments'  → canCreate (grading IS creating a result)
// 'create-grade'       → canCreate
// 'edit-grade'         → canUpdate
// 'delete-grade'       → canDelete
```

---

<a name="part-11"></a>
## Part 11 — Classes.tsx + ClassSubjects.tsx

**`Classes.tsx` (lines 127+):**

```typescript
// REMOVE:
const isInstituteAdmin = userRole === 'InstituteAdmin';
const canEdit   = AccessControl.hasPermission(userRole, 'edit-class');
const canDelete = AccessControl.hasPermission(userRole, 'delete-class');

// ADD:
const { canCreate, canUpdate, canDelete } = usePermission('academics.classes');
```

**`ClassSubjects.tsx` (lines 153–154):**

```typescript
// REMOVE:
const isInstituteAdmin = userRole === 'InstituteAdmin';
const isTeacher = userRole === 'Teacher';

// ADD:
const { canCreate, canUpdate, canDelete } = usePermission('academics.subjects');
// For enrollment-specific actions:
const { canCreate: canEnroll } = usePermission('academics.classes');
```

---

<a name="part-12"></a>
## Part 12 — `SMS.tsx`

**Current problems:**
1. Line 212: `const allowedRoles = new Set(['InstituteAdmin', 'INSTITUTE_ADMIN']); if (!allowedRoles.has(String(instituteRole))) → blocked`
2. Lines 727, 729: `value: 'STUDENTS'`, `value: 'TEACHERS'` hardcoded recipient types
3. Line 753, 787: `role={String(instituteRole || 'User')}` passed as prop

**Changes:**

#### Change 1 — Replace access gate

```typescript
// REMOVE: const allowedRoles = new Set([...])
// ADD:
const { canCreate } = usePermission('communication.sms');
if (!canCreate) return <AccessDenied featureName="SMS" />;
```

#### Change 2 — Replace recipient type dropdown with dynamic user types

```typescript
// REMOVE hardcoded 'STUDENTS', 'TEACHERS'
// The SMS recipient picker needs to list user types:
import { useUserTypes } from '@/hooks/useUserTypes';
const { userTypes } = useUserTypes();

// In the recipient type select:
{userTypes.map(ut => (
  <option key={ut.id} value={ut.id}>
    {ut.name}
  </option>
))}
// Also keep 'ALL' option
```

#### Change 3 — API call for SMS recipients

The API endpoint currently is `/sms/institute/${id}/recipients?type=STUDENT`. This must be updated to accept a `userTypeId` param (see Part 21 for backend change).

```typescript
// REMOVE: /sms/.../recipients?type=STUDENTS
// ADD:    /sms/.../recipients?userTypeId=${selectedUserTypeId}
```

---

<a name="part-13"></a>
## Part 13 — Notifications

**Files:** `CreateNotificationButton.tsx`, `NotificationsPage.tsx`, `NotificationManagement.tsx`, `CreateNotificationForm.tsx`

**Current pattern in all four (lines vary):**

```typescript
const isInstituteAdmin = instituteUserType === 'INSTITUTE_ADMIN' || instituteUserType === 'INSTITUTEADMIN';
const isTeacher = instituteUserType === 'TEACHER';
// Used to show/hide create notification button and management UI
```

**Changes in all four files:**

```typescript
// REMOVE all isInstituteAdmin / isTeacher checks

// ADD in each file:
const { canCreate, canView } = usePermission('communication.push');

// Replace:
// (isInstituteAdmin || isTeacher) → canCreate
// isInstituteAdmin only → canCreate  (management is same permission)
```

---

<a name="part-14"></a>
## Part 14 — Attendance Components

**Files:** `Attendance.tsx`, `AttendanceMarkers.tsx`, `QRAttendance.tsx`, `admin-attendance/AttendanceByUserType.tsx`

**`AttendanceMarkers.tsx`:**

```typescript
// REMOVE: AccessControl.hasPermission(userRole, 'create-attendance-marker')
// ADD:
const { canCreate, canUpdate, canDelete } = usePermission('attendance.class');
```

**`admin-attendance/AttendanceByUserType.tsx`:**

This component currently lists users by type for attendance. Replace the hardcoded type filter with dynamic user types:

```typescript
// REMOVE: hardcoded filter 'STUDENT' | 'TEACHER' | etc.
// ADD:
const { userTypes } = useUserTypes();
// Render a tab or select per user type
```

---

<a name="part-15"></a>
## Part 15 — Payment Components

**Files:** `CreateClassPaymentForm.tsx`, `CreateSubjectPaymentForm.tsx`, `CreatePaymentDialog.tsx`, `Payments.tsx`

**Pattern to replace:**

```typescript
// REMOVE: 'STUDENT' | 'TEACHER' hardcoded recipient types in payment forms
// These appear as "Who pays this fee?" selectors

// ADD: use useUserTypes() to list all institute user types
// The payment system should be able to target any user type, not just students
const { userTypes } = useUserTypes();
// In the recipient selector:
{userTypes.map(ut => (
  <SelectItem key={ut.id} value={ut.id}>{ut.name}</SelectItem>
))}
```

**Access gates:**

```typescript
// REMOVE: isInstituteAdmin checks
// ADD:
const { canCreate } = usePermission('payments.class');   // or 'payments.subject'
```

---

<a name="part-16"></a>
## Part 16 — Dashboard Components

**Files:** `Dashboard.tsx`, `DesktopDashboard.tsx`, `MobileDashboard.tsx`, `DashboardStatCards.tsx`, `DashboardWidgets.tsx`, `InstituteDashboardView.tsx`

**Pattern:**

```typescript
// REMOVE: userRole === 'Student' / userRole === 'Teacher' / userRole === 'InstituteAdmin' checks
// that decide which dashboard sections to show

// ADD: use permission checks for each section:
const { canView: canViewAttendance }  = usePermission('attendance.class');
const { canView: canViewHomework }    = usePermission('academics.homework');
const { canView: canViewPayments }    = usePermission('payments.class');
const { canView: canViewStudents }    = usePermission('services.user_management');
const { canReport: canViewReports }   = usePermission('academics.results');

// Each dashboard widget is shown/hidden by its permission:
{canViewAttendance && <AttendanceWidget />}
{canViewHomework && <HomeworkWidget />}
{canViewPayments && <PaymentWidget />}
{canViewStudents && <StudentsWidget />}
```

**`DashboardChildrenCard.tsx`:**

```typescript
// Keep this as-is — it's specifically for parent viewing mode (isViewingAsParent context)
// Not a permissions issue, it's a context-switching feature
```

---

<a name="part-17"></a>
## Part 17 — StudyMaterials + HomeworkSubmissionsDialog + SubjectDashboard

**`StudyMaterials.tsx`:**

```typescript
// REMOVE: userRole === 'Teacher' || userRole === 'InstituteAdmin' for upload button
// ADD:
const { canCreate } = usePermission('academics.study_materials');
{canCreate && <UploadButton />}
```

**`HomeworkSubmissionsDialog.tsx`:**

```typescript
// REMOVE: AccessControl.hasPermission(userRole, 'view-homework-submissions')
// ADD:
const { canReport } = usePermission('academics.homework');
if (!canReport) return null;
```

**`SubjectDashboard.tsx`:**

```typescript
// REMOVE: multiple AccessControl + role checks for what sections to show
// ADD: per-section permission checks as in Part 16 pattern
```

---

<a name="part-18"></a>
## Part 18 — `InstituteSettingsPage.tsx`

**Current:** `const isInstituteAdmin = instituteRole === 'InstituteAdmin'` (line 131)

**Change:**

```typescript
// REMOVE:
const instituteRole = useInstituteRole();
const isInstituteAdmin = instituteRole === 'InstituteAdmin';

// ADD:
const { canView: canViewSettings, canUpdate: canUpdateSettings } = usePermission('services.features');
// Settings page visibility is controlled by this permission
// isInstituteAdmin usages → replace with canUpdateSettings
```

---

<a name="part-19"></a>
## Part 19 — Students/Teachers/Parents → "Users" terminology

**The class section now uses `institute_class_users` (renamed from `institute_class_students`). The frontend must reflect this.**

### Files that call `student`-named APIs or show "Students" label:

**`Students.tsx` component:**
- The component itself can stay — but the label must come from the institute's user type names
- The API call must shift from `/institute-class-students` to `/institute-class-users`

**`UnverifiedStudents.tsx`:**
```typescript
// API call change:
// REMOVE: GET /institute-class-students?status=pending
// ADD:    GET /institute-class-users?status=pending&userTypeId=<studentTypeId>
```

**`AssignStudentsDialog.tsx` and `AssignSubjectStudentsDialog.tsx`:**

```typescript
// These dialogs assign users to classes/subjects.
// REMOVE "student" from labels and API paths
// Labels should read "Enroll User" not "Enroll Student"
// API: endpoint changes from /class-students to /class-users (Part 21)
```

**`useInstituteLabels.ts` — critical hook:**

This hook already has some label customization. Extend it:

```typescript
// src/hooks/useInstituteLabels.ts — ADD:
export const useInstituteLabels = () => {
  const { userTypes } = useUserTypes();

  // Find the student-like and teacher-like types by slug
  const studentType = userTypes.find(ut => ut.slug === 'student');
  const teacherType = userTypes.find(ut => ut.slug === 'teacher');

  return {
    // existing labels (subjectLabel, classLabel) ...
    studentLabel: studentType?.name ?? 'Student',
    teacherLabel: teacherType?.name ?? 'Teacher',
    usersLabel:   'Users',  // generic label for all institute users
  };
};
```

Then throughout the codebase, replace hardcoded "Student" / "Teacher" text labels with:

```typescript
const { studentLabel, teacherLabel } = useInstituteLabels();
// "Enroll Student" → `Enroll ${studentLabel}`
// "View Students"  → `View ${studentLabel}s`
```

### Class section heading rename

**`InstituteUsers.tsx` tab labels:**

```typescript
// REMOVE hardcoded tab labels: "Students", "Teachers", "Admins", "Markers"
// ADD: render userTypes dynamically, show each type's name as tab label
```

---

<a name="part-20"></a>
## Part 20 — API Layer Changes

**File:** `src/api/instituteStudents.api.ts`

This file has endpoints referencing `class-students` and `subject-students`. Rename to match the backend table rename:

```typescript
// All functions that call /institute-class-students endpoints:
// CHANGE to /institute-class-users

// Example:
// REMOVE: `/institute-class-students/institute/${instituteId}/class/${classId}`
// ADD:    `/institute-class-users/institute/${instituteId}/class/${classId}`
```

**File:** `src/api/institute.api.ts`

```typescript
// REMOVE: export type InstituteUserType = 'STUDENT' | 'TEACHER' | 'INSTITUTE_ADMIN' | 'ATTENDANCE_MARKER';
// ADD:    The userType is now a string ID from the institute_user_types table.
//         For places that still need the legacy enum for the old API, keep it but mark as deprecated:
/** @deprecated Use userTypes.api.ts instead */
export type LegacyInstituteUserType = 'STUDENT' | 'TEACHER' | 'INSTITUTE_ADMIN' | 'ATTENDANCE_MARKER' | 'PARENT';
```

**File:** `src/api/instituteClasses.api.ts`

```typescript
// Update any endpoint that sends instituteUserType in the body to send primaryUserTypeId instead
```

---

<a name="part-21"></a>
## Part 21 — Backend Implementation Gaps to Close

The frontend migration above requires these backend endpoints that are NOT yet implemented. Each is a new feature the backend must add.

### Gap 1: `GET /institute-users/institute/:id/users?userTypeId=42`

Currently the endpoint is `/institute-users/institute/:id/users/STUDENT` (path param as enum).

**Required change:**
- Accept `?userTypeId=42` query param
- Also accept `?userTypeSlug=student` as a fallback for old clients
- Keep old path param route working for backward compat

**Backend file:** `src/modules/institute_mudules/institue_user/` (the controller for institute users)

```typescript
@Get('institute-users/institute/:id/users')
async getInstituteUsersByType(
  @Param('id') id: string,
  @Query('userTypeId') userTypeId?: string,
  @Query('userTypeSlug') userTypeSlug?: string,
) {
  return this.instituteUserService.getUsersByType(id, { userTypeId, userTypeSlug });
}
```

### Gap 2: `GET /institute-class-users/institute/:id/class/:classId`

Currently at `/institute-class-students/...` — the table rename in the RBAC migrations renames the DB table but the API path still says `class-students`.

**Required change:** Add new routes at `class-users` while keeping `class-students` routes active (they query the renamed table, so they still work for backward compat).

### Gap 3: SMS recipients endpoint — accept `userTypeId`

Current: `GET /sms/institute/:id/recipients?type=STUDENT`

**Required:** `GET /sms/institute/:id/recipients?userTypeId=42`

The backend SMS service needs to join `institute_user` on `primary_user_type_id = :userTypeId` instead of filtering by the old enum.

### Gap 4: Payment target user type — accept `userTypeId`

Payment forms currently send `recipientType: 'STUDENT'`. This must accept a `primaryUserTypeId` instead.

### Gap 5: `GET /institutes/:id/user-types/:typeId/members` (optional, useful)

A convenience endpoint to get all institute users belonging to a specific user type. Used for the bulk actions in `InstituteUsers.tsx`.

---

<a name="part-22"></a>
## Part 22 — Complete File Change Checklist

### New files to create

```
src/
  hooks/
    useMyRbacContext.ts          ✓ (in RBAC_SYSTEM_ADMIN_FRONTEND.md)
    usePermission.ts             ✓ (in RBAC_SYSTEM_ADMIN_FRONTEND.md)
    useUserTypes.ts              ← Part 01-C above
  api/
    userTypes.api.ts             ✓ (in RBAC_SYSTEM_ADMIN_FRONTEND.md)
  types/
    rbac.types.ts                ✓ (in RBAC_SYSTEM_ADMIN_FRONTEND.md)
  components/
    common/
      AccessDenied.tsx           ← Part 06 above
    institute-settings/
      UserTypesManager.tsx       ✓ (in RBAC_SYSTEM_ADMIN_FRONTEND.md)
      PermissionMatrixEditor.tsx ✓ (in RBAC_SYSTEM_ADMIN_FRONTEND.md)
    users/
      AssignUserTypeDialog.tsx   ✓ (in RBAC_SYSTEM_ADMIN_FRONTEND.md)
```

### Files to edit — by priority

#### Priority 1 — Foundation (do first, others depend on these)
| File | Change |
|------|--------|
| `src/hooks/useInstituteRole.ts` | Add `useInstituteUserTypeSlug` export |
| `src/hooks/useInstituteLabels.ts` | Add `studentLabel`, `teacherLabel` dynamic from user types |
| `src/api/institute.api.ts` | Mark `InstituteUserType` as deprecated, export `LegacyInstituteUserType` |
| `src/api/instituteStudents.api.ts` | Update `class-students` → `class-users` endpoints |

#### Priority 2 — User creation/assignment forms (most visible)
| File | Change |
|------|--------|
| `src/components/forms/CreateInstituteUserForm.tsx` | Load user types from API, replace hardcoded STUDENT/TEACHER select |
| `src/components/forms/AssignUserMethodsDialog.tsx` | 4 duplicate SelectItem blocks → `<UserTypeSelectField />` |
| `src/components/forms/AssignUserForm.tsx` | Same SelectItem replacement |
| `src/components/InstituteUsers.tsx` | `type UserType` → dynamic; tab dropdown → dynamic; access gate → `usePermission` |
| `src/components/InstituteUsersFilters.tsx` | Hardcoded type filter → dynamic user types |

#### Priority 3 — Academic components
| File | Change |
|------|--------|
| `src/components/Homework.tsx` | All role checks → `usePermission('academics.homework')` |
| `src/components/Exams.tsx` | → `usePermission('academics.exams')` |
| `src/components/forms/CreateExamForm.tsx` | Role gate → `canCreate` |
| `src/components/forms/UpdateExamForm.tsx` | Role gate → `canUpdate` |
| `src/components/Lectures.tsx` | → `usePermission('academics.lectures.*')` |
| `src/components/FreeLectures.tsx` | `isInstituteAdmin`/`isTeacher` → `usePermission` |
| `src/components/forms/CreateLectureForm.tsx` | Role gate → `canCreate` |
| `src/components/forms/UpdateLectureForm.tsx` | Role gate → `canUpdate` |
| `src/components/Results.tsx` | `AccessControl` → `usePermission('academics.results')` |
| `src/components/Grades.tsx` | `AccessControl` → `usePermission('academics.results')` |
| `src/components/Grading.tsx` | `AccessControl` → `usePermission('academics.results')` |
| `src/components/StudyMaterials.tsx` | → `usePermission('academics.study_materials')` |
| `src/components/HomeworkSubmissionsDialog.tsx` | `AccessControl` → `canReport` |
| `src/components/Classes.tsx` | `isInstituteAdmin` → `usePermission('academics.classes')` |
| `src/components/ClassSubjects.tsx` | `isInstituteAdmin`/`isTeacher` → `usePermission('academics.subjects')` |

#### Priority 4 — Communication & notifications
| File | Change |
|------|--------|
| `src/components/SMS.tsx` | Access gate + recipient types → `usePermission` + dynamic user types |
| `src/components/notifications/CreateNotificationButton.tsx` | `isInstituteAdmin`/`isTeacher` → `canCreate` |
| `src/pages/NotificationsPage.tsx` | Same |
| `src/components/notifications/NotificationManagement.tsx` | Same |
| `src/components/forms/CreateNotificationForm.tsx` | Same |

#### Priority 5 — Layout / navigation
| File | Change |
|------|--------|
| `src/components/layout/Sidebar.tsx` | Add `featureKey` to nav items; replace `AccessControl.hasPermission` filter; add user type chip in profile area |
| `src/components/AppContent.tsx` | Add `<AccessDenied>` wrappers on sensitive routes |
| `src/pages/InstituteSettingsPage.tsx` | `isInstituteAdmin` → `canUpdateSettings` from `usePermission` |

#### Priority 6 — Rename students → users in class context
| File | Change |
|------|--------|
| `src/components/forms/AssignStudentsDialog.tsx` | Labels + API path |
| `src/components/forms/AssignSubjectStudentsDialog.tsx` | Labels + API path |
| `src/components/UnverifiedStudents.tsx` | API path + labels |
| `src/components/students/ClassEnrollmentTypePanel.tsx` | Labels |

#### Priority 7 — Dashboard & misc
| File | Change |
|------|--------|
| `src/components/Dashboard.tsx` | Per-section `usePermission` checks |
| `src/components/dashboard/DashboardStatCards.tsx` | Permission-gated cards |
| `src/components/dashboard/DashboardWidgets.tsx` | Permission-gated widgets |
| `src/components/dashboard/InstituteDashboardView.tsx` | Permission-gated sections |
| `src/pages/SubjectDashboard.tsx` | `AccessControl` → `usePermission` |
| `src/components/AttendanceMarkers.tsx` | `AccessControl` → `usePermission('attendance.class')` |
| `src/pages/HomeworkSubmissions.tsx` | `AccessControl` → `canReport` |
| `src/pages/SubjectSubmissions.tsx` | `AccessControl` → `canReport` |
| `src/components/CalendarMonthView.tsx` | `isTeacherOrStudentView` → permission check |

### Backend gaps to close (must match this frontend)
| Task | What to add |
|------|-------------|
| `GET /institute-users/institute/:id/users?userTypeId=` | Accept query param instead of path enum |
| `GET /institute-class-users/...` routes | Alias for renamed class-students routes |
| SMS recipients endpoint | Accept `userTypeId` query param |
| Payment forms | Accept `primaryUserTypeId` |

---

## Migration Order (safe, zero-downtime)

```
Week 1:  Part 01 — Foundation hooks (useUserTypes, usePermission, useMyRbacContext)
Week 1:  Part 02 + 03 — InstituteUsers + CreateInstituteUserForm (most visible to admins)
Week 2:  Part 04 — AssignUserMethodsDialog
Week 2:  Part 05 — Sidebar (add featureKey to items, add user type chip)
Week 3:  Parts 07–11 — Academic components (Homework, Exams, Lectures, Results, Grades, Classes)
Week 3:  Parts 12–13 — Communication (SMS, Notifications)
Week 4:  Parts 14–16 — Attendance, Payments, Dashboard
Week 4:  Part 19 — Student/Teacher label rename using useInstituteLabels
Week 5:  Part 06 — AppContent route guards
Week 5:  Clean up: delete unused AccessControl calls, remove old UserType enum imports
```

Each week's changes are independently deployable — old `useInstituteRole` and `AccessControl` keep working until replaced.
