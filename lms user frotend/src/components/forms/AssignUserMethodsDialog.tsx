import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { UserPlus, Phone, CreditCard, User, Eye, Mail, Upload, Camera, Loader2 } from 'lucide-react';
import { uploadWithSignedUrl, detectFolder } from '@/utils/signedUploadHelper';
import PassportImageCropUpload from '@/components/common/PassportImageCropUpload';
import { getErrorMessage } from '@/api/apiError';

interface AssignUserMethodsDialogProps {
  open: boolean;
  onClose: () => void;
  instituteId: string;
  onSuccess: () => void;
}

type AssignMethod = 'id' | 'phone' | 'rfid' | 'email';

interface UserPreviewData {
  id: string;
  imageUrl: string;
  fullName: string;
  userType: string;
}

const AssignUserMethodsDialog = ({ open, onClose, instituteId, onSuccess }: AssignUserMethodsDialogProps) => {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<AssignMethod | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userPreview, setUserPreview] = useState<UserPreviewData | null>(null);
  const [showUserPreview, setShowUserPreview] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Form states for different methods - changed image to imageUrl string
  const [idFormData, setIdFormData] = useState({
    userId: '',
    instituteUserType: 'STUDENT',
    userIdByInstitute: '',
    instituteCardId: '',
    imageUrl: ''
  });

  const [phoneFormData, setPhoneFormData] = useState({
    phoneNumber: '+94',
    instituteUserType: 'STUDENT',
    userIdByInstitute: '',
    instituteCardId: '',
    imageUrl: ''
  });

  const [rfidFormData, setRfidFormData] = useState({
    rfid: '',
    instituteUserType: 'STUDENT',
    userIdByInstitute: '',
    instituteCardId: '',
    imageUrl: ''
  });

  const [emailFormData, setEmailFormData] = useState({
    email: '',
    instituteUserType: 'STUDENT',
    userIdByInstitute: '',
    instituteCardId: '',
    imageUrl: ''
  });

  const handleAssignById = async () => {
    if (!idFormData.userId || !idFormData.userIdByInstitute) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        userId: idFormData.userId,
        instituteUserType: idFormData.instituteUserType,
        userIdByInstitute: idFormData.userIdByInstitute,
        ...(idFormData.instituteCardId && { instituteCardId: idFormData.instituteCardId }),
        ...(idFormData.imageUrl && { instituteImage: idFormData.imageUrl })
      };

      const response = await apiClient.post(
        `/institute-users/institute/${instituteId}/assign-user-by-id`,
        payload
      );

      if (response.success) {
        toast({
          title: "Success",
          description: response.message,
        });
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to assign user',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignByPhone = async () => {
    if (phoneFormData.phoneNumber.length <= 3 || !phoneFormData.userIdByInstitute) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid phone number and institute user ID",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      let imageUrl = '';
      
      // Upload image if provided using signed URL
      if (phoneFormData.imageUrl) {
        imageUrl = phoneFormData.imageUrl;
      }

      const payload = {
        phoneNumber: phoneFormData.phoneNumber,
        instituteUserType: phoneFormData.instituteUserType,
        userIdByInstitute: phoneFormData.userIdByInstitute,
        ...(phoneFormData.instituteCardId && { instituteCardId: phoneFormData.instituteCardId }),
        ...(imageUrl && { imageUrl })
      };

      const response = await apiClient.post(
        `/institute-users/institute/${instituteId}/assign-user-by-phone`,
        payload
      );

      if (response.success) {
        toast({
          title: "Success",
          description: response.message,
        });
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to assign user by phone',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignByRfid = async () => {
    if (!rfidFormData.rfid || !rfidFormData.userIdByInstitute) {
      toast({
        title: "Validation Error",
        description: "Please enter RFID and institute user ID",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      let instituteImage = '';
      
      // Upload image if provided using signed URL
      if (rfidFormData.imageUrl) {
        instituteImage = rfidFormData.imageUrl;
      }

      const payload = {
        rfid: rfidFormData.rfid,
        instituteUserType: rfidFormData.instituteUserType,
        userIdByInstitute: rfidFormData.userIdByInstitute,
        ...(rfidFormData.instituteCardId && { instituteCardId: rfidFormData.instituteCardId }),
        ...(instituteImage && { instituteImage })
      };

      const response = await apiClient.post(
        `/institute-users/institute/${instituteId}/assign-student-by-rfid`,
        payload
      );

      if (response.success) {
        toast({
          title: "Success",
          description: response.message,
        });
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to assign student by RFID',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignByEmail = async () => {
    if (!emailFormData.email || !emailFormData.userIdByInstitute) {
      toast({
        title: "Validation Error",
        description: "Please enter email and institute user ID",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      let imageUrl = '';
      
      // Upload image if provided using signed URL
      if (emailFormData.imageUrl) {
        imageUrl = emailFormData.imageUrl;
      }

      const payload = {
        email: emailFormData.email,
        instituteUserType: emailFormData.instituteUserType,
        userIdByInstitute: emailFormData.userIdByInstitute,
        ...(emailFormData.instituteCardId && { instituteCardId: emailFormData.instituteCardId }),
        ...(imageUrl && { instituteImage: imageUrl })
      };

      const response = await apiClient.post(
        `/institute-users/institute/${instituteId}/assign-user-by-email`,
        payload
      );

      if (response.success) {
        toast({
          title: "Success",
          description: response.message,
        });
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || 'Failed to assign user by email',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserById = async (userId: string) => {
    if (!userId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a user ID",
        variant: "destructive"
      });
      return;
    }

    setIsLoadingPreview(true);
    try {
      const response = await apiClient.get(`/users/basic/${userId}`);
      setUserPreview(response);
      setShowUserPreview(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: getErrorMessage(error, 'User not found'),
        variant: "destructive"
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const fetchUserByPhone = async (phoneNumber: string) => {
    if (!phoneNumber.trim() || phoneNumber === '+94') {
      toast({
        title: "Validation Error",
        description: "Please enter a valid phone number",
        variant: "destructive"
      });
      return;
    }

    setIsLoadingPreview(true);
    try {
      // Don't encode the phone number - backend expects literal + sign
      const response = await apiClient.get(`/users/basic/phone/${phoneNumber}`);
      setUserPreview(response);
      setShowUserPreview(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: getErrorMessage(error, 'User not found'),
        variant: "destructive"
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const fetchUserByEmail = async (email: string) => {
    if (!email.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    setIsLoadingPreview(true);
    try {
      const response = await apiClient.get(`/users/basic/email/${email}`);
      setUserPreview(response);
      setShowUserPreview(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: getErrorMessage(error, 'User not found'),
        variant: "destructive"
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const fetchUserByRfid = async (rfid: string) => {
    if (!rfid.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid RFID",
        variant: "destructive"
      });
      return;
    }

    setIsLoadingPreview(true);
    try {
      const response = await apiClient.get(`/users/basic/rfid/${rfid}`);
      setUserPreview(response);
      setShowUserPreview(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: getErrorMessage(error, 'User not found'),
        variant: "destructive"
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const resetForm = () => {
    setSelectedMethod(null);
    setIdFormData({ userId: '', instituteUserType: 'STUDENT', userIdByInstitute: '', instituteCardId: '', imageUrl: '' });
    setPhoneFormData({ phoneNumber: '+94', instituteUserType: 'STUDENT', userIdByInstitute: '', instituteCardId: '', imageUrl: '' });
    setRfidFormData({ rfid: '', instituteUserType: 'STUDENT', userIdByInstitute: '', instituteCardId: '', imageUrl: '' });
    setEmailFormData({ email: '', instituteUserType: 'STUDENT', userIdByInstitute: '', instituteCardId: '', imageUrl: '' });
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Always ensure it starts with +94
    if (!value.startsWith('+94')) {
      value = '+94';
    }
    
    // Get the part after +94
    const numberPart = value.slice(3);
    
    // Prevent starting with 0 and only allow digits
    if (numberPart.length > 0) {
      // Remove any non-digit characters
      const cleanNumber = numberPart.replace(/\D/g, '');
      
      // Prevent starting with 0
      if (cleanNumber.startsWith('0')) {
        return; // Don't update if trying to start with 0
      }
      
      value = '+94' + cleanNumber;
    }
    
    setPhoneFormData(prev => ({ ...prev, phoneNumber: value }));
  };

  const handleClose = () => {
    resetForm();
    stopCamera();
    onClose();
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setCameraStream(stream);
      setShowCamera(true);
      
      // Wait for dialog to render, then set the stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error: any) {
      toast({
        title: "Camera Error",
        description: "Failed to access camera. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
            const photoUrl = URL.createObjectURL(blob);
            
            // Update the appropriate form data based on selected method
            if (selectedMethod === 'id') {
              setIdFormData(prev => ({ ...prev, image: file }));
            } else if (selectedMethod === 'phone') {
              setPhoneFormData(prev => ({ ...prev, image: file }));
            } else if (selectedMethod === 'rfid') {
              setRfidFormData(prev => ({ ...prev, image: file }));
            } else if (selectedMethod === 'email') {
              setEmailFormData(prev => ({ ...prev, image: file }));
            }
            
            setCapturedPhoto(photoUrl);
            stopCamera();
            setShowCamera(false);
            
            toast({
              title: "Photo Captured",
              description: "Profile photo has been captured successfully.",
            });
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Assign User
          </DialogTitle>
        </DialogHeader>

        {!selectedMethod ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose how you want to assign a user to this institute:
            </p>
            
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-auto p-4"
                onClick={() => setSelectedMethod('id')}
              >
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-blue-500" />
                  <div className="text-left">
                    <div className="font-medium">Assign user by ID</div>
                    <div className="text-sm text-muted-foreground">Use existing user ID</div>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto p-4"
                onClick={() => setSelectedMethod('phone')}
              >
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-green-500" />
                  <div className="text-left">
                    <div className="font-medium">Assign user by Phone number</div>
                    <div className="text-sm text-muted-foreground">Find user by phone number</div>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto p-4"
                onClick={() => setSelectedMethod('rfid')}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-purple-500" />
                  <div className="text-left">
                    <div className="font-medium">Assign Student by RFID</div>
                    <div className="text-sm text-muted-foreground">Use RFID card number</div>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-auto p-4"
                onClick={() => setSelectedMethod('email')}
              >
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-orange-500" />
                  <div className="text-left">
                    <div className="font-medium">Assign user by Email</div>
                    <div className="text-sm text-muted-foreground">Find user by email address</div>
                  </div>
                </div>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedMethod(null)}
              className="mb-2"
            >
              ← Back to methods
            </Button>

            {selectedMethod === 'id' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-4 w-4 text-blue-500" />
                  <Badge variant="outline">Assign by User ID</Badge>
                </div>

                <div>
                  <Label htmlFor="userId">User ID *</Label>
                  <div className="relative mt-1">
                    <Input
                      id="userId"
                      value={idFormData.userId}
                      onChange={(e) => setIdFormData(prev => ({ ...prev, userId: e.target.value }))}
                      placeholder="Enter user ID"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => fetchUserById(idFormData.userId)}
                      disabled={isLoadingPreview || !idFormData.userId.trim()}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="instituteUserType">User Type *</Label>
                  <Select
                    value={idFormData.instituteUserType}
                    onValueChange={(value) => setIdFormData(prev => ({ ...prev, instituteUserType: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSTITUTE_ADMIN">Institute Admin</SelectItem>
                      <SelectItem value="TEACHER">Teacher</SelectItem>
                      <SelectItem value="STUDENT">Student</SelectItem>
                      <SelectItem value="ATTENDANCE_MARKER">Attendance Marker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="userIdByInstitute">Institute User ID *</Label>
                  <Input
                    id="userIdByInstitute"
                    value={idFormData.userIdByInstitute}
                    onChange={(e) => setIdFormData(prev => ({ ...prev, userIdByInstitute: e.target.value }))}
                    placeholder="e.g., STU2024001"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="instituteCardId">Institute Card ID</Label>
                  <Input
                    id="instituteCardId"
                    value={idFormData.instituteCardId}
                    onChange={(e) => setIdFormData(prev => ({ ...prev, instituteCardId: e.target.value }))}
                    placeholder="e.g., CARD-2024-001"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Profile Image (35mm × 45mm)</Label>
                  <div className="mt-2">
                    <PassportImageCropUpload
                      currentImageUrl={idFormData.imageUrl || null}
                      onImageUpdate={(url) => setIdFormData(prev => ({ ...prev, imageUrl: url }))}
                      folder="institute-user-images"
                      label="Profile Image"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleAssignById}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Assigning...' : 'Assign User'}
                </Button>
              </div>
            )}

            {selectedMethod === 'phone' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Phone className="h-4 w-4 text-green-500" />
                  <Badge variant="outline">Assign by Phone Number</Badge>
                </div>

                <div>
                  <Label htmlFor="phoneNumber">Phone Number *</Label>
                  <div className="relative mt-1">
                    <Input
                      id="phoneNumber"
                      value={phoneFormData.phoneNumber}
                      onChange={handlePhoneNumberChange}
                      placeholder="+94772261284"
                      className="pl-12 pr-10"
                      maxLength={12}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                      +94
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => fetchUserByPhone(phoneFormData.phoneNumber)}
                      disabled={isLoadingPreview || phoneFormData.phoneNumber === '+94'}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="phoneUserType">User Type *</Label>
                  <Select
                    value={phoneFormData.instituteUserType}
                    onValueChange={(value) => setPhoneFormData(prev => ({ ...prev, instituteUserType: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSTITUTE_ADMIN">Institute Admin</SelectItem>
                      <SelectItem value="TEACHER">Teacher</SelectItem>
                      <SelectItem value="STUDENT">Student</SelectItem>
                      <SelectItem value="ATTENDANCE_MARKER">Attendance Marker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="phoneUserIdByInstitute">Institute User ID *</Label>
                  <Input
                    id="phoneUserIdByInstitute"
                    value={phoneFormData.userIdByInstitute}
                    onChange={(e) => setPhoneFormData(prev => ({ ...prev, userIdByInstitute: e.target.value }))}
                    placeholder="e.g., STU2024001"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="phoneInstituteCardId">Institute Card ID</Label>
                  <Input
                    id="phoneInstituteCardId"
                    value={phoneFormData.instituteCardId}
                    onChange={(e) => setPhoneFormData(prev => ({ ...prev, instituteCardId: e.target.value }))}
                    placeholder="e.g., CARD-2024-001"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Profile Image (35mm × 45mm)</Label>
                  <div className="mt-2">
                    <PassportImageCropUpload
                      currentImageUrl={phoneFormData.imageUrl || null}
                      onImageUpdate={(url) => setPhoneFormData(prev => ({ ...prev, imageUrl: url }))}
                      folder="institute-user-images"
                      label="Profile Image"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleAssignByPhone}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Assigning...' : 'Assign User'}
                </Button>
              </div>
            )}

            {selectedMethod === 'rfid' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-4 w-4 text-purple-500" />
                  <Badge variant="outline">Assign by RFID</Badge>
                </div>

                <div>
                  <Label htmlFor="rfid">RFID *</Label>
                  <div className="relative mt-1">
                    <Input
                      id="rfid"
                      value={rfidFormData.rfid}
                      onChange={(e) => setRfidFormData(prev => ({ ...prev, rfid: e.target.value }))}
                      placeholder="RFID0000"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => fetchUserByRfid(rfidFormData.rfid)}
                      disabled={isLoadingPreview || !rfidFormData.rfid.trim()}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="rfidUserType">User Type *</Label>
                  <Select
                    value={rfidFormData.instituteUserType}
                    onValueChange={(value) => setRfidFormData(prev => ({ ...prev, instituteUserType: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSTITUTE_ADMIN">Institute Admin</SelectItem>
                      <SelectItem value="TEACHER">Teacher</SelectItem>
                      <SelectItem value="STUDENT">Student</SelectItem>
                      <SelectItem value="ATTENDANCE_MARKER">Attendance Marker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="rfidUserIdByInstitute">Institute User ID *</Label>
                  <Input
                    id="rfidUserIdByInstitute"
                    value={rfidFormData.userIdByInstitute}
                    onChange={(e) => setRfidFormData(prev => ({ ...prev, userIdByInstitute: e.target.value }))}
                    placeholder="e.g., STU2024001"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="rfidInstituteCardId">Institute Card ID</Label>
                  <Input
                    id="rfidInstituteCardId"
                    value={rfidFormData.instituteCardId}
                    onChange={(e) => setRfidFormData(prev => ({ ...prev, instituteCardId: e.target.value }))}
                    placeholder="e.g., CARD-2024-001"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Profile Image (35mm × 45mm)</Label>
                  <div className="mt-2">
                    <PassportImageCropUpload
                      currentImageUrl={rfidFormData.imageUrl || null}
                      onImageUpdate={(url) => setRfidFormData(prev => ({ ...prev, imageUrl: url }))}
                      folder="institute-user-images"
                      label="Profile Image"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleAssignByRfid}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Assigning...' : 'Assign Student'}
                </Button>
              </div>
            )}

            {selectedMethod === 'email' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="h-4 w-4 text-orange-500" />
                  <Badge variant="outline">Assign by Email</Badge>
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <div className="relative mt-1">
                    <Input
                      id="email"
                      type="email"
                      value={emailFormData.email}
                      onChange={(e) => setEmailFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="user@example.com"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => fetchUserByEmail(emailFormData.email)}
                      disabled={isLoadingPreview || !emailFormData.email.trim()}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="emailUserType">User Type *</Label>
                  <Select
                    value={emailFormData.instituteUserType}
                    onValueChange={(value) => setEmailFormData(prev => ({ ...prev, instituteUserType: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSTITUTE_ADMIN">Institute Admin</SelectItem>
                      <SelectItem value="TEACHER">Teacher</SelectItem>
                      <SelectItem value="STUDENT">Student</SelectItem>
                      <SelectItem value="ATTENDANCE_MARKER">Attendance Marker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="emailUserIdByInstitute">Institute User ID *</Label>
                  <Input
                    id="emailUserIdByInstitute"
                    value={emailFormData.userIdByInstitute}
                    onChange={(e) => setEmailFormData(prev => ({ ...prev, userIdByInstitute: e.target.value }))}
                    placeholder="e.g., STU2024001"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="emailInstituteCardId">Institute Card ID</Label>
                  <Input
                    id="emailInstituteCardId"
                    value={emailFormData.instituteCardId}
                    onChange={(e) => setEmailFormData(prev => ({ ...prev, instituteCardId: e.target.value }))}
                    placeholder="e.g., CARD-2024-001"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Profile Image (35mm × 45mm)</Label>
                  <div className="mt-2">
                    <PassportImageCropUpload
                      currentImageUrl={emailFormData.imageUrl || null}
                      onImageUpdate={(url) => setEmailFormData(prev => ({ ...prev, imageUrl: url }))}
                      folder="institute-user-images"
                      label="Profile Image"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleAssignByEmail}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Assigning...' : 'Assign User'}
                </Button>
              </div>
            )}
          </div>
        )}
        
        {/* User Preview Dialog */}
        <Dialog open={showUserPreview} onOpenChange={setShowUserPreview}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>User Preview</DialogTitle>
            </DialogHeader>
            {userPreview && (
              <div className="flex flex-col items-center space-y-4 py-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={userPreview.imageUrl} alt={userPreview.fullName} />
                  <AvatarFallback>
                    {userPreview.fullName.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="font-semibold text-lg">{userPreview.fullName}</h3>
                  <Badge variant="outline" className="mt-1">
                    {userPreview.userType}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">ID: {userPreview.id}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Camera Dialog */}
        <Dialog open={showCamera} onOpenChange={stopCamera}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Capture Photo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={stopCamera}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={capturePhoto}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Capture Photo
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

export default AssignUserMethodsDialog;