import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Nfc,
  QrCode,
  Smartphone,
  Wifi,
} from 'lucide-react';

const NFC_SUPPORTED = typeof window !== 'undefined' && 'NDEFReader' in window;
const IS_MOBILE = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

const SelectAttendanceMarkType = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedInstitute, selectedClass, selectedSubject, currentInstituteId } = useAuth();

  const instituteId = currentInstituteId || selectedInstitute?.id;
  const sessionId = new URLSearchParams(location.search).get('sessionId') ?? undefined;
  const sessionName = new URLSearchParams(location.search).get('sessionName') ?? undefined;

  // At class level with no session selected → redirect to sessions page
  useEffect(() => {
    if (selectedClass?.id && !sessionId && instituteId) {
      navigate(
        `/institute/${instituteId}/class/${selectedClass.id}/class-attendance-sessions`,
        { replace: true },
      );
    }
  }, [selectedClass?.id, sessionId, instituteId, navigate]);

  const goBack = () => {
    if (selectedClass?.id && instituteId) {
      navigate(`/institute/${instituteId}/class/${selectedClass.id}/class-attendance-sessions`);
      return;
    }
    navigate(instituteId ? `/institute/${instituteId}/dashboard` : '/dashboard');
  };

  // Build a mark-method URL, appending sessionId if available
  const buildMarkUrl = (page: string, extraParams?: Record<string, string>) => {
    let base = `/institute/${instituteId}`;
    if (selectedClass?.id) {
      base += `/class/${selectedClass.id}`;
      if (selectedSubject?.id) base += `/subject/${selectedSubject.id}`;
    }
    const qs = new URLSearchParams();
    if (sessionId) qs.set('sessionId', sessionId);
    if (sessionName) qs.set('sessionName', sessionName);
    if (extraParams) Object.entries(extraParams).forEach(([k, v]) => qs.set(k, v));
    const query = qs.toString() ? `?${qs}` : '';
    return `${base}/${page}${query}`;
  };

  const goToSessionAttendance = () => {
    if (!instituteId) { navigate('/select-institute'); return; }
    let url = `/institute/${instituteId}`;
    if (selectedClass?.id) url += `/class/${selectedClass.id}`;
    navigate(`${url}/class-attendance-sessions`);
  };

  const goToSessionView = () => {
    if (!instituteId || !sessionId || !selectedClass?.id) return;
    navigate(`/institute/${instituteId}/class/${selectedClass.id}/class-attendance-sessions?viewSession=${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-background sticky top-0 z-10">
        <div className="max-w-2xl mx-auto w-full px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0 -ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Mark Attendance</h1>
            <p className="text-xs text-muted-foreground">
              {sessionId ? 'Session selected — choose a marking method' : 'Select a method to record attendance'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 space-y-6">

        {/* Current Selection */}
        <Card className="border-border/60 shadow-sm bg-background">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Current Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0 space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <span className={`font-medium text-sm ${selectedInstitute ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                {selectedInstitute?.name || 'No institute selected'}
              </span>
            </div>
            {selectedClass && (
              <div className="flex items-center gap-3 pl-3 ml-1 border-l-2 border-primary/30">
                <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="font-medium text-sm text-foreground">{selectedClass.name}</span>
              </div>
            )}
            {selectedSubject && (
              <div className="flex items-center gap-3 pl-3 ml-5 border-l-2 border-primary/20">
                <div className="h-7 w-7 rounded-md bg-primary/5 flex items-center justify-center shrink-0">
                  <BookOpen className="h-3.5 w-3.5 text-primary/70" />
                </div>
                <span className="font-medium text-sm text-foreground">{selectedSubject.name}</span>
              </div>
            )}
            {sessionId && (
              <div className="flex items-center gap-3 pl-3 ml-9 border-l-2 border-indigo-300">
                <div className="h-7 w-7 rounded-md bg-indigo-100 flex items-center justify-center shrink-0">
                  <CalendarClock className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                <span className="font-medium text-sm text-indigo-800">{sessionName || `Session #${sessionId.slice(-6)}`}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Attendance — show only when no class selected */}
        {!selectedClass && (
          <button
            onClick={goToSessionAttendance}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-indigo-300 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left shadow-sm"
          >
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-indigo-100 border border-indigo-200">
              <CalendarClock className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-indigo-900 leading-tight">Session Attendance</p>
              <p className="text-xs text-indigo-600 mt-0.5">Select or create a session, then mark via NFC · QR · Manual</p>
            </div>
            <ChevronRight className="h-5 w-5 text-indigo-400 shrink-0" />
          </button>
        )}

        {/* Manual session view — when sessionId available */}
        {sessionId && selectedClass && (
          <button
            onClick={goToSessionView}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-indigo-300 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left shadow-sm"
          >
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-indigo-100 border border-indigo-200">
              <ClipboardCheck className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-indigo-900 leading-tight">Manual Mark (Session View)</p>
              <p className="text-xs text-indigo-600 mt-0.5">View all students and mark attendance individually</p>
            </div>
            <ChevronRight className="h-5 w-5 text-indigo-400 shrink-0" />
          </button>
        )}

        {/* Attendance Methods */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
            {selectedClass ? 'Scan / Card Methods' : 'Attendance Methods'}
          </p>
          <div className="rounded-xl border border-border bg-background overflow-hidden divide-y divide-border/60">
            {[
              ...(!selectedClass ? [{
                icon: <ClipboardCheck className="h-5 w-5 text-sky-600" />,
                bg: 'bg-sky-100',
                label: 'Manual Class Attendance',
                desc: 'Bulk mark from institute check-ins',
                onClick: () => navigate(buildMarkUrl('manual-class-attendance')),
              }] : []),
              ...(selectedClass && sessionId ? [{
                icon: <ClipboardCheck className="h-5 w-5 text-sky-600" />,
                bg: 'bg-sky-100',
                label: 'Inherit from Institute',
                desc: 'Bulk mark class attendance from institute check-ins',
                onClick: () => navigate(buildMarkUrl('manual-class-attendance')),
              }] : []),
              {
                icon: <QrCode className="h-5 w-5 text-cyan-600" />,
                bg: 'bg-cyan-100',
                label: 'QR Code',
                desc: 'Scan student QR code cards with the camera',
                onClick: () => navigate(buildMarkUrl('qr-attendance', { method: 'qr' })),
              },
              {
                icon: <BarChart3 className="h-5 w-5 text-blue-600" />,
                bg: 'bg-blue-100',
                label: 'Barcode',
                desc: 'Scan 1D barcode cards with a scanner',
                onClick: () => navigate(buildMarkUrl('qr-attendance', { method: 'barcode' })),
              },
              {
                icon: <Smartphone className="h-5 w-5 text-violet-600" />,
                bg: 'bg-violet-100',
                label: 'RFID / NFC',
                desc: 'Tap RFID or NFC cards · Mobile NFC supported',
                badge: (NFC_SUPPORTED || IS_MOBILE) ? 'NFC' : undefined,
                onClick: () => navigate(buildMarkUrl('rfid')),
              },
              {
                icon: <Wifi className="h-5 w-5 text-emerald-600" />,
                bg: 'bg-emerald-100',
                label: 'Institute Card',
                desc: 'Mark using institute-issued card IDs · NFC supported',
                badge: (NFC_SUPPORTED || IS_MOBILE) ? 'NFC' : undefined,
                onClick: () => navigate(buildMarkUrl('institute-mark-attendance')),
              },
            ].map((m) => (
              <button
                key={m.label}
                onClick={m.onClick}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-background active:bg-muted/60 transition-colors hover:bg-muted/40"
              >
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${m.bg}`}>
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground leading-tight">{m.label}</p>
                    {(m as any).badge && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[10px] font-bold leading-none">
                        <Nfc className="h-2.5 w-2.5" />{(m as any).badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{m.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SelectAttendanceMarkType;
