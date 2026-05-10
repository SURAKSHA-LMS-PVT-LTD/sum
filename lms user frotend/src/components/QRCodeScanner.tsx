import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useToast } from '@/hooks/use-toast';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { attendanceDuplicateChecker } from '@/utils/attendanceDuplicateCheck';
import { ArrowLeft, Camera, QrCode, UserCheck, CheckCircle, MapPin, Monitor, Users, X, RefreshCw } from 'lucide-react';
import jsQR from 'jsqr';
import { getAttendanceUrl, getBaseUrl, getCredentialsMode } from '@/contexts/utils/auth.api';
import { getAuthHeadersSync } from '@/services/tokenStorageService';
import { Capacitor } from '@capacitor/core';
import { useTodayCalendarEvents, DEFAULT_EVENT_ID } from '@/hooks/useTodayCalendarEvents';
import EventSelector from '@/components/attendance/EventSelector';
import { AddressCoordinates } from '@/types/attendance.types';

interface MarkAttendanceRequest {
  instituteId: string;
  classId?: string;
  subjectId?: string;
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  // ✅ NEW: Consolidated coordinates
  address?: AddressCoordinates;
  location?: string;
}

interface StudentData {
  id: string;
  name: string;
  package: string;
  town: string;
  imageUrl: string;
}

interface MarkAttendanceResponse {
  success: boolean;
  message?: string;
  data?: {
    student: StudentData;
  };
  markedBy?: string;
  userType?: string;
}

interface AttendanceNotification {
  student: StudentData;
  status: string;
  timestamp: Date;
}

const QRCodeScanner = () => {
  const { selectedInstitute, selectedClass, selectedSubject, currentInstituteId, currentClassId, currentSubjectId, user } = useAuth();
  const userRole = useInstituteRole();
  const { toast } = useToast();
  
  const [studentId, setStudentId] = useState('');
  const [markedCount, setMarkedCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address: string } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [status, setStatus] = useState<"PRESENT" | "ABSENT" | "LATE" | "EXCUSED">('PRESENT');
  const [selectedEventId, setSelectedEventId] = useState(DEFAULT_EVENT_ID);
  const [attendanceNotification, setAttendanceNotification] = useState<AttendanceNotification | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch today's calendar events for the event selector
  const calendarInfo = useTodayCalendarEvents(currentInstituteId, currentClassId);

  // Check if user has permission - InstituteAdmin, Teacher, and AttendanceMarker can mark attendance
  const hasPermission = userRole === 'InstituteAdmin' || userRole === 'Teacher' || userRole === 'AttendanceMarker';

  useEffect(() => {
    if (attendanceNotification) {
      const timer = setTimeout(() => {
        setAttendanceNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [attendanceNotification]);

  useEffect(() => {
    fetchLocation();

    return () => {
      stopCamera();
    };
  }, [selectedInstitute, selectedClass, selectedSubject]);

  const fetchLocation = async () => {
    setLocationLoading(true);
    console.log('Fetching location...');
    
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
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
          });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } else {
        console.log('Geolocation not supported');
        setLocation(null);
        setLocationLoading(false);
        return;
      }
      
      console.log('GPS coordinates:', { latitude, longitude });
      try {
        const address = await reverseGeocode(latitude, longitude);
        setLocation({ latitude, longitude, address });
      } catch {
        const address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setLocation({ latitude, longitude, address });
      }
    } catch (error: any) {
      console.log('Location access error (optional):', error);
      setLocation(null);
    } finally {
      setLocationLoading(false);
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
      const data = await response.json();
      
      if (data && data.display_name) {
        return data.display_name;
      }
      throw new Error('No address found');
    } catch (error: any) {
      console.log('Reverse geocoding failed:', error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  };

  const generateAddress = (): string => {
    let address = selectedInstitute?.name || 'Unknown Institute';
    
    if (selectedClass?.name) {
      address += ` - ${selectedClass.name}`;
    }
    
    if (selectedSubject?.name) {
      address += ` - ${selectedSubject.name}`;
    }
    
    return address;
  };

  const getDeviceType = (): string => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/mobile|android|iphone|ipad|tablet/.test(userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  };

  const getApiHeaders = () => getAuthHeadersSync();

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanQRCode);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code && code.data.trim()) {
      console.log('🎯 QR Code detected:', code.data);
      handleMarkAttendance(code.data.trim());
      return; // Stop scanning temporarily after detection
    }

    // Continue scanning
    animationRef.current = requestAnimationFrame(scanQRCode);
  };

  const startCamera = async () => {
    try {
      console.log('Starting camera...');
      setCameraError(null);
      
      if (!videoRef.current || !canvasRef.current) {
        throw new Error('Video or canvas element not found');
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
          console.log('Video metadata loaded:', {
            width: video.videoWidth,
            height: video.videoHeight
          });
          resolve();
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata);
        
        setTimeout(() => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          reject(new Error('Video failed to load metadata'));
        }, 10000);
      });

      await videoRef.current.play();
      
      // Start QR scanning loop
      scanQRCode();

      setIsScanning(true);
      setCameraError(null);

      console.log('QR Scanner started successfully');

      toast({
        title: "Camera Started",
        description: "Point camera at QR code to scan automatically"
      });

    } catch (error: any) {
      console.error('Camera start error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown camera error';
      setCameraError(errorMessage);
      setIsScanning(false);
      
      let userMessage = errorMessage;
      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        userMessage = 'Camera access denied. Please allow camera permissions and refresh the page.';
      } else if (errorMessage.includes('No camera found')) {
        userMessage = 'No camera found on this device.';
      } else if (errorMessage.includes('NotReadableError')) {
        userMessage = 'Camera is being used by another application. Please close other apps using the camera.';
      } else if (errorMessage.includes('Video failed to load')) {
        userMessage = 'Camera failed to initialize. Please try again or refresh the page.';
      }
      
      toast({
        title: "Camera Access Error",
        description: userMessage,
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    try {
      console.log('Stopping camera...');
      
      // Stop animation frame
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      // Stop media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Clear video source
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.style.display = 'none';
      }
      
      setIsScanning(false);
      setCameraError(null);
      console.log('Camera stopped successfully');
    } catch (error: any) {
      console.error('Error stopping camera:', error);
    }
  };

  const handleMarkAttendance = async (studentIdValue: string) => {
    console.log('=== HANDLE QR ATTENDANCE START ===');
    console.log('Scanned Student ID:', studentIdValue);
    console.log('Current Institute ID:', currentInstituteId);
    console.log('Selected Institute:', selectedInstitute?.name);
    console.log('Current Location:', location);
    console.log('Selected Status:', status);
    console.log('=====================================');

    if (!studentIdValue.trim() || !currentInstituteId) {
      console.log('❌ VALIDATION FAILED: Missing student ID or institute information');
      toast({
        title: "Missing Information",
        description: "Please ensure student ID and institute are selected",
        variant: "destructive"
      });
      return;
    }

    // Location is optional

    try {
      let attendanceBaseUrl = getAttendanceUrl();
      if (!attendanceBaseUrl) {
        // Use main API URL as fallback
        attendanceBaseUrl = getBaseUrl();
        if (!attendanceBaseUrl) {
          throw new Error('No API URL configured. Please set the API URL in settings.');
        }
      }

      console.log('Using attendance URL:', attendanceBaseUrl);

      const headers = getApiHeaders();
      
      // ✅ NEW: Build address coordinates object
      const addressCoordinates: AddressCoordinates | undefined = location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
          }
        : undefined;
      
      const requestBody: MarkAttendanceRequest & { eventId?: string; date?: string } = {
        instituteId: currentInstituteId,
        studentId: studentIdValue.trim(),
        status: status,
        // ✅ NEW: Use address object instead of separate latitude/longitude
        address: addressCoordinates,
        // Location display name (human-readable address)
        location: location?.address,
        date: calendarInfo.currentDate,
      };

      // Send eventId — use selected event or omit for default
      if (selectedEventId !== DEFAULT_EVENT_ID) {
        requestBody.eventId = selectedEventId;
      }

      // Only include classId if it has a valid value
      if (currentClassId) {
        requestBody.classId = currentClassId;
      }

      // Only include subjectId if it has a valid value
      if (currentSubjectId) {
        requestBody.subjectId = currentSubjectId;
      }

      const baseUrl = attendanceBaseUrl.endsWith('/') ? attendanceBaseUrl.slice(0, -1) : attendanceBaseUrl;
      const fullApiUrl = `${baseUrl}/api/attendance/mark`;
      
      console.log('=== PREPARING QR ATTENDANCE REQUEST ===');
      console.log('API Endpoint:', fullApiUrl);
      console.log('Request Body:', JSON.stringify(requestBody, null, 2));
      console.log('Request Headers:', headers);
      console.log('About to make API call...');
      console.log('=========================================');

      const response = await fetch(fullApiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      console.log('=== QR ATTENDANCE API RESPONSE ===');
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      console.log('================================');

      if (!response.ok) {
        const errorText = await response.text();
        console.error('=== QR ATTENDANCE API ERROR ===');
        console.error('Status Code:', response.status);
        console.error('Status Text:', response.statusText);
        console.error('Error Response:', errorText);
        console.error('Original Request:', JSON.stringify(requestBody, null, 2));
        console.error('=============================');
        throw new Error(`Failed to mark attendance: ${response.status} - ${errorText}`);
      }

      const result: MarkAttendanceResponse = await response.json();
      console.log('=== QR ATTENDANCE SUCCESS ===');
      console.log('Result:', JSON.stringify(result, null, 2));

      // Update event picker from response's availableEvents
      if ((result as any).availableEvents) {
        calendarInfo.updateFromResponse((result as any).availableEvents);
      }

      if (result.success && result.data?.student) {
        // ✅ RECORD ATTENDANCE LOCALLY TO PREVENT DUPLICATES
        const userId = localStorage.getItem('userId') || user?.id || 'unknown';
        const statusLower = (status === 'ABSENT' ? 'absent' : status === 'LATE' ? 'late' : 'present') as 'present' | 'absent' | 'late';
        attendanceDuplicateChecker.recordAttendance({
          userId,
          studentId: studentIdValue.trim(),
          instituteId: currentInstituteId,
          classId: currentClassId || undefined,
          subjectId: currentSubjectId || undefined,
          status: statusLower,
          method: 'qr'
        });

        setMarkedCount(prev => prev + 1);
        setStudentId(result.data.student.id); // Set the actual student ID from response
        
        setAttendanceNotification({
          student: result.data.student,
          status: status,
          timestamp: new Date()
        });

        // Briefly pause scanning to prevent duplicate scans
        if (isScanning && videoRef.current && canvasRef.current) {
          console.log('⏸️ Pausing scanner to prevent duplicates...');
          try {
            // Stop current scanning
            if (animationRef.current) {
              cancelAnimationFrame(animationRef.current);
              animationRef.current = null;
            }
            setTimeout(() => {
              if (isScanning && videoRef.current && canvasRef.current) {
                console.log('▶️ Resuming scanner...');
                scanQRCode();
              }
            }, 2000);
          } catch (e) {
            console.error('Error pausing scanner:', e);
          }
        }

        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } else {
        throw new Error(result.message || 'Failed to mark attendance');
      }
    } catch (error: any) {
      console.error('Failed to mark attendance:', error);
      toast({
        title: "Mark Failed",
        description: error instanceof Error ? error.message : "Failed to mark attendance. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleStudentIdChange = (value: string) => {
    setStudentId(value);
  };

  const handleManualSubmit = () => {
    if (studentId.trim()) {
      handleMarkAttendance(studentId);
    }
  };

  const handleBack = () => {
    stopCamera();
    window.history.back();
  };

  const simulateQRScan = () => {
    const randomId = `STU${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    setStudentId(randomId);
    handleMarkAttendance(randomId);
  };

  const handleRefreshLocation = () => {
    fetchLocation();
  };

  if (!hasPermission) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Card>
          <CardContent className="text-center py-8 sm:py-12">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Access Denied
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
              You don't have permission to mark attendance. This feature is available for Institute Admins, Teachers, and Attendance Markers.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedInstitute) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Card>
          <CardContent className="text-center py-8 sm:py-12">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Institute Selection Required
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
              Please select an institute first to mark attendance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Attendance Success Notification */}
      {attendanceNotification && (
        <div className="fixed top-4 left-2 right-2 sm:left-4 sm:right-auto z-50 animate-in slide-in-from-left-5">
          <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 shadow-lg max-w-sm sm:min-w-[320px]">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                {attendanceNotification.student.imageUrl ? (
                  <img 
                    src={getImageUrl(attendanceNotification.student.imageUrl)} 
                    alt={attendanceNotification.student.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAxMkMyNi4yMDkxIDEyIDI4IDEzLjc5MDkgMjggMTZDMjggMTguMjA5MSAyNi4yMDkxIDIwIDI0IDIwQzIxLjc5MDkgMjAgMjAgMTguMjA5MSAyMCAxNkMyMCAxMy43OTA5IDIxLjc5MDkgMTIgMjQgMTJaIiBmaWxsPSIjOUM5Q0EzIi8+CjxwYXRoIGQ9Ik0xNiAzNkMxNiAzMC40NzcyIDE5LjU4MTcgMjYgMjQgMjZDMjguNDE4MyAyNiAzMiAzMC40NzcyIDMyIDM2SDE2WiIgZmlsbD0iIzlDOUNBMyIvPgo8L3N2Zz4K';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <UserCheck className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-semibold text-green-800 dark:text-green-200">
                    Attendance Marked Successfully
                  </h4>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-green-600 hover:text-green-800"
                    onClick={() => setAttendanceNotification(null)}
                  >
                    <X className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
                <AlertDescription className="text-green-700 dark:text-green-300 mt-1">
                  <div className="font-medium text-sm sm:text-base truncate">{attendanceNotification.student.name}</div>
                  <div className="text-xs mt-1 flex items-center gap-1 sm:gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs px-1 py-0 border-green-300 text-green-700">
                      {attendanceNotification.status}
                    </Badge>
                    <span className="text-green-600">
                      {attendanceNotification.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {attendanceNotification.student.town && (
                    <div className="text-xs text-green-600 mt-1 truncate">
                      📍 {attendanceNotification.student.town}
                    </div>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        </div>
      )}

      <div className="container mx-auto p-4 sm:p-6 space-y-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleBack} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              QR Code Attendance
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Scan QR codes to mark student attendance
            </p>
          </div>
        </div>

        {/* Current Selection Card - Updated to match image */}
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100 text-lg">
              <QrCode className="h-5 w-5" />
              Current Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Institute: </span>
                <span className="text-blue-900 dark:text-blue-100">{selectedInstitute.name}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Class: </span>
                <span className="text-blue-900 dark:text-blue-100">{selectedClass?.name || 'Not selected'}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Marker: </span>
                <span className="text-blue-900 dark:text-blue-100">{user?.name || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Location: </span>
                <span className="text-xs text-blue-900 dark:text-blue-100">{location?.address || 'Getting location...'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid - Updated layout to match image */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QR Code Scanner - Left Side */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Camera className="h-5 w-5" />
                QR Code Scanner
              </CardTitle>
              <CardDescription className="text-sm">
                Point camera at QR code to automatically scan and mark attendance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Camera Preview Area */}
               <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden">
                 <video
                   ref={videoRef}
                   className="hidden"
                   autoPlay
                   playsInline
                   muted
                 />
                 <canvas
                   ref={canvasRef}
                   className="hidden"
                 />
                 {!isScanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                    <Camera className="h-16 w-16 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Camera Off
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Click start to begin scanning
                    </p>
                  </div>
                )}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-8 border-2 border-blue-400 rounded-lg opacity-75">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="flex gap-2">
                {!isScanning ? (
                  <Button 
                    onClick={startCamera} 
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    disabled={!!cameraError}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Start Camera
                  </Button>
                ) : (
                  <Button onClick={stopCamera} variant="outline" className="flex-1">
                    Stop Camera
                  </Button>
                )}
                <Button onClick={simulateQRScan} variant="outline">
                  Demo Scan
                </Button>
              </div>

              {cameraError && (
                <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
                  <AlertDescription className="text-red-700 dark:text-red-300 text-sm">
                    {cameraError}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Manual Entry - Right Side - Updated to match image */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCheck className="h-5 w-5" />
                Manual Entry
              </CardTitle>
              <CardDescription className="text-sm">
                Manually enter student ID and select status to mark attendance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Attendance Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Attendance Status</label>
                <Select value={status} onValueChange={(value: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED") => setStatus(value)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT">Present</SelectItem>
                    <SelectItem value="ABSENT">Absent</SelectItem>
                    <SelectItem value="LATE">Late</SelectItem>
                    <SelectItem value="EXCUSED">Excused</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Event Selector */}
              <EventSelector
                events={calendarInfo.events}
                selectedEventId={selectedEventId}
                onEventChange={setSelectedEventId}
                loading={calendarInfo.loading}
                dayType={calendarInfo.dayType}
                isAttendanceExpected={calendarInfo.isAttendanceExpected}
                compact
              />

              {/* Student ID Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Student ID</label>
                <Input
                  ref={inputRef}
                  value={studentId}
                  onChange={(e) => handleStudentIdChange(e.target.value)}
                  placeholder="Enter student ID or scan QR code"
                  className="h-10"
                />
              </div>

              {/* Mark Button */}
              <Button 
                onClick={handleManualSubmit} 
                disabled={!studentId.trim()}
                className="w-full bg-green-600 hover:bg-green-700 h-10"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark {status}
              </Button>

              {/* Statistics - Centered layout like in image */}
              <div className="text-center space-y-2 py-4">
                <div className="text-4xl font-bold text-green-600">{markedCount}</div>
                <div className="text-sm text-green-600 font-medium">Students Marked</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Current Status: {status}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default QRCodeScanner;
