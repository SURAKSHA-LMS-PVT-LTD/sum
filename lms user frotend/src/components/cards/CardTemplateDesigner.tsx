/**
 * CardTemplateDesigner
 * Full ID-card template editor with:
 *  - Background image URL + overlay PNG URL (two-layer)
 *  - Draggable / resizable text elements
 *  - Variable tokens: {firstName} {lastName} {fullName} {nameWithInitials}
 *    {userIdByInstitute} {userImage} (renders as image placeholder)
 *  - Google Fonts (English-compatible only)
 *  - Per-element: font, size, color, bold, italic, position
 *  - Save template → JSON stored in institute extra settings (via API)
 *  - Load saved template on open
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Trash2, Save, Type, Image, Bold, Italic,
  ChevronUp, ChevronDown, Eye, Layers, Settings,
  AlignLeft, AlignCenter, AlignRight, Loader2, Check, X, Upload,
  ArrowLeft, LayoutGrid, Pencil, Clock, QrCode,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { profileImageApi } from '@/api/profileImage.api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TextToken =
  | '{firstName}' | '{lastName}' | '{fullName}'
  | '{nameWithInitials}' | '{userIdByInstitute}' | '{instituteCardId}';

export interface TextElement {
  id: string;
  type: 'text';
  content: string;          // raw text with {token} placeholders
  x: number;                // percent of card width 0-100
  y: number;                // percent of card height 0-100
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  width: number;            // percent of card width
}

export interface ImageElement {
  id: string;
  type: 'image';
  token: '{userImage}';
  x: number;
  y: number;
  width: number;            // percent of card width
  height: number;           // percent of card height
  shape: 'circle' | 'square';
  borderColor: string;
  borderWidth: number;
}

/**
 * QR code element.
 * valueMode decides what the QR encodes:
 *  - 'token'  → a single field token (uses `token`), e.g. {userIdByInstitute}
 *  - 'url'    → a URL/string pattern with embedded tokens (uses `pattern`),
 *               e.g. https://fds.lk/{instituteCardId}  or  https://fds.lk/{uuid}
 *  - 'uuid'   → a freshly generated random UUID per user, truncated to `uuidLength`
 * When the resolved value contains the {uuid} token (url mode) or in uuid mode,
 * each user gets a unique generated id which is also written to the export CSV.
 */
export interface QrElement {
  id: string;
  type: 'qr';
  x: number;
  y: number;
  size: number;             // percent of card width (square)
  valueMode: 'token' | 'url' | 'uuid';
  token: string;            // used when valueMode === 'token'
  pattern: string;          // used when valueMode === 'url'
  uuidLength: number;       // 15-23, used when valueMode === 'uuid' or pattern has {uuid}
  fgColor: string;
  bgColor: string;
  margin: number;           // quiet-zone modules
}

export type CardElement = TextElement | ImageElement | QrElement;

export interface CardTemplate {
  id: string;
  name: string;
  backgroundImageUrl: string;
  overlayImageUrl: string;
  cardWidth: number;        // px (preview canvas width)
  cardHeight: number;
  elements: CardElement[];
  createdAt: string;
  updatedAt: string;
}

// ─── Google Fonts (English-compatible subset) ─────────────────────────────────

const GOOGLE_FONTS = [
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Raleway', 'Nunito', 'Inter', 'Oswald', 'Playfair Display',
  'Merriweather', 'Ubuntu', 'Source Sans 3', 'PT Sans',
  'Noto Sans', 'Work Sans', 'Barlow', 'Mulish', 'Quicksand',
  'Exo 2', 'Josefin Sans', 'Titillium Web', 'Bebas Neue',
];

const loadGoogleFont = (family: string) => {
  const id = `gf-${family.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
  document.head.appendChild(link);
};

// ─── QR sample-value helper ────────────────────────────────────────────────────
// In the designer we don't have a real user, so we show a representative sample.
const qrSampleValue = (el: QrElement): string => {
  if (el.valueMode === 'uuid') return 'a1b2c3d4e5f6g7h8'.slice(0, Math.min(el.uuidLength, 16));
  if (el.valueMode === 'token') return el.token.replace(/[{}]/g, '') || 'SAMPLE';
  // url mode — show the pattern with tokens left visible
  return el.pattern || 'https://example.com';
};

// ─── Live QR preview (canvas) for the designer ──────────────────────────────────
const QrPreview: React.FC<{ el: QrElement }> = ({ el }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    import('qrcode').then((QRmod: any) => {
      const QR = QRmod.default ?? QRmod;
      if (cancelled || !ref.current) return;
      QR.toCanvas(ref.current, qrSampleValue(el), {
        margin: el.margin,
        color: { dark: el.fgColor, light: el.bgColor },
        width: 240,
        errorCorrectionLevel: 'M',
      }).catch(() => {});
    });
    return () => { cancelled = true; };
  }, [el.valueMode, el.token, el.pattern, el.uuidLength, el.fgColor, el.bgColor, el.margin]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block' }} />;
};

// ─── Token helpers ────────────────────────────────────────────────────────────

const TEXT_TOKENS: { token: TextToken; label: string }[] = [
  { token: '{firstName}', label: 'First Name' },
  { token: '{lastName}', label: 'Last Name' },
  { token: '{fullName}', label: 'Full Name' },
  { token: '{nameWithInitials}', label: 'Name w/ Initials' },
  { token: '{userIdByInstitute}', label: 'Institute User ID' },
  { token: '{instituteCardId}', label: 'Card ID' },
];

const makeId = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_CARD_W = 640;
const DEFAULT_CARD_H = 400;

// ─── Drag state ───────────────────────────────────────────────────────────────

interface DragState {
  elId: string;
  startMouseX: number;
  startMouseY: number;
  startElX: number;
  startElY: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CardTemplateDesignerProps {
  templates?: CardTemplate[];
  saving?: boolean;
  onSave?: (templates: CardTemplate[]) => Promise<void>;
  activeTemplateId?: string | null;
  onTemplateSelect?: (id: string) => void;
  onBack?: () => void;
  /** Raw API templates (carry status/rejection info). Optional — backwards compatible. */
  apiTemplates?: Array<{ id: string; status: string; rejectionReason?: string }>;
  /** Called with the chosen name — parent creates + saves + navigates into editor. */
  onCreate?: (name: string) => Promise<void>;
  creating?: boolean;
}

const CardTemplateDesigner: React.FC<CardTemplateDesignerProps> = ({
  templates: propTemplates,
  saving,
  onSave,
  activeTemplateId,
  onTemplateSelect,
  onBack,
  apiTemplates = [],
  onCreate,
  creating,
}) => {
  const { toast } = useToast();

  // Local copy of templates — owns all unsaved edits.
  // Initialised from propTemplates; only syncs from parent when the template
  // list length changes (new template added / deleted) or on first load.
  const [templates, setTemplates] = useState<CardTemplate[]>(propTemplates ?? []);
  const [selectedElId, setSelectedElId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingOverlay, setUploadingOverlay] = useState(false);

  // Only pull from propTemplates when the set of templates actually changes
  // (different IDs or count), not on every parent render. This prevents
  // propTemplates from overwriting local edits on each re-render.
  useEffect(() => {
    const incoming = propTemplates ?? [];
    const incomingIds = incoming.map(t => t.id).sort().join(',');
    const localIds   = templates.map(t => t.id).sort().join(',');
    if (incomingIds !== localIds) {
      // Merge: keep local edits for templates that already exist locally,
      // add/remove templates that changed in the parent.
      setTemplates(prev => {
        const localMap = new Map(prev.map(t => [t.id, t]));
        return incoming.map(t => localMap.get(t.id) ?? t);
      });
    }
  }, [propTemplates]); // eslint-disable-line react-hooks/exhaustive-deps

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  const activeTemplate = templates.find(t => t.id === activeTemplateId) ?? null;

  const selectedEl = activeTemplate?.elements.find(e => e.id === selectedElId) ?? null;

  // Load Google Fonts for active template elements
  useEffect(() => {
    activeTemplate?.elements.forEach(el => {
      if (el.type === 'text') loadGoogleFont(el.fontFamily);
    });
  }, [activeTemplate]);

  const saveTemplates = useCallback(async (updated: CardTemplate[]) => {
    await onSave(updated);
  }, [onSave]);

  // ─── Template CRUD ─────────────────────────────────────────────────────────

  const deleteTemplate = (id: string) => {
    const next = templates.filter(t => t.id !== id);
    setTemplates(next);
    onBack();
  };

  const patchTemplate = (patch: Partial<CardTemplate>) => {
    setTemplates(prev => prev.map(t =>
      t.id === activeTemplateId ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
    ));
  };

  const uploadTemplateImage = async (
    file: File,
    field: 'backgroundImageUrl' | 'overlayImageUrl'
  ) => {
    const setUploading = field === 'backgroundImageUrl' ? setUploadingBg : setUploadingOverlay;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Use JPEG, PNG, WebP, or GIF.', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum 10 MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const { uploadUrl, relativePath, fields } = await profileImageApi.generateSignedUrl(
        file.name, file.type, file.size
      );
      await profileImageApi.uploadToStorage(uploadUrl, file, fields);
      const publicUrl = await profileImageApi.verifyAndPublish(relativePath);
      patchTemplate({ [field]: publicUrl });
      toast({ title: 'Image uploaded' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message ?? 'Try again.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // ─── Element CRUD ──────────────────────────────────────────────────────────

  const addTextElement = () => {
    if (!activeTemplate) return;
    const el: TextElement = {
      id: makeId(), type: 'text',
      content: 'New Text',
      x: 10, y: 10, fontSize: 18,
      fontFamily: 'Roboto', color: '#ffffff',
      bold: false, italic: false, align: 'left', width: 60,
    };
    loadGoogleFont(el.fontFamily);
    patchTemplate({ elements: [...(activeTemplate.elements ?? []), el] });
    setSelectedElId(el.id);
  };

  const addImageElement = () => {
    if (!activeTemplate) return;
    const el: ImageElement = {
      id: makeId(), type: 'image', token: '{userImage}',
      x: 5, y: 10, width: 20, height: 33,
      shape: 'circle', borderColor: '#ffffff', borderWidth: 2,
    };
    patchTemplate({ elements: [...(activeTemplate.elements ?? []), el] });
    setSelectedElId(el.id);
  };

  const addQrElement = () => {
    if (!activeTemplate) return;
    const el: QrElement = {
      id: makeId(), type: 'qr',
      x: 70, y: 60, size: 22,
      valueMode: 'token', token: '{userIdByInstitute}',
      pattern: 'https://fds.lk/{uuid}', uuidLength: 18,
      fgColor: '#000000', bgColor: '#ffffff', margin: 1,
    };
    patchTemplate({ elements: [...(activeTemplate.elements ?? []), el] });
    setSelectedElId(el.id);
  };

  const deleteElement = (id: string) => {
    if (!activeTemplate) return;
    patchTemplate({ elements: (activeTemplate.elements ?? []).filter(e => e.id !== id) });
    if (selectedElId === id) setSelectedElId(null);
  };

  const patchElement = (id: string, patch: Partial<CardElement>) => {
    if (!activeTemplate) return;
    patchTemplate({
      elements: (activeTemplate.elements ?? []).map(e => e.id === id ? { ...e, ...patch } as CardElement : e),
    });
  };

  const moveElementZ = (id: string, dir: 'up' | 'down') => {
    if (!activeTemplate) return;
    const els = [...(activeTemplate.elements ?? [])];
    const idx = els.findIndex(e => e.id === id);
    if (idx < 0) return;
    const swap = dir === 'up' ? idx + 1 : idx - 1;
    if (swap < 0 || swap >= els.length) return;
    [els[idx], els[swap]] = [els[swap], els[idx]];
    patchTemplate({ elements: els });
  };

  // ─── Drag logic ────────────────────────────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent, elId: string, elX: number, elY: number) => {
    e.stopPropagation();
    setSelectedElId(elId);
    dragRef.current = { elId, startMouseX: e.clientX, startMouseY: e.clientY, startElX: elX, startElY: elY };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d || !canvasRef.current || !activeTemplate) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((e.clientX - d.startMouseX) / rect.width) * 100;
      const dy = ((e.clientY - d.startMouseY) / rect.height) * 100;
      const nx = Math.max(0, Math.min(95, d.startElX + dx));
      const ny = Math.max(0, Math.min(95, d.startElY + dy));
      patchElement(d.elId, { x: parseFloat(nx.toFixed(2)), y: parseFloat(ny.toFixed(2)) });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [activeTemplate]);

  // ─── Insert token into selected text element ───────────────────────────────

  const insertToken = (token: TextToken) => {
    if (!selectedEl || selectedEl.type !== 'text') return;
    patchElement(selectedEl.id, { content: selectedEl.content + token });
  };

  // ─── Canvas element renderer ───────────────────────────────────────────────

  const renderElement = (el: CardElement, interactive: boolean) => {
    if (el.type === 'image') {
      const border = `${el.borderWidth}px solid ${el.borderColor}`;
      return (
        <div
          key={el.id}
          style={{
            position: 'absolute',
            left: `${el.x}%`, top: `${el.y}%`,
            width: `${el.width}%`, paddingBottom: `${el.height}%`,
            cursor: interactive ? 'move' : 'default',
            outline: interactive && selectedElId === el.id ? '2px dashed #6366f1' : 'none',
          }}
          onMouseDown={interactive ? (e) => onMouseDown(e, el.id, el.x, el.y) : undefined}
          onClick={(e) => { e.stopPropagation(); if (interactive) setSelectedElId(el.id); }}
        >
          <div style={{
            position: 'absolute', inset: 0,
            background: '#ccc',
            borderRadius: el.shape === 'circle' ? '50%' : '6px',
            border,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            fontSize: '10px', color: '#666',
          }}>
            <span style={{ textAlign: 'center', padding: '4px' }}>User<br/>Photo</span>
          </div>
        </div>
      );
    }

    if (el.type === 'qr') {
      return (
        <div
          key={el.id}
          style={{
            position: 'absolute',
            left: `${el.x}%`, top: `${el.y}%`,
            width: `${el.size}%`, paddingBottom: `${el.size}%`,
            cursor: interactive ? 'move' : 'default',
            outline: interactive && selectedElId === el.id ? '2px dashed #6366f1' : 'none',
          }}
          onMouseDown={interactive ? (e) => onMouseDown(e, el.id, el.x, el.y) : undefined}
          onClick={(e) => { e.stopPropagation(); if (interactive) setSelectedElId(el.id); }}
        >
          <div style={{ position: 'absolute', inset: 0, background: el.bgColor }}>
            <QrPreview el={el} />
          </div>
        </div>
      );
    }

    // text
    const fontStyle = [el.italic ? 'italic' : '', el.bold ? 'bold' : ''].filter(Boolean).join(' ');
    return (
      <div
        key={el.id}
        style={{
          position: 'absolute',
          left: `${el.x}%`, top: `${el.y}%`,
          width: `${el.width}%`,
          fontSize: `${el.fontSize}px`,
          fontFamily: `'${el.fontFamily}', sans-serif`,
          color: el.color,
          fontWeight: el.bold ? 'bold' : 'normal',
          fontStyle: el.italic ? 'italic' : 'normal',
          textAlign: el.align,
          cursor: interactive ? 'move' : 'default',
          outline: interactive && selectedElId === el.id ? '2px dashed #6366f1' : 'none',
          userSelect: 'none',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.3,
          pointerEvents: interactive ? 'auto' : 'none',
        }}
        onMouseDown={interactive ? (e) => onMouseDown(e, el.id, el.x, el.y) : undefined}
        onClick={(e) => { e.stopPropagation(); if (interactive) setSelectedElId(el.id); }}
      >
        {el.content}
      </div>
    );
  };

  // ─── Selected element property panel ──────────────────────────────────────

  const renderPropsPanel = () => {
    if (!selectedEl) return (
      <div className="text-center text-muted-foreground text-sm py-8">
        <Type className="h-8 w-8 mx-auto mb-2 opacity-30" />
        Click an element on the canvas to edit its properties
      </div>
    );

    if (selectedEl.type === 'image') {
      return (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-xs sm:text-sm">User Photo Element</h3>
            <Button variant="ghost" size="sm" onClick={() => deleteElement(selectedEl.id)} className="text-destructive h-6 sm:h-7 px-2 sm:px-3 text-xs sm:text-sm">
              <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="space-y-1"><Label className="text-xs">X (%)</Label>
              <Input type="number" value={selectedEl.x} min={0} max={95} step={0.5}
                onChange={e => patchElement(selectedEl.id, { x: +e.target.value })} className="h-7 sm:h-8 text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Y (%)</Label>
              <Input type="number" value={selectedEl.y} min={0} max={95} step={0.5}
                onChange={e => patchElement(selectedEl.id, { y: +e.target.value })} className="h-7 sm:h-8 text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Width (%)</Label>
              <Input type="number" value={selectedEl.width} min={5} max={80} step={1}
                onChange={e => patchElement(selectedEl.id, { width: +e.target.value })} className="h-7 sm:h-8 text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Height (%)</Label>
              <Input type="number" value={selectedEl.height} min={5} max={80} step={1}
                onChange={e => patchElement(selectedEl.id, { height: +e.target.value })} className="h-7 sm:h-8 text-xs" /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Shape</Label>
            <Select value={selectedEl.shape} onValueChange={v => patchElement(selectedEl.id, { shape: v as any })}>
              <SelectTrigger className="h-7 sm:h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="square">Square</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="space-y-1"><Label className="text-xs">Border Color</Label>
              <input type="color" value={selectedEl.borderColor}
                onChange={e => patchElement(selectedEl.id, { borderColor: e.target.value })}
                className="w-full h-7 sm:h-8 rounded cursor-pointer border" /></div>
            <div className="space-y-1"><Label className="text-xs">Border Width</Label>
              <Input type="number" value={selectedEl.borderWidth} min={0} max={10} step={1}
                onChange={e => patchElement(selectedEl.id, { borderWidth: +e.target.value })} className="h-7 sm:h-8 text-xs" /></div>
          </div>
          <div className="flex gap-1 sm:gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1 h-7 sm:h-8 text-xs sm:text-sm" onClick={() => moveElementZ(selectedEl.id, 'up')}>
              <ChevronUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />Forward
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-7 sm:h-8 text-xs sm:text-sm" onClick={() => moveElementZ(selectedEl.id, 'down')}>
              <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />Back
            </Button>
          </div>
        </div>
      );
    }

    // QR element props
    if (selectedEl.type === 'qr') {
      const qr = selectedEl;
      return (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-xs sm:text-sm flex items-center gap-1.5"><QrCode className="h-3.5 w-3.5" />QR Code</h3>
            <Button variant="ghost" size="sm" onClick={() => deleteElement(qr.id)} className="text-destructive h-6 sm:h-7 px-2 sm:px-3 text-xs sm:text-sm">
              <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </Button>
          </div>

          {/* Value mode */}
          <div className="space-y-1">
            <Label className="text-xs">QR encodes</Label>
            <Select value={qr.valueMode} onValueChange={v => patchElement(qr.id, { valueMode: v as QrElement['valueMode'] })}>
              <SelectTrigger className="h-7 sm:h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="token">A field (ID, card ID…)</SelectItem>
                <SelectItem value="url">Custom URL + tokens</SelectItem>
                <SelectItem value="uuid">Random unique UUID</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Token picker */}
          {qr.valueMode === 'token' && (
            <div className="space-y-1">
              <Label className="text-xs">Field</Label>
              <Select value={qr.token} onValueChange={v => patchElement(qr.id, { token: v })}>
                <SelectTrigger className="h-7 sm:h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="{userIdByInstitute}">Institute User ID</SelectItem>
                  <SelectItem value="{instituteCardId}">Card ID</SelectItem>
                  <SelectItem value="{email}">Email</SelectItem>
                  <SelectItem value="{fullName}">Full Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* URL pattern */}
          {qr.valueMode === 'url' && (
            <div className="space-y-1.5">
              <Label className="text-xs">URL pattern</Label>
              <Input value={qr.pattern}
                onChange={e => patchElement(qr.id, { pattern: e.target.value })}
                placeholder="https://fds.lk/{uuid}" className="h-7 sm:h-8 text-xs font-mono" />
              <div className="flex flex-wrap gap-1">
                {['{userIdByInstitute}', '{instituteCardId}', '{email}', '{uuid}'].map(tk => (
                  <button key={tk} type="button"
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                    onClick={() => patchElement(qr.id, { pattern: qr.pattern + tk })}>{tk}</button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Use <code>{'{uuid}'}</code> to embed a generated unique id (exported to CSV).</p>
            </div>
          )}

          {/* UUID length — shown for uuid mode or url with {uuid} */}
          {(qr.valueMode === 'uuid' || (qr.valueMode === 'url' && qr.pattern.includes('{uuid}'))) && (
            <div className="space-y-1">
              <Label className="text-xs">UUID length: <span className="font-bold">{qr.uuidLength}</span> chars</Label>
              <Input type="range" min={15} max={23} step={1} value={qr.uuidLength}
                onChange={e => patchElement(qr.id, { uuidLength: +e.target.value })}
                className="w-full h-7 cursor-pointer" />
            </div>
          )}

          {/* Position + size */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <div className="space-y-1"><Label className="text-xs">X (%)</Label>
              <Input type="number" value={qr.x} min={0} max={95} step={0.5}
                onChange={e => patchElement(qr.id, { x: +e.target.value })} className="h-7 sm:h-8 text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Y (%)</Label>
              <Input type="number" value={qr.y} min={0} max={95} step={0.5}
                onChange={e => patchElement(qr.id, { y: +e.target.value })} className="h-7 sm:h-8 text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Size (%)</Label>
              <Input type="number" value={qr.size} min={5} max={60} step={1}
                onChange={e => patchElement(qr.id, { size: +e.target.value })} className="h-7 sm:h-8 text-xs" /></div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="space-y-1"><Label className="text-xs">Foreground</Label>
              <input type="color" value={qr.fgColor}
                onChange={e => patchElement(qr.id, { fgColor: e.target.value })}
                className="w-full h-7 sm:h-8 rounded cursor-pointer border" /></div>
            <div className="space-y-1"><Label className="text-xs">Background</Label>
              <input type="color" value={qr.bgColor}
                onChange={e => patchElement(qr.id, { bgColor: e.target.value })}
                className="w-full h-7 sm:h-8 rounded cursor-pointer border" /></div>
          </div>

          <div className="flex gap-1 sm:gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1 h-7 sm:h-8 text-xs sm:text-sm" onClick={() => moveElementZ(qr.id, 'up')}>
              <ChevronUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />Forward
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-7 sm:h-8 text-xs sm:text-sm" onClick={() => moveElementZ(qr.id, 'down')}>
              <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />Back
            </Button>
          </div>
        </div>
      );
    }

    // Text element props
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-xs sm:text-sm">Text Element</h3>
          <Button variant="ghost" size="sm" onClick={() => deleteElement(selectedEl.id)} className="text-destructive h-6 sm:h-7 px-2 sm:px-3 text-xs sm:text-sm">
            <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-1">
          <Label className="text-xs">Content</Label>
          <Input value={selectedEl.content}
            onChange={e => patchElement(selectedEl.id, { content: e.target.value })}
            placeholder="Text or tokens…" className="h-7 sm:h-8 text-xs sm:text-sm" />
        </div>

        {/* Token insert */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Insert variable</Label>
          <div className="flex flex-wrap gap-1">
            {TEXT_TOKENS.map(({ token, label }) => (
              <button key={token}
                className="text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors active:scale-95"
                onClick={() => insertToken(token)}>{label}</button>
            ))}
          </div>
        </div>

        {/* Font family */}
        <div className="space-y-1">
          <Label className="text-xs">Font</Label>
          <Select value={selectedEl.fontFamily} onValueChange={v => { loadGoogleFont(v); patchElement(selectedEl.id, { fontFamily: v }); }}>
            <SelectTrigger className="h-7 sm:h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {GOOGLE_FONTS.map(f => (
                <SelectItem key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Size + Color */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="space-y-1"><Label className="text-xs">Size (px)</Label>
            <Input type="number" value={selectedEl.fontSize} min={8} max={120} step={1}
              onChange={e => patchElement(selectedEl.id, { fontSize: +e.target.value })} className="h-7 sm:h-8 text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">Color</Label>
            <input type="color" value={selectedEl.color}
              onChange={e => patchElement(selectedEl.id, { color: e.target.value })}
              className="w-full h-7 sm:h-8 rounded cursor-pointer border" /></div>
        </div>

        {/* Position + Width */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <div className="space-y-1"><Label className="text-xs">X (%)</Label>
            <Input type="number" value={selectedEl.x} min={0} max={95} step={0.5}
              onChange={e => patchElement(selectedEl.id, { x: +e.target.value })} className="h-7 sm:h-8 text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">Y (%)</Label>
            <Input type="number" value={selectedEl.y} min={0} max={95} step={0.5}
              onChange={e => patchElement(selectedEl.id, { y: +e.target.value })} className="h-7 sm:h-8 text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">Width (%)</Label>
            <Input type="number" value={selectedEl.width} min={5} max={100} step={1}
              onChange={e => patchElement(selectedEl.id, { width: +e.target.value })} className="h-7 sm:h-8 text-xs" /></div>
        </div>

        {/* Style */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={() => patchElement(selectedEl.id, { bold: !selectedEl.bold })}
            className={`p-1.5 rounded text-xs sm:text-sm ${selectedEl.bold ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}>
            <Bold className="h-3 w-3 sm:h-4 sm:w-4" />
          </button>
          <button onClick={() => patchElement(selectedEl.id, { italic: !selectedEl.italic })}
            className={`p-1.5 rounded text-xs sm:text-sm ${selectedEl.italic ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}>
            <Italic className="h-3 w-3 sm:h-4 sm:w-4" />
          </button>
          <div className="flex border rounded overflow-hidden">
            {(['left', 'center', 'right'] as const).map(a => (
              <button key={a} onClick={() => patchElement(selectedEl.id, { align: a })}
                className={`p-1.5 text-xs sm:text-sm ${selectedEl.align === a ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                {a === 'left' ? <AlignLeft className="h-3 w-3 sm:h-4 sm:w-4" /> : a === 'center' ? <AlignCenter className="h-3 w-3 sm:h-4 sm:w-4" /> : <AlignRight className="h-3 w-3 sm:h-4 sm:w-4" />}
              </button>
            ))}
          </div>
        </div>

        {/* Z-order */}
        <div className="flex gap-1 sm:gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-7 sm:h-8 text-xs sm:text-sm" onClick={() => moveElementZ(selectedEl.id, 'up')}>
            <ChevronUp className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />Forward
          </Button>
          <Button variant="outline" size="sm" className="flex-1 h-7 sm:h-8 text-xs sm:text-sm" onClick={() => moveElementZ(selectedEl.id, 'down')}>
            <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />Back
          </Button>
        </div>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  if (!activeTemplateId) {
    return (
      <div className="space-y-3 sm:space-y-5 pb-20 sm:pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-card rounded-lg sm:rounded-xl border border-border">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base">Templates</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Manage your card designs</p>
            </div>
            <Badge variant="secondary" className="ml-auto sm:ml-2">{templates.length}</Badge>
          </div>
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Input
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newTemplateName.trim() && onCreate) {
                  onCreate(newTemplateName.trim()).then(() => setNewTemplateName(''));
                }
              }}
              placeholder="Template name…"
              className="h-7 sm:h-8 text-xs sm:text-sm flex-1 sm:w-44"
            />
            <Button
              size="sm"
              onClick={() => {
                if (!newTemplateName.trim() || !onCreate) return;
                onCreate(newTemplateName.trim()).then(() => setNewTemplateName(''));
              }}
              disabled={!newTemplateName.trim() || creating}
              className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 shrink-0"
            >
              {creating
                ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                : <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />}
              Create
            </Button>
          </div>
        </div>

        {/* Grid of template cards */}
        {templates.length === 0 ? (
          <div className="text-center py-12 sm:py-20 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            <Layers className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-3 opacity-25" />
            <p className="font-medium text-sm sm:text-base">No templates yet</p>
            <p className="text-xs sm:text-sm mt-1">Enter a name above and click <strong>Create</strong> to start designing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {templates.map(t => (
              <div key={t.id}
                className="group relative rounded-lg sm:rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-md transition-all active:scale-95"
                onClick={() => { onTemplateSelect?.(t.id); setSelectedElId(null); }}>
                {/* Preview thumbnail */}
                <div className="relative overflow-hidden bg-muted/40" style={{ paddingBottom: `${((t.cardHeight ?? 400) / (t.cardWidth ?? 640)) * 100}%` }}>
                  <div className="absolute inset-0"
                    style={{
                      background: t.backgroundImageUrl
                        ? `url(${t.backgroundImageUrl}) center/cover no-repeat`
                        : 'linear-gradient(135deg,#1a237e,#283593)',
                    }}>
                    {/* Render text elements as tiny preview */}
                    {(t.elements ?? []).map(el => {
                      if (el.type === 'text') {
                        return (
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
                      }
                      if (el.type === 'qr') {
                        return (
                          <div key={el.id} style={{
                            position: 'absolute', left: `${el.x}%`, top: `${el.y}%`,
                            width: `${el.size}%`, paddingBottom: `${el.size}%`, pointerEvents: 'none',
                          }}>
                            <div style={{
                              position: 'absolute', inset: 0, background: el.bgColor,
                              backgroundImage: 'repeating-linear-gradient(0deg,#000 0 2px,transparent 2px 4px),repeating-linear-gradient(90deg,#000 0 2px,transparent 2px 4px)',
                              opacity: 0.7,
                            }} />
                          </div>
                        );
                      }
                      return (
                        <div key={el.id} style={{
                          position: 'absolute', left: `${el.x}%`, top: `${el.y}%`,
                          width: `${el.width}%`, paddingBottom: `${el.height}%`, pointerEvents: 'none',
                        }}>
                          <div style={{
                            position: 'absolute', inset: 0,
                            background: '#aaa', opacity: 0.5,
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
                  {/* Edit overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" style={{ zIndex: 20 }}>
                    <span className="flex items-center gap-1.5 text-white text-xs sm:text-sm font-medium bg-black/30 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg">
                      <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />Edit
                    </span>
                  </div>
                </div>
                {/* Card info */}
                <div className="p-2 sm:p-3">
                  <p className="font-medium text-xs sm:text-sm truncate">{t.name}</p>
                  {/* Approval status badge */}
                  {(() => {
                    const apiTpl = apiTemplates.find(a => a.id === t.id);
                    if (!apiTpl) return null;
                    const colors: Record<string, string> = {
                      APPROVED: 'text-green-600 bg-green-50',
                      PENDING: 'text-yellow-600 bg-yellow-50',
                      REJECTED: 'text-red-600 bg-red-50',
                      SUSPENDED: 'text-orange-600 bg-orange-50',
                    };
                    return (
                      <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${colors[apiTpl.status] ?? 'text-muted-foreground bg-muted'}`}>
                        {apiTpl.status}
                      </span>
                    );
                  })()}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="text-[10px] sm:text-xs">{t.cardWidth}×{t.cardHeight}px</span>
                    <span>·</span>
                    <span className="text-[10px] sm:text-xs">{(t.elements ?? []).length} el</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                    <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    <span>{new Date(t.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── EDITOR VIEW ───────────────────────────────────────────────────────────
  if (!activeTemplate) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading template…
      </div>
    );
  }

  const activeApiTpl = apiTemplates.find(a => a.id === activeTemplate.id) ?? null;
  return (
    <div className="space-y-2 sm:space-y-4 pb-20 sm:pb-12">
      {/* Re-approval warning when editing an approved template */}
      {activeApiTpl?.status === 'APPROVED' && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-700 text-xs">
          <span className="font-semibold">⚠ Approved template:</span>
          Saving changes will reset it to <span className="font-semibold">Pending Review</span> and disable generation until re-approved.
        </div>
      )}
      {/* Top bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap p-2 sm:p-3 bg-card rounded-lg sm:rounded-xl border border-border">
        <Button size="sm" variant="ghost" className="h-7 sm:h-8 gap-1 text-xs sm:text-sm px-2 sm:px-3 text-muted-foreground hover:text-foreground"
          onClick={() => { onBack(); setSelectedElId(null); }}>
          <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Templates</span>
        </Button>
        <span className="text-muted-foreground hidden sm:inline">/</span>
        <span className="text-xs sm:text-sm font-medium truncate">{activeTemplate.name}</span>

        <div className="ml-auto flex items-center gap-1 sm:gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setShowPreview(p => !p)} className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 gap-1">
            <Eye className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">{showPreview ? 'Hide Preview' : 'Preview'}</span><span className="sm:hidden">{showPreview ? 'Hide' : 'Show'}</span>
          </Button>
          <Button size="sm" variant="ghost" className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 text-destructive"
            onClick={() => { if (confirm(`Delete "${activeTemplate.name}"?`)) { deleteTemplate(activeTemplate.id); } }}>
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button size="sm" onClick={() => saveTemplates(templates)} disabled={saving} className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3 gap-1">
            {saving ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Save className="h-3 w-3 sm:h-4 sm:w-4" />}
            <span className="hidden sm:inline">Save</span>
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-3 sm:gap-4">
        {/* Left: canvas + layer list */}
        <div className="space-y-3 sm:space-y-4">
          {/* Template settings */}
          <Card>
            <CardHeader className="py-2 sm:py-3 px-3 sm:px-4">
              <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />Template Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 sm:space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={activeTemplate.name}
                    onChange={e => patchTemplate({ name: e.target.value })} className="h-7 sm:h-8 text-xs sm:text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Card Size (W × H)</Label>
                  <div className="flex gap-1 items-center">
                    <Input type="number" value={activeTemplate.cardWidth} min={200} max={1200}
                      onChange={e => patchTemplate({ cardWidth: +e.target.value })} className="h-7 sm:h-8 text-xs sm:text-sm flex-1" />
                    <span className="text-muted-foreground text-xs">×</span>
                    <Input type="number" value={activeTemplate.cardHeight} min={100} max={800}
                      onChange={e => patchTemplate({ cardHeight: +e.target.value })} className="h-7 sm:h-8 text-xs sm:text-sm flex-1" />
                    <span className="text-muted-foreground text-xs shrink-0 whitespace-nowrap">px</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {/* Background image */}
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Image className="h-3 w-3" />Background</Label>
                  <div className="flex gap-1">
                    <Input value={activeTemplate.backgroundImageUrl}
                      onChange={e => patchTemplate({ backgroundImageUrl: e.target.value })}
                      placeholder="URL or upload…" className="h-7 sm:h-8 text-xs sm:text-sm min-w-0" />
                    <Button type="button" size="sm" variant="outline" className="h-7 sm:h-8 px-2 shrink-0"
                      disabled={uploadingBg} onClick={() => bgInputRef.current?.click()} title="Upload">
                      {uploadingBg ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    </Button>
                    {activeTemplate.backgroundImageUrl && (
                      <Button type="button" size="sm" variant="ghost" className="h-7 sm:h-8 px-2 shrink-0 text-muted-foreground"
                        onClick={() => patchTemplate({ backgroundImageUrl: '' })}><X className="h-3 w-3" /></Button>
                    )}
                  </div>
                  {activeTemplate.backgroundImageUrl && (
                    <div className="rounded border border-border overflow-hidden h-10 sm:h-14 bg-muted/30">
                      <img src={activeTemplate.backgroundImageUrl} alt="bg preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <input ref={bgInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplateImage(f, 'backgroundImageUrl'); e.target.value = ''; }} />
                </div>

                {/* Overlay image */}
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Layers className="h-3 w-3" />Overlay PNG</Label>
                  <div className="flex gap-1">
                    <Input value={activeTemplate.overlayImageUrl}
                      onChange={e => patchTemplate({ overlayImageUrl: e.target.value })}
                      placeholder="Transparent PNG URL or upload…" className="h-7 sm:h-8 text-xs sm:text-sm min-w-0" />
                    <Button type="button" size="sm" variant="outline" className="h-7 sm:h-8 px-2 shrink-0"
                      disabled={uploadingOverlay} onClick={() => overlayInputRef.current?.click()} title="Upload">
                      {uploadingOverlay ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    </Button>
                    {activeTemplate.overlayImageUrl && (
                      <Button type="button" size="sm" variant="ghost" className="h-7 sm:h-8 px-2 shrink-0 text-muted-foreground"
                        onClick={() => patchTemplate({ overlayImageUrl: '' })}><X className="h-3 w-3" /></Button>
                    )}
                  </div>
                  {activeTemplate.overlayImageUrl && (
                    <div className="rounded border border-border overflow-hidden h-10 sm:h-14 bg-muted/30">
                      <img src={activeTemplate.overlayImageUrl} alt="overlay preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <input ref={overlayInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplateImage(f, 'overlayImageUrl'); e.target.value = ''; }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Canvas */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Canvas</span>
              <div className="flex gap-1 ml-auto">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addTextElement}>
                  <Type className="h-3.5 w-3.5 mr-1" />Text
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addImageElement}>
                  <Image className="h-3.5 w-3.5 mr-1" />User Photo
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addQrElement}>
                  <QrCode className="h-3.5 w-3.5 mr-1" />QR Code
                </Button>
              </div>
            </div>

            <div className="overflow-auto rounded-xl border border-border shadow-inner bg-muted/20 p-2">
              <div
                ref={canvasRef}
                className="relative mx-auto rounded-lg overflow-hidden select-none"
                style={{
                  width: activeTemplate.cardWidth,
                  height: activeTemplate.cardHeight,
                  background: activeTemplate.backgroundImageUrl
                    ? `url(${activeTemplate.backgroundImageUrl}) center/cover no-repeat`
                    : 'linear-gradient(135deg,#1a237e,#283593)',
                  cursor: 'default',
                }}
                onClick={() => setSelectedElId(null)}
              >
                {(activeTemplate.elements ?? []).map(el => <React.Fragment key={el.id}>{renderElement(el, true)}</React.Fragment>)}
                {activeTemplate.overlayImageUrl && (
                  <img src={activeTemplate.overlayImageUrl} alt=""
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    style={{ zIndex: 50 }} />
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Click element to select · Drag to reposition · Use property panel to style
            </p>
          </div>

          {/* Layer list */}
          <Card>
            <CardHeader className="py-2 sm:py-3 px-3 sm:px-4">
              <CardTitle className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground">Layers ({(activeTemplate.elements ?? []).length})</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3">
              {(activeTemplate.elements ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2 sm:py-3">No elements yet</p>
              ) : (
                <div className="space-y-1">
                  {[...(activeTemplate.elements ?? [])].reverse().map(el => (
                    <div key={el.id}
                      onClick={() => setSelectedElId(el.id)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-xs sm:text-sm transition-colors ${
                        selectedElId === el.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                      }`}>
                      {el.type === 'text' ? <Type className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                        : el.type === 'qr' ? <QrCode className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                        : <Image className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />}
                      <span className="flex-1 truncate text-xs">
                        {el.type === 'text' ? (el.content.slice(0, 20) || '(empty)')
                          : el.type === 'qr' ? 'QR Code' : 'Photo'}
                      </span>
                      <button className="text-muted-foreground hover:text-destructive shrink-0 p-0.5"
                        onClick={e => { e.stopPropagation(); deleteElement(el.id); }}>
                        <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: properties */}
        <div>
          <Card className="sticky top-4 z-20">
            <CardHeader className="py-2 sm:py-3 px-3 sm:px-4">
              <CardTitle className="text-xs sm:text-sm">Properties</CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
              {renderPropsPanel()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CardTemplateDesigner;
