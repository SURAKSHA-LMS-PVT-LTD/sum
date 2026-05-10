import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Settings, Building2, Loader2, Upload, X, Trash2 } from "lucide-react";
import { uploadFile } from "@/lib/upload";

const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  isPublic: z.boolean(),
  enrollmentKey: z.string().optional(),
  needEnrollmentVerification: z.boolean(),
  enabledEnrollments: z.boolean(),
  instituteId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Organization {
  organizationId: string;
  name: string;
  type: string;
  isPublic: boolean;
  enrollmentKey?: string;
  needEnrollmentVerification: boolean;
  enabledEnrollments: boolean;
  imageUrl?: string;
  instituteId?: string;
  instituteName?: string;
  canDelete?: boolean;
}

interface Institute {
  instituteId: string;
  name: string;
  shortName?: string;
}

interface OrganizationSettingsPanelProps {
  organization: Organization;
  onRefresh: () => void;
  onOrganizationUpdated: (org: Organization) => void;
}

export function OrganizationSettingsPanel({ 
  organization, 
  onRefresh, 
  onOrganizationUpdated 
}: OrganizationSettingsPanelProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(organization.imageUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [isLoadingInstitutes, setIsLoadingInstitutes] = useState(false);
  const [removeInstituteDialog, setRemoveInstituteDialog] = useState(false);
  const [isRemovingInstitute, setIsRemovingInstitute] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: organization.name,
      isPublic: organization.isPublic,
      enrollmentKey: organization.enrollmentKey || "",
      needEnrollmentVerification: organization.needEnrollmentVerification,
      enabledEnrollments: organization.enabledEnrollments,
      instituteId: organization.instituteId || "",
    },
  });

  useEffect(() => {
    fetchInstitutes();
  }, []);

  useEffect(() => {
    form.reset({
      name: organization.name,
      isPublic: organization.isPublic,
      enrollmentKey: organization.enrollmentKey || "",
      needEnrollmentVerification: organization.needEnrollmentVerification,
      enabledEnrollments: organization.enabledEnrollments,
      instituteId: organization.instituteId || "",
    });
    setImagePreview(organization.imageUrl || null);
  }, [organization]);

  const fetchInstitutes = async () => {
    try {
      setIsLoadingInstitutes(true);
      const response = await api.getAvailableInstitutesForOrg();
      setInstitutes(response.institutes || response.data || []);
    } catch (error) {
      console.error("Failed to fetch institutes:", error);
      try {
        const response = await api.getInstitutes(1, 100);
        setInstitutes(response.data?.map((i: any) => ({
          instituteId: i.id,
          name: i.name,
          shortName: i.shortName,
        })) || []);
      } catch (e) {
        console.error("Failed to fetch institutes from fallback:", e);
      }
    } finally {
      setIsLoadingInstitutes(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleRemoveInstitute = async () => {
    try {
      setIsRemovingInstitute(true);
      await api.removeInstituteFromOrganization(organization.organizationId);
      toast({
        title: "Success",
        description: "Institute removed from organization",
      });
      setRemoveInstituteDialog(false);
      onRefresh();
    } catch (error) {
      console.error("Failed to remove institute:", error);
      toast({
        title: "Error",
        description: "Failed to remove institute",
        variant: "destructive",
      });
    } finally {
      setIsRemovingInstitute(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      let imageUrl: string | undefined = organization.imageUrl;

      // Upload new image if selected
      if (imageFile) {
        setIsUploading(true);
        try {
          const result = await uploadFile(imageFile, "organizations");
          imageUrl = result?.relativePath;
        } catch (error) {
          console.error("Image upload failed:", error);
          toast({
            title: "Warning",
            description: "Failed to upload new image. Keeping existing image.",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
        }
      } else if (!imagePreview && organization.imageUrl) {
        // Image was removed
        imageUrl = undefined;
      }

      // Handle institute assignment
      const currentInstituteId = organization.instituteId;
      const newInstituteId = data.instituteId === "none" ? undefined : data.instituteId;

      if (newInstituteId && newInstituteId !== currentInstituteId) {
        // Assign new institute
        await api.assignInstituteToOrganization(organization.organizationId, newInstituteId);
      }

      const payload = {
        name: data.name,
        isPublic: data.isPublic,
        enrollmentKey: data.enrollmentKey || undefined,
        needEnrollmentVerification: data.needEnrollmentVerification,
        enabledEnrollments: data.enabledEnrollments,
        imageUrl,
      };

      const updated = await api.updateOrganization(organization.organizationId, payload);

      toast({
        title: "Success",
        description: "Organization updated successfully",
      });

      onOrganizationUpdated(updated);
      onRefresh();
      setImageFile(null);
    } catch (error) {
      console.error("Failed to update organization:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update organization",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPublic = form.watch("isPublic");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Organization Settings
          </CardTitle>
          <CardDescription>
            Update settings for {organization.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Image Upload */}
              <div className="space-y-2">
                <FormLabel>Organization Logo</FormLabel>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-24 h-24 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={removeImage}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary transition-colors">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                    </label>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">Type</span>
                </div>
                <p className="text-muted-foreground">{organization.type}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Organization type cannot be changed after creation
                </p>
              </div>

              <FormField
                control={form.control}
                name="instituteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Associated Institute</FormLabel>
                    <div className="flex gap-2">
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder={isLoadingInstitutes ? "Loading..." : "Select institute"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {institutes.map((institute) => (
                            <SelectItem key={institute.instituteId} value={institute.instituteId}>
                              {institute.name} {institute.shortName && `(${institute.shortName})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {organization.instituteId && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setRemoveInstituteDialog(true)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <FormDescription>
                      Link this organization to an institute
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Public Organization</FormLabel>
                        <FormDescription>
                          Anyone can discover and join
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enabledEnrollments"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Enrollments</FormLabel>
                        <FormDescription>
                          Allow new members to join
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="needEnrollmentVerification"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Require Verification</FormLabel>
                      <FormDescription>
                        Admin must verify new members before they can access
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!isPublic && (
                <FormField
                  control={form.control}
                  name="enrollmentKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Enrollment Key</FormLabel>
                      <FormControl>
                        <Input placeholder="Secret key for private enrollment" {...field} />
                      </FormControl>
                      <FormDescription>
                        Users will need this key to join a private organization
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting || isUploading}>
                  {(isSubmitting || isUploading) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isUploading ? "Uploading..." : isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Remove Institute Dialog */}
      <AlertDialog open={removeInstituteDialog} onOpenChange={setRemoveInstituteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Institute Association</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the institute association from this organization?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingInstitute}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveInstitute}
              disabled={isRemovingInstitute}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemovingInstitute && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
