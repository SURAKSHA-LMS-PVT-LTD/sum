import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFeatures } from '@/contexts/FeaturesContext';
import {
  registrationLinksApi, RegistrationLink, CardScope, CardEmptyPoolBehavior, CustomColumnMode,
} from '@/api/registrationLinks.api';
import { instituteSettingsApi, ExtraDataColumn } from '@/api/instituteSettings.api';
import {
  Link2, Copy, Plus, Trash2, Power, Loader2, CreditCard, GraduationCap, ShieldCheck, AlertCircle, Check,
} from 'lucide-react';

const USER_TYPES: { value: string; label: string }[] = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'TEACHER', label: 'Teacher' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'ATTENDANCE_MARKER', label: 'Attendance Marker' },
  { value: 'INSTITUTE_ADMIN', label: 'Institute Admin' },
];

interface Props {
  instituteId: string;
}

const RegistrationLinkManager: React.FC<Props> = ({ instituteId }) => {
  const { toast } = useToast();
  const { isFeatureEnabled } = useFeatures();
  const smartCardsEnabled = isFeatureEnabled('smart-cards');

  const [links, setLinks] = useState<RegistrationLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── New-link form state ──
  const [label, setLabel] = useState('');
  const [allowedTypes, setAllowedTypes] = useState<string[]>(['STUDENT']);
  const [autoAssignCard, setAutoAssignCard] = useState(false);
  const [cardScope, setCardScope] = useState<CardScope>('INSTITUTE');
  const [cardEmptyBehavior, setCardEmptyBehavior] = useState<CardEmptyPoolBehavior>('skip');
  const [allowClass, setAllowClass] = useState(false);
  const [allowSubject, setAllowSubject] = useState(false);
  const [requirePhone, setRequirePhone] = useState(true);
  const [requireEmail, setRequireEmail] = useState(true);
  // Institute custom columns + the per-column mode (off/optional/required) for this link.
  const [customColumns, setCustomColumns] = useState<ExtraDataColumn[]>([]);
  const [extra, setExtra] = useState<Record<string, CustomColumnMode>>({});

  const load = useCallback(async () => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const [linksRes, cols] = await Promise.all([
        registrationLinksApi.listLinks(instituteId),
        instituteSettingsApi.getUserExtraDataSchema(instituteId).catch(() => [] as ExtraDataColumn[]),
      ]);
      setLinks(linksRes);
      setCustomColumns(cols);
    } catch (e: any) {
      toast({ title: 'Failed to load links', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [instituteId, toast]);

  useEffect(() => { load(); }, [load]);

  const setColMode = (key: string, mode: CustomColumnMode) =>
    setExtra(prev => ({ ...prev, [key]: mode }));

  const toggleType = (t: string) =>
    setAllowedTypes(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]));

  const publicUrl = (token: string) => `${window.location.origin}/forms/${token}`;

  const copyLink = async (link: RegistrationLink) => {
    try {
      await navigator.clipboard.writeText(publicUrl(link.token));
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast({ title: 'Copy failed', description: publicUrl(link.token), variant: 'destructive' });
    }
  };

  const handleCreate = async () => {
    if (!allowedTypes.length) {
      toast({ title: 'Select at least one user type', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      await registrationLinksApi.createLink(instituteId, {
        label: label.trim() || undefined,
        allowedUserTypes: allowedTypes,
        autoAssignCard: smartCardsEnabled ? autoAssignCard : false,
        cardScope,
        cardEmptyPoolBehavior: cardEmptyBehavior,
        allowClassEnrollment: allowClass,
        allowSubjectEnrollment: allowClass && allowSubject,
        requirePhoneVerification: requirePhone,
        requireEmailVerification: requireEmail,
        extraDataFields: extra,
      });
      toast({ title: 'Link created', description: 'Your public registration link is ready to share.' });
      // Reset form to defaults
      setLabel(''); setAllowedTypes(['STUDENT']); setAutoAssignCard(false); setCardScope('INSTITUTE');
      setCardEmptyBehavior('skip'); setAllowClass(false); setAllowSubject(false);
      setRequirePhone(true); setRequireEmail(true); setExtra({});
      load();
    } catch (e: any) {
      toast({ title: 'Create failed', description: e?.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (link: RegistrationLink) => {
    try {
      await registrationLinksApi.updateLink(instituteId, link.id, { isActive: !link.isActive });
      setLinks(prev => prev.map(l => (l.id === link.id ? { ...l, isActive: !l.isActive } : l)));
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.message, variant: 'destructive' });
    }
  };

  const remove = async (link: RegistrationLink) => {
    try {
      await registrationLinksApi.deleteLink(instituteId, link.id);
      setLinks(prev => prev.filter(l => l.id !== link.id));
      toast({ title: 'Link deleted' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Builder ─────────────────────────────────────────────── */}
      <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Create a public registration link</h3>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Label (internal only)</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. 2026 Grade-6 intake" maxLength={120} />
        </div>

        {/* User types */}
        <div className="space-y-1.5">
          <Label className="text-xs">Allowed user types</Label>
          <div className="flex flex-wrap gap-2">
            {USER_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => toggleType(t.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  allowedTypes.includes(t.value)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground hover:bg-muted border-border'
                }`}
              >
                {allowedTypes.includes(t.value) && <Check className="h-3 w-3 inline mr-1" />}
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            If you pick more than one, the form shows a type selector limited to your choices.
          </p>
        </div>

        {/* Card auto-assign */}
        <div className="space-y-2 rounded-md border p-3 bg-background">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={autoAssignCard}
              disabled={!smartCardsEnabled}
              onCheckedChange={v => setAutoAssignCard(!!v)}
            />
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Auto-assign a smart card on registration</span>
          </label>
          {!smartCardsEnabled && (
            <p className="text-[11px] text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Enable the <strong>Smart Cards</strong> feature to use card auto-assignment.
            </p>
          )}
          {smartCardsEnabled && autoAssignCard && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
              <div className="space-y-1">
                <Label className="text-[11px]">Card type</Label>
                <Select value={cardScope} onValueChange={v => setCardScope(v as CardScope)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INSTITUTE" className="text-xs">Institute card</SelectItem>
                    <SelectItem value="GLOBAL" className="text-xs">Suraksha card</SelectItem>
                    <SelectItem value="BOTH" className="text-xs">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">If card pool is empty</Label>
                <Select value={cardEmptyBehavior} onValueChange={v => setCardEmptyBehavior(v as CardEmptyPoolBehavior)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip" className="text-xs">Register anyway, flag card pending</SelectItem>
                    <SelectItem value="error" className="text-xs">Block registration with error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Enrollment */}
        <div className="space-y-2 rounded-md border p-3 bg-background">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={allowClass} onCheckedChange={v => { setAllowClass(!!v); if (!v) setAllowSubject(false); }} />
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Allow class enrollment</span>
          </label>
          {allowClass && (
            <label className="flex items-center gap-2 cursor-pointer pl-6">
              <Checkbox checked={allowSubject} onCheckedChange={v => setAllowSubject(!!v)} />
              <span className="text-sm">Allow subject enrollment within each class</span>
            </label>
          )}
          <p className="text-[11px] text-muted-foreground pl-6">
            Self-enrollments are submitted as <strong>pending</strong> — no enrollment key needed; you approve them later.
          </p>
        </div>

        {/* Verification */}
        <div className="space-y-2 rounded-md border p-3 bg-background">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Verification required
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={requirePhone} onCheckedChange={v => setRequirePhone(!!v)} />
            <span className="text-sm">Phone (WhatsApp) verification</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={requireEmail} onCheckedChange={v => setRequireEmail(!!v)} />
            <span className="text-sm">Email verification</span>
          </label>
        </div>

        {/* Institute custom columns — each Off / Optional / Required */}
        <div className="space-y-2 rounded-md border p-3 bg-background">
          <Label className="text-xs">Your institute's custom columns</Label>
          {customColumns.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No custom columns defined. Add them in Institute Settings → Custom Columns to collect extra data on this form.
            </p>
          ) : (
            <div className="space-y-1.5">
              {customColumns.map(col => {
                const mode = extra[col.key] ?? 'off';
                return (
                  <div key={col.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{col.label}</span>
                    <div className="flex rounded-md border overflow-hidden shrink-0">
                      {(['off', 'optional', 'required'] as CustomColumnMode[]).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setColMode(col.key, m)}
                          className={`px-2.5 py-1 text-[11px] capitalize transition-colors ${
                            mode === m
                              ? (m === 'required' ? 'bg-primary text-primary-foreground' : m === 'optional' ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground')
                              : 'bg-background text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Button onClick={handleCreate} disabled={creating} className="gap-1.5">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create link
        </Button>
      </div>

      {/* ── Existing links ─────────────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Your registration links</h3>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : links.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No links yet. Create one above to share.</p>
        ) : (
          links.map(link => (
            <div key={link.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{link.label || 'Untitled link'}</span>
                    <Badge variant={link.isActive ? 'default' : 'secondary'} className="text-[10px]">
                      {link.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                    {link.allowedUserTypes.map(t => (
                      <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">{publicUrl(link.token)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{link.registrationCount} registration(s)</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copyLink(link)}>
                  {copiedId === link.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedId === link.id ? 'Copied' : 'Copy link'}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => toggleActive(link)}>
                  <Power className="h-3 w-3" />
                  {link.isActive ? 'Disable' : 'Enable'}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => remove(link)}>
                  <Trash2 className="h-3 w-3" /> Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RegistrationLinkManager;
