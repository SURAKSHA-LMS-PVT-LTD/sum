import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CalendarIcon, Eye, Upload, Search, CheckCircle, X, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { studentsApi, StudentCreateData } from '@/api/students.api';
import { usersApi, BasicUser } from '@/api/users.api';
import { apiClient } from '@/api/client';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { getBaseUrl, getApiHeadersAsync } from '@/contexts/utils/auth.api';
import { getErrorMessage } from '@/api/apiError';
interface CreateInstituteStudentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
const CreateInstituteStudentForm: React.FC<CreateInstituteStudentFormProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  // Parent verification state
  const [parentSearch, setParentSearch] = useState<Record<string, string>>({
    father: '', mother: '', guardian: ''
  });
  const [parentSearchType, setParentSearchType] = useState<Record<string, 'phone' | 'email' | 'id'>>({
    father: 'phone', mother: 'phone', guardian: 'phone'
  });
  const [parentPreview, setParentPreview] = useState<Record<string, BasicUser | null>>({
    father: null, mother: null, guardian: null
  });
  const [parentVerified, setParentVerified] = useState<Record<string, boolean>>({
    father: false, mother: false, guardian: false
  });
  const [parentSearchLoading, setParentSearchLoading] = useState<Record<string, boolean>>({
    father: false, mother: false, guardian: false
  });
  const [formData, setFormData] = useState({
    // User data
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    nic: '',
    birthCertificateNo: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    district: '',
    province: '',
    postalCode: '',
    country: '',
    // Parent IDs
    fatherId: '',
    motherId: '',
    guardianId: '',
    // Notification delivery preference
    notificationDeliveryTo: '' as '' | 'father' | 'mother' | 'guardian',
    // Student data
    studentId: '',
    emergencyContact: '',
    medicalConditions: '',
    allergies: '',
    bloodGroup: ''
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const handleInputChange = (field: string, value: string) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSearchParent = async (role: string) => {
    const searchValue = parentSearch[role]?.trim();
    const searchType = parentSearchType[role];
    if (!searchValue) {
      toast({
        title: "Missing Input",
        description: `Please enter a ${searchType} to search`,
        variant: "destructive",
      });
      return;
    }

    setParentSearchLoading(prev => ({ ...prev, [role]: true }));
    try {
      let user: BasicUser;
      if (searchType === 'phone') {
        user = await apiClient.get(`/users/basic/phone/${searchValue}`);
      } else if (searchType === 'email') {
        user = await apiClient.get(`/users/basic/email/${searchValue}`);
      } else {
        user = await usersApi.getBasicInfo(searchValue);
      }
      setParentPreview(prev => ({ ...prev, [role]: user }));
      setParentVerified(prev => ({ ...prev, [role]: false }));
    } catch (error: any) {
      toast({
        title: "Not Found",
        description: getErrorMessage(error, `No user found with this ${searchType}`),
        variant: "destructive",
      });
      setParentPreview(prev => ({ ...prev, [role]: null }));
      setParentVerified(prev => ({ ...prev, [role]: false }));
    } finally {
      setParentSearchLoading(prev => ({ ...prev, [role]: false }));
    }
  };

  const handleAcceptParent = (role: string) => {
    const user = parentPreview[role];
    if (!user) return;
    const field = role === 'father' ? 'fatherId' : role === 'mother' ? 'motherId' : 'guardianId';
    setFormData(prev => {
      const updated = { ...prev, [field]: user.id };
      // Auto-set notification delivery if this is the only linked parent
      const linkedCount = [updated.fatherId, updated.motherId, updated.guardianId].filter(Boolean).length;
      if (linkedCount === 1) {
        updated.notificationDeliveryTo = role as 'father' | 'mother' | 'guardian';
      }
      return updated;
    });
    setParentVerified(prev => ({ ...prev, [role]: true }));
    toast({
      title: "Parent Accepted",
      description: `${user.fullName} has been linked as ${role}`,
    });
  };

  const handleRemoveParent = (role: string) => {
    const field = role === 'father' ? 'fatherId' : role === 'mother' ? 'motherId' : 'guardianId';
    setFormData(prev => {
      const updated = { ...prev, [field]: '' };
      // Clear notification delivery if this parent was selected
      if (prev.notificationDeliveryTo === role) {
        updated.notificationDeliveryTo = '' as '' | 'father' | 'mother' | 'guardian';
      }
      // Auto-set to remaining parent if only one left
      const remaining = (['father', 'mother', 'guardian'] as const).filter(r => {
        const f = r === 'father' ? 'fatherId' : r === 'mother' ? 'motherId' : 'guardianId';
        return !!updated[f];
      });
      if (remaining.length === 1) {
        updated.notificationDeliveryTo = remaining[0];
      }
      return updated;
    });
    setParentPreview(prev => ({ ...prev, [role]: null }));
    setParentVerified(prev => ({ ...prev, [role]: false }));
    setParentSearch(prev => ({ ...prev, [role]: '' }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dateOfBirth) {
      toast({
        title: "Error",
        description: "Please select a date of birth",
        variant: "destructive"
      });
      return;
    }

    const hasContactInfo = !!(formData.email?.trim() || formData.phone?.trim());
    const hasParent = !!(formData.fatherId || formData.motherId || formData.guardianId);

    // If no phone and no email, at least one parent must be assigned
    if (!hasContactInfo && !hasParent) {
      toast({
        title: "Parent Required",
        description: "When no email or phone number is provided, at least one parent must be assigned to receive notifications.",
        variant: "destructive"
      });
      return;
    }

    // If no contact info and multiple parents linked, must select notification delivery target
    const linkedParentCount = [formData.fatherId, formData.motherId, formData.guardianId].filter(Boolean).length;
    if (!hasContactInfo && linkedParentCount > 1 && !formData.notificationDeliveryTo) {
      toast({
        title: "Select Notification Recipient",
        description: "Please select which parent should receive notifications for this student.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const studentData: StudentCreateData = {
        user: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          userType: 'STUDENT',
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          nic: formData.nic || undefined,
          birthCertificateNo: formData.birthCertificateNo || undefined,
          addressLine1: formData.addressLine1 || undefined,
          addressLine2: formData.addressLine2 || undefined,
          city: formData.city || undefined,
          district: formData.district || undefined,
          province: formData.province || undefined,
          postalCode: formData.postalCode || undefined,
          country: formData.country || undefined,
          isActive: false
        },
        fatherId: formData.fatherId || null,
        motherId: formData.motherId || null,
        guardianId: formData.guardianId || null,
        studentId: formData.studentId,
        emergencyContact: formData.emergencyContact,
        medicalConditions: formData.medicalConditions || undefined,
        allergies: formData.allergies || undefined,
        bloodGroup: formData.bloodGroup || undefined,
        isActive: false
      };
      const newStudent = await studentsApi.create(studentData);
      
      // If image is selected, upload it using signed URL
      if (selectedImage && newStudent.userId) {
        try {
          const { uploadWithSignedUrl } = await import('@/utils/signedUploadHelper');
          
          // Step 1: Upload to S3 using signed URL
          const relativePath = await uploadWithSignedUrl(
            selectedImage,
            'student-images'
          );
          
          // Step 2: Update student with relativePath
          const headers = await getApiHeadersAsync();
          const imageResponse = await fetch(`${getBaseUrl()}/students/${newStudent.userId}/image-url`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ imageUrl: relativePath })
          });
          
          if (!imageResponse.ok) {
            console.error('Failed to update student image URL');
            toast({
              title: "Warning",
              description: "Student created but image upload failed",
              variant: "destructive"
            });
          }
        } catch (imageError) {
          console.error('Error uploading student image:', imageError);
        }
      }
      
      toast({
        title: "Success",
        description: "Student created successfully!"
      });

      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        nic: '',
        birthCertificateNo: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        district: '',
        province: '',
        postalCode: '',
        country: '',
        fatherId: '',
        motherId: '',
        guardianId: '',
        notificationDeliveryTo: '' as '' | 'father' | 'mother' | 'guardian',
        studentId: '',
        emergencyContact: '',
        medicalConditions: '',
        allergies: '',
        bloodGroup: ''
      });
      setSelectedImage(null);
      setParentSearch({ father: '', mother: '', guardian: '' });
      setParentPreview({ father: null, mother: null, guardian: null });
      setParentVerified({ father: false, mother: false, guardian: false });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating student:', error);
      toast({
        title: "Error",
        description: "Failed to create student. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Student</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Personal Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" value={formData.firstName} onChange={e => handleInputChange('firstName', e.target.value)} required
              className={`${fieldErrors.firstName ? 'border-red-500 focus-visible:ring-red-500' : ''}`} />
 {fieldErrors.firstName && <p className="text-xs text-red-500 mt-1">{fieldErrors.firstName}</p>}
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" value={formData.lastName} onChange={e => handleInputChange('lastName', e.target.value)} required
              className={`${fieldErrors.lastName ? 'border-red-500 focus-visible:ring-red-500' : ''}`} />
 {fieldErrors.lastName && <p className="text-xs text-red-500 mt-1">{fieldErrors.lastName}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={e => handleInputChange('email', e.target.value)} 
                  className="h-16 text-lg"
                  placeholder="Optional - for student login"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input 
                  id="phone" 
                  value={formData.phone} 
                  onChange={e => handleInputChange('phone', e.target.value)} 
                  className="h-16 text-lg"
                  placeholder="Optional"
                />
              </div>

              <div>
                <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                <div className="relative">
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    className={`h-16 text-lg${fieldErrors.dateOfBirth ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                    placeholder="mm/dd/yyyy"
                    required
                  />

                  {fieldErrors.dateOfBirth && <p className="text-xs text-red-500 mt-1">{fieldErrors.dateOfBirth}</p>}
                  <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <Label htmlFor="gender">Gender *</Label>
                <Select value={formData.gender} onValueChange={value => handleInputChange('gender', value)}>
                  <SelectTrigger className="h-16 text-lg">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="nic">NIC</Label>
                <Input 
                  id="nic" 
                  value={formData.nic} 
                  onChange={e => handleInputChange('nic', e.target.value)} 
                  className="h-16 text-lg"
                />
              </div>

              <div>
                <Label htmlFor="birthCertificateNo">Birth Certificate No</Label>
                <Input 
                  id="birthCertificateNo" 
                  value={formData.birthCertificateNo} 
                  onChange={e => handleInputChange('birthCertificateNo', e.target.value)} 
                  className="h-16 text-lg"
                />
              </div>
              
              <div>
                <Label htmlFor="studentImage">Student Image</Label>
                <div className="space-y-2">
                  <Input
                    id="studentImage"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                    className="h-16 text-lg"
                  />
                  {selectedImage && (
                    <span className="text-xs text-muted-foreground">
                      Selected: {selectedImage.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Address & Student Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Address Information</h3>
              
              <div>
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input 
                  id="addressLine1" 
                  value={formData.addressLine1} 
                  onChange={e => handleInputChange('addressLine1', e.target.value)} 
                  className="h-16 text-lg"
                />
              </div>

              <div>
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input 
                  id="addressLine2" 
                  value={formData.addressLine2} 
                  onChange={e => handleInputChange('addressLine2', e.target.value)} 
                  className="h-16 text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input 
                    id="city" 
                    value={formData.city} 
                    onChange={e => handleInputChange('city', e.target.value)} 
                    className="h-16 text-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="district">District</Label>
                  <Input 
                    id="district" 
                    value={formData.district} 
                    onChange={e => handleInputChange('district', e.target.value)} 
                    className="h-16 text-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="province">Province</Label>
                  <Input 
                    id="province" 
                    value={formData.province} 
                    onChange={e => handleInputChange('province', e.target.value)} 
                    className="h-16 text-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input 
                    id="postalCode" 
                    value={formData.postalCode} 
                    onChange={e => handleInputChange('postalCode', e.target.value)} 
                    className="h-16 text-lg"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="country">Country</Label>
                <Input 
                  id="country" 
                  value={formData.country} 
                  onChange={e => handleInputChange('country', e.target.value)} 
                  className="h-16 text-lg"
                />
              </div>

              <h3 className="text-lg font-semibold mt-6">Parent Information</h3>
              
              {(['father', 'mother', 'guardian'] as const).map((role) => (
                <div key={role} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium capitalize">{role}</Label>
                    {parentVerified[role] && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" /> Verified
                      </Badge>
                    )}
                  </div>

                  {parentVerified[role] && parentPreview[role] ? (
                    // Show accepted parent summary
                    <div className="flex items-center gap-3 bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={parentPreview[role]!.imageUrl} alt={parentPreview[role]!.fullName} />
                        <AvatarFallback>{parentPreview[role]!.fullName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{parentPreview[role]!.fullName}</p>
                        <p className="text-xs text-muted-foreground">ID: {parentPreview[role]!.id}</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveParent(role)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Search type selector + input */}
                      <div className="flex gap-2">
                        <Select
                          value={parentSearchType[role]}
                          onValueChange={(v) => setParentSearchType(prev => ({ ...prev, [role]: v as 'phone' | 'email' | 'id' }))}
                        >
                          <SelectTrigger className="w-28 h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="id">User ID</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={parentSearch[role]}
                          onChange={(e) => setParentSearch(prev => ({ ...prev, [role]: e.target.value }))}
                          placeholder={
                            parentSearchType[role] === 'phone' ? '+94771234567' :
                            parentSearchType[role] === 'email' ? 'parent@email.com' :
                            'Enter user ID'
                          }
                          className="h-12 flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 px-4"
                          onClick={() => handleSearchParent(role)}
                          disabled={parentSearchLoading[role] || !parentSearch[role]?.trim()}
                        >
                          {parentSearchLoading[role] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {/* Parent preview card with accept button */}
                      {parentPreview[role] && !parentVerified[role] && (
                        <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-14 w-14">
                              <AvatarImage src={parentPreview[role]!.imageUrl} alt={parentPreview[role]!.fullName} />
                              <AvatarFallback>{parentPreview[role]!.fullName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-lg">{parentPreview[role]!.fullName}</p>
                              <Badge variant="outline" className="mt-1">{parentPreview[role]!.userType}</Badge>
                              <p className="text-xs text-muted-foreground mt-1">ID: {parentPreview[role]!.id}</p>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Is this the correct {role} of the student? Please verify before accepting.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={() => handleAcceptParent(role)}
                              className="flex-1"
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Accept as {role.charAt(0).toUpperCase() + role.slice(1)}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setParentPreview(prev => ({ ...prev, [role]: null }))}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}

              {/* Notice: parent required when no contact info */}
              {!formData.email?.trim() && !formData.phone?.trim() && (
                <div className={`rounded-lg p-4 text-sm ${
                  formData.fatherId || formData.motherId || formData.guardianId
                    ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                    : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                }`}>
                  {formData.fatherId || formData.motherId || formData.guardianId ? (
                    <p>No email or phone provided. Notifications will be delivered to the assigned parent(s).</p>
                  ) : (
                    <p className="font-medium">⚠ No email or phone number provided. You must assign at least one parent so they can receive notifications for this student.</p>
                  )}
                </div>
              )}

              {/* Notification delivery selector - when no direct contact and multiple parents linked */}
              {!formData.email?.trim() && !formData.phone?.trim() && 
               [formData.fatherId, formData.motherId, formData.guardianId].filter(Boolean).length > 1 && (
                <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                  <Label className="text-base font-semibold">Deliver Notifications To *</Label>
                  <p className="text-sm text-muted-foreground">
                    Multiple parents are linked. Select who should primarily receive SMS and push notifications.
                  </p>
                  <Select 
                    value={formData.notificationDeliveryTo} 
                    onValueChange={value => handleInputChange('notificationDeliveryTo', value)}
                  >
                    <SelectTrigger className="h-14 text-base">
                      <SelectValue placeholder="Select parent for notifications" />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.fatherId && parentPreview.father && (
                        <SelectItem value="father">Father — {parentPreview.father.fullName}</SelectItem>
                      )}
                      {formData.motherId && parentPreview.mother && (
                        <SelectItem value="mother">Mother — {parentPreview.mother.fullName}</SelectItem>
                      )}
                      {formData.guardianId && parentPreview.guardian && (
                        <SelectItem value="guardian">Guardian — {parentPreview.guardian.fullName}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <h3 className="text-lg font-semibold mt-6">Student Information</h3>
              
              <div>
                <Label htmlFor="studentId">Student ID *</Label>
                <Input 
                  id="studentId" 
                  value={formData.studentId} 
                  onChange={e => handleInputChange('studentId', e.target.value)} 
                  className={`h-16 text-lg${fieldErrors.studentId ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required 
                />
 
                {fieldErrors.studentId && <p className="text-xs text-red-500 mt-1">{fieldErrors.studentId}</p>}
              </div>

              <div>
                <Label htmlFor="emergencyContact">Emergency Contact *</Label>
                <Input 
                  id="emergencyContact" 
                  value={formData.emergencyContact} 
                  onChange={e => handleInputChange('emergencyContact', e.target.value)} 
                  className={`h-16 text-lg${fieldErrors.emergencyContact ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required 
                />
 
                {fieldErrors.emergencyContact && <p className="text-xs text-red-500 mt-1">{fieldErrors.emergencyContact}</p>}
              </div>

              <div>
                <Label htmlFor="bloodGroup">Blood Group</Label>
                <Select value={formData.bloodGroup} onValueChange={value => handleInputChange('bloodGroup', value)}>
                  <SelectTrigger className="h-16 text-lg">
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="medicalConditions">Medical Conditions</Label>
                <Textarea 
                  id="medicalConditions" 
                  value={formData.medicalConditions} 
                  onChange={e => handleInputChange('medicalConditions', e.target.value)} 
                  placeholder="Enter any medical conditions..." 
                  className="min-h-24 text-lg"
                />
              </div>

              <div>
                <Label htmlFor="allergies">Allergies</Label>
                <Textarea 
                  id="allergies" 
                  value={formData.allergies} 
                  onChange={e => handleInputChange('allergies', e.target.value)} 
                  placeholder="Enter any allergies..." 
                  className="min-h-24 text-lg"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="h-16 text-lg px-8">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="h-16 text-lg px-8">
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              Create Student
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>;
};
export default CreateInstituteStudentForm;