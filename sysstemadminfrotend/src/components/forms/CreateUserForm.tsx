import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { uploadFile } from "@/lib/upload";
import { UserType, Gender, District, Province, Occupation } from "@/lib/enums";
import { Loader2, Upload, X, User, Camera } from "lucide-react";

const bloodGroups = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"
] as const;

const userSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address").optional().or(z.literal('')),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").optional().or(z.literal('')),
  userType: z.nativeEnum(UserType),
  gender: z.nativeEnum(Gender),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  nic: z.string().optional(),
  birthCertificateNo: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  district: z.nativeEnum(District).optional(),
  province: z.nativeEnum(Province).optional(),
  postalCode: z.string().optional(),
  isActive: z.boolean().default(true),
  // Student data
  studentId: z.string().optional(),
  emergencyContact: z.string().optional(),
  medicalConditions: z.string().optional(),
  allergies: z.string().optional(),
  bloodGroup: z.enum(bloodGroups).optional(),
  fatherPhoneNumber: z.string().optional(),
  motherPhoneNumber: z.string().optional(),
  guardianPhoneNumber: z.string().optional(),
  // Parent data
  occupation: z.nativeEnum(Occupation).optional(),
  workplace: z.string().optional(),
  workPhone: z.string().optional(),
  educationLevel: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface CreateUserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateUserForm({ open, onOpenChange, onSuccess }: CreateUserFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idFileName, setIdFileName] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      userType: UserType.USER,
      gender: Gender.MALE,
      dateOfBirth: "",
      isActive: true,
    },
  });

  const userType = form.watch("userType");

  const showStudentData = userType === UserType.USER || userType === UserType.USER_WITHOUT_PARENT;
  const showParentData = userType === UserType.USER || userType === UserType.USER_WITHOUT_STUDENT;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error("Camera access denied:", error);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
            setImageFile(file);
            setImagePreview(canvas.toDataURL("image/jpeg"));
          }
        }, "image/jpeg", 0.9);
      }
      stopCamera();
    }
  };

  const handleIdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdFile(file);
      setIdFileName(file.name);
    }
  };

  const resetForm = () => {
    form.reset();
    setImageFile(null);
    setImagePreview(null);
    setIdFile(null);
    setIdFileName(null);
    stopCamera();
  };

  const onSubmit = async (data: UserFormData) => {
    try {
      setIsSubmitting(true);

      let imageUrl: string | undefined;
      let idUrl: string | undefined;

      if (imageFile) {
        const result = await uploadFile(imageFile, "profile-images");
        imageUrl = result.publicUrl || result.relativePath;
      }

      if (idFile) {
        const result = await uploadFile(idFile, "id-documents");
        idUrl = result.publicUrl || result.relativePath;
      }

      const requestBody: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        userType: data.userType,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
        nic: data.nic || undefined,
        birthCertificateNo: data.birthCertificateNo || undefined,
        addressLine1: data.addressLine1 || undefined,
        addressLine2: data.addressLine2 || undefined,
        city: data.city || undefined,
        district: data.district || undefined,
        province: data.province || undefined,
        postalCode: data.postalCode || undefined,
        country: "Sri Lanka",
        imageUrl,
        idUrl,
        isActive: data.isActive,
      };

      if (showStudentData) {
        requestBody.studentData = {
          studentId: data.studentId || undefined,
          emergencyContact: data.emergencyContact || undefined,
          medicalConditions: data.medicalConditions || undefined,
          allergies: data.allergies || undefined,
          bloodGroup: data.bloodGroup || undefined,
          fatherPhoneNumber: data.fatherPhoneNumber || undefined,
          motherPhoneNumber: data.motherPhoneNumber || undefined,
          guardianPhoneNumber: data.guardianPhoneNumber || undefined,
        };
      }

      if (showParentData) {
        requestBody.parentData = {
          occupation: data.occupation || undefined,
          workplace: data.workplace || undefined,
          workPhone: data.workPhone || undefined,
          educationLevel: data.educationLevel || undefined,
        };
      }

      await api.createUser(requestBody);

      toast({
        title: "Success",
        description: "User created successfully",
      });

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Failed to create user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) stopCamera(); onOpenChange(open); }}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Create New User
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <ScrollArea className="h-[65vh] pr-4">
            <div className="space-y-6 pb-4">
              {/* Profile Image with Camera */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {showCamera ? (
                    <div className="relative">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className="w-32 h-32 rounded-full object-cover border-2 border-primary"
                      />
                      <div className="flex gap-2 mt-2 justify-center">
                        <Button type="button" size="sm" onClick={capturePhoto}>
                          Capture
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={stopCamera}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : imagePreview ? (
                    <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-border">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                        className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-full p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                {!showCamera && (
                  <div className="space-y-2">
                    <Label>Profile Image</Label>
                    <p className="text-sm text-muted-foreground">Upload a profile photo</p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                        <Camera className="w-4 h-4 mr-1" />
                        Camera
                      </Button>
                      <label>
                        <Button type="button" variant="outline" size="sm" asChild>
                          <span>
                            <Upload className="w-4 h-4 mr-1" />
                            Upload
                          </span>
                        </Button>
                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" {...form.register("firstName")} placeholder="Enter first name" />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" {...form.register("lastName")} placeholder="Enter last name" />
                  {form.formState.errors.lastName && (
                    <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...form.register("email")} placeholder="Optional - for user login" />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input id="phoneNumber" {...form.register("phoneNumber")} placeholder="Optional" />
                  {form.formState.errors.phoneNumber && (
                    <p className="text-sm text-destructive">{form.formState.errors.phoneNumber.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="userType">User Type *</Label>
                  <Select value={form.watch("userType")} onValueChange={(v) => form.setValue("userType", v as UserType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(UserType).map(([key, value]) => (
                        <SelectItem key={value} value={value}>
                          {key.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select value={form.watch("gender")} onValueChange={(v) => form.setValue("gender", v as Gender)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(Gender).map(([key, value]) => (
                        <SelectItem key={value} value={value}>{key}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input id="dateOfBirth" type="date" {...form.register("dateOfBirth")} />
                  {form.formState.errors.dateOfBirth && (
                    <p className="text-sm text-destructive">{form.formState.errors.dateOfBirth.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nic">NIC Number</Label>
                  <Input id="nic" {...form.register("nic")} placeholder="Enter NIC number" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthCertificateNo">Birth Certificate No</Label>
                <Input id="birthCertificateNo" {...form.register("birthCertificateNo")} placeholder="Enter birth certificate number" />
              </div>

              {/* ID Document Upload */}
              <div className="space-y-2">
                <Label>ID Document</Label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 border-2 border-dashed border-border rounded-lg p-3 flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                    <Upload className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {idFileName || "Upload ID document (PDF/Image)"}
                    </span>
                    <input type="file" accept="image/*,.pdf" onChange={handleIdFileChange} className="hidden" />
                  </label>
                  {idFile && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setIdFile(null); setIdFileName(null); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Active Status</Label>
                <Switch
                  id="isActive"
                  checked={form.watch("isActive")}
                  onCheckedChange={(checked) => form.setValue("isActive", checked)}
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input id="addressLine1" {...form.register("addressLine1")} placeholder="Street address" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input id="addressLine2" {...form.register("addressLine2")} placeholder="Apartment, suite, etc." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" {...form.register("city")} placeholder="Enter city" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input id="postalCode" {...form.register("postalCode")} placeholder="00000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="district">District</Label>
                  <Select value={form.watch("district")} onValueChange={(v) => form.setValue("district", v as District)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(District).map(([key, value]) => (
                        <SelectItem key={value} value={value}>
                          {key.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="province">Province</Label>
                  <Select value={form.watch("province")} onValueChange={(v) => form.setValue("province", v as Province)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(Province).map(([key, value]) => (
                        <SelectItem key={value} value={value}>
                          {key.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Student Data */}
              {showStudentData && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-4">Student Information</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="studentId">Student ID</Label>
                      <Input id="studentId" {...form.register("studentId")} placeholder="STU-XXXX-XXX" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergencyContact">Emergency Contact</Label>
                      <Input id="emergencyContact" {...form.register("emergencyContact")} placeholder="+94XXXXXXXXX" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="medicalConditions">Medical Conditions</Label>
                      <Input id="medicalConditions" {...form.register("medicalConditions")} placeholder="None or specify" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="allergies">Allergies</Label>
                      <Input id="allergies" {...form.register("allergies")} placeholder="None or specify" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bloodGroup">Blood Group</Label>
                    <Select value={form.watch("bloodGroup")} onValueChange={(v) => form.setValue("bloodGroup", v as typeof bloodGroups[number])}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select blood group" />
                      </SelectTrigger>
                      <SelectContent>
                        {bloodGroups.map((group) => (
                          <SelectItem key={group} value={group}>
                            {group}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fatherPhoneNumber">Father's Phone</Label>
                      <Input id="fatherPhoneNumber" {...form.register("fatherPhoneNumber")} placeholder="+94XXXXXXXXX" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="motherPhoneNumber">Mother's Phone</Label>
                      <Input id="motherPhoneNumber" {...form.register("motherPhoneNumber")} placeholder="+94XXXXXXXXX" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guardianPhoneNumber">Guardian's Phone</Label>
                      <Input id="guardianPhoneNumber" {...form.register("guardianPhoneNumber")} placeholder="+94XXXXXXXXX" />
                    </div>
                  </div>
                </>
              )}

              {/* Parent Data */}
              {showParentData && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-4">Parent Information</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="occupation">Occupation</Label>
                      <Select value={form.watch("occupation")} onValueChange={(v) => form.setValue("occupation", v as Occupation)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select occupation" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(Occupation).map(([key, value]) => (
                            <SelectItem key={value} value={value}>
                              {key.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="workplace">Workplace</Label>
                      <Input id="workplace" {...form.register("workplace")} placeholder="Company/Institution name" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="workPhone">Work Phone</Label>
                      <Input id="workPhone" {...form.register("workPhone")} placeholder="+94XXXXXXXXX" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="educationLevel">Education Level</Label>
                      <Input id="educationLevel" {...form.register("educationLevel")} placeholder="e.g., Bachelor's Degree" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
