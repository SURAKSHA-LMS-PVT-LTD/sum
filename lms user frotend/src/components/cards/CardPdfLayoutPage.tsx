import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Loader2, FileText, Download, Settings2, Grid, ChevronDown, ChevronUp, Zap,
  CreditCard, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { instituteDesignsApi, DesignTemplate, DesignOutputType } from '@/api/instituteDesigns.api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface InstituteUser {
  id: string;
  name: string;
  nameWithInitials?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  imageUrl?: string;
  userIdByInstitute?: string | null;
  instituteCardId?: string | null;
  className?: string;
}

interface CardTemplate {
  id: string;
  name: string;
  cardWidth: number;
  cardHeight: number;
  elements: any[];
  backgroundImageUrl?: string;
  overlayImageUrl?: string;
  [key: string]: any;
}

// ─── Page size presets (in mm → pt at 72dpi; jsPDF units = mm) ───────────────

const PAGE_SIZES: Record<string, { label: string; w: number; h: number }> = {
  A4:      { label: 'A4 (210×297)',     w: 210, h: 297 },
  Letter:  { label: 'Letter (216×279)', w: 216, h: 279 },
  A5:      { label: 'A5 (148×210)',     w: 148, h: 210 },
  A3:      { label: 'A3 (297×420)',     w: 297, h: 420 },
};

const PER_PAGE_PRESETS = [
  { label: '1 per page', cols: 1, rows: 1 },
  { label: '2 per page', cols: 1, rows: 2 },
  { label: '4 per page', cols: 2, rows: 2 },
  { label: '6 per page', cols: 2, rows: 3 },
  { label: '9 per page', cols: 3, rows: 3 },
  { label: '16 per page',cols: 4, rows: 4 },
];

// ─── Token / image helpers (copied from CardTemplateBulkGenerate) ────────────

function resolveTokens(content: string, u: InstituteUser): string {
  const parts = (u.name || '').trim().split(/\s+/);
  const firstName = u.firstName || parts[0] || '';
  const lastName  = u.lastName  || (parts.length > 1 ? parts[parts.length - 1] : '');
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

async function toDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) return null;
    const blob = await r.blob();
    return new Promise(res => { const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.readAsDataURL(blob); });
  } catch { return null; }
}

async function ensureFontLoaded(family: string) {
  await document.fonts.load(`16px '${family}'`).catch(() => {});
}

function makeTruncatedUuid(length: number): string {
  const raw = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`)
    .replace(/-/g, '');
  const len = Math.min(23, Math.max(15, length || 18));
  return raw.slice(0, len);
}

function resolveQrValue(el: any, u: InstituteUser): { value: string; uuid?: string } {
  if (el.valueMode === 'token') return { value: resolveTokens(el.token, u) };
  if (el.valueMode === 'uuid') { const uuid = makeTruncatedUuid(el.uuidLength); return { value: uuid, uuid }; }
  let uuid: string | undefined;
  let pattern = el.pattern || '';
  if (pattern.includes('{uuid}')) { uuid = makeTruncatedUuid(el.uuidLength); pattern = pattern.replace(/\{uuid\}/g, uuid); }
  return { value: resolveTokens(pattern, u), uuid };
}

async function renderCard(tpl: CardTemplate, user: InstituteUser, userImg: string | null, bg: string | null, ov: string | null): Promise<{ canvas: HTMLCanvasElement; qrValues: Record<string, string> }> {
  const { default: html2canvas } = await import('html2canvas');
  const fonts = new Set<string>();
  for (const el of tpl.elements) if (el.type === 'text') fonts.add(el.fontFamily);
  await Promise.all([...fonts].map(ensureFontLoaded));

  // Pre-generate QR data URLs
  const QRmod: any = await import('qrcode');
  const QR = QRmod.default ?? QRmod;
  const qrDataUrls: Record<string, string> = {};
  const qrValues: Record<string, string> = {};
  for (const el of tpl.elements as any[]) {
    if (el.type === 'qr') {
      const { value, uuid } = resolveQrValue(el, user);
      if (uuid) qrValues[el.id] = uuid;
      try {
        qrDataUrls[el.id] = await QR.toDataURL(value || ' ', {
          margin: el.margin ?? 1,
          color: { dark: el.fgColor || '#000000', light: el.bgColor || '#ffffff' },
          width: 600, errorCorrectionLevel: 'M',
        });
      } catch { qrDataUrls[el.id] = ''; }
    }
  }

  const W = tpl.cardWidth, H = tpl.cardHeight;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-${W * 4}px;top:0;width:${W}px;height:${H}px;overflow:hidden;`;
  document.body.appendChild(host);

  try {
    const bgDiv = document.createElement('div');
    bgDiv.style.cssText = `position:absolute;inset:0;${bg ? `background:url(${bg}) center/cover no-repeat` : 'background:linear-gradient(135deg,#1a237e,#283593)'};`;
    host.appendChild(bgDiv);

    for (const el of tpl.elements as any[]) {
      if (el.type === 'image') {
        const wrap = document.createElement('div');
        wrap.style.cssText = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}%;padding-bottom:${el.height}%;`;
        const inner = document.createElement('div');
        inner.style.cssText = `position:absolute;inset:0;border-radius:${el.shape==='circle'?'50%':'6px'};border:${el.borderWidth}px solid ${el.borderColor};overflow:hidden;background:#aaa;`;
        if (userImg) { const img = document.createElement('img'); img.src = userImg; img.style.cssText='width:100%;height:100%;object-fit:cover;'; inner.appendChild(img); }
        wrap.appendChild(inner); host.appendChild(wrap);
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
        const div = document.createElement('div');
        div.style.cssText = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}%;font-size:${el.fontSize}px;font-family:'${el.fontFamily}',sans-serif;color:${el.color};font-weight:${el.bold?'bold':'normal'};font-style:${el.italic?'italic':'normal'};text-align:${el.align};white-space:pre-wrap;line-height:1.3;`;
        div.textContent = resolveTokens(el.content, user);
        host.appendChild(div);
      }
    }
    if (ov) { const img = document.createElement('img'); img.src=ov; img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;'; host.appendChild(img); }

    await new Promise(r => setTimeout(r, 80));
    const canvas = await html2canvas(host, { width: W, height: H, scale: 2, useCORS: true, allowTaint: false, backgroundColor: null, logging: false });
    return { canvas, qrValues };
  } finally {
    document.body.removeChild(host);
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface CardPdfLayoutPageProps {
  template: CardTemplate;
  apiTemplate: DesignTemplate;
  users: InstituteUser[];
  selectedUserIds: Set<string>;
  /** PDF (download) or PRINT (print-ready PDF) — drives which cost is billed */
  outputType?: DesignOutputType;
  onBack: () => void;
}

const CardPdfLayoutPage: React.FC<CardPdfLayoutPageProps> = ({
  template, apiTemplate, users, selectedUserIds, outputType = 'PDF', onBack,
}) => {
  const { toast } = useToast();
  const { currentInstituteId } = useAuth();

  // Layout settings
  const [pageSize, setPageSize] = useState<keyof typeof PAGE_SIZES>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(4);
  const [marginMm, setMarginMm] = useState(10);
  const [gapMm, setGapMm] = useState(4);
  // Card scale: shrink each card cell within its slot (others keep the grid).
  // 100 = fill the cell; lower keeps the grid spacing but draws smaller cards.
  const [cardScale, setCardScale] = useState(100);
  // Optional page header (printed at top of every page) + page numbers
  const [headerText, setHeaderText] = useState('');
  const [showPageNumbers, setShowPageNumbers] = useState(false);
  // Keep template aspect ratio (letterbox card inside cell) instead of stretching
  const [keepAspect, setKeepAspect] = useState(true);

  // Billing
  const [preflight, setPreflight] = useState<{
    userCount: number; unitCost: number; totalCost: number; balance: number; sufficient: boolean;
  } | null>(null);
  const [loadingPreflight, setLoadingPreflight] = useState(false);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [step, setStep] = useState<'layout' | 'preflight' | 'generating' | 'done'>('layout');

  const abortRef = useRef(false);
  const targetUsers = users.filter(u => selectedUserIds.has(u.id));

  const applyPreset = (preset: { cols: number; rows: number }) => {
    setCols(preset.cols);
    setRows(preset.rows);
  };

  // Derived dimensions (respect orientation: swap w/h when landscape)
  const base = PAGE_SIZES[pageSize];
  const page = orientation === 'landscape' ? { ...base, w: base.h, h: base.w } : base;
  const headerH = headerText ? 12 : 0;          // mm reserved at top for header
  const footerH = showPageNumbers ? 8 : 0;       // mm reserved at bottom for page no.
  const cardAreaW = page.w - 2 * marginMm;
  const cardAreaH = page.h - 2 * marginMm - headerH - footerH;
  const cellW = (cardAreaW - (cols - 1) * gapMm) / cols;
  const cellH = (cardAreaH - (rows - 1) * gapMm) / rows;
  const perPage = cols * rows;
  const totalPages = Math.ceil(targetUsers.length / perPage);
  const tplAspect = template.cardWidth / template.cardHeight;

  // ── Pre-flight ─────────────────────────────────────────────────────────────
  const runPreflight = async () => {
    if (!currentInstituteId) return;
    setLoadingPreflight(true);
    try {
      const result = await instituteDesignsApi.previewCost(
        currentInstituteId, template.id, outputType, targetUsers.map(u => u.id),
      );
      setPreflight(result);
      setStep('preflight');
    } catch (err: any) {
      toast({ title: 'Could not fetch cost', description: err?.message, variant: 'destructive' });
    } finally {
      setLoadingPreflight(false);
    }
  };

  // ── Commit + generate PDF ─────────────────────────────────────────────────
  const generate = async () => {
    if (!currentInstituteId || !preflight) return;

    // 1. Commit
    let commitResult: { recordId: string; definition: Record<string, any> };
    try {
      commitResult = await instituteDesignsApi.commitGeneration(
        currentInstituteId, template.id, outputType, targetUsers.map(u => u.id),
      );
    } catch (err: any) {
      toast({ title: 'Commit failed', description: err?.message, variant: 'destructive' });
      setStep('layout');
      return;
    }
    setRecordId(commitResult.recordId);
    const tplFromServer = { ...template, ...commitResult.definition } as CardTemplate;

    // 2. Render
    setGenerating(true);
    setStep('generating');
    abortRef.current = false;
    setProgress({ done: 0, total: targetUsers.length });

    const uniqueImgUrls = [...new Set(targetUsers.map(u => u.imageUrl ? getImageUrl(u.imageUrl) : '').filter(Boolean))];
    const [bgData, ovData, ...userImgResults] = await Promise.all([
      tplFromServer.backgroundImageUrl ? toDataUrl(tplFromServer.backgroundImageUrl) : Promise.resolve(null),
      tplFromServer.overlayImageUrl    ? toDataUrl(tplFromServer.overlayImageUrl)    : Promise.resolve(null),
      ...uniqueImgUrls.map(url => toDataUrl(url)),
    ]);
    const userImgCache = new Map<string, string | null>(uniqueImgUrls.map((url, i) => [url, userImgResults[i]]));

    // Render all canvases
    const canvases: { canvas: HTMLCanvasElement; ok: boolean }[] = [];
    const uuidQrEls = (tplFromServer.elements as any[]).filter(
      el => el.type === 'qr' && (el.valueMode === 'uuid' || (el.valueMode === 'url' && (el.pattern || '').includes('{uuid}'))),
    );
    const uuidRows: { user: InstituteUser; uuids: Record<string, string> }[] = [];
    let okCount = 0, failCount = 0;
    for (let i = 0; i < targetUsers.length; i++) {
      if (abortRef.current) break;
      const user = targetUsers[i];
      try {
        const rawImg = user.imageUrl ? getImageUrl(user.imageUrl) : '';
        const userImg = rawImg ? (userImgCache.get(rawImg) ?? null) : null;
        const { canvas, qrValues } = await renderCard(tplFromServer, user, userImg, bgData, ovData);
        if (uuidQrEls.length > 0) uuidRows.push({ user, uuids: qrValues });
        canvases.push({ canvas, ok: true });
        okCount++;
      } catch {
        canvases.push({ canvas: document.createElement('canvas'), ok: false });
        failCount++;
      }
      setProgress({ done: i + 1, total: targetUsers.length });
    }

    // Export the generated-UUID CSV alongside the PDF
    if (uuidQrEls.length > 0 && uuidRows.length > 0) {
      try {
        const single = uuidQrEls.length === 1;
        const header = ['User ID', 'Institute User ID', 'Card ID', 'Name', 'Email',
          ...uuidQrEls.map((el, i) => single ? 'Generated UUID' : `Generated UUID (QR ${i + 1})`)];
        const esc = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        const lines = [header.map(esc).join(',')];
        for (const { user, uuids } of uuidRows) {
          lines.push([user.id, user.userIdByInstitute || '', user.instituteCardId || '', user.name || '', user.email || '',
            ...uuidQrEls.map(el => uuids[el.id] || '')].map(c => esc(String(c))).join(','));
        }
        const csvBlob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(csvBlob);
        a.download = `${(template.name || 'designs').replace(/\s+/g, '_')}_uuids_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch { /* ignore */ }
    }

    // 3. Build PDF
    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: page.w > page.h ? 'l' : 'p', unit: 'mm', format: [page.w, page.h] });
      const okCanvases = canvases.filter(c => c.ok && c.canvas.width > 0);
      const pagesNeeded = Math.max(1, Math.ceil(okCanvases.length / perPage));

      // Draws the header text + page number on the current page
      const drawPageChrome = (pageNo: number) => {
        if (headerText) {
          pdf.setFontSize(12);
          pdf.setTextColor(40);
          pdf.text(headerText, page.w / 2, marginMm + 6, { align: 'center' });
        }
        if (showPageNumbers) {
          pdf.setFontSize(9);
          pdf.setTextColor(120);
          pdf.text(`Page ${pageNo} of ${pagesNeeded}`, page.w / 2, page.h - 4, { align: 'center' });
        }
      };

      const gridTop = marginMm + headerH;
      drawPageChrome(1);

      for (let i = 0; i < okCanvases.length; i++) {
        const slot = i % perPage;
        if (slot === 0 && i > 0) { pdf.addPage(); drawPageChrome(Math.floor(i / perPage) + 1); }
        const col = slot % cols;
        const row = Math.floor(slot / cols);
        const cellX = marginMm + col * (cellW + gapMm);
        const cellY = gridTop + row * (cellH + gapMm);

        // Apply card scale (shrink within the cell, keep centred)
        const scale = Math.min(100, Math.max(20, cardScale)) / 100;
        let drawW = cellW * scale;
        let drawH = cellH * scale;
        // Keep template aspect ratio inside the (scaled) cell if requested
        if (keepAspect) {
          const cellAspect = drawW / drawH;
          if (tplAspect > cellAspect) drawH = drawW / tplAspect;
          else                        drawW = drawH * tplAspect;
        }
        const x = cellX + (cellW - drawW) / 2;
        const y = cellY + (cellH - drawH) / 2;

        const { canvas } = okCanvases[i];
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', x, y, drawW, drawH);
      }

      const pdfBlob = pdf.output('blob');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pdfBlob);
      a.download = `${(template.name || 'designs').replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast({ title: 'PDF generation failed', variant: 'destructive' });
    }

    // 4. Report result
    try {
      await instituteDesignsApi.reportResult(currentInstituteId, commitResult.recordId, okCount, failCount);
      if (failCount > 0) {
        const refund = (preflight.unitCost ?? 0) * failCount;
        toast({ title: `${okCount} cards in PDF, ${failCount} failed`, description: `${refund.toFixed(2)} credits refunded.`, variant: 'destructive' });
      } else {
        toast({ title: `PDF generated with ${okCount} cards`, description: `${totalPages} page(s).` });
      }
    } catch {
      toast({ title: 'Could not report result to server', variant: 'destructive' });
    }

    setGenerating(false);
    setStep('done');
  };

  return (
    <div className="space-y-4 pb-16">
      {/* Back bar */}
      <div className="flex items-center gap-2 p-2 sm:p-3 bg-card rounded-lg border border-border">
        <button onClick={onBack} className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />Back to generate
        </button>
        <span className="text-muted-foreground text-xs">/</span>
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs sm:text-sm font-medium">{template.name} — PDF Layout</span>
        <div className="ml-auto text-xs text-muted-foreground">{targetUsers.length} users · {totalPages} page(s)</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Left: settings ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="py-2.5 px-3">
              <CardTitle className="text-xs sm:text-sm flex items-center gap-2"><Settings2 className="h-4 w-4" />Page &amp; Layout</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-3">
              {/* Page size */}
              <div className="flex items-center gap-2">
                <Label className="text-xs w-24 shrink-0">Page size</Label>
                <Select value={pageSize} onValueChange={v => setPageSize(v as any)}>
                  <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAGE_SIZES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Orientation */}
              <div className="flex items-center gap-2">
                <Label className="text-xs w-24 shrink-0">Orientation</Label>
                <div className="flex gap-1 flex-1">
                  {(['portrait', 'landscape'] as const).map(o => (
                    <button key={o} onClick={() => setOrientation(o)}
                      className={`flex-1 text-xs px-2 py-1 rounded border capitalize transition-colors ${orientation === o ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border hover:bg-muted'}`}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              {/* Presets */}
              <div>
                <Label className="text-xs">Cards per page preset</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {PER_PAGE_PRESETS.map(p => (
                    <button key={p.label} onClick={() => applyPreset(p)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${cols === p.cols && rows === p.rows ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 border-border hover:bg-muted'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Columns */}
              <div className="flex items-center gap-3">
                <Label className="text-xs w-24 shrink-0">Columns: <span className="font-bold">{cols}</span></Label>
                <Slider min={1} max={8} step={1} value={[cols]} onValueChange={([v]) => setCols(v)} className="flex-1" />
              </div>

              {/* Rows */}
              <div className="flex items-center gap-3">
                <Label className="text-xs w-24 shrink-0">Rows: <span className="font-bold">{rows}</span></Label>
                <Slider min={1} max={8} step={1} value={[rows]} onValueChange={([v]) => setRows(v)} className="flex-1" />
              </div>

              {/* Margins */}
              <div className="flex items-center gap-3">
                <Label className="text-xs w-24 shrink-0">Margin: <span className="font-bold">{marginMm}mm</span></Label>
                <Slider min={0} max={30} step={1} value={[marginMm]} onValueChange={([v]) => setMarginMm(v)} className="flex-1" />
              </div>

              {/* Gap */}
              <div className="flex items-center gap-3">
                <Label className="text-xs w-24 shrink-0">Gap: <span className="font-bold">{gapMm}mm</span></Label>
                <Slider min={0} max={15} step={0.5} value={[gapMm]} onValueChange={([v]) => setGapMm(v)} className="flex-1" />
              </div>

              {/* Card scale within cell */}
              <div className="flex items-center gap-3">
                <Label className="text-xs w-24 shrink-0">Card size: <span className="font-bold">{cardScale}%</span></Label>
                <Slider min={30} max={100} step={1} value={[cardScale]} onValueChange={([v]) => setCardScale(v)} className="flex-1" />
              </div>

              <Separator />

              {/* Keep aspect toggle */}
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={keepAspect} onChange={e => setKeepAspect(e.target.checked)} className="h-3.5 w-3.5" />
                Keep card aspect ratio (no stretch)
              </label>

              {/* Page header text */}
              <div className="space-y-1">
                <Label className="text-xs">Page header (optional)</Label>
                <Input value={headerText} onChange={e => setHeaderText(e.target.value)}
                  placeholder="e.g. ABC College — Student ID Cards 2026" className="h-7 text-xs" />
              </div>

              {/* Page numbers toggle */}
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={showPageNumbers} onChange={e => setShowPageNumbers(e.target.checked)} className="h-3.5 w-3.5" />
                Show page numbers (Page N of M)
              </label>

              {/* Computed info */}
              <div className="rounded-lg bg-muted/50 border p-2 text-xs space-y-0.5 text-muted-foreground">
                <p><span className="font-semibold text-foreground">{perPage}</span> cards/page · <span className="font-semibold text-foreground">{totalPages}</span> pages total</p>
                <p>Card cell: {cellW.toFixed(1)} × {cellH.toFixed(1)} mm</p>
                <p>Template aspect: {(template.cardWidth / template.cardHeight).toFixed(2)} · Cell aspect: {(cellW / cellH).toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Pre-flight panel */}
          {step === 'preflight' && preflight && (
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardContent className="pt-4 pb-4 px-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <CreditCard className="h-4 w-4 text-primary" />Credit Summary
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-background border p-2">
                    <p className="text-[10px] text-muted-foreground">Users</p>
                    <p className="text-xl font-bold">{preflight.userCount}</p>
                  </div>
                  <div className="rounded-lg bg-background border p-2">
                    <p className="text-[10px] text-muted-foreground">Cost/user</p>
                    <p className="text-xl font-bold">{preflight.unitCost.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg bg-background border p-2">
                    <p className="text-[10px] text-muted-foreground">Total</p>
                    <p className="text-xl font-bold text-primary">{preflight.totalCost.toFixed(2)}</p>
                  </div>
                  <div className={`rounded-lg bg-background border p-2 ${!preflight.sufficient ? 'border-red-300 bg-red-50' : ''}`}>
                    <p className="text-[10px] text-muted-foreground">Balance</p>
                    <p className={`text-xl font-bold ${preflight.sufficient ? 'text-green-600' : 'text-red-600'}`}>{preflight.balance.toFixed(2)}</p>
                  </div>
                </div>
                {!preflight.sufficient && (
                  <div className="flex items-center gap-2 p-2 rounded border border-red-200 bg-red-50 text-red-700 text-xs">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />Insufficient credits.
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={generate} disabled={!preflight.sufficient || generating}
                    className="gap-1.5 h-8 text-xs px-4" size="sm">
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    Generate PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setStep('layout'); setPreflight(null); }} className="h-8 text-xs px-3">
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate button */}
          {(step === 'layout' || step === 'done') && (
            <Button onClick={runPreflight} disabled={loadingPreflight || generating || targetUsers.length === 0}
              className="gap-2 w-full h-9 text-sm">
              {loadingPreflight
                ? <><Loader2 className="h-4 w-4 animate-spin" />Checking cost…</>
                : <><FileText className="h-4 w-4" />Check cost &amp; generate {outputType === 'PRINT' ? 'print PDF' : 'PDF'}</>
              }
            </Button>
          )}

          {/* Progress */}
          {progress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Rendering cards…</span><span>{progress.done}/{progress.total}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
              </div>
            </div>
          )}

          {step === 'done' && !generating && (
            <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
              <CheckCircle2 className="h-4 w-4" />PDF downloaded.
            </div>
          )}
        </div>

        {/* ── Right: preview ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="py-2.5 px-3">
            <CardTitle className="text-xs sm:text-sm flex items-center gap-2"><Grid className="h-4 w-4" />Preview</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {/* Page preview rendered in CSS — mirrors the actual PDF layout */}
            <div className="w-full overflow-x-auto">
              <div className="relative border border-dashed border-border/60 rounded bg-white mx-auto"
                style={{ width: '100%', maxWidth: 300, aspectRatio: `${page.w}/${page.h}` }}>

                {/* Header band */}
                {headerText && (
                  <div className="absolute left-0 right-0 flex items-center justify-center text-center px-1"
                    style={{ top: `${marginMm / page.h * 100}%`, height: `${headerH / page.h * 100}%` }}>
                    <span className="text-[7px] font-semibold text-gray-700 truncate">{headerText}</span>
                  </div>
                )}

                {/* Card slots — full cols×rows grid */}
                {Array.from({ length: perPage }).map((_, i) => {
                  const col = i % cols;
                  const row = Math.floor(i / cols);
                  const gridTop = marginMm + headerH;
                  // Cell rect (in mm → %)
                  const cellLmm = marginMm + col * (cellW + gapMm);
                  const cellTmm = gridTop + row * (cellH + gapMm);
                  // Apply scale + aspect exactly like the PDF builder
                  const scale = Math.min(100, Math.max(20, cardScale)) / 100;
                  let drawW = cellW * scale, drawH = cellH * scale;
                  if (keepAspect) {
                    const cellAspect = drawW / drawH;
                    if (tplAspect > cellAspect) drawH = drawW / tplAspect;
                    else                        drawW = drawH * tplAspect;
                  }
                  const xmm = cellLmm + (cellW - drawW) / 2;
                  const ymm = cellTmm + (cellH - drawH) / 2;
                  const hasUser = i < targetUsers.length;
                  return (
                    <div key={i} style={{
                      position: 'absolute',
                      left: `${xmm / page.w * 100}%`, top: `${ymm / page.h * 100}%`,
                      width: `${drawW / page.w * 100}%`, height: `${drawH / page.h * 100}%`,
                    }}>
                      <div className="absolute inset-0 rounded-sm border border-border/40 overflow-hidden flex items-center justify-center"
                        style={{ background: hasUser ? (template.backgroundImageUrl ? `url(${template.backgroundImageUrl}) center/cover` : 'linear-gradient(135deg,#1a237e,#283593)') : '#f3f4f6' }}>
                        {hasUser
                          ? <span className="text-[6px] text-white/70 font-medium">{targetUsers[i]?.name?.slice(0, 10)}</span>
                          : <span className="text-[6px] text-muted-foreground">·</span>
                        }
                      </div>
                    </div>
                  );
                })}

                {/* Page number band */}
                {showPageNumbers && (
                  <div className="absolute left-0 right-0 flex items-center justify-center"
                    style={{ bottom: 0, height: `${footerH / page.h * 100}%` }}>
                    <span className="text-[6px] text-gray-400">Page 1 of {totalPages}</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              {orientation === 'landscape' ? `${base.label} (landscape)` : page.label} · {cols}×{rows} · {perPage}/page · {totalPages} page(s)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CardPdfLayoutPage;
