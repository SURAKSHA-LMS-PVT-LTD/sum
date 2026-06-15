import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useRbac } from '@/contexts/RbacContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { extractPageFromUrl, buildSidebarUrl, getSidebarHighlightPage } from '@/utils/pageNavigation';
import ProfileSwitcherSheet from './ProfileSwitcherSheet';
import { AccessControl } from '@/utils/permissions';
import {
  LayoutDashboard, Users, GraduationCap, UserCheck, BookOpen, School,
  ClipboardList, BarChart3, Settings, User, Building2, QrCode, X,
  Award, Video, LogOut, Menu, FileText, ArrowLeft, Notebook, Images,
  Palette, CreditCard, Camera, AlertCircle, Truck, ImageIcon, IdCard,
  MessageSquare, MessageSquareHeart, Wifi, Lock, Bell, Calendar,
  CalendarDays, ChevronDown, UserCog, ShieldCheck, Megaphone, Home,
  LayoutGrid, GalleryHorizontal, ListChecks, Flag, Search, Receipt, Wallet, Banknote
} from 'lucide-react';
import GlobalSearch from '@/components/GlobalSearch';
import surakshaLogoSidebar from '@/assets/suraksha-logo-sidebar.png';
import surakshaMainLogo from '@/assets/surakshalms-main-logo.png';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useInstituteMe } from '@/hooks/useInstituteMe';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { FEATURE_KEYS } from '@/config/feature-keys';

interface SidebarProps { isOpen: boolean; onClose: () => void; }

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  alwaysShow?: boolean;
  locked?: boolean;
  badge?: number;
  path?: string;
  /** Override the feature key used for the feature-toggle check (defaults to id) */
  featureKey?: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
  defaultOpen?: boolean;
  alwaysFlat?: boolean;   // show without collapsible header
}

// ──────────────────────────────────────────────────────────────────
// NavGroupSection — renders a collapsible or flat group
// ──────────────────────────────────────────────────────────────────
const NavGroupSection = React.memo(({
  group, isCollapsed, activePage, onItemClick, filterFn
}: {
  group: NavGroup;
  isCollapsed: boolean;
  activePage: string;
  onItemClick: (id: string) => void;
  filterFn: (items: NavItem[]) => NavItem[];
}) => {
  const filtered = filterFn(group.items);
  if (filtered.length === 0) return null;

  const hasActive = filtered.some(i => activePage === i.id);

  const renderItems = () => (
    <div className="space-y-0.5">
      {filtered.map(item => {
        const isActive = activePage === item.id;
        const Icon = item.icon;
        return (
          <Button
            key={item.id}
            variant="ghost"
            className={`w-full relative ${isCollapsed ? 'justify-center px-2' : 'justify-start px-3'} h-9 text-[13px] font-medium rounded-xl transition-all duration-150 ${
              isActive
                ? 'bg-primary/10 text-primary border-l-2 border-primary shadow-sm'
                : item.locked
                  ? 'text-muted-foreground/40 cursor-not-allowed'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            onClick={() => !item.locked && onItemClick(item.id)}
            disabled={item.locked}
            title={isCollapsed ? item.label : undefined}
          >
            <Icon className={`${isCollapsed ? '' : 'mr-2.5'} h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
            {isCollapsed && item.badge != null && item.badge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
            {!isCollapsed && (
              <span className="flex items-center gap-1.5 truncate flex-1">
                {item.label}
                {item.badge != null && item.badge > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
                {item.locked && <Lock className="h-3 w-3 opacity-50 ml-auto" />}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );

  if (group.alwaysFlat || isCollapsed) {
    return (
      <div className="mb-1">
        {!isCollapsed && (
          <div className="flex items-center gap-1.5 px-3 pt-3 pb-1">
            <group.icon className="h-3 w-3 text-muted-foreground/50" />
            <h3 className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.08em]">
              {group.label}
            </h3>
          </div>
        )}
        {renderItems()}
      </div>
    );
  }

  return (
    <Collapsible defaultOpen={hasActive || group.defaultOpen} className="mb-0.5">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 group hover:bg-accent/40 rounded-xl transition-colors">
        <div className="flex items-center gap-2">
          <group.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.06em]">
            {group.label}
          </span>
          {hasActive && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </div>
        <ChevronDown className="h-3 w-3 text-muted-foreground/40 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-1 pt-0.5">
        {renderItems()}
      </CollapsibleContent>
    </Collapsible>
  );
});
NavGroupSection.displayName = 'NavGroupSection';

// ──────────────────────────────────────────────────────────────────
// Sidebar
// ──────────────────────────────────────────────────────────────────
const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const {
    user, selectedInstitute, selectedClass, selectedSubject, selectedChild,
    selectedOrganization, selectedTransport, logout,
    setSelectedInstitute, setSelectedClass, setSelectedSubject,
    setSelectedChild, setSelectedOrganization, setSelectedTransport,
    isViewingAsParent
  } = useAuth();
  const { isTenantLogin } = useTenant();
  const { isFeatureEnabled, isFeatureEnabledForScope } = useFeatures();

  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [profileSwitcherOpen, setProfileSwitcherOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Lock body scroll when sidebar is open on mobile
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);
  const { globalUnreadCount: unreadNotifCount } = useNotificationStore();

  // Load user avatar + institute tier in a single /me request (one API call with join)
  // Shared hook — collapses the institute "me" fetch onto a single request
  // shared with the Header (both are always mounted in the shell).
  const { data: instituteMe } = useInstituteMe(
    isViewingAsParent && selectedChild?.user?.imageUrl ? undefined : selectedInstitute?.id,
  );
  const sidebarAvatarUrl = React.useMemo(() => {
    if (isViewingAsParent && selectedChild?.user?.imageUrl) {
      return getImageUrl(selectedChild.user.imageUrl);
    }
    const url = instituteMe?.instituteUserImageUrl || user?.imageUrl || '';
    return url ? getImageUrl(url) : '';
  }, [isViewingAsParent, selectedChild?.user?.imageUrl, instituteMe?.instituteUserImageUrl, user?.imageUrl]);
  const instituteTier = instituteMe?.instituteTier || 'FREE';

  const isTuitionInstitute = (selectedInstitute?.type || '').toLowerCase() === 'tuition_institute';
  const { subjectLabel, subjectsLabel } = useInstituteLabels();
  const userRole = useInstituteRole();
  const { context: rbacContext, loading: rbacLoading } = useRbac();

  // Users with these slugs use the hard-coded sidebar layout (role-based).
  // All other slugs are custom institute-defined roles and use the RBAC permission matrix.
  const SYSTEM_TYPE_SLUGS = React.useMemo(
    () => new Set(['student', 'teacher', 'institute_admin', 'attendance_marker', 'parent']),
    [],
  );

  const currentPage = React.useMemo(() => extractPageFromUrl(location.pathname), [location.pathname]);
  const activePage = React.useMemo(() => getSidebarHighlightPage(location.pathname), [location.pathname]);

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('sidebar-collapsed', isCollapsed);
    root.classList.toggle('sidebar-expanded', !isCollapsed);
    window.dispatchEvent(new CustomEvent('sidebar:state', { detail: { collapsed: isCollapsed } }));
  }, [isCollapsed]);

  // ── Navigation helper ──────────────────────────────────────────
  const handleItemClick = React.useCallback((itemId: string) => {
    if (itemId === FEATURE_KEYS.ORGANIZATIONS && !selectedInstitute) {
      window.open('https://org.suraksha.lk/', '_blank');
      onClose(); return;
    }
    // User Types → open Institute Settings on the user-types tab
    if (itemId === 'user-types' && selectedInstitute) {
      const base = `/institute/${selectedInstitute.id}`;
      const cls = selectedClass?.id ? `/class/${selectedClass.id}` : '';
      navigate(`${base}${cls}/institute-settings?tab=user-types`);
      onClose(); return;
    }
    if (itemId === 'my-children') {
      setSelectedChild(null);
      navigate('/my-children');
      onClose(); return;
    }
    if (itemId === FEATURE_KEYS.ID_CARDS) {
      navigate('/id-cards');
      onClose(); return;
    }
    const context = {
      instituteId: selectedInstitute?.id,
      classId: selectedClass?.id,
      subjectId: selectedSubject?.id,
      childId: selectedChild?.id,
      organizationId: selectedOrganization?.id,
      transportId: selectedTransport?.id,
    };
    navigate(buildSidebarUrl(itemId, context));
    onClose();
  }, [selectedInstitute?.id, selectedClass?.id, selectedSubject?.id, selectedChild?.id,
      selectedOrganization?.id, selectedTransport?.id, navigate, onClose]);

  const handleLogout = () => { logout(); onClose(); };

  const handleBackNavigation = () => {
    if (selectedTransport) { setSelectedTransport(null); navigate('/transport'); }
    else if (selectedOrganization) { setSelectedOrganization(null); navigate('/organizations'); }
    else if (selectedChild) {
      if (selectedSubject) { setSelectedSubject(null); navigate(`/child/${selectedChild.id}/select-subject`); }
      else if (selectedClass) { setSelectedClass(null); navigate(`/child/${selectedChild.id}/select-class`); }
      else if (selectedInstitute) {
        // In subdomain/tenant mode, don't allow clearing institute — go back to class selection
        if (isTenantLogin) {
          navigate(`/child/${selectedChild.id}/select-class`);
        } else {
          setSelectedInstitute(null); navigate(`/child/${selectedChild.id}/select-institute`);
        }
      }
      else { setSelectedChild(null); navigate('/my-children'); }
    } else if (selectedSubject) {
      setSelectedSubject(null);
      navigate(`/institute/${selectedInstitute?.id}/class/${selectedClass?.id}/dashboard`);
    } else if (selectedClass) {
      setSelectedClass(null);
      navigate(`/institute/${selectedInstitute?.id}/dashboard`);
    } else if (selectedInstitute) {
      // In subdomain/tenant mode, don't navigate away from the institute
      if (!isTenantLogin) {
        setSelectedInstitute(null);
        navigate('/dashboard');
      }
    }
  };

  // Determines whether a user can see a nav item.
  // Two-layer check:
  //   1. Institute feature toggle (admin enables/disables at institute level) — always gates first.
  //   2. Permission check — if the user has a CUSTOM (non-system) RBAC user type,
  //      use their `canView` permission for that feature key.
  //      Otherwise fall back to the hard-coded role permission matrix.
  // Determine current navigation scope for scope-aware feature checks
  const currentNavScope: 'institute' | 'class' | 'subject' = selectedSubject
    ? 'subject'
    : selectedClass
    ? 'class'
    : 'institute';

  const filterFn = React.useCallback((items: NavItem[]) => {
    // Has the user been assigned a custom (non-system) RBAC user type by the institute?
    const slug = rbacContext?.userTypeSlug ?? '';
    const hasCustomType = !rbacLoading && !!rbacContext?.userTypeId && !SYSTEM_TYPE_SLUGS.has(slug);

    return items.filter(item => {
      // alwaysShow items bypass all checks (Dashboard, Profile, etc.)
      if (item.alwaysShow) return true;

      // Scope-aware feature check using featureKey override when provided.
      // class-scope keys (class-mark-attendance etc.) only hide items inside a class.
      // subject-scope keys only hide inside a subject. institute-scope always applies.
      const featureEnabled = isFeatureEnabledForScope(item.featureKey ?? item.id, currentNavScope);
      if (!featureEnabled) return false;

      // Custom RBAC user type: use per-feature canView from the permission matrix
      if (hasCustomType) {
        // isSystemAdmin (global superadmin) → see everything that the feature toggle allows
        if (rbacContext!.isSystemAdmin) return true;
        const perms = rbacContext!.permissions[item.id];
        // No row = not granted. Structural items (select-class, etc.) use alwaysShow so they bypass this.
        if (perms === undefined) return false;
        return perms.includes('view');
      }

      // Legacy hard-coded role check (system types: student, teacher, admin, etc.)
      return AccessControl.hasPermission(userRole as any, (item.permission || 'view-dashboard') as any);
    });
  }, [userRole, isFeatureEnabled, isFeatureEnabledForScope, currentNavScope, rbacContext, rbacLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build nav groups based on role + selection state ──────────
  const navGroups = React.useMemo((): NavGroup[] => {
    const groups: NavGroup[] = [];

    // ── Transport attendance special case ──────────────────────
    if (currentPage === 'transport-attendance') {
      return [{
        id: 'transport', label: 'Transport', icon: Truck, alwaysFlat: true,
        items: [{ id: 'transport-attendance', label: 'Attendance', icon: UserCheck, alwaysShow: true }]
      }];
    }

    // ── Organization context ───────────────────────────────────
    if (selectedOrganization) {
      return [
        { id: 'org-nav', label: 'Organization', icon: Building2, alwaysFlat: true,
          items: [
            { id: FEATURE_KEYS.ORGANIZATIONS, label: 'Select Organization', icon: Building2, alwaysShow: true },
            { id: 'organization-gallery', label: 'Gallery', icon: Camera, alwaysShow: true },
            { id: 'organization-courses', label: 'Courses', icon: BookOpen, alwaysShow: true },
          ]},
        { id: 'account', label: 'Account', icon: User, alwaysFlat: true,
          items: [{ id: 'profile', label: 'My Profile', icon: User, alwaysShow: true }] }
      ];
    }

    // ── Child context navigation (parent viewing child) ────────
    if (selectedChild && !selectedInstitute) {
      return [{
        id: 'child-nav', label: 'Select Child Institute', icon: Building2, alwaysFlat: true,
        items: [{ id: 'select-institute', label: 'Institutes', icon: Building2, alwaysShow: true,
          path: `/child/${selectedChild.id}/select-institute` }]
      }];
    }

    // ==========================================================
    //  STUDENT
    // ==========================================================
    if (userRole === 'Student') {
      // Main
      const mainItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, alwaysShow: true },
      ];
      if (!isTenantLogin && !selectedInstitute) {
        mainItems.push({ id: 'select-institute', label: 'Institutes', icon: Building2, alwaysShow: true });
      }
      groups.push({ id: 'main', label: 'Main', icon: Home, alwaysFlat: true, defaultOpen: true, items: mainItems });


      if (selectedInstitute && !selectedClass) {
        groups.push({ id: 'institute', label: 'Institute', icon: Building2, alwaysFlat: true, items: [
          { id: 'select-class', label: 'Select Class', icon: School, alwaysShow: true },
          { id: FEATURE_KEYS.MY_ATTENDANCE, label: 'My Attendance', icon: UserCheck },
          { id: FEATURE_KEYS.INSTITUTE_LECTURES, label: 'Institute Lectures', icon: Video },
          { id: FEATURE_KEYS.CALENDAR_VIEW, label: 'Calendar', icon: Calendar },
          ...(!isTuitionInstitute ? [{ id: FEATURE_KEYS.HOUSES, label: 'Houses', icon: Flag }] : []),
        ]});
      }

      if (selectedInstitute && selectedClass && !selectedSubject) {
        groups.push({ id: 'class', label: 'Class', icon: School, alwaysFlat: true, items: [
          { id: 'select-subject', label: `Select ${subjectLabel}`, icon: BookOpen, alwaysShow: true },
          { id: FEATURE_KEYS.CLASS_LECTURES, label: 'Class Lectures', icon: Video },
          { id: FEATURE_KEYS.LECTURE_RECORDING_ATTENDANCE, label: 'Recording Activity', icon: BarChart3 },
          { id: FEATURE_KEYS.MY_ATTENDANCE, label: 'My Attendance', icon: UserCheck },
          { id: FEATURE_KEYS.CALENDAR_VIEW, label: 'Calendar', icon: Calendar },
        ]});
        groups.push({ id: 'payments-class', label: 'Fees & Payments', icon: CreditCard, items: [
          { id: FEATURE_KEYS.CLASS_PAYMENTS, label: 'Class Fees', icon: Banknote },
          { id: 'my-submissions', label: 'My Submissions', icon: FileText, alwaysShow: true },
        ]});
      }

      if (selectedInstitute && selectedClass && selectedSubject) {
        // Check if student has full access (verified/enrolled_free_card) or limited access (pending states)
        const vs = selectedSubject.verificationStatus;
        const hasFullAccess = !vs || vs === 'verified' || vs === 'enrolled_free_card';
        
        const academicItems: NavItem[] = [];
        if (hasFullAccess) {
          academicItems.push(
            { id: FEATURE_KEYS.LECTURES, label: 'Lectures', icon: Video },
          );
        }
        academicItems.push(
          { id: FEATURE_KEYS.FREE_LECTURES, label: 'Free Lectures', icon: Video },
        );
        if (hasFullAccess) {
          academicItems.push(
            { id: FEATURE_KEYS.HOMEWORK, label: 'Homework', icon: Notebook },
            { id: FEATURE_KEYS.EXAMS, label: 'Exams', icon: Award },
            { id: FEATURE_KEYS.STUDY_MATERIALS, label: 'Study Materials', icon: FileText },
          );
        }
        
        groups.push({ id: 'academics', label: 'Academics', icon: BookOpen, defaultOpen: true, items: academicItems });
        groups.push({ id: 'attendance', label: 'Attendance', icon: UserCheck, defaultOpen: true, items: [
          { id: FEATURE_KEYS.MY_ATTENDANCE, label: 'My Attendance', icon: UserCheck, featureKey: FEATURE_KEYS.SUBJECT_MY_ATTENDANCE },
          { id: FEATURE_KEYS.CALENDAR_VIEW, label: 'Calendar', icon: Calendar },
        ]});
        // Subject-level payments disabled — class payments handled via enrollment
        groups.push({ id: 'payments', label: 'Fees & Payments', icon: CreditCard, items: [
          { id: FEATURE_KEYS.CLASS_PAYMENTS, label: 'Class Fees', icon: Banknote },
          { id: 'my-submissions', label: 'My Submissions', icon: FileText, alwaysShow: true },
        ]});
      }

      if (selectedInstitute && !selectedClass) {
        groups.push({ id: 'payments-inst', label: 'Fees & Payments', icon: CreditCard, items: [
          { id: FEATURE_KEYS.INSTITUTE_PAYMENTS, label: 'Institute Fees', icon: CreditCard },
          { id: 'my-submissions', label: 'My Submissions', icon: FileText, alwaysShow: true },
        ]});
      }

      if (!selectedInstitute) {
        groups.push({ id: 'services', label: 'Services', icon: LayoutGrid, items: [
          { id: FEATURE_KEYS.ID_CARDS, label: 'ID Cards', icon: IdCard },
          ...(!isTenantLogin ? [
            { id: FEATURE_KEYS.SYSTEM_PAYMENT, label: 'System Payment', icon: CreditCard },
            { id: FEATURE_KEYS.ORGANIZATIONS, label: 'Organizations', icon: Building2, locked: true },
            { id: FEATURE_KEYS.TRANSPORT, label: 'Transport', icon: Truck, locked: true },
          ] : []),
        ]});
      }

      // Consolidated Communication
      groups.push({ id: 'communication', label: 'Communication', icon: MessageSquare,
        defaultOpen: activePage === 'institute-notifications',
        items: [{ id: FEATURE_KEYS.INSTITUTE_NOTIFICATIONS, label: 'Notifications', icon: Bell, badge: unreadNotifCount }]
      });

      groups.push({ id: 'account', label: 'Account', icon: User, items: [
        selectedInstitute
          ? { id: 'institute-profile', label: 'My Profile', icon: User, alwaysShow: true }
          : { id: 'profile', label: 'My Profile', icon: User, alwaysShow: true },
        { id: 'settings', label: 'Settings', icon: Settings, alwaysShow: true },
      ]});

      return groups;
    }

    // ==========================================================
    //  TEACHER
    // ==========================================================
    if (userRole === 'Teacher') {
      groups.push({ id: 'main', label: 'Main', icon: Home, alwaysFlat: true, items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, alwaysShow: true },
        ...(!isTenantLogin && !selectedInstitute ? [{ id: 'select-institute', label: 'Institutes', icon: Building2, alwaysShow: true }] : []),
      ]});

      if (!isTenantLogin) {
        groups.push({ id: 'communication-global', label: 'Communication', icon: MessageSquare,
          defaultOpen: activePage === 'institute-notifications',
          items: [{ id: FEATURE_KEYS.INSTITUTE_NOTIFICATIONS, label: 'All Notifications', icon: Bell, badge: unreadNotifCount }]
        });
      }

      if (selectedInstitute) {
        groups.push({ id: 'class-nav', label: 'Class Navigation', icon: School, alwaysFlat: true, items: [
          ...(!selectedClass ? [{ id: 'select-class', label: 'Select Class', icon: School, alwaysShow: true }] : []),
          ...(selectedClass && !selectedSubject ? [{ id: 'select-subject', label: `Select ${subjectLabel}`, icon: BookOpen, alwaysShow: true }] : []),
          // Institute Subjects and Institute Lectures only at institute level
          ...(!selectedClass ? [{ id: FEATURE_KEYS.INSTITUTE_SUBJECTS, label: `Institute ${subjectsLabel}`, icon: BookOpen }] : []),
          ...(!selectedClass ? [{ id: FEATURE_KEYS.INSTITUTE_LECTURES, label: 'Institute Lectures', icon: Video }] : []),
          ...(selectedClass && !selectedSubject ? [{ id: FEATURE_KEYS.CLASS_LECTURES, label: 'Class Lectures', icon: Video }] : []),
          ...(!selectedClass && !isTuitionInstitute ? [{ id: FEATURE_KEYS.HOUSES, label: 'Houses', icon: Flag }] : []),
        ].filter(i => i !== undefined) as NavItem[]});

        if (selectedClass) {
          groups.push({ id: 'manage-users', label: 'Manage Users', icon: Users, defaultOpen: hasActiveInGroup(['students','unverified-students'], activePage), items: [
            { id: FEATURE_KEYS.STUDENTS, label: 'Students', icon: GraduationCap },
            { id: FEATURE_KEYS.UNVERIFIED_STUDENTS, label: 'Pending Students', icon: UserCheck },
          ]});
        }

        if (selectedClass && selectedSubject) {
          groups.push({ id: 'academics', label: 'Academics', icon: BookOpen, defaultOpen: true, items: [
            { id: FEATURE_KEYS.LECTURES, label: 'Lectures', icon: Video },
            { id: FEATURE_KEYS.FREE_LECTURES, label: 'Free Lectures', icon: Video },
            { id: FEATURE_KEYS.HOMEWORK, label: 'Homework', icon: Notebook },
            { id: FEATURE_KEYS.EXAMS, label: 'Exams', icon: Award },
            { id: FEATURE_KEYS.STUDY_MATERIALS, label: 'Study Materials', icon: FileText },
          ]});
        }

        const teacherAttendanceLabel = (selectedClass && selectedSubject) ? (isTuitionInstitute ? 'Month Attendance' : `${subjectLabel} Attendance`) : (selectedClass ? 'Class Attendance' : 'Institute Attendance');
        const teacherItemLabel = (selectedClass && selectedSubject) ? (isTuitionInstitute ? 'Month Attendance' : `${subjectLabel} Attendance`) : (selectedClass ? 'Class Attendance' : 'Institute Attendance');
        groups.push({ id: 'attendance', label: teacherAttendanceLabel, icon: UserCheck, defaultOpen: hasActiveInGroup(['daily-attendance','my-attendance','select-attendance-mark-type','qr-attendance','rfid-attendance','institute-mark-attendance','close-attendance','lecture-live-attendance','lecture-recording-attendance'], activePage), items: [
          { id: FEATURE_KEYS.SELECT_ATTENDANCE_MARK_TYPE, label: 'Mark Attendance', icon: QrCode, ...(selectedSubject ? { featureKey: FEATURE_KEYS.SUBJECT_MARK_ATTENDANCE } : selectedClass ? { featureKey: FEATURE_KEYS.CLASS_MARK_ATTENDANCE } : {}) },
          ...(selectedClass ? [{ id: FEATURE_KEYS.DAILY_ATTENDANCE, label: teacherItemLabel, icon: ClipboardList, featureKey: selectedSubject ? FEATURE_KEYS.SUBJECT_DAILY_ATTENDANCE : FEATURE_KEYS.CLASS_DAILY_ATTENDANCE }] : []),
          // Live/Recording attendance only when a class is selected
          ...(selectedClass ? [{ id: FEATURE_KEYS.LECTURE_LIVE_ATTENDANCE, label: 'Live Attendance', icon: BarChart3, featureKey: FEATURE_KEYS.CLASS_LIVE_ATTENDANCE }] : []),
          ...(selectedClass ? [{ id: FEATURE_KEYS.LECTURE_RECORDING_ATTENDANCE, label: 'Recording Attendance', icon: BarChart3, featureKey: FEATURE_KEYS.CLASS_RECORDING_ATTENDANCE }] : []),
          { id: FEATURE_KEYS.MY_ATTENDANCE, label: 'My Attendance', icon: UserCheck, ...(selectedSubject ? { featureKey: FEATURE_KEYS.SUBJECT_MY_ATTENDANCE } : selectedClass ? { featureKey: FEATURE_KEYS.CLASS_MY_ATTENDANCE } : {}) },
        ]});

        if (!selectedClass) {
          groups.push({ id: 'calendar', label: 'Calendar', icon: Calendar,
            defaultOpen: hasActiveInGroup(['calendar-view'], activePage),
            items: [
              { id: FEATURE_KEYS.CALENDAR_VIEW, label: 'View Calendar', icon: Calendar },
            ]});
        }

        // Subject-level payments disabled — class payments handled via enrollment
        const teacherPaymentItems: NavItem[] = [];
        if (!selectedClass) {
          teacherPaymentItems.push({ id: FEATURE_KEYS.INSTITUTE_PAYMENTS, label: 'Institute Fees', icon: CreditCard });
        }
        if (selectedClass) {
          teacherPaymentItems.push({ id: FEATURE_KEYS.CLASS_PAYMENTS, label: 'Class Fees', icon: Banknote });
        }
        teacherPaymentItems.push({ id: FEATURE_KEYS.COLLECT_PHYSICAL_PAYMENT, label: 'Collect Payment', icon: Banknote, ...(selectedSubject ? { featureKey: FEATURE_KEYS.SUBJECT_COLLECT_PAYMENT } : selectedClass ? { featureKey: FEATURE_KEYS.CLASS_COLLECT_PAYMENT } : {}) });
        if (isFeatureEnabled(FEATURE_KEYS.TEACHER_FINANCE)) {
          teacherPaymentItems.push({ id: 'teacher-finance', label: 'My Earnings', icon: Wallet });
        }
        groups.push({ id: 'payments', label: 'Fees & Payments', icon: CreditCard,
          defaultOpen: hasActiveInGroup(['institute-payments','class-payments','collect-physical-payment','teacher-finance'], activePage),
          items: teacherPaymentItems });
      }

      if (!selectedInstitute) {
        groups.push({ id: 'services', label: 'Services', icon: LayoutGrid, items: [
          { id: FEATURE_KEYS.ID_CARDS, label: 'ID Cards', icon: IdCard },
          ...(!isTenantLogin ? [
            { id: FEATURE_KEYS.SYSTEM_PAYMENT, label: 'System Payment', icon: CreditCard },
          ] : []),
        ]});
      }

      groups.push({ id: 'account', label: 'Account', icon: User, items: [
        selectedInstitute
          ? { id: 'institute-profile', label: 'My Profile', icon: User, alwaysShow: true }
          : { id: 'profile', label: 'My Profile', icon: User, alwaysShow: true },
        { id: 'settings', label: 'Settings', icon: Settings, alwaysShow: true },
      ]});

      return groups;
    }

    // ==========================================================
    //  INSTITUTE ADMIN
    // ==========================================================
    if (userRole === 'InstituteAdmin') {
      groups.push({ id: 'main', label: 'Main', icon: Home, alwaysFlat: true, items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, alwaysShow: true },
        ...(!isTenantLogin && !selectedInstitute ? [{ id: 'select-institute', label: 'Institutes', icon: Building2, alwaysShow: true }] : []),
      ]});

      if (selectedInstitute) {
        // Class/Subject navigation
        groups.push({ id: 'institute-nav', label: 'Navigate', icon: School, alwaysFlat: true, items: [
          ...(!selectedClass ? [{ id: 'select-class', label: 'Select Class', icon: School, alwaysShow: true }] : []),
          ...(selectedClass && !selectedSubject ? [{ id: 'select-subject', label: `Select ${subjectLabel}`, icon: BookOpen, alwaysShow: true }] : []),
        ]});

        // Houses
        if (!selectedClass && !isTuitionInstitute) {
          groups.push({ id: 'houses-group', label: 'Community', icon: Flag,
            defaultOpen: activePage === 'houses',
            items: [{ id: FEATURE_KEYS.HOUSES, label: 'Houses', icon: Flag }] });
        }

        // Manage Users — consolidated group (the key improvement)
        const manageUserItems: NavItem[] = [
          ...(!selectedClass ? [{ id: FEATURE_KEYS.INSTITUTE_USERS, label: 'All Users', icon: Users }] : []),
          ...(!selectedSubject ? [{ id: FEATURE_KEYS.PARENTS, label: 'Parents', icon: Users, ...(selectedClass ? { featureKey: FEATURE_KEYS.CLASS_PARENTS } : {}) }] : []),
          ...(selectedClass ? [
            { id: FEATURE_KEYS.STUDENTS, label: 'Students', icon: GraduationCap },
            { id: FEATURE_KEYS.UNVERIFIED_STUDENTS, label: 'Pending Students', icon: UserCheck },
          ] : []),
          ...(!selectedClass ? [{ id: FEATURE_KEYS.VERIFY_IMAGE, label: 'Verify Photos', icon: ShieldCheck }] : []),
        ];
        groups.push({ id: 'manage-users', label: 'Manage Users', icon: UserCog,
          defaultOpen: hasActiveInGroup(['institute-users','parents','students','unverified-students','verify-image'], activePage),
          items: manageUserItems });

        // Academics
        const academicItems: NavItem[] = [
          // All Classes and Institute Subjects only at institute level (no class selected)
          ...(!selectedClass ? [
            { id: FEATURE_KEYS.CLASSES, label: 'All Classes', icon: School },
            { id: FEATURE_KEYS.INSTITUTE_SUBJECTS, label: `Institute ${subjectsLabel}`, icon: BookOpen },
            { id: FEATURE_KEYS.INSTITUTE_LECTURES, label: 'Institute Lectures', icon: Video },
          ] : []),
          ...(selectedClass && !selectedSubject ? [
            { id: FEATURE_KEYS.CLASS_LECTURES, label: 'Class Lectures', icon: Video },
            { id: FEATURE_KEYS.CLASS_SUBJECTS, label: `Class ${subjectsLabel}`, icon: BookOpen },
          ] : []),
          ...(selectedClass && selectedSubject ? [
            { id: FEATURE_KEYS.LECTURES, label: 'Lectures', icon: Video },
            { id: FEATURE_KEYS.FREE_LECTURES, label: 'Free Lectures', icon: Video },
            { id: FEATURE_KEYS.SUBJECT_RECORDINGS, label: 'Recordings', icon: Video },
            { id: FEATURE_KEYS.HOMEWORK, label: 'Homework', icon: Notebook },
            { id: FEATURE_KEYS.EXAMS, label: 'Exams', icon: Award },
            { id: FEATURE_KEYS.STUDY_MATERIALS, label: 'Study Materials', icon: FileText },
          ] : []),
          ...(!isTuitionInstitute && !selectedClass ? [{ id: FEATURE_KEYS.INSTITUTE_ORGANIZATIONS, label: 'Organization', icon: Building2 }] : []),
        ];
        groups.push({ id: 'academics', label: 'Academics', icon: BookOpen,
          defaultOpen: hasActiveInGroup(['classes','institute-subjects','institute-lectures','class-lectures','class-subjects','lectures','subject-recordings','homework','exams','study-materials'], activePage),
          items: academicItems });

        // Attendance
        const attendanceItemLabel = (selectedClass && selectedSubject) ? (isTuitionInstitute ? 'Month Attendance' : `${subjectLabel} Attendance`) : (selectedClass ? 'Class Attendance' : 'Institute Attendance');
        const attendanceSectionLabel = (selectedClass && selectedSubject) ? (isTuitionInstitute ? 'Month Attendance' : `${subjectLabel} Attendance`) : (selectedClass ? 'Class Attendance' : 'Institute Attendance');
        const attendanceItems: NavItem[] = selectedClass ? [
          { id: FEATURE_KEYS.SELECT_ATTENDANCE_MARK_TYPE, label: 'Mark Attendance', icon: QrCode, featureKey: selectedSubject ? FEATURE_KEYS.SUBJECT_MARK_ATTENDANCE : FEATURE_KEYS.CLASS_MARK_ATTENDANCE },
          { id: FEATURE_KEYS.DAILY_ATTENDANCE, label: attendanceItemLabel, icon: ClipboardList, featureKey: selectedSubject ? FEATURE_KEYS.SUBJECT_DAILY_ATTENDANCE : FEATURE_KEYS.CLASS_DAILY_ATTENDANCE },
          // Live/Recording attendance only when a class is selected (lecture-based features)
          { id: FEATURE_KEYS.LECTURE_LIVE_ATTENDANCE, label: 'Live Attendance', icon: BarChart3, featureKey: FEATURE_KEYS.CLASS_LIVE_ATTENDANCE },
          { id: FEATURE_KEYS.LECTURE_RECORDING_ATTENDANCE, label: 'Recording Attendance', icon: BarChart3, featureKey: FEATURE_KEYS.CLASS_RECORDING_ATTENDANCE },
          { id: FEATURE_KEYS.MY_ATTENDANCE, label: 'My Attendance', icon: UserCheck, featureKey: selectedSubject ? FEATURE_KEYS.SUBJECT_MY_ATTENDANCE : FEATURE_KEYS.CLASS_MY_ATTENDANCE },
        ] : [
          // Institute level — no lecture attendance here
          { id: FEATURE_KEYS.SELECT_ATTENDANCE_MARK_TYPE, label: 'Mark Attendance', icon: QrCode },
          { id: FEATURE_KEYS.DAILY_ATTENDANCE, label: attendanceItemLabel, icon: ClipboardList },
          { id: FEATURE_KEYS.MY_ATTENDANCE, label: 'My Attendance', icon: UserCheck },
          { id: FEATURE_KEYS.ADMIN_ATTENDANCE, label: 'Advanced Attendance', icon: BarChart3 },
        ];
        groups.push({ id: 'attendance', label: attendanceSectionLabel, icon: UserCheck,
          defaultOpen: hasActiveInGroup(['daily-attendance','select-attendance-mark-type','qr-attendance','rfid-attendance','institute-mark-attendance','close-attendance','admin-attendance'], activePage),
          items: attendanceItems });

        // Calendar
        if (!selectedClass) {
          groups.push({ id: 'calendar', label: 'Calendar', icon: Calendar,
            defaultOpen: hasActiveInGroup(['calendar-view','calendar-management'], activePage),
            items: [
              { id: FEATURE_KEYS.CALENDAR_VIEW, label: 'View Calendar', icon: Calendar },
              { id: FEATURE_KEYS.CALENDAR_MANAGEMENT, label: 'Manage Calendar', icon: CalendarDays },
            ]});
        }

        // Designs (certificates, birthday wishes, etc.) — InstituteAdmin only, no class selected
        if (!selectedClass) {
          groups.push({ id: 'designs', label: 'Designs', icon: Palette,
            defaultOpen: activePage === 'institute-designs',
            items: [{ id: FEATURE_KEYS.INSTITUTE_DESIGNS, label: 'Designs', icon: Palette }] });
        }

        // Fees & Payments
        const paymentItems: NavItem[] = [];
        if (!selectedClass) {
          paymentItems.push({ id: FEATURE_KEYS.INSTITUTE_PAYMENTS, label: 'Institute Fees', icon: CreditCard });
        }
        if (selectedClass) {
          paymentItems.push({ id: FEATURE_KEYS.CLASS_PAYMENTS, label: 'Class Fees', icon: Banknote });
        }
        paymentItems.push({
          id: FEATURE_KEYS.COLLECT_PHYSICAL_PAYMENT, label: 'Collect Payment', icon: Banknote,
          ...(selectedSubject ? { featureKey: FEATURE_KEYS.SUBJECT_COLLECT_PAYMENT } : selectedClass ? { featureKey: FEATURE_KEYS.CLASS_COLLECT_PAYMENT } : {}),
        });
        if (!selectedClass) {
          paymentItems.push({ id: FEATURE_KEYS.INSTITUTE_BILLING, label: `Billing & Plan${instituteTier && instituteTier !== 'FREE' ? '' : ' — Free'}`, icon: Receipt });
          paymentItems.push({ id: FEATURE_KEYS.INSTITUTE_CREDITS, label: 'Institute Wallet', icon: Wallet });
          if (isFeatureEnabled(FEATURE_KEYS.SURAKSHA_FINANCE)) {
            paymentItems.push({ id: 'finance-hub', label: 'Finance Hub', icon: Wallet });
          }
        }
        if (paymentItems.length) {
          groups.push({ id: 'payments', label: 'Fees & Payments', icon: CreditCard,
            defaultOpen: hasActiveInGroup(['institute-payments','class-payments','institute-billing','institute-credits','collect-physical-payment','finance-hub'], activePage),
            items: paymentItems });
        }

        // Communication
      }

      // Services (only visible before institute is selected)
      if (!selectedInstitute) {
        groups.push({ id: 'services', label: 'Services', icon: LayoutGrid,
          defaultOpen: hasActiveInGroup(['id-cards'], activePage),
          items: [
            { id: FEATURE_KEYS.ID_CARDS, label: 'ID Cards', icon: IdCard },
            ...(!isTenantLogin ? [
              { id: FEATURE_KEYS.SYSTEM_PAYMENT, label: 'System Payment', icon: CreditCard },
              { id: FEATURE_KEYS.ORGANIZATIONS, label: 'Organizations', icon: Building2, locked: true },
            ] : []),
          ]});
      }

      // Account
      const accountItems: NavItem[] = [
        selectedInstitute
          ? { id: 'institute-profile', label: 'My Profile', icon: User, alwaysShow: true }
          : { id: 'profile', label: 'My Profile', icon: User, alwaysShow: true },
      ];
      if (selectedInstitute && !selectedClass) {
        accountItems.push({ id: 'institute-settings', label: 'Institute Settings', icon: Settings, alwaysShow: true });
        accountItems.push({ id: FEATURE_KEYS.DEVICE_MANAGEMENT, label: 'Device Management', icon: Wifi });
      }
      accountItems.push({ id: 'settings', label: 'Settings', icon: Settings, alwaysShow: true });
      // Consolidated Communication
      const commItems: NavItem[] = [];
      if (!isTenantLogin) {
        const notifFeatureKey = selectedSubject
          ? FEATURE_KEYS.SUBJECT_NOTIFICATIONS
          : selectedClass
          ? FEATURE_KEYS.CLASS_NOTIFICATIONS
          : undefined;
        commItems.push({ id: FEATURE_KEYS.INSTITUTE_NOTIFICATIONS, label: 'All Notifications', icon: Bell, badge: unreadNotifCount, ...(notifFeatureKey ? { featureKey: notifFeatureKey } : {}) });
      }
      if (selectedInstitute) {
        if (!selectedClass) {
          commItems.push({ id: FEATURE_KEYS.SMS, label: 'Send SMS', icon: MessageSquare });
          commItems.push({ id: FEATURE_KEYS.SMS_HISTORY, label: 'SMS History', icon: ListChecks });
        }
        if (isTenantLogin) {
          commItems.push({ id: FEATURE_KEYS.INSTITUTE_NOTIFICATIONS, label: 'Notifications', icon: Bell, badge: unreadNotifCount });
        }
      }
      if (commItems.length > 0) {
        groups.push({ id: 'communication', label: 'Communication', icon: MessageSquare,
          defaultOpen: hasActiveInGroup(['sms','sms-history','institute-notifications'], activePage),
          items: commItems
        });
      }

      groups.push({ id: 'account', label: 'Account', icon: User,
        defaultOpen: hasActiveInGroup(['profile','institute-profile','settings'], activePage),
        items: accountItems });

      return groups;
    }

    // ==========================================================
    //  PARENT
    // ==========================================================
    if (userRole === 'Parent') {
      groups.push({ id: 'main', label: 'Main', icon: Home, alwaysFlat: true, items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, alwaysShow: true },
        ...(!isTenantLogin && !selectedInstitute ? [{ id: 'select-institute', label: 'Institutes', icon: Building2, alwaysShow: true }] : []),
        { id: 'my-children', label: 'My Children', icon: Users, alwaysShow: true },
      ]});

      if (selectedChild) {
        groups.push({ id: 'attendance', label: 'Attendance', icon: UserCheck, defaultOpen: true, items: [
          { id: 'parent-attendance', label: 'Attendance Dashboard', icon: CalendarDays, alwaysShow: true },
          { id: 'child-attendance', label: 'Transport Attendance', icon: Truck, alwaysShow: true },
        ]});
      }

    if (selectedChild && selectedInstitute) {
      groups.push({ id: 'child-nav', label: 'Navigate', icon: School, alwaysFlat: true, items: [
        ...(!selectedClass ? [{ id: 'select-class', label: 'Select Class', icon: School, alwaysShow: true }] : []),
        ...(selectedClass && !selectedSubject ? [{ id: 'select-subject', label: `Select ${subjectLabel}`, icon: BookOpen, alwaysShow: true }] : []),
      ]});

      groups.push({ id: 'academics', label: 'Academics', icon: BookOpen,
        defaultOpen: hasActiveInGroup(['homework','homework-submissions','exams'], activePage),
        items: [
          { id: FEATURE_KEYS.HOMEWORK, label: 'Homework', icon: Notebook },
          { id: 'homework-submissions', label: 'Submit Homework', icon: FileText, alwaysShow: true },
          { id: FEATURE_KEYS.EXAMS, label: 'Exams', icon: Award },
        ]});

      // Subject-level payments disabled — class payments handled via enrollment
      const parentPaymentItems: NavItem[] = [
        { id: FEATURE_KEYS.INSTITUTE_PAYMENTS, label: 'Institute Fees', icon: CreditCard },
        ...(selectedClass ? [{ id: FEATURE_KEYS.CLASS_PAYMENTS, label: 'Class Fees', icon: Banknote }] : []),
        { id: 'my-submissions', label: 'My Submissions', icon: FileText, alwaysShow: true },
      ];
      groups.push({ id: 'payments', label: 'Fees & Payments', icon: CreditCard,
        defaultOpen: hasActiveInGroup(['institute-payments','class-payments','my-submissions'], activePage),
        items: parentPaymentItems });
      }

      groups.push({ id: 'services', label: 'Services', icon: LayoutGrid, items: [
        ...(!selectedInstitute ? [
          { id: FEATURE_KEYS.ID_CARDS, label: 'ID Cards', icon: IdCard },
          { id: FEATURE_KEYS.SYSTEM_PAYMENT, label: 'System Payment', icon: CreditCard },
        ] : []),
        { id: FEATURE_KEYS.TRANSPORT, label: 'Transport', icon: Truck, locked: true },
      ]});

      groups.push({ id: 'account', label: 'Account', icon: User, items: [
        { id: 'profile', label: 'My Profile', icon: User, alwaysShow: true },
        { id: 'settings', label: 'Settings', icon: Settings, alwaysShow: true },
      ]});

      return groups;
    }

    // ==========================================================
    //  ATTENDANCE MARKER
    // ==========================================================
    if (userRole === 'AttendanceMarker') {
      groups.push({ id: 'main', label: 'Main', icon: Home, alwaysFlat: true, items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, alwaysShow: true },
        ...(!isTenantLogin && !selectedInstitute ? [{ id: 'select-institute', label: 'Institutes', icon: Building2, alwaysShow: true }] : []),
      ]});

      if (selectedInstitute) {
        groups.push({ id: 'class-nav', label: 'Navigate', icon: School, alwaysFlat: true, items: [
          ...(!selectedClass ? [{ id: 'select-class', label: 'Select Class', icon: School, alwaysShow: true }] : []),
          ...(selectedClass && !selectedSubject ? [{ id: 'select-subject', label: `Select ${subjectLabel}`, icon: BookOpen, alwaysShow: true }] : []),
        ]});

        groups.push({ id: 'attendance', label: 'Attendance', icon: UserCheck, defaultOpen: true, items: [
          { id: FEATURE_KEYS.DAILY_ATTENDANCE, label: 'Daily Attendance', icon: UserCheck },
          { id: FEATURE_KEYS.SELECT_ATTENDANCE_MARK_TYPE, label: 'Mark Attendance', icon: QrCode },
          { id: FEATURE_KEYS.MY_ATTENDANCE, label: 'My Attendance', icon: UserCheck },
        ]});

        if (!selectedClass) {
          groups.push({ id: 'calendar', label: 'Calendar', icon: Calendar,
            defaultOpen: hasActiveInGroup(['calendar-view'], activePage),
            items: [
              { id: FEATURE_KEYS.CALENDAR_VIEW, label: 'View Calendar', icon: Calendar },
            ]});
        }

        if (selectedSubject) {
          groups.push({ id: 'academics', label: 'Academics', icon: BookOpen, items: [
            { id: FEATURE_KEYS.FREE_LECTURES, label: 'Free Lectures', icon: Video },
          ]});
        }

        // Collect Payment is always available once an institute is selected
        groups.push({ id: 'payments', label: 'Fees & Payments', icon: CreditCard,
          defaultOpen: hasActiveInGroup(['collect-physical-payment'], activePage),
          items: [
            { id: FEATURE_KEYS.COLLECT_PHYSICAL_PAYMENT, label: 'Collect Payment', icon: Banknote },
          ]});
      }

      if (!selectedInstitute) {
        groups.push({ id: 'services', label: 'Services', icon: LayoutGrid, items: [
          { id: FEATURE_KEYS.ID_CARDS, label: 'ID Cards', icon: IdCard },
          { id: FEATURE_KEYS.SYSTEM_PAYMENT, label: 'System Payment', icon: CreditCard },
        ]});
      }

      groups.push({ id: 'account', label: 'Account', icon: User, items: [
        { id: 'profile', label: 'My Profile', icon: User, alwaysShow: true },
        ...(selectedInstitute && !selectedClass ? [{ id: 'institute-profile', label: 'Institute Profile', icon: Building2, alwaysShow: true }] : []),
        { id: 'settings', label: 'Settings', icon: Settings, alwaysShow: true },
      ]});

      if (selectedInstitute) {
        groups.push({ id: 'rbac', label: 'Permissions', icon: ShieldCheck, items: [
          { id: 'user-types', label: 'User Types & Permissions', icon: ShieldCheck, alwaysShow: true },
        ]});
      }

      return groups;
    }

    // ==========================================================
    //  CUSTOM USER TYPE (non-system role assigned by institute)
    //  e.g. "Lab Assistant", "Librarian", "Transport Manager"
    //  The filterFn already gates each item by canView; here we
    //  expose ALL feature-based nav items so they're available to filter.
    // ==========================================================
    if (rbacContext?.userTypeId && !SYSTEM_TYPE_SLUGS.has(rbacContext.userTypeSlug ?? '')) {
      groups.push({ id: 'main', label: 'Main', icon: Home, alwaysFlat: true, items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, alwaysShow: true },
        ...(!isTenantLogin && !selectedInstitute ? [{ id: 'select-institute', label: 'Institutes', icon: Building2, alwaysShow: true }] : []),
      ]});

      if (selectedInstitute) {
        groups.push({ id: 'navigate', label: 'Navigate', icon: School, alwaysFlat: true, items: [
          ...(!selectedClass ? [{ id: 'select-class', label: 'Select Class', icon: School, alwaysShow: true }] : []),
          ...(selectedClass && !selectedSubject ? [{ id: 'select-subject', label: `Select ${subjectLabel}`, icon: BookOpen, alwaysShow: true }] : []),
        ]});

        groups.push({ id: 'manage-users', label: 'Manage Users', icon: UserCog, items: [
          { id: FEATURE_KEYS.INSTITUTE_USERS, label: 'All Users', icon: Users },
          { id: FEATURE_KEYS.PARENTS, label: 'Parents', icon: Users },
          { id: FEATURE_KEYS.STUDENTS, label: 'Students', icon: GraduationCap },
          { id: FEATURE_KEYS.UNVERIFIED_STUDENTS, label: 'Pending Students', icon: UserCheck },
          { id: FEATURE_KEYS.VERIFY_IMAGE, label: 'Verify Photos', icon: ShieldCheck },
        ]});

        groups.push({ id: 'academics', label: 'Academics', icon: BookOpen, items: [
          { id: FEATURE_KEYS.CLASSES, label: 'All Classes', icon: School },
          { id: FEATURE_KEYS.INSTITUTE_SUBJECTS, label: `Institute ${subjectsLabel}`, icon: BookOpen },
          { id: FEATURE_KEYS.INSTITUTE_LECTURES, label: 'Institute Lectures', icon: Video },
          ...(selectedClass ? [{ id: FEATURE_KEYS.CLASS_LECTURES, label: 'Class Lectures', icon: Video }] : []),
          ...(selectedClass ? [{ id: FEATURE_KEYS.CLASS_SUBJECTS, label: `Class ${subjectsLabel}`, icon: BookOpen }] : []),
          ...(selectedClass && selectedSubject ? [
            { id: FEATURE_KEYS.LECTURES, label: 'Lectures', icon: Video },
            { id: FEATURE_KEYS.FREE_LECTURES, label: 'Free Lectures', icon: Video },
            { id: FEATURE_KEYS.SUBJECT_RECORDINGS, label: 'Recordings', icon: Video },
            { id: FEATURE_KEYS.HOMEWORK, label: 'Homework', icon: Notebook },
            { id: FEATURE_KEYS.EXAMS, label: 'Exams', icon: Award },
            { id: FEATURE_KEYS.STUDY_MATERIALS, label: 'Study Materials', icon: FileText },
          ] : []),
        ]});

        groups.push({ id: 'attendance', label: 'Attendance', icon: UserCheck, items: [
          { id: FEATURE_KEYS.SELECT_ATTENDANCE_MARK_TYPE, label: 'Mark Attendance', icon: QrCode },
          { id: FEATURE_KEYS.DAILY_ATTENDANCE, label: 'Daily Attendance', icon: ClipboardList },
          { id: FEATURE_KEYS.LECTURE_LIVE_ATTENDANCE, label: 'Live Attendance', icon: BarChart3 },
          { id: FEATURE_KEYS.LECTURE_RECORDING_ATTENDANCE, label: 'Recording Attendance', icon: BarChart3 },
          { id: FEATURE_KEYS.ADMIN_ATTENDANCE, label: 'Advanced Attendance', icon: BarChart3 },
          { id: FEATURE_KEYS.MY_ATTENDANCE, label: 'My Attendance', icon: UserCheck },
          { id: FEATURE_KEYS.CALENDAR_VIEW, label: 'Calendar', icon: Calendar },
        ]});

        groups.push({ id: 'communication', label: 'Communication', icon: MessageSquare, items: [
          { id: FEATURE_KEYS.SMS, label: 'Send SMS', icon: MessageSquare },
          { id: FEATURE_KEYS.SMS_HISTORY, label: 'SMS History', icon: ListChecks },
          { id: FEATURE_KEYS.INSTITUTE_NOTIFICATIONS, label: 'Notifications', icon: Bell, badge: unreadNotifCount },
        ]});

        groups.push({ id: 'payments', label: 'Fees & Payments', icon: CreditCard, items: [
          { id: FEATURE_KEYS.INSTITUTE_PAYMENTS, label: 'Institute Fees', icon: CreditCard },
          { id: FEATURE_KEYS.CLASS_PAYMENTS, label: 'Class Fees', icon: Banknote },
          { id: FEATURE_KEYS.COLLECT_PHYSICAL_PAYMENT, label: 'Collect Payment', icon: Banknote },
          { id: FEATURE_KEYS.INSTITUTE_BILLING, label: 'Billing & Plan', icon: Receipt },
          { id: FEATURE_KEYS.INSTITUTE_CREDITS, label: 'Institute Wallet', icon: Wallet },
        ]});
      }

      groups.push({ id: 'account', label: 'Account', icon: User, items: [
        selectedInstitute
          ? { id: 'institute-profile', label: 'My Profile', icon: User, alwaysShow: true }
          : { id: 'profile', label: 'My Profile', icon: User, alwaysShow: true },
        { id: 'settings', label: 'Settings', icon: Settings, alwaysShow: true },
      ]});

      return groups;
    }

    // ==========================================================
    //  DEFAULT / SystemAdmin / Other
    // ==========================================================
    groups.push({ id: 'main', label: 'Main', icon: Home, alwaysFlat: true, items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, alwaysShow: true },
      ...(!isTenantLogin && !selectedInstitute ? [{ id: 'select-institute', label: 'Institutes', icon: Building2, alwaysShow: true }] : []),
      ...((userRole === 'User' || userRole === 'UserWithoutStudent') ? [{ id: 'my-children', label: 'My Children', icon: Users, alwaysShow: true }] : []),
    ]});

    if (!selectedInstitute && !isTenantLogin) {
      groups.push({ id: 'communication-global', label: 'Communication', icon: MessageSquare,
        defaultOpen: activePage === 'institute-notifications',
        items: [{ id: FEATURE_KEYS.INSTITUTE_NOTIFICATIONS, label: 'All Notifications', icon: Bell, badge: unreadNotifCount }]
      });
    }

    if (selectedInstitute) {
      groups.push({ id: 'manage-users', label: 'Manage Users', icon: UserCog, defaultOpen: true, items: [
        { id: FEATURE_KEYS.INSTITUTE_USERS, label: 'All Users', icon: Users },
        { id: FEATURE_KEYS.STUDENTS, label: 'Students', icon: GraduationCap },
        ...(!selectedSubject ? [{ id: FEATURE_KEYS.PARENTS, label: 'Parents', icon: Users }] : []),
        ...(user?.role !== 'SystemAdmin' ? [{ id: 'teachers', label: 'Teachers', icon: UserCheck }] : []),
        { id: FEATURE_KEYS.VERIFY_IMAGE, label: 'Verify Photos', icon: ShieldCheck },
      ]});

      groups.push({ id: 'academics', label: 'Academics', icon: BookOpen, items: [
        { id: FEATURE_KEYS.CLASSES, label: 'All Classes', icon: School },
        { id: FEATURE_KEYS.INSTITUTE_SUBJECTS, label: `Institute ${subjectsLabel}`, icon: BookOpen },
        ...(user?.role !== 'SystemAdmin' ? [
          { id: 'select-class', label: 'Select Class', icon: School },
          ...(selectedClass && !selectedSubject ? [{ id: 'select-subject', label: `Select ${subjectLabel}`, icon: BookOpen }] : []),
        ] : []),
        { id: 'institutes', label: 'Institutes', icon: Building2 },
      ]});

      groups.push({ id: 'attendance', label: 'Attendance', icon: UserCheck, items: [
        { id: FEATURE_KEYS.SELECT_ATTENDANCE_MARK_TYPE, label: 'Mark Attendance', icon: QrCode, permission: 'mark-attendance' },
      ]});

      groups.push({ id: 'calendar', label: 'Calendar', icon: Calendar,
        defaultOpen: hasActiveInGroup(['calendar-view'], activePage),
        items: [
          { id: FEATURE_KEYS.CALENDAR_VIEW, label: 'View Calendar', icon: Calendar },
        ]});
    }

    if (!selectedInstitute) {
      groups.push({ id: 'services', label: 'Services', icon: LayoutGrid, items: [
        { id: FEATURE_KEYS.ID_CARDS, label: 'ID Cards', icon: IdCard },
        { id: FEATURE_KEYS.SYSTEM_PAYMENT, label: 'System Payment', icon: CreditCard },
        { id: FEATURE_KEYS.ORGANIZATIONS, label: 'Organizations', icon: Building2, locked: true },
        { id: FEATURE_KEYS.TRANSPORT, label: 'Transport', icon: Truck, locked: true },
      ]});

    }

    groups.push({ id: 'account', label: 'Account', icon: User, items: [
      { id: 'profile', label: 'My Profile', icon: User, alwaysShow: true },
      { id: 'feedback', label: 'Feedback', icon: MessageSquareHeart, alwaysShow: true },
      { id: 'settings', label: 'Settings', icon: Settings, alwaysShow: true },
    ]});

    return groups;
  }, [userRole, selectedInstitute?.id, selectedClass?.id, selectedSubject?.id,
      selectedChild?.id, selectedOrganization?.id, selectedTransport?.id,
      isTuitionInstitute, subjectLabel, subjectsLabel, activePage, user?.role, currentPage, unreadNotifCount]);

  // Context breadcrumb
  const showContextBar = !isCollapsed && user?.role !== 'SystemAdmin'
    && (selectedInstitute || selectedClass || selectedSubject || selectedChild || selectedOrganization || selectedTransport)
    && !location.pathname.startsWith('/child/');

  const childContextBar = !isCollapsed && location.pathname.startsWith('/child/') && selectedChild;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      {/* Sidebar panel */}
      <div className={`
        fixed top-0 bottom-16 lg:bottom-0 right-0 z-50 lg:relative lg:left-0 lg:right-auto
        ${isCollapsed ? 'w-16' : 'w-72 sm:w-80 lg:w-64'} bg-background border-l lg:border-l-0 lg:border-r border-border
        transform transition-all duration-300 ease-in-out lg:transform-none
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        flex flex-col lg:h-dvh overflow-hidden pt-safe-top pb-safe-bottom
      `}>

        {/* ── Sidebar Header ──────────────────────────────────── */}
        <div className={`flex items-center border-b border-border ${
          isCollapsed
            ? 'justify-center px-1 py-2.5'
            : 'justify-between px-2 sm:px-4 py-2.5 sm:py-3'
        }`}>
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {selectedInstitute ? (
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <img
                    src={selectedInstitute.logo || surakshaLogoSidebar}
                    alt="logo"
                    className="h-6 w-6 object-contain"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                {selectedInstitute ? (
                  <p className="font-bold text-sm text-foreground truncate leading-tight">
                    {selectedInstitute.shortName || selectedInstitute.name}
                  </p>
                ) : (
                  <img
                    src={surakshaMainLogo}
                    alt="SurakshaLMS"
                    className="h-7 w-auto max-w-full object-contain"
                  />
                )}
                {selectedInstitute && (
                  <p className="text-[10px] text-muted-foreground truncate leading-tight">
                    {userRole}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-1 shrink-0">

            <Button
              variant="ghost" size="sm"
              onClick={() => window.innerWidth < 1024 ? onClose() : setIsCollapsed(!isCollapsed)}
              className="h-8 w-8 p-0 hover:bg-accent"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <X className="h-4 w-4 lg:hidden" />
              <Menu className="h-4 w-4 hidden lg:block" />
            </Button>
          </div>
        </div>

        {/* ── Context Bar ──────────────────────────────────────── */}
        {(showContextBar || childContextBar) && (
          <div className="px-3 py-2 bg-primary/5 border-b border-border/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-primary/70 uppercase tracking-wide">
                {childContextBar ? 'Viewing Child' : 'Current Selection'}
              </span>
              <button
                onClick={handleBackNavigation}
                className="p-1 rounded-lg hover:bg-primary/10 transition-colors"
                title="Go back"
              >
                <ArrowLeft className="h-3 w-3 text-primary/70" />
              </button>
            </div>
            <div className="space-y-0.5 text-[11px]">
              {childContextBar && (
                <div className="flex items-center gap-1.5 text-primary">
                  <Users className="h-3 w-3" />
                  <span className="font-medium truncate">
                    {(selectedChild as any)?.name || selectedChild?.user?.firstName || 'Child'}
                  </span>
                </div>
              )}
              {selectedOrganization && <div className="flex items-center gap-1.5 text-primary/80"><Building2 className="h-3 w-3" /><span className="truncate">{selectedOrganization.name}</span></div>}
              {selectedInstitute && <div className="flex items-center gap-1.5 text-primary/80"><Building2 className="h-3 w-3" /><span className="font-semibold truncate">{selectedInstitute.shortName || selectedInstitute.name}</span></div>}
              {selectedClass && <div className="flex items-center gap-1.5 text-primary/60"><School className="h-3 w-3" /><span className="truncate">{selectedClass.name}</span></div>}
              {selectedSubject && <div className="flex items-center gap-1.5 text-primary/60"><BookOpen className="h-3 w-3" /><span className="truncate">{selectedSubject.name}</span></div>}
            </div>
          </div>
        )}

        {/* ── Navigation ───────────────────────────────────────── */}
        <ScrollArea className="flex-1 px-2 py-2">



          <div className="space-y-0.5">
            {navGroups.map((group, idx) => (
              <React.Fragment key={`${group.id}-${idx}`}>
                {idx > 0 && !navGroups[idx - 1].alwaysFlat && !group.alwaysFlat && (
                  <div className="my-1 mx-2 border-t border-border/40" />
                )}
                <NavGroupSection
                  group={group}
                  isCollapsed={isCollapsed}
                  activePage={activePage}
                  onItemClick={handleItemClick}
                  filterFn={filterFn}
                />
              </React.Fragment>
            ))}
          </div>
        </ScrollArea>

        {/* ── Footer ───────────────────────────────────────────── */}
        <div className="lg:hidden px-3 py-2.5 border-t border-border">
          {/* User profile row — click avatar or name to open profile switcher */}
          <div className="flex items-center gap-2.5 mb-2">
            <button
              onClick={() => setProfileSwitcherOpen(true)}
              className="relative focus:outline-none active:scale-95 transition-transform shrink-0"
              aria-label="Switch profile"
            >
              <Avatar className="h-8 w-8 ring-1 ring-border cursor-pointer">
                {sidebarAvatarUrl && (
                  <AvatarImage src={sidebarAvatarUrl} alt={user?.name} className="object-cover" />
                )}
                <AvatarFallback className="bg-muted">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              {isViewingAsParent && selectedChild && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 border border-background" />
              )}
            </button>
            <button
              onClick={() => setProfileSwitcherOpen(true)}
              className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
            >
              <p className="text-xs font-semibold text-foreground truncate leading-tight">{user?.name}</p>
              <p className="text-[10px] text-muted-foreground truncate leading-tight">
                {isViewingAsParent && selectedChild ? `Viewing: ${selectedChild.name}` : userRole}
              </p>
            </button>
          </div>
          {/* Action buttons row */}
          <div className="flex gap-1.5">
            <Button
              variant="ghost" size="sm"
              onClick={() => setProfileSwitcherOpen(true)}
              className="flex-1 gap-1.5 text-xs rounded-xl hover:bg-muted/60"
              title="Switch profile"
            >
              <User className="h-3.5 w-3.5" />
              <span>Profiles</span>
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={handleLogout}
              className="flex-1 gap-1.5 text-xs hover:bg-destructive hover:text-destructive-foreground hover:border-destructive h-8 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Profile Switcher Sheet */}
      <ProfileSwitcherSheet open={profileSwitcherOpen} onOpenChange={setProfileSwitcherOpen} />
    </>
  );
};

// Helper: check if any item id in a list matches the active page
function hasActiveInGroup(ids: string[], activePage: string): boolean {
  return ids.includes(activePage);
}

export default Sidebar;
