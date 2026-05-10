import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2, AlertCircle, CheckCircle, Key, Unlock, BookOpen,
  GraduationCap, Users, Search, Clock, CreditCard, Info, Banknote,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { TeacherAutocomplete } from '@/components/ui/teacher-autocomplete';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useToast } from '@/hooks/use-toast';
import { getBaseUrl, getApiHeadersAsync } from '@/contexts/utils/auth.api';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';
import { classPaymentsApi, ClassPayment } from '@/api/classPayments.api';

interface AssignSubjectToClassFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  preselectedClassId?: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  creditHours: number;
  isActive: boolean;
}

interface ClassOption {
  id: string;
  name: string;
  code: string;
  grade: number;
  specialty: string;
}

interface AssignResponse {
  success: boolean;
  message: string;
  assignedCount: number;
  skippedCount: number;
}

interface SubjectEnrollment {
  keyEnabled: boolean;
  key: string;
  payMethodEnabled: boolean;
  paymentRefId: string;
  allowedStatuses: string[];
}

const DEFAULT_ENROLLMENT: SubjectEnrollment = {
  keyEnabled: false,
  key: '',
  payMethodEnabled: false,
  paymentRefId: '',
  allowedStatuses: ['VERIFIED'],
};

const PAYMENT_STATUS_OPTIONS = [
  { value: 'VERIFIED',         label: 'Full Payment',    desc: '100%' },
  { value: 'HALF_VERIFIED',    label: 'Half Payment',    desc: '50%'  },
  { value: 'QUARTER_VERIFIED', label: 'Quarter Payment', desc: '25%'  },
];

const AssignSubjectToClassForm: React.FC<AssignSubjectToClassFormProps> = ({
  onSuccess, onCancel, preselectedClassId,
}) => {
  const { currentInstituteId, user } = useAuth();
  const userRole = useInstituteRole();
  const { toast } = useToast();

  const [selectedClassId, setSelectedClassId] = useState(preselectedClassId || '');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [defaultTeacherId, setDefaultTeacherId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [classesLoading, setClassesLoading] = useState(false);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [showClassSelector, setShowClassSelector] = useState(!preselectedClassId);
  const [assignResult, setAssignResult] = useState<AssignResponse | null>(null);
  const [enrollmentSettings, setEnrollmentSettings] = useState<Record<string, SubjectEnrollment>>({});
  const [classPayments, setClassPayments] = useState<ClassPayment[]>([]);
  const [loadingClassPayments, setLoadingClassPayments] = useState(false);

  if (userRole !== 'Teacher' && userRole !== 'InstituteAdmin') {
    return (
      <div className="p-4 text-center">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Access Denied: Only Institute Admins and Teachers can assign subjects.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const getEnrollment = (id: string): SubjectEnrollment =>
    enrollmentSettings[id] || DEFAULT_ENROLLMENT;

  const updateEnrollment = (id: string, patch: Partial<SubjectEnrollment>) =>
    setEnrollmentSettings(prev => ({
      ...prev,
      [id]: { ...getEnrollment(id), ...patch },
    }));

  const toggleStatus = (id: string, status: string) => {
    const cur = getEnrollment(id).allowedStatuses;
    updateEnrollment(id, {
      allowedStatuses: cur.includes(status) ? cur.filter(s => s !== status) : [...cur, status],
    });
  };

  // ── API Loaders ────────────────────────────────────────────────────────────

  const loadClassPayments = async (classId: string) => {
    if (!currentInstituteId || !classId) return;
    setLoadingClassPayments(true);
    try {
      const res = await classPaymentsApi.getClassPayments(currentInstituteId, classId, 1, 100, true);
      setClassPayments(res.data || []);
    } catch { /* non-critical */ } finally {
      setLoadingClassPayments(false);
    }
  };

  React.useEffect(() => {
    if (preselectedClassId && currentInstituteId) loadClassPayments(preselectedClassId);
  }, [preselectedClassId, currentInstituteId]);

  const handleLoadSubjects = async () => {
    if (!currentInstituteId) return;
    setSubjectsLoading(true);
    try {
      const result: Subject[] = await enhancedCachedClient.get(
        '/subjects',
        { page: '1', limit: '50', instituteId: currentInstituteId },
        { ttl: CACHE_TTL.SUBJECTS, userId: user?.id, role: userRole, instituteId: currentInstituteId },
      );
      setSubjects(result.filter(s => s.isActive));
    } catch {
      toast({ title: 'Load Failed', description: 'Failed to load subjects.', variant: 'destructive' });
    } finally {
      setSubjectsLoading(false);
    }
  };

  const handleLoadClasses = async () => {
    if (!currentInstituteId) return;
    setClassesLoading(true);
    try {
      let classData: any[] = [];
      if (userRole === 'Teacher' && user?.id) {
        const r = await enhancedCachedClient.get(
          `/institute-classes/${currentInstituteId}/teacher/${user.id}`,
          { page: '1', limit: '10' },
          { ttl: CACHE_TTL.CLASSES, userId: user?.id, role: userRole, instituteId: currentInstituteId },
        );
        classData = (r.data || []).map((i: any) => i.class || i);
      } else {
        classData = await enhancedCachedClient.get(
          `/institute-classes/institute/${currentInstituteId}`,
          {},
          { ttl: CACHE_TTL.CLASSES, userId: user?.id, role: userRole, instituteId: currentInstituteId },
        );
      }
      const mapped: ClassOption[] = classData.map((c: any) => ({
        id: c.id, name: c.name, code: c.code, grade: c.grade, specialty: c.specialty,
      }));
      setClasses(mapped);
      setShowClassSelector(false);
      if (mapped.length === 1) loadClassPayments(mapped[0].id);
    } catch {
      toast({ title: 'Load Failed', description: 'Failed to load classes.', variant: 'destructive' });
    } finally {
      setClassesLoading(false);
    }
  };

  const handleSubjectToggle = (id: string) =>
    setSelectedSubjectIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id],
    );

  const handleAssignSubjects = async () => {
    if (!selectedClassId || selectedSubjectIds.length === 0 || !currentInstituteId) {
      toast({ title: 'Error', description: 'Select a class and at least one subject.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const baseUrl = getBaseUrl();
      const headers = await getApiHeadersAsync();
      const subjectsPayload = selectedSubjectIds.map(id => {
        const e = getEnrollment(id);
        const enrollmentEnabled = e.keyEnabled || e.payMethodEnabled;
        return {
          subjectId: id,
          teacherId: defaultTeacherId || undefined,
          isActive: true,
          enrollmentEnabled,
          enrollmentKey: e.keyEnabled && e.key ? e.key : undefined,
          enrollmentFeeRequired: e.payMethodEnabled,
          enrollmentPaymentRefId: e.payMethodEnabled && e.paymentRefId ? e.paymentRefId : undefined,
          enrollmentPaymentStatuses:
            e.payMethodEnabled && e.paymentRefId && e.allowedStatuses.length > 0
              ? e.allowedStatuses
              : undefined,
        };
      });
      const res = await fetch(
        `${baseUrl}/institutes/${currentInstituteId}/classes/${selectedClassId}/subjects/bulk`,
        { method: 'POST', headers, body: JSON.stringify({ subjects: subjectsPayload, defaultTeacherId: defaultTeacherId || user?.id }) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result: AssignResponse = await res.json();
      setAssignResult(result);
      toast({ title: 'Assignment Complete', description: result.message });
      if (result.assignedCount > 0) onSuccess();
    } catch {
      toast({ title: 'Assignment Failed', description: 'Failed to assign subjects.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSubjects = subjects.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedClass = classes.find(c => c.id === selectedClassId);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">

      {/* ── Step 1: Load / Select Class ── */}
      {showClassSelector ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <GraduationCap className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Load available classes to get started</p>
            <Button onClick={handleLoadClasses} disabled={classesLoading}>
              {classesLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading…</> : <><GraduationCap className="h-4 w-4 mr-2" />Load Classes</>}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Class selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />Class
            </Label>
            <Select value={selectedClassId} onValueChange={v => { setSelectedClassId(v); loadClassPayments(v); }}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a class…" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2 sticky top-0 bg-popover z-10">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search…" className="pl-8 h-8" value={classSearchQuery}
                      onChange={e => setClassSearchQuery(e.target.value)} />
                  </div>
                </div>
                <ScrollArea className="max-h-48">
                  {classes
                    .filter(c =>
                      c.name.toLowerCase().includes(classSearchQuery.toLowerCase()) ||
                      c.code.toLowerCase().includes(classSearchQuery.toLowerCase()))
                    .map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{c.name}</span>
                          <Badge variant="secondary" className="text-xs">{c.code}</Badge>
                          <Badge variant="outline" className="text-xs">G{c.grade}</Badge>
                        </span>
                      </SelectItem>
                    ))}
                </ScrollArea>
              </SelectContent>
            </Select>
            {selectedClass && (
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                <Badge className="bg-primary/10 text-primary border-primary/20">{selectedClass.code}</Badge>
                <span className="font-medium text-sm">{selectedClass.name}</span>
                <Badge variant="outline" className="text-xs">Grade {selectedClass.grade}</Badge>
                {selectedClass.specialty && <Badge variant="secondary" className="text-xs">{selectedClass.specialty}</Badge>}
              </div>
            )}
          </div>

          {/* Teacher */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />Default Teacher
              <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <TeacherAutocomplete value={defaultTeacherId} onChange={setDefaultTeacherId} placeholder="Search teacher by name…" />
          </div>

          {/* Subject list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />Subjects
              </Label>
              {subjects.length === 0 ? (
                <Button size="sm" variant="outline" onClick={handleLoadSubjects} disabled={subjectsLoading}>
                  {subjectsLoading
                    ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Loading…</>
                    : <><BookOpen className="h-3 w-3 mr-1.5" />Load Subjects</>}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">{filteredSubjects.length} of {subjects.length}</span>
              )}
            </div>

            {subjects.length > 0 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search subjects…" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)} className="pl-8" />
              </div>
            )}

            {subjects.length > 0 ? (
              <ScrollArea className="h-44 border rounded-lg">
                <div className="p-2 space-y-1">
                  {filteredSubjects.map(s => (
                    <div
                      key={s.id}
                      onClick={() => handleSubjectToggle(s.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors hover:bg-accent/50 ${
                        selectedSubjectIds.includes(s.id) ? 'bg-primary/10 border border-primary/20' : 'border border-transparent'
                      }`}
                    >
                      <Checkbox
                        checked={selectedSubjectIds.includes(s.id)}
                        onCheckedChange={() => handleSubjectToggle(s.id)}
                        onClick={e => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.code}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant="outline" className="text-xs">{s.category}</Badge>
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="h-3 w-3 mr-0.5" />{s.creditHours}h
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {filteredSubjects.length === 0 && searchQuery && (
                    <p className="text-center text-muted-foreground py-6 text-sm">No subjects match "{searchQuery}"</p>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="border rounded-lg p-8 text-center bg-muted/30">
                <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Click "Load Subjects" to continue</p>
              </div>
            )}
          </div>

          {/* ── Per-Subject Enrollment Settings ── */}
          {selectedSubjectIds.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="rounded-full">{selectedSubjectIds.length}</Badge>
                <span className="text-sm text-muted-foreground">subject(s) selected</span>
              </div>

              <Card className="border-dashed">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    Enrollment Settings
                    <span className="text-muted-foreground font-normal">(Per Subject)</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Configure self-enrollment for each selected subject
                  </p>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-4">
                  {/* Info note */}
                  <Alert className="py-2 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                    <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
                      Enable one or both methods per subject. A student satisfying <em>either</em> condition will be enrolled.
                    </AlertDescription>
                  </Alert>

                  {selectedSubjectIds.map(subjectId => {
                    const subject = subjects.find(s => s.id === subjectId);
                    const e = getEnrollment(subjectId);
                    if (!subject) return null;

                    return (
                      <div key={subjectId} className="rounded-lg border bg-card overflow-hidden">
                        {/* Subject header */}
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b">
                          <BookOpen className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium text-sm flex-1 truncate">{subject.name}</span>
                          <Badge variant="outline" className="text-xs shrink-0">{subject.code}</Badge>
                        </div>

                        <div className="p-4 space-y-4">
                          {/* ── Method 1: By Key ── */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Key className="h-3.5 w-3.5 text-amber-500" />
                                <Label className="text-sm font-medium cursor-pointer">By Enrollment Key</Label>
                                {e.keyEnabled && (
                                  e.key
                                    ? <Badge variant="secondary" className="text-xs"><Key className="h-2.5 w-2.5 mr-1" />Key Set</Badge>
                                    : <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-xs"><Unlock className="h-2.5 w-2.5 mr-1" />Open</Badge>
                                )}
                              </div>
                              <Switch
                                checked={e.keyEnabled}
                                onCheckedChange={v => updateEnrollment(subjectId, { keyEnabled: v, key: v ? e.key : '' })}
                              />
                            </div>
                            {e.keyEnabled && (
                              <div className="pl-5 space-y-1">
                                <div className="relative">
                                  <Key className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                  <Input
                                    placeholder="e.g. MATH-2026 (leave empty for open enrollment)"
                                    value={e.key}
                                    onChange={ev => updateEnrollment(subjectId, { key: ev.target.value.toUpperCase() })}
                                    maxLength={50}
                                    className="pl-8 h-9 text-sm font-mono"
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Empty = any class student can enroll without a key
                                </p>
                              </div>
                            )}
                          </div>

                          <Separator />

                          {/* ── Method 2: By Payment ── */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-3.5 w-3.5 text-green-500" />
                                <Label className="text-sm font-medium cursor-pointer">By Class Payment</Label>
                                {e.payMethodEnabled && e.paymentRefId && (
                                  <Badge className="bg-green-500/10 text-green-600 border-green-200 text-xs">
                                    <Banknote className="h-2.5 w-2.5 mr-1" />Gate Active
                                  </Badge>
                                )}
                              </div>
                              <Switch
                                checked={e.payMethodEnabled}
                                onCheckedChange={v => updateEnrollment(subjectId, {
                                  payMethodEnabled: v,
                                  paymentRefId: v ? e.paymentRefId : '',
                                  allowedStatuses: v ? (e.allowedStatuses.length ? e.allowedStatuses : ['VERIFIED']) : ['VERIFIED'],
                                })}
                              />
                            </div>

                            {e.payMethodEnabled && (
                              <div className="pl-5 space-y-3">
                                {/* Payment selector */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground font-medium">Required Class Payment</Label>
                                  {loadingClassPayments ? (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground h-9">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />Loading payments…
                                    </div>
                                  ) : classPayments.length === 0 ? (
                                    <Alert className="py-2 border-orange-200 bg-orange-50 dark:bg-orange-950/30">
                                      <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                                      <AlertDescription className="text-xs text-orange-700 dark:text-orange-300">
                                        No class payments found. Select a class first, then create a class payment.
                                      </AlertDescription>
                                    </Alert>
                                  ) : (
                                    <Select
                                      value={e.paymentRefId || '__none'}
                                      onValueChange={v => updateEnrollment(subjectId, { paymentRefId: v === '__none' ? '' : v })}
                                    >
                                      <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="Select payment…" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none">
                                          <span className="text-muted-foreground">No payment gate</span>
                                        </SelectItem>
                                        {classPayments.map(p => (
                                          <SelectItem key={p.id} value={p.id}>
                                            <span className="font-medium">{p.title}</span>
                                            <span className="text-muted-foreground ml-1.5 text-xs">
                                              · Rs {parseFloat(p.amount).toLocaleString()}
                                            </span>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>

                                {/* Allowed tiers */}
                                {e.paymentRefId && e.paymentRefId !== '__none' && (
                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground font-medium">Accept students with these payment tiers</Label>
                                    <div className="flex flex-wrap gap-3">
                                      {PAYMENT_STATUS_OPTIONS.map(opt => (
                                        <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                                          <Checkbox
                                            checked={e.allowedStatuses.includes(opt.value)}
                                            onCheckedChange={() => toggleStatus(subjectId, opt.value)}
                                            className="h-4 w-4"
                                          />
                                          <span className="text-sm">{opt.label}</span>
                                          <span className="text-xs text-muted-foreground">({opt.desc})</span>
                                        </label>
                                      ))}
                                    </div>
                                    {e.allowedStatuses.length === 0 && (
                                      <p className="text-xs text-red-500">Select at least one payment tier.</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Assignment result */}
          {assignResult && (
            <Alert variant={assignResult.success ? 'default' : 'destructive'}>
              {assignResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertDescription className="text-sm space-y-1">
                <p className="font-medium">{assignResult.message}</p>
                {assignResult.assignedCount > 0 && (
                  <p className="text-green-700 dark:text-green-300">✓ {assignResult.assignedCount} subject(s) assigned</p>
                )}
                {assignResult.skippedCount > 0 && (
                  <p className="text-amber-600">⚠ {assignResult.skippedCount} skipped (already assigned)</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t sticky bottom-0 bg-background pb-1">
            <Button variant="outline" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleAssignSubjects}
              disabled={isLoading || !selectedClassId || selectedSubjectIds.length === 0}
              className="w-full sm:w-auto"
            >
              {isLoading
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Assigning…</>
                : <><CheckCircle className="h-4 w-4 mr-2" />Assign {selectedSubjectIds.length > 0 ? `${selectedSubjectIds.length} ` : ''}Subjects</>}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default AssignSubjectToClassForm;
