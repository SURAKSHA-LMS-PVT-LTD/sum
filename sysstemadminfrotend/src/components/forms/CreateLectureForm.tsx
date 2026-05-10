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
import { InstituteType } from "@/lib/enums";
import { Loader2, Upload, X, Plus, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  instituteId: z.string().min(1, "Institute is required"),
  classId: z.string().optional(),
  subjectId: z.string().min(1, "Subject is required"),
  grade: z.coerce.number().min(1).max(13, "Grade must be 1-13"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  lessonNumber: z.coerce.number().min(1).optional(),
  lectureNumber: z.coerce.number().min(1).optional(),
  provider: z.string().optional(),
  lectureLink: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface Institute {
  id: string;
  name: string;
  type?: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface DocumentItem {
  name: string;
  file: File | null;
  description?: string;
}

interface CreateLectureFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
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

export function CreateLectureForm({
  open,
  onOpenChange,
  onSuccess,
}: CreateLectureFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      instituteId: "",
      classId: "",
      subjectId: "",
      grade: 10,
      title: "",
      description: "",
      lessonNumber: 1,
      lectureNumber: 1,
      provider: "",
      lectureLink: "",
      isActive: true,
    },
  });

  const selectedInstituteId = form.watch("instituteId");
  const selectedInst = institutes.find((i) => i.id === selectedInstituteId);
  const isTuition = selectedInst?.type === InstituteType.TUITION_INSTITUTE;
  const subjectLabel = isTuition ? 'Month' : 'Subject';

  useEffect(() => {
    if (open) {
      fetchSubjects();
      fetchInstitutes();
    }
  }, [open]);

  useEffect(() => {
    if (selectedInstituteId) {
      fetchClasses(selectedInstituteId);
    } else {
      setClasses([]);
    }
  }, [selectedInstituteId]);

  const fetchSubjects = async () => {
    try {
      const response = await api.getSubjects({ page: 1, limit: 100 });
      setSubjects(Array.isArray(response) ? response : response.data || []);
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
    }
  };

  const fetchInstitutes = async () => {
    try {
      const response = await api.getInstitutes(1, 100);
      const list = response.data || response.institutes || response;
      setInstitutes(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Failed to fetch institutes:", error);
    }
  };

  const fetchClasses = async (instituteId: string) => {
    try {
      const response = await api.getClassesByInstitute(instituteId);
      const list = response.data || response.classes || response;
      setClasses(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Failed to fetch classes:", error);
      setClasses([]);
    }
  };

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

  const addDocument = () => {
    setDocuments([...documents, { name: "", file: null, description: "" }]);
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const handleDocumentChange = (index: number, field: keyof DocumentItem, value: any) => {
    const updated = [...documents];
    updated[index] = { ...updated[index], [field]: value };
    setDocuments(updated);
  };

  const handleDocumentFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleDocumentChange(index, "file", file);
      if (!documents[index].name) {
        handleDocumentChange(index, "name", file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      let coverImageUrl: string | undefined;
      if (coverImageFile) {
        coverImageUrl = await uploadLectureFile(coverImageFile);
      }

      const uploadedDocuments: { documentUrl: string; documentName: string; documentDescription?: string }[] = [];
      for (const doc of documents) {
        if (doc.file) {
          const url = await uploadLectureFile(doc.file);
          uploadedDocuments.push({
            documentUrl: url,
            documentName: doc.name || doc.file.name,
            documentDescription: doc.description || undefined,
          });
        }
      }

      const payload: any = {
        instituteId: data.instituteId,
        subjectId: data.subjectId,
        grade: data.grade,
        title: data.title,
        isActive: data.isActive,
      };

      if (data.classId) payload.classId = Number(data.classId);
      if (data.description) payload.description = data.description;
      if (data.lessonNumber) payload.lessonNumber = data.lessonNumber;
      if (data.lectureNumber) payload.lectureNumber = data.lectureNumber;
      if (data.provider) payload.provider = data.provider;
      if (data.lectureLink) payload.lectureLink = data.lectureLink;
      if (coverImageUrl) payload.coverImageUrl = coverImageUrl;
      if (uploadedDocuments.length > 0) payload.documents = uploadedDocuments;

      await api.createStructuredLecture(payload);

      toast({ title: "Success", description: "Lecture created successfully" });

      form.reset();
      setCoverImageFile(null);
      setCoverImagePreview(null);
      setDocuments([]);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Failed to create lecture:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create lecture",
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
          <DialogTitle>Create Structured Lecture</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Institute and Class */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="instituteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Institute *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select institute" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {institutes.map((inst) => (
                            <SelectItem key={inst.id} value={String(inst.id)}>
                              {inst.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="classId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class (optional — leave empty for institute-wide)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="All classes" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">All classes (institute-wide)</SelectItem>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={String(cls.id)}>
                              {cls.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Subject and Grade */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="subjectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{subjectLabel} *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${subjectLabel.toLowerCase()}`} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.name} ({subject.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="grade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grade *</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={13} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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

              {/* Lesson Number, Lecture Number, Provider */}
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
                        <Input placeholder="e.g. YouTube, Vimeo" {...field} />
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
                    <FormLabel>Lecture Link (Video URL)</FormLabel>
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
                        Click to upload cover image (JPEG, PNG, WebP)
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

              {/* Documents */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel>Documents</FormLabel>
                  <Button type="button" variant="outline" size="sm" onClick={addDocument}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Document
                  </Button>
                </div>
                {documents.map((doc, index) => (
                  <div key={index} className="flex gap-3 items-start p-3 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Document name"
                        value={doc.name}
                        onChange={(e) => handleDocumentChange(index, "name", e.target.value)}
                      />
                      <Input
                        placeholder="Description (optional)"
                        value={doc.description || ""}
                        onChange={(e) => handleDocumentChange(index, "description", e.target.value)}
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
                          onChange={(e) => handleDocumentFileChange(index, e)}
                        />
                      </label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDocument(index)}
                    >
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
                        Make this lecture visible to students
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
                  Create Lecture
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
