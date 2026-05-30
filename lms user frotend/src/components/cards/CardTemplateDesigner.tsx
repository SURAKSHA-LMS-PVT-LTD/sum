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
  ArrowLeft, LayoutGrid, Pencil, Clock,
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

export type CardElement = TextElement | ImageElement;

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
}

const CardTemplateDesigner: React.FC<CardTemplateDesignerProps> = ({
  templates: propTemplates,
  saving,
  onSave,
  activeTemplateId,
  onTemplateSelect,
  onBack,
}) => {
  const { toast } = useToast();

  // Local copy of templates so edits don't propagate until Save
  const [templates, setTemplates] = useState<CardTemplate[]>(propTemplates);
  const [selectedElId, setSelectedElId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingOverlay, setUploadingOverlay] = useState(false);

  // Sync when parent updates templates (after save from another view)
  useEffect(() => { setTemplates(propTemplates); }, [propTemplates]);

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

  const addTemplate = () => {
    if (!newTemplateName.trim()) return;
    const t: CardTemplate = {
      id: makeId(),
      name: newTemplateName.trim(),
      backgroundImageUrl: '',
      overlayImageUrl: '',
      cardWidth: DEFAULT_CARD_W,
      cardHeight: DEFAULT_CARD_H,
      elements: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [...templates, t];
    setTemplates(next);
    onTemplateSelect(t.id);
    setNewTemplateName('');
    setAddingTemplate(false);
  };

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
    patchTemplate({ elements: [...activeTemplate.elements, el] });
    setSelectedElId(el.id);
  };

  const addImageElement = () => {
    if (!activeTemplate) return;
    const el: ImageElement = {
      id: makeId(), type: 'image', token: '{userImage}',
      x: 5, y: 10, width: 20, height: 33,
      shape: 'circle', borderColor: '#ffffff', borderWidth: 2,
    };
    patchTemplate({ elements: [...activeTemplate.elements, el] });
    setSelectedElId(el.id);
  };

  const deleteElement = (id: string) => {
    if (!activeTemplate) return;
    patchTemplate({ elements: activeTemplate.elements.filter(e => e.id !== id) });
    if (selectedElId === id) setSelectedElId(null);
  };

  const patchElement = (id: string, patch: Partial<CardElement>) => {
    if (!activeTemplate) return;
    patchTemplate({
      elements: activeTemplate.elements.map(e => e.id === id ? { ...e, ...patch } as CardElement : e),
    });
  };

  const moveElementZ = (id: string, dir: 'up' | 'down') => {
    if (!activeTemplate) return;
    const els = [...activeTemplate.elements];
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">User Photo Element</h3>
            <Button variant="ghost" size="sm" onClick={() => deleteElement(selectedEl.id)} className="text-destructive h-7">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">X (%)</Label>
              <Input type="number" value={selectedEl.x} min={0} max={95} step={0.5}
                onChange={e => patchElement(selectedEl.id, { x: +e.target.value })} className="h-8" /></div>
            <div className="space-y-1"><Label className="text-xs">Y (%)</Label>
              <Input type="number" value={selectedEl.y} min={0} max={95} step={0.5}
                onChange={e => patchElement(selectedEl.id, { y: +e.target.value })} className="h-8" /></div>
            <div className="space-y-1"><Label className="text-xs">Width (%)</Label>
              <Input type="number" value={selectedEl.width} min={5} max={80} step={1}
                onChange={e => patchElement(selectedEl.id, { width: +e.target.value })} className="h-8" /></div>
            <div className="space-y-1"><Label className="text-xs">Height (%)</Label>
              <Input type="number" value={selectedEl.height} min={5} max={80} step={1}
                onChange={e => patchElement(selectedEl.id, { height: +e.target.value })} className="h-8" /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Shape</Label>
            <Select value={selectedEl.shape} onValueChange={v => patchElement(selectedEl.id, { shape: v as any })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="square">Square / Rounded</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Border Color</Label>
              <input type="color" value={selectedEl.borderColor}
                onChange={e => patchElement(selectedEl.id, { borderColor: e.target.value })}
                className="w-full h-8 rounded cursor-pointer border" /></div>
            <div className="space-y-1"><Label className="text-xs">Border Width</Label>
              <Input type="number" value={selectedEl.borderWidth} min={0} max={10} step={1}
                onChange={e => patchElement(selectedEl.id, { borderWidth: +e.target.value })} className="h-8" /></div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => moveElementZ(selectedEl.id, 'up')}>
              <ChevronUp className="h-3.5 w-3.5 mr-1" />Forward
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={() => moveElementZ(selectedEl.id, 'down')}>
              <ChevronDown className="h-3.5 w-3.5 mr-1" />Back
            </Button>
          </div>
        </div>
      );
    }

    // Text element props
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Text Element</h3>
          <Button variant="ghost" size="sm" onClick={() => deleteElement(selectedEl.id)} className="text-destructive h-7">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-1">
          <Label className="text-xs">Content</Label>
          <Input value={selectedEl.content}
            onChange={e => patchElement(selectedEl.id, { content: e.target.value })}
            placeholder="Enter text or insert tokens…" className="h-8 text-sm" />
        </div>

        {/* Token insert */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Insert variable token</Label>
          <div className="flex flex-wrap gap-1">
            {TEXT_TOKENS.map(({ token, label }) => (
              <button key={token}
                className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                onClick={() => insertToken(token)}>{label}</button>
            ))}
          </div>
        </div>

        {/* Font family */}
        <div className="space-y-1">
          <Label className="text-xs">Font</Label>
          <Select value={selectedEl.fontFamily} onValueChange={v => { loadGoogleFont(v); patchElement(selectedEl.id, { fontFamily: v }); }}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-60">
              {GOOGLE_FONTS.map(f => (
                <SelectItem key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Size + Color */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Size (px)</Label>
            <Input type="number" value={selectedEl.fontSize} min={8} max={120} step={1}
              onChange={e => patchElement(selectedEl.id, { fontSize: +e.target.value })} className="h-8" /></div>
          <div className="space-y-1"><Label className="text-xs">Color</Label>
            <input type="color" value={selectedEl.color}
              onChange={e => patchElement(selectedEl.id, { color: e.target.value })}
              className="w-full h-8 rounded cursor-pointer border" /></div>
        </div>

        {/* Position + Width */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1"><Label className="text-xs">X (%)</Label>
            <Input type="number" value={selectedEl.x} min={0} max={95} step={0.5}
              onChange={e => patchElement(selectedEl.id, { x: +e.target.value })} className="h-8" /></div>
          <div className="space-y-1"><Label className="text-xs">Y (%)</Label>
            <Input type="number" value={selectedEl.y} min={0} max={95} step={0.5}
              onChange={e => patchElement(selectedEl.id, { y: +e.target.value })} className="h-8" /></div>
          <div className="space-y-1"><Label className="text-xs">Width (%)</Label>
            <Input type="number" value={selectedEl.width} min={5} max={100} step={1}
              onChange={e => patchElement(selectedEl.id, { width: +e.target.value })} className="h-8" /></div>
        </div>

        {/* Style */}
        <div className="flex items-center gap-3">
          <button onClick={() => patchElement(selectedEl.id, { bold: !selectedEl.bold })}
            className={`p-1.5 rounded ${selectedEl.bold ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}>
            <Bold className="h-4 w-4" />
          </button>
          <button onClick={() => patchElement(selectedEl.id, { italic: !selectedEl.italic })}
            className={`p-1.5 rounded ${selectedEl.italic ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}>
            <Italic className="h-4 w-4" />
          </button>
          <div className="flex border rounded overflow-hidden">
            {(['left', 'center', 'right'] as const).map(a => (
              <button key={a} onClick={() => patchElement(selectedEl.id, { align: a })}
                className={`p-1.5 ${selectedEl.align === a ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                {a === 'left' ? <AlignLeft className="h-4 w-4" /> : a === 'center' ? <AlignCenter className="h-4 w-4" /> : <AlignRight className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>

        {/* Z-order */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => moveElementZ(selectedEl.id, 'up')}>
            <ChevronUp className="h-3.5 w-3.5 mr-1" />Forward
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => moveElementZ(selectedEl.id, 'down')}>
            <ChevronDown className="h-3.5 w-3.5 mr-1" />Back
          </Button>
        </div>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  if (!activeTemplateId) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold text-base">Templates</span>
            <Badge variant="secondary">{templates.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => saveTemplates(templates)} disabled={saving || templates.length === 0} variant="outline" className="h-8">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save All
            </Button>
            {addingTemplate ? (
              <div className="flex items-center gap-1">
                <Input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)}
                  placeholder="Template name" className="h-8 w-44 text-sm"
                  onKeyDown={e => e.key === 'Enter' && addTemplate()} autoFocus />
                <Button size="sm" onClick={addTemplate} className="h-8"><Check className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingTemplate(false); setNewTemplateName(''); }} className="h-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setAddingTemplate(true)} className="h-8">
                <Plus className="h-4 w-4 mr-1" />New Template
              </Button>
            )}
          </div>
        </div>

        {/* Grid of template cards */}
        {templates.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            <Layers className="h-12 w-12 mx-auto mb-3 opacity-25" />
            <p className="font-medium">No templates yet</p>
            <p className="text-sm mt-1">Click <strong>New Template</strong> to create your first design.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(t => (
              <div key={t.id}
                className="group relative rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                onClick={() => { onTemplateSelect(t.id); setSelectedElId(null); }}>
                {/* Preview thumbnail */}
                <div className="relative overflow-hidden bg-muted/40" style={{ paddingBottom: `${(t.cardHeight / t.cardWidth) * 100}%` }}>
                  <div className="absolute inset-0"
                    style={{
                      background: t.backgroundImageUrl
                        ? `url(${t.backgroundImageUrl}) center/cover no-repeat`
                        : 'linear-gradient(135deg,#1a237e,#283593)',
                    }}>
                    {/* Render text elements as tiny preview */}
                    {t.elements.map(el => {
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
                    <span className="flex items-center gap-1.5 text-white text-sm font-medium bg-black/30 px-3 py-1.5 rounded-lg">
                      <Pencil className="h-4 w-4" />Edit
                    </span>
                  </div>
                </div>
                {/* Card info */}
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

  // ── EDITOR VIEW ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => { onBack(); setSelectedElId(null); }}>
          <ArrowLeft className="h-4 w-4" />Templates
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium truncate max-w-[200px]">{activeTemplate!.name}</span>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowPreview(p => !p)} className="h-8">
            <Eye className="h-4 w-4 mr-1" />{showPreview ? 'Hide Preview' : 'Preview'}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-destructive"
            onClick={() => { if (confirm(`Delete "${activeTemplate!.name}"?`)) { deleteTemplate(activeTemplate!.id); } }}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => saveTemplates(templates)} disabled={saving} className="h-8">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        {/* Left: canvas + layer list */}
        <div className="space-y-4">
          {/* Template settings */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />Template Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Template Name</Label>
                  <Input value={activeTemplate!.name}
                    onChange={e => patchTemplate({ name: e.target.value })} className="h-8 text-sm" />
                </div>
                <div className="space-y-1 col-span-full sm:col-span-1">
                  <Label className="text-xs">Card Size</Label>
                  <div className="flex gap-1 items-center">
                    <Input type="number" value={activeTemplate!.cardWidth} min={200} max={1200}
                      onChange={e => patchTemplate({ cardWidth: +e.target.value })} className="h-8 text-sm" />
                    <span className="text-muted-foreground text-xs">×</span>
                    <Input type="number" value={activeTemplate!.cardHeight} min={100} max={800}
                      onChange={e => patchTemplate({ cardHeight: +e.target.value })} className="h-8 text-sm" />
                    <span className="text-muted-foreground text-xs shrink-0">px</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Background image */}
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Image className="h-3 w-3" />Background Image</Label>
                  <div className="flex gap-1">
                    <Input value={activeTemplate!.backgroundImageUrl}
                      onChange={e => patchTemplate({ backgroundImageUrl: e.target.value })}
                      placeholder="https://… or upload →" className="h-8 text-sm min-w-0" />
                    <Button type="button" size="sm" variant="outline" className="h-8 px-2 shrink-0"
                      disabled={uploadingBg} onClick={() => bgInputRef.current?.click()} title="Upload">
                      {uploadingBg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    </Button>
                    {activeTemplate!.backgroundImageUrl && (
                      <Button type="button" size="sm" variant="ghost" className="h-8 px-2 shrink-0 text-muted-foreground"
                        onClick={() => patchTemplate({ backgroundImageUrl: '' })}><X className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                  {activeTemplate!.backgroundImageUrl && (
                    <div className="rounded border border-border overflow-hidden h-14 bg-muted/30">
                      <img src={activeTemplate!.backgroundImageUrl} alt="bg preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <input ref={bgInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadTemplateImage(f, 'backgroundImageUrl'); e.target.value = ''; }} />
                </div>

                {/* Overlay image */}
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Layers className="h-3 w-3" />Overlay PNG</Label>
                  <div className="flex gap-1">
                    <Input value={activeTemplate!.overlayImageUrl}
                      onChange={e => patchTemplate({ overlayImageUrl: e.target.value })}
                      placeholder="https://… (transparent PNG) or upload →" className="h-8 text-sm min-w-0" />
                    <Button type="button" size="sm" variant="outline" className="h-8 px-2 shrink-0"
                      disabled={uploadingOverlay} onClick={() => overlayInputRef.current?.click()} title="Upload">
                      {uploadingOverlay ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    </Button>
                    {activeTemplate!.overlayImageUrl && (
                      <Button type="button" size="sm" variant="ghost" className="h-8 px-2 shrink-0 text-muted-foreground"
                        onClick={() => patchTemplate({ overlayImageUrl: '' })}><X className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                  {activeTemplate!.overlayImageUrl && (
                    <div className="rounded border border-border overflow-hidden h-14 bg-muted/30">
                      <img src={activeTemplate!.overlayImageUrl} alt="overlay preview" className="w-full h-full object-cover" />
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
              </div>
            </div>

            <div className="overflow-auto rounded-xl border border-border shadow-inner bg-muted/20 p-2">
              <div
                ref={canvasRef}
                className="relative mx-auto rounded-lg overflow-hidden select-none"
                style={{
                  width: activeTemplate!.cardWidth,
                  height: activeTemplate!.cardHeight,
                  background: activeTemplate!.backgroundImageUrl
                    ? `url(${activeTemplate!.backgroundImageUrl}) center/cover no-repeat`
                    : 'linear-gradient(135deg,#1a237e,#283593)',
                  cursor: 'default',
                }}
                onClick={() => setSelectedElId(null)}
              >
                {activeTemplate!.elements.map(el => renderElement(el, true))}
                {activeTemplate!.overlayImageUrl && (
                  <img src={activeTemplate!.overlayImageUrl} alt=""
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
            <CardHeader className="py-2 px-4">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Layers ({activeTemplate!.elements.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {activeTemplate!.elements.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No elements yet — add Text or User Photo above</p>
              ) : (
                <div className="space-y-1">
                  {[...activeTemplate!.elements].reverse().map(el => (
                    <div key={el.id}
                      onClick={() => setSelectedElId(el.id)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                        selectedElId === el.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                      }`}>
                      {el.type === 'text' ? <Type className="h-3.5 w-3.5 shrink-0" /> : <Image className="h-3.5 w-3.5 shrink-0" />}
                      <span className="flex-1 truncate text-xs">
                        {el.type === 'text' ? el.content.slice(0, 30) || '(empty)' : 'User Photo'}
                      </span>
                      <button className="text-muted-foreground hover:text-destructive"
                        onClick={e => { e.stopPropagation(); deleteElement(el.id); }}>
                        <Trash2 className="h-3 w-3" />
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
          <Card className="sticky top-4">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Properties</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {renderPropsPanel()}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CardTemplateDesigner;
