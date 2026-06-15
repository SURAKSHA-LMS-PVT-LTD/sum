# Suraksha LMS — External API & Migration Scripts

API-key authenticated endpoints for migrating students and attendance from a legacy
system into Suraksha LMS, plus two browser DevTools console scripts that drive them.

- Backend base (prod): `https://apilms.suraksha.lk`
- All endpoints live under `/api/external/v1/...`
- Auth: **institute API key** as `Authorization: Bearer <KEY>`. The institute is
  derived from the key — you never pass `instituteId`/`orgId` in the body or URL.

---

## 1. API keys & scopes

Generate keys from the institute API-key management UI/endpoint. Each key carries
**scopes**; an endpoint rejects the key (403) if the required scope is missing.

| Scope             | Grants                                                        |
|-------------------|--------------------------------------------------------------|
| `STUDENT_CREATE`  | Create / link students and assign them to the institute      |
| `CLASS_READ`      | List classes and list a class's sessions                     |
| `SESSION_CREATE`  | Generate a new attendance session for a class                |
| `ATTENDANCE_MARK` | Bulk-mark attendance for a session                           |

For the full migration, issue one key with all four scopes.

---

## 2. Endpoints

### 2.1 List classes
```
GET /api/external/v1/classes?search=<optional name filter>
Authorization: Bearer <KEY>          (scope: CLASS_READ)
```
**200** → array of:
```json
{ "id": "uuid", "name": "Grade 10 A", "code": "G10A", "classType": "regular",
  "grade": 10, "academicYear": "2026", "isActive": true }
```

### 2.2 List sessions for a class
```
GET /api/external/v1/classes/:classId/sessions?search=<optional>
Authorization: Bearer <KEY>          (scope: CLASS_READ)
```
**200** → array of:
```json
{ "id": "uuid", "name": "Morning", "classId": "uuid", "date": "2026-06-15",
  "startTime": "08:00", "endTime": "10:00", "isClosed": false, "totalStudents": 42 }
```
**404** if the class doesn't belong to the key's institute.

### 2.3 Generate a session
```
POST /api/external/v1/classes/:classId/sessions
Authorization: Bearer <KEY>          (scope: SESSION_CREATE)
Content-Type: application/json

{ "name": "Migrated 2026-03-01", "date": "2026-03-01", "startTime": "08:00", "endTime": "10:00" }
```
- `date` optional (defaults to today, Sri Lanka). `endTime` optional.
- The session is created with `sendNotifications: false` — **no parent alerts**.

**201** → same shape as a session object above. Use its `id` to mark attendance.

### 2.4 Create / link students (bulk)
```
POST /api/external/v1/students/bulk
Authorization: Bearer <KEY>          (scope: STUDENT_CREATE)
Content-Type: application/json

{ "students": [ { ...record }, ... ] }
```
Per record (`firstName` required; everything else optional):
```json
{
  "userId": "500423",                 // if given → link this exact Suraksha user (no matching)
  "firstName": "Nimal",
  "lastName": "Perera",
  "phoneNumber": "+94771234567",      // used to match an existing user when no userId
  "email": "nimal@example.com",
  "nic": "200012345678",
  "dateOfBirth": "2008-04-12",
  "gender": "MALE",
  "city": "Colombo",
  "userIdByInstitute": "STU2026001",  // institute/legacy id — stored on the membership
  "institutePassword": "Pass@12345",  // INSTITUTE (tenant) login password — bcrypt-hashed.
                                       // NOT the global Suraksha user.password.
  "classId": "uuid",                  // OPTIONAL — if given, also enroll into this class
                                       // (active+verified) during creation. Class must belong
                                       // to the key's institute. Omit for institute-level only.
  "extraData": { "grade": "10", "stream": "Science", "notes": "..." }
}
```

**Resolution per record:**
1. `userId` present → link that user directly.
2. else `phoneNumber` matches an active user → link it.
3. else → create a new `USER_WITHOUT_PARENT` (student-capable, never a parent) + `students` row.

Then the `institute_user` membership is created as `STUDENT`/`ACTIVE` with the
`extraData`, `userIdByInstitute`, and (hashed) `institutePassword`. Re-running
**updates** extraData/password instead of failing. **No parents. No notifications.**

**200** →
```json
{
  "instituteId": "12", "successCount": 2, "failedCount": 0,
  "results": [
    { "index": 0, "userId": "500423", "action": "created", "assignmentCreated": true, "classEnrollment": "created" },
    { "index": 1, "userId": "500111", "action": "linked",  "assignmentCreated": true, "classEnrollment": "existing" }
  ],
  "failures": [ { "index": 2, "reason": "..." } ]
}
```
`classEnrollment` is `created` (newly enrolled into `classId`), `existing` (already
enrolled — re-activated if it was inactive), or `none` (no `classId` supplied).

> **Enrollment note:** without `classId`, this endpoint assigns students to the
> **institute** only. With `classId`, it also enrolls them into that class
> (`institute_class_student`, active+verified) so they're immediately markable.
> Attendance marking only succeeds for students enrolled in the session's class.

### 2.5 Bulk-mark attendance
```
POST /api/external/v1/attendance/sessions/:sessionId/mark-bulk
Authorization: Bearer <KEY>          (scope: ATTENDANCE_MARK)
Content-Type: application/json

{ "records": [ { "studentId": "STU2026001", "status": 1, "checkInTime": "2026-03-01T08:32:00.000Z", "remarks": "..." }, ... ] }
```
- `studentId` may be the **Suraksha user ID** *or* the **legacy id** (the
  `userIdByInstitute` stored at migration) — the backend resolves either within the institute.
- `status` (optional): `0`=Absent `1`=Present `2`=Late `3`=Left `4`=LeftEarly `5`=LeftLately.
  Omit to auto-resolve from the session's time rules.
- `checkInTime` (optional, ISO 8601): preserves the original time; falls back to now().
- `remarks` (optional).
- Past sessions allowed (migration). Future sessions rejected. **No notifications.**

**200** →
```json
{ "sessionId": "uuid", "successCount": 40, "failedCount": 2,
  "failures": [ { "studentId": "STU999", "reason": "Student is not enrolled in this class" } ] }
```
Failures echo back the **original** `studentId` you sent, so you can match them to
your source rows. Students not enrolled appear here with a reason — create + enroll
them, then re-run.

---

## 3. Migration runbook

1. **Issue an API key** with `STUDENT_CREATE`, `CLASS_READ`, `SESSION_CREATE`, `ATTENDANCE_MARK`.
2. **Migrate students** — run `01-student-migrator.js` on the legacy student pages.
   Each gets a Suraksha user + student record + institute membership, with the legacy
   id stored as `userIdByInstitute` and the institute (tenant) password set. Set
   `CLASS_ID_NEW` in the script to also **auto-enroll into that class** during creation
   (leave it `""` to assign at institute level only).
3. **(Only if you skipped `classId`)** Enroll students into classes via the normal
   Suraksha class-enrollment flow. Attendance marking requires class enrollment.
4. **Migrate attendance** — run `02-attendance-injector.js` on the legacy attendance
   pages. Pick the class, pick or **generate** the session, push the rows. Not-enrolled
   students come back as a downloadable CSV; fix those and re-run.

---

## 4. Console scripts

Both scripts run in the browser DevTools console **while logged in to the legacy
system** (so their `fetch` to the legacy pages carries your session cookies). They
call Suraksha with the API key you paste at the top.

### `01-student-migrator.js`
- Edit the CONFIG block: `SURAKSHA_API`, `API_KEY`, `CLASS_ID_NEW`, `DEFAULT_INSTITUTE_PASSWORD`,
  and the legacy `CLASS_ID_OLD` / `BASE_URL`.
- Prompts for legacy student IDs, scrapes each detail page, then sends them to
  `POST /students/bulk` in batches.
- Legacy `password` concept → `institutePassword` (tenant login). All other legacy
  fields (guardian, address, school, paymentType, barcode) go into `extraData`.
- Prints a created / linked / failed summary (`console.table`).

### `02-attendance-injector.js`
- Edit the CONFIG block: `SURAKSHA_API`, `API_KEY` (needs CLASS_READ + SESSION_CREATE + ATTENDANCE_MARK).
- Opens a panel: **select class** (loaded from the API), **select session** or
  **+ New session** (generates one for that class), choose check-in-time source and status.
- Reads the page's DataTable (`#dt_cls_ses_sessions` / `#dt_cls_students`, or DOM
  fallback). **Set the table page length to "All" first** so every student is read.
- Sends to `POST /attendance/sessions/:id/mark-bulk`; downloads a CSV of any failures.

> **Security:** the API key is embedded in the script you paste — treat it like a
> password, use a key scoped only to what you need, and revoke it after the migration.
