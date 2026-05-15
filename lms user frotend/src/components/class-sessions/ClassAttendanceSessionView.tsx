import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSriLankaDateTime } from '@/utils/timezone';
import classAttendanceSessionsApi, {
  SessionDetail, SessionStudentRecord, CloseUnmarkAction,
} from '@/api/classAttendanceSessions.api';
import {
  ArrowLeft, RefreshCw, CheckCircle2, XCircle, Clock, Users,
  Lock, Search, Download, FileText, QrCode, CreditCard,
  Wifi, ChevronDown, ChevronUp, Banknote, X,
} from 'lucide-react';
import jsQR from 'jsqr';
import { Capacitor } from '@capacitor/core';
import * as XLSX from 'xlsx-js-style';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  instituteId: string;
  classId: string;
  sessionId: string;
  onBack: () => void;
}

type ScanMode = 'manual' | 'qr' | 'nfc' | 'card';
type FilterMode = 'all' | 'present' | 'absent' | 'not-marked';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_OPTS = [
  { value: 1, label: 'Present',     color: 'bg-green-100 text-green-800' },
  { value: 0, label: 'Absent',      color: 'bg-red-100 text-red-800' },
  { value: 2, label: 'Late',        color: 'bg-yellow-100 text-yellow-800' },
  { value: 3, label: 'Left',        color: 'bg-blue-100 text-blue-800' },
  { value: 4, label: 'Left Early',  color: 'bg-orange-100 text-orange-800' },
  { value: 5, label: 'Left Lately', color: 'bg-purple-100 text-purple-800' },
];

const STATUS_STYLE: Record<number, string> = {
  1: 'bg-green-100 text-green-800',
  0: 'bg-red-100 text-red-800',
  2: 'bg-yellow-100 text-yellow-800',
  3: 'bg-blue-100 text-blue-800',
  4: 'bg-orange-100 text-orange-800',
  5: 'bg-purple-100 text-purple-800',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function getThemeHex(fallback = '#4c32e9'): string {
  try {
    const hsl = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    if (!hsl) return fallback;
    const parts = hsl.replace(/%/g, '').split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return fallback;
    const [h, s, l] = [parts[0], parts[1] / 100, parts[2] / 100];
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch { return fallback; }
}

// ─── NFC availability ─────────────────────────────────────────────────────────

function nfcSupported(): boolean {
  return 'NDEFReader' in window;
}

// ─── Excel / PDF export (unchanged) ──────────────────────────────────────────

const EXCEL_STATUS: Record<number | string, { bg: string; fg: string; label: string }> = {
  1: { bg: 'C6EFCE', fg: '375623', label: 'Present' },
  0: { bg: 'FFC7CE', fg: '9C0006', label: 'Absent' },
  2: { bg: 'FFEB9C', fg: '9C5700', label: 'Late' },
  3: { bg: 'BDD7EE', fg: '1F497D', label: 'Left' },
  4: { bg: 'FFD9C0', fg: '833C00', label: 'Left Early' },
  5: { bg: 'E2D9F3', fg: '5B3896', label: 'Left Lately' },
  'null': { bg: 'F2F2F2', fg: '808080', label: 'Not Marked' },
};

const XLSX_HEADER = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
  fill: { patternType: 'solid', fgColor: { rgb: '366092' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};

function exportSessionAttendance(detail: SessionDetail) {
  const wb = XLSX.utils.book_new();
  const enc = XLSX.utils.encode_cell;
  const hasPayment = !!detail.linkedPaymentId;
  const headers = ['#', 'Student Name', 'Institute ID', 'Card ID', 'Status', 'Marked At', 'Source',
    ...(hasPayment ? ['Payment Status'] : [])];
  const rows: any[][] = [headers];
  const sorted = [...detail.students].sort((a, b) => a.studentName.localeCompare(b.studentName));
  sorted.forEach((s, idx) => {
    const statusKey = s.statusCode !== null ? s.statusCode : 'null';
    rows.push([idx + 1, s.studentName, s.userIdInstitute ?? '', s.cardId ?? '',
      EXCEL_STATUS[statusKey]?.label ?? 'Unknown', s.markedAt ?? '', 'Session',
      ...(hasPayment ? [s.paymentStatus ?? 'UNPAID'] : [])]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, ...(hasPayment ? [{ wch: 16 }] : [])];
  for (let c = 0; c < headers.length; c++) { const a = enc({ r: 0, c }); if (ws[a]) ws[a].s = XLSX_HEADER; }
  sorted.forEach((s, rowIdx) => {
    const statusKey = s.statusCode !== null ? s.statusCode : 'null';
    const ex = EXCEL_STATUS[statusKey];
    if (!ex) return;
    const a = enc({ r: rowIdx + 1, c: 4 });
    if (ws[a]) ws[a].s = { fill: { patternType: 'solid', fgColor: { rgb: ex.bg } }, font: { bold: true, color: { rgb: ex.fg }, sz: 9 }, alignment: { horizontal: 'center' } };
    if (hasPayment) {
      const pc = enc({ r: rowIdx + 1, c: 7 });
      if (ws[pc]) {
        const pStyle = s.paymentStatus === 'PAID' ? { bg: 'C6EFCE', fg: '375623' } : s.paymentStatus === 'PENDING' ? { bg: 'FFEB9C', fg: '9C5700' } : { bg: 'FFC7CE', fg: '9C0006' };
        ws[pc].s = { fill: { patternType: 'solid', fgColor: { rgb: pStyle.bg } }, font: { bold: true, color: { rgb: pStyle.fg }, sz: 9 }, alignment: { horizontal: 'center' } };
      }
    }
  });
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  XLSX.writeFile(wb, `Session_${detail.name.replace(/[^a-z0-9]/gi, '_')}_${detail.date}.xlsx`);
}

function exportSessionToPdf(detail: SessionDetail) {
  const brandColor = getThemeHex();
  const STATUS_PDF: Record<number | string, { label: string; color: string; bg: string; border: string }> = {
    1: { label: 'Present', color: '#375623', bg: '#C6EFCE', border: '#A8D5B0' },
    2: { label: 'Late', color: '#9C5700', bg: '#FFEB9C', border: '#F0D580' },
    0: { label: 'Absent', color: '#9C0006', bg: '#FFC7CE', border: '#F4A7AE' },
    3: { label: 'Left', color: '#5B3896', bg: '#E2D9F3', border: '#C9BDE8' },
    4: { label: 'Left Early', color: '#993366', bg: '#FFD9E8', border: '#F4B8D0' },
    5: { label: 'Left Lately', color: '#33338B', bg: '#D9D9FF', border: '#B8B8F0' },
    'null': { label: 'Not Marked', color: '#808080', bg: '#F5F5F5', border: '#D0D0D0' },
  };
  const sorted = [...detail.students].sort((a, b) => a.studentName.localeCompare(b.studentName));
  const rows = sorted.map((s, idx) => {
    const key = s.statusCode !== null ? s.statusCode : 'null';
    const cfg = STATUS_PDF[key] ?? STATUS_PDF['null'];
    const ini = s.studentName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    return `<tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f9f9ff'};">
      <td style="padding:8px 10px;border:1px solid #eaeaea;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:50%;background:#6a4cff;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">${ini}</div>
          <div><div style="font-weight:600;font-size:12px;">${s.studentName}</div>
          <div style="font-size:10px;color:#888;">${s.userIdInstitute ?? ''}${s.cardId ? ` · Card: ${s.cardId}` : ''}</div></div>
        </div>
      </td>
      <td style="padding:8px 10px;border:1px solid #eaeaea;text-align:center;">
        <span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.border};">${cfg.label}</span>
      </td>
      <td style="padding:8px 10px;border:1px solid #eaeaea;font-size:11px;color:#666;text-align:center;">${s.markedAt ? formatSriLankaDateTime(s.markedAt) : '—'}</td>
    </tr>`;
  }).join('');
  const attendanceRate = detail.students.length ? Math.round(((detail.presentCount + detail.lateCount) / detail.students.length) * 100) : 0;
  const rateColor = attendanceRate >= 75 ? '#00b050' : attendanceRate >= 50 ? '#ffc000' : '#e21b1b';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Session Attendance</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Segoe UI',sans-serif;background:#f4f6fb;}
.page{width:210mm;min-height:297mm;margin:20px auto;background:#fff;padding:36px;box-shadow:0 4px 24px rgba(0,0,0,.12);}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${brandColor};padding-bottom:14px;margin-bottom:22px;}
.banner{background:${brandColor};color:#fff;border-radius:8px;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}
.stats{display:flex;gap:10px;margin-bottom:20px;}.stat{flex:1;border:1px solid #e8e8e8;border-radius:6px;text-align:center;padding:14px 0;border-top-width:6px;border-top-style:solid;}
.stat .n{font-size:22px;font-weight:700;margin-bottom:4px;}.stat .l{font-size:10px;color:#888;text-transform:uppercase;}
.sc-total{border-top-color:#444;color:#444;}.sc-present{border-top-color:#00b050;color:#00b050;}.sc-absent{border-top-color:#e21b1b;color:#e21b1b;}.sc-late{border-top-color:#ffc000;color:#ffc000;}.sc-nm{border-top-color:#aaa;color:#aaa;}
.tbl-wrap{border-radius:8px;border:1px solid #ddd;margin-bottom:28px;overflow:hidden;}table{width:100%;border-collapse:collapse;font-size:12px;}
th{background:${brandColor};color:#fff;padding:10px 12px;text-align:left;}td{padding:6px 10px;border:1px solid #eaeaea;vertical-align:middle;}
.footer{border-top:1px solid #eee;padding-top:12px;display:flex;justify-content:space-between;font-size:11px;color:#bbb;}
@media print{body{background:#fff;}.page{box-shadow:none;margin:0;padding:20px;width:100%;}@page{size:A4 portrait;margin:12mm;}}</style></head>
<body><div class="page">
<div class="hdr"><div style="display:flex;align-items:center;gap:14px;">
  <div style="width:52px;height:52px;background:${brandColor};border-radius:8px;display:flex;align-items:center;justify-content:center;">
    <svg viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/></svg>
  </div>
  <div><div style="font-size:12px;color:#888;text-transform:uppercase;">Session Attendance Report</div><div style="font-size:18px;color:#222;font-weight:700;">${detail.name}</div></div>
</div>
<div style="text-align:right;font-size:13px;"><div style="font-weight:700;">${detail.date} · ${detail.startTime}${detail.endTime ? ` – ${detail.endTime}` : ''}</div>
<div style="color:#999;margin-top:4px;">Generated: ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div></div></div>
<div class="banner"><h3>👥 Attendance Report</h3><span style="color:${rateColor};background:rgba(255,255,255,.15);padding:4px 12px;border-radius:20px;font-weight:700;">Rate: ${attendanceRate}%</span></div>
<div class="stats">
  <div class="stat sc-total"><div class="n">${detail.students.length}</div><div class="l">Total</div></div>
  <div class="stat sc-present"><div class="n">${detail.presentCount}</div><div class="l">Present</div></div>
  <div class="stat sc-absent"><div class="n">${detail.absentCount}</div><div class="l">Absent</div></div>
  <div class="stat sc-late"><div class="n">${detail.lateCount}</div><div class="l">Late</div></div>
  <div class="stat sc-nm"><div class="n">${detail.notMarkedCount}</div><div class="l">Not Marked</div></div>
</div>
<div class="tbl-wrap"><table><thead><tr><th style="width:50%;">Student</th><th style="width:25%;text-align:center;">Status</th><th style="width:25%;text-align:center;">Marked At</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<div class="footer"><span>Suraksha LMS — Session Attendance Report</span><span>Printed: ${new Date().toLocaleString()}</span></div>
</div><script>window.onload=()=>{ window.print(); }<\/script></body></html>`;
  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}

// ─── Scan mode button ─────────────────────────────────────────────────────────

const ScanModeBtn = React.memo(function ScanModeBtn({
  mode, active, label, icon: Icon, onClick, disabled,
}: {
  mode: ScanMode; active: boolean; label: string; icon: React.ElementType;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all
        ${active ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card text-muted-foreground border-border hover:bg-muted'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
});

// ─── Payment badge ─────────────────────────────────────────────────────────────

const PaymentBadge = React.memo(function PaymentBadge({
  status, size = 'sm',
}: { status?: 'PAID' | 'PENDING' | 'UNPAID' | null; size?: 'sm' | 'xs' }) {
  if (!status) return null;
  const cfg =
    status === 'PAID'    ? { cls: 'bg-green-100 text-green-700 border-green-300', label: 'Paid' } :
    status === 'PENDING' ? { cls: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Pending' } :
                           { cls: 'bg-red-100 text-red-700 border-red-300', label: 'Unpaid' };
  return (
    <span className={`font-semibold rounded-full border ${cfg.cls} ${size === 'xs' ? 'text-[9px] px-1 py-0' : 'text-[10px] px-1.5 py-0.5'}`}>
      {cfg.label}
    </span>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClassAttendanceSessionView({ instituteId, classId, sessionId, onBack }: Props) {
  const navigate = useNavigate();

  // Data
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  // Scan mode
  const [scanMode, setScanMode] = useState<ScanMode>('manual');
  const [cardInput, setCardInput] = useState('');
  const [cardInputStatus, setCardInputStatus] = useState<number>(1);

  // QR scanner
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qrSnapshot, setQrSnapshot] = useState<string | null>(null);

  // NFC
  const [nfcActive, setNfcActive] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const nfcReaderRef = useRef<any>(null);

  // Filter / search
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // History panel
  const [historyOpen, setHistoryOpen] = useState(false);
  type HistoryEntry = { studentId: string; studentName: string; statusLabel: string; time: string; paymentStatus?: string | null };
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Close session dialog
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeAction, setCloseAction] = useState<CloseUnmarkAction>('KEEP_NOT_MARKED');
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await classAttendanceSessionsApi.getSessionDetail(instituteId, classId, sessionId);
      setDetail(data);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [instituteId, classId, sessionId]);

  useEffect(() => { load(); }, [load]);

  // Ref keeps scanResult handler fresh inside the rAF loop without recreating scanFrame
  const handleScanResultRef = useRef<(v: string) => void>(() => {});

  // Stop camera on unmount
  useEffect(() => () => { stopCamera(); stopNfc(); }, []);

  // ─── Camera (QR) ────────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; }
    setIsCameraOn(false);
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) { animRef.current = requestAnimationFrame(scanFrame); return; }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
    if (code?.data) {
      // Freeze snapshot
      try {
        const snap = canvas.toDataURL('image/jpeg', 0.7);
        setQrSnapshot(snap);
        setTimeout(() => { setQrSnapshot(null); animRef.current = requestAnimationFrame(scanFrame); }, 2000);
      } catch { setTimeout(() => { animRef.current = requestAnimationFrame(scanFrame); }, 2000); }
      // Use ref to always call the latest handler (avoids stale closure over `detail`)
      handleScanResultRef.current(code.data.trim());
      return;
    }
    animRef.current = requestAnimationFrame(scanFrame);
  }, []); // scanFrame never changes — it reads everything via refs

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setQrSnapshot(null);
    try {
      if (Capacitor.isNativePlatform()) {
        // Try native barcode scanner
        try {
          const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHintALLOption, CapacitorBarcodeScannerCameraDirection } = await import('@capacitor/barcode-scanner');
          const result = await CapacitorBarcodeScanner.scanBarcode({
            hint: CapacitorBarcodeScannerTypeHintALLOption.ALL,
            cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
          });
          if (result.ScanResult) handleScanResultRef.current(result.ScanResult);
          return;
        } catch { /* fall through to web camera */ }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setIsCameraOn(true);
      animRef.current = requestAnimationFrame(scanFrame);
    } catch (e: any) {
      const msg = e?.message?.includes('Permission') ? 'Camera permission denied' : (e?.message ?? 'Camera error');
      setCameraError(msg);
      toast.error(msg);
    }
  }, [scanFrame]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCamera = useCallback(() => {
    if (isCameraOn) { stopCamera(); } else { startCamera(); }
  }, [isCameraOn, stopCamera, startCamera]);

  // ─── NFC ─────────────────────────────────────────────────────────────────────

  const stopNfc = useCallback(() => {
    try { nfcReaderRef.current?.abort?.(); } catch { /* */ }
    nfcReaderRef.current = null;
    setNfcActive(false);
  }, []);

  const startNfc = useCallback(async () => {
    setNfcError(null);
    if (!nfcSupported()) {
      setNfcError('NFC not supported on this device/browser. Use Chrome on Android with NFC enabled.');
      return;
    }
    try {
      const reader = new (window as any).NDEFReader();
      nfcReaderRef.current = reader;
      await reader.scan();
      setNfcActive(true);
      reader.addEventListener('reading', ({ message, serialNumber }: any) => {
        // Use serial number (card UID) as the identifier
        let id = serialNumber ?? '';
        // Also try to read text records
        for (const record of message.records) {
          if (record.recordType === 'text') {
            const decoder = new TextDecoder(record.encoding ?? 'utf-8');
            id = decoder.decode(record.data);
            break;
          }
        }
        if (id) handleScanResultRef.current(id.trim());
      });
      reader.addEventListener('readingerror', () => {
        setNfcError('NFC read error. Hold card steady.');
      });
    } catch (e: any) {
      const msg = e?.message?.includes('permission') ? 'NFC permission denied. Enable NFC in Android settings.' : (e?.message ?? 'NFC error');
      setNfcError(msg);
      toast.error(msg);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleNfc = useCallback(() => {
    if (nfcActive) { stopNfc(); } else { startNfc(); }
  }, [nfcActive, stopNfc, startNfc]);

  // ─── Switch scan mode ─────────────────────────────────────────────────────────

  const switchMode = useCallback((m: ScanMode) => {
    // Stop previous mode
    if (scanMode === 'qr') stopCamera();
    if (scanMode === 'nfc') stopNfc();
    setScanMode(m);
    setCardInput('');
    setCameraError(null);
    setNfcError(null);
    setQrSnapshot(null);
  }, [scanMode, stopCamera, stopNfc]);

  // ─── Core scan handler ────────────────────────────────────────────────────────

  const handleScanResult = useCallback(async (scannedValue: string) => {
    if (!detail) return;
    // Find student by cardId, userIdInstitute, or studentId
    const student = detail.students.find(s =>
      (s.cardId && s.cardId === scannedValue) ||
      (s.userIdInstitute && s.userIdInstitute === scannedValue) ||
      s.studentId === scannedValue
    );
    if (!student) {
      toast.error(`No student found for: ${scannedValue}`);
      return;
    }
    await markStudent(student);
  }, [detail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep ref current so scanFrame always calls the latest version
  useEffect(() => { handleScanResultRef.current = handleScanResult; }, [handleScanResult]);

  const markStudent = useCallback(async (student: SessionStudentRecord, statusCode?: number) => {
    if (detail?.isClosed) return;
    const paymentBlocked = detail?.paymentMode === 'REQUIRED' && student.paymentStatus !== 'PAID';
    if (paymentBlocked) {
      toast.error(`Payment required for ${student.studentName}`, {
        description: 'Click "Collect Payment" to collect payment first.',
        action: {
          label: 'Collect',
          onClick: () => navigate(`/collect-payment?studentId=${student.studentId}`),
        },
      });
      return;
    }
    setSaving(student.studentId);
    try {
      await classAttendanceSessionsApi.markAttendance(instituteId, classId, sessionId, {
        studentId: student.studentId,
        ...(statusCode !== undefined ? { status: statusCode } : {}),
      });
      const label = statusCode !== undefined
        ? (STATUS_OPTS.find(s => s.value === statusCode)?.label ?? 'marked')
        : 'marked';
      toast.success(`${student.studentName} — ${label}`);
      setHistory(prev => [{
        studentId: student.studentId,
        studentName: student.studentName,
        statusLabel: label,
        time: new Date().toLocaleTimeString(),
        paymentStatus: student.paymentStatus,
      }, ...prev.slice(0, 49)]);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to mark');
    } finally {
      setSaving(null);
    }
  }, [detail, instituteId, classId, sessionId, load, navigate]);

  const handleCardSubmit = useCallback(() => {
    if (!cardInput.trim()) return;
    handleScanResult(cardInput.trim());
    setCardInput('');
  }, [cardInput, handleScanResult]);

  const handleClose = async () => {
    setClosing(true);
    try {
      await classAttendanceSessionsApi.closeSession(instituteId, classId, sessionId, { closeUnmarkAction: closeAction });
      toast.success('Session closed');
      setCloseDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to close session');
    } finally {
      setClosing(false);
    }
  };

  // ─── Filtered students ────────────────────────────────────────────────────────

  const filtered = (detail?.students ?? []).filter(s => {
    const matchSearch = search
      ? s.studentName.toLowerCase().includes(search.toLowerCase()) ||
        (s.userIdInstitute ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.cardId ?? '').toLowerCase().includes(search.toLowerCase())
      : true;
    const matchFilter =
      filterMode === 'all' ? true :
      filterMode === 'present' ? (s.statusCode === 1 || s.statusCode === 2) :
      filterMode === 'absent' ? s.statusCode === 0 :
      s.statusCode === null;
    return matchSearch && matchFilter;
  });

  // ─── NFC availability ─────────────────────────────────────────────────────────

  const nfcAvailable = nfcSupported();
  const hasPaymentLink = !!detail?.linkedPaymentId;

  // ─── Loading skeleton ─────────────────────────────────────────────────────────

  if (loading && !detail) {
    return (
      <div className="space-y-3 p-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-20 w-full" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  // ─── Main layout: fixed header + scrollable list ──────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-background border-b px-3 py-2 space-y-2">

        {/* Row 1: back + title + actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={onBack} className="px-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">{detail?.name ?? 'Session'}</h2>
            <p className="text-xs text-muted-foreground">
              {detail?.date} · {detail?.startTime}{detail?.endTime ? ` – ${detail.endTime}` : ''}
              {detail?.group && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{ background: detail.group.color ? `${detail.group.color}22` : '#f0f0f0', color: detail.group.color ?? '#555', border: `1px solid ${detail.group.color ?? '#ccc'}` }}>
                  {detail.group.name}
                </span>
              )}
              {hasPaymentLink && (
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full border font-medium
                  ${detail.paymentMode === 'REQUIRED' ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
                  {detail.paymentMode === 'REQUIRED' ? 'Pay Required' : 'Pay Optional'}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {detail && (
              <>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Export PDF" onClick={() => exportSessionToPdf(detail)} disabled={!detail.students?.length}>
                  <FileText className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Export Excel" onClick={() => exportSessionAttendance(detail)} disabled={!detail.students?.length}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {!detail?.isClosed ? (
              <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => setCloseDialogOpen(true)}>
                <Lock className="h-3 w-3 mr-1" />Close
              </Button>
            ) : (
              <Badge variant="outline" className="text-destructive border-destructive text-[10px]">Closed</Badge>
            )}
          </div>
        </div>

        {/* Row 2: stat chips */}
        {detail && (
          <div className="flex gap-2 text-xs">
            <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" />{detail.presentCount}</span>
            <span className="flex items-center gap-1 text-red-500"><XCircle className="h-3 w-3" />{detail.absentCount}</span>
            <span className="flex items-center gap-1 text-yellow-600"><Clock className="h-3 w-3" />{detail.lateCount}</span>
            <span className="flex items-center gap-1 text-gray-400"><Users className="h-3 w-3" />{detail.notMarkedCount}</span>
            <span className="ml-auto text-muted-foreground">{detail.totalStudents} students</span>
          </div>
        )}

        {/* Row 3: scan mode selector */}
        {!detail?.isClosed && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <ScanModeBtn mode="manual" active={scanMode === 'manual'} label="Manual" icon={Search} onClick={() => switchMode('manual')} />
            <ScanModeBtn mode="qr" active={scanMode === 'qr'} label="QR" icon={QrCode} onClick={() => switchMode('qr')} />
            <ScanModeBtn mode="nfc" active={scanMode === 'nfc'} label="NFC" icon={Wifi} onClick={() => switchMode('nfc')} disabled={!nfcAvailable} />
            <ScanModeBtn mode="card" active={scanMode === 'card'} label="Card/ID" icon={CreditCard} onClick={() => switchMode('card')} />
          </div>
        )}

        {/* Row 4: scan mode controls */}
        {!detail?.isClosed && scanMode === 'qr' && (
          <div className="space-y-1.5">
            {/* Camera area */}
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '36vh', maxHeight: '240px' }}>
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              {qrSnapshot ? (
                <img src={qrSnapshot} alt="QR detected" className="absolute inset-0 w-full h-full object-cover" />
              ) : !isCameraOn ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 gap-2">
                  <QrCode className="h-10 w-10" />
                  <p className="text-xs">Tap to start camera</p>
                </div>
              ) : null}
              {isCameraOn && !qrSnapshot && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-36 h-36 relative">
                    <div className="absolute -top-px -left-px w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl" />
                    <div className="absolute -top-px -right-px w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr" />
                    <div className="absolute -bottom-px -left-px w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl" />
                    <div className="absolute -bottom-px -right-px w-6 h-6 border-b-2 border-r-2 border-primary rounded-br" />
                    <div className="absolute left-2 right-2 h-0.5 bg-primary/70 rounded-full animate-scan-line" />
                  </div>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4">
                  <p className="text-white text-xs text-center">{cameraError}</p>
                </div>
              )}
              {qrSnapshot && (
                <div className="absolute bottom-2 inset-x-2 flex items-center justify-center">
                  <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">QR Detected ✓</span>
                </div>
              )}
            </div>
            <Button size="sm" className="w-full h-8 text-xs" variant={isCameraOn ? 'outline' : 'default'} onClick={toggleCamera}>
              {isCameraOn ? 'Stop Camera' : 'Start Camera'}
            </Button>
          </div>
        )}

        {!detail?.isClosed && scanMode === 'nfc' && (
          <div className="space-y-1.5">
            <div className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${nfcActive ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <Wifi className={`h-8 w-8 mx-auto mb-1.5 ${nfcActive ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
              <p className="text-xs font-medium">{nfcActive ? 'Hold NFC card near device…' : 'NFC reader ready'}</p>
              {nfcError && <p className="text-xs text-destructive mt-1">{nfcError}</p>}
              {!nfcAvailable && <p className="text-xs text-destructive mt-1">Web NFC not supported. Use Chrome on Android.</p>}
            </div>
            <Button size="sm" className="w-full h-8 text-xs" variant={nfcActive ? 'outline' : 'default'} onClick={toggleNfc} disabled={!nfcAvailable}>
              {nfcActive ? 'Stop NFC' : 'Enable NFC'}
            </Button>
          </div>
        )}

        {!detail?.isClosed && scanMode === 'card' && (
          <div className="flex gap-1.5">
            <Input
              className="h-8 text-sm flex-1"
              placeholder="Scan or type card ID / institute ID…"
              value={cardInput}
              onChange={e => setCardInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCardSubmit()}
              autoFocus
            />
            <Select value={String(cardInputStatus)} onValueChange={v => setCardInputStatus(Number(v))}>
              <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map(o => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 text-xs px-3" onClick={handleCardSubmit} disabled={!cardInput.trim()}>Mark</Button>
          </div>
        )}

        {/* Row 5: filter row */}
        <div className="flex gap-1.5 items-center overflow-x-auto no-scrollbar">
          <div className="relative shrink-0">
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-7 h-7 text-xs w-40"
            />
          </div>
          {(['all', 'present', 'absent', 'not-marked'] as FilterMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`shrink-0 text-xs px-2.5 h-7 rounded-md border transition-colors
                ${filterMode === mode ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:bg-muted'}`}
            >
              {mode === 'not-marked' ? 'Unmarked' : mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Row 6: history toggle */}
        {history.length > 0 && (
          <button
            onClick={() => setHistoryOpen(v => !v)}
            className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground py-0.5"
          >
            <span className="font-medium">Recent marks ({history.length})</span>
            {historyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* ── HISTORY PANEL (collapsible) ──────────────────────────────────────── */}
      {historyOpen && (
        <div className="shrink-0 bg-muted/40 border-b max-h-40 overflow-y-auto">
          {history.map((h, i) => (
            <div key={`${h.studentId}-${i}`} className="flex items-center gap-2 px-3 py-1.5 border-b last:border-0 text-xs">
              <span className="font-medium truncate flex-1">{h.studentName}</span>
              <span className="text-muted-foreground">{h.statusLabel}</span>
              {h.paymentStatus && <PaymentBadge status={h.paymentStatus as any} size="xs" />}
              <span className="text-muted-foreground shrink-0">{h.time}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── STUDENT LIST (scrollable) ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">No students match.</div>
        )}
        {filtered.map(student => {
          const paymentBlocked = detail?.paymentMode === 'REQUIRED' && student.paymentStatus !== 'PAID';
          const isSaving = saving === student.studentId;
          return (
            <Card key={student.studentId} className={`${paymentBlocked ? 'border-orange-200' : ''}`}>
              <CardContent className="py-2 px-2.5">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={student.imageUrl ? getImageUrl(student.imageUrl) : undefined} />
                    <AvatarFallback className="text-xs">{initials(student.studentName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-medium truncate">{student.studentName}</p>
                      {hasPaymentLink && <PaymentBadge status={student.paymentStatus} />}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {student.userIdInstitute && <span className="mr-1.5">ID: {student.userIdInstitute}</span>}
                      {student.cardId && <span>Card: {student.cardId}</span>}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0 text-right min-w-[60px]">
                    {student.statusCode !== null ? (
                      <div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[student.statusCode] ?? 'bg-gray-100'}`}>
                          {student.statusLabel}
                        </span>
                        {student.markedAt && (
                          <p className="text-[9px] text-muted-foreground mt-0.5">{formatSriLankaDateTime(student.markedAt)}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Not Marked</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  {!detail?.isClosed && (
                    <div className="flex items-center gap-1 shrink-0">
                      {paymentBlocked ? (
                        /* Collect payment button */
                        <Button
                          size="sm"
                          className="h-7 text-[10px] px-2 bg-orange-500 hover:bg-orange-600 text-white"
                          onClick={() => navigate(`/collect-payment?studentId=${student.studentId}`)}
                        >
                          <Banknote className="h-3 w-3 mr-1" />
                          Collect
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant={student.statusCode === null ? 'default' : 'outline'}
                            className="h-7 text-[10px] px-2"
                            disabled={isSaving}
                            onClick={() => markStudent(student)}
                          >
                            {isSaving ? '…' : student.statusCode !== null ? '✓ Re' : '✓ Mark'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] px-1.5 text-red-600 border-red-200 hover:bg-red-50"
                            disabled={isSaving}
                            onClick={() => markStudent(student, 0)}
                          >
                            Absent
                          </Button>
                          <Select disabled={isSaving} onValueChange={v => markStudent(student, Number(v))}>
                            <SelectTrigger className="w-16 h-7 text-[10px]">
                              <SelectValue placeholder="More" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTS.map(opt => (
                                <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── CLOSE SESSION DIALOG ─────────────────────────────────────────────── */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Close Session</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>{detail?.notMarkedCount ?? 0}</strong> students not yet marked. What should happen to them?
            </p>
            {([
              { value: 'KEEP_NOT_MARKED', label: 'Keep as Not Marked' },
              { value: 'MARK_ABSENT', label: 'Auto-mark as Absent' },
            ] as { value: CloseUnmarkAction; label: string }[]).map(opt => (
              <button
                key={opt.value}
                className={`w-full text-left px-4 py-2 rounded-lg border text-sm transition-colors
                  ${closeAction === opt.value ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:bg-muted'}`}
                onClick={() => setCloseAction(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleClose} disabled={closing}>
              {closing ? 'Closing…' : 'Close Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
