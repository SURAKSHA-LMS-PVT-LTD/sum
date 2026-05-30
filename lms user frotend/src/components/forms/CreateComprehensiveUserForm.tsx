import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast as sonnerToast } from 'sonner';
import { getSignedUrl, uploadToSignedUrl, detectFolder } from '@/utils/imageUploadHelper';
import PassportImageCropUpload from '@/components/common/PassportImageCropUpload';
import { getErrorMessage } from '@/api/apiError';
import { parentsApi, type InstituteParent } from '@/api/parents.api';
import { useAuth } from '@/contexts/AuthContext';
import { Occupation } from '@/types/occupation.types';
import { District } from '@/types/district.types';
import { Province } from '@/types/province.types';

interface CreateComprehensiveUserFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

interface ParentLinkFieldProps {
  label: string;
  selectedParentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  options: InstituteParent[];
  loading: boolean;
}

type UserType = 'USER' | 'USER_WITHOUT_PARENT' | 'USER_WITHOUT_STUDENT';
type BloodGroup = 'A_POSITIVE' | 'A_NEGATIVE' | 'B_POSITIVE' | 'B_NEGATIVE' | 'O_POSITIVE' | 'O_NEGATIVE' | 'AB_POSITIVE' | 'AB_NEGATIVE';

const CreateComprehensiveUserForm = ({
  onSubmit,
  onCancel
}: CreateComprehensiveUserFormProps) => {
  const { currentInstituteId } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [userType, setUserType] = useState<UserType>('USER');
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Basic user data
  const [formData, setFormData] = useState({
    nameWithInitials: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    gender: '',
    dateOfBirth: '',
    nic: '',
    birthCertificateNo: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    district: '',
    province: '',
    postalCode: '',
    country: 'Sri Lanka',
    idUrl: '',
    isActive: true
  });

  // Student data
  const [studentData, setStudentData] = useState({
    studentId: '',
    emergencyContact: '',
    medicalConditions: '',
    allergies: '',
    bloodGroup: '' as BloodGroup | '',
    fatherId: '',
    fatherPhoneNumber: '',
    motherId: '',
    motherPhoneNumber: '',
    guardianId: '',
    guardianPhoneNumber: ''
  });

  // Parent data
  const [parentData, setParentData] = useState({
    occupation: '',
    workplace: '',
    workPhone: '',
    educationLevel: ''
  });
  const [availableParents, setAvailableParents] = useState<InstituteParent[]>([]);
  const [isLoadingParents, setIsLoadingParents] = useState(false);
  const [fatherOpen, setFatherOpen] = useState(false);
  const [motherOpen, setMotherOpen] = useState(false);
  const [guardianOpen, setGuardianOpen] = useState(false);

  const handleInputChange = (field: string, value: any) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));

    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleStudentDataChange = (field: string, value: any) => {
    setStudentData(prev => ({ ...prev, [field]: value }));
  };

  const handleParentDataChange = (field: string, value: any) => {
    setParentData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!currentInstituteId) {
      setAvailableParents([]);
      return;
    }

    const loadParents = async () => {
      setIsLoadingParents(true);
      try {
        const response = await parentsApi.getInstituteParents(currentInstituteId, {
          page: 1,
          limit: 500,
        });
        const parents = Array.isArray(response?.data) ? response.data : [];
        setAvailableParents(parents);
      } catch {
        setAvailableParents([]);
      } finally {
        setIsLoadingParents(false);
      }
    };

    loadParents();
  }, [currentInstituteId]);

  const resolveSelectedParent = (id: string) =>
    availableParents.find((parent) => String(parent.id) === String(id));

  const handleParentLinkSelect = (
    relation: 'father' | 'mother' | 'guardian',
    parentId: string
  ) => {
    const selectedParent = resolveSelectedParent(parentId);
    if (!selectedParent) return;

    if (relation === 'father') {
      setStudentData((prev) => ({
        ...prev,
        fatherId: String(selectedParent.id),
        fatherPhoneNumber: selectedParent.phoneNumber || prev.fatherPhoneNumber,
      }));
      setFatherOpen(false);
      return;
    }

    if (relation === 'mother') {
      setStudentData((prev) => ({
        ...prev,
        motherId: String(selectedParent.id),
        motherPhoneNumber: selectedParent.phoneNumber || prev.motherPhoneNumber,
      }));
      setMotherOpen(false);
      return;
    }

    setStudentData((prev) => ({
      ...prev,
      guardianId: String(selectedParent.id),
      guardianPhoneNumber: selectedParent.phoneNumber || prev.guardianPhoneNumber,
    }));
    setGuardianOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
        const errors: Record<string, string> = {};
    if (!formData.nameWithInitials) errors.nameWithInitials = 'Name With Initials is required';
    if (!formData.firstName) errors.firstName = 'First Name is required';
    if (!formData.lastName) errors.lastName = 'Last Name is required';

    if (!formData.dateOfBirth) errors.dateOfBirth = 'Date Of Birth is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      let idDocumentRelativePath = '';
      const profileImageRelativePath = profileImageUrl;

      if (idFile) {
        sonnerToast.info('Uploading ID document...');
        const folder = detectFolder(idFile, 'id-document');
        const signedUrlData = await getSignedUrl(folder, idFile.name, idFile.type, idFile.size);
        await uploadToSignedUrl(signedUrlData.uploadUrl, idFile, signedUrlData.fields);
        idDocumentRelativePath = signedUrlData.relativePath;
        sonnerToast.success('ID document uploaded');
      }

      const payload: any = {
        nameWithInitials: formData.nameWithInitials,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        phone: formData.phoneNumber,
        userType,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        isActive: formData.isActive
      };

      if (formData.nic) payload.nic = formData.nic;
      if (formData.birthCertificateNo) payload.birthCertificateNo = formData.birthCertificateNo;
      if (formData.addressLine1) payload.addressLine1 = formData.addressLine1;
      if (formData.addressLine2) payload.addressLine2 = formData.addressLine2;
      if (formData.city) payload.city = formData.city;
      if (formData.district) payload.district = formData.district;
      if (formData.province) payload.province = formData.province;
      if (formData.postalCode) payload.postalCode = formData.postalCode;
      if (formData.country) payload.country = formData.country;
      if (profileImageRelativePath) payload.imageUrl = profileImageRelativePath;
      if (idDocumentRelativePath) payload.idUrl = idDocumentRelativePath;

      if (userType === 'USER' || userType === 'USER_WITHOUT_PARENT') {
        payload.studentData = {
          studentId: studentData.studentId || undefined,
          emergencyContact: studentData.emergencyContact || undefined,
          medicalConditions: studentData.medicalConditions || undefined,
          allergies: studentData.allergies || undefined,
          bloodGroup: studentData.bloodGroup || undefined,
          fatherId: studentData.fatherId ? Number(String(studentData.fatherId)) : undefined,
          fatherPhoneNumber: studentData.fatherPhoneNumber || undefined,
          motherId: studentData.motherId ? Number(String(studentData.motherId)) : undefined,
          motherPhoneNumber: studentData.motherPhoneNumber || undefined,
          guardianId: studentData.guardianId ? Number(String(studentData.guardianId)) : undefined,
          guardianPhoneNumber: studentData.guardianPhoneNumber || undefined
        };
      }

      if (userType === 'USER' || userType === 'USER_WITHOUT_STUDENT') {
        payload.parentData = {
          occupation: parentData.occupation || undefined,
          workplace: parentData.workplace || undefined,
          workPhone: parentData.workPhone || undefined,
          educationLevel: parentData.educationLevel || undefined
        };
      }

      const response = await apiClient.post('/users/comprehensive', payload);
      toast({
        title: "Success",
        description: response.message || "User created successfully!"
      });
      onSubmit(response);
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error, 'Failed to create user'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const showStudentData = userType === 'USER' || userType === 'USER_WITHOUT_PARENT';
  const showParentData = userType === 'USER' || userType === 'USER_WITHOUT_STUDENT';

  const [occupationOpen, setOccupationOpen] = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [provinceOpen, setProvinceOpen] = useState(false);

  const occupationOptions = useMemo(() => Object.values(Occupation).map(value => ({
    value,
    label: value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  })), []);

  const districtOptions = useMemo(() => Object.values(District).map(value => ({
    value,
    label: value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  })), []);

  const provinceOptions = useMemo(() => Object.values(Province).map(value => ({
    value,
    label: value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  })), []);

  const ParentLinkField = ({
    label,
    selectedParentId,
    open,
    onOpenChange,
    onSelect,
    options,
    loading,
  }: ParentLinkFieldProps) => {
    const selectedParent = options.find((option) => String(option.id) === String(selectedParentId));
    const selectedName = selectedParent?.name || 'Select parent user';

    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{label} (Link Existing Parent)</Label>
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full h-10 sm:h-9 justify-between font-normal text-left">
              <span className="truncate">{loading ? 'Loading parents...' : selectedName}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover z-50" align="start">
            <Command>
              <CommandInput placeholder="Search parent name/phone..." />
              <CommandList className="max-h-[220px]">
                <CommandEmpty>{loading ? 'Loading parents...' : 'No parent found.'}</CommandEmpty>
                <CommandGroup>
                  {options.map((parent) => (
                    <CommandItem
                      key={parent.id}
                      value={`${parent.name} ${parent.phoneNumber || ''} ${parent.userIdByInstitute || ''}`}
                      onSelect={() => onSelect(String(parent.id))}
                    >
                      <Check className={cn('mr-2 h-4 w-4', String(selectedParentId) === String(parent.id) ? 'opacity-100' : 'opacity-0')} />
                      <div className="flex flex-col">
                        <span>{parent.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {parent.phoneNumber || 'No phone'}
                          {parent.userIdByInstitute ? ` • ${parent.userIdByInstitute}` : ''}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  return (
    <Dialog open={true} onOpenChange={() => onCancel()} routeName="create-comprehensive-user-form-popup">
      <DialogContent className="w-full sm:w-[95vw] sm:max-w-2xl max-h-[95vh] overflow-hidden flex flex-col p-3 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg sm:text-xl text-center">Create New User</DialogTitle>
          <p className="text-xs sm:text-sm text-muted-foreground text-center">Fill in the details to create a user profile</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <form id="comprehensive-user-form" onSubmit={handleSubmit} className="space-y-5 py-2">
            
            {/* User Type Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">User Type *</Label>
              <Select value={userType} onValueChange={(value: UserType) => setUserType(value)}>
                <SelectTrigger 
                  className="h-10 sm:h-9 text-white border-primary [&>svg]:text-white [&>svg]:opacity-100"
                  style={{ backgroundColor: 'hsl(var(--primary))' }}
                >
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem 
                    value="USER" 
                    className="text-muted-foreground focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">USER</span>
                      <span className="text-xs opacity-70">(InstituteAdmin, Teacher, AttendanceMarker, Student, Parent)</span>
                    </div>
                  </SelectItem>
                  <SelectItem 
                    value="USER_WITHOUT_STUDENT" 
                    className="text-muted-foreground focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">USER_WITHOUT_STUDENT</span>
                      <span className="text-xs opacity-70">(InstituteAdmin, Teacher, AttendanceMarker, Parent)</span>
                    </div>
                  </SelectItem>
                  <SelectItem 
                    value="USER_WITHOUT_PARENT" 
                    className="text-muted-foreground focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">USER_WITHOUT_PARENT</span>
                      <span className="text-xs opacity-70">(InstituteAdmin, Teacher, AttendanceMarker, Student)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Profile Image */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Profile Photo</Label>
              <PassportImageCropUpload
                currentImageUrl={profileImageUrl || null}
                onImageUpdate={(url) => setProfileImageUrl(url)}
                folder="profile-images"
                label=""
                showCamera={true}
              />
            </div>

            {/* Personal Information */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-primary-foreground bg-primary px-3 py-2 rounded-md">Personal Information</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="col-span-1 sm:col-span-2 space-y-1.5">
                  <Label className="text-sm">Name with Initials *</Label>
                  <Input
                    value={formData.nameWithInitials}
                    onChange={e => handleInputChange('nameWithInitials', e.target.value)}
                    placeholder="e.g., J. Doe"
                    required
                    className={`h-10 sm:h-9${fieldErrors.nameWithInitials ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  />

                  {fieldErrors.nameWithInitials && <p className="text-xs text-red-500 mt-1">{fieldErrors.nameWithInitials}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">First Name *</Label>
                  <Input
                    value={formData.firstName}
                    onChange={e => handleInputChange('firstName', e.target.value)}
                    placeholder="Enter first name"
                    required
                    className={`h-10 sm:h-9${fieldErrors.firstName ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  />

                  {fieldErrors.firstName && <p className="text-xs text-red-500 mt-1">{fieldErrors.firstName}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Last Name *</Label>
                  <Input
                    value={formData.lastName}
                    onChange={e => handleInputChange('lastName', e.target.value)}
                    placeholder="Enter last name"
                    required
                    className={`h-10 sm:h-9${fieldErrors.lastName ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  />

                  {fieldErrors.lastName && <p className="text-xs text-red-500 mt-1">{fieldErrors.lastName}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={e => handleInputChange('email', e.target.value)}
                    placeholder="Optional - for user login"
                    className={`h-10 sm:h-9${fieldErrors.email ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  />

                  {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Phone Number</Label>
                  <Input
                    value={formData.phoneNumber}
                    onChange={e => handleInputChange('phoneNumber', e.target.value)}
                    placeholder="Optional"
                    className={`h-10 sm:h-9${fieldErrors.phoneNumber ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  />

                  {fieldErrors.phoneNumber && <p className="text-xs text-red-500 mt-1">{fieldErrors.phoneNumber}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Gender *</Label>
                  <Select value={formData.gender} onValueChange={value => handleInputChange('gender', value)}>
                    <SelectTrigger className="h-10 sm:h-9">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Date of Birth *</Label>
                  <Input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={e => handleInputChange('dateOfBirth', e.target.value)}
                    required
                    className={`h-10 sm:h-9${fieldErrors.dateOfBirth ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  />

                  {fieldErrors.dateOfBirth && <p className="text-xs text-red-500 mt-1">{fieldErrors.dateOfBirth}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">NIC Number</Label>
                  <Input
                    value={formData.nic}
                    onChange={e => handleInputChange('nic', e.target.value)}
                    placeholder="National ID number"
                    className="h-10 sm:h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Birth Certificate No</Label>
                  <Input
                    value={formData.birthCertificateNo}
                    onChange={e => handleInputChange('birthCertificateNo', e.target.value)}
                    placeholder="Birth certificate number"
                    className="h-10 sm:h-9"
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-primary-foreground bg-primary px-3 py-2 rounded-md">Address Details</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="col-span-1 sm:col-span-2 space-y-1.5">
                  <Label className="text-sm">Address Line 1</Label>
                  <Input
                    value={formData.addressLine1}
                    onChange={e => handleInputChange('addressLine1', e.target.value)}
                    placeholder="Street address, area, landmark"
                    className="h-10 sm:h-9"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2 space-y-1.5">
                  <Label className="text-sm">Address Line 2</Label>
                  <Input
                    value={formData.addressLine2}
                    onChange={e => handleInputChange('addressLine2', e.target.value)}
                    placeholder="Apartment, floor, unit, or additional details"
                    className="h-10 sm:h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">City</Label>
                  <Input
                    value={formData.city}
                    onChange={e => handleInputChange('city', e.target.value)}
                    placeholder="City name"
                    className="h-10 sm:h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">District</Label>
                  <Popover open={districtOpen} onOpenChange={setDistrictOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-10 sm:h-9 justify-between font-normal text-left">
                        <span className="truncate">{formData.district ? districtOptions.find(d => d.value === formData.district)?.label : "Select district"}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover z-50" align="start">
                      <Command>
                        <CommandInput placeholder="Search district..." />
                        <CommandList className="max-h-[200px]">
                          <CommandEmpty>No district found.</CommandEmpty>
                          <CommandGroup>
                            {districtOptions.map(district => (
                              <CommandItem
                                key={district.value}
                                value={district.label}
                                onSelect={() => {
                                  handleInputChange('district', district.value);
                                  setDistrictOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", formData.district === district.value ? "opacity-100" : "opacity-0")} />
                                {district.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Province</Label>
                  <Popover open={provinceOpen} onOpenChange={setProvinceOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-10 sm:h-9 justify-between font-normal text-left">
                        <span className="truncate">{formData.province ? provinceOptions.find(p => p.value === formData.province)?.label : "Select province"}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover z-50" align="start">
                      <Command>
                        <CommandInput placeholder="Search province..." />
                        <CommandList className="max-h-[200px]">
                          <CommandEmpty>No province found.</CommandEmpty>
                          <CommandGroup>
                            {provinceOptions.map(province => (
                              <CommandItem
                                key={province.value}
                                value={province.label}
                                onSelect={() => {
                                  handleInputChange('province', province.value);
                                  setProvinceOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", formData.province === province.value ? "opacity-100" : "opacity-0")} />
                                {province.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Postal Code</Label>
                  <Input
                    value={formData.postalCode}
                    onChange={e => handleInputChange('postalCode', e.target.value)}
                    placeholder="Postal/ZIP code"
                    className="h-10 sm:h-9"
                  />
                </div>
              </div>
            </div>

            {/* Student Information */}
            {showStudentData && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-primary-foreground bg-primary px-3 py-2 rounded-md">Student Information</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Emergency Contact</Label>
                    <Input
                      value={studentData.emergencyContact}
                      onChange={e => handleStudentDataChange('emergencyContact', e.target.value)}
                      placeholder="+94XXXXXXXXX"
                      className="h-10 sm:h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Blood Group</Label>
                    <Select value={studentData.bloodGroup} onValueChange={value => handleStudentDataChange('bloodGroup', value)}>
                      <SelectTrigger className="h-10 sm:h-9">
                        <SelectValue placeholder="Select blood group" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="A_POSITIVE">A+</SelectItem>
                        <SelectItem value="A_NEGATIVE">A-</SelectItem>
                        <SelectItem value="B_POSITIVE">B+</SelectItem>
                        <SelectItem value="B_NEGATIVE">B-</SelectItem>
                        <SelectItem value="O_POSITIVE">O+</SelectItem>
                        <SelectItem value="O_NEGATIVE">O-</SelectItem>
                        <SelectItem value="AB_POSITIVE">AB+</SelectItem>
                        <SelectItem value="AB_NEGATIVE">AB-</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Medical Conditions</Label>
                    <Input
                      value={studentData.medicalConditions}
                      onChange={e => handleStudentDataChange('medicalConditions', e.target.value)}
                      placeholder="None or specify conditions"
                      className="h-10 sm:h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Allergies</Label>
                    <Input
                      value={studentData.allergies}
                      onChange={e => handleStudentDataChange('allergies', e.target.value)}
                      placeholder="None or specify allergies"
                      className="h-10 sm:h-9"
                    />
                  </div>

                  <ParentLinkField
                    label="Father"
                    selectedParentId={studentData.fatherId}
                    open={fatherOpen}
                    onOpenChange={setFatherOpen}
                    onSelect={(id) => handleParentLinkSelect('father', id)}
                    options={availableParents}
                    loading={isLoadingParents}
                  />

                  <ParentLinkField
                    label="Mother"
                    selectedParentId={studentData.motherId}
                    open={motherOpen}
                    onOpenChange={setMotherOpen}
                    onSelect={(id) => handleParentLinkSelect('mother', id)}
                    options={availableParents}
                    loading={isLoadingParents}
                  />

                  <ParentLinkField
                    label="Guardian"
                    selectedParentId={studentData.guardianId}
                    open={guardianOpen}
                    onOpenChange={setGuardianOpen}
                    onSelect={(id) => handleParentLinkSelect('guardian', id)}
                    options={availableParents}
                    loading={isLoadingParents}
                  />

                  <div className="space-y-1.5">
                    <Label className="text-sm">Father's Phone</Label>
                    <Input
                      value={studentData.fatherPhoneNumber}
                      onChange={e => handleStudentDataChange('fatherPhoneNumber', e.target.value)}
                      placeholder="+94XXXXXXXXX"
                      className="h-10 sm:h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Mother's Phone</Label>
                    <Input
                      value={studentData.motherPhoneNumber}
                      onChange={e => handleStudentDataChange('motherPhoneNumber', e.target.value)}
                      placeholder="+94XXXXXXXXX"
                      className="h-10 sm:h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Guardian's Phone</Label>
                    <Input
                      value={studentData.guardianPhoneNumber}
                      onChange={e => handleStudentDataChange('guardianPhoneNumber', e.target.value)}
                      placeholder="+94XXXXXXXXX"
                      className="h-10 sm:h-9"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Parent Information */}
            {showParentData && (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-primary-foreground bg-primary px-3 py-2 rounded-md">Parent Information</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="col-span-1 sm:col-span-2 space-y-1.5">
                    <Label className="text-sm">Occupation</Label>
                    <Popover open={occupationOpen} onOpenChange={setOccupationOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-10 sm:h-9 justify-between font-normal text-left">
                          <span className="truncate">{parentData.occupation ? occupationOptions.find(o => o.value === parentData.occupation)?.label : "Select occupation"}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover z-50" align="start">
                        <Command>
                          <CommandInput placeholder="Search occupation..." />
                          <CommandList className="max-h-[200px]">
                            <CommandEmpty>No occupation found.</CommandEmpty>
                            <CommandGroup>
                              {occupationOptions.map(occ => (
                                <CommandItem
                                  key={occ.value}
                                  value={occ.label}
                                  onSelect={() => {
                                    handleParentDataChange('occupation', occ.value);
                                    setOccupationOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", parentData.occupation === occ.value ? "opacity-100" : "opacity-0")} />
                                  {occ.label}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Workplace</Label>
                    <Input
                      value={parentData.workplace}
                      onChange={e => handleParentDataChange('workplace', e.target.value)}
                      placeholder="Company or workplace name"
                      className="h-10 sm:h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Work Phone</Label>
                    <Input
                      value={parentData.workPhone}
                      onChange={e => handleParentDataChange('workPhone', e.target.value)}
                      placeholder="+94XXXXXXXXX"
                      className="h-10 sm:h-9"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-2 space-y-1.5">
                    <Label className="text-sm">Education Level</Label>
                    <Select value={parentData.educationLevel} onValueChange={value => handleParentDataChange('educationLevel', value)}>
                      <SelectTrigger className="h-10 sm:h-9">
                        <SelectValue placeholder="Select education level" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="PRIMARY">Primary Education</SelectItem>
                        <SelectItem value="SECONDARY">Secondary Education (O/L)</SelectItem>
                        <SelectItem value="HIGHER_SECONDARY">Higher Secondary (A/L)</SelectItem>
                        <SelectItem value="DIPLOMA">Diploma</SelectItem>
                        <SelectItem value="BACHELORS">Bachelor's Degree</SelectItem>
                        <SelectItem value="MASTERS">Master's Degree</SelectItem>
                        <SelectItem value="PHD">PhD / Doctorate</SelectItem>
                        <SelectItem value="PROFESSIONAL">Professional Qualification</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto h-10 sm:h-9">
            Cancel
          </Button>
          <Button type="submit" form="comprehensive-user-form" disabled={isLoading} className="w-full sm:w-auto h-10 sm:h-9">
            {isLoading ? 'Creating...' : 'Create User'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateComprehensiveUserForm;
