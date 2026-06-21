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
import { Eye, RefreshCw, GraduationCap, Users, UserCheck, Plus, UserPlus, UserCog, Filter, Search, Shield, Upload, CheckCircle, UserX, UserMinus, Loader2, Clock, CheckCircle2, XCircle, ChevronDown, LayoutGrid, Table2, KeyRound, Pencil, X, MoreVertical, ArrowUpCircle, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useResizableColumns, ResizeHandle } from '@/hooks/useResizableColumns';
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
import AdminUpgradeUserTypeDialog from '@/components/forms/AdminUpgradeUserTypeDialog';
import AssignParentForm from '@/components/forms/AssignParentForm';
import AssignParentByPhoneForm from '@/components/forms/AssignParentByPhoneForm';
import AssignUserMethodsDialog from '@/components/forms/AssignUserMethodsDialog';
import { usersApi, BasicUser } from '@/api/users.api';
import { housesApi, InstituteHouse } from '@/api/houses.api';
import { profileImageApi } from '@/api/profileImage.api';
import { instituteUsersApi } from '@/api/instituteUsers.api';
import UserInfoDialog from '@/components/forms/UserInfoDialog';
import UserOrganizationsDialog from '@/components/forms/UserOrganizationsDialog';
import { getBaseUrl, getApiHeadersAsync } from '@/contexts/utils/auth.api';
import { setInstituteUserPassword } from '@/contexts/utils/auth.api';
import { getErrorMessage } from '@/api/apiError';
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
import { useUserTypes } from '@/hooks/useUserTypes';
import { UserType } from '@/api/userTypes.api';

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
  primaryUserTypeId?: string;
  userType?: {
    id: string;
    name: string;
    slug: string;
  };
  /** Global system-level user type (e.g. USER_WITHOUT_PARENT) — present when API returns it */
  globalUserType?: string;
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
type ViewType = 'USERS' | 'PENDING' | 'INACTIVE';

const formatNameWithInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  const initials = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + '.').join(' ');
  const last = parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1).toLowerCase();
  return `${initials} ${last}`;
};

const InstituteUsers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, currentInstituteId } = useAuth();
  const { userTypes, loading: typesLoading } = useUserTypes();

  const { columns: extraColumns } = useInstituteUserColumns(currentInstituteId);
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
  const [selectedUserTypeId, setSelectedUserTypeId] = useState<string>('');
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

  const [filters, setFilters] = useState<Record<string, InstituteUserFilterParams>>({});
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<InstituteUserFilterParams>({});
  const [inactiveFilters, setInactiveFilters] = useState<InstituteUserFilterParams>({});
  const [pendingUserTypeId, setPendingUserTypeId] = useState<string>('');
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());

  // Store table instances in refs to avoid recreating them on every render
  const tableInstancesRef = useRef<Record<string, any>>({});
  const [selectedPendingUsers, setSelectedPendingUsers] = useState<string[]>([]);
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const [userInfoDialog, setUserInfoDialog] = useState<{ open: boolean; user: BasicUser | null }>({ open: false, user: null });
  const [uploadingImageTarget, setUploadingImageTarget] = useState<{ userId: string; scope: 'GLOBAL' | 'INSTITUTE' } | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [selectedUserForOrg, setSelectedUserForOrg] = useState<{ id: string; name: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<{ isOpen: boolean; url: string; title: string; userMetadata?: any }>({ isOpen: false, url: '', title: '' });
  const [cropImgSrc, setCropImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const PASSPORT_ASPECT_RATIO = 7 / 9;

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
  const [upgradeTypeDialog, setUpgradeTypeDialog] = useState<{ open: boolean; user: InstituteUserData | null }>({ open: false, user: null });

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const defaultViewForType = (typeId: string): 'card' | 'table' => {
    // Desktop always defaults to table; mobile defaults to card for students, table otherwise
    if (!isMobile) return 'table';
    const type = userTypes.find(t => t.id === typeId);
    return type?.slug === 'student' ? 'card' : 'table';
  };

  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');

  useEffect(() => {
    if (userTypes.length > 0 && !selectedUserTypeId) {
      const studentType = userTypes.find(t => t.slug === 'student');
      const typeId = studentType?.id ?? userTypes[0]?.id ?? '';
      setSelectedUserTypeId(typeId);
      if (!pendingUserTypeId) setPendingUserTypeId(typeId);
    }
  }, [userTypes, selectedUserTypeId, pendingUserTypeId]);

  useEffect(() => {
    const stored = localStorage.getItem(`viewMode_${selectedUserTypeId}`);
    setViewMode((stored as 'card' | 'table') || defaultViewForType(selectedUserTypeId));
  }, [selectedUserTypeId, userTypes]);

  const handleSetViewMode = (mode: 'card' | 'table') => {
    setViewMode(mode);
    if (selectedUserTypeId) {
      localStorage.setItem(`viewMode_${selectedUserTypeId}`, mode);
    }
  };

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [houseOptions, setHouseOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [instituteNameOptions, setInstituteNameOptions] = useState<string[]>([]);

  useEffect(() => {
    const loadHouseOptions = async () => {
      if (!currentInstituteId) return;
      try {
        const houses = await housesApi.list(currentInstituteId, false);
        const options = (houses ?? []).map((h: InstituteHouse) => ({ id: String(h.id), name: h.name }));
        setHouseOptions(options);
      } catch { setHouseOptions([]); }
    };
    loadHouseOptions();
  }, [currentInstituteId]);

  const getCurrentFilters = () => {
    if (activeView === 'PENDING') return pendingFilters;
    if (activeView === 'INACTIVE') return inactiveFilters;
    return filters[selectedUserTypeId] || {};
  };

  const setCurrentFilters = (newFilters: InstituteUserFilterParams) => {
    if (activeView === 'PENDING') setPendingFilters(newFilters);
    else if (activeView === 'INACTIVE') setInactiveFilters(newFilters);
    else setFilters(prev => ({ ...prev, [selectedUserTypeId]: newFilters }));
  };

  // Call table hooks at top level - one for each view
  const tableConfig = { pagination: { defaultLimit: 50, availableLimits: [25, 50, 100, 500] }, autoLoad: false };
  
  // Table for regular users by type (call hook at top level, always)
  // Backend expects user type SLUG (e.g. STUDENT, TEACHER), not numeric id
  const selectedUserTypeSlug = userTypes.find(ut => ut.id === selectedUserTypeId)?.slug?.toUpperCase() || '';
  const usersByTypeTable = useTableData<InstituteUserData>({
    endpoint: currentInstituteId && selectedUserTypeSlug ? `/institute-users/institute/${currentInstituteId}/users/${selectedUserTypeSlug}` : null,
    defaultParams: filters[selectedUserTypeId] || {},
    dependencies: [],
    ...tableConfig
  });

  // Table for inactive users (call hook at top level, always)
  const inactiveUsersTable = useTableData<InstituteUserData>({
    endpoint: currentInstituteId ? `/institute-users/institute/${currentInstituteId}/users/inactive` : null,
    defaultParams: inactiveFilters,
    dependencies: [],
    ...tableConfig
  });

  // Table for pending verification (call hook at top level, always)
  const pendingUserTypeSlug = userTypes.find(ut => ut.id === pendingUserTypeId)?.slug?.toUpperCase() || '';
  const pendingUsersTable = useTableData<InstituteUserData>({
    endpoint: currentInstituteId && pendingUserTypeSlug ? `/institute-users/institute/${currentInstituteId}/users/${pendingUserTypeSlug}/unverified` : null,
    defaultParams: pendingFilters,
    dependencies: [pendingUserTypeSlug],
    ...tableConfig
  });

  // Organize tables in an object after hooks are called
  const tables = useMemo(() => {
    const allTables: Record<string, any> = {
      [selectedUserTypeId]: usersByTypeTable,
      inactive: inactiveUsersTable,
      pending: pendingUsersTable
    };
    return allTables;
  }, [selectedUserTypeId, usersByTypeTable, inactiveUsersTable, pendingUsersTable]);

  // Collect distinct instituteName values from loaded users' extra_data for filter dropdown
  const allLoadedUsers = useMemo(() => {
    const allTables = [usersByTypeTable, inactiveUsersTable, pendingUsersTable];
    return allTables.flatMap(t => t?.state?.data || []);
  }, [usersByTypeTable, inactiveUsersTable, pendingUsersTable]);

  useEffect(() => {
    const names = Array.from(
      new Set(
        allLoadedUsers
          .map((u: any) => u?.extraData?.instituteName)
          .filter((n: any) => typeof n === 'string' && n.trim() !== '')
      )
    ).sort() as string[];
    if (names.length > 0) setInstituteNameOptions(names);
  }, [allLoadedUsers]);

  const createUserRequest = useApiRequest(async (userData: any) => {
    const response = await fetch(`/api/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userData) });
    return response.json();
  }, { preventDuplicates: true, showLoading: false });

  const handleViewUser = (user: InstituteUserData) => {
    setSelectedUser(user);
    setShowUserDialog(true);
  };

  const handleOpenUserDetails = (user: InstituteUserData) => {
    const selectedType = userTypes.find(ut => ut.id === selectedUserTypeId);
    if (activeView === 'USERS' && selectedType?.slug === 'student') {
      navigate(`/institute/${currentInstituteId}/student/${user.id}/profile`, { state: { student: user } });
      return;
    }
    handleViewUser(user);
  };

  const handleViewBasicUser = async (id?: string | null) => {
    if (!id) return;
    try {
      const info = await usersApi.getBasicInfo(id);
      setUserInfoDialog({ open: true, user: info });
    } catch (error: any) {
      toast({ title: 'Failed to load user', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleCreateUser = (userData: any) => {
    setShowCreateUserDialog(false);
    if (userData?.user?.id) {
      setAssignInitialUserId(userData.user.id);
      setShowAssignUserDialog(true);
    }
    toast({ title: "User Created", description: "User has been created successfully." });
  };

  const handleAssignUser = (assignData: any) => {
    setShowAssignUserDialog(false);
    toast({ title: "User Assigned", description: "User has been assigned successfully." });
    getCurrentTable()?.actions.refresh();
  };

  const handleAssignParent = (student: InstituteUserData) => {
    setSelectedStudentForParent(student);
    setShowAssignParentDialog(true);
  };

  const handleParentAssignment = (data: any) => {
    setShowAssignParentDialog(false);
    setSelectedStudentForParent(null);
    tables[selectedUserTypeId]?.actions.refresh();
  };

  const centerAspectCrop = useCallback((mediaWidth: number, mediaHeight: number, aspect: number) => centerCrop(makeAspectCrop({ unit: '%', width: 70 }, aspect, mediaWidth, mediaHeight), mediaWidth, mediaHeight), []);
  const onCropImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, PASSPORT_ASPECT_RATIO));
  }, [centerAspectCrop]);

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
    const cropX = cropData.x * scaleX, cropY = cropData.y * scaleY;
    ctx.save();
    ctx.translate(-cropX, -cropY);
    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, image.naturalWidth, image.naturalHeight);
    ctx.restore();
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas is empty')), 'image/png'));
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
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
      const croppedFile = new File([croppedBlob], 'cropped-image.png', { type: 'image/png' });
      const folder = target.scope === 'GLOBAL' ? 'profile-images' : 'institute-user-images';
      const relativePath = await uploadWithSignedUrl(croppedFile, folder, (msg, prog) => console.log(`Upload: ${prog}% - ${msg}`));
      
      let result: any;
      if (target.scope === 'GLOBAL') {
        result = await profileImageApi.submitProfileImage(target.userId, relativePath, 'GLOBAL');
      } else {
        const headers = await getApiHeadersAsync();
        const res = await fetch(`${getBaseUrl()}/institute-users/institute/${currentInstituteId}/user/${target.userId}/upload-image`, {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl: relativePath })
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || `Server error: ${res.status}`);
        result = await res.json();
      }
      
      toast({ title: "Success", description: result.message || "Image uploaded successfully" });
      handleCloseUploadDialog();
      getCurrentTable()?.actions.refresh();
    } catch (error: any) {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to upload image"), variant: "destructive" });
    } finally { setUploading(false); }
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
      const response = await fetch(`${getBaseUrl()}/institute-users/institute/${currentInstituteId}/users/${userId}/activate`, { method: 'PATCH', headers });
      if (!response.ok) throw new Error('Failed to activate user');
      const result = await response.json();
      toast({ title: "Success", description: result.message || "User activated" });
      tables.inactive.actions.refresh();
      getCurrentTable()?.actions.refresh();
    } catch (error: any) {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to activate user"), variant: "destructive" });
    } finally { setActivatingUserId(null); }
  };

  const handleDeactivateUser = async (userId: string) => {
    if (!currentInstituteId) return;
    setDeactivatingUserId(userId);
    try {
      const headers = await getApiHeadersAsync();
      const response = await fetch(`${getBaseUrl()}/institute-users/institute/${currentInstituteId}/users/${userId}/deactivate`, { method: 'PATCH', headers });
      if (!response.ok) throw new Error('Failed to deactivate user');
      const result = await response.json();
      toast({ title: "Success", description: result.message || "User deactivated" });
      getCurrentTable()?.actions.refresh();
    } catch (error: any) {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to deactivate user"), variant: "destructive" });
    } finally { setDeactivatingUserId(null); }
  };

  const handleChangeRole = async () => {
    if (!currentInstituteId || !changeRoleDialog.user || !newRoleValue) return;
    setChangingRole(true);
    try {
      const headers = await getApiHeadersAsync();
      const response = await fetch(`${getBaseUrl()}/institute-users/institute/${currentInstituteId}/user/${changeRoleDialog.user.id}/change-role`, {
        method: 'PATCH', headers, body: JSON.stringify({ primaryUserTypeId: newRoleValue })
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Failed to change role');
      const result = await response.json();
      const newType = userTypes.find(t => t.id === newRoleValue);
      toast({ title: "Role Changed", description: result.message || `Role changed to ${newType?.name}` });
      setChangeRoleDialog({ open: false, user: null });
      setNewRoleValue('');
      getCurrentTable()?.actions.refresh();
      if (tables[newRoleValue]) tables[newRoleValue].actions.refresh();
    } catch (error: any) {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to change role"), variant: "destructive" });
    } finally { setChangingRole(false); }
  };

  const handleSetInstitutePassword = async () => {
    if (!currentInstituteId || !setPasswordDialog.user || !newPasswordValue) return;
    if (newPasswordValue.length < 8) { toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" }); return; }
    if (newPasswordValue !== confirmPasswordValue) { toast({ title: "Error", description: "Passwords do not match", variant: "destructive" }); return; }
    setSettingPassword(true);
    try {
      await setInstituteUserPassword({ instituteId: currentInstituteId, targetUserId: setPasswordDialog.user.id, newPassword: newPasswordValue });
      toast({ title: "Success", description: "Institute password set successfully" });
      setSetPasswordDialog({ open: false, user: null });
      setNewPasswordValue(''); setConfirmPasswordValue('');
    } catch (error: any) {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to set password"), variant: "destructive" });
    } finally { setSettingPassword(false); }
  };

  const handleOpenEditExtraData = (user: InstituteUserData) => {
    const existing: Record<string, string> = user.extraData ? Object.fromEntries(Object.entries(user.extraData).map(([k, v]) => [k, String(v ?? '')])) : {};
    if (extraColumns.length > 0) {
      for (const col of extraColumns) if (!(col.key in existing)) existing[col.key] = '';
      setExtraDataRecord(existing);
    } else {
      setExtraDataRows(Object.keys(existing).length > 0 ? Object.entries(existing).map(([key, value]) => ({ key, value })) : [{ key: '', value: '' }]);
    }
    setEditExtraDataDialog({ open: true, user });
  };

  const handleSaveExtraData = async () => {
    if (!currentInstituteId || !editExtraDataDialog.user) return;
    setSavingExtraData(true);
    try {
      let dataToSave: Record<string, any> | null;
      if (extraColumns.length > 0) {
        dataToSave = Object.values(extraDataRecord).some(v => v !== '') ? extraDataRecord : null;
      } else {
        const filtered = extraDataRows.filter(r => r.key.trim() !== '');
        dataToSave = filtered.length > 0 ? Object.fromEntries(filtered.map(r => [r.key.trim(), r.value])) : null;
      }
      await instituteUsersApi.updateInstituteUserExtraData(currentInstituteId, editExtraDataDialog.user.id, dataToSave);
      toast({ title: 'Success', description: 'Extra data updated successfully' });
      setEditExtraDataDialog({ open: false, user: null });
      getCurrentTable()?.actions.refresh();
    } catch (error: any) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to update extra data'), variant: "destructive" });
    } finally { setSavingExtraData(false); }
  };

  const getCurrentTable = () => {
    if (activeView === 'PENDING') return tables.pending;
    if (activeView === 'INACTIVE') return tables.inactive;
    return tables[selectedUserTypeId];
  };

  useEffect(() => {
    if (!currentInstituteId || !selectedUserTypeId) return;
    const table = getCurrentTable();
    if (table && !table.state.loading) {
      table.actions.loadData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserTypeId, activeView, pendingUserTypeId, currentInstituteId]);

  // Reload when the current table's page or limit changes (autoLoad is false so we drive it here).
  const currentTablePage = getCurrentTable()?.pagination.page;
  const currentTableLimit = getCurrentTable()?.pagination.limit;
  useEffect(() => {
    if (!currentInstituteId || !selectedUserTypeId) return;
    const table = getCurrentTable();
    if (table && !table.state.loading) {
      table.actions.loadData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTablePage, currentTableLimit]);

  const handleFiltersChange = (newFilters: InstituteUserFilterParams) => setCurrentFilters(newFilters);

  const handleApplyFilters = async () => {
    setIsApplyingFilters(true);
    const currentTable = getCurrentTable();
    if (currentTable) {
      await currentTable.actions.applyFiltersAndLoad(getCurrentFilters());
    }
    setIsApplyingFilters(false);
  };

  useEffect(() => {
    Object.values(tables).forEach((table: any) => {
      if (table?.state?.error) {
        toast({ title: 'Failed to load data', description: table.state.error, variant: 'destructive' });
      }
    });
  }, [tables, toast]);

  const handleClearFilters = () => {
    setCurrentFilters({});
    getCurrentTable()?.actions.applyFiltersAndLoad({});
  };

  const getUserTypeLabel = (typeId: string) => userTypes.find(t => t.id === typeId)?.name || 'User';

  const handleVerifyUser = async (userId: string) => {
    if (!currentInstituteId) return;
    setVerifyingIds(prev => new Set(prev).add(userId));
    try {
      const headers = await getApiHeadersAsync();
      const res = await fetch(`${getBaseUrl()}/institute-users/institute/${currentInstituteId}/verify-user`, {
        method: 'POST', headers, body: JSON.stringify({ userId, notes: 'Verified by admin' })
      });
      if (!res.ok) throw new Error('Failed to verify user');
      const result = await res.json();
      toast({ title: "User Verified", description: result.message || "User verified" });
      tables.pending?.actions.refresh();
      setSelectedPendingUsers(prev => prev.filter(id => id !== userId));
    } catch (error: any) {
      toast({ title: "Error", description: getErrorMessage(error, "Failed to verify user"), variant: "destructive" });
    } finally { setVerifyingIds(prev => { const n = new Set(prev); n.delete(userId); return n; }); }
  };

  const handleBulkVerify = async () => {
    if (!currentInstituteId || selectedPendingUsers.length === 0) return;
    setBulkVerifying(true);
    try {
      const headers = await getApiHeadersAsync();
      const res = await fetch(`${getBaseUrl()}/institute-users/institute/${currentInstituteId}/verify-users`, {
        method: 'POST', headers, body: JSON.stringify({ userIds: selectedPendingUsers, notes: 'Bulk verification' })
      });
      if (!res.ok) throw new Error('Failed to bulk verify');
      const result = await res.json();
      toast({ title: "Users Verified", description: result.message || `${result.verified?.length} users verified` });
      tables.pending?.actions.refresh();
      setSelectedPendingUsers([]);
    } catch (error: any) {
      toast({ title: "Error", description: getErrorMessage(error, "Bulk verification failed"), variant: "destructive" });
    } finally { setBulkVerifying(false); }
  };

  const togglePendingUserSelection = (userId: string) => setSelectedPendingUsers(p => p.includes(userId) ? p.filter(id => id !== userId) : [...p, userId]);

  const toggleAllPendingUsers = () => {
    const currentPendingUsers = tables.pending?.state.data || [];
    setSelectedPendingUsers(selectedPendingUsers.length === currentPendingUsers.length ? [] : currentPendingUsers.map(u => u.id));
  };
  
  const userRole = useInstituteRole();

  const allDataColumnDefs: ColumnDef[] = useMemo(() => [
    { key: 'imageUrl', header: 'Image', locked: true, defaultVisible: true, defaultWidth: 80, minWidth: 60, render: (v, row) => <div className="cursor-pointer flex justify-center" onClick={() => row.imageUrl && setImagePreview({ isOpen: true, url: getImageUrl(row.imageUrl), title: row.nameWithInitials || row.name, userMetadata: { userId: row.id, email: row.email, phoneNumber: row.phoneNumber, userType: row.userType?.name }})}><Avatar className="h-10 w-10 md:h-12 md:w-12 lg:h-14 lg:w-14 hover:opacity-80 transition-opacity border-2 border-border"><AvatarImage src={getImageUrl(row.imageUrl || '')} alt={row.name} className="object-cover" /><AvatarFallback className="bg-muted">{row.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar></div> },
    { key: 'id', header: 'ID', defaultVisible: false, defaultWidth: 160, minWidth: 100, render: (_, row) => <span className="font-mono text-sm">{row.id}</span> },
    { key: 'name', header: 'Name', defaultVisible: true, defaultWidth: 180, minWidth: 120, render: (_, row) => <div className="font-medium">{row.nameWithInitials || formatNameWithInitials(row.name)}</div> },
    { key: 'email', header: 'Email', defaultVisible: true, defaultWidth: 200, minWidth: 140, render: (_, row) => <span className="text-sm">{row.email || '-'}</span> },
    { key: 'phoneNumber', header: 'Phone Number', defaultVisible: true, defaultWidth: 150, minWidth: 110, render: (_, row) => <span className="text-sm">{row.phoneNumber || '-'}</span> },
    { key: 'userIdByInstitute', header: 'Institute ID', defaultVisible: true, defaultWidth: 150, minWidth: 100, render: (_, row) => <span className="font-mono text-sm">{row.userIdByInstitute || '-'}</span> },
    { key: 'dateOfBirth', header: 'DOB', defaultVisible: false, defaultWidth: 140, minWidth: 100, render: (_, row) => <span className="text-sm">{row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString() : '-'}</span> },
    { key: 'addressLine1', header: 'Address', defaultVisible: false, defaultWidth: 200, minWidth: 120, render: (_, row) => <div className="text-sm"><div>{row.addressLine1 || '-'}</div>{row.addressLine2 && <div className="text-sm text-muted-foreground">{row.addressLine2}</div>}</div> },
    { key: 'houseName', header: 'House', defaultVisible: false, defaultWidth: 130, minWidth: 90, render: (_, row) => <span className="text-sm">{row.houseName || '-'}</span> },
    ...extraColumns.map(col => ({ key: `extra_${col.key}`, header: col.label, defaultVisible: true, defaultWidth: 140, minWidth: 90, render: (_, row) => <span className="text-sm">{String(row.extraData?.[col.key] ?? '-')}</span> })),
    ...(extraColumns.length === 0 ? [{ key: 'extraData', header: 'Extra Data', defaultVisible: true, defaultWidth: 220, minWidth: 140, render: (_, row) => !row.extraData || Object.keys(row.extraData).length === 0 ? <span className="text-sm text-muted-foreground">—</span> : <div className="flex flex-col gap-0.5">{Object.entries(row.extraData).map(([k, v]) => <span key={k} className="text-xs"><span className="font-medium text-muted-foreground">{k}:</span> <span>{String(v)}</span></span>)}</div> }] : []),
    { key: 'actions', header: 'Actions', defaultVisible: true, defaultWidth: 160, minWidth: 120, render: (_, row) => {
        const isStudentRow = userTypes.find(ut => ut.id === selectedUserTypeId)?.slug === 'student';
        const isUsersView = activeView === 'USERS', isPendingView = activeView === 'PENDING', isInactiveView = activeView === 'INACTIVE';
        const actions: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; className?: string }[] = [
          { label: isStudentRow ? 'View Student Details' : 'View Details', icon: <Eye className="h-4 w-4" />, onClick: () => handleOpenUserDetails(row) },
        ];
        if (isUsersView) actions.push(
          { label: 'View Organizations', icon: <Users className="h-4 w-4" />, onClick: () => { setSelectedUserForOrg({ id: row.id, name: row.name }); setOrgDialogOpen(true); } },
          { label: 'Change Institute Image', icon: <Upload className="h-4 w-4" />, onClick: () => setUploadingImageTarget({ userId: row.id, scope: 'INSTITUTE' }) }
        );
        if (isStudentRow && isUsersView) actions.push({ label: 'Assign Parent', icon: <UserCog className="h-4 w-4" />, onClick: () => handleAssignParent(row) });
        if (isUsersView) {
          actions.push(
            { label: 'Change Role', icon: <UserCog className="h-4 w-4" />, onClick: () => { setChangeRoleDialog({ open: true, user: row }); setNewRoleValue(selectedUserTypeId); } },
            { label: 'Set Password', icon: <KeyRound className="h-4 w-4" />, onClick: () => { setSetPasswordDialog({ open: true, user: row }); setNewPasswordValue(''); setConfirmPasswordValue(''); } },
            { label: 'Edit Extra Data', icon: <Pencil className="h-4 w-4" />, onClick: () => handleOpenEditExtraData(row) },
          );
          const gType = row.globalUserType ?? '';
          if (gType === 'USER_WITHOUT_PARENT' || gType === 'USER_WITHOUT_STUDENT') {
            actions.push({
              label: 'Upgrade to Full USER',
              icon: <ArrowUpCircle className="h-4 w-4" />,
              onClick: () => setUpgradeTypeDialog({ open: true, user: row }),
              className: 'text-primary',
            });
          }
        }
        if (isPendingView) actions.push({ label: verifyingIds.has(row.id) ? 'Verifying...' : 'Verify', icon: verifyingIds.has(row.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />, onClick: () => handleVerifyUser(row.id), disabled: verifyingIds.has(row.id), className: 'text-primary' });
        else if (isInactiveView) actions.push({ label: activatingUserId === row.id ? 'Activating...' : 'Activate', icon: activatingUserId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />, onClick: () => handleActivateUser(row.id), disabled: activatingUserId === row.id, className: 'text-emerald-600' });
        else actions.push({ label: deactivatingUserId === row.id ? 'Deactivating...' : 'Deactivate', icon: deactivatingUserId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />, onClick: () => handleDeactivateUser(row.id), disabled: deactivatingUserId === row.id, className: 'text-destructive' });
        return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()} title="Actions"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{actions.map((a, i) => <DropdownMenuItem key={`${a.label}-${i}`} onClick={a.disabled ? undefined : a.onClick} disabled={a.disabled} className={a.className}><span className="mr-2 h-4 w-4 shrink-0">{a.icon}</span><span>{a.label}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
    } },
  ], [activeView, selectedUserTypeId, handleOpenUserDetails, setSelectedUserForOrg, setOrgDialogOpen, setUploadingImageTarget, handleAssignParent, setChangeRoleDialog, setNewRoleValue, setSetPasswordDialog, handleOpenEditExtraData, verifyingIds, activatingUserId, deactivatingUserId, userTypes, extraColumns]);

  const { colState, visibleColumns, toggleColumn, resetColumns } = useColumnConfig(allDataColumnDefs, 'institute-users');
  const { getWidth: getIUColWidth, totalWidth: totalIUTableWidth, setHoveredCol: setIUHoveredCol, hoveredCol: IUHoveredCol, activeCol: IUActiveCol, startResize: IUStartResize } = useResizableColumns(
    allDataColumnDefs.map(c => c.key), allDataColumnDefs.reduce((acc, c) => ({...acc, [c.key]: c.defaultWidth}), { _checkbox: 50 })
  );

  if (userRole !== 'InstituteAdmin') return <div className="text-center py-12"><p>Access denied. InstituteAdmin role required.</p></div>;
  if (!currentInstituteId) return <div className="text-center py-12"><p>Please select an institute first.</p></div>;

  const currentTable = getCurrentTable();
  const currentUsers = currentTable?.state.data || [];
  const currentLoading = currentTable?.state.loading || typesLoading;
  const currentType = userTypes.find(t => t.id === selectedUserTypeId);

  const viewIcon = activeView === 'PENDING' ? Clock : activeView === 'INACTIVE' ? UserX : Users;

  return <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Institute Users</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage users in your institute</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowAssignMethodsDialog(true)} variant="outline" className="gap-2 flex-1 sm:flex-none" size="sm"><UserPlus className="h-4 w-4" />Assign User</Button>
          <Button onClick={() => navigate(`/institute-users/${currentInstituteId}/create`)} className="gap-2 flex-1 sm:flex-none" size="sm"><Plus className="h-4 w-4" />Create User</Button>
          <ColumnConfigurator allColumns={allDataColumnDefs} colState={colState} onToggle={toggleColumn} onReset={resetColumns} />
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button onClick={() => handleSetViewMode('card')} className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Card View"><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => handleSetViewMode('table')} className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Table View"><Table2 className="h-4 w-4" /></button>
          </div>
          <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen} routeName="institute-users-filter-sheet">
            <SheetTrigger asChild><Button variant="outline" className="gap-2 flex-1 sm:flex-none md:hidden" size="sm"><Filter className="h-4 w-4" />Filters</Button></SheetTrigger>
            <SheetContent side="bottom" className="md:hidden flex flex-col max-h-[80vh]">
              <SheetHeader><SheetTitle>User Filters</SheetTitle></SheetHeader>
              <div className="flex-1 overflow-y-auto py-4">
                <InstituteUsersFilters filters={getCurrentFilters()} onFiltersChange={handleFiltersChange} onApplyFilters={() => { handleApplyFilters(); setIsFilterSheetOpen(false); }} onClearFilters={handleClearFilters} userType={activeView === 'USERS' ? currentType?.slug as any : (activeView as any)} houseOptions={houseOptions} isApplying={isApplyingFilters} instituteNameOptions={instituteNameOptions} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <ScrollAnimationWrapper animationType="slide-up" className="hidden md:block">
        <InstituteUsersFilters filters={getCurrentFilters()} onFiltersChange={handleFiltersChange} onApplyFilters={handleApplyFilters} onClearFilters={handleClearFilters} userType={activeView === 'USERS' ? currentType?.slug as any : (activeView as any)} houseOptions={houseOptions} isApplying={isApplyingFilters} instituteNameOptions={instituteNameOptions} />
      </ScrollAnimationWrapper>

      <Tabs value={activeView} onValueChange={value => setActiveView(value as ViewType)}>
        <div className="lg:hidden overflow-x-auto">
          <TabsList className="inline-flex h-auto w-full gap-1 p-1 bg-muted/50 border rounded-lg">
            <TabsTrigger value="USERS" className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md whitespace-nowrap text-xs sm:text-sm"><Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span>Users</span></TabsTrigger>
            <TabsTrigger value="PENDING" className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md whitespace-nowrap text-xs sm:text-sm"><Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span>Pending</span></TabsTrigger>
            <TabsTrigger value="INACTIVE" className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md whitespace-nowrap text-xs sm:text-sm"><UserX className="h-3.5 w-3.5 sm:h-4 sm:w-4" /><span>Inactive</span></TabsTrigger>
          </TabsList>
        </div>
        <div className="hidden lg:block">
          <TabsList className="grid w-full grid-cols-3 gap-2 p-2 h-auto bg-muted/50">
            <TabsTrigger value="USERS" className="flex items-center gap-2 px-4 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Users className="h-4 w-4" /><span>Users</span></TabsTrigger>
            <TabsTrigger value="PENDING" className="flex items-center gap-2 px-4 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"><Clock className="h-4 w-4" /><span>Pending</span></TabsTrigger>
            <TabsTrigger value="INACTIVE" className="flex items-center gap-2 px-4 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"><UserX className="h-4 w-4" /><span>Inactive</span></TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="USERS" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Select value={selectedUserTypeId} onValueChange={setSelectedUserTypeId} disabled={typesLoading}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder={typesLoading ? 'Loading…' : 'Select user type'} /></SelectTrigger>
                <SelectContent>
                  {userTypes.map(ut => <SelectItem key={ut.id} value={ut.id}><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ut.color ?? '#6B7280' }} />{ut.name}</div></SelectItem>)}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="flex items-center gap-1">{currentTable?.pagination.totalCount ?? 0} {currentType?.namePlural || 'Users'}</Badge>
            </div>
            <Button onClick={() => currentTable?.actions.refresh()} disabled={currentLoading} variant="outline" size="sm">
              {currentLoading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Loading...</> : <><RefreshCw className="h-4 w-4 mr-2" />Load {currentType?.namePlural || 'Users'}</>}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="PENDING" className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2"><Badge variant="outline" className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"><Clock className="h-4 w-4 text-amber-600" />{tables.pending?.pagination.totalCount ?? 0} Pending</Badge></div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={pendingUserTypeId} onValueChange={setPendingUserTypeId} disabled={typesLoading}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder={typesLoading ? 'Loading…' : 'Select type'} /></SelectTrigger>
                  <SelectContent>{userTypes.map(ut => <SelectItem key={ut.id} value={ut.id}>{ut.namePlural}</SelectItem>)}</SelectContent>
                </Select>
                <Button onClick={() => tables.pending?.actions.refresh()} disabled={tables.pending?.state.loading} variant="outline" size="sm">{tables.pending?.state.loading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Loading...</> : <><RefreshCw className="h-4 w-4 mr-2" />Refresh</>}</Button>
              </div>
            </div>
            {selectedPendingUsers.length > 0 && <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border"><span className="text-sm font-medium">{selectedPendingUsers.length} selected</span><Button onClick={handleBulkVerify} disabled={bulkVerifying} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">{bulkVerifying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Verify Selected</>}</Button><Button onClick={() => setSelectedPendingUsers([])} variant="outline" size="sm">Clear</Button></div>}
          </div>
        </TabsContent>

        <TabsContent value="INACTIVE" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Badge variant="outline" className="flex items-center gap-1"><UserX className="h-4 w-4" />{tables.inactive?.pagination.totalCount ?? 0} Inactive Users</Badge></div>
            <Button onClick={() => tables.inactive?.actions.refresh()} disabled={tables.inactive?.state.loading} variant="outline" size="sm">{tables.inactive?.state.loading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Loading...</> : <><RefreshCw className="h-4 w-4 mr-2" />Load Inactive</>}</Button>
          </div>
        </TabsContent>
      </Tabs>

      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 gap-4">
          {currentUsers.length === 0 ? <div className="col-span-full"><EmptyState icon={viewIcon} title={`No ${activeView === 'USERS' ? currentType?.namePlural : activeView} Found`} description="No users found for the current selection." /></div> : currentUsers.map(userData => <Card key={userData.id} className="hover:shadow-md transition-shadow"><div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => handleOpenUserDetails(userData)}>{activeView === 'PENDING' && <input type="checkbox" checked={selectedPendingUsers.includes(userData.id)} onClick={e => e.stopPropagation()} onChange={() => togglePendingUserSelection(userData.id)} className="w-4 h-4 rounded border-border shrink-0" />}<Avatar className="h-12 w-12 shrink-0 border-2 border-border cursor-pointer" onClick={(e) => { e.stopPropagation(); if (userData.imageUrl) setImagePreview({ isOpen: true, url: getImageUrl(userData.imageUrl), title: userData.nameWithInitials || userData.name, userMetadata: { userId: userData.id, email: userData.email, phoneNumber: userData.phoneNumber, userType: userData.userType?.name } }); }}><AvatarImage src={getImageUrl(userData.imageUrl || '')} alt={userData.name} /><AvatarFallback>{userData.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="font-semibold truncate">{userData.nameWithInitials || formatNameWithInitials(userData.name)}</p><p className="text-sm text-muted-foreground truncate">{userData.email || '-'}</p>{userData.userIdByInstitute && <p className="text-sm text-muted-foreground font-mono">Inst. ID: {userData.userIdByInstitute}</p>}</div><button onClick={(e) => { e.stopPropagation(); setExpandedUserId(p => p === userData.id ? null : userData.id); }} className="text-muted-foreground hover:text-foreground ml-auto shrink-0"><ChevronDown className={`h-4 w-4 transition-transform ${expandedUserId === userData.id ? 'rotate-180' : ''}`} /></button></div>{expandedUserId === userData.id && <div className="px-4 pb-4 border-t pt-3 space-y-3"><div className="space-y-1 text-sm">... details ...</div></div>}</Card>)}
        </div>
      ) : (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ height: 'calc(100vh - 320px)', overflow: 'auto' }}>
            <Table stickyHeader aria-label="users table" sx={{ tableLayout: 'fixed', minWidth: totalIUTableWidth }}>
              <TableHead><TableRow>{activeView === 'PENDING' && <TableCell padding="checkbox" style={{ width: getIUColWidth('_checkbox')}}><input type="checkbox" checked={selectedPendingUsers.length === currentUsers.length && currentUsers.length > 0} onChange={toggleAllPendingUsers} /></TableCell>}{visibleColumns.map(col => <TableCell key={col.key} onMouseEnter={() => setIUHoveredCol(col.key)} onMouseLeave={() => setIUHoveredCol(null)} style={{ position: 'relative', width: getIUColWidth(col.key) }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.header}</div><ResizeHandle colId={col.key} hoveredCol={IUHoveredCol} activeCol={IUActiveCol} onMouseDown={IUStartResize} /></TableCell>)}</TableRow></TableHead>
              <TableBody>{currentUsers.map(userData => <TableRow hover role="checkbox" tabIndex={-1} key={userData.id} className="cursor-pointer" onClick={() => handleOpenUserDetails(userData)}>{activeView === 'PENDING' && <TableCell padding="checkbox"><input type="checkbox" checked={selectedPendingUsers.includes(userData.id)} onChange={() => togglePendingUserSelection(userData.id)} /></TableCell>}{visibleColumns.map(col => <TableCell key={col.key}>{col.render ? col.render((userData as any)[col.key], userData) : (userData as any)[col.key]}</TableCell>)}</TableRow>)}{currentUsers.length === 0 && <TableRow><TableCell colSpan={visibleColumns.length + (activeView === 'PENDING' ? 1 : 0)} align="center"><div className="py-12 text-center text-muted-foreground">{activeView === 'PENDING' ? <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" /> : activeView === 'INACTIVE' ? <UserX className="h-12 w-12 mx-auto mb-4 opacity-50" /> : <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />}<p className="text-lg">No {activeView === 'USERS' ? currentType?.namePlural.toLowerCase() : activeView.toLowerCase()}</p><p className="text-sm">No users for current selection</p></div></TableCell></TableRow>}</TableBody>
            </Table>
          </TableContainer>
          {currentTable && <TablePagination rowsPerPageOptions={currentTable.availableLimits.map(n => n === 500 ? { value: 500, label: 'All (500)' } : n)} component="div" count={currentTable.pagination.totalCount} rowsPerPage={currentTable.pagination.limit} page={currentTable.pagination.page} onPageChange={(_, newPage) => currentTable.actions.setPage(newPage)} onRowsPerPageChange={(e) => { currentTable.actions.setLimit(parseInt(e.target.value, 10)); currentTable.actions.setPage(0); }} />}
        </Paper>
      )}

      {currentTable && currentTable.pagination.totalPages > 1 && <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Showing {currentTable.pagination.page * currentTable.pagination.limit + 1}-{Math.min((currentTable.pagination.page + 1) * currentTable.pagination.limit, currentTable.pagination.totalCount)} of {currentTable.pagination.totalCount}</p><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => currentTable.actions.prevPage()} disabled={currentTable.pagination.page === 0 || currentLoading}>Prev</Button><Button variant="outline" size="sm" onClick={() => currentTable.actions.nextPage()} disabled={currentTable.pagination.page >= currentTable.pagination.totalPages - 1 || currentLoading}>Next</Button></div></div>}

      {currentUsers.length === 0 && !currentLoading && <EmptyState icon={viewIcon} title={`No ${activeView === 'USERS' ? currentType?.namePlural : activeView} Found`} description={`No users for this institute. Click to load.`} />}

      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent routeName="view-user-details-popup" className="w-[95vw] max-w-2xl max-h-[93vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" />
              User Details
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-5 py-1">
              {/* Avatar + name + badges */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-border shrink-0">
                  <AvatarImage src={getImageUrl(selectedUser.instituteUserImageUrl || selectedUser.imageUrl || '')} alt={selectedUser.name} className="object-cover" />
                  <AvatarFallback className="text-lg">{selectedUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold">{selectedUser.nameWithInitials || formatNameWithInitials(selectedUser.name)}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedUser.userType && <Badge variant="secondary">{selectedUser.userType.name}</Badge>}
                    {selectedUser.globalUserType && <Badge variant="outline" className="text-xs">{selectedUser.globalUserType.replace(/_/g, ' ')}</Badge>}
                  </div>
                </div>
              </div>

              {/* IDs section */}
              <div className="p-3 rounded-lg bg-muted/40 border space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Identifiers</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">System User ID</p>
                    <p className="text-sm font-mono font-medium">{selectedUser.id}</p>
                  </div>
                  {selectedUser.userIdByInstitute && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Institute User ID</p>
                      <p className="text-sm font-mono font-medium">{selectedUser.userIdByInstitute}</p>
                    </div>
                  )}
                  {selectedUser.studentId && (
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Student Record ID</p>
                      <p className="text-sm font-mono font-medium">{selectedUser.studentId}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact & personal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Email', value: selectedUser.email },
                  { label: 'Phone', value: selectedUser.phoneNumber },
                  { label: 'Date of Birth', value: selectedUser.dateOfBirth ? new Date(selectedUser.dateOfBirth).toLocaleDateString() : undefined },
                  { label: 'Address', value: [selectedUser.addressLine1, selectedUser.addressLine2].filter(Boolean).join(', ') || undefined },
                  { label: 'House', value: selectedUser.houseName },
                  { label: 'Emergency Contact', value: selectedUser.emergencyContact },
                  { label: 'Medical Conditions', value: selectedUser.medicalConditions },
                  { label: 'Allergies', value: selectedUser.allergies },
                  { label: 'Verified By', value: selectedUser.verifiedBy },
                ].map(({ label, value }) => value ? (
                  <div key={label} className="space-y-0.5">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
                    <p className="text-sm">{value}</p>
                  </div>
                ) : null)}
              </div>

              {/* Extra data */}
              {selectedUser.extraData && Object.keys(selectedUser.extraData).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Extra Info</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg bg-muted/40 border">
                    {Object.entries(selectedUser.extraData).map(([k, v]) => (
                      <div key={k} className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{k}</p>
                        <p className="text-sm font-medium">{String(v ?? '-')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parent / Guardian info */}
              {selectedUser.father && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Father / Guardian</p>
                  <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
                    <p className="text-sm font-medium">{selectedUser.father.name}</p>
                    {selectedUser.father.email && <p className="text-sm text-muted-foreground">{selectedUser.father.email}</p>}
                    {selectedUser.father.occupation && <p className="text-xs text-muted-foreground">{selectedUser.father.occupation}{selectedUser.father.workPlace ? ` · ${selectedUser.father.workPlace}` : ''}</p>}
                  </div>
                </div>
              )}

              {/* Attendance quick-link for students */}
              {selectedUser.studentId && (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-sm"
                    onClick={() => {
                      setShowUserDialog(false);
                      navigate(`/institute/${currentInstituteId}/student/${selectedUser.id}/profile`, { state: { student: selectedUser } });
                    }}
                  >
                    <GraduationCap className="h-4 w-4 mr-2" />
                    View Full Student Profile &amp; Attendance
                  </Button>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button variant="outline" onClick={() => setShowUserDialog(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog} routeName="create-user-dialog-popup"><DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto"><DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader><CreateUserForm onSubmit={handleCreateUser} onCancel={() => setShowCreateUserDialog(false)} /></DialogContent></Dialog>
      <Dialog open={showAssignUserDialog} onOpenChange={setShowAssignUserDialog} routeName="assign-user-to-institute-popup"><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Assign User to Institute</DialogTitle></DialogHeader><AssignUserForm instituteId={currentInstituteId!} onSubmit={handleAssignUser} onCancel={() => setShowAssignUserDialog(false)} initialUserId={assignInitialUserId} /></DialogContent></Dialog>
      <Dialog open={showAssignParentDialog} onOpenChange={setShowAssignParentDialog} routeName="assign-parent-dialog-popup"><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Assign Parent</DialogTitle></DialogHeader>{selectedStudentForParent && <div className="mb-4 p-3 bg-muted rounded-lg"><p className="text-sm">Assigning parent to:</p><p className="font-medium">{selectedStudentForParent.name}</p></div>}<AssignParentByPhoneForm studentId={selectedStudentForParent?.id || ''} onSubmit={handleParentAssignment} onCancel={() => {setShowAssignParentDialog(false); setSelectedStudentForParent(null);}} /></DialogContent></Dialog>
      <AssignUserMethodsDialog open={showAssignMethodsDialog} onClose={() => setShowAssignMethodsDialog(false)} instituteId={currentInstituteId!} onSuccess={() => getCurrentTable()?.actions.refresh()} />
      <UserInfoDialog open={userInfoDialog.open} onClose={() => setUserInfoDialog({ open: false, user: null })} user={userInfoDialog.user} />
      {selectedUserForOrg && <UserOrganizationsDialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen} userId={selectedUserForOrg.id} userName={selectedUserForOrg.name} />}
      {showCreateComprehensiveUserDialog && <CreateComprehensiveUserForm onSubmit={data => { setShowCreateComprehensiveUserDialog(false); toast({ title: "Success", description: data.message || "User created!" }); getCurrentTable()?.actions.refresh(); }} onCancel={() => setShowCreateComprehensiveUserDialog(false)} />}
      {showCreateInstituteUserDialog && <CreateInstituteUserForm onSubmit={data => { setShowCreateInstituteUserDialog(false); toast({ title: "Success", description: data.message || "User created and enrolled!" }); getCurrentTable()?.actions.refresh(); }} onCancel={() => setShowCreateInstituteUserDialog(false)} />}
      <Dialog open={!!uploadingImageTarget} onOpenChange={handleCloseUploadDialog} routeName="upload-institute-user-image-popup"><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{uploadingImageTarget?.scope === 'GLOBAL' ? 'Upload Global Image' : 'Upload Institute Image'}</DialogTitle></DialogHeader><div className="space-y-4"><Input type="file" accept="image/*" onChange={handleFileSelect} />{cropImgSrc && <div className="max-h-80 overflow-auto flex justify-center"><ReactCrop crop={crop} onChange={(_, pc) => setCrop(pc)} onComplete={c => setCompletedCrop(c)} aspect={PASSPORT_ASPECT_RATIO} minWidth={50} keepSelection><img ref={imgRef} alt="Crop preview" src={cropImgSrc} onLoad={onCropImageLoad} style={{ maxHeight: '300px' }} /></ReactCrop></div>}<p className="text-sm text-muted-foreground text-center">Passport photo size: 35mm × 45mm (7:9)</p></div><DialogFooter><Button variant="outline" onClick={handleCloseUploadDialog}>Cancel</Button><Button onClick={() => uploadingImageTarget && handleImageUpload(uploadingImageTarget)} disabled={!completedCrop || uploading}>{uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Upload</>}</Button></DialogFooter></DialogContent></Dialog>
      <ImagePreviewModal isOpen={imagePreview.isOpen} onClose={() => setImagePreview({ isOpen: false, url: '', title: '' })} imageUrl={imagePreview.url} title={imagePreview.title} userMetadata={imagePreview.userMetadata} />
      <Dialog open={changeRoleDialog.open} onOpenChange={(open) => !open && setChangeRoleDialog({ open: false, user: null })} routeName="change-user-role-popup"><DialogContent><DialogHeader><DialogTitle>Change User Role</DialogTitle></DialogHeader><div className="py-2 space-y-4"><p>Changing role for <strong>{changeRoleDialog.user?.name}</strong></p><div className="space-y-2"><p className="font-medium">New Role</p><Select value={newRoleValue} onValueChange={setNewRoleValue} disabled={typesLoading}><SelectTrigger><SelectValue placeholder={typesLoading ? 'Loading…' : 'Select role'} /></SelectTrigger><SelectContent>{userTypes.map(ut => <SelectItem key={ut.id} value={ut.id}><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: ut.color }} />{ut.name}</div></SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setChangeRoleDialog({ open: false, user: null })}>Cancel</Button><Button onClick={handleChangeRole} disabled={changingRole || !newRoleValue}> {changingRole ? 'Changing...' : 'Change Role'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={setPasswordDialog.open} onOpenChange={(open) => !open && setSetPasswordDialog({ open: false, user: null })}><DialogContent routeName="set-password-popup">...</DialogContent></Dialog>
      <Dialog open={editExtraDataDialog.open} onOpenChange={(open) => !open && setEditExtraDataDialog({ open: false, user: null })}><DialogContent routeName="edit-extra-data-popup">...</DialogContent></Dialog>

      {upgradeTypeDialog.user && (
        <AdminUpgradeUserTypeDialog
          open={upgradeTypeDialog.open}
          onOpenChange={(open) => { if (!open) setUpgradeTypeDialog({ open: false, user: null }); }}
          globalUserType={upgradeTypeDialog.user.globalUserType ?? ''}
          userId={upgradeTypeDialog.user.id}
          userName={upgradeTypeDialog.user.name}
          instituteId={currentInstituteId!}
          onSuccess={() => {
            setUpgradeTypeDialog({ open: false, user: null });
            getCurrentTable()?.actions.refresh();
          }}
        />
      )}
    </div>;
};
export default InstituteUsers;