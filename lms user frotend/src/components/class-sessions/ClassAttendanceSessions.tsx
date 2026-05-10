import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { generateStudentClassReport } from '@/utils/studentClassReport';
import { fetchInstituteReportBranding } from '@/utils/instituteReportBranding';
import ReportDialog, { type ReportDialogResult } from '@/components/ReportDialog';
import { apiClient } from '@/api/client';
import { toast } from 'sonner';
import { getSriLankaDate } from '@/utils/timezone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import classAttendanceSessionsApi, {
  Session, SessionGroup, CreateSessionPayload, CreateSessionGroupPayload, UpdateSessionPayload,
  UpdateSessionGroupPayload, SessionGridResponse,
} from '@/api/classAttendanceSessions.api';
import {
  Plus, RefreshCw, Clock, Users, ChevronRight, Layers,
  Pencil, ClipboardList, MoreVertical, Trash2, Lock, X,
  LayoutGrid, FileText, CheckSquare, Download,
} from 'lucide-react';
import ClassAttendanceSessionView from './ClassAttendanceSessionView';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ExcelJS from 'exceljs';

const XLSX_BORDER_STYLE = {
  top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
};

const GRID_STATUS_CONFIG: Record<string, { label: string; short: string; bg: string; text: string; border: string }> = {
  present:     { label: 'Present',     short: 'P',  bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  late:        { label: 'Late',        short: 'L',  bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  absent:      { label: 'Absent',      short: 'A',  bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300' },
  left:        { label: 'Left',        short: '←',  bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  left_early:  { label: 'Left Early',  short: 'LE', bg: 'bg-pink-100',   text: 'text-pink-800',   border: 'border-pink-300' },
  left_lately: { label: 'Left Lately', short: 'LL', bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
  not_marked:  { label: 'Not Marked',  short: '-',  bg: 'bg-gray-50',    text: 'text-gray-500',   border: 'border-gray-200' },
};

const GRID_STATUS_XLSX_STYLE: Record<string, { fill: string; text: string }> = {
  present:     { fill: 'FFE8F7ED', text: 'FF166534' },
  late:        { fill: 'FFFFF4D6', text: 'FF92400E' },
  absent:      { fill: 'FFFDE8E8', text: 'FFB91C1C' },
  left:        { fill: 'FFE7F0FF', text: 'FF1D4ED8' },
  left_early:  { fill: 'FFFFE4E6', text: 'FFBE123C' },
  left_lately: { fill: 'FFEDE9FE', text: 'FF5B21B6' },
  not_marked:  { fill: 'FFF1F5F9', text: 'FF475569' },
};

function gridStatusCell(status: string | null | undefined) {
  const key = (status ?? 'not_marked').toLowerCase().replace(' ', '_');
  return GRID_STATUS_CONFIG[key] ?? GRID_STATUS_CONFIG['not_marked'];
}

async function exportSessionsToExcel(sessions: Session[], groups: SessionGroup[], className: string | undefined, dateRange: string) {
  const workbook = new ExcelJS.Workbook();
  const today = getSriLankaDate();

  // ── Sheet 1: Session List ──────────────────────────────────────────────────
  const worksheet = workbook.addWorksheet('Sessions List');
  const headers = ['#', 'Session Name', 'Date', 'Start Time', 'End Time', 'Group', 'Students', 'Late After (min)', 'Left Early Before (min)', 'Status', 'Closed?'];
  
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = XLSX_BORDER_STYLE;
  });

  const sortedSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  sortedSessions.forEach((s, idx) => {
    const group = groups.find(g => g.id === s.sessionGroupId);
    const isToday = s.date === today;
    const isPast = s.date < today;
    const statusLabel = s.isClosed ? 'Closed' : isToday ? 'Today' : isPast ? 'Past' : 'Open';
    
    const row = worksheet.addRow([
      idx + 1,
      s.name,
      s.date,
      s.startTime,
      s.endTime ?? '',
      group?.name ?? '',
      s.totalStudents ?? 0,
      s.lateAfterMinutes ?? '',
      s.leftEarlyBeforeMinutes ?? '',
      statusLabel,
      s.isClosed ? 'Yes' : 'No',
    ]);
    row.height = 20;
    row.eachCell((cell) => {
      cell.border = XLSX_BORDER_STYLE;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

    // Status coloring
    const statusCell = row.getCell(10);
    let statusStyle = { fill: 'FFF1F5F9', text: 'FF475569' }; // Default
    if (s.isClosed) statusStyle = { fill: 'FFFDE8E8', text: 'FFB91C1C' };
    else if (isToday) statusStyle = { fill: 'FFE7F0FF', text: 'FF1D4ED8' };
    else if (isPast) statusStyle = { fill: 'FFFFF4D6', text: 'FF92400E' };
    else statusStyle = { fill: 'FFE8F7ED', text: 'FF166534' };

    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusStyle.fill } };
    statusCell.font = { bold: true, color: { argb: statusStyle.text } };
  });

  worksheet.columns = [
    { width: 6 }, { width: 32 }, { width: 14 }, { width: 12 }, { width: 12 },
    { width: 18 }, { width: 12 }, { width: 18 }, { width: 22 }, { width: 12 }, { width: 10 },
  ];
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  // ── Sheet 2: Summary ──────────────────────────────────────────────────────
  const ws2 = workbook.addWorksheet('Summary');
  ws2.addRow(['Attendance Sessions Report']).font = { bold: true, size: 14 };
  ws2.addRow([]);
  ws2.addRow(['Class', className ?? '']);
  ws2.addRow(['Date Range', dateRange]);
  ws2.addRow(['Generated', new Date().toLocaleString()]);
  ws2.addRow(['Total Sessions', sessions.length]);
  ws2.addRow(['Open Sessions', sessions.filter(s => !s.isClosed && s.date === today).length]);
  ws2.addRow(['Past Sessions', sessions.filter(s => s.date < today && !s.isClosed).length]);
  ws2.addRow(['Closed Sessions', sessions.filter(s => s.isClosed).length]);
  ws2.addRow([]);
  const groupHeader = ws2.addRow(['Group', 'Sessions Count', 'Total Students']);
  groupHeader.font = { bold: true };
  groupHeader.eachCell(c => c.border = XLSX_BORDER_STYLE);

  const groupMap: Record<string, { count: number; students: number }> = {};
  sessions.forEach(s => {
    const g = groups.find(g => g.id === s.sessionGroupId);
    const key = g?.name ?? 'No Group';
    if (!groupMap[key]) groupMap[key] = { count: 0, students: 0 };
    groupMap[key].count++;
    groupMap[key].students += s.totalStudents ?? 0;
  });
  Object.entries(groupMap).forEach(([name, data]) => {
    const r = ws2.addRow([name, data.count, data.students]);
    r.eachCell(c => c.border = XLSX_BORDER_STYLE);
  });

  ws2.columns = [{ width: 26 }, { width: 18 }, { width: 18 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(className ?? 'Sessions').replace(/[^a-z0-9]/gi, '_')}_sessions_${getSriLankaDate()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Session attendance grid Excel export ───────────────────────────────────────
// Columns: #, Name, Inst.ID, Suraksha ID, [sessions grouped by group name], P, A, L, Rate
async function exportGridToExcel(gridData: SessionGridResponse, groups: SessionGroup[], className: string | undefined) {
  const { sessions: gridSessions, students: gridStudents } = gridData;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Session Grid');

  // Row 1: group name spans; Row 2: session names
  const groupHeaders = ['#', 'Student Name', 'Institute ID', 'Suraksha ID'];
  const sessionHeaders = ['', '', '', ''];
  gridSessions.forEach(s => {
    const g = groups.find(g => g.id === s.sessionGroupId);
    groupHeaders.push(g?.name ?? '—');
    sessionHeaders.push(`${s.name}\n(${s.date})`);
  });
  groupHeaders.push('P', 'A', 'L', 'Rate');
  sessionHeaders.push('Present', 'Absent', 'Late', '%');

  const gRow = worksheet.addRow(groupHeaders);
  const sRow = worksheet.addRow(sessionHeaders);

  [gRow, sRow].forEach(row => {
    row.height = 24;
    row.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = XLSX_BORDER_STYLE;
    });
  });

  // Merge group header cells
  let si = 0;
  while (si < gridSessions.length) {
    const groupId = gridSessions[si].sessionGroupId;
    let j = si;
    while (j < gridSessions.length && gridSessions[j].sessionGroupId === groupId) j++;
    if (j - si > 1) {
      worksheet.mergeCells(1, 5 + si, 1, 5 + j - 1);
    }
    si = j;
  }
  // Merge student info headers vertically
  for (let i = 1; i <= 4; i++) worksheet.mergeCells(1, i, 2, i);

  gridStudents.forEach((student, idx) => {
    let present = 0, absent = 0, late = 0;
    const statusValues = gridSessions.map(s => {
      const status = (student.sessions[s.id]?.statusLabel ?? 'not_marked').toLowerCase();
      if (status === 'present') present++;
      else if (status === 'absent') absent++;
      else if (status === 'late') late++;
      return status;
    });

    const rate = gridSessions.length ? Math.round((present / gridSessions.length) * 100) : 0;
    const row = worksheet.addRow([
      idx + 1,
      student.nameWithInitials || student.studentName,
      student.userIdInstitute ?? '',
      student.studentId,
      ...statusValues.map(st => gridStatusCell(st).short),
      present,
      absent,
      late,
      `${rate}%`,
    ]);
    row.height = 20;
    row.eachCell(cell => {
      cell.border = XLSX_BORDER_STYLE;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

    // Status coloring
    statusValues.forEach((st, sIdx) => {
      const cell = row.getCell(5 + sIdx);
      const style = GRID_STATUS_XLSX_STYLE[st.replace(/ /g, '_')] ?? GRID_STATUS_XLSX_STYLE['not_marked'];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } };
      cell.font = { bold: true, color: { argb: style.text } };
    });

    // Summary columns coloring
    const summaryStart = 5 + gridSessions.length;
    row.getCell(summaryStart).font = { bold: true, color: { argb: GRID_STATUS_XLSX_STYLE.present.text } };
    row.getCell(summaryStart + 1).font = { bold: true, color: { argb: GRID_STATUS_XLSX_STYLE.absent.text } };
    row.getCell(summaryStart + 2).font = { bold: true, color: { argb: GRID_STATUS_XLSX_STYLE.late.text } };

    const rateCell = row.getCell(summaryStart + 3);
    const rateStyle = rate >= 75 ? GRID_STATUS_XLSX_STYLE.present : rate >= 50 ? GRID_STATUS_XLSX_STYLE.late : GRID_STATUS_XLSX_STYLE.absent;
    rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rateStyle.fill } };
    rateCell.font = { bold: true, color: { argb: rateStyle.text } };
  });

  // Legend at bottom
  worksheet.addRow([]);
  const legendRow = worksheet.addRow(['Status Legend']);
  legendRow.font = { bold: true };
  Object.entries(GRID_STATUS_CONFIG).forEach(([key, cfg]) => {
    const r = worksheet.addRow([cfg.label, `(${cfg.short})`]);
    const style = GRID_STATUS_XLSX_STYLE[key.replace(/ /g, '_')] ?? GRID_STATUS_XLSX_STYLE['not_marked'];
    const c1 = r.getCell(1);
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } };
    c1.font = { bold: true, color: { argb: style.text } };
    c1.border = XLSX_BORDER_STYLE;
    r.getCell(2).border = XLSX_BORDER_STYLE;
  });

  worksheet.columns = [
    { width: 6 }, { width: 28 }, { width: 16 }, { width: 16 },
    ...gridSessions.map(() => ({ width: 10 })),
    { width: 8 }, { width: 8 }, { width: 8 }, { width: 10 },
  ];
  worksheet.views = [{ state: 'frozen', xSplit: 4, ySplit: 2 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(className ?? 'Sessions').replace(/[^a-z0-9]/gi, '_')}_grid_${getSriLankaDate()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  instituteId: string;
  classId: string;
  className?: string;
  defaultView?: 'list';
}

function getSriLankaDateOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const sl = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return sl.toISOString().slice(0, 10);
}

export default function ClassAttendanceSessions({ instituteId, classId, className, defaultView }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedInstitute } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const today = getSriLankaDate();

  // Date range: default last 31 days
  const [startDate, setStartDate] = useState(() => getSriLankaDateOffset(-30));
  const [endDate, setEndDate] = useState(() => getSriLankaDate());
  const [filterGroupId, setFilterGroupId] = useState<string>('all');

  const [viewMode, setViewMode] = useState<'list' | 'session' | 'grid'>('list');

  // ── Multi-select & grid state ───────────────────────────────────────────────
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [gridData, setGridData] = useState<SessionGridResponse | null>(null);
  const [loadingGrid, setLoadingGrid] = useState(false);

  // Report generation state (used from grid view)
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [generatingReports, setGeneratingReports] = useState(false);
  const [reportProgress, setReportProgress] = useState({ current: 0, total: 0 });
  const [reportDone, setReportDone] = useState<{ success: number; failed: string[] } | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Read ?viewSession= from URL to auto-open a session (e.g. from "Manual Mark" on mark-type page)
  const viewSessionProcessed = useRef(false);
  useEffect(() => {
    if (viewSessionProcessed.current) return;
    const params = new URLSearchParams(location.search);
    const viewSessId = params.get('viewSession');
    if (viewSessId && viewMode === 'list') {
      viewSessionProcessed.current = true;
      setActiveSessionId(viewSessId);
      setViewMode('session');
      // Clean the URL param
      params.delete('viewSession');
      const newSearch = params.toString();
      navigate(location.pathname + (newSearch ? `?${newSearch}` : ''), { replace: true });
    }
  }, [location.search, viewMode, navigate, location.pathname]);

  // Groups panel
  const [groupsPanelOpen, setGroupsPanelOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupForm, setGroupForm] = useState<Partial<CreateSessionGroupPayload>>({});
  const [savingGroup, setSavingGroup] = useState(false);

  // Edit group dialog
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editGroupTarget, setEditGroupTarget] = useState<SessionGroup | null>(null);
  const [editGroupForm, setEditGroupForm] = useState<Partial<UpdateSessionGroupPayload>>({});
  const [savingEditGroup, setSavingEditGroup] = useState(false);

  // Create session dialog
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState<Partial<CreateSessionPayload> & { date: string }>({
    date: getSriLankaDate(),
    startTime: '08:00',
    sendNotifications: true,
  });
  const [savingSession, setSavingSession] = useState(false);

  // Edit session dialog
  const [editSessionOpen, setEditSessionOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState<UpdateSessionPayload>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sess, grp] = await Promise.all([
        classAttendanceSessionsApi.getSessions(instituteId, classId, {
          startDate,
          endDate,
          sessionGroupId: filterGroupId === 'all' ? undefined : filterGroupId,
        }),
        classAttendanceSessionsApi.getGroups(instituteId, classId),
      ]);
      setSessions(sess);
      setGroups(grp);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [instituteId, classId, startDate, endDate, filterGroupId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { load(); }, [load]);

  // ── Helpers ────────────────────────────────────────────────────
  const buildBase = () => {
    const parts = location.pathname.split('/');
    const instIdx = parts.indexOf('institute');
    const clsIdx  = parts.indexOf('class');
    if (instIdx !== -1 && clsIdx !== -1) {
      return `/institute/${parts[instIdx + 1]}/class/${parts[clsIdx + 1]}`;
    }
    return `/institute/${instituteId}/class/${classId}`;
  };

  const isPastSession = (session: Session) => session.date < today;

  // ── Create session ──────────────────────────────────────────────
  const handleCreateSession = async () => {
    if (!sessionForm.name || !sessionForm.startTime) {
      toast.error('Name and start time are required');
      return;
    }
    setSavingSession(true);
    try {
      await classAttendanceSessionsApi.createSession(instituteId, classId, {
        name: sessionForm.name!,
        date: sessionForm.date,
        startTime: sessionForm.startTime!,
        endTime: sessionForm.endTime,
        lateAfterMinutes: sessionForm.lateAfterMinutes ? Number(sessionForm.lateAfterMinutes) : undefined,
        leftEarlyBeforeMinutes: sessionForm.leftEarlyBeforeMinutes ? Number(sessionForm.leftEarlyBeforeMinutes) : undefined,
        sessionGroupId: sessionForm.sessionGroupId,
        sendNotifications: sessionForm.sendNotifications ?? true,
      });
      toast.success('Session created');
      setCreateSessionOpen(false);
      setSessionForm({ date: getSriLankaDate(), startTime: '08:00', sendNotifications: true });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create session');
    } finally {
      setSavingSession(false);
    }
  };

  // ── Edit session ────────────────────────────────────────────────
  const openEdit = (session: Session) => {
    setEditTarget(session);
    setEditForm({
      name: session.name,
      startTime: session.startTime,
      endTime: session.endTime,
      lateAfterMinutes: session.lateAfterMinutes,
      leftEarlyBeforeMinutes: session.leftEarlyBeforeMinutes,
      sessionGroupId: session.sessionGroupId,
    });
    setEditSessionOpen(true);
  };

  const handleEditSession = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await classAttendanceSessionsApi.updateSession(instituteId, classId, editTarget.id, editForm);
      toast.success('Session updated');
      setEditSessionOpen(false);
      setEditTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update session');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Groups CRUD ─────────────────────────────────────────────────
  const handleCreateGroup = async () => {
    if (!groupForm.name) { toast.error('Name is required'); return; }
    setSavingGroup(true);
    try {
      await classAttendanceSessionsApi.createGroup(instituteId, classId, {
        name: groupForm.name!,
        color: groupForm.color,
      });
      toast.success('Group created');
      setCreateGroupOpen(false);
      setGroupForm({});
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create group');
    } finally {
      setSavingGroup(false);
    }
  };

  const openEditGroup = (group: SessionGroup) => {
    setEditGroupTarget(group);
    setEditGroupForm({ name: group.name, color: group.color });
    setEditGroupOpen(true);
  };

  const handleEditGroup = async () => {
    if (!editGroupTarget) return;
    setSavingEditGroup(true);
    try {
      await classAttendanceSessionsApi.updateGroup(instituteId, classId, editGroupTarget.id, editGroupForm);
      toast.success('Group updated');
      setEditGroupOpen(false);
      setEditGroupTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update group');
    } finally {
      setSavingEditGroup(false);
    }
  };

  const handleDeleteGroup = async (group: SessionGroup) => {
    if (!confirm(`Delete group "${group.name}"? Sessions assigned to this group will lose their group.`)) return;
    try {
      await classAttendanceSessionsApi.deleteGroup(instituteId, classId, group.id);
      toast.success('Group deleted');
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete group');
    }
  };



  // ── Session multi-select & grid ─────────────────────────────────────────────
  const toggleSession = (id: string) => setSelectedSessionIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const selectAllSessions = () => setSelectedSessionIds(new Set(sessions.map(s => s.id)));
  const clearSelection = () => setSelectedSessionIds(new Set());

  const openGrid = async () => {
    if (selectedSessionIds.size === 0) return;
    setLoadingGrid(true);
    try {
      const data = await classAttendanceSessionsApi.getSessionGrid(
        instituteId, classId, Array.from(selectedSessionIds),
      );
      setGridData(data);
      setViewMode('grid');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load attendance grid');
    } finally {
      setLoadingGrid(false);
    }
  };

  // Generate student PDF reports for all students visible in the grid
  const handleGenerateReports = async ({ options, dateRanges, printOptions }: ReportDialogResult) => {
    if (!gridData?.students.length) return;
    setShowReportDialog(false);
    setGeneratingReports(true);
    setReportDone(null);
    const studentIds = gridData.students.map(s => s.studentId);
    setReportProgress({ current: 0, total: studentIds.length });
    const failed: string[] = [];
    try {
      const branding = await fetchInstituteReportBranding(instituteId);
      const res: any = await apiClient.post(`/api/attendance/institute/${instituteId}/class-report`, {
        classId, studentIds,
        attendanceStart: dateRanges.attendanceStart, attendanceEnd: dateRanges.attendanceEnd,
        paymentsStart: dateRanges.paymentsStart, paymentsEnd: dateRanges.paymentsEnd,
        liveStart: dateRanges.liveStart, liveEnd: dateRanges.liveEnd,
        recordingStart: dateRanges.recordingStart, recordingEnd: dateRanges.recordingEnd,
        withActivities: false, attendanceLimit: 500,
      });
      const reportStudents: any[] = res?.students ?? [];
      for (let i = 0; i < reportStudents.length; i++) {
        setReportProgress({ current: i + 1, total: reportStudents.length });
        const row = reportStudents[i];
        if (!row?.student) { failed.push(studentIds[i]); continue; }
        const s = row.student;
        const physical = (row.attendance ?? []).filter(
          (r: any) => !r.markingMethod?.includes('LIVE') && !r.markingMethod?.includes('RECORDING'),
        );
        const liveAtt = (row.lectures ?? []).filter((l: any) => l.liveEnabled).map((l: any) => ({
          title: l.title ?? '', date: l.startTime ?? '', subjectName: l.subjectName ?? undefined,
          totalDurationMinutes: Math.round((l.liveAttendance?.totalSeconds ?? 0) / 60),
          sessions: (l.liveAttendance?.sessions ?? []).map((ss: any) => ({
            joinTime: ss.joinTime, leaveTime: ss.leaveTime ?? undefined,
            durationMinutes: ss.leaveTime && ss.joinTime
              ? Math.round((new Date(ss.leaveTime).getTime() - new Date(ss.joinTime).getTime()) / 60000) : 0,
          })),
        }));
        const recAtt = (row.lectures ?? []).filter((l: any) => l.recEnabled).map((l: any) => ({
          title: l.title ?? '', date: l.startTime ?? '', subjectName: l.subjectName ?? undefined,
          totalWatchedSeconds: l.recordingActivity?.totalWatchedSeconds ?? 0,
          sessionCount: l.recordingActivity?.sessionCount ?? 0,
        }));
        const gridStudent = gridData.students.find(gs => gs.studentId === studentIds[i]);
        try {
          await generateStudentClassReport({
            student: {
              name: s.nameWithInitials ?? s.fullName ?? s.name,
              fullName: s.fullName ?? null, email: s.email ?? null,
              phoneNumber: s.phoneNumber ?? null,
              userIdByInstitute: s.userIdByInstitute ?? null,
              surakshaUserId: s.id ? String(s.id) : null,
              dateOfBirth: s.dateOfBirth ?? null, gender: s.gender ?? null,
              address: s.address ?? null,
              imageUrl: gridStudent?.imageUrl ?? s.imageUrl ?? null,
              globalImageUrl: s.profileImageUrl ?? null,
            },
            instituteName: selectedInstitute?.name ?? '',
            className: className ?? '',
            dateRange: { start: dateRanges.attendanceStart, end: dateRanges.attendanceEnd },
            physicalAttendance: physical.map((r: any) => ({
              date: r.date ?? '', session: r.sessionName ?? '', group: r.groupName ?? '',
              sessionStart: r.sessionStart ?? undefined, sessionEnd: r.sessionEnd ?? undefined,
              checkIn: r.markedAt ?? undefined, status: r.status ?? 'absent',
            })),
            liveAttendance: liveAtt, recordingAttendance: recAtt,
            payments: (row.payments ?? []).map((p: any) => ({
              title: p.title ?? '', amount: Number(p.amount ?? 0),
              status: p.status ?? '', submissionStatus: p.submissionStatus ?? null,
            })),
          }, options, { ...branding, ...printOptions });
        } catch { failed.push(studentIds[i]); }
        if (i < reportStudents.length - 1) await new Promise(r => setTimeout(r, 400));
      }
    } catch { studentIds.forEach(id => failed.push(id)); }
    setGeneratingReports(false);
    setReportDone({ success: studentIds.length - failed.length, failed });
  };

  // ── Navigation ──────────────────────────────────────────────────
  const goToMarkAttendance = (sessionId: string, sessionName?: string) => {
    const qs = new URLSearchParams({ sessionId });
    if (sessionName) qs.set('sessionName', sessionName);
    navigate(`${buildBase()}/select-attendance-mark-type?${qs}`);
  };

  // ── Grid view ──────────────────────────────────────────────────
  if (viewMode === 'grid' && gridData) {
    const gridSessions = gridData.sessions;
    const gridStudents = gridData.students;

    // Compute group header spans (consecutive sessions with same groupId)
    const groupSpans: { name: string | null; color?: string; count: number }[] = [];
    let gi = 0;
    while (gi < gridSessions.length) {
      const gid = gridSessions[gi].sessionGroupId;
      let gj = gi;
      while (gj < gridSessions.length && gridSessions[gj].sessionGroupId === gid) gj++;
      const grp = groups.find(g => g.id === gid);
      groupSpans.push({ name: grp?.name ?? null, color: grp?.color, count: gj - gi });
      gi = gj;
    }

    return (
      <div className="space-y-4">
        {/* ── Grid header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setViewMode('list')}>
              ← Back
            </Button>
            <span className="text-sm font-semibold">
              Session Grid — {gridSessions.length} session{gridSessions.length !== 1 ? 's' : ''}, {gridStudents.length} students
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => exportGridToExcel(gridData, groups, className)} disabled={!gridStudents.length}>
              <Download className="h-3.5 w-3.5 mr-1.5" />Excel
            </Button>
            {!generatingReports && !reportDone && (
              <Button size="sm" onClick={() => setShowReportDialog(true)} disabled={!gridStudents.length}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Reports ({gridStudents.length})
              </Button>
            )}
            {generatingReports && (
              <Button size="sm" disabled>
                Generating {reportProgress.current}/{reportProgress.total}…
              </Button>
            )}
            {reportDone && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-600">{reportDone.success} PDF{reportDone.success !== 1 ? 's' : ''} done</span>
                {reportDone.failed.length > 0 && <span className="text-xs text-destructive">{reportDone.failed.length} failed</span>}
                <Button size="sm" variant="outline" onClick={() => setReportDone(null)}>Again</Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Status legend ────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(GRID_STATUS_CONFIG).map(([key, cfg]) => (
            <span key={key} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              {cfg.short} = {cfg.label}
            </span>
          ))}
        </div>

        {/* ── Cross-tab grid ───────────────────────────────────────────── */}
        {/* Columns: Student | Inst.ID | Suraksha ID | [group span] [session] ... | P | A | L | % */}
        <div className="overflow-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-max text-xs border-collapse">
            <thead>
              {/* Row 1: Group name spans */}
              <tr className="bg-muted/40">
                <th rowSpan={2} className="sticky left-0 z-20 bg-muted/80 border-b border-r border-border px-3 py-2 text-left font-semibold min-w-[160px]">Student</th>
                <th rowSpan={2} className="bg-muted/80 border-b border-r border-border px-2 py-2 text-center font-semibold min-w-[80px]">Inst. ID</th>
                <th rowSpan={2} className="bg-muted/80 border-b border-r border-border px-2 py-2 text-center font-semibold min-w-[80px]">Suraksha ID</th>
                {groupSpans.map((span, idx) => (
                  <th key={idx} colSpan={span.count}
                    className="border-b border-r border-border px-2 py-1.5 text-center font-semibold text-[11px]"
                    style={span.color ? { color: span.color, borderBottom: `2px solid ${span.color}40` } : {}}
                  >
                    {span.name ?? '—'}
                  </th>
                ))}
                <th rowSpan={2} className="border-b border-r border-border px-2 py-2 text-center font-semibold text-green-700 bg-green-50/40 min-w-[34px]">P</th>
                <th rowSpan={2} className="border-b border-r border-border px-2 py-2 text-center font-semibold text-red-700 bg-red-50/40 min-w-[34px]">A</th>
                <th rowSpan={2} className="border-b border-r border-border px-2 py-2 text-center font-semibold text-yellow-700 bg-yellow-50/40 min-w-[34px]">L</th>
                <th rowSpan={2} className="border-b border-border px-2 py-2 text-center font-semibold min-w-[44px]">%</th>
              </tr>
              {/* Row 2: Session names */}
              <tr className="bg-muted/20">
                {gridSessions.map(s => {
                  const grp = groups.find(g => g.id === s.sessionGroupId);
                  return (
                    <th key={s.id}
                      className="border-b border-r border-border px-1.5 py-1.5 text-center font-medium min-w-[60px]"
                      style={grp?.color ? { borderTop: `2px solid ${grp.color}` } : {}}
                    >
                      <div className="text-[10px] leading-tight truncate max-w-[72px]">{s.name}</div>
                      <div className="text-[9px] text-muted-foreground">{s.date}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {gridStudents.map((student, idx) => {
                let present = 0, absent = 0, late = 0;
                return (
                  <tr key={student.studentId} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                    <td className="sticky left-0 z-10 bg-inherit border-b border-r border-border px-2 py-1.5 font-medium text-[11px]">
                      {student.studentName}
                    </td>
                    <td className="border-b border-r border-border px-2 py-1.5 text-center text-[10px] text-muted-foreground font-mono">
                      {student.userIdInstitute ?? '—'}
                    </td>
                    <td className="border-b border-r border-border px-2 py-1.5 text-center text-[10px] text-muted-foreground font-mono">
                      {student.studentId}
                    </td>
                    {gridSessions.map(s => {
                      const record = student.sessions[s.id];
                      const status = record?.statusLabel ?? 'not_marked';
                      const cfg = gridStatusCell(status);
                      if (status.toLowerCase() === 'present') present++;
                      else if (status.toLowerCase() === 'absent') absent++;
                      else if (status.toLowerCase() === 'late') late++;
                      return (
                        <td key={s.id} className="border-b border-r border-border text-center p-1">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                            {cfg.short}
                          </span>
                        </td>
                      );
                    })}
                    <td className="border-b border-r border-border text-center px-2 py-1.5 font-bold text-green-700 bg-green-50/20">{present}</td>
                    <td className="border-b border-r border-border text-center px-2 py-1.5 font-bold text-red-700 bg-red-50/20">{absent}</td>
                    <td className="border-b border-r border-border text-center px-2 py-1.5 font-bold text-yellow-700 bg-yellow-50/20">{late}</td>
                    <td className="border-b border-border text-center px-2 py-1.5">
                      <span className={`font-bold text-[11px] ${
                        gridSessions.length && Math.round((present / gridSessions.length) * 100) >= 75 ? 'text-green-700' :
                        gridSessions.length && Math.round((present / gridSessions.length) * 100) >= 50 ? 'text-yellow-700' : 'text-red-600'
                      }`}>
                        {gridSessions.length ? Math.round((present / gridSessions.length) * 100) : 0}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals footer */}
            {gridStudents.length > 0 && (
              <tfoot>
                <tr className="bg-muted/60 font-semibold">
                  <td colSpan={3} className="sticky left-0 z-10 bg-muted/80 border-t border-r border-border px-3 py-2 text-[11px]">
                    Totals ({gridStudents.length} students)
                  </td>
                  {gridSessions.map(s => {
                    const presentCount = gridStudents.filter(st =>
                      (st.sessions[s.id]?.statusLabel ?? '').toLowerCase() === 'present',
                    ).length;
                    const pct = gridStudents.length ? Math.round((presentCount / gridStudents.length) * 100) : 0;
                    return (
                      <td key={s.id} className="border-t border-r border-border text-center px-1 py-1.5">
                        <div className="text-[10px] font-bold text-green-700">{presentCount}</div>
                        <div className={`text-[9px] ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{pct}%</div>
                      </td>
                    );
                  })}
                  <td colSpan={4} className="border-t border-border" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Report dialog */}
        <ReportDialog
          open={showReportDialog}
          onClose={() => setShowReportDialog(false)}
          onGenerate={handleGenerateReports}
          generating={generatingReports}
          progress={generatingReports ? reportProgress : undefined}
          title={`Generate Reports (${gridStudents.length} students)`}
          showDateRanges={true}
        />
      </div>
    );
  }

  // ── Sub-views ───────────────────────────────────────────────────
  if (viewMode === 'session' && activeSessionId) {
    return (
      <ClassAttendanceSessionView
        instituteId={instituteId}
        classId={classId}
        sessionId={activeSessionId}
        onBack={() => { setViewMode('list'); setActiveSessionId(null); load(); }}
      />
    );
  }



  // ── Group sessions by date ──────────────────────────────────────
  const sessionsByDate = sessions.reduce<Record<string, Session[]>>((acc, s) => {
    (acc[s.date] = acc[s.date] ?? []).push(s);
    return acc;
  }, {});
  const sortedDates = Object.keys(sessionsByDate).sort((a, b) => b.localeCompare(a));

  // ── Main list view ──────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Attendance Sessions</h2>
          {className && <p className="text-sm text-muted-foreground">{className}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Session selection controls */}
          {sessions.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={selectAllSessions} disabled={selectedSessionIds.size === sessions.length}>
                <CheckSquare className="h-3.5 w-3.5 mr-1" />All ({sessions.length})
              </Button>
              {selectedSessionIds.size > 0 && (
                <>
                  <Button size="sm" variant="ghost" onClick={clearSelection} className="text-muted-foreground">
                    Clear ({selectedSessionIds.size})
                  </Button>
                  <Button size="sm" onClick={openGrid} disabled={loadingGrid}>
                    <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                    {loadingGrid ? 'Loading…' : `Grid (${selectedSessionIds.size})`}
                  </Button>
                </>
              )}
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => setGroupsPanelOpen(v => !v)}>
            <Layers className="h-4 w-4 mr-1" />
            Groups {groups.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{groups.length}</Badge>}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={sessions.length === 0}
            onClick={() => exportSessionsToExcel(sessions, groups, className, `${startDate} → ${endDate}`)}
          >
            <Download className="h-4 w-4 mr-1" />Export Excel
          </Button>
          <Button size="sm" onClick={() => setCreateSessionOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Session
          </Button>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Groups panel */}
      {groupsPanelOpen && (
        <Card className="border-dashed">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Session Groups</CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCreateGroupOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" />
                  New Group
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setGroupsPanelOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No groups yet. Create one to organise sessions.</p>
            ) : (
              <div className="space-y-1.5">
                {groups.map(g => (
                  <div key={g.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/50">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ background: g.color ?? '#9ca3af' }} />
                    <span className="flex-1 text-sm font-medium">{g.name}</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditGroup(g)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteGroup(g)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Date range + group filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-36 text-sm"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <Input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-36 text-sm"
          />
        </div>
        <Select value={filterGroupId} onValueChange={setFilterGroupId}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groups.map(g => (
              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sessions list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No sessions in this date range. Create a new session to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {date === today ? '📅 Today' : date}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-2">
                {sessionsByDate[date].map(session => {
                  const isToday = date === today;
                  const isPast = isPastSession(session);
                  const canMark = !session.isClosed && isToday;

                  return (
                    <Card
                      key={session.id}
                      className={`transition-shadow hover:shadow-md`}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start gap-2">
                          {/* Checkbox for multi-select grid view */}
                          <input
                            type="checkbox"
                            checked={selectedSessionIds.has(session.id)}
                            onChange={() => toggleSession(session.id)}
                            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                          />
                        <div className="flex-1 flex items-start justify-between gap-2 flex-wrap">
                          <div className="flex items-start gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{session.name}</span>
                                {session.isClosed && (
                                  <Badge variant="outline" className="text-xs text-destructive border-destructive">Closed</Badge>
                                )}
                                {isPast && !session.isClosed && (
                                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Past</Badge>
                                )}
                                {session.group && (
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{
                                      background: session.group.color ? `${session.group.color}22` : '#f0f0f0',
                                      color: session.group.color ?? '#555',
                                      border: `1px solid ${session.group.color ?? '#ccc'}`,
                                    }}
                                  >
                                    {session.group.name}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {session.startTime}{session.endTime ? ` – ${session.endTime}` : ''}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {session.totalStudents}
                                </span>
                                {session.lateAfterMinutes != null && (
                                  <span className="text-yellow-600">Late +{session.lateAfterMinutes}m</span>
                                )}
                                {session.leftEarlyBeforeMinutes != null && (
                                  <span className="text-orange-600">Early -{session.leftEarlyBeforeMinutes}m</span>
                                )}
                              </div>

                              {/* Mark Attendance button — today's open sessions only */}
                              {canMark && (
                                <div className="mt-2">
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => goToMarkAttendance(session.id, session.name)}
                                  >
                                    <ClipboardList className="h-3 w-3 mr-1" />
                                    Mark Attendance
                                  </Button>
                                </div>
                              )}
                              {isPast && !session.isClosed && (
                                <p className="text-xs text-orange-600 mt-1">Past session — close only, no new marks</p>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => { setActiveSessionId(session.id); setViewMode('session'); }}
                            >
                              View <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(session)}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" />
                                  Edit Session
                                </DropdownMenuItem>
                                {!session.isClosed && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => { setActiveSessionId(session.id); setViewMode('session'); }}
                                    >
                                      <Lock className="h-3.5 w-3.5 mr-2" />
                                      Close Session
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>{/* end flex-1 wrapper */}
                        </div>{/* end checkbox+content row */}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Create Session Dialog ─────────────────────────────── */}
      <Dialog open={createSessionOpen} onOpenChange={setCreateSessionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create Attendance Session</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Session Name *</Label>
              <Input
                placeholder="e.g. Period 1 – Mathematics"
                value={sessionForm.name ?? ''}
                onChange={e => setSessionForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input
                type="date"
                value={sessionForm.date}
                onChange={e => setSessionForm(p => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Time *</Label>
                <Input
                  type="time"
                  value={sessionForm.startTime ?? '08:00'}
                  onChange={e => setSessionForm(p => ({ ...p, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={sessionForm.endTime ?? ''}
                  onChange={e => setSessionForm(p => ({ ...p, endTime: e.target.value || undefined }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Late After (min)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 15"
                  value={sessionForm.lateAfterMinutes ?? ''}
                  onChange={e => setSessionForm(p => ({ ...p, lateAfterMinutes: e.target.value as any }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Left Early Before (min)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 10"
                  value={sessionForm.leftEarlyBeforeMinutes ?? ''}
                  onChange={e => setSessionForm(p => ({ ...p, leftEarlyBeforeMinutes: e.target.value as any }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Session Group</Label>
              <Select
                value={sessionForm.sessionGroupId ?? 'none'}
                onValueChange={v => setSessionForm(p => ({ ...p, sessionGroupId: v === 'none' ? undefined : v }))}
              >
                <SelectTrigger><SelectValue placeholder="No group" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      <span style={{ color: g.color }}>{g.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Send Parent Notifications</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Notify parents when attendance is marked in this session</p>
              </div>
              <Switch
                checked={sessionForm.sendNotifications ?? true}
                onCheckedChange={v => setSessionForm(p => ({ ...p, sendNotifications: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSessionOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSession} disabled={savingSession}>
              {savingSession ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Session Dialog ───────────────────────────────── */}
      <Dialog open={editSessionOpen} onOpenChange={v => { if (!v) setEditTarget(null); setEditSessionOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Session</DialogTitle></DialogHeader>
          {editTarget && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Session Name</Label>
                <Input
                  value={editForm.name ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={editForm.startTime ?? ''}
                    onChange={e => setEditForm(p => ({ ...p, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={editForm.endTime ?? ''}
                    onChange={e => setEditForm(p => ({ ...p, endTime: e.target.value || undefined }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Late After (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editForm.lateAfterMinutes ?? ''}
                    onChange={e => setEditForm(p => ({ ...p, lateAfterMinutes: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Left Early Before (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editForm.leftEarlyBeforeMinutes ?? ''}
                    onChange={e => setEditForm(p => ({ ...p, leftEarlyBeforeMinutes: e.target.value ? Number(e.target.value) : undefined }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Session Group</Label>
                <Select
                  value={editForm.sessionGroupId ?? 'none'}
                  onValueChange={v => setEditForm(p => ({ ...p, sessionGroupId: v === 'none' ? null : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="No group" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No group</SelectItem>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>
                        <span style={{ color: g.color }}>{g.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSessionOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSession} disabled={savingEdit}>
              {savingEdit ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create Group Dialog ───────────────────────────────── */}
      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Create Session Group</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Group Name *</Label>
              <Input
                placeholder="e.g. Morning Sessions"
                value={groupForm.name ?? ''}
                onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={groupForm.color ?? '#3B82F6'}
                  onChange={e => setGroupForm(p => ({ ...p, color: e.target.value }))}
                  className="w-12 h-9 p-1 cursor-pointer"
                />
                <Input
                  placeholder="#3B82F6"
                  value={groupForm.color ?? ''}
                  onChange={e => setGroupForm(p => ({ ...p, color: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={savingGroup}>
              {savingGroup ? 'Creating…' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Group Dialog ─────────────────────────────────── */}
      <Dialog open={editGroupOpen} onOpenChange={v => { if (!v) setEditGroupTarget(null); setEditGroupOpen(v); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Edit Group</DialogTitle></DialogHeader>
          {editGroupTarget && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Group Name</Label>
                <Input
                  value={editGroupForm.name ?? ''}
                  onChange={e => setEditGroupForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={editGroupForm.color ?? '#3B82F6'}
                    onChange={e => setEditGroupForm(p => ({ ...p, color: e.target.value }))}
                    className="w-12 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    placeholder="#3B82F6"
                    value={editGroupForm.color ?? ''}
                    onChange={e => setEditGroupForm(p => ({ ...p, color: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGroupOpen(false)}>Cancel</Button>
            <Button onClick={handleEditGroup} disabled={savingEditGroup}>
              {savingEditGroup ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
