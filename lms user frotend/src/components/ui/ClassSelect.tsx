import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen } from 'lucide-react';
import { instituteClassesApi, type InstituteClass } from '@/api/instituteClasses.api';

interface ClassSelectProps {
  instituteId: string;
  value: string;
  onChange: (classId: string, className: string, classObj: InstituteClass) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Dropdown that lists all classes for a given institute.
 * Calls GET /institute-classes/institute/:instituteId
 */
const ClassSelect: React.FC<ClassSelectProps> = ({
  instituteId,
  value,
  onChange,
  label = 'Class',
  placeholder = 'Select class…',
  required = false,
  disabled = false,
  className,
}) => {
  const [classes, setClasses] = useState<InstituteClass[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!instituteId) { setClasses([]); return; }
    setLoading(true);
    instituteClassesApi.getByInstitute(instituteId)
      .then(data => setClasses(Array.isArray(data) ? data : []))
      .catch(() => setClasses([]))
      .finally(() => setLoading(false));
  }, [instituteId]);

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
          const cls = classes.find(c => c.id === id);
          if (cls) onChange(cls.id, cls.name, cls);
        }}
        disabled={disabled || !instituteId || classes.length === 0}
      >
        <SelectTrigger>
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder={!instituteId ? 'Select institute first' : classes.length === 0 ? 'No classes found' : placeholder} />
          </div>
        </SelectTrigger>
        <SelectContent>
          {classes.map(c => (
            <SelectItem key={c.id} value={c.id}>
              <span>{c.name}</span>
              {c.grade ? <span className="text-xs text-muted-foreground ml-1">(Grade {c.grade})</span> : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ClassSelect;
