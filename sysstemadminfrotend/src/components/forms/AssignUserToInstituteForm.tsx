import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { uploadFile } from "@/lib/upload";
import { Loader2, Upload, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

import { InstituteUserType } from "@/lib/enums";

const formSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  instituteUserType: z.string().min(1, "User type is required"),
  userIdByInstitute: z.string().optional(),
  instituteCardId: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AssignUserToInstituteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  instituteId: string;
  instituteName: string;
}

export function AssignUserToInstituteForm({
  open,
  onOpenChange,
  onSuccess,
  instituteId,
  instituteName,
}: AssignUserToInstituteFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: "",
      instituteUserType: InstituteUserType.STUDENT,
      userIdByInstitute: "",
      instituteCardId: "",
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageFile(file);
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      let instituteImage = "";

      if (imageFile) {
        const imageResult = await uploadFile(imageFile, "institute-user-images");
        instituteImage = imageResult.relativePath;
      }

      await api.assignUserToInstitute(instituteId, {
        userId: data.userId,
        instituteUserType: data.instituteUserType,
        userIdByInstitute: data.userIdByInstitute,
        instituteCardId: data.instituteCardId || undefined,
        instituteImage: instituteImage || undefined,
      });

      toast({
        title: "Success",
        description: "User assigned to institute successfully",
      });

      form.reset();
      setImageFile(null);
      setImagePreview(null);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Failed to assign user:", error);
      toast({
        title: "Error",
        description: "Failed to assign user to institute",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Assign User to {instituteName}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* User ID Input */}
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User ID *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter user ID (e.g., 105124)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* User Type */}
              <FormField
                control={form.control}
                name="instituteUserType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(InstituteUserType).map(([key, value]) => (
                          <SelectItem key={key} value={value}>
                            {key}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Institute User ID */}
              <FormField
                control={form.control}
                name="userIdByInstitute"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Institute User ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., STU2024001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Institute Card ID */}
              <FormField
                control={form.control}
                name="instituteCardId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Institute Card ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., CARD-2024-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Image Upload */}
              <div className="space-y-2">
                <FormLabel>Institute Image</FormLabel>
                {imagePreview ? (
                  <div className="relative w-32 h-32">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={removeFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-1">Upload</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Assign User
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
