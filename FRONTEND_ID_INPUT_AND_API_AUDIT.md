# Frontend ID Input Pain Points & API GET Endpoint Audit

**Scope:** `suraksha-lms123/src/`  
**Stack:** React 19 · TypeScript · Vite · Capacitor · TanStack Query · React Hook Form · Zod  
**UI Layer:** shadcn/ui (`<Input>`, `<Select>`) + MUI  
**Auth context (`useAuth()`) auto-provides:** `currentInstituteId`, `currentClassId`, `currentSubjectId`, `selectedInstitute`, `selectedClass`, `selectedSubject`, `selectedChild`, `user`

---

## Section A — ID Input Pain Points

> Severity legend: 🔴 High — user must know/guess a DB ID | 🟡 Medium — workaround exists | 🟢 Acceptable — hardware/external constraint

### A1. Free-Text ID Inputs (Users Must Manually Type a System ID)

| # | Severity | File | Component / Dialog | Field(s) | Input Type | What Calls This | Improvement |
|---|----------|------|--------------------|----------|------------|-----------------|-------------|
| 1 | 🔴 | `src/pages/BulkAttendancePage.tsx` | `BulkAttendancePage` | `studentId` (per-row, up to 100) | `<Input placeholder="Student ID *">` | `adminAttendanceApi.markBulkAttendance()` → `POST /api/attendance/mark-bulk` | Replace row inputs with a student-picker loaded from `GET /institute-users/institute/{id}/users/STUDENT/class/{classId}` |
| 2 | 🔴 | `src/components/ClassSelector.tsx` (line ~978) | Enrollment dialog inside `ClassSelector` | `classId` | `<Input placeholder="Enter class ID">` | `instituteClassesApi.enroll({ classId, enrollmentCode })` | Dropdown from `instituteClassesApi.getByInstitute(instituteId)` — the data already exists |
| 3 | 🔴 | `src/pages/DeviceManagement.tsx` (`BindEventDialog`) | Bind-Event dialog | `eventId` (number), `calendarDayId` (number) | `<Input type="number">` for both | `systemAdminDeviceApi.bindEvent()` / `instituteDeviceApi.bindEvent()` | Calendar-event dropdown via `calendarApi.getToday(instituteId)` or `calendarApi.getByDate()` — already used by `EventSelector` component |
| 4 | 🔴 | `src/pages/DeviceManagement.tsx` (`AssignDialog`) | Assign-to-Institute dialog | `instId` (string) | `<Input placeholder="109">` | `systemAdminDeviceApi.assign()` / `systemAdminDeviceApi.changeInstitute()` | Institute search/autocomplete from `GET /users/{userId}/institutes` |
| 5 | 🔴 | `src/pages/DeviceManagement.tsx` (`RegisterDeviceDialog`) | Register-Device dialog | `instituteId` (optional string) | `<Input placeholder="109">` | `systemAdminDeviceApi.register()` | Same as #4 — institute search or auto-populate when admin is scoped to one institute |
| 6 | 🔴 | `src/components/AssignInstituteDialog.tsx` | `AssignInstituteDialog` | `instituteId` | `<Input placeholder="Enter institute ID">` | `PUT /organization/api/v1/organizations/{orgId}/assign-institute` | Institute search dropdown; IDs are numeric strings not visible in the UI otherwise |
| 7 | 🔴 | `src/components/forms/EnrollTransportDialog.tsx` | `EnrollTransportDialog` | `bookhireId` (number) | `<Input type="number" placeholder="Enter bookhire ID">` | `transportApi.enrollTransport()` → `POST /api/student-bookhire-enrollment` | Needs a new backend endpoint `GET /api/bookhire` returning available services; currently no list endpoint exists |
| 8 | 🟡 | `src/components/forms/CreateComprehensiveUserForm.tsx` | `CreateComprehensiveUserForm` | `fatherId`, `motherId`, `guardianId` | Free-text numeric inputs | User create/update API | User search/autocomplete against `parentsApi.getInstituteParents(instituteId)` → `GET /institute-users/institute/{id}/users/PARENT` |
| 9 | 🟡 | `src/pages/CardUserLookupPage.tsx` | `CardUserLookupPage` | `cardId` (institute card string) | `<Input>` | `adminAttendanceApi.getCardUser()` → `GET /api/attendance/institute-card-user` | Could show a registered-card registry if such a list endpoint existed; currently no browse API for cards |
| 10 | 🟡 | `src/components/admin-attendance/CardManagement.tsx` | `CardManagement` | `cardId` (institute card string) | `<Input placeholder="e.g. CARD001">` | `adminAttendanceApi.getCardUser()` + `getAttendanceByCardId()` | Same as #9 — no card browse endpoint currently |
| 11 | 🟢 | `src/pages/InstituteMarkAttendance.tsx` | `InstituteMarkAttendance` | `instituteCardId` | `<Input placeholder="Scan or enter RFID ID...">` | `childAttendanceApi.markAttendanceByInstituteCard()` | Designed for RFID scanner hardware auto-populating the field; acceptable as-is |
| 12 | 🟢 | `src/pages/RFIDAttendance.tsx` | `RfidAttendance` | `rfidCardId` | `<Input>` | `childAttendanceApi.markAttendanceByCard()` | Same RFID-hardware intent as #11; acceptable as-is |
| 13 | 🟢 | `src/pages/DeviceManagement.tsx` (`RegisterDeviceDialog`) | Register-Device dialog | `deviceUid` (string) | `<Input placeholder="DEVICE-SN-00129">` | `systemAdminDeviceApi.register()` | Must be typed — this is a physical hardware serial number |

---

### A2. IDs Resolved via Dropdown (Good Patterns — No User Pain)

| Component | ID Field | How ID is resolved | Endpoint |
|-----------|----------|--------------------|----------|
| `EventSelector` (used in BulkAttendancePage, QRAttendance, RFIDAttendance, etc.) | `eventId` | `<Select>` populated by `useTodayCalendarEvents(instituteId, classId, date)` | `GET /institutes/{id}/calendar/today` or `GET /institutes/{id}/calendar/date/{date}` |
| `ClassSelector` | `instituteId`, `classId`, `subjectId` | Cascaded `<Select>` loaded from API + auth context | `GET /institute-classes/institute/{id}`, `GET /institute-class-subjects/institute/{id}` |
| Exam filter in Results / ExamResults pages | `examId` | `<Select>` populated by `examApi.getExams({instituteId, classId, subjectId})` | `GET /institute-class-subject-exams` |
| Institute selector (various pages) | `instituteId` | Loaded from `instituteApi.getUserInstitutes(userId)` | `GET /users/{userId}/institutes` |
| Device type in RegisterDeviceDialog | `deviceType` | `<Select>` over `DEVICE_TYPES` constant | Static enum, no API call |

---

### A3. IDs Auto-Resolved from Auth Context (No User Input Needed)

The following ID fields are **never entered by users** — they are read from `useAuth()` automatically:

- `currentInstituteId` — used in: BulkAttendancePage, RFIDAttendance, InstituteMarkAttendance, QRAttendance, QRCodeScanner, CardUserLookupPage, Results, ClassSubjects, TeacherEnrollmentManagement
- `currentClassId` — used in: BulkAttendancePage, QRAttendance, InstituteMarkAttendance
- `currentSubjectId` — used in: QRAttendance, InstituteMarkAttendance, Results

---

### A4. IDs from URL Path Parameters (No User Input Needed)

| Page | URL pattern | ID fields extracted |
|------|------------|---------------------|
| `CreateExamResults.tsx` | `/institute/:instituteId/class/:classId/subject/:subjectId/exam/:examId` | All four from `useParams()` |
| `TeacherEnrollmentManagement.tsx` | `?instituteId=&classId=&subjectId=` | From `useSearchParams()` |

---

### A5. Hardcoded / Sentinel Constants (Not Real DB IDs)

| File | Constant | Value | Purpose |
|------|----------|-------|---------|
| `src/hooks/useTodayCalendarEvents.ts:25` | `DEFAULT_EVENT_ID` | `'__default__'` | UI sentinel for "no specific event selected" — never sent to backend |

---

## Section B — All GET Endpoints by API File

### B1. `adminAttendance.api.ts` · `attendanceApiClient` (`VITE_ATTENDANCE_BASE_URL`)

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/api/attendance/student/{studentId}` | `instituteId`, `startDate`, `endDate`, `page?`, `limit?`, `status?` | `AttendanceQueryResponse` |
| GET | `/api/attendance/by-cardId/{cardId}` | `startDate?`, `endDate?`, `page?`, `limit?` | `AttendanceQueryResponse` |
| GET | `/api/attendance/institute/{instituteId}` | `startDate`, `endDate`, `page?`, `limit?`, `status?`, `studentId?` | `AttendanceQueryResponse` |
| GET | `/api/attendance/institute/{instituteId}/class/{classId}` | same as above | `AttendanceQueryResponse` |
| GET | `/api/attendance/institute/{instituteId}/class/{classId}/subject/{subjectId}` | same | `AttendanceQueryResponse` |
| GET | `/api/attendance/institute/{instituteId}/class/{classId}/student/{studentId}` | same | `AttendanceQueryResponse` |
| GET | `/api/attendance/institute/{instituteId}/class/{classId}/subject/{subjectId}/student/{studentId}` | same | `AttendanceQueryResponse` |
| GET | `/api/attendance/institute-card-user` | `instituteCardId`, `instituteId` | `CardUserResponse` |
| GET | `/api/attendance/institute/{instituteId}/class/{classId}/card-user` | `instituteCardId` | `CardUserResponse` |
| GET | `/api/attendance/institute/{instituteId}/class/{classId}/subject/{subjectId}/card-user` | `instituteCardId` | `CardUserResponse` |
| GET | `/api/attendance/calendar/institute/{instituteId}/event/{eventId}` | `date?`, `classId?`, `subjectId?`, `page?`, `limit?` | `AttendanceQueryResponse` |
| GET | `/api/attendance/calendar/institute/{instituteId}/calendar-day/{calendarDayId}` | `userType?`, `classId?`, `subjectId?`, `page?`, `limit?` | `AttendanceQueryResponse` |
| GET | `/api/attendance/calendar/institute/{instituteId}/user-type/{userType}` | `date?`, `eventId?`, `page?`, `limit?` | `AttendanceQueryResponse` |
| GET | `/api/attendance/calendar/institute/{instituteId}/class/{classId}/user-type/{userType}` | same | `AttendanceQueryResponse` |
| GET | `/api/attendance/calendar/institute/{instituteId}/class/{classId}/subject/{subjectId}/user-type/{userType}` | same | `AttendanceQueryResponse` |
| GET | `/api/attendance/calendar/institute/{instituteId}/student/{studentId}/event/{eventId}` | `date?`, `page?`, `limit?` | `AttendanceQueryResponse` |

---

### B2. `calendar.api.ts` · `apiClient` (`VITE_LMS_BASE_URL`)

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/institutes/{instituteId}/calendar/operating-config` | `academicYear?` | `OperatingConfig[]` |
| GET | `/institutes/{instituteId}/calendar/days` | Various filters | `CalendarDay[]` |
| GET | `/institutes/{instituteId}/calendar/today` | — | `CalendarDay` |
| GET | `/institutes/{instituteId}/calendar/date/{date}` | — | `CalendarDay` |
| GET | `/institute/{instituteId}/calendar-view` | Various | `CalendarDay[] \| CalendarViewData` |
| GET | `/institutes/{instituteId}/calendar/month` | `year`, `month` | `{ days: CalendarDay[] }` |

---

### B3. `institute.api.ts` · `apiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/users/{userId}/institutes` | — | `Institute[]` |
| GET | `/institute-classes` | `instituteId`, `page?`, `limit?`, `isActive?`, `search?` | `ApiResponse<Class[]>` |
| GET | `/institute-class-subjects/institute/{instituteId}` | — | `any[]` |
| GET | `/institute-users/institute/{instituteId}/users` | — | `InstituteUser[]` |
| GET | `/institute-users/institute/{instituteId}/users/{userType}` | `page?`, `limit?` | paginated user list |
| GET | `/institute-users/institute/{instituteId}/users/STUDENT/class/{classId}/subject/{subjectId}` | `page?`, `limit?` | paginated `InstituteUser[]` |

---

### B4. `instituteClasses.api.ts` · `enhancedCachedClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/institute-classes/institute/{instituteId}` | `page?`, `limit?` | `InstituteClass[]` |
| GET | `/institute-classes/{instituteId}/teacher/{teacherId}` | `page?`, `limit?` | `TeacherClassesResponse` |
| GET | `/institute-classes/{classId}/enrollment-code` | — | `EnrollmentCodeResponse` |

---

### B5. `subjects.api.ts` · `apiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/subjects` | `instituteId`, `isActive?`, `search?`, `category?`, `subjectType?`, `basketCategory?`, `page?`, `limit?`, `sortBy?`, `sortOrder?` | `Subject[]` |
| GET | `/subjects/stats` | `instituteId` | `{ total, active, inactive }` |
| GET | `/subjects/categories` | `instituteId` | `{ category, count }[]` |

---

### B6. `exam.api.ts` · `apiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/institute-class-subject-exams` | `instituteId?`, `classId?`, `subjectId?`, `page?`, `limit?`, `sortBy?`, `sortOrder?`, `search?`, `status?`, `isActive?` | `ApiResponse<Exam[]>` |
| GET | `/institute-class-subject-exams/{id}` | — | `Exam` |

---

### B7. `examResults.api.ts` · `apiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/institute-class-subject-resaults` *(sic)* | `instituteId?`, `classId?`, `subjectId?`, `examId?`, `studentId?`, `page?`, `limit?` | `ExamResultsResponse` |
| GET | `/institute-class-subject-resaults/students-with-marks` | `instituteId`, `classId`, `subjectId`, `examId` | `StudentExamMark[]` |

---

### B8. `homework.api.ts` · `apiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/institute-class-subject-homeworks` | `instituteId?`, `classId?`, `subjectId?`, `page?`, `limit?`, `search?`, `status?`, `isActive?`, `includeReferences?`, `includeSubmissions?` | `ApiResponse<Homework[]>` |
| GET | `/institute-class-subject-homeworks/{id}` | — | `Homework` |

---

### B9. `homeworkSubmissions.api.ts` · `apiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/institute-class-subject-homework-submissions` | `homeworkId?`, `studentId?`, `page?`, `limit?`, `instituteId?`, `classId?`, `subjectId?` | `ApiResponse<HomeworkSubmission[]>` |
| GET | `/institute-class-subject-homework-submissions/{id}` | — | `HomeworkSubmission` |

---

### B10. `homeworkReferences.api.ts` · `apiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/homework-references` | `homeworkId?`, `referenceType?`, `referenceSource?`, `isActive?`, `search?`, `page?`, `limit?`, `sortBy?`, `sortOrder?` | `ApiResponse<HomeworkReference[]>` |
| GET | `/homework-references/homework/{homeworkId}` | — | `HomeworkReference[]` |

---

### B11. `lecture.api.ts` · `apiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/institute-class-subject-lectures` | `instituteId?`, `classId?`, `subjectId?`, `page?`, `limit?`, `search?`, `status?`, `isActive?` | `ApiResponse<Lecture[]>` |
| GET | `/institute-lectures` | `instituteId?`, `page?`, ... | `ApiResponse<Lecture[]>` |
| GET | `/institute-class-subject-lectures/{id}` | — | `Lecture` |
| GET | `/institute-lectures/{id}` | — | `Lecture` |

---

### B12. `structuredLectures.api.ts` · `apiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/api/structured-lectures` | `grade?`, `isActive?`, `search?`, `page?`, `limit?`, `sortBy?`, `sortOrder?` | `StructuredLecturesResponse` |
| GET | `/api/structured-lectures/{id}` | — | `StructuredLecture` |
| GET | `/api/structured-lectures/institute/{instituteId}/subject/{subjectId}` | `grade?`, `isActive?` | `StructuredLecturesResponse` |
| GET | `/api/structured-lectures/subject/{subjectId}/grade/{grade}` | `isActive?` | `LecturesBySubjectGradeResponse` |
| GET | `/api/structured-lectures/class/{classId}/subject/{subjectId}` | `grade?`, `isActive?`, `page?`, `limit?` | `LecturesByClassSubjectResponse` |
| GET | `/api/structured-lectures/statistics/{subjectId}` | `grade?` | `LectureStatisticsResponse` |

---

### B13. `organization.api.ts` · `apiClient` / `cachedApiClient` (`VITE_API_BASE_URL_2`)

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/organizations/user/enrolled` | `page?`, `limit?`, `search?`, `type?`, `isPublic?` | `OrganizationResponse` |
| GET | `/organizations` | same | `OrganizationResponse` |
| GET | `/organizations/institute/{instituteId}` | same | `OrganizationResponse` |
| GET | `/causes` | — | `CourseResponse` |
| GET | `/organizations/{organizationId}/causes` | — | `CourseResponse` |
| GET | `/lectures` | — | `LectureResponse` |

---

### B14. `transport.api.ts` · `attendanceApiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/api/student-bookhire-enrollment/student/{studentId}` | `page?`, `limit?` | `TransportEnrollmentsResponse` |
| GET | `/api/bookhire-attendance/student/{studentId}` | `page?`, `limit?`, `bookhireId` | `TransportAttendanceResponse` |

---

### B15. `deviceManagement.api.ts` · `attendanceApiClient`

**System Admin endpoints:**

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/api/admin/attendance-devices` | `DeviceListQueryParams` (search, status, instituteId, page, limit, etc.) | `DeviceListResponse` |
| GET | `/api/admin/attendance-devices/{deviceId}` | — | `DeviceDetail` |
| GET | `/api/admin/attendance-devices/stats` | — | `DeviceStats` |
| GET | `/api/admin/attendance-devices/{deviceId}/config` | — | `DeviceConfig` |
| GET | `/api/admin/attendance-devices/{deviceId}/bindings` | — | `DeviceEventBinding[]` |
| GET | `/api/admin/attendance-devices/{deviceId}/sessions` | — | `DeviceSession[]` |
| GET | `/api/admin/attendance-devices/{deviceId}/audit` | `limit?` | `DeviceAuditEntry[]` |

**Institute Admin endpoints:**

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/api/institute/{instituteId}/devices` | — | `DeviceListResponse` |
| GET | `/api/institute/{instituteId}/devices/{deviceId}` | — | `DeviceDetail` |
| GET | `/api/institute/{instituteId}/devices/{deviceId}/config` | — | `DeviceConfig` |
| GET | `/api/institute/{instituteId}/devices/{deviceId}/bindings` | — | `DeviceEventBinding[]` |
| GET | `/api/institute/{instituteId}/devices/{deviceId}/sessions` | — | `DeviceSession[]` |
| GET | `/api/institute/{instituteId}/devices/{deviceId}/audit` | — | `DeviceAuditEntry[]` |

---

### B16. `institutePayments.api.ts` · `apiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/institute-payments/institute/{instituteId}/payments` | `page?`, `limit?`, `search?`, `status?`, `priority?`, `targetType?`, `sortBy?`, `sortOrder?` | `InstitutePaymentsResponse` |
| GET | `/institute-payments/institute/{instituteId}/my-payments` | `page?`, `limit?`, `search?`, `status?`, `priority?` | `StudentPaymentsResponse` |
| GET | `/institute-payments/institute/{instituteId}/stats` | — | `PaymentStatsResponse` |
| GET | `/institute-payments/institute/{instituteId}/my-summary` | — | `MySummaryResponse` |
| GET | `/institute-payments/institute/{instituteId}/payment/{paymentId}/submissions` | — | `PaymentSubmissionsResponse` |
| GET | `/institute-payments/institute/{instituteId}/my-submissions` | — | `MySubmissionsResponse` |
| GET | `/institute-payments/institute/{instituteId}/pending-submissions` | — | `PendingSubmissionsResponse` |

---

### B17. `subjectPayments.api.ts` · `apiClient`

Base: `/institute-class-subject-payments/institute/{instituteId}/class/{classId}/subject/{subjectId}`

| Method | Path Suffix | Key Query Params | Return Type |
|--------|-------------|-----------------|-------------|
| GET | *(base)* | `page?`, `limit?` | `SubjectPaymentsResponse` |
| GET | `/my-payments` | `page?`, `limit?` | `SubjectPaymentsResponse` (student view) |
| GET | `/stats` | — | `SubjectPaymentStatsResponse` |
| GET | `/my-status` | — | `SubjectMyStatusResponse` |
| GET | `/submissions` | — | `SubjectSubmissionsResponse` |

---

### B18. `userCard.api.ts` · `enhancedCachedClient` + `apiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/user-card/cards` | `page?`, `limit?`, `cardType?`, `search?` | `PaginatedCardsResponse` |
| GET | `/user-card/orders` | `page?`, `limit?`, `orderStatus?`, `cardType?` | `PaginatedOrdersResponse` |
| GET | `/user-card/orders/{orderId}` | — | `UserIdCardOrder` |
| GET | `/user-card/my-cards` | `page?`, `limit?`, `cardType?` | `PaginatedOrdersResponse` |

---

### B19. `students.api.ts` · `apiClient`

| Method | Path | Return Type |
|--------|------|-------------|
| GET | `/students/{userId}` | `Student` |

---

### B20. `users.api.ts` · `apiClient`

| Method | Path | Return Type |
|--------|------|-------------|
| GET | `/users/basic/{userId}` | `BasicUser` |
| GET | `/users/basic/rfid/{rfid}` | `BasicUser` |

---

### B21. `parents.api.ts` · `apiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/institute-users/institute/{instituteId}/users/PARENT` | `page?`, `limit?`, `occupation?`, `workplace?`, `enrolledAfter?`, `sortBy?`, `sortOrder?` | `InstituteParentsResponse` |
| GET | `/institute-users/institute/{instituteId}/users/PARENT/class/{classId}` | same | `InstituteParentsResponse` |
| GET | `/institute-users/institute/{instituteId}/users/PARENT/class/{classId}/subject/{subjectId}` | same | `InstituteParentsResponse` |
| GET | `/parents/{parentId}/children` | — | `ParentChildrenResponse` |

---

### B22. `instituteStudents.api.ts` · `attendanceApiClient` + `enhancedCachedClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `{attendanceUrl}/institute-users/institute/{id}/users/STUDENT/class/{classId}` | `page`, `limit`, `parent?` | `StudentListResponse` |
| GET | `{attendanceUrl}/institute-users/institute/{id}/users/STUDENT/class/{classId}/subject/{subjectId}` | same | `StudentListResponse` |
| GET | `{attendanceUrl}/api/attendance/institute/{instituteId}` | `startDate`, `endDate`, `studentId?`, `page?`, `limit?`, `status?` | `StudentAttendanceResponse` |
| GET | `{attendanceUrl}/api/attendance/institute/{instituteId}/class/{classId}` | same | `StudentAttendanceResponse` |
| GET | `{attendanceUrl}/api/attendance/institute/{instituteId}/class/{classId}/subject/{subjectId}` | same | `StudentAttendanceResponse` |
| GET | `{attendanceUrl}/api/attendance/student/{studentId}` | same | `StudentAttendanceResponse` |

---

### B23. `studentAttendance.api.ts` · `enhancedCachedClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/api/attendance/institute/{instituteId}` | `studentId`, `startDate`, `endDate`, `page?`, `limit?` | `StudentAttendanceResponse` |
| GET | `/api/attendance/institute/{instituteId}/class/{classId}` | same | `StudentAttendanceResponse` |
| GET | `/api/attendance/institute/{instituteId}/class/{classId}/subject/{subjectId}` | same | `StudentAttendanceResponse` |

*(Smart dispatch: `getAttendance()` picks the narrowest scope automatically.)*

---

### B24. `childAttendance.api.ts` · `attendanceApiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/api/attendance/student/{studentId}` | `startDate?`, `endDate?`, `page?`, `limit?` | `ChildAttendanceResponse` |

---

### B25. `myAttendanceHistory.api.ts` · `attendanceApiClient`

| Method | Path | Key Query Params | Return Type |
|--------|------|-----------------|-------------|
| GET | `/api/attendance/my-history` | `startDate?`, `endDate?`, `instituteId?`, `status?`, `page?`, `limit?` | `MyAttendanceHistoryResponse` |

---

### B26. `enrollment.api.ts` · `apiClient`

| Method | Path | Return Type |
|--------|------|-------------|
| GET | `/institute-class-subject-students/enrollment-settings/{instituteId}/{classId}/{subjectId}` | `EnrollmentSettingsResponse` |

---

### B27. `instituteSettings.api.ts` · `apiClient`

| Method | Path | Return Type |
|--------|------|-------------|
| GET | `/institutes/{instituteId}/settings` | `InstituteSettingsResponse` |
| GET | `/institutes/{instituteId}/profile` | `InstituteProfileResponse` |

---

### B28. `profileImage.api.ts` · `apiClient`

| Method | Path | Return Type |
|--------|------|-------------|
| GET | `/users/profile/image-status` | `ProfileImageStatus` |
| GET | `/users/profile/image-history` | `ProfileImageHistoryResponse` |
| GET | `/users/{id}/profile-image/institute/{instituteId}/history` | `InstituteImageHistoryResponse` |
| GET | `/institute-users/institute/{id}/users/unverified-with-images` | `InstituteUnverifiedImagesResponse` |
| GET | `/admin/users/unverified-images` | `AdminImageListResponse` |

---

### B29. `account-deletion.api.ts` · `apiClient`

| Method | Path | Return Type |
|--------|------|-------------|
| GET | `/account/deletion-status` | account deletion status object |

---

### B30. `otpVerification.api.ts` · raw `fetch` (POST only)

> No GET endpoints. All operations (`requestEmailOtp`, `verifyEmailOtp`, `requestPhoneOtp`, `verifyPhoneOtp`, and `reRequest*`) are POST.

---

### B31. `firstLogin.api.ts` · raw `fetch` (POST only)

> No GET endpoints. All operations (`initiate`, `verifyOtp`, `additionalVerify`, `completeProfile`) are POST.

---

### B32. `instituteRegistration.api.ts` · raw `fetch` (POST only)

> No GET endpoints. Provides `uploadInstituteFile()`, `createInstitute()`, and helper functions. Also exports eligibility helpers `canCreateInstitute()` and `canCreateInstituteFromJwt()`.

---

### B33. `attendance.api.ts` · raw `fetch` / `attendanceApiClient` (POST only for public surface)

> Exposes `markAttendanceApi` (POST mark-single, mark-bulk, mark-by-card, mark-by-institute-card). GET attendance queries are handled by `adminAttendance.api.ts` and `studentAttendance.api.ts`.

---

## Summary Table — ID Pain Points by Severity

| Severity | Count | Key issues |
|----------|-------|------------|
| 🔴 High | 7 | BulkAttendancePage student rows, ClassSelector enrollment dialog classId, BindEventDialog eventId/calendarDayId, both AssignDialog forms (DeviceManagement + AssignInstituteDialog), EnrollTransportDialog bookhireId, DeviceManagement Register instituteId |
| 🟡 Medium | 4 | fatherId/motherId/guardianId in user create form, cardId in CardUserLookupPage, CardManagement |
| 🟢 Acceptable | 3 | RFID hardware inputs (InstituteMarkAttendance, RFIDAttendance), Device serial UID |

**Quick wins (data already available, just need a dropdown):**
- `BulkAttendancePage` `studentId` rows → student list from `GET /institute-users/.../STUDENT/class/{classId}` ✅ endpoint exists
- `ClassSelector` enrollment `classId` → class list from `instituteClassesApi.getByInstitute()` ✅ data already loaded elsewhere in the same component
- `BindEventDialog` `eventId` → calendar events from `calendarApi.getToday()` ✅ already used by `EventSelector` component
- `fatherId/motherId/guardianId` → parent list from `parentsApi.getInstituteParents()` ✅ endpoint exists

**Needs new backend endpoint:**
- `EnrollTransportDialog` `bookhireId` — no `GET /api/bookhire` list endpoint currently exists
