import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Download, Loader2, Users, Filter, CheckCircle2, XCircle,
  AlertCircle, ChevronDown, Layers, Search, Settings2,
  LayoutGrid, ArrowLeft, Clock, Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/api/client';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { userTypesApi, UserType } from '@/api/userTypes.api';
import { CardTemplate, TextElement } from './CardTemplateDesigner';
import JSZip from 'jszip';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface InstituteUser {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  nameWithInitials?: string;
  email?: string;
  imageUrl?: string;
  instituteUserImageUrl?: string;
  dateOfBirth?: string;
  createdAt?: string;
  userIdByInstitute?: string | null;
  instituteCardId?: string | null;
  gender?: string;
  classId?: string;
  className?: string;
}

interface InstituteClass { id: string; name: string; grade?: number; }
interface InstituteSubject { id: string; name: string; }

interface Filters {
  userTypeSlug: string;
  classId: string;
  subjectId: string;
  search: string;
  gender: string;
  isActive: string;
  dobFrom: string;
  dobTo: string;
  joinedFrom: string;
  joinedTo: string;
  limit: number;
}

interface GenResult {
  userId: string;
  userName: string;
  status: 'ok' | 'error';
  error?: string;
}

// ─── Token resolver ────────────────────────────────────────────────────────────

function resolveTokens(content: string, u: InstituteUser): string {
  const parts = (u.name || '').trim().split(/\s+/);
  const firstName = u.firstName || parts[0] || '';
  const lastName = u.lastName || (parts.length > 1 ? parts[parts.length - 1] : '');
  return content
    .replace(/\{firstName\}/g, firstName)
    .replace(/\{lastName\}/g, lastName)
    .replace(/\{fullName\}/g, u.name || '')
    .replace(/\{nameWithInitials\}/g, u.nameWithInitials || u.name || '')
    .replace(/\{userIdByInstitute\}/g, u.userIdByInstitute || '')
    .replace(/\{instituteCardId\}/g, u.instituteCardId || u.userIdByInstitute || '')
    .replace(/\{email\}/g, u.email || '')
    .replace(/\{className\}/g, u.className || '');
}

function resolveFileName(pattern: string, u: InstituteUser, ext: string): string {
  const safe = (s: string) => (s || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const parts = (u.name || '').trim().split(/\s+/);
  const firstName = u.firstName || parts[0] || '';
  const lastName = u.lastName || (parts.length > 1 ? parts[parts.length - 1] : '');
  const result = pattern
    .replace(/\{userId\}/g, safe(u.userIdByInstitute || u.id))
    .replace(/\{instituteCardId\}/g, safe(u.instituteCardId || u.userIdByInstitute || u.id))
    .replace(/\{firstName\}/g, safe(firstName))
    .replace(/\{lastName\}/g, safe(lastName))
    .replace(/\{fullName\}/g, safe(u.name))
    .replace(/\{nameWithInitials\}/g, safe(u.nameWithInitials || u.name))
    .replace(/\{email\}/g, safe(u.email || ''))
    .replace(/\{className\}/g, safe(u.className || ''));
  return `${result || 'file'}.${ext}`;
}

// ─── Image helpers ─────────────────────────────────────────────────────────────

async function toDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) return null;
    const blob = await r.blob();
    return new Promise(res => {
      const fr = new FileReader();
      fr.onloadend = () => res(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function ensureFontLoaded(family: string): Promise<void> {
  await document.fonts.load(`16px '${family}'`).catch(() => {});
}

// ─── Card renderer ─────────────────────────────────────────────────────────────

async function renderCard(
  tpl: CardTemplate,
  user: InstituteUser,
  userImgDataUrl: string | null,
  bgDataUrl: string | null,
  overlayDataUrl: string | null,
): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  const fonts = new Set<string>();
  for (const el of tpl.elements) if (el.type === 'text') fonts.add((el as TextElement).fontFamily);
  await Promise.all([...fonts].map(ensureFontLoaded));

  const W = tpl.cardWidth;
  const H = tpl.cardHeight;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-${W * 3}px;top:0;width:${W}px;height:${H}px;overflow:hidden;-webkit-font-smoothing:antialiased;`;
  document.body.appendChild(host);

  try {
    const bg = document.createElement('div');
    bg.style.cssText = 'position:absolute;inset:0;';
    if (bgDataUrl) {
      bg.style.backgroundImage = `url(${bgDataUrl})`;
      bg.style.backgroundSize = 'cover';
      bg.style.backgroundPosition = 'center';
    } else {
      bg.style.background = 'linear-gradient(135deg,#1a237e,#283593)';
    }
    host.appendChild(bg);

    for (const el of tpl.elements) {
      if (el.type === 'image') {
        const wrap = document.createElement('div');
        wrap.style.cssText = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}%;padding-bottom:${el.height}%;`;
        const inner = document.createElement('div');
        inner.style.cssText = `position:absolute;inset:0;border-radius:${el.shape === 'circle' ? '50%' : '6px'};border:${el.borderWidth}px solid ${el.borderColor};overflow:hidden;background:#aaa;`;
        if (userImgDataUrl) {
          const img = document.createElement('img');
          img.src = userImgDataUrl;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          inner.appendChild(img);
        }
        wrap.appendChild(inner);
        host.appendChild(wrap);
      } else {
        const te = el as TextElement;
        const div = document.createElement('div');
        div.style.cssText = `position:absolute;left:${te.x}%;top:${te.y}%;width:${te.width}%;font-size:${te.fontSize}px;font-family:'${te.fontFamily}',sans-serif;color:${te.color};font-weight:${te.bold ? 'bold' : 'normal'};font-style:${te.italic ? 'italic' : 'normal'};text-align:${te.align};white-space:pre-wrap;line-height:1.3;`;
        div.textContent = resolveTokens(te.content, user);
        host.appendChild(div);
      }
    }

    if (overlayDataUrl) {
      const ov = document.createElement('img');
      ov.src = overlayDataUrl;
      ov.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;';
      host.appendChild(ov);
    }

    await new Promise(r => setTimeout(r, 120));
    return await html2canvas(host, { width: W, height: H, scale: 2, useCORS: true, allowTaint: false, backgroundColor: null, logging: false });
  } finally {
    document.body.removeChild(host);
  }
}

// ─── FILE TYPE OPTIONS ─────────────────────────────────────────────────────────

const FILE_TYPES = [
  { value: 'png', label: 'PNG (lossless)' },
  { value: 'jpg', label: 'JPEG (smaller size)' },
  { value: 'webp', label: 'WebP (best compression)' },
];

const NAMING_TOKENS = ['{userId}', '{firstName}', '{lastName}', '{fullName}', '{nameWithInitials}', '{email}', '{instituteCardId}', '{className}'];

// ─── Component ─────────────────────────────────────────────────────────────────

interface CardTemplateBulkGenerateProps {
  templates: CardTemplate[];
  activeTemplateId: string | null;
  onTemplateSelect: (id: string) => void;
  onBack: () => void;
}

const CardTemplateBulkGenerate: React.FC<CardTemplateBulkGenerateProps> = ({
  templates,
  activeTemplateId,
  onTemplateSelect,
  onBack,
}) => {
  const { toast } = useToast();
  const { currentInstituteId } = useAuth();

  // Bootstrap data (user types + classes only — templates come from parent)
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [classes, setClasses] = useState<InstituteClass[]>([]);
  const [subjects, setSubjects] = useState<InstituteSubject[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);

  // Filters (not auto-applied — user clicks "Fetch Users")
  const [filters, setFilters] = useState<Filters>({
    userTypeSlug: 'STUDENT',
    classId: '',
    subjectId: '',
    search: '',
    gender: '',
    isActive: 'true',
    dobFrom: '',
    dobTo: '',
    joinedFrom: '',
    joinedTo: '',
    limit: 500,
  });
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Users
  const [users, setUsers] = useState<InstituteUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Output settings
  const [fileType, setFileType] = useState<'png' | 'jpg' | 'webp'>('png');
  const [namingPattern, setNamingPattern] = useState('{userId}_{fullName}');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<GenResult[]>([]);
  const abortRef = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const selectedTemplate = templates.find(t => t.id === activeTemplateId) ?? null;

  // ── Bootstrap: user types + classes only ─────────────────────────────────────
  useEffect(() => {
    if (!currentInstituteId) return;
    Promise.all([
      userTypesApi.list(currentInstituteId).catch(() => [] as UserType[]),
      apiClient.get(`/institutes/${currentInstituteId}/classes?limit=200`)
        .then((res: any) => Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [])
        .catch(() => [] as InstituteClass[]),
    ]).then(([uts, cls]) => {
      setUserTypes(uts);
      setClasses(cls);
    }).finally(() => setBootstrapping(false));
  }, [currentInstituteId]);

  // ── Load subjects when class changes ─────────────────────────────────────────
  useEffect(() => {
    if (!filters.classId || !currentInstituteId) { setSubjects([]); return; }
    apiClient.get(`/institutes/${currentInstituteId}/classes/${filters.classId}/subjects?limit=200`)
      .then((res: any) => setSubjects(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []))
      .catch(() => setSubjects([]));
  }, [filters.classId, currentInstituteId]);

  // ── Fetch users (explicit — only on button click) ─────────────────────────────
  const fetchUsers = async () => {
    if (!currentInstituteId || !filters.userTypeSlug) return;
    setLoadingUsers(true);
    setHasFetched(true);
    try {
      const p = new URLSearchParams({ page: '1', limit: String(filters.limit) });
      if (filters.search)    p.set('search', filters.search);
      if (filters.gender)    p.set('gender', filters.gender);
      if (filters.isActive)  p.set('isActive', filters.isActive);
      if (filters.dobFrom)   p.set('dobFrom', filters.dobFrom);
      if (filters.dobTo)     p.set('dobTo', filters.dobTo);
      if (filters.joinedFrom) p.set('joinedFrom', filters.joinedFrom);
      if (filters.joinedTo)   p.set('joinedTo', filters.joinedTo);

      let endpoint: string;
      if (filters.subjectId && filters.classId) {
        endpoint = `/institute-users/institute/${currentInstituteId}/users/${filters.userTypeSlug}/class/${filters.classId}/subject/${filters.subjectId}?${p}`;
      } else if (filters.classId) {
        endpoint = `/institute-users/institute/${currentInstituteId}/users/${filters.userTypeSlug}/class/${filters.classId}?${p}`;
      } else {
        endpoint = `/institute-users/institute/${currentInstituteId}/users/${filters.userTypeSlug}?${p}`;
      }

      const res: any = await apiClient.get(endpoint);
      const raw: any[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

      const data: InstituteUser[] = raw.map(u => ({
        id: String(u.userId || u.id || u.user_id || ''),
        name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        firstName: u.first_name || u.firstName,
        lastName: u.last_name || u.lastName,
        nameWithInitials: u.nameWithInitials || u.name_with_initials,
        email: u.email,
        imageUrl: u.instituteUserImageUrl || u.institute_user_image_url || u.imageUrl || u.image_url || u.user_image_url,
        dateOfBirth: u.dateOfBirth || u.date_of_birth,
        createdAt: u.createdAt || u.created_at,
        userIdByInstitute: u.userIdByInstitute || u.user_id_institue || u.user_id_institute,
        instituteCardId: u.instituteCardId || u.institute_card_id,
        gender: u.gender,
        classId: filters.classId || undefined,
        className: u.className || u.class_name,
      }));

      setUsers(data);
      setTotalUsers(res?.meta?.total ?? data.length);
      setSelectedIds(new Set(data.map(u => u.id)));
      setResults([]);
    } catch {
      toastRef.current({ title: 'Failed to load users', variant: 'destructive' });
    } finally {
      setLoadingUsers(false);
    }
  };

  // ── Selection helpers ────────────────────────────────────────────────────────
  const toggleUser = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelectedIds(selectedIds.size === users.length ? new Set() : new Set(users.map(u => u.id)));

  // ── Generate & ZIP ───────────────────────────────────────────────────────────
  const generate = async () => {
    if (!selectedTemplate) { toastRef.current({ title: 'No template selected', variant: 'destructive' }); return; }
    const targets = users.filter(u => selectedIds.has(u.id));
    if (!targets.length) { toastRef.current({ title: 'No users selected', variant: 'destructive' }); return; }

    setGenerating(true);
    abortRef.current = false;
    setProgress({ done: 0, total: targets.length });
    setResults([]);

    // Pre-fetch template images + all unique user images in parallel (2 API calls total for templates)
    const uniqueImgUrls = [...new Set(targets.map(u => u.imageUrl ? getImageUrl(u.imageUrl) : '').filter(Boolean))];
    const [bgDataUrl, ovDataUrl, ...userImgResults] = await Promise.all([
      selectedTemplate.backgroundImageUrl ? toDataUrl(selectedTemplate.backgroundImageUrl) : Promise.resolve(null),
      selectedTemplate.overlayImageUrl    ? toDataUrl(selectedTemplate.overlayImageUrl)    : Promise.resolve(null),
      ...uniqueImgUrls.map(url => toDataUrl(url)),
    ]);
    const userImgCache = new Map<string, string | null>(
      uniqueImgUrls.map((url, i) => [url, userImgResults[i]])
    );

    const zip = new JSZip();
    const log: GenResult[] = [];
    const mimeMap = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const;

    for (let i = 0; i < targets.length; i++) {
      if (abortRef.current) break;
      const user = targets[i];
      try {
        const rawImg = user.imageUrl ? getImageUrl(user.imageUrl) : '';
        const userImgDataUrl = rawImg ? (userImgCache.get(rawImg) ?? null) : null;
        const canvas = await renderCard(selectedTemplate, user, userImgDataUrl, bgDataUrl, ovDataUrl);
        const blob = await new Promise<Blob>((res, rej) =>
          canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), mimeMap[fileType], fileType === 'jpg' ? 0.92 : undefined)
        );
        const fileName = resolveFileName(namingPattern, user, fileType);
        zip.file(fileName, blob);
        log.push({ userId: user.id, userName: user.name, status: 'ok' });
      } catch (err: any) {
        log.push({ userId: user.id, userName: user.name, status: 'error', error: err?.message });
      }
      setProgress({ done: i + 1, total: targets.length });
      setResults([...log]);
    }

    if (!abortRef.current) {
      try {
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = `${selectedTemplate.name.replace(/\s+/g, '_')}_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
        const ok   = log.filter(r => r.status === 'ok').length;
        const fail = log.filter(r => r.status === 'error').length;
        toastRef.current({ title: `${ok} files generated`, description: fail ? `${fail} failed` : 'ZIP downloaded.', variant: fail ? 'destructive' : 'default' });
      } catch {
        toastRef.current({ title: 'ZIP failed', variant: 'destructive' });
      }
    }
    setGenerating(false);
    setProgress(null);
  };

  // ─── UI ───────────────────────────────────────────────────────────────────────

  if (bootstrapping) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin" />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  // ── LIST VIEW — pick a template ───────────────────────────────────────────
  if (!activeTemplateId || !selectedTemplate) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold text-base">Select a Template</span>
          <Badge variant="secondary">{templates.length}</Badge>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            <Layers className="h-12 w-12 mx-auto mb-3 opacity-25" />
            <p className="font-medium">No templates yet</p>
            <p className="text-sm mt-1">Go to <strong>Template Designer</strong> to create one first.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(t => (
              <div key={t.id}
                className="group relative rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                onClick={() => onTemplateSelect(t.id)}>
                {/* Preview thumbnail */}
                <div className="relative overflow-hidden bg-muted/40" style={{ paddingBottom: `${(t.cardHeight / t.cardWidth) * 100}%` }}>
                  <div className="absolute inset-0" style={{
                    background: t.backgroundImageUrl
                      ? `url(${t.backgroundImageUrl}) center/cover no-repeat`
                      : 'linear-gradient(135deg,#1a237e,#283593)',
                  }}>
                    {t.elements.map(el => {
                      if (el.type === 'text') return (
                        <div key={el.id} style={{
                          position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`,
                          fontSize: `${el.fontSize * 0.35}px`, fontFamily: `'${el.fontFamily}',sans-serif`,
                          color: el.color, fontWeight: el.bold ? 'bold' : 'normal',
                          fontStyle: el.italic ? 'italic' : 'normal', textAlign: el.align,
                          whiteSpace: 'pre-wrap', lineHeight: 1.3, pointerEvents: 'none',
                        }}>
                          {el.content.replace(/\{[^}]+\}/g, '···')}
                        </div>
                      );
                      return (
                        <div key={el.id} style={{
                          position: 'absolute', left: `${el.x}%`, top: `${el.y}%`,
                          width: `${el.width}%`, paddingBottom: `${el.height}%`, pointerEvents: 'none',
                        }}>
                          <div style={{
                            position: 'absolute', inset: 0, background: '#aaa', opacity: 0.5,
                            borderRadius: el.shape === 'circle' ? '50%' : '6px',
                            border: `${el.borderWidth}px solid ${el.borderColor}`,
                          }} />
                        </div>
                      );
                    })}
                    {t.overlayImageUrl && (
                      <img src={t.overlayImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 10 }} />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ zIndex: 20 }}>
                    <span className="flex items-center gap-1.5 text-white text-sm font-medium bg-black/30 px-3 py-1.5 rounded-lg">
                      <Zap className="h-4 w-4" />Generate
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <p className="font-medium text-sm truncate">{t.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{t.cardWidth}×{t.cardHeight}px</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{t.elements.length} element{t.elements.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Updated {new Date(t.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── GENERATE VIEW ─────────────────────────────────────────────────────────
  const okCount   = results.filter(r => r.status === 'ok').length;
  const failCount = results.filter(r => r.status === 'error').length;

  return (
    <div className="space-y-4">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />Templates
        </button>
        <span className="text-muted-foreground">/</span>
        <div className="flex items-center gap-2">
          <div className="rounded border overflow-hidden shrink-0 relative" style={{ width: 40, height: 25 }}>
            <div style={{ position: 'absolute', inset: 0, background: selectedTemplate.backgroundImageUrl ? `url(${selectedTemplate.backgroundImageUrl}) center/cover` : 'linear-gradient(135deg,#1a237e,#283593)' }} />
            {selectedTemplate.overlayImageUrl && <img src={selectedTemplate.overlayImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          </div>
          <span className="text-sm font-medium truncate max-w-[200px]">{selectedTemplate.name}</span>
        </div>
      </div>

      {/* ── Step 2: Filters ──────────────────────────────────────────────────── */}
      <Card>
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 px-4 cursor-pointer select-none">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4" />Filters
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">

                {/* User Type */}
                <div className="space-y-1">
                  <Label className="text-xs">User Type *</Label>
                  <Select value={filters.userTypeSlug} onValueChange={v => setFilters(f => ({ ...f, userTypeSlug: v, classId: '', subjectId: '' }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STUDENT">Students</SelectItem>
                      <SelectItem value="TEACHER">Teachers</SelectItem>
                      <SelectItem value="ATTENDANCE_MARKER">Attendance Markers</SelectItem>
                      <SelectItem value="INSTITUTE_ADMIN">Admins</SelectItem>
                      {userTypes.filter(ut => !['STUDENT','TEACHER','ATTENDANCE_MARKER','INSTITUTE_ADMIN','PARENT'].includes(ut.slug.toUpperCase())).map(ut => (
                        <SelectItem key={ut.id} value={ut.slug.toUpperCase()}>{ut.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Class */}
                <div className="space-y-1">
                  <Label className="text-xs">Class (optional)</Label>
                  <Select value={filters.classId || '__all__'} onValueChange={v => setFilters(f => ({ ...f, classId: v === '__all__' ? '' : v, subjectId: '' }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All classes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All classes</SelectItem>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subject */}
                {filters.classId && subjects.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">Subject (optional)</Label>
                    <Select value={filters.subjectId || '__all__'} onValueChange={v => setFilters(f => ({ ...f, subjectId: v === '__all__' ? '' : v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All subjects" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All subjects</SelectItem>
                        {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Search */}
                <div className="space-y-1">
                  <Label className="text-xs">Search name / email</Label>
                  <Input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Search…" className="h-8 text-sm" />
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <Label className="text-xs">Gender</Label>
                  <Select value={filters.gender || '__all__'} onValueChange={v => setFilters(f => ({ ...f, gender: v === '__all__' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={filters.isActive || '__all__'} onValueChange={v => setFilters(f => ({ ...f, isActive: v === '__all__' ? '' : v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* DOB range */}
                <div className="space-y-1">
                  <Label className="text-xs">Date of Birth — from</Label>
                  <Input type="date" value={filters.dobFrom} onChange={e => setFilters(f => ({ ...f, dobFrom: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date of Birth — to</Label>
                  <Input type="date" value={filters.dobTo} onChange={e => setFilters(f => ({ ...f, dobTo: e.target.value }))} className="h-8 text-sm" />
                </div>

                {/* Joined range */}
                <div className="space-y-1">
                  <Label className="text-xs">Joined — from</Label>
                  <Input type="date" value={filters.joinedFrom} onChange={e => setFilters(f => ({ ...f, joinedFrom: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Joined — to</Label>
                  <Input type="date" value={filters.joinedTo} onChange={e => setFilters(f => ({ ...f, joinedTo: e.target.value }))} className="h-8 text-sm" />
                </div>

                {/* Limit */}
                <div className="space-y-1">
                  <Label className="text-xs">Max records</Label>
                  <Select value={String(filters.limit)} onValueChange={v => setFilters(f => ({ ...f, limit: +v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[50, 100, 200, 500, 1000, 2000].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

              </div>

              <Button onClick={fetchUsers} disabled={loadingUsers || !filters.userTypeSlug} className="mt-4 gap-2" size="sm">
                {loadingUsers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Fetch Users
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* ── Step 3: User list ────────────────────────────────────────────────── */}
      {loadingUsers ? (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin" />Fetching users…
        </div>
      ) : hasFetched && (
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />Users</CardTitle>
              <Badge variant="secondary">
                {totalUsers > users.length ? `${users.length} loaded / ${totalUsers} total` : `${users.length} users`}
              </Badge>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={toggleAll} className="text-xs text-primary underline underline-offset-2">
                  {selectedIds.size === users.length ? 'Deselect all' : 'Select all'}
                </button>
                <Badge variant="outline">{selectedIds.size} selected</Badge>
              </div>
            </div>
          </CardHeader>
          {users.length === 0 ? (
            <CardContent className="px-4 pb-4 text-center text-sm text-muted-foreground py-6">No users found for these filters.</CardContent>
          ) : (
            <CardContent className="px-4 pb-4">
              <div className="max-h-72 overflow-y-auto rounded-lg border divide-y divide-border/60">
                {users.map(user => {
                  const sel    = selectedIds.has(user.id);
                  const result = results.find(r => r.userId === user.id);
                  return (
                    <div key={user.id} onClick={() => toggleUser(user.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer select-none transition-colors ${sel ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                      <input type="checkbox" checked={sel} readOnly className="shrink-0 pointer-events-none" />
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={getImageUrl(user.imageUrl || '')} />
                        <AvatarFallback className="text-xs bg-muted">{(user.name || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">{user.nameWithInitials || user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user.userIdByInstitute && <span className="mr-1">#{user.userIdByInstitute} ·</span>}
                          {user.email}
                        </p>
                      </div>
                      {result && (result.status === 'ok'
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        : <XCircle className="h-4 w-4 text-destructive shrink-0" title={result.error} />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Step 4: Output settings + Generate ───────────────────────────────── */}
      <Card>
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="py-3 px-4 cursor-pointer select-none">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4" />Output Settings
                <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4 space-y-4">

              {/* File type */}
              <div className="space-y-1">
                <Label className="text-xs">File Type</Label>
                <Select value={fileType} onValueChange={v => setFileType(v as any)}>
                  <SelectTrigger className="h-8 text-sm w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FILE_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Naming pattern */}
              <div className="space-y-1">
                <Label className="text-xs">File Naming Pattern</Label>
                <Input
                  value={namingPattern}
                  onChange={e => setNamingPattern(e.target.value)}
                  placeholder="{userId}_{fullName}"
                  className="h-8 text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Preview: <span className="font-mono text-foreground">{namingPattern || 'file'}.{fileType}</span>
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {NAMING_TOKENS.map(t => (
                    <button key={t} onClick={() => setNamingPattern(p => p + t)}
                      className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/70 font-mono border border-border/60 transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>

        <CardContent className="px-4 pb-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button size="lg" onClick={generate} disabled={generating || !selectedTemplate || selectedIds.size === 0} className="gap-2">
              {generating
                ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</>
                : <><Download className="h-4 w-4" />Generate & Download ZIP</>}
            </Button>
            {generating && (
              <Button variant="outline" size="sm" onClick={() => { abortRef.current = true; }}>Cancel</Button>
            )}
            {!generating && selectedTemplate && selectedIds.size > 0 && (
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{selectedIds.size}</span> {fileType.toUpperCase()} files · <span className="font-medium text-foreground">{selectedTemplate.name}</span>
              </span>
            )}
          </div>

          {/* Progress */}
          {progress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Rendering…</span>
                <span>{progress.done} / {progress.total}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-200"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
              </div>
              {results.length > 0 && (
                <div className="max-h-24 overflow-y-auto space-y-0.5 mt-1">
                  {[...results].reverse().slice(0, 5).map(r => (
                    <div key={r.userId} className="flex items-center gap-1.5 text-xs">
                      {r.status === 'ok'
                        ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                        : <XCircle className="h-3 w-3 text-destructive shrink-0" />}
                      <span className="truncate text-muted-foreground">{r.userName}</span>
                      {r.error && <span className="text-destructive/70">— {r.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {results.length > 0 && !generating && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm">
                {okCount > 0 && <span className="flex items-center gap-1.5 text-green-600 font-medium"><CheckCircle2 className="h-4 w-4" />{okCount} generated</span>}
                {failCount > 0 && <span className="flex items-center gap-1.5 text-destructive font-medium"><XCircle className="h-4 w-4" />{failCount} failed</span>}
              </div>
              {failCount > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="text-xs font-semibold text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />Failed:</p>
                  {results.filter(r => r.status === 'error').map(r => (
                    <p key={r.userId} className="text-xs text-muted-foreground">{r.userName} — {r.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};

export default CardTemplateBulkGenerate;
