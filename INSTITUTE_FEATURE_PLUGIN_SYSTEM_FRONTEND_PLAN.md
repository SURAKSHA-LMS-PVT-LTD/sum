    # Institute Feature Plugin System - Frontend Plan

    Status: Draft
    Date: 2026-05-12
    Scope: lms user frotend

    ## Goals
    - Hide all non-required features until the institute enables them.
    - Keep feature configuration at institute level only (no per-class or per-subject overrides).
    - Make sidebar, tabs, and forms respond to feature flags without breaking routing.
    - Cache feature flags locally after the first request.

    ## Non-goals
    - No institute type gating (school vs tuition) in this phase.
    - No backend enforcement in this phase (frontend visibility and lock state only).
    - No per-class or per-subject configuration UI.

    ## Key decisions
    - Feature keys align with existing navigation IDs to avoid route refactors.
    - All toggleable features default to disabled; only core navigation is always on.
    - Feature flags are resolved per instituteId and cached.

    ## Scope model
    - Institute scope: shown when an institute is selected and no class or subject is selected.
    - Class scope: shown when a class is selected.
    - Subject scope: shown when a subject is selected.
    - A single institute-level toggle can enable features in any scope.

    ## Core always-on items (not toggleable)
    - Dashboard, Profile, Settings, Logout.
    - Select Institute, Select Class, Select Subject.
    - Basic navigation helpers (Back, Search).
    If a core item is later made optional, add a feature key and treat it like any other toggle.

    ## Feature payload from backend (expected)
    Example shape:
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

    Rules:
    - Missing keys are treated as disabled.
    - Paid features should show a locked state if the plan does not allow them.
    - No default enabled features; the first response can be an empty map.

    ## Compact feature encoding (optional)
    If payload size becomes a concern, features can be sent as compact IDs (F_1, F_2) or as a bitset.

    Recommended approach:
    - Keep the canonical feature keys in a catalog table.
    - Assign a stable numeric ID to each key.
    - Backend returns `enabledFeatureIds: [1, 2, 5]` plus a `catalogVersion`.
    - Frontend resolves IDs to keys using a cached catalog map; if versions mismatch, it refetches the catalog.

    Tradeoffs:
    - Harder to debug and audit without the map.
    - Requires strict versioning when new features are added.
    - Minimal size savings unless the feature list is large.

    Default remains key-based responses for clarity and safer rollouts.

    ## Caching strategy
    - Fetch on institute selection (or on login if already selected).
    - Cache by instituteId with a short TTL (5 to 10 minutes).
    - Clear cache after saving feature settings.
    - If cache is empty or expired, hide gated UI until data arrives.

    ## UI integration points

    ### Sidebar gating
    Update filtering in [lms user frotend/src/components/layout/Sidebar.tsx](lms%20user%20frotend/src/components/layout/Sidebar.tsx).
    - Filter nav items by both permission and feature enablement.
    - For paid but disabled features, show as locked instead of hiding (optional).

    ### Dashboard quick features
    Update [lms user frotend/src/hooks/useDashboardFeatures.ts](lms%20user%20frotend/src/hooks/useDashboardFeatures.ts).
    - Intersect ROLE_AVAILABLE with enabled feature keys.
    - If no default features is required, set role defaults to empty or derive defaults from enabled features only.

    ### Institute settings - Feature Enable section
    Add a Feature Enable section in [lms user frotend/src/pages/InstituteSettingsPage.tsx](lms%20user%20frotend/src/pages/InstituteSettingsPage.tsx).
    - Three tabs: Institute, Class, Subject.
    - Each item shows name, description, pricing badge, and enable toggle.
    - Group by category (Attendance, Academics, Payments, Communication, Branding, Transport).
    - Disable toggles for paid features if the plan does not include them.

    ### Feature-dependent sections
    Gate sections inside forms and pages:
    - Custom login page: show Domain and Login Page section only when `login-branding` is enabled.
    - Lecture create: show Welcome Message section only when `lecture-welcome-message` is enabled.
    - Attendance: show Live Attendance and Recording Attendance only when their keys are enabled.

    ## Feature catalog (initial list)

    Institute scope features:
    | Feature key | UI surfaces | Pricing | Notes |
    | --- | --- | --- | --- |
    | `classes` | All Classes list | free | Academics |
    | `institute-subjects` | Institute Subjects list | free | Academics |
    | `institute-lectures` | Institute Lectures | free | Academics |
    | `structured-lectures` | Structured Lectures | paid | Depends on lectures module |
    | `houses` | Houses community | free | Hide for simple institutes |
    | `institute-organizations` | Organization section | paid | Optional module |
    | `institute-users` | All Users | free | Manage users |
    | `parents` | Parents list | free | Manage users |
    | `verify-image` | Verify Photos | free | Manage users |
    | `select-attendance-mark-type` | Mark Attendance chooser | free | Attendance entry |
    | `qr-attendance` | QR attendance flow | free | Requires select-attendance-mark-type |
    | `rfid-attendance` | RFID attendance flow | paid | Requires select-attendance-mark-type |
    | `daily-attendance` | Institute or class attendance list | free | Attendance core |
    | `admin-attendance` | Advanced attendance reports | paid | Attendance analytics |
    | `lecture-live-attendance` | Live attendance | paid | Requires lectures and attendance |
    | `lecture-recording-attendance` | Recording attendance | paid | Requires lectures and attendance |
    | `calendar-view` | Calendar view | free | Attendance calendar |
    | `calendar-management` | Manage calendar | paid | Admin only |
    | `sms` | Send SMS | paid | Communication |
    | `sms-history` | SMS history | paid | Communication |
    | `institute-notifications` | Notifications | free | Communication |
    | `institute-payments` | Institute fees | free | Payments |
    | `pending-submissions` | Review payments | paid | Payments |
    | `collect-physical-payment` | Collect payment | paid | Payments |
    | `institute-billing` | Billing and plan | paid | Billing |
    | `institute-credits` | Institute wallet | paid | Billing |
    | `device-management` | Device management | paid | Admin tools |
    | `transport` | Transport module | paid | Includes transport attendance |
    | `id-cards` | ID Cards | paid | Services |
    | `organizations` | Organizations | paid | Services |
    | `system-payment` | System payment | paid | Services |
    | `login-branding` | Domain and Login Page section | paid | Settings gating |
    | `custom-domain` | Custom domain | paid | Settings gating |
    | `subdomain` | Subdomain | paid | Settings gating |
    | `video-background` | Video background | paid | Login branding |
    | `report-branding` | Report header and footer | paid | Settings gating |

    Class scope features:
    | Feature key | UI surfaces | Pricing | Notes |
    | --- | --- | --- | --- |
    | `class-subjects` | Class subjects list | free | Academics |
    | `class-lectures` | Class lectures | free | Academics |
    | `students` | Students list | free | Manage users |
    | `unverified-students` | Pending students | free | Manage users |
    | `daily-attendance` | Class attendance | free | Attendance |
    | `lecture-live-attendance` | Live attendance | paid | Attendance |
    | `lecture-recording-attendance` | Recording attendance | paid | Attendance |
    | `my-attendance` | My attendance | free | Student and staff view |
    | `calendar-view` | Calendar view | free | Attendance calendar |
    | `class-payments` | Class fees | free | Payments |
    | `collect-physical-payment` | Collect payment | paid | Payments |

    Subject scope features:
    | Feature key | UI surfaces | Pricing | Notes |
    | --- | --- | --- | --- |
    | `lectures` | Lectures list | free | Academics |
    | `free-lectures` | Free lectures | free | Academics |
    | `structured-lectures` | Structured lectures | paid | Academics |
    | `homework` | Homework | free | Academics |
    | `exams` | Exams | free | Academics |
    | `grading` | Grading | paid | Academics |
    | `study-materials` | Study materials | paid | Academics |
    | `lecture-welcome-message` | Lecture create welcome message | paid | Form section |
    | `my-attendance` | My attendance | free | Attendance |
    | `calendar-view` | Calendar view | free | Attendance calendar |
    | `subject-payments` | Subject fees | paid | Future use |

    ## Dependency rules
    - `qr-attendance` and `rfid-attendance` require `select-attendance-mark-type`.
    - `lecture-live-attendance` and `lecture-recording-attendance` require both `lectures` and attendance.
    - `custom-domain`, `subdomain`, and `video-background` require `login-branding`.

    ## Example behavior
    - If only class attendance is enabled, show only class-level attendance menus and hide institute and subject attendance features.
    - If `login-branding` is disabled, hide the Domain and Login Page section in institute settings.
    - If `lecture-welcome-message` is disabled, hide the Welcome Message section in lecture creation forms.

    ## Implementation plan (frontend)
    1. Add a features hook that loads and caches feature flags per institute.
    2. Integrate the hook into sidebar filtering and dashboard feature lists.
    3. Add Feature Enable UI in institute settings with three scopes.
    4. Apply feature gating inside lecture creation, attendance flows, and settings sections.
    5. Add a manual refresh action for admins after saving feature toggles.
