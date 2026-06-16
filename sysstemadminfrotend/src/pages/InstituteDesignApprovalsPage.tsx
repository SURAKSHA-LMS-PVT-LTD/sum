import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import {
  Loader2, CheckCircle2, XCircle, PauseCircle, Clock, FileEdit,
  LayoutGrid, Activity, RefreshCw, Search, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type TemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

interface DesignTemplate {
  id: string;
  instituteId: string;
  name: string;
  definition: Record<string, any>;
  status: TemplateStatus;
  costPng: number;
  costPdf: number;
  costWhatsapp: number;
  costPrint: number;
  allowPng: boolean;
  allowPdf: boolean;
  allowWhatsapp: boolean;
  allowPrint: boolean;
  whatsappTtlDays?: number;
  rejectionReason?: string;
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface GenerationRecord {
  id: string;
  instituteId: string;
  templateId: string;
  outputType: string;
  requestedBy: string;
  userCount: number;
  unitCost: number;
  totalCost: number;
  refunded: number;
  status: string;
  successCount: number;
  failCount: number;
  createdAt: string;
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS: Record<TemplateStatus, { label: string; color: string; icon: React.ReactNode }> = {
  DRAFT:     { label: 'Draft',     color: 'bg-slate-50 text-slate-700 border-slate-200',   icon: <FileEdit className="h-3 w-3" /> },
  PENDING:   { label: 'Pending',   color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: <Clock className="h-3 w-3" /> },
  APPROVED:  { label: 'Approved',  color: 'bg-green-50 text-green-700 border-green-200',   icon: <CheckCircle2 className="h-3 w-3" /> },
  REJECTED:  { label: 'Rejected',  color: 'bg-red-50 text-red-700 border-red-200',         icon: <XCircle className="h-3 w-3" /> },
  SUSPENDED: { label: 'Suspended', color: 'bg-orange-50 text-orange-700 border-orange-200',icon: <PauseCircle className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: TemplateStatus }) {
  const cfg = STATUS[status] ?? STATUS.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ─── Mini card preview (canvas-free, CSS-only thumbnail) ─────────────────────

function TemplateMiniPreview({ definition }: { definition: Record<string, any> }) {
  const W = definition.cardWidth  || 340;
  const H = definition.cardHeight || 215;
  const elements: any[] = definition.elements || [];
  const bg: string = definition.backgroundImageUrl || '';
  const ov: string = definition.overlayImageUrl || '';

  return (
    <div className="relative overflow-hidden rounded border border-border/60 shrink-0"
      style={{ width: 80, height: Math.round(80 * H / W) }}>
      <div className="absolute inset-0" style={{
        background: bg ? `url(${bg}) center/cover no-repeat` : 'linear-gradient(135deg,#1a237e,#283593)',
      }} />
      {elements.filter(el => el.type === 'text').slice(0, 4).map((el: any) => (
        <div key={el.id} style={{
          position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`,
          fontSize: `${el.fontSize * 0.22}px`, color: el.color, fontWeight: el.bold ? 'bold' : 'normal',
          fontFamily: `'${el.fontFamily}',sans-serif`, whiteSpace: 'nowrap', overflow: 'hidden',
        }}>{el.content.replace(/\{[^}]+\}/g, '···')}</div>
      ))}
      {ov && <img src={ov} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />}
    </div>
  );
}

// ─── Approve dialog ────────────────────────────────────────────────────────────

interface ApproveDialogProps {
  template: DesignTemplate | null;
  onClose: () => void;
  onDone: () => void;
}

function ApproveDialog({ template, onClose, onDone }: ApproveDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    allowPng: true,  costPng: 1,
    allowPdf: false, costPdf: 1,
    allowWhatsapp: false, costWhatsapp: 1,
    allowPrint: false, costPrint: 1,
    whatsappTtlDays: 7,
    adminNotes: '',
  });

  useEffect(() => {
    if (!template) return;
    setForm({
      allowPng: template.allowPng,      costPng: template.costPng ?? 1,
      allowPdf: template.allowPdf,      costPdf: template.costPdf ?? 1,
      allowWhatsapp: template.allowWhatsapp, costWhatsapp: template.costWhatsapp ?? 1,
      allowPrint: template.allowPrint,  costPrint: template.costPrint ?? 1,
      whatsappTtlDays: template.whatsappTtlDays ?? 7,
      adminNotes: template.adminNotes ?? '',
    });
  }, [template]);

  const submit = async () => {
    if (!template) return;
    setSaving(true);
    try {
      await api.approveDesignTemplate(template.id, form);
      toast({ title: 'Template approved' });
      onDone();
    } catch (err: any) {
      toast({ title: 'Failed to approve', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const row = (
    allowed: boolean, setAllowed: (v: boolean) => void,
    cost: number, setCost: (v: number) => void,
    label: string,
  ) => (
    <div className="flex items-center gap-3">
      <Switch checked={allowed} onCheckedChange={setAllowed} id={label} />
      <label htmlFor={label} className="text-xs font-medium w-20">{label}</label>
      <Input type="number" min={0} step={0.01} value={cost}
        onChange={e => setCost(Number(e.target.value))}
        disabled={!allowed}
        className="h-7 text-xs w-24" />
      <span className="text-xs text-muted-foreground">credits / user</span>
    </div>
  );

  return (
    <Dialog open={!!template} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve Template</DialogTitle>
          <DialogDescription>{template?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Output types &amp; costs
          </p>
          {row(form.allowPng, v => setForm(f => ({ ...f, allowPng: v })),
            form.costPng, v => setForm(f => ({ ...f, costPng: v })), 'PNG')}
          {row(form.allowPdf, v => setForm(f => ({ ...f, allowPdf: v })),
            form.costPdf, v => setForm(f => ({ ...f, costPdf: v })), 'PDF')}
          {row(form.allowWhatsapp, v => setForm(f => ({ ...f, allowWhatsapp: v })),
            form.costWhatsapp, v => setForm(f => ({ ...f, costWhatsapp: v })), 'WhatsApp')}
          {row(form.allowPrint, v => setForm(f => ({ ...f, allowPrint: v })),
            form.costPrint, v => setForm(f => ({ ...f, costPrint: v })), 'Print')}

          {form.allowWhatsapp && (
            <div className="flex items-center gap-2">
              <Label className="text-xs w-32">WhatsApp TTL (days)</Label>
              <Input type="number" min={1} value={form.whatsappTtlDays}
                onChange={e => setForm(f => ({ ...f, whatsappTtlDays: Number(e.target.value) }))}
                className="h-7 text-xs w-20" />
            </div>
          )}

          <div>
            <Label className="text-xs">Admin notes (optional)</Label>
            <Textarea value={form.adminNotes} onChange={e => setForm(f => ({ ...f, adminNotes: e.target.value }))}
              rows={2} className="text-xs mt-1" placeholder="Internal notes…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}
            className="bg-green-600 hover:bg-green-700 text-white">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reject dialog ─────────────────────────────────────────────────────────────

interface RejectDialogProps {
  template: DesignTemplate | null;
  onClose: () => void;
  onDone: () => void;
}

function RejectDialog({ template, onClose, onDone }: RejectDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState('');
  const [notes,  setNotes]  = useState('');

  useEffect(() => {
    if (!template) return;
    setReason(template.rejectionReason ?? '');
    setNotes(template.adminNotes ?? '');
  }, [template]);

  const submit = async () => {
    if (!template || !reason.trim()) return;
    setSaving(true);
    try {
      await api.rejectDesignTemplate(template.id, { rejectionReason: reason, adminNotes: notes });
      toast({ title: 'Template rejected' });
      onDone();
    } catch (err: any) {
      toast({ title: 'Failed to reject', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!template} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reject Template</DialogTitle>
          <DialogDescription>{template?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Rejection reason <span className="text-red-500">*</span></Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)}
              rows={3} className="text-xs mt-1" placeholder="Explain why the template is rejected…" />
          </div>
          <div>
            <Label className="text-xs">Internal notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} className="text-xs mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving || !reason.trim()} variant="destructive">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Suspend/Unsuspend dialog ─────────────────────────────────────────────────

interface SuspendDialogProps {
  template: DesignTemplate | null;
  onClose: () => void;
  onDone: () => void;
}

function SuspendDialog({ template, onClose, onDone }: SuspendDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const isSuspended = template?.status === 'SUSPENDED';

  const submit = async () => {
    if (!template) return;
    setSaving(true);
    try {
      if (isSuspended) {
        await api.unsuspendDesignTemplate(template.id, { adminNotes: notes });
        toast({ title: 'Template unsuspended' });
      } else {
        await api.suspendDesignTemplate(template.id, { adminNotes: notes });
        toast({ title: 'Template suspended' });
      }
      onDone();
    } catch (err: any) {
      toast({ title: 'Action failed', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!template} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isSuspended ? 'Unsuspend' : 'Suspend'} Template</DialogTitle>
          <DialogDescription>{template?.name}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label className="text-xs">Notes (optional)</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs mt-1" />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}
            className={isSuspended ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />}
            {isSuspended ? 'Unsuspend' : 'Suspend'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Template row ──────────────────────────────────────────────────────────────

interface TemplateRowProps {
  tpl: DesignTemplate;
  onApprove: () => void;
  onReject: () => void;
  onSuspend: () => void;
}

function TemplateRow({ tpl, onApprove, onReject, onSuspend }: TemplateRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-3 bg-card">
        <TemplateMiniPreview definition={tpl.definition} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{tpl.name}</p>
            <StatusBadge status={tpl.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            Institute: {tpl.instituteId} · Submitted {new Date(tpl.createdAt).toLocaleDateString()}
          </p>
          {tpl.rejectionReason && (
            <p className="text-xs text-red-600 mt-0.5 truncate">Reason: {tpl.rejectionReason}</p>
          )}
          {tpl.status === 'APPROVED' && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tpl.allowPng  && <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-200 font-semibold">PNG {tpl.costPng}cr</span>}
              {tpl.allowPdf  && <span className="text-[9px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded border border-purple-200 font-semibold">PDF {tpl.costPdf}cr</span>}
              {tpl.allowWhatsapp && <span className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded border border-green-200 font-semibold">WA {tpl.costWhatsapp}cr</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {tpl.status === 'PENDING' && (
            <>
              <Button size="sm" onClick={onApprove}
                className="h-7 text-xs px-2 bg-green-600 hover:bg-green-700 text-white">
                Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={onReject} className="h-7 text-xs px-2">
                Reject
              </Button>
            </>
          )}
          {tpl.status === 'APPROVED' && (
            <>
              <Button size="sm" onClick={onApprove} variant="outline" className="h-7 text-xs px-2">
                Edit approval
              </Button>
              <Button size="sm" onClick={onSuspend}
                className="h-7 text-xs px-2 bg-orange-500 hover:bg-orange-600 text-white">
                Suspend
              </Button>
            </>
          )}
          {tpl.status === 'REJECTED' && (
            <Button size="sm" onClick={onApprove}
              className="h-7 text-xs px-2 bg-green-600 hover:bg-green-700 text-white">
              Approve anyway
            </Button>
          )}
          {tpl.status === 'SUSPENDED' && (
            <>
              <Button size="sm" onClick={onSuspend}
                className="h-7 text-xs px-2 bg-green-600 hover:bg-green-700 text-white">
                Unsuspend
              </Button>
              <Button size="sm" variant="destructive" onClick={onReject} className="h-7 text-xs px-2">
                Reject
              </Button>
            </>
          )}
          <button onClick={() => setExpanded(e => !e)}
            className="h-7 w-7 flex items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="bg-muted/30 border-t p-3 text-xs space-y-1">
          {tpl.adminNotes && <p><span className="font-semibold">Admin notes:</span> {tpl.adminNotes}</p>}
          {tpl.reviewedBy  && <p><span className="font-semibold">Reviewed by:</span> {tpl.reviewedBy} · {tpl.reviewedAt && new Date(tpl.reviewedAt).toLocaleString()}</p>}
          <p><span className="font-semibold">Updated:</span> {new Date(tpl.updatedAt).toLocaleString()}</p>
          <p><span className="font-semibold">Template ID:</span> {tpl.id}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function InstituteDesignApprovalsPage() {
  const { toast } = useToast();

  // Templates tab
  const [templates, setTemplates] = useState<DesignTemplate[]>([]);
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [searchFilter, setSearchFilter] = useState('');

  // Generations tab
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [loadingGen, setLoadingGen] = useState(false);
  const [genInstFilter, setGenInstFilter] = useState('');

  // Dialogs
  const [approveTarget, setApproveTarget]   = useState<DesignTemplate | null>(null);
  const [rejectTarget,  setRejectTarget]    = useState<DesignTemplate | null>(null);
  const [suspendTarget, setSuspendTarget]   = useState<DesignTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoadingTpl(true);
    try {
      const res = await api.getDesignTemplates({ status: statusFilter || undefined, page: 1, limit: 200 });
      const list: DesignTemplate[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setTemplates(list);
    } catch (err: any) {
      toast({ title: 'Failed to load templates', description: err?.message, variant: 'destructive' });
    } finally {
      setLoadingTpl(false);
    }
  }, [statusFilter, toast]);

  const loadGenerations = useCallback(async () => {
    setLoadingGen(true);
    try {
      const res = await api.getDesignGenerations({
        instituteId: genInstFilter || undefined,
        page: 1, limit: 200,
      });
      const list: GenerationRecord[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setGenerations(list);
    } catch (err: any) {
      toast({ title: 'Failed to load generations', description: err?.message, variant: 'destructive' });
    } finally {
      setLoadingGen(false);
    }
  }, [genInstFilter, toast]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const afterDialog = () => {
    setApproveTarget(null);
    setRejectTarget(null);
    setSuspendTarget(null);
    loadTemplates();
  };

  const visibleTemplates = templates.filter(t =>
    !searchFilter || t.name.toLowerCase().includes(searchFilter.toLowerCase()) || t.instituteId.includes(searchFilter),
  );

  const counts = {
    PENDING:   templates.filter(t => t.status === 'PENDING').length,
    APPROVED:  templates.filter(t => t.status === 'APPROVED').length,
    REJECTED:  templates.filter(t => t.status === 'REJECTED').length,
    SUSPENDED: templates.filter(t => t.status === 'SUSPENDED').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-12">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-100 border border-violet-200">
            <LayoutGrid className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Institute Design Approvals</h1>
            <p className="text-sm text-muted-foreground">Review, approve, and manage design templates from institutes</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as TemplateStatus[]).map(s => {
            const cfg = STATUS[s];
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`rounded-lg border p-3 text-left transition-all ${statusFilter === s ? 'ring-2 ring-primary' : 'hover:bg-muted/40'}`}>
                <div className="flex items-center gap-1.5 mb-1">{cfg.icon}<span className="text-xs font-semibold">{cfg.label}</span></div>
                <p className="text-2xl font-bold">{counts[s]}</p>
              </button>
            );
          })}
        </div>

        <Tabs defaultValue="templates">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="generations" onClick={() => { if (!generations.length) loadGenerations(); }}>
              Generation Records
            </TabsTrigger>
          </TabsList>

          {/* ── Templates tab ───────────────────────────────────────────── */}
          <TabsContent value="templates" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              {/* Status quick-filter */}
              <Select value={statusFilter || 'ALL'} onValueChange={v => setStatusFilter(v === 'ALL' ? '' : v)}>
                <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative flex-1 min-w-48 max-w-80">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
                  placeholder="Search name or institute ID…" className="pl-8 h-8 text-xs" />
              </div>

              <Button size="sm" variant="outline" onClick={loadTemplates}
                disabled={loadingTpl} className="h-8 gap-1.5 text-xs">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingTpl ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {loadingTpl ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />Loading templates…
              </div>
            ) : visibleTemplates.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                <LayoutGrid className="h-8 w-8 mx-auto mb-2 opacity-25" />
                No templates found.
              </div>
            ) : (
              <div className="space-y-2">
                {visibleTemplates.map(tpl => (
                  <TemplateRow key={tpl.id} tpl={tpl}
                    onApprove={() => setApproveTarget(tpl)}
                    onReject={()  => setRejectTarget(tpl)}
                    onSuspend={() => setSuspendTarget(tpl)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Generations tab ─────────────────────────────────────────── */}
          <TabsContent value="generations" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Input value={genInstFilter} onChange={e => setGenInstFilter(e.target.value)}
                placeholder="Filter by institute ID…" className="h-8 text-xs w-56" />
              <Button size="sm" variant="outline" onClick={loadGenerations}
                disabled={loadingGen} className="h-8 gap-1.5 text-xs">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingGen ? 'animate-spin' : ''}`} />
                Load
              </Button>
            </div>

            {loadingGen ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />Loading records…
              </div>
            ) : generations.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-25" />
                No generation records. Click Load to fetch.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      {['Institute', 'Template', 'Output', 'Users', 'Unit', 'Total', 'Refunded', 'OK/Fail', 'Status', 'Date'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {generations.map(rec => (
                      <tr key={rec.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono">{rec.instituteId.slice(0, 8)}…</td>
                        <td className="px-3 py-2 font-mono">{rec.templateId.slice(0, 8)}…</td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary" className="text-[10px]">{rec.outputType}</Badge>
                        </td>
                        <td className="px-3 py-2 text-center">{rec.userCount}</td>
                        <td className="px-3 py-2">{Number(rec.unitCost).toFixed(2)}</td>
                        <td className="px-3 py-2 font-semibold">{Number(rec.totalCost).toFixed(2)}</td>
                        <td className="px-3 py-2 text-orange-600">{Number(rec.refunded).toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <span className="text-green-600">{rec.successCount}</span>/
                          <span className="text-red-600">{rec.failCount}</span>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={rec.status === 'COMPLETED' ? 'secondary' : rec.status === 'PARTIAL' ? 'outline' : 'destructive'}
                            className="text-[10px]">{rec.status}</Badge>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(rec.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <ApproveDialog  template={approveTarget}  onClose={() => setApproveTarget(null)}  onDone={afterDialog} />
      <RejectDialog   template={rejectTarget}   onClose={() => setRejectTarget(null)}   onDone={afterDialog} />
      <SuspendDialog  template={suspendTarget}  onClose={() => setSuspendTarget(null)}  onDone={afterDialog} />
    </DashboardLayout>
  );
}
