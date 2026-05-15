import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, CheckCircle, XCircle, QrCode, Barcode, Wifi, Clock, User, StopCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { AttendanceStatus, ALL_ATTENDANCE_STATUSES, ATTENDANCE_STATUS_CONFIG } from '@/types/attendance.types';
import { attendanceScanLog, ScanLogEntry } from '@/utils/attendanceScanLog';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface MobileScannerOverlayProps {
  isActive: boolean;
  onClose: () => void;
  scanMethod: 'qr' | 'barcode' | 'rfid/nfc';
  status: AttendanceStatus;
  onStatusChange: (status: AttendanceStatus) => void;
  markedCount: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  cameraError?: string | null;
  /** Base64 / blob URL snapshot captured at QR detection — replaces live camera view temporarily */
  snapshotUrl?: string | null;
}

const ScannerHeader: React.FC<{
  scanMethod: 'qr' | 'barcode' | 'rfid/nfc';
  markedCount: number;
  onClose: () => void;
}> = ({ scanMethod, markedCount, onClose }) => {
  const icon = scanMethod === 'qr' ? <QrCode className="h-4 w-4" /> 
    : scanMethod === 'barcode' ? <Barcode className="h-4 w-4" /> 
    : <Wifi className="h-4 w-4" />;
  
  const label = scanMethod === 'qr' ? 'QR Scanner' 
    : scanMethod === 'barcode' ? 'Barcode Scanner' 
    : 'RFID/NFC';

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-card/95 backdrop-blur-md border-b border-border shrink-0 safe-top">
      <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-destructive/10">
        <X className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 text-foreground">
        {icon}
        <span className="font-semibold text-sm">{label}</span>
      </div>
      <Badge className="bg-primary text-primary-foreground text-xs font-bold min-w-[28px] justify-center">
        {markedCount}
      </Badge>
    </div>
  );
};

const CameraView: React.FC<{
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  cameraError?: string | null;
  scanMethod: 'qr' | 'barcode' | 'rfid/nfc';
  snapshotUrl?: string | null;
}> = ({ videoRef, canvasRef, cameraError, scanMethod, snapshotUrl }) => (
  // Fixed pixel-bounded height prevents the video stream from expanding to full-screen
  // on Android WebView; overflow-hidden clips any native video frame bleed.
  <div className="relative bg-black flex items-center justify-center shrink-0 w-full overflow-hidden" style={{ height: '36vh', maxHeight: '240px' }}>
    <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover ${snapshotUrl ? 'opacity-0' : ''}`} playsInline muted />
    <canvas ref={canvasRef} className="hidden" />

    {/* Freeze-frame snapshot shown briefly after QR detected */}
    {snapshotUrl && (
      <img
        src={snapshotUrl}
        alt="QR detected"
        className="absolute inset-0 w-full h-full object-cover"
      />
    )}

    {cameraError && (
      <div className="absolute inset-0 flex items-center justify-center bg-black/85 z-10 p-6">
        <div className="text-center text-white">
          <XCircle className="h-8 w-8 mx-auto mb-3 text-destructive" />
          <p className="text-sm leading-relaxed">{cameraError}</p>
        </div>
      </div>
    )}

    {/* Corner markers — sized to fit within the fixed 240px max-height camera box */}
    {!snapshotUrl && (
      <div className="relative w-[150px] h-[150px] z-[1] pointer-events-none">
        <div className="absolute inset-0 border border-white/20 rounded-xl" />
        <div className="absolute -top-px -left-px w-7 h-7 border-t-[3px] border-l-[3px] border-primary rounded-tl-lg" />
        <div className="absolute -top-px -right-px w-7 h-7 border-t-[3px] border-r-[3px] border-primary rounded-tr-lg" />
        <div className="absolute -bottom-px -left-px w-7 h-7 border-b-[3px] border-l-[3px] border-primary rounded-bl-lg" />
        <div className="absolute -bottom-px -right-px w-7 h-7 border-b-[3px] border-r-[3px] border-primary rounded-br-lg" />
        <div className="absolute left-3 right-3 h-0.5 bg-primary/70 rounded-full animate-scan-line" />
      </div>
    )}

    {snapshotUrl && (
      <div className="absolute bottom-3 inset-x-0 flex justify-center z-[1]">
        <span className="bg-green-600/90 text-white text-[11px] font-semibold px-3 py-1 rounded-full backdrop-blur-sm">
          ✓ QR Detected
        </span>
      </div>
    )}

    {!snapshotUrl && (
      <p className="absolute bottom-3 inset-x-0 text-center text-white/70 text-[11px] font-medium z-[1]">
        Point at {scanMethod === 'qr' ? 'QR code' : 'barcode'} to scan
      </p>
    )}
  </div>
);

const StatusBar: React.FC<{
  status: AttendanceStatus;
  onStatusChange: (s: AttendanceStatus) => void;
  onStop: () => void;
}> = ({ status, onStatusChange, onStop }) => (
  <div className="flex items-center gap-2 px-3 py-2.5 bg-card border-b border-border shrink-0">
    <Select value={status} onValueChange={(v) => onStatusChange(v as AttendanceStatus)}>
      <SelectTrigger className="flex-1 h-9 text-sm rounded-lg">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-card border-border z-[10001]">
        {ALL_ATTENDANCE_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <span className="flex items-center gap-2">
              <span>{ATTENDANCE_STATUS_CONFIG[s].icon}</span>
              <span>{ATTENDANCE_STATUS_CONFIG[s].label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Button variant="destructive" size="sm" className="h-9 px-4 rounded-lg font-medium" onClick={onStop}>
      <StopCircle className="h-4 w-4 mr-1.5" />
      Stop
    </Button>
  </div>
);

const ScanLogCard: React.FC<{ entry: ScanLogEntry }> = ({ entry }) => {
  const time = new Date(entry.markedAt).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });

  return (
    <div className={`rounded-lg p-3 border animate-in slide-in-from-top-1 duration-200 ${
      entry.success
        ? 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-500/10'
        : 'bg-destructive/5 border-destructive/20 dark:bg-destructive/10'
    }`}>
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          {entry.success && entry.imageUrl ? (
            <img
              src={getImageUrl(entry.imageUrl)}
              alt={entry.studentName || 'Student'}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/30"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            entry.success && entry.imageUrl ? 'hidden' : ''
          } ${entry.success ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
            {entry.success 
              ? <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              : <XCircle className="h-5 w-5 text-destructive" />
            }
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-semibold truncate ${
              entry.success ? 'text-emerald-700 dark:text-emerald-300' : 'text-destructive'
            }`}>
              {entry.success ? entry.studentName || 'Student' : 'Failed'}
            </p>
            {entry.success && entry.status && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${
                ATTENDANCE_STATUS_CONFIG[entry.status as AttendanceStatus]?.color || ''
              }`}>
                {ATTENDANCE_STATUS_CONFIG[entry.status as AttendanceStatus]?.label || entry.status}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {entry.success && entry.studentId && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <User className="h-2.5 w-2.5" /> {entry.studentId}
              </span>
            )}
            {!entry.success && entry.errorMessage && (
              <span className="text-[10px] text-destructive truncate">{entry.errorMessage}</span>
            )}
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto shrink-0">
              <Clock className="h-2.5 w-2.5" /> {time}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MobileScannerOverlay: React.FC<MobileScannerOverlayProps> = ({
  isActive, onClose, scanMethod, status, onStatusChange, markedCount, videoRef, canvasRef, cameraError, snapshotUrl,
}) => {
  const [logEntries, setLogEntries] = useState<ScanLogEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);

  useEffect(() => {
    if (!isActive) return;
    setLogEntries(attendanceScanLog.getAll());
    const unsub = attendanceScanLog.subscribe(() => setLogEntries(attendanceScanLog.getAll()));
    return unsub;
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-background">
      <ScannerHeader scanMethod={scanMethod} markedCount={markedCount} onClose={onClose} />
      <CameraView videoRef={videoRef} canvasRef={canvasRef} cameraError={cameraError} scanMethod={scanMethod} snapshotUrl={snapshotUrl} />
      <StatusBar status={status} onStatusChange={onStatusChange} onStop={onClose} />

      {/* History header — collapsible */}
      <button
        onClick={() => setHistoryOpen(v => !v)}
        className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition-colors shrink-0"
      >
        <span>Scan History ({logEntries.length})</span>
        {historyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {/* Scan log */}
      {historyOpen && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 pb-safe-bottom">
          {logEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 gap-2">
              <QrCode className="h-8 w-8" />
              <p className="text-xs font-medium">No scans yet</p>
              <p className="text-[11px]">Scan a code to see results here</p>
            </div>
          ) : (
            logEntries.map((entry) => <ScanLogCard key={entry.id} entry={entry} />)
          )}
        </div>
      )}
    </div>
  );
};

export default MobileScannerOverlay;
