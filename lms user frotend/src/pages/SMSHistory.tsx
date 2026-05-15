import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTableData } from '@/hooks/useTableData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const SMSH_COL_DEFS: ColumnDef[] = [
  { key: 'id', header: 'ID', defaultVisible: false, defaultWidth: 80, minWidth: 60 },
  { key: 'messageType', header: 'Message Type', defaultWidth: 160, minWidth: 120 },
  { key: 'recipientFilter', header: 'Recipient Filter', defaultWidth: 160, minWidth: 120 },
  { key: 'status', header: 'Status', defaultWidth: 130, minWidth: 90 },
  { key: 'maskId', header: 'Mask ID', defaultWidth: 160, minWidth: 120 },
  { key: 'totalRecipients', header: 'Total', defaultWidth: 80, minWidth: 70 },
  { key: 'successful', header: 'Sent', defaultWidth: 80, minWidth: 70 },
  { key: 'failed', header: 'Failed', defaultWidth: 80, minWidth: 70 },
  { key: 'slip', header: 'Slip', defaultWidth: 90, minWidth: 70 },
  { key: 'actions', header: 'Actions', locked: true, defaultWidth: 100, minWidth: 80 },
];
import { format } from 'date-fns';
import { RefreshCw, Filter, X, Eye, Plus, FileText } from 'lucide-react';
import { apiClient } from '@/api/client';
import { toast } from '@/hooks/use-toast';
import PaymentSlipPreviewDialog from '@/components/PaymentSlipPreviewDialog';
interface SMSMessage {
  id: string;
  instituteId: string;
  sentBy: string;
  messageType: string;
  recipientFilterType: string;
  messageTemplate: string;
  processedMessageSample: string;
  totalRecipients: number;
  successfulSends: number;
  failedSends: number;
  creditsUsed: number;
  status: string;
  maskIdUsed: string | null;
  senderName: string | null;
  filterCriteria: any;
  scheduledAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  sentAt: string | null;
  completedAt: string | null;
  rejectionReason: string | null;
  errorMessage: string | null;
  deliveryReport: any;
  notificationLogged: boolean;
  createdAt: string;
  updatedAt: string;
}
export default function SMSHistory() {
  const {
    selectedInstitute
  } = useAuth();
  const [selectedMessage, setSelectedMessage] = useState<SMSMessage | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState<string>('');
  const [messageTypeFilter, setMessageTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newPaymentOpen, setNewPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    requestedCredits: '',
    paymentAmount: '',
    paymentMethod: 'Bank Transfer',
    paymentReference: '',
    submissionNotes: '',
    paymentSlip: null as File | null
  });
  const [slipPreviewUrl, setSlipPreviewUrl] = useState<string | null>(null);
  const {
    state: {
      data: messages,
      loading
    },
    pagination: {
      page,
      limit,
      totalCount
    },
    actions: {
      setPage,
      setLimit,
      refresh,
      updateFilters
    }
  } = useTableData<SMSMessage>({
    endpoint: selectedInstitute ? `/sms/message-history/${selectedInstitute.id}` : '',
    autoLoad: true, // Enable auto-loading from cache
    defaultParams: {
      recipientFilterType: recipientFilter || undefined,
      messageType: messageTypeFilter || undefined,
      search: searchQuery || undefined
    },
    pagination: {
      defaultLimit: 10,
      availableLimits: [10, 25, 50, 100]
    }
  });

  // Filters will be applied when you click "Load Data"
  const clearFilters = () => {
    setRecipientFilter('');
    setMessageTypeFilter('');
    setSearchQuery('');
  };
  const handleView = (message: SMSMessage) => {
    setSelectedMessage(message);
    setViewDialogOpen(true);
  };
  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      QUEUED: 'bg-yellow-500',
      PENDING: 'bg-blue-500',
      SENT: 'bg-green-500',
      FAILED: 'bg-red-500',
      APPROVED: 'bg-green-600',
      REJECTED: 'bg-red-600'
    };
    return <Badge className={statusColors[status] || 'bg-gray-500'}>
        {status}
      </Badge>;
  };
  const smshColIds = useMemo(() => SMSH_COL_DEFS.map(c => c.key), []);
  const smshColDefaultWidths = useMemo(() => Object.fromEntries(SMSH_COL_DEFS.map(c => [c.key, c.defaultWidth!])), []);
  const { getWidth: getSMSHColWidth, setHoveredCol: setSMSHHoveredCol, hoveredCol: SMSHHoveredCol, activeCol: SMSHActiveCol, startResize: SMSHStartResize } = useResizableColumns(smshColIds, smshColDefaultWidths);
  const { colState: smshColState, visibleColumns: smshVisDefs, toggleColumn: toggleSMSHCol, resetColumns: resetSMSHCols } = useColumnConfig(SMSH_COL_DEFS, 'sms-history');
  const smshVisKeys = useMemo(() => new Set(smshVisDefs.map(c => c.key)), [smshVisDefs]);

  const [currentPage, setCurrentPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const handleChangePage = (event: unknown, newPage: number) => {
    setCurrentPage(newPage);
    setPage(newPage);
  };
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setLimit(+event.target.value);
    setCurrentPage(0);
    setPage(0);
  };
  const handlePaymentSubmit = async () => {
    if (!selectedInstitute) return;
    if (!paymentForm.requestedCredits || !paymentForm.paymentAmount || !paymentForm.paymentReference || !paymentForm.paymentSlip) {
      toast({
        title: "Error",
        description: "Please fill in all required fields and upload payment slip",
        variant: "destructive"
      });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('requestedCredits', paymentForm.requestedCredits);
      formData.append('paymentAmount', paymentForm.paymentAmount);
      formData.append('paymentMethod', paymentForm.paymentMethod);
      formData.append('paymentReference', paymentForm.paymentReference);
      formData.append('submissionNotes', paymentForm.submissionNotes);
      formData.append('paymentSlip', paymentForm.paymentSlip);
      const response = await apiClient.post(`/sms/payment/submit?instituteId=${selectedInstitute.id}`, formData);
      toast({
        title: "Success",
        description: response.data.message || "Payment submission created successfully"
      });
      setNewPaymentOpen(false);
      setPaymentForm({
        requestedCredits: '',
        paymentAmount: '',
        paymentMethod: 'Bank Transfer',
        paymentReference: '',
        submissionNotes: '',
        paymentSlip: null
      });
      refresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to submit payment",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };
  const handleViewSlip = (filename: string | null) => {
    if (!filename) {
      toast({
        title: "No slip available",
        description: "This payment has no slip uploaded",
        variant: "destructive"
      });
      return;
    }
    // Open the slip - use configured backend URL
    const baseUrl = import.meta.env.VITE_LMS_BASE_URL || 'https://lmsapi.suraksha.lk';
    const slipUrl = `${baseUrl}/sms/payment-slip/${filename}`;
    setSlipPreviewUrl(slipUrl);
  };
  if (!selectedInstitute) {
    return <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Please select an institute to view SMS history</p>
      </div>;
  }
  return <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">SMS Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">View all sent SMS messages</p>
        </div>
        <div className="flex flex-wrap gap-2">
          
          <Button onClick={() => setShowFilters(!showFilters)} variant="outline" className="flex items-center gap-2" size="sm">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </Button>
          <Button onClick={refresh} disabled={loading || !selectedInstitute} variant="outline" className="flex items-center gap-2" size="sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Loading...' : 'Load Data'}</span>
          </Button>
          <ColumnConfigurator allColumns={SMSH_COL_DEFS} colState={smshColState} onToggle={toggleSMSHCol} onReset={resetSMSHCols} />
        </div>
      </div>

      {showFilters && <div className="bg-muted/50 p-4 rounded-lg space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Filters</h3>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search (ID / Sent By)</label>
              <Input placeholder="Search by ID or Sent By..." value={searchQuery} onChange={e => { const v = e.target.value; setSearchQuery(v); updateFilters({ recipientFilterType: recipientFilter || undefined, messageType: messageTypeFilter || undefined, search: v || undefined }); }} className="w-full" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Recipient Filter</label>
              <Select value={recipientFilter || "all"} onValueChange={value => { const val = value === "all" ? '' : value; setRecipientFilter(val); updateFilters({ recipientFilterType: val || undefined, messageType: messageTypeFilter || undefined, search: searchQuery || undefined }); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                  <SelectItem value="STUDENTS">Students</SelectItem>
                  <SelectItem value="TEACHERS">Teachers</SelectItem>
                  <SelectItem value="PARENTS">Parents</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Message Type</label>
              <Select value={messageTypeFilter || "all"} onValueChange={value => { const val = value === "all" ? '' : value; setMessageTypeFilter(val); updateFilters({ recipientFilterType: recipientFilter || undefined, messageType: val || undefined, search: searchQuery || undefined }); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Message Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Message Types</SelectItem>
                  <SelectItem value="CUSTOM_NUMBERS">Custom Numbers</SelectItem>
                  <SelectItem value="BULK_INSTITUTE_USERS">Bulk Institute Users</SelectItem>
                  <SelectItem value="CLASS_BASED">Class Based</SelectItem>
                  <SelectItem value="SUBJECT_BASED">Subject Based</SelectItem>
                  <SelectItem value="USER_TYPE_BASED">User Type Based</SelectItem>
                  <SelectItem value="SPECIFIC_USERS">Specific Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>}

      <Paper sx={{ width: '100%', overflow: 'hidden', height: showFilters ? 'calc(100vh - 350px)' : 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table stickyHeader aria-label="sms messages table" sx={{ tableLayout: 'fixed', minWidth: smshVisDefs.reduce((s, c) => s + getSMSHColWidth(c.key), 0) }}>
            <TableHead>
              <TableRow>
                {smshVisDefs.map((col) => (
                  <TableCell key={col.key} sx={{ position: 'relative', width: getSMSHColWidth(col.key), fontWeight: 600, bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
                    onMouseEnter={() => setSMSHHoveredCol(col.key)} onMouseLeave={() => setSMSHHoveredCol(null)}>
                    <div style={{ paddingRight: 12 }}>{col.header}</div>
                    <ResizeHandle colId={col.key} hoveredCol={SMSHHoveredCol} activeCol={SMSHActiveCol} onMouseDown={SMSHStartResize} />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {messages.map(message => (
                <TableRow hover role="checkbox" tabIndex={-1} key={message.id}>
                  {smshVisKeys.has('id') && <TableCell style={{ width: getSMSHColWidth('id'), maxWidth: getSMSHColWidth('id'), overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{message.id}</TableCell>}
                  {smshVisKeys.has('messageType') && <TableCell style={{ width: getSMSHColWidth('messageType'), maxWidth: getSMSHColWidth('messageType'), overflow: 'hidden' }}>{message.messageType.replace(/_/g, ' ')}</TableCell>}
                  {smshVisKeys.has('recipientFilter') && <TableCell style={{ width: getSMSHColWidth('recipientFilter'), maxWidth: getSMSHColWidth('recipientFilter'), overflow: 'hidden' }}>{message.recipientFilterType.replace(/_/g, ' ')}</TableCell>}
                  {smshVisKeys.has('status') && <TableCell style={{ width: getSMSHColWidth('status'), maxWidth: getSMSHColWidth('status'), overflow: 'hidden' }}>{getStatusBadge(message.status)}</TableCell>}
                  {smshVisKeys.has('maskId') && <TableCell style={{ width: getSMSHColWidth('maskId'), maxWidth: getSMSHColWidth('maskId'), overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{message.maskIdUsed || '-'}</TableCell>}
                  {smshVisKeys.has('totalRecipients') && <TableCell style={{ width: getSMSHColWidth('totalRecipients'), maxWidth: getSMSHColWidth('totalRecipients'), overflow: 'hidden' }}>{message.totalRecipients}</TableCell>}
                  {smshVisKeys.has('successful') && <TableCell style={{ width: getSMSHColWidth('successful'), maxWidth: getSMSHColWidth('successful'), overflow: 'hidden' }}><span className="text-green-600 font-medium">{message.successfulSends}</span></TableCell>}
                  {smshVisKeys.has('failed') && <TableCell style={{ width: getSMSHColWidth('failed'), maxWidth: getSMSHColWidth('failed'), overflow: 'hidden' }}><span className="text-red-600 font-medium">{message.failedSends}</span></TableCell>}
                  {smshVisKeys.has('slip') && <TableCell style={{ width: getSMSHColWidth('slip'), maxWidth: getSMSHColWidth('slip'), overflow: 'hidden' }}><Button variant="ghost" size="sm" onClick={() => handleViewSlip((message as any).paymentSlipFilename)} disabled={!(message as any).paymentSlipFilename}><FileText className="h-4 w-4 mr-1" />View</Button></TableCell>}
                  {smshVisKeys.has('actions') && <TableCell style={{ width: getSMSHColWidth('actions'), maxWidth: getSMSHColWidth('actions'), overflow: 'hidden' }}><Button variant="outline" size="sm" onClick={() => handleView(message)}><Eye className="h-4 w-4 mr-1" />View</Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination rowsPerPageOptions={[10, 25, 50, 100]} component="div" count={totalCount} rowsPerPage={rowsPerPage} page={currentPage} onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage} />
      </Paper>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-bold text-base leading-tight">SMS Message Details</p>
                {selectedMessage && <p className="text-[13px] text-muted-foreground font-mono">{selectedMessage.id}</p>}
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedMessage && (
            <div className="space-y-4">
              {/* Overview */}
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Overview <span className="flex-1 h-px bg-border/40" /></p>
                <div className="divide-y divide-border/40">
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span>{getStatusBadge(selectedMessage.status)}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Message Type</span>
                    <span className="text-sm font-medium">{selectedMessage.messageType.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Sent By</span>
                    <span className="text-sm font-medium">{selectedMessage.sentBy}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Recipient Filter</span>
                    <span className="text-sm font-medium">{selectedMessage.recipientFilterType.replace(/_/g, ' ')}</span>
                  </div>
                  {selectedMessage.senderName && (
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Sender Name</span>
                      <span className="text-sm font-medium">{selectedMessage.senderName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Stats */}
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Delivery Stats <span className="flex-1 h-px bg-border/40" /></p>
                <div className="divide-y divide-border/40">
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Total Recipients</span>
                    <span className="text-sm font-semibold text-primary">{selectedMessage.totalRecipients}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Successful</span>
                    <span className="text-sm font-semibold text-green-700 dark:text-green-300">{selectedMessage.successfulSends}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Failed</span>
                    <span className="text-sm font-semibold text-red-700 dark:text-red-300">{selectedMessage.failedSends}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Credits Used</span>
                    <span className="text-sm font-semibold">{selectedMessage.creditsUsed}</span>
                  </div>
                </div>
              </div>

              {/* Message Content */}
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Message Content <span className="flex-1 h-px bg-border/40" /></p>
                <div className="space-y-2">
                  <div>
                    <p className="text-[13px] text-muted-foreground mb-1.5">Template</p>
                    <p className="text-sm leading-relaxed">{selectedMessage.messageTemplate}</p>
                  </div>
                  {selectedMessage.processedMessageSample && (
                    <div className="pt-2 border-t border-border/30">
                      <p className="text-[13px] text-muted-foreground mb-1.5">Processed Sample</p>
                      <p className="text-sm leading-relaxed">{selectedMessage.processedMessageSample}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Filter Criteria */}
              {selectedMessage.filterCriteria && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Filter Criteria <span className="flex-1 h-px bg-border/40" /></p>
                  <div className="divide-y divide-border/40">
                    {Object.entries(selectedMessage.filterCriteria).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between py-3.5">
                        <span className="text-sm text-muted-foreground">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                        </span>
                        <span className="text-sm font-medium">{Array.isArray(val) ? (val as any[]).join(', ') : String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Timestamps <span className="flex-1 h-px bg-border/40" /></p>
                <div className="divide-y divide-border/40">
                  {selectedMessage.scheduledAt && new Date(selectedMessage.scheduledAt).toString() !== 'Invalid Date' && (
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Scheduled</span>
                      <span className="text-sm font-medium">{format(new Date(selectedMessage.scheduledAt), 'PPpp')}</span>
                    </div>
                  )}
                  {selectedMessage.sentAt && new Date(selectedMessage.sentAt).toString() !== 'Invalid Date' && (
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Sent</span>
                      <span className="text-sm font-medium">{format(new Date(selectedMessage.sentAt), 'PPpp')}</span>
                    </div>
                  )}
                  {selectedMessage.approvedAt && new Date(selectedMessage.approvedAt).toString() !== 'Invalid Date' && (
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-xs text-green-600 dark:text-green-400">Approved</span>
                      <span className="text-xs font-medium text-green-700 dark:text-green-300">{format(new Date(selectedMessage.approvedAt), 'PPpp')}</span>
                    </div>
                  )}
                  {selectedMessage.completedAt && new Date(selectedMessage.completedAt).toString() !== 'Invalid Date' && (
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-xs text-green-600 dark:text-green-400">Completed</span>
                      <span className="text-xs font-medium text-green-700 dark:text-green-300">{format(new Date(selectedMessage.completedAt), 'PPpp')}</span>
                    </div>
                  )}
                  {selectedMessage.createdAt && (
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Created</span>
                      <span className="text-sm font-medium">{format(new Date(selectedMessage.createdAt), 'PPpp')}</span>
                    </div>
                  )}
                  {selectedMessage.updatedAt && (
                    <div className="flex items-center justify-between py-3.5">
                      <span className="text-sm text-muted-foreground">Updated</span>
                      <span className="text-sm font-medium">{format(new Date(selectedMessage.updatedAt), 'PPpp')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Errors */}
              {(selectedMessage.rejectionReason || selectedMessage.errorMessage) && (
                <div className="space-y-2">
                  {selectedMessage.rejectionReason && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 block mb-1">Rejection Reason</span>
                      <p className="text-sm text-red-700 dark:text-red-300">{selectedMessage.rejectionReason}</p>
                    </div>
                  )}
                  {selectedMessage.errorMessage && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 block mb-1">Error Message</span>
                      <p className="text-sm text-red-700 dark:text-red-300">{selectedMessage.errorMessage}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Payment Dialog */}
      <Dialog open={newPaymentOpen} onOpenChange={setNewPaymentOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Payment for SMS Credits</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requestedCredits">Requested Credits *</Label>
                <Input id="requestedCredits" type="number" placeholder="1000" value={paymentForm.requestedCredits} onChange={e => setPaymentForm({
                ...paymentForm,
                requestedCredits: e.target.value
              })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Payment Amount *</Label>
                <Input id="paymentAmount" type="number" step="0.01" placeholder="1000.00" value={paymentForm.paymentAmount} onChange={e => setPaymentForm({
                ...paymentForm,
                paymentAmount: e.target.value
              })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <Select value={paymentForm.paymentMethod} onValueChange={value => setPaymentForm({
              ...paymentForm,
              paymentMethod: value
            })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                  <SelectItem value="Online Payment">Online Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentReference">Payment Reference *</Label>
              <Input id="paymentReference" placeholder="TXN12345" value={paymentForm.paymentReference} onChange={e => setPaymentForm({
              ...paymentForm,
              paymentReference: e.target.value
            })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="submissionNotes">Submission Notes</Label>
              <Textarea id="submissionNotes" placeholder="Payment made on 2024-10-07 via online banking" value={paymentForm.submissionNotes} onChange={e => setPaymentForm({
              ...paymentForm,
              submissionNotes: e.target.value
            })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentSlip">Payment Slip *</Label>
              <Input id="paymentSlip" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                setPaymentForm({
                  ...paymentForm,
                  paymentSlip: file
                });
              }
            }} />
              {paymentForm.paymentSlip && <p className="text-sm text-muted-foreground">
                  Selected: {paymentForm.paymentSlip.name}
                </p>}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setNewPaymentOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handlePaymentSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentSlipPreviewDialog
        open={!!slipPreviewUrl}
        onOpenChange={(open) => { if (!open) setSlipPreviewUrl(null); }}
        url={slipPreviewUrl || ''}
        title="Payment Slip"
      />
    </div>;
}