# UX Improvement Plan: Eliminate Manual ID Entry

## Executive Summary

Users are currently forced to type raw database IDs (instituteId, classId, calendarDayId, eventId,
bookhireId, etc.) into free-text fields across several screens. This is a complete UX failure —
users don't know these IDs, can't find them, and make mistakes.

This document maps every pain point, the API chain that resolves it, what's missing from the
backend, and a prioritized implementation plan for full resolution.

---

## 1. All ID Input Pain Points

### 🔴 CRITICAL — Users must type raw UUIDs / numeric IDs

| # | Page / Component | Field(s) | Current UX | Impact |
|---|---|---|---|---|
| 1 | **DeviceManagement** — Bind session dialog | `eventId`, `calendarDayId` | Free-text input | Device bound to wrong event silently |
| 2 | **DeviceManagement** — Assign dialog | `instituteId` | Free-text input | Admin must look up institute UUID |
| 3 | **DeviceManagement** — Register dialog | `instituteId` | Free-text input | Same as above |
| 4 | **AssignInstituteDialog** | `instituteId` | Free-text input | Same |
| 5 | **EnrollTransportDialog** | `bookhireId` | Free-text input | Student must know internal ID of bus |
| 6 | **Attendance marking (bulk)** | `studentId` per student row | Array of UUIDs | Must pre-know all student IDs |
| 7 | **Exam results (bulk)** | `studentId` in each result row | Free-text in bulk form | Teacher needs student UUIDs |

### 🟡 MEDIUM — Dropdowns exist but chain is incomplete

| # | Page / Component | Problem |
|---|---|---|
| 8 | **ClassSelector** enrollment dialog | Class dropdown loads OK; subject dropdown doesn't cascade from selected class automatically |
| 9 | **Attendance device session** | Events for "today" are auto-fetched but device's calendar day events are not pre-loaded |
| 10 | **Exam results entry** | Exam dropdown filters by subjectId but doesn't pre-fill classId from selected class context |

### 🟢 ACCEPTABLE (no change needed)

| # | Field | Reason |
|---|---|---|
| 11 | RFID/NFC hardware scan input | Physical scan — ID is the card chip value |
| 12 | Device serial number | Set once during hardware registration |
| 13 | QR code scan input | Camera scan — auto-populates |

---

## 2. API Chains That Resolve Each Pain Point

### Pain Point 1 & (Device Bind → Event)

**Goal**: Replace `eventId` + `calendarDayId` text inputs with a date-picker + event dropdown.

```
Step 1 — User picks a DATE (DatePicker, defaults to today)
   ↓
GET /institutes/:instituteId/calendar/date/:date
   → returns { calendarDayId, events: [{ id, name, startTime, endTime, isDefault }] }
   ↓
Step 2 — Event dropdown auto-populated from events[]
   The default event (isDefault=true) is pre-selected
   ↓
Step 3 — POST /api/institute/:instituteId/devices/:deviceId/bind-event
   body: { eventId, calendarDayId }   ← both come from step 1 response
```

**No backend change needed.** The endpoint already returns both `calendarDayId` and `events[]`.

---

### Pain Points 2, 3, 4 (Institute ID inputs)

**Goal**: Replace `instituteId` text inputs with a searchable dropdown.

```
Role = SUPERADMIN:
   GET /institutes?search=query&page=1&limit=20
   → paginated list of { id, name, code }

Role = InstAdmin / Teacher:
   GET /institute-users/user/:userId/institutes
   → user's own institutes (already called during login — reuse auth context)
```

**Frontend**: Use the institute list already loaded in `AuthContext.user.institutes` (populated at
login). For SUPERADMIN context where any institute can be selected, call `GET /institutes` with a
search input (debounced).

**No backend change needed.**

---

### Pain Point 5 (Transport Enrollment — bookhireId)

**Goal**: Show a list of available transports (name, vehicle number, route) instead of asking for
a UUID.

```
GET /api/bookhires/available?page=1&limit=50
→ returns approved bookhires with { id, vehicleNumber, ownerName, route, capacity }
```

**⚠️ Backend gap**: No `instituteId` filter — the list is global. For now, show all available
bookhires in a searchable dropdown. Add `instituteId` filter later (see Section 4).

**Frontend change**: Replace the `bookhireId` text input with a dropdown that calls
`GET /api/bookhires/available`.

---

### Pain Points 6 & 7 (Student IDs in attendance / exam results)

**Goal**: Show a student name+photo list; let teacher tick/select instead of typing UUIDs.

```
For attendance:
   GET /institutes/:instituteId/classes/:classId/students
   → returns [{ userId, firstName, lastName, imageUrl, studentNumber }]

For exam results (subject-scoped):
   GET /institute-class-subject-students/class-subject/:instituteId/:classId/:subjectId
   → returns enrolled students for subject

For exam results (already implemented):
   GET /institute-class-subject-resaults/students-with-marks
        ?instituteId=&classId=&subjectId=&examId=
   → returns ALL enrolled students with current marks (score: '0' if ungraded)
```

**No backend change needed.** The student lists already exist. The frontend needs to render a
table (student rows pre-populated) instead of a raw JSON/form with ID fields.

---

### Pain Point 8 (Class → Subject cascade)

**Goal**: Auto-load subjects when a class is selected.

```
Step 1 — Class dropdown:
   GET /institute-classes/institute/:instituteId
   → [{ id, name, grade }]

Step 2 — Subject dropdown (cascades from selected class):
   GET /institutes/:instituteId/classes/:classId/subjects
   → [{ id, name, subjectCode }]
```

**No backend change needed.** Just wire the cascade trigger in React: on `classId` change,
re-fetch subjects and reset subject selection.

---

### Pain Point 9 (Attendance device → today's events)

**Goal**: On the "Bind session" dialog, auto-load today's events for the device's institute.

```
GET /institutes/:instituteId/calendar/today
→ { calendarDayId, defaultEventId, events: [{ id, name, startTime, isDefault }] }
```

Pre-select `defaultEventId`. Only show the date-picker if the admin wants a different date.

**No backend change needed.**

---

### Pain Point 10 (Exam dropdown — classId context)

**Goal**: When a teacher has already selected a class, the exam dropdown should only show exams
for that class.

```
GET /institute-class-subject-exams?instituteId=X&classId=Y&subjectId=Z&status=ACTIVE
→ paginated exams filtered by all three
```

**No backend change needed.** The endpoint already accepts `classId` + `subjectId` query params.

---

## 3. Missing Backend Endpoints (Must Build)

These are gaps that block complete UX resolution.

### 3.1 `GET /api/bookhires/available?instituteId=:id`

**Priority**: High  
**Why**: Students see ALL bookhires globally. Institute admins need to filter to their institute.

**Backend change** — Add `instituteId` query param to `BookhireController.getAvailable()`:

```typescript
// bookhire.controller.ts
@Get('available')
getAvailable(
  @Query('page') page = 1,
  @Query('limit') limit = 50,
  @Query('instituteId') instituteId?: string,  // ← ADD THIS
) {
  return this.bookhireService.getAvailable({ page, limit, instituteId });
}

// bookhire.service.ts — in getAvailable():
if (instituteId) {
  query.where('bookhire.instituteId = :instituteId', { instituteId });
}
```

---

### 3.2 `GET /admin/users/:userId/card` (Card lookup for admin)

**Priority**: Medium  
**Why**: Admins can look up a student's RFID card from student profile — only reverse direction
(card → student) exists right now.

**Backend change** — Add to `UserCardController`:

```typescript
@Get('admin/user/:userId/card')
@UseGuards(RolesGuard)
@RequireAnyOfRoles({ global: [UserType.SUPERADMIN], instituteAdmin: true })
async getCardByUser(@Param('userId') userId: string) {
  return this.userCardService.getCardsByUser(userId);
}
```

---

### 3.3 `GET /students?instituteId=:id` filter support

**Priority**: Medium  
**Why**: `GET /students` is SUPERADMIN-only and has no `instituteId` filter. The nested route
`GET /institutes/:id/classes/:classId/students` requires a class — no institute-wide student list
without knowing class.

**Backend change** — Add `instituteId` to `QueryStudentDto` and join through `InstituteUser` or
`InstituteClassStudent`:

```typescript
// query-student.dto.ts
@IsOptional()
@IsString()
instituteId?: string;

// students.service.ts — in findAll():
if (filters.instituteId) {
  query.innerJoin(
    'student.instituteUsers', 'iu',
    'iu.instituteId = :instituteId', { instituteId: filters.instituteId }
  );
}
```

---

### 3.4 `GET /institutes/:instituteId/calendar/days/:calendarDayId` (direct day lookup)

**Priority**: Low  
**Why**: There is no way to fetch a single calendar day by its ID. Only date-range or `/date/:date`
works. Needed when you have a calendarDayId from a stored value and need to display its label.

**Backend change** — Add to `InstituteCalendarController`:

```typescript
@Get('days/:calendarDayId')
async getCalendarDay(
  @Param('instituteId') instituteId: string,
  @Param('calendarDayId') calendarDayId: string,
) {
  return this.calendarService.getCalendarDayById(calendarDayId, instituteId);
}
```

---

## 4. Implementation Plan

### Phase 1 — Frontend Only (No backend changes needed) · 1 week

These fix the most critical pain points using existing APIs.

#### 1A. Device → Bind Session Dialog
**File**: `DeviceManagement.tsx` (Bind dialog)  
**Change**: Replace `eventId` + `calendarDayId` text inputs with:
- `DatePicker` (defaults to today, `YYYY-MM-DD`)
- On date select → `GET /institutes/:id/calendar/date/:date`
- Event `<Select>` populated from response `events[]`
- Pre-select `defaultEventId`
- Both `eventId` and `calendarDayId` resolved from API — never shown to user

```tsx
const [bindDate, setBindDate] = useState(format(new Date(), 'yyyy-MM-dd'));
const { data: dayData } = useQuery({
  queryKey: ['calendar-day', instituteId, bindDate],
  queryFn: () => api.get(`/institutes/${instituteId}/calendar/date/${bindDate}`),
  enabled: !!bindDate,
});
// Pre-select defaultEventId
const [selectedEventId, setSelectedEventId] = useState<string>('');
useEffect(() => {
  if (dayData?.defaultEventId) setSelectedEventId(dayData.defaultEventId);
}, [dayData]);
```

---

#### 1B. Device / Assign Institute Dialog
**File**: `DeviceManagement.tsx`, `AssignInstituteDialog.tsx`  
**Change**: Replace `instituteId` text input with:
- For SUPERADMIN: searchable dropdown calling `GET /institutes?search=Q&limit=20`
- For InstAdmin: use `AuthContext.user.institutes` (already loaded — no extra API call)

```tsx
// SUPERADMIN context:
const [instSearch, setInstSearch] = useState('');
const { data: institutes } = useQuery({
  queryKey: ['institutes', instSearch],
  queryFn: () => api.get(`/institutes?search=${instSearch}&limit=20`),
  enabled: isSuperAdmin,
  debounce: 300,
});
```

---

#### 1C. Exam Results — Pre-populated Student Table
**File**: Results entry page  
**Change**: When `examId` is selected, call:
```
GET /institute-class-subject-resaults/students-with-marks
    ?instituteId=&classId=&subjectId=&examId=
```
Render a table (student name, photo, score input, grade select) — pre-filled with existing marks.
Teacher only edits the scores, never types student IDs.

---

#### 1D. Class → Subject Auto-cascade
**File**: Any form with class + subject selectors  
**Change**: On `classId` change:
1. Clear subject selection
2. Fetch `GET /institutes/:id/classes/:classId/subjects`
3. Populate subject dropdown

Use a shared `useSubjectsForClass(instituteId, classId)` hook (create once, reuse everywhere).

---

#### 1E. Transport Enrollment — Bookhire Dropdown
**File**: `EnrollTransportDialog.tsx`  
**Change**: Replace `bookhireId` text input with:
```
GET /api/bookhires/available?limit=50
```
Show: vehicle number + owner name + route as display label. Store `.id` as value.

---

#### 1F. Bulk Attendance — Student List Auto-load
**File**: `BulkAttendancePage.tsx`  
**Change**: On class select, fetch:
```
GET /institutes/:id/classes/:classId/students
```
Render student rows (photo + name) pre-populated. Teacher only selects status (Present/Absent/
Late). No student ID entry.

---

### Phase 2 — Backend + Frontend · 1 week

#### 2A. `GET /api/bookhires/available?instituteId=:id`
Add `instituteId` query param to bookhire service/controller (see Section 3.1).  
Update `EnrollTransportDialog` to pass `instituteId` when calling the endpoint.

#### 2B. `GET /admin/users/:userId/card`
Add admin card lookup endpoint (see Section 3.2).  
Add card info display to student profile page (admin view).

#### 2C. `GET /students?instituteId=:id`
Add `instituteId` filter to student list endpoint (see Section 3.3).  
Use in institute-wide student search dropdowns.

---

### Phase 3 — Polish · 3–4 days

#### 3A. Shared Reusable Dropdown Components
Build once, use everywhere:

| Component | Calls | Props |
|---|---|---|
| `<InstituteSelect>` | `GET /institutes` or context | `value`, `onChange`, `role` |
| `<ClassSelect>` | `GET /institute-classes/institute/:id` | `instituteId`, `value`, `onChange` |
| `<SubjectSelect>` | `GET /institutes/:id/classes/:classId/subjects` | `instituteId`, `classId`, `value`, `onChange` |
| `<StudentSelect>` | `GET /institutes/:id/classes/:classId/students` | `instituteId`, `classId`, `value`, `onChange`, `multiple?` |
| `<ExamSelect>` | `GET /institute-class-subject-exams` | `instituteId`, `classId`, `subjectId`, `value`, `onChange` |
| `<EventSelect>` | `GET /institutes/:id/calendar/date/:date` | `instituteId`, `date`, `value`, `onChange` |
| `<BookhireSelect>` | `GET /api/bookhires/available` | `instituteId?`, `value`, `onChange` |

Each component:
- Shows a label (name/title), not an ID
- Stores the `.id` as value
- Supports search/filter
- Shows loading skeleton while fetching
- Shows "No results" empty state

#### 3B. `GET /institutes/:instituteId/calendar/days/:calendarDayId`
Add the direct calendar day lookup endpoint (see Section 3.4).

---

## 5. Summary Table

| Pain Point | Needs Backend Change | Phase | Effort |
|---|---|---|---|
| Device bind → eventId text | ❌ No | 1A | 3h |
| Device assign → instituteId text | ❌ No | 1B | 2h |
| Assign institute dialog → instituteId | ❌ No | 1B | 1h |
| Exam results → studentId per row | ❌ No | 1C | 4h |
| Class → subject cascade | ❌ No | 1D | 2h |
| Transport enrollment → bookhireId | ⚠️ Partial (global list works) | 1E | 2h |
| Bulk attendance → studentId array | ❌ No | 1F | 4h |
| Bookhire by instituteId filter | ✅ Yes — small | 2A | 2h backend + 1h frontend |
| Card lookup by student (admin) | ✅ Yes — small | 2B | 3h backend + 2h frontend |
| Student list by instituteId filter | ✅ Yes — small | 2C | 2h backend + 1h frontend |
| Shared dropdown components | ❌ No | 3A | 6h |
| Calendar day direct lookup | ✅ Yes — tiny | 3B | 1h backend |

**Total frontend effort**: ~30h  
**Total backend effort**: ~8h  
**No breaking changes** to any existing API or DB schema.

---

## 6. Key Files to Modify

### Frontend (`suraksha-lms123/src/`)
| File | Phase | Change |
|---|---|---|
| `components/DeviceManagement.tsx` | 1A, 1B | Bind dialog → date+event picker; Assign dialog → institute select |
| `components/AssignInstituteDialog.tsx` | 1B | institute text → `<InstituteSelect>` |
| `pages/ExamResultsPage.tsx` (or equivalent) | 1C | Pre-populated student table |
| `components/ClassSelector.tsx` | 1D | Auto-cascade subject on class change |
| `components/EnrollTransportDialog.tsx` | 1E | bookhireId text → `<BookhireSelect>` |
| `pages/BulkAttendancePage.tsx` | 1F | Student table from class students API |
| `components/ui/InstituteSelect.tsx` | 3A | New shared component |
| `components/ui/ClassSelect.tsx` | 3A | New shared component |
| `components/ui/SubjectSelect.tsx` | 3A | New shared component |
| `components/ui/StudentSelect.tsx` | 3A | New shared component |
| `components/ui/ExamSelect.tsx` | 3A | New shared component |
| `components/ui/EventSelect.tsx` | 3A | New shared component |
| `components/ui/BookhireSelect.tsx` | 3A | New shared component |

### Backend (`lms-api-suraksha-lk/src/`)
| File | Phase | Change |
|---|---|---|
| `modules/private-transportation/controllers/bookhire.controller.ts` | 2A | Add `instituteId` query param |
| `modules/private-transportation/services/bookhire.service.ts` | 2A | Add institute filter to query |
| `modules/card/controllers/user-card.controller.ts` | 2B | Add `GET admin/user/:userId/card` |
| `modules/card/services/user-card.service.ts` | 2B | Add `getCardsByUser(userId)` |
| `modules/student/dto/query-student.dto.ts` | 2C | Add `instituteId` optional field |
| `modules/student/students.service.ts` | 2C | Add institute join to findAll query |
| `modules/institute/controllers/institute-calendar.controller.ts` | 3B | Add `GET days/:calendarDayId` |
| `modules/institute/services/institute-calendar.service.ts` | 3B | Add `getCalendarDayById()` |

---

## 7. API Quick-Reference for Frontend Implementation

```typescript
// Institute list (SUPERADMIN)
GET /institutes?search=q&page=1&limit=20
→ { count, total, data: [{ id, instituteName, instituteCode }] }

// User's institutes (InstAdmin / Teacher / Student)
// ← Already in AuthContext.user.institutes — no extra call needed

// Classes for institute
GET /institute-classes/institute/:instituteId
→ [{ id, className, grade, academicYear }]

// Subjects for class
GET /institutes/:instituteId/classes/:classId/subjects
→ [{ id, subjectName, subjectCode, subjectType }]

// Students in class
GET /institutes/:instituteId/classes/:classId/students
→ [{ userId, firstName, lastName, imageUrl, studentNumber }]

// Students in class+subject
GET /institute-class-subject-students/class-subject/:instituteId/:classId/:subjectId
→ [{ studentId, userId, firstName, lastName, imageUrl }]

// Exams (filtered)
GET /institute-class-subject-exams?instituteId=X&classId=Y&subjectId=Z&status=ACTIVE
→ { count, total, data: [{ id, examName, examType, examDate, totalMarks }] }

// Calendar day + events for a date
GET /institutes/:instituteId/calendar/date/YYYY-MM-DD
→ { calendarDayId, dayType, defaultEventId, events: [{ id, eventName, startTime, endTime, isDefault }] }

// Today's calendar (same shape)
GET /institutes/:instituteId/calendar/today
→ { calendarDayId, defaultEventId, events: [...] }

// Available transports
GET /api/bookhires/available?page=1&limit=50
→ { data: [{ id, vehicleNumber, ownerName, routeDescription }] }
// (After Phase 2A: add &instituteId=X)

// Students with exam marks (existing endpoint from earlier session)
GET /institute-class-subject-resaults/students-with-marks
    ?instituteId=X&classId=Y&subjectId=Z&examId=E
→ [{ userId, firstName, lastName, imageUrl, examId, score, grade }]
```
