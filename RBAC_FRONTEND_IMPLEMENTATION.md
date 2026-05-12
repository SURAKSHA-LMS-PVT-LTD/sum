  # Suraksha LMS — Custom RBAC Frontend Implementation
  ## Part 1: Architecture & Design · Part 2: File-by-File Changes · Part 3: New Files

  > **Scope:** Remove all hardcoded role logic. Replace with dynamic custom user types loaded from the backend. Every file that currently checks `if (role === 'Teacher')` or uses the `permissions.ts` static map must be updated.

  ---

  ## PART 1 — ARCHITECTURE OVERVIEW

  ### 1.1 What Changes Completely

  | Old | New |
  |-----|-----|
  | 5 hardcoded roles (enum) | N custom user types per institute (DB rows) |
  | `permissions.ts` static map | `institute_feature_permissions` from backend |
  | `useInstituteRole()` returns string | Returns `{ id, name, baseRole, permissions }` |
  | `AccessControl.hasPermission(role, 'view-students')` | `usePermission('institute-users', 'view')` |
  | `useDashboardFeatures` hardcoded ROLE_DEFAULTS | Loaded from backend per user type |
  | Sidebar built with `if (role === 'InstituteAdmin')` blocks | Built from permission matrix |
  | AppContent: 100+ case/role switch statements | Single data-driven renderer |
  | Feature enabled = everyone sees it | Feature enabled + per-type `canView` check |

  ### 1.2 New Data Flow

  ```
  Login
    ↓
  GET /institutes/:id/my-context
    → { userType: { id, name, baseRole }, permissions: Record<featureKey, PermMatrix> }
    ↓
  Stored in AuthContext as selectedInstitute.userType + selectedInstitute.permissions
    ↓
  usePermission('lectures', 'create') → reads from selectedInstitute.permissions
    ↓
  Sidebar, AppContent, every UI component reads from this single source
  ```

  ### 1.3 Permission Matrix Shape (per user, per institute)

  ```typescript
  // Loaded once per institute selection, cached
  interface PermissionMatrix {
    [featureKey: string]: {
      enabled: boolean;   // institute feature toggle AND this type has canView
      canView: boolean;
      canCreate: boolean;
      canUpdate: boolean;
      canDelete: boolean;
      canReport: boolean;
    }
  }
  ```

  ### 1.4 New Hook: `usePermission`

  ```typescript
  // Replaces ALL: AccessControl.hasPermission(), isFeatureEnabled(), role === 'X' checks
  const { canView, canCreate, canUpdate, canDelete, canReport } =
    usePermission('institute-users');

  // With context override (subject-level type)
  const { canCreate } = usePermission('lectures', { classId, subjectId });
  ```

  ### 1.5 Backward Compatibility: `baseRole`

  Every custom user type has a `baseRole` field (`INSTITUTE_ADMIN | TEACHER | STUDENT | ATTENDANCE_MARKER | PARENT`). This is used ONLY for:
  - Enrollment flows that need to know "is this person a student in this subject?"
  - Parent-child viewing context detection

  **No more `if (role === 'Teacher')` for UI/permission decisions.**

  ---

  ## PART 2 — FILE-BY-FILE CHANGES

  ### FILE 1: `src/contexts/types/auth.types.ts`

  **Current:** `Institute` interface has `userRole: string` and `instituteUserType: string`

  **New additions:**
  ```typescript
  // Add to Institute interface:
  export interface InstituteUserType {
    id: number;
    name: string;
    baseRole: 'INSTITUTE_ADMIN' | 'TEACHER' | 'STUDENT' | 'ATTENDANCE_MARKER' | 'PARENT';
    color?: string;
    icon?: string;
    isSystem: boolean;
  }

  export interface FeaturePermission {
    enabled: boolean;
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canReport: boolean;
  }

  // Update Institute interface — ADD these fields:
  userType?: InstituteUserType;           // replaces instituteUserType string
  permissions?: Record<string, FeaturePermission>; // full matrix for this user
  // KEEP: instituteUserType for backward compat during transition
  ```

  ---

  ### FILE 2: `src/contexts/AuthContext.tsx`

  **Current:** After `setSelectedInstitute()`, features are fetched separately via `FeaturesContext`.

  **Changes:**

  ```typescript
  // In setSelectedInstitute(), after setting the institute, fetch user's permission matrix:
  const loadInstitutePermissions = async (instituteId: string) => {
    try {
      const ctx = await cachedApiClient.get(
        `/institutes/${instituteId}/my-context`,
        {},
        { ttl: 300, forceRefresh: false }
      );
      // ctx = { userType: InstituteUserType, permissions: Record<string, FeaturePermission> }
      setUser(prev => prev ? {
        ...prev,
        // Update the matching institute entry with full type + permissions
        institutes: prev.institutes.map(inst =>
          inst.id === instituteId
            ? { ...inst, userType: ctx.userType, permissions: ctx.permissions }
            : inst
        )
      } : null);
      setSelectedInstitute(prev => prev ? {
        ...prev,
        userType: ctx.userType,
        permissions: ctx.permissions
      } : null);
    } catch (e) {
      // fallback: permissions = {} (all default to enabled)
    }
  };
  ```

  **In `setSelectedInstitute`:**
  ```typescript
  // After setting institute, trigger permission load:
  setSelectedInstituteState(institute);
  if (institute) {
    loadInstitutePermissions(institute.id);
  }
  ```

  ---

  ### FILE 3: `src/contexts/FeaturesContext.tsx`

  **Current:** Fetches `/institutes/:id/features` separately, stores `Record<key, { enabled, scope, pricing }>`.

  **Changes:** `FeaturesContext` becomes a thin wrapper that reads from `AuthContext.selectedInstitute.permissions` instead of making its own API call.

  ```typescript
  export const FeaturesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { selectedInstitute } = useAuth();

    const isFeatureEnabled = useCallback((key: string): boolean => {
      if (!selectedInstitute?.permissions) return true; // loading = show
      const perm = selectedInstitute.permissions[key];
      if (!perm) return true; // no rule = show
      return perm.enabled && perm.canView;
    }, [selectedInstitute?.permissions]);

    const refetchFeatures = useCallback(async () => {
      // Trigger permission reload in AuthContext
      if (selectedInstitute?.id) {
        await loadInstitutePermissions(selectedInstitute.id); // exposed from AuthContext
      }
    }, [selectedInstitute?.id]);

    // Keep same interface so all useFeatures() consumers still work
    const value = useMemo(() => ({
      features: selectedInstitute?.permissions ?? {},
      loading: !selectedInstitute?.permissions,
      isFeatureEnabled,
      refetchFeatures,
    }), [selectedInstitute?.permissions, isFeatureEnabled, refetchFeatures]);

    return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
  };
  ```

  ---

  ### FILE 4: `src/hooks/useInstituteRole.ts`

  **Current:**
  ```typescript
  export function useInstituteRole(): UserRole {
    // maps instituteUserType string → one of 7 hardcoded strings
  }
  ```

  **New — return the full type object:**
  ```typescript
  export interface ResolvedUserType {
    id?: number;                    // null for unauthenticated
    name: string;                   // "Vice Principal", "Student", etc.
    baseRole: string;               // legacy compat: 'TEACHER', 'STUDENT', etc.
    // Legacy string for components that still read it as a string
    // (will be removed once all files are migrated)
    toString(): string;             // returns baseRole mapped to old role string
  }

  export function useInstituteRole(): ResolvedUserType {
    const { selectedInstitute, isViewingAsParent } = useAuth();

    if (isViewingAsParent) {
      return { id: undefined, name: 'Student', baseRole: 'STUDENT', toString: () => 'Student' };
    }

    const userType = selectedInstitute?.userType;
    if (userType) {
      const legacyName = BASE_ROLE_TO_LEGACY[userType.baseRole] ?? 'Student';
      return { ...userType, toString: () => legacyName };
    }

    // Fallback: map old instituteUserType string
    const raw = selectedInstitute?.instituteUserType ?? selectedInstitute?.userRole ?? '';
    const legacyName = mapInstituteUserType(raw); // existing function kept
    return { id: undefined, name: legacyName, baseRole: raw, toString: () => legacyName };
  }

  const BASE_ROLE_TO_LEGACY: Record<string, string> = {
    'INSTITUTE_ADMIN': 'InstituteAdmin',
    'TEACHER': 'Teacher',
    'STUDENT': 'Student',
    'ATTENDANCE_MARKER': 'AttendanceMarker',
    'PARENT': 'Parent',
  };
  ```

  **Why `toString()`:** Existing code like `const userRole = useInstituteRole(); if (userRole === 'Teacher')` continues to work during migration because the object's `toString()` returns the legacy string.

  ---

  ### FILE 5: `src/utils/permissions.ts`

  **Current:** Static map of 43 permissions per role.

  **New — Remove static role map, keep types + add permission helper:**

  ```typescript
  // REMOVE: ROLE_PERMISSIONS static map
  // KEEP: Permission type definition
  // ADD:

  export type PermAction = 'view' | 'create' | 'update' | 'delete' | 'report';

  export interface ResolvedPermission {
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canReport: boolean;
    enabled: boolean;
  }

  // Runtime permission resolver — reads from selectedInstitute.permissions
  export function resolvePermission(
    permissions: Record<string, ResolvedPermission> | undefined,
    featureKey: string,
  ): ResolvedPermission {
    if (!permissions) {
      // No permissions loaded yet = default all true (optimistic)
      return { canView: true, canCreate: true, canUpdate: true, canDelete: true, canReport: true, enabled: true };
    }
    return permissions[featureKey] ?? {
      canView: true, canCreate: false, canUpdate: false, canDelete: false, canReport: false, enabled: true
    };
  }

  // KEEP AccessControl class but make it read from dynamic permissions:
  export class AccessControl {
    // Legacy method — kept for backward compat during migration
    // New code should use usePermission() hook instead
    static hasPermission(
      userRole: string | { toString(): string },
      permission: string,
      dynamicPerms?: Record<string, ResolvedPermission>
    ): boolean {
      // If dynamic permissions provided, use them
      if (dynamicPerms) {
        const featureKey = PERMISSION_TO_FEATURE_KEY[permission];
        if (featureKey) {
          const perm = dynamicPerms[featureKey];
          if (perm) return perm.enabled && perm.canView;
        }
      }
      // Fallback to old static map (during transition)
      const role = String(userRole);
      return STATIC_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
    }
  }

  // Mapping from old permission strings to new feature keys
  const PERMISSION_TO_FEATURE_KEY: Record<string, string> = {
    'view-users': 'institute-users',
    'create-user': 'institute-users',
    'edit-user': 'institute-users',
    'delete-user': 'institute-users',
    'view-students': 'institute-users',
    'view-teachers': 'institute-users',
    'view-attendance': 'daily-attendance',
    'mark-attendance': 'select-attendance-mark-type',
    'view-lectures': 'lectures',
    'create-lecture': 'lectures',
    'view-homework': 'homework',
    'view-exams': 'exams',
    'view-grades': 'grading',
    'view-settings': 'institute-settings',
    // ... complete map
  };
  ```

  ---

  ### FILE 6: `src/hooks/usePermission.ts` ← NEW FILE

  ```typescript
  import { useAuth } from '@/contexts/AuthContext';
  import { resolvePermission, type ResolvedPermission } from '@/utils/permissions';

  interface PermissionContext {
    classId?: string;
    subjectId?: string;
  }

  /**
   * Primary permission hook — replaces ALL hardcoded role checks.
   * 
   * Usage:
   *   const { canCreate } = usePermission('lectures');
   *   const { canView, canReport } = usePermission('daily-attendance');
   */
  export function usePermission(
    featureKey: string,
    _context?: PermissionContext  // for future subject-level override
  ): ResolvedPermission {
    const { selectedInstitute } = useAuth();
    return resolvePermission(selectedInstitute?.permissions, featureKey);
  }

  /**
   * Check multiple features at once.
   */
  export function usePermissions(featureKeys: string[]): Record<string, ResolvedPermission> {
    const { selectedInstitute } = useAuth();
    return Object.fromEntries(
      featureKeys.map(key => [key, resolvePermission(selectedInstitute?.permissions, key)])
    );
  }

  /**
   * Check if current user is effectively an admin type
   * (baseRole = INSTITUTE_ADMIN). For UI-only hints, not security.
   */
  export function useIsAdmin(): boolean {
    const { selectedInstitute } = useAuth();
    return selectedInstitute?.userType?.baseRole === 'INSTITUTE_ADMIN';
  }

  /**
   * Check if current user's base role matches.
   * For enrollment/context logic only — not for permission decisions.
   */
  export function useBaseRole(): string {
    const { selectedInstitute, isViewingAsParent } = useAuth();
    if (isViewingAsParent) return 'STUDENT';
    return selectedInstitute?.userType?.baseRole
      ?? selectedInstitute?.instituteUserType
      ?? '';
  }
  ```

  ---

  ### FILE 7: `src/api/userTypes.api.ts` ← NEW FILE

  ```typescript
  import { apiClient } from './client';

  export interface InstituteUserType {
    id: number;
    instituteId: number;
    name: string;
    description?: string;
    baseRole: 'INSTITUTE_ADMIN' | 'TEACHER' | 'STUDENT' | 'ATTENDANCE_MARKER' | 'PARENT';
    color?: string;
    icon?: string;
    sortOrder: number;
    isSystem: boolean;
    isActive: boolean;
    memberCount?: number;
    permissions?: FeaturePermissionRow[];
  }

  export interface FeaturePermissionRow {
    featureKey: string;
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canReport: boolean;
  }

  export interface MyContextResponse {
    userType: InstituteUserType;
    permissions: Record<string, {
      enabled: boolean;
      canView: boolean;
      canCreate: boolean;
      canUpdate: boolean;
      canDelete: boolean;
      canReport: boolean;
    }>;
  }

  export const userTypesApi = {
    // Admin: manage user types
    list: (instituteId: string) =>
      apiClient.get<InstituteUserType[]>(`/institutes/${instituteId}/user-types`),

    create: (instituteId: string, data: Partial<InstituteUserType>) =>
      apiClient.post<InstituteUserType>(`/institutes/${instituteId}/user-types`, data),

    update: (instituteId: string, typeId: number, data: Partial<InstituteUserType>) =>
      apiClient.patch<InstituteUserType>(`/institutes/${instituteId}/user-types/${typeId}`, data),

    delete: (instituteId: string, typeId: number) =>
      apiClient.delete(`/institutes/${instituteId}/user-types/${typeId}`),

    // Permissions matrix per type
    getPermissions: (instituteId: string, typeId: number) =>
      apiClient.get<FeaturePermissionRow[]>(`/institutes/${instituteId}/user-types/${typeId}/permissions`),

    updatePermissions: (instituteId: string, typeId: number, matrix: FeaturePermissionRow[]) =>
      apiClient.put(`/institutes/${instituteId}/user-types/${typeId}/permissions`, { permissions: matrix }),

    // Current user's resolved context (type + full permission matrix)
    getMyContext: (instituteId: string) =>
      apiClient.get<MyContextResponse>(`/institutes/${instituteId}/my-context`),

    // Assign type to a user
    assignType: (instituteId: string, userId: string, typeId: number) =>
      apiClient.patch(`/institutes/${instituteId}/users/${userId}/user-type`, { userTypeId: typeId }),
  };
  ```

  ---

  ### FILE 8: `src/components/institute-settings/UserTypesSettings.tsx` ← NEW FILE

  **Purpose:** Admin UI to create/edit/delete custom user types and set their permission matrix.

  ```typescript
  // Structure:
  // - List of user types as cards (color + name + member count + edit/delete buttons)
  // - System types: locked (no delete), shows "System" badge
  // - "New User Type" button → dialog: name, description, base role, color, icon
  // - Each card has "Edit Permissions" button → opens PermissionMatrixEditor drawer
  ```

  **PermissionMatrixEditor (sub-component):**

  ```
  User Type: "Vice Principal"   [Base Role: Teacher ▾]

                          ENABLE  CREATE  UPDATE  DELETE  VIEW  REPORT
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ▼ INSTITUTE LEVEL
    — Academics
    Classes                  ●      ○       ○       ○      ●      ●
    All Subjects             ●      ○       ○       ○      ●      ●
    Lectures                 ●      ○       ○       ○      ●      ○

    — Attendance
    Mark Attendance          ●      ●       ○       ○      ●      ○
    Daily Attendance         ●      ○       ○       ○      ●      ●

    — Communication
    Send SMS         [PAID]  ○   ← grayed: feature OFF at institute level

  ▼ SUBJECT LEVEL
    Lectures                 ●      ○       ○       ○      ●      ○
    Grading                  ○   ← grayed: feature OFF

  [Cancel]   [Save Permissions  (4 changed)]
  ```

  **Key behaviors:**
  - Rows grayed if feature is toggled OFF at institute level (disabled switch)
  - ENABLE column = `canView` in the matrix
  - Checking CREATE/UPDATE/DELETE auto-checks ENABLE
  - Row checkbox selects all 5 columns
  - Changes shown as count in save button
  - Optimistic save with revert on error

  ---

  ### FILE 9: `src/components/layout/Sidebar.tsx`

  **Current:** 1090 lines with `if (userRole === 'InstituteAdmin')` blocks building navGroups.

  **New approach — data-driven nav builder:**

  ```typescript
  // Replace all role-based if/else blocks with:
  const navGroups = useMemo(() => buildNavGroups({
    permissions,        // Record<featureKey, ResolvedPermission>
    baseRole,           // for enrollment/context decisions only
    context: { hasInstitute, hasClass, hasSubject, hasChild, isViewingAsParent }
  }), [permissions, baseRole, hasInstitute, hasClass, hasSubject]);
  ```

  **`buildNavGroups()` function — replaces all hardcoded blocks:**

  ```typescript
  // Each nav item declares which feature key controls its visibility:
  const NAV_ITEMS: NavItemDef[] = [
    // Institute level
    { id: 'classes',              featureKey: 'classes',              action: 'view', scope: 'institute', label: 'Classes',            icon: School },
    { id: 'institute-subjects',   featureKey: 'institute-subjects',   action: 'view', scope: 'institute', label: 'Subjects',           icon: BookOpen },
    { id: 'institute-lectures',   featureKey: 'institute-lectures',   action: 'view', scope: 'institute', label: 'Lectures',           icon: Video },
    { id: 'daily-attendance',     featureKey: 'daily-attendance',     action: 'view', scope: 'institute', label: 'Attendance',         icon: ClipboardList },
    { id: 'admin-attendance',     featureKey: 'admin-attendance',     action: 'report', scope: 'institute', label: 'Advanced Attendance', icon: BarChart3 },
    { id: 'select-attendance-mark-type', featureKey: 'select-attendance-mark-type', action: 'create', scope: 'any', label: 'Mark Attendance', icon: QrCode },
    { id: 'institute-users',      featureKey: 'institute-users',      action: 'view', scope: 'institute', label: 'All Users',          icon: Users },
    { id: 'institute-settings',   featureKey: 'institute-settings',   action: 'view', scope: 'institute', label: 'Settings',           icon: Settings },
    { id: 'sms',                  featureKey: 'sms',                  action: 'create', scope: 'institute', label: 'Send SMS',         icon: MessageSquare },
    { id: 'device-management',    featureKey: 'device-management',    action: 'view', scope: 'institute', label: 'Devices',            icon: Wifi },
    { id: 'institute-payments',   featureKey: 'institute-payments',   action: 'view', scope: 'institute', label: 'Institute Fees',     icon: CreditCard },
    { id: 'pending-submissions',  featureKey: 'pending-submissions',  action: 'update', scope: 'institute', label: 'Review Payments',  icon: Clock },
    { id: 'institute-notifications', featureKey: 'institute-notifications', action: 'create', scope: 'institute', label: 'Notifications', icon: Bell },
    // Class level
    { id: 'class-subjects',       featureKey: 'class-subjects',       action: 'view', scope: 'class', label: 'Subjects',              icon: BookOpen },
    { id: 'students',             featureKey: 'institute-users',      action: 'view', scope: 'class', label: 'Students',              icon: GraduationCap },
    { id: 'daily-attendance',     featureKey: 'daily-attendance',     action: 'view', scope: 'class', label: 'Attendance',            icon: ClipboardList },
    // Subject level
    { id: 'lectures',             featureKey: 'lectures',             action: 'view', scope: 'subject', label: 'Lectures',            icon: Video },
    { id: 'homework',             featureKey: 'homework',             action: 'view', scope: 'subject', label: 'Homework',            icon: Notebook },
    { id: 'exams',                featureKey: 'exams',                action: 'view', scope: 'subject', label: 'Exams',               icon: Award },
    { id: 'grading',              featureKey: 'grading',              action: 'create', scope: 'subject', label: 'Grading',           icon: CheckSquare },
    // Always show
    { id: 'profile',              featureKey: null,                   action: null, scope: 'any', label: 'Profile',                   icon: User, alwaysShow: true },
    { id: 'settings',             featureKey: null,                   action: null, scope: 'any', label: 'Settings',                  icon: Settings2, alwaysShow: true },
    // ... all items
  ];

  function buildNavGroups({ permissions, context }): NavGroup[] {
    return NAV_GROUPS.map(group => ({
      ...group,
      items: NAV_ITEMS
        .filter(item => item.group === group.id)
        .filter(item => item.alwaysShow || (
          isInScope(item.scope, context) &&
          (item.featureKey === null || checkPerm(permissions, item.featureKey, item.action))
        ))
    })).filter(g => g.items.length > 0);
  }
  ```

  ---

  ### FILE 10: `src/components/AppContent.tsx`

  **Current:** 1563 lines. Massive switch on `userRole` → 100+ case statements.

  **New approach — role-agnostic renderer:**

  ```typescript
  // Instead of:
  if (userRole === 'InstituteAdmin') {
    switch(currentPage) {
      case 'classes': return <Classes />;
      case 'students': return <Students />;
      ...
    }
  } else if (userRole === 'Teacher') {
    switch(currentPage) {
      case 'classes': return <Classes />;  // same!
      ...
    }
  }

  // New:
  const PAGE_REGISTRY: Record<string, PageDef> = {
    'classes':           { component: Classes,         featureKey: 'classes',          action: 'view' },
    'institute-subjects': { component: Subjects,        featureKey: 'institute-subjects', action: 'view' },
    'institute-users':   { component: InstituteUsers,   featureKey: 'institute-users',   action: 'view' },
    'daily-attendance':  { component: AttendancePage,   featureKey: 'daily-attendance',  action: 'view' },
    'grading':           { component: Grading,          featureKey: 'grading',           action: 'view' },
    'lectures':          { component: Lectures,         featureKey: 'lectures',          action: 'view' },
    // ... all pages
  };

  function renderComponent() {
    const pageDef = PAGE_REGISTRY[currentPage];
    if (!pageDef) return <NotFound />;

    const perm = resolvePermission(selectedInstitute?.permissions, pageDef.featureKey);
    if (!perm.canView) return <AccessDenied featureKey={pageDef.featureKey} />;

    return <pageDef.component />;
  }
  ```

  **AppContent reduces from 1563 lines to ~200 lines.**

  The `PAGE_REGISTRY` approach:
  - Single definition per page
  - `canView` check gates rendering
  - Individual pages check `canCreate/canUpdate/canDelete` internally for buttons
  - `scope` field ensures class-level pages only render when class is selected

  ---

  ### FILE 11: `src/hooks/useDashboardFeatures.ts`

  **Current:** Hardcoded `ROLE_DEFAULTS` and `ROLE_AVAILABLE` per role string.

  **New — dynamic defaults from backend + filter by permissions:**

  ```typescript
  export const useDashboardFeatures = (level: DashboardLevel) => {
    const { selectedInstitute } = useAuth();
    const permissions = selectedInstitute?.permissions ?? {};
    const storageKey = `dash_features_${level}_${selectedInstitute?.userType?.id ?? 'default'}`;

    // Available = all features where canView is true for this level
    const available = Object.entries(FEATURE_CATALOG)
      .filter(([key, def]) => {
        const levelScope = FEATURE_SCOPE[key]; // 'institute' | 'class' | 'subject'
        if (levelScope !== level) return false;
        const perm = permissions[key];
        return !perm || (perm.enabled && perm.canView);
      })
      .map(([, def]) => def);

    // Defaults: read from backend user type, fall back to ALL available
    const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) return JSON.parse(stored);
      } catch {}
      // Default pins = first 6 available features for this level
      return available.slice(0, 6).map(f => f.id);
    });

    // ... rest same as current
  };
  ```

  ---

  ### FILE 12: `src/components/dashboard/FeaturesSection.tsx`

  **Change:** Remove `userRole` dependency, filter purely from `usePermissions()`.

  ```typescript
  const FeaturesSection = ({ level }: { level: DashboardLevel }) => {
    // REMOVE: const userRole = useInstituteRole();
    // The useDashboardFeatures hook now reads permissions directly
    const { pinnedFeatures, togglePin, resetToDefaults, availableToAdd } =
      useDashboardFeatures(level);
    // ... rest same
  };
  ```

  ---

  ### FILE 13: `src/components/dashboard/DashboardQuickNav.tsx`

  **Change:** Replace role check for institute chip clickability with permission check.

  ```typescript
  // OLD:
  disabled={isTenantLogin}

  // NEW — also disable if user can't change institute (no multi-institute access):
  const { canView: canSelectInstitute } = usePermission('institute-switcher');
  // (or just keep isTenantLogin check — this one is fine as-is)
  ```

  ---

  ### FILE 14: `src/components/institute-settings/InstituteSettingsPage.tsx`

  **Add "User Types" tab:**

  ```typescript
  // In the tabs array, add between "Session Limits" and "Features":
  { id: 'user-types', label: 'User Types', icon: Users2 }

  // In tab content:
  {activeTab === 'user-types' && (
    <UserTypesSettings />
  )}
  ```

  ---

  ### FILE 15: `src/components/InstituteUsers.tsx` / `src/components/Users.tsx`

  **Add user type column and assignment UI:**

  ```typescript
  // In the users table, add:
  {
    header: 'User Type',
    cell: (user) => (
      <UserTypeBadge
        typeId={user.primaryUserTypeId}
        typeName={user.userTypeName}
        color={user.userTypeColor}
      />
    )
  }

  // Inline assignment (admin only):
  // Clicking the badge opens a dropdown of available types
  ```

  ---

  ### FILE 16: `src/pages/DeviceManagement.tsx`

  **Change:** Replace `userRole === 'InstituteAdmin'` guard with:

  ```typescript
  const { canView } = usePermission('device-management');
  if (!canView) return <AccessDenied />;
  ```

  ---

  ### FILE 17: Individual page components (every page with create/edit/delete buttons)

  **Pattern to apply to ALL pages:**

  ```typescript
  // Example: Lectures.tsx
  const Lectures = () => {
    const { canCreate, canUpdate, canDelete, canReport } = usePermission('lectures');

    return (
      <div>
        {canCreate && <Button onClick={createLecture}>New Lecture</Button>}
        {lectures.map(lec => (
          <LectureCard
            key={lec.id}
            lecture={lec}
            canEdit={canUpdate}
            canDelete={canDelete}
          />
        ))}
        {canReport && <LectureAnalytics />}
      </div>
    );
  };
  ```

  **Files needing this pattern (all pages with action buttons):**
  - `Classes.tsx` → `usePermission('classes')`
  - `Subjects.tsx` / `InstituteSubjects.tsx` → `usePermission('institute-subjects')`
  - `Lectures.tsx` / `InstituteLectures.tsx` → `usePermission('lectures')` / `usePermission('institute-lectures')`
  - `Homework.tsx` → `usePermission('homework')`
  - `Exams.tsx` → `usePermission('exams')`
  - `Grading.tsx` → `usePermission('grading')`
  - `Students.tsx` / `InstituteUsers.tsx` → `usePermission('institute-users')`
  - `AttendancePage` components → `usePermission('daily-attendance')` / `usePermission('select-attendance-mark-type')`
  - `SMS.tsx` → `usePermission('sms')`
  - `InstitutePayments.tsx` → `usePermission('institute-payments')`
  - `PendingSubmissions.tsx` → `usePermission('pending-submissions')`
  - `DeviceManagement.tsx` → `usePermission('device-management')`
  - `CalendarManagementPage.tsx` → `usePermission('calendar-management')`
  - `NotificationManagement.tsx` → `usePermission('institute-notifications')`
  - `FeatureSettings.tsx` → `usePermission('institute-settings')`

  ---

  ## PART 3 — NEW FILES SUMMARY

  | File | Purpose |
  |------|---------|
  | `src/hooks/usePermission.ts` | Primary permission hook — replaces all role checks |
  | `src/api/userTypes.api.ts` | API client for user type management |
  | `src/components/institute-settings/UserTypesSettings.tsx` | Admin UI: manage custom user types |
  | `src/components/institute-settings/PermissionMatrixEditor.tsx` | Per-type permission matrix UI |
  | `src/components/UserTypeBadge.tsx` | Badge showing custom type with color |
  | `src/components/AccessDenied.tsx` | Shown when canView = false for a page |
  | `src/utils/navRegistry.ts` | NAV_ITEMS definition replacing Sidebar role blocks |
  | `src/utils/pageRegistry.ts` | PAGE_REGISTRY replacing AppContent role switch |

  ---

  ## PART 4 — MIGRATION STRATEGY (ZERO BREAKING CHANGES)

  ### Step 1: Add new types + hook (no behavior change)
  - Add `InstituteUserType`, `FeaturePermission` to auth.types.ts
  - Add `usePermission()` hook (returns all-true while no permissions loaded)
  - Add `userTypes.api.ts`

  ### Step 2: Load permissions after institute select
  - Add `/my-context` fetch in `setSelectedInstitute()`
  - Store in `selectedInstitute.permissions`
  - `FeaturesContext.isFeatureEnabled()` reads from permissions

  ### Step 3: Migrate AppContent (biggest change)
  - Build `PAGE_REGISTRY`
  - Replace role switch blocks one group at a time
  - Keep old blocks as fallback until registry covers all pages

  ### Step 4: Migrate Sidebar
  - Build `NAV_ITEMS` registry
  - Replace role blocks with `buildNavGroups()`
  - Test each role via `baseRole` simulation

  ### Step 5: Migrate individual page buttons
  - Add `usePermission()` to each page
  - Gates create/edit/delete buttons

  ### Step 6: Add UserTypes admin UI
  - New tab in InstituteSettingsPage
  - UserTypesSettings + PermissionMatrixEditor components

  ### Step 7: Remove legacy code
  - Remove `ROLE_PERMISSIONS` static map from permissions.ts
  - Remove `ROLE_DEFAULTS` / `ROLE_AVAILABLE` from useDashboardFeatures.ts
  - Remove `mapInstituteUserType()` from useInstituteRole.ts

  ---

  ## PART 5 — REDIS CACHING IN FRONTEND

  The `/my-context` endpoint is cached at 2 levels:

  ### Level 1: cachedApiClient (5 min TTL)
  ```typescript
  await cachedApiClient.get(`/institutes/${id}/my-context`, {}, {
    ttl: 300,
    forceRefresh: false,
    cacheKey: `my-context-${userId}-${id}`
  });
  ```

  ### Level 2: AuthContext state
  Once loaded, stays in React state for the session. Only refetched on:
  - Institute re-select
  - `refetchFeatures()` call (admin changes permissions → triggers on self too)
  - Token refresh (new permissions might apply)

  ### Cache invalidation triggers
  - Admin saves permission matrix changes → emit event → all active users with that type get `forceRefresh` on next request
  - User's type is changed by admin → logout + re-login required (or socket notification)

  ---

  *Document version: 1.0 · Frontend Implementation · 2026-05-13*
