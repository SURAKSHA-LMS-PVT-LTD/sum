/**
 * ExtraDataFields
 * Renders a set of form inputs based on the institute's custom column schema.
 * Reads/writes to a plain Record<string, string> (extraData).
 *
 * Usage:
 *   <ExtraDataFields
 *     columns={columns}
 *     values={extraData ?? {}}
 *     onChange={setExtraData}
 *     userType="Student"   // optional — filters columns by applicableTo
 *   />
 */
import React from 'react';
import { ExtraDataColumn } from '@/api/instituteSettings.api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ExtraDataFieldsProps {
  columns: ExtraDataColumn[];
  values: Record<string, string>;
  onChange: (updated: Record<string, string>) => void;
  /** Optional user type to filter which columns are shown */
  userType?: string;
  /** Set to true for a read-only view (e.g. table cell expansion) */
  readOnly?: boolean;
  className?: string;
}

export const ExtraDataFields: React.FC<ExtraDataFieldsProps> = ({
  columns,
  values,
  onChange,
  userType,
  readOnly = false,
  className = '',
}) => {
  // Filter columns by userType when provided
  const visibleCols = columns.filter(col => {
    if (!userType) return true;
    if (!col.applicableTo || col.applicableTo.length === 0) return true;
    return col.applicableTo.some(t => t.toLowerCase() === userType.toLowerCase());
  });

  if (visibleCols.length === 0) return null;

  const handleChange = (key: string, value: string) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {visibleCols.map(col => {
        const value = values[col.key] ?? '';
        return (
          <div key={col.key} className="space-y-1">
            <Label htmlFor={`extra-${col.key}`} className="text-sm font-medium">
              {col.label}
            </Label>
            {readOnly ? (
              <p className="text-sm text-muted-foreground min-h-[1.5rem]">
                {value || <span className="italic opacity-50">—</span>}
              </p>
            ) : (
              <Input
                id={`extra-${col.key}`}
                type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : col.type === 'email' ? 'email' : col.type === 'phone' ? 'tel' : 'text'}
                value={value}
                onChange={e => handleChange(col.key, e.target.value)}
                placeholder={`Enter ${col.label.toLowerCase()}`}
                className="h-9"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
