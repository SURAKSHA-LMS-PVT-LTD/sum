# ThilinaDhananjaya LMS → Suraksha LMS: Integration Analysis

**Generated:** 2026-05-21  
**Task:** Migrate all institute users (students) from ThilinaDhananjaya LMS into Suraksha LMS as institute users under the corresponding institute, including all profile data, class enrolments, attendance, video-watch details, and payment history.

---

## 1. Source Database — ThilinaDhananjaya LMS

| Property | Value |
|---|---|
| DB name | `thilinadhananjaya_lms` |
| Host | 34.42.163.47:3306 (Google Cloud SQL) |
| ORM | Prisma (MySQL) |
| Backend | NestJS + Prisma |
| Institute ID prefix | `TD` (e.g. TD-2026-0001) |
| S3 bucket | `thilinadhananjaya-lms-uploads` |

---

## 2. Target Database — Suraksha LMS

| Property | Value |
|---|---|
| DB name | `suraksha-lms-db` |
| ORM | TypeORM (MySQL) |
| Backend | NestJS + TypeORM |
| Institute relation | `institute_user` table (composite PK: instituteId + userId) |
| Custom fields | `institute_user.extra_data` (JSON) |
| Custom schema | `institutes.user_extra_data_schema` (JSON array) |

---

## 3. Source Data — Complete Schema Summary

### 3.1 User / Profile (Students)

**`User` table** — auth record  
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| email | String UNIQUE | Login email |
| password | String | Hashed |
| role | Role | ADMIN \| STUDENT |
| orgId | String? | FK → Institute |
| createdAt | DateTime | |
| updatedAt | DateTime | |

**`Profile` table** — identity & contact record  
| Column | Type | Suraksha Target |
|---|---|---|
| id | UUID | — |
| userId | UUID UNIQUE | FK → User |
| instituteId | String UNIQUE | `userIdByInstitute` in institute_user |
| barcodeId | String? UNIQUE | `extra_data.barcodeId` or `instituteCardId` |
| fullName | String | → User.firstName + lastName split |
| avatarUrl | String? | `instituteUserImageUrl` |
| address | String? | → User.addressLine1 |
| phone | String? | → User.phoneNumber |
| whatsappPhone | String? | `extra_data.whatsappPhone` |
| school | String? | `extra_data.school` |
| dateOfBirth | DateTime? | → User.dateOfBirth |
| guardianName | String? | `extra_data.guardianName` |
| guardianPhone | String? | `extra_data.guardianPhone` |
| relationship | String? | `extra_data.guardianRelationship` |
| occupation | String? | `extra_data.occupation` |
| gender | Gender? | → User.gender |
| status | StudentStatus | → `institute_user.status` (mapping below) |
| enrolledDate | DateTime | → `institute_user.createdAt` |

**StudentStatus → InstituteUserStatus mapping:**
| Thilina | Suraksha |
|---|---|
| ACTIVE | ACTIVE |
| INACTIVE | INACTIVE |
| PENDING | PENDING |
| OLD | FORMER |

---

### 3.2 Classes

**`Class` table**  
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | String | Class name (e.g. "A/L Physics 2026") |
| subject | String? | Subject name |
| description | String? | |
| monthlyFee | Float? | |
| thumbnail | String? | |
| vision | String? | |
| mission | String? | |
| introVideoUrl | String? | |
| status | ClassStatus | ANYONE \| STUDENTS_ONLY \| PAID_ONLY \| PRIVATE \| INACTIVE |
| orgId | String? | FK → Institute |

**`Month` table** — month-by-month grouping within a class  
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| classId | String | FK → Class |
| name | String | e.g. "January 2026" |
| year | Int | |
| month | Int | 1–12 |
| status | MonthStatus | |

---

### 3.3 Enrolment

**`Enrollment` table** — student ↔ class membership  
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | String | FK → User |
| classId | String | FK → Class |
| paymentType | EnrollmentPaymentType | FULL \| HALF \| FREE |
| customMonthlyFee | Float? | Override of class.monthlyFee |
| createdAt | DateTime | |

---

### 3.4 Payments

**`PaymentSlip` table**  
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | String | FK → User |
| monthId | String | FK → Month |
| type | PaymentType | MONTHLY \| ADMISSION \| OTHER |
| reason | String? | If type=OTHER |
| slipUrl | String | S3 URL |
| amount | Float? | |
| paidDate | DateTime? | Set by admin on verify |
| transactionId | String? UNIQUE | |
| paymentMethod | PaymentMethod? | ONLINE \| PHYSICAL |
| paymentPortion | PaymentPortion? | FULL \| HALF |
| status | PaymentSlipStatus | PENDING \| VERIFIED \| REJECTED \| LATE |
| adminNote | String? | |
| rejectReason | String? | |

---

### 3.5 Attendance (Recording / Video)

**`Attendance` table** — per-recording video watch tracking  
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | String | FK → User |
| recordingId | String? | FK → Recording (null = manual) |
| eventName | String? | For manual attendance |
| status | AttendanceStatus | COMPLETED \| INCOMPLETE \| MANUAL |
| watchedSec | Int? | Total seconds watched |
| liveJoinedAt | DateTime? | When joined live lecture |
| details | Json? | Full status change log |

**`WatchSession` table** — granular per-session video analytics  
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | String | |
| recordingId | String | |
| startedAt | DateTime | |
| endedAt | DateTime? | |
| videoStartPos | Float | Seconds into video when started |
| videoEndPos | Float | Last known position |
| totalWatchedSec | Int | Actual seconds in this session |
| status | WatchSessionStatus | WATCHING \| PAUSED \| ENDED |
| events | Json? | [{type, videoTime, wallTime}] |

---

### 3.6 Physical Class Attendance

**`ClassAttendance` table** — per-student per-date attendance  
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | String | FK → User |
| classId | String | FK → Class |
| date | Date | |
| sessionTime | String | HH:mm |
| sessionCode | String? | e.g. cls002sub1 |
| sessionAt | DateTime? | |
| status | ClassAttendanceStatus | PRESENT \| ABSENT \| LATE \| EXCUSED |
| method | String? | "barcode", "manual", "institute_id" |
| note | String? | |
| markedBy | String? | Admin user ID |

**`ClassAttendanceSession` table** — the session definition (what date/time was held)  
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| classId | String | FK → Class |
| weekId | String? | FK → ClassAttendanceWeek |
| date | Date | |
| sessionTime | String | HH:mm |
| sessionCode | String? | |
| sessionAt | DateTime? | |
| createdBy | String? | |

**`ClassAttendanceWeek` table** — grouping sessions by week  
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| classId | String | FK → Class |
| name | String | Week label |
| orderNo | Int | |
| createdBy | String? | |

---

### 3.7 Lecture Attendance

**`LectureAttendance` table** — registered user joining a live lecture  
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| lectureId | String | FK → Lecture |
| userId | String | FK → User |
| joinedAt | DateTime | |

**`GuestLectureJoin` table** — public (non-enrolled) guest joins  
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| lectureId | String | |
| fullName | String | |
| phone | String | |
| email | String? | |
| note | String? | |
| joinedAt | DateTime | |

---

### 3.8 Content Models

**`Recording`** — video lessons inside a Month  
- `id`, `monthId`, `title`, `description`, `videoUrl`, `videoType` (DRIVE/YOUTUBE/ZOOM/OTHER), `thumbnail`, `duration` (seconds), `topic`, `icon`, `materials` (JSON), `welcomeMessage`, `isLive`, `liveUrl`, `liveToken`, `liveStartedAt`, `liveEndedAt`, `status`, `order`

**`Lecture`** — scheduled live sessions inside a Month  
- `id`, `monthId`, `title`, `description`, `mode` (ONLINE/OFFLINE), `platform`, `startTime`, `endTime`, `sessionLink`, `meetingId`, `meetingPassword`, `maxParticipants`, `welcomeMessage`, `liveToken`, `cardImageUrl`, `bgMediaUrl`, `status`

**`MonthMedia`** — study materials (PDFs, images, links) inside a Month  
- `id`, `monthId`, `title`, `description`, `fileUrl`, `mediaType` (PDF/IMAGE/LINK/DOCUMENT/OTHER), `thumbnail`, `size`, `order`, `status`

---

## 4. Target Mapping — What Goes Where in Suraksha

### 4.1 Institute Users (Core)

Each Thilina `User` (role=STUDENT) becomes:
1. A **global `User`** in Suraksha (if not already exists by email)
2. An **`institute_user`** row linking that user to the Thilina institute in Suraksha

| Thilina Field | Suraksha Location |
|---|---|
| `user.email` | `user.email` |
| `profile.fullName` | `user.firstName` + `user.lastName` |
| `profile.dateOfBirth` | `user.dateOfBirth` |
| `profile.gender` | `user.gender` |
| `profile.phone` | `user.phoneNumber` |
| `profile.address` | `user.addressLine1` |
| `profile.avatarUrl` | `institute_user.instituteUserImageUrl` |
| `profile.instituteId` (TD-2026-0001) | `institute_user.userIdByInstitute` |
| `profile.barcodeId` | `institute_user.instituteCardId` |
| `profile.status` | `institute_user.status` (mapped) |
| `profile.enrolledDate` | `institute_user.createdAt` |

### 4.2 Extra Data Schema (institute_user.extra_data)

The following fields have **no direct column** in Suraksha's `User` or `institute_user` tables and must be stored in `extra_data` JSON. These should also be defined in `institutes.user_extra_data_schema` so they appear in the admin UI.

| Key | Label | Type | Source Field |
|---|---|---|---|
| `whatsapp_phone` | WhatsApp Phone | phone | `profile.whatsappPhone` |
| `school` | School | text | `profile.school` |
| `guardian_name` | Guardian Name | text | `profile.guardianName` |
| `guardian_phone` | Guardian Phone | phone | `profile.guardianPhone` |
| `guardian_relationship` | Guardian Relationship | text | `profile.relationship` |
| `occupation` | Occupation | text | `profile.occupation` |

**These 6 columns must be added to `institutes.user_extra_data_schema`** for the Thilina institute when it is created in Suraksha. They will then appear automatically in the Create/Edit user forms and user detail views.

### 4.3 Classes → Suraksha Classes

Thilina `Class` → Suraksha `institute_class` (or equivalent).  
> ⚠️ **See Section 6 for compatibility notes.**

### 4.4 Enrolments → Class Assignments

Thilina `Enrollment` (userId + classId) → Suraksha class member assignment.

### 4.5 Payments → Suraksha Payment Records

Thilina `PaymentSlip` → Suraksha payment module (finance).  
> ⚠️ **See Section 6 for compatibility notes.**

### 4.6 Video Watch / Recording Attendance

Thilina `Attendance` + `WatchSession` → Suraksha subject recordings module.  
> ⚠️ **See Section 6 for compatibility notes.**

### 4.7 Physical Class Attendance

Thilina `ClassAttendance` + `ClassAttendanceSession` + `ClassAttendanceWeek`  
→ Suraksha attendance module (session-based).  
> ⚠️ **See Section 6 for compatibility notes.**

---

## 5. Proposed `user_extra_data_schema` for the Thilina Institute

Add this array to `institutes.user_extra_data_schema` when creating the Thilina institute entry in Suraksha:

```json
[
  {
    "key": "whatsapp_phone",
    "label": "WhatsApp Phone",
    "type": "phone",
    "applicableTo": ["Student"]
  },
  {
    "key": "school",
    "label": "School",
    "type": "text",
    "applicableTo": ["Student"]
  },
  {
    "key": "guardian_name",
    "label": "Guardian Name",
    "type": "text",
    "applicableTo": ["Student"]
  },
  {
    "key": "guardian_phone",
    "label": "Guardian Phone",
    "type": "phone",
    "applicableTo": ["Student"]
  },
  {
    "key": "guardian_relationship",
    "label": "Guardian Relationship",
    "type": "select",
    "options": ["Father", "Mother", "Guardian", "Sibling", "Other"],
    "applicableTo": ["Student"]
  },
  {
    "key": "occupation",
    "label": "Occupation",
    "type": "text",
    "applicableTo": ["Student"]
  }
]
```

> **Note:** `guardian_relationship` is ideal as a **select (enum)** field now that we added `select` type support. This is what you just implemented.

---

## 6. Compatibility Issues & Mismatches

### 6.1 ✅ COMPATIBLE — User Profile Fields

| Status | Detail |
|---|---|
| ✅ | Email, name, phone, gender, DOB, address map cleanly |
| ✅ | `profile.instituteId` (TD-2026-0001) → `userIdByInstitute` — perfect fit |
| ✅ | `profile.barcodeId` → `instituteCardId` — perfect fit |
| ✅ | `profile.avatarUrl` (S3) → `instituteUserImageUrl` |
| ✅ | 6 extra fields → `extra_data` JSON (schema defined in Section 5) |
| ✅ | StudentStatus → InstituteUserStatus mapping is 1:1 |

---

### 6.2 ⚠️ MISMATCH — Class / Subject Hierarchy

**Thilina:** `Class → Month → Recording/Lecture/Media`  
**Suraksha:** `institute_classes → (subjects) → subject_recordings`

| Thilina | Suraksha | Status |
|---|---|---|
| `Class` | `institute_classes` | ✅ Compatible — `name`, `description`, `thumbnail` map directly |
| `Class.subject` | `InstituteClassEntity` has no subject field | ⚠️ Use `classType` or `specialty` to store subject name |
| `Class.monthlyFee` | `InstituteClassEntity` has no fee field | ⚠️ Store in class description or separate finance config |
| `Class.status` (ANYONE/STUDENTS_ONLY/PAID_ONLY/PRIVATE/INACTIVE) | `isActive` boolean | ⚠️ Only binary; store access level in extra metadata |
| `Class.introVideoUrl` | No field in `institute_classes` | ⚠️ Can store as first Recording |
| `Class.vision / mission` | `InstituteClassEntity` has no vision/mission | ⚠️ Store in `description` or drop |
| `Month` | **No direct equivalent** | ⚠️ Decision required — see below |
| `Recording` | `subject_recordings` | ✅ Very compatible — see Section 6.4 |
| `Lecture` | Live recordings (`isLive=true`) | ✅ See Section 6.6 |
| `MonthMedia` | `SubjectRecording.materials` (JSON) or separate media record | ⚠️ Partial match |

**Month Strategy (decision required — pick one):**

**Option A — Flatten:** Ignore months, put all recordings for a class into one subject. Simple but loses month grouping.

**Option B — Month as Subject:** Create one Suraksha Subject per Month (e.g. "January 2026"). Recordings nest under that subject. Preserves grouping exactly.

**Recommendation: Option B** — creates the cleanest mapping and the admin can see monthly breakdowns in the subject list.

**`InstituteClass` field mapping for Thilina classes:**
| Thilina | Suraksha Field | Notes |
|---|---|---|
| `Class.name` | `name` | Direct |
| `Class.subject` | `specialty` | Reuse specialty field |
| `Class.description` | `description` | Direct |
| `Class.thumbnail` | `imageUrl` | Direct |
| `Class.orgId` | `instituteId` | Direct |
| `Class.status=INACTIVE` | `isActive=false` | Map INACTIVE → false, all others → true |

---

### 6.3 ⚠️ MISMATCH — Payment Type / Structure

**Thilina:** `PaymentSlip` is linked to a `Month` (not a class directly), with types MONTHLY/ADMISSION/OTHER.  
**Suraksha:** Finance module uses its own payment structure (linked to institute, user, plan, class).

| Thilina Field | Suraksha Finance | Issue |
|---|---|---|
| `monthId` | No direct month reference | Suraksha payments are not month-scoped |
| `type` (MONTHLY/ADMISSION/OTHER) | Different enum | Needs value mapping |
| `paymentPortion` (FULL/HALF) | May not exist | Custom field needed |
| `slipUrl` (S3) | Suraksha uses GCS/S3 too | URL portability fine |
| `transactionId` | Likely present | Verify field name |

**Action required:** Confirm Suraksha finance module table structure, then map fields. Payment slips can be stored in `extra_data` on the payment record if fields don't match.

---

### 6.4 ✅ COMPATIBLE — Recording Attendance / WatchSession

**Thilina:** `Attendance` (per-recording total) + `WatchSession` (per-session granular).  
**Suraksha:** `subject_recording_sessions` (session-level) + `subject_recording_activities` (event-level).

| Thilina | Suraksha | Status |
|---|---|---|
| `Attendance.watchedSec` | `SubjectRecordingSession.totalWatchedSeconds` | ✅ Maps directly |
| `WatchSession.totalWatchedSec` | `SubjectRecordingSession.totalWatchedSeconds` | ✅ Maps directly |
| `WatchSession.videoStartPos` | `SubjectRecordingSession.lastPositionSeconds` (use as start) | ✅ Approx match |
| `WatchSession.videoEndPos` | `SubjectRecordingSession.lastPositionSeconds` | ✅ Maps directly |
| `WatchSession.startedAt` | `SubjectRecordingSession.startTime` | ✅ Maps directly |
| `WatchSession.endedAt` | `SubjectRecordingSession.endTime` | ✅ Maps directly |
| `WatchSession.status` (WATCHING/PAUSED/ENDED) | `SubjectRecordingSession.backupStatus` | ⚠️ Different enum — use `backupStatus=completed` for ENDED, `pending` for others |
| `WatchSession.events` (JSON array) | `SubjectRecordingActivity` rows (one row per event) | ✅ Richer — Suraksha stores event-level rows |
| `Attendance.liveJoinedAt` | `SubjectRecordingSession.startTime` (for live recordings) | ✅ Compatible |
| `Attendance.details` (JSON) | `SubjectRecordingActivity` rows | ✅ Compatible (expand JSON → rows) |

**Suraksha recording platform mapping:**
| Thilina `VideoType` | Suraksha `platform` |
|---|---|
| YOUTUBE | YOUTUBE |
| DRIVE | GOOGLE_DRIVE |
| ZOOM | EXTERNAL |
| OTHER | EXTERNAL |

**Suraksha recording status mapping:**
| Thilina `RecordingStatus` | Suraksha `status` |
|---|---|
| ANYONE | published (recAccessLevel=ANYONE) |
| STUDENTS_ONLY | published (recAccessLevel=ENROLLED_ONLY) |
| PAID_ONLY | published (recAccessLevel=PAID_ONLY) |
| PRIVATE | draft |
| INACTIVE | archived |

---

### 6.5 ✅ COMPATIBLE — Physical Attendance Sessions / Weeks

**Thilina:** `ClassAttendanceWeek → ClassAttendanceSession → ClassAttendance`  
**Suraksha:** `institute_class_attendance_session_groups → institute_class_attendance_sessions → attendance_records`

| Thilina | Suraksha | Status |
|---|---|---|
| `ClassAttendanceWeek` | `InstituteClassAttendanceSessionGroupEntity` | ✅ Direct match — both group sessions |
| `ClassAttendanceSession` | `InstituteClassAttendanceSessionEntity` | ✅ Direct match — `date`, `startTime`, `endTime` |
| `ClassAttendance` | `AttendanceRecordEntity` | ✅ Compatible |
| `ClassAttendance.status` (PRESENT/ABSENT/LATE/EXCUSED) | `status` tinyint (0=Absent,1=Present,2=Late,3=Left,4=LeftEarly,5=LeftLately) | ✅ Map: PRESENT→1, ABSENT→0, LATE→2, EXCUSED→0+remarks |
| `ClassAttendance.method` ("barcode","manual","institute_id") | `AttendanceRecord.markingMethod` (MANUAL, NFC, QR, DEVICE, FACE…) | ✅ Free-string — pass through directly |
| `ClassAttendance.note` | `AttendanceRecord.remarks` | ✅ Maps directly |
| `ClassAttendance.markedBy` | No direct field in AttendanceRecord | ⚠️ Store in `remarks` or `metadata` |
| `sessionTime` (HH:mm) | `startTime` (time) | ✅ Maps directly |
| `sessionCode` | No equivalent | ⚠️ Store as remarks or drop |

**Suraksha attendance also uses DynamoDB as source of truth** (MySQL is read replica). Migration script must write to the `attendance_records` MySQL table directly with `syncStatus='SYNCED'`, `markingMethod='MANUAL'`.

---

### 6.6 ✅ HIGHLY COMPATIBLE — Lecture Model

**Thilina `Lecture`** maps to **Suraksha `subject_recording` with `isLive=true`**.

| Thilina Field | Suraksha `SubjectRecording` Field | Status |
|---|---|---|
| `liveToken` | `liveToken` | ✅ Direct match |
| `liveUrl` (sessionLink) | `liveUrl` | ✅ Direct match |
| `cardImageUrl` | `recCardImageUrl` | ✅ Direct match |
| `bgMediaUrl` | `recEntryBgUrl` | ✅ Direct match |
| `welcomeMessage` | `welcomeMessageText` (enable `welcomeMessageEnabled=true`) | ✅ Direct match |
| `title` | `title` | ✅ Direct match |
| `description` | `description` | ✅ Direct match |
| `liveStartedAt` | `liveStartedAt` | ✅ Direct match |
| `liveEndedAt` | `liveEndedAt` | ✅ Direct match |
| `meetingId`, `meetingPassword` | `materials` JSON | ⚠️ Store as: `[{documentName:"Meeting ID", documentUrl: meetingId}]` |
| `maxParticipants` | No field | ⚠️ Drop (use session totalStudents instead) |
| `platform` (Zoom/Meet/etc.) | No separate platform field | ⚠️ Store in description or drop |
| `LectureAttendance.joinedAt` | `SubjectRecordingSession.startTime` | ✅ Map joinedAt → startTime |
| `GuestLectureJoin` | `SubjectRecordingSession` with `userType='guest'` | ✅ Compatible — guestName/guestPhone fields exist |

---

### 6.7 ✅ COMPATIBLE — Enrolment

Thilina `Enrollment` (userId + classId, unique constraint) maps directly to Suraksha's class member assignment. The `paymentType` (FULL/HALF/FREE) and `customMonthlyFee` can be stored as extra metadata on the enrolment record.

---

### 6.8 ⚠️ MISMATCH — Institute Relationship

**Thilina:** Single-institute system (all data under one `Institute` record with slug "thilina-dhananjaya").  
**Suraksha:** Multi-tenant. Thilina's institute needs to be created as a Suraksha `Institute` record, and all users tagged with that institute's UUID.

**No institute-to-institute foreign keys are needed** — Suraksha's `institute_user` table already handles the link via `instituteId`.

---

## 7. Required `user_extra_data_schema` Changes Already Implemented

The `select` type support added to the `ExtraDataColumn` schema (today's work) is **required** for the `guardian_relationship` field above. Without it, the relationship field would have to be a free-text field — now it can be a dropdown with: Father, Mother, Guardian, Sibling, Other.

The `boolean` type is also now available but not needed for Thilina data currently.

---

## 8. Implementation Checklist

### Phase 1 — Institute Setup in Suraksha (Ready now)
- [ ] Create Institute record in Suraksha for "Thilina Dhananjaya" with slug, name, logo
- [ ] Add `user_extra_data_schema` (6 columns from Section 5) via settings API
- [ ] Confirm institute UUID for use in migration scripts

### Phase 2 — User Migration
- [ ] Export all Thilina `User` (role=STUDENT) + `Profile` records
- [ ] For each: create/find global Suraksha user by email, then upsert `institute_user` row
- [ ] Map `extra_data` fields (whatsapp, school, guardian name/phone/relationship, occupation)
- [ ] Map `barcodeId` → `instituteCardId`
- [ ] Map `profile.instituteId` (TD-xxxx) → `userIdByInstitute`

### Phase 3 — Class & Enrolment Migration
- [ ] Resolve class hierarchy mismatch (Section 6.2) — decide Month → Subject mapping strategy
- [ ] Create Suraksha classes for each Thilina `Class`
- [ ] Migrate `Enrollment` → class member assignments

### Phase 4 — Attendance Migration
- [ ] Confirm Suraksha attendance session entity columns (Section 6.5)
- [ ] Migrate `ClassAttendanceWeek` → Suraksha weeks/cycles
- [ ] Migrate `ClassAttendanceSession` → Suraksha sessions
- [ ] Migrate `ClassAttendance` → per-student attendance records

### Phase 5 — Recording / Video Migration
- [ ] Confirm Suraksha recording entity columns (Section 6.4)
- [ ] Migrate `Recording` → Suraksha subject_recording
- [ ] Migrate `Attendance` (video watching) → Suraksha watch tracking
- [ ] Migrate `WatchSession` events — may need `details` JSON field

### Phase 6 — Payment Migration
- [ ] Confirm Suraksha finance module table structure (Section 6.3)
- [ ] Migrate `PaymentSlip` records with month/class reference mapping

### Phase 7 — Lecture Migration
- [ ] Decide whether to map Thilina `Lecture` → Suraksha recording (isLive=true) or separate lecture model
- [ ] Handle extra fields (cardImageUrl, bgMediaUrl, meetingId) — store as JSON or drop
- [ ] `GuestLectureJoin` — no Suraksha equivalent; export to CSV for records or skip

---

## 9. Immediate Next Steps

1. **Verify Phase 3–5 compatibility** — Read Suraksha's `institute_class`, `attendance_session`, and `subject_recording_access` entities to finalise the mismatch analysis.
2. **Define the Month→Subject strategy** — either treat Month as a Subject, or flatten all recordings under one Subject per Class.
3. **Write the migration script** (NestJS service or standalone TypeScript) that reads from Thilina Prisma DB and writes to Suraksha TypeORM.
4. **For Sinhala UI** — all 6 `extra_data` labels need Sinhala translations added to the `CreateInstituteUserForm.tsx` `lang === 'si'` branches.

---

## 10. Sinhala (සිංහල) Label Translations for Extra Data Fields

| Key | English Label | Sinhala Label |
|---|---|---|
| `whatsapp_phone` | WhatsApp Phone | WhatsApp දුරකථනය |
| `school` | School | පාසල |
| `guardian_name` | Guardian Name | භාරකාරයාගේ නම |
| `guardian_phone` | Guardian Phone | භාරකාරයාගේ දුරකථනය |
| `guardian_relationship` | Guardian Relationship | සම්බන්ධතාවය |
| `occupation` | Occupation | රැකියාව |

Options for `guardian_relationship` in Sinhala:
- Father → පියා  
- Mother → මව  
- Guardian → භාරකාරයා  
- Sibling → සහෝදරයා/සහෝදරිය  
- Other → වෙනත්  
