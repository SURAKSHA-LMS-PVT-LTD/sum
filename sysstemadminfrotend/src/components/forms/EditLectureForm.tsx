import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Loader2, Upload, X, Plus, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  lessonNumber: z.coerce.number().min(1).optional(),
  lectureNumber: z.coerce.number().min(1).optional(),
  provider: z.string().optional(),
  lectureLink: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface LectureDocument {
  documentUrl: string;
  documentName: string;
  documentDescription?: string;
}

interface Lecture {
  _id: string;
  title: string;
  description?: string;
  instituteId?: string;
  classId?: number | null;
  subjectId?: string;
  grade?: number;
  lessonNumber?: number;
  lectureNumber?: number;
  provider?: string;
  lectureLink?: string;
  coverImageUrl?: string;
  documents?: LectureDocument[];
  isActive: boolean;
}

interface NewDocumentItem {
  name: string;
  file: File | null;
  description?: string;
}

interface EditLectureFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  lecture: Lecture | null;
}

async function uploadLectureFile(file: File): Promise<string> {
  const { signedUrl, publicUrl } = await api.getLectureSignedUrl(file.name, file.type);
  await fetch(signedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  return publicUrl;
}

export function EditLectureForm({
  open,
  onOpenChange,
  onSuccess,
  lecture,
}: EditLectureFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [existingDocs, setExistingDocs] = useState<LectureDocument[]>([]);
  const [newDocuments, setNewDocuments] = useState<NewDocumentItem[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      lessonNumber: 1,
      lectureNumber: 1,
      provider: "",
      lectureLink: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (lecture && open) {
      form.reset({
        title: lecture.title || "",
        description: lecture.description || "",
        lessonNumber: lecture.lessonNumber || 1,
        lectureNumber: lecture.lectureNumber || 1,
        provider: lecture.provider || "",
        lectureLink: lecture.lectureLink || "",
        isActive: lecture.isActive,
      });
      setCoverImagePreview(lecture.coverImageUrl || null);
      setCoverImageFile(null);
      setExistingDocs(lecture.documents || []);
      setNewDocuments([]);
    }
  }, [lecture, open]);

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCoverImageFile(file);
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeCoverImage = () => {
    setCoverImageFile(null);
    setCoverImagePreview(null);
  };

  const removeExistingDoc = (index: number) => {
    setExistingDocs(existingDocs.filter((_, i) => i !== index));
  };

  const addNewDocument = () => {
    setNewDocuments([...newDocuments, { name: "", file: null, description: "" }]);
  };

  const removeNewDocument = (index: number) => {
    setNewDocuments(newDocuments.filter((_, i) => i !== index));
  };

  const handleNewDocChange = (index: number, field: keyof NewDocumentItem, value: any) => {
    const updated = [...newDocuments];
    updated[index] = { ...updated[index], [field]: value };
    setNewDocuments(updated);
  };

  const handleNewDocFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleNewDocChange(index, "file", file);
      if (!newDocuments[index].name) {
        handleNewDocChange(index, "name", file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!lecture) return;
    try {
      setIsSubmitting(true);

      const patch: any = {};

      // Only send changed fields
      if (data.title !== lecture.title) patch.title = data.title;
      if (data.description !== (lecture.description || "")) patch.description = data.description;
      if (data.lessonNumber !== lecture.lessonNumber) patch.lessonNumber = data.lessonNumber;
      if (data.lectureNumber !== lecture.lectureNumber) patch.lectureNumber = data.lectureNumber;
      if (data.provider !== (lecture.provider || "")) patch.provider = data.provider;
      if (data.lectureLink !== (lecture.lectureLink || "")) patch.lectureLink = data.lectureLink;
      if (data.isActive !== lecture.isActive) patch.isActive = data.isActive;

      // Handle cover image change
      if (coverImageFile) {
        patch.coverImageUrl = await uploadLectureFile(coverImageFile);
      }

      // Handle documents — merge existing + new uploads
      const uploadedNewDocs: LectureDocument[] = [];
      for (const doc of newDocuments) {
        if (doc.file) {
          const url = await uploadLectureFile(doc.file);
          uploadedNewDocs.push({
            documentUrl: url,
            documentName: doc.name || doc.file.name,
            documentDescription: doc.description,
          });
        }
      }

      const docsChanged =
        existingDocs.length !== (lecture.documents || []).length || uploadedNewDocs.length > 0;
      if (docsChanged) {
        patch.documents = [...existingDocs, ...uploadedNewDocs];
      }

      if (Object.keys(patch).length === 0) {
        toast({ title: "No changes", description: "Nothing was modified" });
        return;
      }

      await api.updateStructuredLecture(lecture._id, patch);

      toast({ title: "Success", description: "Lecture updated successfully" });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Failed to update lecture:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update lecture",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Lecture</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Read-only info */}
              {lecture && (
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                  <div><span className="text-muted-foreground">Institute:</span> {lecture.instituteId}</div>
                  <div><span className="text-muted-foreground">Subject:</span> {lecture.subjectId}</div>
                  <div><span className="text-muted-foreground">Grade:</span> {lecture.grade}</div>
                  <div><span className="text-muted-foreground">Class:</span> {lecture.classId ?? "All (institute-wide)"}</div>
                </div>
              )}

              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Lecture title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Lecture description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Lesson / Lecture / Provider */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="lessonNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lesson Number</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lectureNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lecture Number</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provider</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. YouTube" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Lecture Link */}
              <FormField
                control={form.control}
                name="lectureLink"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lecture Link</FormLabel>
                    <FormControl>
                      <Input placeholder="https://youtube.com/watch?v=..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cover Image */}
              <div className="space-y-2">
                <FormLabel>Cover Image</FormLabel>
                <div className="border-2 border-dashed border-border rounded-lg p-4">
                  {coverImagePreview ? (
                    <div className="relative">
                      <img
                        src={coverImagePreview}
                        alt="Cover preview"
                        className="w-full h-40 object-cover rounded"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={removeCoverImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center cursor-pointer py-4">
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground mt-2">
                        Click to upload cover image
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleCoverImageChange}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Existing Documents */}
              {existingDocs.length > 0 && (
                <div className="space-y-2">
                  <FormLabel>Existing Documents</FormLabel>
                  {existingDocs.map((doc, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{doc.documentName}</span>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeExistingDoc(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* New Documents */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Add Documents</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={addNewDocument}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Document
                  </Button>
                </div>
                {newDocuments.map((doc, index) => (
                  <div key={index} className="flex gap-3 items-start p-3 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Document name"
                        value={doc.name}
                        onChange={(e) => handleNewDocChange(index, "name", e.target.value)}
                      />
                      <label className="flex items-center gap-2 cursor-pointer border rounded px-3 py-2 hover:bg-muted/50">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground truncate">
                          {doc.file ? doc.file.name : "Choose file..."}
                        </span>
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          className="hidden"
                          onChange={(e) => handleNewDocFileChange(index, e)}
                        />
                      </label>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeNewDocument(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Is Active */}
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Visible to students when active
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
