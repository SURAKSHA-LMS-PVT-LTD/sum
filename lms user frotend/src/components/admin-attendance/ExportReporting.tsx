import React, { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi, { AdminAttendanceRecord, fetchMultiWindow } from '@/api/adminAttendance.api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Printer, FileText, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

function toSriLankaTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleString('en-LK', { timeZone: 'Asia/Colombo' });
  } catch { return isoStr; }
}

function escHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CSV_HEADERS = [
  'No.', 'Date', 'User Name', 'User ID', 'User Type',
  'Class', 'Subject', 'Status', 'Marked At', 'Marking Method',
  'Marked By', 'Event Title', 'Event ID', 'Institute', 'Remarks',
];

function toCSVRow(r: AdminAttendanceRecord, index: number): string[] {
  return [
    String(index + 1),
    r.date || r.markedAt?.split('T')[0] || '',
    r.studentName || r.userName || '',
    r.studentId || r.userId || '',
    r.userType || 'student',
    r.className || '',
    r.subjectName || '',
    r.status || '',
    r.markedAt ? toSriLankaTime(r.markedAt) : '',
    r.markingMethod || '',
    r.markedBy || '',
    r.eventTitle || '',
    r.eventId || '',
    r.instituteName || '',
    r.remarks || '',
  ];
}

function exportToCSV(records: AdminAttendanceRecord[], filename: string) {
  const rows = records.map((r, i) => toCSVRow(r, i));
  const csvContent = [
    CSV_HEADERS.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  // BOM for Excel UTF-8 compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function buildPrintDocument(
  records: AdminAttendanceRecord[],
  instituteName: string,
  startDate: string,
  endDate: string,
  scopeLabel: string,
): string {
  const rows = records.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtml(r.date || r.markedAt?.split('T')[0] || '—')}</td>
      <td>${escHtml(r.studentName || r.userName || '—')}</td>
      <td>${escHtml(r.studentId || r.userId || '—')}</td>
      <td>${escHtml(r.userType || 'student')}</td>
      <td>${escHtml(r.className || '—')}</td>
      <td>${escHtml(r.subjectName || '—')}</td>
      <td class="status">${escHtml(r.status || '—')}</td>
      <td>${r.markedAt ? escHtml(toSriLankaTime(r.markedAt)) : '—'}</td>
      <td>${escHtml(r.markingMethod || '—')}</td>
      <td>${escHtml(r.markedBy || '—')}</td>
      <td>${r.eventTitle ? escHtml(r.eventTitle) : '—'}</td>
      <td>${escHtml(r.instituteName || '—')}</td>
      <td>${escHtml(r.remarks || '—')}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html>
    <head>
      <title>Attendance Report — ${escHtml(instituteName)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .meta { font-size: 12px; color: #888; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; font-weight: 600; }
        tr:nth-child(even) { background: #fafafa; }
        td.status { font-weight: 600; text-transform: capitalize; }
        @media print { body { margin: 10px; } }
      </style>
    </head>
    <body>
      <h1>Attendance Report — ${escHtml(instituteName)}</h1>
      <p class="meta">
        Scope: ${escHtml(scopeLabel)} &nbsp;|&nbsp;
        Date Range: ${escHtml(startDate)} to ${escHtml(endDate)} &nbsp;|&nbsp;
        Total records: ${records.length} &nbsp;|&nbsp;
        Generated: ${new Date().toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })}
      </p>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Date</th><th>User Name</th><th>User ID</th><th>User Type</th>
            <th>Class</th><th>Subject</th><th>Status</th><th>Marked At</th>
            <th>Method</th><th>Marked By</th><th>Event</th><th>Institute</th><th>Remarks</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>`;
}

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  late: 'bg-yellow-100 text-yellow-700',
  left: 'bg-blue-100 text-blue-700',
  left_early: 'bg-orange-100 text-orange-700',
  left_lately: 'bg-purple-100 text-purple-700',
};

const USERTYPE_COLORS: Record<string, string> = {
  student: 'bg-sky-100 text-sky-700',
  teacher: 'bg-violet-100 text-violet-700',
  staff: 'bg-emerald-100 text-emerald-700',
};

const PREVIEW_LIMIT = 50;

const ExportReporting: React.FC = () => {
  const { currentInstituteId, selectedInstitute } = useAuth();
  const [exportType, setExportType] = useState<'institute' | 'class' | 'subject'>('institute');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);
  const [reportRecords, setReportRecords] = useState<AdminAttendanceRecord[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const scopeLabel = exportType === 'class'
    ? `Class (${classId || '?'})`
    : exportType === 'subject'
      ? `Subject (${subjectId || '?'}) — Class (${classId || '?'})`
      : 'Institute-wide';

  const fetchRecords = useCallback(async (): Promise<AdminAttendanceRecord[]> => {
    if (!currentInstituteId) throw new Error('No institute selected');

    if (exportType === 'class') {
      if (!classId.trim()) throw new Error('Class ID is required for class-scoped export');
      return fetchMultiWindow(
        `/api/attendance/institute/${currentInstituteId}/class/${classId.trim()}`,
        startDate, endDate,
      );
    }

    if (exportType === 'subject') {
      if (!classId.trim()) throw new Error('Class ID is required for subject-scoped export');
      if (!subjectId.trim()) throw new Error('Subject ID is required for subject-scoped export');
      return fetchMultiWindow(
        `/api/attendance/institute/${currentInstituteId}/class/${classId.trim()}/subject/${subjectId.trim()}`,
        startDate, endDate,
      );
    }

    return adminAttendanceApi.getInstituteAttendanceRange(currentInstituteId, startDate, endDate);
  }, [currentInstituteId, exportType, classId, subjectId, startDate, endDate]);

  const handleExport = useCallback(async () => {
    setLoading(true);
    try {
      const records = await fetchRecords();
      if (!records || records.length === 0) {
        toast.error('No records found for the selected range');
        setReportRecords([]);
        return;
      }
      setReportRecords(records);
      setShowPreview(true);
      const name = selectedInstitute?.name?.replace(/\s+/g, '_') || 'institute';
      exportToCSV(records, `attendance_${name}_${exportType}`);
      toast.success(`Exported ${records.length} records`);
    } catch (e: any) {
      toast.error(e.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  }, [fetchRecords, selectedInstitute, exportType]);

  const handlePrint = useCallback(async () => {
    let records = reportRecords;
    if (!records.length) {
      setLoading(true);
      try {
        records = await fetchRecords();
        if (!records.length) { toast.error('No records to print'); return; }
        setReportRecords(records);
      } catch (e: any) {
        toast.error(e.message || 'Failed to load data');
        return;
      } finally {
        setLoading(false);
      }
    }
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildPrintDocument(records, selectedInstitute?.name || 'Institute', startDate, endDate, scopeLabel));
    win.document.close();
    win.print();
  }, [reportRecords, fetchRecords, selectedInstitute, startDate, endDate, scopeLabel]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Export & Reporting
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Export Scope</Label>
            <Select value={exportType} onValueChange={v => setExportType(v as typeof exportType)}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="institute" className="text-xs">Institute-wide</SelectItem>
                <SelectItem value="class" className="text-xs">By Class</SelectItem>
                <SelectItem value="subject" className="text-xs">By Subject</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Start Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs" />
          </div>
          <div>
            <Label className="text-xs">End Date</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs" />
          </div>
        </div>

        {/* Class / Subject ID inputs (conditional) */}
        {(exportType === 'class' || exportType === 'subject') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Class ID</Label>
              <Input
                placeholder="Enter Class ID"
                value={classId}
                onChange={e => setClassId(e.target.value)}
                className="text-xs"
              />
            </div>
            {exportType === 'subject' && (
              <div>
                <Label className="text-xs">Subject ID</Label>
                <Input
                  placeholder="Enter Subject ID"
                  value={subjectId}
                  onChange={e => setSubjectId(e.target.value)}
                  className="text-xs"
                />
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap items-center">
          <Button size="sm" onClick={handleExport} disabled={loading}>
            <Download className="h-3 w-3 mr-1" />
            {loading ? 'Loading…' : 'Export CSV'}
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint} disabled={loading}>
            <Printer className="h-3 w-3 mr-1" />
            Print Report
          </Button>
          {reportRecords.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setShowPreview(p => !p)}>
              {showPreview
                ? <><EyeOff className="h-3 w-3 mr-1" />Hide Preview</>
                : <><Eye className="h-3 w-3 mr-1" />Preview ({reportRecords.length})</>
              }
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          CSV columns: No., Date, User Name, User ID, <strong>User Type</strong>, Class, Subject, Status,
          Marked At, Marking Method, <strong>Marked By</strong>, <strong>Event Title</strong>, Event ID,
          Institute, Remarks. Attendance without a linked event shows an empty Event column.
          Large ranges are split into 5-day windows automatically.
        </p>

        {/* Inline preview table */}
        {showPreview && reportRecords.length > 0 && (
          <div className="rounded border overflow-x-auto">
            {reportRecords.length > PREVIEW_LIMIT && (
              <p className="text-xs text-amber-600 px-3 py-1.5 bg-amber-50 border-b">
                Showing first {PREVIEW_LIMIT} of {reportRecords.length} records — use Export CSV for full data.
              </p>
            )}
            <table className="w-full text-xs border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-muted/50">
                  {['#', 'Date', 'Name', 'ID', 'Type', 'Class', 'Subject', 'Status', 'Marked At', 'Method', 'Marked By', 'Event'].map(h => (
                    <th key={h} className="border px-2 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportRecords.slice(0, PREVIEW_LIMIT).map((r, i) => (
                  <tr key={r.attendanceId || r.id || i} className="hover:bg-muted/30">
                    <td className="border px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="border px-2 py-1.5 whitespace-nowrap">{r.date || r.markedAt?.split('T')[0] || '—'}</td>
                    <td className="border px-2 py-1.5 font-medium">{r.studentName || r.userName || '—'}</td>
                    <td className="border px-2 py-1.5 text-muted-foreground text-[10px]">{r.studentId || r.userId || '—'}</td>
                    <td className="border px-2 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${USERTYPE_COLORS[r.userType || 'student'] || 'bg-secondary'}`}>
                        {r.userType || 'student'}
                      </span>
                    </td>
                    <td className="border px-2 py-1.5">{r.className || '—'}</td>
                    <td className="border px-2 py-1.5">{r.subjectName || '—'}</td>
                    <td className="border px-2 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="border px-2 py-1.5 whitespace-nowrap">{r.markedAt ? toSriLankaTime(r.markedAt) : '—'}</td>
                    <td className="border px-2 py-1.5">{r.markingMethod || '—'}</td>
                    <td className="border px-2 py-1.5">{r.markedBy || '—'}</td>
                    <td className="border px-2 py-1.5">
                      {r.eventTitle
                        ? <span className="text-primary font-medium">{r.eventTitle}</span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default ExportReporting;
