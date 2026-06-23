import React, { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Eye, CheckCircle, Clock, XCircle, User, Calendar, FileText, DollarSign, Shield, RefreshCw,
  Search, Loader2, AlertCircle, Download, Filter, MoreVertical, Book,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { classPaymentsApi, ClassPaymentSubmissionDetail } from '@/api/classPayments.api';
import { getImageUrl, safeOpenUrl } from '@/utils/imageUrlHelper';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';

interface VerificationDialogState {
  submissionId: string;
  studentName: string;
  amount: string;
  status: 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED' | null;
  notes: string;
  rejectionReason: string;
}

const ClassPaymentSubmissionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { selectedInstitute, selectedClass } = useAuth();
  const [searchParams] = useSearchParams();

  // Query params
  const paymentId = searchParams.get('paymentId') || '';
  const paymentTitle = searchParams.get('paymentTitle') || 'Payment';
  const instituteId = searchParams.get('instituteId') || selectedInstitute?.id || '';
  const classId = searchParams.get('classId') || selectedClass?.id || '';
  const type = searchParams.get('type') || 'class';

  // State
  const [submissions, setSubmissions] = useState<ClassPaymentSubmissionDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [verifyDialog, setVerifyDialog] = useState<VerificationDialogState | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Load submissions
  const loadSubmissions = async () => {
    if (!instituteId || !classId || !paymentId || type !== 'class') return;
    setLoading(true);
    try {
      const res = await classPaymentsApi.getClassPaymentSubmissions(
        instituteId,
        classId,
        paymentId,
        { page: page + 1, limit: rowsPerPage }
      );
      setSubmissions(res.data || []);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to load submissions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [instituteId, classId, paymentId, page, rowsPerPage]);

  // Filter submissions
  const filteredSubmissions = useMemo(() => {
    let filtered = submissions;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        s => (s.studentName || '').toLowerCase().includes(query) ||
             (s.nameWithInitials || '').toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    return filtered;
  }, [submissions, searchQuery, statusFilter]);

  // Handle verification
  const handleVerify = async () => {
    if (!verifyDialog || verifyDialog.status === null) return;

    setVerifying(true);
    try {
      if (verifyDialog.status === 'REJECTED') {
        await classPaymentsApi.rejectClassPaymentSubmission(
          instituteId,
          classId,
          verifyDialog.submissionId,
          {
            rejectionReason: verifyDialog.rejectionReason,
            notes: verifyDialog.notes,
          }
        );
        toast({
          title: 'Success',
          description: `Submission rejected successfully`,
        });
      } else {
        await classPaymentsApi.verifyClassPaymentSubmission(
          instituteId,
          classId,
          verifyDialog.submissionId,
          {
            status: verifyDialog.status as 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED',
            notes: verifyDialog.notes,
          }
        );
        toast({
          title: 'Success',
          description: `Submission verified as ${verifyDialog.status}`,
        });
      }
      setVerifyDialog(null);
      loadSubmissions();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Verification failed',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  // Status badge
  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'VERIFIED') return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3" />Verified</Badge>;
    if (status === 'HALF_VERIFIED') return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200"><CheckCircle className="h-3 w-3" />Half Paid</Badge>;
    if (status === 'QUARTER_VERIFIED') return <Badge className="bg-teal-100 text-teal-800 border-teal-200"><CheckCircle className="h-3 w-3" />Quarter Paid</Badge>;
    if (status === 'PENDING') return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="h-3 w-3" />Pending</Badge>;
    if (status === 'REJECTED') return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3" />Rejected</Badge>;
    return <Badge variant="outline">Unknown</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Book className="h-8 w-8" />
                {paymentTitle}
              </h1>
              <p className="text-gray-600 text-sm mt-1">View and verify payment submissions</p>
            </div>
          </div>
          <Button onClick={loadSubmissions} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 flex items-end gap-4">
            <div className="flex-1">
              <Label className="text-xs mb-2 block">Search Student</Label>
              <Input
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                {...({ icon: <Search className="h-4 w-4" /> } as any)}
              />
            </div>
            <div className="w-40">
              <Label className="text-xs mb-2 block">Status Filter</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="VERIFIED">Verified</SelectItem>
                  <SelectItem value="HALF_VERIFIED">Half Verified</SelectItem>
                  <SelectItem value="QUARTER_VERIFIED">Quarter Verified</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Submissions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Payment Submissions ({filteredSubmissions.length})</span>
              <span className="text-sm font-normal text-gray-600">
                Page {page + 1} of {Math.ceil(filteredSubmissions.length / rowsPerPage)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No submissions found</p>
              </div>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead className="bg-gray-50">
                    <TableRow>
                      <TableCell className="font-semibold">Student</TableCell>
                      <TableCell className="font-semibold">Amount</TableCell>
                      <TableCell className="font-semibold">Transaction ID</TableCell>
                      <TableCell className="font-semibold">Payment Date</TableCell>
                      <TableCell className="font-semibold">Status</TableCell>
                      <TableCell className="font-semibold">Submitted At</TableCell>
                      <TableCell className="font-semibold text-right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSubmissions.map((sub) => (
                      <TableRow key={sub.id} hover>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img
                              src={getImageUrl(sub.image)}
                              alt={sub.studentName}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                            <div>
                              <p className="font-medium">{sub.studentName}</p>
                              <p className="text-xs text-gray-600">{sub.nameWithInitials}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">Rs. {sub.submittedAmount}</span>
                        </TableCell>
                        <TableCell className="text-sm">{sub.transactionId || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(sub.paymentDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={sub.status} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(sub.uploadedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setVerifyDialog({
                              submissionId: sub.id,
                              studentName: sub.studentName,
                              amount: sub.submittedAmount,
                              status: null,
                              notes: '',
                              rejectionReason: '',
                            })}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Verify
                          </Button>
                          {sub.receiptUrl && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => safeOpenUrl(sub.receiptUrl)}
                              className="ml-2"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50]}
                  component="div"
                  count={filteredSubmissions.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
                />
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Verification Dialog */}
        {verifyDialog && (
          <Dialog open={!!verifyDialog} onOpenChange={() => setVerifyDialog(null)} routeName="verify-class-payment-popup">
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Verify Payment Submission
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs mb-2 block">Student</Label>
                  <div className="p-2 bg-gray-100 rounded text-sm">{verifyDialog.studentName}</div>
                </div>

                <div>
                  <Label className="text-xs mb-2 block">Amount Submitted</Label>
                  <div className="p-2 bg-gray-100 rounded text-sm font-semibold">Rs. {verifyDialog.amount}</div>
                </div>

                <div>
                  <Label className="mb-3 block">Verification Status *</Label>
                  <Select
                    value={verifyDialog.status || ''}
                    onValueChange={(value) =>
                      setVerifyDialog({
                        ...verifyDialog,
                        status: (value === 'REJECTED' ? 'REJECTED' : value) as any,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VERIFIED">✓ Fully Verified (100%)</SelectItem>
                      <SelectItem value="HALF_VERIFIED">½ Half Verified (50%)</SelectItem>
                      <SelectItem value="QUARTER_VERIFIED">¼ Quarter Verified (25%)</SelectItem>
                      <SelectItem value="REJECTED">✗ Reject Submission</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {verifyDialog.status === 'REJECTED' && (
                  <div>
                    <Label htmlFor="rejection-reason" className="text-xs mb-2 block">Rejection Reason *</Label>
                    <Input
                      id="rejection-reason"
                      placeholder="Why are you rejecting this submission?"
                      value={verifyDialog.rejectionReason}
                      onChange={(e) =>
                        setVerifyDialog({ ...verifyDialog, rejectionReason: e.target.value })
                      }
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="notes" className="text-xs mb-2 block">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add notes about this verification..."
                    value={verifyDialog.notes}
                    onChange={(e) => setVerifyDialog({ ...verifyDialog, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setVerifyDialog(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleVerify}
                  disabled={
                    verifying ||
                    !verifyDialog.status ||
                    (verifyDialog.status === 'REJECTED' && !verifyDialog.rejectionReason)
                  }
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {verifyDialog.status === 'REJECTED' ? 'Reject' : 'Verify'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppLayout>
  );
};

export default ClassPaymentSubmissionsPage;
