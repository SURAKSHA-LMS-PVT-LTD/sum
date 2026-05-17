// src/components/notifications/CreateNotificationForm.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { 
  adminNotificationService,
  NotificationScope,
  NotificationTargetUserType,
  NotificationPriority,
  CreateNotificationPayload
} from '@/services/adminNotificationService';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { Loader2, Send, Bell, ChevronsUpDown, Check, ImageIcon, X } from 'lucide-react';
import { apiClient } from '@/api/client';
import { profileImageApi } from '@/api/profileImage.api';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ClassOption {
  id: string;
  name: string;
}

interface SubjectOption {
  id: string;
  name: string;
  classId: string;
}

export const CreateNotificationForm: React.FC<Props> = ({ open, onOpenChange, onSuccess }) => {
  const { user, selectedInstitute } = useAuth();
  const { subjectLabel } = useInstituteLabels();
  
  const isSuperAdmin = user?.userType === 'SUPERADMIN' || user?.userType === 'SA';
  
  // Check for both formats: INSTITUTEADMIN and INSTITUTE_ADMIN (API returns underscore format)
  const instituteUserType = selectedInstitute?.instituteUserType || selectedInstitute?.userRole;
  const isInstituteAdmin = instituteUserType === 'INSTITUTEADMIN' || instituteUserType === 'INSTITUTE_ADMIN';
  const isTeacher = instituteUserType === 'TEACHER';

  // Form State
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState(''); // final published URL after upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [actionUrl, setActionUrl] = useState('');
  const [scope, setScope] = useState<NotificationScope>(
    isSuperAdmin ? NotificationScope.GLOBAL : NotificationScope.INSTITUTE
  );
  const [targetUserTypes, setTargetUserTypes] = useState<NotificationTargetUserType[]>([
    NotificationTargetUserType.ALL
  ]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [priority, setPriority] = useState<NotificationPriority>(NotificationPriority.NORMAL);

  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // State for searchable dropdowns
  const [classSearchOpen, setClassSearchOpen] = useState(false);
  const [subjectSearchOpen, setSubjectSearchOpen] = useState(false);
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');

  // Fetch classes when scope requires it - NEW API: /institute-classes/institute/{instituteId}
  useEffect(() => {
    if ((scope === NotificationScope.CLASS || scope === NotificationScope.SUBJECT) && selectedInstitute?.id) {
      setLoadingClasses(true);
      setSelectedClassId('');
      setSelectedSubjectId('');
      apiClient.get<any>(`/institute-classes/institute/${selectedInstitute.id}`)
        .then((response) => {
          const classData = Array.isArray(response) ? response : response?.data || [];
          setClasses(classData.map((c: any) => ({ 
            id: c.id || c.classId, 
            name: c.name || c.className || c.class?.name 
          })));
        })
        .catch((error) => {
          console.error('Failed to fetch classes:', error);
          setClasses([]);
        })
        .finally(() => setLoadingClasses(false));
    }
  }, [scope, selectedInstitute?.id]);

  // Fetch subjects when class is selected - NEW API: /institutes/{instituteId}/classes/{classId}/subjects
  useEffect(() => {
    if (scope === NotificationScope.SUBJECT && selectedClassId && selectedInstitute?.id) {
      setLoadingSubjects(true);
      setSelectedSubjectId('');
      apiClient.get<any>(`/institutes/${selectedInstitute.id}/classes/${selectedClassId}/subjects`)
        .then((response) => {
          const subjectData = Array.isArray(response) ? response : response?.data || [];
          setSubjects(subjectData.map((s: any) => ({ 
            id: s.subjectId || s.id, 
            name: s.subject?.name || s.name || s.subjectName,
            classId: selectedClassId 
          })));
        })
        .catch((error) => {
          console.error('Failed to fetch subjects:', error);
          setSubjects([]);
        })
        .finally(() => setLoadingSubjects(false));
    }
  }, [scope, selectedClassId, selectedInstitute?.id]);

  // Filtered classes based on search
  const filteredClasses = useMemo(() => {
    if (!classSearchQuery) return classes;
    return classes.filter(c => 
      c.name?.toLowerCase().includes(classSearchQuery.toLowerCase())
    );
  }, [classes, classSearchQuery]);

  // Filtered subjects based on search
  const filteredSubjects = useMemo(() => {
    if (!subjectSearchQuery) return subjects;
    return subjects.filter(s => 
      s.name?.toLowerCase().includes(subjectSearchQuery.toLowerCase())
    );
  }, [subjects, subjectSearchQuery]);

  // Available scopes based on user role
  const getAvailableScopes = (): { value: NotificationScope; label: string }[] => {
    const scopes: { value: NotificationScope; label: string }[] = [];
    
    if (isSuperAdmin) {
      scopes.push({ value: NotificationScope.GLOBAL, label: 'Global (All Users)' });
    }
    if (isSuperAdmin || isInstituteAdmin) {
      scopes.push({ value: NotificationScope.INSTITUTE, label: 'Institute-wide' });
    }
    if (isSuperAdmin || isInstituteAdmin || isTeacher) {
      scopes.push({ value: NotificationScope.CLASS, label: 'Specific Class' });
      scopes.push({ value: NotificationScope.SUBJECT, label: 'Specific Subject' });
    }
    
    return scopes;
  };

  const handleTargetUserTypeChange = (type: NotificationTargetUserType, checked: boolean) => {
    if (type === NotificationTargetUserType.ALL && checked) {
      setTargetUserTypes([NotificationTargetUserType.ALL]);
    } else if (checked) {
      const newTypes = targetUserTypes.filter(t => t !== NotificationTargetUserType.ALL);
      setTargetUserTypes([...newTypes, type]);
    } else {
      setTargetUserTypes(targetUserTypes.filter(t => t !== type));
    }
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error('Only JPEG, PNG, WebP or GIF images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageUrl(''); // will be set after upload on submit

    // Upload immediately so we have the URL ready
    setImageUploading(true);
    try {
      const signed = await profileImageApi.generateSignedUrl(file.name, file.type, file.size);
      await profileImageApi.uploadToStorage(signed.uploadUrl, file, signed.fields);
      const publicUrl = await profileImageApi.verifyAndPublish(signed.relativePath);
      setImageUrl(publicUrl);
    } catch (err: any) {
      toast.error(err.message || 'Image upload failed');
      setImageFile(null);
      setImagePreview('');
    } finally {
      setImageUploading(false);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    setImageUrl('');
  };

  const resetForm = () => {
    setTitle('');
    setBody('');
    setImageUrl('');
    setImageFile(null);
    setImagePreview('');
    setActionUrl('');
    setScope(isSuperAdmin ? NotificationScope.GLOBAL : NotificationScope.INSTITUTE);
    setTargetUserTypes([NotificationTargetUserType.ALL]);
    setSelectedClassId('');
    setSelectedSubjectId('');
    setPriority(NotificationPriority.NORMAL);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imageUploading) { toast.error('Please wait — image is still uploading'); return; }
    setLoading(true);

    try {
      if (!title.trim()) throw new Error('Title is required');
      if (!body.trim()) throw new Error('Message body is required');
      if (targetUserTypes.length === 0) throw new Error('Select at least one target audience');
      if (scope !== NotificationScope.GLOBAL && !selectedInstitute?.id) {
        throw new Error('Institute must be selected for non-global notifications');
      }
      if (scope === NotificationScope.CLASS && !selectedClassId) throw new Error('Please select a class');
      if (scope === NotificationScope.SUBJECT && !selectedSubjectId) throw new Error(`Please select a ${subjectLabel.toLowerCase()}`);

      const payload: CreateNotificationPayload = {
        title: title.trim(),
        body: body.trim(),
        scope,
        targetUserTypes,
        priority,
        sendImmediately: true,
      };

      if (imageUrl) payload.imageUrl = imageUrl;
      if (actionUrl.trim()) payload.actionUrl = actionUrl.trim();

      if (scope !== NotificationScope.GLOBAL) payload.instituteId = selectedInstitute!.id;
      if (scope === NotificationScope.CLASS || scope === NotificationScope.SUBJECT) payload.classId = selectedClassId;
      if (scope === NotificationScope.SUBJECT) payload.subjectId = selectedSubjectId;

      await adminNotificationService.createNotification(payload);
      toast.success('Notification sent successfully!');
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  const availableScopes = getAvailableScopes();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Create Push Notification
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter notification title"
              maxLength={255}
              required
            />
            <p className="text-xs text-muted-foreground text-right">{title.length}/255</p>
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Message *</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter notification message"
              maxLength={5000}
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground text-right">{body.length}/5000</p>
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <Label>Notification Scope *</Label>
            <Select value={scope} onValueChange={(val) => setScope(val as NotificationScope)}>
              <SelectTrigger>
                <SelectValue placeholder="Select scope" />
              </SelectTrigger>
              <SelectContent>
                {availableScopes.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Class Selection with Search */}
          {(scope === NotificationScope.CLASS || scope === NotificationScope.SUBJECT) && (
            <div className="space-y-2">
              <Label>Select Class *</Label>
              <Popover open={classSearchOpen} onOpenChange={setClassSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={classSearchOpen}
                    className="w-full justify-between"
                    disabled={loadingClasses}
                  >
                    {loadingClasses 
                      ? "Loading..." 
                      : selectedClassId 
                        ? classes.find(c => c.id === selectedClassId)?.name || "Select a class"
                        : "Select a class"
                    }
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search classes..." 
                      value={classSearchQuery}
                      onValueChange={setClassSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No class found.</CommandEmpty>
                      <CommandGroup>
                        {filteredClasses.map((cls) => (
                          <CommandItem
                            key={cls.id}
                            value={cls.name}
                            onSelect={() => {
                              setSelectedClassId(cls.id);
                              setClassSearchOpen(false);
                              setClassSearchQuery('');
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedClassId === cls.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {cls.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Subject Selection with Search */}
          {scope === NotificationScope.SUBJECT && selectedClassId && (
            <div className="space-y-2">
              <Label>Select {subjectLabel} *</Label>
              <Popover open={subjectSearchOpen} onOpenChange={setSubjectSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={subjectSearchOpen}
                    className="w-full justify-between"
                    disabled={loadingSubjects}
                  >
                    {loadingSubjects 
                      ? "Loading..." 
                      : selectedSubjectId 
                        ? subjects.find(s => s.id === selectedSubjectId)?.name || `Select a ${subjectLabel.toLowerCase()}`
                        : `Select a ${subjectLabel.toLowerCase()}`
                    }
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search subjects..." 
                      value={subjectSearchQuery}
                      onValueChange={setSubjectSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No subject found.</CommandEmpty>
                      <CommandGroup>
                        {filteredSubjects.map((sub) => (
                          <CommandItem
                            key={sub.id}
                            value={sub.name}
                            onSelect={() => {
                              setSelectedSubjectId(sub.id);
                              setSubjectSearchOpen(false);
                              setSubjectSearchQuery('');
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedSubjectId === sub.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {sub.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Target Audience */}
          <div className="space-y-2">
            <Label>Target Audience *</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(NotificationTargetUserType).map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`target-${type}`}
                    checked={targetUserTypes.includes(type)}
                    onCheckedChange={(checked) => handleTargetUserTypeChange(type, !!checked)}
                  />
                  <label htmlFor={`target-${type}`} className="text-sm cursor-pointer">
                    {type === 'ALL' && 'Everyone'}
                    {type === 'STUDENTS' && 'Students'}
                    {type === 'PARENTS' && 'Parents'}
                    {type === 'TEACHERS' && 'Teachers'}
                    {type === 'ADMINS' && 'Admins'}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(val) => setPriority(val as NotificationPriority)}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Image (optional)</Label>
            {imagePreview ? (
              <div className="relative w-full rounded-xl overflow-hidden border border-border/50">
                <img src={imagePreview} alt="preview" className="w-full max-h-40 object-cover" />
                {imageUploading && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Uploading…</span>
                  </div>
                )}
                {!imageUploading && (
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 flex items-center justify-center hover:bg-background"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 w-full h-24 rounded-xl border-2 border-dashed border-border/60 cursor-pointer hover:bg-muted/40 transition-colors">
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Click to upload image</span>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleImageFileSelect}
                />
              </label>
            )}
          </div>

          {/* Action URL */}
          <div className="space-y-2">
            <Label htmlFor="actionUrl">Action URL (optional)</Label>
            <Input
              id="actionUrl"
              type="text"
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="/announcements/123 or https://..."
            />
            <p className="text-xs text-muted-foreground">Where to navigate when notification is clicked</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || imageUploading}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Send Now</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
