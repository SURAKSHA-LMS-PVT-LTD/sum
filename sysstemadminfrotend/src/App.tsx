import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UsersPage from "./pages/UsersPage";
import InstitutePage from "./pages/InstitutePage";
import SubjectsPage from "./pages/SubjectsPage";
import StructuredLecturesPage from "./pages/StructuredLecturesPage";
import TransportPage from "./pages/TransportPage";
import SystemPaymentPage from "./pages/SystemPaymentPage";
import SMSPage from "./pages/SMSPage";
import SMSPaymentPage from "./pages/SMSPaymentPage";
import AdvertisementPage from "./pages/AdvertisementPage";
import OrganizationPage from "./pages/OrganizationPage";
import CardManagementPage from "./pages/CardManagementPage";
import CardOrdersPage from "./pages/CardOrdersPage";
import CardPaymentsPage from "./pages/CardPaymentsPage";
import NotificationsPage from "./pages/NotificationsPage";
import FamilyManagementPage from "./pages/FamilyManagementPage";
import ProfileImagePage from "./pages/ProfileImagePage";
import ImageManagementPage from "./pages/ImageManagementPage";
import SessionManagementPage from "./pages/SessionManagementPage";
import CalendarManagementPage from "./pages/CalendarManagementPage";
import DeviceManagementPage from "./pages/DeviceManagementPage";
import SystemConfigPage from "./pages/SystemConfigPage";
import SecurityMonitoringPage from "./pages/SecurityMonitoringPage";
import StudentsPage from "./pages/StudentsPage";
import ParentsPage from "./pages/ParentsPage";
import AttendancePage from "./pages/AttendancePage";
import InstituteClassesPage from "./pages/InstituteClassesPage";
import InstitutePaymentsPage from "./pages/InstitutePaymentsPage";
import AccountDeletionPage from "./pages/AccountDeletionPage";
import InstituteUsersPage from "./pages/InstituteUsersPage";
import TeachersPage from "./pages/TeachersPage";
import ClassSubjectsPage from "./pages/ClassSubjectsPage";
import InstitutePaymentSubmissionsPage from "./pages/InstitutePaymentSubmissionsPage";
import SubjectPaymentsPage from "./pages/SubjectPaymentsPage";
import AttendanceReportingPage from "./pages/AttendanceReportingPage";
import InstituteBillingManagementPage from "./pages/InstituteBillingManagementPage";
import BillingOverviewPage from "./pages/BillingOverviewPage";
import InstituteCreditsManagementPage from "./pages/InstituteCreditsManagementPage";
import CollectPhysicalPaymentPage from "./pages/CollectPhysicalPaymentPage";
import ErrorReportsPage from "./pages/ErrorReportsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/users" element={<UsersPage />} />
            <Route path="/dashboard/institute" element={<InstitutePage />} />
            <Route path="/dashboard/subjects" element={<SubjectsPage />} />
            <Route path="/dashboard/structured-lectures" element={<StructuredLecturesPage />} />
            <Route path="/dashboard/transport" element={<TransportPage />} />
            <Route path="/dashboard/system-payment" element={<SystemPaymentPage />} />
            <Route path="/dashboard/sms" element={<SMSPage />} />
            <Route path="/dashboard/sms-payment" element={<SMSPaymentPage />} />
            <Route path="/dashboard/advertisement" element={<AdvertisementPage />} />
            <Route path="/dashboard/organizations" element={<OrganizationPage />} />
            <Route path="/dashboard/card-management" element={<CardManagementPage />} />
            <Route path="/dashboard/card-orders" element={<CardOrdersPage />} />
            <Route path="/dashboard/card-payments" element={<CardPaymentsPage />} />
            <Route path="/dashboard/notifications" element={<NotificationsPage />} />
            <Route path="/dashboard/family-management" element={<FamilyManagementPage />} />
            <Route path="/dashboard/profile-images" element={<ProfileImagePage />} />
            <Route path="/dashboard/image-management" element={<ImageManagementPage />} />
            <Route path="/dashboard/session-management" element={<SessionManagementPage />} />
            <Route path="/dashboard/calendar-management" element={<CalendarManagementPage />} />
            <Route path="/dashboard/device-management" element={<DeviceManagementPage />} />
            <Route path="/dashboard/system-config" element={<SystemConfigPage />} />
            <Route path="/dashboard/security" element={<SecurityMonitoringPage />} />
            <Route path="/dashboard/students" element={<StudentsPage />} />
            <Route path="/dashboard/parents" element={<ParentsPage />} />
            <Route path="/dashboard/attendance" element={<AttendancePage />} />
            <Route path="/dashboard/institute-classes" element={<InstituteClassesPage />} />
            <Route path="/dashboard/institute-payments" element={<InstitutePaymentsPage />} />
            <Route path="/dashboard/account-deletion" element={<AccountDeletionPage />} />
            <Route path="/dashboard/institute-users" element={<InstituteUsersPage />} />
            <Route path="/dashboard/teachers" element={<TeachersPage />} />
            <Route path="/dashboard/class-subjects" element={<ClassSubjectsPage />} />
            <Route path="/dashboard/payment-submissions" element={<InstitutePaymentSubmissionsPage />} />
            <Route path="/dashboard/subject-payments" element={<SubjectPaymentsPage />} />
            <Route path="/dashboard/attendance-reports" element={<AttendanceReportingPage />} />
            <Route path="/dashboard/institute-billing" element={<InstituteBillingManagementPage />} />
            <Route path="/dashboard/billing-overview" element={<BillingOverviewPage />} />
            <Route path="/dashboard/institute-credits" element={<InstituteCreditsManagementPage />} />
            <Route path="/dashboard/collect-payment" element={<CollectPhysicalPaymentPage />} />
            <Route path="/dashboard/error-reports" element={<ErrorReportsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
