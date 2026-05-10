import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { enrollmentApi, ClassEnrollmentSummaryItem } from '@/api/enrollment.api';
import { subjectPaymentsApi, SubjectPayment } from '@/api/subjectPayments.api';
import { getImageUrl } from '@/utils/imageUrlHelper';
import {
  CreditCard, Users, CheckCircle, XCircle, Loader2, Gift,
  CircleDollarSign, ArrowRight, RotateCcw, UserCheck, AlertTriangle,
} from 'lucide-react';

type PaymentTier = 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'free_card';

interface StudentRow {
  studentId: string;
  name: string;
  imageUrl?: string | null;
  paymentStatus: 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'PENDING' | 'NOT_SUBMITTED' | 'free_card';
  amount?: number | null;
  alreadyEnrolled: boolean;
  isFreeCard: boolean;
  selected: boolean;
}

interface EnrollResult {
  success: number;
  failed: number;
  alreadyEnrolled: number;
  failures: { name: string; reason: string }[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  instituteId: string;
  classId: string;
  subjectId: string;
  subjectName?: string;
  onSuccess?: () => void;
}

const TIER_OPTIONS: { value: PaymentTier; label: string; color: string; icon: React.ReactNode }[] = [
  { value: 'VERIFIED',       label: 'Full Paid',   color: 'bg-green-100 text-green-800 border-green-300',  icon: <CheckCircle className="h-3 w-3" /> },
  { value: 'HALF_VERIFIED',  label: 'Half Paid',   color: 'bg-orange-100 text-orange-800 border-orange-300', icon: <CircleDollarSign className="h-3 w-3" /> },
  { value: 'QUARTER_VERIFIED', label: 'Quarter Paid', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: <CircleDollarSign className="h-3 w-3" /> },
  { value: 'free_card',      label: 'Free Card',   color: 'bg-violet-100 text-violet-800 border-violet-300', icon: <Gift className="h-3 w-3" /> },
];

const statusBadge = (s: StudentRow['paymentStatus']) => {
  const map: Record<string, { cls: string; label: string }> = {
    VERIFIED:        { cls: 'bg-green-100 text-green-800 border-green-300',   label: 'Full Paid' },
    HALF_VERIFIED:   { cls: 'bg-orange-100 text-orange-800 border-orange-300', label: 'Half Paid' },
    QUARTER_VERIFIED:{ cls: 'bg-purple-100 text-purple-800 border-purple-300', label: 'Qtr Paid' },
    PENDING:         { cls: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'Pending' },
    NOT_SUBMITTED:   { cls: 'bg-gray-100 text-gray-600 border-gray-200',       label: 'Not Paid' },
    free_card:       { cls: 'bg-violet-100 text-violet-800 border-violet-300', label: 'Free Card' },
  };
  const m = map[s] || map.NOT_SUBMITTED;
  return <Badge className={`text-[10px] px-1.5 py-0 border ${m.cls}`}>{m.label}</Badge>;
};

const EnrollByPaymentDialog: React.FC<Props> = ({
  open, onOpenChange, instituteId, classId, subjectId, subjectName = 'Subject', onSuccess,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [payments, setPayments] = useState<SubjectPayment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [selectedTiers, setSelectedTiers] = useState<PaymentTier[]>(['VERIFIED', 'free_card']);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Step 2
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Step 3
  const [enrolling, setEnrolling] = useState(false);
  const [result, setResult] = useState<EnrollResult | null>(null);

  // Load subject payments on open — always fetch fresh (no stale cache)
  useEffect(() => {
    if (!open) { setStep(1); setRows([]); setResult(null); setSelectedPaymentId(''); return; }
    setLoadingPayments(true);
    subjectPaymentsApi.getSubjectPayments(instituteId, classId, subjectId, 1, 100, true)
      .then(r => setPayments(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingPayments(false));
  }, [open, instituteId, classId, subjectId]);

  const toggleTier = (t: PaymentTier) =>
    setSelectedTiers(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  // Step 1 → 2: fetch and merge student data
  const handleFetchStudents = async () => {
    setLoadingStudents(true);
    setStep(2);
    try {
      // Parallel fetch: payment submissions + class enrollment summary + current subject enrollments
      // All fetches bypass cache to ensure real-time enrollment accuracy
      const [submissionsRes, classSummary, enrollmentsRes] = await Promise.all([
        selectedPaymentId
          ? subjectPaymentsApi.getStudentsForPayment(selectedPaymentId, 1, 500, true)
          : Promise.resolve({ data: { students: [] } }),
        enrollmentApi.getClassEnrollmentSummary(instituteId, classId, 'all', undefined, true),
        // get currently enrolled students in this subject — always fresh
        subjectPaymentsApi.getEnrolledUsers(instituteId, classId, subjectId, true).catch(() => ({ data: [] })),
      ]);

      // Build enrolled set from current subject enrollments
      const rawEnrolled: any[] = Array.isArray(enrollmentsRes)
        ? enrollmentsRes
        : (enrollmentsRes?.data || []);
      const enrolledSet = new Set<string>(
        rawEnrolled.map((e: any) => String(e.studentId || e.student_id || e.userId || e.id || ''))
      );

      // Build free card map from class summary
      const freeCardMap = new Map<string, ClassEnrollmentSummaryItem>(
        (classSummary || []).filter(s => s.hasFreeCard).map(s => [s.studentId, s])
      );

      const merged = new Map<string, StudentRow>();

      // Process payment submissions — getStudentsForPayment returns { data: { students: [...] } }
      // Each student has: userId, nameWithInitials/name, paymentStatus (VERIFIED/HALF_VERIFIED/etc or NOT_SUBMITTED)
      const rawSubmissions: any[] =
        submissionsRes?.data?.students ||
        submissionsRes?.students ||
        (Array.isArray(submissionsRes?.data) ? submissionsRes.data : []) ||
        [];

      for (const s of rawSubmissions) {
        const sid = String(s.userId || s.studentId || s.id || '');
        if (!sid) continue;
        const status = (s.paymentStatus || s.status || 'NOT_SUBMITTED') as StudentRow['paymentStatus'];
        const isFc = freeCardMap.has(sid);
        const isEnrolled = enrolledSet.has(sid);
        const isTierMatch = selectedTiers.includes(status as PaymentTier) || (isFc && selectedTiers.includes('free_card'));
        merged.set(sid, {
          studentId: sid,
          name: s.nameWithInitials || s.name || `Student ${sid}`,
          imageUrl: s.instituteUserImage || s.imageUrl || null,
          paymentStatus: isFc && status === 'NOT_SUBMITTED' ? 'free_card' : status,
          amount: s.amount ?? s.submittedAmount ?? null,
          alreadyEnrolled: isEnrolled,
          isFreeCard: isFc,
          selected: isTierMatch && !isEnrolled,
        });
      }

      // Add free card students not already in submission list
      if (selectedTiers.includes('free_card')) {
        for (const [sid, fc] of freeCardMap) {
          if (!merged.has(sid)) {
            const isEnrolled = enrolledSet.has(sid);
            merged.set(sid, {
              studentId: sid,
              name: fc.name,
              imageUrl: fc.imageUrl || null,
              paymentStatus: 'free_card',
              amount: null,
              alreadyEnrolled: isEnrolled,
              isFreeCard: true,
              selected: !isEnrolled,
            });
          }
        }
      }

      setRows(Array.from(merged.values()));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to load students', variant: 'destructive' });
      setStep(1);
    } finally {
      setLoadingStudents(false);
    }
  };

  const toggleRow = (sid: string) =>
    setRows(prev => prev.map(r => r.studentId === sid ? { ...r, selected: !r.selected } : r));

  const toggleAll = () => {
    const eligible = rows.filter(r => !r.alreadyEnrolled);
    const allSelected = eligible.every(r => r.selected);
    setRows(prev => prev.map(r => r.alreadyEnrolled ? r : { ...r, selected: !allSelected }));
  };

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (r.paymentStatus === 'free_card' && selectedTiers.includes('free_card')) return true;
      return selectedTiers.includes(r.paymentStatus as PaymentTier);
    });
  }, [rows, selectedTiers]);

  const toEnroll = filteredRows.filter(r => r.selected && !r.alreadyEnrolled);
  const alreadyCount = filteredRows.filter(r => r.alreadyEnrolled).length;

  // Step 2 → 3: perform enrollment
  const handleEnroll = async () => {
    if (!toEnroll.length) return;
    setEnrolling(true);
    setStep(3);
    try {
      const freeCardIds = toEnroll.filter(r => r.isFreeCard && r.paymentStatus === 'free_card').map(r => r.studentId);
      const paidIds = toEnroll.filter(r => !freeCardIds.includes(r.studentId)).map(r => r.studentId);
      const allIds = [...new Set([...paidIds, ...freeCardIds])];

      const res = await enrollmentApi.teacherAssignStudents(instituteId, classId, subjectId, allIds);

      // Mark free card students
      if (freeCardIds.length) {
        await Promise.allSettled(
          res.successfulAssignments
            .filter(a => freeCardIds.includes(a.studentId))
            .map(a => enrollmentApi.updateStudentType(instituteId, classId, subjectId, a.studentId, 'free_card'))
        );
      }

      setResult({
        success: res.successCount,
        failed: res.failedCount,
        alreadyEnrolled: alreadyCount,
        failures: (res.failedAssignments || []).map(a => ({
          name: a.studentName || a.studentId,
          reason: a.reason || 'Unknown error',
        })),
      });
      onSuccess?.();
    } catch (err: any) {
      toast({ title: 'Enrollment Failed', description: err.message || 'Something went wrong', variant: 'destructive' });
      setStep(2);
    } finally {
      setEnrolling(false);
    }
  };

  const selectedPayment = payments.find(p => p.id === selectedPaymentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[92vh] overflow-y-auto mx-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-bold leading-tight">Enroll by Payment</p>
              <p className="text-xs text-muted-foreground font-normal">{subjectName}</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              {[1, 2, 3].map(n => (
                <div key={n} className={`h-2 w-2 rounded-full transition-colors ${step >= n ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-5">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Payment picker */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Select Payment</p>
                {loadingPayments ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />Loading payments…
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                    No payments found for this subject
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto border rounded-lg p-1">
                    {payments.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPaymentId(p.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm flex items-center justify-between group ${
                          selectedPaymentId === p.id
                            ? 'bg-primary/10 border border-primary/30 text-primary'
                            : 'hover:bg-muted border border-transparent'
                        }`}
                      >
                        <div>
                          <p className="font-medium">{p.title}</p>
                          <p className="text-xs text-muted-foreground">Rs {Number(p.amount).toLocaleString()}</p>
                        </div>
                        {selectedPaymentId === p.id && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tier selector */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Allowed Payment Tiers</p>
                <p className="text-xs text-muted-foreground">Students with these payment statuses will be eligible for enrollment</p>
                <div className="grid grid-cols-2 gap-2">
                  {TIER_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => toggleTier(t.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        selectedTiers.includes(t.value)
                          ? `${t.color} border-current`
                          : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Checkbox
                        checked={selectedTiers.includes(t.value)}
                        onCheckedChange={() => toggleTier(t.value)}
                        className="pointer-events-none h-3.5 w-3.5"
                      />
                      {t.icon}{t.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                disabled={!selectedTiers.length}
                onClick={handleFetchStudents}
              >
                <Users className="h-4 w-4 mr-2" />
                Fetch Eligible Students
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="space-y-4">
              {loadingStudents ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading student data…</p>
                </div>
              ) : (
                <>
                  {/* Summary bar */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Total Eligible', val: filteredRows.length, cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20' },
                      { label: 'Already Enrolled', val: alreadyCount, cls: 'bg-green-50 text-green-700 dark:bg-green-900/20' },
                      { label: 'Will Enroll', val: toEnroll.length, cls: 'bg-primary/10 text-primary' },
                    ].map(s => (
                      <div key={s.label} className={`rounded-lg p-2.5 text-center ${s.cls}`}>
                        <p className="text-xl font-bold">{s.val}</p>
                        <p className="text-[10px] font-medium">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {selectedPayment && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                      <CreditCard className="h-3 w-3 shrink-0" />
                      {selectedPayment.title} · Rs {Number(selectedPayment.amount).toLocaleString()}
                    </div>
                  )}

                  {/* Student list */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold">Eligible Students</p>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={toggleAll}>
                        {filteredRows.filter(r => !r.alreadyEnrolled).every(r => r.selected) ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>
                    <ScrollArea className="h-64 border rounded-lg">
                      <div className="p-2 space-y-1">
                        {filteredRows.length === 0 ? (
                          <div className="flex flex-col items-center py-10 text-muted-foreground">
                            <Users className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-sm">No eligible students found</p>
                          </div>
                        ) : filteredRows.map(row => (
                          <div
                            key={row.studentId}
                            onClick={() => !row.alreadyEnrolled && toggleRow(row.studentId)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                              row.alreadyEnrolled
                                ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10 opacity-70 cursor-default'
                                : row.selected
                                ? 'border-primary/40 bg-primary/5 cursor-pointer'
                                : 'border-border bg-card cursor-pointer hover:bg-muted/40'
                            }`}
                          >
                            {row.alreadyEnrolled ? (
                              <UserCheck className="h-4 w-4 text-green-600 shrink-0" />
                            ) : (
                              <Checkbox
                                checked={row.selected}
                                onCheckedChange={() => toggleRow(row.studentId)}
                                className="pointer-events-none h-3.5 w-3.5 shrink-0"
                              />
                            )}
                            {row.imageUrl ? (
                              <img src={getImageUrl(row.imageUrl)} alt={row.name} className="h-8 w-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-primary">{(row.name[0] || 'S').toUpperCase()}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{row.name}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {row.isFreeCard && (
                                <Badge className="text-[10px] px-1.5 py-0 border bg-violet-100 text-violet-800 border-violet-300">
                                  <Gift className="h-2.5 w-2.5 mr-0.5" />Free
                                </Badge>
                              )}
                              {statusBadge(row.paymentStatus)}
                              {row.alreadyEnrolled && (
                                <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 border border-green-300">
                                  Enrolled
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setStep(1)} className="flex-none">
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Back
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={toEnroll.length === 0}
                      onClick={handleEnroll}
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Enroll {toEnroll.length} Student{toEnroll.length !== 1 ? 's' : ''}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div className="space-y-4">
              {enrolling ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Enrolling students…</p>
                </div>
              ) : result && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg p-3 text-center bg-green-50 dark:bg-green-900/20">
                      <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-green-700">{result.success}</p>
                      <p className="text-[10px] text-green-700 font-medium">Enrolled</p>
                    </div>
                    <div className="rounded-lg p-3 text-center bg-green-50 dark:bg-green-900/20">
                      <UserCheck className="h-5 w-5 text-green-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-green-600">{result.alreadyEnrolled}</p>
                      <p className="text-[10px] text-green-600 font-medium">Already In</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${result.failed > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted'}`}>
                      {result.failed > 0
                        ? <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                        : <CheckCircle className="h-5 w-5 text-muted-foreground mx-auto mb-1" />}
                      <p className={`text-2xl font-bold ${result.failed > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>{result.failed}</p>
                      <p className={`text-[10px] font-medium ${result.failed > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>Failed</p>
                    </div>
                  </div>

                  {result.success > 0 && (
                    <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                        ✅ Successfully enrolled {result.success} student{result.success !== 1 ? 's' : ''} into {subjectName}
                      </p>
                    </div>
                  )}

                  {result.failures.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold flex items-center gap-1.5 text-red-600">
                        <AlertTriangle className="h-3.5 w-3.5" />Failed Enrollments
                      </p>
                      <ScrollArea className="h-32 border border-red-200 rounded-lg">
                        <div className="p-2 space-y-1">
                          {result.failures.map((f, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs px-2 py-1.5 rounded bg-red-50 dark:bg-red-900/20">
                              <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-medium text-red-800 dark:text-red-300">{f.name}</span>
                                <span className="text-red-600 dark:text-red-400 ml-1">— {f.reason}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setStep(1); setRows([]); setResult(null); }}>
                      Enroll More
                    </Button>
                    <Button className="flex-1" onClick={() => onOpenChange(false)}>
                      Done
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnrollByPaymentDialog;
