import React from 'react';

export interface DayTypeMeta {
  dot: string;
  bg: string;
  text: string;
  label: string;
}

export const DAY_TYPE_META: Record<string, DayTypeMeta> = {
  REGULAR: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', label: 'Regular' },
  WEEKEND: { dot: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-400', label: 'Weekend' },
  PUBLIC_HOLIDAY: { dot: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-700 dark:text-red-400', label: 'Holiday' },
  INSTITUTE_HOLIDAY: { dot: 'bg-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-700 dark:text-orange-400', label: 'Inst. Holiday' },
  HALF_DAY: { dot: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400', label: 'Half Day' },
  EXAM_DAY: { dot: 'bg-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-700 dark:text-purple-400', label: 'Exam' },
  STAFF_ONLY: { dot: 'bg-slate-400', bg: 'bg-slate-500/10', text: 'text-slate-700 dark:text-slate-400', label: 'Staff Only' },
  SPECIAL_EVENT: { dot: 'bg-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-700 dark:text-cyan-400', label: 'Special' },
  CANCELLED: { dot: 'bg-slate-500', bg: 'bg-slate-500/10', text: 'text-slate-500', label: 'Cancelled' },
};

export const getDayTypeMeta = (dayType: string): DayTypeMeta => {
  return DAY_TYPE_META[dayType] || DAY_TYPE_META.REGULAR;
};

export const renderAttendanceStatusBadge = (status: string) => {
  switch (status) {
    case 'present':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500 text-white">Present</span>;
    case 'absent':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white">Absent</span>;
    case 'late':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500 text-white">Late</span>;
    case 'left':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500 text-white">Left</span>;
    case 'left_early':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pink-500 text-white">Left Early</span>;
    case 'left_lately':
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500 text-white">Left Late</span>;
    default:
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">—</span>;
  }
};
