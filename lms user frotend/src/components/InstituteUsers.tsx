import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as MUI from '@mui/material';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, RefreshCw, GraduationCap, Users, UserCheck, Plus, UserPlus, UserCog, Filter, Search, Shield, Upload, CheckCircle, UserX, UserMinus, Loader2, Clock, CheckCircle2, XCircle, ChevronDown, LayoutGrid, Table2, KeyRound, Pencil, X, MoreVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import { EmptyState } from '@/components/ui/EmptyState';
import { instituteApi } from '@/api/institute.api';
import { studentsApi } from '@/api/students.api';
import { useApiRequest } from '@/hooks/useApiRequest';
import { useTableData } from '@/hooks/useTableData';
import CreateUserForm from '@/components/forms/CreateUserForm';
import CreateComprehensiveUserForm from '@/components/forms/CreateComprehensiveUserForm';
import CreateInstituteUserForm from '@/components/forms/CreateInstituteUserForm';
import { useNavigate } from 'react-router-dom';
import AssignUserForm from '@/components/forms/AssignUserForm';
import AssignParentForm from '@/components/forms/AssignParentForm';
import AssignParentByPhoneForm from '@/components/forms/AssignParentByPhoneForm';
import AssignUserMethodsDialog from '@/components/forms/AssignUserMethodsDialog';
import { usersApi, BasicUser } from '@/api/users.api';
import { housesApi, InstituteHouse } from '@/api/houses.api';
import { profileImageApi } from '@/api/profileImage.api';
import UserInfoDialog from '@/components/forms/UserInfoDialog';
import UserOrganizationsDialog from '@/components/forms/UserOrganizationsDialog';
import { getBaseUrl, getApiHeadersAsync } from '@/contexts/utils/auth.api';
import { setInstituteUserPassword } from '@/contexts/utils/auth.api';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';
import InstituteUsersFilters, { InstituteUserFilterParams } from '@/components/InstituteUsersFilters';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';
import 'react-image-crop/dist/ReactCrop.css';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExtraDataFields } from '@/components/users/ExtraDataFields';
import { useInstituteUserColumns } from '@/hooks/useInstituteUserColumns';

interface InstituteUserData {
  id: string;
  name: string;
  nameWithInitials?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  phoneNumber?: string;
  imageUrl?: string;
  instituteUserImageUrl?: string;
  dateOfBirth?: string;
  userIdByInstitute?: string | null;
  verifiedBy?: string | null;
  fatherId?: string;
  motherId?: string;
  guardianId?: string;
  studentId?: string;
  houseId?: string | null;
  houseName?: string | null;
  emergencyContact?: string;
  medicalConditions?: string;
  allergies?: string;
  extraData?: Record<string, any> | null;
  father?: {
    id: string;
    name: string;
    email?: string;
    occupation?: string;
    workPlace?: string;
    children?: any[];
  };
}
interface InstituteUsersResponse {
  data: InstituteUserData[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
type UserType = 'STUDENT' | 'TEACHER' | 'ATTENDANCE_MARKER' | 'INSTITUTE_ADMIN';
type ViewType = 'USERS' | 'PENDING' | 'INACTIVE';

// Shows all words except the last as initials, last word in full
// e.g. "HEENKENDA MUDIYANSELAGE KAVEESHA KARUNARATHNA" → "H. M. K. Karunarathna"
const formatNameWithInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  const initials = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + '.').join(' ');
  const last = parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1).toLowerCase();
  return `${initials} ${last}`;
};

const InstituteUsers = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    user,
    currentInstituteId
  } = useAuth();

  // Institute-wide extra user column schema
  const { columns: extraColumns } = useInstituteUserColumns(currentInstituteId);

  // Local extra-data edit state (schema-driven Record OR ad-hoc rows)
  const [extraDataRecord, setExtraDataRecord] = useState<Record<string, string>>({});

  const [selectedUser, setSelectedUser] = useState<InstituteUserData | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showCreateComprehensiveUserDialog, setShowCreateComprehensiveUserDialog] = useState(false);
  const [showCreateInstituteUserDialog, setShowCreateInstituteUserDialog] = useState(false);
  const [showAssignUserDialog, setShowAssignUserDialog] = useState(false);
  const [showAssignMethodsDialog, setShowAssignMethodsDialog] = useState(false);
  const [showAssignParentDialog, setShowAssignParentDialog] = useState(false);
  const [selectedStudentForParent, setSelectedStudentForParent] = useState<InstituteUserData | null>(null);
  const [assignInitialUserId, setAssignInitialUserId] = useState<string | undefined>(undefined);
  const [activeView, setActiveView] = useState<ViewType>('USERS');
  const [selectedUserType, setSelectedUserType] = useState<UserType>('STUDENT');
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

  // Filter state for each user type
  const [studentFilters, setStudentFilters] = useState<InstituteUserFilterParams>({
    parent: 'true'
  } as any);
  const [teacherFilters, setTeacherFilters] = useState<InstituteUserFilterParams>({});
  const [markerFilters, setMarkerFilters] = useState<InstituteUserFilterParams>({});
  const [adminFilters, setAdminFilters] = useState<InstituteUserFilterParams>({});
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<InstituteUserFilterParams>({});
  const [inactiveFilters, setInactiveFilters] = useState<InstituteUserFilterParams>({});
  const [pendingUserType, setPendingUserType] = useState<'STUDENT' | 'TEACHER' | 'INSTITUTE_ADMIN' | 'ATTENDANCE_MARKER'>('STUDENT');
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [selectedPendingUsers, setSelectedPendingUsers] = useState<string[]>([]);
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const [userInfoDialog, setUserInfoDialog] = useState<{
    open: boolean;
    user: BasicUser | null;
  }>({
    open: false,
    user: null
  });
  const [uploadingImageTarget, setUploadingImageTarget] = useState<{ userId: string; scope: 'GLOBAL' | 'INSTITUTE' } | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [selectedUserForOrg, setSelectedUserForOrg] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [imagePreview, setImagePreview] = useState<{
    isOpen: boolean;
    url: string;
    title: string;
    userMetadata?: {
      userId?: string;
      email?: string;
      phoneNumber?: string;
      instituteUserType?: string;
    };
  }>({
    isOpen: false,
    url: '',
    title: ''
  });
  // Crop state for image upload
  const [cropImgSrc, setCropImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  // 35mm x 45mm = 7:9 aspect ratio
  const PASSPORT_ASPECT_RATIO = 7 / 9;

  // Loading states for individual button actions
  const [activatingUserId, setActivatingUserId] = useState<string | null>(null);
  const [deactivatingUserId, setDeactivatingUserId] = useState<string | null>(null);
  const [changeRoleDialog, setChangeRoleDialog] = useState<{ open: boolean; user: InstituteUserData | null }>({ open: false, user: null });
  const [newRoleValue, setNewRoleValue] = useState('');
  const [changingRole, setChangingRole] = useState(false);
  const [setPasswordDialog, setSetPasswordDialog] = useState<{ open: boolean; user: InstituteUserData | null }>({ open: false, user: null });
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [editExtraDataDialog, setEditExtraDataDialog] = useState<{ open: boolean; user: InstituteUserData | null }>({ open: false, user: null });
  const [extraDataRows, setExtraDataRows] = useState<{ key: string; value: string }[]>([]);
  const [savingExtraData, setSavingExtraData] = useState(false);

  const defaultViewForType = (type: UserType): 'card' | 'table' =>
    type === 'STUDENT' ? 'card' : 'table';

  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    const stored = localStorage.getItem(`viewMode_${selectedUserType}`);
    return (stored as 'card' | 'table') || defaultViewForType(selectedUserType);
  });

  // Switch view mode when user type changes (respects per-type saved preference)
  useEffect(() => {
    const stored = localStorage.getItem(`viewMode_${selectedUserType}`);
    setViewMode((stored as 'card' | 'table') || defaultViewForType(selectedUserType));
  }, [selectedUserType]);

  const handleSetViewMode = (mode: 'card' | 'table') => {
    setViewMode(mode);
    localStorage.setItem(`viewMode_${selectedUserType}`, mode);
  };

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [houseOptions, setHouseOptions] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const loadHouseOptions = async () => {
      if (!currentInstituteId) return;
      try {
        const houses = await housesApi.list(currentInstituteId, false);
        const options = (houses ?? []).map((h: InstituteHouse) => ({ id: String(h.id), name: h.name }));
        setHouseOptions(options);
      } catch {
        setHouseOptions([]);
      }
    };

    loadHouseOptions();
  }, [currentInstituteId]);

  // Get current filters based on active view and selected user type
  const getCurrentFilters = () => {
    if (activeView === 'USERS') {
      switch (selectedUserType) {
        case 'STUDENT':
          return studentFilters;
        case 'TEACHER':
          return teacherFilters;
        case 'ATTENDANCE_MARKER':
          return markerFilters;
        case 'INSTITUTE_ADMIN':
          return adminFilters;
        default:
          return studentFilters;
      }
    } else if (activeView === 'PENDING') {
      return pendingFilters;
    } else {
      return inactiveFilters;
    }
  };
  const setCurrentFilters = (filters: InstituteUserFilterParams) => {
    if (activeView === 'USERS') {
      switch (selectedUserType) {
        case 'STUDENT':
          setStudentFilters(filters);
          break;
        case 'TEACHER':
          setTeacherFilters(filters);
          break;
        case 'ATTENDANCE_MARKER':
          setMarkerFilters(filters);
          break;
        case 'INSTITUTE_ADMIN':
          setAdminFilters(filters);
          break;
      }
    } else if (activeView === 'PENDING') {
      setPendingFilters(filters);
    } else {
      setInactiveFilters(filters);
    }
  };

  // Table data management for each user type
  const studentsTable = useTableData<InstituteUserData>({
    endpoint: `/institute-users/institute/${currentInstituteId}/users/STUDENT`,
    defaultParams: {
      parent: 'true',
      ...studentFilters
    },
    dependencies: [],
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
    autoLoad: false
  });
  const teachersTable = useTableData<InstituteUserData>({
    endpoint: `/institute-users/institute/${currentInstituteId}/users/TEACHER`,
    defaultParams: teacherFilters,
    dependencies: [],
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
    autoLoad: false
  });
  const attendanceMarkersTable = useTableData<InstituteUserData>({
    endpoint: `/institute-users/institute/${currentInstituteId}/users/ATTENDANCE_MARKER`,
    defaultParams: markerFilters,
    dependencies: [],
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
    autoLoad: false
  });
  const instituteAdminsTable = useTableData<InstituteUserData>({
    endpoint: `/institute-users/institute/${currentInstituteId}/users/INSTITUTE_ADMIN`,
    defaultParams: adminFilters,
    dependencies: [],
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
    autoLoad: false
  });
  const inactiveUsersTable = useTableData<InstituteUserData>({
    endpoint: `/institute-users/institute/${currentInstituteId}/users/inactive`,
    defaultParams: inactiveFilters,
    dependencies: [],
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
    autoLoad: false
  });

  // Pending users table - fetches unverified users by type
  const pendingUsersTable = useTableData<InstituteUserData>({
    endpoint: `/institute-users/institute/${currentInstituteId}/users/${pendingUserType}/unverified`,
    defaultParams: pendingFilters,
    dependencies: [],
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
    autoLoad: false
  });

  // Use API request hook for creating users with duplicate prevention
  const createUserRequest = useApiRequest(async (userData: any) => {
    console.log('Creating user with data:', userData);
    // This would need to be implemented based on your API structure
    const response = await fetch(`/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });
    return response.json();
  }, {
    preventDuplicates: true,
    showLoading: false
  });
  const handleViewUser = (user: InstituteUserData) => {
    setSelectedUser(user);
    setShowUserDialog(true);
  };
  const handleOpenUserDetails = (user: InstituteUserData) => {
    if (activeView === 'USERS' && selectedUserType === 'STUDENT') {
      // Navigate to student profile page
      navigate(`/institute/${currentInstituteId}/student/${user.id}/profile`, { state: { student: user } });
      return;
    }
    handleViewUser(user);
  };
  const handleViewBasicUser = async (id?: string | null) => {
    if (!id) return;
    try {
      const info = await usersApi.getBasicInfo(id);
      setUserInfoDialog({
        open: true,
        user: info
      });
    } catch (error: any) {
      console.error('Error fetching user basic info:', error);
      toast({
        title: 'Failed to load user',
        description: error?.message || 'Could not fetch user information',
        variant: 'destructive',
        duration: 1500
      });
    }
  };
  const handleCreateUser = async (userData: any) => {
    console.log('User created successfully:', userData);
    setShowCreateUserDialog(false);

    // If API returned assignment-related shape, auto-open Assign dialog with prefilled userId
    if (userData && typeof userData.success === 'boolean' && userData.user?.id) {
      setAssignInitialUserId(userData.user.id);
      setShowAssignUserDialog(true);
    }
    toast({
      title: "User Created",
      description: "User has been created successfully.",
      duration: 1500
    });
  };
  const handleAssignUser = async (assignData: any) => {
    console.log('User assigned successfully:', assignData);
    setShowAssignUserDialog(false);
    toast({
      title: "User Assigned",
      description: "User has been assigned to institute successfully.",
      duration: 1500
    });

    // Refresh the current tab data
    getCurrentTable().actions.refresh();
  };
  const handleAssignParent = (student: InstituteUserData) => {
    setSelectedStudentForParent(student);
    setShowAssignParentDialog(true);
  };
  const handleParentAssignment = async (data: any) => {
    // The API call is handled by the form component
    // This function just handles the success response
    setShowAssignParentDialog(false);
    setSelectedStudentForParent(null);

    // Refresh students data
    studentsTable.actions.refresh();
  };
  const centerAspectCrop = useCallback((mediaWidth: number, mediaHeight: number, aspect: number) => {
    return centerCrop(makeAspectCrop({
      unit: '%',
      width: 70
    }, aspect, mediaWidth, mediaHeight), mediaWidth, mediaHeight);
  }, []);
  const onCropImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const {
      width,
      height
    } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, PASSPORT_ASPECT_RATIO));
  }, [centerAspectCrop, PASSPORT_ASPECT_RATIO]);
  const getCroppedImg = useCallback((image: HTMLImageElement, cropData: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const pixelRatio = window.devicePixelRatio;
    canvas.width = Math.floor(cropData.width * scaleX * pixelRatio);
    canvas.height = Math.floor(cropData.height * scaleY * pixelRatio);
    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';
    const cropX = cropData.x * scaleX;
    const cropY = cropData.y * scaleY;
    ctx.save();
    ctx.translate(-cropX, -cropY);
    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, image.naturalWidth, image.naturalHeight);
    ctx.restore();
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    });
  }, []);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setCrop(undefined);
      setCompletedCrop(undefined);
      const reader = new FileReader();
      reader.addEventListener('load', () => setCropImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(file);
    }
  };
  const handleImageUpload = async (target: { userId: string; scope: 'GLOBAL' | 'INSTITUTE' }) => {
    if (!completedCrop || !imgRef.current || !currentInstituteId) return;
    setUploading(true);
    try {
      // Get cropped image blob
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);

      // Create file from blob
      const croppedFile = new File([croppedBlob], 'cropped-image.png', {
        type: 'image/png'
      });

      // Step 1: Upload file using signed URL and get relativePath
      console.log('Step 1: Getting signed URL and uploading file...');
      const folder = target.scope === 'GLOBAL' ? 'profile-images' : 'institute-user-images';
      const relativePath = await uploadWithSignedUrl(croppedFile, folder, (message, progress) => {
        console.log(`Upload progress: ${progress}% - ${message}`);
      });
      console.log('Step 1 complete. RelativePath:', relativePath);

      // Step 2: Send relativePath to the appropriate backend endpoint
      console.log('Step 2: Sending relativePath to backend...');
      let result: any;
      if (target.scope === 'GLOBAL') {
        result = await profileImageApi.submitProfileImage(target.userId, relativePath, 'GLOBAL');
      } else {
        const headers = await getApiHeadersAsync();
        const response = await fetch(`${getBaseUrl()}/institute-users/institute/${currentInstituteId}/users/${target.userId}/upload-image`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ imageUrl: relativePath })
        });
        console.log('Response status:', response.status);
        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error('Error response:', errorText);
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText };
          }
          throw new Error(errorData.message || `Server error: ${response.status}`);
        }
        result = await response.json();
      }
      console.log('Success response:', result);
      toast({
        title: "Success",
        description: result.message || "Image uploaded successfully",
        duration: 1500
      });
      handleCloseUploadDialog();
      getCurrentTable().actions.refresh();
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
        duration: 1500
      });
    } finally {
      setUploading(false);
    }
  };
  const handleCloseUploadDialog = () => {
    setUploadingImageTarget(null);
    setSelectedImage(null);
    setCropImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
  };
  const handleActivateUser = async (userId: string) => {
    if (!currentInstituteId) return;
    setActivatingUserId(userId);
    try {
      const headers = await getApiHeadersAsync();
      const response = await fetch(`${getBaseUrl()}/institute-users/institute/${currentInstituteId}/users/${userId}/activate`, {
        method: 'PATCH',
        headers
      });
      if (!response.ok) {
        throw new Error('Failed to activate user');
      }
      const result = await response.json();
      toast({
        title: "Success",
        description: result.message || "User activated successfully",
        duration: 1500
      });

      // Refresh both inactive and active tables
      inactiveUsersTable.actions.refresh();
      getCurrentTable().actions.refresh();
    } catch (error: any) {
      console.error('Error activating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to activate user",
        variant: "destructive",
        duration: 1500
      });
    } finally {
      setActivatingUserId(null);
    }
  };
  const handleDeactivateUser = async (userId: string) => {
    if (!currentInstituteId) return;
    setDeactivatingUserId(userId);
    try {
      const headers = await getApiHeadersAsync();
      const response = await fetch(`${getBaseUrl()}/institute-users/institute/${currentInstituteId}/users/${userId}/deactivate`, {
        method: 'PATCH',
        headers
      });
      if (!response.ok) {
        throw new Error('Failed to deactivate user');
      }
      const result = await response.json();
      toast({
        title: "Success",
        description: result.message || "User deactivated successfully",
        duration: 1500
      });

      // Refresh the current table
      getCurrentTable().actions.refresh();
    } catch (error: any) {
      console.error('Error deactivating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to deactivate user",
        variant: "destructive",
        duration: 1500
      });
    } finally {
      setDeactivatingUserId(null);
    }
  };
  const handleChangeRole = async () => {
    if (!currentInstituteId || !changeRoleDialog.user || !newRoleValue) return;
    setChangingRole(true);
    try {
      const headers = await getApiHeadersAsync();
      const response = await fetch(`${getBaseUrl()}/institute-users/institute/${currentInstituteId}/users/${changeRoleDialog.user.id}/change-role`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ newRole: newRoleValue })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to change role');
      }
      const result = await response.json();
      toast({
        title: "Role Changed",
        description: result.message || `Role changed to ${newRoleValue}`,
        duration: 1500
      });
      setChangeRoleDialog({ open: false, user: null });
      setNewRoleValue('');
      getCurrentTable().actions.refresh();
    } catch (error: any) {
      console.error('Error changing role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to change role",
        variant: "destructive",
        duration: 1500
      });
    } finally {
      setChangingRole(false);
    }
  };
  const handleSetInstitutePassword = async () => {
    if (!currentInstituteId || !setPasswordDialog.user || !newPasswordValue) return;
    if (newPasswordValue.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive", duration: 1500 });
      return;
    }
    if (newPasswordValue !== confirmPasswordValue) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive", duration: 1500 });
      return;
    }
    setSettingPassword(true);
    try {
      await setInstituteUserPassword({
        instituteId: currentInstituteId,
        targetUserId: setPasswordDialog.user.id,
        newPassword: newPasswordValue,
      });
      toast({ title: "Success", description: "Institute password set successfully", duration: 1500 });
      setSetPasswordDialog({ open: false, user: null });
      setNewPasswordValue('');
      setConfirmPasswordValue('');
    } catch (error: any) {
      console.error('Error setting institute password:', error);
      toast({ title: "Error", description: error.message || "Failed to set password", variant: "destructive", duration: 1500 });
    } finally {
      setSettingPassword(false);
    }
  };

  const handleOpenEditExtraData = (user: InstituteUserData) => {
    // Build record from existing extra_data + schema defaults
    const existing: Record<string, string> = {};
    if (user.extraData) {
      for (const [k, v] of Object.entries(user.extraData)) {
        existing[k] = String(v ?? '');
      }
    }
    if (extraColumns.length > 0) {
      // Pre-fill schema keys that are missing
      for (const col of extraColumns) {
        if (!(col.key in existing)) existing[col.key] = '';
      }
      setExtraDataRecord(existing);
    } else {
      // Fallback: ad-hoc rows
      const rows = Object.keys(existing).length > 0
        ? Object.entries(existing).map(([key, value]) => ({ key, value }))
        : [{ key: '', value: '' }];
      setExtraDataRows(rows);
    }
    setEditExtraDataDialog({ open: true, user });
  };

  const handleSaveExtraData = async () => {
    if (!currentInstituteId || !editExtraDataDialog.user) return;
    setSavingExtraData(true);
    try {
      let extraData: Record<string, any> | null;
      if (extraColumns.length > 0) {
        // Schema-driven: save the record directly (keep empty strings so columns stay)
        const hasAny = Object.values(extraDataRecord).some(v => v !== '');
        extraData = hasAny ? extraDataRecord : null;
      } else {
        // Ad-hoc rows fallback
        const filtered = extraDataRows.filter(r => r.key.trim() !== '');
        extraData = filtered.length > 0
          ? Object.fromEntries(filtered.map(r => [r.key.trim(), r.value]))
          : null;
      }
      await instituteApi.updateInstituteUserExtraData(
        currentInstituteId,
        editExtraDataDialog.user.id,
        extraData,
      );
      toast({ title: 'Success', description: 'Extra data updated successfully', duration: 1500 });
      setEditExtraDataDialog({ open: false, user: null });
      getCurrentTable().actions.refresh();
    } catch (error: any) {
      console.error('Error updating extra data:', error);
      toast({ title: 'Error', description: error.message || 'Failed to update extra data', variant: 'destructive', duration: 1500 });
    } finally {
      setSavingExtraData(false);
    }
  };

  const getCurrentTable = () => {
    if (activeView === 'USERS') {
      switch (selectedUserType) {
        case 'STUDENT':
          return studentsTable;
        case 'TEACHER':
          return teachersTable;
        case 'ATTENDANCE_MARKER':
          return attendanceMarkersTable;
        case 'INSTITUTE_ADMIN':
          return instituteAdminsTable;
        default:
          return studentsTable;
      }
    } else if (activeView === 'PENDING') {
      return pendingUsersTable;
    } else {
      return inactiveUsersTable;
    }
  };

  // Prevent unnecessary API calls on repeated clicks.
  const safeLoad = (table: any) => {
    if (!table || table.state?.loading) return;
    // If already loaded once and no explicit refresh requested, skip
    if (table.state?.lastRefresh && (table.state?.data?.length || 0) > 0) return;
    table.actions?.loadData?.(false);
  };

  // Lazy-load: only fetch data for the currently visible tab/user-type.
  // Fires on mount (initial load) and whenever the user switches tabs or user-type.
  useEffect(() => {
    if (!currentInstituteId) return;
    const table = getCurrentTable();
    if (!table || table.state?.loading) return;
    // Skip if data was already loaded for this table
    if (table.state?.lastRefresh && table.state?.data?.length > 0) return;
    table.actions.loadData(false);
  }, [selectedUserType, activeView, pendingUserType, currentInstituteId]);
  const getCurrentUsers = () => {
    return getCurrentTable().state.data;
  };
  const handleFiltersChange = (newFilters: InstituteUserFilterParams) => {
    setCurrentFilters(newFilters);
  };
  const handleApplyFilters = async () => {
    setIsApplyingFilters(true);
    const currentFilters = getCurrentFilters();
    const currentTable = getCurrentTable();
    try {
      // Update filters and immediately trigger API call
      currentTable.actions.updateFilters(currentFilters);
      await currentTable.actions.refresh();
    } finally {
      setIsApplyingFilters(false);
    }
  };

  // Show error toast when data fails to load
  useEffect(() => {
    const currentTable = getCurrentTable();
    if (currentTable?.state?.error) {
      toast({
        title: 'Failed to load data',
        description: currentTable.state.error,
        variant: 'destructive',
        duration: 2000
      });
    }
  }, [studentsTable.state.error, teachersTable.state.error, attendanceMarkersTable.state.error, instituteAdminsTable.state.error, inactiveUsersTable.state.error, pendingUsersTable.state.error, activeView, selectedUserType, toast, getCurrentTable]);
  const handleClearFilters = () => {
    setCurrentFilters({});
    getCurrentTable().actions.updateFilters({});
  };
  const getUserTypeLabel = (type: UserType | ViewType) => {
    switch (type) {
      case 'STUDENT':
        return 'Students';
      case 'TEACHER':
        return 'Teachers';
      case 'ATTENDANCE_MARKER':
        return 'Attendance Markers';
      case 'INSTITUTE_ADMIN':
        return 'Institute Admins';
      case 'USERS':
        return 'Users';
      case 'PENDING':
        return 'Pending Users';
      case 'INACTIVE':
        return 'Inactive Users';
      default:
        return '';
    }
  };
  const getUserTypeIcon = (type: UserType | ViewType) => {
    switch (type) {
      case 'STUDENT':
        return GraduationCap;
      case 'TEACHER':
        return Users;
      case 'ATTENDANCE_MARKER':
        return UserCheck;
      case 'INSTITUTE_ADMIN':
        return Shield;
      case 'USERS':
        return Users;
      case 'PENDING':
        return Clock;
      case 'INACTIVE':
        return UserX;
      default:
        return Users;
    }
  };

  // Verify single pending user
  const handleVerifyUser = async (userId: string) => {
    if (!currentInstituteId) return;
    setVerifyingIds(prev => new Set(prev).add(userId));
    try {
      const headers = await getApiHeadersAsync();
      const response = await fetch(`${getBaseUrl()}/institute-users/institute/${currentInstituteId}/verify-user`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          notes: 'Verified by admin'
        })
      });
      if (!response.ok) {
        throw new Error('Failed to verify user');
      }
      const result = await response.json();
      toast({
        title: "User Verified",
        description: result.message || "User has been verified successfully",
        duration: 1500
      });
      pendingUsersTable.actions.refresh();
      setSelectedPendingUsers(prev => prev.filter(id => id !== userId));
    } catch (error: any) {
      console.error('Error verifying user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to verify user",
        variant: "destructive",
        duration: 1500
      });
    } finally {
      setVerifyingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  // Bulk verify selected pending users
  const handleBulkVerify = async () => {
    if (!currentInstituteId || selectedPendingUsers.length === 0) return;
    setBulkVerifying(true);
    try {
      const headers = await getApiHeadersAsync();
      const response = await fetch(`${getBaseUrl()}/institute-users/institute/${currentInstituteId}/verify-users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userIds: selectedPendingUsers,
          notes: 'Bulk verification by admin'
        })
      });
      if (!response.ok) {
        throw new Error('Failed to bulk verify users');
      }
      const result = await response.json();
      toast({
        title: "Users Verified",
        description: result.message || `${result.verified?.length || selectedPendingUsers.length} users verified successfully`,
        duration: 1500
      });
      pendingUsersTable.actions.refresh();
      setSelectedPendingUsers([]);
    } catch (error: any) {
      console.error('Error bulk verifying users:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to bulk verify users",
        variant: "destructive",
        duration: 1500
      });
    } finally {
      setBulkVerifying(false);
    }
  };

  // Toggle selection of pending user
  const togglePendingUserSelection = (userId: string) => {
    setSelectedPendingUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  // Select/deselect all pending users
  const toggleAllPendingUsers = () => {
    const currentPendingUsers = pendingUsersTable.state.data;
    if (selectedPendingUsers.length === currentPendingUsers.length) {
      setSelectedPendingUsers([]);
    } else {
      setSelectedPendingUsers(currentPendingUsers.map(u => u.id));
    }
  };
  const userRole = useInstituteRole();

  // --- Configurable data columns for the table ---
  const allDataColumnDefs: ColumnDef[] = useMemo(() => [
    {
      key: 'imageUrl',
      header: 'Image',
      locked: true,
      defaultVisible: true,
      defaultWidth: 80,
      minWidth: 60,
      render: (value: any, row: InstituteUserData) => (
        <div className="cursor-pointer flex justify-center" onClick={() => {
          if (row.imageUrl) {
            setImagePreview({
              isOpen: true,
              url: getImageUrl(row.imageUrl),
              title: row.nameWithInitials || row.name,
              userMetadata: {
                userId: row.id,
                email: row.email,
                phoneNumber: row.phoneNumber,
                instituteUserType: row.instituteUserImageUrl ? 'User' : 'No Type'
              }
            });
          }
        }}>
          <Avatar className="h-10 w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 hover:opacity-80 transition-opacity border-2 border-border">
            <AvatarImage src={getImageUrl(row.imageUrl || '')} alt={row.name} className="object-cover" />
            <AvatarFallback className="bg-muted">
              {row.name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        </div>
      )
    },
    {
      key: 'id',
      header: 'ID',
      defaultVisible: false,
      defaultWidth: 160,
      minWidth: 100,
      render: (_: any, row: InstituteUserData) => <span className="font-mono text-sm">{row.id}</span>
    },
    {
      key: 'name',
      header: 'Name',
      defaultVisible: true,
      defaultWidth: 180,
      minWidth: 120,
      render: (_: any, row: InstituteUserData) => <div className="font-medium">{row.nameWithInitials || formatNameWithInitials(row.name)}</div>
    },
    {
      key: 'email',
      header: 'Email',
      defaultVisible: true,
      defaultWidth: 200,
      minWidth: 140,
      render: (_: any, row: InstituteUserData) => <span className="text-sm">{row.email || 'Not provided'}</span>
    },
    {
      key: 'phoneNumber',
      header: 'Phone Number',
      defaultVisible: true,
      defaultWidth: 150,
      minWidth: 110,
      render: (_: any, row: InstituteUserData) => <span className="text-sm">{row.phoneNumber || 'Not provided'}</span>
    },
    {
      key: 'userIdByInstitute',
      header: 'Institute User ID',
      defaultVisible: true,
      defaultWidth: 150,
      minWidth: 100,
      render: (_: any, row: InstituteUserData) => <span className="font-mono text-sm">{row.userIdByInstitute || 'Not assigned'}</span>
    },
    {
      key: 'dateOfBirth',
      header: 'Date of Birth',
      defaultVisible: false,
      defaultWidth: 140,
      minWidth: 100,
      render: (_: any, row: InstituteUserData) => <span className="text-sm">{row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString() : 'N/A'}</span>
    },
    {
      key: 'addressLine1',
      header: 'Address',
      defaultVisible: false,
      defaultWidth: 200,
      minWidth: 120,
      render: (_: any, row: InstituteUserData) => (
        <div className="text-sm">
          <div>{row.addressLine1 || 'N/A'}</div>
          {row.addressLine2 && <div className="text-sm text-muted-foreground">{row.addressLine2}</div>}
        </div>
      )
    },
    {
      key: 'houseName',
      header: 'House',
      defaultVisible: false,
      defaultWidth: 130,
      minWidth: 90,
      render: (_: any, row: InstituteUserData) => <span className="text-sm">{row.houseName || 'N/A'}</span>
    },
    // ── Schema-driven extra data columns — one column per schema key ──
    ...extraColumns.map(col => ({
      key: `extra_${col.key}`,
      header: col.label,
      defaultVisible: true,
      defaultWidth: 140,
      minWidth: 90,
      render: (_: any, row: InstituteUserData) => {
        const val = row.extraData?.[col.key];
        return val !== undefined && val !== null && String(val) !== ''
          ? <span className="text-sm">{String(val)}</span>
          : <span className="text-sm text-muted-foreground">—</span>;
      }
    })),
    // Fallback single column when schema not configured
    ...( extraColumns.length === 0 ? [{
      key: 'extraData',
      header: 'Extra Data',
      defaultVisible: true,
      defaultWidth: 220,
      minWidth: 140,
      render: (_: any, row: InstituteUserData) => {
        if (!row.extraData || Object.keys(row.extraData).length === 0) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-col gap-0.5">
            {Object.entries(row.extraData).map(([k, v]) => (
              <span key={k} className="text-xs">
                <span className="font-medium text-muted-foreground">{k}:</span>{' '}
                <span>{String(v)}</span>
              </span>
            ))}
          </div>
        );
      }
    }] : []),
    {
      key: 'actions',
      header: 'Actions',
      defaultVisible: true,
      defaultWidth: 160,
      minWidth: 120,
      render: (_: any, row: InstituteUserData) => {
        const isStudentRow = activeView === 'USERS' && selectedUserType === 'STUDENT';
        const isUsersView = activeView === 'USERS';
        const isPendingView = activeView === 'PENDING';
        const isInactiveView = activeView === 'INACTIVE';

        const actions: Array<{
          label: string;
          icon: React.ReactNode;
          onClick: () => void;
          disabled?: boolean;
          className?: string;
        }> = [];

        actions.push({
          label: isStudentRow ? 'View Student Details' : 'View Details',
          icon: <Eye className="h-4 w-4" />,
          onClick: () => handleOpenUserDetails(row),
        });

        if (activeView !== 'PENDING') {
          actions.push({
            label: 'View Organizations',
            icon: <Users className="h-4 w-4" />,
            onClick: () => {
              setSelectedUserForOrg({ id: row.id, name: row.name });
              setOrgDialogOpen(true);
            },
          });
          actions.push({
            label: row.instituteUserImageUrl ? 'Change Institute Image' : 'Upload Institute Image',
            icon: <Upload className="h-4 w-4" />,
            onClick: () => setUploadingImageTarget({ userId: row.id, scope: 'INSTITUTE' }),
          });
        }

        if (isStudentRow) {
          actions.push({
            label: 'Assign Parent',
            icon: <UserCog className="h-4 w-4" />,
            onClick: () => handleAssignParent(row),
          });
        }

        if (isUsersView) {
          actions.push({
            label: 'Change Role',
            icon: <UserCog className="h-4 w-4" />,
            onClick: () => {
              setChangeRoleDialog({ open: true, user: row });
              setNewRoleValue(selectedUserType);
            },
          });
          actions.push({
            label: 'Set Password',
            icon: <KeyRound className="h-4 w-4" />,
            onClick: () => {
              setSetPasswordDialog({ open: true, user: row });
              setNewPasswordValue('');
              setConfirmPasswordValue('');
            },
          });
          actions.push({
            label: 'Edit Extra Data',
            icon: <Pencil className="h-4 w-4" />,
            onClick: () => handleOpenEditExtraData(row),
          });
        }

        if (isPendingView) {
          actions.push({
            label: verifyingIds.has(row.id) ? 'Verifying...' : 'Verify',
            icon: verifyingIds.has(row.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />,
            onClick: () => handleVerifyUser(row.id),
            disabled: verifyingIds.has(row.id),
            className: 'text-primary',
          });
        } else if (isInactiveView) {
          actions.push({
            label: activatingUserId === row.id ? 'Activating...' : 'Activate',
            icon: activatingUserId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />,
            onClick: () => handleActivateUser(row.id),
            disabled: activatingUserId === row.id,
            className: 'text-emerald-600',
          });
        } else {
          actions.push({
            label: deactivatingUserId === row.id ? 'Deactivating...' : 'Deactivate',
            icon: deactivatingUserId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />,
            onClick: () => handleDeactivateUser(row.id),
            disabled: deactivatingUserId === row.id,
            className: 'text-destructive',
          });
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => e.stopPropagation()}
                title="Actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {actions.map((action, index) => (
                <DropdownMenuItem
                  key={`${action.label}-${index}`}
                  onClick={action.disabled ? undefined : action.onClick}
                  disabled={action.disabled}
                  className={action.className}
                >
                  <span className="mr-2 h-4 w-4 shrink-0">{action.icon}</span>
                  <span>{action.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    },
  ], [activeView, selectedUserType, handleOpenUserDetails, setSelectedUserForOrg, setOrgDialogOpen, setUploadingImageTarget, handleAssignParent, setChangeRoleDialog, setNewRoleValue, setSetPasswordDialog, setNewPasswordValue, setConfirmPasswordValue, handleOpenEditExtraData, verifyingIds, activatingUserId, deactivatingUserId]);

  const { colState, visibleColumns, toggleColumn, resetColumns } = useColumnConfig(allDataColumnDefs, 'institute-users');

  const { getWidth: getIUColWidth, totalWidth: totalIUTableWidth, setHoveredCol: setIUHoveredCol, ResizeHandle: IUResizeHandle } = useResizableColumns(
    ['imageUrl', 'id', 'name', 'email', 'phoneNumber', 'userIdByInstitute', 'dateOfBirth', 'addressLine1', 'houseName', 'extraData', 'actions', '_checkbox'],
    { imageUrl: 80, id: 160, name: 180, email: 200, phoneNumber: 150, userIdByInstitute: 150, dateOfBirth: 140, addressLine1: 200, houseName: 130, extraData: 220, actions: 160, _checkbox: 50 }
  );

  if (userRole !== 'InstituteAdmin') {
    return <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Access denied. InstituteAdmin role required.</p>
      </div>;
  }
  if (!currentInstituteId) {
    return <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Please select an institute first.</p>
      </div>;
  }
  const currentTable = getCurrentTable();
  const currentUsers = getCurrentUsers();
  const currentLoading = currentTable.state.loading;
  const IconComponent = activeView === 'USERS' ? getUserTypeIcon(selectedUserType) : getUserTypeIcon(activeView);

  return <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Institute Users</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage users in your institute
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowAssignMethodsDialog(true)} variant="outline" className="flex items-center gap-2 flex-1 sm:flex-none" size="sm">
            <UserPlus className="h-4 w-4" />
            Assign User
          </Button>
          <Button onClick={() => navigate(`/institute-users/${currentInstituteId}/create`)} className="flex items-center gap-2 flex-1 sm:flex-none" size="sm">
            <Plus className="h-4 w-4" />
            Create User
          </Button>
          <ColumnConfigurator
            allColumns={allDataColumnDefs}
            colState={colState}
            onToggle={toggleColumn}
            onReset={resetColumns}
          />
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button onClick={() => handleSetViewMode('card')} className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Card View">
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => handleSetViewMode('table')} className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Table View">
              <Table2 className="h-4 w-4" />
            </button>
          </div>
          {/* Mobile Filter Button */}
          <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-2 flex-1 sm:flex-none md:hidden"
                size="sm"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="md:hidden flex flex-col max-h-[80vh]">
              <SheetHeader>
                <SheetTitle>User Filters</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto py-4">
                <InstituteUsersFilters 
                  filters={getCurrentFilters()} 
                  onFiltersChange={handleFiltersChange} 
                  onApplyFilters={() => {
                    handleApplyFilters();
                    setIsFilterSheetOpen(false);
                  }} 
                  onClearFilters={handleClearFilters} 
                  userType={activeView === 'USERS' ? selectedUserType : activeView} 
                  houseOptions={houseOptions}
                  isApplying={isApplyingFilters} 
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Filters Component - Desktop Only */}
      <ScrollAnimationWrapper animationType="slide-up" className="hidden md:block">
        <InstituteUsersFilters 
          filters={getCurrentFilters()} 
          onFiltersChange={handleFiltersChange} 
          onApplyFilters={handleApplyFilters} 
          onClearFilters={handleClearFilters} 
          userType={activeView === 'USERS' ? selectedUserType : activeView} 
          houseOptions={houseOptions}
          isApplying={isApplyingFilters} 
        />
      </ScrollAnimationWrapper>

      {/* Tabs for Views: Users, Pending, Inactive */}
      <Tabs value={activeView} onValueChange={value => setActiveView(value as ViewType)}>
        {/* Mobile: Horizontal scrollable tabs - Always show names */}
        <div className="lg:hidden overflow-x-auto">
          <TabsList className="inline-flex h-auto w-full gap-1 p-1 bg-muted/50 border rounded-lg">
            <TabsTrigger value="USERS" className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md whitespace-nowrap text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Users</span>
            </TabsTrigger>
            <TabsTrigger value="PENDING" className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md whitespace-nowrap text-xs sm:text-sm">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Pending</span>
            </TabsTrigger>
            <TabsTrigger value="INACTIVE" className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md whitespace-nowrap text-xs sm:text-sm">
              <UserX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Inactive</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Desktop: Full width tabs with text */}
        <div className="hidden lg:block">
          <TabsList className="grid w-full grid-cols-3 gap-2 p-2 h-auto bg-muted/50">
            <TabsTrigger value="USERS" className="flex items-center gap-2 px-4 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Users className="h-4 w-4" />
              <span>Users</span>
            </TabsTrigger>
            <TabsTrigger value="PENDING" className="flex items-center gap-2 px-4 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Clock className="h-4 w-4" />
              <span>Pending</span>
            </TabsTrigger>
            <TabsTrigger value="INACTIVE" className="flex items-center gap-2 px-4 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <UserX className="h-4 w-4" />
              <span>Inactive</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="USERS" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* User Type Dropdown */}
              <Select value={selectedUserType} onValueChange={(value: UserType) => setSelectedUserType(value)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      <span>Students</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="TEACHER">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Teachers</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ATTENDANCE_MARKER">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      <span>Attendance Markers</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="INSTITUTE_ADMIN">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>Admins</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className="flex items-center gap-1">
                {React.createElement(getUserTypeIcon(selectedUserType), { className: "h-4 w-4" })}
                {currentTable.pagination.totalCount} {getUserTypeLabel(selectedUserType)}
              </Badge>
            </div>
            <Button onClick={() => currentTable.actions.refresh()} disabled={currentTable.state.loading} variant="outline" size="sm">
              {currentTable.state.loading ? <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </> : <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Load {getUserTypeLabel(selectedUserType)}
                </>}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="PENDING" className="space-y-4">
          <div className="flex flex-col gap-4">
            {/* Pending user type selector */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                  <Clock className="h-4 w-4 text-amber-600" />
                  {pendingUsersTable.pagination.totalCount} Pending {pendingUserType.replace('_', ' ')}s
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={pendingUserType} onValueChange={(value: 'STUDENT' | 'TEACHER' | 'INSTITUTE_ADMIN' | 'ATTENDANCE_MARKER') => {
                setPendingUserType(value);
                setSelectedPendingUsers([]);
              }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select user type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT">Students</SelectItem>
                    <SelectItem value="TEACHER">Teachers</SelectItem>
                    <SelectItem value="INSTITUTE_ADMIN">Admins</SelectItem>
                    <SelectItem value="ATTENDANCE_MARKER">Markers</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => pendingUsersTable.actions.refresh()} disabled={pendingUsersTable.state.loading} variant="outline" size="sm">
                  {pendingUsersTable.state.loading ? <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </> : <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </>}
                </Button>
              </div>
            </div>
            
            {/* Bulk actions */}
            {selectedPendingUsers.length > 0 && <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
                <span className="text-sm font-medium">
                  {selectedPendingUsers.length} selected
                </span>
                <Button onClick={handleBulkVerify} disabled={bulkVerifying} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {bulkVerifying ? <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </> : <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Verify Selected
                    </>}
                </Button>
                <Button onClick={() => setSelectedPendingUsers([])} variant="outline" size="sm">
                  Clear Selection
                </Button>
              </div>}
          </div>
        </TabsContent>

        <TabsContent value="INACTIVE" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <UserX className="h-4 w-4" />
                {inactiveUsersTable.pagination.totalCount} Inactive Users
              </Badge>
            </div>
            <Button onClick={() => inactiveUsersTable.actions.refresh()} disabled={inactiveUsersTable.state.loading} variant="outline" size="sm">
              {inactiveUsersTable.state.loading ? <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </> : <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Load Inactive Users
                </>}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Users Card / Table View */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 gap-4">
          {currentUsers.length === 0 ? (
            <div className="col-span-full">
              <EmptyState icon={IconComponent} title={`No ${activeView === 'USERS' ? getUserTypeLabel(selectedUserType) : getUserTypeLabel(activeView)} Found`} description="No users found for the current selection." />
            </div>
          ) : currentUsers.map(userData => {
            const isExpanded = expandedUserId === userData.id;
            return (
              <Card key={userData.id} className="hover:shadow-md transition-shadow">
                <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => handleOpenUserDetails(userData)}>
                  {activeView === 'PENDING' && (
                    <input type="checkbox" checked={selectedPendingUsers.includes(userData.id)} onClick={e => e.stopPropagation()} onChange={() => togglePendingUserSelection(userData.id)} className="w-4 h-4 rounded border-border shrink-0" />
                  )}
                  <Avatar 
                    className="h-12 w-12 shrink-0 border-2 border-border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (userData.imageUrl) {
                        setImagePreview({
                          isOpen: true,
                          url: getImageUrl(userData.imageUrl),
                          title: userData.nameWithInitials || userData.name,
                          userMetadata: {
                            userId: userData.id,
                            email: userData.email,
                            phoneNumber: userData.phoneNumber,
                            instituteUserType: userData.instituteUserImageUrl ? 'User' : 'No Type'
                          }
                        });
                      }
                    }}
                  >
                    <AvatarImage src={getImageUrl(userData.imageUrl || '')} alt={userData.name} className="object-cover" />
                    <AvatarFallback className="bg-muted">{userData.name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{userData.nameWithInitials || formatNameWithInitials(userData.name)}</p>
                    <p className="text-[13px] text-muted-foreground truncate">{userData.email || 'No email'}</p>
                    {userData.userIdByInstitute && <p className="text-[13px] text-muted-foreground font-mono">Institute ID: {userData.userIdByInstitute}</p>}
                    {userData.studentId && <p className="text-[13px] text-muted-foreground font-mono">Student ID: {userData.studentId}</p>}
                    <p className="text-[13px] text-muted-foreground font-mono">ID: {userData.id}</p>
                  </div>
                  {/* Chevron on right of top row */}
                  <button
                    onClick={() => setExpandedUserId(isExpanded ? null : userData.id)}
                    onClick={(e) => { e.stopPropagation(); setExpandedUserId(isExpanded ? null : userData.id); }}
                    className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-auto shrink-0"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {/* Action Buttons — full width row below */}
                <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
                    {activeView === 'USERS' && selectedUserType === 'STUDENT' ? (
                      <Button size="sm" variant="outline" onClick={(e) => { 
                        e.stopPropagation(); 
                        navigate(`/institute/${currentInstituteId}/student/${userData.id}/profile`, { state: { student: userData } });
                      }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleViewUser(userData); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {activeView !== 'PENDING' && (
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedUserForOrg({ id: userData.id, name: userData.name }); setOrgDialogOpen(true); }}>
                        <Shield className="h-4 w-4" />
                      </Button>
                    )}
                    {activeView !== 'PENDING' && (
                      userData.instituteUserImageUrl ? (
                        <Badge variant="default" className="bg-primary hover:bg-primary text-primary-foreground h-8 px-2 flex items-center">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          <span className="text-xs">Uploaded</span>
                        </Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setUploadingImageTarget({ userId: userData.id, scope: 'INSTITUTE' }); }}>
                          <Upload className="h-4 w-4" />
                        </Button>
                      )
                    )}
                    {activeView === 'USERS' && (
                      <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={(e) => { e.stopPropagation(); setChangeRoleDialog({ open: true, user: userData }); setNewRoleValue(selectedUserType); }}>
                        <UserCog className="h-4 w-4" />
                      </Button>
                    )}
                    {activeView === 'USERS' && (
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSetPasswordDialog({ open: true, user: userData }); setNewPasswordValue(''); setConfirmPasswordValue(''); }} title="Set Institute Password">
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    )}
                    {activeView === 'USERS' && (
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleOpenEditExtraData(userData); }} title="Edit Extra Data">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {activeView === 'PENDING' ? (
                      <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={(e) => { e.stopPropagation(); handleVerifyUser(userData.id); }} disabled={verifyingIds.has(userData.id)}>
                        {verifyingIds.has(userData.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      </Button>
                    ) : activeView === 'INACTIVE' ? (
                      <Button size="sm" variant="default" className="bg-primary hover:bg-primary/90" onClick={(e) => { e.stopPropagation(); handleActivateUser(userData.id); }} disabled={activatingUserId === userData.id}>
                        {activatingUserId === userData.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                    ) : (
                      <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleDeactivateUser(userData.id); }} disabled={deactivatingUserId === userData.id}>
                        {deactivatingUserId === userData.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                      </Button>
                    )}
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t pt-3.5 space-y-3">
                    <div className="space-y-1.5 text-sm text-muted-foreground leading-relaxed">
                      {userData.phoneNumber && <p><span className="font-medium">Phone:</span> {userData.phoneNumber}</p>}
                      {userData.dateOfBirth && <p><span className="font-medium">Date of Birth:</span> {new Date(userData.dateOfBirth).toLocaleDateString()}</p>}
                      {userData.addressLine1 && <p><span className="font-medium">Address:</span> {userData.addressLine1}</p>}
                      {userData.medicalConditions && <p><span className="font-medium">Medical Conditions:</span> {userData.medicalConditions}</p>}
                      {userData.allergies && <p><span className="font-medium">Allergies:</span> {userData.allergies}</p>}
                    </div>
                    {/* Extra Data Cards - schema-driven */}
                    {extraColumns.length > 0 ? (
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">Extra Data <span className="flex-1 h-px bg-border/40" /></p>
                        <div className="divide-y divide-border/40">
                          {extraColumns.map(col => {
                            const val = userData.extraData?.[col.key];
                            return (
                              <div key={col.key} className="flex items-center justify-between py-2">
                                <span className="text-xs text-muted-foreground">{col.label}</span>
                                <span className="text-xs font-medium">{val !== undefined && val !== null && String(val) !== '' ? String(val) : <span className="text-muted-foreground">—</span>}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : userData.extraData && Object.keys(userData.extraData).length > 0 ? (
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Extra Data <span className="flex-1 h-px bg-border/40" /></p>
                        <div className="divide-y divide-border/40">
                          {Object.entries(userData.extraData).map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between py-3.5">
                              <span className="text-sm text-muted-foreground">{k}</span>
                              <span className="text-sm font-medium break-all">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
      <Paper sx={{
      width: '100%',
      overflow: 'hidden'
    }}>
        <TableContainer sx={{
        height: 'calc(100vh - 280px)',
        overflow: 'auto'
      }}>
          <Table stickyHeader aria-label="users table" sx={{ tableLayout: 'fixed', minWidth: totalIUTableWidth }}>
            <TableHead>
              <TableRow>
                {activeView === 'PENDING' && (
                  <TableCell
                    padding="checkbox"
                    style={{ position: 'relative', width: getIUColWidth('_checkbox'), userSelect: 'none' }}
                  >
                    <input type="checkbox" checked={selectedPendingUsers.length === currentUsers.length && currentUsers.length > 0} onChange={toggleAllPendingUsers} className="w-4 h-4 rounded border-border" />
                  </TableCell>
                )}
                {visibleColumns.map(col => (
                  <TableCell
                    key={col.key}
                    onMouseEnter={() => setIUHoveredCol(col.key)}
                    onMouseLeave={() => setIUHoveredCol(null)}
                    style={{ position: 'relative', width: getIUColWidth(col.key), userSelect: 'none' }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.header}</div>
                    <IUResizeHandle colId={col.key} />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {currentUsers.map(userData => <TableRow hover role="checkbox" tabIndex={-1} key={userData.id} className="cursor-pointer" onClick={() => handleOpenUserDetails(userData)}>
                  {activeView === 'PENDING' && <TableCell padding="checkbox">
                      <input type="checkbox" checked={selectedPendingUsers.includes(userData.id)} onChange={() => togglePendingUserSelection(userData.id)} className="w-4 h-4 rounded border-border" />
                    </TableCell>}
                  {visibleColumns.map(col => (
                    <TableCell key={col.key}>
                      {col.render ? col.render((userData as any)[col.key], userData) : (userData as any)[col.key]}
                    </TableCell>
                  ))}
                </TableRow>)}
              {currentUsers.length === 0 && <TableRow>
                  <TableCell colSpan={visibleColumns.length + (activeView === 'PENDING' ? 1 : 0)} align="center">
                    <div className="py-12 text-center text-muted-foreground">
                      <IconComponent className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg">No {activeView === 'USERS' ? getUserTypeLabel(selectedUserType).toLowerCase() : getUserTypeLabel(activeView).toLowerCase()}</p>
                      <p className="text-sm">No users found for the current selection</p>
                    </div>
                  </TableCell>
                </TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination rowsPerPageOptions={currentTable.availableLimits} component="div" count={currentTable.pagination.totalCount} rowsPerPage={currentTable.pagination.limit} page={currentTable.pagination.page} onPageChange={(event: unknown, newPage: number) => currentTable.actions.setPage(newPage)} onRowsPerPageChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        currentTable.actions.setLimit(parseInt(event.target.value, 10));
        currentTable.actions.setPage(0);
      }} />
      </Paper>
      )}

      {/* Pagination */}
      {currentTable.pagination.totalPages > 1 && <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {currentTable.pagination.page * currentTable.pagination.limit + 1} to {Math.min((currentTable.pagination.page + 1) * currentTable.pagination.limit, currentTable.pagination.totalCount)} of {currentTable.pagination.totalCount} {activeView === 'USERS' ? selectedUserType.toLowerCase() : activeView.toLowerCase()}s
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => currentTable.actions.prevPage()} disabled={currentTable.pagination.page === 0 || currentTable.state.loading}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentTable.pagination.page + 1} of {currentTable.pagination.totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => currentTable.actions.nextPage()} disabled={currentTable.pagination.page === currentTable.pagination.totalPages - 1 || currentTable.state.loading}>
              Next
            </Button>
          </div>
        </div>}

      {currentUsers.length === 0 && !currentLoading && (
        <EmptyState
          icon={IconComponent}
          title={`No ${activeView === 'USERS' ? getUserTypeLabel(selectedUserType) : getUserTypeLabel(activeView)} Found`}
          description={`No ${activeView === 'USERS' ? selectedUserType.toLowerCase().replace('_', ' ') : activeView.toLowerCase().replace('_', ' ')}s found in this institute. Click the button above to load data.`}
        />
      )}

      {/* User Details Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[93vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-3">
              {selectedUser && (
                <Avatar className="h-14 w-14 ring-2 ring-primary/10">
                  <AvatarImage src={getImageUrl(selectedUser.imageUrl || '')} alt={selectedUser.name} />
                  <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                    {selectedUser.name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div>
                <p className="font-bold text-base leading-tight">{selectedUser ? formatNameWithInitials(selectedUser.name) : `${activeView === 'USERS' ? getUserTypeLabel(selectedUserType).slice(0, -1) : getUserTypeLabel(activeView).slice(0, -1)} Details`}</p>
                <p className="text-[13px] text-muted-foreground font-normal">{activeView === 'USERS' ? getUserTypeLabel(selectedUserType).slice(0, -1) : getUserTypeLabel(activeView).slice(0, -1)}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedUser && <div className="space-y-5">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xl font-bold leading-tight break-words whitespace-normal">{formatNameWithInitials(selectedUser.name)}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1 break-all">{selectedUser.userIdByInstitute || selectedUser.id}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">{activeView === 'USERS' ? selectedUserType.replace('_', ' ') : activeView.replace('_', ' ')}</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Card className="border-border/60">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-14 w-14 ring-1 ring-border/60">
                          <AvatarImage src={getImageUrl(selectedUser.imageUrl || '')} alt={selectedUser.name} className="object-cover" />
                          <AvatarFallback className="bg-muted">GI</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-muted-foreground">Global Image</p>
                          <p className="text-xs text-muted-foreground">Main account profile image.</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => selectedUser.imageUrl && setImagePreview({ isOpen: true, url: getImageUrl(selectedUser.imageUrl), title: selectedUser.name, userMetadata: { userId: selectedUser.id, email: selectedUser.email, phoneNumber: selectedUser.phoneNumber, instituteUserType: 'Global Image' } })} disabled={!selectedUser.imageUrl}>
                              View Global Image
                            </Button>
                            {activeView === 'USERS' && (
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setUploadingImageTarget({ userId: selectedUser.id, scope: 'GLOBAL' })}>
                                Upload Global Image
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/60">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-14 w-14 ring-1 ring-border/60">
                          <AvatarImage src={getImageUrl(selectedUser.instituteUserImageUrl || '')} alt={selectedUser.name} className="object-cover" />
                          <AvatarFallback className="bg-muted">II</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-muted-foreground">Institute Image</p>
                          <p className="text-xs text-muted-foreground">Institute-scoped identification image.</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => selectedUser.instituteUserImageUrl && setImagePreview({ isOpen: true, url: getImageUrl(selectedUser.instituteUserImageUrl), title: `${selectedUser.name} - Institute Image`, userMetadata: { userId: selectedUser.id, email: selectedUser.email, phoneNumber: selectedUser.phoneNumber, instituteUserType: 'Institute Image' } })} disabled={!selectedUser.instituteUserImageUrl}>
                              View Institute Image
                            </Button>
                            {activeView === 'USERS' && (
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setUploadingImageTarget({ userId: selectedUser.id, scope: 'INSTITUTE' })}>
                                Upload Institute Image
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {activeView === 'USERS' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white w-full" onClick={() => { setChangeRoleDialog({ open: true, user: selectedUser }); setNewRoleValue(selectedUserType); }}>
                      <UserCog className="h-4 w-4 mr-2" />Change User Type
                    </Button>
                    <Button type="button" variant="outline" className="w-full" onClick={() => { setSetPasswordDialog({ open: true, user: selectedUser }); setNewPasswordValue(''); setConfirmPasswordValue(''); }}>
                      <KeyRound className="h-4 w-4 mr-2" />Set Password
                    </Button>
                    <Button type="button" variant="outline" className="w-full" onClick={() => handleOpenEditExtraData(selectedUser)}>
                      <Pencil className="h-4 w-4 mr-2" />Edit Extra Data
                    </Button>
                    <Button type="button" variant="destructive" className="w-full" onClick={() => handleDeactivateUser(selectedUser.id)}>
                      <UserMinus className="h-4 w-4 mr-2" />Deactivate
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Overview <span className="flex-1 h-px bg-border/40" /></p>
                <div className="divide-y divide-border/40">
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">User ID</span>
                    <span className="text-sm font-mono font-semibold text-primary break-all">{selectedUser.id}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">User Type</span>
                    <span className="mt-0.5"><Badge variant="outline">{activeView === 'USERS' ? selectedUserType.replace('_', ' ') : activeView.replace('_', ' ')}</Badge></span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Institute User ID</span>
                    <span className="text-sm font-mono font-medium break-all">{selectedUser.userIdByInstitute || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Verified By</span>
                    <span className="text-sm font-medium">{selectedUser.verifiedBy || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Contact <span className="flex-1 h-px bg-border/40" /></p>
                <div className="divide-y divide-border/40">
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="text-sm font-medium break-all">{selectedUser.email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Phone Number</span>
                    <span className="text-sm font-medium">{selectedUser.phoneNumber || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Date of Birth</span>
                    <span className="text-sm font-medium">{selectedUser.dateOfBirth ? new Date(selectedUser.dateOfBirth).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Address <span className="flex-1 h-px bg-border/40" /></p>
                <div className="divide-y divide-border/40">
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Address Line 1</span>
                    <span className="text-sm font-medium">{selectedUser.addressLine1 || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Address Line 2</span>
                    <span className="text-sm font-medium">{selectedUser.addressLine2 || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Extra Data Section in Detail View - schema-driven */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-muted-foreground flex items-center gap-3">Extra Data <span className="flex-1 h-px bg-border/40" /></p>
                  <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-sm gap-1.5 ml-3" onClick={() => handleOpenEditExtraData(selectedUser)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
                {extraColumns.length > 0 ? (
                  <div className="divide-y divide-border/40">
                    {extraColumns.map(col => {
                      const val = selectedUser.extraData?.[col.key];
                      const display = val !== undefined && val !== null && String(val) !== '' ? String(val) : null;
                      return (
                        <div key={col.key} className="flex items-center justify-between py-3.5">
                          <span className="text-sm text-muted-foreground">{col.label}</span>
                          <span className="text-sm font-medium break-all">{display ?? <span className="text-muted-foreground italic text-xs">—</span>}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : selectedUser.extraData && Object.keys(selectedUser.extraData).length > 0 ? (
                  <div className="divide-y divide-border/40">
                    {Object.entries(selectedUser.extraData).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between py-3.5">
                        <span className="text-sm text-muted-foreground">{k}</span>
                        <span className="text-sm font-medium break-all">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                    {extraColumns.length > 0 ? 'No custom data entered yet.' : 'No extra data has been added yet. Use Edit to add fields.'}
                  </div>
                )}
              </div>

              {activeView === 'USERS' && selectedUserType === 'STUDENT' && (selectedUser.fatherId || selectedUser.motherId || selectedUser.guardianId) && <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Family Information <span className="flex-1 h-px bg-border/40" /></p>
                  <div className="divide-y divide-border/40">
                    {selectedUser.fatherId && <div className="flex items-center justify-between py-3.5">
                        <div>
                          <p className="text-sm text-muted-foreground">Father ID</p>
                          <p className="text-sm font-mono font-medium break-all">{selectedUser.fatherId}</p>
                        </div>
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleViewBasicUser(selectedUser.fatherId)} aria-label="View father user details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>}
                    {selectedUser.motherId && <div className="flex items-center justify-between py-3.5">
                        <div>
                          <p className="text-sm text-muted-foreground">Mother ID</p>
                          <p className="text-sm font-mono font-medium break-all">{selectedUser.motherId}</p>
                        </div>
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleViewBasicUser(selectedUser.motherId)} aria-label="View mother user details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>}
                    {selectedUser.guardianId && <div className="flex items-center justify-between py-3.5">
                        <div>
                          <p className="text-sm text-muted-foreground">Guardian ID</p>
                          <p className="text-sm font-mono font-medium break-all">{selectedUser.guardianId}</p>
                        </div>
                        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleViewBasicUser(selectedUser.guardianId)} aria-label="View guardian user details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>}
                  </div>
                </div>}
            </div>}
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <CreateUserForm onSubmit={handleCreateUser} onCancel={() => setShowCreateUserDialog(false)} />
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={showAssignUserDialog} onOpenChange={setShowAssignUserDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign User to Institute</DialogTitle>
          </DialogHeader>
          <AssignUserForm instituteId={currentInstituteId!} onSubmit={handleAssignUser} onCancel={() => setShowAssignUserDialog(false)} initialUserId={assignInitialUserId} />
        </DialogContent>
      </Dialog>

      {/* Assign Parent Dialog */}
      <Dialog open={showAssignParentDialog} onOpenChange={setShowAssignParentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Parent to Student</DialogTitle>
          </DialogHeader>
          {selectedStudentForParent && <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Assigning parent to:</p>
              <p className="font-medium">{selectedStudentForParent.name}</p>
              <p className="text-sm text-muted-foreground">ID: {selectedStudentForParent.id}</p>
            </div>}
          <AssignParentByPhoneForm studentId={selectedStudentForParent?.id || ''} onSubmit={handleParentAssignment} onCancel={() => {
          setShowAssignParentDialog(false);
          setSelectedStudentForParent(null);
        }} />
        </DialogContent>
      </Dialog>

      {/* Assign User Methods Dialog */}
      <AssignUserMethodsDialog open={showAssignMethodsDialog} onClose={() => setShowAssignMethodsDialog(false)} instituteId={currentInstituteId} onSuccess={() => {
      // Refresh the current tab data
      getCurrentTable().actions.refresh();
    }} />

      <UserInfoDialog open={userInfoDialog.open} onClose={() => setUserInfoDialog({
      open: false,
      user: null
    })} user={userInfoDialog.user} />

      {/* User Organizations Dialog */}
      {selectedUserForOrg && <UserOrganizationsDialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen} userId={selectedUserForOrg.id} userName={selectedUserForOrg.name} />}

      {/* Create Comprehensive User Dialog */}
      {showCreateComprehensiveUserDialog && <CreateComprehensiveUserForm onSubmit={data => {
      console.log('Comprehensive user created:', data);
      setShowCreateComprehensiveUserDialog(false);
      toast({
        title: "Success",
        description: data.message || "User created successfully!",
        duration: 1500
      });
      // Refresh the current tab data
      getCurrentTable().actions.refresh();
    }} onCancel={() => setShowCreateComprehensiveUserDialog(false)} />}

      {/* Create Institute User Dialog (with enrollment, images, class/subject) */}
      {showCreateInstituteUserDialog && <CreateInstituteUserForm onSubmit={data => {
      console.log('Institute user created:', data);
      setShowCreateInstituteUserDialog(false);
      toast({
        title: "Success",
        description: data.message || "User created and enrolled successfully!",
        duration: 2000
      });
      getCurrentTable().actions.refresh();
    }} onCancel={() => setShowCreateInstituteUserDialog(false)} />}

      {/* Upload Image Dialog with Crop */}
      <Dialog open={!!uploadingImageTarget} onOpenChange={handleCloseUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{uploadingImageTarget?.scope === 'GLOBAL' ? 'Upload Global Image' : 'Upload Institute Image'} (35mm × 45mm)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Image</label>
              <Input type="file" accept="image/*" onChange={handleFileSelect} />
            </div>
            
            {cropImgSrc && <div className="max-h-80 overflow-auto rounded-lg flex justify-center">
                <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} onComplete={c => setCompletedCrop(c)} aspect={PASSPORT_ASPECT_RATIO} minWidth={50} minHeight={50} keepSelection ruleOfThirds style={{
              maxHeight: '300px'
            }}>
                  <img ref={imgRef} alt="Crop preview" src={cropImgSrc} onLoad={onCropImageLoad} style={{
                maxHeight: '300px',
                maxWidth: '100%'
              }} />
                </ReactCrop>
              </div>}
            
            <p className="text-[13px] text-muted-foreground text-center">
              Passport photo size: 35mm × 45mm (7:9 aspect ratio)
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseUploadDialog}>
              Cancel
            </Button>
            <Button onClick={() => uploadingImageTarget && handleImageUpload(uploadingImageTarget)} disabled={!completedCrop || uploading}>
              {uploading ? <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </> : <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImagePreviewModal 
        isOpen={imagePreview.isOpen} 
        onClose={() => setImagePreview({
          isOpen: false,
          url: '',
          title: ''
        })} 
        imageUrl={imagePreview.url} 
        title={imagePreview.title}
        userMetadata={imagePreview.userMetadata}
      />

      {/* Change Role Dialog */}
      <Dialog open={changeRoleDialog.open} onOpenChange={(open) => { if (!open) { setChangeRoleDialog({ open: false, user: null }); setNewRoleValue(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Changing role for <strong>{changeRoleDialog.user?.name || 'Unknown'}</strong>
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">New Role</p>
              <Select value={newRoleValue} onValueChange={setNewRoleValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSTITUTE_ADMIN">Institute Admin</SelectItem>
                  <SelectItem value="TEACHER">Teacher</SelectItem>
                  <SelectItem value="STUDENT">Student</SelectItem>
                  <SelectItem value="ATTENDANCE_MARKER">Attendance Marker</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setChangeRoleDialog({ open: false, user: null }); setNewRoleValue(''); }}>Cancel</Button>
            <Button onClick={handleChangeRole} disabled={changingRole || !newRoleValue}>
              {changingRole ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Changing...</> : 'Change Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Institute Password Dialog */}
      <Dialog open={setPasswordDialog.open} onOpenChange={(open) => { if (!open) { setSetPasswordDialog({ open: false, user: null }); setNewPasswordValue(''); setConfirmPasswordValue(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Institute Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Setting institute password for <strong>{setPasswordDialog.user?.name || 'Unknown'}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              This will set or reset the institute-level login password for this user. The current password cannot be viewed.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium">New Password</p>
              <Input
                type="password"
                placeholder="Min 8 characters"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Confirm Password</p>
              <Input
                type="password"
                placeholder="Re-enter password"
                value={confirmPasswordValue}
                onChange={(e) => setConfirmPasswordValue(e.target.value)}
                autoComplete="new-password"
              />
              {confirmPasswordValue && newPasswordValue !== confirmPasswordValue && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSetPasswordDialog({ open: false, user: null }); setNewPasswordValue(''); setConfirmPasswordValue(''); }}>Cancel</Button>
            <Button onClick={handleSetInstitutePassword} disabled={settingPassword || !newPasswordValue || newPasswordValue.length < 8 || newPasswordValue !== confirmPasswordValue}>
              {settingPassword ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Setting...</> : 'Set Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Extra Data Dialog */}
      <Dialog open={editExtraDataDialog.open} onOpenChange={(open) => { if (!open) setEditExtraDataDialog({ open: false, user: null }); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Extra Data — {editExtraDataDialog.user?.name || 'User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {extraColumns.length > 0 ? (
              // Schema-driven edit
              <ExtraDataFields
                columns={extraColumns}
                values={extraDataRecord}
                onChange={setExtraDataRecord}
                userType={selectedUserType === 'STUDENT' ? 'Student' : selectedUserType === 'TEACHER' ? 'Teacher' : undefined}
              />
            ) : (
              // Fallback: ad-hoc key-value rows
              <>
                <p className="text-sm text-muted-foreground">
                  Add any custom key-value fields for this user. Stored as JSON, visible to admins.
                </p>
                <div className="space-y-2">
                  {extraDataRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input className="flex-1" placeholder="Key (e.g. batch)" value={row.key} onChange={e => { const next = [...extraDataRows]; next[idx] = { ...next[idx], key: e.target.value }; setExtraDataRows(next); }} />
                      <Input className="flex-1" placeholder="Value" value={row.value} onChange={e => { const next = [...extraDataRows]; next[idx] = { ...next[idx], value: e.target.value }; setExtraDataRows(next); }} />
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive" onClick={() => setExtraDataRows(extraDataRows.filter((_, i) => i !== idx))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 mt-1" onClick={() => setExtraDataRows([...extraDataRows, { key: '', value: '' }])}>
                    <Plus className="h-4 w-4" />
                    Add field
                  </Button>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExtraDataDialog({ open: false, user: null })}>Cancel</Button>
            <Button onClick={handleSaveExtraData} disabled={savingExtraData}>
              {savingExtraData ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
};
export default InstituteUsers;