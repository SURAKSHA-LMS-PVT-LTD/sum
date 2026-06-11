import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, CheckCircle, Loader2, User, ArrowLeft, CalendarClock, Building2, GraduationCap, BookOpen, AlertCircle, Nfc, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { childAttendanceApi } from '@/api/childAttendance.api';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { buildAttendanceAddress } from '@/utils/attendanceAddress';
import { AttendanceStatus, ALL_ATTENDANCE_STATUSES, ATTENDANCE_STATUS_CONFIG, AddressCoordinates } from '@/types/attendance.types';
import { Capacitor } from '@capacitor/core';
import { useTodayCalendarEvents, DEFAULT_EVENT_ID } from '@/hooks/useTodayCalendarEvents';
import EventSelector from '@/components/attendance/EventSelector';
import AttendanceLocationViewer from '@/components/dialogs/AttendanceLocationViewer';

declare global {
  interface NDEFReadingEvent extends Event {
    serialNumber: string;
    message: NDEFMessage;
  }
  interface NDEFMessage { records: NDEFRecord[]; }
  interface NDEFRecord {
    recordType: string;
    mediaType?: string;
    data?: DataView;
  }
  interface NDEFReader extends EventTarget {
    scan(options?: { signal?: AbortSignal }): Promise<void>;
    onreading: ((event: NDEFReadingEvent) => void) | null;
    onreadingerror: ((event: Event) => void) | null;
  }
  interface Window { NDEFReader?: new () => NDEFReader; }
}

const NFC_SUPPORTED = typeof window !== 'undefined' && 'NDEFReader' in window;

interface LocationViewData {
  studentName: string;
  studentId: string;
  status: string;
  address?: AddressCoordinates;
  location?: string;
  instituteName?: string;
  className?: string;
  date?: string;
  markingTime?: string;
  markingMethod: string;
}

interface LastAttendance {
  instituteCardId: string;
  studentName: string;
  userIdByInstitute: string;
  status: AttendanceStatus;
  timestamp: number;
  imageUrl?: string;
}

const InstituteMarkAttendance = () => {
  const { selectedInstitute, selectedClass, selectedSubject, currentInstituteId } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const sessionId = new URLSearchParams(routerLocation.search).get('sessionId') ?? undefined;
  const sessionName = new URLSearchParams(routerLocation.search).get('sessionName') ?? undefined;
  const [instituteCardId, setInstituteCardId] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [selectedEventId, setSelectedEventId] = useState(DEFAULT_EVENT_ID);
  const [isProcessing, setIsProcessing] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [lastAttendance, setLastAttendance] = useState<LastAttendance | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationViewerOpen, setLocationViewerOpen] = useState(false);
  const [locationViewData, setLocationViewData] = useState<LocationViewData | null>(null);
  const [nfcActive, setNfcActive] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nfcAbortRef = useRef<AbortController | null>(null);
  const handleMarkRef = useRef<((id: string) => void) | null>(null);

  // Fetch today's calendar events
  const calendarInfo = useTodayCalendarEvents(
    currentInstituteId,
    selectedClass?.id?.toString()
  );

  // Live clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const buildAddress = (loc?: { address: string } | null) => {
    return buildAttendanceAddress({
      instituteName: selectedInstitute?.name,
      className: selectedClass?.name,
      subjectName: selectedSubject?.name,
      location: loc?.address,
    });
  };

  // Get user location
  useEffect(() => {
    const getLocation = async () => {
      try {
        let latitude: number, longitude: number;
        if (Capacitor.isNativePlatform()) {
          const { Geolocation } = await import('@capacitor/geolocation');
          await Geolocation.requestPermissions();
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } else if (navigator.geolocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } else {
          setLocation(null);
          return;
        }
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          setLocation({ latitude, longitude, address: data.display_name || 'Unknown Location' });
        } catch {
          setLocation({ latitude, longitude, address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` });
        }
      } catch (error: any) {
        console.error('Error getting location:', error);
        setLocation(null);
      }
    };
    getLocation();
  }, []);

  // Clear last attendance after 1 minute
  useEffect(() => {
    if (lastAttendance) {
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = setTimeout(() => setLastAttendance(null), 60000);
    }
    return () => { if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current); };
  }, [lastAttendance]);

  const markById = async (cardId: string) => {
    if (!cardId.trim()) return;
    if (!currentInstituteId || !selectedInstitute?.name) {
      toast({ title: "Error", description: "Please select an institute first", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const addressStr = buildAddress(location) || selectedInstitute.name;

      const request: any = {
        instituteCardId: cardId.trim(),
        instituteId: currentInstituteId.toString(),
        instituteName: selectedInstitute.name,
        address: addressStr,
        location: location?.address,
        markingMethod: 'rfid/nfc',
        status: status,
        date: new Date().toISOString().split('T')[0],
      };

      const isInstituteScope = !selectedClass;
      if (isInstituteScope && selectedEventId !== DEFAULT_EVENT_ID) {
        request.eventId = selectedEventId;
      }
      if (sessionId) {
        request.classSessionId = sessionId;
      }
      if (selectedClass) {
        request.classId = selectedClass.id.toString();
        request.className = selectedClass.name;
      }
      if (selectedSubject) {
        request.subjectId = selectedSubject.id.toString();
        request.subjectName = selectedSubject.name;
      }

      const result = await childAttendanceApi.markAttendanceByInstituteCard(request);
      if (result.success) {
        const studentName = result.name || result.data?.studentName || 'Student';
        const userIdByInstitute = result.userIdByInstitute || '';
        setLastAttendance({
          instituteCardId: cardId.trim(),
          studentName, userIdByInstitute,
          status: result.status || status,
          timestamp: Date.now(),
          imageUrl: result.imageUrl || undefined,
        });
        toast({ title: `✓ ${studentName}`, description: `${status.toUpperCase()} - ${new Date().toLocaleTimeString()}` });
        setInstituteCardId('');
        inputRef.current?.focus();
      } else {
        throw new Error(result.message || 'Failed to mark attendance');
      }
    } catch (error: any) {
      console.error('Attendance marking error:', error);
      const raw: string = error?.message || error?.error || String(error);
      let title = 'Marking Failed';
      let description = 'An unexpected error occurred. Please try again.';

      if (raw.includes('404') || raw.toLowerCase().includes('not found') || raw.toLowerCase().includes('user not found')) {
        title = 'Card Not Found';
        description = `No student is registered with card ID "${cardId.trim()}". Check the card and try again.`;
      } else if (raw.includes('400')) {
        // Extract "message" from JSON body if present
        try {
          const jsonStart = raw.indexOf('{');
          if (jsonStart !== -1) {
            const parsed = JSON.parse(raw.slice(jsonStart));
            description = parsed.message || parsed.error || description;
          } else {
            description = raw;
          }
        } catch {
          description = raw;
        }
      } else if (raw.includes('401') || raw.includes('403')) {
        title = 'Permission Denied';
        description = 'You do not have permission to mark attendance here.';
      } else if (raw.includes('409') || raw.toLowerCase().includes('already marked')) {
        title = 'Already Marked';
        description = 'Attendance for this card has already been recorded today.';
      } else if (raw.toLowerCase().includes('network') || raw.toLowerCase().includes('failed to fetch')) {
        title = 'Network Error';
        description = 'Could not reach the server. Check your connection and try again.';
      } else {
        description = raw.length < 200 ? raw : 'Failed to mark attendance';
      }

      toast({ title, description, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => { handleMarkRef.current = markById; });

  const handleMarkAttendance = () => markById(instituteCardId);

  const startNfc = useCallback(async () => {
    if (!NFC_SUPPORTED) {
      setNfcError('Web NFC is not supported on this device/browser. Use Chrome on Android.');
      return;
    }
    try {
      const controller = new AbortController();
      nfcAbortRef.current = controller;
      const reader = new window.NDEFReader!();
      reader.onreading = (event: NDEFReadingEvent) => {
        const uid = event.serialNumber.replace(/:/g, '').toUpperCase();
        if (uid) {
          setInstituteCardId(uid);
          handleMarkRef.current?.(uid);
        }
      };
      reader.onreadingerror = () => {
        toast({ title: "NFC Error", description: "Could not read the card. Try again.", variant: "destructive" });
      };
      await reader.scan({ signal: controller.signal });
      setNfcActive(true);
      setNfcError(null);
      toast({ title: "NFC Active", description: "Hold an NFC card near the back of the phone." });
    } catch (err: any) {
      setNfcActive(false);
      if (err?.name === 'AbortError') return;
      if (err?.name === 'NotAllowedError') {
        setNfcError('NFC permission denied. Allow NFC access in browser settings.');
      } else {
        setNfcError(err?.message || 'Failed to start NFC scanner.');
      }
    }
  }, [toast]);

  const stopNfc = useCallback(() => {
    nfcAbortRef.current?.abort();
    nfcAbortRef.current = null;
    setNfcActive(false);
    toast({ title: "NFC Stopped", description: "NFC card scanning has been stopped." });
  }, [toast]);

  useEffect(() => () => { nfcAbortRef.current?.abort(); }, []);

  const openLocationViewer = () => {
    if (lastAttendance && location) {
      setLocationViewData({
        studentName: lastAttendance.studentName,
        studentId: lastAttendance.userIdByInstitute,
        status: lastAttendance.status,
        address: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        location: location.address,
        instituteName: selectedInstitute?.name,
        className: selectedClass?.name,
        date: currentTime.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        markingTime: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        markingMethod: 'barcode',
      });
      setLocationViewerOpen(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isProcessing) handleMarkAttendance();
  };

  const handleBack = () => {
    const instituteId = currentInstituteId || selectedInstitute?.id;
    if (instituteId) {
      let url = `/institute/${instituteId}`;
      if (selectedClass?.id) {
        url += `/class/${selectedClass.id}`;
        if (selectedSubject?.id) url += `/subject/${selectedSubject.id}`;
      }
      const qs = new URLSearchParams();
      if (sessionId) qs.set('sessionId', sessionId);
      if (sessionName) qs.set('sessionName', sessionName);
      const query = qs.toString() ? `?${qs}` : '';
      navigate(`${url}/select-attendance-mark-type${query}`);
    } else {
      navigate('/dashboard');
    }
  };

  // Class-level marking requires a session
  if (selectedClass && !sessionId) {
    const instituteId = currentInstituteId || selectedInstitute?.id;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full border-orange-200">
          <CardContent className="text-center py-10 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold">Session Required</h3>
            <p className="text-sm text-muted-foreground">
              Class-level attendance must be linked to a session. Select or create a session first, then choose a marking method.
            </p>
            <Button
              onClick={() => navigate(`/institute/${instituteId}/class/${selectedClass.id}/class-attendance-sessions`)}
              className="w-full"
            >
              Select Session
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleBack} className="flex items-center gap-2 rounded-full border-primary text-primary hover:bg-primary hover:text-primary-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-foreground">Institute Card Mark Attendance</h1>
          </div>
        </div>

        {/* Current Selection */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Current Selection
            </CardTitle>
          </CardHeader>
          <div className="px-6 pb-4 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className={`font-semibold text-sm ${selectedInstitute ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                {selectedInstitute?.name || 'No institute selected'}
              </span>
            </div>
            {selectedClass && (
              <div className="flex items-center gap-2 pl-4 border-l-2 border-primary/30 ml-2">
                <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground">{selectedClass.name}</span>
              </div>
            )}
            {selectedSubject && (
              <div className="flex items-center gap-2 pl-4 border-l-2 border-primary/20 ml-6">
                <BookOpen className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                <span className="text-sm font-medium text-foreground">{selectedSubject.name}</span>
              </div>
            )}
            {sessionId && (
              <div className="flex items-center gap-2 pl-4 border-l-2 border-indigo-300 ml-2">
                <CalendarClock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <span className="text-sm font-semibold text-indigo-700">{sessionName || `Session #${sessionId.slice(-6)}`}</span>
              </div>
            )}
            {location && (
              <div className="flex items-start gap-2 pt-1">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground break-words">{location.address}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Main Card */}
        <Card className="border shadow-lg">
          <CardContent className="p-0">
            {/* Date/Time Header */}
            <div className="flex border-b">
              <div className="flex-1 p-4 text-center border-r">
                <p className="text-xs text-muted-foreground mb-1">Date</p>
                <p className="font-semibold text-foreground">{currentTime.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="flex-1 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Time</p>
                <p className="font-semibold text-foreground tabular-nums">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid lg:grid-cols-2 gap-0">
              {/* Left - Image Area */}
              <div className="p-6 lg:p-8 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r">
                <div className="relative mb-6">
                  {lastAttendance?.imageUrl ? (
                    <div className="relative">
                      <img
                        src={getImageUrl(lastAttendance.imageUrl)}
                        alt={`${lastAttendance.studentName} photo`}
                        className={`h-48 w-48 sm:h-56 sm:w-56 rounded-lg object-cover border-4 shadow-lg ${
                          lastAttendance.status === 'present' ? 'border-success' :
                          lastAttendance.status === 'absent' ? 'border-destructive' :
                          lastAttendance.status === 'late' ? 'border-warning' : 'border-muted'
                        }`}
                      />
                      <div className={`absolute -bottom-3 -right-3 rounded-full p-2 shadow-lg ${
                        lastAttendance.status === 'present' ? 'bg-success' :
                        lastAttendance.status === 'absent' ? 'bg-destructive' :
                        lastAttendance.status === 'late' ? 'bg-warning' : 'bg-muted'
                      }`}>
                        <CheckCircle className="h-8 w-8 text-primary-foreground" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 w-48 sm:h-56 sm:w-56 border-4 border-destructive rounded-lg flex items-center justify-center bg-muted/30">
                      <User className="h-20 w-20 text-destructive" />
                    </div>
                  )}
                </div>
                {lastAttendance && (
                  <div className="text-center space-y-3">
                    <p className={`text-xl font-bold ${
                      lastAttendance.status === 'present' ? 'text-success' :
                      lastAttendance.status === 'absent' ? 'text-destructive' :
                      lastAttendance.status === 'late' ? 'text-warning' : 'text-muted-foreground'
                    }`}>{lastAttendance.studentName}</p>
                    <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold border ${
                      lastAttendance.status === 'present' ? 'bg-success/10 text-success border-success/20' :
                      lastAttendance.status === 'absent' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                      lastAttendance.status === 'late' ? 'bg-warning/10 text-warning border-warning/20' :
                      'bg-muted/10 text-muted-foreground border-muted/20'
                    }`}>
                      Status: {ATTENDANCE_STATUS_CONFIG[lastAttendance.status]?.label || lastAttendance.status.toUpperCase()}
                    </div>
                    <div className="text-sm space-y-1 text-muted-foreground">
                      <p>Card ID: <span className="font-medium">{lastAttendance.instituteCardId}</span></p>
                      <p>User ID: <span className="font-medium">{lastAttendance.userIdByInstitute}</span></p>
                    </div>
                    <Button 
                      onClick={openLocationViewer} 
                      disabled={!location} 
                      variant="outline" 
                      className="mt-4 w-full"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      View Location
                    </Button>
                  </div>
                )}
              </div>

              {/* Right - Inputs */}
              <div className="p-6 lg:p-8 flex flex-col justify-center space-y-5">
                {/* NFC Toggle */}
                {NFC_SUPPORTED && (
                  <div className={`flex items-center justify-between rounded-xl px-4 py-3 border-2 transition-colors ${
                    nfcActive ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/20' : 'border-border bg-muted/30'
                  }`}>
                    <div className="flex items-center gap-3">
                      {nfcActive
                        ? <Nfc className="h-5 w-5 text-violet-600 animate-pulse" />
                        : <WifiOff className="h-5 w-5 text-muted-foreground" />}
                      <div>
                        <p className="text-sm font-medium leading-tight">
                          {nfcActive ? 'NFC Active — tap a card' : 'NFC Card Scanner'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {nfcActive ? 'Hold 13.56 MHz card near phone back' : 'Tap to enable NFC reading'}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={nfcActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={nfcActive ? stopNfc : startNfc}
                      className={nfcActive ? 'bg-violet-600 hover:bg-violet-700 text-white' : ''}
                    >
                      {nfcActive ? 'Stop' : 'Start'}
                    </Button>
                  </div>
                )}
                {nfcError && (
                  <p className="text-xs text-destructive flex items-center gap-1.5 -mt-2 px-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />{nfcError}
                  </p>
                )}

                {/* Card ID Input */}
                <div className="space-y-2">
                  <Label htmlFor="institute-card-input" className="text-sm font-medium text-foreground">Institute Card ID</Label>
                  <Input
                    id="institute-card-input"
                    ref={inputRef}
                    type="text"
                    placeholder="Tap NFC card or enter ID..."
                    value={instituteCardId}
                    onChange={(e) => setInstituteCardId(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isProcessing}
                    className="h-12 text-base border-2 border-input focus-visible:border-primary focus-visible:ring-0 focus-visible:ring-offset-0"
                    autoFocus
                  />
                </div>

                {/* Status Select */}
                <div className="space-y-2">
                  <Label htmlFor="status-select" className="text-sm font-medium text-foreground">Status</Label>
                  <Select value={status} onValueChange={(value: AttendanceStatus) => setStatus(value)} disabled={isProcessing}>
                    <SelectTrigger id="status-select" className="h-12 text-base border-2 border-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_ATTENDANCE_STATUSES.map((statusOption) => (
                        <SelectItem key={statusOption} value={statusOption} className="text-muted-foreground">
                          {ATTENDANCE_STATUS_CONFIG[statusOption].icon} {ATTENDANCE_STATUS_CONFIG[statusOption].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Event Selector — only for institute scope */}
                {!selectedClass && (
                  <EventSelector
                    events={calendarInfo.events}
                    selectedEventId={selectedEventId}
                    onEventChange={setSelectedEventId}
                    loading={calendarInfo.loading}
                    disabled={isProcessing}
                    dayType={calendarInfo.dayType}
                    isAttendanceExpected={calendarInfo.isAttendanceExpected}
                  />
                )}

                {/* Mark Button */}
                <Button onClick={handleMarkAttendance} disabled={isProcessing || !instituteCardId.trim()} className="w-full font-semibold" size="xl">
                  {isProcessing ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>) : 'Mark Attendance'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location Viewer Dialog */}
        {locationViewData && (
          <AttendanceLocationViewer
            open={locationViewerOpen}
            onOpenChange={setLocationViewerOpen}
            studentName={locationViewData.studentName}
            studentId={locationViewData.studentId}
            status={locationViewData.status}
            address={locationViewData.address}
            location={locationViewData.location}
            instituteName={locationViewData.instituteName}
            className={locationViewData.className}
            date={locationViewData.date}
            markingTime={locationViewData.markingTime}
            markingMethod={locationViewData.markingMethod}
          />
        )}
      </div>
    </div>
  );
};

export default InstituteMarkAttendance;
