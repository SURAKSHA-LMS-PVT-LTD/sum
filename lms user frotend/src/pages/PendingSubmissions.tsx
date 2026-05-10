import React, { useState, useEffect, useMemo } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, RefreshCw, Search, CheckCircle, Clock, XCircle, 
  Eye, CreditCard, AlertCircle 
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { institutePaymentsApi, PaymentSubmission, PendingSubmissionsResponse } from '@/api/institutePayments.api';
import { EmptyState } from '@/components/ui/EmptyState';
import VerifySubmissionDialog from '@/components/forms/VerifySubmissionDialog';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { Skeleton } from '@/components/ui/skeleton';
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

const PS_COL_DEFS: ColumnDef[] = [
  { key: 'student', header: 'Student', locked: true, defaultWidth: 200, minWidth: 150 },
  { key: 'amount', header: 'Amount', defaultWidth: 120, minWidth: 90 },
  { key: 'transactionRef', header: 'Transaction Ref', defaultWidth: 160, minWidth: 120 },
  { key: 'paymentDate', header: 'Payment Date', defaultWidth: 130, minWidth: 100 },
  { key: 'submitted', header: 'Submitted', defaultWidth: 130, minWidth: 100 },
  { key: 'receipt', header: 'Receipt', defaultWidth: 100, minWidth: 80 },
  { key: 'actions', header: 'Actions', locked: true, defaultWidth: 120, minWidth: 90 },
];

const PendingSubmissions = () => {
  const { selectedInstitute } = useAuth();
  const role = useInstituteRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [data, setData] = useState<PendingSubmissionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<PaymentSubmission | null>(null);

  const psColIds = useMemo(() => PS_COL_DEFS.map(c => c.key), []);
  const psColDefaultWidths = useMemo(() => Object.fromEntries(PS_COL_DEFS.map(c => [c.key, c.defaultWidth!])), []);
  const { getWidth: getPSColWidth, setHoveredCol: setPSHoveredCol, ResizeHandle: PSResizeHandle } = useResizableColumns(psColIds, psColDefaultWidths);
  const { colState: psColState, visibleColumns: psVisDefs, toggleColumn: togglePSCol, resetColumns: resetPSCols } = useColumnConfig(PS_COL_DEFS, 'pending-submissions');
  const psVisKeys = useMemo(() => new Set(psVisDefs.map(c => c.key)), [psVisDefs]);

  const canVerify = role === 'InstituteAdmin' || role === 'Teacher';

  const loadPendingSubmissions = async (forceRefresh = false) => {
    if (!selectedInstitute?.id) return;
    setLoading(true);
    try {
      const response = await institutePaymentsApi.getPendingSubmissions(selectedInstitute.id, {
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery || undefined,
      });
      setData(response);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load pending submissions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedInstitute?.id && canVerify) {
      loadPendingSubmissions();
    }
  }, [selectedInstitute?.id, page, rowsPerPage]);

  const submissions = data?.data?.submissions || [];
  const totalCount = data?.data?.pagination?.totalItems || 0;

  const filteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return submissions;
    const q = searchQuery.toLowerCase();
    return submissions.filter(s => 
      s.username?.toLowerCase().includes(q) ||
      s.transactionId?.toLowerCase().includes(q) ||
      s.id?.toString().includes(q)
    );
  }, [submissions, searchQuery]);

  const handleVerify = (submission: PaymentSubmission) => {
    setSelectedSubmission(submission);
    setVerifyDialogOpen(true);
  };

  const handleViewReceipt = (url: string) => {
    if (url) window.open(getImageUrl(url), '_blank');
  };

  if (!canVerify) {
    return (
      <PageContainer>
        <EmptyState
          icon={AlertCircle}
          title="Access Denied"
          description="Only admins and teachers can review submissions."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)} size="sm">
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              Pending Submissions
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Review and verify payment submissions
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm self-start sm:self-auto">
          <Clock className="h-3 w-3 mr-1" />
          {totalCount} pending
        </Badge>
      </div>

      {/* Search & Refresh */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by student name or transaction ID..." 
                className="pl-10 text-sm"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => loadPendingSubmissions(true)} 
              disabled={loading}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <ColumnConfigurator allColumns={PS_COL_DEFS} colState={psColState} onToggle={togglePSCol} onReset={resetPSCols} />
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && !data && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!loading || data ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-primary" />
              Pending Review Queue
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Paper sx={{ width: '100%', overflow: 'hidden', height: 'calc(100vh - 320px)', display: 'flex', flexDirection: 'column' }}>
              <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                <Table stickyHeader sx={{ tableLayout: 'fixed', minWidth: psVisDefs.reduce((s, c) => s + getPSColWidth(c.key), 0) }}>
                  <TableHead>
                    <TableRow>
                      {psVisDefs.map((col) => (
                        <TableCell key={col.key} sx={{ position: 'relative', width: getPSColWidth(col.key), fontWeight: 600, bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
                          onMouseEnter={() => setPSHoveredCol(col.key)} onMouseLeave={() => setPSHoveredCol(null)}>
                          <div style={{ paddingRight: 12 }}>{col.header}</div>
                          <PSResizeHandle colId={col.key} />
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSubmissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={psVisDefs.length} align="center">
                          <div className="py-12">
                            <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground text-lg">
                              {searchQuery ? 'No matching submissions' : 'No pending submissions'}
                            </p>
                            <p className="text-muted-foreground text-sm">
                              {searchQuery ? 'Try a different search' : 'All submissions have been reviewed!'}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSubmissions.map(submission => (
                        <TableRow hover key={submission.id}>
                          {psVisKeys.has('student') && (
                            <TableCell style={{ width: getPSColWidth('student'), maxWidth: getPSColWidth('student'), overflow: 'hidden' }}>
                              <div className="font-medium text-foreground">{submission.username || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">ID: {submission.userId}</div>
                            </TableCell>
                          )}
                          {psVisKeys.has('amount') && (
                            <TableCell style={{ width: getPSColWidth('amount'), maxWidth: getPSColWidth('amount'), overflow: 'hidden' }}>
                              <span className="font-semibold text-primary">
                                Rs {parseFloat(submission.submittedAmount || '0').toLocaleString()}
                              </span>
                            </TableCell>
                          )}
                          {psVisKeys.has('transactionRef') && (
                            <TableCell style={{ width: getPSColWidth('transactionRef'), maxWidth: getPSColWidth('transactionRef'), overflow: 'hidden' }}>
                              <span className="font-mono text-xs">{submission.transactionId || '-'}</span>
                            </TableCell>
                          )}
                          {psVisKeys.has('paymentDate') && (
                            <TableCell style={{ width: getPSColWidth('paymentDate'), maxWidth: getPSColWidth('paymentDate'), overflow: 'hidden' }}>
                              {submission.paymentDate ? new Date(submission.paymentDate).toLocaleDateString() : '-'}
                            </TableCell>
                          )}
                          {psVisKeys.has('submitted') && (
                            <TableCell style={{ width: getPSColWidth('submitted'), maxWidth: getPSColWidth('submitted'), overflow: 'hidden' }}>
                              {submission.uploadedAt ? new Date(submission.uploadedAt).toLocaleDateString() : '-'}
                            </TableCell>
                          )}
                          {psVisKeys.has('receipt') && (
                            <TableCell style={{ width: getPSColWidth('receipt'), maxWidth: getPSColWidth('receipt'), overflow: 'hidden' }}>
                              {submission.receiptUrl ? (
                                <Button variant="outline" size="sm" onClick={() => handleViewReceipt(submission.receiptUrl)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              ) : '-'}
                            </TableCell>
                          )}
                          {psVisKeys.has('actions') && (
                            <TableCell style={{ width: getPSColWidth('actions'), maxWidth: getPSColWidth('actions'), overflow: 'hidden' }}>
                              <Button size="sm" onClick={() => handleVerify(submission)}>Verify</Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50]}
                component="div"
                count={totalCount}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={e => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </Paper>
          </CardContent>
        </Card>
      ) : null}

      {/* Verify Dialog */}
      {selectedInstitute && (
        <VerifySubmissionDialog
          open={verifyDialogOpen}
          onOpenChange={setVerifyDialogOpen}
          submission={selectedSubmission}
          instituteId={selectedInstitute.id}
          onSuccess={() => {
            setVerifyDialogOpen(false);
            setSelectedSubmission(null);
            loadPendingSubmissions();
          }}
        />
      )}
    </PageContainer>
  );
};

export default PendingSubmissions;
