# Suraksha LMS — Custom Institute User Types & RBAC System
## Complete Design Document · Backend + Frontend Implementation Requirements

> **Purpose:** Design a fully custom, per-institute Role-Based Access Control (RBAC) system where institute admins define their own user types, assign those types to users, and control per-feature, per-action permissions for each type — across institute, class, and subject levels.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current System Analysis](#2-current-system-analysis)
3. [Problems With the Current Model](#3-problems-with-the-current-model)
4. [Proposed Architecture](#4-proposed-architecture)
5. [New vs Changed Tables](#5-new-vs-changed-tables)
6. [Migration Path (Step by Step)](#6-migration-path-step-by-step)
7. [Permission Matrix Design](#7-permission-matrix-design)
8. [Multi-Role per User Design](#8-multi-role-per-user-design)
9. [API Endpoints Required](#9-api-endpoints-required)
10. [Frontend Implementation](#10-frontend-implementation)
11. [Performance & Cost Analysis](#11-performance--cost-analysis)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Open Doors This Unlocks](#13-open-doors-this-unlocks)
14. [Risk Register](#14-risk-register)

---

## 1. Executive Summary

### What Is Being Proposed

Replace the current **hardcoded 5-role system** (`INSTITUTE_ADMIN`, `TEACHER`, `STUDENT`, `ATTENDANCE_MARKER`, `PARENT`) with a **fully custom, per-institute user type system** where:

- Each institute defines its own user types (e.g., "Vice Principal", "Lab Assistant", "Part-Time Teacher")
- Each user type gets a **permission matrix** — per feature, per action (`create`, `update`, `delete`, `view`, `reporting`)
- A single user can hold **different roles in different subjects** (e.g., Teacher in Mathematics, Student in English)
- Institute admins toggle this through a clean UI — identical to the feature toggle UI already built
- Class-level student tables are upgraded to **class users** — any user type, not just students

### Key Insight

> The current `institute_class_students` table restricts class membership to the `Student` type. By renaming it to `institute_class_users` and removing that restriction, a user can be a Teacher in one class and a Student in another — opening massive flexibility without breaking existing data.

### Scale of Change

| Layer | Scope |
|-------|-------|
| New DB tables | 3 (user_types, feature_permissions, user_type_assignments) |
| Modified DB tables | 2 (institute_class_students → users, institute_class_subject_students → users) |
| New API endpoints | ~18 |
| Modified API endpoints | ~12 |
| New frontend pages | 2 |
| Modified frontend components | ~8 |
| DB migrations | 4–5 |
| Estimated backend dev time | 6–10 days |
| Estimated frontend dev time | 4–6 days |

---

## 2. Current System Analysis

### 2.1 Current User Type Model

```
Global UserType (users.userType):
  SUPER_ADMIN | ORGANIZATION_MANAGER | USER | USER_WITHOUT_PARENT | USER_WITHOUT_STUDENT

Institute-Level Role (institute_user.instituteUserType):
  INSTITUTE_ADMIN | TEACHER | STUDENT | ATTENDANCE_MARKER | PARENT
```

These are **hardcoded enums**. Every permission check in the codebase does:
```typescript
if (userRole === 'Teacher') { ... }
if (userRole === 'InstituteAdmin') { ... }
```

### 2.2 Current Enrollment Chain

```
User → institute_user (role: STUDENT)
     → institute_class_students (studentUserId FK → students table)
         → institute_class_subject_students (studentId FK → users table)
```

**Critical Issue:** `institute_class_students` has `studentUserId` pointing to the `students` table — meaning **only users with a student profile can join a class**. Teachers can't be "in" a class except via `classTeacherId` (one teacher per class max).

### 2.3 Current Feature Access

Features are either **on or off** per institute via `institute_feature_toggles`. There is **no per-role feature access** — either everyone sees it or no one does.

### 2.4 Current Permission Enforcement

Permissions are enforced by:
1. JWT token contains `instituteUserType` (IA/T/S/AM/P compact codes)
2. `JwtAuthGuard` validates the token
3. Controllers/services check `userType === 'Teacher'` etc. inline

---

## 3. Problems With the Current Model

| Problem | Impact |
|---------|--------|
| Only 5 fixed roles — can't create "Vice Principal" or "Lab Assistant" | Can't serve real school org charts |
| A Teacher can't be a Student in another subject in the same institute | Real scenario for tuition institutes |
| Feature access is all-or-nothing — can't give Teachers read-only reporting | Lost granularity |
| `institute_class_students` only accepts users with a student profile | Locks out non-student types from classes |
| No way to give custom staff limited admin access | Need secondary admins, HODs, etc. |
| Changing a user's role requires modifying the hardcoded enum | Not maintainable |
| No audit trail for who has what permission | Compliance risk |

---

## 4. Proposed Architecture

### 4.1 Architecture Overview

```
Institute
├── InstituteUserType (custom types defined per institute)
│   ├── name: "Vice Principal"
│   ├── baseRole: TEACHER  ← fallback for legacy checks
│   └── FeaturePermission[] (per feature per action)
│
├── InstituteUser
│   └── primaryUserTypeId → InstituteUserType
│
├── InstituteClassUser (replaces InstituteClassStudent)
│   └── userTypeId → InstituteUserType  ← per-class role override
│
└── InstituteClassSubjectUser (replaces InstituteClassSubjectStudent)
    └── userTypeId → InstituteUserType  ← per-subject role override
```

### 4.2 Permission Resolution Order

```
1. Check subject-level userTypeId (most specific)
2. Fall back to class-level userTypeId
3. Fall back to institute-level primaryUserTypeId
4. Fall back to baseRole (legacy compatibility)
```

This gives full flexibility: a user can be Teacher at institute level, but Student in a specific subject within that institute.

### 4.3 Feature Permission Matrix

```
InstituteUserType "Vice Principal"
└── FeaturePermissions:
    ├── feature: "institute-users"    → view: true,  create: false, update: false, delete: false, reporting: true
    ├── feature: "daily-attendance"   → view: true,  create: false, update: false, delete: false, reporting: true
    ├── feature: "institute-payments" → view: true,  create: false, update: false, delete: false, reporting: true
    ├── feature: "institute-settings" → view: false, create: false, update: false, delete: false, reporting: false
    └── ...
```

---

## 5. New vs Changed Tables

### 5.1 NEW TABLE: `institute_user_types`

```sql
CREATE TABLE institute_user_types (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  institute_id  BIGINT NOT NULL,
  name          VARCHAR(100) NOT NULL,        -- "Vice Principal", "Lab Assistant"
  description   TEXT NULL,
  base_role     ENUM('INSTITUTE_ADMIN','TEACHER','STUDENT','ATTENDANCE_MARKER','PARENT') NOT NULL DEFAULT 'TEACHER',
                -- base_role is used for legacy guards that check hardcoded roles
                -- NEW: CUSTOM is also valid but falls back to TEACHER permissions
  color         VARCHAR(7) NULL,              -- UI badge color, e.g. "#6366F1"
  icon          VARCHAR(50) NULL,             -- lucide icon name
  sort_order    INT NOT NULL DEFAULT 0,
  is_system     BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = cannot be deleted (migrated legacy roles)
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_institute_type_name (institute_id, name),
  KEY idx_institute_user_types_institute (institute_id)
);
```

**Pre-populated system rows (via migration) for every institute:**

| id | name | base_role | is_system |
|----|------|-----------|-----------|
| auto | Institute Admin | INSTITUTE_ADMIN | TRUE |
| auto | Teacher | TEACHER | TRUE |
| auto | Student | STUDENT | TRUE |
| auto | Attendance Marker | ATTENDANCE_MARKER | TRUE |
| auto | Parent | PARENT | TRUE |

---

### 5.2 NEW TABLE: `institute_feature_permissions`

```sql
CREATE TABLE institute_feature_permissions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  institute_id    BIGINT NOT NULL,
  user_type_id    BIGINT UNSIGNED NOT NULL,   -- FK → institute_user_types.id
  feature_key     VARCHAR(100) NOT NULL,       -- FK → feature_catalog.key
  can_view        BOOLEAN NOT NULL DEFAULT TRUE,
  can_create      BOOLEAN NOT NULL DEFAULT FALSE,
  can_update      BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete      BOOLEAN NOT NULL DEFAULT FALSE,
  can_report      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_type_feature (user_type_id, feature_key),
  KEY idx_ifp_institute (institute_id),
  KEY idx_ifp_user_type (user_type_id),
  CONSTRAINT fk_ifp_user_type FOREIGN KEY (user_type_id) REFERENCES institute_user_types(id) ON DELETE CASCADE
);
```

**Default permission matrix for system types (seeded via migration):**

| Feature | Admin | Teacher | Student | AttMarker | Parent |
|---------|-------|---------|---------|-----------|--------|
| classes | CVUDR | V | V | - | - |
| institute-subjects | CVUDR | V | V | - | - |
| institute-lectures | CVUDR | CVUD | V | - | V |
| daily-attendance | CVUDR | CVU | V | CVU | V |
| institute-users | CVUDR | V | - | - | - |
| institute-settings | CVUDR | - | - | - | - |
| institute-payments | CVUDR | V | V | - | - |
| sms | CVUDR | - | - | - | - |
| device-management | CVUDR | - | - | - | - |
| lectures | CVUDR | CVUD | V | - | V |
| homework | CVUDR | CVUD | V | - | V |
| exams | CVUDR | CVUD | V | - | V |
| grading | CVUDR | CVUDR | - | - | - |
| ... | ... | ... | ... | ... | ... |

> C=create, V=view, U=update, D=delete, R=reporting

---

### 5.3 MODIFIED TABLE: `institute_user` — Add `primary_user_type_id`

```sql
ALTER TABLE institute_user
  ADD COLUMN primary_user_type_id BIGINT UNSIGNED NULL
    COMMENT 'FK to institute_user_types. NULL = use legacy instituteUserType',
  ADD CONSTRAINT fk_iu_user_type
    FOREIGN KEY (primary_user_type_id) REFERENCES institute_user_types(id) ON DELETE SET NULL;
```

**Migration strategy:**
- After adding `institute_user_types` system rows for each institute, run:
```sql
UPDATE institute_user iu
  JOIN institute_user_types iut
    ON iut.institute_id = iu.institute_id
   AND iut.base_role = iu.institute_user_type
   AND iut.is_system = TRUE
SET iu.primary_user_type_id = iut.id;
```

---

### 5.4 MODIFIED TABLE: `institute_class_students` → `institute_class_users`

**Option A (Recommended): Add columns, keep old data, add new FK**

```sql
-- Step 1: Add new columns
ALTER TABLE institute_class_students
  ADD COLUMN user_id       BIGINT NULL     -- new generic user FK (replaces studentUserId for new enrollments)
    AFTER student_user_id,
  ADD COLUMN user_type_id  BIGINT UNSIGNED NULL  -- per-class role override
    AFTER user_id,
  ADD CONSTRAINT fk_ics_user_type
    FOREIGN KEY (user_type_id) REFERENCES institute_user_types(id) ON DELETE SET NULL;

-- Step 2: Backfill user_id from student_user_id
UPDATE institute_class_students SET user_id = student_user_id WHERE student_user_id IS NOT NULL;

-- Step 3: Rename table (no data loss)
RENAME TABLE institute_class_students TO institute_class_users;
```

**After migration, new enrollments use `user_id`. Legacy data keeps `student_user_id` populated too.**

---

### 5.5 MODIFIED TABLE: `institute_class_subject_students` → `institute_class_subject_users`

Same pattern:
```sql
ALTER TABLE institute_class_subject_students
  ADD COLUMN user_type_id BIGINT UNSIGNED NULL
    COMMENT 'Per-subject role override. NULL = use class or institute type',
  ADD CONSTRAINT fk_icss_user_type
    FOREIGN KEY (user_type_id) REFERENCES institute_user_types(id) ON DELETE SET NULL;

RENAME TABLE institute_class_subject_students TO institute_class_subject_users;
```

---

### 5.6 Summary: Table Changes

| Table | Change | Data Loss? |
|-------|--------|------------|
| `institute_user_types` | NEW | N/A |
| `institute_feature_permissions` | NEW | N/A |
| `institute_user` | ADD column `primary_user_type_id` | None |
| `institute_class_students` | ADD columns, RENAME to `institute_class_users` | None |
| `institute_class_subject_students` | ADD column, RENAME to `institute_class_subject_users` | None |

---

## 6. Migration Path (Step by Step)

### Phase 1 — Schema Addition (Non-Breaking)
```
Migration 1: Create institute_user_types + seed system types for all existing institutes
Migration 2: Create institute_feature_permissions + seed default matrix for all system types
Migration 3: Add primary_user_type_id to institute_user + backfill from instituteUserType
Migration 4: Add user_id + user_type_id to institute_class_students + backfill user_id
Migration 5: Add user_type_id to institute_class_subject_students
```

### Phase 2 — Code Dual-Read
- All permission checks read BOTH the old `instituteUserType` enum AND the new `primary_user_type_id`
- New type wins if set; old type used as fallback
- No breaking changes to existing behaviour

### Phase 3 — Rename Tables
```
Migration 6: RENAME institute_class_students → institute_class_users
Migration 7: RENAME institute_class_subject_students → institute_class_subject_users
```
- Update all TypeORM `@Entity('...')` decorators
- Update all service/repository references

### Phase 4 — Remove Legacy Hardcoding
- Remove hardcoded `if (role === 'Teacher')` checks, replace with permission matrix lookup
- Make `instituteUserType` enum a derived field (computed from `primary_user_type_id.base_role`)

### Phase 5 — New Admin UI
- Add "User Types" tab to institute settings
- Add permission matrix editor per type

---

## 7. Permission Matrix Design

### 7.1 Actions Per Feature

```typescript
interface FeaturePermission {
  featureKey: string;
  canView: boolean;       // Can see the page/section
  canCreate: boolean;     // Can create new records
  canUpdate: boolean;     // Can edit existing records
  canDelete: boolean;     // Can delete records
  canReport: boolean;     // Can access analytics/reporting views
}
```

### 7.2 UI: Permission Matrix Table

```
Institute Features               ENABLE  | CREATE | UPDATE | DELETE | VIEW | REPORT
──────────────────────────────────────────────────────────────────────────────────
▼ INSTITUTE LEVEL
  ─ Academics
  Classes                          ✓    |   ✓    |        |        |  ✓   |
  All Subjects                     ✓    |   ✓    |        |        |  ✓   |
  Lectures                         ✓    |        |        |        |  ✓   |   ✓

  ─ Attendance
  Mark Attendance                  ✓    |   ✓    |        |        |  ✓   |
  Daily Attendance                 ✓    |        |        |        |  ✓   |   ✓
  Advanced Attendance              ✓    |        |        |        |  ✓   |   ✓

  ─ Payments & Billing
  Institute Fees                   ✓    |        |        |        |  ✓   |   ✓
  Review Payments                  ✓    |        |   ✓    |        |  ✓   |

▼ SUBJECT LEVEL
  ─ Academics
  Lectures                         ✓    |   ✓    |   ✓    |        |  ✓   |
  Homework                         ✓    |        |        |        |  ✓   |
  Exams                            ✓    |        |        |        |  ✓   |
  Grading                          ✗    |        |        |        |      |
```

### 7.3 Permission Inheritance Rules

```
Feature disabled at institute level
  → ALL user types lose access regardless of permission matrix
  → Shows as grayed-out row in permission editor

Feature enabled at institute level
  → Per-type matrix applies
  → canView=false means the menu item is hidden for that type
  → canView=true but canCreate=false means read-only access
```

### 7.4 Backend Permission Check (New Pattern)

```typescript
// New utility — replaces all hardcoded role checks
async function checkPermission(
  userId: string,
  instituteId: string,
  featureKey: string,
  action: 'view' | 'create' | 'update' | 'delete' | 'report',
  classId?: string,
  subjectId?: string,
): Promise<boolean> {
  // 1. Check feature is enabled for institute
  const toggle = await featureToggleRepo.findOne({ instituteId, featureKey });
  if (toggle && !toggle.enabled) return false;

  // 2. Resolve effective user type (subject > class > institute)
  const userTypeId = await resolveEffectiveUserType(userId, instituteId, classId, subjectId);

  // 3. Look up permission matrix
  const perm = await permissionRepo.findOne({ userTypeId, featureKey });
  if (!perm) return true; // no explicit rule = allowed (default open)

  return perm[`can_${action}`];
}
```

---

## 8. Multi-Role per User Design

### 8.1 How It Works

A user is enrolled in an institute with ONE primary user type (`institute_user.primary_user_type_id`).

But when enrolled in a **specific class** or **specific subject**, they can have a **different user type** for that context:

```
User: Kavisha
├── institute_user: primaryUserTypeId = "Teacher" (base role: TEACHER)
├── institute_class_users (class: Grade 10 Science)
│   └── userTypeId = "Teacher"  → full teacher access in this class
└── institute_class_users (class: Grade 11 English)
    └── userTypeId = "Student"  → enrolled as a student in English class
```

**Subject level example:**
```
User: Nimal (enrolled as Teacher in institute)
├── Subject: Mathematics → userTypeId = "Teacher"    → can create lectures, grade
└── Subject: Drama       → userTypeId = "Student"    → can only view lectures, submit
```

### 8.2 JWT Token Changes

Current JWT payload:
```json
{ "sub": "123", "instituteId": "109", "role": "T" }
```

New JWT payload (backward compatible):
```json
{
  "sub": "123",
  "instituteId": "109",
  "role": "T",              ← keep for backward compat (base_role compact code)
  "userTypeId": "42",       ← new: institute_user_types.id
  "userTypeName": "Teacher" ← new: for display
}
```

For class/subject scoped tokens (institute-login generates these):
```json
{
  "sub": "123",
  "instituteId": "109",
  "classId": "1003",
  "subjectId": "55",
  "role": "S",              ← resolved base_role for this context
  "userTypeId": "7",        ← resolved type for this subject
  "userTypeName": "Student"
}
```

---

## 9. API Endpoints Required

### 9.1 User Type Management (InstituteAdmin only)

```
GET    /institutes/:id/user-types                  List all user types for institute
POST   /institutes/:id/user-types                  Create new user type
GET    /institutes/:id/user-types/:typeId           Get one user type + permissions
PATCH  /institutes/:id/user-types/:typeId           Update user type (name, color, etc.)
DELETE /institutes/:id/user-types/:typeId           Delete custom type (not system types)
POST   /institutes/:id/user-types/:typeId/clone     Clone a type with its permissions
```

### 9.2 Feature Permission Matrix (InstituteAdmin only)

```
GET    /institutes/:id/user-types/:typeId/permissions          Get full matrix
PUT    /institutes/:id/user-types/:typeId/permissions          Replace full matrix
PATCH  /institutes/:id/user-types/:typeId/permissions/:featureKey  Update one feature row
```

### 9.3 User Type Assignment

```
PATCH  /institutes/:id/users/:userId/user-type                  Set primary user type
PATCH  /institutes/:id/classes/:classId/users/:userId/user-type Set class-level override
PATCH  /institutes/:id/classes/:classId/subjects/:subjectId/users/:userId/user-type  Set subject-level override
```

### 9.4 Class Users (replaces class students)

```
GET    /institutes/:id/classes/:classId/users                   List class users (any type)
POST   /institutes/:id/classes/:classId/users                   Enroll user in class with type
DELETE /institutes/:id/classes/:classId/users/:userId           Remove from class
```

### 9.5 Subject Users (replaces subject students)

```
GET    /institutes/:id/classes/:classId/subjects/:subjectId/users
POST   /institutes/:id/classes/:classId/subjects/:subjectId/users
DELETE /institutes/:id/classes/:classId/subjects/:subjectId/users/:userId
```

### 9.6 Permission Check (used internally + by frontend)

```
GET    /institutes/:id/my-permissions?feature=lectures&classId=&subjectId=
       → { canView, canCreate, canUpdate, canDelete, canReport }
GET    /institutes/:id/my-user-type?classId=&subjectId=
       → { userTypeId, userTypeName, baseRole, permissions: [...] }
```

---

## 10. Frontend Implementation

### 10.1 New Pages

#### A. User Types Management Page
**Route:** `/institute/:id/institute-settings?tab=user-types`

**Sections:**
1. **User Type List** — Cards showing each type with color/icon, member count, edit/delete buttons
2. **System Types** — Grayed out, non-deletable, shows "System Default" badge
3. **Create Type Dialog** — Name, description, base role (dropdown), color picker, icon picker

#### B. Permission Matrix Editor
**Route:** Opens as a drawer/modal from each user type card

**Layout:**
```
User Type: "Vice Principal"  [Base Role: Teacher ▾]  [Color] [Icon]

Features                    ENABLE  CREATE  UPDATE  DELETE  VIEW   REPORT
──────────────────────────────────────────────────────────────────────
▼ Institute Level
  ─ Academics
  Classes                     ●       ○       ○       ○      ●       ●
  Subjects                    ●       ○       ○       ○      ●       ●
  Lectures                    ●       ○       ○       ○      ●       ●

  ─ Attendance
  Mark Attendance             ●       ●       ○       ○      ●       ○
  Daily Attendance            ●       ○       ○       ○      ●       ●

  ─ Payments
  Institute Fees              ●       ○       ○       ○      ●       ●

▼ Subject Level
  Lectures                    ●       ○       ○       ○      ●       ○
  Grading                     ○
  ...

[Cancel]  [Save Changes (3 modified)]
```

**Notes:**
- Feature rows are disabled (grayed) if the feature is toggled OFF at institute level
- "ENABLE" column = whether this type can see the feature at all (overrides feature toggle for this type? No — feature toggle must be ON first)
- Clicking row header selects/deselects all actions in that row
- "VIEW" auto-checks when any other action is checked

### 10.2 Modified Components

#### A. `InstituteSettingsPage.tsx`
- Add "User Types" tab between "Session Limits" and "Features"
- Render `<UserTypesSettings />` component

#### B. `InstituteUsersPage.tsx` / User List
- Add "User Type" column showing custom type badge (color + name)
- Allow changing user type inline via dropdown

#### C. `DashboardQuickNav` / `FeaturesSection`
- Read permissions from `usePermissions()` hook instead of hardcoded role checks
- Hide menu items where `canView = false`

#### D. `useInstituteRole` hook
- Extend to return `{ baseRole, userTypeId, userTypeName, permissions }` instead of just role string

#### E. New `usePermissions` hook
```typescript
const usePermissions = (featureKey: string, classId?: string, subjectId?: string) => {
  // reads from cached /my-permissions endpoint
  return { canView, canCreate, canUpdate, canDelete, canReport, loading };
};
```

### 10.3 Frontend API File: `userTypesApi.ts`

```typescript
export const userTypesApi = {
  listUserTypes: (instituteId) => ...,
  createUserType: (instituteId, data) => ...,
  updateUserType: (instituteId, typeId, data) => ...,
  deleteUserType: (instituteId, typeId) => ...,
  getPermissions: (instituteId, typeId) => ...,
  updatePermissions: (instituteId, typeId, matrix) => ...,
  getMyPermissions: (instituteId, featureKey, classId?, subjectId?) => ...,
};
```

---

## 11. Performance & Cost Analysis

### 11.1 Current Permission Check Cost

```
Current: O(1)
  → Read role from JWT (already in memory)
  → if (role === 'Teacher') → done
  → 0 DB queries
  → ~0ms
```

### 11.2 New Permission Check Cost

```
New (worst case, no cache):
  → Query 1: institute_feature_toggles WHERE institute_id = ? AND feature_key = ?  (~2ms)
  → Query 2: institute_feature_permissions WHERE user_type_id = ? AND feature_key = ?  (~2ms)
  → Total: ~4ms per permission check
  → On a page with 10 features: potentially 40ms extra latency
```

### 11.3 Caching Strategy (Mandatory)

```
Level 1: JWT payload — include resolved permissions for common features
  → User logs in → server resolves top 20 feature permissions → encodes in JWT
  → Cost: ~5ms at login time
  → Benefit: 0 DB queries for common checks during session

Level 2: Redis/in-memory cache per (instituteId, userTypeId)
  → Cache full permission matrix for 5 minutes
  → Key: perm:{instituteId}:{userTypeId}
  → Invalidated when admin saves changes to that type's permissions
  → Cost: 1 Redis lookup (~0.5ms) vs 2 DB queries (~4ms)

Level 3: Frontend cache (already using cachedApiClient)
  → /my-permissions response cached for 5 minutes
  → forceRefresh on login and on permission change events
```

### 11.4 Server Resource Impact

| Metric | Current | New (no cache) | New (with cache) |
|--------|---------|----------------|-----------------|
| DB queries per page load | ~5–10 | ~5–30 | ~5–12 |
| RAM per request | ~1 KB | ~3 KB | ~1.5 KB |
| CPU per auth check | ~0.01ms | ~0.1ms | ~0.02ms |
| DB connection pool pressure | Low | Medium-High | Low |
| Monthly AWS RDS cost (estimate) | baseline | +30–50% without cache | +5–10% with cache |

### 11.5 Budget Estimate

| Item | Cost |
|------|------|
| Extra DB storage (new tables) | ~5MB per 1,000 users × institutes |
| Extra query load (with Redis cache) | +5–10% RDS cost |
| Redis cache instance (ElastiCache t3.micro) | ~$15/month |
| Development time (backend 8 days + frontend 5 days) | Developer cost |
| **Recommendation** | Add Redis before enabling this feature in prod |

### 11.6 Mitigation: Permission Matrix in JWT

To avoid ALL extra DB queries, encode a compact permission bitmap in the JWT:

```
Permissions bitmap (24 features × 5 actions = 120 bits = 15 bytes → base64 = 20 chars)
JWT field: "pb": "AAAB..." (permission bitmap)
```

On every request, decode bitmap in memory — **zero DB queries**. Invalidate JWT on permission change (force re-login or token refresh).

---

## 12. Implementation Roadmap

### Phase 1 — Foundation (Week 1–2)
- [ ] Create `institute_user_types` table + migration
- [ ] Seed system types for all existing institutes
- [ ] Create `institute_feature_permissions` table + migration
- [ ] Seed default permission matrix for system types
- [ ] Add `primary_user_type_id` to `institute_user` + backfill
- [ ] Basic CRUD API for user types
- [ ] Basic API for permission matrix

### Phase 2 — Class/Subject Users (Week 2–3)
- [ ] Add `user_id` + `user_type_id` to `institute_class_students`
- [ ] Backfill `user_id` from `student_user_id`
- [ ] Add `user_type_id` to `institute_class_subject_students`
- [ ] Rename tables (with backward-compat aliases)
- [ ] Update entity classes + module imports
- [ ] Update class enrollment APIs to accept any user type

### Phase 3 — Permission Enforcement (Week 3–4)
- [ ] Build `PermissionService.checkPermission()` utility
- [ ] Add Redis caching for permission matrices
- [ ] Add permission checks to feature endpoints
- [ ] Extend JWT to include `userTypeId` + `userTypeName`
- [ ] Build `/my-permissions` endpoint

### Phase 4 — Frontend (Week 4–5)
- [ ] `UserTypesSettings` component
- [ ] Permission matrix editor UI
- [ ] `usePermissions` hook
- [ ] Update sidebar/nav to use permission checks
- [ ] Update user list to show custom types
- [ ] User type assignment in user detail modal

### Phase 5 — Testing + Rollout (Week 5–6)
- [ ] Migration dry-run on staging
- [ ] Backward compat testing (old hardcoded role checks still work)
- [ ] Performance testing (with/without Redis cache)
- [ ] Feature flag: `CUSTOM_USER_TYPES_ENABLED` per institute

---

## 13. Open Doors This Unlocks

By upgrading `institute_class_students` to `institute_class_users`:

### 1. Multi-Role Users
A professional trainer at a music institute can be:
- **Teacher** in Guitar class
- **Student** in Music Theory class
- **Attendance Marker** for the Choir

### 2. Substitute Teachers
A teacher temporarily covering a class gets `userTypeId = Teacher` in that class for the duration.

### 3. Teaching Assistants
New custom type "Teaching Assistant" with:
- `canView` attendance: true
- `canCreate` attendance: false
- `canView` grading: true
- `canUpdate` grading: false (read-only)

### 4. Department Heads (HOD)
Custom type "Head of Department" with reporting access across all classes in their department but no create/delete.

### 5. Observers / Inspectors
Type "Inspector" — view only across all features. No create/update/delete anywhere.

### 6. Parent-Teachers
A parent enrolled as Teacher in specific subjects. Full dual context via subject-level type override.

### 7. Accurate Reporting
"Show me all users of type X" — proper reports because types are data, not enum values.

### 8. Cross-Institute Templates
Export a permission matrix template. Import in another institute. (Phase 2 feature.)

### 9. Timed Access
`expires_at` in `InstituteFeatureToggles` already supports time-limited feature access. Extend `institute_class_users` with `active_from`, `active_until` for substitute/temp access.

### 10. Granular SMS/Notification Targeting
Send SMS to "all Vice Principals" — now queryable via user type.

---

## 14. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Old hardcoded role checks break | High (during transition) | High | Dual-read pattern in Phase 2 |
| Performance regression without cache | Medium | Medium | Mandatory Redis before Phase 3 rollout |
| Admin accidentally locks themselves out | Low | High | Cannot disable INSTITUTE_ADMIN view permission for own type |
| Table rename breaks existing queries | Medium | High | Keep old table name as VIEW during transition period |
| JWT size bloat with permissions bitmap | Low | Low | Only add top 20 features to JWT, rest from cache |
| Data migration fails mid-run | Low | High | All migrations wrapped in transactions with rollback |
| Frontend permission checks bypassed | Medium | Medium | Server-side checks are authoritative — frontend is UI only |

---

## Appendix A: Recommended Migration SQL Order

```sql
-- 1. Create user types table
CREATE TABLE institute_user_types (...);

-- 2. Seed system types for all existing institutes
INSERT INTO institute_user_types (institute_id, name, base_role, is_system)
SELECT DISTINCT id, 'Institute Admin', 'INSTITUTE_ADMIN', TRUE FROM institutes
UNION ALL SELECT DISTINCT id, 'Teacher', 'TEACHER', TRUE FROM institutes
UNION ALL SELECT DISTINCT id, 'Student', 'STUDENT', TRUE FROM institutes
UNION ALL SELECT DISTINCT id, 'Attendance Marker', 'ATTENDANCE_MARKER', TRUE FROM institutes
UNION ALL SELECT DISTINCT id, 'Parent', 'PARENT', TRUE FROM institutes;

-- 3. Create permissions table
CREATE TABLE institute_feature_permissions (...);

-- 4. Seed default permissions (script iterates feature_catalog × system types)

-- 5. Backfill institute_user.primary_user_type_id
UPDATE institute_user iu
  JOIN institute_user_types iut
    ON iut.institute_id = iu.institute_id
   AND iut.base_role = iu.institute_user_type
   AND iut.is_system = TRUE
SET iu.primary_user_type_id = iut.id;

-- 6. Add columns to class students
ALTER TABLE institute_class_students ADD COLUMN user_id BIGINT NULL, ADD COLUMN user_type_id BIGINT UNSIGNED NULL;
UPDATE institute_class_students SET user_id = student_user_id;

-- 7. Rename tables (week 3+)
RENAME TABLE institute_class_students TO institute_class_users;
RENAME TABLE institute_class_subject_students TO institute_class_subject_users;
```

---

## Appendix B: TypeORM Entity Changes

### `InstituteUserEntity` additions
```typescript
@Column({ name: 'primary_user_type_id', nullable: true })
primaryUserTypeId?: number;

@ManyToOne(() => InstituteUserTypeEntity, { nullable: true, onDelete: 'SET NULL' })
@JoinColumn({ name: 'primary_user_type_id' })
primaryUserType?: InstituteUserTypeEntity;
```

### New `InstituteUserTypeEntity`
```typescript
@Entity('institute_user_types')
export class InstituteUserTypeEntity {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'institute_id' })
  instituteId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'base_role', type: 'enum',
    enum: ['INSTITUTE_ADMIN','TEACHER','STUDENT','ATTENDANCE_MARKER','PARENT'],
    default: 'TEACHER' })
  baseRole: string;

  @Column({ length: 7, nullable: true })
  color?: string;

  @Column({ length: 50, nullable: true })
  icon?: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => InstituteFeaturePermissionEntity, p => p.userType)
  permissions: InstituteFeaturePermissionEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### New `InstituteFeaturePermissionEntity`
```typescript
@Entity('institute_feature_permissions')
export class InstituteFeaturePermissionEntity {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'institute_id' })
  instituteId: number;

  @Column({ name: 'user_type_id', unsigned: true })
  userTypeId: number;

  @ManyToOne(() => InstituteUserTypeEntity, t => t.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_type_id' })
  userType: InstituteUserTypeEntity;

  @Column({ name: 'feature_key', length: 100 })
  featureKey: string;

  @Column({ name: 'can_view', default: true })
  canView: boolean;

  @Column({ name: 'can_create', default: false })
  canCreate: boolean;

  @Column({ name: 'can_update', default: false })
  canUpdate: boolean;

  @Column({ name: 'can_delete', default: false })
  canDelete: boolean;

  @Column({ name: 'can_report', default: false })
  canReport: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

---

*Document version: 1.0 · Generated: 2026-05-13 · Suraksha LMS*
