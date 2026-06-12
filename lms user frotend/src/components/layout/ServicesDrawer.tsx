import React, { useMemo, useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { useNavigate } from 'react-router-dom';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import { canCreateInstitute } from '@/api/instituteRegistration.api';
import {
  User, Building2, CreditCard, IdCard, Settings, Bus,
  MessageSquare, ImageIcon, Users, QrCode, UserCheck,
  Bell, School, BookOpen, GraduationCap, Clock,
  ChevronRight, Plus, Search, LayoutDashboard, Video,
  Notebook, Award, Calendar, CalendarDays, BarChart3,
  ClipboardList, FileText, Wifi,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface ServiceItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  color: string;
}

interface ServiceSection {
  title: string;
  items: ServiceItem[];
}

interface ServicesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ServicesDrawer: React.FC<ServicesDrawerProps> = ({ open, onOpenChange }) => {
  const {
    user, selectedInstitute, selectedClass, selectedSubject,
    selectedChild, selectedOrganization, selectedTransport,
  } = useAuth();
  const userRole = useInstituteRole();
  const navigate = useNavigate();
  const { subjectLabel: rawSubjectLabel, isTuition: isTuitionInstitute } = useInstituteLabels();
  const subjectLabel = rawSubjectLabel || 'Subject';
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setSearchQuery('');
    onOpenChange(isOpen);
  };

  const handleNavigate = (itemId: string) => {
    // Handle special routes
    if (itemId === 'create-institute') {
      navigate('/register/institute');
      handleOpenChange(false);
      return;
    }
    const context = {
      instituteId: selectedInstitute?.id,
      classId: selectedClass?.id,
      subjectId: selectedSubject?.id,
      childId: selectedChild?.id,
      organizationId: selectedOrganization?.id,
      transportId: selectedTransport?.id,
    };
    if (itemId === 'organizations' && !selectedInstitute) {
      window.open('https://org.suraksha.lk/', '_blank');
      handleOpenChange(false);
      return;
    }
    const url = buildSidebarUrl(itemId, context);
    navigate(url);
    handleOpenChange(false);
  };

  const getSections = (): ServiceSection[] => {
    const sections: ServiceSection[] = [];
    const userType = user?.userType?.toUpperCase() || '';

    // ── Navigate ──────────────────────────────────────────────────
    if (selectedInstitute) {
      const navItems: ServiceItem[] = [];
      if (!selectedClass) {
        navItems.push({ id: 'select-class', label: 'Choose Class', icon: School, color: 'bg-emerald-500', description: 'Select your class' });
      }
      if (selectedClass && !selectedSubject) {
        const sl = subjectLabel || 'Subject';
        navItems.push({ id: 'select-subject', label: `Choose ${sl}`, icon: BookOpen, color: 'bg-violet-500', description: `Pick a ${String(sl).toLowerCase()}` });
      }
      if (navItems.length > 0) {
        sections.push({ title: 'Navigate', items: navItems });
      }
    }

    // ── Academics ─────────────────────────────────────────────────
    if (selectedInstitute && userRole !== 'Parent') {
      const academicItems: ServiceItem[] = [];

      // Institute Lectures
      academicItems.push({ id: 'institute-lectures', label: 'Institute Lectures', icon: Video, color: 'bg-blue-400', description: 'Browse institute lectures' });

      // Admin/Teacher without class: all classes & subjects
      if (!selectedClass && (userRole === 'InstituteAdmin' || userRole === 'Teacher')) {
        academicItems.push({ id: 'classes', label: 'All Classes', icon: School, color: 'bg-violet-500', description: 'Manage all classes' });
        academicItems.push({ id: 'institute-subjects', label: `All ${subjectLabel}s`, icon: BookOpen, color: 'bg-indigo-500', description: `All ${subjectLabel.toLowerCase()}s` });
      }

      // Admin with class, no subject: class subjects
      if (selectedClass && !selectedSubject && userRole === 'InstituteAdmin') {
        academicItems.push({ id: 'class-subjects', label: `Class ${subjectLabel}s`, icon: BookOpen, color: 'bg-indigo-400', description: `${subjectLabel}s in selected class` });
      }

      // Subject-level academics
      if (selectedSubject) {
        academicItems.push({ id: 'lectures', label: 'Lectures', icon: Video, color: 'bg-blue-600', description: 'Subject lectures' });
        academicItems.push({ id: 'free-lectures', label: 'Free Lectures', icon: Video, color: 'bg-teal-500', description: 'Available to all' });
        if (userRole !== 'AttendanceMarker') {
          academicItems.push({ id: 'homework', label: 'Homework', icon: Notebook, color: 'bg-amber-500', description: 'Assignments & tasks' });
          academicItems.push({ id: 'exams', label: 'Exams', icon: Award, color: 'bg-rose-500', description: 'Examinations & results' });
        }
      }

      sections.push({ title: 'Academics', items: academicItems });
    }

    // ── People (Admin / Teacher) ───────────────────────────────────
    if (selectedInstitute && (userRole === 'InstituteAdmin' || userRole === 'Teacher')) {
      const peopleItems: ServiceItem[] = [];
      if (userRole === 'InstituteAdmin') {
        if (!isTuitionInstitute && !selectedClass) {
          peopleItems.push({ id: 'institute-organizations', label: 'Organizations', icon: Building2, color: 'bg-slate-500', description: 'Manage organizations' });
        }
        peopleItems.push({ id: 'institute-users', label: 'All Users', icon: Users, color: 'bg-blue-500', description: 'View all members' });
        peopleItems.push({ id: 'parents', label: 'Parents', icon: Users, color: 'bg-teal-500', description: 'Parent accounts' });
        peopleItems.push({ id: 'verify-image', label: 'Verify Photos', icon: ImageIcon, color: 'bg-pink-500', description: 'Approve profile photos' });
      }
      if (selectedClass || selectedSubject) {
        peopleItems.push({ id: 'students', label: 'Students', icon: GraduationCap, color: 'bg-indigo-500', description: 'View enrolled students' });
        peopleItems.push({ id: 'unverified-students', label: 'Pending Students', icon: UserCheck, color: 'bg-amber-500', description: 'Awaiting approval' });
      }
      if (peopleItems.length > 0) {
        sections.push({ title: 'People', items: peopleItems });
      }
    }

    // ── Attendance ────────────────────────────────────────────────
    if (selectedInstitute) {
      const attendanceItems: ServiceItem[] = [];

      if (userRole === 'InstituteAdmin' || userRole === 'Teacher' || userRole === 'AttendanceMarker') {
        attendanceItems.push({ id: 'select-attendance-mark-type', label: 'Mark Attendance', icon: QrCode, color: 'bg-cyan-500', description: 'Choose QR, Barcode, or RFID' });
        attendanceItems.push({ id: 'daily-attendance', label: 'Institute Attendance', icon: ClipboardList, color: 'bg-blue-500', description: 'Daily attendance records' });
      }
      if (userRole === 'Student') {
        attendanceItems.push({ id: 'my-attendance', label: 'My Attendance', icon: UserCheck, color: 'bg-cyan-500', description: 'Your attendance history' });
      }
      if (userRole === 'InstituteAdmin' && !selectedClass) {
        attendanceItems.push({ id: 'admin-attendance', label: 'Advanced Attendance', icon: BarChart3, color: 'bg-indigo-500', description: 'Institute-wide overview' });
        attendanceItems.push({ id: 'calendar-view', label: 'Calendar View', icon: Calendar, color: 'bg-emerald-500', description: 'Attendance calendar' });
        attendanceItems.push({ id: 'calendar-management', label: 'Manage Calendar', icon: CalendarDays, color: 'bg-emerald-600', description: 'Manage academic calendar' });
      } else if ((userRole === 'Teacher' || userRole === 'AttendanceMarker') && !selectedClass) {
        attendanceItems.push({ id: 'calendar-view', label: 'Calendar View', icon: Calendar, color: 'bg-emerald-500', description: 'Attendance calendar' });
      } else if (userRole === 'Student' && selectedSubject) {
        attendanceItems.push({ id: 'calendar-view', label: 'Calendar', icon: Calendar, color: 'bg-emerald-500', description: 'Attendance calendar' });
      }

      if (attendanceItems.length > 0) {
        sections.push({ title: 'Attendance', items: attendanceItems });
      }
    }

    // ── Messaging (Admin) ─────────────────────────────────────────
    if (selectedInstitute && userRole === 'InstituteAdmin' && !selectedClass) {
      sections.push({
        title: 'Messaging',
        items: [
          { id: 'sms', label: 'Send SMS', icon: MessageSquare, color: 'bg-sky-500', description: 'Send messages to users' },
          { id: 'sms-history', label: 'SMS History', icon: MessageSquare, color: 'bg-sky-600', description: 'View sent messages' },
          { id: 'institute-notifications', label: 'Notifications', icon: Bell, color: 'bg-purple-500', description: 'Institute push notifications' },
        ],
      });
    }

    // ── Fees & Payments ───────────────────────────────────────────
    if (selectedInstitute) {
      const feeItems: ServiceItem[] = [];
      if (userRole === 'InstituteAdmin') {
        if (!selectedClass) feeItems.push({ id: 'institute-payments', label: 'Institute Fees', icon: CreditCard, color: 'bg-amber-500', description: 'Manage institute fees' });
        feeItems.push({ id: 'pending-submissions', label: 'Review Payments', icon: Clock, color: 'bg-orange-500', description: 'Approve pending payments' });
      }
      if (userRole === 'Teacher' && !selectedClass) {
        feeItems.push({ id: 'institute-payments', label: 'Institute Fees', icon: CreditCard, color: 'bg-amber-500', description: 'Institute fee overview' });
      }
      // Subject-level payments disabled — class payments handled via enrollment
      if (userRole === 'Student') {
        feeItems.push({ id: 'my-submissions', label: 'My Submissions', icon: FileText, color: 'bg-orange-500', description: 'All my fee submissions' });
      }
      if (feeItems.length > 0) {
        sections.push({ title: 'Fees & Payments', items: feeItems });
      }
    }

    // ── Parent children activity ───────────────────────────────────
    if (userRole === 'Parent' && selectedChild) {
      sections.push({
        title: 'My Children Activity',
        items: [
          { id: 'parent-attendance', label: 'Attendance Dashboard', icon: CalendarDays, color: 'bg-cyan-500', description: "Child's attendance overview" },
          { id: 'child-attendance', label: 'Transport Attendance', icon: Bus, color: 'bg-teal-500', description: "Child's transport attendance" },
        ],
      });
    }

    // ── General Services ──────────────────────────────────────────
    const serviceItems: ServiceItem[] = [];
    if (userType !== 'USER_WITHOUT_PARENT') {
      serviceItems.push({ id: 'my-children', label: 'My Children', icon: Users, color: 'bg-rose-500', description: 'View your children' });
    }
    if (canCreateInstitute(userType)) {
      serviceItems.push({ id: 'create-institute', label: 'Create Institute', icon: Plus, color: 'bg-primary', description: 'Set up a new institute' });
    }
    serviceItems.push({ id: 'id-cards', label: 'ID Cards', icon: IdCard, color: 'bg-indigo-500', description: 'Manage your ID cards' });
    serviceItems.push({ id: 'system-payment', label: 'Payments', icon: CreditCard, color: 'bg-amber-500', description: 'Manage payments' });
    sections.push({ title: 'Services', items: serviceItems });

    // ── Account ───────────────────────────────────────────────────
    const accountItems: ServiceItem[] = [
      { id: 'profile', label: 'My Profile', icon: User, color: 'bg-blue-500', description: 'View & edit profile' },
    ];
    if (selectedInstitute && ['Student', 'Teacher', 'InstituteAdmin', 'Parent', 'AttendanceMarker'].includes(userRole)) {
      accountItems.push({ id: 'institute-profile', label: 'Institute Profile', icon: Building2, color: 'bg-indigo-500', description: 'View institute profile' });
    }
    if (selectedInstitute && userRole === 'InstituteAdmin') {
      accountItems.push({ id: 'institute-settings', label: 'Institute Settings', icon: Settings, color: 'bg-slate-500', description: 'Manage institute settings' });
      accountItems.push({ id: 'device-management', label: 'Device Management', icon: Wifi, color: 'bg-emerald-500', description: 'Manage connected devices' });
    }
    sections.push({ title: 'Account', items: accountItems });

    return sections;
  };

  const allSections = useMemo(() => getSections(), [
    user?.userType,
    selectedInstitute?.id,
    selectedInstitute?.type,
    selectedClass?.id,
    selectedSubject?.id,
    selectedChild?.id,
    userRole,
    subjectLabel,
    isTuitionInstitute,
  ]);

  // Filter sections based on search query (memoized)
  const sections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allSections;

    return allSections
      .map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        ),
      }))
      .filter(section => section.items.length > 0);
  }, [allSections, searchQuery]);

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} routeName="services-drawer">
      <DrawerContent className="rounded-t-3xl border-border/70 bg-background/95 backdrop-blur-xl">
        {/* Sticky header — lives outside the scroll container so it never scrolls away */}
        <div className="shrink-0">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-lg font-bold text-foreground">Services</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-3 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted/50 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="px-4 pb-8 pt-3 space-y-5">
          {sections.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No services found for "{searchQuery}"</p>
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.title}>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                  {section.title}
                </h3>
                <div className="space-y-1.5">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
                      className="group flex items-center gap-3 w-full p-3 rounded-2xl text-left bg-card/70 border border-border/40 hover:border-border hover:bg-card active:scale-[0.985] transition-all duration-200"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.color} text-white shadow-sm group-hover:scale-105 transition-transform`}>
                        <item.icon className="h-[18px] w-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">{item.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ServicesDrawer;
