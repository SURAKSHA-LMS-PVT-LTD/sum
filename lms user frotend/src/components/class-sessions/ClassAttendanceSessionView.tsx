import React, { useCallback, useEffect, useState } from 'react';

import { toast } from 'sonner';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSriLankaDateTime } from '@/utils/timezone';
import classAttendanceSessionsApi, {
  SessionDetail, SessionStudentRecord, CloseUnmarkAction,
} from '@/api/classAttendanceSessions.api';
import {
  ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, Users,
  Lock, UserCheck, UserMinus, Search, Send, Download, FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';


interface Props {
  instituteId: string;
  classId: string;
  sessionId: string;
  onBack: () => void;
}

const STATUS_OPTS = [
  { value: 1, label: 'Present',    color: 'bg-green-100 text-green-800' },
  { value: 0, label: 'Absent',     color: 'bg-red-100 text-red-800' },
  { value: 2, label: 'Late',       color: 'bg-yellow-100 text-yellow-800' },
  { value: 3, label: 'Left',       color: 'bg-blue-100 text-blue-800' },
  { value: 4, label: 'Left Early', color: 'bg-orange-100 text-orange-800' },
  { value: 5, label: 'Left Lately',color: 'bg-purple-100 text-purple-800' },
];

const STATUS_STYLE: Record<number, string> = {
  1: 'bg-green-100 text-green-800',
  0: 'bg-red-100 text-red-800',
  2: 'bg-yellow-100 text-yellow-800',
  3: 'bg-blue-100 text-blue-800',
  4: 'bg-orange-100 text-orange-800',
  5: 'bg-purple-100 text-purple-800',
};

type FilterMode = 'all' | 'present' | 'absent' | 'not-marked';

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Excel colours per status code ───────────────────────────────────────────
const EXCEL_STATUS: Record<number | string, { bg: string; fg: string; label: string }> = {
  1:          { bg: 'C6EFCE', fg: '375623', label: 'Present' },
  0:          { bg: 'FFC7CE', fg: '9C0006', label: 'Absent' },
  2:          { bg: 'FFEB9C', fg: '9C5700', label: 'Late' },
  3:          { bg: 'BDD7EE', fg: '1F497D', label: 'Left' },
  4:          { bg: 'FFD9C0', fg: '833C00', label: 'Left Early' },
  5:          { bg: 'E2D9F3', fg: '5B3896', label: 'Left Lately' },
  'null':     { bg: 'F2F2F2', fg: '808080', label: 'Not Marked' },
};

const XLSX_HEADER = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
  fill: { patternType: 'solid', fgColor: { rgb: '366092' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};

function exportSessionAttendance(detail: import('@/api/classAttendanceSessions.api').SessionDetail) {
  const wb = XLSX.utils.book_new();
  const enc = XLSX.utils.encode_cell;

  // ── Sheet 1: Attendance ────────────────────────────────────────────────────
  const headers = ['#', 'Student Name', 'Institute ID', 'Card ID', 'Status', 'Marked At', 'Source'];
  const rows: any[][] = [headers];

  const sorted = [...detail.students].sort((a, b) => a.studentName.localeCompare(b.studentName));

  sorted.forEach((s, idx) => {
    const statusKey = s.statusCode !== null ? s.statusCode : 'null';
    const statusLabel = EXCEL_STATUS[statusKey]?.label ?? 'Unknown';
    rows.push([
      idx + 1,
      s.studentName,
      s.userIdInstitute ?? '',
      s.cardId ?? '',
      statusLabel,
      s.markedAt ?? '',
      'Session',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 4 }, { wch: 28 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 20 }, { wch: 14 },
  ];

  // Header row styles
  for (let c = 0; c < headers.length; c++) {
    const a = enc({ r: 0, c });
    if (ws[a]) ws[a].s = XLSX_HEADER;
  }
  // Status cell (col 4) colour per student
  sorted.forEach((s, rowIdx) => {
    const statusKey = s.statusCode !== null ? s.statusCode : 'null';
    const ex = EXCEL_STATUS[statusKey];
    if (!ex) return;
    const a = enc({ r: rowIdx + 1, c: 4 });
    if (ws[a]) {
      ws[a].s = {
        fill: { patternType: 'solid', fgColor: { rgb: ex.bg } },
        font: { bold: true, color: { rgb: ex.fg }, sz: 9 },
        alignment: { horizontal: 'center' },
      };
    }
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');

  // ── Sheet 2: Summary ──────────────────────────────────────────────────────
  const summaryRows: any[][] = [
    ['Session Attendance Report'],
    [],
    ['Session',    detail.name],
    ['Date',       detail.date],
    ['Time',       `${detail.startTime}${detail.endTime ? ` – ${detail.endTime}` : ''}`],
    ['Group',      detail.group?.name ?? '—'],
    ['Status',     detail.isClosed ? 'Closed' : 'Open'],
    ['Generated',  new Date().toLocaleString()],
    [],
    ['Metric',             'Count'],
    ['Total Students',     detail.students.length],
    ['Present',            detail.presentCount],
    ['Absent',             detail.absentCount],
    ['Late',               detail.lateCount],
    ['Not Marked',         detail.notMarkedCount],
    ['Attendance Rate',    detail.students.length
      ? `${Math.round(((detail.presentCount + detail.lateCount) / detail.students.length) * 100)}%`
      : '—'],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws2['!cols'] = [{ wch: 22 }, { wch: 20 }];
  // Style the "Metric / Count" header at row index 9
  for (let c = 0; c < 2; c++) {
    const a = enc({ r: 9, c });
    if (ws2[a]) ws2[a].s = XLSX_HEADER;
  }
  // Colour-code the count cells for key metrics (rows 10–14)
  const metricColors: Array<{ bg: string; fg: string }> = [
    { bg: 'FFFFFF', fg: '000000' }, // Total
    { bg: 'C6EFCE', fg: '375623' }, // Present
    { bg: 'FFC7CE', fg: '9C0006' }, // Absent
    { bg: 'FFEB9C', fg: '9C5700' }, // Late
    { bg: 'F2F2F2', fg: '808080' }, // Not Marked
  ];
  metricColors.forEach(({ bg, fg }, i) => {
    const a = enc({ r: 10 + i, c: 1 });
    if (ws2[a]) ws2[a].s = { fill: { patternType: 'solid', fgColor: { rgb: bg } }, font: { bold: true, color: { rgb: fg }, sz: 9 } };
  });

  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  const safeName = detail.name.replace(/[^a-z0-9]/gi, '_');
  XLSX.writeFile(wb, `Session_${safeName}_${detail.date}.xlsx`);
}

// ── Read the live institute theme color from CSS variables ───────────────────
function getThemeHex(fallback = '#4c32e9'): string {
  try {
    const hsl = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary').trim();
    if (!hsl) return fallback;
    const parts = hsl.replace(/%/g, '').split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return fallback;
    const [h, s, l] = [parts[0], parts[1] / 100, parts[2] / 100];
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255)
        .toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch {
    return fallback;
  }
}

// ── PDF export ──────────────────────────────────────────────────────────────
function exportSessionToPdf(
  detail: import('@/api/classAttendanceSessions.api').SessionDetail,
) {
  const brandColor = getThemeHex();
  const STATUS_PDF: Record<number | string, { label: string; color: string; bg: string; border: string }> = {
    1:      { label: 'Present',     color: '#375623', bg: '#C6EFCE', border: '#A8D5B0' },
    2:      { label: 'Late',        color: '#9C5700', bg: '#FFEB9C', border: '#F0D580' },
    0:      { label: 'Absent',      color: '#9C0006', bg: '#FFC7CE', border: '#F4A7AE' },
    3:      { label: 'Left',        color: '#5B3896', bg: '#E2D9F3', border: '#C9BDE8' },
    4:      { label: 'Left Early',  color: '#993366', bg: '#FFD9E8', border: '#F4B8D0' },
    5:      { label: 'Left Lately', color: '#33338B', bg: '#D9D9FF', border: '#B8B8F0' },
    'null': { label: 'Not Marked', color: '#808080', bg: '#F5F5F5', border: '#D0D0D0' },
  };

  const sorted = [...detail.students].sort((a, b) => a.studentName.localeCompare(b.studentName));

  const rows = sorted.map((s, idx) => {
    const key = s.statusCode !== null ? s.statusCode : 'null';
    const cfg = STATUS_PDF[key] ?? STATUS_PDF['null'];
    const initials = s.studentName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    const sourceTag = '';
    return `
      <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f9f9ff'};">
        <td style="padding:8px 10px;border:1px solid #eaeaea;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:50%;background:#6a4cff;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">${initials}</div>
            <div>
              <div style="font-weight:600;font-size:12px;">${s.studentName}</div>
              <div style="font-size:10px;color:#888;">${s.userIdInstitute ?? ''}${s.cardId ? ` · Card: ${s.cardId}` : ''}</div>
            </div>
          </div>
        </td>
        <td style="padding:8px 10px;border:1px solid #eaeaea;text-align:center;">
          <span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.border};">${cfg.label}</span>${sourceTag}
        </td>
        <td style="padding:8px 10px;border:1px solid #eaeaea;font-size:11px;color:#666;text-align:center;">${s.markedAt ? formatSriLankaDateTime(s.markedAt) : '—'}</td>
      </tr>`;
  }).join('');

  const attendanceRate = detail.students.length
    ? Math.round(((detail.presentCount + detail.lateCount) / detail.students.length) * 100)
    : 0;
  const rateColor = attendanceRate >= 75 ? '#00b050' : attendanceRate >= 50 ? '#ffc000' : '#e21b1b';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Session Attendance – ${detail.name}</title>
  <style>
    :root { --purple: #4c32e9; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f6fb; color: #333; }
    .page { width: 210mm; min-height: 297mm; margin: 20px auto; background: #fff; padding: 36px; box-shadow: 0 4px 24px rgba(0,0,0,.12); }

    .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${brandColor}; padding-bottom: 14px; margin-bottom: 22px; }
    .hdr-left { display: flex; align-items: center; gap: 14px; }
    .hdr-logo { width: 52px; height: 52px; background: ${brandColor}; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .hdr-logo svg { fill: #fff; width: 28px; height: 28px; }
    .hdr-titles h1 { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: .06em; }
    .hdr-titles h2 { font-size: 18px; color: #222; }
    .hdr-right { text-align: right; font-size: 13px; }
    .hdr-right .cls { font-weight: 700; color: #222; }
    .hdr-right .gen { color: #999; margin-top: 4px; }

    .banner { background: ${brandColor}; color: #fff; border-radius: 8px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .banner h3 { font-size: 16px; }
    .banner .rate { font-size: 13px; font-weight: 700; opacity: .9; }

    .stats { display: flex; gap: 10px; margin-bottom: 20px; }
    .stat { flex: 1; border: 1px solid #e8e8e8; border-radius: 6px; text-align: center; padding: 14px 0; border-top-width: 6px; border-top-style: solid; }
    .stat .n { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .stat .l { font-size: 10px; color: #888; text-transform: uppercase; }
    .sc-total   { border-top-color: #444;    color: #444; }
    .sc-present { border-top-color: #00b050; color: #00b050; }
    .sc-absent  { border-top-color: #e21b1b; color: #e21b1b; }
    .sc-late    { border-top-color: #ffc000; color: #ffc000; }
    .sc-nm      { border-top-color: #aaa;    color: #aaa; }

    .legend { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
    .leg { font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 20px; border: 1px solid transparent; }

    .tbl-wrap { border-radius: 8px; border: 1px solid #ddd; margin-bottom: 28px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: ${brandColor}; color: #fff; padding: 10px 12px; text-align: left; border: 1px solid ${brandColor}dd; }
    td { padding: 6px 10px; border: 1px solid #eaeaea; vertical-align: middle; }

    .footer { border-top: 1px solid #eee; padding-top: 12px; display: flex; justify-content: space-between; font-size: 11px; color: #bbb; }

    @media print {
      body { background: #fff; }
      .page { box-shadow: none; margin: 0; padding: 20px; width: 100%; }
      @page { size: A4 portrait; margin: 12mm; }
    }
  </style>
</head>
<body>
<div class="page">

  <div class="hdr">
    <div class="hdr-left">
      <div class="hdr-logo">
        <svg viewBox="0 0 24 24"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
      </div>
      <div class="hdr-titles">
        <h1>Session Attendance Report</h1>
        <h2>${detail.name}</h2>
      </div>
    </div>
    <div class="hdr-right">
      <div class="cls">${detail.date} · ${detail.startTime}${detail.endTime ? ` – ${detail.endTime}` : ''}${detail.group ? ` · ${detail.group.name}` : ''}</div>
      <div class="gen">Generated: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      <div class="gen" style="margin-top:2px;">${detail.isClosed ? '🔒 Closed' : '🟢 Open'}</div>
    </div>
  </div>

  <div class="banner">
    <h3>👥 Attendance Report</h3>
    <span class="rate" style="color:${rateColor};background:rgba(255,255,255,.15);padding:4px 12px;border-radius:20px;">Attendance Rate: ${attendanceRate}%</span>
  </div>

  <div class="stats">
    <div class="stat sc-total"><div class="n">${detail.students.length}</div><div class="l">Total</div></div>
    <div class="stat sc-present"><div class="n">${detail.presentCount}</div><div class="l">Present</div></div>
    <div class="stat sc-absent"><div class="n">${detail.absentCount}</div><div class="l">Absent</div></div>
    <div class="stat sc-late"><div class="n">${detail.lateCount}</div><div class="l">Late</div></div>
    <div class="stat sc-nm"><div class="n">${detail.notMarkedCount}</div><div class="l">Not Marked</div></div>
  </div>

  <div class="legend">
    <span class="leg" style="background:#C6EFCE;color:#375623;border-color:#A8D5B0;">Present</span>
    <span class="leg" style="background:#FFC7CE;color:#9C0006;border-color:#F4A7AE;">Absent</span>
    <span class="leg" style="background:#FFEB9C;color:#9C5700;border-color:#F0D580;">Late</span>
    <span class="leg" style="background:#E2D9F3;color:#5B3896;border-color:#C9BDE8;">Left</span>
    <span class="leg" style="background:#FFD9E8;color:#993366;border-color:#F4B8D0;">Left Early</span>
    <span class="leg" style="background:#D9D9FF;color:#33338B;border-color:#B8B8F0;">Left Lately</span>
    <span class="leg" style="background:#F5F5F5;color:#808080;border-color:#D0D0D0;">Not Marked</span>
  </div>

  <div class="tbl-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:50%;">Student</th>
          <th style="width:25%;text-align:center;">Status</th>
          <th style="width:25%;text-align:center;">Marked At</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="footer">
    <span>Suraksha LMS — Session Attendance Report</span>
    <span>Printed: ${new Date().toLocaleString()}</span>
  </div>

</div>
<script>window.onload=()=>{ window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}

export default function ClassAttendanceSessionView({ instituteId, classId, sessionId, onBack }: Props) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [saving, setSaving] = useState<string | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeAction, setCloseAction] = useState<CloseUnmarkAction>('KEEP_NOT_MARKED');
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await classAttendanceSessionsApi.getSessionDetail(instituteId, classId, sessionId);
      setDetail(data);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [instituteId, classId, sessionId]);

  useEffect(() => { load(); }, [load]);

  const handleMark = async (student: SessionStudentRecord, statusCode?: number) => {
    if (detail?.isClosed) return;
    setSaving(student.studentId);
    try {
      await classAttendanceSessionsApi.markAttendance(instituteId, classId, sessionId, {
        studentId: student.studentId,
        ...(statusCode !== undefined ? { status: statusCode } : {}),
      });
      const label = statusCode !== undefined
        ? (STATUS_OPTS.find(s => s.value === statusCode)?.label ?? 'marked')
        : 'marked';
      toast.success(`${student.studentName} ${label}`);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to mark');
    } finally {
      setSaving(null);
    }
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      await classAttendanceSessionsApi.closeSession(instituteId, classId, sessionId, {
        closeUnmarkAction: closeAction,
      });
      toast.success('Session closed');
      setCloseDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to close session');
    } finally {
      setClosing(false);
    }
  };

  const filtered = (detail?.students ?? []).filter(s => {
    const matchSearch = search
      ? s.studentName.toLowerCase().includes(search.toLowerCase()) ||
        (s.userIdInstitute ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.cardId ?? '').toLowerCase().includes(search.toLowerCase())
      : true;
    const matchFilter =
      filterMode === 'all' ? true :
      filterMode === 'present' ? s.statusCode === 1 || s.statusCode === 2 :
      filterMode === 'absent' ? s.statusCode === 0 :
      /* not-marked */ s.statusCode === null;
    return matchSearch && matchFilter;
  });

  if (loading && !detail) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Back + header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{detail?.name ?? 'Session'}</h2>
          <p className="text-sm text-muted-foreground">
            {detail?.date} · {detail?.startTime}{detail?.endTime ? ` – ${detail.endTime}` : ''}
            {detail?.group && (
              <span
                className="ml-2 text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: detail.group.color ? `${detail.group.color}22` : '#f0f0f0',
                  color: detail.group.color ?? '#555',
                  border: `1px solid ${detail.group.color ?? '#ccc'}`,
                }}
              >
                {detail.group.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {detail && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportSessionToPdf(detail)}
                disabled={!detail.students?.length}
              >
                <FileText className="h-4 w-4 mr-1.5" />PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportSessionAttendance(detail)}
                disabled={!detail.students?.length}
              >
                <Download className="h-4 w-4 mr-1.5" />Excel
              </Button>
            </>
          )}
          {!detail?.isClosed && (
            <Button size="sm" variant="destructive" onClick={() => setCloseDialogOpen(true)}>
              <Lock className="h-4 w-4 mr-1" />
              Close Session
            </Button>
          )}
          {detail?.isClosed && (
            <Badge variant="outline" className="text-destructive border-destructive">Closed</Badge>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {detail && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Present', count: detail.presentCount, icon: CheckCircle2, cls: 'text-green-600' },
            { label: 'Absent',  count: detail.absentCount,  icon: XCircle,      cls: 'text-red-600' },
            { label: 'Late',    count: detail.lateCount,    icon: Clock,        cls: 'text-yellow-600' },
            { label: 'Not Marked', count: detail.notMarkedCount, icon: Users,   cls: 'text-gray-500' },
          ].map(({ label, count, icon: Icon, cls }) => (
            <Card key={label}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${cls}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-bold">{count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name / ID / card..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 w-56"
          />
        </div>
        {(['all', 'present', 'absent', 'not-marked'] as FilterMode[]).map(mode => (
          <Button
            key={mode}
            size="sm"
            variant={filterMode === mode ? 'default' : 'outline'}
            onClick={() => setFilterMode(mode)}
            className="capitalize"
          >
            {mode === 'not-marked' ? 'Not Marked' : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Button>
        ))}
      </div>

      {/* Student rows */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No students match the current filter.
            </CardContent>
          </Card>
        )}
        {filtered.map(student => (
          <Card key={student.studentId}>
            <CardContent className="py-2 px-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={student.imageUrl ? getImageUrl(student.imageUrl) : undefined} />
                  <AvatarFallback className="text-xs">{initials(student.studentName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{student.studentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {student.userIdInstitute && <span className="mr-2">ID: {student.userIdInstitute}</span>}
                    {student.cardId && <span>Card: {student.cardId}</span>}
                  </p>
                </div>
                {/* Current status */}
                <div className="text-center shrink-0">
                  {student.statusCode !== null ? (
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[student.statusCode] ?? 'bg-gray-100'}`}>
                        {student.statusLabel}
                      </span>
                      {student.markedAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">{formatSriLankaDateTime(student.markedAt)}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Not Marked</span>
                  )}
                </div>
                {/* Mark buttons — shown for all students when session is open */}
                {!detail?.isClosed && (
                  <div className="flex items-center gap-1 flex-wrap shrink-0">
                    {/* Auto-mark: backend resolves Present/Late from session time rules */}
                    <Button
                      size="sm"
                      variant={student.statusCode === null ? 'default' : 'outline'}
                      className="text-xs px-2.5 h-7"
                      disabled={saving === student.studentId}
                      onClick={() => handleMark(student)}
                    >
                      {saving === student.studentId ? '…' : student.statusCode !== null ? '✓ Re-mark' : '✓ Mark'}
                    </Button>
                    {/* Absent shortcut */}
                    <Button
                      size="sm"
                      variant={student.statusCode === 0 ? 'default' : 'outline'}
                      className="text-xs px-2 h-7 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={saving === student.studentId}
                      onClick={() => handleMark(student, 0)}
                    >
                      Absent
                    </Button>
                    {/* More statuses */}
                    <Select onValueChange={v => handleMark(student, Number(v))}>
                      <SelectTrigger className="w-20 h-7 text-xs">
                        <SelectValue placeholder="More" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTS.map(opt => (
                          <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Close Session Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Close Session</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              There are <strong>{detail?.notMarkedCount ?? 0}</strong> students not yet marked.
              What should happen to them?
            </p>
            <div className="space-y-2">
              {([
                { value: 'KEEP_NOT_MARKED', label: 'Keep as Not Marked' },
                { value: 'MARK_ABSENT', label: 'Auto-mark as Absent' },
              ] as { value: CloseUnmarkAction; label: string }[]).map(opt => (
                <button
                  key={opt.value}
                  className={`w-full text-left px-4 py-2 rounded-lg border text-sm transition-colors
                    ${closeAction === opt.value ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:bg-muted'}`}
                  onClick={() => setCloseAction(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClose} disabled={closing}>
              {closing ? 'Closing…' : 'Close Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
