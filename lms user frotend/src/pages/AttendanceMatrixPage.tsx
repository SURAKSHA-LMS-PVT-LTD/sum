import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { attendanceApi } from '@/api/attendance.api';
import { instituteStudentsApi } from '@/api/instituteStudents.api';
import type { StudentListRecord } from '@/api/instituteStudents.api';
import type { AttendanceRecord } from '@/types/attendance.types';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { getSriLankaDate } from '@/utils/timezone';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Download, RefreshCw, Users, UserX, TrendingUp, Calendar, FileText } from 'lucide-react';
import ExcelJS from 'exceljs';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; short: string; bg: string; text: string; border: string }> = {
  present:      { label: 'Present',      short: 'P',  bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  late:         { label: 'Late',         short: 'L',  bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  absent:       { label: 'Absent',       short: 'A',  bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300' },
  left:         { label: 'Left',         short: '←',  bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  left_early:   { label: 'Left Early',   short: 'LE', bg: 'bg-pink-100',   text: 'text-pink-800',   border: 'border-pink-300' },
  left_lately:  { label: 'Left Late',    short: 'LL', bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
  not_marked:   { label: 'Not Marked',   short: '-',  bg: 'bg-orange-50',  text: 'text-orange-500', border: 'border-orange-200' },
};

function statusCell(status: string | null | undefined) {
  const key = status?.toLowerCase() ?? 'not_marked';
  return STATUS_CONFIG[key] ?? STATUS_CONFIG['not_marked'];
}

const XLSX_BORDER_STYLE = {
  top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
};

const STATUS_XLSX_STYLE: Record<string, { fill: string; text: string }> = {
  present:     { fill: 'FFE8F7ED', text: 'FF166534' },
  late:        { fill: 'FFFFF4D6', text: 'FF92400E' },
  absent:      { fill: 'FFFDE8E8', text: 'FFB91C1C' },
  left:        { fill: 'FFE7F0FF', text: 'FF1D4ED8' },
  left_early:  { fill: 'FFFFE4E6', text: 'FFBE123C' },
  left_lately: { fill: 'FFEDE9FE', text: 'FF5B21B6' },
  not_marked:  { fill: 'FFF1F5F9', text: 'FF475569' },
};

// ─── Excel export ─────────────────────────────────────────────────────────────
async function exportToExcel(
  students: StudentListRecord[],
  dates: string[],
  matrix: Record<string, Record<string, string>>,
  title: string,
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Attendance Matrix');

  const headers = ['#', 'Student Name', 'Student ID', 'Institute User ID', ...dates.map(d => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })), 'P', 'A', 'L', 'NM', 'Rate'];
  const headerRow = worksheet.addRow(headers);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = XLSX_BORDER_STYLE;
  });

  students.forEach((s, idx) => {
    let present = 0, absent = 0, late = 0, notMarked = 0;
    const statusShorts = dates.map(d => {
      const st = (matrix[s.id]?.[d] ?? 'not_marked').toLowerCase();
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'late') late++;
      else notMarked++;
      return { short: statusCell(st).short, key: st };
    });

    const rate = dates.length ? Math.round((present / dates.length) * 100) : 0;
    const row = worksheet.addRow([
      idx + 1,
      s.nameWithInitials || s.name,
      s.studentId || s.id,
      s.userIdByInstitute || '',
      ...statusShorts.map(ss => ss.short),
      present,
      absent,
      late,
      notMarked,
      `${rate}%`,
    ]);
    row.height = 20;
    row.eachCell((cell) => {
      cell.border = XLSX_BORDER_STYLE;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };

    // Status cells coloring
    statusShorts.forEach((ss, dateIdx) => {
      const cell = row.getCell(5 + dateIdx);
      const style = STATUS_XLSX_STYLE[ss.key.replace(/ /g, '_')] ?? STATUS_XLSX_STYLE['not_marked'];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } };
      cell.font = { bold: true, color: { argb: style.text } };
    });

    // Summary columns coloring
    const statsBase = 5 + dates.length;
    row.getCell(statsBase).font = { bold: true, color: { argb: STATUS_XLSX_STYLE.present.text } };
    row.getCell(statsBase + 1).font = { bold: true, color: { argb: STATUS_XLSX_STYLE.absent.text } };
    row.getCell(statsBase + 2).font = { bold: true, color: { argb: STATUS_XLSX_STYLE.late.text } };

    const rateCell = row.getCell(statsBase + 4);
    const rateStyle = rate >= 80 ? STATUS_XLSX_STYLE.present : rate >= 60 ? STATUS_XLSX_STYLE.late : STATUS_XLSX_STYLE.absent;
    rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rateStyle.fill } };
    rateCell.font = { bold: true, color: { argb: rateStyle.text } };
  });

  worksheet.columns = [
    { width: 6 }, { width: 28 }, { width: 18 }, { width: 18 },
    ...dates.map(() => ({ width: 8 })),
    { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 10 },
  ];
  worksheet.views = [{ state: 'frozen', xSplit: 4, ySplit: 1 }];

  // Summary sheet
  const ws2 = workbook.addWorksheet('Summary');
  ws2.addRow(['Attendance Report Summary']).font = { bold: true, size: 14 };
  ws2.addRow([]);
  ws2.addRow(['Title', title]);
  ws2.addRow(['Generated', new Date().toLocaleString()]);
  ws2.addRow(['Total Students', students.length]);
  ws2.addRow(['Total Days', dates.length]);
  ws2.addRow([]);
  const sumHeader = ws2.addRow(['Student', 'Present', 'Absent', 'Late', 'NM', 'Rate %']);
  sumHeader.font = { bold: true };
  sumHeader.eachCell(c => c.border = XLSX_BORDER_STYLE);

  students.forEach(s => {
    let present = 0, absent = 0, late = 0, notMarked = 0;
    dates.forEach(d => {
      const st = (matrix[s.id]?.[d] ?? 'not_marked').toLowerCase();
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'late') late++;
      else notMarked++;
    });
    const rate = dates.length ? Math.round((present / dates.length) * 100) : 0;
    const r = ws2.addRow([s.nameWithInitials || s.name, present, absent, late, notMarked, `${rate}%`]);
    r.eachCell(c => c.border = XLSX_BORDER_STYLE);
    const rateCell = r.getCell(6);
    const rateStyle = rate >= 80 ? STATUS_XLSX_STYLE.present : rate >= 60 ? STATUS_XLSX_STYLE.late : STATUS_XLSX_STYLE.absent;
    rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rateStyle.fill } };
    rateCell.font = { bold: true, color: { argb: rateStyle.text } };
  });
  ws2.columns = [{ width: 28 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 }];

  // Add Legend to Matrix sheet
  worksheet.addRow([]);
  const legendTitle = worksheet.addRow(['Status Legend']);
  legendTitle.font = { bold: true };
  Object.entries(STATUS_CONFIG).forEach(([key, cfg]) => {
    const r = worksheet.addRow([cfg.label, `(${cfg.short})`]);
    const style = STATUS_XLSX_STYLE[key] ?? STATUS_XLSX_STYLE['not_marked'];
    const c1 = r.getCell(1);
    c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.fill } };
    c1.font = { bold: true, color: { argb: style.text } };
    c1.border = XLSX_BORDER_STYLE;
    r.getCell(2).border = XLSX_BORDER_STYLE;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_${getSriLankaDate()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Read the live institute theme color from CSS variables ───────────────────
function getThemeHex(fallback = '#4c32e9'): string {
  try {
    const hsl = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary').trim();
    if (!hsl) return fallback;
    // HSL stored as "H S% L%" e.g. "217 91% 60%"
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

// ─── PDF Export ──────────────────────────────────────────────────────────────
function exportMatrixToPdf(
  students: StudentListRecord[],
  dates: string[],
  matrix: Record<string, Record<string, string>>,
  title: string,
  startDate: string,
  endDate: string,
) {
  const brandColor = getThemeHex();
  // Derive a lighter tint (15% opacity) for backgrounds
  const tint = `${brandColor}26`; // 26 hex ≈ 15% opacity

  const STATUS_PDF: Record<string, { label: string; color: string; bg: string }> = {
    present:     { label: 'P',  color: '#375623', bg: '#C6EFCE' },
    late:        { label: 'L',  color: '#9C5700', bg: '#FFEB9C' },
    absent:      { label: 'A',  color: '#9C0006', bg: '#FFC7CE' },
    left:        { label: '←', color: '#5B3896', bg: '#E2D9F3' },
    left_early:  { label: 'LE', color: '#993366', bg: '#FFD9E8' },
    left_lately: { label: 'LL', color: '#33338B', bg: '#D9D9FF' },
    not_marked:  { label: '-',  color: '#808080', bg: '#F5F5F5' },
  };

  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  // ── compute per-student stats ────────────────────────────────────────────────
  const studentStats = students.map(s => {
    let present = 0, absent = 0, late = 0, notMarked = 0;
    dates.forEach(d => {
      const st = (matrix[s.id]?.[d] ?? 'not_marked').toLowerCase();
      if (st === 'present') present++;
      else if (st === 'absent') absent++;
      else if (st === 'late') late++;
      else notMarked++;
    });
    const pct = dates.length ? Math.round(((present + late) / dates.length) * 100) : 0;
    return { present, absent, late, notMarked, pct };
  });

  const avgPct = studentStats.length
    ? Math.round(studentStats.reduce((a, s) => a + s.pct, 0) / studentStats.length)
    : 0;
  const totalPresent = studentStats.reduce((a, s) => a + s.present, 0);
  const totalAbsent  = studentStats.reduce((a, s) => a + s.absent, 0);
  const totalLate    = studentStats.reduce((a, s) => a + s.late, 0);

  // ── date header cells ───────────────────────────────────────────────────────
  const dateCols = dates.map(d => `<th style="min-width:34px;padding:6px 4px;background:#366092;color:#fff;font-size:10px;text-align:center;border:1px solid #d0d0d0;">${fmt(d)}</th>`).join('');

  // ── student rows ────────────────────────────────────────────────────────────
  const studentRows = students.map((s, idx) => {
    const cells = dates.map(d => {
      const key = (matrix[s.id]?.[d] ?? 'not_marked').toLowerCase().replace(' ', '_') as string;
      const cfg = STATUS_PDF[key] ?? STATUS_PDF['not_marked'];
      return `<td style="text-align:center;padding:4px 2px;border:1px solid #e0e0e0;background:${cfg.bg};color:${cfg.color};font-weight:bold;font-size:10px;">${cfg.label}</td>`;
    }).join('');
    const st = studentStats[idx];
    const pctColor = st.pct >= 80 ? '#375623' : st.pct >= 60 ? '#9C5700' : '#9C0006';
    const pctBg    = st.pct >= 80 ? '#C6EFCE' : st.pct >= 60 ? '#FFEB9C' : '#FFC7CE';
    return `
      <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f9f9ff'};">
        <td style="padding:6px 8px;border:1px solid #e0e0e0;font-size:11px;font-weight:600;white-space:nowrap;">${s.name}</td>
        <td style="padding:6px 8px;border:1px solid #e0e0e0;font-size:10px;color:#555;">${s.userIdByInstitute ?? s.studentId ?? ''}</td>
        ${cells}
        <td style="text-align:center;padding:4px;border:1px solid #e0e0e0;font-weight:bold;font-size:10px;color:#375623;background:#EAF5EA;">${st.present}</td>
        <td style="text-align:center;padding:4px;border:1px solid #e0e0e0;font-weight:bold;font-size:10px;color:#9C0006;background:#FEF0F0;">${st.absent}</td>
        <td style="text-align:center;padding:4px;border:1px solid #e0e0e0;font-weight:bold;font-size:10px;color:#9C5700;background:#FFFBE6;">${st.late}</td>
        <td style="text-align:center;padding:4px;border:1px solid #e0e0e0;font-weight:bold;font-size:11px;color:${pctColor};background:${pctBg};">${st.pct}%</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Attendance Matrix – ${title}</title>
  <style>
    :root { --purple: #4c32e9; --light-purple: #f4f2ff; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f6fb; color: #333; }
    .page { width: 210mm; min-height: 297mm; margin: 20px auto; background: #fff; padding: 32px; box-shadow: 0 4px 24px rgba(0,0,0,.12); }

    /* Header */
    .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${brandColor}; padding-bottom: 14px; margin-bottom: 22px; }
    .hdr-left { display: flex; align-items: center; gap: 14px; }
    .hdr-logo { width: 52px; height: 52px; background: ${brandColor}; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .hdr-logo svg { fill: #fff; width: 28px; height: 28px; }
    .hdr-titles h1 { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: .06em; }
    .hdr-titles h2 { font-size: 18px; color: #222; }
    .hdr-right { text-align: right; font-size: 13px; }
    .hdr-right .cls { font-weight: 700; color: #222; }
    .hdr-right .gen { color: #999; margin-top: 4px; }

    /* Summary banner */
    .banner { background: ${brandColor}; color: #fff; border-radius: 8px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .banner h3 { font-size: 16px; }
    .banner .rate { font-size: 13px; font-weight: 700; opacity: .9; }

    /* Stat cards */
    .stats { display: flex; gap: 10px; margin-bottom: 20px; }
    .stat { flex: 1; background: #fff; border: 1px solid #e8e8e8; border-radius: 6px; text-align: center; padding: 14px 0; border-top-width: 6px; border-top-style: solid; }
    .stat .n { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .stat .l { font-size: 10px; color: #888; text-transform: uppercase; }
    .sc-total   { border-top-color: #444;    color: #444; }
    .sc-days    { border-top-color: ${brandColor}; color: ${brandColor}; }
    .sc-present { border-top-color: #00b050; color: #00b050; }
    .sc-absent  { border-top-color: #e21b1b; color: #e21b1b; }
    .sc-late    { border-top-color: #ffc000; color: #ffc000; }
    .sc-avg     { border-top-color: ${brandColor}; color: ${brandColor}; }

    /* Legend */
    .legend { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .leg-item { font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 20px; border: 1px solid transparent; }

    /* Table */
    .tbl-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid #d8d8d8; margin-bottom: 28px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #366092; color: #fff; padding: 8px 6px; text-align: left; border: 1px solid #d0d0d0; }
    .th-right { text-align: center; }
    td { padding: 6px 8px; border: 1px solid #e8e8e8; }

    /* Footer */
    .footer { border-top: 1px solid #eee; padding-top: 12px; display: flex; justify-content: space-between; font-size: 11px; color: #aaa; }

    @media print {
      body { background: #fff; }
      .page { box-shadow: none; margin: 0; padding: 20px; width: 100%; }
      @page { size: A4 landscape; margin: 15mm; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="hdr">
    <div class="hdr-left">
      <div class="hdr-logo">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
      </div>
      <div class="hdr-titles">
        <h1>Attendance Matrix Report</h1>
        <h2>${title}</h2>
      </div>
    </div>
    <div class="hdr-right">
      <div class="cls">${startDate} → ${endDate}</div>
      <div class="gen">Generated: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>

  <!-- Banner -->
  <div class="banner">
    <h3>👥 Attendance Matrix</h3>
    <span class="rate">Average Attendance Rate: ${avgPct}%</span>
  </div>

  <!-- Stat Cards -->
  <div class="stats">
    <div class="stat sc-total"><div class="n">${students.length}</div><div class="l">Students</div></div>
    <div class="stat sc-days"><div class="n">${dates.length}</div><div class="l">Days</div></div>
    <div class="stat sc-present"><div class="n">${totalPresent}</div><div class="l">Present</div></div>
    <div class="stat sc-absent"><div class="n">${totalAbsent}</div><div class="l">Absent</div></div>
    <div class="stat sc-late"><div class="n">${totalLate}</div><div class="l">Late</div></div>
    <div class="stat sc-avg"><div class="n">${avgPct}%</div><div class="l">Avg Rate</div></div>
  </div>

  <!-- Legend -->
  <div class="legend">
    <span class="leg-item" style="background:#C6EFCE;color:#375623;border-color:#A8D5B0;">P = Present</span>
    <span class="leg-item" style="background:#FFC7CE;color:#9C0006;border-color:#F4A7AE;">A = Absent</span>
    <span class="leg-item" style="background:#FFEB9C;color:#9C5700;border-color:#F0D580;">L = Late</span>
    <span class="leg-item" style="background:#E2D9F3;color:#5B3896;border-color:#C9BDE8;">← = Left</span>
    <span class="leg-item" style="background:#FFD9E8;color:#993366;border-color:#F4B8D0;">LE = Left Early</span>
    <span class="leg-item" style="background:#D9D9FF;color:#33338B;border-color:#B8B8F0;">LL = Left Late</span>
    <span class="leg-item" style="background:#F5F5F5;color:#808080;border-color:#D0D0D0;">- = Not Marked</span>
  </div>

  <!-- Matrix Table -->
  <div class="tbl-wrap">
    <table>
      <thead>
        <tr>
          <th style="min-width:140px;">Student Name</th>
          <th style="min-width:90px;">Institute ID</th>
          ${dateCols}
          <th class="th-right" style="background:#EAF5EA;color:#375623;min-width:32px;">P</th>
          <th class="th-right" style="background:#FEF0F0;color:#9C0006;min-width:32px;">A</th>
          <th class="th-right" style="background:#FFFBE6;color:#9C5700;min-width:32px;">L</th>
          <th class="th-right" style="background:#f0f0ff;color:#366092;min-width:42px;">Rate</th>
        </tr>
      </thead>
      <tbody>
        ${studentRows}
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>Suraksha LMS — Attendance Matrix Report</span>
    <span>Printed: ${new Date().toLocaleString()}</span>
  </div>

</div>
<script>window.onload=()=>{ window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ─── Main view (reusable, no AppLayout) ──────────────────────────────────────
export const AttendanceMatrixView: React.FC = () => {
  const { selectedInstitute, selectedClass, selectedSubject } = useAuth();

  const today = getSriLankaDate();
  const thirtyOneDaysAgo = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }, [today]);

  const [startDate, setStartDate] = useState(thirtyOneDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentListRecord[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mode = selectedSubject?.id ? 'subject' : 'class';

  const instituteId = selectedInstitute?.id?.toString() ?? '';
  const classId = selectedClass?.id?.toString() ?? '';
  const subjectId = selectedSubject?.id?.toString() ?? '';
  const instituteName = selectedInstitute?.name ?? '';
  const className = selectedClass?.name ?? '';
  const subjectName = selectedSubject?.name ?? '';

  const title = mode === 'subject'
    ? `${instituteName} › ${className} › ${subjectName}`
    : `${instituteName} › ${className}`;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!instituteId || !classId) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch students + attendance records in parallel
      const [studentsRes, attendanceRes] = await Promise.all([
        mode === 'subject' && subjectId
          ? instituteStudentsApi.getStudentsBySubject(instituteId, classId, subjectId, { limit: 500 })
          : instituteStudentsApi.getStudentsByClass(instituteId, classId, { limit: 500 }),
        mode === 'subject' && subjectId
          ? attendanceApi.query.getSubjectAttendance(instituteId, classId, subjectId, { startDate, endDate, limit: 2000 })
          : attendanceApi.query.getClassAttendance(instituteId, classId, { startDate, endDate, limit: 2000 }),
      ]);
      setStudents(studentsRes.data ?? []);
      setRecords(attendanceRes.data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [instituteId, classId, subjectId, mode, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derive dates & matrix ──────────────────────────────────────────────────
  const { dates, matrix } = useMemo(() => {
    // Collect all unique dates that have at least one record
    const dateSet = new Set<string>();
    records.forEach(r => { if (r.date) dateSet.add(r.date.split('T')[0]); });
    const dates = Array.from(dateSet).sort();

    // Build matrix: studentId → date → status
    const matrix: Record<string, Record<string, string>> = {};
    records.forEach(r => {
      const date = r.date?.split('T')[0];
      if (!date) return;
      const sid = r.studentId;
      if (!matrix[sid]) matrix[sid] = {};
      matrix[sid][date] = r.status;
    });
    return { dates, matrix };
  }, [records]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!students.length || !dates.length) return null;
    let totalPresent = 0, totalAbsent = 0, totalLate = 0, totalNotMarked = 0;
    const rates: number[] = [];
    students.forEach(s => {
      let sp = 0;
      dates.forEach(d => {
        const st = (matrix[s.id]?.[d] ?? 'not_marked').toLowerCase();
        if (st === 'present') { sp++; totalPresent++; }
        else if (st === 'absent') totalAbsent++;
        else if (st === 'late') totalLate++;
        else totalNotMarked++;
      });
      rates.push(sp / dates.length);
    });
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    return { totalPresent, totalAbsent, totalLate, totalNotMarked, avg: Math.round(avg * 100), total: students.length, days: dates.length };
  }, [students, dates, matrix]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 p-3 pb-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportMatrixToPdf(students, dates, matrix, title, startDate, endDate)}
            disabled={!students.length || !dates.length}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />PDF
          </Button>
          <Button size="sm" onClick={() => exportToExcel(students, dates, matrix, title)} disabled={!students.length || !dates.length}>
            <Download className="h-3.5 w-3.5 mr-1.5" />Excel
          </Button>
        </div>
      </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs w-36" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={endDate} min={startDate} max={today} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs w-36" />
          </div>
          <Button size="sm" onClick={fetchData} className="h-8" disabled={loading}>Load</Button>
          <p className="text-[10px] text-muted-foreground self-end">Max 31 days (covers full months).</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard icon={<Users className="h-4 w-4 text-blue-500" />} label="Students" value={stats.total} />
            <StatCard icon={<Calendar className="h-4 w-4 text-slate-500" />} label="Days" value={stats.days} />
            <StatCard icon={<TrendingUp className="h-4 w-4 text-green-500" />} label="Avg Attendance" value={`${stats.avg}%`} highlight />
            <StatCard icon={<UserX className="h-4 w-4 text-red-500" />} label="Total Absent" value={stats.totalAbsent} />
          </div>
        )}

        {/* Status legend */}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <span key={key} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              {cfg.short} = {cfg.label}
            </span>
          ))}
        </div>

        {/* Matrix table */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        ) : !students.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Users className="h-10 w-10 opacity-30" />
            <p className="text-sm">No students found</p>
          </div>
        ) : !dates.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Calendar className="h-10 w-10 opacity-30" />
            <p className="text-sm">No attendance records in this date range</p>
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="min-w-max text-xs border-collapse">
              <thead>
                <tr className="bg-muted/60">
                  {/* Sticky student column header */}
                  <th className="sticky left-0 z-20 bg-muted/80 backdrop-blur-sm border-b border-r border-border px-3 py-2.5 text-left font-semibold text-[11px] min-w-[200px]">
                    Student
                  </th>
                  {/* Date headers */}
                  {dates.map(d => {
                    const dateObj = new Date(d + 'T00:00:00');
                    const isToday = d === today;
                    return (
                      <th key={d} className={`border-b border-r border-border px-1 py-2 text-center font-semibold min-w-[40px] ${isToday ? 'bg-primary/10 text-primary' : ''}`}>
                        <div className="text-[10px] leading-tight">{dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                        <div className="text-[9px] text-muted-foreground">{dateObj.toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                      </th>
                    );
                  })}
                  {/* Summary columns */}
                  <th className="border-b border-r border-border px-2 py-2 text-center font-semibold text-green-700 bg-green-50/40 min-w-[40px]">P</th>
                  <th className="border-b border-r border-border px-2 py-2 text-center font-semibold text-red-700 bg-red-50/40 min-w-[40px]">A</th>
                  <th className="border-b border-r border-border px-2 py-2 text-center font-semibold text-yellow-700 bg-yellow-50/40 min-w-[40px]">L</th>
                  <th className="border-b border-border px-2 py-2 text-center font-semibold min-w-[50px]">%</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, idx) => {
                  let present = 0, absent = 0, late = 0;
                  return (
                    <tr key={s.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                      {/* Sticky student info */}
                      <td className="sticky left-0 z-10 bg-inherit border-b border-r border-border px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 shrink-0 border border-border">
                            <AvatarImage
                              src={getImageUrl(s.imageUrl ?? null)}
                              alt={s.name}
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                              {s.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-semibold text-[11px] truncate max-w-[120px]" title={s.name}>
                              {s.nameWithInitials || s.name}
                            </p>
                            {s.studentId && <p className="text-[9px] text-muted-foreground truncate">{s.studentId}</p>}
                            {s.userIdByInstitute && <p className="text-[9px] text-blue-500 truncate">#{s.userIdByInstitute}</p>}
                          </div>
                        </div>
                      </td>
                      {/* Date cells */}
                      {dates.map(d => {
                        const st = matrix[s.id]?.[d] ?? 'not_marked';
                        const cfg = statusCell(st);
                        if (st === 'present') present++;
                        else if (st === 'absent') absent++;
                        else if (st === 'late') late++;
                        return (
                          <td key={d} className={`border-b border-r border-border text-center `}>
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-[10px] font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                              {cfg.short}
                            </span>
                          </td>
                        );
                      })}
                      {/* Summary */}
                      <td className="border-b border-r border-border text-center px-2 py-1.5 font-bold text-green-700 bg-green-50/30">{present}</td>
                      <td className="border-b border-r border-border text-center px-2 py-1.5 font-bold text-red-700 bg-red-50/30">{absent}</td>
                      <td className="border-b border-r border-border text-center px-2 py-1.5 font-bold text-yellow-700 bg-yellow-50/30">{late}</td>
                      <td className="border-b border-border text-center px-2 py-1.5">
                        <span className={`font-bold text-[11px] ${
                          Math.round((present / dates.length) * 100) >= 75 ? 'text-green-700' :
                          Math.round((present / dates.length) * 100) >= 50 ? 'text-yellow-700' : 'text-red-600'
                        }`}>
                          {dates.length ? Math.round((present / dates.length) * 100) : 0}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer totals */}
              {stats && (
                <tfoot>
                  <tr className="bg-muted/60 font-semibold">
                    <td className="sticky left-0 z-10 bg-muted/80 border-t border-r border-border px-3 py-2 text-[11px]">
                      Totals ({students.length} students)
                    </td>
                    {dates.map(d => {
                      const dayPresent = students.filter(s => (matrix[s.id]?.[d] ?? 'not_marked') === 'present').length;
                      const pct = Math.round((dayPresent / students.length) * 100);
                      return (
                        <td key={d} className="border-t border-r border-border text-center px-1 py-1.5">
                          <div className="text-[10px] font-bold text-green-700">{dayPresent}</div>
                          <div className={`text-[9px] ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{pct}%</div>
                        </td>
                      );
                    })}
                    <td className="border-t border-r border-border text-center px-2 py-1.5 text-green-700">{stats.totalPresent}</td>
                    <td className="border-t border-r border-border text-center px-2 py-1.5 text-red-700">{stats.totalAbsent}</td>
                    <td className="border-t border-r border-border text-center px-2 py-1.5 text-yellow-700">{stats.totalLate}</td>
                    <td className="border-t border-border text-center px-2 py-1.5 font-bold">{stats.avg}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
    </div>
  );
};

// ─── Page wrapper (with AppLayout) ───────────────────────────────────────────
const AttendanceMatrixPage: React.FC = () => (
  <AppLayout>
    <div className="pb-24 min-h-screen">
      <div className="p-3">
        <h1 className="text-lg font-bold mb-1">Attendance Matrix</h1>
      </div>
      <AttendanceMatrixView />
    </div>
  </AppLayout>
);

// ─── Stat card ─────────────────────────────────────────────────────────────────
const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; highlight?: boolean }> = ({ icon, label, value, highlight }) => (
  <div className={`rounded-xl border px-3 py-2.5 flex flex-col gap-1 ${highlight ? 'bg-primary/5 border-primary/30' : 'bg-card border-border'}`}>
    <div className="flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[11px]">{label}</span></div>
    <p className={`text-lg font-bold leading-none ${highlight ? 'text-primary' : ''}`}>{value}</p>
  </div>
);

export default AttendanceMatrixPage;
