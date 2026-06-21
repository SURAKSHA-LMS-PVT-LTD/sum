import { useState, useCallback } from 'react';
import { useFeatures } from '@/contexts/FeaturesContext';

export interface FeatureDef {
  id: string;
  label: string;
  color: string;
  description: string;
  icon: string;
}

// All possible navigable features across all levels
export const FEATURE_CATALOG: Record<string, FeatureDef> = {
  'classes':                  { id: 'classes',                  label: 'All Classes',         color: 'bg-violet-500',  description: 'Manage all classes',            icon: 'School' },
  'institute-subjects':       { id: 'institute-subjects',       label: 'All Subjects',        color: 'bg-indigo-500',  description: 'Manage all subjects',           icon: 'BookOpen' },
  'institute-lectures':       { id: 'institute-lectures',       label: 'Lectures',            color: 'bg-blue-500',    description: 'Browse lectures',               icon: 'Video' },
  'select-attendance-mark-type': { id: 'select-attendance-mark-type', label: 'Mark Attendance', color: 'bg-cyan-500', description: 'Choose QR, Barcode, or RFID', icon: 'QrCode' },
  'qr-attendance':            { id: 'qr-attendance',            label: 'Mark Attendance',     color: 'bg-cyan-500',    description: 'Mark via QR / Barcode',         icon: 'QrCode' },
  'daily-attendance':         { id: 'daily-attendance',         label: 'Institute Attendance', color: 'bg-blue-600',    description: 'Daily attendance records',       icon: 'ClipboardList' },
  'admin-attendance':         { id: 'admin-attendance',         label: 'Advanced Attendance',  color: 'bg-indigo-500',  description: 'Institute-wide overview',        icon: 'BarChart3' },
  'calendar-view':            { id: 'calendar-view',            label: 'Calendar',            color: 'bg-emerald-500', description: 'Attendance calendar',            icon: 'Calendar' },
  'calendar-management':      { id: 'calendar-management',      label: 'Manage Calendar',     color: 'bg-emerald-600', description: 'Manage academic calendar',        icon: 'CalendarDays' },
  'sms':                      { id: 'sms',                      label: 'Send SMS',            color: 'bg-sky-500',     description: 'Send messages to users',         icon: 'MessageSquare' },
  'sms-history':              { id: 'sms-history',              label: 'SMS History',         color: 'bg-sky-600',     description: 'View sent messages',             icon: 'MessageSquare' },
  'institute-payments':       { id: 'institute-payments',       label: 'Institute Fees',      color: 'bg-amber-500',   description: 'Manage institute fees',          icon: 'CreditCard' },
  'pending-submissions':      { id: 'pending-submissions',      label: 'Review Payments',     color: 'bg-orange-500',  description: 'Approve pending payments',        icon: 'Clock' },
  'institute-users':          { id: 'institute-users',          label: 'All Users',           color: 'bg-blue-500',    description: 'View all members',               icon: 'Users' },
  'parents':                  { id: 'parents',                  label: 'Parents',             color: 'bg-teal-500',    description: 'Parent accounts',                icon: 'Users' },
  'institute-settings':       { id: 'institute-settings',       label: 'Settings',            color: 'bg-slate-500',   description: 'Institute settings',             icon: 'Settings' },
  'device-management':        { id: 'device-management',        label: 'Devices',             color: 'bg-emerald-500', description: 'Manage connected devices',        icon: 'Wifi' },
  'institute-notifications':  { id: 'institute-notifications',  label: 'Notifications',       color: 'bg-purple-500',  description: 'Institute push notifications',   icon: 'Bell' },
  'unverified-students':      { id: 'unverified-students',      label: 'Pending Students',    color: 'bg-amber-500',   description: 'Awaiting approval',              icon: 'UserCheck' },
  'verify-image':             { id: 'verify-image',             label: 'Verify Photos',       color: 'bg-pink-500',    description: 'Approve profile photos',         icon: 'ImageIcon' },
  'class-subjects':           { id: 'class-subjects',           label: 'Subjects',            color: 'bg-indigo-400',  description: 'Subjects in this class',         icon: 'BookOpen' },
  'students':                 { id: 'students',                 label: 'Students',            color: 'bg-indigo-500',  description: 'View enrolled students',         icon: 'GraduationCap' },
  'lectures':                 { id: 'lectures',                 label: 'Lectures',            color: 'bg-blue-600',    description: 'Subject lectures',               icon: 'Video' },
  'free-lectures':            { id: 'free-lectures',            label: 'Free Lectures',       color: 'bg-teal-500',    description: 'Available to all',               icon: 'Video' },
  'homework':                 { id: 'homework',                 label: 'Homework',            color: 'bg-amber-500',   description: 'Assignments & tasks',            icon: 'Notebook' },
  'exams':                    { id: 'exams',                    label: 'Exams',               color: 'bg-rose-500',    description: 'Examinations & results',         icon: 'Award' },
  'subject-payments':         { id: 'subject-payments',         label: 'Subject Fees',        color: 'bg-amber-600',   description: 'Subject fee details',            icon: 'CreditCard' },
  'my-attendance':            { id: 'my-attendance',            label: 'My Attendance',       color: 'bg-cyan-500',    description: 'Your attendance history',        icon: 'UserCheck' },
  
  'rfid-attendance':          { id: 'rfid-attendance',          label: 'RFID Attendance',     color: 'bg-purple-500',  description: 'Mark via RFID',                  icon: 'Wifi' },
  'structured-lectures':      { id: 'structured-lectures',      label: 'Structured Lectures', color: 'bg-blue-400',    description: 'Structured lecture management',  icon: 'Video' },
  'study-materials':          { id: 'study-materials',          label: 'Study Materials',     color: 'bg-emerald-500', description: 'Class study materials & folders', icon: 'FileText' },
};

// Default pinned IDs per level per role
const ROLE_DEFAULTS: Record<string, Record<string, string[]>> = {
  institute: {
    InstituteAdmin:   ['select-attendance-mark-type', 'classes', 'institute-subjects', 'institute-lectures', 'daily-attendance', 'admin-attendance', 'sms', 'institute-payments', 'pending-submissions'],
    Teacher:          ['select-attendance-mark-type', 'daily-attendance', 'classes', 'institute-lectures'],
    Student:          ['institute-lectures', 'my-attendance'],
    AttendanceMarker: ['select-attendance-mark-type', 'daily-attendance'],
    Parent:           ['institute-lectures'],
  },
  class: {
    InstituteAdmin:   ['select-attendance-mark-type', 'class-subjects', 'students', 'daily-attendance', 'unverified-students', 'study-materials'],
    Teacher:          ['select-attendance-mark-type', 'daily-attendance', 'students', 'study-materials'],
    Student:          ['my-attendance', 'class-subjects', 'study-materials'],
    AttendanceMarker: ['select-attendance-mark-type', 'daily-attendance'],
    Parent:           [],
  },
  subject: {
    InstituteAdmin:   ['select-attendance-mark-type', 'lectures', 'homework', 'exams', 'students'],
    Teacher:          ['select-attendance-mark-type', 'lectures', 'homework', 'exams', 'students'],
    Student:          ['lectures', 'homework', 'exams', 'calendar-view'],
    AttendanceMarker: ['select-attendance-mark-type'],
    Parent:           ['lectures', 'homework', 'exams'],
  },
};

// Features available (accessible) per level per role
const ROLE_AVAILABLE: Record<string, Record<string, string[]>> = {
  institute: {
    InstituteAdmin:   ['classes', 'institute-subjects', 'institute-lectures', 'structured-lectures', 'select-attendance-mark-type', 'qr-attendance', 'rfid-attendance', 'daily-attendance', 'admin-attendance', 'sms', 'sms-history', 'institute-payments', 'pending-submissions', 'institute-users', 'parents', 'institute-settings', 'device-management', 'institute-notifications', 'unverified-students', 'verify-image', 'calendar-view', 'calendar-management'],
    Teacher:          ['classes', 'institute-subjects', 'institute-lectures', 'structured-lectures', 'select-attendance-mark-type', 'qr-attendance', 'rfid-attendance', 'daily-attendance', 'calendar-view', 'institute-payments'],
    Student:          ['institute-lectures', 'structured-lectures', 'my-attendance', 'calendar-view'],
    AttendanceMarker: ['select-attendance-mark-type', 'qr-attendance', 'rfid-attendance', 'daily-attendance', 'calendar-view'],
    Parent:           ['institute-lectures'],
  },
  class: {
    InstituteAdmin:   ['class-subjects', 'students', 'select-attendance-mark-type', 'qr-attendance', 'rfid-attendance', 'daily-attendance', 'unverified-students', 'calendar-view', 'institute-lectures', 'study-materials'],
    Teacher:          ['class-subjects', 'students', 'select-attendance-mark-type', 'qr-attendance', 'rfid-attendance', 'daily-attendance', 'calendar-view', 'study-materials'],
    Student:          ['my-attendance', 'class-subjects', 'calendar-view', 'study-materials'],
    AttendanceMarker: ['select-attendance-mark-type', 'qr-attendance', 'rfid-attendance', 'daily-attendance'],
    Parent:           [],
  },
  subject: {
    InstituteAdmin:   ['lectures', 'free-lectures', 'structured-lectures', 'homework', 'exams', 'students', 'calendar-view', 'select-attendance-mark-type', 'qr-attendance'],
    Teacher:          ['lectures', 'free-lectures', 'structured-lectures', 'homework', 'exams', 'students', 'calendar-view', 'select-attendance-mark-type'],
    Student:          ['lectures', 'free-lectures', 'structured-lectures', 'homework', 'exams', 'calendar-view'],
    AttendanceMarker: ['select-attendance-mark-type', 'qr-attendance'],
    Parent:           ['lectures', 'free-lectures', 'homework', 'exams'],
  },
};

export type DashboardLevel = 'institute' | 'class' | 'subject';

export const useDashboardFeatures = (level: DashboardLevel, userRole: string) => {
  const { isFeatureEnabled } = useFeatures();
  const storageKey = `dash_features_${level}_${userRole}`;

  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) return JSON.parse(stored);
    } catch {}
    return ROLE_DEFAULTS[level]?.[userRole] ?? [];
  });

  const togglePin = useCallback((id: string) => {
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [storageKey]);

  const resetToDefaults = useCallback(() => {
    const defaults = ROLE_DEFAULTS[level]?.[userRole] ?? [];
    setPinnedIds(defaults);
    try { localStorage.setItem(storageKey, JSON.stringify(defaults)); } catch {}
  }, [level, userRole, storageKey]);

  const roleAvailableIds = (ROLE_AVAILABLE[level]?.[userRole] ?? []).filter(isFeatureEnabled);
  const pinnedFeatures = pinnedIds
    .filter(id => isFeatureEnabled(id))
    .map(id => FEATURE_CATALOG[id])
    .filter(Boolean);
  const availableToAdd = roleAvailableIds
    .filter(id => !pinnedIds.includes(id))
    .map(id => FEATURE_CATALOG[id])
    .filter(Boolean);

  return { pinnedIds, pinnedFeatures, togglePin, resetToDefaults, availableToAdd };
};
