import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  instituteApiKeysApi,
  type InstituteApiKey,
  type ApiKeyScope,
} from '@/api/instituteApiKeys.api';
import {
  Key, Plus, Trash2, Loader2, Copy, CheckCircle, AlertTriangle, Clock, Shield,
} from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';

const SCOPE_LABELS: Record<ApiKeyScope, string> = {
  ATTENDANCE_MARK: 'Attendance Marking',
  STUDENT_CREATE: 'Create Students',
  CLASS_READ: 'Read Classes & Sessions',
  SESSION_CREATE: 'Create Attendance Sessions',
};

const SCOPE_DESCRIPTIONS: Record<ApiKeyScope, string> = {
  ATTENDANCE_MARK: 'Mark attendance (present/absent/late) for students in bulk.',
  STUDENT_CREATE: 'Register new students into the institute via the external API.',
  CLASS_READ: 'List institute classes and their attendance sessions (read-only).',
  SESSION_CREATE: 'Create new attendance sessions for a class.',
};

const ALL_SCOPES: ApiKeyScope[] = ['ATTENDANCE_MARK', 'STUDENT_CREATE', 'CLASS_READ', 'SESSION_CREATE'];

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

interface Props {
  instituteId: string;
  isAdmin: boolean;
}

export const ApiKeysManager: React.FC<Props> = ({ instituteId, isAdmin }) => {
  const { toast } = useToast();
  const [keys, setKeys] = useState<InstituteApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['ATTENDANCE_MARK']);
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);

  // Reveal dialog (shown once after creation)
  const [revealOpen, setRevealOpen] = useState(false);
  const [rawKey, setRawKey] = useState('');
  const [copied, setCopied] = useState(false);

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<InstituteApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await instituteApiKeysApi.list(instituteId);
      setKeys(data);
    } catch (e) {
      toast({ title: 'Failed to load API keys', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [instituteId, toast]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim() || scopes.length === 0) return;
    setCreating(true);
    try {
      const res = await instituteApiKeysApi.create(instituteId, {
        name: name.trim(),
        scopes,
        expiresAt: expiresAt || undefined,
      });
      const { key, warning: _w, ...apiKey } = res;
      setKeys(prev => [...prev, { ...apiKey, lastUsedAt: null }]);
      setRawKey(key);
      setCreateOpen(false);
      setRevealOpen(true);
      setName('');
      setScopes(['ATTENDANCE_MARK']);
      setExpiresAt('');
    } catch (e) {
      toast({ title: 'Failed to create API key', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await instituteApiKeysApi.revoke(instituteId, revokeTarget.id);
      setKeys(prev => prev.map(k => k.id === revokeTarget.id ? { ...k, isActive: false } : k));
      toast({ title: 'API key revoked' });
      setRevokeTarget(null);
    } catch (e) {
      toast({ title: 'Failed to revoke key', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setRevoking(false);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Could not copy — please select and copy manually', variant: 'destructive' });
    }
  };

  const toggleScope = (scope: ApiKeyScope) => {
    setScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Generate API keys for external systems to mark attendance, create students, or manage classes & sessions via the REST API.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New API Key
          </Button>
        )}
      </div>

      {/* Key list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            Active Keys
          </CardTitle>
          <CardDescription>
            Keys are shown as a prefix only. The full key is displayed once at creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No API keys yet</p>
              {isAdmin && (
                <p className="text-xs mt-1">Click "New API Key" to generate one.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map(k => (
                <div
                  key={k.id}
                  className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 ${
                    !k.isActive || isExpired(k.expiresAt) ? 'opacity-60 bg-muted/30' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{k.name}</span>
                      {!k.isActive && <Badge variant="destructive" className="text-xs">Revoked</Badge>}
                      {k.isActive && isExpired(k.expiresAt) && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Expired</Badge>
                      )}
                      {k.isActive && !isExpired(k.expiresAt) && (
                        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-400">Active</Badge>
                      )}
                    </div>
                    <p className="text-xs font-mono text-muted-foreground">{k.keyPrefix}...</p>
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.map(s => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {SCOPE_LABELS[s] ?? s}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground mt-1">
                      <span>Created: {formatDate(k.createdAt)}</span>
                      {k.lastUsedAt && <span>Last used: {formatDate(k.lastUsedAt)}</span>}
                      {k.expiresAt && <span>Expires: {formatDate(k.expiresAt)}</span>}
                    </div>
                  </div>
                  {isAdmin && k.isActive && !isExpired(k.expiresAt) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => setRevokeTarget(k)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            How to use
          </CardTitle>
          <CardDescription>
            Send the API key in the <code className="bg-muted px-1 rounded text-xs">Authorization</code> header on every request. Each endpoint below requires the matching scope.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">Attendance Marking — requires <code className="bg-muted px-1 rounded">ATTENDANCE_MARK</code></p>
            <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
{`POST /api/external/v1/attendance/sessions/{sessionId}/mark-bulk
Authorization: Bearer sk_<your-key>
Content-Type: application/json

{
  "records": [
    { "studentId": "abc123", "status": 1 },
    { "studentId": "def456", "status": 2, "remarks": "Late arrival" }
  ]
}`}
            </pre>
            <p className="text-xs">Status codes: <code className="bg-muted px-1 rounded text-xs">0</code>=Absent&nbsp; <code className="bg-muted px-1 rounded text-xs">1</code>=Present&nbsp; <code className="bg-muted px-1 rounded text-xs">2</code>=Late&nbsp; <code className="bg-muted px-1 rounded text-xs">3</code>=Left&nbsp; <code className="bg-muted px-1 rounded text-xs">4</code>=Left Early&nbsp; <code className="bg-muted px-1 rounded text-xs">5</code>=Left Late</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">Create Students — requires <code className="bg-muted px-1 rounded">STUDENT_CREATE</code></p>
            <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
{`POST /api/external/v1/students/bulk
Authorization: Bearer sk_<your-key>
Content-Type: application/json

{
  "students": [
    { "firstName": "Jane", "lastName": "Doe", "phoneNumber": "0771234567" }
  ]
}`}
            </pre>
            <p className="text-xs">Matches existing users by <code className="bg-muted px-1 rounded text-xs">userId</code> or phone and links them; otherwise creates a new student.</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">Read Classes &amp; Sessions — requires <code className="bg-muted px-1 rounded">CLASS_READ</code></p>
            <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
{`GET /api/external/v1/classes
GET /api/external/v1/classes/{classId}/sessions
Authorization: Bearer sk_<your-key>`}
            </pre>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">Create Attendance Sessions — requires <code className="bg-muted px-1 rounded">SESSION_CREATE</code></p>
            <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
{`POST /api/external/v1/classes/{classId}/sessions
Authorization: Bearer sk_<your-key>
Content-Type: application/json

{ "name": "Morning Session", "date": "2026-06-16" }`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen} routeName="create-api-key-popup">
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="keyName">Key name</Label>
              <Input
                id="keyName"
                placeholder="e.g. Attendance Device #1"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Permissions (scopes)</Label>
              <p className="text-xs text-muted-foreground">Grant only what this system needs — least privilege.</p>
              <div className="space-y-2.5">
                {ALL_SCOPES.map(s => (
                  <label key={s} className="flex items-start gap-2 cursor-pointer rounded-lg border px-3 py-2 hover:bg-muted/40">
                    <Checkbox
                      checked={scopes.includes(s)}
                      onCheckedChange={() => toggleScope(s)}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium block">{SCOPE_LABELS[s]}</span>
                      <span className="text-xs text-muted-foreground">{SCOPE_DESCRIPTIONS[s]}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expiresAt">Expiry date (optional)</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave blank for no expiry.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !name.trim() || scopes.length === 0}
            >
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
              Generate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal dialog — shown once after key creation */}
      <Dialog open={revealOpen} onOpenChange={open => { if (!open) { setRevealOpen(false); setRawKey(''); } }} routeName="reveal-api-key-popup">
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              API Key Created
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Copy this key now. It will <strong>not</strong> be shown again.</span>
            </div>
            <div className="flex gap-2">
              <code className="flex-1 block rounded-lg bg-muted px-3 py-2 text-xs font-mono break-all select-all">
                {rawKey}
              </code>
              <Button size="sm" variant="outline" onClick={copyKey} className="shrink-0">
                {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setRevealOpen(false); setRawKey(''); }}>
              I've copied it — close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={open => { if (!open) setRevokeTarget(null); }} routeName="revoke-api-key-popup">
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Revoke <strong>{revokeTarget?.name}</strong>? Any system using this key will immediately lose access and cannot be recovered.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
