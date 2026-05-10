import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  X, GripHorizontal, Maximize2, Minimize2, PanelRightClose, PanelRightOpen,
  FileText, ExternalLink, Cloud, HardDrive, Link2, RotateCw, Lock, Smartphone,
  ChevronDown, ChevronUp, User as UserIcon,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getImageUrl } from '@/utils/imageUrlHelper';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VideoPreviewMaterial {
  documentName: string;
  documentUrl: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  source: 'S3' | 'GOOGLE_DRIVE' | 'GOOGLE_DRIVE_INSTITUTE' | 'EXTERNAL_LINK';
}

interface WatermarkData {
  id: string;
  text: string;
  top: number;
  left: number;
  opacity: number;
}

interface VideoPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
  description?: string;
  materials?: VideoPreviewMaterial[];
  /** Override default cinema mode on open. Defaults: mobile=cinema, desktop=floating. */
  defaultMode?: 'floating' | 'cinema';
}

type ViewMode = 'floating' | 'cinema';

const MIN_W = 280;
const MIN_H = 200;
const DEFAULT_W = 1120;
const DEFAULT_H = 720;

// ── Helpers ───────────────────────────────────────────────────────────────────

const isMobileDevice = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

const getEmbedUrl = (url: string): string | null => {
  if (!url) return null;

  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    // Lock down YouTube chrome: no related videos, no modest branding info, no keyboard shortcuts,
    // no fullscreen button (we provide our own), no share button via rel=0.
    const id = youtubeMatch[1];
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      showinfo: '0',
      controls: '1',
      disablekb: '1',
      fs: '0',
      iv_load_policy: '3',
      cc_load_policy: '0',
    });
    return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
  }

  if (url.includes('drive.google.com')) {
    const a = url.match(/\/file\/d\/([^\/]+)/);
    const b = url.match(/[?&]id=([^&]+)/);
    const m = a || b;
    if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    if (url.includes('/preview')) return url;
  }

  return null;
};

const sourceIcon = (source: VideoPreviewMaterial['source']) => {
  switch (source) {
    case 'GOOGLE_DRIVE':
    case 'GOOGLE_DRIVE_INSTITUTE':
      return <HardDrive className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    case 'S3':
      return <Cloud className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
    default:
      return <Link2 className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
  }
};

const sourceLabel = (source: VideoPreviewMaterial['source']) => {
  switch (source) {
    case 'GOOGLE_DRIVE': return 'Personal Drive';
    case 'GOOGLE_DRIVE_INSTITUTE': return 'Institute Drive';
    case 'S3': return 'Cloud';
    default: return 'External';
  }
};

const userInitials = (name?: string, email?: string) => {
  const s = (name || email || '?').trim();
  return s.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
};

// ── Logo overlay ──────────────────────────────────────────────────────────────

const VideoOverlayLogo = ({ logoUrl, instituteName }: { logoUrl: string; instituteName?: string }) => (
  <div
    className="absolute right-3 top-3 z-40 h-12 w-12 rounded-xl border border-border/60 bg-background/95 p-1.5 shadow-lg backdrop-blur-sm"
    onMouseDown={(e) => e.stopPropagation()}
    onTouchStart={(e) => e.stopPropagation()}
    onClick={(e) => e.stopPropagation()}
    aria-hidden="true"
  >
    <img
      src={logoUrl}
      alt={instituteName ? `${instituteName} logo` : 'Institute logo'}
      className="h-full w-full rounded-lg object-cover"
      draggable={false}
    />
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

const VideoPreviewDialog = ({
  open, onOpenChange, url, title,
  description, materials, defaultMode,
}: VideoPreviewDialogProps) => {
  const { user, selectedInstitute } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  const instituteLogoUrl = useMemo(() => {
    const raw = selectedInstitute?.logo
      || (selectedInstitute as any)?.logoUrl
      || (selectedInstitute as any)?.instituteLogo
      || '';
    return raw ? getImageUrl(raw) : '';
  }, [selectedInstitute]);

  const userImageUrl = useMemo(() => {
    const raw = (user as any)?.imageUrl || '';
    return raw ? getImageUrl(raw) : '';
  }, [user]);

  const userDisplayName = useMemo(() => {
    return (user as any)?.nameWithInitials || (user as any)?.name || user?.email || 'Student';
  }, [user]);

  // ── View mode (floating vs cinema) ────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('floating');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showRotatePrompt, setShowRotatePrompt] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  // ── Floating panel position and size ─────────────────────────────────────
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const [interacting, setInteracting] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPX: number; startPY: number } | null>(null);
  const resizeRef = useRef<{
    handle: string;
    startX: number; startY: number;
    startW: number; startH: number;
    startPX: number; startPY: number;
  } | null>(null);

  // ── Watermark / user info ────────────────────────────────────────────────
  const [watermarks, setWatermarks] = useState<WatermarkData[]>([]);
  const [userInfo, setUserInfo] = useState({
    ip: '',
    location: '',
    timestamp: new Date().toLocaleString(),
  });

  const embedUrl = useMemo(() => getEmbedUrl(url), [url]);
  const [loaded, setLoaded] = useState(false);
  const [fallback, setFallback] = useState(false);
  const loadedRef = useRef(false);

  // ── Pick initial mode based on device ────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setViewMode(defaultMode ?? (isMobileDevice() ? 'cinema' : 'floating'));
    setSidebarOpen(!isMobileDevice());
    if (isMobileDevice() && window.matchMedia('(orientation: portrait)').matches) {
      setShowRotatePrompt(true);
    }
  }, [open, defaultMode]);

  // ── Track orientation: hide rotate prompt once landscape ─────────────────
  useEffect(() => {
    if (!open) return;
    const mql = window.matchMedia('(orientation: landscape)');
    const handler = () => setShowRotatePrompt(!mql.matches && isMobileDevice());
    handler();
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else mql.removeListener(handler);
    };
  }, [open]);

  // ── Reset iframe load state on URL change ───────────────────────────────
  useEffect(() => {
    setLoaded(false);
    setFallback(false);
    loadedRef.current = false;
    if (!embedUrl) return;
    const t = window.setTimeout(() => {
      if (!loadedRef.current) setFallback(true);
    }, 2500);
    return () => window.clearTimeout(t);
  }, [embedUrl, open]);

  const shouldUseIframe = !!embedUrl && !fallback;

  // ── Anti-copy / anti-inspect handlers ────────────────────────────────────
  const handleContextMenu = (e: React.MouseEvent | React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };
  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // ── Fetch user IP and location once per open ─────────────────────────────
  useEffect(() => {
    if (!open) return;
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => {
        setUserInfo(prev => ({ ...prev, ip: data.ip }));
        return fetch(`https://ipapi.co/${data.ip}/json/`);
      })
      .then(res => res.json())
      .then(data => {
        setUserInfo(prev => ({
          ...prev,
          location: `${data.city || ''}, ${data.country_name || ''}`.trim(),
        }));
      })
      .catch(() => { });
  }, [open]);

  // ── Rolling watermarks ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setWatermarks([]);
      return;
    }
    const generate = () => {
      const parts = [
        userInfo.ip,
        userInfo.location,
        user?.email || 'User',
        new Date().toLocaleTimeString(),
        `ID: ${user?.id?.substring(0, 8) || 'XXXX'}`,
      ].filter(Boolean);
      const text = parts[Math.floor(Math.random() * parts.length)];
      return {
        id: Math.random().toString(36),
        text,
        top: Math.random() * 80 + 10,
        left: Math.random() * 80 + 10,
        opacity: Math.random() * 0.12 + 0.14,
      };
    };
    setWatermarks([generate()]);
    const t = window.setInterval(() => setWatermarks([generate()]), 6000);
    return () => window.clearInterval(t);
  }, [open, userInfo, user]);

  // ── Block keyboard shortcuts (DevTools, copy, save, view-source) ─────────
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // F12
    if (e.keyCode === 123) {
      e.preventDefault();
      toast({ title: 'Action blocked', variant: 'destructive' });
      return false;
    }
    // Ctrl+Shift+I / J / C
    if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
      e.preventDefault();
      toast({ title: 'Action blocked', variant: 'destructive' });
      return false;
    }
    // Ctrl+U (view source)
    if (e.ctrlKey && e.keyCode === 85) {
      e.preventDefault();
      toast({ title: 'Action blocked', variant: 'destructive' });
      return false;
    }
    // Ctrl+S (save)
    if (e.ctrlKey && e.keyCode === 83) {
      e.preventDefault();
      toast({ title: 'Action blocked', variant: 'destructive' });
      return false;
    }
    // Ctrl+P (print)
    if (e.ctrlKey && e.keyCode === 80) {
      e.preventDefault();
      toast({ title: 'Action blocked', variant: 'destructive' });
      return false;
    }
    // PrintScreen
    if (e.keyCode === 44) {
      e.preventDefault();
      toast({ title: 'Action blocked', variant: 'destructive' });
      return false;
    }
    // Ctrl+C anywhere inside dialog — already blocked by copy event, but block early too
    if (e.ctrlKey && (e.keyCode === 67 || e.keyCode === 88)) {
      // Allow only if focus is on a benign input outside dialog (we always block while dialog open)
      e.preventDefault();
      return false;
    }
  }, []);

  const blockContextMenu = useCallback((e: Event) => { e.preventDefault(); }, []);
  const blockCopy = useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    try { e.clipboardData?.setData('text/plain', ''); } catch { }
    toast({ title: 'Copying disabled while watching', variant: 'destructive' });
  }, []);
  const blockCut = useCallback((e: ClipboardEvent) => { e.preventDefault(); }, []);
  const blockPaste = useCallback((e: ClipboardEvent) => { e.preventDefault(); }, []);
  const blockDrag = useCallback((e: DragEvent) => { e.preventDefault(); }, []);
  const blockSelect = useCallback((e: Event) => { e.preventDefault(); }, []);

  useEffect(() => {
    if (!open) return;

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', blockContextMenu as EventListener);
    document.addEventListener('copy', blockCopy as EventListener);
    document.addEventListener('cut', blockCut as EventListener);
    document.addEventListener('paste', blockPaste as EventListener);
    document.addEventListener('dragstart', blockDrag as EventListener);
    document.addEventListener('selectstart', blockSelect as EventListener);

    document.body.style.userSelect = 'none';
    (document.body.style as any).webkitUserSelect = 'none';
    (document.body.style as any).msUserSelect = 'none';
    document.body.style.overflow = 'hidden';

    // Clear clipboard on open to wipe any pre-copied YouTube share URL
    try { navigator.clipboard?.writeText('').catch(() => { }); } catch { }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', blockContextMenu as EventListener);
      document.removeEventListener('copy', blockCopy as EventListener);
      document.removeEventListener('cut', blockCut as EventListener);
      document.removeEventListener('paste', blockPaste as EventListener);
      document.removeEventListener('dragstart', blockDrag as EventListener);
      document.removeEventListener('selectstart', blockSelect as EventListener);
      document.body.style.userSelect = '';
      (document.body.style as any).webkitUserSelect = '';
      (document.body.style as any).msUserSelect = '';
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown, blockContextMenu, blockCopy, blockCut, blockPaste, blockDrag, blockSelect]);

  // ── Hide content when window loses focus (basic anti-screenshare) ────────
  const [obscured, setObscured] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onBlur = () => setObscured(true);
    const onFocus = () => setObscured(false);
    const onVis = () => setObscured(document.visibilityState !== 'visible');
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [open]);

  // ── Inject one-shot @media print rule that hides everything ──────────────
  useEffect(() => {
    if (!open) return;
    const style = document.createElement('style');
    style.setAttribute('data-video-preview-print', 'true');
    style.textContent = `@media print { body * { visibility: hidden !important; } body::after { content: 'Printing disabled during secure playback'; visibility: visible; position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 24px; }}`;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [open]);

  // ── Centre & size the floating panel when it opens / mode changes ────────
  useEffect(() => {
    if (!open || viewMode !== 'floating') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(DEFAULT_W, vw - 40);
    const h = Math.min(DEFAULT_H, vh - 48);
    setSize({ w, h });
    setPos({ x: Math.max(0, (vw - w) / 2), y: Math.max(0, (vh - h) / 2) });
  }, [open, viewMode]);

  // ── Drag & resize for floating mode ──────────────────────────────────────
  useEffect(() => {
    if (!open || viewMode !== 'floating') return;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const onMove = (cx: number, cy: number) => {
      if (dragRef.current) {
        const { startX, startY, startPX, startPY } = dragRef.current;
        const maxX = Math.max(0, window.innerWidth - size.w);
        const maxY = Math.max(0, window.innerHeight - size.h);
        setPos({
          x: clamp(startPX + (cx - startX), 0, maxX),
          y: clamp(startPY + (cy - startY), 0, maxY),
        });
      }
      if (resizeRef.current) {
        const { handle, startX, startY, startW, startH, startPX, startPY } = resizeRef.current;
        const dx = cx - startX;
        const dy = cy - startY;
        let nw = startW, nh = startH, nx = startPX, ny = startPY;
        if (handle.includes('e')) nw = Math.max(MIN_W, startW + dx);
        if (handle.includes('s')) nh = Math.max(MIN_H, startH + dy);
        if (handle.includes('w')) { nw = Math.max(MIN_W, startW - dx); nx = startPX + (startW - nw); }
        if (handle.includes('n')) { nh = Math.max(MIN_H, startH - dy); ny = startPY + (startH - nh); }
        nw = clamp(nw, MIN_W, window.innerWidth);
        nh = clamp(nh, MIN_H, window.innerHeight);
        const maxX = Math.max(0, window.innerWidth - nw);
        const maxY = Math.max(0, window.innerHeight - nh);
        nx = clamp(nx, 0, maxX);
        ny = clamp(ny, 0, maxY);
        setSize({ w: nw, h: nh });
        setPos({ x: nx, y: ny });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
      setInteracting(false);
    };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (dragRef.current || resizeRef.current) e.preventDefault();
      if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onPointerMove = (e: PointerEvent) => onMove(e.clientX, e.clientY);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onUp);
    document.addEventListener('touchcancel', onUp);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [open, size.w, size.h, viewMode]);

  const startDrag = useCallback((cx: number, cy: number) => {
    dragRef.current = { startX: cx, startY: cy, startPX: pos.x, startPY: pos.y };
    setInteracting(true);
  }, [pos]);

  const handleTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (viewMode !== 'floating') return;
    e.preventDefault(); e.stopPropagation();
    startDrag(e.clientX, e.clientY);
  };
  const handleTitleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (viewMode !== 'floating' || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    startDrag(e.clientX, e.clientY);
  };
  const handleTitleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (viewMode !== 'floating') return;
    const t = e.touches[0];
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    startDrag(t.clientX, t.clientY);
  };

  const startResize = (handle: string) => (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const cx = 'touches' in e ? e.touches[0].clientX : (e as any).clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : (e as any).clientY;
    resizeRef.current = { handle, startX: cx, startY: cy, startW: size.w, startH: size.h, startPX: pos.x, startPY: pos.y };
    setInteracting(true);
  };

  // ── Cinema mode actions ──────────────────────────────────────────────────
  const enterCinema = useCallback(async () => {
    setViewMode('cinema');
    setSidebarOpen(!isMobileDevice());
    try {
      if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      }
      const so: any = (screen as any).orientation;
      if (so?.lock && isMobileDevice()) {
        try { await so.lock('landscape'); } catch { }
      }
    } catch { }
  }, []);

  const exitCinema = useCallback(async () => {
    setViewMode('floating');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      const so: any = (screen as any).orientation;
      if (so?.unlock) try { so.unlock(); } catch { }
    } catch { }
  }, []);

  // If user exits browser fullscreen via Esc, return to floating
  useEffect(() => {
    if (!open) return;
    const handler = () => {
      if (!document.fullscreenElement && viewMode === 'cinema') {
        setViewMode('floating');
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [open, viewMode]);

  // Reset desc-expanded when closing
  useEffect(() => { if (!open) setDescExpanded(false); }, [open]);

  // ── Material click safety — open in new tab, no copy ─────────────────────
  const openMaterial = (m: VideoPreviewMaterial) => (e: React.MouseEvent) => {
    e.preventDefault();
    const link = m.driveWebViewLink || m.documentUrl;
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  if (!open) return null;

  // ── Shared content blocks ────────────────────────────────────────────────

  const VideoBlock = (
    <div
      className="relative w-full h-full rounded-lg overflow-hidden select-none"
      style={{ userSelect: 'none' }}
      onContextMenu={handleContextMenu}
    >
      {shouldUseIframe ? (
        <iframe
          src={embedUrl!}
          title={title || 'Video'}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          onLoad={() => { loadedRef.current = true; setLoaded(true); }}
          allowFullScreen={false}
          style={{ border: 'none', pointerEvents: interacting ? 'none' : 'auto' }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
          <p className="text-muted-foreground text-sm">Unable to preview this video format</p>
        </div>
      )}

      {interacting && <div className="absolute inset-0 z-20" />}

      {instituteLogoUrl && (
        <VideoOverlayLogo logoUrl={instituteLogoUrl} instituteName={selectedInstitute?.name} />
      )}

      {/* Pointer-events overlay protects against right-click via overlay + drag */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      />

      {/* Watermarks */}
      {watermarks.map(mark => (
        <div
          key={mark.id}
          className="absolute z-30 rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/90 font-mono pointer-events-none select-none"
          style={{
            top: `${mark.top}%`,
            left: `${mark.left}%`,
            opacity: mark.opacity,
            textShadow: '0 1px 1px rgba(0,0,0,0.6)',
            userSelect: 'none',
          }}
        >
          {mark.text}
        </div>
      ))}

      {/* Centre student-id watermark — always-visible */}
      <div
        className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center"
        style={{ userSelect: 'none' }}
      >
        <div className="text-white/[0.07] text-3xl sm:text-5xl font-bold tracking-widest rotate-[-12deg] text-center leading-tight">
          {userDisplayName}<br />
          <span className="text-base sm:text-2xl">{user?.email}</span>
        </div>
      </div>

      {/* Hide content when window loses focus (anti-screen-share) */}
      {obscured && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center text-white gap-2">
          <Lock className="h-8 w-8" />
          <p className="text-sm">Playback paused — return focus to continue</p>
        </div>
      )}

      {/* Mobile: rotate-for-fullscreen prompt */}
      {showRotatePrompt && viewMode === 'cinema' && (
        <button
          type="button"
          onClick={() => setShowRotatePrompt(false)}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 bg-black/80 text-white text-xs rounded-full px-3 py-1.5 backdrop-blur-sm border border-white/10"
        >
          <Smartphone className="h-3.5 w-3.5" />
          <RotateCw className="h-3.5 w-3.5 animate-spin-slow" />
          Rotate for full screen
        </button>
      )}
    </div>
  );

  const Sidebar = (
    <aside
      className="flex flex-col h-full w-full sm:w-[320px] bg-card border-l border-border overflow-hidden"
      onContextMenu={handleContextMenu}
      onCopy={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Student identity card */}
      <div className="flex items-center gap-2.5 p-3 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
        {userImageUrl ? (
          <img
            src={userImageUrl}
            alt={userDisplayName}
            className="h-10 w-10 rounded-full object-cover border border-border shrink-0"
            draggable={false}
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
            {userInitials((user as any)?.name, user?.email)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{userDisplayName}</p>
          <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
            <Lock className="h-2.5 w-2.5" /> Secure session
          </p>
        </div>
      </div>

      {/* Description */}
      {description && (
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</h4>
            <button
              type="button"
              onClick={() => setDescExpanded(s => !s)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={descExpanded ? 'Collapse description' : 'Expand description'}
            >
              {descExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className={`text-xs text-foreground/80 leading-relaxed mt-1.5 ${descExpanded ? '' : 'line-clamp-3'}`}>
            {description}
          </p>
        </div>
      )}

      {/* Materials */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 border-b border-border sticky top-0 bg-card z-10">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Materials {materials && materials.length > 0 && (
              <span className="ml-1 text-[10px] font-medium text-muted-foreground/70">({materials.length})</span>
            )}
          </h4>
        </div>
        {materials && materials.length > 0 ? (
          <ul className="p-2 space-y-1.5">
            {materials.map((m, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={openMaterial(m)}
                  onContextMenu={handleContextMenu}
                  onCopy={(e) => e.preventDefault()}
                  onAuxClick={(e) => e.preventDefault()}
                  className="w-full flex items-center gap-2 p-2 rounded-md border border-border/50 hover:bg-muted/60 hover:border-border transition-colors text-left group"
                >
                  {sourceIcon(m.source)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{m.documentName}</p>
                    <p className="text-[10px] text-muted-foreground">{sourceLabel(m.source)}</p>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No reference materials.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 border-t border-border bg-muted/30 text-[10px] text-muted-foreground/80 leading-tight space-y-0.5">
        <p className="flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> Copy, screenshot &amp; download disabled</p>
        <p className="truncate">Session: {userInfo.ip || 'detecting…'} · {new Date().toLocaleDateString()}</p>
      </div>
    </aside>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  if (viewMode === 'cinema') {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-[100] bg-black flex flex-col"
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
        style={{ userSelect: 'none' }}
      >
        {/* Top bar */}
        <header className="flex items-center justify-between gap-2 px-3 py-2 bg-black/90 text-white border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {instituteLogoUrl ? (
              <img src={instituteLogoUrl} alt="Logo" className="h-6 w-6 rounded object-cover shrink-0" draggable={false} />
            ) : (
              <Lock className="h-4 w-4 text-white/70 shrink-0" />
            )}
            <span className="text-sm font-medium truncate">{title || 'Recording'}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(s => !s)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={exitCinema}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              title="Exit cinema mode"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0">
          <div className="flex-1 p-2 sm:p-3 min-h-0">{VideoBlock}</div>

          {sidebarOpen && (
            <div className="h-[40vh] sm:h-auto sm:w-[320px] shrink-0 border-t sm:border-t-0 sm:border-l border-white/10 bg-card text-foreground">
              {Sidebar}
            </div>
          )}
        </div>
      </div>
    );
  }

  // floating mode
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} />

      <div
        ref={containerRef}
        className="fixed z-50 flex bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
        style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
        onContextMenu={handleContextMenu}
        onDragStart={handleDragStart}
      >
        {/* Main column */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Title bar */}
          <div
            className="flex items-center justify-between pl-3 pr-2 py-2 border-b border-border bg-muted/40 shrink-0 select-none touch-none"
            style={{ cursor: interacting ? 'grabbing' : 'grab' }}
            onPointerDown={handleTitlePointerDown}
            onMouseDown={handleTitleMouseDown}
            onTouchStart={handleTitleTouchStart}
          >
            <div className="flex items-center gap-2 min-w-0">
              {instituteLogoUrl ? (
                <img
                  src={instituteLogoUrl}
                  alt={selectedInstitute?.name || 'Logo'}
                  className="h-6 w-6 rounded-md object-cover border border-border/60 bg-background shrink-0"
                  onMouseDown={e => e.stopPropagation()}
                  onTouchStart={e => e.stopPropagation()}
                  draggable={false}
                />
              ) : (
                <GripHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className="text-sm font-semibold truncate">{title || 'Video Preview'}</span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0 ml-2">
              <button
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setSidebarOpen(s => !s); }}
                title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              >
                {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </button>
              <button
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); enterCinema(); }}
                title="Cinema mode"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onOpenChange(false); }}
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Video */}
          <div
            className="flex-1 p-2.5 overflow-hidden relative min-h-0"
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onContextMenu={handleContextMenu}
            onDragStart={handleDragStart}
          >
            {VideoBlock}
            {!loaded && shouldUseIframe && (
              <div className="absolute inset-2.5 z-20 flex items-center justify-center bg-muted/80 rounded-lg pointer-events-none">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-primary" />
              </div>
            )}
            {!embedUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                <p className="text-muted-foreground text-sm">Unable to preview this video format</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar (desktop floating) */}
        {sidebarOpen && (description || (materials && materials.length > 0)) && (
          <div className="hidden md:flex shrink-0 w-[300px]">{Sidebar}</div>
        )}

        {/* Resize handles */}
        <div className="absolute right-0 top-10 bottom-4 w-2 cursor-ew-resize z-40 hover:bg-primary/10 transition-colors" onPointerDown={startResize('e')} />
        <div className="absolute left-0 top-10 bottom-4 w-2 cursor-ew-resize z-40 hover:bg-primary/10 transition-colors" onPointerDown={startResize('w')} />
        <div className="absolute bottom-0 left-4 right-4 h-2 cursor-ns-resize z-40 hover:bg-primary/10 transition-colors" onPointerDown={startResize('s')} />
        <div className="absolute top-10 left-4 right-4 h-1 cursor-ns-resize z-40" onPointerDown={startResize('n')} />
        <div
          className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-50 flex items-end justify-end pr-0.5 pb-0.5"
          onPointerDown={startResize('se')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-muted-foreground/50" fill="none">
            <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 w-5 h-5 cursor-nesw-resize z-50" onPointerDown={startResize('sw')} />
        <div className="absolute top-10 right-0 w-4 h-4 cursor-nesw-resize z-50" onPointerDown={startResize('ne')} />
        <div className="absolute top-10 left-0 w-4 h-4 cursor-nwse-resize z-50" onPointerDown={startResize('nw')} />
      </div>
    </>
  );
};

export default VideoPreviewDialog;
