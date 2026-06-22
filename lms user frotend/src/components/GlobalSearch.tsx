import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import StudentEnrollDrilldown, { EnrollStep } from '@/components/dialogs/StudentEnrollDrilldown';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { useFeatures } from '@/contexts/FeaturesContext';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import {
  LayoutDashboard, Users, GraduationCap, UserCheck, BookOpen, School,
  ClipboardList, BarChart3, Settings, User, Building2, QrCode,
  Award, Video, FileText, Notebook,
  CreditCard, Bell, Calendar, CalendarDays, ShieldCheck,
  Flag, IdCard, MessageSquare, ListChecks,
  UserPlus, Wifi, Search, Clock, ArrowRight, Zap,
  GalleryHorizontal, Megaphone, X,
  Palette, Wallet, Receipt, Banknote, Layers,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SearchItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  group: string;
  groupColor: string; // tailwind bg class for icon badge
  action: () => void;
  keywords?: string[];
  badge?: string;    // e.g. "Admin only"
}

interface RecentEntry {
  id: string;
  label: string;
  path: string;
  timestamp: number;
}

// ─── Group color palette ───────────────────────────────────────────────────────
const GROUP_COLORS: Record<string, string> = {
  'Quick Actions':  'bg-orange-100 text-orange-700 dark:bg-orange-500/25 dark:text-orange-400',
  'Recent':         'bg-slate-100 text-slate-600 dark:bg-slate-500/25 dark:text-slate-400',
  'Navigation':     'bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-400',
  'Manage Users':   'bg-violet-100 text-violet-700 dark:bg-violet-500/25 dark:text-violet-400',
  'Academics':      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-400',
  'Attendance':     'bg-teal-100 text-teal-700 dark:bg-teal-500/25 dark:text-teal-400',
  'Payments':       'bg-amber-100 text-amber-700 dark:bg-amber-500/25 dark:text-amber-400',
  'Communication':  'bg-pink-100 text-pink-700 dark:bg-pink-500/25 dark:text-pink-400',
  'Institute':      'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-400',
  'Services':       'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/25 dark:text-cyan-400',
  'Account':        'bg-gray-100 text-gray-600 dark:bg-gray-500/25 dark:text-gray-400',
};

const RECENT_KEY = 'gs_recent';
const MAX_RECENT = 6;

function loadRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(entries: RecentEntry[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(entries.slice(0, MAX_RECENT)));
  } catch { /* noop */ }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
const GlobalSearch = ({ open, onOpenChange }: GlobalSearchProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    selectedInstitute, selectedClass, selectedSubject,
    selectedChild, selectedOrganization, selectedTransport,
    currentInstituteId, user,
  } = useAuth();
  const userRole = useInstituteRole();
  const { isFeatureEnabled } = useFeatures();

  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollStep, setEnrollStep] = useState<EnrollStep>('institute');

  // Load recent on mount / when dialog opens
  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setQuery('');
    }
  }, [open]);

  const context = useMemo(() => ({
    instituteId: selectedInstitute?.id,
    classId: selectedClass?.id,
    subjectId: selectedSubject?.id,
    childId: selectedChild?.id,
    organizationId: selectedOrganization?.id,
    transportId: selectedTransport?.id,
  }), [selectedInstitute?.id, selectedClass?.id, selectedSubject?.id,
       selectedChild?.id, selectedOrganization?.id, selectedTransport?.id]);

  const { subjectLabel, classLabel } = useInstituteLabels();

  // Track navigation and add to recent
  const handleNavigate = useCallback((label: string, path: string) => {
    const entry: RecentEntry = { id: path, label, path, timestamp: Date.now() };
    const updated = [entry, ...recent.filter(r => r.path !== path)];
    setRecent(updated);
    saveRecent(updated);
    navigate(path);
    onOpenChange(false);
  }, [navigate, onOpenChange, recent]);

  const go = useCallback((page: string, label: string) => {
    const path = buildSidebarUrl(page, context);
    handleNavigate(label, path);
  }, [context, handleNavigate]);

  const goTo = useCallback((path: string, label: string) => {
    handleNavigate(label, path);
  }, [handleNavigate]);

  const openEnroll = useCallback((step: EnrollStep) => {
    onOpenChange(false);
    setEnrollStep(step);
    setEnrollOpen(true);
  }, [onOpenChange]);

  const clearRecent = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecent([]);
    saveRecent([]);
  };

  // ── All searchable items ─────────────────────────────────────────────────────
  const items: SearchItem[] = useMemo(() => {
    const result: SearchItem[] = [];
    const c = (group: string) => GROUP_COLORS[group] ?? 'bg-muted text-muted-foreground';

    // ── Always available ──────────────────────────────────────────
    result.push(
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Navigation', groupColor: c('Navigation'), action: () => go('dashboard', 'Dashboard'), keywords: ['home', 'main', 'overview'] },
      { id: 'profile', label: 'My Profile', description: 'View and edit your profile', icon: User, group: 'Account', groupColor: c('Account'), action: () => goTo('/profile', 'My Profile'), keywords: ['account', 'me', 'photo', 'password'] },
      { id: 'settings', label: 'Settings', icon: Settings, group: 'Account', groupColor: c('Account'), action: () => goTo('/settings', 'Settings'), keywords: ['preferences', 'config', 'theme', 'dark mode'] },
      { id: 'id-cards', label: 'ID Cards', icon: IdCard, group: 'Services', groupColor: c('Services'), action: () => goTo('/id-cards', 'ID Cards'), keywords: ['card', 'identity', 'print'] },
      { id: 'all-notifications', label: 'All Notifications', icon: Bell, group: 'Navigation', groupColor: c('Navigation'), action: () => goTo('/all-notifications', 'All Notifications'), keywords: ['alerts', 'messages', 'unread'] },
    );

    if (currentInstituteId) {
      result.push(
        { id: 'institute-profile', label: 'Institute Profile', description: selectedInstitute?.name, icon: Building2, group: 'Institute', groupColor: c('Institute'), action: () => go('institute-profile', 'Institute Profile'), keywords: ['school', 'info', 'about'] },
        { id: 'institute-notifications', label: 'Institute Notifications', icon: Bell, group: 'Institute', groupColor: c('Institute'), action: () => go('institute-notifications', 'Institute Notifications'), keywords: ['alerts', 'news'] },
      );

      // ── Institute Admin ──────────────────────────────────────────
      if (userRole === 'InstituteAdmin') {
        const hasSmartCards = isFeatureEnabled('smart-cards');
        const hasDesigns = isFeatureEnabled('institute-designs');
        const hasFinanceHub = isFeatureEnabled('suraksha-finance');

        result.push(
          // Quick actions at top
          { id: 'create-user', label: 'Create New User', description: 'Register a student, teacher, or staff member', icon: UserPlus, group: 'Quick Actions', groupColor: c('Quick Actions'), action: () => goTo(`/institute-users/${currentInstituteId}/create`, 'Create New User'), keywords: ['add user', 'new user', 'register', 'enroll', 'invite', 'student', 'teacher'] },
          { id: 'add-student-institute', label: 'Add Student to Institute', description: 'Assign a student to this institute', icon: UserPlus, group: 'Quick Actions', groupColor: c('Quick Actions'), action: () => openEnroll('institute'), keywords: ['add student', 'enroll student', 'assign student', 'institute enrollment', 'new student'] },
          { id: 'add-student-class', label: `Add Student to ${classLabel}`, description: `Assign a student to a ${classLabel.toLowerCase()}`, icon: UserPlus, group: 'Quick Actions', groupColor: c('Quick Actions'), action: () => openEnroll('class'), keywords: ['add student class', 'enroll class', 'assign class', 'student class'] },
          { id: 'add-student-subject', label: `Add Student to ${subjectLabel}`, description: `Enroll a student in a ${subjectLabel.toLowerCase()}`, icon: UserPlus, group: 'Quick Actions', groupColor: c('Quick Actions'), action: () => openEnroll('subject'), keywords: ['add student subject', 'enroll subject', 'month', 'module', 'assign subject'] },
          { id: 'mark-attendance', label: 'Mark Attendance', description: 'QR code / RFID / Manual entry', icon: QrCode, group: 'Quick Actions', groupColor: c('Quick Actions'), action: () => go('select-attendance-mark-type', 'Mark Attendance'), keywords: ['qr', 'rfid', 'scan', 'check in'] },
          { id: 'send-sms', label: 'Send Bulk SMS', description: 'Send message to multiple users', icon: Megaphone, group: 'Quick Actions', groupColor: c('Quick Actions'), action: () => go('sms', 'Send Bulk SMS'), keywords: ['message', 'notify', 'broadcast'] },

          // Manage users
          { id: 'institute-users', label: 'All Users', description: 'Students, teachers & staff', icon: Users, group: 'Manage Users', groupColor: c('Manage Users'), action: () => go('institute-users', 'All Users'), keywords: ['staff', 'students', 'teachers', 'list', 'manage'] },
          { id: 'parents', label: 'Parents / Guardians', icon: Users, group: 'Manage Users', groupColor: c('Manage Users'), action: () => go('parents', 'Parents'), keywords: ['guardian', 'family'] },
          { id: 'verify-image', label: 'Verify Profile Photos', icon: ShieldCheck, group: 'Manage Users', groupColor: c('Manage Users'), action: () => go('verify-image', 'Verify Profile Photos'), keywords: ['approve', 'image', 'photo', 'pending', 'review'] },

          // Academics
          { id: 'classes', label: `All ${classLabel}s`, icon: School, group: 'Academics', groupColor: c('Academics'), action: () => go('classes', `All ${classLabel}s`), keywords: ['class list', 'grade', classLabel.toLowerCase()] },
          { id: 'institute-subjects', label: `Institute ${subjectLabel}s`, icon: BookOpen, group: 'Academics', groupColor: c('Academics'), action: () => go('institute-subjects', `Institute ${subjectLabel}s`), keywords: ['subject list', 'course', subjectLabel.toLowerCase()] },
          { id: 'institute-lectures', label: 'Institute Lectures', icon: Video, group: 'Academics', groupColor: c('Academics'), action: () => go('institute-lectures', 'Institute Lectures'), keywords: ['video', 'recording', 'online class'] },
          { id: 'houses', label: 'Houses', icon: Flag, group: 'Academics', groupColor: c('Academics'), action: () => go('houses', 'Houses'), keywords: ['team', 'group', 'prefect'] },
          { id: 'institute-organizations', label: 'Organizations', icon: Building2, group: 'Academics', groupColor: c('Academics'), action: () => go('institute-organizations', 'Organizations'), keywords: ['club', 'society'] },

          // Attendance (institute-level, only when no class selected)
          ...(!selectedClass ? [
            { id: 'daily-attendance', label: 'Institute Attendance Log', icon: ClipboardList, group: 'Attendance', groupColor: c('Attendance'), action: () => go('daily-attendance', 'Institute Attendance Log'), keywords: ['log', 'daily', 'report'] },
            { id: 'admin-attendance', label: 'Advanced Attendance', description: 'Analytics and detailed reports', icon: BarChart3, group: 'Attendance', groupColor: c('Attendance'), action: () => go('admin-attendance', 'Advanced Attendance'), keywords: ['reports', 'stats', 'analytics'] },
            { id: 'calendar-view', label: 'Attendance Calendar', icon: Calendar, group: 'Attendance', groupColor: c('Attendance'), action: () => go('calendar-view', 'Attendance Calendar'), keywords: ['month', 'calendar', 'schedule'] },
            { id: 'calendar-management', label: 'Manage Calendar', icon: CalendarDays, group: 'Attendance', groupColor: c('Attendance'), action: () => go('calendar-management', 'Manage Calendar'), keywords: ['holiday', 'events', 'schedule', 'edit'] },
          ] as SearchItem[] : []),
          { id: 'my-attendance', label: 'My Attendance', icon: UserCheck, group: 'Attendance', groupColor: c('Attendance'), action: () => go('my-attendance', 'My Attendance') },

          // Payments (institute-level only)
          ...(!selectedClass ? [
            { id: 'institute-payments', label: 'Institute Fees', icon: CreditCard, group: 'Payments', groupColor: c('Payments'), action: () => go('institute-payments', 'Institute Fees'), keywords: ['fees', 'money', 'dues', 'pay'] },
            { id: 'collect-physical-payment', label: 'Collect Payment', description: 'Record a cash or manual payment', icon: Banknote, group: 'Payments', groupColor: c('Payments'), action: () => go('collect-physical-payment', 'Collect Payment'), keywords: ['cash', 'manual', 'record', 'receipt'] },
            { id: 'institute-billing', label: 'Billing & Plan', icon: Receipt, group: 'Payments', groupColor: c('Payments'), action: () => go('institute-billing', 'Billing & Plan'), keywords: ['subscription', 'upgrade', 'plan', 'invoice'] },
            { id: 'institute-credits', label: 'Institute Wallet', description: 'SMS & credit balance', icon: Wallet, group: 'Payments', groupColor: c('Payments'), action: () => go('institute-credits', 'Institute Wallet'), keywords: ['wallet', 'balance', 'credits', 'topup', 'sms credits'] },
            ...(hasFinanceHub ? [
              { id: 'finance-hub', label: 'Finance Hub', icon: Layers, group: 'Payments', groupColor: c('Payments'), action: () => go('finance-hub', 'Finance Hub'), keywords: ['finance', 'revenue', 'reports', 'analytics'] },
            ] as SearchItem[] : []),
          ] as SearchItem[] : [
            { id: 'class-payments', label: `${classLabel} Fees`, icon: CreditCard, group: 'Payments', groupColor: c('Payments'), action: () => go('class-payments', `${classLabel} Fees`), keywords: ['fees', 'class', 'pay'] },
            { id: 'collect-physical-payment', label: 'Collect Payment', description: 'Record a cash or manual payment', icon: Banknote, group: 'Payments', groupColor: c('Payments'), action: () => go('collect-physical-payment', 'Collect Payment'), keywords: ['cash', 'manual', 'record'] },
          ] as SearchItem[]),

          // Communication
          { id: 'sms-history', label: 'SMS History', icon: ListChecks, group: 'Communication', groupColor: c('Communication'), action: () => go('sms-history', 'SMS History'), keywords: ['sent', 'messages log'] },

          // Designs (feature-gated)
          ...(hasDesigns ? [
            { id: 'institute-designs', label: 'Designs', description: 'ID cards, certificates & templates', icon: Palette, group: 'Institute', groupColor: c('Institute'), action: () => go('institute-designs', 'Designs'), keywords: ['template', 'certificate', 'id card design', 'birthday', 'card'] },
          ] as SearchItem[] : []),

          // Smart Cards (feature-gated, institute-level only)
          ...(hasSmartCards && !selectedClass ? [
            { id: 'manage-smart-cards', label: 'Manage Smart Cards', description: 'Issue and manage smart cards', icon: CreditCard, group: 'Institute', groupColor: c('Institute'), action: () => go('manage-smart-cards', 'Manage Smart Cards'), keywords: ['rfid', 'nfc', 'card', 'suraksha card'] },
          ] as SearchItem[] : []),

          // Institute settings
          { id: 'institute-settings', label: 'Institute Settings', icon: Settings, group: 'Institute', groupColor: c('Institute'), action: () => go('institute-settings', 'Institute Settings'), keywords: ['config', 'manage institute', 'branding'] },
          { id: 'device-management', label: 'Device Management', icon: Wifi, group: 'Institute', groupColor: c('Institute'), action: () => go('device-management', 'Device Management'), keywords: ['devices', 'rfid readers', 'scanner'] },

          // Navigation
          { id: 'select-class', label: `Select ${classLabel}`, icon: School, group: 'Navigation', groupColor: c('Navigation'), action: () => go('select-class', `Select ${classLabel}`) },
          { id: 'select-subject', label: `Select ${subjectLabel}`, icon: BookOpen, group: 'Navigation', groupColor: c('Navigation'), action: () => go('select-subject', `Select ${subjectLabel}`) },
        );

        if (selectedClass) {
          result.push(
            { id: 'students', label: 'Class Students', icon: GraduationCap, group: 'Manage Users', groupColor: c('Manage Users'), action: () => go('students', 'Class Students') },
            { id: 'unverified-students', label: 'Pending Students', description: 'Students awaiting verification', icon: UserCheck, group: 'Manage Users', groupColor: c('Manage Users'), action: () => go('unverified-students', 'Pending Students'), keywords: ['approve', 'verify', 'pending'] },
            { id: 'class-daily-attendance', label: `${classLabel} Attendance`, icon: ClipboardList, group: 'Attendance', groupColor: c('Attendance'), action: () => go('daily-attendance', `${classLabel} Attendance`), keywords: ['daily', 'log', 'report'] },
            { id: 'class-study-materials', label: 'Study Materials', description: 'Files and resources for this class', icon: FileText, group: 'Academics', groupColor: c('Academics'), action: () => go('study-materials', 'Study Materials'), keywords: ['files', 'resources', 'documents', 'download'] },
          );
          if (selectedSubject) {
            result.push(
              { id: 'lectures', label: 'Lectures', icon: Video, group: 'Academics', groupColor: c('Academics'), action: () => go('lectures', 'Lectures') },
              { id: 'free-lectures', label: 'Free Lectures', icon: Video, group: 'Academics', groupColor: c('Academics'), action: () => go('free-lectures', 'Free Lectures') },
              { id: 'homework', label: 'Homework', icon: Notebook, group: 'Academics', groupColor: c('Academics'), action: () => go('homework', 'Homework'), keywords: ['assignments', 'tasks', 'due'] },
              { id: 'exams', label: 'Exams / Results', icon: Award, group: 'Academics', groupColor: c('Academics'), action: () => go('exams', 'Exams'), keywords: ['results', 'test', 'marks', 'grades'] },
              { id: 'subject-study-materials', label: `${subjectLabel} Study Materials`, icon: FileText, group: 'Academics', groupColor: c('Academics'), action: () => go('study-materials', `${subjectLabel} Study Materials`), keywords: ['files', 'resources', 'notes'] },
            );
          }
        }
      }

      // ── Teacher ──────────────────────────────────────────────────
      if (userRole === 'Teacher') {
        result.push(
          { id: 'mark-attendance', label: 'Mark Attendance', description: 'QR code / RFID / Manual entry', icon: QrCode, group: 'Quick Actions', groupColor: c('Quick Actions'), action: () => go('select-attendance-mark-type', 'Mark Attendance'), keywords: ['qr', 'rfid', 'scan'] },
          { id: 'my-attendance', label: 'My Attendance', icon: UserCheck, group: 'Attendance', groupColor: c('Attendance'), action: () => go('my-attendance', 'My Attendance') },
          { id: 'institute-lectures', label: 'Institute Lectures', icon: Video, group: 'Academics', groupColor: c('Academics'), action: () => go('institute-lectures', 'Institute Lectures') },
          { id: 'select-class', label: `Select ${classLabel}`, icon: School, group: 'Navigation', groupColor: c('Navigation'), action: () => go('select-class', `Select ${classLabel}`) },
          { id: 'select-subject', label: `Select ${subjectLabel}`, icon: BookOpen, group: 'Navigation', groupColor: c('Navigation'), action: () => go('select-subject', `Select ${subjectLabel}`) },
        );
        if (selectedClass) {
          result.push(
            { id: 'students', label: 'Class Students', icon: GraduationCap, group: 'Manage Users', groupColor: c('Manage Users'), action: () => go('students', 'Class Students') },
            { id: 'unverified-students', label: 'Pending Students', icon: UserCheck, group: 'Manage Users', groupColor: c('Manage Users'), action: () => go('unverified-students', 'Pending Students'), keywords: ['approve', 'verify'] },
            { id: 'daily-attendance', label: 'Attendance Log', icon: ClipboardList, group: 'Attendance', groupColor: c('Attendance'), action: () => go('daily-attendance', 'Attendance Log') },
            { id: 'class-study-materials', label: 'Study Materials', icon: FileText, group: 'Academics', groupColor: c('Academics'), action: () => go('study-materials', 'Study Materials'), keywords: ['files', 'resources', 'documents'] },
          );
          if (selectedSubject) {
            result.push(
              { id: 'lectures', label: 'Lectures', icon: Video, group: 'Academics', groupColor: c('Academics'), action: () => go('lectures', 'Lectures') },
              { id: 'free-lectures', label: 'Free Lectures', icon: Video, group: 'Academics', groupColor: c('Academics'), action: () => go('free-lectures', 'Free Lectures') },
              { id: 'homework', label: 'Homework', icon: Notebook, group: 'Academics', groupColor: c('Academics'), action: () => go('homework', 'Homework'), keywords: ['assignments', 'tasks'] },
              { id: 'exams', label: 'Exams / Results', icon: Award, group: 'Academics', groupColor: c('Academics'), action: () => go('exams', 'Exams'), keywords: ['results', 'marks', 'grades'] },
            );
          }
        }
      }

      // ── Student ──────────────────────────────────────────────────
      if (userRole === 'Student') {
        result.push(
          { id: 'my-attendance', label: 'My Attendance', icon: UserCheck, group: 'Attendance', groupColor: c('Attendance'), action: () => go('my-attendance', 'My Attendance') },
          { id: 'calendar-view', label: 'Attendance Calendar', icon: Calendar, group: 'Attendance', groupColor: c('Attendance'), action: () => go('calendar-view', 'Attendance Calendar') },
          { id: 'institute-payments', label: 'Institute Fees', icon: CreditCard, group: 'Payments', groupColor: c('Payments'), action: () => go('institute-payments', 'Institute Fees'), keywords: ['fees', 'pay', 'dues'] },
          { id: 'my-submissions', label: 'My Fee Submissions', icon: FileText, group: 'Payments', groupColor: c('Payments'), action: () => go('my-submissions', 'My Fee Submissions'), keywords: ['paid', 'fees', 'receipt', 'history'] },
          { id: 'institute-lectures', label: 'Institute Lectures', icon: Video, group: 'Academics', groupColor: c('Academics'), action: () => go('institute-lectures', 'Institute Lectures') },
          { id: 'select-class', label: `Select ${classLabel}`, icon: School, group: 'Navigation', groupColor: c('Navigation'), action: () => go('select-class', `Select ${classLabel}`) },
        );
        if (selectedClass) {
          result.push(
            { id: 'class-study-materials', label: 'Study Materials', icon: FileText, group: 'Academics', groupColor: c('Academics'), action: () => go('study-materials', 'Study Materials'), keywords: ['files', 'notes', 'resources'] },
          );
        }
        if (selectedSubject) {
          result.push(
            { id: 'lectures', label: 'Lectures', icon: Video, group: 'Academics', groupColor: c('Academics'), action: () => go('lectures', 'Lectures') },
            { id: 'free-lectures', label: 'Free Lectures', icon: Video, group: 'Academics', groupColor: c('Academics'), action: () => go('free-lectures', 'Free Lectures') },
            { id: 'homework', label: 'Homework', icon: Notebook, group: 'Academics', groupColor: c('Academics'), action: () => go('homework', 'Homework'), keywords: ['assignments', 'tasks', 'due'] },
            { id: 'exams', label: 'Exams / Results', icon: Award, group: 'Academics', groupColor: c('Academics'), action: () => go('exams', 'Exams / Results'), keywords: ['marks', 'grades', 'test'] },
          );
        }
      }

      // ── Parent ───────────────────────────────────────────────────
      if (userRole === 'Parent') {
        result.push(
          { id: 'my-children', label: 'My Children', description: 'Switch to child view', icon: Users, group: 'Navigation', groupColor: c('Navigation'), action: () => goTo('/my-children', 'My Children'), keywords: ['kids', 'students', 'child'] },
        );
      }
    }

    return result;
  }, [userRole, currentInstituteId, selectedClass?.id, selectedSubject?.id, subjectLabel, classLabel, selectedInstitute?.name, openEnroll, go, goTo, isFeatureEnabled]);

  // ── Group items ───────────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, SearchItem[]>();
    for (const item of items) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    const order = ['Quick Actions', 'Navigation', 'Manage Users', 'Academics', 'Attendance', 'Payments', 'Communication', 'Institute', 'Services', 'Account'];
    const sorted = new Map<string, SearchItem[]>();
    for (const key of order) {
      if (map.has(key)) sorted.set(key, map.get(key)!);
    }
    for (const [key, val] of map) {
      if (!sorted.has(key)) sorted.set(key, val);
    }
    return sorted;
  }, [items]);

  // ── Recent items that match existing items ────────────────────────────────────
  const recentWithMeta = useMemo(() => {
    return recent.slice(0, 5);
  }, [recent]);

  // ── Keyboard shortcut Ctrl+K / Cmd+K ─────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        if (e.key === '/' && ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const instituteName = selectedInstitute?.shortName || selectedInstitute?.name;

  return (
    <>
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {/* Header with context badge */}
      <div className="flex items-center border-b border-border/60 px-3 gap-2 bg-muted/40">
        <Search className="h-4 w-4 shrink-0 text-primary" />
        <CommandInput
          placeholder="Search pages, actions, features, payments…"
          value={query}
          onValueChange={setQuery}
          className="border-0 focus:ring-0 px-0"
        />
        {instituteName && (
          <span className="shrink-0 text-[11px] px-2.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold border border-primary/20">
            {instituteName}
          </span>
        )}
      </div>

      <CommandList className="max-h-[420px]">
        <CommandEmpty>
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Search className="h-5 w-5 opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">No results for "{query}"</p>
              <p className="text-xs mt-1 opacity-70">Try "users", "attendance", "fees" or "create"</p>
            </div>
            {/* Suggest quick actions as chips */}
            <div className="flex flex-wrap gap-1.5 justify-center mt-1">
              {['Attendance', 'Users', 'Fees', 'Designs', 'SMS'].map(s => (
                <button
                  key={s}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-muted text-foreground transition-colors"
                  onMouseDown={(e) => { e.preventDefault(); setQuery(s.toLowerCase()); }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </CommandEmpty>

        {/* Recent section — only when not searching */}
        {!query && recentWithMeta.length > 0 && (
          <>
            <CommandGroup
              heading={
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Recently Visited
                  </span>
                  <button
                    onMouseDown={clearRecent}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1"
                  >
                    Clear
                  </button>
                </div>
              }
            >
              {recentWithMeta.map((entry) => (
                <CommandItem
                  key={entry.id + entry.timestamp}
                  value={`recent ${entry.label}`}
                  onSelect={() => { navigate(entry.path); onOpenChange(false); }}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg mx-1 data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-sm ${GROUP_COLORS['Recent']}`}>
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm flex-1 truncate text-foreground">{entry.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-data-[selected=true]/item:text-primary/60 shrink-0" />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* All grouped items */}
        {Array.from(grouped.entries()).map(([group, groupItems], idx) => (
          <React.Fragment key={`${group}-${idx}`}>
            {(idx > 0 || (!query && recentWithMeta.length === 0)) && idx > 0 && <CommandSeparator />}
            <CommandGroup heading={
              <span className="flex items-center gap-1.5">
                {group === 'Quick Actions' && <Zap className="h-3 w-3 text-orange-500" />}
                {group}
              </span>
            }>
              {groupItems.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.description || ''} ${item.keywords?.join(' ') || ''} ${group}`}
                    onSelect={item.action}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer group/item rounded-lg mx-1 data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary dark:data-[selected=true]:bg-primary/20"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm ${item.groupColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      {item.description && (
                        <span className="text-xs text-muted-foreground/80 truncate">{item.description}</span>
                      )}
                    </div>
                    {item.badge && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {item.badge}
                      </span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 group-data-[selected=true]/item:text-primary/60 transition-colors shrink-0" />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground bg-muted/50">
        <span className="flex items-center gap-2">
          <span><kbd className="rounded border border-border/80 px-1.5 py-0.5 font-mono text-[10px] bg-background shadow-sm">↑↓</kbd> navigate</span>
          <span><kbd className="rounded border border-border/80 px-1.5 py-0.5 font-mono text-[10px] bg-background shadow-sm">↵</kbd> select</span>
          <span><kbd className="rounded border border-border/80 px-1.5 py-0.5 font-mono text-[10px] bg-background shadow-sm">Esc</kbd> close</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border/80 px-1.5 py-0.5 font-mono text-[10px] bg-background shadow-sm">Ctrl</kbd>
          <kbd className="rounded border border-border/80 px-1.5 py-0.5 font-mono text-[10px] bg-background shadow-sm">K</kbd>
          <span className="ml-1">to open</span>
        </span>
      </div>
    </CommandDialog>

    <StudentEnrollDrilldown
      open={enrollOpen}
      onOpenChange={setEnrollOpen}
      startStep={enrollStep}
    />
    </>
  );
};

export default GlobalSearch;
