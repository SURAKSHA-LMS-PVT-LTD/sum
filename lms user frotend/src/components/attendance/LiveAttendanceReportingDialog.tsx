import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lecture } from '@/api/lecture.api';
import { AttendanceGridResult } from '@/api/lectureTracking.api';
import { StudentListRecord } from '@/api/instituteStudents.api';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { FileText, Table as TableIcon } from 'lucide-react';
import jsPDF from 'jspdf';
// @ts-ignore - jspdf-autotable side-effect import
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx-js-style';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grid: AttendanceGridResult | null;
  selectedLectures: Lecture[];
  className: string;
  studentDirectoryById: Record<string, StudentListRecord>;
}

function formatTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function LiveAttendanceReportingDialog({ open, onOpenChange, grid, selectedLectures, className, studentDirectoryById }: Props) {
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [studentFilter, setStudentFilter] = useState<'all' | 'present'>('all');
  const [targetLectureId, setTargetLectureId] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open || selectedLectures.length === 0) return;
    setTargetLectureId(prev => (selectedLectures.some(lecture => lecture.id === prev) ? prev : selectedLectures[0].id));
  }, [open, selectedLectures]);

  const selectedLecture = useMemo(
    () => selectedLectures.find(lecture => lecture.id === targetLectureId) ?? selectedLectures[0] ?? null,
    [selectedLectures, targetLectureId],
  );

  const visibleStudents = useMemo(() => {
    if (!selectedLecture) return [];

    const baseStudents = grid?.students?.length
      ? grid.students
      : Object.values(studentDirectoryById).map(student => ({
        id: student.id,
        name: student.name,
        imageUrl: student.imageUrl || null,
      }));

    return baseStudents.filter(student => {
      if (studentFilter === 'all') return true;
      return !!grid?.grid?.[student.id]?.[selectedLecture.id]?.attended;
    });
  }, [grid, selectedLecture, studentFilter, studentDirectoryById]);

  const generatePdf = async () => {
    if (!grid || !selectedLecture) return;

    const studentImages = new Map<string, string | null>();
    await Promise.all(
      visibleStudents.map(async student => {
        const source = student.imageUrl ? getImageUrl(student.imageUrl) : null;
        studentImages.set(student.id, source ? await toDataUrl(source) : null);
      }),
    );

    const doc = new jsPDF('landscape', 'mm', 'a4');
    const reportDate = selectedLecture.startTime ? formatDateTime(selectedLecture.startTime) : '—';

    const body = visibleStudents.map(student => {
      const cell = grid?.grid?.[student.id]?.[selectedLecture.id];
      const attended = !!cell?.attended;
      const instituteUserId = studentDirectoryById[student.id]?.userIdByInstitute || student.id;
      return [
        student.name,
        instituteUserId,
        attended ? 'Present' : 'Absent',
        reportDate,
        attended ? formatTime(cell?.joinTime) : '—',
      ];
    });

    doc.setFontSize(14);
    doc.text(`Live Attendance Report - ${className}`, 14, 14);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `Lecture: ${selectedLecture.title} | Filter: ${studentFilter === 'all' ? 'All Students' : 'Only Present Students'} | Generated: ${new Date().toLocaleString()}`,
      14,
      20,
    );

    autoTable(doc, {
      startY: 26,
      head: [['Student Image/Name', 'Institute User ID', 'Status', 'Date', 'Present Time']],
      body,
      theme: 'grid',
      margin: { left: 14, right: 14 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center' },
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 58, halign: 'left' },
        1: { cellWidth: 36, halign: 'left' },
        2: { cellWidth: 24, halign: 'center' },
        3: { cellWidth: 42, halign: 'center' },
        4: { cellWidth: 28, halign: 'center' },
      },
      didParseCell: data => {
        if (data.section === 'body' && data.column.index === 0) {
          data.cell.styles.cellPadding = { top: 2, right: 2, bottom: 2, left: 14 } as any;
        }
      },
      didDrawCell: data => {
        if (data.section !== 'body' || data.column.index !== 0) return;
        const student = visibleStudents[data.row.index];
        if (!student) return;

        const avatarX = data.cell.x + 2.5;
        const avatarY = data.cell.y + 2.3;
        const avatarSize = 8.5;
        const image = studentImages.get(student.id);

        if (image) {
          try {
            doc.addImage(image, avatarX, avatarY, avatarSize, avatarSize, undefined, 'FAST');
            return;
          } catch {
            // Fallback to initials below.
          }
        }

        doc.setFillColor(52, 144, 220);
        doc.circle(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 'F');
        doc.setTextColor(255);
        doc.setFontSize(6.5);
        doc.text(initials(student.name), avatarX + avatarSize / 2, avatarY + 5.6, { align: 'center' });
        doc.setTextColor(0);
      },
      didDrawPage: data => {
        doc.setFontSize(8);
        doc.setTextColor(110);
        doc.text(`Page ${data.pageNumber}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      },
    });

    doc.save(`Live_Attendance_${selectedLecture.title.replace(/[^a-z0-9]/gi, '_')}.pdf`);
  };

  const generateExcel = () => {
    if (!grid || !selectedLecture) return;

    const wb = XLSX.utils.book_new();
    const headers = ['Image', 'Name', 'Institute User ID', 'Date', 'Present Time', 'Status'];
    const rows: any[][] = [headers];

    const baseStudents = grid.students.length
      ? grid.students
      : Object.values(studentDirectoryById).map(student => ({
        id: student.id,
        name: student.name,
        imageUrl: student.imageUrl || null,
      }));

    const exportStudents = baseStudents.filter(student => {
      if (studentFilter === 'all') return true;
      return !!grid?.grid?.[student.id]?.[selectedLecture.id]?.attended;
    });

    exportStudents.forEach(student => {
      const cell = grid.grid[student.id]?.[selectedLecture.id];
      const attended = !!cell?.attended;
      const instituteUserId = studentDirectoryById[student.id]?.userIdByInstitute || student.id;
      const row = [
        student.imageUrl ? 'View' : '—',
        student.name,
        instituteUserId,
        selectedLecture.startTime ? new Date(selectedLecture.startTime).toLocaleDateString() : '—',
        attended ? formatTime(cell?.joinTime) : '—',
        attended ? 'Present' : 'Absent',
      ];
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const enc = XLSX.utils.encode_cell;
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '2980B9' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    };

    for (let c = 0; c < headers.length; c++) {
      const addr = enc({ r: 0, c });
      if (ws[addr]) ws[addr].s = headerStyle;
    }

    ws['!cols'] = [
      { wch: 10 },
      { wch: 26 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
    ];

    ws['!views'] = [{
      state: 'frozen',
      xSplit: 3,
      ySplit: 1,
      activeCell: 'D2',
    }];

    for (let r = 1; r < rows.length; r++) {
      const imageCell = enc({ r, c: 0 });
      const imageStudent = exportStudents[r - 1];
      if (ws[imageCell] && imageStudent?.imageUrl) {
        ws[imageCell].l = {
          Target: getImageUrl(imageStudent.imageUrl),
          Tooltip: imageStudent.name,
        };
        ws[imageCell].s = {
          font: { color: { rgb: '0563C1' }, underline: true },
          alignment: { horizontal: 'center' },
        };
      }

      for (let c = 3; c <= 5; c++) {
        const addr = enc({ r, c });
        const wsCell = ws[addr];
        if (!wsCell) continue;
        wsCell.s = {
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        };
      }

      const statusAddr = enc({ r, c: 5 });
      const statusCell = ws[statusAddr];
      if (statusCell && statusCell.v === 'Present') {
        statusCell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: 'C6EFCE' } },
          font: { color: { rgb: '006100' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        };
      } else if (statusCell) {
        statusCell.s = {
          fill: { patternType: 'solid', fgColor: { rgb: 'FDE2E1' } },
          font: { color: { rgb: '9C0006' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Lecture Report');
    XLSX.writeFile(wb, `Live_Attendance_${selectedLecture.title.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
  };

  const handleGenerate = async () => {
    if (!grid || selectedLectures.length === 0) {
      toast.error('No data available to export.');
      return;
    }

    if (!selectedLecture) {
      toast.error('Select a target lecture to continue.');
      return;
    }

    setGenerating(true);
    try {
      if (format === 'pdf') {
        await generatePdf();
      } else {
        generateExcel();
      }
      onOpenChange(false);
      toast.success('Report generated successfully.');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} routeName="live-attendance-reporting-popup">
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Generate Live Attendance Report</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Export Format</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={format === 'pdf' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setFormat('pdf')}
              >
                <FileText className="mr-2 h-4 w-4" /> PDF
              </Button>
              <Button
                type="button"
                variant={format === 'excel' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setFormat('excel')}
              >
                <TableIcon className="mr-2 h-4 w-4" /> Excel
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Student Filter</Label>
            <Select value={studentFilter} onValueChange={(v: 'all' | 'present') => setStudentFilter(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="present">Only Present Students</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Target Lecture</Label>
            <Select value={targetLectureId} onValueChange={setTargetLectureId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectedLectures.map(lecture => (
                  <SelectItem key={lecture.id} value={lecture.id}>
                    {lecture.title}
                    {lecture.startTime ? ` · ${formatDateTime(lecture.startTime)}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLectures.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Exports are generated for one lecture at a time to preserve detailed per-student fields.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={generating || selectedLectures.length === 0 || !selectedLecture}>
            {generating ? 'Generating...' : 'Generate Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
