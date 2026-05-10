import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { BookMarked } from 'lucide-react';
import { instituteApi } from '@/api/institute.api';

export interface SubjectOption {
  id: string;
  name: string;
  code?: string;
  subjectType?: string;
}

interface SubjectSelectProps {
  instituteId: string;
  classId: string;
  value: string;
  onChange: (subjectId: string, subjectName: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Dropdown that lists subjects for a given class.
 * Calls GET /institutes/:instituteId/classes/:classId/subjects
 * Resets when classId changes.
 */
const SubjectSelect: React.FC<SubjectSelectProps> = ({
  instituteId,
  classId,
  value,
  onChange,
  label = 'Subject',
  placeholder = 'Select subject…',
  required = false,
  disabled = false,
  className,
}) => {
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!instituteId || !classId) { setSubjects([]); return; }
    setLoading(true);
    instituteApi.getClassSubjects(instituteId, classId)
      .then(res => {
        const raw = Array.isArray(res) ? res : (res?.data ?? []);
        setSubjects(raw.map((s: any) => ({
          id: s.id ?? s.subjectId,
          name: s.subjectName ?? s.name,
          code: s.subjectCode ?? s.code,
          subjectType: s.subjectType,
        })));
      })
      .catch(() => setSubjects([]))
      .finally(() => setLoading(false));
  }, [instituteId, classId]);

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
          const sub = subjects.find(s => s.id === id);
          if (sub) onChange(sub.id, sub.name);
        }}
        disabled={disabled || !classId || subjects.length === 0}
      >
        <SelectTrigger>
          <div className="flex items-center gap-2">
            <BookMarked className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder={!classId ? 'Select class first' : subjects.length === 0 ? 'No subjects found' : placeholder} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {subjects.map(s => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}{s.code ? ` (${s.code})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default SubjectSelect;
