import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { studyMaterialApi, StudyMaterial, StudyMaterialCreateData, StudyMaterialFolder } from '@/api/studyMaterial.api';
import { driveAccessApi, uploadToGoogleDrive } from '@/api/driveAccess.api';
import { instituteDriveApi, InstituteDriveStatus } from '@/api/instituteDriveAccess.api';
import { uploadToInstituteDrive } from '@/lib/instituteDriveUpload';
import { classPaymentsApi, ClassPayment } from '@/api/classPayments.api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Plus, FileText, Link2, Download, Share2, Trash2, Eye, EyeOff,
  Pencil, X, Loader2, ExternalLink, FileIcon, Image as ImageIcon,
  Film, Music, File, AlertTriangle, ArrowLeft, Check,
  HardDrive, Cloud, CheckCircle2, Folder, FolderOpen, FolderPlus,
  ChevronRight, Lock, CreditCard,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function buildFolderTree(folders: StudyMaterialFolder[]): StudyMaterialFolder[] {
  const map: Record<string, StudyMaterialFolder> = {};
  folders.forEach(f => { map[f.id] = { ...f, children: [] }; });
  const roots: StudyMaterialFolder[] = [];
  folders.forEach(f => {
    if (f.parentId && map[f.parentId]) {
      (map[f.parentId].children ??= []).push(map[f.id]);
    } else {
      roots.push(map[f.id]);
    }
  });
  return roots;
}

// ── Types ────────────────────────────────────────────────────────────────────

type View = 'list' | 'add' | 'edit' | 'add-folder' | 'edit-folder';
type UploadTab = 'link' | 'drive';
type DriveDestination = 'institute' | 'personal';

interface DriveStatusState { checked: boolean; connected: boolean; email?: string; }

interface MaterialFormState {
  title: string; description: string;
  materialType: 'FILE' | 'LINK'; fileUrl: string; fileName: string;
  fileSize: string; mimeType: string; source: string;
  driveFileId: string; driveWebViewLink: string;
  downloadEnabled: boolean; shareEnabled: boolean; isActive: boolean;
  accessLevel: 'ANYONE' | 'ENROLLED_ONLY' | 'PAID_ONLY';
  requiredPaymentId: string; folderId: string;
}

const emptyMaterialForm: MaterialFormState = {
  title: '', description: '', materialType: 'FILE', fileUrl: '',
  fileName: '', fileSize: '', mimeType: '', source: 'GOOGLE_DRIVE',
  driveFileId: '', driveWebViewLink: '',
  downloadEnabled: true, shareEnabled: false, isActive: true,
  accessLevel: 'ENROLLED_ONLY', requiredPaymentId: '', folderId: '',
};

interface FolderFormState { name: string; description: string; parentId: string; }
const emptyFolderForm: FolderFormState = { name: '', description: '', parentId: '' };

// ── Component ────────────────────────────────────────────────────────────────

const StudyMaterials: React.FC = () => {
  const { user, currentInstituteId, selectedClass } = useAuth();
  const { toast } = useToast();
  const { classLabel } = useInstituteLabels();

  const [folders, setFolders] = useState<StudyMaterialFolder[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [classPayments, setClassPayments] = useState<ClassPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [foldersLoading, setFoldersLoading] = useState(true);

  const [activeFolderId, setActiveFolderId] = useState<string | 'root'>('root');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const [view, setView] = useState<View>('list');
  const [editMaterialId, setEditMaterialId] = useState<string | null>(null);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);

  const [materialForm, setMaterialForm] = useState<MaterialFormState>(emptyMaterialForm);
  const [folderForm, setFolderForm] = useState<FolderFormState>(emptyFolderForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'material' | 'folder'; id: string } | null>(null);
  const [uploadTab, setUploadTab] = useState<UploadTab>('drive');
  const [driveDestination, setDriveDestination] = useState<DriveDestination>('institute');
  const [driveStatus, setDriveStatus] = useState<DriveStatusState>({ checked: false, connected: false });
  const [instituteDriveStatus, setInstituteDriveStatus] = useState<InstituteDriveStatus | null>(null);
  const [instituteDriveChecked, setInstituteDriveChecked] = useState(false);
  const driveFileRef = useRef<HTMLInputElement>(null);

  const isAdminOrTeacher = useMemo(() => {
    const r = user?.role || user?.userType || '';
    return ['Teacher', 'InstituteAdmin', 'SuperAdmin', 'SUPERADMIN'].includes(r);
  }, [user]);

  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);

  // ── Data loading ───────────────────────────────────────────────────────────

  const fetchFolders = useCallback(async () => {
    if (!currentInstituteId || !selectedClass?.id) return;
    setFoldersLoading(true);
    try {
      const data = await studyMaterialApi.listFolders(currentInstituteId, selectedClass.id, true);
      setFolders(data || []);
    } catch { /* silent */ } finally { setFoldersLoading(false); }
  }, [currentInstituteId, selectedClass?.id]);

  const fetchMaterials = useCallback(async (fid: string | 'root' = activeFolderId) => {
    if (!currentInstituteId || !selectedClass?.id) return;
    setLoading(true);
    try {
      const params: any = {
        instituteId: currentInstituteId,
        classId: selectedClass.id,
        folderId: fid,
        limit: 200,
      };
      if (!isAdminOrTeacher) params.isActive = true;
      const res = await studyMaterialApi.list(params, true);
      setMaterials(res.data ?? []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load study materials', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [currentInstituteId, selectedClass?.id, isAdminOrTeacher, activeFolderId, toast]);

  const fetchPayments = useCallback(async () => {
    if (!currentInstituteId || !selectedClass?.id || !isAdminOrTeacher) return;
    try {
      const res = await classPaymentsApi.getClassPayments(currentInstituteId, selectedClass.id, 1, 100);
      setClassPayments(res.data?.filter(p => p.status === 'ACTIVE') ?? []);
    } catch { /* silent */ }
  }, [currentInstituteId, selectedClass?.id, isAdminOrTeacher]);

  useEffect(() => {
    fetchFolders();
    fetchPayments();
  }, [fetchFolders, fetchPayments]);

  useEffect(() => {
    fetchMaterials(activeFolderId);
  }, [activeFolderId, currentInstituteId, selectedClass?.id]);

  // ── Folder navigation ──────────────────────────────────────────────────────

  const handleSelectFolder = (id: string | 'root') => {
    setActiveFolderId(id);
    setView('list');
  };

  const toggleExpand = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getActiveFolderName = (): string => {
    if (activeFolderId === 'root') return 'All Materials';
    return folders.find(f => f.id === activeFolderId)?.name ?? 'Folder';
  };

  // ── Drive helpers ──────────────────────────────────────────────────────────

  const handleDriveTabOpen = useCallback(async () => {
    if (!driveStatus.checked) {
      try {
        const s = await driveAccessApi.getStatus();
        setDriveStatus({ checked: true, connected: s.isConnected, email: s.googleEmail });
      } catch { setDriveStatus({ checked: true, connected: false }); }
    }
    if (!instituteDriveChecked && currentInstituteId) {
      try {
        const s = await instituteDriveApi.getStatus(currentInstituteId);
        setInstituteDriveStatus(s);
        if (s.isConnected) setDriveDestination('institute');
      } catch { setInstituteDriveStatus({ isConnected: false }); }
      finally { setInstituteDriveChecked(true); }
    }
  }, [driveStatus.checked, instituteDriveChecked, currentInstituteId]);

  useEffect(() => {
    if (view === 'add' || view === 'edit') handleDriveTabOpen();
  }, [view, handleDriveTabOpen]);

  const handleDriveFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (driveFileRef.current) driveFileRef.current.value = '';
    setUploading(true);
    try {
      if (driveDestination === 'institute' && instituteDriveStatus?.isConnected && currentInstituteId) {
        setUploadProgress('Uploading to institute Drive…');
        const registered = await uploadToInstituteDrive({
          file, instituteId: currentInstituteId, purpose: 'GENERAL',
          folderParams: { className: selectedClass?.name },
          referenceType: 'study_material',
          onProgress: (p) => setUploadProgress(`Uploading… ${p}%`),
        });
        setMaterialForm(f => ({
          ...f,
          fileUrl: registered.viewUrl || registered.driveWebViewLink || `https://drive.google.com/file/d/${registered.driveFileId}/view`,
          fileName: registered.fileName, fileSize: String(file.size), mimeType: file.type,
          driveFileId: registered.driveFileId,
          driveWebViewLink: registered.driveWebViewLink || registered.viewUrl || '',
          source: 'GOOGLE_DRIVE_INSTITUTE', materialType: 'FILE',
        }));
        toast({ title: 'Uploaded', description: `"${registered.fileName}" saved to institute Drive.` });
      } else {
        setUploadProgress('Getting Drive access token…');
        const { accessToken } = await driveAccessApi.getToken();
        const { folderId } = await driveAccessApi.getFolder('GENERAL');
        setUploadProgress(`Uploading ${file.name}…`);
        const { driveFileId, fileName } = await uploadToGoogleDrive(file, accessToken, folderId);
        const viewUrl = `https://drive.google.com/file/d/${driveFileId}/view`;
        setMaterialForm(f => ({
          ...f,
          fileUrl: viewUrl, fileName: fileName || file.name, fileSize: String(file.size),
          mimeType: file.type, driveFileId, driveWebViewLink: viewUrl,
          source: 'GOOGLE_DRIVE', materialType: 'FILE',
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
    } finally { setUploading(false); setUploadProgress(''); }
  };

  // ── Save handlers ──────────────────────────────────────────────────────────

  const handleSaveMaterial = async () => {
    const f = materialForm;
    if (!f.title.trim()) { toast({ title: 'Validation', description: 'Title is required', variant: 'destructive' }); return; }
    if (!f.fileUrl && f.materialType === 'FILE') { toast({ title: 'Validation', description: 'Please upload a file', variant: 'destructive' }); return; }
    if (!f.fileUrl && f.materialType === 'LINK') { toast({ title: 'Validation', description: 'Please enter a URL', variant: 'destructive' }); return; }
    if (f.accessLevel === 'PAID_ONLY' && !f.requiredPaymentId) {
      toast({ title: 'Validation', description: 'Select a class payment for PAID_ONLY access', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const payload: StudyMaterialCreateData = {
        instituteId: currentInstituteId!,
        classId: selectedClass?.id,
        folderId: f.folderId || (activeFolderId !== 'root' ? activeFolderId : undefined),
        title: f.title.trim(),
        description: f.description.trim() || undefined,
        materialType: f.materialType,
        fileUrl: f.fileUrl,
        fileName: f.fileName || undefined,
        fileSize: f.fileSize || undefined,
        mimeType: f.mimeType || undefined,
        source: f.source || (f.materialType === 'LINK' ? 'EXTERNAL_LINK' : 'GOOGLE_DRIVE'),
        driveFileId: f.driveFileId || undefined,
        driveWebViewLink: f.driveWebViewLink || undefined,
        downloadEnabled: f.downloadEnabled,
        shareEnabled: f.shareEnabled,
        isActive: f.isActive,
        accessLevel: f.accessLevel,
        requiredPaymentId: f.accessLevel === 'PAID_ONLY' ? f.requiredPaymentId : undefined,
      };
      if (view === 'edit' && editMaterialId) {
        await studyMaterialApi.update(editMaterialId, payload);
        toast({ title: 'Updated' });
      } else {
        await studyMaterialApi.create(payload);
        toast({ title: 'Added' });
      }
      setView('list');
      setMaterialForm(emptyMaterialForm);
      setEditMaterialId(null);
      fetchMaterials();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleSaveFolder = async () => {
    if (!folderForm.name.trim()) {
      toast({ title: 'Validation', description: 'Folder name is required', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      if (view === 'edit-folder' && editFolderId) {
        await studyMaterialApi.updateFolder(editFolderId, {
          name: folderForm.name.trim(),
          description: folderForm.description.trim() || undefined,
        });
        toast({ title: 'Folder updated' });
      } else {
        await studyMaterialApi.createFolder({
          instituteId: currentInstituteId!,
          classId: selectedClass!.id,
          parentId: folderForm.parentId || (activeFolderId !== 'root' ? activeFolderId : undefined),
          name: folderForm.name.trim(),
          description: folderForm.description.trim() || undefined,
        });
        toast({ title: 'Folder created' });
      }
      setView('list');
      setFolderForm(emptyFolderForm);
      setEditFolderId(null);
      fetchFolders();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleDeleteMaterial = async (id: string) => {
    try {
      await studyMaterialApi.remove(id);
      toast({ title: 'Deleted' });
      setConfirmDelete(null);
      fetchMaterials();
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await studyMaterialApi.deleteFolder(id);
      toast({ title: 'Folder deleted' });
      setConfirmDelete(null);
      if (activeFolderId === id) setActiveFolderId('root');
      fetchFolders();
      fetchMaterials('root');
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const handleToggleActive = async (id: string) => {
    try { await studyMaterialApi.toggleActive(id); fetchMaterials(); }
    catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
  };

  const startEditMaterial = (m: StudyMaterial) => {
    setMaterialForm({
      title: m.title, description: m.description ?? '',
      materialType: m.materialType, fileUrl: m.fileUrl ?? '',
      fileName: m.fileName ?? '', fileSize: m.fileSize ?? '',
      mimeType: m.mimeType ?? '', source: m.source ?? 'GOOGLE_DRIVE',
      driveFileId: m.driveFileId ?? '', driveWebViewLink: m.driveWebViewLink ?? '',
      downloadEnabled: m.downloadEnabled, shareEnabled: m.shareEnabled, isActive: m.isActive,
      accessLevel: m.accessLevel ?? 'ENROLLED_ONLY',
      requiredPaymentId: m.requiredPaymentId ?? '',
      folderId: m.folderId ?? '',
    });
    setEditMaterialId(m.id);
    setView('edit');
  };

  const startEditFolder = (f: StudyMaterialFolder) => {
    setFolderForm({ name: f.name, description: f.description ?? '', parentId: f.parentId ?? '' });
    setEditFolderId(f.id);
    setView('edit-folder');
  };

  const openFile = (m: StudyMaterial) => {
    const url = m.driveWebViewLink || m.fileUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShare = async (m: StudyMaterial) => {
    const url = m.driveWebViewLink || m.fileUrl;
    if (!url) return;
    if (navigator.share) {
      try { await navigator.share({ title: m.title, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied' });
    }
  };

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!currentInstituteId || !selectedClass?.id) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-7 w-7 text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">Select a {classLabel}</h3>
          <p className="text-sm text-muted-foreground">Choose a class to view study materials.</p>
        </CardContent>
      </Card>
    );
  }

  // ── Folder form ────────────────────────────────────────────────────────────

  if (view === 'add-folder' || view === 'edit-folder') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { setView('list'); setFolderForm(emptyFolderForm); setEditFolderId(null); }}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">{view === 'edit-folder' ? 'Edit Folder' : 'New Folder'}</h2>
        </div>
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Folder Name *</Label>
              <Input value={folderForm.name} onChange={e => setFolderForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Chapter 3 Notes" maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea value={folderForm.description} onChange={e => setFolderForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional…" rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            {view === 'add-folder' && (
              <div className="space-y-1.5">
                <Label>Parent Folder (optional)</Label>
                <select value={folderForm.parentId} onChange={e => setFolderForm(f => ({ ...f, parentId: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">— Root (no parent) —</option>
                  {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setView('list'); setFolderForm(emptyFolderForm); setEditFolderId(null); }}>Cancel</Button>
              <Button className="flex-1" disabled={saving} onClick={handleSaveFolder}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {view === 'edit-folder' ? 'Update Folder' : 'Create Folder'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Material form ──────────────────────────────────────────────────────────

  if (view === 'add' || view === 'edit') {
    const f = materialForm;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { setView('list'); setMaterialForm(emptyMaterialForm); setEditMaterialId(null); }}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold">{view === 'edit' ? 'Edit Material' : 'Add Material'}</h2>
        </div>
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={f.title} onChange={e => setMaterialForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Chapter 3 – Notes" maxLength={255} />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea value={f.description} onChange={e => setMaterialForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Optional description…" rows={2} maxLength={5000}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>

            {/* Folder */}
            <div className="space-y-1.5">
              <Label>Folder</Label>
              <select value={f.folderId} onChange={e => setMaterialForm(p => ({ ...p, folderId: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">— No folder (root) —</option>
                {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
              </select>
            </div>

            {/* Access level */}
            <div className="space-y-2 pt-1 border-t border-border/50">
              <Label>Access Level</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { val: 'ANYONE', label: 'Anyone', desc: 'Public', icon: <Eye className="h-3.5 w-3.5" /> },
                  { val: 'ENROLLED_ONLY', label: 'Enrolled', desc: 'Class students', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
                  { val: 'PAID_ONLY', label: 'Paid Only', desc: 'Verified payment', icon: <CreditCard className="h-3.5 w-3.5" /> },
                ] as const).map(opt => (
                  <button key={opt.val} type="button"
                    onClick={() => setMaterialForm(p => ({ ...p, accessLevel: opt.val }))}
                    className={cn('flex flex-col items-center gap-1 p-2.5 rounded-lg border text-center transition-all text-xs',
                      f.accessLevel === opt.val ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}>
                    {opt.icon}
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-[10px] opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>

              {f.accessLevel === 'PAID_ONLY' && (
                <div className="space-y-1.5 mt-2">
                  <Label className="text-xs">Select Class Payment *</Label>
                  {classPayments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No active class payments found. Create a class payment first.</p>
                  ) : (
                    <select value={f.requiredPaymentId} onChange={e => setMaterialForm(p => ({ ...p, requiredPaymentId: e.target.value }))}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="">— Select payment —</option>
                      {classPayments.map(p => (
                        <option key={p.id} value={p.id}>{p.title} — Rs. {Number(p.amount).toLocaleString()}</option>
                      ))}
                    </select>
                  )}
                  <p className="text-[10px] text-muted-foreground">Students must have a VERIFIED submission for the selected payment to access this material.</p>
                </div>
              )}
            </div>

            {/* Upload: Drive | Link tabs */}
            <div className="space-y-3 pt-1 border-t border-border/50">
              <Label>Add Material</Label>
              <div className="flex items-center bg-muted rounded-xl p-1 gap-1 w-fit">
                {([
                  { id: 'drive' as UploadTab, label: 'Drive Upload', icon: <HardDrive className="h-3.5 w-3.5" /> },
                  { id: 'link' as UploadTab, label: 'External Link', icon: <Link2 className="h-3.5 w-3.5" /> },
                ]).map(t => (
                  <button key={t.id} type="button"
                    onClick={() => { setUploadTab(t.id); if (t.id === 'drive') handleDriveTabOpen(); }}
                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                      uploadTab === t.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {uploadTab === 'drive' && (
                <div className="space-y-3">
                  {f.fileUrl && f.materialType === 'FILE' ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                      {fileIcon(f.mimeType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.fileName || 'File'}</p>
                        <p className="text-[10px] text-muted-foreground">{f.source === 'GOOGLE_DRIVE_INSTITUTE' ? 'Institute Drive' : 'Personal Drive'}</p>
                      </div>
                      <button onClick={() => setMaterialForm(p => ({ ...p, fileUrl: '', fileName: '', fileSize: '', mimeType: '', driveFileId: '', driveWebViewLink: '', source: 'GOOGLE_DRIVE' }))}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      {instituteDriveChecked && instituteDriveStatus?.isConnected && (
                        <div className="flex items-center bg-muted/50 rounded-xl p-1 gap-1 w-fit">
                          {(['institute', 'personal'] as DriveDestination[]).map(dest => (
                            <button key={dest} type="button" onClick={() => setDriveDestination(dest)}
                              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                                driveDestination === dest
                                  ? dest === 'institute' ? 'bg-blue-600 text-white shadow-sm' : 'bg-background shadow-sm text-foreground'
                                  : 'text-muted-foreground hover:text-foreground')}>
                              {dest === 'institute' ? <HardDrive className="h-3 w-3" /> : <Cloud className="h-3 w-3" />}
                              {dest === 'institute' ? 'Institute Drive' : 'Personal Drive'}
                            </button>
                          ))}
                        </div>
                      )}
                      {driveDestination === 'institute' && instituteDriveStatus?.isConnected ? (
                        <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-xl px-3 py-2 border border-blue-200 dark:border-blue-800">
                          <HardDrive className="h-4 w-4 shrink-0" />
                          <span>Institute Drive — <strong>{instituteDriveStatus.googleEmail}</strong></span>
                        </div>
                      ) : !driveStatus.checked ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking…</div>
                      ) : driveStatus.connected ? (
                        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-3 py-2 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />Connected as <strong>{driveStatus.email}</strong>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Personal Google Drive not connected.</p>
                          <Button type="button" variant="outline" size="sm" className="gap-2"
                            onClick={async () => { try { const { authUrl } = await driveAccessApi.getConnectUrl(window.location.pathname + window.location.search); window.location.href = authUrl; } catch { toast({ title: 'Error', variant: 'destructive' }); } }}>
                            <HardDrive className="h-4 w-4" /> Connect Google Drive
                          </Button>
                        </div>
                      )}
                      {(driveDestination === 'institute' ? instituteDriveStatus?.isConnected : driveStatus.connected) && (
                        <>
                          <input ref={driveFileRef} type="file" className="hidden" onChange={handleDriveFileSelect} disabled={uploading}
                            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mp3,.wav,.zip" />
                          {uploading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{uploadProgress || 'Uploading…'}</div>
                          ) : (
                            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => driveFileRef.current?.click()}>
                              <HardDrive className="h-4 w-4" />Choose File
                            </Button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {uploadTab === 'link' && (
                <div className="space-y-3">
                  {f.fileUrl && f.materialType === 'LINK' ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <Link2 className="h-5 w-5 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.fileName || f.fileUrl}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{f.fileUrl}</p>
                      </div>
                      <button onClick={() => setMaterialForm(p => ({ ...p, fileUrl: '', fileName: '', source: 'EXTERNAL_LINK', materialType: 'FILE' }))}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input value={f.fileUrl} onChange={e => setMaterialForm(p => ({ ...p, fileUrl: e.target.value }))}
                        placeholder="https://… (YouTube, Drive share link, etc.)" type="url" className="text-sm" />
                      <Button type="button" variant="outline" size="sm" className="gap-2"
                        onClick={() => {
                          const url = f.fileUrl.trim();
                          if (!url) { toast({ title: 'Enter a URL', variant: 'destructive' }); return; }
                          try { new URL(url); } catch { toast({ title: 'Invalid URL', variant: 'destructive' }); return; }
                          setMaterialForm(p => ({ ...p, fileUrl: url, materialType: 'LINK', source: 'EXTERNAL_LINK' }));
                        }} disabled={!f.fileUrl.trim()}>
                        <Check className="h-4 w-4" /> Set Link
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Permissions */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student Permissions</p>
              {[
                { key: 'downloadEnabled', label: 'Download', desc: 'Students can download this file' },
                { key: 'shareEnabled', label: 'Share', desc: 'Students can share the link' },
                { key: 'isActive', label: 'Visible', desc: 'Hidden materials only visible to teachers' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                  <Switch checked={(f as any)[item.key]} onCheckedChange={v => setMaterialForm(p => ({ ...p, [item.key]: v }))} />
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setView('list'); setMaterialForm(emptyMaterialForm); setEditMaterialId(null); }}>Cancel</Button>
              <Button className="flex-1" disabled={saving || uploading} onClick={handleSaveMaterial}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {view === 'edit' ? 'Update' : 'Add Material'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────

  const activeFolderObj = folders.find(f => f.id === activeFolderId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">Study Materials</h1>
          <p className="text-[11px] sm:text-xs text-muted-foreground">{selectedClass?.name}</p>
        </div>
        {isAdminOrTeacher && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setFolderForm(emptyFolderForm); setView('add-folder'); }}>
              <FolderPlus className="h-4 w-4 mr-1" /> Folder
            </Button>
            <Button size="sm" onClick={() => { setMaterialForm(emptyMaterialForm); setView('add'); }}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        )}
      </div>

      {/* Folder breadcrumb + sidebar */}
      <div className="flex gap-3">
        {/* Sidebar */}
        <div className="shrink-0 w-40 sm:w-48 space-y-0.5">
          <FolderNavItem
            id="root" label="All Materials" active={activeFolderId === 'root'}
            onClick={() => handleSelectFolder('root')} icon={<Folder className="h-4 w-4" />}
          />
          {foldersLoading ? (
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading…</div>
          ) : (
            folderTree.map(folder => (
              <FolderNavTree key={folder.id} folder={folder} activeFolderId={activeFolderId}
                expandedFolders={expandedFolders} onToggleExpand={toggleExpand}
                onSelect={handleSelectFolder}
                onEdit={isAdminOrTeacher ? startEditFolder : undefined}
                onDelete={isAdminOrTeacher ? (f) => setConfirmDelete({ type: 'folder', id: f.id }) : undefined}
              />
            ))
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Folder header */}
          {activeFolderId !== 'root' && activeFolderObj && (
            <div className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{activeFolderObj.name}</span>
                {activeFolderObj.description && <span className="text-xs text-muted-foreground hidden sm:block">— {activeFolderObj.description}</span>}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : materials.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <h3 className="font-semibold mb-1">No Materials</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {isAdminOrTeacher ? 'Add study materials for your students.' : 'Study materials will appear here when your teacher adds them.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2.5">
              {materials.map(m => (
                <MaterialCard key={m.id} material={m}
                  isAdminOrTeacher={isAdminOrTeacher}
                  classPayments={classPayments}
                  onOpen={openFile}
                  onShare={handleShare}
                  onToggleActive={handleToggleActive}
                  onEdit={startEditMaterial}
                  onDelete={(id) => setConfirmDelete({ type: 'material', id })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setConfirmDelete(null)}>
          <div className="bg-background border rounded-2xl shadow-xl w-full max-w-xs p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">
              {confirmDelete.type === 'folder' ? 'Delete Folder?' : 'Delete Material?'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {confirmDelete.type === 'folder'
                ? 'The folder will be deleted. Materials inside will be moved to root.'
                : 'This action cannot be undone.'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" className="flex-1"
                onClick={() => confirmDelete.type === 'folder'
                  ? handleDeleteFolder(confirmDelete.id)
                  : handleDeleteMaterial(confirmDelete.id)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const FolderNavItem: React.FC<{
  id: string; label: string; active: boolean;
  onClick: () => void; icon?: React.ReactNode;
}> = ({ label, active, onClick, icon }) => (
  <button type="button" onClick={onClick}
    className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-left transition-colors',
      active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
    {icon}
    <span className="truncate">{label}</span>
  </button>
);

const FolderNavTree: React.FC<{
  folder: StudyMaterialFolder;
  activeFolderId: string;
  expandedFolders: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onEdit?: (f: StudyMaterialFolder) => void;
  onDelete?: (f: StudyMaterialFolder) => void;
  depth?: number;
}> = ({ folder, activeFolderId, expandedFolders, onToggleExpand, onSelect, onEdit, onDelete, depth = 0 }) => {
  const hasChildren = folder.children && folder.children.length > 0;
  const isExpanded = expandedFolders.has(folder.id);
  const isActive = activeFolderId === folder.id;

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <div className={cn('group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors',
        isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
        <button type="button" onClick={() => { if (hasChildren) onToggleExpand(folder.id); onSelect(folder.id); }}
          className="flex items-center gap-1.5 flex-1 text-xs font-medium text-left min-w-0">
          {hasChildren ? (
            <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform', isExpanded && 'rotate-90')} />
          ) : <span className="w-3" />}
          {isActive ? <FolderOpen className="h-3.5 w-3.5 shrink-0" /> : <Folder className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{folder.name}</span>
        </button>
        {(onEdit || onDelete) && (
          <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
            {onEdit && <button type="button" onClick={e => { e.stopPropagation(); onEdit(folder); }} className="p-0.5 rounded hover:bg-muted-foreground/20"><Pencil className="h-2.5 w-2.5" /></button>}
            {onDelete && <button type="button" onClick={e => { e.stopPropagation(); onDelete(folder); }} className="p-0.5 rounded hover:bg-destructive/20 hover:text-destructive"><Trash2 className="h-2.5 w-2.5" /></button>}
          </div>
        )}
      </div>
      {hasChildren && isExpanded && folder.children!.map(child => (
        <FolderNavTree key={child.id} folder={child} activeFolderId={activeFolderId}
          expandedFolders={expandedFolders} onToggleExpand={onToggleExpand}
          onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} depth={depth + 1} />
      ))}
    </div>
  );
};

const MaterialCard: React.FC<{
  material: StudyMaterial;
  isAdminOrTeacher: boolean;
  classPayments: ClassPayment[];
  onOpen: (m: StudyMaterial) => void;
  onShare: (m: StudyMaterial) => void;
  onToggleActive: (id: string) => void;
  onEdit: (m: StudyMaterial) => void;
  onDelete: (id: string) => void;
}> = ({ material: m, isAdminOrTeacher, classPayments, onOpen, onShare, onToggleActive, onEdit, onDelete }) => {
  const isPaidBlocked = !isAdminOrTeacher && m.accessLevel === 'PAID_ONLY' && m._paymentVerified === false;
  const requiredPayment = m.requiredPaymentId ? classPayments.find(p => p.id === m.requiredPaymentId) : undefined;

  return (
    <Card className={cn('overflow-hidden transition-all', !m.isActive && 'opacity-60 border-dashed', isPaidBlocked && 'opacity-70')}>
      <CardContent className="p-0">
        <div className="flex items-start gap-3 p-3 sm:p-4">
          {/* Icon */}
          <div className={cn('shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
            isPaidBlocked ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400'
              : m.materialType === 'LINK' ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
              : 'bg-primary/10 text-primary')}>
            {isPaidBlocked ? <Lock className="h-5 w-5" /> : m.materialType === 'LINK' ? <Link2 className="h-5 w-5" /> : fileIcon(m.mimeType)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground leading-snug truncate">{m.title}</h3>
                {m.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.description}</p>}
                {isPaidBlocked && requiredPayment && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />Requires payment: {requiredPayment.title}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {m.accessLevel === 'PAID_ONLY' && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">Paid</span>
                )}
                {m.accessLevel === 'ANYONE' && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400">Public</span>
                )}
                {isAdminOrTeacher && !m.isActive && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Hidden</span>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
              <span className="px-1.5 py-0.5 rounded bg-muted/80 font-medium">
                {m.materialType === 'LINK' ? 'Link' : m.source === 'GOOGLE_DRIVE_INSTITUTE' ? 'Drive' : m.source === 'GOOGLE_DRIVE' ? 'Drive' : 'File'}
              </span>
              {m.fileSize && <span>{formatBytes(m.fileSize)}</span>}
              {m.createdBy && <span>by {m.createdBy.firstName}</span>}
            </div>

            {/* Actions */}
            {!isPaidBlocked && (
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                <button onClick={() => onOpen(m)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </button>
                {(m.downloadEnabled || isAdminOrTeacher) && m.materialType === 'FILE' && (
                  <a href={m.fileUrl} download={m.fileName || m.title} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors">
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                )}
                {(m.shareEnabled || isAdminOrTeacher) && (
                  <button onClick={() => onShare(m)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 hover:bg-blue-200 transition-colors">
                    <Share2 className="h-3.5 w-3.5" /> Share
                  </button>
                )}
                {isAdminOrTeacher && (
                  <>
                    <button onClick={() => onToggleActive(m.id)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
                      title={m.isActive ? 'Hide' : 'Show'}>
                      {m.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => onEdit(m)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => onDelete(m.id)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-destructive/70 hover:bg-destructive/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
            {isPaidBlocked && (
              <div className="mt-2.5">
                <a href={`/payments`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 hover:bg-amber-200 transition-colors">
                  <CreditCard className="h-3.5 w-3.5" /> Pay to Access
                </a>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StudyMaterials;
