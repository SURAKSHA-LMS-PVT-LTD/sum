import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { subjectRecordingsApi, SubjectRecording, SubjectRecordingCreateData, RecordingPlatform, RecordingStatus } from '@/api/subjectRecordings.api';
import { useToast } from '@/hooks/use-toast';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Video, Search, RefreshCw, Loader2, AlertCircle,
  ExternalLink, Pencil, Trash2, Eye, EyeOff, PlayCircle,
  ChevronDown, ChevronUp, X, Check, Globe, Lock, Users, CreditCard,
  Clock,
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

// ─── Recording Card ──────────────────────────────────────────────────────────

const RecordingCard: React.FC<{
  recording: SubjectRecording;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (r: SubjectRecording) => void;
  onDelete: (id: string) => void;
  onToggleActive: (r: SubjectRecording) => void;
}> = ({ recording: r, canEdit, canDelete, onEdit, onDelete, onToggleActive }) => {
  const [expanded, setExpanded] = useState(false);
  const AccessIcon = accessLevelIcon[r.recAccessLevel] ?? Lock;

  return (
    <Card className={`border-border/50 rounded-2xl overflow-hidden transition-all ${!r.isActive ? 'opacity-60' : ''}`}>
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <PlayCircle className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{r.title}</p>
          <div className="flex flex-wrap gap-1.5 mt-0.5 items-center">
            <Badge variant="outline" className="text-[10px] h-4 px-1">{platformLabel[r.platform] ?? r.platform}</Badge>
            {r.durationSeconds && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock className="h-3 w-3" />{formatDuration(r.durationSeconds)}</span>}
            <Badge className={`text-[10px] h-4 px-1 ${r.status === 'published' ? 'bg-green-100 text-green-800' : r.status === 'archived' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-800'}`}>
              {r.status}
            </Badge>
            {r.recAttendanceEnabled && (
              <Badge className="text-[10px] h-4 px-1 bg-blue-100 text-blue-700 flex items-center gap-0.5">
                <AccessIcon className="h-2.5 w-2.5" />{accessLevelLabel[r.recAccessLevel]}
              </Badge>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 space-y-3">
          {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}

          {r.recordingUrl && (
            <a
              href={r.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />Open Recording
            </a>
          )}

          {r.welcomeMessageEnabled && r.welcomeMessageText && (
            <div className="rounded-lg bg-muted/30 border border-border/50 p-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Welcome Message</p>
              <p className="text-xs">{r.welcomeMessageText}</p>
              {r.welcomeMessageVoiceEnabled && (
                <Badge className="mt-1 text-[10px] h-4 px-1 bg-purple-100 text-purple-700">Voice Enabled</Badge>
              )}
            </div>
          )}

          {r.materials && r.materials.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Materials ({r.materials.length})</p>
              <div className="space-y-1">
                {r.materials.map((m, i) => (
                  <a key={i} href={m.driveWebViewLink ?? m.documentUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-1 hover:underline truncate">
                    <ExternalLink className="h-3 w-3 shrink-0" />{m.documentName}
                  </a>
                ))}
              </div>
            </div>
          )}

          {(canEdit || canDelete) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {canEdit && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onEdit(r)}>
                  <Pencil className="h-3 w-3" />Edit
                </Button>
              )}
              {canEdit && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onToggleActive(r)}>
                  {r.isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {r.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              )}
              {canDelete && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => onDelete(r.id)}>
                  <Trash2 className="h-3 w-3" />Delete
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
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
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Recording' : 'Add Recording'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Core fields */}
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

          {/* Thumbnail */}
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

          {/* Welcome message */}
          <LectureWelcomeMessageSettings data={welcome} onChange={setWelcome} />

          {/* Materials */}
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

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecording, setEditingRecording] = useState<SubjectRecording | null>(null);

  const load = useCallback(async (forceRefresh = false) => {
    if (!selectedInstitute?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        instituteId: selectedInstitute.id,
        page,
        limit,
      };
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

  const handleDelete = async (id: string) => {
    if (!window.confirm('This will deactivate the recording (soft delete). It will no longer be visible to students. Continue?')) return;
    try {
      await subjectRecordingsApi.remove(id);
      toast({ title: 'Recording deactivated' });
      load(true);
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.response?.data?.message ?? String(e), variant: 'destructive' });
    }
  };

  const handleToggleActive = async (r: SubjectRecording) => {
    try {
      await subjectRecordingsApi.update(r.id, { isActive: !r.isActive });
      toast({ title: r.isActive ? 'Recording deactivated' : 'Recording activated' });
      load(true);
    } catch (e: any) {
      toast({ title: 'Update failed', description: e?.response?.data?.message ?? String(e), variant: 'destructive' });
    }
  };

  return (
    <PageContainer>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-foreground">Recordings</h1>
            {selectedSubject && <p className="text-xs text-muted-foreground mt-0.5">{subjectLabel}: {selectedSubject.name}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading} className="h-8">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {canCreate && (
              <Button size="sm" className="h-8 gap-1.5" onClick={() => { setEditingRecording(null); setFormOpen(true); }}>
                <Plus className="h-3.5 w-3.5" />Add Recording
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px]">
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
        ) : (
          <>
            <div className="space-y-2">
              {recordings.map(r => (
                <RecordingCard
                  key={r.id}
                  recording={r}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={rec => { setEditingRecording(rec); setFormOpen(true); }}
                  onDelete={handleDelete}
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
    </PageContainer>
  );
};

export default SubjectRecordingsPage;
