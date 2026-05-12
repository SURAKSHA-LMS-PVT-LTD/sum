    # Institute Feature Plugin System - Feature Usage Map

    Status: Draft
    Date: 2026-05-13
    Scope: lms user frotend

    ## Purpose
    This document is the single source of truth for feature keys, scopes, and UI surfaces.
    Use it to avoid mismatches between sidebar items, dashboards, pages, and forms.

    ## Golden rules to avoid mismatches
    - Use one shared `FEATURE_KEYS` map and reuse it everywhere (sidebar, dashboards, forms, routes).
    - Every new sidebar item must have a feature key or be marked as core.
    - If a feature hides a page, also hide entry buttons and quick actions that navigate to it.
    - If a feature hides a form section, also hide any related preview or summary badges.
    - Missing keys are treated as disabled (no defaults).

    ## Encoding options (detailed)
    ### Key-based (default)
    - Response example:
    ```json
    {
    "instituteId": "1",
    "version": 1,
    "features": {
        "institute-lectures": { "enabled": true, "scope": "institute", "pricing": "free" },
        "lecture-live-attendance": { "enabled": false, "scope": "class", "pricing": "paid", "billingCycle": "monthly" }
    }
    }
    ```
    - Best for debugging and safe rollouts.

    ### ID-based (compact, optional)
    - Catalog response (cached by version):
    ```json
    {
    "catalogVersion": 12,
    "idToKey": {
        "1": "institute-lectures",
        "2": "lecture-live-attendance"
    }
    }
    ```
    - Enabled list response:
    ```json
    {
    "instituteId": "1",
    "catalogVersion": 12,
    "enabledFeatureIds": [1, 2, 5]
    }
    ```
    - Frontend resolves IDs using the cached catalog map.
    - If versions mismatch, refetch the catalog.

    ## Feature usage map

    ### Institute scope - Academics
    - `classes`
    - Sidebar: Academics > All Classes
    - Dashboard tile: All Classes
    - Page: Institute classes list
    - `institute-subjects`
    - Sidebar: Academics > Institute Subjects
    - Dashboard tile: Institute Subjects
    - Page: Institute subjects list
    - `institute-lectures`
    - Sidebar: Academics > Institute Lectures (when no class selected)
    - Dashboard tile: Institute Lectures
    - Page: Institute lecture list
    - `structured-lectures`
    - Sidebar: Academics > Structured Lectures (if surfaced)
    - Dashboard tile: Structured Lectures
    - Page: Structured lecture management
    - Dependency: `institute-lectures`
    - `institute-organizations`
    - Sidebar: Academics > Organization
    - Page: Institute organization management

    ### Institute scope - Community
    - `houses`
    - Sidebar: Community > Houses
    - Page: Houses management
    - Note: Only show for institutes that use houses

    ### Institute scope - Manage Users
    - `institute-users`
    - Sidebar: Manage Users > All Users
    - Page: Institute users list
    - `parents`
    - Sidebar: Manage Users > Parents
    - Page: Parent list
    - `verify-image`
    - Sidebar: Manage Users > Verify Photos
    - Page: Verify profile photos

    ### Institute scope - Attendance
    - `select-attendance-mark-type`
    - Sidebar: Attendance > Mark Attendance
    - Page: Attendance mark type selector
    - `qr-attendance`
    - Page: QR/Barcode attendance flow
    - Form: Hide QR option in mark type selector
    - Dependency: `select-attendance-mark-type`
    - `rfid-attendance`
    - Page: RFID attendance flow
    - Form: Hide RFID option in mark type selector
    - Dependency: `select-attendance-mark-type`
    - `daily-attendance`
    - Sidebar: Attendance > Institute Attendance
    - Page: Institute attendance list
    - `admin-attendance`
    - Sidebar: Attendance > Advanced Attendance
    - Page: Institute attendance analytics
    - `lecture-live-attendance`
    - Sidebar: Attendance > Live Attendance (when class is selected)
    - Page: Live lecture attendance
    - If a subject-level live attendance view exists, gate it here too
    - Dependency: `lectures` and attendance
    - `lecture-recording-attendance`
    - Sidebar: Attendance > Recording Attendance (when class is selected)
    - Page: Recorded lecture attendance
    - If a subject-level recording view exists, gate it here too
    - Dependency: `lectures` and attendance
    - `calendar-view`
    - Sidebar: Calendar > View Calendar
    - Page: Attendance calendar view
    - `calendar-management`
    - Sidebar: Calendar > Manage Calendar (admin only)
    - Page: Academic calendar management

    ### Institute scope - Communication
    - `sms`
    - Sidebar: Communication > Send SMS
    - Page: SMS sender
    - `sms-history`
    - Sidebar: Communication > SMS History
    - Page: SMS history list
    - `institute-notifications`
    - Sidebar: Communication > Notifications
    - Page: Notifications list

    ### Institute scope - Payments and Billing
    - `institute-payments`
    - Sidebar: Fees & Payments > Institute Fees
    - Page: Institute fee management
    - `pending-submissions`
    - Sidebar: Fees & Payments > Review Payments
    - Page: Payment approvals
    - `collect-physical-payment`
    - Sidebar: Fees & Payments > Collect Payment
    - Page: Physical payment collection
    - `institute-billing`
    - Sidebar: Fees & Payments > Billing and Plan
    - Page: Billing and plan info
    - `institute-credits`
    - Sidebar: Fees & Payments > Institute Wallet
    - Page: Institute credit wallet

    ### Institute scope - Admin Tools
    - `device-management`
    - Sidebar: Account > Device Management
    - Page: Device management

    ### Institute scope - Services
    - `transport`
    - Sidebar: Services > Transport
    - Page: Transport module
    - `id-cards`
    - Sidebar: Services > ID Cards
    - Page: ID card management
    - `organizations`
    - Sidebar: Services > Organizations
    - Page: External organization list
    - `system-payment`
    - Sidebar: Services > System Payment
    - Page: System payment flow

    ### Institute scope - Settings and Branding
    - `login-branding`
    - Settings section: Domain and Login Page tab
    - Login page: Custom branding applied
    - `custom-domain`
    - Settings section: Custom Domain fields
    - Dependency: `login-branding`
    - `subdomain`
    - Settings section: Subdomain fields
    - Dependency: `login-branding`
    - `video-background`
    - Settings section: Login background video controls
    - Dependency: `login-branding`
    - `report-branding`
    - Settings section: Report header and footer upload

    ### Class scope - Academics and Users
    - `class-subjects`
    - Sidebar: Academics > Class Subjects
    - Page: Class subjects list
    - `class-lectures`
    - Sidebar: Academics > Class Lectures
    - Page: Class lecture list
    - `students`
    - Sidebar: Manage Users > Students
    - Page: Class student list
    - `unverified-students`
    - Sidebar: Manage Users > Pending Students
    - Page: Pending student approvals

    ### Class scope - Attendance
    - `daily-attendance`
    - Sidebar: Attendance > Class Attendance
    - Page: Class attendance list
    - `lecture-live-attendance`
    - Sidebar: Attendance > Live Attendance
    - Page: Live lecture attendance (class view)
    - `lecture-recording-attendance`
    - Sidebar: Attendance > Recording Attendance
    - Page: Recorded lecture attendance (class view)
    - `my-attendance`
    - Sidebar: Attendance > My Attendance
    - Page: My attendance (staff or student)
    - `calendar-view`
    - Sidebar: Calendar > View Calendar
    - Page: Attendance calendar view

    ### Class scope - Payments
    - `class-payments`
    - Sidebar: Fees & Payments > Class Fees
    - Page: Class fee management
    - `collect-physical-payment`
    - Sidebar: Fees & Payments > Collect Payment
    - Page: Physical payment collection

    ### Subject scope - Academics
    - `lectures`
    - Sidebar: Academics > Lectures
    - Page: Subject lecture list
    - `free-lectures`
    - Sidebar: Academics > Free Lectures
    - Page: Free lecture list
    - `structured-lectures`
    - Sidebar: Academics > Structured Lectures (if surfaced)
    - Page: Structured lectures (subject)
    - `homework`
    - Sidebar: Academics > Homework
    - Page: Homework list
    - `exams`
    - Sidebar: Academics > Exams
    - Page: Exams list
    - `grading`
    - Sidebar: Academics > Grading
    - Page: Grading panel
    - `study-materials`
    - Sidebar: Academics > Study Materials
    - Page: Study materials list
    - `lecture-welcome-message`
    - Form section: Lecture create/edit > Welcome Message
    - If disabled, hide the section in create and edit forms

    ### Subject scope - Attendance and Calendar
    - `my-attendance`
    - Sidebar: Attendance > My Attendance
    - Page: My attendance (subject context)
    - `calendar-view`
    - Sidebar: Attendance > Calendar
    - Page: Attendance calendar view

    ### Subject scope - Payments (future)
    - `subject-payments`
    - Sidebar: Fees & Payments > Subject Fees
    - Page: Subject fee management (future)

    ## Dependency rules (summary)
    - `qr-attendance` and `rfid-attendance` require `select-attendance-mark-type`.
    - `lecture-live-attendance` and `lecture-recording-attendance` require `lectures` and attendance.
    - `custom-domain`, `subdomain`, and `video-background` require `login-branding`.

    ## Implementation checklist
    - Add feature key to catalog and usage map.
    - Wire key into sidebar gating, dashboard tiles, and route guards.
    - Gate related form sections and quick actions.
    - Add test case: feature disabled hides all entry points.
    - Update this document when UI surfaces change.
