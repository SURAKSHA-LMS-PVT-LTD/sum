import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Loader2, Upload, X } from "lucide-react";
import { uploadFile } from "@/lib/upload";

const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100, "Name must be less than 100 characters"),
  type: z.enum(["INSTITUTE", "GLOBAL", "CLUB", "DEPARTMENT"]),
  isPublic: z.boolean().default(false),
  enrollmentKey: z.string().optional(),
  needEnrollmentVerification: z.boolean().default(true),
  enabledEnrollments: z.boolean().default(true),
  instituteId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CreateOrganizationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Institute {
  instituteId: string;
  name: string;
  shortName?: string;
}

export function CreateOrganizationForm({ open, onOpenChange, onSuccess }: CreateOrganizationFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [isLoadingInstitutes, setIsLoadingInstitutes] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "INSTITUTE",
      isPublic: false,
      enrollmentKey: "",
      needEnrollmentVerification: true,
      enabledEnrollments: true,
      instituteId: "",
    },
  });

  useEffect(() => {
    if (open) {
      fetchInstitutes();
    }
  }, [open]);

  const fetchInstitutes = async () => {
    try {
      setIsLoadingInstitutes(true);
      const response = await api.getAvailableInstitutesForOrg();
      setInstitutes(response.institutes || response.data || []);
    } catch (error) {
      console.error("Failed to fetch institutes:", error);
      // Fallback to regular institutes endpoint
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

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      let imageUrl: string | undefined;

      // Upload image if selected
      if (imageFile) {
        setIsUploading(true);
        try {
          const result = await uploadFile(imageFile, "organizations");
          imageUrl = result?.relativePath;
        } catch (error) {
          console.error("Image upload failed:", error);
          toast({
            title: "Warning",
            description: "Failed to upload image. Organization will be created without an image.",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
        }
      }

      const payload = {
        name: data.name,
        type: data.type,
        isPublic: data.isPublic,
        needEnrollmentVerification: data.needEnrollmentVerification,
        enabledEnrollments: data.enabledEnrollments,
        imageUrl: imageUrl || undefined,
        enrollmentKey: data.enrollmentKey || undefined,
        instituteId: data.instituteId === "none" ? undefined : data.instituteId || undefined,
      };

      await api.createOrganization(payload);

      toast({
        title: "Success",
        description: "Organization created successfully",
      });

      form.reset();
      setImageFile(null);
      setImagePreview(null);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Failed to create organization:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create organization",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPublic = form.watch("isPublic");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Create a new organization to manage members and activities.
          </DialogDescription>
        </DialogHeader>

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
                  <FormLabel>Organization Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Computer Science Student Association" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select organization type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="INSTITUTE">Institute</SelectItem>
                      <SelectItem value="GLOBAL">Global</SelectItem>
                      <SelectItem value="CLUB">Club</SelectItem>
                      <SelectItem value="DEPARTMENT">Department</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instituteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Associated Institute</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingInstitutes ? "Loading..." : "Select institute (optional)"} />
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
                  <FormDescription>
                    Optionally link this organization to an institute
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isUploading}>
                {(isSubmitting || isUploading) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isUploading ? "Uploading..." : isSubmitting ? "Creating..." : "Create Organization"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
