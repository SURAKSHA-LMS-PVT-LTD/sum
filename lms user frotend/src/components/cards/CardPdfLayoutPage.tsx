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

async function renderCard(tpl: CardTemplate, user: InstituteUser, userImg: string | null, bg: string | null, ov: string | null): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  const fonts = new Set<string>();
  for (const el of tpl.elements) if (el.type === 'text') fonts.add(el.fontFamily);
  await Promise.all([...fonts].map(ensureFontLoaded));

  const W = tpl.cardWidth, H = tpl.cardHeight;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-${W * 4}px;top:0;width:${W}px;height:${H}px;overflow:hidden;`;
  document.body.appendChild(host);

  try {
    const bgDiv = document.createElement('div');
    bgDiv.style.cssText = `position:absolute;inset:0;${bg ? `background:url(${bg}) center/cover no-repeat` : 'background:linear-gradient(135deg,#1a237e,#283593)'};`;
    host.appendChild(bgDiv);

    for (const el of tpl.elements) {
      if (el.type === 'image') {
        const wrap = document.createElement('div');
        wrap.style.cssText = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}%;padding-bottom:${el.height}%;`;
        const inner = document.createElement('div');
        inner.style.cssText = `position:absolute;inset:0;border-radius:${el.shape==='circle'?'50%':'6px'};border:${el.borderWidth}px solid ${el.borderColor};overflow:hidden;background:#aaa;`;
        if (userImg) { const img = document.createElement('img'); img.src = userImg; img.style.cssText='width:100%;height:100%;object-fit:cover;'; inner.appendChild(img); }
        wrap.appendChild(inner); host.appendChild(wrap);
      } else {
        const div = document.createElement('div');
        div.style.cssText = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.width}%;font-size:${el.fontSize}px;font-family:'${el.fontFamily}',sans-serif;color:${el.color};font-weight:${el.bold?'bold':'normal'};font-style:${el.italic?'italic':'normal'};text-align:${el.align};white-space:pre-wrap;line-height:1.3;`;
        div.textContent = resolveTokens(el.content, user);
        host.appendChild(div);
      }
    }
    if (ov) { const img = document.createElement('img'); img.src=ov; img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;'; host.appendChild(img); }

    await new Promise(r => setTimeout(r, 80));
    return await html2canvas(host, { width: W, height: H, scale: 2, useCORS: true, allowTaint: false, backgroundColor: null, logging: false });
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
  onBack: () => void;
}

const CardPdfLayoutPage: React.FC<CardPdfLayoutPageProps> = ({
  template, apiTemplate, users, selectedUserIds, onBack,
}) => {
  const { toast } = useToast();
  const { currentInstituteId } = useAuth();

  // Layout settings
  const [pageSize, setPageSize] = useState<keyof typeof PAGE_SIZES>('A4');
  const [cols, setCols] = useState(2);
  const [rows, setRows] = useState(4);
  const [marginMm, setMarginMm] = useState(10);
  const [gapMm, setGapMm] = useState(4);

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

  // Derived dimensions
  const page = PAGE_SIZES[pageSize];
  const cardAreaW = page.w - 2 * marginMm;
  const cardAreaH = page.h - 2 * marginMm;
  const cellW = (cardAreaW - (cols - 1) * gapMm) / cols;
  const cellH = (cardAreaH - (rows - 1) * gapMm) / rows;
  const perPage = cols * rows;
  const totalPages = Math.ceil(targetUsers.length / perPage);

  // ── Pre-flight ─────────────────────────────────────────────────────────────
  const runPreflight = async () => {
    if (!currentInstituteId) return;
    setLoadingPreflight(true);
    try {
      const result = await instituteDesignsApi.previewCost(
        currentInstituteId, template.id, 'PDF', targetUsers.map(u => u.id),
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
        currentInstituteId, template.id, 'PDF', targetUsers.map(u => u.id),
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
    let okCount = 0, failCount = 0;
    for (let i = 0; i < targetUsers.length; i++) {
      if (abortRef.current) break;
      const user = targetUsers[i];
      try {
        const rawImg = user.imageUrl ? getImageUrl(user.imageUrl) : '';
        const userImg = rawImg ? (userImgCache.get(rawImg) ?? null) : null;
        const canvas = await renderCard(tplFromServer, user, userImg, bgData, ovData);
        canvases.push({ canvas, ok: true });
        okCount++;
      } catch {
        canvases.push({ canvas: document.createElement('canvas'), ok: false });
        failCount++;
      }
      setProgress({ done: i + 1, total: targetUsers.length });
    }

    // 3. Build PDF
    try {
      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: page.w > page.h ? 'l' : 'p', unit: 'mm', format: [page.w, page.h] });
      let pageIdx = 0;

      for (let i = 0; i < canvases.length; i++) {
        const slot = i % perPage;
        if (slot === 0 && i > 0) { pdf.addPage(); pageIdx++; }
        const col = slot % cols;
        const row = Math.floor(slot / cols);
        const x = marginMm + col * (cellW + gapMm);
        const y = marginMm + row * (cellH + gapMm);
        const { canvas } = canvases[i];
        if (canvas.width > 0 && canvas.height > 0) {
          const imgData = canvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', x, y, cellW, cellH);
        }
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

  // ── Preview grid (CSS only, no render) ────────────────────────────────────
  const previewCols = Math.min(cols, 4);
  const previewRows = Math.min(rows, 4);

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
                : <><FileText className="h-4 w-4" />Check cost &amp; generate PDF</>
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
            {/* A page preview rendered in CSS at scaled-down size */}
            <div className="w-full overflow-x-auto">
              <div className="relative border border-dashed border-border/60 rounded bg-white mx-auto"
                style={{ width: '100%', maxWidth: 280, aspectRatio: `${page.w}/${page.h}` }}>
                {/* Grid of card slots */}
                {Array.from({ length: previewCols * previewRows }).map((_, i) => {
                  const col = i % previewCols;
                  const row = Math.floor(i / previewCols);
                  const pctL = (marginMm + col * (cellW + gapMm)) / page.w * 100;
                  const pctT = (marginMm + row * (cellH + gapMm)) / page.h * 100;
                  const pctW = cellW / page.w * 100;
                  const pctH = cellH / page.h * 100;
                  const hasUser = i < targetUsers.length;
                  return (
                    <div key={i} style={{
                      position: 'absolute',
                      left: `${pctL}%`, top: `${pctT}%`,
                      width: `${pctW}%`, height: `${pctH}%`,
                    }}>
                      <div className="absolute inset-0 rounded-sm border border-border/40 overflow-hidden flex items-center justify-center"
                        style={{ background: hasUser ? (template.backgroundImageUrl ? `url(${template.backgroundImageUrl}) center/cover` : 'linear-gradient(135deg,#1a237e,#283593)') : '#f3f4f6' }}>
                        {hasUser
                          ? <span className="text-[6px] text-white/70 font-medium">{targetUsers[i]?.name?.slice(0, 10)}</span>
                          : <span className="text-[6px] text-muted-foreground">empty</span>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              {page.label} · {cols}×{rows} grid
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CardPdfLayoutPage;
