
import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lecture } from '@/api/lecture.api';
import { AttendanceGridResult } from '@/api/lectureTracking.api';
import { StudentListRecord } from '@/api/instituteStudents.api';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { FileText, Table as TableIcon, Settings2, ArrowRight, ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

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

// ─── Column & Filter Types ───────────────────────────────────────────────────┘

type StudentFilterType = 'all' | 'present' | 'absent';
type AbsenceFilterCondition = 'gte' | 'lte' | 'eq';

interface ReportColumn {
  id: keyof StudentExportRow;
  label: string;
  enabled: boolean;
}

interface StudentExportRow {
  id: string;
  name: string;
  initials: string;
  phone: string;
  instituteId: string;
  imageUrl: string;
  [key: `lecture_${string}_status`]: string;
  [key: `lecture_${string}_joinTime`]: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────┘

export default function LiveAttendanceReportingDialog({
  open,
  onOpenChange,
  grid,
  selectedLectures,
  className,
  studentDirectoryById,
}: Props) {

  // ─── Step Management ───────────────────────────────────────────────────────┘

  const [step, setStep] = useState(1);

  // ─── Report Configuration State ──────────────────────────────────────────┘

  const [format, setFormat] = useState('excel');
  const [studentFilter, setStudentFilter] = useState<StudentFilterType>('all');
  const [absenceFilterCondition, setAbsenceFilterCondition] = useState<AbsenceFilterCondition>('gte');
  const [absenceFilterCount, setAbsenceFilterCount] = useState<number>(1);
  const [generating, setGenerating] = useState(false);

  // ─── Column Configuration ──────────────────────────────────────────────────┘

  const [columns, setColumns] = useState<ReportColumn[]>([
    { id: 'name', label: 'Name', enabled: true },
    { id: 'instituteId', label: 'Institute ID', enabled: true },
    { id: 'phone', label: 'Phone', enabled: false },
    { id: 'initials', label: 'Initials', enabled: false },
  ]);

  const toggleColumn = (id: keyof StudentExportRow) => {
    setColumns(prev => prev.map(c => (c.id === id ? { ...c, enabled: !c.enabled } : c)));
  };

  // ─── Student & Data Filtering Logic ──────────────────────────────────────┘

  const studentAbsenceCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    if (!grid) return counts;

    for (const studentId in grid.grid) {
      let absentCount = 0;
      for (const lecture of selectedLectures) {
        if (!grid.grid[studentId]?.[lecture.id]?.attended) {
          absentCount++;
        }
      }
      counts[studentId] = absentCount;
    }

    return counts;
  }, [grid, selectedLectures]);

  const filteredStudents = useMemo<StudentListRecord[]>(() => {
    const baseStudents = Object.values(studentDirectoryById);

    if (studentFilter === 'all') {
      return baseStudents;
    }

    return baseStudents.filter(student => {
      const totalAbsences = studentAbsenceCounts[student.id] || 0;

      if (studentFilter === 'present') {
        return totalAbsences === 0;
      }

      if (studentFilter === 'absent') {
        switch (absenceFilterCondition) {
          case 'gte': return totalAbsences >= absenceFilterCount;
          case 'lte': return totalAbsences <= absenceFilterCount;
          case 'eq': return totalAbsences === absenceFilterCount;
          default: return true;
        }
      }
      return true;
    });
  }, [
    studentDirectoryById,
    studentFilter,
    studentAbsenceCounts,
    absenceFilterCondition,
    absenceFilterCount,
  ]);

  // ─── Report Generation ─────────────────────────────────────────────────────┘

  const generateExcel = () => {
    if (!grid) return;

    const enabledColumns = columns.filter(c => c.enabled);

    // Build headers: Enabled student columns + dynamic lecture columns
    const headers = [
      ...enabledColumns.map(c => c.label),
      ...selectedLectures.flatMap(lecture => [`${lecture.title}-Status`, `${lecture.title}-JoinTime`]),
    ];

    // Build rows
    const rows = filteredStudents.map(student => {
      const studentRow: StudentExportRow = {
        id: student.id,
        name: student.name,
        initials: student.name.split(' ').map(s => s[0]).join(''),
        phone: student.phone || '—',
        instituteId: student.userIdByInstitute || student.id,
        imageUrl: student.imageUrl || '—',
      };

      const studentColumns = enabledColumns.map(c => studentRow[c.id]);
      const lectureColumns = selectedLectures.flatMap(lecture => {
        const cell = grid.grid[student.id]?.[lecture.id];
        const attended = !!cell?.attended;
        return [attended ? 'Present' : 'Absent', attended ? formatTime(cell?.joinTime) : '—'];
      });

      return [...studentColumns, ...lectureColumns];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Styling
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { patternType: 'solid', fgColor: { rgb: '2980B9' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
    headers.forEach((_, c) => {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) cell.s = headerStyle;
    });

    ws['!cols'] = headers.map(h => ({ wch: h.includes('Status') || h.includes('Time') ? 14 : 22 }));

    XLSX.utils.book_append_sheet(XLSX.utils.book_new(), ws, 'Attendance Report');
    XLSX.writeFile(XLSX.utils.book_new(), `Live_Attendance_${className.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
    toast.success('Excel report generated!');
  };

  const handleGenerate = async () => {
    if (!grid) {
      toast.error('No data available to export.');
      return;
    }

    setGenerating(true);
    try {
      generateExcel();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setStep(1);
      setStudentFilter('all');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle>Generate Advanced Attendance Report</DialogTitle>
        </DialogHeader>
        
        {step === 1 && (
          <div className="grid gap-6 py-4">
            <p className="text-sm text-muted-foreground">
              Export attendance for {selectedLectures.length} lectures and {Object.keys(studentDirectoryById).length} students.
            </p>

            <div className="space-y-3">
              <Label className="font-semibold">Student Filter</Label>
              <Select value={studentFilter} onValueChange={(v: StudentFilterType) => setStudentFilter(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  <SelectItem value="present">Only Present (in all selected lectures)</SelectItem>
                  <SelectItem value="absent">Only Absent (in one or more lectures)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {studentFilter === 'absent' && (
              <div className="grid grid-cols-3 items-center gap-3 pl-4 border-l-2">
                <Label className="text-xs col-span-3">...where total absences are:</Label>
                <Select value={absenceFilterCondition} onValueChange={(v: AbsenceFilterCondition) => setAbsenceFilterCondition(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gte">Greater than or equal to</SelectItem>
                    <SelectItem value="lte">Less than or equal to</SelectItem>
                    <SelectItem value="eq">Exactly equal to</SelectItem>
                  </SelectContent>
                </Select>
                <Input 
                  type="number"
                  className="col-span-2"
                  value={absenceFilterCount} 
                  onChange={e => setAbsenceFilterCount(Math.max(1, parseInt(e.target.value, 10)))}
                  min={1}
                />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-6 py-4">
            <p className="text-sm text-muted-foreground">
              Select the student details to include in the Excel export.
              Lecture status and join times will be added automatically.
            </p>
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <Label className="font-semibold flex items-center gap-2"><Settings2 className="h-4 w-4"/> Customize Columns</Label>
              <div className="grid grid-cols-2 gap-3">
                {columns.map(col => (
                  <div key={col.id} className="flex items-center gap-2">
                    <Checkbox id={col.id} checked={col.enabled} onCheckedChange={() => toggleColumn(col.id)} />
                    <Label htmlFor={col.id} className="text-sm font-normal">{col.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={selectedLectures.length === 0}>
              Next <ArrowRight className="ml-2 h-4 w-4"/>
            </Button>
          )}
          {step === 2 && (
            <div className="w-full flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4"/> Back
              </Button>
              <Button onClick={handleGenerate} disabled={generating || selectedLectures.length === 0}>
                {generating ? 'Generating...' : `Generate for ${filteredStudents.length} Students`}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
