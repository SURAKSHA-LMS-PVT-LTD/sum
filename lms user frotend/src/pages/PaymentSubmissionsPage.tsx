import React, { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Eye, CheckCircle, Clock, XCircle, User, Calendar, FileText, DollarSign, Shield, RefreshCw, School, Search, BookOpen, ChevronDown } from 'lucide-react';
import { useViewMode } from '@/hooks/useViewMode';
import { useToast } from '@/hooks/use-toast';
import { subjectPaymentsApi, SubjectPaymentSubmission } from '@/api/subjectPayments.api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import VerifySubjectPaymentDialog from '@/components/forms/VerifySubjectPaymentDialog';
import { getImageUrl } from '@/utils/imageUrlHelper';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';

const PPS_COL_DEFS: ColumnDef[] = [
  { key: 'username', header: 'Student Name', locked: true, defaultWidth: 160, minWidth: 120 },
  { key: 'submittedAmount', header: 'Amount', defaultWidth: 110, minWidth: 80 },
  { key: 'transactionId', header: 'Transaction ID', defaultWidth: 160, minWidth: 120 },
  { key: 'paymentDate', header: 'Payment Date', defaultWidth: 130, minWidth: 100 },
  { key: 'status', header: 'Status', defaultWidth: 110, minWidth: 80 },
  { key: 'uploadedAt', header: 'Submitted At', defaultWidth: 130, minWidth: 100 },
  { key: 'receipt', header: 'Receipt', defaultWidth: 100, minWidth: 80 },
  { key: 'actions', header: 'Actions', locked: true, defaultWidth: 150, minWidth: 110 },
];

const PaymentSubmissionsPage = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    user,
    selectedInstitute,
    selectedClass,
    selectedSubject
  } = useAuth();
  const role = useInstituteRole();
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const paymentTitle = searchParams.get('paymentTitle');
  const [submissions, setSubmissions] = useState<SubjectPaymentSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [verifyingSubmission, setVerifyingSubmission] = useState<SubjectPaymentSubmission | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const { viewMode, setViewMode } = useViewMode();
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);

  // Check if user can verify submissions (InstituteAdmin or Teacher only)
  const canVerifySubmissions = role === 'InstituteAdmin' || role === 'Teacher';
  const loadSubmissions = async (newPage?: number, newRowsPerPage?: number) => {
    if (loading || !paymentId) return;
    const currentPage = newPage !== undefined ? newPage + 1 : page + 1; // API uses 1-based indexing
    const currentLimit = newRowsPerPage || rowsPerPage;
    setLoading(true);
    try {
      const response = await subjectPaymentsApi.getPaymentSubmissions(paymentId, currentPage, currentLimit);
      setSubmissions(response.data);
      setTotalCount(response.total);
      setLoaded(true);
      toast({
        title: "Success",
        description: "Payment submissions loaded successfully."
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load payment submissions.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleVerifySubmission = async (status: 'VERIFIED' | 'REJECTED', rejectionReason?: string, notes?: string) => {
    if (!verifyingSubmission) return;
    try {
      await subjectPaymentsApi.verifyPaymentSubmission(verifyingSubmission.id, {
        status,
        rejectionReason,
        notes
      });
      toast({
        title: "Success",
        description: `Payment submission ${status.toLowerCase()} successfully.`
      });

      // Reload submissions
      setLoaded(false);
      await loadSubmissions(page, rowsPerPage);
      setVerifyingSubmission(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to verify payment submission.",
        variant: "destructive"
      });
    }
  };
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    loadSubmissions(newPage, rowsPerPage);
  };
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = +event.target.value;
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    loadSubmissions(0, newRowsPerPage);
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  // Filter submissions based on search term
  const filteredSubmissions = submissions.filter(submission => submission.username?.toLowerCase().includes(searchTerm.toLowerCase()) || submission.submittedAmount?.toString().includes(searchTerm) || submission.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
  const handleRefresh = () => {
    setLoaded(false);
    setSearchTerm('');
    loadSubmissions(0, rowsPerPage);
  };
  const ppsColIds = useMemo(() => PPS_COL_DEFS.map(c => c.key), []);
  const ppsColDefaultWidths = useMemo(() => Object.fromEntries(PPS_COL_DEFS.map(c => [c.key, c.defaultWidth!])), []);
  const { getWidth: getPPSColWidth, setHoveredCol: setPPSHoveredCol, ResizeHandle: PPSResizeHandle } = useResizableColumns(ppsColIds, ppsColDefaultWidths);
  const { colState: ppsColState, visibleColumns: ppsVisDefs, toggleColumn: togglePPSCol, resetColumns: resetPPSCols } = useColumnConfig(PPS_COL_DEFS, 'payment-submissions-page');
  const ppsVisKeys = useMemo(() => new Set(ppsVisDefs.map(c => c.key)), [ppsVisDefs]);
  return <AppLayout>
      <div className="space-y-3 sm:space-y-4 px-2 sm:px-4 py-3 sm:py-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4" size="sm">
            <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="text-xs sm:text-sm">Back</span>
          </Button>
        </div>

        {/* Subject Info */}
        {selectedSubject && <Card className="border-border">
            <CardHeader className="p-3 sm:p-4">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base text-foreground">
                <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <span className="truncate">{selectedSubject.name}</span>
              </CardTitle>
              <p className="text-muted-foreground text-xs sm:text-sm truncate">
                {selectedClass?.name} • {selectedInstitute?.name}
              </p>
            </CardHeader>
          </Card>}


        {/* Payment Submissions Section */}
        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <div className="flex flex-col gap-2 sm:gap-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <span className="truncate">Payment Submissions</span>
                  </CardTitle>
                  {paymentId && <p className="text-xs sm:text-sm text-muted-foreground truncate mt-1">
                      Payment ID: {paymentId}
                    </p>}
                </div>
                <Button onClick={handleRefresh} disabled={loading} variant="outline" size="sm" className="flex items-center justify-center gap-2 shrink-0 text-xs sm:text-sm px-3 py-2">
                  <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </Button>
                <ColumnConfigurator allColumns={PPS_COL_DEFS} colState={ppsColState} onToggle={togglePPSCol} onReset={resetPPSCols} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6">
            <div className="space-y-3 sm:space-y-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3 sm:h-4 sm:w-4" />
                <Input placeholder="Search student, amount, or transaction..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 sm:pl-10 text-xs sm:text-sm h-9 sm:h-10" />
              </div>

              {/* Submissions Count */}
              

              {/* Load Button or Table */}
              {!loaded ? <div className="text-center py-6 sm:py-8">
                  <Button onClick={() => loadSubmissions()} disabled={loading} className="flex items-center justify-center gap-2 w-full sm:w-auto text-xs sm:text-sm px-4 py-2">
                    <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>{loading ? 'Loading...' : 'Load Submissions'}</span>
                  </Button>
                </div> : viewMode === 'card' ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSubmissions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(submission => {
                    const isExpanded = expandedSubmissionId === String(submission.id);
                    return <Card key={submission.id} className="hover:shadow-md transition-shadow">
                        <div className="p-4 flex items-start gap-3 cursor-pointer select-none" onClick={() => setExpandedSubmissionId(isExpanded ? null : String(submission.id))}>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{submission.username || 'Unknown User'}</p>
                            <p className="text-xs text-muted-foreground">Rs {parseFloat(submission.submittedAmount || '0').toLocaleString()}</p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(submission.status)}`}>{submission.status}</span>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                        {isExpanded && <div className="px-4 pb-4 border-t pt-3 space-y-2">
                            {submission.transactionId && <p className="text-xs text-muted-foreground"><span className="font-medium">Transaction:</span> {submission.transactionId}</p>}
                            <p className="text-xs text-muted-foreground"><span className="font-medium">Payment Date:</span> {new Date(submission.paymentDate).toLocaleDateString()}</p>
                            <p className="text-xs text-muted-foreground"><span className="font-medium">Submitted:</span> {new Date(submission.uploadedAt).toLocaleDateString()}</p>
                            <div className="flex gap-2 pt-2 border-t">
                              {submission.receiptUrl && <Button variant="outline" size="sm" className="flex-1 flex items-center gap-1 text-xs" onClick={() => window.open(getImageUrl(submission.receiptUrl), '_blank')}><Eye className="h-3 w-3" />View Receipt</Button>}
                              {canVerifySubmissions && submission.status === 'PENDING' && <Button size="sm" className="flex-1 flex items-center gap-1 text-xs" onClick={() => setVerifyingSubmission(submission)}><Shield className="h-3 w-3" />Verify</Button>}
                            </div>
                          </div>}
                      </Card>;
                  })}
                </div> : <Paper sx={{ width: '100%', height: 'calc(100vh - 320px)', display: 'flex', flexDirection: 'column' }}>
                  <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                    <Table stickyHeader aria-label="payment submissions table" sx={{ tableLayout: 'fixed', minWidth: ppsVisDefs.reduce((s, c) => s + getPPSColWidth(c.key), 0) }}>
                      <TableHead>
                        <TableRow>
                          {ppsVisDefs.map((col) => (
                            <TableCell key={col.key} sx={{ position: 'relative', width: getPPSColWidth(col.key), fontWeight: 600, bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
                              onMouseEnter={() => setPPSHoveredCol(col.key)} onMouseLeave={() => setPPSHoveredCol(null)}>
                              <div style={{ paddingRight: 12 }}>{col.header}</div>
                              <PPSResizeHandle colId={col.key} />
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredSubmissions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={ppsVisDefs.length} align="center" sx={{ py: 8 }}>
                              <div className="text-center px-4">
                                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500 dark:text-gray-400 text-base mb-2">
                                  {searchTerm ? 'No matching submissions found' : 'No submissions found'}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : filteredSubmissions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(submission => (
                          <TableRow hover role="checkbox" tabIndex={-1} key={submission.id}>
                            {ppsVisKeys.has('username') && <TableCell style={{ width: getPPSColWidth('username'), maxWidth: getPPSColWidth('username'), overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{submission.username || 'Unknown User'}</TableCell>}
                            {ppsVisKeys.has('submittedAmount') && <TableCell style={{ width: getPPSColWidth('submittedAmount'), maxWidth: getPPSColWidth('submittedAmount'), overflow: 'hidden' }}>Rs {parseFloat(submission.submittedAmount || '0').toLocaleString()}</TableCell>}
                            {ppsVisKeys.has('transactionId') && <TableCell style={{ width: getPPSColWidth('transactionId'), maxWidth: getPPSColWidth('transactionId'), overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{submission.transactionId}</TableCell>}
                            {ppsVisKeys.has('paymentDate') && <TableCell style={{ width: getPPSColWidth('paymentDate'), maxWidth: getPPSColWidth('paymentDate'), overflow: 'hidden' }}>{new Date(submission.paymentDate).toLocaleDateString()}</TableCell>}
                            {ppsVisKeys.has('status') && <TableCell style={{ width: getPPSColWidth('status'), maxWidth: getPPSColWidth('status'), overflow: 'hidden' }}><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(submission.status)}`}>{submission.status}</span></TableCell>}
                            {ppsVisKeys.has('uploadedAt') && <TableCell style={{ width: getPPSColWidth('uploadedAt'), maxWidth: getPPSColWidth('uploadedAt'), overflow: 'hidden' }}>{new Date(submission.uploadedAt).toLocaleDateString()}</TableCell>}
                            {ppsVisKeys.has('receipt') && <TableCell style={{ width: getPPSColWidth('receipt'), maxWidth: getPPSColWidth('receipt'), overflow: 'hidden' }}>{submission.receiptUrl ? <Button variant="outline" size="sm" onClick={() => window.open(getImageUrl(submission.receiptUrl), '_blank')} className="flex items-center gap-1 text-xs px-2 py-1"><Eye className="h-3 w-3" />View</Button> : <span className="text-muted-foreground text-xs">N/A</span>}</TableCell>}
                            {ppsVisKeys.has('actions') && <TableCell style={{ width: getPPSColWidth('actions'), maxWidth: getPPSColWidth('actions'), overflow: 'hidden' }}><div className="flex items-center gap-1">{canVerifySubmissions && submission.status === 'PENDING' && <Button onClick={() => setVerifyingSubmission(submission)} className="flex items-center gap-1 text-xs px-2 py-1" size="sm"><Shield className="h-3 w-3" />Verify</Button>}</div></TableCell>}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination rowsPerPageOptions={[25, 50, 100]} component="div" count={searchTerm ? filteredSubmissions.length : totalCount} rowsPerPage={rowsPerPage} page={page} onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage} />
                </Paper>}
            </div>
          </CardContent>
        </Card>
        
        {/* Verification Dialog */}
        <VerifySubjectPaymentDialog open={!!verifyingSubmission} onOpenChange={open => !open && setVerifyingSubmission(null)} submission={verifyingSubmission} onVerify={handleVerifySubmission} />
      </div>
    </AppLayout>;
};
export default PaymentSubmissionsPage;