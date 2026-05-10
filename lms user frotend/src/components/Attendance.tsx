import * as React from 'react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Filter, LayoutGrid, Table2, List, CalendarDays, BarChart2, TableProperties, CalendarClock, Download, FileText } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import ClassAttendanceSessions from '@/components/class-sessions/ClassAttendanceSessions';
import { AttendanceMatrixView } from '@/pages/AttendanceMatrixPage';
import { useViewMode } from '@/hooks/useViewMode';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';
import { useRefreshWithCooldown } from '@/hooks/useRefreshWithCooldown';
import { useToast } from '@/hooks/use-toast';
import { instituteStudentsApi, StudentAttendanceRecord, StudentAttendanceResponse } from '@/api/instituteStudents.api';
import { childAttendanceApi, ChildAttendanceRecord } from '@/api/childAttendance.api';
import AttendanceFilters, { AttendanceFilterParams } from '@/components/AttendanceFilters';
import { getAttendanceStatusConfig, ATTENDANCE_CHART_COLORS, normalizeAttendanceSummary } from '@/types/attendance.types';
import adminAttendanceApi, { MonthlyAttendanceCount, DailyAttendanceDayCount } from '@/api/adminAttendance.api';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

// ── Read institute theme colour from CSS variable --primary (HSL → hex) ─────────
function getThemeHex(fallback = '#4c32e9'): string {
  try {
    const hsl = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    if (!hsl) return fallback;
    const parts = hsl.replace(/%/g, '').split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return fallback;
    const [h, s, l] = [parts[0], parts[1] / 100, parts[2] / 100];
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch { return fallback; }
}

type AttendanceRow = import('@/api/instituteStudents.api').StudentAttendanceRecord;

// ── STATUS colour maps ────────────────────────────────────────────────────
const EXCEL_STATUS_COLOUR: Record<string, { bg: string; fg: string; label: string }> = {
  PRESENT:     { bg: 'C6EFCE', fg: '375623', label: 'Present' },
  LATE:        { bg: 'FFEB9C', fg: '9C5700', label: 'Late' },
  ABSENT:      { bg: 'FFC7CE', fg: '9C0006', label: 'Absent' },
  LEFT:        { bg: 'BDD7EE', fg: '1F497D', label: 'Left' },
  LEFT_EARLY:  { bg: 'FFD9C0', fg: '833C00', label: 'Left Early' },
  LEFT_LATELY: { bg: 'E2D9F3', fg: '5B3896', label: 'Left Lately' },
};
const PDF_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PRESENT:     { label: 'Present',     color: '#375623', bg: '#C6EFCE' },
  LATE:        { label: 'Late',        color: '#9C5700', bg: '#FFEB9C' },
  ABSENT:      { label: 'Absent',      color: '#9C0006', bg: '#FFC7CE' },
  LEFT:        { label: 'Left',        color: '#1F497D', bg: '#BDD7EE' },
  LEFT_EARLY:  { label: 'Left Early',  color: '#833C00', bg: '#FFD9C0' },
  LEFT_LATELY: { label: 'Left Lately', color: '#5B3896', bg: '#E2D9F3' },
};

// ── Export Records to Excel ─────────────────────────────────────────────────
function exportRecordsToExcel(rows: AttendanceRow[], title: string, dateRange: string) {
  const HEADER_STYLE = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: '366092' } }, alignment: { horizontal: 'center' }, border: { bottom: { style: 'thin', color: { rgb: 'FFFFFF' } } } };
  const CELL_STYLE = { font: { sz: 10 }, alignment: { wrapText: false }, border: { bottom: { style: 'thin', color: { rgb: 'E0E0E0' } } } };

  const headers = ['#', 'Student Name', 'Student ID', 'Class', 'Subject', 'Date', 'Time (SL)', 'Status', 'Method', 'Location'];
  const wsData: any[][] = [
    [{ v: `${title} — Attendance Records`, s: { font: { bold: true, sz: 14 } } }],
    [{ v: `Date Range: ${dateRange}`, s: { font: { sz: 10, italic: true, color: { rgb: '666666' } } } }],
    [{ v: `Exported: ${new Date().toLocaleString()}`, s: { font: { sz: 10, italic: true, color: { rgb: '666666' } } } }],
    [],
    headers.map(h => ({ v: h, s: HEADER_STYLE })),
  ];

  const counts: Record<string, number> = {};
  rows.forEach((r, i) => {
    const statusKey = (r.status ?? '').toUpperCase();
    counts[statusKey] = (counts[statusKey] ?? 0) + 1;
    const cfg = EXCEL_STATUS_COLOUR[statusKey];
    const statusCell = cfg
      ? { v: cfg.label, s: { ...CELL_STYLE, font: { sz: 10, bold: true, color: { rgb: cfg.fg } }, fill: { fgColor: { rgb: cfg.bg } } } }
      : { v: r.status ?? '—', s: CELL_STYLE };
    const ts = r.timestamp ? new Date(r.timestamp) : null;
    const dateStr = ts ? ts.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' }) : '—';
    const timeStr = ts ? ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' }) : '—';
    wsData.push([
      { v: i + 1, s: { ...CELL_STYLE, alignment: { horizontal: 'center' } } },
      { v: r.studentName ?? '—', s: CELL_STYLE },
      { v: r.studentId ?? '—', s: CELL_STYLE },
      { v: r.className ?? '—', s: CELL_STYLE },
      { v: r.subjectName ?? '—', s: CELL_STYLE },
      { v: dateStr, s: CELL_STYLE },
      { v: timeStr, s: CELL_STYLE },
      statusCell,
      { v: r.markingMethod ?? '—', s: CELL_STYLE },
      { v: r.location ?? '—', s: CELL_STYLE },
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [40, 220, 120, 120, 130, 100, 90, 100, 120, 180].map(w => ({ wch: Math.round(w / 7) }));
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } }];

  // Summary sheet
  const total = rows.length;
  const sumHeaders = ['Status', 'Count', '% of Total'];
  const sumData: any[][] = [
    [{ v: 'Summary', s: { font: { bold: true, sz: 14 } } }],
    [],
    sumHeaders.map(h => ({ v: h, s: HEADER_STYLE })),
    ...Object.entries(counts).map(([k, c]) => {
      const cfg = EXCEL_STATUS_COLOUR[k];
      return [
        { v: cfg?.label ?? k, s: { ...CELL_STYLE, fill: cfg ? { fgColor: { rgb: cfg.bg } } : {} } },
        { v: c, s: { ...CELL_STYLE, alignment: { horizontal: 'center' } } },
        { v: `${total ? ((c / total) * 100).toFixed(1) : 0}%`, s: { ...CELL_STYLE, alignment: { horizontal: 'center' } } },
      ];
    }),
    [],
    [{ v: 'Total', s: { font: { bold: true, sz: 11 } } }, { v: total, s: { font: { bold: true, sz: 11 }, alignment: { horizontal: 'center' } } }],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(sumData);
  ws2['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Records');
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
  XLSX.writeFile(wb, `Attendance_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ── Export Records to PDF ──────────────────────────────────────────────────
function exportRecordsToPdf(rows: AttendanceRow[], title: string, dateRange: string) {
  const brandColor = getThemeHex();
  const counts: Record<string, number> = {};
  rows.forEach(r => { const k = (r.status ?? 'UNKNOWN').toUpperCase(); counts[k] = (counts[k] ?? 0) + 1; });

  const statusRows = rows.map((r, idx) => {
    const k = (r.status ?? 'UNKNOWN').toUpperCase();
    const cfg = PDF_STATUS[k] ?? { label: r.status ?? '—', color: '#666', bg: '#f5f5f5' };
    const ts = r.timestamp ? new Date(r.timestamp) : null;
    const dateStr = ts ? ts.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' }) : '—';
    const timeStr = ts ? ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' }) : '—';
    return `<tr style="background:${idx % 2 === 0 ? '#fff' : '#f9f9ff'}">
      <td style="padding:6px 8px;border:1px solid #eaeaea;font-size:11px;color:#555;text-align:center;">${idx + 1}</td>
      <td style="padding:6px 8px;border:1px solid #eaeaea;font-size:11px;font-weight:600;">${r.studentName ?? '—'}</td>
      <td style="padding:6px 8px;border:1px solid #eaeaea;font-size:10px;color:#666;font-family:monospace;">${r.studentId ?? '—'}</td>
      <td style="padding:6px 8px;border:1px solid #eaeaea;font-size:10px;">${r.className ?? '—'}</td>
      <td style="padding:6px 8px;border:1px solid #eaeaea;font-size:10px;">${dateStr}</td>
      <td style="padding:6px 8px;border:1px solid #eaeaea;font-size:10px;">${timeStr}</td>
      <td style="padding:6px 8px;border:1px solid #eaeaea;text-align:center;"><span style="padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${cfg.bg};color:${cfg.color};">${cfg.label}</span></td>
      <td style="padding:6px 8px;border:1px solid #eaeaea;font-size:10px;">${r.markingMethod ?? '—'}</td>
    </tr>`;
  }).join('');

  const summaryCards = Object.entries(counts).map(([k, c]) => {
    const cfg = PDF_STATUS[k];
    const borderColor = cfg?.bg.replace('#', '') ?? 'aaaaaa';
    return `<div style="flex:1;min-width:80px;border:1px solid #e8e8e8;border-radius:6px;text-align:center;padding:12px 0;border-top:6px solid ${cfg?.bg ?? '#aaa'};">
      <div style="font-size:20px;font-weight:700;color:${cfg?.color ?? '#444'};margin-bottom:3px;">${c}</div>
      <div style="font-size:10px;color:#888;text-transform:uppercase;">${cfg?.label ?? k}</div>
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Attendance Records – ${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f6fb; }
  .page { width: 210mm; min-height: 297mm; margin: 20px auto; background: #fff; padding: 32px; box-shadow: 0 4px 24px rgba(0,0,0,.12); }
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${brandColor}; padding-bottom: 14px; margin-bottom: 22px; }
  .hdr-left { display: flex; align-items: center; gap: 14px; }
  .hdr-logo { width: 52px; height: 52px; background: ${brandColor}; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
  .hdr-logo svg { fill: #fff; width: 28px; height: 28px; }
  .hdr-titles h1 { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: .06em; }
  .hdr-titles h2 { font-size: 18px; color: #222; }
  .hdr-right { text-align: right; font-size: 12px; color: #888; }
  .hdr-right .cls { font-weight: 700; color: #222; font-size: 13px; }
  .banner { background: ${brandColor}; color: #fff; border-radius: 8px; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
  .banner h3 { font-size: 15px; }
  .stats { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
  .tbl-wrap { border-radius: 8px; border: 1px solid #ddd; overflow: hidden; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: ${brandColor}; color: #fff; padding: 9px 10px; text-align: left; font-size: 11px; border: 1px solid ${brandColor}dd; }
  .footer { border-top: 1px solid #eee; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #bbb; }
  @media print { body { background: #fff; } .page { box-shadow: none; margin: 0; padding: 20px; width: 100%; } @page { size: A4 landscape; margin: 12mm; } }
</style></head><body>
<div class="page">
  <div class="hdr">
    <div class="hdr-left">
      <div class="hdr-logo"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg></div>
      <div class="hdr-titles"><h1>Attendance Records Report</h1><h2>${title}</h2></div>
    </div>
    <div class="hdr-right">
      <div class="cls">${dateRange}</div>
      <div style="margin-top:4px;">Generated: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>
  <div class="banner"><h3>📊 Attendance Records</h3><span style="font-size:13px;font-weight:700;">${rows.length} records</span></div>
  <div class="stats">${summaryCards}<div style="flex:1;min-width:80px;border:1px solid #e8e8e8;border-radius:6px;text-align:center;padding:12px 0;border-top:6px solid ${brandColor};"><div style="font-size:20px;font-weight:700;color:${brandColor};margin-bottom:3px;">${rows.length}</div><div style="font-size:10px;color:#888;text-transform:uppercase;">Total</div></div></div>
  <div class="tbl-wrap"><table>
    <thead><tr>
      <th style="width:32px;text-align:center;">#</th>
      <th style="min-width:130px;">Student Name</th>
      <th style="min-width:100px;">Student ID</th>
      <th style="min-width:90px;">Class</th>
      <th style="min-width:90px;">Date</th>
      <th style="min-width:70px;">Time</th>
      <th style="min-width:90px;text-align:center;">Status</th>
      <th style="min-width:90px;">Method</th>
    </tr></thead>
    <tbody>${statusRows}</tbody>
  </table></div>
  <div class="footer"><span>Suraksha LMS — Attendance Records Report</span><span>Printed: ${new Date().toLocaleString()}</span></div>
</div>
<script>window.onload=()=>{ window.print(); }<\/script>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}

const ATT_COL_DEFS: ColumnDef[] = [
  { key: 'studentId', header: 'Student ID', defaultVisible: false, defaultWidth: 100, minWidth: 80 },
  { key: 'studentName', header: 'Student Name', locked: true, defaultWidth: 220, minWidth: 120 },
  { key: 'instituteName', header: 'Institute', defaultVisible: false, defaultWidth: 150, minWidth: 100 },
  { key: 'className', header: 'Class', defaultVisible: true, defaultWidth: 120, minWidth: 80 },
  { key: 'subjectName', header: 'Subject', defaultVisible: true, defaultWidth: 130, minWidth: 80 },
  { key: 'timestamp', header: 'Time (SL)', locked: true, defaultWidth: 180, minWidth: 120 },
  { key: 'status', header: 'Status', locked: true, defaultWidth: 100, minWidth: 80 },
  { key: 'userType', header: 'User Type', defaultVisible: false, defaultWidth: 130, minWidth: 80 },
  { key: 'location', header: 'Location', defaultVisible: false, defaultWidth: 200, minWidth: 120 },
  { key: 'markingMethod', header: 'Method', defaultVisible: true, defaultWidth: 120, minWidth: 80 },
  { key: 'eventId', header: 'Event ID', defaultVisible: false, defaultWidth: 100, minWidth: 70 },
  { key: 'calendarDayId', header: 'Calendar Day', defaultVisible: false, defaultWidth: 110, minWidth: 80 },
];

interface AttendanceColumn {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  format?: (value: any, record?: any) => React.ReactNode;
}

const Attendance = () => {
  const { selectedInstitute, selectedClass, selectedSubject, currentInstituteId, currentClassId, currentSubjectId, user } = useAuth();
  const { toast } = useToast();
  const { refresh, isRefreshing, canRefresh, cooldownRemaining } = useRefreshWithCooldown(10);
  const location = useLocation();
  const navigate = useNavigate();

  const [studentAttendanceRecords, setStudentAttendanceRecords] = useState<StudentAttendanceRecord[]>([]);
  const [childAttendanceRecords, setChildAttendanceRecords] = useState<ChildAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const VALID_TABS = ['records', 'calendar', 'statistics', 'matrix', 'sessions'];
  const tabFromUrl = new URLSearchParams(location.search).get('tab') ?? '';
  const [activeTab, setActiveTab] = useState(() => VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'records');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    navigate(`${location.pathname}?${params}`, { replace: true });
  };
  const { viewMode, setViewMode } = useViewMode();
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [studentImagesMap, setStudentImagesMap] = useState<Map<string, string>>(new Map());
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const toggleCard = (index: number) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Sri Lanka timezone (UTC+5:30) — used globally for all date calculations
  const SL_TZ = 'Asia/Colombo';

  /** Returns current date as a Date whose year/month/date match Sri Lanka's current date */
  const getSLCurrentDate = (): Date => {
    const slStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: SL_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    return new Date(slStr + 'T00:00:00');
  };

  const [calendarMonth, setCalendarMonth] = useState<Date>(getSLCurrentDate);
  
  // Enhanced pagination state with default of 50 and available options [25, 50, 100]
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  const rowsPerPageOptions = [25, 50, 100];
  
  // Calculate default 5-day date range dynamically using SL timezone
  const getDefaultDateRange = () => {
    const fmt = (d: Date) => new Intl.DateTimeFormat('en-CA', {
      timeZone: SL_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d);
    const today = new Date();
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(today.getDate() - 4);
    return { startDate: fmt(fiveDaysAgo), endDate: fmt(today) };
  };
  
  const [filters, setFilters] = useState<AttendanceFilterParams>(() => getDefaultDateRange());
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);

  // Monthly count from API
  const [monthlyCount, setMonthlyCount] = useState<MonthlyAttendanceCount | null>(null);
  const [monthlyCountLoading, setMonthlyCountLoading] = useState(false);
  const monthlyCountCacheKey = React.useRef<string>('');

  // Daily count (day-by-day) from API — used for Calendar tab
  const [dailyCount, setDailyCount] = useState<DailyAttendanceDayCount[]>([]);
  const [dailyCountLoading, setDailyCountLoading] = useState(false);
  const dailyCountCacheKey = React.useRef<string>('');

  // Get institute role
  const userRoleAuth = useInstituteRole();

  // Format a Unix millisecond timestamp to local time string (Sri Lanka Time = UTC+5:30)
  const formatTimestamp = (ts?: number): string => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'Asia/Colombo',
      hour12: true
    });
  };

  const getInitials = (name?: string): string => {
    if (!name) return 'ST';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  };

  const getPermissionInfo = () => {
    const userRole = userRoleAuth;
    
    console.log('🔍 ATTENDANCE CONTEXT DEBUG:', {
      userRole,
      currentInstituteId,
      currentClassId,
      currentSubjectId,
      'selectedInstitute FULL': selectedInstitute,
      'selectedInstitute.userRole': selectedInstitute?.userRole,
      selectedClass: selectedClass?.name,
      selectedSubject: selectedSubject?.name
    });
    
    if (userRole === 'Student') {
      return {
        hasPermission: false,
        title: 'Attendance Access Restricted',
        viewType: 'none',
        description: 'Attendance viewing is not available for students'
      };
    }
    
    if ((userRole === 'InstituteAdmin' || userRole === 'AttendanceMarker') && currentInstituteId && !currentClassId) {
      return {
        hasPermission: true,
        title: 'Institute Student Attendance Overview',
        viewType: 'institute',
        description: 'View all students attendance records for the selected institute'
      };
    }
    
    if ((userRole === 'InstituteAdmin' || userRole === 'Teacher' || userRole === 'AttendanceMarker') && 
        currentInstituteId && currentClassId && !currentSubjectId) {
      return {
        hasPermission: true,
        title: 'Class Student Attendance Overview',
        viewType: 'class',
        description: 'View student attendance records for the selected class'
      };
    }
    
    if ((userRole === 'InstituteAdmin' || userRole === 'Teacher' || userRole === 'AttendanceMarker') && 
        currentInstituteId && currentClassId && currentSubjectId) {
      return {
        hasPermission: true,
        title: 'Subject Student Attendance Overview',
        viewType: 'subject',
        description: 'View student attendance records for the selected subject'
      };
    }
    
    return {
      hasPermission: false,
      title: 'Student Attendance Records',
      viewType: 'none',
      description: 'Select the required context to view attendance records'
    };
  };

  const { hasPermission, title, viewType, description } = getPermissionInfo();

  // Define columns based on view type
  const getColumns = (): AttendanceColumn[] => {
    return [
      { id: 'studentId', label: 'Student ID', minWidth: 100 },
      {
        id: 'studentName',
        label: 'Student Name',
        minWidth: 220,
        format: (value, record) => {
          // ✅ NEW: Try to get image from map first, then from record
          const studentId = (record as any)?.studentId;
          const mappedImage = studentId ? studentImagesMap.get(studentId) : undefined;
          const imageUrl = mappedImage || (record as any)?.studentImageUrl || (record as any)?.imageUrl || '';
          const studentName = (value as string) || '-';
          
          if (mappedImage) {
            console.log(`📸 Using mapped image for ${studentId}: ${mappedImage}`);
          }
          
          return (
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={getImageUrl(imageUrl)} alt={studentName} />
                <AvatarFallback className="text-[10px]">{getInitials(studentName)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{studentName}</span>
            </div>
          );
        }
      },
      { id: 'instituteName', label: 'Institute', minWidth: 150 },
      { id: 'className', label: 'Class', minWidth: 120 },
      { id: 'subjectName', label: 'Subject', minWidth: 130 },
      { 
        id: 'timestamp', 
        label: 'Time (SL)', 
        minWidth: 180,
        format: (value) => value ? formatTimestamp(value) : '-'
      },
      { 
        id: 'status', 
        label: 'Status', 
        minWidth: 100,
        format: (value) => {
          const config = getAttendanceStatusConfig(value);
          return (
            <Badge className={`${config.bgColor} ${config.color} border`}>
              {config.icon} {config.label}
            </Badge>
          );
        }
      },
      { id: 'userType', label: 'User Type', minWidth: 130 },
      { id: 'location', label: 'Location', minWidth: 200 },
      { id: 'markingMethod', label: 'Method', minWidth: 120 },
      { id: 'eventId', label: 'Event ID', minWidth: 100 },
      { id: 'calendarDayId', label: 'Calendar Day', minWidth: 110 }
    ];
  };

  // Calendar helpers
  const getCalendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();
    
    const days: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  }, [calendarMonth]);

  // Monthly stats derived from API
  const monthlyStats = useMemo(() => {
    if (!monthlyCount) return { present: 0, absent: 0, late: 0, left: 0, leftEarly: 0, leftLate: 0, total: 0, attendanceRate: 0 };
    return {
      present: monthlyCount.presentCount,
      absent: monthlyCount.absentCount,
      late: monthlyCount.lateCount,
      left: monthlyCount.leftCount,
      leftEarly: monthlyCount.leftEarlyCount,
      leftLate: monthlyCount.leftLatelyCount,
      total: monthlyCount.totalRecords,
      attendanceRate: monthlyCount.attendanceRate,
    };
  }, [monthlyCount]);

  const monthlyPieChartData = useMemo(() => {
    const total = monthlyStats.total;
    if (total === 0) return [];
    const items = [
      { name: 'Present', value: monthlyStats.present, color: ATTENDANCE_CHART_COLORS.present },
      { name: 'Absent', value: monthlyStats.absent, color: ATTENDANCE_CHART_COLORS.absent },
      { name: 'Late', value: monthlyStats.late, color: ATTENDANCE_CHART_COLORS.late },
      { name: 'Left', value: monthlyStats.left, color: '#f97316' },
      { name: 'Left Early', value: monthlyStats.leftEarly, color: '#a855f7' },
      { name: 'Left Late', value: monthlyStats.leftLate, color: '#ec4899' },
    ].filter(item => item.value > 0);
    return items.map(item => ({
      ...item,
      percentage: ((item.value / total) * 100).toFixed(1),
    }));
  }, [monthlyStats]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCalendarMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const handleFiltersChange = (newFilters: AttendanceFilterParams) => {
    setFilters(newFilters);
  };

  const handleApplyFilters = () => {
    console.log('Applying filters:', filters);
    setPage(0);
    loadStudentAttendanceData();
  };

  const handleClearFilters = () => {
    setFilters(getDefaultDateRange()); // Reset to default 5-day range
    setPage(0);
    loadStudentAttendanceData();
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const loadStudentAttendanceData = useCallback(async () => {
    if (!hasPermission) return;
    
    setIsLoading(true);
    try {
      const apiParams = {
        page: page + 1,
        limit: rowsPerPage,
        ...filters,
        userId: user?.id,
        role: userRoleAuth
      };

      let response: StudentAttendanceResponse;

      if (viewType === 'institute' && currentInstituteId) {
        response = await instituteStudentsApi.getInstituteStudentAttendance(currentInstituteId, apiParams);
      } else if (viewType === 'class' && currentInstituteId && currentClassId) {
        response = await instituteStudentsApi.getClassStudentAttendance(currentInstituteId, currentClassId, apiParams);
      } else if (viewType === 'subject' && currentInstituteId && currentClassId && currentSubjectId) {
        response = await instituteStudentsApi.getSubjectStudentAttendance(currentInstituteId, currentClassId, currentSubjectId, apiParams);
      } else {
        console.warn('Invalid view type or missing context for attendance data');
        return;
      }

      if (response.success) {
        setStudentAttendanceRecords(response.data);
        setTotalRecords(response.pagination.totalRecords);
        setAttendanceSummary(response.summary ? normalizeAttendanceSummary(response.summary) : null);
        
        // ✅ NEW: Extract student images from API response
        if (response.data && Array.isArray(response.data)) {
          const imagesMap = new Map<string, string>();
          response.data.forEach((record: StudentAttendanceRecord) => {
            if (record.studentId && record.studentImageUrl) {
              imagesMap.set(record.studentId, record.studentImageUrl);
            } else if (record.studentId && record.imageUrl) {
              imagesMap.set(record.studentId, record.imageUrl);
            }
          });
          if (imagesMap.size > 0) {
            setStudentImagesMap(imagesMap);
            console.log('✅ Extracted student images from API response:', imagesMap.size, 'images');
          }
        }
        
        setDataLoaded(true);
        
        
      } else {
        throw new Error(response.message || 'Failed to load attendance data');
      }
    } catch (error: any) {
      console.error('Error loading attendance data:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load attendance data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentInstituteId, currentClassId, currentSubjectId, viewType, hasPermission, page, rowsPerPage, filters, toast, user?.id, userRoleAuth]);

  useEffect(() => {
    if (hasPermission && activeTab === 'records') {
      loadStudentAttendanceData();
    }
  }, [loadStudentAttendanceData, hasPermission, activeTab]);

  // Load monthly attendance count from API
  const loadMonthlyCount = useCallback(async (forceRefresh = false) => {
    if (!hasPermission || !currentInstituteId) return;
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth() + 1;
    const cacheKey = `${year}-${month}-${viewType}-${currentInstituteId}-${currentClassId ?? ''}-${currentSubjectId ?? ''}`;
    if (!forceRefresh && monthlyCountCacheKey.current === cacheKey) return;
    setMonthlyCountLoading(true);
    try {
      let res: MonthlyAttendanceCount;
      if (viewType === 'subject' && currentClassId && currentSubjectId) {
        res = await adminAttendanceApi.getSubjectMonthlyCount(currentInstituteId, currentClassId, currentSubjectId, { year, month });
      } else if (viewType === 'class' && currentClassId) {
        res = await adminAttendanceApi.getClassMonthlyCount(currentInstituteId, currentClassId, { year, month });
      } else {
        res = await adminAttendanceApi.getInstituteMonthlyCount(currentInstituteId, { year, month });
      }
      if (res.success) {
        setMonthlyCount(res);
        monthlyCountCacheKey.current = cacheKey;
      }
    } catch (e: any) {
      console.error('Failed to load monthly count:', e);
    } finally {
      setMonthlyCountLoading(false);
    }
  }, [hasPermission, currentInstituteId, currentClassId, currentSubjectId, viewType, calendarMonth]);

  useEffect(() => {
    if (hasPermission && (activeTab === 'calendar' || activeTab === 'statistics')) {
      loadMonthlyCount();
    }
  }, [loadMonthlyCount, hasPermission, activeTab]);

  // Load day-by-day attendance count from API — used for Calendar tab
  const loadDailyCount = useCallback(async (forceRefresh = false) => {
    if (!hasPermission || !currentInstituteId) return;
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth() + 1;
    const cacheKey = `${year}-${month}-${viewType}-${currentInstituteId}-${currentClassId ?? ''}-${currentSubjectId ?? ''}`;
    if (!forceRefresh && dailyCountCacheKey.current === cacheKey) return;
    setDailyCountLoading(true);
    try {
      let res;
      if (viewType === 'subject' && currentClassId && currentSubjectId) {
        res = await adminAttendanceApi.getSubjectDailyCount(currentInstituteId, currentClassId, currentSubjectId, { year, month });
      } else if (viewType === 'class' && currentClassId) {
        res = await adminAttendanceApi.getClassDailyCount(currentInstituteId, currentClassId, { year, month });
      } else {
        res = await adminAttendanceApi.getInstituteDailyCount(currentInstituteId, { year, month });
      }
      if (res.success) {
        setDailyCount(res.days);
        dailyCountCacheKey.current = cacheKey;
      }
    } catch (e: any) {
      console.error('Failed to load daily count:', e);
    } finally {
      setDailyCountLoading(false);
    }
  }, [hasPermission, currentInstituteId, currentClassId, currentSubjectId, viewType, calendarMonth]);

  useEffect(() => {
    if (hasPermission && activeTab === 'calendar') {
      loadDailyCount();
    }
  }, [loadDailyCount, hasPermission, activeTab]);

  const getCurrentSelection = () => {
    const parts = [];
    if (selectedInstitute) parts.push(`Institute: ${selectedInstitute.name}`);
    if (selectedClass) parts.push(`Class: ${selectedClass.name}`);
    if (selectedSubject) parts.push(`Subject: ${selectedSubject.name}`);
    return parts.join(' → ') || 'No selection';
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const { getWidth: getAttColWidth, totalWidth: totalAttTableWidth, setHoveredCol: setAttHoveredCol, ResizeHandle: AttResizeHandle } = useResizableColumns(
    ['studentId', 'studentName', 'instituteName', 'className', 'subjectName', 'timestamp', 'status', 'userType', 'location', 'markingMethod', 'eventId', 'calendarDayId'],
    { studentId: 100, studentName: 220, instituteName: 150, className: 120, subjectName: 130, timestamp: 180, status: 100, userType: 130, location: 200, markingMethod: 120, eventId: 100, calendarDayId: 110 }
  );

  const { colState: attColState, visibleColumns: visAttDefs, toggleColumn: toggleAttCol, resetColumns: resetAttCols } = useColumnConfig(ATT_COL_DEFS, 'attendance');
  const attVisibleKeys = useMemo(() => new Set(visAttDefs.map(c => c.key)), [visAttDefs]);

  if (!hasPermission) {
    return (
      <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Attendance</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            View student attendance records
          </p>
        </div>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="font-medium mb-2 text-sm">Please select the required context to view attendance:</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• <strong>Institute Admin / Attendance Marker:</strong> Select Institute only</p>
              <p>• <strong>Institute Admin / Teacher / Attendance Marker:</strong> Select Institute + Class</p>
              <p>• <strong>Institute Admin / Teacher / Attendance Marker:</strong> Select Institute + Class + Subject</p>
            </div>
            {getCurrentSelection() !== 'No selection' && (
              <p className="mt-3 text-xs font-medium text-muted-foreground">Current: {getCurrentSelection()}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const columns = getColumns();
  const visibleCols = columns.filter(col => attVisibleKeys.has(col.id));
  const visibleAttTotal = visibleCols.reduce((sum, col) => sum + getAttColWidth(col.id), 0);
  const displayData = viewType === 'student' ? childAttendanceRecords : studentAttendanceRecords;

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:gap-3">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{title}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            {getCurrentSelection()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            onClick={() => {
              if (activeTab === 'records') loadStudentAttendanceData();
              else if (activeTab === 'calendar') loadDailyCount(true);
              else if (activeTab === 'statistics') loadMonthlyCount(true);
            }}
            disabled={isLoading || dailyCountLoading || monthlyCountLoading}
            variant="outline"
            size="sm"
            className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 ${(isLoading || dailyCountLoading || monthlyCountLoading) ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Card View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Table View"
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>
          {activeTab === 'records' && viewMode === 'table' && (
            <ColumnConfigurator allColumns={ATT_COL_DEFS} colState={attColState} onToggle={toggleAttCol} onReset={resetAttCols} />
          )}
          {/* Export buttons — Records tab only */}
          {activeTab === 'records' && displayData.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => exportRecordsToExcel(
                  displayData as any[],
                  title,
                  `${filters.startDate ?? ''} → ${filters.endDate ?? ''}`,
                )}
              >
                <Download className="h-3.5 w-3.5 mr-1" />Excel
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
                onClick={() => exportRecordsToPdf(
                  displayData as any[],
                  title,
                  `${filters.startDate ?? ''} → ${filters.endDate ?? ''}`,
                )}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />PDF
              </Button>
            </>
          )}
          {/* Mobile Filter Button - Records tab only */}
          {activeTab === 'records' && (
          <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3 md:hidden"
              >
                <Filter className="h-3.5 w-3.5 mr-1" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="md:hidden flex flex-col max-h-[80vh]">
              <SheetHeader>
                <SheetTitle>Attendance Filters</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto py-4">
                <AttendanceFilters
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  onApplyFilters={() => {
                    handleApplyFilters();
                    setIsFilterSheetOpen(false);
                  }}
                  onClearFilters={handleClearFilters}
                />
              </div>
            </SheetContent>
          </Sheet>
          )}
        </div>
      </div>

      {/* Filters Section - Desktop Only, Records tab only */}
      {activeTab === 'records' && (
      <ScrollAnimationWrapper animationType="slide-up" className="hidden md:block">
        <AttendanceFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onApplyFilters={handleApplyFilters}
          onClearFilters={handleClearFilters}
        />
      </ScrollAnimationWrapper>
      )}

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={`w-full grid ${(currentInstituteId || selectedInstitute?.id) && (currentClassId || selectedClass?.id) ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="matrix" className="flex items-center gap-1">
            <TableProperties className="h-3.5 w-3.5" />Matrix
          </TabsTrigger>
          {(currentInstituteId || selectedInstitute?.id) && (currentClassId || selectedClass?.id) && (
            <TabsTrigger value="sessions" className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />Sessions
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Records */}
        <TabsContent value="records" className="mt-4 space-y-4">
          {/* Card View */}
          {viewMode === 'card' && (
            <div className="space-y-2">
              {displayData.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {displayData.map((record, index) => {
                      const config = getAttendanceStatusConfig((record as any).status);
                      const isExpanded = expandedCards.has(index);
                      return (
                        <Card
                          key={index}
                          className="hover:shadow-md transition-shadow cursor-pointer select-none"
                          onClick={() => toggleCard(index)}
                        >
                          {/* Always-visible summary row */}
                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 shrink-0">
                                {/* ✅ NEW: Use map first, then record fields */}
                                {(() => {
                                  const studentId = (record as any).studentId;
                                  const mappedImage = studentId ? studentImagesMap.get(studentId) : undefined;
                                  const imageUrl = mappedImage || (record as any).studentImageUrl || (record as any).imageUrl || '';
                                  return (
                                    <AvatarImage
                                      src={getImageUrl(imageUrl)}
                                      alt={(record as any).studentName || 'Student'}
                                    />
                                  );
                                })()}
                                <AvatarFallback className="text-xs">
                                  {getInitials((record as any).studentName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{(record as any).studentName || '-'}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{(record as any).studentId || ''}</p>
                              </div>
                              <Badge className={`${config.bgColor} ${config.color} border text-xs shrink-0`}>
                                {config.label}
                              </Badge>
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </div>
                            
                            {/* Date, Time, User Type badges */}
                            <div className="flex flex-wrap gap-2 items-center text-xs">
                              {(record as any).date && (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                  {(() => {
                                    const d = (record as any).date;
                                    const dStr = String(d);
                                    let dateObj: Date;
                                    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
                                      // Pure date string — avoid TZ shift
                                      dateObj = new Date(dStr + 'T12:00:00');
                                    } else if (/^\d+$/.test(dStr)) {
                                      // Unix timestamp (ms)
                                      dateObj = new Date(Number(dStr));
                                    } else {
                                      // ISO datetime or other string
                                      dateObj = new Date(dStr);
                                    }
                                    return isNaN(dateObj.getTime())
                                      ? dStr
                                      : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Colombo' });
                                  })()}
                                </Badge>
                              )}
                              {((record as any).markedAt || (record as any).timestamp) && (
                                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20">
                                  {new Date((record as any).markedAt ?? (record as any).timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </Badge>
                              )}
                              {(record as any).userType && (
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
                                  {(record as any).userType}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Expandable detail section */}
                          {isExpanded && (
                            <div className="px-4 pb-4 border-t pt-3 space-y-1 text-xs text-muted-foreground">
                              {(record as any).instituteName && (
                                <p><span className="font-medium text-foreground">Institute:</span> {(record as any).instituteName}</p>
                              )}
                              {(record as any).className && (
                                <p><span className="font-medium text-foreground">Class:</span> {(record as any).className}{(record as any).subjectName && ` · ${(record as any).subjectName}`}</p>
                              )}
                              {(record as any).location && (
                                <p><span className="font-medium text-foreground">Location:</span> {(record as any).location}</p>
                              )}
                              {(record as any).markingMethod && (
                                <p><span className="font-medium text-foreground">Method:</span> {(record as any).markingMethod}</p>
                              )}
                              {(record as any).userType && (
                                <p><span className="font-medium text-foreground">User Type:</span> {(record as any).userType}</p>
                              )}
                              {(record as any).eventId && (
                                <p><span className="font-medium text-foreground">Event:</span> {(record as any).eventId}</p>
                              )}
                              {(record as any).calendarDayId && (
                                <p><span className="font-medium text-foreground">Calendar Day:</span> {(record as any).calendarDayId}</p>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>

                  {/* Card view pagination */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-muted-foreground">
                      Showing {page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, totalRecords)} of {totalRecords}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleChangePage(null, page - 1)} disabled={page === 0}>
                        Prev
                      </Button>
                      <span className="text-sm font-medium px-2">{page + 1} / {Math.ceil(totalRecords / rowsPerPage) || 1}</span>
                      <Button variant="outline" size="sm" onClick={() => handleChangePage(null, page + 1)} disabled={(page + 1) * rowsPerPage >= totalRecords}>
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-muted-foreground">
                  <p className="text-lg">No attendance records found</p>
                  <p className="text-sm mt-1">{getCurrentSelection()}</p>
                </div>
              )}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <Paper sx={{ width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 400px)', minHeight: '400px' }}>
              <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                <Table stickyHeader aria-label="attendance table" sx={{ width: '100%', minWidth: visibleAttTotal }}>
                  <TableHead>
                    <TableRow>
                      {visibleCols.map((column) => (
                        <TableCell
                          key={column.id}
                          align={column.align}
                          onMouseEnter={() => setAttHoveredCol(column.id)}
                          onMouseLeave={() => setAttHoveredCol(null)}
                          style={{ position: 'relative', width: getAttColWidth(column.id), userSelect: 'none' }}
                          sx={{ 
                            fontWeight: 'bold',
                            backgroundColor: 'hsl(var(--muted))',
                            color: 'hsl(var(--foreground))',
                            borderBottom: '2px solid hsl(var(--border))',
                            fontSize: { xs: '0.75rem', sm: '0.875rem' },
                            padding: { xs: '8px 6px', sm: '12px 16px' },
                          }}
                        >
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{column.label}</div>
                          <AttResizeHandle colId={column.id} />
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayData.length > 0 ? (
                      displayData.map((record, index) => (
                        <TableRow 
                          hover 
                          role="checkbox" 
                          tabIndex={-1} 
                          key={index}
                          sx={{
                            '&:hover': {
                              backgroundColor: 'hsl(var(--muted) / 0.5)'
                            }
                          }}
                        >
                          {visibleCols.map((column) => {
                            const value = (record as any)[column.id];
                            return (
                              <TableCell 
                                key={column.id} 
                                align={column.align}
                                sx={{
                                  fontSize: { xs: '0.7rem', sm: '0.875rem' },
                                  padding: { xs: '6px 4px', sm: '12px 16px' },
                                  borderBottom: '1px solid hsl(var(--border))',
                                  color: 'hsl(var(--foreground))'
                                }}
                              >
                                {column.format ? column.format(value, record) : value}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} align="center" sx={{ py: 8 }}>
                          <div className="py-8 text-center text-muted-foreground">
                            <p className="text-base sm:text-lg">No attendance records found</p>
                            <p className="text-xs sm:text-sm mt-1">{getCurrentSelection()}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={rowsPerPageOptions}
                component="div"
                count={totalRecords}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                sx={{
                  borderTop: '1px solid hsl(var(--border))',
                  '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                    fontSize: { xs: '0.7rem', sm: '0.875rem' }
                  },
                  '.MuiTablePagination-select': {
                    fontSize: { xs: '0.7rem', sm: '0.875rem' }
                  },
                  '.MuiTablePagination-actions': {
                    marginLeft: { xs: '4px', sm: '20px' }
                  }
                }}
              />
            </Paper>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-0">
          <Card>
            <CardHeader className="border-b border-border/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-base font-semibold">Attendance Calendar</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium min-w-[140px] text-center text-sm">
                    {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: SL_TZ })}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6">
              {/* Loading indicator */}
              {dailyCountLoading && (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Loading calendar data...</span>
                </div>
              )}

              {/* Status Legend */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Present</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-400">Absent</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Late</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span className="text-xs font-medium text-orange-700 dark:text-orange-400">Left</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-xs font-medium text-purple-700 dark:text-purple-400">Left Early</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-800">
                  <div className="w-3 h-3 rounded-full bg-pink-500" />
                  <span className="text-xs font-medium text-pink-700 dark:text-pink-400">Left Late</span>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2">
                {/* Week Day Headers */}
                {weekDays.map(day => (
                  <div key={day} className="text-center text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground py-1 sm:py-2">
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{day.charAt(0)}</span>
                  </div>
                ))}

                {/* Calendar Days */}
                {getCalendarDays.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} className="min-h-[52px] sm:min-h-[70px] md:min-h-[80px]" />;
                  }

                  const dayData = dailyCount.find(d => d.day === day);
                  const slToday = getSLCurrentDate();
                  const isToday =
                    slToday.getDate() === day &&
                    slToday.getMonth() === calendarMonth.getMonth() &&
                    slToday.getFullYear() === calendarMonth.getFullYear();
                  const weekday = index % 7; // 0=Sun, 6=Sat
                  const isWeekend = weekday === 0 || weekday === 6;

                  return (
                    <div
                      key={day}
                      className={`
                        min-h-[52px] sm:min-h-[70px] md:min-h-[80px] flex flex-col items-center rounded-md sm:rounded-lg
                        transition-all duration-200 cursor-default p-1 sm:p-1.5
                        ${isWeekend ? 'bg-sky-100 dark:bg-sky-900/30' : dayData ? 'bg-muted/50' : 'bg-muted/20'}
                        ${isToday ? 'ring-2 ring-primary ring-offset-1 sm:ring-offset-2 ring-offset-background' : ''}
                      `}
                    >
                      <span className="font-semibold text-xs sm:text-sm md:text-base mb-1 leading-none">{day}</span>
                      {dayData && (
                        <div className="flex flex-wrap gap-0.5 justify-center">
                          {dayData.presentCount > 0 && (
                            <span className="bg-emerald-500 text-white px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium leading-tight">{dayData.presentCount}</span>
                          )}
                          {dayData.absentCount > 0 && (
                            <span className="bg-red-500 text-white px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium leading-tight">{dayData.absentCount}</span>
                          )}
                          {dayData.lateCount > 0 && (
                            <span className="bg-amber-500 text-white px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium leading-tight">{dayData.lateCount}</span>
                          )}
                          {dayData.leftCount > 0 && (
                            <span className="bg-orange-500 text-white px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium leading-tight">{dayData.leftCount}</span>
                          )}
                          {dayData.leftEarlyCount > 0 && (
                            <span className="bg-purple-500 text-white px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium leading-tight">{dayData.leftEarlyCount}</span>
                          )}
                          {dayData.leftLatelyCount > 0 && (
                            <span className="bg-pink-500 text-white px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium leading-tight">{dayData.leftLatelyCount}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Statistics View */}
        <TabsContent value="statistics" className="mt-0 space-y-4">
          {monthlyCountLoading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Loading monthly statistics...</span>
            </div>
          )}

          {/* Month Navigator */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Month</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateMonth('prev')}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium min-w-[140px] text-center text-sm">
                    {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateMonth('next')}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm font-semibold">
                  {monthlyStats.total > 0 && <span className="text-primary">{monthlyStats.attendanceRate}% rate</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly Pie Chart */}
            <Card>
              <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base font-semibold">Monthly Distribution</CardTitle>
              </CardHeader>
               <CardContent className="p-4 md:p-6">
                 {monthlyPieChartData.length > 0 ? (
                   <div className="h-[250px] sm:h-[300px]">
                     <ResponsiveContainer width="100%" height="100%">
                       <RechartsPie>
                         <Pie
                           data={monthlyPieChartData}
                           cx="50%"
                           cy="50%"
                           innerRadius={40}
                           outerRadius={70}
                           paddingAngle={2}
                           dataKey="value"
                           label={(props: any) => `${props.name} ${((props.percent ?? 0) * 100).toFixed(1)}%`}
                           labelLine={false}
                           fontSize={11}
                           isAnimationActive={true}
                         >
                           {monthlyPieChartData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.color} />
                           ))}
                         </Pie>
                         <Tooltip 
                           formatter={(value: number, name: string) => [`${value} records`, name]}
                           contentStyle={{ 
                             backgroundColor: 'hsl(var(--card))', 
                             borderColor: 'hsl(var(--border))',
                             borderRadius: '8px'
                           }}
                         />
                         <Legend wrapperStyle={{ fontSize: '12px' }} />
                       </RechartsPie>
                     </ResponsiveContainer>
                   </div>
                 ) : (
                   <div className="h-[250px] sm:h-[300px] flex items-center justify-center text-muted-foreground">
                     No attendance data for this month
                   </div>
                 )}
              </CardContent>
            </Card>

            {/* Monthly Summary Stats */}
            <Card>
              <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base font-semibold">Monthly Summary</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <Card>
                      <CardContent className="p-2.5 sm:p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{monthlyStats.present}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Present</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-2.5 sm:p-4 text-center">
                        <p className="text-2xl font-bold text-red-600">{monthlyStats.absent}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Absent</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-2.5 sm:p-4 text-center">
                        <p className="text-2xl font-bold text-amber-600">{monthlyStats.late}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Late</p>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <Card>
                      <CardContent className="p-2.5 sm:p-4 text-center">
                        <p className="text-2xl font-bold text-orange-600">{monthlyStats.left}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Left</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-2.5 sm:p-4 text-center">
                        <p className="text-2xl font-bold text-purple-600">{monthlyStats.leftEarly}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Left Early</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-2.5 sm:p-4 text-center">
                        <p className="text-2xl font-bold text-pink-600">{monthlyStats.leftLate}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Left Late</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Total & Rate */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Records</p>
                      <p className="text-lg font-bold">{monthlyStats.total}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Attendance Rate</p>
                      <p className="text-lg font-bold text-primary">{monthlyStats.attendanceRate}%</p>
                    </div>
                  </div>

                  {/* Percentage Bars */}
                  <div className="space-y-3">
                    {monthlyPieChartData.map((item) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="flex-1 text-sm font-medium">{item.name}</span>
                        <span className="font-semibold">{item.value}</span>
                        <span className="text-sm text-muted-foreground w-16 text-right">({item.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </TabsContent>

        {/* Tab 4: Matrix — always show the date-range attendance matrix with export */}
        <TabsContent value="matrix" className="mt-0">
          <AttendanceMatrixView />
        </TabsContent>

        {/* Tab 5: Sessions (only when class is selected) */}
        {(currentInstituteId || selectedInstitute?.id) && (currentClassId || selectedClass?.id) && (
          <TabsContent value="sessions" className="mt-4">
            <ClassAttendanceSessions
              instituteId={((currentInstituteId ?? selectedInstitute?.id) as string)}
              classId={((currentClassId ?? selectedClass?.id) as string)}
              className={selectedClass?.name}
            />
          </TabsContent>
        )}

      </Tabs>
    </div>
  );
};

export default Attendance;