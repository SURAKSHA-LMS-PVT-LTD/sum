import React, { useState, useMemo, useCallback } from 'react';
import { classPaymentsApi, ClassPayment, ClassPaymentSubmission } from '@/api/classPayments.api';
import { instituteStudentsApi } from '@/api/instituteStudents.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { useToast } from '@/hooks/use-toast';
import {
  RefreshCw, CheckCircle, Clock, XCircle, CircleDollarSign, Minus, Search, Users,
} from 'lucide-react';

interface MatrixStudent {
  userId: string;
  username: string;
  instituteUserId?: string;
  imageUrl?: string;
}

export interface ClassPaymentMatrixProps {
  payments: ClassPayment[];
  instituteId: string;
  classId: string;
}

const STATUS_PRIORITY: Record<string, number> = {
  VERIFIED: 5,
  HALF_VERIFIED: 4,
  QUARTER_VERIFIED: 3,
  PENDING: 2,
  REJECTED: 1,
};

interface StatusCfg {
  label: string;
  bg: string;
  text: string;
  icon: React.ReactNode;
}

const STATUS_CONFIG: Record<string, StatusCfg> = {
  VERIFIED: {
    label: 'Verified',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-200',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  PENDING: {
    label: 'Pending',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-200',
    icon: <Clock className="h-3 w-3" />,
  },
  HALF_VERIFIED: {
    label: 'Half',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-800 dark:text-orange-200',
    icon: <CircleDollarSign className="h-3 w-3" />,
  },
  QUARTER_VERIFIED: {
    label: 'Quarter',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-200',
    icon: <CircleDollarSign className="h-3 w-3" />,
  },
  REJECTED: {
    label: 'Rejected',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-200',
    icon: <XCircle className="h-3 w-3" />,
  },
};

const ClassPaymentMatrix: React.FC<ClassPaymentMatrixProps> = ({ payments, instituteId, classId }) => {
  const { toast } = useToast();
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>(() => payments.map(p => p.id));
  const [allSubmissions, setAllSubmissions] = useState<ClassPaymentSubmission[]>([]);
  const [students, setStudents] = useState<MatrixStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const loadData = useCallback(async () => {
    if (!instituteId || !classId || payments.length === 0) return;
    setLoading(true);
    try {
      // Fetch all submissions in one shot (up to 1 000 rows)
      const subsRes = await classPaymentsApi.getAllSubmissions(instituteId, classId, { limit: 1000 });
      setAllSubmissions(subsRes.data);

      // Fetch all students in the class
      const studentsRes = await instituteStudentsApi.getStudentsByClass(instituteId, classId, { limit: 1000 });
      const studentList = studentsRes.data || [];
      const roster = studentList.map(s => ({
        userId: s.id,
        username: s.name || s.email || s.id,
        instituteUserId: s.userIdByInstitute,
        imageUrl: s.imageUrl || (s as any).userImageUrl || (s as any).studentImageUrl,
      })).sort((a, b) => a.username.localeCompare(b.username));
      
      setStudents(roster);
      setDataLoaded(true);
    } catch (err: any) {
      toast({ title: 'Matrix load error', description: err.message || 'Failed to load data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [instituteId, classId, payments, toast]);

  const selectedPayments = useMemo(
    () => payments.filter(p => selectedPaymentIds.includes(p.id)),
    [payments, selectedPaymentIds],
  );

  // studentId → paymentId → highest-priority status
  const submissionMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const sub of allSubmissions) {
      const byPayment = map.get(sub.userId) ?? new Map<string, string>();
      const existing = byPayment.get(sub.paymentId);
      const newPri = STATUS_PRIORITY[sub.status] ?? 0;
      const oldPri = existing ? (STATUS_PRIORITY[existing] ?? 0) : -1;
      if (newPri > oldPri) byPayment.set(sub.paymentId, sub.status);
      map.set(sub.userId, byPayment);
    }
    return map;
  }, [allSubmissions]);

  // Aggregated counts per payment column (over ALL students, not just filtered)
  const paymentStats = useMemo(() => {
    const s: Record<string, Record<string, number>> = {};
    for (const p of selectedPayments) {
      s[p.id] = { VERIFIED: 0, PENDING: 0, REJECTED: 0, HALF_VERIFIED: 0, QUARTER_VERIFIED: 0, NONE: 0 };
    }
    for (const student of students) {
      const byPmt = submissionMap.get(student.userId);
      for (const p of selectedPayments) {
        const status = byPmt?.get(p.id) ?? 'NONE';
        s[p.id][status] = (s[p.id][status] ?? 0) + 1;
      }
    }
    return s;
  }, [students, selectedPayments, submissionMap]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(s => 
      s.username.toLowerCase().includes(q) ||
      s.userId.toLowerCase().includes(q) ||
      (s.instituteUserId && s.instituteUserId.toLowerCase().includes(q))
    );
  }, [students, studentSearch]);

  const togglePayment = (id: string) =>
    setSelectedPaymentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="space-y-4 p-4">
      {/* ── Payment multi-select ── */}
      <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Payments to Compare</p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setSelectedPaymentIds(payments.map(p => p.id))}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedPaymentIds([])}>
              Clear
            </Button>
            <Button variant={dataLoaded ? 'outline' : 'default'} size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              {dataLoaded ? 'Refresh' : 'Load Matrix'}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {payments.map(p => {
            const sel = selectedPaymentIds.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => togglePayment(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  sel
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/60 hover:text-foreground'
                }`}
              >
                {sel && <CheckCircle className="h-3 w-3 shrink-0" />}
                <span className="truncate max-w-[120px]">{p.title}</span>
                <span className={sel ? 'opacity-70' : 'opacity-50'}>· Rs {Number(p.amount).toLocaleString()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Loading skeletons ── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded" />)}
        </div>
      ) : selectedPayments.length === 0 ? (
        <div className="border rounded-lg py-16 text-center">
          <p className="text-muted-foreground text-sm">Select at least one payment to display the matrix.</p>
        </div>
      ) : !dataLoaded ? (
        <div className="border rounded-lg py-16 text-center bg-muted/10">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-base font-semibold mb-1">Matrix Data Not Loaded</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
            Select the payments you want to compare from the list above, then click the button below to load the matrix.
          </p>
          <Button onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Load Matrix Data
          </Button>
        </div>
      ) : (
        <>
          {/* ── Student search + summary ── */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter students…"
                className="pl-8 h-8 text-sm"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{selectedPayments.length} payment{selectedPayments.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* ── Matrix grid ── */}
          {students.length === 0 ? (
            <div className="border rounded-lg py-12 text-center">
              <p className="text-muted-foreground text-sm">No enrolled students found for these payments.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
                <table
                  className="border-collapse text-sm"
                  style={{ minWidth: 200 + selectedPayments.length * 160 }}
                >
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      {/* Sticky corner cell */}
                      <th
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-r bg-muted"
                        style={{ position: 'sticky', left: 0, zIndex: 20, minWidth: 200 }}
                      >
                        Student
                      </th>

                      {/* Payment column headers */}
                      {selectedPayments.map(p => {
                        const stats = paymentStats[p.id] ?? {};
                        const dueDate = p.lastDate ? new Date(p.lastDate) : null;
                        const overdue = dueDate && dueDate < new Date();
                        return (
                          <th
                            key={p.id}
                            className="px-3 py-3 text-center border-b border-r bg-muted"
                            style={{ minWidth: 160 }}
                          >
                            <div
                              className="font-semibold text-xs text-foreground truncate mx-auto"
                              style={{ maxWidth: 150 }}
                              title={p.title}
                            >
                              {p.title}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-normal">
                              Rs {Number(p.amount).toLocaleString()}
                            </div>
                            {dueDate && (
                              <div className={`text-[10px] mt-0.5 ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                {overdue ? '⚠ ' : ''}{dueDate.toLocaleDateString()}
                              </div>
                            )}
                            {/* Per-column mini stats */}
                            <div className="flex justify-center gap-1 mt-1 flex-wrap">
                              {!!stats.VERIFIED && (
                                <span className="text-[9px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1.5 rounded-full">
                                  {stats.VERIFIED}✓
                                </span>
                              )}
                              {!!stats.PENDING && (
                                <span className="text-[9px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 px-1.5 rounded-full">
                                  {stats.PENDING}⏱
                                </span>
                              )}
                              {!!stats.HALF_VERIFIED && (
                                <span className="text-[9px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 px-1.5 rounded-full">
                                  {stats.HALF_VERIFIED}½
                                </span>
                              )}
                              {!!stats.QUARTER_VERIFIED && (
                                <span className="text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 rounded-full">
                                  {stats.QUARTER_VERIFIED}¼
                                </span>
                              )}
                              {!!stats.REJECTED && (
                                <span className="text-[9px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-1.5 rounded-full">
                                  {stats.REJECTED}✗
                                </span>
                              )}
                              {!!stats.NONE && (
                                <span className="text-[9px] bg-muted text-muted-foreground px-1.5 rounded-full">
                                  {stats.NONE}–
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student, idx) => {
                      const byPmt = submissionMap.get(student.userId);
                      const isEven = idx % 2 === 0;
                      return (
                        <tr
                          key={student.userId}
                          className={`border-b transition-colors hover:bg-primary/5 ${isEven ? '' : 'bg-muted/20'}`}
                        >
                          {/* Sticky student name cell */}
                          <td
                            className={`px-4 py-2.5 border-r ${isEven ? 'bg-background' : 'bg-muted/20'}`}
                            style={{ position: 'sticky', left: 0, zIndex: 1, minWidth: 220, maxWidth: 280 }}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 shrink-0 border border-border/50">
                                <AvatarImage src={student.imageUrl ? getImageUrl(student.imageUrl) : undefined} alt={student.username} className="object-cover" />
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                                  {student.username.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col min-w-0">
                                <div className="font-medium text-sm truncate" title={student.username}>{student.username}</div>
                                <div className="flex flex-col gap-0.5 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground font-mono truncate" title={`Sys ID: ${student.userId}`}>
                                    ID: {student.userId}
                                  </span>
                                  {student.instituteUserId && (
                                    <span className="text-[10px] text-muted-foreground font-mono truncate" title={`Inst ID: ${student.instituteUserId}`}>
                                      Inst: {student.instituteUserId}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Status cells */}
                          {selectedPayments.map(p => {
                            const status = byPmt?.get(p.id);
                            const cfg = status ? STATUS_CONFIG[status] : null;
                            return (
                              <td key={p.id} className="px-3 py-2.5 text-center border-r">
                                {cfg ? (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                                    {cfg.icon}{cfg.label}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-muted-foreground bg-muted/40">
                                    <Minus className="h-3 w-3" />None
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Legend ── */}
          <div className="flex flex-wrap gap-2 items-center text-xs">
            <span className="text-muted-foreground font-medium">Legend:</span>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <span key={key} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
                {cfg.icon}{cfg.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium text-muted-foreground bg-muted/40">
              <Minus className="h-3 w-3" />None
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default ClassPaymentMatrix;
