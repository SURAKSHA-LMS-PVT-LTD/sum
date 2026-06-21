import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { subjectRecordingsApi, SubjectRecording, SubjectRecordingCreateData, RecordingPlatform, RecordingStatus } from '@/api/subjectRecordings.api';
import { useToast } from '@/hooks/use-toast';
import PageContainer from '@/components/layout/PageContainer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import MUITable from '@/components/ui/mui-table';
import {
  Plus, Video, Search, RefreshCw, Loader2, AlertCircle,
  ExternalLink, Pencil, Trash2, Eye, EyeOff, PlayCircle,
  ChevronDown, X, Check, Globe, Lock, Users, CreditCard,
  Clock, ImageIcon, LayoutGrid, Table2, FileText, Download,
  Cloud, HardDrive, Link2,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import LectureTrackingSettings, { TrackingSettingsData } from '@/components/common/LectureTrackingSettings';
import LectureWelcomeMessageSettings, { WelcomeMessageSettingsData } from '@/components/common/LectureWelcomeMessageSettings';
import LectureMaterialsSection, { LectureMaterial } from '@/components/common/LectureMaterialsSection';
import LectureThumbnailUpload from '@/components/common/LectureThumbnailUpload';
import LectureUrlPanel from '@/components/common/LectureUrlPanel';
import { getImageUrl } from '@/utils/imageUrlHelper';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';

// ─── Helpers ────────────────────────────────────────────────────────────────

const platformLabel: Record<RecordingPlatform, string> = {
  SYSTEM: 'System Upload',
  YOUTUBE: 'YouTube',
  GOOGLE_DRIVE: 'Google Drive',
  EXTERNAL: 'External Link',
};

const accessLevelIcon: Record<string, React.ElementType> = {
  ANYONE: Globe,
  SURAKSHA_USERS: Users,
  ENROLLED_ONLY: Lock,
  PAID_ONLY: CreditCard,
};

const accessLevelLabel: Record<string, string> = {
  ANYONE: 'Anyone',
  SURAKSHA_USERS: 'Suraksha Users',
  ENROLLED_ONLY: 'Enrolled Only',
  PAID_ONLY: 'Paid Only',
};

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  published: { label: 'Published', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  draft:     { label: 'Draft',     className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  archived:  { label: 'Archived',  className: 'bg-muted text-muted-foreground border-border' },
};

// ─── Recording Card (lecture-style) ─────────────────────────────────────────

const RecordingCard: React.FC<{
  recording: SubjectRecording;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (r: SubjectRecording) => void;
  onDelete: (r: SubjectRecording) => void;
  onToggleActive: (r: SubjectRecording) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}> = ({ recording: r, canEdit, canDelete, onEdit, onDelete, onToggleActive, expanded, onToggleExpand }) => {
  const navigate = useNavigate();
  const AccessIcon = accessLevelIcon[r.recAccessLevel] ?? Lock;
  const sc = statusConfig[r.status] ?? { label: r.status, className: 'bg-muted text-muted-foreground border-border' };
  const thumbSrc = r.thumbnailUrl ? getImageUrl(r.thumbnailUrl) : '';

  const handleWatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (r.recAttendanceEnabled && r.recUrlId) {
      navigate(`/view-recording/${r.recUrlId}?src=subject`);
    } else if (r.recordingUrl) {
      window.open(r.recordingUrl, '_blank');
    }
  };

  return (
    <div className={`relative ${expanded ? 'z-40' : 'z-0'}`}>
      <Card
        className={`overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col cursor-pointer ${!r.isActive ? 'opacity-60' : ''}`}
        onClick={onToggleExpand}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video bg-muted group">
          {thumbSrc ? (
            <img
              src={thumbSrc}
              alt={r.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50 gap-2">
              <ImageIcon className="h-10 w-10" />
              <span className="text-xs font-medium">No Thumbnail</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <Badge variant="outline" className={`absolute top-2 left-2 ${sc.className} text-[10px] font-semibold px-2 py-0.5 backdrop-blur-sm bg-background/80`}>
            {sc.label}
          </Badge>
          <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] backdrop-blur-sm bg-background/80">
            {platformLabel[r.platform] ?? r.platform}
          </Badge>
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="font-semibold text-sm text-white line-clamp-2 drop-shadow-md">{r.title}</h3>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 flex-1 flex flex-col gap-2">
          {r.durationSeconds && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{formatDuration(r.durationSeconds)}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {r.recAttendanceEnabled && (
              <Badge className="text-[10px] h-4 px-1.5 bg-blue-100 text-blue-700 flex items-center gap-0.5">
                <AccessIcon className="h-2.5 w-2.5" />{accessLevelLabel[r.recAccessLevel]}
              </Badge>
            )}
            {Array.isArray(r.materials) && r.materials.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">
                <FileText className="h-3 w-3" />{r.materials.length} file{r.materials.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {r.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{r.description}</p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-2 border-t border-border/50">
            {(r.recUrlId || r.recordingUrl) && (
              <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 rounded-lg gap-1" onClick={handleWatch}>
                <PlayCircle className="h-3 w-3" />Watch
              </Button>
            )}
            <div className="ml-auto flex items-center gap-0.5">
              {canEdit && (
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2 rounded-lg gap-1" onClick={(e) => { e.stopPropagation(); onEdit(r); }}>
                  <Pencil className="h-3 w-3" />Edit
                </Button>
              )}
              {canEdit && (
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2 rounded-lg gap-1" onClick={(e) => { e.stopPropagation(); onToggleActive(r); }}>
                  {r.isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {r.isActive ? 'Hide' : 'Show'}
                </Button>
              )}
              {canDelete && (
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2 rounded-lg gap-1 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(r); }}>
                  <Trash2 className="h-3 w-3" />Delete
                </Button>
              )}
              <span className="flex items-center text-muted-foreground/60 px-1">
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180 text-primary' : ''}`} />
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-background border rounded-xl shadow-2xl p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
          <div className="absolute -top-1.5 left-6 w-3 h-3 bg-background border-l border-t rotate-45 rounded-tl-sm" />

          <LectureUrlPanel
            recAttendanceEnabled={r.recAttendanceEnabled}
            recUrlId={r.recUrlId}
          />

          {Array.isArray(r.materials) && r.materials.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Materials ({r.materials.length})</p>
              <div className="space-y-1">
                {r.materials.map((m, i) => {
                  const icon = (m as any).source === 'S3'
                    ? <Cloud className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    : ((m as any).source === 'GOOGLE_DRIVE' || (m as any).source === 'GOOGLE_DRIVE_INSTITUTE')
                      ? <HardDrive className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      : <Link2 className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
                  const viewUrl = m.driveWebViewLink || m.documentUrl;
                  return (
                    <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/60 border border-border/50">
                      {icon}
                      <span className="text-xs font-medium truncate flex-1">{m.documentName}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {viewUrl && (
                          <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" /> View
                          </a>
                        )}
                        {m.documentUrl && (m as any).source === 'S3' && (
                          <a href={m.documentUrl} download className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary ml-1">
                            <Download className="h-3 w-3" /> DL
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(canEdit || canDelete) && (
            <div className="flex gap-2 pt-1 border-t">
              {canEdit && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => onEdit(r)}>Edit</Button>
              )}
              {canEdit && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => onToggleActive(r)}>
                  {r.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              )}
              {canDelete && (
                <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => onDelete(r)}>Delete</Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Recording Form Dialog ───────────────────────────────────────────────────

const EMPTY_TRACKING: TrackingSettingsData = {
  liveAttendanceEnabled: false,
  liveAccessLevel: 'ENROLLED_ONLY',
  recAttendanceEnabled: false,
  recPlatform: 'SYSTEM',
  recAccessLevel: 'ENROLLED_ONLY',
};

const EMPTY_WELCOME: WelcomeMessageSettingsData = {
  welcomeMessageEnabled: false,
  welcomeMessageText: '',
  welcomeMessageVoiceEnabled: false,
};

const RecordingFormDialog: React.FC<{
  open: boolean;
  editing: SubjectRecording | null;
  instituteId: string;
  classId?: string;
  subjectId?: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ open, editing, instituteId, classId, subjectId, onClose, onSaved }) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform] = useState<RecordingPlatform>('YOUTUBE');
  const [recordingUrl, setRecordingUrl] = useState('');
  const [durationSeconds, setDurationSeconds] = useState<number | undefined>();
  const [status, setStatus] = useState<RecordingStatus>('draft');
  const [isActive, setIsActive] = useState(true);
  const [tracking, setTracking] = useState<TrackingSettingsData>(EMPTY_TRACKING);
  const [welcome, setWelcome] = useState<WelcomeMessageSettingsData>(EMPTY_WELCOME);
  const [materials, setMaterials] = useState<LectureMaterial[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? '');
      setPlatform(editing.platform);
      setRecordingUrl(editing.recordingUrl ?? '');
      setDurationSeconds(editing.durationSeconds);
      setStatus(editing.status);
      setIsActive(editing.isActive);
      setThumbnailUrl(editing.thumbnailUrl ?? '');
      setMaterials(Array.isArray(editing.materials) ? (editing.materials as LectureMaterial[]) : []);
      setTracking({
        liveAttendanceEnabled: false,
        liveAccessLevel: 'ENROLLED_ONLY',
        recAttendanceEnabled: editing.recAttendanceEnabled,
        recPlatform: 'SYSTEM',
        recAccessLevel: editing.recAccessLevel,
        recPaymentId: editing.recPaymentId,
      });
      setWelcome({
        welcomeMessageEnabled: editing.welcomeMessageEnabled,
        welcomeMessageText: editing.welcomeMessageText ?? '',
        welcomeMessageVoiceEnabled: editing.welcomeMessageVoiceEnabled,
      });
    } else {
      setTitle('');
      setDescription('');
      setPlatform('YOUTUBE');
      setRecordingUrl('');
      setDurationSeconds(undefined);
      setStatus('draft');
      setIsActive(true);
      setThumbnailUrl('');
      setMaterials([]);
      setTracking(EMPTY_TRACKING);
      setWelcome(EMPTY_WELCOME);
    }
  }, [open, editing]);

  const handleSave = async () => {
    if (!title.trim()) { toast({ title: 'Title is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload: Partial<SubjectRecordingCreateData> = {
        title: title.trim(),
        description: description || undefined,
        platform,
        recordingUrl: recordingUrl || undefined,
        durationSeconds,
        status,
        isActive,
        thumbnailUrl: thumbnailUrl || undefined,
        materials: materials.length > 0 ? materials : undefined,
        recAttendanceEnabled: tracking.recAttendanceEnabled,
        recAccessLevel: tracking.recAccessLevel,
        recPaymentId: tracking.recPaymentId,
        welcomeMessageEnabled: welcome.welcomeMessageEnabled,
        welcomeMessageText: welcome.welcomeMessageText || undefined,
        welcomeMessageVoiceEnabled: welcome.welcomeMessageVoiceEnabled,
      };

      if (editing) {
        await subjectRecordingsApi.update(editing.id, payload);
      } else {
        await subjectRecordingsApi.create({ ...payload, instituteId, classId, subjectId } as SubjectRecordingCreateData);
      }
      toast({ title: editing ? 'Recording updated' : 'Recording created' });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.response?.data?.message ?? String(e), variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()} routeName="view-recording-popup">
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Recording' : 'Add Recording'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {editing && (
            <LectureUrlPanel
              recAttendanceEnabled={editing.recAttendanceEnabled}
              recUrlId={editing.recUrlId}
            />
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input placeholder="Recording title" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea placeholder="Optional description" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Platform</Label>
              <Select value={platform} onValueChange={v => setPlatform(v as RecordingPlatform)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(platformLabel) as RecordingPlatform[]).map(p => (
                    <SelectItem key={p} value={p} className="text-xs">{platformLabel[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as RecordingStatus)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft" className="text-xs">Draft</SelectItem>
                  <SelectItem value="published" className="text-xs">Published</SelectItem>
                  <SelectItem value="archived" className="text-xs">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Recording URL</Label>
            <Input placeholder="https://..." value={recordingUrl} onChange={e => setRecordingUrl(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Duration (seconds)</Label>
            <Input
              type="number" min={1} placeholder="e.g. 3600"
              value={durationSeconds ?? ''}
              onChange={e => setDurationSeconds(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <LectureThumbnailUpload thumbnailUrl={thumbnailUrl} onChange={setThumbnailUrl} disabled={saving} />

          <LectureTrackingSettings
            data={tracking}
            onChange={setTracking}
            showPayments={true}
            instituteId={instituteId}
            classId={classId}
            scope="subject"
            hideLive={true}
          />

          <LectureWelcomeMessageSettings data={welcome} onChange={setWelcome} />

          <LectureMaterialsSection
            materials={materials}
            onChange={setMaterials}
            instituteId={instituteId}
            disabled={saving}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}><X className="h-3.5 w-3.5 mr-1" />Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
            {editing ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const SubjectRecordingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const userRole = useInstituteRole();
  const { subjectLabel } = useInstituteLabels();
  const { toast } = useToast();

  const isInstituteAdmin = userRole === 'InstituteAdmin';
  const isTeacher = userRole === 'Teacher';
  const canCreate = isInstituteAdmin || isTeacher;
  const canEdit = isInstituteAdmin || isTeacher;
  const canDelete = isInstituteAdmin;

  const [recordings, setRecordings] = useState<SubjectRecording[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecording, setEditingRecording] = useState<SubjectRecording | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: SubjectRecording | null }>({ open: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async (forceRefresh = false) => {
    if (!selectedInstitute?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = { instituteId: selectedInstitute.id, page, limit };
      if (selectedClass?.id) params.classId = selectedClass.id;
      if (selectedSubject?.id) params.subjectId = selectedSubject.id;
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await subjectRecordingsApi.list(params, forceRefresh);
      setRecordings(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load recordings');
    } finally { setLoading(false); }
  }, [selectedInstitute?.id, selectedClass?.id, selectedSubject?.id, search, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const handleToggleActive = async (r: SubjectRecording) => {
    try {
      await subjectRecordingsApi.update(r.id, { isActive: !r.isActive });
      toast({ title: r.isActive ? 'Recording deactivated' : 'Recording activated' });
      load(true);
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.response?.data?.message ?? String(e), variant: 'destructive' });
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialog.item) return;
    setIsDeleting(true);
    try {
      await subjectRecordingsApi.remove(deleteDialog.item.id);
      toast({ title: 'Recording deleted' }); // BUG-21: was "Recording deactivated" — misleading
      setDeleteDialog({ open: false, item: null });
      load(true);
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message ?? String(e), variant: 'destructive' });
    } finally { setIsDeleting(false); }
  };

  const tableColumns = [
    { key: 'title', header: 'Title' },
    { key: 'platform', header: 'Platform', render: (v: string) => <Badge variant="outline" className="text-xs">{platformLabel[v as RecordingPlatform] ?? v}</Badge> },
    { key: 'durationSeconds', header: 'Duration', render: (v: number) => formatDuration(v) || '—' },
    {
      key: 'status', header: 'Status',
      render: (v: string) => {
        const sc = statusConfig[v] ?? { label: v, className: 'bg-muted text-muted-foreground border-border' };
        return <Badge variant="outline" className={`text-xs ${sc.className}`}>{sc.label}</Badge>;
      },
    },
    {
      key: 'recAttendanceEnabled', header: 'Tracking',
      render: (v: boolean, row: any) => v
        ? <Badge className="text-xs bg-blue-100 text-blue-700">{accessLevelLabel[row.recAccessLevel]}</Badge>
        : <span className="text-xs text-muted-foreground">Off</span>,
    },
    {
      key: 'actions', header: 'Actions',
      render: (_: unknown, row: SubjectRecording) => (
        <div className="flex flex-wrap gap-1.5 min-w-[200px]">
          {(row.recUrlId || row.recordingUrl) && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={() => row.recAttendanceEnabled && row.recUrlId
                ? navigate(`/view-recording/${row.recUrlId}?src=subject`)
                : window.open(row.recordingUrl, '_blank')
              }>
              <PlayCircle className="h-3 w-3" />Watch
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={() => { setEditingRecording(row); setFormOpen(true); }}>
              <Pencil className="h-3 w-3" />Edit
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={() => handleToggleActive(row)}>
              {row.isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {row.isActive ? 'Hide' : 'Show'}
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setDeleteDialog({ open: true, item: row })}>
              <Trash2 className="h-3 w-3" />Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <div className="space-y-4">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-foreground">Recordings</h1>
              {selectedSubject && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {subjectLabel}: {selectedSubject.name}
                </p>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Search recordings..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Status</SelectItem>
                <SelectItem value="draft" className="text-xs">Draft</SelectItem>
                <SelectItem value="published" className="text-xs">Published</SelectItem>
                <SelectItem value="archived" className="text-xs">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading} className="h-8 px-2.5">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {/* View toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('card')} className={`p-1.5 transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Card view">
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode('table')} className={`p-1.5 transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Table view">
                <Table2 className="h-4 w-4" />
              </button>
            </div>
            {canCreate && (
              <Button size="sm" className="h-8 gap-1.5 ml-auto" onClick={() => { setEditingRecording(null); setFormOpen(true); }}>
                <Plus className="h-3.5 w-3.5" />Add Recording
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading && recordings.length === 0 ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="h-8 w-8 text-destructive/50" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => load(true)}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry</Button>
          </div>
        ) : recordings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Video className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No recordings found</p>
            {canCreate && (
              <Button size="sm" onClick={() => { setEditingRecording(null); setFormOpen(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Add First Recording
              </Button>
            )}
          </div>
        ) : viewMode === 'card' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-visible">
              {recordings.map(r => (
                <RecordingCard
                  key={r.id}
                  recording={r}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  expanded={expandedId === r.id}
                  onToggleExpand={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  onEdit={rec => { setEditingRecording(rec); setFormOpen(true); }}
                  onDelete={rec => setDeleteDialog({ open: true, item: rec })}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
            {total > limit && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">Showing {recordings.length} of {total}</p>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <MUITable
            title=""
            data={recordings}
            columns={tableColumns.map(col => ({
              id: col.key,
              label: col.header,
              minWidth: col.key === 'actions' ? 260 : 140,
              format: col.render,
            }))}
            onAdd={canCreate ? () => { setEditingRecording(null); setFormOpen(true); } : undefined}
            page={page}
            rowsPerPage={limit}
            totalCount={total}
            onPageChange={(newPage: number) => setPage(newPage)}
            onRowsPerPageChange={() => {}}
            sectionType="recordings"
            allowEdit={false}
            allowDelete={false}
          />
        )}
      </div>

      <RecordingFormDialog
        open={formOpen}
        editing={editingRecording}
        instituteId={selectedInstitute?.id ?? ''}
        classId={selectedClass?.id}
        subjectId={selectedSubject?.id}
        onClose={() => setFormOpen(false)}
        onSaved={() => load(true)}
      />

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={open => setDeleteDialog(prev => ({ ...prev, open }))}
        itemName={deleteDialog.item?.title ?? ''}
        itemType="recording"
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />
    </PageContainer>
  );
};

export default SubjectRecordingsPage;
