import React, { useState, useEffect } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CreditCard, ArrowLeft, Search, Eye, CheckCircle, Clock, FileText,
  History, Plus, RefreshCw, XCircle, ChevronDown, AlertCircle, Calendar,
  LayoutGrid, Table2, Trash2, CircleDollarSign, Building2, Banknote, Grid3x3,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { classPaymentsApi, ClassPayment, ClassPaymentsResponse, ClassPaymentSubmission as PaymentSubmission } from '@/api/classPayments.api';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import VerifySubmissionDialog from '@/components/forms/VerifySubmissionDialog';
import CreateClassPaymentForm from '@/components/forms/CreateClassPaymentForm';
import SubmitClassPaymentDialog from '@/components/forms/SubmitClassPaymentDialog';
import { Skeleton } from '@/components/ui/skeleton';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { useViewMode } from '@/hooks/useViewMode';
import { useResizableColumns, ResizeHandle } from '@/hooks/useResizableColumns';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';
import ClassPaymentMatrix from '@/components/payments/ClassPaymentMatrix';
import { usePermission } from '@/hooks/usePermission';

// Inline bank details dialog (reuse for class payments)
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SRI_LANKAN_BANKS } from '@/config/sriLankanBanks';

function ClassPaymentBankDetailsDialog({ open, onOpenChange, payment }: { open: boolean; onOpenChange: (v: boolean) => void; payment: ClassPayment | null }) {
  if (!payment) return null;
  const bank = SRI_LANKAN_BANKS.find(b => b.name === payment.bankName || b.abbreviation === payment.bankName);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Bank Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {bank && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <img src={bank.logoUrl} alt={bank.name} className="h-10 w-10 object-contain rounded" onError={e => { e.currentTarget.style.display = 'none'; }} />
              <div><p className="font-semibold text-sm">{bank.name}</p><p className="text-xs text-muted-foreground">{bank.abbreviation}</p></div>
            </div>
          )}
          {payment.bankName && !bank && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Bank</p>
              <p className="font-medium">{payment.bankName}</p>
            </div>
          )}
          {payment.accountHolderName && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Account Holder</p>
              <p className="font-medium">{payment.accountHolderName}</p>
            </div>
          )}
          {payment.accountHolderNumber && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Account Number</p>
              <p className="font-medium font-mono tracking-wider">{payment.accountHolderNumber}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ClassPayments = () => {
  const { user, selectedInstitute, selectedClass, isViewingAsParent, selectedChild } = useAuth();
  const instituteRole = useInstituteRole();
  const { hasCustomType, canCreate: rbacCanCreate, canSubmit: rbacCanSubmit } = usePermission('class-payments');
  const isAdminRole = hasCustomType ? rbacCanCreate : (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher');
  const isSubmitterRole = hasCustomType ? rbacCanSubmit : (instituteRole === 'Student');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [paymentsData, setPaymentsData] = useState<ClassPaymentsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<PaymentSubmission | null>(null);
  const [createPaymentDialogOpen, setCreatePaymentDialogOpen] = useState(false);
  const [submitPaymentDialogOpen, setSubmitPaymentDialogOpen] = useState(false);
  const [selectedPaymentForSubmission, setSelectedPaymentForSubmission] = useState<ClassPayment | null>(null);
  const [bankDetailsDialogOpen, setBankDetailsDialogOpen] = useState(false);
  const [selectedPaymentForBankDetails, setSelectedPaymentForBankDetails] = useState<ClassPayment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const { viewMode, setViewMode } = useViewMode();
  const [matrixMode, setMatrixMode] = useState(false);
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);
  const [deleteConfirmPayment, setDeleteConfirmPayment] = useState<ClassPayment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const contextKey = `${selectedInstitute?.id}-${selectedClass?.id}`;
  const [lastLoadedContext, setLastLoadedContext] = useState('');

  useEffect(() => {
    if (selectedInstitute && selectedClass && contextKey !== lastLoadedContext) {
      setLastLoadedContext(contextKey);
      setPage(0);
      loadPayments(0, rowsPerPage, false);
    }
  }, [contextKey]);

  const loadPayments = async (pageNum: number = page, limitNum: number = rowsPerPage, forceRefresh = false) => {
    if (!selectedInstitute || !selectedClass) {
      toast({ title: 'Missing Selection', description: 'Please select an institute and class first.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      let response: ClassPaymentsResponse;
      const isPayerRole = instituteRole === 'Student' || instituteRole === 'Parent' || (isViewingAsParent && selectedChild);
      if (isPayerRole) {
        response = await classPaymentsApi.getMyClassPayments(selectedInstitute.id, selectedClass.id, pageNum + 1, limitNum, forceRefresh);
      } else if (isAdminRole || instituteRole === 'AttendanceMarker') {
        response = await classPaymentsApi.getClassPayments(selectedInstitute.id, selectedClass.id, pageNum + 1, limitNum, forceRefresh);
      } else {
        toast({ title: 'Access Denied', description: "You don't have permission to view class payments.", variant: 'destructive' });
        return;
      }
      setPaymentsData(response);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to load class payments.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!deleteConfirmPayment) return;
    setDeleting(true);
    try {
      await classPaymentsApi.deletePayment(deleteConfirmPayment.id);
      toast({ title: 'Payment Deleted', description: `"${deleteConfirmPayment.title}" has been deleted.` });
      setDeleteConfirmPayment(null);
      loadPayments(page, rowsPerPage, true);
    } catch (error: any) {
      toast({ title: 'Cannot Delete', description: error.message || 'Failed to delete payment.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const viewSubmissions = (payment: ClassPayment) => {
    navigate(`/payment-submissions?paymentId=${payment.id}&paymentTitle=${encodeURIComponent(payment.title)}&type=class`);
  };

  const viewPhysicalPayments = (payment: ClassPayment) => {
    navigate(
      `/payment-submissions-pysical?paymentId=${payment.id}&paymentTitle=${encodeURIComponent(payment.title)}` +
      `&instituteId=${selectedInstitute?.id ?? ''}&classId=${selectedClass?.id ?? ''}&type=class`,
    );
  };

  const getStatusColor = (status: string) => {
    if (status === 'ACTIVE') return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };
  const getPriorityColor = (priority: string) => {
    if (priority === 'MANDATORY') return 'bg-red-100 text-red-800 border-red-200';
    if (priority === 'OPTIONAL') return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const filteredPayments = React.useMemo(() => {
    if (!paymentsData?.data) return [];
    if (!searchQuery.trim()) return paymentsData.data;
    const q = searchQuery.toLowerCase();
    return paymentsData.data.filter(p => (p.title || '').toLowerCase().includes(q) || p.amount?.toString().includes(searchQuery.trim()) || (p.priority || '').toLowerCase().includes(q));
  }, [paymentsData?.data, searchQuery]);

  const isPayerRole = isSubmitterRole || instituteRole === 'Parent' || isViewingAsParent;

  const colDefs = React.useMemo<ColumnDef[]>(() => [
    { key: 'title', header: 'Title', locked: true, defaultWidth: 200, minWidth: 120 },
    { key: 'amount', header: 'Amount (Rs)', defaultVisible: true, defaultWidth: 120, minWidth: 80 },
    { key: 'status', header: 'Status', defaultVisible: true, defaultWidth: 100, minWidth: 80 },
    ...(!isPayerRole ? [{ key: 'priority', header: 'Priority', defaultVisible: true, defaultWidth: 100, minWidth: 80 } as ColumnDef] : []),
    { key: 'dueDate', header: 'Due Date', defaultVisible: true, defaultWidth: 120, minWidth: 80 },
    { key: 'bankDetails', header: 'Bank Details', defaultVisible: true, defaultWidth: 140, minWidth: 120 },
    ...(isPayerRole ? [{ key: 'mySubmissionStatus', header: 'My Submission', defaultVisible: true, defaultWidth: 140, minWidth: 80 } as ColumnDef] : []),
    ...(!isPayerRole ? [{ key: 'submissions', header: 'Submissions', defaultVisible: true, defaultWidth: 150, minWidth: 100 } as ColumnDef] : []),
    ...(!isPayerRole ? [{ key: 'onlinePayment', header: 'Online Payment', defaultVisible: true, defaultWidth: 150, minWidth: 120 } as ColumnDef] : []),
    ...(!isPayerRole ? [{ key: 'physicalPayment', header: 'Physical Payment', defaultVisible: true, defaultWidth: 160, minWidth: 120 } as ColumnDef] : []),
    ...(isAdminRole ? [{ key: 'deletePayment', header: 'Delete', defaultVisible: true, defaultWidth: 90, minWidth: 70 } as ColumnDef] : []),
    ...(isPayerRole ? [{ key: 'submitPayment', header: 'Submit', locked: true, defaultWidth: 160, minWidth: 120 } as ColumnDef] : []),
  ], [isPayerRole, isAdminRole]);
  const colIds = React.useMemo(() => colDefs.map(c => c.key), [colDefs]);
  const colDefaultWidths = React.useMemo(() => { const m: Record<string, number> = {}; colDefs.forEach(c => { m[c.key] = c.defaultWidth || 120; }); return m; }, [colDefs]);
  const { getWidth, setHoveredCol, hoveredCol, activeCol, startResize } = useResizableColumns(colIds, colDefaultWidths);
  const { colState, visibleColumns: visDefs, toggleColumn, resetColumns } = useColumnConfig(colDefs, 'class-payments');

  const renderCell = (colKey: string, payment: ClassPayment): React.ReactNode => {
    switch (colKey) {
      case 'title':
        return <div><div className="font-medium">{payment.title}</div><div className="text-sm text-muted-foreground mt-1 line-clamp-2">{payment.description || '-'}</div><div className="text-xs text-muted-foreground mt-1">Target: {payment.targetType}</div></div>;
      case 'amount':
        return <div className="font-semibold text-lg text-primary">Rs {Number(payment.amount).toLocaleString()}</div>;
      case 'status':
        return <Badge className={getStatusColor(payment.status)}>{payment.status}</Badge>;
      case 'priority':
        return <Badge className={getPriorityColor(payment.priority)}>{payment.priority}</Badge>;
      case 'dueDate': {
        const d = new Date(payment.lastDate);
        const overdue = d < new Date();
        return <div className={`text-sm ${overdue ? 'text-destructive font-medium' : ''}`}>{d.toLocaleDateString()}{overdue && <div className="text-xs text-destructive">⚠ Overdue</div>}</div>;
      }
      case 'mySubmissionStatus': {
        const status = payment.mySubmissionStatus;
        if (!payment.hasSubmitted) return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">Not Submitted</Badge>;
        const map: Record<string, string> = { VERIFIED: 'bg-green-100 text-green-800 border-green-200', PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200', HALF_VERIFIED: 'bg-orange-100 text-orange-800 border-orange-200', QUARTER_VERIFIED: 'bg-purple-100 text-purple-800 border-purple-200', REJECTED: 'bg-red-100 text-red-800 border-red-200' };
        return <Badge className={map[status || ''] || ''}>{status?.replace('_', ' ')}</Badge>;
      }
      case 'submissions':
        return <div className="text-xs space-y-1"><div className="flex items-center gap-1"><FileText className="h-3 w-3" /><span>Total: {payment.submissionsCount || 0}</span></div><div className="flex items-center gap-1 text-green-600"><CheckCircle className="h-3 w-3" /><span>Verified: {payment.verifiedSubmissionsCount || 0}</span></div><div className="flex items-center gap-1 text-yellow-600"><Clock className="h-3 w-3" /><span>Pending: {payment.pendingSubmissionsCount || 0}</span></div></div>;
      case 'onlinePayment':
        return <Button variant="default" size="sm" onClick={() => viewSubmissions(payment)} className="bg-blue-600 hover:bg-blue-700 text-white"><Eye className="h-3 w-3 mr-1" />Online</Button>;
      case 'physicalPayment':
        return <Button variant="outline" size="sm" onClick={() => viewPhysicalPayments(payment)} className="border-green-500 text-green-700 hover:bg-green-50"><Banknote className="h-3 w-3 mr-1" />Physical</Button>;
      case 'bankDetails':
        return payment.bankName || payment.accountHolderName ? (
          <Button variant="outline" size="sm" onClick={() => { setSelectedPaymentForBankDetails(payment); setBankDetailsDialogOpen(true); }} className="border-blue-500 text-blue-700 hover:bg-blue-50"><Building2 className="h-3 w-3 mr-1" />Bank Details</Button>
        ) : null;
      case 'deletePayment':
        return isAdminRole && (payment.submissionsCount ?? 0) === 0 ? (
          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmPayment(payment)}><Trash2 className="h-3 w-3 mr-1" />Delete</Button>
        ) : null;
      case 'submitPayment': {
        const status = payment.mySubmissionStatus;
        const latestSub = payment.mySubmissions?.[0];
        if (payment.hasSubmitted) {
          return (
            <div className="flex flex-col gap-1.5">
              <Badge className={status === 'VERIFIED' ? 'bg-green-100 text-green-800 border-green-200' : status === 'PENDING' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : status === 'REJECTED' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-blue-100 text-blue-800 border-blue-200'}>
                {status === 'VERIFIED' ? <CheckCircle className="h-3 w-3 mr-1" /> : status === 'PENDING' ? <Clock className="h-3 w-3 mr-1" /> : status === 'REJECTED' ? <XCircle className="h-3 w-3 mr-1" /> : <CircleDollarSign className="h-3 w-3 mr-1" />}
                {status?.replace('_', ' ')}
              </Badge>
              {status === 'REJECTED' && latestSub?.rejectionReason && <p className="text-xs text-red-600 leading-tight max-w-[180px]">{latestSub.rejectionReason}</p>}
              {latestSub?.canResubmit && (
                <Button variant="destructive" size="sm" onClick={() => { setSelectedPaymentForSubmission(payment); setSubmitPaymentDialogOpen(true); }}><CreditCard className="h-3 w-3 mr-1" />Resubmit</Button>
              )}
            </div>
          );
        }
        return <Button variant="default" size="sm" onClick={() => { setSelectedPaymentForSubmission(payment); setSubmitPaymentDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white"><CreditCard className="h-3 w-3 mr-1" />Submit</Button>;
      }
      default: return null;
    }
  };

  if (!selectedInstitute || !selectedClass) {
    return (
      <PageContainer maxWidth="full" className="h-full">
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <CreditCard className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Please select a class to view class payments.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full" className="h-full">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <Button variant="ghost" onClick={() => navigate(-1)} size="sm" className="shrink-0 p-2"><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate">Class Payments</h1>
            <p className="text-muted-foreground text-xs mt-0.5 truncate">
              Class: <span className="font-medium text-foreground">{selectedClass.name}</span> · {selectedInstitute.name}
            </p>
          </div>
        </div>
        {isAdminRole && (
          <Button onClick={() => setCreatePaymentDialogOpen(true)} size="sm" className="shrink-0 w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-1.5" />Create Payment
          </Button>
        )}
      </div>

      {/* Payer summary stats (Student / Parent) */}
      {isPayerRole && paymentsData && !loading && (() => {
        const payments = paymentsData.data;
        const needsSubmission = payments.filter(p => !p.hasSubmitted && p.status === 'ACTIVE').length;
        const pendingReview = payments.filter(p => p.mySubmissionStatus === 'PENDING').length;
        const verified = payments.filter(p => p.mySubmissionStatus === 'VERIFIED').length;
        const rejected = payments.filter(p => p.mySubmissionStatus === 'REJECTED').length;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3 flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10 shrink-0"><CreditCard className="h-4 w-4 text-primary" /></div><div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{payments.length}</p></div></CardContent></Card>
            <Card className={needsSubmission > 0 ? 'border-orange-400/60' : ''}><CardContent className="p-3 flex items-center gap-3"><div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20 shrink-0"><AlertCircle className="h-4 w-4 text-orange-500" /></div><div><p className="text-xs text-muted-foreground">Needs Submission</p><p className="text-xl font-bold text-orange-600">{needsSubmission}</p></div></CardContent></Card>
            <Card><CardContent className="p-3 flex items-center gap-3"><div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 shrink-0"><Clock className="h-4 w-4 text-yellow-600" /></div><div><p className="text-xs text-muted-foreground">Pending Review</p><p className="text-xl font-bold text-yellow-700">{pendingReview}</p></div></CardContent></Card>
            <Card><CardContent className="p-3 flex items-center gap-3"><div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20 shrink-0"><CheckCircle className="h-4 w-4 text-green-600" /></div><div><p className="text-xs text-muted-foreground">Verified</p><p className="text-xl font-bold text-green-700">{verified}</p></div></CardContent></Card>
            {rejected > 0 && (
              <Card className="col-span-2 sm:col-span-4 border-red-400/60 bg-red-50/50 dark:bg-red-950/20">
                <CardContent className="p-3 flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">{rejected} payment{rejected > 1 ? 's' : ''} rejected — expand the card to see the reason and resubmit.</p>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })()}

      {/* Search + View Toggle */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="flex-1 min-w-0 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search payments..." className="pl-9 text-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-2 items-center shrink-0">
              <Button variant="outline" onClick={() => loadPayments(page, rowsPerPage, true)} disabled={loading} size="sm">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="ml-1.5">{loading ? 'Loading...' : 'Refresh'}</span>
              </Button>
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
                <button onClick={() => { setViewMode('card'); setMatrixMode(false); }} className={`p-2 rounded-md transition-colors ${!matrixMode && viewMode === 'card' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Card View"><LayoutGrid className="h-4 w-4" /></button>
                <button onClick={() => { setViewMode('table'); setMatrixMode(false); }} className={`p-2 rounded-md transition-colors ${!matrixMode && viewMode === 'table' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Table View"><Table2 className="h-4 w-4" /></button>
                {isAdminRole && (
                  <button onClick={() => setMatrixMode(true)} className={`p-2 rounded-md transition-colors ${matrixMode ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Matrix View"><Grid3x3 className="h-4 w-4" /></button>
                )}
              </div>
              {!matrixMode && viewMode === 'table' && <ColumnConfigurator allColumns={colDefs} colState={colState} onToggle={toggleColumn} onReset={resetColumns} />}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && <Card><CardContent className="pt-6 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></CardContent></Card>}

      {!loading && (
        <Card className="w-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5 text-primary" />
                {isPayerRole ? 'My Class Payments' : 'Class Payment Records'}
              </CardTitle>
              {paymentsData && <Badge variant="outline" className="text-sm">{filteredPayments.length} of {paymentsData.total} total</Badge>}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {matrixMode ? (
              <ClassPaymentMatrix
                payments={paymentsData?.data ?? []}
                instituteId={selectedInstitute.id}
                classId={selectedClass.id}
              />
            ) : filteredPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center"><CreditCard className="h-7 w-7 opacity-40" /></div>
                <p className="font-medium">No payments found</p>
                <p className="text-sm text-muted-foreground">No class payment records available.</p>
              </div>
            ) : viewMode === 'card' ? (
              <div className="p-4 grid grid-cols-1 gap-4">
                {filteredPayments.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(payment => {
                  const isExpanded = expandedPaymentId === payment.id;
                  const dueDate = payment.lastDate ? new Date(payment.lastDate) : null;
                  const isOverdue = dueDate ? dueDate < new Date() : false;
                  const isMandatory = payment.priority === 'MANDATORY';
                  const totalSubs = payment.submissionsCount ?? 0;
                  const verifiedSubs = payment.verifiedSubmissionsCount ?? 0;
                  const progressPct = totalSubs > 0 ? Math.round((verifiedSubs / totalSubs) * 100) : 0;
                  return (
                    <Card key={payment.id} className={`hover:shadow-lg transition-all overflow-hidden ${isOverdue ? 'border-destructive' : isMandatory ? 'border-orange-400/60' : 'border-border'}`}>
                      <div className={`h-1.5 w-full ${isOverdue ? 'bg-destructive' : isMandatory ? 'bg-orange-500' : 'bg-primary'}`} />
                      <div className="p-4 flex items-start gap-3 cursor-pointer select-none" onClick={() => setExpandedPaymentId(isExpanded ? null : payment.id)}>
                        <div className={`p-2.5 rounded-xl shrink-0 ${isOverdue ? 'bg-destructive/10' : isMandatory ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-primary/10'}`}>
                          <CreditCard className={`h-5 w-5 ${isOverdue ? 'text-destructive' : isMandatory ? 'text-orange-500' : 'text-primary'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{payment.title}</p>
                          <div className="text-2xl font-extrabold leading-tight mt-0.5">Rs {Number(payment.amount).toLocaleString()}</div>
                          {dueDate && <p className={`text-xs mt-1 flex items-center gap-1 ${isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>{isOverdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}{isOverdue ? 'Overdue · ' : 'Due '}{dueDate.toLocaleDateString()}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Badge className={getStatusColor(payment.status)}>{payment.status}</Badge>
                          {instituteRole !== 'Student' && <Badge className={`text-xs ${getPriorityColor(payment.priority)}`}>{payment.priority}</Badge>}
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t pt-3 space-y-3">
                          {payment.description && <p className="text-xs text-muted-foreground leading-relaxed">{payment.description}</p>}
                          {payment.targetType && <p className="text-xs text-muted-foreground">Target: <span className="font-medium text-foreground">{payment.targetType}</span></p>}
                          {isAdminRole && totalSubs > 0 && (
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs text-muted-foreground"><span>Submissions</span><span className="font-medium">{verifiedSubs}/{totalSubs} verified</span></div>
                              <div className="h-2 w-full rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} /></div>
                            </div>
                          )}
                          <div className="pt-2 border-t">
                            {isPayerRole && (() => {
                              const allSubs = payment.mySubmissions || [];
                              const latestSub = allSubs[0];
                              if (!payment.hasSubmitted) return (
                                <Button size="sm" className="w-full" onClick={() => { setSelectedPaymentForSubmission(payment); setSubmitPaymentDialogOpen(true); }}>
                                  <CreditCard className="h-3.5 w-3.5 mr-1.5" />Submit Payment
                                </Button>
                              );
                              return (
                                <div className="flex flex-col gap-2">
                                  {allSubs.length > 1 && <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1"><History className="h-3 w-3" />Submission History ({allSubs.length})</p>}
                                  <div className="space-y-1.5">
                                    {allSubs.map((sub, idx) => (
                                      <div key={sub.id || idx} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs border ${sub.status === 'VERIFIED' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300' : sub.status === 'PENDING' ? 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20' : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20'}`}>
                                        <div className="shrink-0 mt-0.5">{sub.status === 'VERIFIED' ? <CheckCircle className="h-3.5 w-3.5" /> : sub.status === 'PENDING' ? <Clock className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}</div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-semibold">{sub.status === 'VERIFIED' ? 'Verified' : sub.status === 'PENDING' ? 'Under Review' : sub.status?.replace('_', ' ')}</span>
                                            {sub.submittedAmount && <span className="opacity-80">Rs {Number(sub.submittedAmount).toLocaleString()}</span>}
                                            <span className="ml-auto text-[10px] opacity-60 shrink-0">{sub.uploadedAt ? new Date(sub.uploadedAt).toLocaleDateString() : ''}</span>
                                          </div>
                                          {sub.status === 'REJECTED' && sub.rejectionReason && <p className="mt-0.5 opacity-90 break-words">{sub.rejectionReason}</p>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {latestSub?.canResubmit && (
                                    <Button size="sm" variant="destructive" className="w-full" onClick={() => { setSelectedPaymentForSubmission(payment); setSubmitPaymentDialogOpen(true); }}>
                                      <CreditCard className="h-3.5 w-3.5 mr-1.5" />Resubmit Payment
                                    </Button>
                                  )}
                                </div>
                              );
                            })()}
                            {isAdminRole && (
                              <div className="flex flex-col gap-1.5">
                                {(payment.bankName || payment.accountHolderName) && (
                                  <Button variant="outline" size="sm" className="w-full border-blue-500 text-blue-700 hover:bg-blue-50" onClick={() => { setSelectedPaymentForBankDetails(payment); setBankDetailsDialogOpen(true); }}><Building2 className="h-3.5 w-3.5 mr-1.5" />Bank Details</Button>
                                )}
                                <Button variant="outline" size="sm" className="w-full" onClick={() => viewSubmissions(payment)}><Eye className="h-3.5 w-3.5 mr-1.5" />Online Payment</Button>
                                <Button variant="outline" size="sm" className="w-full border-green-500 text-green-700 hover:bg-green-50" onClick={() => viewPhysicalPayments(payment)}><Banknote className="h-3.5 w-3.5 mr-1.5" />Physical Payment</Button>
                                {(payment.submissionsCount ?? 0) === 0 && (
                                  <Button variant="destructive" size="sm" className="w-full" onClick={() => setDeleteConfirmPayment(payment)}><Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete Payment</Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Paper sx={{ width: '100%', overflow: 'hidden', height: 'calc(100vh - 300px)', display: 'flex', flexDirection: 'column' }}>
                <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                  <Table stickyHeader sx={{ tableLayout: 'fixed', minWidth: visDefs.reduce((sum, col) => sum + getWidth(col.key), 0) }}>
                    <TableHead>
                      <TableRow>
                        {visDefs.map(col => (
                          <TableCell key={col.key} onMouseEnter={() => setHoveredCol(col.key)} onMouseLeave={() => setHoveredCol(null)} style={{ position: 'relative', width: getWidth(col.key), userSelect: 'none' }} sx={{ fontWeight: 600, backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', borderBottom: '1px solid hsl(var(--border))' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{col.header}</div>
                            <ResizeHandle colId={col.key} hoveredCol={hoveredCol} activeCol={activeCol} onMouseDown={startResize} />
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredPayments.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(payment => (
                        <TableRow hover key={payment.id}>
                          {visDefs.map(col => (
                            <TableCell key={col.key} style={{ width: getWidth(col.key), maxWidth: getWidth(col.key) }}>{renderCell(col.key, payment)}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination rowsPerPageOptions={[25, 50, 100]} component="div" count={searchQuery ? filteredPayments.length : paymentsData?.total || 0} rowsPerPage={rowsPerPage} page={page} onPageChange={(_, p) => { setPage(p); loadPayments(p, rowsPerPage); }} onRowsPerPageChange={e => { const n = +e.target.value; setRowsPerPage(n); setPage(0); loadPayments(0, n); }} />
              </Paper>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {paymentsData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Active Amount</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">Rs {paymentsData.data.filter(p => p.status === 'ACTIVE').reduce((sum, p) => sum + parseFloat(p.amount), 0).toLocaleString()}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Payments</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{paymentsData.total}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Mandatory Payments</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{paymentsData.data.filter(p => p.priority === 'MANDATORY').length}</p></CardContent></Card>
        </div>
      )}

      {/* Dialogs */}
      {selectedInstitute && isAdminRole && (
        <VerifySubmissionDialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen} submission={selectedSubmission as any} instituteId={selectedInstitute.id} onSuccess={() => { setVerifyDialogOpen(false); setSelectedSubmission(null); loadPayments(); }} />
      )}

      {selectedInstitute && selectedClass && (
        <CreateClassPaymentForm open={createPaymentDialogOpen} onOpenChange={setCreatePaymentDialogOpen} instituteId={selectedInstitute.id} classId={selectedClass.id} onSuccess={() => loadPayments(0, rowsPerPage, true)} />
      )}

      {isPayerRole && selectedPaymentForSubmission && (
        <SubmitClassPaymentDialog open={submitPaymentDialogOpen} onOpenChange={setSubmitPaymentDialogOpen} payment={selectedPaymentForSubmission} onSuccess={() => { setSubmitPaymentDialogOpen(false); setSelectedPaymentForSubmission(null); loadPayments(0, rowsPerPage, true); }} />
      )}

      <AlertDialog open={!!deleteConfirmPayment} onOpenChange={open => { if (!open) setDeleteConfirmPayment(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete <strong>"{deleteConfirmPayment?.title}"</strong> (Rs {Number(deleteConfirmPayment?.amount || 0).toLocaleString()})? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? 'Deleting...' : 'Delete'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClassPaymentBankDetailsDialog open={bankDetailsDialogOpen} onOpenChange={setBankDetailsDialogOpen} payment={selectedPaymentForBankDetails} />
    </PageContainer>
  );
};

export default ClassPayments;
