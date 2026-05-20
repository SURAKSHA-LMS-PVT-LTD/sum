/**
 * ExtraDataFields
 * Renders form inputs based on the institute's custom column schema.
 * Reads/writes to a plain Record<string, string> (extraData).
 *
 * Supported field types:
 *   text, number, date, email, phone — plain Input
 *   boolean — Checkbox (stored as "true" / "false" string)
 *   select  — Dropdown with the options defined in the column schema
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const visibleCols = columns.filter(col => {
    if (!userType) return true;
    if (!col.applicableTo || col.applicableTo.length === 0) return true;
    return col.applicableTo.some(t => t.toLowerCase() === userType.toLowerCase());
  });

  if (visibleCols.length === 0) return null;

  const set = (key: string, value: string) => onChange({ ...values, [key]: value });

  return (
    <div className={`space-y-3 ${className}`}>
      {visibleCols.map(col => {
        const value = values[col.key] ?? '';

        return (
          <div key={col.key} className="space-y-1">
            {col.type !== 'boolean' && (
              <Label htmlFor={`extra-${col.key}`} className="text-sm font-medium">
                {col.label}
              </Label>
            )}

            {readOnly ? (
              /* ── Read-only display ── */
              col.type === 'boolean' ? (
                <div className="flex items-center gap-2">
                  <Checkbox checked={value === 'true'} disabled className="h-4 w-4" />
                  <span className="text-sm">{col.label}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground min-h-[1.5rem]">
                  {value || <span className="italic opacity-50">—</span>}
                </p>
              )
            ) : col.type === 'boolean' ? (
              /* ── Boolean — checkbox ── */
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`extra-${col.key}`}
                  checked={value === 'true'}
                  onCheckedChange={checked => set(col.key, checked ? 'true' : 'false')}
                  className="h-4 w-4"
                />
                <Label htmlFor={`extra-${col.key}`} className="text-sm font-medium cursor-pointer">
                  {col.label}
                </Label>
              </div>
            ) : col.type === 'select' ? (
              /* ── Select — dropdown enum ── */
              <Select value={value || '__none__'} onValueChange={v => set(col.key, v === '__none__' ? '' : v)}>
                <SelectTrigger id={`extra-${col.key}`} className="h-9">
                  <SelectValue placeholder={`Select ${col.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground italic">— None —</span>
                  </SelectItem>
                  {(col.options ?? []).map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              /* ── Text / number / date / email / phone ── */
              <Input
                id={`extra-${col.key}`}
                type={
                  col.type === 'number' ? 'number'
                  : col.type === 'date'   ? 'date'
                  : col.type === 'email'  ? 'email'
                  : col.type === 'phone'  ? 'tel'
                  : 'text'
                }
                value={value}
                onChange={e => set(col.key, e.target.value)}
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
