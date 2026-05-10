import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { enrollmentApi, EnrollmentSettingsResponse, ClassEnrollmentSummaryItem } from '@/api/enrollment.api';
import { instituteStudentsApi, StudentListRecord } from '@/api/instituteStudents.api';
import { classPaymentsApi, ClassPayment, ClassPaymentSubmission } from '@/api/classPayments.api';
import {
  Settings, Copy, Users, UserPlus, Loader2, Key, Lock, Unlock,
  CreditCard, Award, CheckCircle2, Info,
} from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TeacherEnrollmentManagerProps {
  instituteId: string;
  classId: string;
  subjectId: string;
  subjectName?: string;
  className?: string;
}

const PAYMENT_STATUSES = [
  { value: 'VERIFIED',         label: 'Full Payment',     desc: '100% paid' },
  { value: 'HALF_VERIFIED',    label: 'Half Payment',     desc: '50% paid' },
  { value: 'QUARTER_VERIFIED', label: 'Quarter Payment',  desc: '25% paid' },
];

const TeacherEnrollmentManager: React.FC<TeacherEnrollmentManagerProps> = ({
  instituteId, classId, subjectId, subjectName = 'Subject', className = 'Class',
}) => {
  const { toast } = useToast();

  const [settings, setSettings]     = useState<EnrollmentSettingsResponse | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Manual assignment
  const [availableStudents, setAvailableStudents]   = useState<StudentListRecord[]>([]);
  const [selectedStudents, setSelectedStudents]     = useState<string[]>([]);
  const [isLoadingStudents, setIsLoadingStudents]   = useState(false);

  // Payments tab (enroll from payment)
  const [classPaymentsList, setClassPaymentsList]               = useState<ClassPayment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId]               = useState('');
  const [paymentStatusFilters, setPaymentStatusFilters]         = useState<string[]>(['VERIFIED', 'HALF_VERIFIED', 'QUARTER_VERIFIED']);
  const [paymentSubmissions, setPaymentSubmissions]             = useState<ClassPaymentSubmission[]>([]);
  const [selectedPaymentStudents, setSelectedPaymentStudents]   = useState<string[]>([]);
  const [isLoadingPayments, setIsLoadingPayments]               = useState(false);

  // Free card tab
  const [freeCardStudents, setFreeCardStudents]                 = useState<ClassEnrollmentSummaryItem[]>([]);
  const [selectedFreeCardStudents, setSelectedFreeCardStudents] = useState<string[]>([]);
  const [isLoadingFreeCards, setIsLoadingFreeCards]             = useState(false);

  // ── Enrollment method config (Settings tab) ───────────────────────────────
  // "By Key" method
  const [keyMethodEnabled, setKeyMethodEnabled]   = useState(false);
  const [showKeyInput, setShowKeyInput]           = useState(false);
  const [customKey, setCustomKey]                 = useState('');

  // "By Payment" method
  const [payMethodEnabled, setPayMethodEnabled]   = useState(false);
  const [selectedPaymentRefId, setSelectedPaymentRefId] = useState('');
  const [allowedStatuses, setAllowedStatuses]           = useState<string[]>(['VERIFIED']);
  const [savingConfig, setSavingConfig]                 = useState(false);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadEnrollmentSettings();
    loadAvailableStudents();
    loadClassPaymentsList();
    loadFreeCardStudents();
  }, [instituteId, classId, subjectId]);

  useEffect(() => {
    if (selectedPaymentId) loadPaymentStudents();
    else { setPaymentSubmissions([]); setSelectedPaymentStudents([]); }
  }, [selectedPaymentId, paymentStatusFilters]);

  // Sync enrollment method state from loaded settings
  useEffect(() => {
    if (!settings) return;
    setKeyMethodEnabled(!!settings.enrollmentEnabled);
    setPayMethodEnabled(!!settings.enrollmentPaymentRefId);
    if (settings.enrollmentPaymentRefId) {
      setSelectedPaymentRefId(settings.enrollmentPaymentRefId);
      setAllowedStatuses(settings.enrollmentPaymentStatuses?.length ? settings.enrollmentPaymentStatuses : ['VERIFIED']);
    }
  }, [settings]);

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadEnrollmentSettings = async () => {
    setIsLoadingSettings(true);
    try {
      setSettings(await enrollmentApi.getEnrollmentSettings(instituteId, classId, subjectId));
    } catch (err: any) {
      // Silently ignore if the endpoint is deprecated (backend returns 410/deprecated error)
      const msg = err?.message || '';
      const isDeprecated = msg.toLowerCase().includes('deprecated') || err?.status === 410 || err?.status === 403;
      if (!isDeprecated) {
        toast({ title: 'Error', description: 'Failed to load enrollment settings', variant: 'destructive' });
      }
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const loadAvailableStudents = async () => {
    setIsLoadingStudents(true);
    try {
      const res = await instituteStudentsApi.getStudentsByClass(instituteId, classId, { limit: 1000 });
      setAvailableStudents(res.data || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load students', variant: 'destructive' });
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const loadClassPaymentsList = async () => {
    try {
      const res = await classPaymentsApi.getClassPayments(instituteId, classId, 1, 100, true);
      setClassPaymentsList(res.data || []);
    } catch { /* non-critical */ }
  };

  const loadFreeCardStudents = async () => {
    setIsLoadingFreeCards(true);
    try {
      setFreeCardStudents(await enrollmentApi.getClassEnrollmentSummary(instituteId, classId, 'free_card', undefined, true));
    } catch { /* non-critical */ } finally {
      setIsLoadingFreeCards(false);
    }
  };

  const loadPaymentStudents = async () => {
    setIsLoadingPayments(true);
    try {
      // Fetch ALL submissions for this class payment (large limit)
      const res = await classPaymentsApi.getPaymentSubmissions(selectedPaymentId, 1, 500);
      const all = (res.data || []) as ClassPaymentSubmission[];

      // STATUS_PRIORITY: higher = better. Used to keep the best submission per user.
      const STATUS_PRIORITY: Record<string, number> = {
        VERIFIED: 4,
        HALF_VERIFIED: 3,
        QUARTER_VERIFIED: 2,
        PENDING: 1,
        REJECTED: 0,
      };

      // Deduplicate: keep one row per userId (highest-priority status)
      const byUser = new Map<string, ClassPaymentSubmission>();
      for (const sub of all) {
        const existing = byUser.get(sub.userId);
        const newPrio = STATUS_PRIORITY[sub.status] ?? 0;
        const existingPrio = existing ? (STATUS_PRIORITY[existing.status] ?? 0) : -1;
        if (newPrio > existingPrio) byUser.set(sub.userId, sub);
      }

      // Filter by any of the selected status filters
      const filtered = Array.from(byUser.values()).filter(s =>
        paymentStatusFilters.length === 0 || paymentStatusFilters.includes(s.status),
      );
      setPaymentSubmissions(filtered);
      setSelectedPaymentStudents([]);
    } catch {
      toast({ title: 'Error', description: 'Failed to load payment submissions', variant: 'destructive' });
    } finally {
      setIsLoadingPayments(false);
    }
  };

  // ── Save enrollment method config ─────────────────────────────────────────
  const saveEnrollmentConfig = async () => {
    setSavingConfig(true);
    try {
      // enrollmentEnabled = key method is on OR payment method is on (either way, enrollment is open)
      const enrollmentEnabled = keyMethodEnabled || payMethodEnabled;
      const updated = await enrollmentApi.updateEnrollmentSettings(
        instituteId, classId, subjectId,
        enrollmentEnabled,
        // Keep existing key if key-method is on; clear it if off
        keyMethodEnabled ? (settings?.enrollmentKey ?? undefined) : '',
        undefined,
        {
          enrollmentFeeRequired: payMethodEnabled,
          enrollmentPaymentRefId: payMethodEnabled ? selectedPaymentRefId : undefined,
          enrollmentPaymentStatuses: payMethodEnabled ? allowedStatuses : undefined,
        },
      );
      setSettings(updated);
      toast({ title: 'Saved', description: 'Enrollment settings updated.' });
    } catch (err) {
      toast({ title: 'Failed', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setSavingConfig(false);
    }
  };

  const updateEnrollmentKey = async (key: string) => {
    setIsLoading(true);
    try {
      setSettings(await enrollmentApi.updateEnrollmentSettings(
        instituteId, classId, subjectId, true, key || undefined,
      ));
      setShowKeyInput(false); setCustomKey('');
      toast({ title: 'Updated', description: key ? 'Enrollment key set' : 'Key cleared (open enrollment)' });
    } catch (err) {
      toast({ title: 'Failed', description: getErrorMessage(err), variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const copyEnrollmentKey = async () => {
    if (!settings?.enrollmentKey) return;
    try {
      await navigator.clipboard.writeText(settings.enrollmentKey);
      toast({ title: 'Copied', description: 'Enrollment key copied to clipboard' });
    } catch {
      toast({ title: 'Copy Failed', variant: 'destructive' });
    }
  };

  // ── Enrollment assignment ─────────────────────────────────────────────────
  const performAssignment = async (
    studentIds: string[],
    successMsg: string,
    postEnrollAction?: (ids: string[]) => Promise<void>,
  ) => {
    if (!studentIds.length) return;
    setIsLoading(true);
    try {
      const result = await enrollmentApi.teacherAssignStudents(instituteId, classId, subjectId, studentIds);
      if (result.successCount > 0 && postEnrollAction) {
        await postEnrollAction(result.successfulAssignments.map(a => a.studentId));
      }
      if (result.failedCount > 0) {
        toast({ title: 'Partial Success', description: `${result.successCount} assigned, ${result.failedCount} failed` });
      } else {
        toast({ title: 'Done', description: successMsg });
      }
      loadEnrollmentSettings();
    } catch (err) {
      toast({ title: 'Failed', description: getErrorMessage(err), variant: 'destructive' });
    } finally { setIsLoading(false); }
  };

  const assignStudents       = async () => { await performAssignment(selectedStudents, `${selectedStudents.length} student(s) assigned`); setSelectedStudents([]); };
  const assignPaymentStudents = async () => { await performAssignment(selectedPaymentStudents, `${selectedPaymentStudents.length} student(s) enrolled from payment`); setSelectedPaymentStudents([]); };
  const assignFreeCardStudents = async () => {
    await performAssignment(
      selectedFreeCardStudents,
      `${selectedFreeCardStudents.length} free card student(s) enrolled`,
      async (ids) => {
        await Promise.allSettled(ids.map(id =>
          enrollmentApi.updateStudentType(instituteId, classId, subjectId, id, 'free_card'),
        ));
      },
    );
    setSelectedFreeCardStudents([]);
  };

  const toggleStatus = (status: string) =>
    setAllowedStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoadingSettings) {
    return <Card><CardContent className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  }

  const isSelfEnrollmentActive = settings?.enrollmentEnabled || !!settings?.enrollmentPaymentRefId;

  return (
    <Tabs defaultValue="settings" className="w-full space-y-6">
      <TabsList className="grid grid-cols-4 w-full h-auto gap-1 p-1 bg-muted/50 rounded-xl">
        <TabsTrigger value="settings" className="py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
          <Settings className="w-3.5 h-3.5 mr-1.5" />Settings
        </TabsTrigger>
        <TabsTrigger value="manual" className="py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
          <UserPlus className="w-3.5 h-3.5 mr-1.5" />Manual
        </TabsTrigger>
        <TabsTrigger value="payments" className="py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
          <CreditCard className="w-3.5 h-3.5 mr-1.5" />Payments
        </TabsTrigger>
        <TabsTrigger value="free_card" className="py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
          <Award className="w-3.5 h-3.5 mr-1.5" />Free Cards
        </TabsTrigger>
      </TabsList>

      {/* ── Settings Tab ── */}
      <TabsContent value="settings" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />Enrollment Settings
            </CardTitle>
            <CardDescription>Configure how students self-enroll in <strong>{subjectName}</strong></CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {settings && (
              <>
                {/* Status summary */}
                <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg text-center">
                  <div>
                    <div className="text-2xl font-bold text-primary">{settings.currentEnrollmentCount}</div>
                    <div className="text-xs text-muted-foreground">Enrolled</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Self-Enrollment</div>
                    <Badge variant={isSelfEnrollmentActive ? 'default' : 'secondary'} className="text-xs">
                      {isSelfEnrollmentActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                </div>

                <Alert className="py-2 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                  <Info className="h-3.5 w-3.5 text-blue-500" />
                  <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
                    Enable one or both methods. Students who satisfy <em>either</em> condition will be enrolled.
                  </AlertDescription>
                </Alert>

                <Separator />

                {/* ── Method 1: By Enrollment Key ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-amber-500" />
                      <div>
                        <Label className="font-medium">Method 1 — By Enrollment Key</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Students enter a key you share with them</p>
                      </div>
                    </div>
                    <Switch
                      checked={keyMethodEnabled}
                      onCheckedChange={v => { setKeyMethodEnabled(v); if (!v) setShowKeyInput(false); }}
                      disabled={savingConfig}
                    />
                  </div>

                  {keyMethodEnabled && (
                    <div className="space-y-3 pl-6 border-l-2 border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2">
                        {settings.enrollmentKey
                          ? <code className="flex-1 p-2 bg-muted border rounded font-mono text-sm">{settings.enrollmentKey}</code>
                          : <span className="text-sm text-muted-foreground italic">No key — open enrollment</span>}
                        {settings.enrollmentKey && (
                          <Button size="icon" variant="outline" onClick={copyEnrollmentKey}><Copy className="h-4 w-4" /></Button>
                        )}
                      </div>
                      {!showKeyInput ? (
                        <div className="flex gap-2">
                          {settings.enrollmentKey ? (
                            <Button size="sm" variant="outline" onClick={() => updateEnrollmentKey('')} disabled={isLoading}>
                              <Unlock className="h-3 w-3 mr-1" />Clear Key
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setShowKeyInput(true)} disabled={isLoading}>
                              <Key className="h-3 w-3 mr-1" />Set Key
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-2 items-end">
                          <Input
                            placeholder="e.g. MATH-2026"
                            value={customKey}
                            onChange={e => setCustomKey(e.target.value.toUpperCase())}
                            maxLength={50}
                            className="h-8 text-sm font-mono"
                          />
                          <Button size="sm" onClick={() => updateEnrollmentKey(customKey)} disabled={isLoading || !customKey.trim()}>Set</Button>
                          <Button size="sm" variant="outline" onClick={() => { setShowKeyInput(false); setCustomKey(''); }}>Cancel</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* ── Method 2: By Payment ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-green-500" />
                      <div>
                        <Label className="font-medium">Method 2 — By Class Payment</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Students enroll automatically once their payment is verified</p>
                      </div>
                    </div>
                    <Switch
                      checked={payMethodEnabled}
                      onCheckedChange={v => { setPayMethodEnabled(v); if (!v) { setSelectedPaymentRefId(''); setAllowedStatuses(['VERIFIED']); } }}
                      disabled={savingConfig}
                    />
                  </div>

                  {payMethodEnabled && (
                    <div className="space-y-3 pl-6 border-l-2 border-green-200 dark:border-green-800">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Required Class Payment</Label>
                        <Select value={selectedPaymentRefId} onValueChange={setSelectedPaymentRefId}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select a class payment…" />
                          </SelectTrigger>
                          <SelectContent>
                            {classPaymentsList.length === 0 && (
                              <SelectItem value="__none" disabled>No class payments found — create one first</SelectItem>
                            )}
                            {classPaymentsList.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                <span className="font-medium">{p.title}</span>
                                {p.amount && <span className="text-muted-foreground ml-1.5 text-xs">· Rs {parseFloat(p.amount).toLocaleString()}</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Accept students with these payment tiers</Label>
                        <div className="flex flex-wrap gap-3">
                          {PAYMENT_STATUSES.map(s => (
                            <label key={s.value} className="flex items-center gap-2 cursor-pointer group">
                              <Checkbox
                                checked={allowedStatuses.includes(s.value)}
                                onCheckedChange={() => toggleStatus(s.value)}
                                className="h-4 w-4"
                              />
                              <span className="text-sm font-medium">{s.label}</span>
                              <span className="text-xs text-muted-foreground">({s.desc})</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {settings.enrollmentPaymentRefId && (
                        <Alert className="py-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <AlertDescription className="text-xs">
                            Payment gate is active. Students with a matching verified submission enroll instantly.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  onClick={saveEnrollmentConfig}
                  disabled={savingConfig || (payMethodEnabled && !selectedPaymentRefId) || (payMethodEnabled && allowedStatuses.length === 0)}
                  className="w-full mt-2"
                >
                  {savingConfig ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : null}
                  Save Enrollment Settings
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Manual Enroll Tab ── */}
      <TabsContent value="manual" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" />Manual Student Assignment</CardTitle>
            <CardDescription>Select students from the class to assign directly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingStudents ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="font-medium text-sm">Class Students</span>
                    <Badge variant="secondary">{availableStudents.length}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedStudents(availableStudents.map(s => s.id))}>All</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedStudents([])}>None</Button>
                  </div>
                </div>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="p-4 space-y-2">
                    {availableStudents.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No students in this class.</p>}
                    {availableStudents.map(student => (
                      <div key={student.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`std-${student.id}`}
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={checked => {
                            if (checked) setSelectedStudents(p => [...p, student.id]);
                            else setSelectedStudents(p => p.filter(id => id !== student.id));
                          }}
                        />
                        <label htmlFor={`std-${student.id}`} className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                              <span className="text-xs font-medium">{student.name.charAt(0)}</span>
                            </div>
                            <div>
                              <div className="text-sm font-medium">{student.name}</div>
                              <div className="text-xs text-muted-foreground">{student.email}</div>
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={assignStudents} disabled={!selectedStudents.length || isLoading} className="w-full">
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Assign {selectedStudents.length} Student{selectedStudents.length !== 1 ? 's' : ''}
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      {/* ── From Payments Tab ── */}
      <TabsContent value="payments" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-4 w-4" />Enroll From Class Payments</CardTitle>
            <CardDescription>Bulk-enroll students based on their class-level payment status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Payment selector */}
            <div className="space-y-1.5">
              <Label className="text-sm">Class Payment</Label>
              <Select value={selectedPaymentId} onValueChange={setSelectedPaymentId}>
                <SelectTrigger><SelectValue placeholder="Select a class payment" /></SelectTrigger>
                <SelectContent>
                  {classPaymentsList.length === 0 && <SelectItem value="__none" disabled>No payments found — create one first</SelectItem>}
                  {classPaymentsList.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-medium">{p.title}</span>
                      {p.amount && <span className="text-muted-foreground ml-1.5 text-xs">· Rs {parseFloat(p.amount).toLocaleString()}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Multi-status filter checkboxes */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Include payment tiers</Label>
              <div className="flex flex-wrap gap-4 p-3 border rounded-lg bg-muted/30">
                {PAYMENT_STATUSES.map(s => (
                  <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={paymentStatusFilters.includes(s.value)}
                      onCheckedChange={(checked) => {
                        setPaymentStatusFilters(prev =>
                          checked
                            ? [...prev, s.value]
                            : prev.filter(x => x !== s.value)
                        );
                      }}
                      disabled={!selectedPaymentId}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium">{s.label}</span>
                    <span className="text-xs text-muted-foreground">({s.desc})</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedPaymentId && (
              isLoadingPayments ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">
                        {paymentSubmissions.length} student{paymentSubmissions.length !== 1 ? 's' : ''} qualify
                      </span>
                      <Badge variant="secondary" className="text-xs">{selectedPaymentStudents.length} selected</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedPaymentStudents(paymentSubmissions.map(s => s.userId))}>All</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedPaymentStudents([])}>None</Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[250px] border rounded-lg">
                    <div className="p-4 space-y-2">
                      {paymentSubmissions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No students with this status.</p>}
                      {paymentSubmissions.map(sub => (
                        <div key={sub.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`pay-${sub.userId}`}
                            checked={selectedPaymentStudents.includes(sub.userId)}
                            onCheckedChange={checked => {
                              if (checked) setSelectedPaymentStudents(p => [...p, sub.userId]);
                              else setSelectedPaymentStudents(p => p.filter(id => id !== sub.userId));
                            }}
                          />
                          <label htmlFor={`pay-${sub.userId}`} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{sub.username || 'Student'}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    sub.status === 'VERIFIED' ? 'border-green-300 text-green-700 bg-green-50 dark:bg-green-950/30' :
                                    sub.status === 'HALF_VERIFIED' ? 'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/30' :
                                    sub.status === 'QUARTER_VERIFIED' ? 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30' :
                                    ''
                                  }`}
                                >
                                  {sub.status === 'VERIFIED' ? 'Full' : sub.status === 'HALF_VERIFIED' ? 'Half' : sub.status === 'QUARTER_VERIFIED' ? 'Quarter' : sub.status}
                                </Badge>
                                <Badge variant="outline" className="text-xs">Rs {parseFloat(sub.submittedAmount || '0').toLocaleString()}</Badge>
                              </div>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )
            )}

            {!selectedPaymentId && (
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
                <CreditCard className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">Select a class payment to see students</p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={assignPaymentStudents} disabled={!selectedPaymentStudents.length || isLoading} className="w-full">
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Enroll {selectedPaymentStudents.length} Student{selectedPaymentStudents.length !== 1 ? 's' : ''}
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      {/* ── Free Cards Tab ── */}
      <TabsContent value="free_card" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Award className="h-4 w-4" />Enroll Free Card Students</CardTitle>
            <CardDescription>Students with a class-level free card are fee-exempt — enroll them directly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingFreeCards ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">Free Card Holders</span>
                    <Badge variant="secondary">{freeCardStudents.length}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedFreeCardStudents(freeCardStudents.map(s => s.studentId))}>All</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedFreeCardStudents([])}>None</Button>
                  </div>
                </div>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="p-4 space-y-2">
                    {freeCardStudents.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No free card students found in this class.</p>}
                    {freeCardStudents.map(student => (
                      <div key={student.studentId} className="flex items-center gap-2">
                        <Checkbox
                          id={`free-${student.studentId}`}
                          checked={selectedFreeCardStudents.includes(student.studentId)}
                          onCheckedChange={checked => {
                            if (checked) setSelectedFreeCardStudents(p => [...p, student.studentId]);
                            else setSelectedFreeCardStudents(p => p.filter(id => id !== student.studentId));
                          }}
                        />
                        <label htmlFor={`free-${student.studentId}`} className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center shrink-0">
                              <span className="text-xs font-medium text-purple-700 dark:text-purple-300">{student.name?.charAt(0) || 'S'}</span>
                            </div>
                            <div>
                              <div className="text-sm font-medium">{student.name}</div>
                              <div className="text-xs text-muted-foreground">{student.email}</div>
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={assignFreeCardStudents} disabled={!selectedFreeCardStudents.length || isLoading} className="w-full">
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Award className="h-4 w-4 mr-2" />}
              Enroll {selectedFreeCardStudents.length} Free Card Student{selectedFreeCardStudents.length !== 1 ? 's' : ''}
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default TeacherEnrollmentManager;
