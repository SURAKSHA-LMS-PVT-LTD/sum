import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { studyMaterialApi, StudyMaterial, StudyMaterialCreateData } from '@/api/studyMaterial.api';
import { driveAccessApi, uploadToGoogleDrive } from '@/api/driveAccess.api';
import { instituteDriveApi, InstituteDriveStatus } from '@/api/instituteDriveAccess.api';
import { uploadToInstituteDrive } from '@/lib/instituteDriveUpload';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  FileText,
  Link2,
  Download,
  Share2,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  X,
  Upload,
  Loader2,
  ExternalLink,
  FileIcon,
  Image as ImageIcon,
  Film,
  Music,
  File,
  AlertTriangle,
  ArrowLeft,
  GripVertical,
  Check,
  HardDrive,
  Cloud,
  CheckCircle2,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | string | undefined): string {
  if (!bytes) return '';
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (isNaN(b) || b === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function fileIcon(mime?: string) {
  if (!mime) return <File className="h-5 w-5" />;
  if (mime.startsWith('image/')) return <ImageIcon className="h-5 w-5" />;
  if (mime.startsWith('video/')) return <Film className="h-5 w-5" />;
  if (mime.startsWith('audio/')) return <Music className="h-5 w-5" />;
  if (mime.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
  return <FileIcon className="h-5 w-5" />;
}

function getMaterialTypeLabel(m: StudyMaterial) {
  if (m.materialType === 'LINK') return 'Link';
  if (m.source === 'GOOGLE_DRIVE' || m.source === 'GOOGLE_DRIVE_INSTITUTE') return 'Drive';
  return 'File';
}

// ── Types ───────────────────────────────────────────────────────────────────

type View = 'list' | 'add' | 'edit';
type UploadTab = 'link' | 'drive';
type DriveDestination = 'institute' | 'personal';

interface DriveStatusState {
  checked: boolean;
  connected: boolean;
  email?: string;
}

interface FormState {
  title: string;
  description: string;
  materialType: 'FILE' | 'LINK';
  fileUrl: string;
  fileName: string;
  fileSize: string;
  mimeType: string;
  source: string;
  driveFileId: string;
  driveWebViewLink: string;
  downloadEnabled: boolean;
  shareEnabled: boolean;
  isActive: boolean;
}

const emptyForm: FormState = {
  title: '',
  description: '',
  materialType: 'FILE',
  fileUrl: '',
  fileName: '',
  fileSize: '',
  mimeType: '',
  source: 'GOOGLE_DRIVE',
  driveFileId: '',
  driveWebViewLink: '',
  downloadEnabled: true,
  shareEnabled: false,
  isActive: true,
};

// ── Component ───────────────────────────────────────────────────────────────

const StudyMaterials: React.FC = () => {
  const { user, currentInstituteId, selectedClass, selectedSubject } = useAuth();
  const { toast } = useToast();
  const { subjectLabel } = useInstituteLabels();

  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Drive state
  const [uploadTab, setUploadTab] = useState<UploadTab>('drive');
  const [driveDestination, setDriveDestination] = useState<DriveDestination>('institute');
  const [driveStatus, setDriveStatus] = useState<DriveStatusState>({ checked: false, connected: false });
  const [instituteDriveStatus, setInstituteDriveStatus] = useState<InstituteDriveStatus | null>(null);
  const [instituteDriveChecked, setInstituteDriveChecked] = useState(false);
  const driveFileRef = useRef<HTMLInputElement>(null);

  const isTeacherOrAdmin = useMemo(() => {
    const r = user?.role || user?.userType || '';
    return ['Teacher', 'InstituteAdmin', 'SuperAdmin', 'SUPERADMIN'].includes(r);
  }, [user]);

  // ── Fetch ───────────────────────────────────────────────────────────────

  const fetchMaterials = useCallback(async () => {
    if (!currentInstituteId || !selectedSubject?.id) return;
    setLoading(true);
    try {
      const res = await studyMaterialApi.list(
        {
          instituteId: currentInstituteId,
          classId: selectedClass?.id,
          subjectId: selectedSubject.id,
          ...(isTeacherOrAdmin ? {} : { isActive: true }),
        },
        true,
      );
      setMaterials(res.data ?? []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load study materials', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, selectedClass?.id, selectedSubject?.id, isTeacherOrAdmin, toast]);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  // ── Handlers ────────────────────────────────────────────────────────────

  // ── Drive helpers ────────────────────────────────────────────────────────

  const handleDriveTabOpen = useCallback(async () => {
    if (!driveStatus.checked) {
      try {
        const s = await driveAccessApi.getStatus();
        setDriveStatus({ checked: true, connected: s.isConnected, email: s.googleEmail });
      } catch {
        setDriveStatus({ checked: true, connected: false });
      }
    }
    if (!instituteDriveChecked && currentInstituteId) {
      try {
        const s = await instituteDriveApi.getStatus(currentInstituteId);
        setInstituteDriveStatus(s);
        if (s.isConnected) setDriveDestination('institute');
      } catch {
        setInstituteDriveStatus({ isConnected: false });
      } finally {
        setInstituteDriveChecked(true);
      }
    }
   
  }, [driveStatus.checked, instituteDriveChecked, currentInstituteId]);

  // Auto-check Drive status when form opens (drive tab is the default)
  useEffect(() => {
    if (view === 'add' || view === 'edit') {
      handleDriveTabOpen();
    }
  }, [view, handleDriveTabOpen]);

  const handleUploadTabChange = (t: UploadTab) => {
    setUploadTab(t);
    if (t === 'drive') handleDriveTabOpen();
  };

  const handleConnectPersonalDrive = async () => {
    try {
      const { authUrl } = await driveAccessApi.getConnectUrl(window.location.pathname + window.location.search);
      window.location.href = authUrl;
    } catch {
      toast({ title: 'Error', description: 'Could not get Google Drive authorization URL.', variant: 'destructive' });
    }
  };

  const handleDriveFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (driveFileRef.current) driveFileRef.current.value = '';

    setUploading(true);
    try {
      if (driveDestination === 'institute' && instituteDriveStatus?.isConnected && currentInstituteId) {
        // Institute Drive: uploadToInstituteDrive registers in existing institute_drive_files table
        setUploadProgress('Uploading to institute Drive…');
        const registered = await uploadToInstituteDrive({
          file,
          instituteId: currentInstituteId,
          purpose: 'GENERAL',
          folderParams: {
            className: selectedClass?.name,
            subjectName: selectedSubject?.name,
          },
          referenceType: 'study_material',
          onProgress: (p) => setUploadProgress(`Uploading… ${p}%`),
        });

        setForm(f => ({
          ...f,
          fileUrl: registered.viewUrl || registered.driveWebViewLink || `https://drive.google.com/file/d/${registered.driveFileId}/view`,
          fileName: registered.fileName,
          fileSize: String(file.size),
          mimeType: file.type,
          driveFileId: registered.driveFileId,
          driveWebViewLink: registered.driveWebViewLink || registered.viewUrl || '',
          source: 'GOOGLE_DRIVE_INSTITUTE',
          materialType: 'FILE',
        }));
        toast({ title: 'Uploaded', description: `"${registered.fileName}" saved to institute Drive.` });
      } else {
        // Personal Drive: upload directly, no registration table needed
        setUploadProgress('Getting Drive access token…');
        const { accessToken } = await driveAccessApi.getToken();
        setUploadProgress('Getting upload folder…');
        const { folderId } = await driveAccessApi.getFolder('GENERAL');
        setUploadProgress(`Uploading ${file.name}…`);
        const { driveFileId, fileName } = await uploadToGoogleDrive(file, accessToken, folderId);
        const viewUrl = `https://drive.google.com/file/d/${driveFileId}/view`;

        setForm(f => ({
          ...f,
          fileUrl: viewUrl,
          fileName: fileName || file.name,
          fileSize: String(file.size),
          mimeType: file.type,
          driveFileId,
          driveWebViewLink: viewUrl,
          source: 'GOOGLE_DRIVE',
          materialType: 'FILE',
        }));
        toast({ title: 'Uploaded', description: `"${fileName || file.name}" saved to Google Drive.` });
      }
    } catch (err: any) {
      if (err?.status === 401 || err?.statusCode === 401) {
        setDriveStatus({ checked: true, connected: false });
        toast({ title: 'Drive disconnected', description: 'Please reconnect your Google Drive.', variant: 'destructive' });
      } else {
        toast({ title: 'Upload failed', description: err?.message || 'Unknown error', variant: 'destructive' });
      }
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Validation', description: 'Title is required', variant: 'destructive' });
      return;
    }
    if (!form.fileUrl && form.materialType === 'FILE') {
      toast({ title: 'Validation', description: 'Please upload a file', variant: 'destructive' });
      return;
    }
    if (!form.fileUrl && form.materialType === 'LINK') {
      toast({ title: 'Validation', description: 'Please enter a URL', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: StudyMaterialCreateData = {
        instituteId: currentInstituteId!,
        classId: selectedClass?.id,
        subjectId: selectedSubject!.id,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        materialType: form.materialType,
        fileUrl: form.fileUrl,
        fileName: form.fileName || undefined,
        fileSize: form.fileSize || undefined,
        mimeType: form.mimeType || undefined,
        source: form.source || (form.materialType === 'LINK' ? 'EXTERNAL_LINK' : 'GOOGLE_DRIVE'),
        driveFileId: form.driveFileId || undefined,
        driveWebViewLink: form.driveWebViewLink || undefined,
        downloadEnabled: form.downloadEnabled,
        shareEnabled: form.shareEnabled,
        isActive: form.isActive,
      };

      if (view === 'edit' && editId) {
        await studyMaterialApi.update(editId, payload);
        toast({ title: 'Updated' });
      } else {
        await studyMaterialApi.create(payload);
        toast({ title: 'Created' });
      }
      setView('list');
      setForm(emptyForm);
      setEditId(null);
      fetchMaterials();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await studyMaterialApi.remove(id);
      toast({ title: 'Deleted' });
      setConfirmDelete(null);
      fetchMaterials();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      await studyMaterialApi.toggleActive(id);
      fetchMaterials();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const startEdit = (m: StudyMaterial) => {
    setForm({
      title: m.title,
      description: m.description ?? '',
      materialType: m.materialType,
      fileUrl: m.fileUrl ?? '',
      fileName: m.fileName ?? '',
      fileSize: m.fileSize ?? '',
      mimeType: m.mimeType ?? '',
      source: m.source ?? 'GOOGLE_DRIVE',
      driveFileId: m.driveFileId ?? '',
      driveWebViewLink: m.driveWebViewLink ?? '',
      downloadEnabled: m.downloadEnabled,
      shareEnabled: m.shareEnabled,
      isActive: m.isActive,
    });
    setEditId(m.id);
    setView('edit');
  };

  const openFile = (m: StudyMaterial) => {
    const url = m.driveWebViewLink || m.fileUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShare = async (m: StudyMaterial) => {
    const url = m.driveWebViewLink || m.fileUrl;
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: m.title, text: m.description || m.title, url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied' });
    }
  };

  const handleDownload = (m: StudyMaterial) => {
    if (!m.downloadEnabled && !isTeacherOrAdmin) {
      toast({ title: 'Download disabled', description: 'This material cannot be downloaded', variant: 'destructive' });
      return;
    }
    const url = m.fileUrl;
    if (!url) return;
    // Confirm before downloading on mobile
    if (window.confirm(`Download "${m.fileName || m.title}"?`)) {
      const a = document.createElement('a');
      a.href = url;
      a.download = m.fileName || m.title;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // ── No-institute guard ──────────────────────────────────────────────────

  if (!currentInstituteId || !selectedSubject?.id) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-7 w-7 text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">Select a {subjectLabel}</h3>
          <p className="text-sm text-muted-foreground">Choose a class & {subjectLabel.toLowerCase()} to view study materials.</p>
        </CardContent>
      </Card>
    );
  }

  // ── ADD / EDIT FORM ─────────────────────────────────────────────────────

  if (view === 'add' || view === 'edit') {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setView('list'); setForm(emptyForm); setEditId(null); }}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">{view === 'edit' ? 'Edit Material' : 'Add Material'}</h2>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Chapter 3 – Notes"
                maxLength={255}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description…"
                maxLength={5000}
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Upload method: Link | Drive tabs */}
            <div className="space-y-3">
              <Label>Add Material</Label>
              <div className="flex items-center bg-muted rounded-xl p-1 gap-1 w-fit">
                {([
                  { id: 'drive' as UploadTab, icon: <HardDrive className="h-3.5 w-3.5" />, label: 'Drive Upload' },
                  { id: 'link' as UploadTab, icon: <Link2 className="h-3.5 w-3.5" />, label: 'External Link' },
                ]).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleUploadTabChange(t.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      uploadTab === t.id
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* ── Drive tab ── */}
              {uploadTab === 'drive' && (
                <div className="space-y-3">
                  {/* Already uploaded file display */}
                  {form.fileUrl && form.materialType === 'FILE' ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                      {fileIcon(form.mimeType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{form.fileName || 'File'}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {form.source === 'GOOGLE_DRIVE_INSTITUTE' ? 'Institute Drive' : form.source === 'GOOGLE_DRIVE' ? 'Personal Drive' : 'Drive'}
                        </p>
                      </div>
                      <button
                        onClick={() => setForm(f => ({ ...f, fileUrl: '', fileName: '', fileSize: '', mimeType: '', driveFileId: '', driveWebViewLink: '', source: 'GOOGLE_DRIVE' }))}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Destination toggle — only if institute drive available */}
                      {instituteDriveChecked && instituteDriveStatus?.isConnected && (
                        <div className="flex items-center bg-muted/50 rounded-xl p-1 gap-1 w-fit">
                          {(['institute', 'personal'] as DriveDestination[]).map((dest) => (
                            <button
                              key={dest}
                              type="button"
                              onClick={() => setDriveDestination(dest)}
                              className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                                driveDestination === dest
                                  ? dest === 'institute' ? 'bg-blue-600 text-white shadow-sm' : 'bg-background shadow-sm text-foreground'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {dest === 'institute' ? <HardDrive className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
                              {dest === 'institute' ? 'Institute Drive' : 'Personal Drive'}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Connection status */}
                      {driveDestination === 'institute' && instituteDriveStatus?.isConnected ? (
                        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-xl px-3 py-2 border border-blue-200 dark:border-blue-800">
                          <HardDrive className="h-4 w-4 shrink-0" />
                          <span>Institute Drive — <strong>{instituteDriveStatus.googleEmail}</strong></span>
                        </div>
                      ) : driveDestination === 'personal' || !instituteDriveStatus?.isConnected ? (
                        <>
                          {!driveStatus.checked ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Checking Drive connection…
                            </div>
                          ) : driveStatus.connected ? (
                            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-3 py-2 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                              Connected as <strong>{driveStatus.email}</strong>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">Personal Google Drive not connected.</p>
                              <Button type="button" variant="outline" size="sm" onClick={handleConnectPersonalDrive} className="gap-2">
                                <HardDrive className="h-4 w-4" /> Connect Google Drive
                              </Button>
                            </div>
                          )}
                        </>
                      ) : null}

                      {/* Upload button */}
                      {(driveDestination === 'institute'
                        ? instituteDriveStatus?.isConnected
                        : driveStatus.connected) && (
                        <>
                          <input
                            ref={driveFileRef}
                            type="file"
                            className="hidden"
                            onChange={handleDriveFileSelect}
                            disabled={uploading}
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mp3,.wav,.zip"
                          />
                          {uploading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {uploadProgress || 'Uploading…'}
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => driveFileRef.current?.click()}
                              className="gap-2"
                            >
                              <HardDrive className="h-4 w-4" />
                              Choose File for {driveDestination === 'institute' ? 'Institute Drive' : 'Personal Drive'}
                            </Button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Link tab ── */}
              {uploadTab === 'link' && (
                <div className="space-y-3">
                  {form.fileUrl && form.materialType === 'LINK' ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <Link2 className="h-5 w-5 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{form.fileName || form.fileUrl}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{form.fileUrl}</p>
                      </div>
                      <button
                        onClick={() => setForm(f => ({ ...f, fileUrl: '', fileName: '', source: 'EXTERNAL_LINK', materialType: 'FILE' }))}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">URL *</Label>
                        <Input
                          value={form.fileUrl}
                          onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))}
                          placeholder="https://… (YouTube, Drive share link, website, etc.)"
                          type="url"
                          className="text-sm"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = form.fileUrl.trim();
                          if (!url) {
                            toast({ title: 'Required', description: 'Enter a URL.', variant: 'destructive' });
                            return;
                          }
                          try { new URL(url); } catch {
                            toast({ title: 'Invalid URL', description: 'Please enter a valid URL.', variant: 'destructive' });
                            return;
                          }
                          setForm(f => ({ ...f, fileUrl: url, materialType: 'LINK', source: 'EXTERNAL_LINK' }));
                        }}
                        disabled={!form.fileUrl.trim()}
                        className="gap-2"
                      >
                        <Check className="h-4 w-4" /> Set Link
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Permissions */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student Permissions</p>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Download</p>
                  <p className="text-xs text-muted-foreground">Students can download this file</p>
                </div>
                <Switch
                  checked={form.downloadEnabled}
                  onCheckedChange={v => setForm(f => ({ ...f, downloadEnabled: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Share</p>
                  <p className="text-xs text-muted-foreground">Students can share the link with others</p>
                </div>
                <Switch
                  checked={form.shareEnabled}
                  onCheckedChange={v => setForm(f => ({ ...f, shareEnabled: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Visible</p>
                  <p className="text-xs text-muted-foreground">Hidden materials are only visible to teachers</p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setView('list'); setForm(emptyForm); setEditId(null); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={saving || uploading}
                onClick={handleSave}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {view === 'edit' ? 'Update' : 'Add Material'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">Study Materials</h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground">
            {selectedSubject?.name || subjectLabel}
          </p>
        </div>
        {isTeacherOrAdmin && (
          <Button size="sm" onClick={() => { setForm(emptyForm); setView('add'); }}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty */}
      {!loading && materials.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold mb-1">No Materials Yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {isTeacherOrAdmin
                ? 'Add study materials — PDFs, links, presentations — for your students.'
                : 'Study materials will appear here when your teacher adds them.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Material Cards */}
      {!loading && materials.length > 0 && (
        <div className="grid gap-3">
          {materials.map(m => (
            <Card
              key={m.id}
              className={cn(
                'overflow-hidden transition-all',
                !m.isActive && 'opacity-60 border-dashed',
              )}
            >
              <CardContent className="p-0">
                <div className="flex items-start gap-3 p-3 sm:p-4">
                  {/* Icon */}
                  <div className={cn(
                    'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                    m.materialType === 'LINK' ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400' : 'bg-primary/10 text-primary',
                  )}>
                    {m.materialType === 'LINK' ? <Link2 className="h-5 w-5" /> : fileIcon(m.mimeType)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground leading-snug truncate">{m.title}</h3>
                        {m.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.description}</p>
                        )}
                      </div>

                      {/* Admin badge */}
                      {isTeacherOrAdmin && !m.isActive && (
                        <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          Hidden
                        </span>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      <span className="px-1.5 py-0.5 rounded bg-muted/80 font-medium">{getMaterialTypeLabel(m)}</span>
                      {m.fileSize && <span>{formatBytes(m.fileSize)}</span>}
                      {m.createdBy && <span>by {m.createdBy.firstName}</span>}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      {/* View / Open */}
                      <button
                        onClick={() => openFile(m)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open
                      </button>

                      {/* Download */}
                      {(m.downloadEnabled || isTeacherOrAdmin) && m.materialType === 'FILE' && (
                        <button
                          onClick={() => handleDownload(m)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </button>
                      )}

                      {/* Share */}
                      {(m.shareEnabled || isTeacherOrAdmin) && (
                        <button
                          onClick={() => handleShare(m)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors"
                        >
                          <Share2 className="h-3.5 w-3.5" /> Share
                        </button>
                      )}

                      {/* Teacher/Admin controls */}
                      {isTeacherOrAdmin && (
                        <>
                          <button
                            onClick={() => handleToggleActive(m.id)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
                            title={m.isActive ? 'Hide' : 'Show'}
                          >
                            {m.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => startEdit(m)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(m.id)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-destructive/70 hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation overlay */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-background border rounded-2xl shadow-xl w-full max-w-xs p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold">Delete Material?</h3>
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleDelete(confirmDelete)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyMaterials;
