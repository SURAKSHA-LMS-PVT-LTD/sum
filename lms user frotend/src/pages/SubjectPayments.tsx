import React, { useState, useEffect } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, ArrowLeft, Download, Search, BookOpen, Eye, CheckCircle, Clock, FileText, History, Shield, Plus, RefreshCw, XCircle, ChevronDown, AlertCircle, Calendar, LayoutGrid, Table2, Trash2, CircleDollarSign, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { subjectPaymentsApi, SubjectPayment, SubjectPaymentsResponse } from '@/api/subjectPayments.api';
import { institutePaymentsApi, PaymentSubmission } from '@/api/institutePayments.api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import VerifySubmissionDialog from '@/components/forms/VerifySubmissionDialog';
import StudentSubmissionsDialog from '@/components/StudentSubmissionsDialog';
import CreateSubjectPaymentForm from '@/components/forms/CreateSubjectPaymentForm';
import SubmitSubjectPaymentDialog from '@/components/forms/SubmitSubjectPaymentDialog';
import SubjectPaymentBankDetailsDialog from '@/components/forms/SubjectPaymentBankDetailsDialog';
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
import { useResizableColumns } from '@/hooks/useResizableColumns';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';
const SubjectPayments = () => {
  const {
    user,
    selectedInstitute,
    selectedClass,
    selectedSubject,
    isViewingAsParent,
    selectedChild
  } = useAuth();
  // When parent is viewing as child, use the child's student ID
  const effectiveStudentId = isViewingAsParent && selectedChild ? selectedChild.id : undefined;
  const instituteRole = useInstituteRole();
  
  // Check if institute type is tuition_institute
  const isTuitionInstitute = selectedInstitute?.type === 'tuition_institute';
  const { subjectLabel } = useInstituteLabels();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [subjectPaymentsData, setSubjectPaymentsData] = useState<SubjectPaymentsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<PaymentSubmission | null>(null);
  const [submissionsDialogOpen, setSubmissionsDialogOpen] = useState(false);
  const [createPaymentDialogOpen, setCreatePaymentDialogOpen] = useState(false);
  const [submitPaymentDialogOpen, setSubmitPaymentDialogOpen] = useState(false);
  const [selectedPaymentForSubmission, setSelectedPaymentForSubmission] = useState<SubjectPayment | null>(null);
  const [bankDetailsDialogOpen, setBankDetailsDialogOpen] = useState(false);
  const [selectedPaymentForBankDetails, setSelectedPaymentForBankDetails] = useState<SubjectPayment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const { viewMode, setViewMode } = useViewMode();
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);
  const [deleteConfirmPayment, setDeleteConfirmPayment] = useState<SubjectPayment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const contextKey = `${selectedInstitute?.id}-${selectedClass?.id}-${selectedSubject?.id}`;
  const [lastLoadedContext, setLastLoadedContext] = useState<string>('');

  // Auto-load subject payments when subject is selected
  useEffect(() => {
    if (selectedInstitute && selectedClass && selectedSubject && contextKey !== lastLoadedContext) {
      setLastLoadedContext(contextKey);
      setPage(0); // Reset to first page
      loadSubjectPayments(0, rowsPerPage, false); // Auto-load from cache
    }
  }, [contextKey]);

  // Load subject payments based on user role
  const loadSubjectPayments = async (pageNum: number = page, limitNum: number = rowsPerPage, forceRefresh: boolean = false) => {
    if (!selectedInstitute || !selectedClass || !selectedSubject) {
      toast({
        title: "Missing Selection",
        description: "Please select institute, class, and subject first.",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      let response: SubjectPaymentsResponse;
      if (instituteRole === 'Student') {
        // my-payments returns inline mySubmissions per payment — no extra call needed
        response = await subjectPaymentsApi.getMySubjectPayments(selectedInstitute.id, selectedClass.id, selectedSubject.id, pageNum + 1, limitNum, forceRefresh, effectiveStudentId);
      } else if (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher') {
        // For admins and teachers, use regular endpoint
        response = await subjectPaymentsApi.getSubjectPayments(selectedInstitute.id, selectedClass.id, selectedSubject.id, pageNum + 1, limitNum, forceRefresh);
      } else {
        toast({
          title: "Access Denied",
          description: "You don't have permission to view subject payments.",
          variant: "destructive"
        });
        return;
      }
      setSubjectPaymentsData(response);
      toast({
        title: "Success",
        description: "Subject payments loaded successfully."
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load subject payments.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle verification for admins
  const handleVerify = (submission: PaymentSubmission) => {
    if (instituteRole !== 'InstituteAdmin') {
      toast({
        title: "Access Denied",
        description: "Only Institute Admins can verify submissions.",
        variant: "destructive"
      });
      return;
    }
    setSelectedSubmission(submission);
    setVerifyDialogOpen(true);
  };

  // View submissions for a payment (admins/teachers only)
  const viewSubmissions = (payment: SubjectPayment) => {
    if (instituteRole !== 'InstituteAdmin' && instituteRole !== 'Teacher') {
      toast({
        title: "Access Denied",
        description: "You don't have permission to view submissions.",
        variant: "destructive"
      });
      return;
    }
    navigate(`/payment-submissions?paymentId=${payment.id}&paymentTitle=${encodeURIComponent(payment.title)}`);
  };

  // View physical payment submissions (admins/teachers only)
  const viewPhysicalPayments = (payment: SubjectPayment) => {
    navigate(
      `/payment-submissions-pysical?paymentId=${payment.id}&paymentTitle=${encodeURIComponent(payment.title)}` +
      `&instituteId=${selectedInstitute?.id ?? ''}&classId=${selectedClass?.id ?? ''}&subjectId=${selectedSubject?.id ?? ''}`
    );
  };

  // View bank details for payment
  const handleViewBankDetails = (payment: SubjectPayment) => {
    setSelectedPaymentForBankDetails(payment);
    setBankDetailsDialogOpen(true);
  };

  // Soft delete a subject payment (admin/teacher, blocked if submissions exist)
  const handleDeletePayment = async () => {
    if (!deleteConfirmPayment) return;
    setDeleting(true);
    try {
      await subjectPaymentsApi.deletePayment(deleteConfirmPayment.id);
      toast({
        title: "Payment Deleted",
        description: `"${deleteConfirmPayment.title}" has been deleted successfully.`,
      });
      setDeleteConfirmPayment(null);
      loadSubjectPayments(page, rowsPerPage, true);
    } catch (error: any) {
      toast({
        title: "Cannot Delete Payment",
        description: error.message || 'Failed to delete payment. It may have submissions.',
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Handle view my submissions for students
  const handleViewMySubmissions = () => {
    if (instituteRole !== 'Student') {
      toast({
        title: "Access Denied",
        description: "This feature is only available for students.",
        variant: "destructive"
      });
      return;
    }
    setSubmissionsDialogOpen(true);
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'MANDATORY':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'OPTIONAL':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Pagination handlers
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    loadSubjectPayments(newPage, rowsPerPage);
  };
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = +event.target.value;
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    loadSubjectPayments(0, newRowsPerPage);
  };

  // Handle search with live filtering
  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  // Filter data locally for live search
  const filteredPayments = React.useMemo(() => {
    if (!subjectPaymentsData?.data) return [];
    if (!searchQuery.trim()) return subjectPaymentsData.data;
    const searchLower = searchQuery.toLowerCase();
    return subjectPaymentsData.data.filter(payment => {
      // Search in Title
      const matchesTitle = payment.title?.toLowerCase().includes(searchLower);

      // Search in Amount (convert to string and search)
      const matchesAmount = payment.amount?.toString().includes(searchQuery.trim());

      // Search in Priority
      const matchesPriority = payment.priority?.toLowerCase().includes(searchLower);
      return matchesTitle || matchesAmount || matchesPriority;
    });
  }, [subjectPaymentsData?.data, searchQuery]);

  // Column definitions (role-aware, each with resize + visibility control)
  const spColDefs = React.useMemo<ColumnDef[]>(() => [
    { key: 'title', header: 'Title', locked: true, defaultWidth: 200, minWidth: 120 },
    { key: 'amount', header: 'Amount (Rs)', defaultVisible: true, defaultWidth: 120, minWidth: 80 },
    { key: 'status', header: 'Status', defaultVisible: true, defaultWidth: 100, minWidth: 80 },
    ...(instituteRole !== 'Student' ? [{ key: 'priority', header: 'Priority', defaultVisible: true, defaultWidth: 100, minWidth: 80 } as ColumnDef] : []),
    { key: 'dueDate', header: 'Due Date', defaultVisible: true, defaultWidth: 120, minWidth: 80 },
    { key: 'bankDetails', header: 'Bank Details', defaultVisible: true, defaultWidth: 140, minWidth: 120 },
    ...(instituteRole === 'Student' ? [{ key: 'mySubmissionStatus', header: 'My Submission', defaultVisible: true, defaultWidth: 140, minWidth: 80 } as ColumnDef] : []),
    ...(instituteRole !== 'Student' ? [{ key: 'submissions', header: 'Submissions', defaultVisible: true, defaultWidth: 150, minWidth: 100 } as ColumnDef] : []),
    ...(instituteRole !== 'Student' ? [{ key: 'onlinePayment', header: 'Online Payment', defaultVisible: true, defaultWidth: 150, minWidth: 120 } as ColumnDef] : []),
    ...(instituteRole !== 'Student' ? [{ key: 'physicalPayment', header: 'Physical Payment', defaultVisible: true, defaultWidth: 160, minWidth: 120 } as ColumnDef] : []),
    ...(instituteRole !== 'Student' ? [{ key: 'deletePayment', header: 'Delete', defaultVisible: true, defaultWidth: 90, minWidth: 70 } as ColumnDef] : []),
    ...(instituteRole === 'Student' ? [{ key: 'submitPayment', header: 'Submit', locked: true, defaultWidth: 160, minWidth: 120 } as ColumnDef] : []),
  ], [instituteRole]);
  const spColIds = React.useMemo(() => spColDefs.map(c => c.key), [spColDefs]);
  const spColDefaultWidths = React.useMemo(() => {
    const m: Record<string, number> = {};
    spColDefs.forEach(c => { m[c.key] = c.defaultWidth || 120; });
    return m;
  }, [spColDefs]);
  const { getWidth: getSPColWidth, setHoveredCol: setSPHoveredCol, ResizeHandle: SPResizeHandle } = useResizableColumns(spColIds, spColDefaultWidths);
  const { colState: spColState, visibleColumns: spVisDefs, toggleColumn: toggleSPCol, resetColumns: resetSPCols } = useColumnConfig(spColDefs, 'subject-payments');

  const renderSPCell = (colKey: string, payment: SubjectPayment): React.ReactNode => {
    switch (colKey) {
      case 'title':
        return (
          <div>
            <div className="font-medium text-foreground">{payment.title}</div>
            <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{payment.description || '-'}</div>
            <div className="text-xs text-muted-foreground mt-1">Target: {payment.targetType}</div>
          </div>
        );
      case 'amount':
        return <div className="font-semibold text-lg text-primary">Rs {Number(payment.amount).toLocaleString()}</div>;
      case 'status':
        return <Badge className={getStatusColor(payment.status)}>{payment.status}</Badge>;
      case 'priority':
        return <Badge className={getPriorityColor(payment.priority)}>{payment.priority}</Badge>;
      case 'dueDate': {
        const d = new Date(payment.lastDate);
        const overdue = d < new Date() && d.toDateString() !== new Date().toDateString();
        return (
          <div className={`text-sm ${overdue ? 'text-destructive font-medium' : 'text-foreground'}`}>
            {d.toLocaleDateString()}
            {overdue && <div className="text-xs text-destructive">⚠ Overdue</div>}
          </div>
        );
      }
      case 'mySubmissionStatus': {
        const status = payment.mySubmissionStatus;
        const hasSubmitted = payment.hasSubmitted;
        const subCount = payment.mySubmissions?.length ?? 0;
        if (!hasSubmitted) return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">Not Submitted</Badge>;
        switch (status) {
          case 'VERIFIED': return (
            <div className="space-y-0.5">
              <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>
              {subCount > 1 && <p className="text-[11px] text-muted-foreground">{subCount} submissions total</p>}
            </div>
          );
          case 'PENDING': return (
            <div className="space-y-0.5">
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
              {subCount > 1 && <p className="text-[11px] text-muted-foreground">{subCount} submissions total</p>}
            </div>
          );
          case 'HALF_VERIFIED': return (
            <div className="space-y-0.5">
              <Badge className="bg-orange-100 text-orange-800 border-orange-200"><CircleDollarSign className="h-3 w-3 mr-1" />Half Paid</Badge>
              {subCount > 1 && <p className="text-[11px] text-muted-foreground">{subCount} submissions total</p>}
            </div>
          );
          case 'QUARTER_VERIFIED': return (
            <div className="space-y-0.5">
              <Badge className="bg-purple-100 text-purple-800 border-purple-200"><CircleDollarSign className="h-3 w-3 mr-1" />Quarter Paid</Badge>
              {subCount > 1 && <p className="text-[11px] text-muted-foreground">{subCount} submissions total</p>}
            </div>
          );
          case 'REJECTED': return (
            <div className="space-y-1">
              <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
              {subCount > 1 && <p className="text-[11px] text-muted-foreground">{subCount} submissions total</p>}
              {payment.mySubmissions?.[0]?.rejectionReason && (
                <p className="text-xs text-red-600 leading-tight">{payment.mySubmissions[0].rejectionReason}</p>
              )}
            </div>
          );
          default: return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Submitted</Badge>;
        }
      }
      case 'submissions':
        return (
          <div className="text-xs space-y-1">
            <div className="flex items-center space-x-1"><FileText className="h-3 w-3" /><span>Total: {payment.submissionsCount || 0}</span></div>
            <div className="flex items-center space-x-1 text-green-600"><CheckCircle className="h-3 w-3" /><span>Verified: {payment.verifiedSubmissionsCount || 0}</span></div>
            <div className="flex items-center space-x-1 text-yellow-600"><Clock className="h-3 w-3" /><span>Pending: {payment.pendingSubmissionsCount || 0}</span></div>
          </div>
        );
      case 'onlinePayment':
        return (
          <Button variant="default" size="sm" onClick={() => viewSubmissions(payment)} className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white">
            <Eye className="h-3 w-3" /><span>Online Payment</span>
          </Button>
        );
      case 'physicalPayment':
        return (
          <Button variant="outline" size="sm" onClick={() => viewPhysicalPayments(payment)} className="flex items-center space-x-1 border-green-500 text-green-700 hover:bg-green-50">
            <CreditCard className="h-3 w-3" /><span>Physical Payment</span>
          </Button>
        );
      case 'bankDetails':
        return payment.bankName || payment.accountHolderName || payment.accountHolderNumber ? (
          <Button variant="outline" size="sm" onClick={() => handleViewBankDetails(payment)} className="flex items-center space-x-1 border-blue-500 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20">
            <Building2 className="h-3 w-3" /><span>Bank Details</span>
          </Button>
        ) : null;
      case 'deletePayment':
        return (payment.submissionsCount ?? 0) === 0 ? (
          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmPayment(payment)} className="flex items-center space-x-1">
            <Trash2 className="h-3 w-3" /><span>Delete</span>
          </Button>
        ) : null;
      case 'submitPayment': {
        const status = payment.mySubmissionStatus;
        const hasSubmitted = payment.hasSubmitted;
        const latestSub = payment.mySubmissions?.[0];
        if (hasSubmitted) {
          return (
            <div className="flex flex-col space-y-1.5">
              <Badge className={status === 'VERIFIED' ? "bg-green-100 text-green-800 border-green-200" : status === 'PENDING' ? "bg-yellow-100 text-yellow-800 border-yellow-200" : status === 'HALF_VERIFIED' ? "bg-orange-100 text-orange-800 border-orange-200" : status === 'QUARTER_VERIFIED' ? "bg-purple-100 text-purple-800 border-purple-200" : status === 'REJECTED' ? "bg-red-100 text-red-800 border-red-200" : "bg-blue-100 text-blue-800 border-blue-200"}>
                {status === 'VERIFIED' && <CheckCircle className="h-3 w-3 mr-1" />}
                {status === 'PENDING' && <Clock className="h-3 w-3 mr-1" />}
                {status === 'REJECTED' && <XCircle className="h-3 w-3 mr-1" />}
                {(status === 'HALF_VERIFIED' || status === 'QUARTER_VERIFIED') && <CircleDollarSign className="h-3 w-3 mr-1" />}
                {status === 'VERIFIED' ? 'Verified' : status === 'PENDING' ? 'Under Review' : status === 'HALF_VERIFIED' ? 'Half Paid' : status === 'QUARTER_VERIFIED' ? 'Quarter Paid' : status === 'REJECTED' ? 'Rejected' : 'Submitted'}
              </Badge>
              {status === 'REJECTED' && latestSub?.rejectionReason && (
                <p className="text-xs text-red-600 leading-tight max-w-[180px]">{latestSub.rejectionReason}</p>
              )}
              {latestSub?.canResubmit && (
                <Button variant="destructive" size="sm" onClick={() => { setSelectedPaymentForSubmission(payment); setSubmitPaymentDialogOpen(true); }} className="flex items-center space-x-1">
                  <CreditCard className="h-3 w-3" /><span>Resubmit</span>
                </Button>
              )}
            </div>
          );
        }
        return (
          <Button variant="default" size="sm" onClick={() => { setSelectedPaymentForSubmission(payment); setSubmitPaymentDialogOpen(true); }} className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white">
            <CreditCard className="h-3 w-3" /><span>Submit</span>
          </Button>
        );
      }
      default: return null;
    }
  };
  return <PageContainer className="h-full">
      {/* Header Section - Mobile Optimized */}
      <div className="flex flex-col space-y-3 sm:space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2 sm:gap-4 min-w-0">
            <Button variant="ghost" onClick={() => navigate(-1)} className="shrink-0 p-2 sm:p-2.5" size="sm">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Back</span>
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">
                {subjectLabel} Payments
              </h1>
              {selectedSubject && <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">
                  {subjectLabel}: <span className="font-medium text-foreground">{selectedSubject.name}</span>
                </p>}
            </div>
          </div>
          {(instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher') && <Button onClick={() => setCreatePaymentDialogOpen(true)} className="shrink-0 w-full sm:w-auto" size="sm" disabled={!selectedInstitute || !selectedClass || !selectedSubject}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Payment
            </Button>}
        </div>
      </div>

      {/* Subject Info Card - Mobile Optimized */}
      {selectedSubject && <Card className="border-border">
          <CardHeader className="p-3 sm:p-4 md:pb-4">
            <CardTitle className="flex items-center gap-2 text-foreground text-sm sm:text-base">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
              <span className="truncate">{selectedSubject.name}</span>
            </CardTitle>
            {selectedClass && <p className="text-muted-foreground text-xs sm:text-sm mt-1 truncate">
                Class: {selectedClass.name} | Institute: {selectedInstitute?.name}
              </p>}
          </CardHeader>
        </Card>}

      {/* Student summary stats — shown only when student has loaded payments */}
      {instituteRole === 'Student' && subjectPaymentsData && !loading && (() => {
        const payments = subjectPaymentsData.data;
        const total = payments.length;
        const needsSubmission = payments.filter(p => !p.hasSubmitted && p.status === 'ACTIVE').length;
        const pendingReview = payments.filter(p => p.mySubmissionStatus === 'PENDING').length;
        const verified = payments.filter(p => p.mySubmissionStatus === 'VERIFIED').length;
        const rejected = payments.filter(p => p.mySubmissionStatus === 'REJECTED').length;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0"><CreditCard className="h-4 w-4 text-primary" /></div>
                <div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{total}</p></div>
              </CardContent>
            </Card>
            <Card className={`border-border ${needsSubmission > 0 ? 'border-orange-400/60' : ''}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20 shrink-0"><AlertCircle className="h-4 w-4 text-orange-500" /></div>
                <div><p className="text-xs text-muted-foreground">Needs Submission</p><p className="text-xl font-bold text-orange-600">{needsSubmission}</p></div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 shrink-0"><Clock className="h-4 w-4 text-yellow-600" /></div>
                <div><p className="text-xs text-muted-foreground">Pending Review</p><p className="text-xl font-bold text-yellow-700">{pendingReview}</p></div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20 shrink-0"><CheckCircle className="h-4 w-4 text-green-600" /></div>
                <div><p className="text-xs text-muted-foreground">Verified</p><p className="text-xl font-bold text-green-700">{verified}</p></div>
              </CardContent>
            </Card>
            {rejected > 0 && (
              <Card className="col-span-2 sm:col-span-4 border-red-400/60 bg-red-50/50 dark:bg-red-950/20">
                <CardContent className="p-3 flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    {rejected} payment{rejected > 1 ? 's' : ''} rejected — expand the card to see the reason and resubmit.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })()}

      {/* Search and Actions - Mobile Optimized */}
      <Card>
        <CardContent className="p-3 sm:p-4 md:pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search payments..." className="pl-9 sm:pl-10 w-full text-sm" value={searchQuery} onChange={e => handleSearch(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 shrink-0 items-center">
              <Button variant="outline" onClick={() => loadSubjectPayments(page, rowsPerPage, true)} disabled={loading || !selectedInstitute || !selectedClass || !selectedSubject} size="sm" className="flex-1 sm:flex-none">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="ml-1.5 sm:ml-2">{loading ? 'Loading...' : 'Refresh'}</span>
              </Button>
              {/* View Mode Toggle */}
              <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
                <button onClick={() => setViewMode('card')} className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Card View"><LayoutGrid className="h-4 w-4" /></button>
                <button onClick={() => setViewMode('table')} className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Table View"><Table2 className="h-4 w-4" /></button>
              </div>
              {viewMode === 'table' && (
                <ColumnConfigurator allColumns={spColDefs} colState={spColState} onToggle={toggleSPCol} onReset={resetSPCols} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>}

      {/* Subject Payments Table */}
      {!loading && <Card className="w-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5 text-primary" />
                {instituteRole === 'Student' ? `My ${subjectLabel} Payments` : `${subjectLabel} Payment Records`}
              </CardTitle>
              {subjectPaymentsData && <Badge variant="outline" className="text-sm">
                  {filteredPayments.length} of {subjectPaymentsData.total} total
                </Badge>}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredPayments.length === 0 ? <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                  <CreditCard className="h-7 w-7 opacity-40" />
                </div>
                <p className="font-medium text-foreground">No payments found</p>
                <p className="text-sm text-muted-foreground">No payment records available for this subject.</p>
              </div> : viewMode === 'card' ? (
                <div className="p-4 grid grid-cols-1 gap-4">
                  {filteredPayments.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(payment => {
                    const isExpanded = expandedPaymentId === payment.id;
                    const dueDate = payment.lastDate ? new Date(payment.lastDate) : null;
                    const isOverdue = dueDate ? dueDate < new Date() && dueDate.toDateString() !== new Date().toDateString() : false;
                    const isMandatory = payment.priority === 'MANDATORY';
                    const totalSubs = payment.submissionsCount ?? 0;
                    const verifiedSubs = payment.verifiedSubmissionsCount ?? 0;
                    const progressPct = totalSubs > 0 ? Math.round((verifiedSubs / totalSubs) * 100) : 0;
                    return (
                      <Card key={payment.id} className={`hover:shadow-lg transition-all duration-200 overflow-hidden ${
                        isOverdue ? 'border-destructive' : isMandatory ? 'border-orange-400/60' : 'border-border'
                      }`}>
                        {/* Accent bar */}
                        <div className={`h-1.5 w-full ${
                          isOverdue ? 'bg-destructive' : isMandatory ? 'bg-orange-500' : 'bg-primary'
                        }`} />
                        {/* Header */}
                        <div
                          className="p-4 flex items-start gap-3 cursor-pointer select-none"
                          onClick={() => setExpandedPaymentId(isExpanded ? null : payment.id)}
                        >
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            isOverdue ? 'bg-destructive/10' : isMandatory ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-primary/10'
                          }`}>
                            <CreditCard className={`h-5 w-5 ${
                              isOverdue ? 'text-destructive' : isMandatory ? 'text-orange-500' : 'text-primary'
                            }`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{payment.title}</p>
                            <div className="text-2xl font-extrabold text-foreground leading-tight mt-0.5">Rs {Number(payment.amount).toLocaleString()}</div>
                            {dueDate && (
                              <p className={`text-xs mt-1 flex items-center gap-1 ${
                                isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'
                              }`}>
                                {isOverdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                                {isOverdue ? 'Overdue · ' : 'Due '}{dueDate.toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <Badge className={getStatusColor(payment.status)}>{payment.status}</Badge>
                            {instituteRole !== 'Student' && <Badge className={`text-xs ${getPriorityColor(payment.priority)}`}>{payment.priority}</Badge>}
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                        {/* Expandable body */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t pt-3 space-y-3">
                            {payment.description && (
                              <p className="text-xs text-muted-foreground leading-relaxed">{payment.description}</p>
                            )}
                            {payment.targetType && (
                              <p className="text-xs text-muted-foreground">Target: <span className="font-medium text-foreground">{payment.targetType}</span></p>
                            )}
                            {(instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher') && totalSubs > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Submissions</span>
                                  <span className="font-medium">{verifiedSubs}/{totalSubs} verified</span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
                                </div>
                              </div>
                            )}
                            <div className="pt-2 border-t">
                              {instituteRole === 'Student' && (() => {
                                const allSubs = payment.mySubmissions || [];
                                const latestSub = allSubs[0];
                                if (!payment.hasSubmitted) return (
                                  <Button size="sm" className="w-full" onClick={() => { setSelectedPaymentForSubmission(payment); setSubmitPaymentDialogOpen(true); }}>
                                    <CreditCard className="h-3.5 w-3.5 mr-1.5" />Submit Payment
                                  </Button>
                                );
                                return (
                                  <div className="flex flex-col gap-2">
                                    {allSubs.length > 1 && (
                                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                        <History className="h-3 w-3" />Submission History ({allSubs.length})
                                      </p>
                                    )}
                                    <div className="space-y-1.5">
                                      {allSubs.map((sub, idx) => (
                                        <div key={sub.id || idx} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs border ${
                                          sub.status === 'VERIFIED' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300' :
                                          sub.status === 'HALF_VERIFIED' ? 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300' :
                                          sub.status === 'QUARTER_VERIFIED' ? 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' :
                                          sub.status === 'PENDING' ? 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300' :
                                          'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                                        }`}>
                                          <div className="shrink-0 mt-0.5">
                                            {sub.status === 'VERIFIED' ? <CheckCircle className="h-3.5 w-3.5" /> :
                                             (sub.status === 'HALF_VERIFIED' || sub.status === 'QUARTER_VERIFIED') ? <CircleDollarSign className="h-3.5 w-3.5" /> :
                                             sub.status === 'PENDING' ? <Clock className="h-3.5 w-3.5" /> :
                                             <XCircle className="h-3.5 w-3.5" />}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="font-semibold">{sub.status === 'VERIFIED' ? 'Verified' : sub.status === 'HALF_VERIFIED' ? 'Half Paid' : sub.status === 'QUARTER_VERIFIED' ? 'Quarter Paid' : sub.status === 'PENDING' ? 'Under Review' : 'Rejected'}</span>
                                              {sub.submittedAmount && <span className="opacity-80">Rs {Number(sub.submittedAmount).toLocaleString()}</span>}
                                              {idx === 0 && allSubs.length > 1 && <span className="text-[10px] opacity-60">(latest)</span>}
                                              <span className="ml-auto text-[10px] opacity-60 shrink-0">
                                                {sub.uploadedAt ? new Date(sub.uploadedAt).toLocaleDateString() : sub.paymentDate ? new Date(sub.paymentDate).toLocaleDateString() : ''}
                                              </span>
                                            </div>
                                            {sub.status === 'REJECTED' && sub.rejectionReason && (
                                              <p className="mt-0.5 opacity-90 break-words">{sub.rejectionReason}</p>
                                            )}
                                            {sub.status === 'PENDING' && sub.daysSinceSubmission != null && (
                                              <p className="mt-0.5 opacity-70">{sub.daysSinceSubmission}d awaiting review</p>
                                            )}
                                            {(sub.status === 'VERIFIED' || sub.status === 'HALF_VERIFIED' || sub.status === 'QUARTER_VERIFIED') && sub.verifiedAt && (
                                              <p className="mt-0.5 opacity-70">{sub.status === 'VERIFIED' ? 'Verified' : sub.status === 'HALF_VERIFIED' ? 'Half paid' : 'Quarter paid'} {new Date(sub.verifiedAt).toLocaleDateString()}</p>
                                            )}
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
                              {(instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher') && (
                                <div className="flex flex-col gap-1.5">
                                  {payment.bankName || payment.accountHolderName || payment.accountHolderNumber ? (
                                    <Button variant="outline" size="sm" className="w-full border-blue-500 text-blue-700 hover:bg-blue-50" onClick={() => handleViewBankDetails(payment)}>
                                      <Building2 className="h-3.5 w-3.5 mr-1.5" />Bank Details
                                    </Button>
                                  ) : null}
                                  <Button variant="outline" size="sm" className="w-full" onClick={() => viewSubmissions(payment)}><Eye className="h-3.5 w-3.5 mr-1.5" />Online Payment</Button>
                                  <Button variant="outline" size="sm" className="w-full border-green-500 text-green-700 hover:bg-green-50" onClick={() => viewPhysicalPayments(payment)}><CreditCard className="h-3.5 w-3.5 mr-1.5" />Physical Payment</Button>
                                  {(payment.submissionsCount ?? 0) === 0 && (
                                    <Button variant="destructive" size="sm" className="w-full" onClick={() => setDeleteConfirmPayment(payment)}>
                                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete Payment
                                    </Button>
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
              ) : <Paper sx={{
            width: '100%',
            overflow: 'hidden',
            height: 'calc(100vh - 420px)',
            display: 'flex',
            flexDirection: 'column',
          }}>
                <TableContainer sx={{
              flex: 1,
              overflow: 'auto'
            }}>
                  <Table stickyHeader aria-label="subject payments table" sx={{ tableLayout: 'fixed', minWidth: spVisDefs.reduce((sum, col) => sum + getSPColWidth(col.key), 0) }}>
                    <TableHead>
                      <TableRow>
                        {spVisDefs.map(col => (
                          <TableCell
                            key={col.key}
                            align={col.key === 'amount' ? 'right' : undefined}
                            onMouseEnter={() => setSPHoveredCol(col.key)}
                            onMouseLeave={() => setSPHoveredCol(null)}
                            style={{ position: 'relative', width: getSPColWidth(col.key), userSelect: 'none' }}
                            sx={{ fontWeight: 600, backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', borderBottom: '1px solid hsl(var(--border))' }}
                          >
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{col.header}</div>
                            <SPResizeHandle colId={col.key} />
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredPayments.length === 0 ? <TableRow>
                          <TableCell colSpan={spVisDefs.length} align="center">
                            <div className="py-12">
                              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                              <p className="text-muted-foreground text-lg mb-2">
                                {searchQuery ? 'No matching payments found' : 'No payments found'}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                {searchQuery ? 'Try adjusting your search criteria.' : 'Subject payments will appear here when created.'}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow> : filteredPayments.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(payment => (
                          <TableRow hover role="checkbox" tabIndex={-1} key={payment.id}>
                            {spVisDefs.map(col => (
                              <TableCell key={col.key} align={col.key === 'amount' ? 'right' : undefined} style={{ width: getSPColWidth(col.key), maxWidth: getSPColWidth(col.key) }}>
                                {renderSPCell(col.key, payment)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination rowsPerPageOptions={[25, 50, 100]} component="div" count={searchQuery ? filteredPayments.length : subjectPaymentsData.total || 0} rowsPerPage={rowsPerPage} page={page} onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage} />
              </Paper>}
          </CardContent>
        </Card>}

      {/* Summary Stats */}
      {subjectPaymentsData && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Active Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                Rs {subjectPaymentsData.data.filter(p => p.status === 'ACTIVE').reduce((sum, p) => sum + parseFloat(p.amount), 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {subjectPaymentsData.total}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Mandatory Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {subjectPaymentsData.data.filter(p => p.priority === 'MANDATORY').length}
              </p>
            </CardContent>
          </Card>
        </div>}

        {/* Verify Dialog for Institute Admins */}
        {selectedInstitute && instituteRole === 'InstituteAdmin' && <VerifySubmissionDialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen} submission={selectedSubmission} instituteId={selectedInstitute.id} onSuccess={() => {
        setVerifyDialogOpen(false);
        setSelectedSubmission(null);
        loadSubjectPayments(); // Reload data after verification
      }} />}

        {/* Student Submissions Dialog */}
        {user?.userType === 'Student' && selectedInstitute && selectedClass && selectedSubject && <StudentSubmissionsDialog open={submissionsDialogOpen} onOpenChange={setSubmissionsDialogOpen} instituteId={selectedInstitute.id} classId={selectedClass.id} subjectId={selectedSubject.id} />}

        {/* Create Subject Payment Dialog */}
        {selectedInstitute && selectedClass && selectedSubject && <CreateSubjectPaymentForm open={createPaymentDialogOpen} onOpenChange={setCreatePaymentDialogOpen} instituteId={selectedInstitute.id} classId={selectedClass.id} subjectId={selectedSubject.id} onSuccess={() => loadSubjectPayments(0, rowsPerPage, true)} />}

        {/* Submit Payment Dialog for Students/Parents */}
        {instituteRole === 'Student' && selectedPaymentForSubmission && <SubmitSubjectPaymentDialog open={submitPaymentDialogOpen} onOpenChange={setSubmitPaymentDialogOpen} payment={selectedPaymentForSubmission} onSuccess={() => {
        setSubmitPaymentDialogOpen(false);
        setSelectedPaymentForSubmission(null);
        loadSubjectPayments(0, rowsPerPage, true);
      }} />}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmPayment} onOpenChange={(open) => { if (!open) setDeleteConfirmPayment(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Payment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the payment <strong>"{deleteConfirmPayment?.title}"</strong> (Rs {Number(deleteConfirmPayment?.amount || 0).toLocaleString()})?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeletePayment}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bank Details Dialog */}
        <SubjectPaymentBankDetailsDialog 
          open={bankDetailsDialogOpen} 
          onOpenChange={setBankDetailsDialogOpen} 
          payment={selectedPaymentForBankDetails} 
        />

    </PageContainer>;
};
export default SubjectPayments;