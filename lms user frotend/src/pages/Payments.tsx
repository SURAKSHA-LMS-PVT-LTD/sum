import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { useResizableColumns, ResizeHandle } from '@/hooks/useResizableColumns';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Clock,
  RefreshCw,
  Plus,
  Eye,
  ArrowLeft,
  LayoutGrid,
  Table2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useViewMode } from '@/hooks/useViewMode';
import PaymentSlipPreviewDialog from '@/components/PaymentSlipPreviewDialog';

const PAY_COL_DEFS: ColumnDef[] = [
  { key: 'amount', header: 'Amount', locked: true, defaultWidth: 120, minWidth: 90 },
  { key: 'reference', header: 'Reference', defaultWidth: 160, minWidth: 120 },
  { key: 'method', header: 'Method', defaultWidth: 130, minWidth: 90 },
  { key: 'paymentDate', header: 'Payment Date', defaultWidth: 160, minWidth: 120 },
  { key: 'month', header: 'Month', defaultWidth: 100, minWidth: 80 },
  { key: 'status', header: 'Status', defaultWidth: 130, minWidth: 90 },
  { key: 'notes', header: 'Notes', defaultVisible: false, defaultWidth: 200, minWidth: 120 },
  { key: 'rejectionReason', header: 'Rejection Reason', defaultVisible: false, defaultWidth: 200, minWidth: 120 },
  { key: 'slip', header: 'Slip', defaultWidth: 120, minWidth: 80 },
];

interface PaymentRecord {
  id: string;
  userId: string;
  paymentAmount: string;
  paymentMethod: string;
  paymentReference: string;
  paymentSlipUrl: string | null;
  paymentSlipFilename: string | null;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  paymentDate: string;
  paymentMonth: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface PaymentApiResponse {
  payments: PaymentRecord[];
  total: number;
  page: number;
  limit: number;
}

const Payments = () => {
  const { user } = useAuth();
  const userRole = useInstituteRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { viewMode, setViewMode } = useViewMode();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'VERIFIED' | 'REJECTED'>('PENDING');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const payColIds = useMemo(() => PAY_COL_DEFS.map(c => c.key), []);
  const payColDefaultWidths = useMemo(() => Object.fromEntries(PAY_COL_DEFS.map(c => [c.key, c.defaultWidth ?? 150])), []);
  const { getWidth: getPayColWidth, setHoveredCol: setPayHoveredCol, hoveredCol: PayHoveredCol, activeCol: PayActiveCol, startResize: PayStartResize } = useResizableColumns(payColIds, payColDefaultWidths);
  const { colState: payColState, visibleColumns: payVisDefs, toggleColumn: togglePayCol, resetColumns: resetPayCols } = useColumnConfig(PAY_COL_DEFS, 'payments');
  const payVisKeys = useMemo(() => new Set(payVisDefs.map(c => c.key)), [payVisDefs]);

  // Load all payment history from API
  const loadPaymentHistory = async (showToast = true, forceRefresh = false) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "No user ID available",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '100'
      });
      
      const data: PaymentApiResponse = await enhancedCachedClient.get(
        `/payment/my-payments?${params}`,
        {},
        {
          ttl: CACHE_TTL.PAYMENTS,
          forceRefresh,
          userId: user?.id,
          role: userRole
        }
      );
      
      console.log('Payment API Response:', data);
      
      setAllPayments(data.payments);
      filterPaymentsByStatus(data.payments, activeTab);
      
    } catch (error: any) {
      console.error('Error loading payment history:', error);
      if (showToast) {
        toast({
          title: "Error",
          description: "Failed to load payment history",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load payment history on mount (uses cache if available)
  useEffect(() => {
    if (user?.id) {
      loadPaymentHistory(false, false); // Load from cache, no toast
    }
  }, [user?.id]);

  // Filter payments by status on frontend
  const filterPaymentsByStatus = (currentPayments: PaymentRecord[], status: 'PENDING' | 'VERIFIED' | 'REJECTED') => {
    const filteredPayments = currentPayments.filter(payment => payment.status === status);
    setPayments(filteredPayments);
  };

  // Handle tab change
  const handleTabChange = (tab: 'PENDING' | 'VERIFIED' | 'REJECTED') => {
    setActiveTab(tab);
    setPage(0);
    filterPaymentsByStatus(allPayments, tab);
  };

  // Handle pagination changes
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  const getStatusBadge = (status: PaymentRecord['status']) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: string) => {
    return `Rs ${parseFloat(amount).toLocaleString()}`;
  };

  const [slipPreview, setSlipPreview] = useState<{ url: string; ref: string } | null>(null);

  const handleViewSlip = (payment: PaymentRecord) => {
    if (payment.paymentSlipUrl) {
      setSlipPreview({ url: payment.paymentSlipUrl, ref: payment.paymentReference });
    }
  };

  const handleNewPayment = () => {
    navigate('/system-payments/create');
  };


  return (
    <AppLayout currentPage="system-payment">
      <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 px-2"
              onClick={() => navigate('/payments')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <CreditCard className="h-7 w-7 sm:h-8 sm:w-8" />
              Payment History
            </h1>
            <p className="text-muted-foreground">
              View your payment transactions and download invoices
            </p>
          </div>
        </div>

        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatAmount(
                  allPayments.filter(p => p.status === 'VERIFIED').reduce((sum, p) => sum + parseFloat(p.paymentAmount), 0).toString()
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Verified Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {allPayments.filter(p => p.status === 'VERIFIED').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {allPayments.filter(p => p.status === 'PENDING').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Rejected Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {allPayments.filter(p => p.status === 'REJECTED').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center flex-wrap gap-3">
          <Button
            onClick={handleNewPayment}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Payment
          </Button>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => loadPaymentHistory(true, true)} // Force refresh from backend with toast
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <ColumnConfigurator allColumns={PAY_COL_DEFS} colState={payColState} onToggle={togglePayCol} onReset={resetPayCols} />
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

        {/* Payment Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="PENDING" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Pending</span>
              <span className="sm:hidden">P</span>
              <span className="ml-1">({allPayments.filter(p => p.status === 'PENDING').length})</span>
            </TabsTrigger>
            <TabsTrigger value="VERIFIED" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Verified</span>
              <span className="sm:hidden">V</span>
              <span className="ml-1">({allPayments.filter(p => p.status === 'VERIFIED').length})</span>
            </TabsTrigger>
            <TabsTrigger value="REJECTED" className="text-xs sm:text-sm">
              <span className="hidden sm:inline">Rejected</span>
              <span className="sm:hidden">R</span>
              <span className="ml-1">({allPayments.filter(p => p.status === 'REJECTED').length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {viewMode === 'card' ? (
              <div className="w-full">
                <div className="w-full space-y-1">
                  {payments
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((payment) => {
                      const statusColor = payment.status === 'VERIFIED' 
                        ? 'bg-green-500' 
                        : payment.status === 'PENDING' 
                        ? 'bg-yellow-500' 
                        : payment.status === 'REJECTED' 
                        ? 'bg-red-500' 
                        : 'bg-blue-500';
                      
                      return (
                        <Card key={payment.id} className="hover:shadow-md transition-all border-border overflow-hidden">
                          <div className={`h-1 w-full ${statusColor}`} />
                          <div className="p-3 flex items-center justify-between gap-2">
                            {/* Left: Amount */}
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-foreground">{formatAmount(payment.paymentAmount)}</p>
                              <p className="text-xs text-muted-foreground">Payment</p>
                            </div>
                            
                            {/* Middle: Info with dots */}
                            <div className="flex-1 min-w-0 text-xs text-muted-foreground flex items-center gap-1 px-2 truncate">
                              <span className="truncate">{payment.paymentReference}</span>
                              <span>•</span>
                              <span className="hidden sm:inline">{payment.paymentMethod?.replace('_', ' ') || '-'}</span>
                              <span className="hidden sm:inline">•</span>
                              <span>{payment.paymentMonth}</span>
                            </div>
                            
                            {/* Right: Status & Actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {getStatusBadge(payment.status)}
                              {payment.paymentSlipUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleViewSlip(payment)}
                                  title="View Slip"
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1" />
                                  View
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                </div>
                
                {/* Pagination */}
                <div className="mt-4 flex justify-between items-center px-1">
                  <p className="text-xs text-muted-foreground">
                    {Math.min(page * rowsPerPage + 1, payments.length)} - {Math.min((page + 1) * rowsPerPage, payments.length)} of {payments.length}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 0}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setPage(page + 1)}
                      disabled={(page + 1) * rowsPerPage >= payments.length}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <Paper sx={{ width: '100%', height: 'calc(100vh - 320px)', display: 'flex', flexDirection: 'column' }}>
                <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                  <Table stickyHeader aria-label="payment submissions table" sx={{ tableLayout: 'fixed', minWidth: payVisDefs.reduce((s, c) => s + getPayColWidth(c.key), 0) }}>
                    <TableHead>
                      <TableRow>
                        {payVisDefs.map(col => (
                          <TableCell
                            key={col.key}
                            sx={{ position: 'relative', width: getPayColWidth(col.key), maxWidth: getPayColWidth(col.key), overflow: 'hidden', whiteSpace: 'nowrap' }}
                            onMouseEnter={() => setPayHoveredCol(col.key)}
                            onMouseLeave={() => setPayHoveredCol(null)}
                          >
                            <div style={{ paddingRight: 12 }}>{col.header}</div>
                            <ResizeHandle colId={col.key} hoveredCol={PayHoveredCol} activeCol={PayActiveCol} onMouseDown={PayStartResize} />
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {payments
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((payment) => (
                          <TableRow hover role="checkbox" tabIndex={-1} key={payment.id}>
                            {payVisKeys.has('amount') && <TableCell style={{ width: getPayColWidth('amount'), maxWidth: getPayColWidth('amount'), overflow: 'hidden' }}>{formatAmount(payment.paymentAmount)}</TableCell>}
                            {payVisKeys.has('reference') && <TableCell style={{ width: getPayColWidth('reference'), maxWidth: getPayColWidth('reference'), overflow: 'hidden' }}><span className="font-mono text-xs">{payment.paymentReference}</span></TableCell>}
                            {payVisKeys.has('method') && <TableCell style={{ width: getPayColWidth('method'), maxWidth: getPayColWidth('method'), overflow: 'hidden' }}>{payment.paymentMethod?.replace('_', ' ') || '-'}</TableCell>}
                            {payVisKeys.has('paymentDate') && <TableCell style={{ width: getPayColWidth('paymentDate'), maxWidth: getPayColWidth('paymentDate'), overflow: 'hidden' }}>{formatDate(payment.paymentDate)}</TableCell>}
                            {payVisKeys.has('month') && <TableCell style={{ width: getPayColWidth('month'), maxWidth: getPayColWidth('month'), overflow: 'hidden' }}>{payment.paymentMonth}</TableCell>}
                            {payVisKeys.has('status') && <TableCell style={{ width: getPayColWidth('status'), maxWidth: getPayColWidth('status'), overflow: 'hidden' }}>{getStatusBadge(payment.status)}</TableCell>}
                            {payVisKeys.has('notes') && <TableCell style={{ width: getPayColWidth('notes'), maxWidth: getPayColWidth('notes'), overflow: 'hidden' }}><span className="text-sm text-gray-600 truncate block" title={payment.notes}>{payment.notes || '-'}</span></TableCell>}
                            {payVisKeys.has('rejectionReason') && <TableCell style={{ width: getPayColWidth('rejectionReason'), maxWidth: getPayColWidth('rejectionReason'), overflow: 'hidden' }}><span className="text-sm text-red-600 truncate block" title={payment.rejectionReason || ''}>{payment.rejectionReason || '-'}</span></TableCell>}
                            {payVisKeys.has('slip') && <TableCell style={{ width: getPayColWidth('slip'), maxWidth: getPayColWidth('slip'), overflow: 'hidden' }}>{payment.paymentSlipUrl && (<Button variant="outline" size="sm" onClick={() => handleViewSlip(payment)}><Eye className="h-4 w-4 mr-1" />View</Button>)}</TableCell>}
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  component="div"
                  count={payments.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </Paper>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <PaymentSlipPreviewDialog
        open={!!slipPreview}
        onOpenChange={(open) => { if (!open) setSlipPreview(null); }}
        url={slipPreview?.url || ''}
        title={`Payment Slip — ${slipPreview?.ref || ''}`}
      />
    </AppLayout>
  );
};

export default Payments;