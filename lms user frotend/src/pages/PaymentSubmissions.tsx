import React, { useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, CheckCircle, AlertCircle, Calendar, DollarSign, RefreshCw, ExternalLink, Eye, Search, Filter, X, ChevronDown, Shield, LayoutGrid, Table2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useNavigate, useParams } from 'react-router-dom';
import { institutePaymentsApi, PaymentSubmissionsResponse, PaymentSubmission } from '@/api/institutePayments.api';
import { subjectPaymentsApi, SubjectPaymentSubmission } from '@/api/subjectPayments.api';
import { getBaseUrl } from '@/contexts/utils/auth.api';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import VerifySubmissionDialog from '@/components/forms/VerifySubmissionDialog';
import { useTableData } from '@/hooks/useTableData';
import { useViewMode } from '@/hooks/useViewMode';
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
interface Column {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  format?: (value: any, row?: any) => React.ReactNode;
}
const PaymentSubmissions = () => {
  const {
    selectedInstitute,
    selectedClass,
    selectedSubject,
    user
  } = useAuth();
  const role = useInstituteRole();
  const canVerifySubmissions = role === 'InstituteAdmin';
  const navigate = useNavigate();
  const {
    paymentId
  } = useParams<{
    paymentId: string;
  }>();
  const {
    toast
  } = useToast();
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<PaymentSubmission | SubjectPaymentSubmission | null>(null);
  const { viewMode, setViewMode } = useViewMode();
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);

  // Use the class-level payment submissions endpoint
  const endpoint = useMemo(() => {
    if (!paymentId || !selectedInstitute || !selectedClass) return '';
    // Use the new class-level payment submissions endpoint
    return `/institute-class-payment-submissions/institute/${selectedInstitute.id}/class/${selectedClass.id}/payment/${paymentId}/submissions`;
  }, [paymentId, selectedInstitute, selectedClass]);

  // Search state
  const [searchValue, setSearchValue] = useState('');
  const [searchType, setSearchType] = useState('studentName');

  // Define columns for the payment submissions table
  const columns: Column[] = useMemo(() => {
    const baseColumns: Column[] = [{
      id: 'id',
      label: 'Submission ID',
      minWidth: 120
    }, {
      id: 'username',
      label: 'Student Name',
      minWidth: 150
    }];

    baseColumns.push({
      id: 'submittedAmount',
      label: 'Amount',
      minWidth: 120,
      align: 'right',
      format: (value: number | string) => `Rs ${typeof value === 'string' ? parseFloat(value).toLocaleString() : value.toLocaleString()}`
    });

    baseColumns.push({
      id: 'transactionId',
      label: 'Transaction Ref',
      minWidth: 150
    }, {
      id: 'receipt',
      label: 'Receipt',
      minWidth: 100,
      align: 'center',
      format: (value: any, row: any) => {
        const receiptUrl = row.receiptUrl;
        const hasAttachment = !!receiptUrl;
        return hasAttachment ? <Button onClick={() => handleViewReceipt(receiptUrl)} size="sm" variant="outline">
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button> : null;
      }
    }, {
      id: 'paymentDate',
      label: 'Payment Date',
      minWidth: 120,
      format: (value: string) => new Date(value).toLocaleDateString()
    });

    baseColumns.push({
      id: 'notes',
      label: 'Notes',
      minWidth: 150
    });

    baseColumns.push({
      id: 'status',
      label: 'Status',
      minWidth: 120,
      format: (value: string) => <Badge className={getStatusColor(value)}>
        {getStatusIcon(value)}
        <span className="ml-2">{value}</span>
      </Badge>
    }, {
      id: 'actions',
      label: 'Actions',
      minWidth: 120,
      align: 'center',
      format: (value: any, row: any) => canVerifySubmissions && row.status === 'PENDING' ? <Button onClick={() => handleVerifySubmission(row)} size="sm">
        Verify
      </Button> : null
    });

    return baseColumns;
  }, [canVerifySubmissions]);

  const psColDefs = useMemo<ColumnDef[]>(() =>
    columns.map(c => ({ key: c.id, header: c.label, defaultWidth: c.minWidth || 150, minWidth: Math.floor((c.minWidth || 150) * 0.7) })),
    [columns]
  );
  const psColIds = useMemo(() => psColDefs.map(c => c.key), [psColDefs]);
  const psColDefaultWidths = useMemo(() => Object.fromEntries(psColDefs.map(c => [c.key, c.defaultWidth ?? 150])), [psColDefs]);
  const { getWidth: getPsColWidth, setHoveredCol: setPsHoveredCol, ResizeHandle: PsResizeHandle } = useResizableColumns(psColIds, psColDefaultWidths);
  const { colState: psColState, visibleColumns: psVisDefs, toggleColumn: togglePsCol, resetColumns: resetPsCols } = useColumnConfig(psColDefs, 'payment-submissions');

  // Use the table data hook for pagination and data management
  const {
    state: {
      data: submissions,
      loading,
      error
    },
    actions: {
      refresh,
      updateFilters
    },
    pagination: {
      page,
      limit,
      totalCount
    }
  } = useTableData<PaymentSubmission | SubjectPaymentSubmission>({
    endpoint,
    pagination: {
      defaultLimit: 10,
      availableLimits: [10, 25, 50]
    },
    autoLoad: !!endpoint
  });

  // Client-side filtered submissions (live, no refresh)
  const filteredSubmissions = useMemo(() => {
    if (!searchValue.trim()) return submissions;
    const q = searchValue.trim().toLowerCase();

    return submissions.filter((row) => {
      if (!row) return false;
      switch (searchType) {
        case 'submissionId': {
          const id = String((row as any).id ?? '');
          return id.toLowerCase().includes(q);
        }
        case 'studentName': {
          const name = String((row as any)['username'] ?? '');
          return name.toLowerCase().includes(q);
        }
        case 'userId': {
          const uid = String((row as any).userId ?? '');
          return uid.toLowerCase().includes(q);
        }
        case 'amount': {
          const amt = (row as any)['submittedAmount'];
          if (amt == null) return false;
          return String(amt).toLowerCase().includes(q);
        }
        default:
          return true;
      }
    });
  }, [submissions, searchType, searchValue]);
  const clearSearch = () => {
    setSearchValue('');
    setSearchType('studentName');
  };

  // (canVerifySubmissions hoisted above)
  const handleVerifySubmission = (submission: PaymentSubmission | SubjectPaymentSubmission) => {
    setSelectedSubmission(submission);
    setVerifyDialogOpen(true);
  };
  const handleViewReceipt = (receiptUrl: string) => {
    if (receiptUrl) {
      // Convert to storage.suraksha.lk URL format and open in new tab
      const fullUrl = getImageUrl(receiptUrl);
      window.open(fullUrl, '_blank');
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300';
    }
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <CheckCircle className="h-4 w-4" />;
      case 'PENDING':
        return <AlertCircle className="h-4 w-4" />;
      case 'REJECTED':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };
  const handlePageChange = (event: unknown, newPage: number) => {
    updateFilters({
      page: newPage + 1
    });
  };
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    updateFilters({
      limit: newLimit,
      page: 1
    });
  };
  return <AppLayout currentPage="class-payments">
    <div className="space-y-3 sm:space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-1 sm:gap-2 px-2" size="sm">
            <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="text-xs sm:text-sm">Back</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-2xl font-bold truncate">Payment Submissions</h1>
            <p className="text-muted-foreground text-xs sm:text-sm truncate">Payment ID: {paymentId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 justify-center w-full sm:w-auto">
          <Button onClick={() => refresh()} disabled={loading} size="sm" variant="outline" className="gap-2">
            <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="text-xs sm:text-sm">{loading ? 'Loading...' : 'Refresh'}</span>
          </Button>
          {/* View mode toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 transition-colors ${viewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              title="Table view"
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>
          {viewMode === 'table' && <ColumnConfigurator allColumns={psColDefs} colState={psColState} onToggle={togglePsCol} onReset={resetPsCols} />}
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="flex-1 order-2 sm:order-1">
              <Input
                placeholder={`Search by ${searchType === 'submissionId' ? 'submission ID' : searchType === 'studentName' ? 'student name' : searchType === 'userId' ? 'user ID' : 'amount'}...`}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full h-9 sm:h-10 text-xs sm:text-sm"
              />
            </div>
            <div className="order-1 sm:order-2 flex items-center gap-2">
              <Select value={searchType} onValueChange={setSearchType}>
                <SelectTrigger className="w-full sm:w-48 h-9 sm:h-10 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submissionId">Submission ID</SelectItem>
                  <SelectItem value="studentName">Student Name</SelectItem>
                  <SelectItem value="userId">User ID</SelectItem>
                  <SelectItem value="amount">Amount</SelectItem>
                </SelectContent>
              </Select>
              {searchValue && (
                <Button variant="outline" size="sm" onClick={clearSearch} className="h-9 px-3">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Selection Info */}
      {selectedInstitute && <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Institute:</span>
              <span className="text-sm">{selectedInstitute.name}</span>
            </div>
            {selectedClass && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Class:</span>
                <span className="text-sm">{selectedClass.name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>}

      {/* Payment Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Payment Submissions</span>
              <Badge variant="secondary">
                {totalCount} total
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <div className="text-center py-10 sm:py-12">
            <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 text-destructive mx-auto mb-3 sm:mb-4" />
            <p className="text-destructive text-base sm:text-lg mb-1 sm:mb-2">Error loading submissions</p>
            <p className="text-muted-foreground text-xs sm:text-sm">{error}</p>
          </div> : viewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading && filteredSubmissions.length === 0 ? (
                <div className="col-span-full text-center py-10"><RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-muted-foreground" /><p className="text-muted-foreground">Loading submissions...</p></div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="col-span-full text-center py-10"><FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">No submissions found</p></div>
              ) : filteredSubmissions.map((row) => {
                const rowId = String((row as any).id ?? Math.random());
                const isExpanded = expandedSubmissionId === rowId;
                const name = (row as any)['username'] || 'Unknown';
                const amount = (row as any)['submittedAmount'];
                const txRef = (row as any)['transactionId'];
                const notes = (row as any).notes || (row as any).remarks;
                const receiptUrl = (row as any).receiptUrl;
                return (
                  <Card key={rowId} className="hover:shadow-md transition-shadow">
                    <div className="p-4 flex items-start gap-3 cursor-pointer select-none" onClick={() => setExpandedSubmissionId(isExpanded ? null : rowId)}>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{name}</p>
                        <p className="text-xs text-muted-foreground">ID: {(row as any).id}</p>
                      </div>
                      <Badge className={getStatusColor((row as any).status)}>{(row as any).status}</Badge>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t pt-3 space-y-2">
                        {amount != null && <div className="text-lg font-bold text-primary">Rs {typeof amount === 'string' ? parseFloat(amount).toLocaleString() : Number(amount).toLocaleString()}</div>}
                        {txRef && <p className="text-xs text-muted-foreground">Transaction: {txRef}</p>}
                        {(row as any).paymentDate && <p className="text-xs text-muted-foreground">Date: {new Date((row as any).paymentDate).toLocaleDateString()}</p>}
                        {(row as any).paymentMethod && <p className="text-xs text-muted-foreground">Method: {(row as any).paymentMethod}</p>}
                        {notes && <p className="text-xs text-muted-foreground">Notes: {notes}</p>}
                        <div className="flex gap-2 pt-1 border-t">
                          {receiptUrl && (
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => window.open(getImageUrl(receiptUrl), '_blank')}>
                              <Eye className="h-3.5 w-3.5 mr-1" />View Receipt
                            </Button>
                          )}
                          {canVerifySubmissions && (row as any).status === 'PENDING' && (
                            <Button size="sm" className="flex-1" onClick={() => handleVerifySubmission(row)}>
                              <Shield className="h-3.5 w-3.5 mr-1" />Verify
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Paper sx={{ width: '100%', height: 'calc(100vh - 300px)', display: 'flex', flexDirection: 'column' }}>
              <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                <Table stickyHeader aria-label="payment submissions table" sx={{ tableLayout: 'fixed', minWidth: psVisDefs.reduce((s, c) => s + getPsColWidth(c.key), 0) }}>
                  <TableHead>
                    <TableRow>
                      {psVisDefs.map(col => (
                        <TableCell
                          key={col.key}
                          sx={{ position: 'relative', width: getPsColWidth(col.key), maxWidth: getPsColWidth(col.key), overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 600, bgcolor: 'rgba(0,0,0,0.04)' }}
                          onMouseEnter={() => setPsHoveredCol(col.key)}
                          onMouseLeave={() => setPsHoveredCol(null)}
                        >
                          <div style={{ paddingRight: 12 }}>{col.header}</div>
                          <PsResizeHandle colId={col.key} />
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={psVisDefs.length} align="center">
                          <div className="py-8 sm:py-12 text-center">
                            <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                            <p className="text-muted-foreground text-sm sm:text-base">Loading submissions...</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredSubmissions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={psVisDefs.length} align="center">
                          <div className="py-8 sm:py-12 text-center px-4">
                            <FileText className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                            <p className="text-muted-foreground text-sm sm:text-lg mb-1 sm:mb-2">No submissions found</p>
                            <p className="text-muted-foreground text-xs sm:text-sm">No payment submissions have been made for this payment.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredSubmissions.map((row, index) => (
                      <TableRow hover role="checkbox" tabIndex={-1} key={(row as any).id || index}>
                        {psVisDefs.map(col => {
                          const colDef = columns.find(c => c.id === col.key);
                          const value = (row as any)[col.key as keyof typeof row];
                          return (
                            <TableCell key={col.key} align={colDef?.align} style={{ width: getPsColWidth(col.key), maxWidth: getPsColWidth(col.key), overflow: 'hidden' }}>
                              {colDef?.format ? colDef.format(value, row) : (value ?? '-')}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={totalCount}
                rowsPerPage={limit}
                page={page}
                onPageChange={handlePageChange}
                onRowsPerPageChange={handleRowsPerPageChange}
                labelRowsPerPage="Submissions per page:"
                sx={{
                  '.MuiTablePagination-toolbar': {
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    minHeight: { xs: '44px', sm: '52px' },
                    px: { xs: 1, sm: 2 }
                  },
                  '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                    fontSize: { xs: '0.75rem', sm: '0.875rem' }
                  }
                }}
              />
            </Paper>
          )}
        </CardContent>
      </Card>

      {/* Verify Dialog */}
      {selectedInstitute && (
        <VerifySubmissionDialog
          open={verifyDialogOpen}
          onOpenChange={setVerifyDialogOpen}
          submission={selectedSubmission as PaymentSubmission}
          instituteId={selectedInstitute.id}
          onSuccess={() => refresh()}
        />
      )}
    </div>
  </AppLayout>;
};
export default PaymentSubmissions;