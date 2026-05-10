import React, { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/api/apiError';
import { instituteDriveApi } from '@/api/instituteDriveAccess.api';
import {
  Folder,
  Trash2,
  ExternalLink,
  Loader2,
  RefreshCw,
  HardDrive,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';

interface DriveFolder {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
}

interface DriveStorage {
  limit: number | null;
  usage: number;
  usageInDrive: number;
  usageInDriveTrash: number;
}

interface InstituteDriveManageDrawerProps {
  open: boolean;
  onClose: () => void;
  instituteId: string;
  instituteName: string;
  isAdmin: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const InstituteDriveManageDrawer: React.FC<InstituteDriveManageDrawerProps> = ({
  open,
  onClose,
  instituteId,
  instituteName,
  isAdmin,
}) => {
  const { toast } = useToast();
  const [storage, setStorage] = useState<DriveStorage | null>(null);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadingStorage(true);
    setLoadingFolders(true);

    instituteDriveApi
      .getStorage(instituteId)
      .then(s => setStorage(s))
      .catch(err =>
        toast({
          title: 'Storage info unavailable',
          description: getErrorMessage(err, 'Could not fetch storage quota'),
          variant: 'destructive',
        }),
      )
      .finally(() => setLoadingStorage(false));

    instituteDriveApi
      .listFolders(instituteId, instituteName)
      .then(f => setFolders(f))
      .catch(err =>
        toast({
          title: 'Folder list unavailable',
          description: getErrorMessage(err, 'Could not fetch Drive folders'),
          variant: 'destructive',
        }),
      )
      .finally(() => setLoadingFolders(false));
  }, [instituteId, instituteName, toast]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const handleDeleteFolder = useCallback(
    async (folder: DriveFolder) => {
      if (confirmDeleteId !== folder.id) {
        setConfirmDeleteId(folder.id);
        return;
      }
      setDeletingId(folder.id);
      setConfirmDeleteId(null);
      try {
        await instituteDriveApi.deleteFolder(instituteId, folder.id);
        setFolders(prev => prev.filter(f => f.id !== folder.id));
        toast({
          title: 'Folder moved to trash',
          description: `"${folder.name}" has been trashed in Google Drive.`,
        });
      } catch (err: any) {
        toast({
          title: 'Delete failed',
          description: getErrorMessage(err, 'Could not trash folder'),
          variant: 'destructive',
        });
      } finally {
        setDeletingId(null);
      }
    },
    [confirmDeleteId, instituteId, toast],
  );

  const usagePercent =
    storage?.limit && storage.limit > 0
      ? Math.min(100, (storage.usage / storage.limit) * 100)
      : null;

  const storageWarning =
    usagePercent !== null && usagePercent >= 90;

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto"
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-blue-600" />
            Manage Drive
          </SheetTitle>
          <SheetDescription className="text-xs">
            Storage and folder overview for{' '}
            <span className="font-medium">{instituteName}</span>
          </SheetDescription>
        </SheetHeader>

        {/* ── Storage Card ── */}
        <div className="rounded-xl border bg-gradient-to-br from-blue-50/60 to-indigo-50/40 dark:from-blue-950/20 dark:to-indigo-950/10 p-4 mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Storage</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={loadData}
              disabled={loadingStorage}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingStorage ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {loadingStorage ? (
            <div className="flex items-center gap-2 text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Fetching quota…</span>
            </div>
          ) : storage ? (
            <>
              {storageWarning && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    Storage is {usagePercent!.toFixed(0)}% full. Consider freeing space.
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                {usagePercent !== null ? (
                  <>
                    <Progress
                      value={usagePercent}
                      className={`h-2.5 ${storageWarning ? '[&>div]:bg-amber-500' : '[&>div]:bg-blue-500'}`}
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>{formatBytes(storage.usage)} used</span>
                      <span>{formatBytes(storage.limit!)} total</span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Unlimited storage (Google Workspace)
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-lg bg-white/70 dark:bg-white/5 border px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">In Drive</p>
                    <p className="text-xs font-semibold">{formatBytes(storage.usageInDrive)}</p>
                  </div>
                  <div className="rounded-lg bg-white/70 dark:bg-white/5 border px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">In Trash</p>
                    <p className="text-xs font-semibold">{formatBytes(storage.usageInDriveTrash)}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Storage info not available.</p>
          )}
        </div>

        {/* ── Folder List ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Grade Folders
              {!loadingFolders && (
                <span className="ml-1.5 text-[11px] text-muted-foreground font-normal">
                  ({folders.length})
                </span>
              )}
            </h3>
            {isAdmin && (
              <span className="text-[10px] text-muted-foreground">
                Tap Delete twice to confirm
              </span>
            )}
          </div>

          {loadingFolders ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading folders…</span>
            </div>
          ) : folders.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 py-8 text-center space-y-2">
              <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No folders yet</p>
              <p className="text-[11px] text-muted-foreground/70">
                Folders are created automatically when teachers upload files.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {folders.map(folder => (
                <div
                  key={folder.id}
                  className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{folder.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Modified {formatDate(folder.modifiedTime)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => window.open(folder.webViewLink, '_blank', 'noopener,noreferrer')}
                      title="Open in Google Drive"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 ${
                          confirmDeleteId === folder.id
                            ? 'text-red-600 bg-red-50 dark:bg-red-950/20 hover:bg-red-100'
                            : 'text-muted-foreground hover:text-red-600'
                        }`}
                        onClick={() => handleDeleteFolder(folder)}
                        disabled={deletingId === folder.id}
                        title={confirmDeleteId === folder.id ? 'Tap again to confirm deletion' : 'Delete folder'}
                      >
                        {deletingId === folder.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {confirmDeleteId && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 px-3 py-2">
              <p className="text-[11px] text-red-700 dark:text-red-400">
                Tap the trash icon once more to confirm. This will move the folder and all its files
                to Google Drive trash (recoverable within 30 days).
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] h-6 px-2 mt-1 text-muted-foreground"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InstituteDriveManageDrawer;
