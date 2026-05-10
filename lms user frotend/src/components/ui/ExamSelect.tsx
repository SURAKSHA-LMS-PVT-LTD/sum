import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList } from 'lucide-react';
import { examApi, type Exam } from '@/api/exam.api';

interface ExamSelectProps {
  instituteId: string;
  classId?: string;
  subjectId?: string;
  value: string;
  onChange: (examId: string, examTitle: string, exam: Exam) => void;
  statusFilter?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Dropdown that lists exams filtered by institute/class/subject.
 * Calls GET /institute-class-subject-exams?instituteId=&classId=&subjectId=
 */
const ExamSelect: React.FC<ExamSelectProps> = ({
  instituteId,
  classId,
  subjectId,
  value,
  onChange,
  statusFilter,
  label = 'Exam',
  placeholder = 'Select exam…',
  required = false,
  disabled = false,
  className,
}) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!instituteId) { setExams([]); return; }
    setLoading(true);
    examApi.getExams({
      instituteId,
      classId,
      subjectId,
      status: statusFilter,
      limit: 100,
    }, true)
      .then(res => setExams(res?.data ?? []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, [instituteId, classId, subjectId, statusFilter]);

  if (loading) return (
    <div className={`space-y-1 ${className ?? ''}`}>
      {label && <Label className="text-sm font-medium">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>}
      <Skeleton className="h-10 w-full" />
    </div>
  );

  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      {label && (
        <Label className="text-sm font-medium">
          {label}{required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      )}
      <Select
        value={value}
        onValueChange={id => {
          const exam = exams.find(e => e.id === id);
          if (exam) onChange(exam.id, exam.title, exam);
        }}
        disabled={disabled || exams.length === 0}
      >
        <SelectTrigger>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder={exams.length === 0 ? 'No exams found' : placeholder} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {exams.map(e => (
            <SelectItem key={e.id} value={e.id}>
              <span>{e.title}</span>
              {e.examDate && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({new Date(e.examDate).toLocaleDateString()})
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ExamSelect;
