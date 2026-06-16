import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  LayoutGrid, ArrowLeft, Clock, Zap, CreditCard, FileImage, FileText,
  Upload, Hash, ListFilter,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { userTypesApi, UserType } from '@/api/userTypes.api';
import { apiClient } from '@/api/client';
import { CardTemplate, TextElement } from './CardTemplateDesigner';
import { instituteDesignsApi, DesignTemplate, DesignOutputType } from '@/api/instituteDesigns.api';
import CardPdfLayoutPage from './CardPdfLayoutPage';
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

// ─── UUID helper (truncated standard UUID, 15-23 chars) ─────────────────────────

function makeTruncatedUuid(length: number): string {
  const raw = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`)
    .replace(/-/g, '');
  const len = Math.min(23, Math.max(15, length || 18));
  return raw.slice(0, len);
}

// ─── QR value resolver ──────────────────────────────────────────────────────────
// Resolves the string a QR should encode for a given user.
// Returns { value, uuid? } — uuid is set whenever a fresh id was generated
// (uuid mode, or url-pattern containing {uuid}) so it can be written to the CSV.
function resolveQrValue(
  el: { valueMode: 'token' | 'url' | 'uuid'; token: string; pattern: string; uuidLength: number },
  u: InstituteUser,
): { value: string; uuid?: string } {
  if (el.valueMode === 'token') {
    return { value: resolveTokens(el.token, u) };
  }
  if (el.valueMode === 'uuid') {
    const uuid = makeTruncatedUuid(el.uuidLength);
    return { value: uuid, uuid };
  }
  // url mode
  let uuid: string | undefined;
  let pattern = el.pattern || '';
  if (pattern.includes('{uuid}')) {
    uuid = makeTruncatedUuid(el.uuidLength);
    pattern = pattern.replace(/\{uuid\}/g, uuid);
  }
  return { value: resolveTokens(pattern, u), uuid };
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

// ─── CSV builder for generated UUIDs ────────────────────────────────────────────
function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function buildUuidCsv(
  uuidQrEls: any[],
  rows: { user: InstituteUser; uuids: Record<string, string> }[],
): string {
  // One column per uuid-generating QR element. If multiple, label them QR 1, QR 2…
  const single = uuidQrEls.length === 1;
  const header = ['User ID', 'Institute User ID', 'Card ID', 'Name', 'Email',
    ...uuidQrEls.map((el, i) => single ? 'Generated UUID' : `Generated UUID (QR ${i + 1})`)];
  const lines = [header.map(csvEscape).join(',')];
  for (const { user, uuids } of rows) {
    const cells = [
      user.id,
      user.userIdByInstitute || '',
      user.instituteCardId || '',
      user.name || '',
      user.email || '',
      ...uuidQrEls.map(el => uuids[el.id] || ''),
    ];
    lines.push(cells.map(c => csvEscape(String(c))).join(','));
  }
  return lines.join('\r\n');
}

// ─── ID import helpers ─────────────────────────────────────────────────────────

/** Parse a plain CSV/TSV text into rows of string arrays. Handles quoted fields. */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ',' || ch === '\t') { cells.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

/** Read a File as text, auto-detect encoding. Returns { headers, rows }. */
async function readSpreadsheetFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const text = await file.text();
  const all = parseCsvText(text);
  if (all.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = all;
  return { headers, rows };
}

/** Extract IDs from a spreadsheet column by column name. */
function extractColumnIds(headers: string[], rows: string[][], colName: string): string[] {
  const idx = headers.findIndex(h => h.trim().toLowerCase() === colName.trim().toLowerCase());
  if (idx === -1) return [];
  return rows.map(r => (r[idx] ?? '').trim()).filter(Boolean);
}

/** Parse a freeform text of IDs (newline or comma separated). */
function parseManualIds(text: string): string[] {
  return text.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
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
): Promise<{ canvas: HTMLCanvasElement; qrValues: Record<string, string> }> {
  const { default: html2canvas } = await import('html2canvas');
  const fonts = new Set<string>();
  for (const el of tpl.elements) if (el.type === 'text') fonts.add((el as TextElement).fontFamily);
  await Promise.all([...fonts].map(ensureFontLoaded));

  // Pre-generate QR data URLs (qrcode is async) before building the DOM.
  const QRmod: any = await import('qrcode');
  const QR = QRmod.default ?? QRmod;
  const qrDataUrls: Record<string, string> = {};
  const qrValues: Record<string, string> = {}; // elementId → generated uuid (for CSV)
  for (const el of tpl.elements as any[]) {
    if (el.type === 'qr') {
      const { value, uuid } = resolveQrValue(el, user);
      if (uuid) qrValues[el.id] = uuid;
      try {
        qrDataUrls[el.id] = await QR.toDataURL(value || ' ', {
          margin: el.margin ?? 1,
          color: { dark: el.fgColor || '#000000', light: el.bgColor || '#ffffff' },
          width: 600,
          errorCorrectionLevel: 'M',
        });
      } catch { qrDataUrls[el.id] = ''; }
    }
  }

  const W = tpl.cardWidth;
  const H = tpl.cardHeight;
  const radius = (tpl as any).cardBorderRadius ?? 0;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-${W * 3}px;top:0;width:${W}px;height:${H}px;overflow:hidden;-webkit-font-smoothing:antialiased;${radius ? `border-radius:${radius}px;` : ''}`;
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

    for (const el of tpl.elements as any[]) {
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
      } else if (el.type === 'qr') {
        const wrap = document.createElement('div');
        wrap.style.cssText = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.size}%;padding-bottom:${el.size}%;`;
        if (qrDataUrls[el.id]) {
          const img = document.createElement('img');
          img.src = qrDataUrls[el.id];
          img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;';
          wrap.appendChild(img);
        }
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
    const canvas = await html2canvas(host, { width: W, height: H, scale: 2, useCORS: true, allowTaint: false, backgroundColor: null, logging: false });
    return { canvas, qrValues };
  } finally {
    document.body.removeChild(host);
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const FILE_TYPES = [
  { value: 'png', label: 'PNG (lossless)' },
  { value: 'jpg', label: 'JPEG (smaller)' },
  { value: 'webp', label: 'WebP (best compression)' },
];

const NAMING_TOKENS = ['{userId}', '{firstName}', '{lastName}', '{fullName}', '{nameWithInitials}', '{email}', '{instituteCardId}', '{className}'];

// ─── Component ─────────────────────────────────────────────────────────────────

interface CardTemplateBulkGenerateProps {
  templates?: CardTemplate[];
  /** Raw API templates — carry status + allowed output flags + costs */
  apiTemplates?: DesignTemplate[];
  activeTemplateId?: string | null;
  onTemplateSelect?: (id: string) => void;
  onBack?: () => void;
}

type GenStep = 'filters' | 'preflight' | 'generating' | 'done';

const CardTemplateBulkGenerate: React.FC<CardTemplateBulkGenerateProps> = ({
  templates = [],
  apiTemplates = [],
  activeTemplateId,
  onTemplateSelect,
  onBack,
}) => {
  const { toast } = useToast();
  const { currentInstituteId } = useAuth();

  // Bootstrap
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [classes, setClasses] = useState<InstituteClass[]>([]);
  const [subjects, setSubjects] = useState<InstituteSubject[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);

  // Filters
  const [filters, setFilters] = useState<Filters>({
    userTypeSlug: 'STUDENT', classId: '', subjectId: '', search: '',
    gender: '', isActive: 'true', dobFrom: '', dobTo: '',
    joinedFrom: '', joinedTo: '', limit: 500,
  });
  const [filtersOpen, setFiltersOpen] = useState(true);

  // ID filter mode
  const [filterMode, setFilterMode] = useState<'criteria' | 'ids' | 'count'>('criteria');
  const [manualIdText, setManualIdText] = useState('');
  // Count-only mode (no real users — e.g. a batch of blank unique-QR cards)
  const [batchCount, setBatchCount] = useState(100);
  const [batchLabel, setBatchLabel] = useState('Card');
  // CSV/Excel import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<string[][]>([]);
  const [importColName, setImportColName] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const importFileRef = useRef<HTMLInputElement>(null);

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
  const [outputType, setOutputType] = useState<DesignOutputType>('PNG');

  // PDF layout page
  const [showPdfLayout, setShowPdfLayout] = useState(false);

  // Pre-flight / billing
  const [step, setStep] = useState<GenStep>('filters');
  const [preflight, setPreflight] = useState<{
    userCount: number; unitCost: number; totalCost: number; balance: number; sufficient: boolean;
  } | null>(null);
  const [loadingPreflight, setLoadingPreflight] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<GenResult[]>([]);
  const abortRef = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const selectedTemplate = templates.find(t => t.id === activeTemplateId) ?? null;
  const selectedApiTpl = apiTemplates.find(t => t.id === activeTemplateId) ?? null;

  // Allowed output types for this template
  const allowedOutputs = selectedApiTpl
    ? ([
        selectedApiTpl.allowPng      && 'PNG',
        selectedApiTpl.allowPdf      && 'PDF',
        selectedApiTpl.allowWhatsapp && 'WHATSAPP',
        selectedApiTpl.allowPrint    && 'PRINT',
      ] as (DesignOutputType | false)[]).filter((x): x is DesignOutputType => !!x)
    : [];

  // Set initial outputType to first allowed when template changes
  useEffect(() => {
    if (allowedOutputs.length > 0 && !allowedOutputs.includes(outputType)) {
      setOutputType(allowedOutputs[0]);
    }
  }, [activeTemplateId]);

  // ── Bootstrap ───────────────────────────────────────────────────────────────
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

  // ── Load subjects when class changes ──────────────────────────────────────
  useEffect(() => {
    if (!filters.classId || !currentInstituteId) { setSubjects([]); return; }
    apiClient.get(`/institutes/${currentInstituteId}/classes/${filters.classId}/subjects?limit=200`)
      .then((res: any) => setSubjects(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []))
      .catch(() => setSubjects([]));
  }, [filters.classId, currentInstituteId]);

  // ── Fetch users ────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    if (!currentInstituteId || !filters.userTypeSlug) return;
    setLoadingUsers(true);
    setHasFetched(true);
    setStep('filters');
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

  // ── Fetch users by explicit ID list ───────────────────────────────────────
  const fetchUsersByIds = async (ids: string[]) => {
    if (!currentInstituteId || ids.length === 0) return;
    setLoadingUsers(true);
    setHasFetched(true);
    setStep('filters');
    setResults([]);
    try {
      // Fetch all users (up to 2000) for the institute, then filter to those
      // matching the provided IDs. We try userIdByInstitute first, fall back to userId.
      const p = new URLSearchParams({ page: '1', limit: '2000', isActive: '' });
      const endpoint = `/institute-users/institute/${currentInstituteId}/users/${filters.userTypeSlug}?${p}`;
      const res: any = await apiClient.get(endpoint);
      const raw: any[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      const all: InstituteUser[] = raw.map(u => ({
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
        classId: undefined,
        className: u.className || u.class_name,
      }));

      // Build lookup by both system ID and institute-assigned ID for flexible matching
      const bySystemId = new Map(all.map(u => [u.id, u]));
      const byInstId   = new Map(all.map(u => [u.userIdByInstitute ?? '', u]).filter(([k]) => k));

      const normalised = ids.map(id => id.trim()).filter(Boolean);
      const matched: InstituteUser[] = [];
      const notFound: string[] = [];
      for (const id of normalised) {
        const u = bySystemId.get(id) ?? byInstId.get(id);
        if (u && !matched.find(m => m.id === u.id)) matched.push(u);
        else if (!u) notFound.push(id);
      }

      setUsers(matched);
      setTotalUsers(matched.length);
      setSelectedIds(new Set(matched.map(u => u.id)));

      if (notFound.length > 0) {
        toastRef.current({
          title: `${notFound.length} ID(s) not found`,
          description: notFound.slice(0, 5).join(', ') + (notFound.length > 5 ? ` …+${notFound.length - 5}` : ''),
          variant: 'destructive',
        });
      }
      if (matched.length > 0) {
        toastRef.current({ title: `${matched.length} user(s) matched`, variant: 'default' });
      }
    } catch {
      toastRef.current({ title: 'Failed to load users', variant: 'destructive' });
    } finally {
      setLoadingUsers(false);
    }
  };

  // ── Count-only mode: synthesize N placeholder "users" ─────────────────────
  // No real student/teacher is bound to these — used for pre-printing a batch
  // of unique-QR cards (e.g. 400 blank visitor passes) to assign to people later.
  // Each gets a synthetic ID so the existing preview/commit/render pipeline
  // (which is keyed on userIds) works completely unchanged.
  const generateBatchPlaceholders = () => {
    const count = Math.max(1, Math.min(5000, Math.floor(batchCount) || 0));
    const batchTag = `BATCH-${Date.now().toString(36)}`;
    const label = batchLabel.trim() || 'Card';
    const placeholders: InstituteUser[] = Array.from({ length: count }, (_, i) => {
      const seq = String(i + 1).padStart(String(count).length, '0');
      const id = `${batchTag}-${seq}`;
      return {
        id,
        name: `${label} ${seq}`,
        firstName: label,
        lastName: seq,
        userIdByInstitute: seq,
        instituteCardId: id,
      };
    });
    setUsers(placeholders);
    setTotalUsers(placeholders.length);
    setSelectedIds(new Set(placeholders.map(u => u.id)));
    setHasFetched(true);
    setStep('filters');
    setResults([]);
    toastRef.current({ title: `${placeholders.length} placeholder card(s) ready`, description: 'No real users are linked — each card just gets a unique QR/ID.' });
  };

  // ── CSV/Excel file import ──────────────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = '';
    try {
      const { headers, rows } = await readSpreadsheetFile(file);
      if (headers.length === 0) {
        toastRef.current({ title: 'File is empty or unreadable', variant: 'destructive' });
        return;
      }
      setImportHeaders(headers);
      setImportRows(rows);
      setImportColName(headers[0]);
      setImportFileName(file.name);
      setImportDialogOpen(true);
    } catch {
      toastRef.current({ title: 'Failed to read file', variant: 'destructive' });
    }
  };

  const handleImportConfirm = () => {
    const ids = extractColumnIds(importHeaders, importRows, importColName);
    if (ids.length === 0) {
      toastRef.current({ title: `Column "${importColName}" has no values`, variant: 'destructive' });
      return;
    }
    const text = ids.join('\n');
    setManualIdText(prev => prev ? prev + '\n' + text : text);
    setImportDialogOpen(false);
    toastRef.current({ title: `Imported ${ids.length} IDs from "${importColName}"` });
  };

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleUser = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelectedIds(selectedIds.size === users.length ? new Set() : new Set(users.map(u => u.id)));

  // ── Pre-flight: fetch cost preview ────────────────────────────────────────
  const runPreflight = async () => {
    if (!currentInstituteId || !activeTemplateId || selectedIds.size === 0) return;
    // PDF: delegate entirely to CardPdfLayoutPage which handles its own billing
    // PDF and PRINT both use the multi-card layout page (PRINT = print-ready PDF)
    if (outputType === 'PDF' || outputType === 'PRINT') { setShowPdfLayout(true); return; }
    setLoadingPreflight(true);
    try {
      const userIds = [...selectedIds];
      const result = await instituteDesignsApi.previewCost(
        currentInstituteId, activeTemplateId, outputType, userIds,
      );
      setPreflight(result);
      setStep('preflight');
    } catch (err: any) {
      toastRef.current({
        title: 'Could not fetch cost preview',
        description: err?.response?.data?.message ?? err?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoadingPreflight(false);
    }
  };

  // ── Commit generation (debit) + render ───────────────────────────────────
  const generate = async () => {
    if (!currentInstituteId || !selectedTemplate || !activeTemplateId) return;
    const targets = users.filter(u => selectedIds.has(u.id));
    if (!targets.length) return;

    // 1. Commit (debits credits, returns record + definition)
    let commitResult: { recordId: string; definition: Record<string, any> };
    try {
      commitResult = await instituteDesignsApi.commitGeneration(
        currentInstituteId, activeTemplateId, outputType, targets.map(u => u.id),
      );
    } catch (err: any) {
      toastRef.current({
        title: 'Generation failed — credits not deducted',
        description: err?.response?.data?.message ?? err?.message,
        variant: 'destructive',
      });
      setStep('filters');
      return;
    }
    setRecordId(commitResult.recordId);

    // 2. Render client-side
    setGenerating(true);
    setStep('generating');
    abortRef.current = false;
    setProgress({ done: 0, total: targets.length });
    setResults([]);

    // Use definition from server (the approved snapshot)
    const tplFromServer = { ...selectedTemplate, ...commitResult.definition } as CardTemplate;
    const uniqueImgUrls = [...new Set(targets.map(u => u.imageUrl ? getImageUrl(u.imageUrl) : '').filter(Boolean))];
    const [bgDataUrl, ovDataUrl, ...userImgResults] = await Promise.all([
      tplFromServer.backgroundImageUrl ? toDataUrl(tplFromServer.backgroundImageUrl) : Promise.resolve(null),
      tplFromServer.overlayImageUrl    ? toDataUrl(tplFromServer.overlayImageUrl)    : Promise.resolve(null),
      ...uniqueImgUrls.map(url => toDataUrl(url)),
    ]);
    const userImgCache = new Map<string, string | null>(uniqueImgUrls.map((url, i) => [url, userImgResults[i]]));

    const zip = outputType === 'PNG' ? new JSZip() : null;
    const log: GenResult[] = [];
    const mimeMap = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' } as const;

    // QR elements that generate a unique id per user (uuid mode, or url with {uuid})
    const uuidQrEls = (tplFromServer.elements as any[]).filter(
      el => el.type === 'qr' && (el.valueMode === 'uuid' || (el.valueMode === 'url' && (el.pattern || '').includes('{uuid}'))),
    );
    // userId → { elementId → generated uuid }
    const uuidRows: { user: InstituteUser; uuids: Record<string, string> }[] = [];

    for (let i = 0; i < targets.length; i++) {
      if (abortRef.current) break;
      const user = targets[i];
      try {
        const rawImg = user.imageUrl ? getImageUrl(user.imageUrl) : '';
        const userImgDataUrl = rawImg ? (userImgCache.get(rawImg) ?? null) : null;
        const { canvas, qrValues } = await renderCard(tplFromServer, user, userImgDataUrl, bgDataUrl, ovDataUrl);

        if (uuidQrEls.length > 0) uuidRows.push({ user, uuids: qrValues });

        if (zip) {
          const blob = await new Promise<Blob>((res, rej) =>
            canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), mimeMap[fileType], fileType === 'jpg' ? 0.92 : undefined)
          );
          const fileName = resolveFileName(namingPattern, user, fileType);
          zip.file(fileName, blob);
        }
        log.push({ userId: user.id, userName: user.name, status: 'ok' });
      } catch (err: any) {
        log.push({ userId: user.id, userName: user.name, status: 'error', error: err?.message });
      }
      setProgress({ done: i + 1, total: targets.length });
      setResults([...log]);
    }

    // 3a. Build the generated-UUID CSV and add it to the ZIP (and standalone download)
    if (uuidQrEls.length > 0 && uuidRows.length > 0) {
      const csv = buildUuidCsv(uuidQrEls, uuidRows);
      if (zip) zip.file('generated-uuids.csv', csv);
      // Also offer a direct CSV download so it's never missed
      try {
        const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(csvBlob);
        a.download = `${(selectedTemplate.name || 'designs').replace(/\s+/g, '_')}_uuids_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch { /* ignore */ }
    }

    // 3b. Download ZIP (PNG output)
    if (!abortRef.current && zip) {
      try {
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = `${(selectedTemplate.name || 'designs').replace(/\s+/g, '_')}_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch {
        toastRef.current({ title: 'ZIP download failed', variant: 'destructive' });
      }
    }

    // 4. Report result (triggers server-side refund for failures)
    const okCount   = log.filter(r => r.status === 'ok').length;
    const failCount = log.filter(r => r.status === 'error').length;
    try {
      await instituteDesignsApi.reportResult(currentInstituteId, commitResult.recordId, okCount, failCount);
      if (failCount > 0) {
        const refundAmount = (preflight?.unitCost ?? 0) * failCount;
        toastRef.current({
          title: `${okCount} generated${failCount ? `, ${failCount} failed` : ''}`,
          description: failCount > 0 ? `${refundAmount.toFixed(2)} credits refunded for failures.` : undefined,
          variant: failCount > 0 ? 'destructive' : 'default',
        });
      } else {
        toastRef.current({ title: `${okCount} files generated`, description: 'ZIP downloaded.' });
      }
    } catch {
      toastRef.current({ title: 'Warning: could not report result to server', variant: 'destructive' });
    }

    setGenerating(false);
    setProgress(null);
    setStep('done');
  };

  // ─── UI ──────────────────────────────────────────────────────────────────────

  if (bootstrapping) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin" /><p className="text-sm">Loading…</p>
      </div>
    );
  }

  // ── PDF layout page ────────────────────────────────────────────────────────
  if (showPdfLayout && selectedTemplate && selectedApiTpl) {
    return (
      <CardPdfLayoutPage
        template={selectedTemplate}
        apiTemplate={selectedApiTpl}
        users={users}
        selectedUserIds={selectedIds}
        outputType={outputType === 'PRINT' ? 'PRINT' : 'PDF'}
        onBack={() => setShowPdfLayout(false)}
      />
    );
  }

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  if (!activeTemplateId || !selectedTemplate) {
    const approvedTemplates = templates.filter(t => {
      const api = apiTemplates.find(a => a.id === t.id);
      return api?.status === 'APPROVED';
    });
    const pendingCount = templates.filter(t => {
      const api = apiTemplates.find(a => a.id === t.id);
      return api?.status !== 'APPROVED';
    }).length;

    return (
      <div className="space-y-3 sm:space-y-5 pb-20 sm:pb-12">
        <div className="flex items-center gap-2 p-3 sm:p-4 bg-card rounded-lg sm:rounded-xl border border-border">
          <div className="p-2 rounded-lg bg-primary/10">
            <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm sm:text-base">Generate & Export</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">Only approved templates can generate</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary">{approvedTemplates.length} approved</Badge>
            {pendingCount > 0 && <Badge variant="outline" className="text-yellow-600">{pendingCount} pending</Badge>}
          </div>
        </div>

        {approvedTemplates.length === 0 ? (
          <div className="text-center py-12 sm:py-20 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            <Layers className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-25" />
            <p className="font-medium text-sm sm:text-base">No approved templates yet</p>
            <p className="text-xs sm:text-sm mt-1">Create a template in the <strong>Designer</strong> tab and wait for system admin approval.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {approvedTemplates.map(t => {
              const api = apiTemplates.find(a => a.id === t.id)!;
              return (
                <div key={t.id}
                  className="group relative rounded-lg sm:rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-md transition-all active:scale-95"
                  onClick={() => onTemplateSelect(t.id)}>
                  <div className="relative overflow-hidden bg-muted/40" style={{ paddingBottom: `${((t.cardHeight ?? 400) / (t.cardWidth ?? 640)) * 100}%` }}>
                    <div className="absolute inset-0" style={{
                      background: t.backgroundImageUrl
                        ? `url(${t.backgroundImageUrl}) center/cover no-repeat`
                        : 'linear-gradient(135deg,#1a237e,#283593)',
                    }}>
                      {(t.elements ?? []).map((el: any) => {
                        if (el.type === 'text') return (
                          <div key={el.id} style={{
                            position: 'absolute', left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`,
                            fontSize: `${el.fontSize * 0.35}px`, fontFamily: `'${el.fontFamily}',sans-serif`,
                            color: el.color, fontWeight: el.bold ? 'bold' : 'normal',
                            fontStyle: el.italic ? 'italic' : 'normal', textAlign: el.align,
                            whiteSpace: 'pre-wrap', lineHeight: 1.3, pointerEvents: 'none',
                          }}>{el.content.replace(/\{[^}]+\}/g, '···')}</div>
                        );
                        if (el.type === 'qr') return (
                          <div key={el.id} style={{
                            position: 'absolute', left: `${el.x}%`, top: `${el.y}%`,
                            width: `${el.size}%`, paddingBottom: `${el.size}%`, pointerEvents: 'none',
                          }}>
                            <div style={{
                              position: 'absolute', inset: 0, background: el.bgColor || '#fff',
                              backgroundImage: 'repeating-linear-gradient(0deg,#000 0 2px,transparent 2px 4px),repeating-linear-gradient(90deg,#000 0 2px,transparent 2px 4px)',
                              opacity: 0.7,
                            }} />
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
                      <span className="flex items-center gap-1.5 text-white text-xs font-medium bg-black/30 px-3 py-1.5 rounded-lg">
                        <Zap className="h-3 w-3" />Generate
                      </span>
                    </div>
                  </div>
                  <div className="p-2 sm:p-3">
                    <p className="font-medium text-xs sm:text-sm truncate">{t.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {api.allowPng  && <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-200 font-semibold">PNG</span>}
                      {api.allowPdf  && <span className="text-[9px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded border border-purple-200 font-semibold">PDF</span>}
                      {api.allowWhatsapp && <span className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded border border-green-200 font-semibold">WhatsApp</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" /><span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const okCount   = results.filter(r => r.status === 'ok').length;
  const failCount = results.filter(r => r.status === 'error').length;
  const selectedArr = [...selectedIds];

  // ── GENERATE VIEW ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-2 sm:space-y-4 pb-20 sm:pb-12">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-card rounded-lg sm:rounded-xl border border-border flex-wrap">
        <button onClick={() => { onBack(); setStep('filters'); setPreflight(null); }}
          className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />Templates
        </button>
        <span className="text-muted-foreground hidden sm:inline text-xs">/</span>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="rounded border overflow-hidden shrink-0 relative" style={{ width: 32, height: 20 }}>
            <div style={{ position: 'absolute', inset: 0, background: selectedTemplate.backgroundImageUrl ? `url(${selectedTemplate.backgroundImageUrl}) center/cover` : 'linear-gradient(135deg,#1a237e,#283593)' }} />
            {selectedTemplate.overlayImageUrl && <img src={selectedTemplate.overlayImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          </div>
          <span className="text-xs sm:text-sm font-medium truncate">{selectedTemplate.name}</span>
        </div>
        {/* Output type selector */}
        {allowedOutputs.length > 1 && (
          <div className="ml-auto">
            <Select value={outputType} onValueChange={v => { setOutputType(v as DesignOutputType); setStep('filters'); setPreflight(null); }}>
              <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {allowedOutputs.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {allowedOutputs.length === 1 && (
          <Badge variant="secondary" className="ml-auto text-xs">{outputType}</Badge>
        )}
      </div>

      {/* Filters */}
      <Card>
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <CardHeader className="py-2 sm:py-3 px-3 sm:px-4 cursor-pointer select-none">
              <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />Filters
                <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ml-auto transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3">

              {/* Mode toggle */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted w-fit">
                <button
                  onClick={() => setFilterMode('criteria')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterMode === 'criteria' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <ListFilter className="h-3 w-3" />By Criteria
                </button>
                <button
                  onClick={() => setFilterMode('ids')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterMode === 'ids' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Hash className="h-3 w-3" />By ID List
                </button>
                <button
                  onClick={() => setFilterMode('count')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterMode === 'count' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Layers className="h-3 w-3" />By Count
                </button>
              </div>

              {/* ── ID LIST MODE ── */}
              {filterMode === 'ids' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className="text-xs font-medium">User IDs</Label>
                    <span className="text-[10px] text-muted-foreground">(system ID or institute-assigned ID, one per line or comma-separated)</span>
                  </div>

                  {/* User type required for lookups */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0">User Type *</Label>
                    <Select value={filters.userTypeSlug} onValueChange={v => setFilters(f => ({ ...f, userTypeSlug: v }))}>
                      <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STUDENT">Students</SelectItem>
                        <SelectItem value="TEACHER">Teachers</SelectItem>
                        <SelectItem value="ATTENDANCE_MARKER">Markers</SelectItem>
                        <SelectItem value="INSTITUTE_ADMIN">Admins</SelectItem>
                        {userTypes.filter(ut => !['STUDENT','TEACHER','ATTENDANCE_MARKER','INSTITUTE_ADMIN','PARENT'].includes(ut.slug.toUpperCase())).map(ut => (
                          <SelectItem key={ut.id} value={ut.slug.toUpperCase()}>{ut.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Textarea
                    value={manualIdText}
                    onChange={e => setManualIdText(e.target.value)}
                    placeholder={"1001\n1002\n1003\n…or paste comma-separated"}
                    className="text-xs font-mono min-h-[120px] resize-y"
                    spellCheck={false}
                  />

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Hidden file input */}
                    <input
                      ref={importFileRef}
                      type="file"
                      accept=".csv,.tsv,.txt,.xls,.xlsx"
                      className="hidden"
                      onChange={handleImportFile}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => importFileRef.current?.click()}
                    >
                      <Upload className="h-3 w-3" />Import CSV / Excel
                    </Button>
                    {manualIdText && (
                      <span className="text-[10px] text-muted-foreground">
                        {parseManualIds(manualIdText).length} IDs entered
                      </span>
                    )}
                    {manualIdText && (
                      <button
                        onClick={() => setManualIdText('')}
                        className="text-[10px] text-destructive hover:underline ml-auto"
                      >Clear</button>
                    )}
                  </div>

                  <Button
                    onClick={() => fetchUsersByIds(parseManualIds(manualIdText))}
                    disabled={loadingUsers || !manualIdText.trim() || !filters.userTypeSlug}
                    className="gap-1.5 h-7 sm:h-8 text-xs px-3" size="sm"
                  >
                    {loadingUsers ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                    Fetch by IDs
                  </Button>
                </div>
              )}

              {/* ── COUNT-ONLY MODE (no real users — e.g. 400 blank unique-QR cards) ── */}
              {filterMode === 'count' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className="text-xs font-medium">Generate by count</Label>
                    <span className="text-[10px] text-muted-foreground">No student/teacher is linked — each card just gets a unique ID/QR code to hand out later.</span>
                  </div>
                  <div className="flex items-end gap-2 flex-wrap">
                    <div className="space-y-1">
                      <Label className="text-xs">How many cards *</Label>
                      <Input
                        type="number" min={1} max={5000} value={batchCount}
                        onChange={e => setBatchCount(+e.target.value)}
                        className="h-7 sm:h-8 text-xs sm:text-sm w-32"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label (optional)</Label>
                      <Input
                        value={batchLabel} onChange={e => setBatchLabel(e.target.value)}
                        placeholder="Card" className="h-7 sm:h-8 text-xs sm:text-sm w-40"
                      />
                    </div>
                    <Button
                      onClick={generateBatchPlaceholders}
                      disabled={loadingUsers || !batchCount || batchCount < 1}
                      className="gap-1.5 h-7 sm:h-8 text-xs px-3" size="sm"
                    >
                      <Layers className="h-3 w-3" />Create Batch
                    </Button>
                  </div>
                </div>
              )}

              {/* ── CRITERIA MODE ── */}
              {filterMode === 'criteria' && (
              <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">

                {/* User Type */}
                <div className="space-y-1">
                  <Label className="text-xs">User Type *</Label>
                  <Select value={filters.userTypeSlug} onValueChange={v => setFilters(f => ({ ...f, userTypeSlug: v, classId: '', subjectId: '' }))}>
                    <SelectTrigger className="h-7 sm:h-8 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STUDENT">Students</SelectItem>
                      <SelectItem value="TEACHER">Teachers</SelectItem>
                      <SelectItem value="ATTENDANCE_MARKER">Markers</SelectItem>
                      <SelectItem value="INSTITUTE_ADMIN">Admins</SelectItem>
                      {userTypes.filter(ut => !['STUDENT','TEACHER','ATTENDANCE_MARKER','INSTITUTE_ADMIN','PARENT'].includes(ut.slug.toUpperCase())).map(ut => (
                        <SelectItem key={ut.id} value={ut.slug.toUpperCase()}>{ut.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Class */}
                <div className="space-y-1">
                  <Label className="text-xs">Class</Label>
                  <Select value={filters.classId || '__all__'} onValueChange={v => setFilters(f => ({ ...f, classId: v === '__all__' ? '' : v, subjectId: '' }))}>
                    <SelectTrigger className="h-7 sm:h-8 text-xs sm:text-sm"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subject */}
                {filters.classId && subjects.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">Subject</Label>
                    <Select value={filters.subjectId || '__all__'} onValueChange={v => setFilters(f => ({ ...f, subjectId: v === '__all__' ? '' : v }))}>
                      <SelectTrigger className="h-7 sm:h-8 text-xs sm:text-sm"><SelectValue placeholder="All" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All</SelectItem>
                        {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Search */}
                <div className="space-y-1">
                  <Label className="text-xs">Search</Label>
                  <Input value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Name/email…" className="h-7 sm:h-8 text-xs sm:text-sm" />
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <Label className="text-xs">Gender</Label>
                  <Select value={filters.gender || '__all__'} onValueChange={v => setFilters(f => ({ ...f, gender: v === '__all__' ? '' : v }))}>
                    <SelectTrigger className="h-7 sm:h-8 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
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
                    <SelectTrigger className="h-7 sm:h-8 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* DOB range */}
                <div className="space-y-1">
                  <Label className="text-xs">DOB from</Label>
                  <Input type="date" value={filters.dobFrom} onChange={e => setFilters(f => ({ ...f, dobFrom: e.target.value }))} className="h-7 sm:h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">DOB to</Label>
                  <Input type="date" value={filters.dobTo} onChange={e => setFilters(f => ({ ...f, dobTo: e.target.value }))} className="h-7 sm:h-8 text-xs" />
                </div>

                {/* Joined range */}
                <div className="space-y-1">
                  <Label className="text-xs">Joined from</Label>
                  <Input type="date" value={filters.joinedFrom} onChange={e => setFilters(f => ({ ...f, joinedFrom: e.target.value }))} className="h-7 sm:h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Joined to</Label>
                  <Input type="date" value={filters.joinedTo} onChange={e => setFilters(f => ({ ...f, joinedTo: e.target.value }))} className="h-7 sm:h-8 text-xs" />
                </div>

                {/* Limit */}
                <div className="space-y-1">
                  <Label className="text-xs">Max records</Label>
                  <Select value={String(filters.limit)} onValueChange={v => setFilters(f => ({ ...f, limit: +v }))}>
                    <SelectTrigger className="h-7 sm:h-8 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[50, 100, 200, 500, 1000, 2000].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={fetchUsers} disabled={loadingUsers || !filters.userTypeSlug}
                className="mt-2 sm:mt-4 gap-1 sm:gap-2 h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3" size="sm">
                {loadingUsers ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                Fetch Users
              </Button>
              </div>
              )}
              {/* end criteria mode */}

            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* ── CSV/Excel column picker dialog ─────────────────────────────────────── */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Import from {importFileName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-xs text-muted-foreground">
              Select the column that contains the user IDs.
              Detected <strong>{importRows.length}</strong> row(s) with <strong>{importHeaders.length}</strong> column(s).
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Column name</Label>
              <Select value={importColName} onValueChange={setImportColName}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select column…" /></SelectTrigger>
                <SelectContent>
                  {importHeaders.map(h => (
                    <SelectItem key={h} value={h} className="text-xs">
                      {h}
                      <span className="ml-2 text-muted-foreground text-[10px]">
                        ({extractColumnIds(importHeaders, importRows, h).length} values)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {importColName && (
              <div className="rounded bg-muted/50 border px-2 py-1.5 text-[10px] font-mono text-muted-foreground max-h-24 overflow-y-auto">
                {extractColumnIds(importHeaders, importRows, importColName).slice(0, 8).join(', ')}
                {extractColumnIds(importHeaders, importRows, importColName).length > 8 && ` …+${extractColumnIds(importHeaders, importRows, importColName).length - 8} more`}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
            <Button size="sm" className="text-xs h-8" onClick={handleImportConfirm} disabled={!importColName}>
              Import IDs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User list */}
      {loadingUsers ? (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
          <Loader2 className="h-4 w-4 animate-spin" />Fetching users…
        </div>
      ) : hasFetched && (
        <Card>
          <CardHeader className="py-2 sm:py-3 px-3 sm:px-4">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <CardTitle className="text-xs sm:text-sm">Users</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {totalUsers > users.length ? `${users.length}/${totalUsers}` : `${users.length}`}
              </Badge>
              <div className="ml-auto flex items-center gap-1.5">
                <button onClick={toggleAll} className="text-xs text-primary underline">
                  {selectedIds.size === users.length ? 'Desel all' : 'Sel all'}
                </button>
                <Badge variant="outline" className="text-xs">{selectedIds.size} sel</Badge>
              </div>
            </div>
          </CardHeader>
          {users.length === 0 ? (
            <CardContent className="text-center text-xs text-muted-foreground py-4">No users found.</CardContent>
          ) : (
            <CardContent className="px-3 pb-3">
              <div className="max-h-72 overflow-y-auto rounded-lg border divide-y divide-border/60">
                {users.map(user => {
                  const sel = selectedIds.has(user.id);
                  const result = results.find(r => r.userId === user.id);
                  return (
                    <div key={user.id} onClick={() => toggleUser(user.id)}
                      className={`flex items-center gap-2 px-2 sm:px-3 py-2 cursor-pointer select-none transition-colors ${sel ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                      <input type="checkbox" checked={sel} readOnly className="shrink-0 pointer-events-none h-4 w-4" />
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={getImageUrl(user.imageUrl || '')} />
                        <AvatarFallback className="text-xs bg-muted">{(user.name || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{user.nameWithInitials || user.name}</p>
                        {user.userIdByInstitute && <p className="text-[10px] text-muted-foreground">#{user.userIdByInstitute}</p>}
                      </div>
                      {result && (result.status === 'ok'
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        : <span title={result.error}><XCircle className="h-3.5 w-3.5 text-destructive shrink-0" /></span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Output settings (PNG) */}
      {outputType === 'PNG' && (
        <Card>
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="py-2 px-3 cursor-pointer select-none">
                <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                  <Settings2 className="h-3.5 w-3.5" />Output Settings
                  <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-3 pb-3 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">File Type</Label>
                  <Select value={fileType} onValueChange={v => setFileType(v as any)}>
                    <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{FILE_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">File Naming Pattern</Label>
                  <Input value={namingPattern} onChange={e => setNamingPattern(e.target.value)}
                    placeholder="{userId}_{fullName}" className="h-7 text-xs font-mono" />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {NAMING_TOKENS.map(t => (
                      <button key={t} onClick={() => setNamingPattern(p => p + t)}
                        className="text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70 font-mono border border-border/60">{t}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* ── PRE-FLIGHT PANEL ─────────────────────────────────────────────────── */}
      {step === 'preflight' && preflight && (
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardContent className="pt-4 pb-4 px-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <CreditCard className="h-4 w-4 text-primary" />Credit Summary
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-lg bg-background border p-2">
                <p className="text-[10px] text-muted-foreground">Users</p>
                <p className="text-base font-bold">{preflight.userCount}</p>
              </div>
              <div className="rounded-lg bg-background border p-2">
                <p className="text-[10px] text-muted-foreground">Cost/user</p>
                <p className="text-base font-bold">{preflight.unitCost.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-background border p-2">
                <p className="text-[10px] text-muted-foreground">Total cost</p>
                <p className="text-base font-bold text-primary">{preflight.totalCost.toFixed(2)}</p>
              </div>
              <div className={`rounded-lg bg-background border p-2 ${preflight.sufficient ? '' : 'border-red-300 bg-red-50'}`}>
                <p className="text-[10px] text-muted-foreground">Balance</p>
                <p className={`text-base font-bold ${preflight.sufficient ? 'text-green-600' : 'text-red-600'}`}>
                  {preflight.balance.toFixed(2)}
                </p>
              </div>
            </div>
            {!preflight.sufficient && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Insufficient credits. You need {preflight.totalCost.toFixed(2)} but have {preflight.balance.toFixed(2)}.
                Please top up your credits first.
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={generate} disabled={!preflight.sufficient || generating}
                className="gap-1.5 h-8 text-xs px-4" size="sm">
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                Confirm & Generate
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setStep('filters'); setPreflight(null); }}
                className="h-8 text-xs px-3">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── GENERATE BUTTON (when in filters/done step) ──────────────────────── */}
      {(step === 'filters' || step === 'done') && (
        <Card>
          <CardContent className="px-3 pb-3 pt-3 space-y-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <Button
                onClick={runPreflight}
                disabled={loadingPreflight || generating || selectedIds.size === 0 || !selectedTemplate || !hasFetched}
                className="gap-1 sm:gap-2 h-7 sm:h-9 text-xs sm:text-sm px-2 sm:px-4"
              >
                {loadingPreflight
                  ? <><Loader2 className="h-3 w-3 animate-spin" />Checking cost…</>
                  : outputType === 'PDF'
                    ? <><FileText className="h-3 w-3" />Check cost & layout PDF</>
                    : <><FileImage className="h-3 w-3" />Check cost & generate</>
                }
              </Button>
              {selectedIds.size > 0 && hasFetched && (
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedIds.size}</span> users · {outputType}
                </span>
              )}
            </div>

            {/* Progress */}
            {progress && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Rendering…</span><span>{progress.done}/{progress.total}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                </div>
                {results.length > 0 && (
                  <div className="max-h-20 overflow-y-auto space-y-0.5 mt-1">
                    {[...results].reverse().slice(0, 5).map(r => (
                      <div key={r.userId} className="flex items-center gap-1.5 text-xs">
                        {r.status === 'ok' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-destructive" />}
                        <span className="truncate text-muted-foreground">{r.userName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Summary */}
            {step === 'done' && results.length > 0 && !generating && (
              <div className="flex items-center gap-3 text-xs flex-wrap">
                {okCount > 0 && <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle2 className="h-3.5 w-3.5" />{okCount} ok</span>}
                {failCount > 0 && <span className="flex items-center gap-1 text-destructive font-medium"><XCircle className="h-3.5 w-3.5" />{failCount} fail (refunded)</span>}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CardTemplateBulkGenerate;
