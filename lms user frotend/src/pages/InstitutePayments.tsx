import React, { useState, useEffect, useMemo } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, ArrowLeft, Download, Search, Eye, Plus, RefreshCw, Filter, CheckCircle, AlertCircle, Calendar, LayoutGrid, Table2, Banknote, Trash2, Clock, XCircle, CircleDollarSign, Users, TrendingUp, Building2, CalendarDays } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { institutePaymentsApi, InstitutePaymentsResponse, StudentPaymentsResponse, InstitutePayment, InlineSubmission } from '@/api/institutePayments.api';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import CreatePaymentDialog from '@/components/forms/CreatePaymentDialog';
import SubmitPaymentDialog from '@/components/forms/SubmitPaymentDialog';
import BankDetailsDialog from '@/components/forms/BankDetailsDialog';
import MUITable from '@/components/ui/mui-table';
import { useTableData } from '@/hooks/useTableData';
import { Skeleton } from '@/components/ui/skeleton';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useViewMode } from '@/hooks/useViewMode';
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

const InstitutePayments = () => {
  console.log('🚀 InstitutePayments component rendering');

  // Check if we're in a Router context
  let navigate;
  let location;
  try {
    navigate = useNavigate();
    location = useLocation();
    console.log('✅ Router context available');
  } catch (error: any) {
    console.error('❌ Router context not available:', error);
    // Fallback navigation function
    navigate = (path: string | number) => {
      if (typeof path === 'string') {
        window.location.href = path;
      } else {
        window.history.go(path);
      }
    };
  }
  const {
    selectedInstitute,
    user,
    isViewingAsParent,
    selectedChild
  } = useAuth();
  const {
    toast
  } = useToast();
  const effectiveRole = useInstituteRole();
  // When parent is viewing as child, use the child's student ID for API calls
  const effectiveUserId = isViewingAsParent && selectedChild ? selectedChild.id : user?.id;
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [bankDetailsDialogOpen, setBankDetailsDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<InstitutePayment | null>(null);
  const [selectedPaymentForBankDetails, setSelectedPaymentForBankDetails] = useState<InstitutePayment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const isInstituteAdmin = effectiveRole === 'InstituteAdmin';
  const isStudent = effectiveRole === 'Student';
  const isTeacher = effectiveRole === 'Teacher';
  const { viewMode, setViewMode } = useViewMode();
  const CARD_INITIAL_SHOW = 8;
  const [showAllPaymentCards, setShowAllPaymentCards] = useState(false);
  const [deleteConfirmPayment, setDeleteConfirmPayment] = useState<InstitutePayment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [extendDatePayment, setExtendDatePayment] = useState<InstitutePayment | null>(null);
  const [extendDate, setExtendDate] = useState('');
  const [extending, setExtending] = useState(false);
  const endpoint = (isInstituteAdmin || isTeacher || isStudent)
    ? `/institute-payments/institute/${selectedInstitute?.id}/payments`
    : '';

  // Configure table data hook
  const tableData = useTableData<InstitutePayment>({
    endpoint,
    defaultParams: {
      search: searchQuery,
      userId: effectiveUserId,
      role: effectiveRole
    },
    cacheOptions: {
      userId: effectiveUserId,
      role: effectiveRole,
      instituteId: selectedInstitute?.id
    },
    dependencies: [selectedInstitute?.id, endpoint, searchQuery, effectiveUserId, effectiveRole],
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
    autoLoad: true // Enable auto-loading from cache
  });

  // Search handler with live filtering
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    // Don't update filters in the API call, just filter locally for live search
  };

  // Force refresh data from API
  const handleForceRefresh = () => {
    console.log('Force refreshing payments data...');
    tableData.actions.refresh();
  };
  const handleSubmitPayment = (payment: InstitutePayment) => {
    const subs = payment.mySubmissions || [];
    const latestSub = subs[0];
    if (latestSub?.status === 'PENDING') {
      toast({
        title: "Under Review",
        description: "Your submission is currently being reviewed. Please wait for a response.",
        variant: "destructive",
      });
      return;
    }
    if (latestSub?.status === 'VERIFIED') {
      toast({
        title: "Payment Verified",
        description: "This payment has already been verified.",
        variant: "destructive",
      });
      return;
    }
    setSelectedPayment(payment);
    setSubmitDialogOpen(true);
  };
  const handleViewSubmissions = (payment: InstitutePayment) => {
    try {
      navigate(`/payment-submissions/${payment.id}`);
    } catch (error: any) {
      console.error('Navigation error:', error);
      window.location.href = `/payment-submissions/${payment.id}`;
    }
  };

  const handleViewPhysicalPayments = (payment: InstitutePayment) => {
    try {
      navigate(`/payment-submissions-pysical/${payment.id}`);
    } catch (error: any) {
      console.error('Navigation error:', error);
      window.location.href = `/payment-submissions-pysical/${payment.id}`;
    }
  };

  const handleViewBankDetails = (payment: InstitutePayment) => {
    setSelectedPaymentForBankDetails(payment);
    setBankDetailsDialogOpen(true);
  };

  const openExtendDate = (payment: InstitutePayment) => {
    setExtendDatePayment(payment);
    setExtendDate(payment.dueDate ? payment.dueDate.slice(0, 10) : '');
  };

  const handleExtendDate = async () => {
    if (!selectedInstitute?.id || !extendDatePayment || !extendDate) return;
    setExtending(true);
    try {
      await institutePaymentsApi.updatePayment(selectedInstitute.id, extendDatePayment.id, {
        dueDate: extendDate,
      });
      toast({
        title: 'Due Date Updated',
        description: `${extendDatePayment.paymentType} due date has been updated successfully.`,
      });
      setExtendDatePayment(null);
      setExtendDate('');
      tableData.actions.refresh();
    } catch (error: any) {
      toast({
        title: 'Unable to Update Due Date',
        description: error.message || 'Failed to update the due date.',
        variant: 'destructive',
      });
    } finally {
      setExtending(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!deleteConfirmPayment || !selectedInstitute?.id) return;
    setDeleting(true);
    try {
      await institutePaymentsApi.deletePayment(selectedInstitute.id, deleteConfirmPayment.id);
      toast({
        title: "Payment Deleted",
        description: `"${deleteConfirmPayment.paymentType}" has been deleted successfully.`,
      });
      setDeleteConfirmPayment(null);
      tableData.actions.refresh();
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
  
  // Filter data locally for live search
  const filteredData = useMemo(() => {
    if (!Array.isArray(tableData.state.data)) return [];
    return tableData.state.data
      .filter(payment => {
        if (!searchQuery.trim()) return true;
        const searchLower = searchQuery.toLowerCase();
        const matchesPaymentType = (payment.paymentType || '').toLowerCase().includes(searchLower);
        const matchesAmount = payment.amount?.toString().includes(searchQuery.trim());
        const matchesPriority = (payment.priority || '').toLowerCase().includes(searchLower);
        return matchesPaymentType || matchesAmount || matchesPriority;
      });
  }, [tableData.state.data, searchQuery]);

  // Table columns configuration
  const columns = useMemo(() => [{
    id: 'paymentType',
    label: 'Payment Type',
    minWidth: 180,
    format: (value: string) => <div className="font-medium text-foreground">{value}</div>
  }, {
    id: 'description',
    label: 'Description',
    minWidth: 200,
    format: (value: string) => <div className="text-sm text-muted-foreground line-clamp-2">{value}</div>
  }, {
    id: 'amount',
    label: 'Amount',
    minWidth: 120,
    align: 'right' as const,
    format: (value: number) => {
      console.log('Amount column format - value:', value, 'type:', typeof value);
      const numericValue = Number(value) || 0;
      return <div className="font-semibold text-lg text-primary">Rs {numericValue.toLocaleString()}</div>;
    }
  }, {
    id: 'dueDate',
    label: 'Due Date',
    minWidth: 120,
    format: (value: string) => {
      const date = new Date(value);
      const isOverdue = date < new Date() && date.toDateString() !== new Date().toDateString();
      return <div className={`text-sm ${isOverdue ? 'text-destructive font-medium' : 'text-foreground'}`}>
            {date.toLocaleDateString()}
            {isOverdue && <div className="text-xs text-destructive">Overdue</div>}
          </div>;
    }
  }, {
    id: 'status',
    label: 'Status',
    minWidth: 100,
    format: (value: string) => <Badge variant={value === 'ACTIVE' ? 'default' : 'secondary'} className={value === 'ACTIVE' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-700'}>
          {value}
        </Badge>
  }, 
  // Submission status column for students
  ...(isStudent ? [{
    id: 'mySubmissionStatus',
    label: 'My Submission',
    minWidth: 120,
    align: 'center' as const,
    format: (value: string | null | undefined, row: InstitutePayment) => {
      const hasSubmitted = row.hasSubmitted || value;
      if (!hasSubmitted) {
        return <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400">Not Submitted</Badge>;
      }
      switch (value) {
        case 'VERIFIED':
          return <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400">Verified</Badge>;
        case 'PENDING':
          return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400">Pending</Badge>;
        case 'HALF_VERIFIED':
          return <Badge className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400">Half Paid</Badge>;
        case 'QUARTER_VERIFIED':
          return <Badge className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400">Quarter Paid</Badge>;
        case 'REJECTED': {
          const rejectionReason = (row as InstitutePayment).mySubmissions?.[0]?.rejectionReason;
          const subCount = (row as InstitutePayment).mySubmissions?.length ?? 0;
          return (
            <div className="space-y-1">
              <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400">Rejected</Badge>
              {subCount > 1 && <p className="text-[11px] text-muted-foreground">{subCount} submissions total</p>}
              {rejectionReason && <p className="text-xs text-red-600 leading-tight max-w-[160px]">{rejectionReason}</p>}
            </div>
          );
        }
        default:
          return <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400">Submitted</Badge>;
      }
    }
  }] : []),
  ], [isStudent]);
  const renderComponent = () => {
    // Debug logging for table data
    console.log('InstitutePayments Debug - Table data:', {
      loading: tableData.state.loading,
      error: tableData.state.error,
      dataLength: Array.isArray(tableData.state.data) ? tableData.state.data.length : 0,
      firstItem: Array.isArray(tableData.state.data) && tableData.state.data[0],
      amountValues: Array.isArray(tableData.state.data) ? tableData.state.data.map(item => ({
        id: item.id,
        paymentType: item.paymentType,
        amount: item.amount,
        typeof_amount: typeof item.amount
      })) : []
    });
    return <PageContainer className="h-full">
        {/* Header Section */}
        <div className="flex flex-col space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" onClick={() => {
                try {
                  navigate(-1);
                } catch (error: any) {
                  console.error('Navigation error:', error);
                  window.history.back();
                }
              }} className="shrink-0" size="sm">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                  Institute Payments
                </h1>
                {selectedInstitute && <p className="text-muted-foreground text-xs sm:text-sm mt-1">
                    Institute: <span className="font-medium text-foreground">{selectedInstitute.name}</span>
                  </p>}
              </div>
            </div>
            {isInstituteAdmin && <Button onClick={() => setCreateDialogOpen(true)} className="shrink-0" size="sm">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Create Payment</span>
                <span className="sm:hidden">Create</span>
              </Button>}
          </div>
        </div>

        {/* Institute Info Card */}
        {selectedInstitute && <Card className="border-border">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <CreditCard className="h-5 w-5 text-primary" />
                {selectedInstitute.name}
              </CardTitle>
              {selectedInstitute.description && <p className="text-muted-foreground text-sm">{selectedInstitute.description}</p>}
            </CardHeader>
          </Card>}

        {/* Search and Actions */}
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by payment type, amount, or priority..." className="pl-10 w-full text-sm sm:text-base" value={searchQuery} onChange={e => handleSearch(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button variant="outline" onClick={handleForceRefresh} disabled={tableData.state.loading} size="sm">
                  <RefreshCw className={`h-4 w-4 sm:mr-2 ${tableData.state.loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{tableData.state.loading ? 'Refreshing...' : 'Force Refresh'}</span>
                  <span className="sm:hidden">Refresh</span>
                </Button>
                
                {/* View Mode Toggle */}
                <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    title="Card View"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    title="Table View"
                  >
                    <Table2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {tableData.state.loading && <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </CardContent>
          </Card>}

        {/* Error State */}
        {tableData.state.error && <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="text-destructive text-lg mb-2">Failed to load payments</div>
                <p className="text-muted-foreground mb-4">{tableData.state.error}</p>
                <Button variant="outline" onClick={() => tableData.actions.refresh()} className="border-destructive/50 hover:bg-destructive/10">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>}

        {/* Load Data Section */}
        {!Array.isArray(tableData.state.data) || tableData.state.data.length === 0 ?
          <EmptyState
            icon={CreditCard}
            title="Institute Payments"
            description={!selectedInstitute?.id
              ? 'Please select an institute first.'
              : (!endpoint
                  ? "You don't have permission to view payments for this institute with your current role."
                  : 'Click the button below to load payments data')}
          >
            <Button
              onClick={() => tableData.actions.refresh()}
              disabled={tableData.state.loading || !selectedInstitute?.id || !endpoint}
            >
              {tableData.state.loading ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Loading Data...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" />Load Data</>
              )}
            </Button>
          </EmptyState> : <>
            {/* Payments Table */}
            {!tableData.state.loading && !tableData.state.error && <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Records
                </CardTitle>
                <Badge variant="outline" className="text-sm">
                  {tableData.pagination.totalCount} total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="w-full overflow-auto">
                <div className="min-w-full">
                  {viewMode === 'card' ? (
                    <div className="p-4 grid grid-cols-1 gap-4">
                      {(showAllPaymentCards ? filteredData : filteredData.slice(0, CARD_INITIAL_SHOW)).map(payment => {
                        const dueDate = payment.dueDate ? new Date(payment.dueDate) : null;
                        const isOverdue = dueDate ? dueDate < new Date() && dueDate.toDateString() !== new Date().toDateString() : false;
                        const statusActive = (payment.status || 'ACTIVE') === 'ACTIVE';
                        const total = payment.totalSubmissions ?? 0;
                        const verified = payment.verifiedSubmissions ?? 0;
                        const progressPct = total > 0 ? Math.round((verified / total) * 100) : 0;
                        const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / 86400000) : null;
                        const dueDateLabel = daysLeft === null ? null
                          : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue`
                          : daysLeft === 0 ? 'Due today'
                          : daysLeft === 1 ? 'Due tomorrow'
                          : `${daysLeft}d left`;
                        const priorityColor = payment.priority === 'MANDATORY'
                          ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400'
                          : payment.priority === 'OPTIONAL'
                          ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400';

                        return (
                          <Card key={payment.id} className={`hover:shadow-md transition-all duration-200 overflow-hidden ${
                            isOverdue ? 'border-destructive/50' : 'border-border'
                          }`}>
                            {/* Accent bar */}
                            <div className={`h-1 w-full ${
                              isOverdue ? 'bg-destructive' : statusActive ? 'bg-primary' : 'bg-muted-foreground/30'
                            }`} />
                            {/* Header */}
                            <div className="p-4 pb-3">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">{payment.paymentType}</p>
                                  <p className="text-2xl font-extrabold text-foreground leading-tight mt-0.5">Rs {Number(payment.amount || 0).toLocaleString()}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <Badge className={`text-[10px] px-1.5 py-0 ${statusActive ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400' : 'bg-muted text-muted-foreground'}`} variant="outline">
                                    {payment.status || 'ACTIVE'}
                                  </Badge>
                                  {payment.priority && (
                                    <Badge className={`text-[10px] px-1.5 py-0 ${priorityColor}`} variant="outline">
                                      {payment.priority}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {dueDate && (
                                <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  isOverdue
                                    ? 'bg-destructive/10 text-destructive'
                                    : daysLeft !== null && daysLeft <= 3
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  {isOverdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                                  {dueDate.toLocaleDateString()} · {dueDateLabel}
                                </div>
                              )}
                            </div>
                            {/* Always-visible body */}
                            <div className="px-3 pb-3 border-t pt-2 space-y-2">
                              {payment.description && (
                                <p className="text-xs text-muted-foreground leading-relaxed">{payment.description}</p>
                              )}
                              {/* Bank details & instructions for students — only for non-CYCLE payments */}
                              {(isStudent || isViewingAsParent) && !payment.hasSubmitted && payment.bankDetails && payment.paymentType?.toUpperCase() !== 'CYCLE' && (
                                <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 text-xs space-y-0.5">
                                  {payment.bankDetails.bankName && <p><span className="text-muted-foreground">Bank:</span> <span className="font-medium text-foreground">{payment.bankDetails.bankName}</span></p>}
                                  {payment.bankDetails.accountNumber && <p><span className="text-muted-foreground">A/C:</span> <span className="font-mono font-medium text-foreground">{payment.bankDetails.accountNumber}</span></p>}
                                  {payment.bankDetails.accountHolderName && <p><span className="text-muted-foreground">Name:</span> <span className="font-medium text-foreground">{payment.bankDetails.accountHolderName}</span></p>}
                                  {payment.bankDetails.branch && <p><span className="text-muted-foreground">Branch:</span> <span className="font-medium text-foreground">{payment.bankDetails.branch}</span></p>}
                                </div>
                              )}
                              {(isStudent || isViewingAsParent) && !payment.hasSubmitted && payment.paymentInstructions && (
                                <p className="text-xs text-blue-700 dark:text-blue-400 italic">{payment.paymentInstructions}</p>
                              )}
                              {(isInstituteAdmin || isTeacher) && (
                                <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2 space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Submissions</span>
                                    <span className="font-semibold">{verified}/{total} verified</span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${total > 0 ? progressPct : 0}%` }} />
                                  </div>
                                  {total > 0 && (
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                      <span>{payment.pendingSubmissions ?? 0} pending</span>
                                      <span className="flex items-center gap-0.5"><TrendingUp className="h-2.5 w-2.5" />{progressPct}%</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {(isStudent || isViewingAsParent) && (payment.mySubmissions?.length ?? 0) > 0 && (
                                <div className="space-y-1.5 mt-1">
                                  {payment.mySubmissions!.map((sub, idx) => (
                                    <div key={sub.id || idx} className={`flex items-start gap-2 p-2 rounded-lg text-xs border ${
                                      sub.status === 'VERIFIED' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300' :
                                      sub.status === 'PENDING' ? 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300' :
                                      'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                                    }`}>
                                      <div className="shrink-0 mt-0.5">
                                        {sub.status === 'VERIFIED' ? <CheckCircle className="h-3.5 w-3.5" /> :
                                         sub.status === 'PENDING' ? <Clock className="h-3.5 w-3.5" /> :
                                         <XCircle className="h-3.5 w-3.5" />}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-semibold">{sub.status}</span>
                                          {sub.paymentAmount > 0 && (
                                            <span className="opacity-80">Rs {sub.paymentAmount.toLocaleString()}</span>
                                          )}
                                          {idx === 0 && payment.mySubmissions!.length > 1 && (
                                            <span className="text-[10px] opacity-60">(latest)</span>
                                          )}
                                          <span className="ml-auto text-[10px] opacity-60 shrink-0">
                                            {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : ''}
                                          </span>
                                        </div>
                                        {sub.status === 'REJECTED' && sub.rejectionReason && (
                                          <p className="mt-0.5 opacity-90 break-words">{sub.rejectionReason}</p>
                                        )}
                                        {sub.status === 'PENDING' && sub.daysSinceSubmission != null && (
                                          <p className="mt-0.5 opacity-70">{sub.daysSinceSubmission}d awaiting review</p>
                                        )}
                                        {sub.status === 'VERIFIED' && sub.verifiedAt && (
                                          <p className="mt-0.5 opacity-70">Verified {new Date(sub.verifiedAt).toLocaleDateString()}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex gap-1.5 pt-1">
                                {(isStudent || isViewingAsParent) && payment.paymentType?.toUpperCase() !== 'CYCLE' && (() => {
                                  const subs = payment.mySubmissions || [];
                                  const latest = subs[0];
                                  if (!latest) {
                                    return (
                                      <Button key="submit" size="sm" className="flex-1 h-7 text-xs px-2" onClick={() => handleSubmitPayment(payment)}>
                                        <CreditCard className="h-3 w-3 mr-1" />Submit
                                      </Button>
                                    );
                                  }
                                  if (latest.status === 'VERIFIED') {
                                    return (
                                      <div key="verified" className="flex-1 flex items-center justify-center gap-1 text-xs text-green-700 dark:text-green-400 font-medium h-7">
                                        <CheckCircle className="h-3 w-3" />Paid &amp; Verified
                                      </div>
                                    );
                                  }

                                  if (latest.status === 'PENDING') {
                                    return (
                                      <Button key="pending" size="sm" className="flex-1 h-7 text-xs px-2" disabled>
                                        <Clock className="h-3 w-3 mr-1" />Pending Review
                                      </Button>
                                    );
                                  }

                                  if (latest.status === 'HALF_VERIFIED' || latest.status === 'QUARTER_VERIFIED') {
                                    return (
                                      <Button
                                        key="partial-resubmit"
                                        size="sm"
                                        className={`flex-1 h-7 text-xs px-2 text-white ${latest.status === 'HALF_VERIFIED' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'}`}
                                        onClick={() => handleSubmitPayment(payment)}
                                      >
                                        <CircleDollarSign className="h-3 w-3 mr-1" />
                                        {latest.status === 'HALF_VERIFIED' ? 'Pay Remainder (Half)' : 'Pay Remainder (3/4)'}
                                      </Button>
                                    );
                                  }

                                  return (
                                    <Button key="resubmit" size="sm" className="flex-1 h-7 text-xs px-2 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => handleSubmitPayment(payment)}>
                                      <CreditCard className="h-3 w-3 mr-1" />Re-submit
                                    </Button>
                                  );
                                })()}
                                {payment.bankDetails && (
                                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs px-2 border-blue-500 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => handleViewBankDetails(payment)}>
                                    <Building2 className="h-3 w-3 mr-1" />Bank Details
                                  </Button>
                                )}
                                {(isInstituteAdmin || isTeacher) && (
                                  <>
                                    <Button variant="outline" size="sm" className="flex-1 h-7 text-xs px-2" onClick={() => handleViewSubmissions(payment)}>
                                      <Eye className="h-3 w-3 mr-1" />Online Payments
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1 h-7 text-xs px-2 border-green-500 text-green-700 hover:bg-green-50" onClick={() => handleViewPhysicalPayments(payment)}>
                                      <Banknote className="h-3 w-3 mr-1" />Physical Payment
                                    </Button>
                                    {isInstituteAdmin && (
                                      <Button variant="outline" size="sm" className="h-7 text-xs px-2 border-blue-400 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950" title="Extend due date" onClick={() => openExtendDate(payment)}>
                                        <CalendarDays className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {isInstituteAdmin && payment.totalSubmissions === 0 && (
                                      <Button variant="outline" size="sm" className="h-7 text-xs px-2 border-destructive text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirmPayment(payment)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                      {filteredData.length > CARD_INITIAL_SHOW && (
                        <div className="col-span-full">
                          <Button variant="outline" className="w-full" onClick={() => setShowAllPaymentCards(v => !v)}>
                            {showAllPaymentCards ? 'Show less' : `Show all ${filteredData.length} payments`}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <MUITable title="" columns={columns} data={filteredData} page={tableData.pagination.page} rowsPerPage={tableData.pagination.limit} totalCount={filteredData.length} onPageChange={tableData.actions.setPage} onRowsPerPageChange={tableData.actions.setLimit} rowsPerPageOptions={tableData.availableLimits} customActions={[
                    // Student actions — only for non-CYCLE payment types
                    ...((isStudent || isViewingAsParent) ? [{
                      label: 'Submit Payment',
                      action: handleSubmitPayment,
                      icon: <CreditCard className="h-4 w-4" />,
                      variant: 'default' as const,
                      disabledCondition: (row: InstitutePayment) =>
                        row.paymentType?.toUpperCase() === 'CYCLE' ||
                        row.mySubmissionStatus === 'PENDING' ||
                        row.mySubmissionStatus === 'VERIFIED',
                      disabledLabel: 'N/A'
                    }] : []),
                    // Bank Details action — only for non-CYCLE payments
                    {
                      label: 'Bank Details',
                      action: handleViewBankDetails,
                      icon: <Building2 className="h-4 w-4" />,
                      variant: 'outline' as const,
                      disabledCondition: (row: InstitutePayment) => !row.bankDetails || row.paymentType?.toUpperCase() === 'CYCLE',
                      disabledLabel: 'N/A'
                    },
                    // InstituteAdmin/Teacher actions  
                    ...(isInstituteAdmin || isTeacher ? [
                      {
                        label: 'Online Payments',
                        action: handleViewSubmissions,
                        icon: <Eye className="h-4 w-4" />,
                        variant: 'default' as const
                      },
                      {
                        label: 'Physical Payment',
                        action: handleViewPhysicalPayments,
                        icon: <Banknote className="h-4 w-4" />,
                        variant: 'outline' as const
                      }
                    ] : []),
                    ...(isInstituteAdmin ? [
                      {
                        label: 'Extend Date',
                        action: (row: InstitutePayment) => openExtendDate(row),
                        icon: <CalendarDays className="h-4 w-4" />,
                        variant: 'outline' as const,
                      },
                      {
                        label: 'Delete',
                        action: (row: InstitutePayment) => setDeleteConfirmPayment(row),
                        icon: <Trash2 className="h-4 w-4" />,
                        variant: 'destructive' as const,
                        disabledCondition: (row: InstitutePayment) => (row.totalSubmissions ?? 0) > 0,
                        disabledLabel: 'Has Submissions'
                      }
                    ] : [])]} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>}

            {/* Summary Stats */}
        {(isStudent || isViewingAsParent) && (() => {
          const rejected = filteredData.filter(p => p.mySubmissionStatus === 'REJECTED').length;
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-foreground">{filteredData.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total Payments</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-orange-500">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-orange-600">{filteredData.filter(p => !p.mySubmissions?.length).length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Needs Submission</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-yellow-500">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-yellow-600">{filteredData.filter(p => p.mySubmissionStatus === 'PENDING').length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pending Review</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-green-600">{filteredData.filter(p => p.mySubmissionStatus === 'VERIFIED').length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Verified</p>
                </CardContent>
              </Card>
              {rejected > 0 && (
                <Card className="col-span-2 md:col-span-4 border-red-400/60 bg-red-50/50 dark:bg-red-950/20">
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
        {!(isStudent || isViewingAsParent) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Active Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                Rs {filteredData.filter(p => p.status === 'ACTIVE').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Submissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {filteredData.reduce((sum, p) => sum + (p.totalSubmissions || 0), 0)}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Loaded Records
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {filteredData.length}
              </p>
            </CardContent>
          </Card>
            </div>
        )}
          </>}

        {/* Dialogs */}
        {selectedInstitute && <>
            <CreatePaymentDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} instituteId={selectedInstitute.id} onSuccess={() => {
            tableData.actions.refresh();
            toast({
              title: "Success",
              description: "Payment created successfully"
            });
          }} />
            <SubmitPaymentDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen} payment={selectedPayment} instituteId={selectedInstitute.id} onSuccess={() => {
            tableData.actions.refresh();
            toast({
              title: "Success",
              description: "Payment submitted successfully"
            });
          }} />
            <BankDetailsDialog open={bankDetailsDialogOpen} onOpenChange={setBankDetailsDialogOpen} payment={selectedPaymentForBankDetails} />
          </>}

        {/* Extend Due Date Dialog */}
        <Dialog open={!!extendDatePayment} onOpenChange={open => { if (!open) setExtendDatePayment(null); }} routeName="extend-payment-deadline-popup">
          <DialogContent className="w-[calc(100vw-2rem)] max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-600" />Extend Due Date
              </DialogTitle>
            </DialogHeader>
            {extendDatePayment && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm space-y-1">
                  <p className="font-semibold">{extendDatePayment.paymentType}</p>
                  <p className="text-xs text-muted-foreground">
                    Current due date:{' '}
                    <span className="font-medium text-foreground">
                      {extendDatePayment.dueDate ? new Date(extendDatePayment.dueDate).toLocaleDateString() : '—'}
                    </span>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">New Due Date</Label>
                  <input
                    type="date"
                    value={extendDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={e => setExtendDate(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setExtendDatePayment(null)} disabled={extending}>
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleExtendDate}
                disabled={extending || !extendDate}
              >
                {extending ? <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : <><CalendarDays className="h-4 w-4 mr-1.5" />Save New Date</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmPayment} onOpenChange={(open) => { if (!open) setDeleteConfirmPayment(null); }} routeName="delete-institute-payment-confirmation-popup">
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Payment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the payment <strong>"{deleteConfirmPayment?.paymentType}"</strong> (Rs {Number(deleteConfirmPayment?.amount || 0).toLocaleString()})?
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
      </PageContainer>;
  };
  return renderComponent();
};
export default InstitutePayments;