import React, { useState, useEffect, useRef, Suspense } from 'react';
import AppLoadingScreen from '@/components/AppLoadingScreen';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useContextUrlSync, extractPageFromUrl } from '@/utils/pageNavigation';
import { stripPopupRouteFromPath } from '@/utils/popupRoutes';
import { useRouteContext } from '@/hooks/useRouteContext';
import { useMobilePermissions } from '@/hooks/useMobilePermissions';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, BookOpen, GraduationCap, User, Palette, Menu, X, ArrowLeft, Lock } from 'lucide-react';
// Layout components - always needed, keep static
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import ModalRouter from '@/components/ModalRouter';

// Lazy-loaded page components for code splitting
const Dashboard = React.lazy(() => import('@/components/Dashboard'));
const Users = React.lazy(() => import('@/components/Users'));
const Students = React.lazy(() => import('@/components/Students'));
const Teachers = React.lazy(() => import('@/components/Teachers'));
const Parents = React.lazy(() => import('@/components/Parents'));
const ChildAttendance = React.lazy(() => import('@/components/ChildAttendance'));
const ChildResults = React.lazy(() => import('@/components/ChildResults'));
const VerifyImage = React.lazy(() => import('@/components/VerifyImage'));

const Classes = React.lazy(() => import('@/components/Classes'));
const ClassSubjects = React.lazy(() => import('@/components/ClassSubjects'));
const Institutes = React.lazy(() => import('@/components/Institutes'));
const Attendance = React.lazy(() => import('@/components/Attendance'));
const NewAttendance = React.lazy(() => import('@/components/NewAttendance'));
const MyAttendance = React.lazy(() => import('@/components/MyAttendance'));

const AttendanceMarkers = React.lazy(() => import('@/components/AttendanceMarkers'));
const QRAttendance = React.lazy(() => import('@/components/QRAttendance'));
const RfidAttendance = React.lazy(() => import('@/pages/RFIDAttendance'));
const InstituteMarkAttendance = React.lazy(() => import('@/pages/InstituteMarkAttendance'));
const Lectures = React.lazy(() => import('@/components/Lectures'));
const LiveLectures = React.lazy(() => import('@/components/LiveLectures'));
const Homework = React.lazy(() => import('@/components/Homework'));
const Exams = React.lazy(() => import('@/components/Exams'));
const Results = React.lazy(() => import('@/components/Results'));
const Profile = React.lazy(() => import('@/components/Profile'));
const InstituteDetails = React.lazy(() => import('@/components/InstituteDetails'));
const Login = React.lazy(() => import('@/components/Login'));
const InstituteSelector = React.lazy(() => import('@/components/InstituteSelector'));
const ClassSelector = React.lazy(() => import('@/components/ClassSelector'));
const SubjectSelector = React.lazy(() => import('@/components/SubjectSelector'));
const ParentChildrenSelector = React.lazy(() => import('@/components/ParentChildrenSelector'));
const Organizations = React.lazy(() => import('@/components/Organizations'));
const Gallery = React.lazy(() => import('@/components/Gallery'));
const Settings = React.lazy(() => import('@/components/Settings'));
const Appearance = React.lazy(() => import('@/components/Appearance'));
const OrganizationHeader = React.lazy(() => import('@/components/OrganizationHeader'));
const OrganizationSelector = React.lazy(() => import('@/components/OrganizationSelector'));
const CreateOrganizationForm = React.lazy(() => import('@/components/forms/CreateOrganizationForm'));
const OrganizationManagement = React.lazy(() => import('@/components/OrganizationManagement'));
const OrganizationCourses = React.lazy(() => import('@/components/OrganizationCourses'));
const OrganizationLectures = React.lazy(() => import('@/components/OrganizationLectures'));
const TeacherStudents = React.lazy(() => import('@/components/TeacherStudents'));
const TeacherHomework = React.lazy(() => import('@/components/TeacherHomework'));
const TeacherExams = React.lazy(() => import('@/components/TeacherExams'));
const TeacherLectures = React.lazy(() => import('@/components/TeacherLectures'));
const StudentInstituteProfilePage = React.lazy(() => import('@/pages/StudentInstituteProfilePage'));
const StudentClassProfilePage = React.lazy(() => import('@/pages/StudentClassProfilePage'));
const StudentSubjectProfilePage = React.lazy(() => import('@/pages/StudentSubjectProfilePage'));
const InstituteLectures = React.lazy(() => import('@/components/InstituteLectures'));
const ClassLecturesPage = React.lazy(() => import('@/pages/ClassLecturesPage'));
const AttendanceMarkerSubjectSelector = React.lazy(() => import('@/components/AttendanceMarkerSubjectSelector'));
const SelectAttendanceMarkType = React.lazy(() => import('@/components/attendance/SelectAttendanceMarkType'));
const ManualClassAttendance = React.lazy(() => import('@/pages/ManualClassAttendance'));
const ClassAttendanceSessionsPage = React.lazy(() => import('@/pages/ClassAttendanceSessionsPage'));
const AttendanceMatrixView = React.lazy(() => import('@/pages/AttendanceMatrixPage').then(m => ({ default: m.AttendanceMatrixView })));
const CloseAttendancePage = React.lazy(() => import('@/components/admin-attendance/CloseAttendance'));
const UnverifiedStudents = React.lazy(() => import('@/components/UnverifiedStudents'));
const EnrollClass = React.lazy(() => import('@/components/EnrollClass'));
const EnrollSubject = React.lazy(() => import('@/components/EnrollSubject'));
const InstituteUsers = React.lazy(() => import('@/components/InstituteUsers'));
const SetupGuide = React.lazy(() => import('@/components/SetupGuide'));
const InstituteProfile = React.lazy(() => import('@/components/InstituteProfile'));
const InstituteSettingsPage = React.lazy(() => import('@/pages/InstituteSettingsPage'));
const StudentHomeworkSubmissions = React.lazy(() => import('@/components/StudentHomeworkSubmissions'));
const FreeLectures = React.lazy(() => import('@/components/FreeLectures'));
const StudyMaterials = React.lazy(() => import('@/components/StudyMaterials'));
const StructuredLectures = React.lazy(() => import('@/components/StructuredLectures'));
const SMS = React.lazy(() => import('@/components/SMS'));
const SMSHistory = React.lazy(() => import('@/pages/SMSHistory'));
const MyChildren = React.lazy(() => import('@/pages/MyChildren'));
const ChildDashboard = React.lazy(() => import('@/pages/ChildDashboard'));
const ChildResultsPage = React.lazy(() => import('@/pages/ChildResultsPage'));
const ChildAttendancePage = React.lazy(() => import('@/pages/ChildAttendancePage'));
const ChildTransportPage = React.lazy(() => import('@/pages/ChildTransportPage'));
const InstituteOrganizations = React.lazy(() => import('@/pages/InstituteOrganizations'));
const InstitutePayments = React.lazy(() => import('@/pages/InstitutePayments'));
const SubjectPayments = React.lazy(() => import('@/pages/SubjectPayments'));
const ClassPayments = React.lazy(() => import('@/pages/ClassPayments'));
const SubjectSubmissions = React.lazy(() => import('@/pages/SubjectSubmissions'));
const SubjectPaymentSubmissions = React.lazy(() => import('@/pages/SubjectPaymentSubmissions'));
const MySubmissions = React.lazy(() => import('@/pages/MySubmissions'));
const PendingSubmissions = React.lazy(() => import('@/pages/PendingSubmissions'));
const HomeworkSubmissions = React.lazy(() => import('@/pages/HomeworkSubmissions'));
const ExamResults = React.lazy(() => import('@/pages/ExamResults'));
const CreateExamResults = React.lazy(() => import('@/pages/CreateExamResults'));
const InstituteSubjects = React.lazy(() => import('@/pages/InstituteSubjects'));
const TeacherEnrollmentManagement = React.lazy(() => import('@/pages/TeacherEnrollmentManagement'));
const NotificationsPage = React.lazy(() => import('@/pages/NotificationsPage'));
const AllNotificationsPage = React.lazy(() => import('@/pages/AllNotificationsPage'));
const CalendarManagementPage = React.lazy(() => import('@/components/calendar/CalendarManagementPage'));
const AdminAttendancePage = React.lazy(() => import('@/components/admin-attendance/AdminAttendancePage'));
const LectureAttendanceReportPage = React.lazy(() => import('@/pages/LectureAttendanceReportPage'));
const LectureAttendanceLivePage = React.lazy(() => import('@/pages/LectureAttendanceLivePage'));
const LectureRecordingAttendancePage = React.lazy(() => import('@/pages/LectureRecordingAttendancePage'));
const StudentRecordingActivityPage = React.lazy(() => import('@/pages/StudentRecordingActivityPage'));
const CalendarMonthView = React.lazy(() => import('@/components/CalendarMonthView'));
const TodayDashboard = React.lazy(() => import('@/components/TodayDashboard'));
const ParentAttendanceDashboard = React.lazy(() => import('@/components/parent-attendance/ParentAttendanceDashboard'));
const ClassCalendarPage = React.lazy(() => import('@/pages/ClassCalendarPage'));
const DeviceManagement = React.lazy(() => import('@/pages/DeviceManagement'));
const Feedback = React.lazy(() => import('@/components/Feedback'));
const GlobalIdCardsPage = React.lazy(() => import('@/pages/GlobalIdCardsPage'));
const InstituteDesignsPage = React.lazy(() => import('@/pages/InstituteDesignsPage'));
const Payments = React.lazy(() => import('@/pages/Payments'));
const InstituteHouses = React.lazy(() => import('@/pages/InstituteHouses'));
const HouseDetail = React.lazy(() => import('@/pages/HouseDetail'));
const InstituteBillingPage = React.lazy(() => import('@/pages/InstituteBillingPage'));
const InstituteCreditsPage = React.lazy(() => import('@/pages/InstituteCreditsPage'));
const CollectPhysicalPayment = React.lazy(() => import('@/pages/CollectPhysicalPayment'));
const FinanceHubPage = React.lazy(() => import('@/pages/FinanceHubPage'));
const TeacherFinancePage = React.lazy(() => import('@/pages/TeacherFinancePage'));
const SubjectRecordingsPage = React.lazy(() => import('@/pages/SubjectRecordingsPage'));


interface AppContentProps {
  initialPage?: string;
}

const FeatureGatedPage: React.FC<{ featureKey: string; component: React.ReactNode }> = ({ featureKey, component }) => {
  const { isFeatureEnabled } = useFeatures();

  if (isFeatureEnabled(featureKey)) {
    return <>{component}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <Lock className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold">Feature Not Enabled</h2>
      <p className="text-muted-foreground mt-2 max-w-sm">
        This feature is not enabled for your institute. Please contact your institute administrator to enable this feature.
      </p>
    </div>
  );
};

const AppContent = ({ initialPage }: AppContentProps) => {
  const { user, login, isInitialized, selectedInstitute, selectedClass, selectedSubject, selectedChild, selectedOrganization, setSelectedOrganization, currentInstituteId, isViewingAsParent, setSelectedInstitute, loadUserInstitutes, validateUserToken } = useAuth();
  const { isTenantLogin, branding, isLoading: tenantLoading, loginMethod } = useTenant();
  const { navigateToPage, getPageFromPath } = useAppNavigation();
  const location = useLocation();
  const navigate = useNavigate();
  const [hasNavigatedAfterLogin, setHasNavigatedAfterLogin] = React.useState(false);
  const tenantAutoSelected = useRef(false);
  
  // 📱 Mobile permissions hook - handles permission prompts after login on mobile
  const { isRequesting: isRequestingPermissions, permissionStatus } = useMobilePermissions();
  
  // Sync URL context with AuthContext and validate access (403 if unauthorized)
  const { isValidating, instituteId: urlInstituteId } = useRouteContext();
  
  // Institute-specific role - always uses selectedInstitute.userRole
  const userRole = useInstituteRole();

  // ═══ Tenant auto-select institute ═══
  // Auto-select on SUBDOMAIN and CUSTOM_DOMAIN (both are 1:1 institute mappings).
  useEffect(() => {
    if ((loginMethod !== 'SUBDOMAIN' && loginMethod !== 'CUSTOM_DOMAIN') || !user || !branding?.id || tenantAutoSelected.current || selectedInstitute) return;

    const autoSelect = async () => {
      // Check user.institutes first, load if not available
      let institutes = user.institutes;
      if (!institutes || institutes.length === 0) {
        try {
          institutes = await loadUserInstitutes();
        } catch {
          // Mark as attempted so auto-navigate isn't blocked forever
          tenantAutoSelected.current = true;
          return;
        }
      }

      // Find the institute that matches the tenant branding
      const match = institutes?.find(inst => inst.id === branding.id);
      if (match) {
        tenantAutoSelected.current = true;
        setSelectedInstitute(match);
        setHasNavigatedAfterLogin(true);
        // Navigate to the institute dashboard
        navigate(`/institute/${match.id}/dashboard`, { replace: true });
      } else {
        // User doesn't belong to this tenant's institute — let them pick normally
        tenantAutoSelected.current = true;
        setHasNavigatedAfterLogin(true);
        navigate('/dashboard', { replace: true });
      }
    };

    autoSelect();
  }, [loginMethod, user, branding, selectedInstitute, setSelectedInstitute, loadUserInstitutes, navigate]);

  // ═══ Tenant institute lockdown ═══
  // On a subdomain or custom domain, the user may only access the matching institute.
  // Block any attempt to navigate to a different institute URL.
  // Also redirect /dashboard and /select-institute back to the institute dashboard.
  useEffect(() => {
    if ((loginMethod !== 'SUBDOMAIN' && loginMethod !== 'CUSTOM_DOMAIN') || !user || !branding?.id) return;

    const path = location.pathname;

    // Block wrong-institute URL (e.g. user types /institute/102 on subdomain for 101)
    if (urlInstituteId && urlInstituteId !== branding.id) {
      navigate(`/institute/${branding.id}/dashboard`, { replace: true });
      return;
    }

    // Redirect institute-selector pages back to the subdomain's institute
    if (
      tenantAutoSelected.current &&
      (path === '/dashboard' || path === '/select-institute' || path === '/' || path === '/my')
    ) {
      navigate(`/institute/${branding.id}/dashboard`, { replace: true });
    }
  }, [loginMethod, user, branding?.id, urlInstituteId, location.pathname, navigate]);

  // Derive current page from URL pathname
  const currentPage = React.useMemo(() => {
    return extractPageFromUrl(location.pathname);
  }, [location.pathname]);
  
  // Check for nested route patterns that need direct component rendering
  const nestedRouteComponent = React.useMemo(() => {
    const path = stripPopupRouteFromPath(location.pathname);
    
    // student/:id/profile
    if (/\/student\/[^\/]+\/profile$/.test(path)) {
      return 'student-profile';
    }
    
    // homework/:id/submissions
    if (/\/homework\/[^\/]+\/submissions/.test(path)) {
      return 'homework-submissions-view';
    }
    // exam/:id/results
    if (/\/exam\/[^\/]+\/results$/.test(path)) {
      return 'exam-results-view';
    }
    // exam/:id/create-results
    if (/\/exam\/[^\/]+\/create-results/.test(path)) {
      return 'exam-create-results';
    }
    // child/:id/select-institute - Parent selecting institute for child
    if (/\/child\/[^\/]+\/select-institute/.test(path)) {
      return 'child-select-institute';
    }
    // child/:id/select-class - Parent selecting class for child
    if (/\/child\/[^\/]+\/select-class/.test(path)) {
      return 'child-select-class';
    }
    // child/:id/select-subject - Parent selecting subject for child
    if (/\/child\/[^\/]+\/select-subject/.test(path)) {
      return 'child-select-subject';
    }
    // child/:id/dashboard - Child dashboard after selecting institute
    if (/\/child\/[^\/]+\/dashboard/.test(path)) {
      return 'child-dashboard';
    }
    // child/:id/child-results
    if (/\/child\/[^\/]+\/child-results/.test(path)) {
      return 'child-results';
    }
    // child/:id/child-attendance or child/:id/attendance
    if (/\/child\/[^\/]+\/(child-)?attendance/.test(path)) {
      return 'child-attendance';
    }
    // child/:id/child-transport
    if (/\/child\/[^\/]+\/child-transport/.test(path)) {
      return 'child-transport';
    }
    // child/:id/homework - Parent viewing child's homework
    if (/\/child\/[^\/]+\/homework/.test(path)) {
      return 'child-homework';
    }
    // child/:id/lectures - Parent viewing child's lectures
    if (/\/child\/[^\/]+\/lectures/.test(path)) {
      return 'child-lectures';
    }
    // child/:id/exams - Parent viewing child's exams
    if (/\/child\/[^\/]+\/exams/.test(path)) {
      return 'child-exams';
    }
    // child/:id/results - Parent viewing child's results
    if (/\/child\/[^\/]+\/results/.test(path)) {
      return 'child-results-page';
    }
    // child/:id/subject-payments - Parent viewing child's subject payments
    if (/\/child\/[^\/]+\/subject-payments/.test(path)) {
      return 'child-subject-payments';
    }
    // child/:id/subject-pay-submission - Parent viewing child's payment submissions
    if (/\/child\/[^\/]+\/subject-pay-submission/.test(path)) {
      return 'child-subject-pay-submission';
    }
    // child/:id/my-submissions - Parent viewing child's fee submissions
    if (/\/child\/[^\/]+\/my-submissions/.test(path)) {
      return 'child-my-submissions';
    }
    // houses/:houseId - House detail page
    if (/\/houses\/[^\/]+/.test(path)) {
      return 'house-detail-view';
    }
    // institute/:id/class/:classId/my-submissions - Student viewing their class payment submissions
    if (/\/institute\/[^\/]+\/class\/[^\/]+\/my-submissions$/.test(path)) {
      return 'class-my-submissions';
    }
    return null;
  }, [location.pathname]);
  
  // 🔗 Sync URL with context automatically
  useContextUrlSync(currentPage);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [navHidden, setNavHidden] = React.useState(false);
  const mainScrollRef = React.useRef<HTMLElement>(null);
  const lastScrollYRef = React.useRef(0);
  React.useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const current = el.scrollTop;
      const delta = current - lastScrollYRef.current;
      if (delta > 10) setNavHidden(true);
      else if (delta < -10) setNavHidden(false);
      lastScrollYRef.current = current;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Check if we're loading context from URL (direct navigation)
  const isLoadingContextFromUrl = urlInstituteId && !selectedInstitute && isValidating;

  // If we were redirected to login, React Router stores the original destination in location.state.from
  const intendedPath = (location.state as any)?.from as string | undefined;
  
  // Auto-navigate after login
  React.useEffect(() => {
    // Don't auto-navigate if we have an institute ID in URL (direct navigation)
    if (urlInstituteId) {
      return;
    }

    // On subdomain, wait for the auto-select effect to handle navigation
    // instead of redirecting to /dashboard prematurely. This prevents the double
    // redirect: / → /dashboard → /institute/{id}/dashboard
    // Custom domains do NOT auto-select, so skip this guard for them.
    if (loginMethod === 'SUBDOMAIN' && branding?.id && !tenantAutoSelected.current) {
      return;
    }

    // If ProtectedRoute redirected here from a deep link, go back to that page after login.
    // intendedPath is set by ProtectedRoute via location.state.from.
    // On logout we navigate to '/' with state: null, so intendedPath is undefined → goes to dashboard.
    if (user && !hasNavigatedAfterLogin && intendedPath && intendedPath !== '/' && intendedPath !== location.pathname) {
      setHasNavigatedAfterLogin(true);
      navigate(intendedPath, { replace: true, state: {} });
      return;
    }

    // On browser reload, context (selectedInstitute, selectedChild, etc.) is cleared.
    // Redirect to dashboard so the user can re-select their context instead of
    // landing on a broken/empty page.
    const navType = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
    const isPageReload = navType === 'reload';

    // Default: go to dashboard after login OR after a page reload
    if (user && !hasNavigatedAfterLogin && (location.pathname === '/' || location.pathname === '' || isPageReload)) {
      setHasNavigatedAfterLogin(true);
      navigate('/dashboard', { replace: true, state: {} });
    }
  }, [user, hasNavigatedAfterLogin, intendedPath, location.pathname, navigate, urlInstituteId, loginMethod, branding?.id]);
  
  // Reset the flag when user logs out and navigate to root
  // CRITICAL: Guard with isInitialized to prevent navigating to '/' during auth
  // initialization — on page reload, user is null momentarily while the token
  // is being validated. Without this guard, the URL (e.g. /institute/123/dashboard)
  // would be destroyed before auth completes, breaking subdomain page reloads.
  React.useEffect(() => {
    if (!user && isInitialized) {
      setHasNavigatedAfterLogin(false);
      // Clear any saved redirect path so after login we always go to dashboard.
      sessionStorage.removeItem('redirectAfterLogin');
      // Always navigate to '/' with state: null.
      // This is critical: ProtectedRoute may have already navigated to '/' with
      // state.from set (when the user was on a protected page and logged out).
      // Without this call the state.from lingers and the login effect would
      // redirect back to the protected page after re-login.
      navigate('/', { replace: true, state: null });
    }
  }, [user, isInitialized, navigate]);
  const [showCreateOrgForm, setShowCreateOrgForm] = useState(false);
  const [organizationCurrentPage, setOrganizationCurrentPage] = useState('organizations');

  const setCurrentPage = (page: string) => {
    navigateToPage(page);
  };

  const handleMenuClick = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSidebarClose = () => {
    setIsSidebarOpen(false);
  };

  const handleOrganizationSelect = (organization: any) => {

    setSelectedOrganization(organization);
    
    // Switch to using baseUrl2 for organization-specific API calls
    apiClient.setUseBaseUrl2(true);
    
    setCurrentPage('dashboard');
  };

  const handleBackToOrganizationSelector = () => {
    setCurrentPage('organization-selector');
  };

  const handleBackToMain = () => {
    setOrganizationCurrentPage('organizations');
    setSelectedOrganization(null);
    
    // Switch back to using baseUrl for main API calls
    apiClient.setUseBaseUrl2(false);
    
    navigateToPage('dashboard');
  };

  const handleCreateOrganization = () => {
    setShowCreateOrgForm(true);
  };

  const handleCreateOrganizationSuccess = (organization: any) => {

    setShowCreateOrgForm(false);
    setCurrentPage('organization-selector');
  };

  const handleCreateOrganizationCancel = () => {
    setShowCreateOrgForm(false);
  };

  // Organization-specific navigation component
  const OrganizationNavigation = () => {
    const isOrganizationManager = userRole === 'OrganizationManager';
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    const navigationItems = [
      {
        id: 'organizations',
        title: 'Select Organizations',
        description: 'Browse and manage organizations',
        icon: Building2,
        visible: true
      },
      {
        id: 'courses',
        title: 'Courses',
        description: 'Manage course content',
        icon: BookOpen,
        visible: isOrganizationManager
      },
      {
        id: 'lectures',
        title: 'Lectures',
        description: 'Schedule and view lectures',
        icon: GraduationCap,
        visible: isOrganizationManager
      },
      {
        id: 'profile',
        title: 'Profile',
        description: 'Manage your profile',
        icon: User,
        visible: true
      },
      {
        id: 'appearance',
        title: 'Appearance',
        description: 'Customize app appearance',
        icon: Palette,
        visible: true
      }
    ];

    const handleNavigation = (pageId: string) => {
      setOrganizationCurrentPage(pageId);
      setIsSidebarOpen(false); // Close mobile sidebar after navigation
    };
    
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Mobile Header */}
        <div className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">Organization Portal</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleBackToMain}>
                Back
              </Button>
            </div>
          </div>
        </div>

        <div className="flex w-full min-h-screen">
          {/* Mobile Overlay */}
          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Organization Sidebar */}
          <div className={`
            fixed inset-y-0 left-0 z-50 md:relative
            w-72 sm:w-80 md:w-64 lg:w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
            transform transition-transform duration-300 ease-in-out md:transform-none
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            flex flex-col h-dvh
            overflow-hidden
          `}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
              <div className="flex items-center space-x-2 min-w-0">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
                <span className="font-bold text-base sm:text-lg text-foreground truncate">
                  Organization
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSidebarOpen(false)}
                  className="h-8 w-8 p-0 hover:bg-muted"
                  aria-label="Close Sidebar"
                >
                  <X className="h-4 w-4 md:hidden" />
                  <Menu className="h-4 w-4 hidden md:block" />
                </Button>
              </div>
            </div>

            {/* Context Info */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  Management Hub
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToMain}
                  className="h-6 w-6 p-0 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800"
                  aria-label="Back to Main"
                >
                  <ArrowLeft className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                <span className="font-medium">Module:</span> 
                <span className="ml-1 truncate">Organization System</span>
              </div>
            </div>

            {/* Navigation */}
            <ScrollArea className="flex-1 px-2 sm:px-3 py-3 sm:py-4">
              <div className="space-y-2">
                {/* Main navigation items */}
                <div className="mb-4 sm:mb-6">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
                    Quick Access
                  </h3>
                  <div className="space-y-1">
                    {navigationItems.filter(item => item.visible).map((item) => (
                      <Button
                        key={item.id}
                        variant={organizationCurrentPage === item.id ? "secondary" : "ghost"}
                        className={`w-full justify-start h-9 sm:h-10 px-3 text-sm ${
                          organizationCurrentPage === item.id 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-r-2 border-blue-500' 
                            : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                        }`}
                        onClick={() => handleNavigation(item.id)}
                      >
                        <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                        {item.title}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToMain}
                className="w-full flex items-center justify-center gap-2 text-sm hover:bg-muted h-8 sm:h-9"
              >
                <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="text-xs sm:text-sm">Back to Main</span>
              </Button>
            </div>
          </div>
          
          {/* Organization Content */}
          <div className="flex-1 overflow-auto">
            {/* Content Wrapper with responsive padding */}
            <div className="p-4 sm:p-6 lg:p-8 max-w-full">
              {organizationCurrentPage === 'organizations' && (
                <OrganizationManagement
                  userRole={userRole || 'Student'}
                  userPermissions={undefined}
                  currentInstituteId={currentInstituteId || undefined}
                />
              )}
              {organizationCurrentPage === 'courses' && isOrganizationManager && (
                <OrganizationCourses />
              )}
              {organizationCurrentPage === 'lectures' && isOrganizationManager && (
                <OrganizationLectures />
              )}
              {organizationCurrentPage === 'profile' && <Profile />}
              {organizationCurrentPage === 'appearance' && <Appearance />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderComponent = () => {
    // Helper: case-insensitive check for tuition_institute type
    const isNotTuitionInstitute = (selectedInstitute?.type || '').toLowerCase() !== 'tuition_institute';

    // On tenant domains (subdomain or custom domain), institute selection is forbidden —
    // the correct institute is auto-selected. Show loading while that completes.
    const tenantInstituteLoading = () => (
      <AppLoadingScreen message="Loading institute..." iconUrl={branding?.logoUrl} />
    );
    // CRITICAL: Show branded loading state when loading context from direct URL navigation
    if (isLoadingContextFromUrl) {
      return <AppLoadingScreen message="Loading your data..." iconUrl={selectedInstitute?.loadingGifUrl || selectedInstitute?.logo || branding?.logoUrl} />;
    }

    // CRITICAL: Global pages that should ALWAYS render regardless of role/institute/child selection
    if (currentPage === 'feedback') return <Feedback />;
    if (currentPage === 'settings') return <Settings />;
    if (currentPage === 'all-notifications') return <AllNotificationsPage />;
    if (currentPage === 'profile') return <Profile />;
    if (currentPage === 'appearance') return <Appearance />;
    if (currentPage === 'id-cards') return <GlobalIdCardsPage />;
    if (currentPage === 'system-payment' || currentPage === 'system-payments') return <Payments />;
    
    // CRITICAL: Handle parent viewing child routes FIRST - regardless of user role
    // When isViewingAsParent is true and child is selected, ONLY allowed child pages render.
    // Any unrecognised route falls back to Dashboard — institute-admin pages must never
    // be reachable while in child-viewing mode.
    if (isViewingAsParent && selectedChild) {
      if (nestedRouteComponent) {
        if (nestedRouteComponent === 'child-select-institute') {
          return isTenantLogin ? tenantInstituteLoading() : <InstituteSelector useChildId={true} />;
        }
        if (nestedRouteComponent === 'child-select-class') return <ClassSelector />;
        if (nestedRouteComponent === 'child-select-subject') return <SubjectSelector />;
        if (nestedRouteComponent === 'child-dashboard') return <Dashboard />;
        if (nestedRouteComponent === 'child-homework') return <Homework />;
        if (nestedRouteComponent === 'child-lectures') return <Lectures />;
        if (nestedRouteComponent === 'child-exams') return <Exams />;
        if (nestedRouteComponent === 'child-results-page') return <Results />;
        if (nestedRouteComponent === 'child-subject-payments') return <Dashboard />;
        if (nestedRouteComponent === 'child-subject-pay-submission') return <Dashboard />;
        if (nestedRouteComponent === 'child-my-submissions') return <MySubmissions />;
        if (nestedRouteComponent === 'child-results') return <ChildResults />;
        if (nestedRouteComponent === 'child-attendance') return <ChildAttendancePage />;
        if (nestedRouteComponent === 'child-transport') return <ChildTransportPage />;
        // Unknown nested route in child-viewing mode — deny
        return <Dashboard />;
      }

      // No nested route component — only allow safe global pages already handled above
      // plus child-specific currentPage values. Block institute-admin pages entirely.
      const allowedChildPages = new Set([
        'dashboard', 'feedback', 'profile', 'appearance', 'settings',
        'all-notifications', 'notifications', 'institute-notifications',
        'calendar-view', 'today-dashboard',
        'homework', 'homework-submissions', 'exams', 'results', 'lectures',
        'institute-payments', 'class-payments', 'my-submissions',
        'child-attendance', 'child-results', 'child-transport',
        'parent-attendance', 'my-children', 'parents',
        'select-institute', 'select-class', 'select-subject',
      ]);
      if (!allowedChildPages.has(currentPage)) {
        return <Dashboard />;
      }
    }

    // Non-parent-viewing child routes (student logged in directly, selectedChild set by URL)
    if (selectedChild && nestedRouteComponent) {
      if (nestedRouteComponent === 'child-subject-payments') return <Dashboard />;
      if (nestedRouteComponent === 'child-subject-pay-submission') return <Dashboard />;
      if (nestedRouteComponent === 'child-my-submissions') return <MySubmissions />;
      if (nestedRouteComponent === 'child-results') return <ChildResults />;
      if (nestedRouteComponent === 'child-attendance') return <ChildAttendancePage />;
      if (nestedRouteComponent === 'child-transport') return <ChildTransportPage />;
    }
    
    // Handle organization-related pages
    if (currentPage === 'organizations') {
      if (showCreateOrgForm) {
        return (
          <CreateOrganizationForm
            onSuccess={handleCreateOrganizationSuccess}
            onCancel={handleCreateOrganizationCancel}
          />
        );
      }
      
      if (!selectedOrganization) {
        return (
          <OrganizationSelector
            onOrganizationSelect={handleOrganizationSelect}
            onBack={handleBackToMain}
            onCreateOrganization={handleCreateOrganization}
            userPermissions={undefined}
          />
        );
      }
    }

    if (currentPage === 'organization-selector') {
      return (
        <OrganizationSelector
          onOrganizationSelect={handleOrganizationSelect}
          onBack={handleBackToMain}
          onCreateOrganization={handleCreateOrganization}
          userPermissions={undefined}
        />
      );
    }

    // For Organization Manager - show organizations list or organization-specific dashboard
    if (userRole === 'OrganizationManager') {
      if (!selectedOrganization && currentPage !== 'organizations') {
        return <Organizations />;
      }

      // Add Organization Header for specific sections
      const shouldShowOrgHeader = ['dashboard', 'students', 'lectures', 'gallery'].includes(currentPage);
      
      const getPageTitle = () => {
        switch (currentPage) {
          case 'dashboard': return 'Dashboard';
          case 'students': return 'Students';
          case 'lectures': return 'Lectures';
          case 'gallery': return 'Gallery';
          default: return 'Management';
        }
      };

      const renderWithHeader = (component: React.ReactNode) => (
        <>
          {shouldShowOrgHeader && <OrganizationHeader title={getPageTitle()} />}
          {component}
        </>
      );

      switch (currentPage) {
        case 'organizations':
          return <Organizations />;
        case 'dashboard':
          return renderWithHeader(<Dashboard />);
        case 'students':
          return renderWithHeader(<Students />);
        case 'lectures':
          return renderWithHeader(<Lectures />);
        case 'gallery':
          return renderWithHeader(<Gallery />);
        case 'appearance':
          return <Appearance />;
        case 'profile':
          return <Profile />;
        case 'settings':
          return <Settings />;
        case 'feedback':
          return <Feedback />;
        case 'all-notifications':
          return <AllNotificationsPage />;
        case 'notifications':
        case 'institute-notifications':
          return <NotificationsPage />;
        default:
          return <Dashboard />;
      }
    }

    // For Student role - simplified interface
    if (userRole === 'Student') {
      // Handle nested routes first for Student role
      if (nestedRouteComponent === 'student-profile') {
        if (selectedSubject) return <StudentSubjectProfilePage />;
        if (selectedClass) return <StudentClassProfilePage />;
        return <StudentInstituteProfilePage />;
      }
      if (nestedRouteComponent === 'homework-submissions-view') return <FeatureGatedPage featureKey="homework" component={<HomeworkSubmissions />} />;
      if (nestedRouteComponent === 'class-my-submissions') return <MySubmissions />;
      if (nestedRouteComponent === 'exam-results-view') return <FeatureGatedPage featureKey="exams" component={<ExamResults />} />;
      if (nestedRouteComponent === 'house-detail-view' && isNotTuitionInstitute) return <FeatureGatedPage featureKey="houses" component={<HouseDetail />} />;
      
      if (!selectedInstitute && user.institutes.length === 1) {
        // Auto-select the only institute available
        // This should be handled by the auth context
      }
      
      // Only redirect to InstituteSelector if no institute AND not loading from URL
      if (!selectedInstitute && !urlInstituteId && currentPage !== 'institutes' && currentPage !== 'select-institute' && currentPage !== 'settings' && currentPage !== 'appearance' && currentPage !== 'all-notifications' && currentPage !== 'notifications' && currentPage !== 'dashboard' && currentPage !== 'feedback') {
        return isTenantLogin ? tenantInstituteLoading() : <InstituteSelector />;
      }

      switch (currentPage) {
        case 'dashboard':
          return <Dashboard />;
        case 'select-class':
          return <ClassSelector />;
        case 'select-subject':
          return <SubjectSelector />;
        case 'enroll-class':
          return <EnrollClass />;
        case 'enroll-subject':
          return <EnrollSubject />;
        case 'my-attendance':
          return <FeatureGatedPage featureKey="my-attendance" component={<MyAttendance />} />;
        case 'students':
          return <FeatureGatedPage featureKey="students" component={<Students />} />;
        case 'lectures':
          return <FeatureGatedPage featureKey="lectures" component={<Lectures />} />;
        case 'free-lectures':
          return <FeatureGatedPage featureKey="free-lectures" component={<FreeLectures />} />;
        case 'homework':
          return <FeatureGatedPage featureKey="homework" component={<Homework />} />;
        case 'homework-submissions':
          return <FeatureGatedPage featureKey="homework" component={<StudentHomeworkSubmissions />} />;
        case 'exams':
          return <FeatureGatedPage featureKey="exams" component={<Exams />} />;
        case 'study-materials':
          return <FeatureGatedPage featureKey="study-materials" component={<StudyMaterials />} />;
        case 'subject-recordings':
          return <FeatureGatedPage featureKey="subject-recordings" component={<SubjectRecordingsPage />} />;
        case 'results':
          return <FeatureGatedPage featureKey="exams" component={<Results />} />;
        case 'institute-lectures':
          return <FeatureGatedPage featureKey="institute-lectures" component={<InstituteLectures />} />;
        case 'profile':
          return <Profile />;
        case 'select-institute':
          return isTenantLogin ? tenantInstituteLoading() : <InstituteSelector />;
        case 'appearance':
          return <Appearance />;
        case 'institute-profile':
          return <InstituteProfile />;
        case 'organizations':
          return <FeatureGatedPage featureKey="organizations" component={<Organizations />} />;
        case 'institute-payments':
          return <FeatureGatedPage featureKey="institute-payments" component={<InstitutePayments />} />;
        case 'class-payments':
          return <FeatureGatedPage featureKey="class-payments" component={<ClassPayments />} />;
        case 'pending-submissions':
          return <FeatureGatedPage featureKey="pending-submissions" component={<PendingSubmissions />} />;
        // Subject-level payments disabled
        case 'subject-payments':
        case 'subject-pay-submission':
          return <Dashboard />;
        case 'collect-physical-payment':
          return <FeatureGatedPage featureKey="collect-physical-payment" component={<CollectPhysicalPayment />} />;
        case 'my-children':
          return <MyChildren />;
        case 'all-notifications':
          return <AllNotificationsPage />;
        case 'notifications':
        case 'institute-notifications':
          return <FeatureGatedPage featureKey="institute-notifications" component={<NotificationsPage />} />;
        case 'calendar-view':
          return <FeatureGatedPage featureKey="calendar-view" component={<CalendarMonthView />} />;
        case 'today-dashboard':
          return <TodayDashboard />;
        case 'settings':
          return <Settings />;
        case 'feedback':
          return <Feedback />;
        case 'houses':
          return isNotTuitionInstitute ? <FeatureGatedPage featureKey="houses" component={<InstituteHouses />} /> : <Dashboard />;
        case 'class-lectures':
          return <FeatureGatedPage featureKey="class-lectures" component={<ClassLecturesPage />} />;
        case 'lecture-live-attendance':
          return <FeatureGatedPage featureKey="lecture-live-attendance" component={<LectureAttendanceLivePage />} />;
        case 'lecture-recording-attendance':
          return <FeatureGatedPage featureKey="lecture-recording-attendance" component={<LectureRecordingAttendancePage />} />;
        case 'lecture-recording-student':
          return <StudentRecordingActivityPage />;
        default:
          return <Dashboard />;
      }
    }

    // For Parent role
    if (userRole === 'Parent') {
      // Handle nested child routes first
      if (nestedRouteComponent === 'child-results') return <ChildResults />;
      if (nestedRouteComponent === 'child-attendance') return <ChildAttendancePage />;
      if (nestedRouteComponent === 'child-transport') return <ChildTransportPage />;
      if (nestedRouteComponent === 'house-detail-view' && isNotTuitionInstitute) return <FeatureGatedPage featureKey="houses" component={<HouseDetail />} />;

      if (currentPage === 'parents') {
        return <ParentChildrenSelector />;
      }

      if (!selectedChild && currentPage !== 'parents' && currentPage !== 'profile' && currentPage !== 'appearance' && currentPage !== 'settings' && currentPage !== 'feedback' && currentPage !== 'all-notifications' && currentPage !== 'notifications') {
        return <ParentChildrenSelector />;
      }

      // For Parent role, when "Select Institute" is clicked (dashboard page),
      // use InstituteSelector but pass the selected child's ID
      if (currentPage === 'dashboard' && selectedChild && !selectedInstitute && !urlInstituteId) {
        return isTenantLogin ? tenantInstituteLoading() : <InstituteSelector useChildId={true} />;
      }

      switch (currentPage) {
        case 'dashboard':
          return <Dashboard />;
        case 'attendance':
          return <FeatureGatedPage featureKey="daily-attendance" component={<Attendance />} />;
        case 'homework':
          return <FeatureGatedPage featureKey="homework" component={<Homework />} />;
        case 'homework-submissions':
          return <FeatureGatedPage featureKey="homework" component={<StudentHomeworkSubmissions />} />;
        case 'results':
          return <FeatureGatedPage featureKey="exams" component={<Results />} />;
        case 'exams':
          return <FeatureGatedPage featureKey="exams" component={<Exams />} />;
        case 'institute-payments':
          return <FeatureGatedPage featureKey="institute-payments" component={<InstitutePayments />} />;
        case 'class-payments':
          return <FeatureGatedPage featureKey="class-payments" component={<ClassPayments />} />;
        case 'my-submissions':
          return <MySubmissions />;
        // Subject-level payments disabled
        case 'subject-payments':
        case 'subject-pay-submission':
          return <Dashboard />;
        case 'profile':
          return <Profile />;
        case 'child-attendance':
          return <ChildAttendance />;
        case 'child-results':
          return <ChildResults />;
        case 'child-transport':
          return <ChildTransportPage />;
        case 'my-children':
          return <ParentChildrenSelector />;
        case 'parents':
          return <ParentChildrenSelector />;
        case 'appearance':
          return <Appearance />;
        case 'settings':
          return <Settings />;
        case 'feedback':
          return <Feedback />;
        case 'all-notifications':
          return <AllNotificationsPage />;
        case 'notifications':
        case 'institute-notifications':
          return <FeatureGatedPage featureKey="institute-notifications" component={<NotificationsPage />} />;
        case 'parent-attendance':
          return <ParentAttendanceDashboard />;
        case 'calendar-view':
          return <FeatureGatedPage featureKey="calendar-view" component={<CalendarMonthView />} />;
        case 'today-dashboard':
          return <TodayDashboard />;
        case 'select-institute':
          return isTenantLogin ? tenantInstituteLoading() : <InstituteSelector useChildId={true} />;
        case 'select-class':
          return <ClassSelector />;
        case 'select-subject':
          return <SubjectSelector />;
        case 'houses':
          return isNotTuitionInstitute ? <FeatureGatedPage featureKey="houses" component={<InstituteHouses />} /> : <Dashboard />;
        default:
          return <ParentChildrenSelector />;
      }
    }

    // For Teacher role
    if (userRole === 'Teacher') {
      // Only redirect to InstituteSelector if no institute AND not loading from URL
      if (!selectedInstitute && !urlInstituteId && currentPage !== 'institutes' && currentPage !== 'select-institute' && currentPage !== 'settings' && currentPage !== 'appearance' && currentPage !== 'all-notifications' && currentPage !== 'notifications' && currentPage !== 'dashboard' && currentPage !== 'feedback') {
        return isTenantLogin ? tenantInstituteLoading() : <InstituteSelector />;
      }

      if (currentPage === 'select-class') {
        return <ClassSelector />;
      }

      if (currentPage === 'select-subject') {
        return <SubjectSelector />;
      }

      const classRequiredPages: string[] = [];
      if (selectedInstitute && !selectedClass && classRequiredPages.includes(currentPage)) {
        return <ClassSelector />;
      }

      // 'lectures' no longer requires a subject — class-level lectures work without one
      const subjectRequiredPages: string[] = [];
      if (selectedClass && !selectedSubject && subjectRequiredPages.includes(currentPage)) {
        return <SubjectSelector />;
      }

      // Handle nested routes first
      if (nestedRouteComponent === 'student-profile') {
        if (selectedSubject) return <StudentSubjectProfilePage />;
        if (selectedClass) return <StudentClassProfilePage />;
        return <StudentInstituteProfilePage />;
      }
      if (nestedRouteComponent === 'homework-submissions-view') return <FeatureGatedPage featureKey="homework" component={<HomeworkSubmissions />} />;
      if (nestedRouteComponent === 'class-my-submissions') return <MySubmissions />;
      if (nestedRouteComponent === 'exam-results-view') return <FeatureGatedPage featureKey="exams" component={<ExamResults />} />;
      if (nestedRouteComponent === 'exam-create-results') return <FeatureGatedPage featureKey="exams" component={<CreateExamResults />} />;
      if (nestedRouteComponent === 'house-detail-view' && isNotTuitionInstitute) return <FeatureGatedPage featureKey="houses" component={<HouseDetail />} />;

      switch (currentPage) {
        case 'dashboard':
          return <Dashboard />;
        case 'students':
          return <FeatureGatedPage featureKey="students" component={<Students />} />;
        case 'unverified-students':
          return <FeatureGatedPage featureKey="unverified-students" component={<UnverifiedStudents />} />;
        case 'parents':
          return <FeatureGatedPage featureKey="parents" component={<Parents />} />;
        case 'classes':
          return <FeatureGatedPage featureKey="classes" component={<Classes />} />;
        case 'subjects':
        case 'institute-subjects':
          return <FeatureGatedPage featureKey="institute-subjects" component={<InstituteSubjects />} />;
        case 'class-subjects':
          return <FeatureGatedPage featureKey="class-subjects" component={<ClassSubjects />} />;
        case 'select-institute':
          return isTenantLogin ? tenantInstituteLoading() : <InstituteSelector />;
        case 'attendance':
        case 'daily-attendance':
          return <FeatureGatedPage featureKey="daily-attendance" component={<Attendance />} />;
        case 'my-attendance':
          return <FeatureGatedPage featureKey="my-attendance" component={<MyAttendance />} />;
        case 'rfid-attendance':
        case 'rfid':
          return <FeatureGatedPage featureKey="rfid-attendance" component={<RfidAttendance />} />;
        case 'select-attendance-mark-type':
          return <FeatureGatedPage featureKey="select-attendance-mark-type" component={<SelectAttendanceMarkType />} />;
        case 'manual-class-attendance':
          return <ManualClassAttendance />;
        case 'class-attendance-sessions':
          return <ClassAttendanceSessionsPage />;
        case 'attendance-matrix':
          return <AttendanceMatrixView />;
        case 'close-attendance':
          return <CloseAttendancePage />;
        case 'institute-mark-attendance':
          return <InstituteMarkAttendance />;
        case 'lectures':
          return <FeatureGatedPage featureKey="lectures" component={<Lectures />} />;
        case 'class-lectures':
          return <FeatureGatedPage featureKey="class-lectures" component={<ClassLecturesPage />} />;
        case 'lecture-live-attendance':
          return <FeatureGatedPage featureKey="lecture-live-attendance" component={<LectureAttendanceLivePage />} />;
        case 'lecture-recording-attendance':
          return <FeatureGatedPage featureKey="lecture-recording-attendance" component={<LectureRecordingAttendancePage />} />;
        case 'lecture-recording-student':
          return <StudentRecordingActivityPage />;
        case 'institute-lectures':
          return <FeatureGatedPage featureKey="institute-lectures" component={<InstituteLectures />} />;
        case 'free-lectures':
          return <FeatureGatedPage featureKey="free-lectures" component={<FreeLectures />} />;
        case 'structured-lectures':
          return <FeatureGatedPage featureKey="structured-lectures" component={<StructuredLectures />} />;
        case 'live-lectures':
          return <LiveLectures />;
        case 'homework':
          return <FeatureGatedPage featureKey="homework" component={<Homework />} />;
        case 'homework-submissions':
          return <FeatureGatedPage featureKey="homework" component={<StudentHomeworkSubmissions />} />;
        case 'study-materials':
          return <FeatureGatedPage featureKey="study-materials" component={<StudyMaterials />} />;
        case 'subject-recordings':
          return <FeatureGatedPage featureKey="subject-recordings" component={<SubjectRecordingsPage />} />;
        case 'exams':
          return <FeatureGatedPage featureKey="exams" component={<Exams />} />;
        case 'results':
          return <FeatureGatedPage featureKey="exams" component={<Results />} />;
        case 'profile':
          return <Profile />;
        case 'appearance':
          return <Appearance />;
        case 'institute-profile':
          return <InstituteProfile />;
        case 'institute-billing':
          return <FeatureGatedPage featureKey="institute-billing" component={<InstituteBillingPage />} />;
        case 'institute-credits':
          return <FeatureGatedPage featureKey="institute-credits" component={<InstituteCreditsPage />} />;
        case 'institute-payments':
          return <FeatureGatedPage featureKey="institute-payments" component={<InstitutePayments />} />;
        case 'class-payments':
          return <FeatureGatedPage featureKey="class-payments" component={<ClassPayments />} />;
        case 'pending-submissions':
          return <FeatureGatedPage featureKey="pending-submissions" component={<PendingSubmissions />} />;
        // Subject-level payments disabled
        case 'subject-payments':
        case 'subject-pay-submission':
          return <Dashboard />;
        case 'collect-physical-payment':
          return <FeatureGatedPage featureKey="collect-physical-payment" component={<CollectPhysicalPayment />} />;
        case 'enrollment-management':
          return <TeacherEnrollmentManagement />;
        case 'calendar-view':
          return <FeatureGatedPage featureKey="calendar-view" component={<CalendarMonthView />} />;
        case 'today-dashboard':
          return <TodayDashboard />;
        case 'all-notifications':
          return <AllNotificationsPage />;
        case 'notifications':
        case 'institute-notifications':
          return <FeatureGatedPage featureKey="institute-notifications" component={<NotificationsPage />} />;
        case 'settings':
          return <Settings />;
        case 'feedback':
          return <Feedback />;
        case 'houses':
          return isNotTuitionInstitute ? <FeatureGatedPage featureKey="houses" component={<InstituteHouses />} /> : <Dashboard />;
        case 'teacher-finance':
          return <FeatureGatedPage featureKey="teacher-finance" component={<TeacherFinancePage />} />;
        default:
          return <Dashboard />;
      }
    }

    // For AttendanceMarker role
    if (userRole === 'AttendanceMarker') {
      // Only redirect to InstituteSelector if no institute AND not loading from URL
      if (!selectedInstitute && !urlInstituteId && currentPage !== 'select-institute' && currentPage !== 'settings' && currentPage !== 'appearance' && currentPage !== 'all-notifications' && currentPage !== 'notifications' && currentPage !== 'dashboard' && currentPage !== 'feedback') {
        return isTenantLogin ? tenantInstituteLoading() : <InstituteSelector />;
      }

      if (currentPage === 'select-class') {
        return <ClassSelector />;
      }

      if (currentPage === 'select-subject') {
        return <SubjectSelector />;
      }

      switch (currentPage) {
        case 'dashboard':
          return <Dashboard />;
        case 'attendance':
        case 'daily-attendance':
          return <FeatureGatedPage featureKey="daily-attendance" component={<Attendance />} />;
        case 'my-attendance':
          return <FeatureGatedPage featureKey="my-attendance" component={<MyAttendance />} />;
        case 'today-dashboard':
          return <TodayDashboard />;
        case 'calendar-view':
          return <FeatureGatedPage featureKey="calendar-view" component={<CalendarMonthView />} />;
        case 'attendance-markers':
          return <AttendanceMarkers />;
        case 'qr-attendance':
          return <FeatureGatedPage featureKey="qr-attendance" component={<QRAttendance />} />;
        case 'select-attendance-mark-type':
          return <FeatureGatedPage featureKey="select-attendance-mark-type" component={<SelectAttendanceMarkType />} />;
        case 'manual-class-attendance':
          return <ManualClassAttendance />;
        case 'class-attendance-sessions':
          return <ClassAttendanceSessionsPage />;
        case 'attendance-matrix':
          return <AttendanceMatrixView />;
        case 'close-attendance':
          return <CloseAttendancePage />;
        case 'rfid-attendance':
        case 'rfid':
          return <FeatureGatedPage featureKey="rfid-attendance" component={<RfidAttendance />} />;
        case 'institute-mark-attendance':
          return <InstituteMarkAttendance />;
        case 'profile':
          return <Profile />;
        case 'select-institute':
          return isTenantLogin ? tenantInstituteLoading() : <InstituteSelector />;
        case 'select-class':
          return <ClassSelector />;
        case 'appearance':
          return <Appearance />;
        case 'institute-profile':
          return <InstituteProfile />;
        case 'collect-physical-payment':
          return <FeatureGatedPage featureKey="collect-physical-payment" component={<CollectPhysicalPayment />} />;
        case 'settings':
          return <Settings />;
        case 'feedback':
          return <Feedback />;
        case 'all-notifications':
          return <AllNotificationsPage />;
        case 'notifications':
        case 'institute-notifications':
          return <FeatureGatedPage featureKey="institute-notifications" component={<NotificationsPage />} />;
        default:
          return <Dashboard />;
      }
    }

    // For InstituteAdmin and other roles - full access within their institute
    // Pages that don't require class/subject selection
    const pagesWithoutClassRequirement = [
      'profile',
      'settings',
      'appearance',
      'transport', 
      'parent-transport', 
      'transport-selection', 
      'transport-attendance',
      'my-children',
      'child/:childId/dashboard',
      'child/:childId/results',
      'child/:childId/attendance',
      'child/:childId/transport',
      'institute-payments',
      'institute-billing',
      'class-payments',
      'subject-payments',
      'my-submissions',
      'notifications',
      'institute-notifications',
      'all-notifications',
      'calendar-management',
      'calendar-view',
      'today-dashboard',
      'admin-attendance',
      'parent-attendance',
      'my-attendance',
      'class-calendar',
      'device-management',
      'institute-designs'
    ];
    
    // Only redirect to institute selector if institute is not selected AND not loading from URL AND page is not in exception list
    if (!selectedInstitute && !urlInstituteId && currentPage !== 'institutes' && currentPage !== 'select-institute' && currentPage !== 'organizations' && currentPage !== 'dashboard' && !pagesWithoutClassRequirement.includes(currentPage)) {
      return isTenantLogin ? tenantInstituteLoading() : <InstituteSelector />;
    }

    // NEVER redirect to class selector for pages that don't need it
    if (currentPage === 'select-class' && !pagesWithoutClassRequirement.includes(currentPage)) {
      return <ClassSelector />;
    }

    if (currentPage === 'select-subject') {
      return <SubjectSelector />;
    }

    // ONLY show class selector for pages that explicitly require a class
    // AND are NOT in the exception list
    if (!pagesWithoutClassRequirement.includes(currentPage)) {
      const classRequiredPages: string[] = [];
      if (selectedInstitute && !selectedClass && classRequiredPages.includes(currentPage)) {
        return <ClassSelector />;
      }
    }

    const subjectRequiredPages = ['lectures'];
    if (selectedClass && !selectedSubject && subjectRequiredPages.includes(currentPage) && !pagesWithoutClassRequirement.includes(currentPage)) {
      return <SubjectSelector />;
    }

    // Handle nested routes first
    if (nestedRouteComponent === 'student-profile') {
      if (selectedSubject) return <StudentSubjectProfilePage />;
      if (selectedClass) return <StudentClassProfilePage />;
      return <StudentInstituteProfilePage />;
    }
    if (nestedRouteComponent === 'homework-submissions-view') return <FeatureGatedPage featureKey="homework" component={<HomeworkSubmissions />} />;
    if (nestedRouteComponent === 'class-my-submissions') return <MySubmissions />;
    if (nestedRouteComponent === 'exam-results-view') return <FeatureGatedPage featureKey="exams" component={<ExamResults />} />;
    if (nestedRouteComponent === 'exam-create-results') return <FeatureGatedPage featureKey="exams" component={<CreateExamResults />} />;
    if (nestedRouteComponent === 'house-detail-view' && isNotTuitionInstitute) return <FeatureGatedPage featureKey="houses" component={<HouseDetail />} />;

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'institute-users':
        return <FeatureGatedPage featureKey="institute-users" component={<InstituteUsers />} />;
      case 'verify-image':
        return <FeatureGatedPage featureKey="verify-image" component={<VerifyImage />} />;
      case 'users':
        // Show InstituteUsers for InstituteAdmin
        if (userRole === 'InstituteAdmin') {
          return <FeatureGatedPage featureKey="institute-users" component={<InstituteUsers />} />;
        }
        return <Users />;
      case 'students':
         return <FeatureGatedPage featureKey="students" component={<Students />} />;
      case 'unverified-students':
        return <FeatureGatedPage featureKey="unverified-students" component={<UnverifiedStudents />} />;
      case 'enroll-class':
        return <EnrollClass />;
      case 'enroll-subject':
        return <EnrollSubject />;
      case 'teachers':
        return <Teachers />;
      case 'parents':
        return <FeatureGatedPage featureKey="parents" component={<Parents />} />;
      case 'classes':
        return <FeatureGatedPage featureKey="classes" component={<Classes />} />;
      case 'subjects':
      case 'institute-subjects':
        return <FeatureGatedPage featureKey="institute-subjects" component={<InstituteSubjects />} />;
      case 'class-subjects':
        return <FeatureGatedPage featureKey="class-subjects" component={<ClassSubjects />} />;
      case 'institutes':
        return <Institutes />;
      case 'institute-organizations':
        return <FeatureGatedPage featureKey="institute-organizations" component={<InstituteOrganizations />} />;
      case 'select-institute':
        return isTenantLogin ? tenantInstituteLoading() : <InstituteSelector />;
      case 'attendance':
      case 'daily-attendance':
        return <FeatureGatedPage featureKey="daily-attendance" component={<Attendance />} />;
      case 'my-attendance':
        return <FeatureGatedPage featureKey="my-attendance" component={<MyAttendance />} />;
      case 'attendance-markers':
        return <AttendanceMarkers />;
      case 'qr-attendance':
        return <FeatureGatedPage featureKey="qr-attendance" component={<QRAttendance />} />;
      case 'select-attendance-mark-type':
        return <FeatureGatedPage featureKey="select-attendance-mark-type" component={<SelectAttendanceMarkType />} />;
      case 'manual-class-attendance':
        return <ManualClassAttendance />;
      case 'class-attendance-sessions':
        return <ClassAttendanceSessionsPage />;
      case 'attendance-matrix':
        return <AttendanceMatrixView />;
      case 'close-attendance':
        return <CloseAttendancePage />;
      case 'rfid-attendance':
      case 'rfid':
        return <FeatureGatedPage featureKey="rfid-attendance" component={<RfidAttendance />} />;
      case 'institute-mark-attendance':
        return <InstituteMarkAttendance />;
      case 'lectures':
        return <FeatureGatedPage featureKey="lectures" component={<Lectures />} />;
      case 'class-lectures':
        return <FeatureGatedPage featureKey="class-lectures" component={<ClassLecturesPage />} />;
      case 'free-lectures':
        return <FeatureGatedPage featureKey="free-lectures" component={<FreeLectures />} />;
      case 'structured-lectures':
        return <FeatureGatedPage featureKey="structured-lectures" component={<StructuredLectures />} />;
      case 'institute-lectures':
        return <FeatureGatedPage featureKey="institute-lectures" component={<InstituteLectures />} />;
      case 'live-lectures':
        return <LiveLectures />;
      case 'homework':
        return <FeatureGatedPage featureKey="homework" component={<Homework />} />;
      case 'homework-submissions':
        return <FeatureGatedPage featureKey="homework" component={<StudentHomeworkSubmissions />} />;
      case 'study-materials':
        return <FeatureGatedPage featureKey="study-materials" component={<StudyMaterials />} />;
      case 'subject-recordings':
        return <FeatureGatedPage featureKey="subject-recordings" component={<SubjectRecordingsPage />} />;
      case 'exams':
        return <FeatureGatedPage featureKey="exams" component={<Exams />} />;
      case 'results':
        return <FeatureGatedPage featureKey="exams" component={<Results />} />;
      case 'teacher-students':
        return <TeacherStudents />;
      case 'teacher-homework':
        return <TeacherHomework />;
      case 'teacher-exams':
        return <TeacherExams />;
      case 'teacher-lectures':
        return <TeacherLectures />;
      case 'profile':
        return <Profile />;
      case 'settings':
        return <Settings />;
      case 'feedback':
        return <Feedback />;
      case 'setup-guide':
        return <SetupGuide />;
      case 'institute-details':
        return <InstituteDetails />;
      case 'appearance':
        return <Appearance />;
      case 'institute-profile':
        return <InstituteProfile />;
      case 'institute-settings':
        return userRole === 'InstituteAdmin' ? <InstituteSettingsPage /> : <Dashboard />;
      case 'sms':
        return <FeatureGatedPage featureKey="sms" component={<SMS />} />;
      case 'sms-history':
        return <FeatureGatedPage featureKey="sms-history" component={<SMSHistory />} />;
      case 'all-notifications':
        return <AllNotificationsPage />;
      case 'notifications':
      case 'institute-notifications':
        return <FeatureGatedPage featureKey="institute-notifications" component={<NotificationsPage />} />;
      case 'institute-payments':
        return <FeatureGatedPage featureKey="institute-payments" component={<InstitutePayments />} />;
      case 'class-payments':
        return <FeatureGatedPage featureKey="class-payments" component={<ClassPayments />} />;
      case 'institute-billing':
        return <FeatureGatedPage featureKey="institute-billing" component={<InstituteBillingPage />} />;
      case 'institute-credits':
        return <FeatureGatedPage featureKey="institute-credits" component={<InstituteCreditsPage />} />;
      case 'pending-submissions':
        return <FeatureGatedPage featureKey="pending-submissions" component={<PendingSubmissions />} />;
      // Subject-level payments disabled
      case 'subject-payments':
      case 'subject-pay-submission':
        return <Dashboard />;
      case 'collect-physical-payment':
        return <FeatureGatedPage featureKey="collect-physical-payment" component={<CollectPhysicalPayment />} />;
      case 'enrollment-management':
        return <TeacherEnrollmentManagement />;
      case 'calendar-management':
        return <FeatureGatedPage featureKey="calendar-management" component={<CalendarManagementPage />} />;
      case 'calendar-view':
        return <FeatureGatedPage featureKey="calendar-view" component={<CalendarMonthView />} />;
      case 'today-dashboard':
        return <TodayDashboard />;
      case 'admin-attendance':
        return <FeatureGatedPage featureKey="admin-attendance" component={<AdminAttendancePage />} />;
      case 'lecture-attendance-report':
        return <LectureAttendanceReportPage />;
      case 'lecture-live-attendance':
        return <FeatureGatedPage featureKey="lecture-live-attendance" component={<LectureAttendanceLivePage />} />;
      case 'lecture-recording-attendance':
        return <FeatureGatedPage featureKey="lecture-recording-attendance" component={<LectureRecordingAttendancePage />} />;
      case 'lecture-recording-student':
        return <StudentRecordingActivityPage />;
      case 'parent-attendance':
        return <ParentAttendanceDashboard />;
      case 'class-calendar':
        return <ClassCalendarPage />;
      case 'device-management':
        return <FeatureGatedPage featureKey="device-management" component={<DeviceManagement />} />;
      case 'houses':
        return isNotTuitionInstitute ? <FeatureGatedPage featureKey="houses" component={<InstituteHouses />} /> : <Dashboard />;
      case 'my-children':
        return <MyChildren />;
      case 'child/:childId/dashboard':
        return <ChildDashboard />;
      case 'child/:childId/results':
        return <ChildResultsPage />;
      case 'child/:childId/attendance':
        return <ChildAttendancePage />;
      case 'child/:childId/transport':
        return <ChildTransportPage />;
      case 'finance-hub':
        return <FeatureGatedPage featureKey="suraksha-finance" component={<FinanceHubPage />} />;
      case 'teacher-finance':
        return <FeatureGatedPage featureKey="teacher-finance" component={<TeacherFinancePage />} />;
      case 'institute-designs':
        return <InstituteDesignsPage />;
      default:
        return <Dashboard />;
    }
  };

  // While auth is still initializing (checking stored token / cookie refresh),
  // show the branded loading screen so the WebView never paints blank white
  // before the Capacitor splash hides.
  if (!isInitialized) {
    return <AppLoadingScreen message="Starting..." />;
  }

  if (!user) {
    return <Login onLogin={() => { validateUserToken().catch(() => {}); }} loginFunction={login} />;
  }

  // While tenant auto-select is in progress, show loading
  if ((loginMethod === 'SUBDOMAIN' || loginMethod === 'CUSTOM_DOMAIN') && user && branding?.id && !selectedInstitute && !tenantAutoSelected.current) {
    return <AppLoadingScreen message="Loading institute..." iconUrl={branding?.logoUrl} />;
  }

  // 🛡️ Show branded loading state while validating context from URL
  if (isValidating && (urlInstituteId || location.pathname.startsWith('/child/') || location.pathname.startsWith('/organization/') || location.pathname.startsWith('/transport/'))) {
    return <AppLoadingScreen message="Loading your data..." iconUrl={selectedInstitute?.loadingGifUrl || selectedInstitute?.logo || branding?.logoUrl} />;
  }

  // If organizations page is active, render full screen
  if (currentPage === 'organizations' && !selectedOrganization) {
    return (
      <Suspense fallback={<AppLoadingScreen message="Loading..." />}>
        {renderComponent()}
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="flex w-full h-dvh">
        <Sidebar 
          isOpen={isSidebarOpen}
          onClose={handleSidebarClose}
        />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header onMenuClick={handleMenuClick} />
          <main ref={mainScrollRef} className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-6">
            <div className="max-w-full">
              <Suspense fallback={<AppLoadingScreen message="Loading..." />}>
                {renderComponent()}
              </Suspense>
            </div>
          </main>
          <ModalRouter />
          <BottomNav onMenuClick={handleMenuClick} hidden={navHidden} />
        </div>
      </div>
    </div>
  );
};

export default AppContent;
