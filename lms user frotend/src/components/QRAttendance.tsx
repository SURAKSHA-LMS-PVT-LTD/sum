import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CalendarClock, Camera, QrCode, UserCheck, CheckCircle, MapPin, X, AlertCircle, Loader2, Building2, GraduationCap, BookOpen } from 'lucide-react';
import jsQR from 'jsqr';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { childAttendanceApi, MarkAttendanceByCardRequest, MarkAttendanceRequest } from '@/api/childAttendance.api';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { getBaseUrl } from '@/contexts/utils/auth.api';
import { tokenStorageService } from '@/services/tokenStorageService';
import { buildAttendanceAddress } from '@/utils/attendanceAddress';
import { attendanceScanLog } from '@/utils/attendanceScanLog';
import { AttendanceStatus, ALL_ATTENDANCE_STATUSES, ATTENDANCE_STATUS_CONFIG, AddressCoordinates } from '@/types/attendance.types';
import { Capacitor } from '@capacitor/core';
import { useTodayCalendarEvents, DEFAULT_EVENT_ID } from '@/hooks/useTodayCalendarEvents';
import EventSelector from '@/components/attendance/EventSelector';
import MobileScannerOverlay from '@/components/MobileScannerOverlay';
import AttendanceLocationViewer from '@/components/dialogs/AttendanceLocationViewer';

interface LocationViewData {
  studentName?: string;
  studentId?: string;
  address?: AddressCoordinates;
  location?: string;
  date?: string;
  status?: string;
  className?: string;
  instituteName?: string;
  markingTime?: string;
  markingMethod?: string;
}

// Dynamic import to avoid crash on web where the plugin isn't available
let CapacitorBarcodeScanner: any = null;
let CapacitorBarcodeScannerTypeHintALLOption: any = { ALL: 17 };
let CapacitorBarcodeScannerCameraDirection: any = { BACK: 1 };

const loadBarcodeScanner = async () => {
  if (Capacitor.isNativePlatform() && !CapacitorBarcodeScanner) {
    try {
      const mod = await import('@capacitor/barcode-scanner');
      CapacitorBarcodeScanner = mod.CapacitorBarcodeScanner;
      CapacitorBarcodeScannerTypeHintALLOption = mod.CapacitorBarcodeScannerTypeHintALLOption;
      CapacitorBarcodeScannerCameraDirection = mod.CapacitorBarcodeScannerCameraDirection;
    } catch {
      // Barcode scanner plugin not available on this platform
    }
  }
};

interface AttendanceAlert {
  id: string;
  type: 'success' | 'error';
  studentName?: string;
  studentId?: string;
  status?: AttendanceStatus;
  message: string;
  timestamp: Date;
}

const QRAttendance = () => {
  const { selectedInstitute, selectedClass, selectedSubject, currentInstituteId, user } = useAuth();
  const instituteRole = useInstituteRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  
  const [studentId, setStudentId] = useState('');
  const [markedCount, setMarkedCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [selectedEventId, setSelectedEventId] = useState(DEFAULT_EVENT_ID);
  const [attendanceAlerts, setAttendanceAlerts] = useState<AttendanceAlert[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<'qr' | 'barcode'>('qr');
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [studentImagesMap, setStudentImagesMap] = useState<Map<string, string>>(new Map());
  const [isManualProcessing, setIsManualProcessing] = useState(false);
  const [lastManualStudent, setLastManualStudent] = useState<{
    name: string;
    imageUrl?: string;
    status: AttendanceStatus;
    time: string;
    date: string;
  } | null>(null);

  // Location viewer dialog state
  const [locationViewerOpen, setLocationViewerOpen] = useState(false);
  const [locationViewData, setLocationViewData] = useState<LocationViewData | null>(null);

  // Fetch today's calendar events
  const calendarInfo = useTodayCalendarEvents(
    currentInstituteId,
    selectedClass?.id?.toString()
  );
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [lastMarkedStudent, setLastMarkedStudent] = useState<{ name: string; status: AttendanceStatus } | null>(null);
  const [isNativeScanning, setIsNativeScanning] = useState(false); // Track native scanner state
  const [qrSnapshotUrl, setQrSnapshotUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check if user has permission - InstituteAdmin, Teacher, and AttendanceMarker can mark attendance
  const hasPermission = ['InstituteAdmin', 'Teacher', 'AttendanceMarker'].includes(instituteRole);

  // Allow method switching by query param (?method=qr|barcode)
  useEffect(() => {
    const params = new URLSearchParams(routerLocation.search);
    const method = params.get('method');
    if (method === 'barcode') {
      setSelectedMethod('barcode');
    } else {
      setSelectedMethod('qr');
    }
  }, [routerLocation.search]);

  const sessionId = new URLSearchParams(routerLocation.search).get('sessionId') ?? undefined;
  const sessionName = new URLSearchParams(routerLocation.search).get('sessionName') ?? undefined;

  // Fetch students to get their images
  useEffect(() => {
    const fetchStudents = async () => {
      if (!currentInstituteId) return;
      
      try {
        const baseUrl = getBaseUrl();
        const token = await tokenStorageService.getAccessToken();
        
        const response = await fetch(
          `${baseUrl}/institute-users/institute/${currentInstituteId}/users/STUDENT?page=1&limit=500`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const studentsData = data.data || [];
          
          // Create a map of studentId -> imageUrl
          const imagesMap = new Map<string, string>();
          studentsData.forEach((student: any) => {
            if (student.id && student.imageUrl) {
              imagesMap.set(student.id.toString(), student.imageUrl);
            }
          });
          
          setStudentImagesMap(imagesMap);
        }
      } catch {
        // Images unavailable — continue without them
      }
    };
    
    fetchStudents();
  }, [currentInstituteId]);

  useEffect(() => {
    fetchLocation();

    return () => {
      stopCamera();
    };
  }, [selectedInstitute]);

  // Auto-dismiss last manual student card after 4 seconds
  useEffect(() => {
    if (lastManualStudent) {
      const timer = setTimeout(() => setLastManualStudent(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [lastManualStudent]);

  // Auto remove alerts after 1.25 seconds
  useEffect(() => {
    if (attendanceAlerts.length > 0) {
      const timer = setTimeout(() => {
        setAttendanceAlerts(prev => prev.slice(1));
      }, 1250);
      return () => clearTimeout(timer);
    }
  }, [attendanceAlerts]);

  const addAlert = (alert: Omit<AttendanceAlert, 'id' | 'timestamp'>) => {
    const newAlert: AttendanceAlert = {
      ...alert,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    // Clear all previous alerts and show only the new one
    setAttendanceAlerts([newAlert]);
  };

  const removeAlert = (id: string) => {
    setAttendanceAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const fetchLocation = async () => {
    setLocationLoading(true);
    
    try {
      let latitude: number, longitude: number;

      if (Capacitor.isNativePlatform()) {
        // Use Capacitor Geolocation on native
        const { Geolocation } = await import('@capacitor/geolocation');
        await Geolocation.requestPermissions();
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } else if (navigator.geolocation) {
        // Use browser geolocation on web
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
          });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } else {
        setLocation(null);
        setLocationLoading(false);
        return;
      }

      // Send raw coordinates only — no external reverse-geocode. The backend stores the
      // location string as-is and derives a human-readable label itself, so blocking the
      // scan on a slow, rate-limited third-party geocoder is unnecessary.
      setLocation({ latitude, longitude, address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` });
    } catch {
      setLocation(null);
    } finally {
      setLocationLoading(false);
    }
  };

  const generateAddress = (): string => {
    let address = selectedInstitute?.name || 'Unknown Institute';
    address += ' - Gate Scanner - Main Entrance';
    return address;
  };

  const startCameraForMethod = async (method: 'qr' | 'barcode') => {
    setSelectedMethod(method);
    
    setIsScanning(true);
    
    // Wait for video element to be rendered
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanQRCode);
      return;
    }

    // Set canvas to optimal size for better QR detection
    const width = video.videoWidth;
    const height = video.videoHeight;
    
    canvas.width = width;
    canvas.height = height;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, width, height);

    // Get image data for QR detection
    const imageData = context.getImageData(0, 0, width, height);
    
    // Enhanced QR detection with better options for close-up codes
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert"
    });

    if (code && code.data.trim()) {
      // Freeze-frame: capture snapshot and show briefly
      try {
        const snap = canvas.toDataURL('image/jpeg', 0.7);
        setQrSnapshotUrl(snap);
        setTimeout(() => setQrSnapshotUrl(null), 2000);
      } catch { /* canvas may be tainted in some browsers */ }
      handleMarkAttendanceByCard(code.data.trim());
    }

    // Always continue scanning for continuous detection
    animationRef.current = requestAnimationFrame(scanQRCode);
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      setCameraPermissionDenied(false);
      
      if (!videoRef.current || !canvasRef.current) {
        setTimeout(() => startCamera(), 200);
        return;
      }

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Stop any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Use platform-aware camera access
      if (Capacitor.isNativePlatform()) {
        await loadBarcodeScanner();

        if (!CapacitorBarcodeScanner) {
          // Fall through to web camera below
        } else {
          setIsNativeScanning(true);
          setIsScanning(true);
          
          // Start continuous scanning loop for native
          const nativeScanLoop = async () => {
            try {
              while (true) {
                const result = await CapacitorBarcodeScanner.scanBarcode({
                  hint: CapacitorBarcodeScannerTypeHintALLOption.ALL,
                  scanInstructions: 'Position QR code or barcode within the frame',
                  scanButton: false,
                  cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
                });
                
                if (result.ScanResult && result.ScanResult.trim()) {
                  handleMarkAttendanceByCard(result.ScanResult.trim());
                  
                  // Brief pause, then scan again
                  await new Promise(resolve => setTimeout(resolve, 1500));
                } else {
                  break;
                }
              }
            } catch {
              // scan loop ended
            } finally {
              setIsNativeScanning(false);
              setIsScanning(false);
            }
          };
          
          nativeScanLoop();
          return; // Don't continue to web camera setup
        }
      } else {
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        streamRef.current = stream;
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;

          const onLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve();
          };

          video.addEventListener('loadedmetadata', onLoadedMetadata);
          
          setTimeout(() => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            reject(new Error('Video failed to load metadata'));
          }, 10000);
        });

        // Start playing video
        await videoRef.current.play();
        
        // Start QR scanning loop
        scanQRCode();
      }
      
      
      setIsScanning(true);
      setCameraError(null);
      addAlert({
        type: 'success',
        message: `📱 Camera active! Point at QR codes or barcodes to scan automatically`
      });

    } catch (error: any) {
      let errorMessage = error instanceof Error ? error.message : 'Unknown camera error';
      
      // Provide user-friendly error messages
      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError') || error?.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please grant camera permission to use the scanner.';
        setCameraPermissionDenied(true);
      } else if (errorMessage.includes('NotFoundError')) {
        errorMessage = '📷 No camera found on this device.';
      } else if (errorMessage.includes('NotReadableError')) {
        errorMessage = '📱 Camera is busy. Please close other apps using the camera and try again.';
      } else if (errorMessage.includes('Video failed to load')) {
        errorMessage = '⏱️ Camera took too long to start. Please try again or reload the page.';
      }
      
      setCameraError(errorMessage);
      setIsScanning(false);
      
      addAlert({
        type: 'error',
        message: errorMessage
      });
    }
  };

  const openLocationViewer = (
    studentName?: string,
    studentId?: string,
    markingMethod?: string,
    markingTime?: string
  ) => {
    setLocationViewData({
      studentName,
      studentId,
      address: location ? { latitude: location.latitude, longitude: location.longitude } : undefined,
      location: location?.address,
      date: new Date().toISOString().split('T')[0],
      status,
      className: selectedClass?.name,
      instituteName: selectedInstitute?.name,
      markingTime: markingTime || new Date().toLocaleTimeString(),
      markingMethod,
    });
    setLocationViewerOpen(true);
  };

  const stopCamera = async () => {
    try {
      // Stop animation frame
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      // Platform-specific cleanup
      if (Capacitor.isNativePlatform()) {
        setIsNativeScanning(false);
      } else {
        // Web: Stop media stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        // Clear video source
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
      
      setIsScanning(false);
      setCameraError(null);
      // Start 15-min auto-cleanup countdown for scan log
      attendanceScanLog.endSession();
      
      addAlert({
        type: 'success',
        message: '📱 Camera stopped'
      });
    } catch {
      // ignore stop errors
    }
  };

  const handleMarkAttendanceByCard = async (studentCardId: string) => {
    if (!studentCardId.trim() || !currentInstituteId || !selectedInstitute?.name) {
      addAlert({
        type: 'error',
        message: '⚠️ Missing information - ensure student code and institute are selected'
      });
      // Scanner continues automatically - no need to restart
      return;
    }

    // Location is optional - continue without it

    try {
      const address = buildAttendanceAddress({
        instituteName: selectedInstitute.name,
        className: selectedClass?.name,
        subjectName: selectedSubject?.name,
        location: location?.address,
      });

      // ✅ NEW: Build address coordinates object
      const addressCoordinates: AddressCoordinates | undefined = location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
          }
        : undefined;

      const request: MarkAttendanceByCardRequest = {
        studentCardId: studentCardId.trim(),
        instituteId: currentInstituteId,
        instituteName: selectedInstitute.name,
        // ✅ NEW: Use address object instead of separate latitude/longitude
        address: addressCoordinates,
        // Location display name (human-readable address)
        location: location?.address,
        markingMethod: selectedMethod,
        status: status,
        date: calendarInfo.currentDate,
      };

      // Only send eventId for institute scope (class/subject → eventId is always null)
      if (!selectedClass && selectedEventId !== DEFAULT_EVENT_ID) {
        request.eventId = selectedEventId;
      }

      // Link to session when marking at class level
      if (sessionId) {
        request.classSessionId = sessionId;
      }

      // Include class data if selected
      if (selectedClass) {
        request.classId = selectedClass.id;
        request.className = selectedClass.name;
      }

      // Include subject data if selected
      if (selectedSubject) {
        request.subjectId = selectedSubject.id;
        request.subjectName = selectedSubject.name;
      }

      const result = await childAttendanceApi.markAttendanceByCard(request);

      // Update event picker from response's availableEvents
      const responseAny = result as any;
      if (responseAny.availableEvents) {
        calendarInfo.updateFromResponse(responseAny.availableEvents);
      }

      if (result.success) {
        const responseData = responseAny.data || result;
        const studentName = responseData.studentName || responseAny.studentName || 'Student';
        const studentIdFromResponse = responseData.studentId || studentCardId.trim();
        const imageUrl = responseData.imageUrl || responseAny.imageUrl || studentImagesMap.get(studentIdFromResponse);
        const dateStr = responseData.date ? new Date(responseData.date).toLocaleDateString() : new Date().toLocaleDateString();
        const timeStr = responseData.time || new Date().toLocaleTimeString();
        const attendanceStatus = responseData.status || request.status;
        
        // Log to scan log for the overlay cards
        attendanceScanLog.add({
          success: true,
          studentName,
          studentId: studentIdFromResponse,
          studentCardId: studentCardId.trim(),
          imageUrl,
          status: attendanceStatus,
        });

        toast({
          title: attendanceStatus === 'present' ? 'Attendance Marked ✓' : 'Attendance Marked',
          description: `${studentName} - ${attendanceStatus.toUpperCase()} - ${dateStr} ${timeStr}`,
          isAttendanceAlert: true,
          imageUrl: imageUrl,
          status: attendanceStatus,
        });
        setMarkedCount(prev => prev + 1);
        
        // Show success animation
        setLastMarkedStudent({ name: studentName, status: attendanceStatus });
        setShowSuccessAnimation(true);
        setTimeout(() => setShowSuccessAnimation(false), 3000);
        addAlert({
          type: 'success',
          studentName: result.name || `Student ${studentCardId.trim()}`,
          studentId: studentCardId.trim(),
          status: result.status,
          message: `🎉 ${result.name || `Student ${studentCardId.trim()}`} marked as ${result.status.toUpperCase()}`
        });
        
      } else {
        throw new Error(result.message || 'Failed to mark attendance');
      }
    } catch (error: any) {
      
      let errorMessage = 'Failed to mark attendance';
      if (error instanceof Error) {
        const errorMsg = error.message;
        // Check for 404 "User not found" error
        if (errorMsg.includes('404') && errorMsg.includes('User not found')) {
          errorMessage = 'Invalid user id';
        } else {
          errorMessage = errorMsg;
        }
      }
      
      // Log failure to scan log
      attendanceScanLog.add({
        success: false,
        studentCardId: studentCardId.trim(),
        errorMessage,
      });

      addAlert({
        type: 'error',
        message: `❌ ${errorMessage}`
      });

      // Scanner continues automatically
    }
  };

  const handleManualMarkAttendance = async () => {
    if (!studentId.trim() || !currentInstituteId || !selectedInstitute?.name) {
      addAlert({
        type: 'error',
        message: 'Please enter student ID and ensure institute is selected'
      });
      return;
    }

    // Location is optional
    setIsManualProcessing(true);
    try {
      // ✅ NEW: Build address coordinates object
      const addressCoordinates: AddressCoordinates | undefined = location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
          }
        : undefined;

      const request: MarkAttendanceRequest = {
        studentId: studentId.trim(),
        instituteId: currentInstituteId,
        instituteName: selectedInstitute.name,
        // ✅ NEW: Use address object instead of separate latitude/longitude
        address: addressCoordinates,
        // Location display name (human-readable address)
        location: location?.address,
        markingMethod: 'manual',
        status: status,
        date: calendarInfo.currentDate,
      };

      // Only send eventId for institute scope (class/subject → eventId is always null)
      if (!selectedClass && selectedEventId !== DEFAULT_EVENT_ID) {
        request.eventId = selectedEventId;
      }

      // Link to session when marking at class level
      if (sessionId) {
        (request as any).classSessionId = sessionId;
      }

      // Only include class data if a class is selected
      if (selectedClass) {
        request.classId = selectedClass.id;
        request.className = selectedClass.name;
      }

      // Only include subject data if a subject is selected
      if (selectedSubject) {
        request.subjectId = selectedSubject.id;
        request.subjectName = selectedSubject.name;
      }

      const result = await childAttendanceApi.markAttendance(request);

      // Update event picker from response's availableEvents
      const manualResponseAny = result as any;
      if (manualResponseAny.availableEvents) {
        calendarInfo.updateFromResponse(manualResponseAny.availableEvents);
      }

      if (result.success) {
        const responseData = (result as any).data || result;
        const studentName = responseData.studentName || (result as any).studentName || (result as any).name || 'Student';
        const studentIdFromResponse = responseData.studentId || studentId;
        const imageUrl = responseData.imageUrl || (result as any).imageUrl || studentImagesMap.get(studentIdFromResponse);
        const dateStr = responseData.date ? new Date(responseData.date).toLocaleDateString() : new Date().toLocaleDateString();
        const timeStr = responseData.time || new Date().toLocaleTimeString();
        const attendanceStatus = responseData.status || status;
        
        const previousCount = markedCount;
        setMarkedCount(prev => prev + 1);
        setStudentId('');
        setLastManualStudent({
          name: studentName,
          imageUrl,
          status: attendanceStatus,
          time: timeStr,
          date: dateStr,
        });

        setTimeout(() => { inputRef.current?.focus(); }, 100);
      } else {
        throw new Error(result.message || 'Failed to mark attendance');
      }
    } catch (error: any) {
      const selectionPath = [selectedInstitute.name, selectedClass?.name, selectedSubject?.name]
        .filter(Boolean)
        .join(' → ');

      // Rebuild address coordinates for error logging
      const addressCoordinatesForLog: AddressCoordinates | undefined = location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
          }
        : undefined;

      const requestForLog: MarkAttendanceRequest = {
        studentId: studentId.trim(),
        instituteId: currentInstituteId,
        instituteName: selectedInstitute.name,
        address: addressCoordinatesForLog,
        location: location?.address,
        markingMethod: 'manual',
        status: status
      };

      // Only include class data if a class is selected
      if (selectedClass) {
        requestForLog.classId = selectedClass.id;
        requestForLog.className = selectedClass.name;
      }

      // Only include subject data if a subject is selected
      if (selectedSubject) {
        requestForLog.subjectId = selectedSubject.id;
        requestForLog.subjectName = selectedSubject.name;
      }
      
      // Parse error message for user-friendly display
      let errorMessage = 'Failed to mark attendance';
      if (error instanceof Error) {
        const errorMsg = error.message;
        // Check for 404 "User not found" error
        if (errorMsg.includes('404') && errorMsg.includes('User not found')) {
          errorMessage = 'Invalid user id';
        } else {
          errorMessage = errorMsg;
        }
      }
      
      toast({
        title: 'Failed to Mark Attendance',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsManualProcessing(false);
    }
  };

  const handleBack = () => {
    stopCamera();
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
      return;
    }
    navigate('/dashboard');
  };

  if (!hasPermission) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">Access Denied</h3>
            <p className="text-muted-foreground">
              You don't have permission to mark attendance. This feature is available for Institute Admins, Teachers, and Attendance Markers.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedInstitute) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">Institute Selection Required</h3>
            <p className="text-muted-foreground">
              Please select an institute first to mark attendance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Class-level marking requires a session — block if no sessionId
  if (selectedClass && !sessionId) {
    const instituteId = currentInstituteId || selectedInstitute?.id;
    return (
      <div className="container mx-auto p-4 max-w-md">
        <Card className="border-orange-200">
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
      <div className="min-h-screen bg-background">
      
      {/* Attendance Alerts */}
      <div className="fixed top-4 left-4 z-50 space-y-2 max-w-sm pt-safe-top">
        {attendanceAlerts.map((alert) => (
          <Alert 
            key={alert.id}
            className={`shadow-lg animate-in slide-in-from-left-5 ${
              alert.type === 'success' 
                ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${
                alert.type === 'success' ? 'bg-green-100 dark:bg-green-800' : 'bg-red-100 dark:bg-red-800'
              }`}>
                {alert.type === 'success' ? (
                  <CheckCircle className={`h-5 w-5 ${alert.type === 'success' ? 'text-green-600 dark:text-green-200' : 'text-red-600 dark:text-red-200'}`} />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-200" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className={`text-sm font-semibold ${
                    alert.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                  }`}>
                    {alert.type === 'success' ? 'Success' : 'Error'}
                  </h4>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => removeAlert(alert.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <AlertDescription className={`${
                  alert.type === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                } mt-1`}>
                  <div className="text-sm">{alert.message}</div>
                  {alert.studentName && (
                    <div className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        {alert.status}
                      </Badge>
                      <span className="opacity-75">
                        {alert.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        ))}
      </div>

      <div className="container mx-auto p-4 space-y-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">QR Scanner</h1>
            <p className="text-muted-foreground text-sm">
              Scan QR codes to mark student attendance
            </p>
          </div>
        </div>

        {/* Current Selection Card */}
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

        {/* Stats Card */}
        {/* Shared Controls */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
            <Select value={status} onValueChange={(value) => setStatus(value as AttendanceStatus)}>
              <SelectTrigger className="w-full h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 z-50">
                {ALL_ATTENDANCE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{ATTENDANCE_STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Event Selector — only for institute scope */}
          {!selectedClass && (
            <div>
              <EventSelector
                events={calendarInfo.events}
                selectedEventId={selectedEventId}
                onEventChange={setSelectedEventId}
                loading={calendarInfo.loading}
                dayType={calendarInfo.dayType}
                isAttendanceExpected={calendarInfo.isAttendanceExpected}
                compact
              />
            </div>
          )}
        </div>

        {/* Two-column grid: Manual Entry + Compact QR Scanner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Manual Entry - top/left */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="h-4 w-4" />
                Manual Entry
              </CardTitle>
              <CardDescription className="text-xs">Enter student ID to mark attendance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Student result after mark */}
              {lastManualStudent && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl overflow-hidden">
                  {/* Header strip */}
                  <div className="flex items-center justify-between px-4 py-2 bg-green-100 dark:bg-green-900/40 border-b border-green-200 dark:border-green-700">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-semibold text-green-700 dark:text-green-300">Attendance Marked</span>
                    </div>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-green-600 hover:text-green-800 hover:bg-green-200 dark:hover:bg-green-800"
                      onClick={() => setLastManualStudent(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* Body */}
                  <div className="flex items-center gap-4 p-4">
                    {/* Photo */}
                    <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800 border-2 border-green-300 dark:border-green-600 shadow-sm">
                      {lastManualStudent.imageUrl ? (
                        <img
                          src={getImageUrl(lastManualStudent.imageUrl)}
                          alt={lastManualStudent.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-green-100 dark:bg-green-900/30">
                          <UserCheck className="h-10 w-10 text-green-500" />
                        </div>
                      )}
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="font-bold text-lg text-gray-900 dark:text-white leading-tight truncate">
                        {lastManualStudent.name}
                      </p>
                      <Badge
                        className={`text-sm px-3 py-0.5 font-semibold ${
                          lastManualStudent.status === 'present' ? 'bg-green-500 hover:bg-green-500 text-white' :
                          lastManualStudent.status === 'absent'  ? 'bg-red-500 hover:bg-red-500 text-white' :
                          lastManualStudent.status === 'late'    ? 'bg-yellow-500 hover:bg-yellow-500 text-white' :
                                                                   'bg-blue-500 hover:bg-blue-500 text-white'
                        }`}
                      >
                        {ATTENDANCE_STATUS_CONFIG[lastManualStudent.status]?.label || lastManualStudent.status}
                      </Badge>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{lastManualStudent.date}</span>
                        <span>•</span>
                        <span>{lastManualStudent.time}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Event Selector — only for institute scope */}
              {!selectedClass && (
                <EventSelector
                  events={calendarInfo.events}
                  selectedEventId={selectedEventId}
                  onEventChange={setSelectedEventId}
                  loading={calendarInfo.loading}
                  dayType={calendarInfo.dayType}
                  isAttendanceExpected={calendarInfo.isAttendanceExpected}
                  compact
                />
              )}

              <Input
                ref={inputRef}
                placeholder="Enter Student ID"
                value={studentId}
                onChange={(e) => { setStudentId(e.target.value); if (lastManualStudent) setLastManualStudent(null); }}
                onKeyPress={(e) => { if (e.key === 'Enter') handleManualMarkAttendance(); }}
                className="h-10"
              />

              <Button
                onClick={handleManualMarkAttendance}
                className="w-full"
                disabled={!studentId.trim() || isManualProcessing}
              >
                {isManualProcessing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                ) : (
                  <><UserCheck className="h-4 w-4 mr-2" />Mark Attendance</>
                )}
              </Button>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">Marked today</span>
                <span className="text-sm font-bold text-green-600">{markedCount}</span>
              </div>
            </CardContent>
          </Card>

          {/* QR Scanner - Compact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-4 w-4" />
                Scan QR
              </CardTitle>
              <CardDescription className="text-xs">Position code within the frame</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isScanning ? (
                <div className="text-center py-8 space-y-3">
                  {cameraPermissionDenied ? (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto">
                        <AlertCircle className="h-8 w-8 text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">Camera Access Denied</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {Capacitor.isNativePlatform()
                            ? 'Open your device Settings → Apps → and allow Camera permission for this app.'
                            : 'Click the camera icon in your browser address bar and allow camera access, then try again.'}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          setCameraPermissionDenied(false);
                          setCameraError(null);
                          startCameraForMethod(selectedMethod);
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Try Again
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto">
                        <Camera className="h-8 w-8 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Ready to Scan</p>
                        <p className="text-xs text-muted-foreground">Start camera to scan QR / Barcode</p>
                      </div>
                      <Button
                        onClick={() => startCameraForMethod(selectedMethod)}
                        className="w-full"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Start Camera
                      </Button>
                      {cameraError && (
                        <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 text-left">
                          <AlertDescription className="text-red-700 dark:text-red-300 text-xs">{cameraError}</AlertDescription>
                        </Alert>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button onClick={stopCamera} variant="outline" size="sm" className="flex items-center gap-1.5">
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Stop
                    </Button>
                    <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Scanning...
                    </div>
                    <span className="ml-auto text-xs font-medium">{markedCount} marked</span>
                  </div>
                  <div className="relative w-full aspect-square bg-gray-900 rounded-xl overflow-hidden max-w-[220px] mx-auto">
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    <canvas ref={canvasRef} className="hidden" />
                    {cameraError && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                        <div className="text-center text-white p-4">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-xs">{cameraError}</p>
                        </div>
                      </div>
                    )}
                    {showSuccessAnimation && lastMarkedStudent && (
                      <div className="absolute inset-0 bg-green-500/30 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-2xl text-center space-y-2 mx-3 animate-in zoom-in duration-300">
                          <div className="mx-auto w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-6 w-6 text-white" />
                          </div>
                          <p className="text-xs font-bold text-green-600">{lastMarkedStudent.name}</p>
                          <Badge variant={lastMarkedStudent.status === 'present' ? 'default' : 'secondary'} className="text-xs">
                            {ATTENDANCE_STATUS_CONFIG[lastMarkedStudent.status].label}
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => openLocationViewer(lastMarkedStudent.name, '', selectedMethod)}
                            className="mt-2 w-full"
                            variant="outline"
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            View Location
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="relative w-28 h-28">
                        <div className="absolute -top-px -left-px w-6 h-6 border-t-[3px] border-l-[3px] border-blue-400 rounded-tl-lg" />
                        <div className="absolute -top-px -right-px w-6 h-6 border-t-[3px] border-r-[3px] border-blue-400 rounded-tr-lg" />
                        <div className="absolute -bottom-px -left-px w-6 h-6 border-b-[3px] border-l-[3px] border-blue-400 rounded-bl-lg" />
                        <div className="absolute -bottom-px -right-px w-6 h-6 border-b-[3px] border-r-[3px] border-blue-400 rounded-br-lg" />
                        <div className="absolute left-2 right-2 h-px bg-blue-400/70 rounded-full animate-scan-line" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Scanner Overlay - renders on top when scanning */}
      <MobileScannerOverlay
        isActive={isScanning}
        onClose={stopCamera}
        scanMethod={selectedMethod}
        status={status}
        onStatusChange={(value) => setStatus(value)}
        markedCount={markedCount}
        videoRef={videoRef as React.RefObject<HTMLVideoElement>}
        canvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
        cameraError={cameraError}
        snapshotUrl={qrSnapshotUrl}
      />

      {/* Location Viewer Dialog */}
      <AttendanceLocationViewer
        open={locationViewerOpen}
        onOpenChange={setLocationViewerOpen}
        studentName={locationViewData?.studentName}
        studentId={locationViewData?.studentId}
        address={locationViewData?.address}
        location={locationViewData?.location}
        date={locationViewData?.date}
        status={locationViewData?.status}
        className={locationViewData?.className}
        instituteName={locationViewData?.instituteName}
        markingTime={locationViewData?.markingTime}
        markingMethod={locationViewData?.markingMethod}
      />
    </div>
  );
};

export default QRAttendance;