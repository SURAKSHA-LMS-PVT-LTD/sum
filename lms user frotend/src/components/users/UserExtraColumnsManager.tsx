/**
 * UserExtraColumnsManager
 * Full management UI for the institute-level custom user column schema.
 * Renders as a self-contained card — drop it into any settings page.
 *
 * Supports field types: text, number, date, email, phone, boolean, select (enum).
 * For 'select' fields an inline option editor lets admins define the allowed values.
 */
import React, { useState } from 'react';
import { ExtraDataColumn } from '@/api/instituteSettings.api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Trash2, Loader2, Save, GripVertical, Columns3,
  AlertCircle, X, ListOrdered,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const COLUMN_TYPES: { value: ExtraDataColumn['type']; label: string; description?: string }[] = [
  { value: 'text',    label: 'Text',    description: 'Free-form text input' },
  { value: 'number',  label: 'Number',  description: 'Numeric input' },
  { value: 'date',    label: 'Date',    description: 'Date picker' },
  { value: 'email',   label: 'Email',   description: 'Email address' },
  { value: 'phone',   label: 'Phone',   description: 'Phone number' },
  { value: 'boolean', label: 'Yes / No', description: 'Checkbox (true/false)' },
  { value: 'select',  label: 'Select (Enum)', description: 'Dropdown with predefined options' },
];

const USER_TYPES = ['Student', 'Teacher', 'Parent', 'Staff'];

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ── Inline options editor for 'select' type ────────────────────────────────
interface OptionsEditorProps {
  options: string[];
  onChange: (opts: string[]) => void;
}

const OptionsEditor: React.FC<OptionsEditorProps> = ({ options, onChange }) => {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v || options.includes(v)) return;
    onChange([...options, v]);
    setDraft('');
  };

  const remove = (idx: number) => onChange(options.filter((_, i) => i !== idx));

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        <ListOrdered className="h-3 w-3" />
        Options <span className="text-destructive">*</span>
        <span className="text-[10px] opacity-60 ml-1">({options.length})</span>
      </Label>
      <div className="flex flex-wrap gap-1 min-h-[28px]">
        {options.map((opt, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
            {opt}
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        {options.length === 0 && (
          <span className="text-[11px] text-muted-foreground italic">No options yet</span>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Type option and press Enter"
          className="h-7 text-xs flex-1"
        />
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={add}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────

interface UserExtraColumnsManagerProps {
  columns: ExtraDataColumn[];
  saving?: boolean;
  onSave: (columns: ExtraDataColumn[]) => Promise<void>;
}

export const UserExtraColumnsManager: React.FC<UserExtraColumnsManagerProps> = ({
  columns: initialColumns,
  onSave,
}) => {
  const { toast } = useToast();
  const [cols, setCols] = useState<ExtraDataColumn[]>(initialColumns);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // New row state
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<ExtraDataColumn['type']>('text');
  const [newOptions, setNewOptions] = useState<string[]>([]);
  const [newAppliesTo, setNewAppliesTo] = useState<string[]>([]);
  const [addError, setAddError] = useState('');

  React.useEffect(() => {
    setCols(initialColumns);
    setDirty(false);
  }, [initialColumns]);

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) { setAddError('Label is required'); return; }
    const key = slugify(label);
    if (!key) { setAddError('Label must contain at least one letter or number'); return; }
    if (cols.some(c => c.key === key)) { setAddError(`Key "${key}" already exists`); return; }
    if (newType === 'select' && newOptions.length === 0) { setAddError('Add at least one option for a Select field'); return; }
    setAddError('');
    setCols(prev => [
      ...prev,
      {
        key,
        label,
        type: newType,
        options: newType === 'select' ? [...newOptions] : undefined,
        applicableTo: newAppliesTo.length ? [...newAppliesTo] : [],
      },
    ]);
    setNewLabel('');
    setNewType('text');
    setNewOptions([]);
    setNewAppliesTo([]);
    setDirty(true);
  };

  const handleDelete = (key: string) => {
    setCols(prev => prev.filter(c => c.key !== key));
    setDirty(true);
  };

  const handleUpdateField = <K extends keyof ExtraDataColumn>(
    key: string,
    field: K,
    value: ExtraDataColumn[K],
  ) => {
    setCols(prev => prev.map(c => {
      if (c.key !== key) return c;
      const updated = { ...c, [field]: value };
      // Clear options if type changed away from select
      if (field === 'type' && value !== 'select') updated.options = undefined;
      return updated;
    }));
    setDirty(true);
  };

  const handleUpdateOptions = (colKey: string, opts: string[]) => {
    setCols(prev => prev.map(c => c.key === colKey ? { ...c, options: opts } : c));
    setDirty(true);
  };

  const toggleNewAppliesTo = (ut: string) => {
    setNewAppliesTo(prev =>
      prev.includes(ut) ? prev.filter(t => t !== ut) : [...prev, ut],
    );
  };

  const toggleAppliesTo = (colKey: string, ut: string, current: string[] = []) => {
    const next = current.includes(ut)
      ? current.filter(t => t !== ut)
      : [...current, ut];
    handleUpdateField(colKey, 'applicableTo', next);
  };

  const handleSave = async () => {
    // Validate select fields have options
    const invalid = cols.find(c => c.type === 'select' && (!c.options || c.options.length === 0));
    if (invalid) {
      toast({ title: 'Validation error', description: `"${invalid.label}" is a Select field but has no options.`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await onSave(cols);
      setDirty(false);
      toast({ title: 'Saved', description: 'Custom columns updated' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save columns', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Columns3 className="h-4 w-4 text-primary" />
          Custom User Columns
        </CardTitle>
        <CardDescription>
          Define extra data fields that appear in user tables, create/edit forms, and detail views institute-wide.
          Use <strong>Select</strong> fields to present a fixed list of choices (enum).
          Each user's values are stored as JSON — no schema migrations needed.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* ── Existing columns ── */}
        {cols.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <Columns3 className="h-8 w-8 mb-2 opacity-25" />
            <p className="text-sm">No custom columns yet. Add one below.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cols.map(col => (
              <div
                key={col.key}
                className="flex items-start gap-2 p-3 border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <GripVertical className="h-4 w-4 mt-2 text-muted-foreground shrink-0 opacity-40" />

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Label */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Label</Label>
                    <Input
                      value={col.label}
                      onChange={e => handleUpdateField(col.key, 'label', e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Column label"
                    />
                    <p className="text-[10px] text-muted-foreground">key: <code>{col.key}</code></p>
                  </div>

                  {/* Type */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <Select
                      value={col.type}
                      onValueChange={v => handleUpdateField(col.key, 'type', v as ExtraDataColumn['type'])}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLUMN_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            <span>{t.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Applies To */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Applies To {(!col.applicableTo || col.applicableTo.length === 0) && (
                        <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">All</Badge>
                      )}
                    </Label>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {USER_TYPES.map(ut => (
                        <label key={ut} className="flex items-center gap-1 cursor-pointer text-xs">
                          <Checkbox
                            checked={(col.applicableTo ?? []).includes(ut)}
                            onCheckedChange={() => toggleAppliesTo(col.key, ut, col.applicableTo)}
                            className="h-3 w-3"
                          />
                          {ut}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Options editor — only for 'select' type, spans full width */}
                  {col.type === 'select' && (
                    <div className="sm:col-span-3">
                      <OptionsEditor
                        options={col.options ?? []}
                        onChange={opts => handleUpdateOptions(col.key, opts)}
                      />
                    </div>
                  )}
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 mt-0.5"
                  onClick={() => handleDelete(col.key)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* ── Add new column ── */}
        <div className="border rounded-lg p-3 space-y-3 bg-background">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add New Column</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Label */}
            <div className="space-y-1">
              <Label className="text-xs">Label *</Label>
              <Input
                value={newLabel}
                onChange={e => { setNewLabel(e.target.value); setAddError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="e.g. Guardian Phone"
                className="h-8 text-sm"
              />
              {newLabel && (
                <p className="text-[10px] text-muted-foreground">key: <code>{slugify(newLabel) || '—'}</code></p>
              )}
            </div>

            {/* Type */}
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={newType} onValueChange={v => { setNewType(v as ExtraDataColumn['type']); setNewOptions([]); }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLUMN_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div className="flex flex-col">
                        <span>{t.label}</span>
                        {t.description && <span className="text-[10px] text-muted-foreground">{t.description}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Applies To */}
            <div className="space-y-1">
              <Label className="text-xs">Applies To (leave empty = All)</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {USER_TYPES.map(ut => (
                  <label key={ut} className="flex items-center gap-1 cursor-pointer text-xs">
                    <Checkbox
                      checked={newAppliesTo.includes(ut)}
                      onCheckedChange={() => toggleNewAppliesTo(ut)}
                      className="h-3 w-3"
                    />
                    {ut}
                  </label>
                ))}
              </div>
            </div>

            {/* Options editor for new select field — spans full row */}
            {newType === 'select' && (
              <div className="sm:col-span-3">
                <OptionsEditor options={newOptions} onChange={setNewOptions} />
              </div>
            )}
          </div>

          {addError && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-3 w-3" />
              <AlertDescription className="text-xs">{addError}</AlertDescription>
            </Alert>
          )}

          <Button size="sm" onClick={handleAdd} variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Column
          </Button>
        </div>

        {/* ── Save ── */}
        {dirty && (
          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Custom Columns
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
