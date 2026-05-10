import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  X, Save, Video, Image, Upload, Loader2,
  Link2, ExternalLink, Users,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { structuredLecturesApi, CreateStructuredLectureDto, LectureDocumentInput } from '@/api/structuredLectures.api';
import { getErrorMessage } from '@/api/apiError';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';
import LectureMaterialsSection, { LectureMaterial } from '@/components/common/LectureMaterialsSection';

// ─── Local types ──────────────────────────────────────────────────────────────

interface CreateStructuredLectureFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const CreateStructuredLectureForm = ({ onClose, onSuccess }: CreateStructuredLectureFormProps) => {
  const { selectedInstitute, selectedClass, selectedSubject, selectedClassGrade } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  // ── Basic fields ──────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    lessonNumber: 1,
    lectureNumber: 1,
    lectureVideoUrl: '',
    lectureLink: '',
    provider: '',
    isActive: true,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Cover image ───────────────────────────────────────────────────────────
  const [coverMode, setCoverMode] = useState<'upload' | 'url'>('upload');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const coverRef = useRef<HTMLInputElement>(null);

  // Reference materials (via common LectureMaterialsSection)
  const [materials, setMaterials] = useState<LectureMaterial[]>([]);

  // ── Cover image handlers ──────────────────────────────────────────────────

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Cover must be an image file.', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Cover image must be under 10 MB.', variant: 'destructive' });
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const clearCover = () => {
    setCoverFile(null);
    setCoverPreview('');
    if (coverRef.current) coverRef.current.value = '';
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInstitute?.id || !selectedClass?.id || !selectedSubject?.id) {
      toast({ title: 'Error', description: 'Please ensure institute, class, and subject are selected.', variant: 'destructive' });
      return;
    }

    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setLoading(true);
    try {
      let coverImageUrl: string | undefined;
      if (coverMode === 'upload' && coverFile) {
        setUploadMsg('Uploading cover image…');
        coverImageUrl = await uploadWithSignedUrl(coverFile, 'subject-images');
      } else if (coverMode === 'url' && coverUrlInput.trim()) {
        coverImageUrl = coverUrlInput.trim();
      }

      setUploadMsg('Saving lecture…');

      const documents: LectureDocumentInput[] = materials.map(m => ({
        documentName: m.documentName,
        documentUrl: m.documentUrl,
        driveFileId: m.driveFileId,
        driveWebViewLink: m.driveWebViewLink,
        source: m.source,
      }));

      const payload: CreateStructuredLectureDto = {
        instituteId: selectedInstitute.id,
        classId: selectedClass.id,
        subjectId: selectedSubject.id,
        grade: selectedClassGrade || selectedClass.grade || 10,
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        lessonNumber: formData.lessonNumber,
        lectureNumber: formData.lectureNumber,
        lectureVideoUrl: formData.lectureVideoUrl.trim() || undefined,
        lectureLink: formData.lectureLink.trim() || undefined,
        coverImageUrl,
        documents: documents.length > 0 ? documents : undefined,
        provider: formData.provider.trim() || undefined,
        isActive: formData.isActive,
      };

      await structuredLecturesApi.create(payload);
      toast({ title: 'Success', description: 'Lecture created successfully.' });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to create lecture'), variant: 'destructive' });
    } finally {
      setLoading(false);
      setUploadMsg('');
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Create New Lecture
        </CardTitle>
        <CardDescription>
          Add a new lecture to {selectedSubject?.name} (Grade {selectedClassGrade})
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Basic fields ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Lecture title"
                className={fieldErrors.title ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {fieldErrors.title && <p className="text-xs text-destructive mt-1">{fieldErrors.title}</p>}
            </div>

            <div>
              <Label htmlFor="lessonNumber">Lesson Number</Label>
              <Input
                id="lessonNumber"
                type="number"
                min="1"
                value={formData.lessonNumber}
                onChange={(e) => handleInputChange('lessonNumber', parseInt(e.target.value) || 1)}
              />
            </div>

            <div>
              <Label htmlFor="lectureNumber">Lecture Number</Label>
              <Input
                id="lectureNumber"
                type="number"
                min="1"
                value={formData.lectureNumber}
                onChange={(e) => handleInputChange('lectureNumber', parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Lecture description"
              rows={3}
            />
          </div>

          {/* ── Video / links ── */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              Video Content
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recording */}
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Video className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <Label htmlFor="lectureVideoUrl" className="text-sm font-medium leading-none">Recording URL</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">YouTube, Drive, or storage link — students can Watch inline</p>
                  </div>
                </div>
                <Input
                  id="lectureVideoUrl"
                  value={formData.lectureVideoUrl}
                  onChange={(e) => handleInputChange('lectureVideoUrl', e.target.value)}
                  placeholder="https://youtu.be/… or storage URL"
                  className="text-sm"
                />
                {formData.lectureVideoUrl.trim() && (
                  <a
                    href={formData.lectureVideoUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Preview link
                  </a>
                )}
              </div>

              {/* Meeting */}
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Users className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  <div>
                    <Label htmlFor="lectureLink" className="text-sm font-medium leading-none">Meeting Link</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Zoom, Google Meet, Teams — opens externally for students</p>
                  </div>
                </div>
                <Input
                  id="lectureLink"
                  value={formData.lectureLink}
                  onChange={(e) => handleInputChange('lectureLink', e.target.value)}
                  placeholder="https://zoom.us/j/… or meet.google.com/…"
                  className="text-sm"
                />
                {formData.lectureLink.trim() && (
                  <a
                    href={formData.lectureLink.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Preview link
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* ── Cover image ── */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Image className="h-4 w-4 text-muted-foreground" />
              Cover Image
            </h3>

            {/* Mode toggle */}
            <div className="flex items-center bg-muted rounded-xl p-1 gap-1 w-fit">
              <button
                type="button"
                onClick={() => setCoverMode('upload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  coverMode === 'upload' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Upload className="h-3.5 w-3.5" /> Upload File
              </button>
              <button
                type="button"
                onClick={() => setCoverMode('url')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  coverMode === 'url' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Link2 className="h-3.5 w-3.5" /> Enter URL
              </button>
            </div>

            {coverMode === 'upload' ? (
              <div className="flex items-start gap-4">
                {coverPreview && (
                  <div className="relative shrink-0">
                    <img src={coverPreview} alt="Cover preview" className="w-24 h-24 object-cover rounded-xl border" />
                    <button
                      type="button"
                      onClick={clearCover}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <div>
                  <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFileChange} />
                  <Button type="button" variant="outline" size="sm" onClick={() => coverRef.current?.click()} className="gap-2">
                    <Image className="h-4 w-4" />
                    {coverFile ? 'Replace Image' : 'Choose Image'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP — max 10 MB (uploaded to S3)</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  value={coverUrlInput}
                  onChange={(e) => setCoverUrlInput(e.target.value)}
                  placeholder="https://example.com/cover.jpg"
                />
                {coverUrlInput.trim() && (
                  <img
                    src={coverUrlInput.trim()}
                    alt="Cover preview"
                    className="w-32 h-20 object-cover rounded-xl border"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <p className="text-xs text-muted-foreground">Direct image URL (must be publicly accessible)</p>
              </div>
            )}
          </div>

          {/* ── Reference documents ── */}
          <div className="space-y-3 border-t pt-4">
            <LectureMaterialsSection
              materials={materials}
              onChange={setMaterials}
              instituteId={selectedInstitute?.id}
              subjectName={selectedSubject?.name}
              className={selectedClass?.name}
              grade={selectedClassGrade || selectedClass?.grade}
              disabled={loading}
            />
          </div>

          {/* ── Provider & Active ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
            <div>
              <Label htmlFor="provider">Provider / Instructor</Label>
              <Input
                id="provider"
                value={formData.provider}
                onChange={(e) => handleInputChange('provider', e.target.value)}
                placeholder="e.g. Dr. Jane Smith"
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(v) => handleInputChange('isActive', v)}
              />
              <Label htmlFor="isActive">Active (visible to students)</Label>
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            {uploadMsg && (
              <span className="text-sm text-muted-foreground flex items-center gap-2 mr-auto">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {uploadMsg}
              </span>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {loading ? 'Saving…' : 'Create Lecture'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreateStructuredLectureForm;
