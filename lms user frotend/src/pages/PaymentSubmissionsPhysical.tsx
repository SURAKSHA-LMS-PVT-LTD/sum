import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ArrowLeft, Search, RefreshCw, CheckCircle, Loader2, User,
  Banknote, XCircle, Clock, AlertCircle, LayoutGrid, Table2, CircleDollarSign,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/api/client';
import { cachedApiClient } from '@/api/cachedClient';
import { classPaymentsApi } from '@/api/classPayments.api';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { useViewMode } from '@/hooks/useViewMode';
import Paper from '@mui/material/Paper';
import MuiTable from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type StudentPaymentStatus = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED';

interface StudentPaymentRecord {
  studentId: string;
  name: string;
  nameWithInitials?: string;
  profileImage?: string | null;
  userIdByInstitute?: string | null;
  status: StudentPaymentStatus;
  submissionId: string | null;
  amount: number | null;
  submittedAt: string | null;
}

interface StudentsResponse {
  data: StudentPaymentRecord[];
  total: number;
  page: number;
  limit: number;
}

interface InstituteStudentItem {
  id: string;
  name: string;
  imageUrl?: string | null;
  userIdByInstitute?: string | null;
}

interface InstituteStudentsResponse {
  data: InstituteStudentItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface RecordDialogState {
  student: StudentPaymentRecord;
  amount: string;
  date: string;
  notes: string;
  paymentTier: 'full' | 'half' | 'quarter';
}

interface VerifyDialogState {
  student: StudentPaymentRecord;
  targetStatus: 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED';
  notes: string;
}

// â”€â”€â”€ Status badge helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const statusBadge = (status: StudentPaymentStatus) => {
  switch (status) {
    case 'VERIFIED':
      return <Badge className="bg-green-100 text-green-800 border-green-200 gap-1"><CheckCircle className="h-3 w-3" />Verified</Badge>;
    case 'PENDING':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
    case 'HALF_VERIFIED':
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200 gap-1"><CircleDollarSign className="h-3 w-3" />Half Paid</Badge>;
    case 'QUARTER_VERIFIED':
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200 gap-1"><CircleDollarSign className="h-3 w-3" />Quarter Paid</Badge>;
    case 'REJECTED':
      return <Badge className="bg-red-100 text-red-800 border-red-200 gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
    default:
      return <Badge variant="outline" className="text-gray-600 gap-1"><AlertCircle className="h-3 w-3" />Not Submitted</Badge>;
  }
};

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PaymentSubmissionsPhysical: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { viewMode, setViewMode } = useViewMode();
  const { selectedInstitute, selectedClass, selectedSubject } = useAuth();

  const paymentId = searchParams.get('paymentId') ?? '';
  const paymentTitle = searchParams.get('paymentTitle') ?? 'Payment';
  // Fallback to context values when URL params are not provided
  const instituteId = searchParams.get('instituteId') || String(selectedInstitute?.id ?? '');
  const classId = searchParams.get('classId') || String(selectedClass?.id ?? '');
  const subjectId = searchParams.get('subjectId') || String(selectedSubject?.id ?? '');

  const [students, setStudents] = useState<StudentPaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [recordDialog, setRecordDialog] = useState<RecordDialogState | null>(null);
  const [recording, setRecording] = useState(false);
  const [verifyDialog, setVerifyDialog] = useState<VerifyDialogState | null>(null);
  const [verifying, setVerifying] = useState(false);

  const loadStudents = async (p = page, rpp = rowsPerPage, forceRefresh = false) => {
    if (!paymentId || !instituteId || !classId) return;
    setLoading(true);
    try {
      const res = await cachedApiClient.get(
        `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/payment/${paymentId}/students-details`,
        { page: p + 1, limit: rpp },
        { ttl: 60, forceRefresh }
      );
      // Response shape: { data: [...], total, page, limit, totalPages, summary }
      const rawStudents: any[] = res?.data ?? [];
      const merged: StudentPaymentRecord[] = rawStudents.filter(Boolean).map((s: any) => ({
        studentId: s?.studentId ?? s?.userId ?? '',
        name: s?.studentName || s?.nameWithInitials || s?.name || 'Unknown',
        nameWithInitials: s?.nameWithInitials ?? undefined,
        profileImage: s?.image ?? s?.instituteUserImage ?? s?.profileImage ?? null,
        userIdByInstitute: s?.instituteUserId ?? s?.instituteStudentId ?? s?.userIdByInstitute ?? null,
        status: (s?.submissionStatus ?? 'NOT_SUBMITTED') as StudentPaymentStatus,
        submissionId: s?.submissionId ?? null,
        amount: s?.paymentAmount ?? s?.amount ?? null,
        submittedAt: s?.verifiedAt ?? s?.submittedDate ?? s?.submittedAt ?? null,
      })).filter((s: StudentPaymentRecord) => s.studentId);
      setStudents(merged);
      setTotal(res?.total ?? merged.length);
      // Set payment amount from API response if not already set
      if (merged.length > 0 && merged[0].amount) setPaymentAmount(String(merged[0].amount));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to load students.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents(0, rowsPerPage);
    setPage(0);
  }, [paymentId, instituteId, classId]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
    loadStudents(newPage, rowsPerPage);
  };

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rpp = +e.target.value;
    setRowsPerPage(rpp);
    setPage(0);
    loadStudents(0, rpp);
  };

  const handleRecord = async () => {
    if (!recordDialog) return;
    if (!recordDialog.amount || isNaN(Number(recordDialog.amount)) || Number(recordDialog.amount) <= 0) {
      toast({ title: 'Error', description: 'Enter a valid amount.', variant: 'destructive' });
      return;
    }
    setRecording(true);
    try {
      await classPaymentsApi.adminVerifyStudentClassPayment(
        paymentId,
        recordDialog.student.studentId,
        { 
          amount: Number(recordDialog.amount), 
          date: recordDialog.date, 
          notes: recordDialog.notes || undefined, 
          paymentTier: recordDialog.paymentTier 
        }
      );
      toast({ title: 'Success', description: `Payment recorded for ${recordDialog.student.name}.` });
      setRecordDialog(null);
      loadStudents(page, rowsPerPage, true);
    } catch (err: any) {
      const msg = err?.status === 409
        ? 'This student already has a verified payment recorded.'
        : err.message || 'Failed to record payment.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setRecording(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyDialog?.student.submissionId) return;
    setVerifying(true);
    try {
      const submissionId = verifyDialog.student.submissionId;
      const isRejection = verifyDialog.targetStatus === 'REJECTED';
      if (isRejection) {
        if (!verifyDialog.notes?.trim()) {
          toast({ title: 'Error', description: 'Please provide a rejection reason.', variant: 'destructive' });
          setVerifying(false);
          return;
        }
        await apiClient.patch(
          `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/submission/${submissionId}/reject`,
          { rejectionReason: verifyDialog.notes, notes: verifyDialog.notes }
        );
      } else {
        await apiClient.patch(
          `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/submission/${submissionId}/verify`,
          { status: verifyDialog.targetStatus, notes: verifyDialog.notes || undefined }
        );
      }
      toast({
        title: verifyDialog.targetStatus === 'VERIFIED' ? 'Verified' : isRejection ? 'Rejected' : 'Updated',
        description: `Submission ${verifyDialog.targetStatus.toLowerCase()} for ${verifyDialog.student.name}.`,
      });
      setVerifyDialog(null);
      loadStudents(page, rowsPerPage, true);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update submission.', variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  const counts = { NOT_SUBMITTED: 0, PENDING: 0, VERIFIED: 0, HALF_VERIFIED: 0, QUARTER_VERIFIED: 0, REJECTED: 0 };
  students.filter(Boolean).forEach(s => { counts[s.status] = (counts[s.status] ?? 0) + 1; });

  const filtered = students.filter(Boolean).filter(s => {
    const q = searchTerm.toLowerCase();
    return !q ||
      (s.name || '').toLowerCase().includes(q) ||
      (s.nameWithInitials || '').toLowerCase().includes(q) ||
      (s.studentId || '').toLowerCase().includes(q) ||
      (s.userIdByInstitute || '').toLowerCase().includes(q);
  });

  const paginationSx = {
    color: 'hsl(var(--foreground))',
    borderTop: '1px solid hsl(var(--border))',
    '.MuiTablePagination-select': { color: 'hsl(var(--foreground))' },
    '.MuiTablePagination-selectIcon': { color: 'hsl(var(--foreground))' },
    '.MuiTablePagination-actions button': { color: 'hsl(var(--foreground))' },
  };

  const actionButtons = (student: StudentPaymentRecord, isCard = false) => (
    <div className={isCard ? 'flex flex-col gap-2 w-full' : 'flex gap-1.5'}>
      {student.status === 'NOT_SUBMITTED' && (
        <Button size="sm"
          className={`bg-green-600 hover:bg-green-700 text-white ${isCard ? 'h-10 text-sm w-full' : 'h-8 text-xs px-3'}`}
          onClick={() => setRecordDialog({ student, amount: paymentAmount, date: new Date().toISOString().slice(0, 10), notes: '', paymentTier: 'full' })}>
          <CheckCircle className={`${isCard ? 'h-4 w-4' : 'h-3.5 w-3.5'} mr-1.5`} />Record Payment
        </Button>
      )}
      {student.status === 'PENDING' && (
        <>
          <Button size="sm"
            className={`bg-green-600 hover:bg-green-700 text-white ${isCard ? 'h-10 text-sm w-full' : 'h-8 text-xs px-3'}`}
            onClick={() => setVerifyDialog({ student, targetStatus: 'VERIFIED', notes: '' })}>
            <CheckCircle className={`${isCard ? 'h-4 w-4' : 'h-3.5 w-3.5'} mr-1.5`} />Verify
          </Button>
          <Button size="sm" variant="outline"
            className={`border-red-400 text-red-600 hover:bg-red-50 ${isCard ? 'h-10 text-sm w-full' : 'h-8 text-xs px-3'}`}
            onClick={() => setVerifyDialog({ student, targetStatus: 'REJECTED', notes: '' })}>
            <XCircle className={`${isCard ? 'h-4 w-4' : 'h-3.5 w-3.5'} mr-1.5`} />Reject
          </Button>
        </>
      )}
      {student.status === 'VERIFIED' && (
        <span className={`inline-flex items-center justify-center gap-1.5 font-semibold rounded-full ${isCard ? 'text-sm px-4 py-2.5 w-full text-green-900 bg-green-200 border border-green-400' : 'text-xs px-2.5 py-1 text-green-700 bg-green-50 border border-green-200'}`}>
          <CheckCircle className={isCard ? 'h-4 w-4' : 'h-3.5 w-3.5'} />Verified
        </span>
      )}
      {(student.status === 'HALF_VERIFIED' || student.status === 'QUARTER_VERIFIED') && (
        <>
          <span className={`inline-flex items-center justify-center gap-1.5 font-semibold rounded-full ${student.status === 'HALF_VERIFIED' ? 'text-orange-800 bg-orange-100 border-orange-300' : 'text-purple-800 bg-purple-100 border-purple-300'} ${isCard ? 'text-sm px-4 py-2.5 w-full border' : 'text-xs px-2.5 py-1 border'}`}>
            <CircleDollarSign className={isCard ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
            {student.status === 'HALF_VERIFIED' ? 'Half Paid' : 'Quarter Paid'}
          </span>
          <Button size="sm"
            className={`bg-green-600 hover:bg-green-700 text-white ${isCard ? 'h-10 text-sm w-full' : 'h-8 text-xs px-3'}`}
            onClick={() => setVerifyDialog({ student, targetStatus: 'VERIFIED', notes: '' })}>
            <CheckCircle className={`${isCard ? 'h-4 w-4' : 'h-3.5 w-3.5'} mr-1.5`} />Complete
          </Button>
        </>
      )}
      {student.status === 'REJECTED' && (
        <span className={`inline-flex items-center justify-center gap-1.5 font-semibold rounded-full ${isCard ? 'text-sm px-4 py-2.5 w-full text-red-900 bg-red-200 border border-red-400' : 'text-xs px-2.5 py-1 text-red-700 bg-red-50 border border-red-200'}`}>
          <XCircle className={isCard ? 'h-4 w-4' : 'h-3.5 w-3.5'} />Rejected
        </span>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-4 px-2 sm:px-4 py-3 sm:py-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)} size="sm" className="shrink-0 px-2">
            <ArrowLeft className="h-4 w-4" /><span className="ml-1 hidden sm:inline text-xs">Back</span>
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <Banknote className="h-5 w-5 text-green-600 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">Physical Payment</h1>
              <p className="text-xs text-muted-foreground truncate">{paymentTitle}</p>
            </div>
          </div>
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {([
            { label: 'Not Paid', key: 'NOT_SUBMITTED', cls: 'bg-gray-100 text-gray-700' },
            { label: 'Pending', key: 'PENDING', cls: 'bg-yellow-100 text-yellow-800' },
            { label: 'Verified', key: 'VERIFIED', cls: 'bg-green-100 text-green-800' },
            { label: 'Half Paid', key: 'HALF_VERIFIED', cls: 'bg-orange-100 text-orange-800' },
            { label: 'Qtr Paid', key: 'QUARTER_VERIFIED', cls: 'bg-purple-100 text-purple-800' },
            { label: 'Rejected', key: 'REJECTED', cls: 'bg-red-100 text-red-800' },
          ] as const).map(({ label, key, cls }) => (
            <div key={key} className={`rounded-lg p-2 text-center ${cls}`}>
              <p className="text-lg font-bold">{counts[key]}</p>
              <p className="text-[10px] font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Search + view toggle + refresh */}
        <Card>
          <CardContent className="p-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name, user ID or inst. ID…" className="pl-9 text-sm" value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
                <button onClick={() => setViewMode('card')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Card View"><LayoutGrid className="h-4 w-4" /></button>
                <button onClick={() => setViewMode('table')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Table View"><Table2 className="h-4 w-4" /></button>
              </div>
              <Button variant="outline" size="sm" onClick={() => loadStudents(page, rowsPerPage, true)} disabled={loading} className="shrink-0">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {loading && students.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : viewMode === 'card' ? (
          /* â”€â”€ CARD VIEW â”€â”€ */
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="flex items-center justify-between text-sm text-foreground">
                <span className="flex items-center gap-2"><User className="h-4 w-4 text-primary" />Students</span>
                <Badge variant="outline">{total} total</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                  <User className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No students found</p>
                </div>
              ) : (
                <div className="grid gap-3 grid-cols-1">
                  {filtered.filter(Boolean).map(student => (
                    <div key={student.studentId} className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow flex flex-col">
                      {/* top: avatar + name + status */}
                      <div className="flex items-center gap-3 p-4 border-b border-border">
                        <div className="shrink-0">
                          {student?.profileImage ? (
                            <img src={getImageUrl(student.profileImage)} alt={student.name}
                              className="h-14 w-14 rounded-full object-cover ring-2 ring-border" />
                          ) : (
                            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border">
                              <span className="text-xl font-bold text-primary">{(student?.name?.[0] ?? '?').toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-semibold text-foreground truncate">{student.name}</p>
                          {student.nameWithInitials && student.nameWithInitials !== student.name && (
                            <p className="text-sm text-muted-foreground truncate">{student.nameWithInitials}</p>
                          )}
                        </div>
                      </div>
                      {/* details */}
                      <div className="px-4 py-3 space-y-2.5 flex-1">
                        {student.userIdByInstitute && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-muted-foreground shrink-0">Inst. ID</span>
                            <span className="text-sm font-mono font-semibold text-foreground">{student.userIdByInstitute}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground shrink-0">User ID</span>
                          <span className="text-sm font-mono text-foreground/80 truncate" title={student.studentId}>{student.studentId}</span>
                        </div>
                        {student.amount != null && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-muted-foreground shrink-0">Amount</span>
                            <span className="text-sm font-semibold text-foreground">Rs {Number(student.amount).toLocaleString()}</span>
                          </div>
                        )}
                        {student.submittedAt && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-muted-foreground shrink-0">Date</span>
                            <span className="text-sm text-foreground">{new Date(student.submittedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                      {/* actions */}
                      <div className="px-4 pb-4 pt-2 border-t border-border">
                        {actionButtons(student, true)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Paper elevation={0} sx={{ borderTop: '1px solid hsl(var(--border))', marginTop: '12px' }}>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  component="div"
                  count={total}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  sx={paginationSx}
                />
              </Paper>
            </CardContent>
          </Card>
        ) : (
          /* â”€â”€ TABLE VIEW â”€â”€ */
          <Paper sx={{ width: '100%', overflow: 'hidden', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }}>
            <TableContainer sx={{ overflow: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
              <MuiTable stickyHeader aria-label="physical payments table" sx={{ width: '100%' }}>
                <TableHead>
                  <TableRow>
                    {([
                      { label: '#', w: 48 },
                      { label: 'Student', w: 220 },
                      { label: 'User ID', w: 160 },
                      { label: 'Inst. ID', w: 110 },
                      { label: 'Status', w: 130 },
                      { label: 'Amount', w: 120 },
                      { label: 'Date', w: 160 },
                      { label: 'Actions', w: 170 },
                    ]).map(col => (
                      <TableCell key={col.label} style={{ minWidth: col.w }}
                        sx={{ fontWeight: 600, backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', borderBottom: '1px solid hsl(var(--border))' }}>
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ color: 'hsl(var(--muted-foreground))', py: 8 }}>
                        <div className="flex flex-col items-center gap-2">
                          <User className="h-8 w-8 opacity-30" />
                          <span className="text-sm">No students found</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filtered.filter(Boolean).map((student, idx) => (
                    <TableRow hover key={student.studentId}
                      sx={{ '&:hover': { backgroundColor: 'hsl(var(--muted)/0.4)' }, backgroundColor: 'hsl(var(--card))' }}>
                      <TableCell sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.75rem' }}>
                        {page * rowsPerPage + idx + 1}
                      </TableCell>
                      <TableCell sx={{ color: 'hsl(var(--foreground))' }}>
                        <div className="flex items-center gap-2">
                          {student?.profileImage ? (
                            <img src={getImageUrl(student.profileImage)} alt={student.name}
                              className="h-8 w-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-primary">{(student.name?.[0] ?? '?').toUpperCase()}</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{student.name}</p>
                            {student.nameWithInitials && (
                              <p className="text-xs text-muted-foreground truncate">{student.nameWithInitials}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell sx={{ color: 'hsl(var(--foreground))', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600, maxWidth: 160 }}>
                        <span title={student.studentId} style={{ display: 'block', wordBreak: 'break-all' }}>{student.studentId}</span>
                      </TableCell>
                      <TableCell sx={{ color: 'hsl(var(--foreground))', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        {student.userIdByInstitute ?? '—'}
                      </TableCell>
                      <TableCell>{statusBadge(student.status)}</TableCell>
                      <TableCell sx={{ color: 'hsl(var(--foreground))' }}>
                        {student.amount != null ? `Rs ${Number(student.amount).toLocaleString()}` : '\u2014'}
                      </TableCell>
                      <TableCell sx={{ color: 'hsl(var(--foreground))', fontSize: '0.85rem', fontWeight: 500 }}>
                        {student.submittedAt ? new Date(student.submittedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </TableCell>
                      <TableCell>{actionButtons(student)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </MuiTable>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={total}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={paginationSx}
            />
          </Paper>
        )}
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={!!recordDialog} onOpenChange={open => { if (!open) setRecordDialog(null); }}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-5 w-5 text-green-600" />Record Physical Payment
            </DialogTitle>
          </DialogHeader>
          {recordDialog && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-sm font-medium">{recordDialog.student.name}</p>
                {recordDialog.student.nameWithInitials && (
                  <p className="text-xs text-muted-foreground">{recordDialog.student.nameWithInitials}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Payment Tier</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['full', 'half', 'quarter'] as const).map(tier => (
                    <button key={tier} type="button"
                      onClick={() => setRecordDialog(d => d ? { ...d, paymentTier: tier } : d)}
                      className={`py-2 px-1 rounded-lg border text-xs font-semibold transition-colors ${
                        recordDialog.paymentTier === tier
                          ? tier === 'full' ? 'bg-green-100 border-green-500 text-green-800' : tier === 'half' ? 'bg-orange-100 border-orange-500 text-orange-800' : 'bg-purple-100 border-purple-500 text-purple-800'
                          : 'bg-muted/40 border-border text-foreground hover:bg-muted'
                      }`}>
                      {tier === 'full' ? 'Full' : tier === 'half' ? 'Half' : 'Quarter'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Amount (Rs) *</Label>
                <Input type="number" min={0} placeholder="e.g. 5000" value={recordDialog.amount}
                  onChange={e => setRecordDialog(d => d ? { ...d, amount: e.target.value } : d)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Payment Date</Label>
                <Input type="date" value={recordDialog.date}
                  onChange={e => setRecordDialog(d => d ? { ...d, date: e.target.value } : d)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Notes (optional)</Label>
                <Textarea placeholder="Receipt no., remarks..." rows={2} value={recordDialog.notes}
                  onChange={e => setRecordDialog(d => d ? { ...d, notes: e.target.value } : d)} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 pt-1">
            <Button variant="outline" onClick={() => setRecordDialog(null)} disabled={recording}>Cancel</Button>
            <Button onClick={handleRecord} disabled={recording} className={`text-white ${
              recordDialog?.paymentTier === 'half' ? 'bg-orange-500 hover:bg-orange-600' :
              recordDialog?.paymentTier === 'quarter' ? 'bg-purple-600 hover:bg-purple-700' :
              'bg-green-600 hover:bg-green-700'
            }`}>
              {recording ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
              {recording ? 'Recording...' : recordDialog?.paymentTier === 'half' ? 'Record Half Payment' : recordDialog?.paymentTier === 'quarter' ? 'Record Quarter Payment' : 'Record Full Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify / Reject Dialog */}
      <Dialog open={!!verifyDialog} onOpenChange={open => { if (!open) setVerifyDialog(null); }}>
        <DialogContent className="max-w-sm w-[calc(100%-2rem)] mx-auto">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 text-base ${
              verifyDialog?.targetStatus === 'REJECTED' ? 'text-red-600' :
              verifyDialog?.targetStatus === 'HALF_VERIFIED' ? 'text-orange-700' :
              verifyDialog?.targetStatus === 'QUARTER_VERIFIED' ? 'text-purple-700' :
              'text-green-700'
            }`}>
              {verifyDialog?.targetStatus === 'VERIFIED' && <><CheckCircle className="h-5 w-5" />Verify Submission</>}
              {verifyDialog?.targetStatus === 'HALF_VERIFIED' && <><CircleDollarSign className="h-5 w-5" />Mark as Half Paid</>}
              {verifyDialog?.targetStatus === 'QUARTER_VERIFIED' && <><CircleDollarSign className="h-5 w-5" />Mark as Quarter Paid</>}
              {verifyDialog?.targetStatus === 'REJECTED' && <><XCircle className="h-5 w-5" />Reject Submission</>}
            </DialogTitle>
          </DialogHeader>
          {verifyDialog && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-sm font-medium">{verifyDialog.student.name}</p>
                {verifyDialog.student.amount != null && (
                  <p className="text-xs text-muted-foreground">Submitted: Rs {Number(verifyDialog.student.amount).toLocaleString()}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Decision</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'VERIFIED', label: 'Full Verified', cls: 'bg-green-100 border-green-500 text-green-800', hover: 'hover:bg-green-50' },
                    { value: 'HALF_VERIFIED', label: 'Half Paid', cls: 'bg-orange-100 border-orange-500 text-orange-800', hover: 'hover:bg-orange-50' },
                    { value: 'QUARTER_VERIFIED', label: 'Quarter Paid', cls: 'bg-purple-100 border-purple-500 text-purple-800', hover: 'hover:bg-purple-50' },
                    { value: 'REJECTED', label: 'Reject', cls: 'bg-red-100 border-red-500 text-red-800', hover: 'hover:bg-red-50' },
                  ] as const).map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setVerifyDialog(d => d ? { ...d, targetStatus: opt.value } : d)}
                      className={`py-2 px-2 rounded-lg border text-xs font-semibold transition-colors ${
                        verifyDialog.targetStatus === opt.value ? opt.cls : `bg-muted/40 border-border text-foreground ${opt.hover}`
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">
                  Notes {verifyDialog.targetStatus === 'REJECTED' ? '(reason for rejection)' : '(optional)'}
                </Label>
                <Textarea placeholder={verifyDialog.targetStatus === 'REJECTED' ? 'Reason for rejection...' : 'Optional notes...'}
                  rows={2} value={verifyDialog.notes}
                  onChange={e => setVerifyDialog(d => d ? { ...d, notes: e.target.value } : d)} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 pt-1">
            <Button variant="outline" onClick={() => setVerifyDialog(null)} disabled={verifying}>Cancel</Button>
            <Button onClick={handleVerify} disabled={verifying}
              className={`text-white ${
                verifyDialog?.targetStatus === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' :
                verifyDialog?.targetStatus === 'HALF_VERIFIED' ? 'bg-orange-500 hover:bg-orange-600' :
                verifyDialog?.targetStatus === 'QUARTER_VERIFIED' ? 'bg-purple-600 hover:bg-purple-700' :
                'bg-green-600 hover:bg-green-700'
              }`}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> :
                verifyDialog?.targetStatus === 'REJECTED' ? <XCircle className="h-4 w-4 mr-1.5" /> :
                <CheckCircle className="h-4 w-4 mr-1.5" />}
              {verifying ? 'Processing...' :
                verifyDialog?.targetStatus === 'VERIFIED' ? 'Verify' :
                verifyDialog?.targetStatus === 'HALF_VERIFIED' ? 'Mark Half Paid' :
                verifyDialog?.targetStatus === 'QUARTER_VERIFIED' ? 'Mark Quarter Paid' :
                'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default PaymentSubmissionsPhysical;
