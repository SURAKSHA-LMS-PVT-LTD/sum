# Merge Analysis: thilinadhananjaya DB → Suraksha LMS

**Date:** 2026-05-18  
**Purpose:** Migrate all institutes from the legacy "thilinadhananjaya" database into the Suraksha LMS multi-tenant system, mapping their data to the existing schema.

---

## 1. Understanding the Two Systems

### Legacy System (thilinadhananjaya DB)
- **Structure:** Single-database, multi-institute but **without multi-tenancy**.
- **Known Institutes:** Winsma, Sihasma (and others listed in db-out.txt: IDs 100–109)
- **Data model assumption:** Each institute stores classes, students, parents, attendance, subjects, and payments — but they share the same flat tables, distinguished only by a column like `institute_id` or similar.
- **No parent↔student relation** — parents stored as extra data on the student record, not as linked entities.
- **Months-based system** — payments/fees likely tracked by month, not by a payment record entity.
- **Classes use plain names** — no UUID-based class IDs; class name likely = `"{institute_name} {class_name}"` or just plain name.

### Target System (Suraksha LMS — `suraksha_lms_db`)
- **Structure:** Full multi-tenant, UUID-based institutes, classes, subjects.
- **All entities are institute-scoped** — every table has `institute_id` (UUID).
- **Students → Users → Parents** — 3-table deep relation, each a separate entity with a unique `user_id`.
- **Classes** → UUID PK, scoped to institute.
- **Subjects** → UUID PK, scoped to institute.
- **Payments** → 3-level hierarchy: Institute / Class / Subject.
- **Attendance** → DynamoDB-mirrored table with sync status.
- **Calendar system** → Full academic calendar with events, overrides.

---

## 2. Data Mapping Plan

### 2.1 Institutes

| Legacy Field | Suraksha Field | Notes |
|---|---|---|
| `id` (INT) | — | Legacy numeric ID — **not used** in Suraksha (UUID) |
| `name` | `institutes.name` | Direct map |
| `subdomain` | `institutes.subdomain` | Direct map; NULL → generate from slug of name |
| `tier` | `institutes.tier` | Map: FREE→FREE, STARTER→STARTER |
| `custom_login_enabled` | `institutes.custom_login_enabled` | Direct map (0/1 → boolean) |

**Action:** INSERT each legacy institute as a new `institutes` row with a generated UUID.  
**Conflict Risk:** `code` (UNIQUE) and `email` (UNIQUE) must be generated — legacy system likely has no email/code for institutes.

---

### 2.2 Classes

Legacy classes are likely named `{class_name}` under an institute. In Suraksha:
- `institute_classes.id` = UUID (generate)
- `institute_classes.institute_id` = the new UUID of the migrated institute
- `institute_classes.name` = legacy class name
- `institute_classes.code` = UNIQUE per institute — must generate (e.g., `INST_CODE-CLASS_SLUG`)

**Known Issue — Class Naming Conflict:**  
If the legacy system has two institutes each with a class named "Grade 5", these become **two separate classes** under two different `institute_id` values — no conflict in Suraksha since `code` uniqueness is per-institute.

**Action:** For each legacy class, create a row in `institute_classes` with:
- New UUID
- `institute_id` = newly assigned UUID of parent institute
- `name` = legacy class name
- `code` = auto-generated slug (e.g., `WINSMA-GRADE5-2024`)
- `academic_year` = derive from legacy data or use a default (e.g., "2024")

---

### 2.3 Subjects

Legacy likely has subjects either as a column in class or as a `subjects` table.  
In Suraksha, subjects are **institute-scoped** with UUID PK and linked via `institute_class_subjects`.

**Mapping:**
- Create `subjects` rows: `institute_id` = new institute UUID, `name` = legacy subject name, `code` = generated slug
- Create `institute_class_subjects` rows linking class ↔ subject

---

### 2.4 Users (Students)

This is the most complex mapping. Legacy students are likely stored with personal info (name, DOB, address, etc.) without a separate `users` table for identity.

**Target structure requires:**
1. A row in `users` (9-digit random ID, user_type = STUDENT)
2. A row in `students` (PK = user_id)
3. A row in `institute_users` (PK composite: institute_id + user_id)
4. A row in `institute_class_students` (composite: institute_id + class_id + student_user_id)

**Steps per legacy student:**
1. Generate a unique 9-digit `user_id`
2. Map fields: name → first_name + last_name, phone, DOB, NIC, address, city, district, province
3. Set `user_type = STUDENT`, `is_active = true`
4. Create `students` row with `student_id` = legacy student code (if exists) or generate
5. Create `institute_users` row linking student to their institute
6. Create `institute_class_students` row for their class enrollment

---

### 2.5 Parents

Legacy system has **no separate parent entity** — parent info is stored as extra data on the student.

**Target structure:**
1. A row in `users` (user_type = PARENT)
2. A row in `parents` (linked via user_id)
3. Student's `father_id` / `mother_id` / `guardian_id` points to the parent row

**Migration Logic:**
- If legacy student has `father_name` / `father_phone` → create a User + Parent record
- Link student.father_id to the new parent
- If no parent data → skip (father_id, mother_id, guardian_id all nullable)

**Conflict/Issue:** Legacy parents are not deduped — two students may share the same parent (same phone/NIC). Must check for duplicates before inserting.

---

### 2.6 Attendance Records

Legacy attendance is likely stored as `{student_id, date, status, class_id}` without DynamoDB sync tracking.

**Target fields not present in legacy:**
- `dynamo_pk` / `dynamo_sk` — **REQUIRED UNIQUE** constraint. Must be fabricated for migrated records (e.g., `INST#{institute_id}#STU#{student_id}` / `DATE#{date}#SEQ#{n}`)
- `sync_status` — set to `SYNCED` (no DynamoDB sync needed for historical data)
- `marking_method` — set to `"MANUAL_MIGRATION"` or `"HISTORICAL"`
- `device_uid` — NULL (no device tracking in legacy)
- `latitude`, `longitude` — NULL (no GPS in legacy)

**Status Mapping:**

| Legacy Value | Suraksha status (TINYINT) |
|---|---|
| present | 1 |
| absent | 0 |
| late | 2 |
| left | 3 |
| (others) | 0 (absent) |

---

### 2.7 Payments / Monthly Fees

Legacy likely tracks fees as `{student_id, month, year, amount, status}` — a flat monthly fee model.

**Target has 3-level payment hierarchy:**
1. `institute_payments` — institute-wide fees
2. `institute_class_payments` — class-level fees  
3. `institute_class_subject_payments` — subject-level fees

**Mapping Strategy:**
- Monthly legacy fees → map as `institute_class_payments` (class-level) with `last_date` = end of month
- One row per month per class = one `institute_class_payment`
- Each student's payment record → `institute_class_payment_submissions`

**Fields missing in legacy:**
- `bank_name`, `account_holder_name`, `account_holder_number` — NULL or default
- `teacher_commission_pct` — 0
- `priority` — default MANDATORY
- `target_type` — default STUDENTS

---

## 3. Conflict / Mismatch Analysis

### 3.1 PRIMARY KEY Conflicts

| Table | Suraksha PK | Legacy PK | Conflict |
|---|---|---|---|
| `institutes` | UUID (varchar 36) | INT (e.g. 100–109) | **YES** — must generate new UUIDs, store legacy ID in a migration mapping table |
| `institute_classes` | UUID | INT or plain name | **YES** — generate UUIDs, keep mapping |
| `subjects` | UUID | INT or name string | **YES** — generate UUIDs |
| `users` | BIGINT 9-digit | INT or no id | **YES** — generate new user IDs |
| `students` | user_id (BIGINT) | id (INT) | **YES** — new user IDs |
| `attendance_records` | BIGINT AUTO_INCREMENT + unique(dynamo_pk, dynamo_sk) | INT | **YES** — fabricate dynamo keys |

### 3.2 UNIQUE Constraint Conflicts

| Table | Unique Constraint | Risk |
|---|---|---|
| `users.email` | UNIQUE | Legacy students may have no email → NULL ok, but if any duplicate emails exist between legacy institutes → **COLLISION** |
| `users.nic` | UNIQUE | Same NIC across institutes = same person → must dedup |
| `users.phone_number` | No unique constraint | Safe |
| `users.rfid` | UNIQUE nullable | Only if RFID data exists |
| `institutes.code` | UNIQUE | Generate slug from name |
| `institutes.email` | UNIQUE | Legacy institutes have no email → generate placeholder or leave logic |
| `institutes.subdomain` | UNIQUE | Assign from existing subdomain column or generate |
| `subjects.code` | UNIQUE | Generate per-institute slug |
| `institute_classes.code` | UNIQUE | Generate per-institute slug |
| `attendance_records` | UNIQUE(dynamo_pk, dynamo_sk) | Must fabricate unique DynamoDB keys for all historical records |

### 3.3 Schema Field Mismatches

| Legacy Concept | Legacy Field(s) | Suraksha Field(s) | Issue |
|---|---|---|---|
| Student name | `name` (single field) | `first_name` + `last_name` | Must split on last space or first space |
| Parent data | Columns on student table | Separate `users` + `parents` tables | Requires 2 new rows per parent |
| Month-based fee | `month`, `year`, `amount` | `institute_class_payments.last_date` | Different data model |
| Institute ID | INT (100, 101...) | UUID varchar(36) | Total PK type change |
| Class-institute link | Column `institute_id` INT | FK to `institutes.id` UUID | All FK references must be remapped |
| Subject-class link | Direct column or simple join table | `institute_class_subjects` junction table | May need to be constructed |
| Attendance status | String (present/absent) | TINYINT 0-5 | Must convert |
| Card status | May not exist | `card_id`, `card_status`, `rfid`, `rfid_card_status` | Leave NULL or migrate if data exists |

### 3.4 Missing Data (Fields Required in Suraksha with No Legacy Source)

| Suraksha Required Field | Default Value for Migration |
|---|---|
| `users.user_type` | STUDENT (for students), PARENT (for parents) |
| `users.is_active` | true |
| `users.first_login_completed` | false |
| `users.profile_completion_status` | INCOMPLETE |
| `institutes.is_active` | true |
| `institutes.tier` | FREE (unless legacy has tier data) |
| `institutes.type` | EDUCATIONAL (default) |
| `institutes.country` | LK (Sri Lanka default) |
| `institute_users.status` | ACTIVE |
| `institute_users.institute_user_type` | STUDENT / PARENT |
| `institute_class_students.is_active` | true |
| `institute_class_students.is_verified` | true |
| `institute_class_students.enrollment_method` | manual |
| `attendance_records.dynamo_pk` | Fabricated: `MIGRATED#INST_{institute_id}#STU_{student_id}` |
| `attendance_records.dynamo_sk` | Fabricated: `DATE_{date}#SEQ_{row_counter}` |
| `attendance_records.sync_status` | SYNCED |
| `subjects.is_active` | true |
| `subjects.subject_type` | THEORY (default) |
| `institute_class_subjects.is_active` | true |

### 3.5 Relation Model Mismatch

**Parent ↔ Student (critical)**

Legacy: Parents are extra columns or a simple linked table on the student. No separate user identity for parents.

Suraksha requires:
```
users (user_type=PARENT) → parents → students.father_id / mother_id / guardian_id
```

Migration creates phantom parent users who will never log in unless they register. This is intentional (parents receive SMS/push notifications without needing an account).

**Risk:** If legacy has a parent's phone but no name, `users.first_name` would be empty — this violates display logic. **Use a placeholder name like "Parent of {student_name}"**.

---

### 3.6 Enum Value Mismatches

| Field | Legacy Values | Suraksha Enum Values | Gap |
|---|---|---|---|
| `attendance_records.status` | String: present/absent/late | TINYINT: 0=absent, 1=present, 2=late, 3=left, 4=leftEarly, 5=leftLately | Must convert string → int |
| `users.gender` | M/F or Male/Female | ENUM: male, female, other | Normalize to lowercase |
| `users.blood_group` | A+/A-/B+... | ENUM: A_POSITIVE, A_NEGATIVE... | Convert format |
| `payment.status` | paid/unpaid/pending | ENUM: PENDING, VERIFIED, REJECTED, EXPIRED | Map accordingly |
| `institute_class_students.student_type` | (may not exist) | ENUM: normal, paid, free_card | Default to 'normal' |
| `institute_class_subject_students.verification_status` | (may not exist) | ENUM: verified/pending/rejected/pending_payment/payment_rejected/enrolled_free_card | Default to 'verified' for migrated data |

---

## 4. Bugs & Issues That Will Break After Merge

### BUG-001: dynamo_pk / dynamo_sk Unique Constraint on Migrated Attendance
**Severity:** CRITICAL  
**Problem:** `attendance_records` has `UNIQUE(dynamo_pk, dynamo_sk)`. Historical records from legacy have no DynamoDB keys. If two scripts generate the same fabricated key pattern for the same student+date, INSERT fails with unique constraint violation.  
**Fix:** Use a deterministic key generation: `dynamo_pk = MIGRATED#INST_{new_uuid}#STU_{user_id}`, `dynamo_sk = {date}#{original_legacy_id}`. This guarantees uniqueness if original IDs are unique.

---

### BUG-002: users.email UNIQUE on Legacy Students Without Email
**Severity:** HIGH  
**Problem:** `users.email` is UNIQUE. Legacy students may not have emails. Inserting NULL works only if MySQL handles nullable unique columns (MySQL allows multiple NULLs in a unique index). However, if any legacy record has a duplicate email across institutes — the migration will fail.  
**Fix:** Before migrating, run: `SELECT email, COUNT(*) FROM legacy_students GROUP BY email HAVING COUNT(*) > 1`. Deduplicate or assign synthetic emails (`student_{id}@noreply.migration`).

---

### BUG-003: Parent Deduplication
**Severity:** HIGH  
**Problem:** The same parent (same phone/NIC) may be enrolled in multiple legacy institutes. Without dedup, we create duplicate `users` and `parents` rows for the same physical person. Suraksha's `users.nic` is UNIQUE — inserting the same NIC twice fails.  
**Fix:** Build a parent map keyed by NIC (or phone if NIC missing). Reuse the same user_id if already inserted.

---

### BUG-004: Class Code Uniqueness
**Severity:** MEDIUM  
**Problem:** `institute_classes.code` is globally UNIQUE (not per-institute). If Winsma and Sihasma both have a class "Grade 5", auto-generating slug `grade-5` collides.  
**Fix:** Prefix with institute code: `WINSMA-GRADE5`, `SIHASMA-GRADE5`. Verify the `code` column constraint in the migration — if it was recently changed to per-institute unique, re-check the entity definition. Current entity shows `@Column({ unique: true })` on `code` — **this is GLOBAL unique, not scoped**.

> **Action Required in Code:** Change `institute_classes.code` unique constraint to composite `(institute_id, code)` before migration. Current entity has a single-column unique — this is a pre-existing schema bug.

---

### BUG-005: subjects.code Global Uniqueness
**Severity:** MEDIUM  
**Problem:** Same as BUG-004 — `subjects.code` is `@Column({ unique: true })` globally. Two institutes having a subject "Mathematics" with slug `mathematics` will collide.  
**Fix:** Same approach — prefix with institute code. Also fix the entity to use composite unique: `(institute_id, code)`.

---

### BUG-006: Missing Academic Year in Legacy Data
**Severity:** MEDIUM  
**Problem:** `institute_classes.academic_year` is required. Legacy data may have no academic year concept.  
**Fix:** Infer from attendance dates (most frequent year) or from a configuration parameter during migration. Default to `"2024"` for historical data.

---

### BUG-007: institute_users.user_id_by_institute Collision
**Severity:** LOW  
**Problem:** `institute_users.user_id_by_institute` (the institute's internal student ID like "STU001") may collide between institutes OR may be NULL in legacy.  
**Fix:** If legacy has no internal IDs, leave NULL. If it does, prefix with original institute ID to ensure scoped uniqueness.

---

### BUG-008: Attendance class_session_id Has No Legacy Source
**Severity:** LOW  
**Problem:** `attendance_records.class_session_id` references `institute_class_attendance_sessions`. Legacy has no session concept — attendance was marked per day, not per session.  
**Fix:** Leave NULL. No session will be assigned to migrated historical records. The system handles nullable session_id.

---

### BUG-009: Payment Submission user_type ENUM Mismatch
**Severity:** LOW  
**Problem:** `institute_class_payment_submissions.user_type` is ENUM (STUDENT/PARENT/TEACHER). Legacy may not have this distinction.  
**Fix:** Default to `STUDENT` for all migrated payment submissions.

---

### BUG-010: InstituteFeatureToggles Not Seeded for Migrated Institutes
**Severity:** MEDIUM  
**Problem:** All features in the system are gated by `institute_feature_toggles`. New institutes created via migration will have no feature toggles, so all features will appear disabled.  
**Fix:** After inserting each new institute, run a seed INSERT to copy the default feature set from `feature_catalog` where `is_core = true`.

---

### BUG-011: Missing InstituteUserType Rows for Migrated Institutes
**Severity:** MEDIUM  
**Problem:** The RBAC system requires `institute_user_types` to be set up per institute before `institute_feature_permissions` can work. Migrated institutes will have no user types defined.  
**Fix:** Seed default user types (STUDENT, PARENT, TEACHER, ADMIN) for each migrated institute as part of the migration script.

---

### BUG-012: Attendance Records Reference New UUIDs, Not Legacy INT IDs
**Severity:** HIGH  
**Problem:** Legacy attendance records reference class_id (INT) and institute_id (INT). After migration, these must be remapped to the new UUIDs. If the mapping table is lost or incomplete, all attendance records become orphaned (class_id / institute_id point to non-existent UUIDs).  
**Fix:** Build and persist a `migration_id_map` table:
```sql
CREATE TABLE migration_id_map (
  legacy_type VARCHAR(50),   -- 'institute', 'class', 'subject', 'user'
  legacy_id   VARCHAR(50),   -- original INT or string ID
  new_id      VARCHAR(36),   -- new UUID or bigint
  migrated_at TIMESTAMP
);
```
Use this as a lookup during attendance record migration.

---

## 5. Migration Execution Order

Steps must be executed in this exact order to avoid FK violations:

```
1.  Create migration_id_map table
2.  INSERT institutes (generate UUIDs, store in id_map)
3.  Seed institute_feature_toggles for each new institute (is_core=true features)
4.  Seed institute_user_types (STUDENT, PARENT, TEACHER, ADMIN per institute)
5.  INSERT subjects (scoped to institute, generate UUIDs, store in id_map)
6.  INSERT institute_classes (scoped to institute, UUID, store in id_map)
7.  INSERT institute_class_subjects (link classes ↔ subjects)
8.  INSERT parent users (users WHERE user_type=PARENT, deduplicated by NIC/phone)
9.  INSERT parents rows
10. INSERT student users (users WHERE user_type=STUDENT)
11. INSERT students rows (link father_id/mother_id/guardian_id)
12. INSERT institute_users (students + parents linked to institutes)
13. INSERT institute_class_students (enrollment records)
14. INSERT institute_class_subject_students (if subject-level enrollment used)
15. INSERT institute_class_payments (monthly fees → class payments)
16. INSERT institute_class_payment_submissions (per-student payment records)
17. INSERT attendance_records (remap IDs, fabricate dynamo keys, convert status)
18. Validate: run counts and spot-check samples
```

---

## 6. Pre-Migration Schema Fixes Required

These code changes must be deployed BEFORE running the migration:

### Fix 1 — institute_classes.code: Change to composite unique

File: [lms-api-suraksha-lk/src/modules/institute_mudules/institue_class/entities/institue_class.entity.ts](lms-api-suraksha-lk/src/modules/institute_mudules/institue_class/entities/institue_class.entity.ts)

```typescript
// Current (WRONG for multi-tenant):
@Column({ unique: true })
code: string;

// Fix:
@Index(['instituteId', 'code'], { unique: true })
@Column()
code: string;
```

Migration SQL:
```sql
ALTER TABLE institute_classes DROP INDEX UQ_..._code;
ALTER TABLE institute_classes ADD UNIQUE KEY uq_class_institute_code (institute_id, code);
```

### Fix 2 — subjects.code: Change to composite unique

File: [lms-api-suraksha-lk/src/modules/subject/entities/subject.entity.ts](lms-api-suraksha-lk/src/modules/subject/entities/subject.entity.ts)

```typescript
// Current (WRONG for multi-tenant):
@Column({ unique: true })
code: string;

// Fix:
@Index(['instituteId', 'code'], { unique: true })
@Column()
code: string;
```

Migration SQL:
```sql
ALTER TABLE subjects DROP INDEX UQ_..._code;
ALTER TABLE subjects ADD UNIQUE KEY uq_subject_institute_code (institute_id, code);
```

### Fix 3 — Add migration_id_map table

Add as a TypeORM migration before the data migration runs:
```sql
CREATE TABLE IF NOT EXISTS migration_id_map (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  legacy_type VARCHAR(50) NOT NULL,
  legacy_id   VARCHAR(100) NOT NULL,
  new_id      VARCHAR(36) NOT NULL,
  migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_legacy (legacy_type, legacy_id),
  INDEX idx_new (legacy_type, new_id)
);
```

---

## 7. Summary Table

| Category | Items | Status |
|---|---|---|
| Institutes to migrate | ~10 (from db-out.txt) | Needs full schema dump |
| Schema pre-fixes needed | 2 entity files + 1 new table | Must deploy before migration |
| Critical bugs | BUG-001 (dynamo keys), BUG-003 (parent dedup), BUG-004/005 (unique codes), BUG-012 (id mapping) | Fix in migration script |
| Medium bugs | BUG-006, BUG-010, BUG-011 | Fix in migration script |
| Low bugs | BUG-007, BUG-008, BUG-009 | Handle with defaults |
| Tables requiring new data rows | institutes, users, students, parents, institute_users, institute_classes, subjects, institute_class_subjects, institute_class_students, attendance_records, institute_class_payments, institute_class_payment_submissions, institute_feature_toggles, institute_user_types, migration_id_map | 15 tables |

---

## 8. What Is Still Unknown (Needs Full Schema Dump)

To complete this analysis and write the actual migration scripts, the following is needed from the legacy "thilinadhananjaya" database:

```sql
-- Run these on the legacy DB and share output:
SHOW TABLES;
SHOW CREATE TABLE students;
SHOW CREATE TABLE classes;
SHOW CREATE TABLE subjects;
SHOW CREATE TABLE attendance;         -- or attendance_records
SHOW CREATE TABLE payments;           -- or monthly_fees
SHOW CREATE TABLE parents;            -- if exists
SHOW CREATE TABLE institute_users;    -- if exists
SELECT COUNT(*) FROM students;
SELECT COUNT(*) FROM attendance;      -- size estimate
```

Once these are available, the migration scripts can be written with exact column mappings.

---

*Generated by Claude Code — Suraksha LMS Merge Analysis*
