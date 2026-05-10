import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Cloud, CheckCircle2, FileText, HardDrive, Link2,
  Loader2, Plus, Trash2, ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { driveAccessApi, uploadToGoogleDrive } from '@/api/driveAccess.api';
import { instituteDriveApi, InstituteDriveStatus } from '@/api/instituteDriveAccess.api';
import { uploadToInstituteDrive } from '@/lib/instituteDriveUpload';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LectureMaterial {
  documentName: string;
  documentUrl: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  source: 'S3' | 'GOOGLE_DRIVE' | 'GOOGLE_DRIVE_INSTITUTE' | 'EXTERNAL_LINK';
}

type UploadTab = 'link' | 'drive';
type DriveDestination = 'institute' | 'personal';

interface DriveStatusState {
  checked: boolean;
  connected: boolean;
  email?: string;
}

interface LectureMaterialsSectionProps {
  materials: LectureMaterial[];
  onChange: (materials: LectureMaterial[]) => void;
  instituteId?: string;
  subjectName?: string;
  className?: string;
  grade?: number;
  disabled?: boolean;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function getFileIcon(source: LectureMaterial['source']) {
  switch (source) {
    case 'GOOGLE_DRIVE':
    case 'GOOGLE_DRIVE_INSTITUTE': return <HardDrive className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    case 'S3': return <Cloud className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
    default: return <Link2 className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
  }
}

function sourceLabel(source: LectureMaterial['source']) {
  switch (source) {
    case 'GOOGLE_DRIVE': return 'Personal Drive';
    case 'GOOGLE_DRIVE_INSTITUTE': return 'Institute Drive';
    case 'S3': return 'Cloud Storage';
    default: return 'External Link';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const LectureMaterialsSection: React.FC<LectureMaterialsSectionProps> = ({
  materials,
  onChange,
  instituteId,
  subjectName,
  className: subjectClassName,
  grade,
  disabled = false,
}) => {
  const { toast } = useToast();
  const [tab, setTab] = useState<UploadTab>('link');

  // ── External link state ────────────────────────────────────────────────────
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // ── Drive state ────────────────────────────────────────────────────────────
  const driveFileRef = useRef<HTMLInputElement>(null);
  const [driveDestination, setDriveDestination] = useState<DriveDestination>('institute');
  const [driveStatus, setDriveStatus] = useState<DriveStatusState>({ checked: false, connected: false });
  const [instituteDriveStatus, setInstituteDriveStatus] = useState<InstituteDriveStatus | null>(null);
  const [instituteDriveChecked, setInstituteDriveChecked] = useState(false);
  const [driveUploading, setDriveUploading] = useState(false);
  const [driveProgress, setDriveProgress] = useState('');

  // ── Drive tab: check statuses on first open ───────────────────────────────
  const handleDriveTabOpen = async () => {
    if (!driveStatus.checked) {
      try {
        const s = await driveAccessApi.getStatus();
        setDriveStatus({ checked: true, connected: s.isConnected, email: s.googleEmail });
      } catch {
        setDriveStatus({ checked: true, connected: false });
      }
    }
    if (!instituteDriveChecked && instituteId) {
      try {
        const s = await instituteDriveApi.getStatus(instituteId);
        setInstituteDriveStatus(s);
        if (s.isConnected) setDriveDestination('institute');
      } catch {
        setInstituteDriveStatus({ isConnected: false });
      } finally {
        setInstituteDriveChecked(true);
      }
    }
  };

  const handleTabChange = (t: UploadTab) => {
    setTab(t);
    if (t === 'drive') handleDriveTabOpen();
  };

  // ── External Link ─────────────────────────────────────────────────────────
  const handleAddLink = () => {
    const name = linkName.trim();
    const url = linkUrl.trim();
    if (!name || !url) {
      toast({ title: 'Required', description: 'Enter both a name and a URL.', variant: 'destructive' });
      return;
    }
    try { new URL(url); } catch {
      toast({ title: 'Invalid URL', description: 'Please enter a valid URL.', variant: 'destructive' });
      return;
    }
    onChange([...materials, { documentName: name, documentUrl: url, source: 'EXTERNAL_LINK' }]);
    setLinkName('');
    setLinkUrl('');
  };

  // ── Drive Upload ──────────────────────────────────────────────────────────
  const handleConnectPersonalDrive = async () => {
    try {
      const { authUrl } = await driveAccessApi.getConnectUrl(window.location.pathname + window.location.search);
      window.location.href = authUrl;
    } catch {
      toast({ title: 'Error', description: 'Could not get Google Drive authorization URL.', variant: 'destructive' });
    }
  };

  const handleDriveFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (driveFileRef.current) driveFileRef.current.value = '';

    setDriveUploading(true);
    const newMaterials: LectureMaterial[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = files.length > 1 ? ` (${i + 1}/${files.length})` : '';
      try {
        if (driveDestination === 'institute' && instituteDriveStatus?.isConnected && instituteId) {
          setDriveProgress(`Uploading "${file.name}"${progress}…`);
          const registered = await uploadToInstituteDrive({
            file,
            instituteId,
            purpose: 'LECTURE_DOCUMENT',
            folderParams: { grade, className: subjectClassName, subjectName },
            referenceType: 'lecture',
            onProgress: (p) => setDriveProgress(`Uploading "${file.name}"${progress} ${p}%`),
          });
          newMaterials.push({
            documentName: registered.fileName,
            documentUrl: registered.viewUrl || registered.driveWebViewLink || `https://drive.google.com/file/d/${registered.driveFileId}/view`,
            driveFileId: registered.driveFileId,
            driveWebViewLink: registered.driveWebViewLink,
            source: 'GOOGLE_DRIVE_INSTITUTE',
          });
        } else {
          setDriveProgress(`Getting Drive access${progress}…`);
          const { accessToken } = await driveAccessApi.getToken();
          const { folderId } = await driveAccessApi.getFolder('LECTURE_DOCUMENT');
          setDriveProgress(`Uploading "${file.name}"${progress}…`);
          const { driveFileId, fileName } = await uploadToGoogleDrive(file, accessToken, folderId);
          setDriveProgress(`Registering "${file.name}"${progress}…`);
          const registered = await driveAccessApi.registerFile({
            driveFileId,
            purpose: 'LECTURE_DOCUMENT',
            referenceType: 'lecture',
          });
          newMaterials.push({
            documentName: registered.fileName || fileName,
            documentUrl: registered.viewUrl,
            driveFileId: registered.driveFileId,
            driveWebViewLink: registered.viewUrl,
            source: 'GOOGLE_DRIVE',
          });
        }
      } catch (err: any) {
        if (err?.status === 401 || err?.statusCode === 401) {
          setDriveStatus({ checked: true, connected: false });
          toast({ title: 'Drive disconnected', description: 'Please reconnect your Google Drive.', variant: 'destructive' });
          break;
        } else {
          toast({ title: `Upload failed: ${file.name}`, description: err?.message || 'Unknown error', variant: 'destructive' });
        }
      }
    }

    if (newMaterials.length > 0) {
      onChange([...materials, ...newMaterials]);
      toast({
        title: newMaterials.length === 1 ? 'Uploaded' : `${newMaterials.length} files uploaded`,
        description: newMaterials.length === 1
          ? `"${newMaterials[0].documentName}" saved.`
          : `${newMaterials.map(m => `"${m.documentName}"`).join(', ')} saved.`,
      });
    }

    setDriveUploading(false);
    setDriveProgress('');
  };

  const removeMaterial = (idx: number) =>
    onChange(materials.filter((_, i) => i !== idx));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Reference Materials
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Add links and/or upload multiple files via Personal or Institute Google Drive.
        </p>
      </div>

      {/* ── Tab toggle ── */}
      <div className="flex items-center bg-muted rounded-xl p-1 gap-1 w-fit">
        {([
          { id: 'link', icon: <Link2 className="h-3.5 w-3.5" />, label: 'Link' },
          { id: 'drive', icon: <HardDrive className="h-3.5 w-3.5" />, label: 'Drive' },
        ] as { id: UploadTab; icon: React.ReactNode; label: string }[]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleTabChange(t.id)}
            disabled={disabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t.id
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── External Link tab ── */}
      {tab === 'link' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Material Name</Label>
            <Input
              placeholder="e.g. Chapter 3 Notes"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              disabled={disabled}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">URL</Label>
            <Input
              placeholder="https://… (YouTube, Drive share link, website, etc.)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              disabled={disabled}
              className="text-sm"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddLink}
            disabled={disabled || !linkName.trim() || !linkUrl.trim()}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Link
          </Button>
        </div>
      )}

      {/* ── Drive tab ── */}
      {tab === 'drive' && (
        <div className="space-y-3">
          {/* Destination toggle — only show if institute drive is available */}
          {instituteDriveChecked && instituteDriveStatus?.isConnected && (
            <div className="flex items-center bg-muted/50 rounded-xl p-1 gap-1 w-fit">
              {(['institute', 'personal'] as DriveDestination[]).map((dest) => (
                <button
                  key={dest}
                  type="button"
                  onClick={() => setDriveDestination(dest)}
                  disabled={disabled}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    driveDestination === dest
                      ? dest === 'institute' ? 'bg-blue-600 text-white shadow-sm' : 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
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
                multiple
                className="hidden"
                onChange={handleDriveFileSelect}
                disabled={disabled || driveUploading}
              />
              {driveUploading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {driveProgress || 'Uploading…'}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => driveFileRef.current?.click()}
                  disabled={disabled}
                  className="gap-2"
                >
                  <HardDrive className="h-4 w-4" />
                  Choose File(s) — {driveDestination === 'institute' ? 'Institute Drive' : 'Personal Drive'}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Materials list ── */}
      {materials.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{materials.length} material{materials.length !== 1 ? 's' : ''} added</p>
          <ul className="space-y-1.5">
            {materials.map((mat, idx) => (
              <li
                key={idx}
                className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-lg px-3 py-2"
              >
                {getFileIcon(mat.source)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{mat.documentName}</p>
                  <p className="text-[10px] text-muted-foreground">{sourceLabel(mat.source)}</p>
                </div>
                <a
                  href={mat.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  title="Open"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => removeMaterial(idx)}
                  disabled={disabled}
                  className="text-muted-foreground hover:text-destructive"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LectureMaterialsSection;
