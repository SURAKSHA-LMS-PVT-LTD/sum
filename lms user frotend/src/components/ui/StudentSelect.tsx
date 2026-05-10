import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { instituteStudentsApi } from '@/api/instituteStudents.api';
import type { StudentListRecord } from '@/api/instituteStudents.api';

interface StudentSelectProps {
  instituteId: string;
  classId: string;
  subjectId?: string;
  value: string;
  onChange: (studentId: string, studentName: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Dropdown that lists students for a given class (and optionally subject).
 * Calls GET /institute-users/institute/:id/users/STUDENT/class/:classId
 */
const StudentSelect: React.FC<StudentSelectProps> = ({
  instituteId,
  classId,
  subjectId,
  value,
  onChange,
  label = 'Student',
  placeholder = 'Select student…',
  required = false,
  disabled = false,
  className,
}) => {
  const [students, setStudents] = useState<StudentListRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!instituteId || !classId) { setStudents([]); return; }
    setLoading(true);
    const fetch = subjectId
      ? instituteStudentsApi.getStudentsBySubject(instituteId, classId, subjectId)
      : instituteStudentsApi.getStudentsByClass(instituteId, classId);
    fetch
      .then(res => setStudents(res?.data ?? []))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  }, [instituteId, classId, subjectId]);

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
          const stu = students.find(s => s.id === id);
          if (stu) onChange(stu.id, stu.name);
        }}
        disabled={disabled || !classId || students.length === 0}
      >
        <SelectTrigger>
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder={!classId ? 'Select class first' : students.length === 0 ? 'No students found' : placeholder} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {students.map(s => (
            <SelectItem key={s.id} value={s.id}>
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={s.imageUrl} />
                  <AvatarFallback className="text-[10px]">{s.name?.charAt(0) ?? '?'}</AvatarFallback>
                </Avatar>
                <span>{s.name}</span>
                {s.userIdByInstitute && <span className="text-xs text-muted-foreground">#{s.userIdByInstitute}</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default StudentSelect;
