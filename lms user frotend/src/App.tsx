import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { NotificationToast } from "@/components/notifications/NotificationToast";
import GoogleTranslateInit from "@/components/LanguageSwitcher";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
// StatusBar imported dynamically to avoid browser module resolution errors

// Native plugin for Android system navigation bar — registered in MainActivity.java
const NavigationBar = registerPlugin<{ setColor(opts: { color: string; darkButtons: boolean }): Promise<void> }>('NavigationBar');
import { useCapacitorConnection } from "@/hooks/useCapacitorConnection";
import CapacitorConnectionError from "@/components/CapacitorConnectionError";
import AppLoadingScreen from "@/components/AppLoadingScreen";
import Index from "./pages/Index";
import QRAttendance from "@/components/QRAttendance";
import RfidAttendance from "@/pages/RFIDAttendance";
import InstituteMarkAttendance from "@/pages/InstituteMarkAttendance";

import NotFound from "./pages/NotFound";
import Payments from "./pages/Payments";
import CreatePayment from "./pages/CreatePayment";
import CreateInstituteUserPage from "./pages/CreateInstituteUserPage";
import PaymentSubmissions from "./pages/PaymentSubmissions";
import MySubmissions from "./pages/MySubmissions";
import InstitutePayments from "./pages/InstitutePayments";
import SubjectPayments from "./pages/SubjectPayments";
import SubjectSubmissions from "./pages/SubjectSubmissions";
import SubjectPaymentSubmissions from "./pages/SubjectPaymentSubmissions";
import PaymentSubmissionsPage from "./pages/PaymentSubmissionsPage";
import PaymentSubmissionsPhysical from "./pages/PaymentSubmissionsPhysical";
import PaymentSubmissionsPhysicalInstitute from "./pages/PaymentSubmissionsPhysicalInstitute";
import HomeworkSubmissions from "./pages/HomeworkSubmissions";
import HomeworkSubmissionDetails from "./pages/HomeworkSubmissionDetails";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { FeaturesProvider } from "@/contexts/FeaturesContext"; // Import FeaturesProvider
import { RbacProvider } from "@/contexts/RbacContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import UpdateHomework from "@/pages/UpdateHomework";
import UpdateLecture from "@/pages/UpdateLecture";
import CardDemo from "@/pages/CardDemo";
import ExamResults from "@/pages/ExamResults";
import CreateExamResults from "@/pages/CreateExamResults";
import ErrorBoundary from "@/components/ErrorBoundary";
import UpdateNotification from "@/components/UpdateNotification";
import NotificationNavigator from "@/components/NotificationNavigator";
import Transport from "@/pages/Transport";
import TransportAttendance from "@/pages/TransportAttendance";
import MyChildren from "@/pages/MyChildren";
import ChildDashboard from "@/pages/ChildDashboard";
import ChildResultsPage from "@/pages/ChildResultsPage";
import ChildAttendancePage from "@/pages/ChildAttendancePage";
import ChildTransportPage from "@/pages/ChildTransportPage";
import CardManagement from "@/pages/CardManagement";
import ProtectedRoute from "@/components/ProtectedRoute";
import GoogleAuthCallback from "@/pages/GoogleAuthCallback";
import ActiveSessionsPage from "@/pages/ActiveSessions";
import ActivateAccount from "@/pages/ActivateAccount";
import CreateAccount from "@/pages/CreateAccount";
import RegisterInstitute from "@/pages/RegisterInstitute";
import ReuploadProfileImagePage from "@/pages/ReuploadProfileImagePage";
import AttendanceViewPage from "@/pages/AttendanceViewPage";
import LiveLecturePage from "@/pages/LiveLecturePage";
import ViewRecordingPage from "@/pages/ViewRecordingPage";
import PublicRegistrationPage from "@/pages/PublicRegistrationPage";
import StudentInstituteProfilePage from "@/pages/StudentInstituteProfilePage";
import StudentClassProfilePage from "@/pages/StudentClassProfilePage";
import StudentSubjectProfilePage from "@/pages/StudentSubjectProfilePage";
import InstituteAttendancePage from "./pages/InstituteAttendancePage";
import SettingsPage from "./pages/SettingsPage";
import DeployPage from "./pages/DeployPage";
import PaymentReturnPage from "./pages/PaymentReturnPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import { isPopupRouteSegment } from "@/utils/popupRoutes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Keeps the native Android status bar AND navigation bar in sync with the app theme
function StatusBarManager() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const isDark = resolvedTheme === 'dark';
    const bgColor = isDark ? '#14171f' : '#f9fafb';

    // Update the <meta name="theme-color"> for browsers / PWA
    const meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', bgColor);

    // Keep root and body background in sync (avoids visible white/black strips)
    document.documentElement.style.backgroundColor = bgColor;
    document.body.style.backgroundColor = bgColor;

    if (!Capacitor.isNativePlatform()) return;
    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      const barStyle = isDark ? Style.Dark : Style.Light;
      // Status bar (top)
      StatusBar.setBackgroundColor({ color: bgColor }).catch(() => {});
      StatusBar.setStyle({ style: barStyle }).catch(() => {});
    }).catch(() => {});
    // Navigation bar (bottom system bar) — uses our custom native plugin
    NavigationBar.setColor({ color: bgColor, darkButtons: !isDark }).catch(() => {});
  }, [resolvedTheme]);
  return null;
}

// Dynamic MUI theme — follows the app's dark/light mode via ThemeContext
function DynamicMuiTheme({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const muiTheme = React.useMemo(() => createTheme({
    palette: {
      mode: resolvedTheme as 'light' | 'dark',
      ...(resolvedTheme === 'dark' ? {
        background: { default: '#14171f', paper: '#1a2336' },
        text:       { primary: '#e8edf2', secondary: '#8699aa' },
        divider:    '#2a3649',
        primary:    { main: '#5b9cf6', contrastText: '#ffffff' },
        action:     { hover: 'rgba(91,156,246,0.08)', selected: 'rgba(91,156,246,0.12)' },
      } : {
        background: { default: '#f5f7fa', paper: '#ffffff' },
        primary:    { main: '#1a63e8', contrastText: '#ffffff' },
      }),
    },
    typography: {
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      fontSize: 14,
    },
    components: {
      MuiTableCell: {
        styleOverrides: {
          root: {
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            borderColor: resolvedTheme === 'dark' ? '#2a3649' : undefined,
          },
          head: {
            fontWeight: 600,
            backgroundColor: resolvedTheme === 'dark' ? '#1a2336' : '#f1f5f9',
            color: resolvedTheme === 'dark' ? '#c5d0db' : undefined,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: resolvedTheme === 'dark' ? 'rgba(91,156,246,0.07)' : 'rgba(26,99,232,0.04)',
            },
            '&:nth-of-type(even)': {
              backgroundColor: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            },
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            backgroundColor: resolvedTheme === 'dark' ? '#1a2336' : '#ffffff',
            borderRadius: 12,
          },
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          root: { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
        },
      },
    },
  }), [resolvedTheme]);

  return <MuiThemeProvider theme={muiTheme}><CssBaseline />{children}</MuiThemeProvider>;
}

const AppContent = () => {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/live-lecture/:urlId" element={<LiveLecturePage />} />
      <Route path="/view-recording/:urlId" element={<ViewRecordingPage />} />
      <Route path="/forms/:token" element={<PublicRegistrationPage />} />
      <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/activate/identify" element={<ActivateAccount />} />
      <Route path="/activate/verify" element={<ActivateAccount />} />
      <Route path="/activate/profile" element={<ActivateAccount />} />
      <Route path="/register/step1" element={<CreateAccount />} />
      <Route path="/register/verify" element={<CreateAccount />} />
      <Route path="/register/parents" element={<CreateAccount />} />
      <Route path="/register/details/personal-information" element={<CreateAccount />} />
      <Route path="/register/details/address" element={<CreateAccount />} />
      <Route path="/register/details/additional" element={<CreateAccount />} />
      <Route path="/register/student" element={<CreateAccount />} />
      <Route path="/register/review" element={<CreateAccount />} />
      <Route path="/register/institute" element={<RegisterInstitute />} />
      <Route path="/profile/image/upload" element={<ReuploadProfileImagePage />} />
      <Route path="/attendance/view" element={<ProtectedRoute><AttendanceViewPage /></ProtectedRoute>} />
      <Route path="/institute/:instituteId/*" element={<Index />} />
      <Route path="/organization/:organizationId/*" element={<Index />} />
      <Route path="/child/:childId/*" element={<Index />} />
      <Route path="/transport/:transportId/*" element={<Index />} />
      <Route path="/dashboard/*" element={<Index />} />
      <Route path="/profile/*" element={<Index />} />
      <Route path="/settings/*" element={<Index />} />
      <Route path="/appearance/*" element={<Index />} />
      <Route path="/institutes/*" element={<Index />} />
      <Route path="/organizations/*" element={<Index />} />
      <Route path="/qr-attendance/*" element={<Index />} />
      <Route path="/rfid-attendance/*" element={<Index />} />
      <Route path="/close-attendance/*" element={<Index />} />
      <Route path="/sms-history/*" element={<Index />} />
      <Route path="/enrollment-management/*" element={<Index />} />
      <Route path="/students/*" element={<Index />} />
      <Route path="/teachers/*" element={<Index />} />
      <Route path="/parents/*" element={<Index />} />
      <Route path="/users/*" element={<Index />} />
      <Route path="/select-institute/*" element={<Index />} />
      <Route path="/select-class/*" element={<Index />} />
      <Route path="/select-subject/*" element={<Index />} />
      <Route path="/classes/*" element={<Index />} />
      <Route path="/subjects/*" element={<Index />} />
      <Route path="/attendance/*" element={<Index />} />
      <Route path="/lectures/*" element={<Index />} />
      <Route path="/free-lectures/*" element={<Index />} />
      <Route path="/live-lectures/*" element={<Index />} />
      <Route path="/institute-lectures/*" element={<Index />} />
      <Route path="/lecture-live-attendance/*" element={<Index />} />
      <Route path="/lecture-recording-attendance/*" element={<Index />} />
      <Route path="/lecture-recording-student/*" element={<Index />} />
      <Route path="/homework" element={<Index />} />
      <Route path="/homework-submissions" element={<Index />} />
      <Route path="/exams" element={<Index />} />
      <Route path="/results" element={<Index />} />
      <Route path="/grades" element={<Index />} />
      <Route path="/institute-details" element={<Index />} />
      <Route path="/institute-profile" element={<Index />} />
      <Route path="/institute-users" element={<Index />} />
      <Route path="/institute-payments" element={<Index />} />
      <Route path="/institute-billing" element={<Index />} />
      <Route path="/institute-settings" element={<Index />} />
      <Route path="/institute-subjects" element={<Index />} />
      <Route path="/institute-organizations" element={<Index />} />
      <Route path="/institute-mark-attendance" element={<Index />} />
      <Route path="/attendance-matrix" element={<Index />} />
      <Route path="/subject-payments" element={<Index />} />
      <Route path="/subject-submissions" element={<Index />} />
      <Route path="/subject-pay-submission" element={<Index />} />
      <Route path="/collect-physical-payment" element={<Index />} />
      <Route path="/sms" element={<Index />} />
      <Route path="/notifications" element={<Index />} />
      <Route path="/institute-notifications" element={<Index />} />
      <Route path="/all-notifications" element={<Index />} />
      <Route path="/setup-guide" element={<Index />} />
      <Route path="/verify-image" element={<Index />} />
      <Route path="/enroll-class" element={<Index />} />
      <Route path="/enroll-subject" element={<Index />} />
      <Route path="/my-attendance" element={<Index />} />
      <Route path="/attendance-markers" element={<Index />} />
      <Route path="/unverified-students" element={<Index />} />
      <Route path="/class-subjects" element={<Index />} />
      <Route path="/teacher-students" element={<Index />} />
      <Route path="/teacher-homework" element={<Index />} />
      <Route path="/teacher-exams" element={<Index />} />
      <Route path="/teacher-lectures" element={<Index />} />
      <Route path="/calendar-management" element={<Index />} />
      <Route path="/calendar-view" element={<Index />} />
      <Route path="/today-dashboard" element={<Index />} />
      <Route path="/admin-attendance" element={<Index />} />
      <Route path="/parent-attendance" element={<Index />} />
      <Route path="/class-calendar" element={<Index />} />
      <Route path="/device-management" element={<Index />} />
      <Route path="/feedback" element={<Index />} />

      <Route path="/my-children" element={<ProtectedRoute><MyChildren /></ProtectedRoute>} />
      <Route path="/transport" element={<ProtectedRoute><Transport /></ProtectedRoute>} />
      <Route path="/system-payment" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/system-payments/create" element={<ProtectedRoute><CreatePayment /></ProtectedRoute>} />
      <Route path="/institute-users/:instituteId/create" element={<ProtectedRoute><CreateInstituteUserPage /></ProtectedRoute>} />
      <Route path="/payment-submissions/:paymentId" element={<ProtectedRoute><PaymentSubmissions /></ProtectedRoute>} />
      <Route path="/payment-submissions" element={<ProtectedRoute><PaymentSubmissionsPage /></ProtectedRoute>} />
      <Route path="/payment-submissions-physical" element={<ProtectedRoute><PaymentSubmissionsPhysical /></ProtectedRoute>} />
      <Route path="/payment-submissions-physical/:paymentId" element={<ProtectedRoute><PaymentSubmissionsPhysicalInstitute /></ProtectedRoute>} />
      <Route path="/payment-submissions-pysical" element={<ProtectedRoute><PaymentSubmissionsPhysical /></ProtectedRoute>} />
      <Route path="/payment-submissions-pysical/:paymentId" element={<ProtectedRoute><PaymentSubmissionsPhysicalInstitute /></ProtectedRoute>} />
      <Route path="/my-submissions" element={<ProtectedRoute><MySubmissions /></ProtectedRoute>} />
      <Route path="/card-demo" element={<ProtectedRoute><CardDemo /></ProtectedRoute>} />
      <Route path="/id-cards" element={<ProtectedRoute><CardManagement /></ProtectedRoute>} />
      <Route path="/id-cards/*" element={<Navigate to="/id-cards" replace />} />
      <Route path="/sessions" element={<ProtectedRoute><ActiveSessionsPage /></ProtectedRoute>} />

      <Route path="/institute-attendance" element={<ProtectedRoute><InstituteAttendancePage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/deploy" element={<ProtectedRoute><DeployPage /></ProtectedRoute>} />

      {/* PayHere gateway return / cancel landing pages */}
      <Route path="/payment/return" element={<ProtectedRoute><PaymentReturnPage /></ProtectedRoute>} />
      <Route path="/payment/cancel" element={<ProtectedRoute><PaymentReturnPage cancelled /></ProtectedRoute>} />

      <Route path="*" element={<PopupRouteFallback />} />
    </Routes>
  );
};

const PopupRouteFallback = () => {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  return isPopupRouteSegment(lastSegment) ? <Index /> : <NotFound />;
};

const App = () => {
  const { isOnline, isLoading, retry } = useCapacitorConnection();

  useEffect(() => {
    // Theme is now managed by ThemeContext — no forced light mode
    
  }, []);

  // Handle Android back button - MUST be before any conditional return (Rules of Hooks)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      let listenerHandle: any = null;
      
      const setupListener = async () => {
        listenerHandle = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            // If at root, exit the app
            CapacitorApp.exitApp();
          }
        });
      };
      
      setupListener();

      return () => {
        if (listenerHandle) {
          listenerHandle.remove();
        }
      };
    }
  }, []);

  // ─── Stale WebView recovery ─────────────────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const STALE_THRESHOLD_MS = 30 * 60 * 1000;
    let backgroundedAt: number | null = null;
    const listenerPromise = CapacitorApp.addListener('appStateChange', (state) => {
      if (!state.isActive) {
        backgroundedAt = Date.now();
      } else {
        if (backgroundedAt !== null) {
          const elapsed = Date.now() - backgroundedAt;
          backgroundedAt = null;
          if (elapsed > STALE_THRESHOLD_MS) {
            window.location.reload();
            return;
          }
        }
        const root = document.getElementById('root');
        if (root && root.childElementCount === 0) {
          window.location.reload();
        }
      }
    });

    return () => {
      listenerPromise.then((h) => h.remove()).catch(() => {});
    };
  }, []);

  const showConnectionError = Capacitor.isNativePlatform() && !isLoading && !isOnline;

  return (
    <ErrorBoundary>
      <ThemeProvider>
      <StatusBarManager />
      <DynamicMuiTheme>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <TenantProvider>
            <AuthProvider>
              <FeaturesProvider>
              <RbacProvider>
              {showConnectionError ? (
                <CapacitorConnectionError onRetry={retry} />
              ) : (
                <>
                  <Toaster />
                  <Sonner />
                  <NotificationToast />
                  <GoogleTranslateInit />
                  <UpdateNotification />
                  <NotificationNavigator />
                  <AppContent />
                </>
              )}
              </RbacProvider>
              </FeaturesProvider>
            </AuthProvider>
            </TenantProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </DynamicMuiTheme>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
