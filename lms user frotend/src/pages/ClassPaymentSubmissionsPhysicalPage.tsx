import React, { useState, useEffect } from 'react';
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
  ArrowLeft, Search, RefreshCw, CheckCircle, Loader2, User, Phone, Mail,
  XCircle, Clock, AlertCircle, Upload, DollarSign, Calendar, FileUp, BookOpen,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { classPaymentsApi, StudentPaymentDetail } from '@/api/classPayments.api';
import { getImageUrl } from '@/utils/imageUrlHelper';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';

interface SubmitPaymentDialogState {
  studentId: string;
  studentName: string;
  paymentAmount: string;
  status?: string;
  submittedAmount: string;
  paymentDate: string;
  transactionId: string;
  notes: string;
  receiptFile: File | null;
}

interface VerifyPaymentDialogState {
  studentId: string;
  studentName: string;
  paymentAmount: string;
  verificationStatus: 'full' | 'half' | 'quarter';
  verificationAmount: string;
  verificationDate: string;
  notes: string;
}

const ClassPaymentSubmissionsPhysicalPage: React.FC = () => {
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
  const [students, setStudents] = useState<StudentPaymentDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [submitDialog, setSubmitDialog] = useState<SubmitPaymentDialogState | null>(null);
  const [verifyDialog, setVerifyDialog] = useState<VerifyPaymentDialogState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  // Load students with payment details
  const loadStudents = async (forceRefresh: boolean = false) => {
    if (!instituteId || !classId || !paymentId || type !== 'class') return;
    setLoading(true);
    try {
      const res = await classPaymentsApi.getStudentsForPaymentWithDetails(
        instituteId,
        classId,
        paymentId,
        { page: page + 1, limit: rowsPerPage },
        forceRefresh,
      );
      setStudents(res.data || []);
      setSummary(res.summary);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to load students',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [instituteId, classId, paymentId, page, rowsPerPage]);

  // Filter students
  const filteredStudents = students.filter(s => {
    const matchSearch = !searchQuery ||
      (s.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.phone?.includes(searchQuery) ||
      (s.email || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = statusFilter === 'all' || s.submissionStatus === statusFilter;

    return matchSearch && matchStatus;
  });

  // Handle submission
  const handleSubmitPayment = async () => {
    if (!submitDialog) return;

    setSubmitting(true);
    try {
      await classPaymentsApi.submitClassPayment(
        instituteId,
        classId,
        paymentId,
        {
          paymentDate: submitDialog.paymentDate,
          submittedAmount: parseFloat(submitDialog.submittedAmount),
          transactionId: submitDialog.transactionId,
          notes: submitDialog.notes,
          receiptFile: submitDialog.receiptFile || undefined,
        }
      );
      toast({
        title: 'Success',
        description: `Payment submitted for ${submitDialog.studentName}`,
      });
      setSubmitDialog(null);
      await loadStudents(true);  // Force refresh after submission
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to submit payment',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle verification
  const handleVerifyPayment = async () => {
    if (!verifyDialog) return;

    setVerifying(true);
    try {
      const tierMap = {
        'full': 'full',
        'half': 'half',
        'quarter': 'quarter',
      };

      await classPaymentsApi.adminVerifyStudentClassPayment(
        paymentId,
        verifyDialog.studentId,
        {
          amount: parseFloat(verifyDialog.verificationAmount),
          date: verifyDialog.verificationDate,
          notes: verifyDialog.notes,
          paymentTier: tierMap[verifyDialog.verificationStatus as keyof typeof tierMap] as any,
        }
      );
      toast({
        title: 'Success',
        description: `Payment verified for ${verifyDialog.studentName}`,
      });
      setVerifyDialog(null);
      await loadStudents(true);  // Force refresh after verification
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to verify payment',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  // Status badge
  const StatusBadge = ({ status }: { status?: string }) => {
    if (!status) return <Badge variant="outline" className="text-gray-600"><AlertCircle className="h-3 w-3" />Not Submitted</Badge>;
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
                <BookOpen className="h-8 w-8" />
                {paymentTitle} - Physical Collection
              </h1>
              <p className="text-gray-600 text-sm mt-1">Collect payments from class students</p>
            </div>
          </div>
          <Button onClick={() => loadStudents()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-gray-600 text-sm">Total Students</p>
                  <p className="text-2xl font-bold">{summary.totalStudents}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-gray-600 text-sm text-green-600">Verified</p>
                  <p className="text-2xl font-bold text-green-600">{summary.verified}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-gray-600 text-sm text-emerald-600">Half Paid</p>
                  <p className="text-2xl font-bold text-emerald-600">{summary.halfVerified}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-gray-600 text-sm text-teal-600">Quarter Paid</p>
                  <p className="text-2xl font-bold text-teal-600">{summary.quarterVerified}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-gray-600 text-sm text-yellow-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{summary.pending}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-gray-600 text-sm text-red-600">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{summary.rejected}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 flex items-end gap-4">
            <div className="flex-1">
              <Label className="text-xs mb-2 block">Search Student</Label>
              <div className="relative">
                <Input
                  placeholder="Search by name, phone, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="h-4 w-4 absolute right-3 top-3 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="w-40">
              <Label className="text-xs mb-2 block">Payment Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="">Not Submitted</SelectItem>
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

        {/* Students Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Class Students ({filteredStudents.length})</span>
              <span className="text-sm font-normal text-gray-600">
                Page {page + 1}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No students found</p>
              </div>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead className="bg-gray-50">
                    <TableRow>
                      <TableCell className="font-semibold">Student Details</TableCell>
                      <TableCell className="font-semibold">Contact</TableCell>
                      <TableCell className="font-semibold">Amount Due</TableCell>
                      <TableCell className="font-semibold">Payment Status</TableCell>
                      <TableCell className="font-semibold">Submitted Amount</TableCell>
                      <TableCell className="font-semibold">Notes</TableCell>
                      <TableCell className="font-semibold text-right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.studentId} hover>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img
                              src={getImageUrl(student.image)}
                              alt={student.studentName}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                            <div>
                              <p className="font-medium">{student.studentName}</p>
                              <p className="text-xs text-gray-600">{student.nameWithInitials}</p>
                              <p className="text-xs text-gray-500">ID: {student.instituteUserId}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            {student.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3 text-gray-400" />
                                {student.phone}
                              </div>
                            )}
                            {student.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3 text-gray-400" />
                                <span className="truncate">{student.email}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-lg">Rs. {student.paymentAmount}</span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={student.submissionStatus} />
                        </TableCell>
                        <TableCell>
                          {student.submittedAmount ? (
                            <div>
                              <p className="font-semibold">Rs. {student.submittedAmount}</p>
                              <p className="text-xs text-gray-600">
                                {new Date(student.submittedDate!).toLocaleDateString()}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs">
                          {student.notes ? (
                            <p className="line-clamp-2">{student.notes}</p>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setVerifyDialog({
                                studentId: student.studentId,
                                studentName: student.studentName,
                                paymentAmount: student.paymentAmount,
                                verificationStatus: 'full',
                                verificationAmount: student.paymentAmount,
                                verificationDate: new Date().toISOString().split('T')[0],
                                notes: '',
                              })}
                              disabled={student.submissionStatus === 'VERIFIED'}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSubmitDialog({
                                studentId: student.studentId,
                                studentName: student.studentName,
                                paymentAmount: student.paymentAmount,
                                status: student.submissionStatus,
                                submittedAmount: student.submittedAmount || '',
                                paymentDate: new Date().toISOString().split('T')[0],
                                transactionId: '',
                                notes: '',
                                receiptFile: null,
                              })}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              Submit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50]}
                  component="div"
                  count={students.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
                />
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Submit Payment Dialog */}
        {submitDialog && (
          <Dialog open={!!submitDialog} onOpenChange={() => setSubmitDialog(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Submit Payment
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="bg-blue-50 p-3 rounded">
                  <p className="font-medium">{submitDialog.studentName}</p>
                  <p className="text-sm text-gray-600">Amount Due: Rs. {submitDialog.paymentAmount}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="payment-date" className="text-xs mb-2 block">Payment Date *</Label>
                    <Input
                      id="payment-date"
                      type="date"
                      value={submitDialog.paymentDate}
                      onChange={(e) =>
                        setSubmitDialog({ ...submitDialog, paymentDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount" className="text-xs mb-2 block">Amount Submitted (Rs.) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      value={submitDialog.submittedAmount}
                      onChange={(e) =>
                        setSubmitDialog({ ...submitDialog, submittedAmount: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="transaction-id" className="text-xs mb-2 block">Transaction ID</Label>
                  <Input
                    id="transaction-id"
                    placeholder="e.g., TXN123456"
                    value={submitDialog.transactionId}
                    onChange={(e) =>
                      setSubmitDialog({ ...submitDialog, transactionId: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="receipt-file" className="text-xs mb-2 block">Receipt / Proof (PDF, Image)</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    <FileUp className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <label htmlFor="file-input" className="cursor-pointer">
                      <span className="text-blue-600 hover:underline">Click to upload</span>
                      <p className="text-xs text-gray-600">or drag and drop</p>
                      <p className="text-xs text-gray-500">PDF, PNG, JPG up to 10MB</p>
                    </label>
                    <input
                      id="file-input"
                      type="file"
                      hidden
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && file.size > 10 * 1024 * 1024) {
                          toast({
                            title: 'Error',
                            description: 'File size must be less than 10MB',
                            variant: 'destructive',
                          });
                          return;
                        }
                        setSubmitDialog({ ...submitDialog, receiptFile: file || null });
                      }}
                    />
                    {submitDialog.receiptFile && (
                      <p className="text-xs text-green-600 mt-2">
                        ✓ {submitDialog.receiptFile.name}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes" className="text-xs mb-2 block">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes about this payment..."
                    value={submitDialog.notes}
                    onChange={(e) => setSubmitDialog({ ...submitDialog, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSubmitDialog(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitPayment}
                  disabled={
                    submitting ||
                    !submitDialog.paymentDate ||
                    !submitDialog.submittedAmount
                  }
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Submit Payment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Verify Payment Dialog */}
        {verifyDialog && (
          <Dialog open={!!verifyDialog} onOpenChange={() => setVerifyDialog(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Verify Payment
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="bg-green-50 p-3 rounded">
                  <p className="font-medium">{verifyDialog.studentName}</p>
                  <p className="text-sm text-gray-600">Amount Due: Rs. {verifyDialog.paymentAmount}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="verify-date" className="text-xs mb-2 block">Verification Date *</Label>
                    <Input
                      id="verify-date"
                      type="date"
                      value={verifyDialog.verificationDate}
                      onChange={(e) =>
                        setVerifyDialog({ ...verifyDialog, verificationDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="verify-amount" className="text-xs mb-2 block">Verified Amount (Rs.) *</Label>
                    <Input
                      id="verify-amount"
                      type="number"
                      placeholder="0.00"
                      value={verifyDialog.verificationAmount}
                      onChange={(e) =>
                        setVerifyDialog({ ...verifyDialog, verificationAmount: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="payment-tier" className="text-xs mb-2 block">Payment Tier *</Label>
                  <Select
                    value={verifyDialog.verificationStatus}
                    onValueChange={(value) =>
                      setVerifyDialog({
                        ...verifyDialog,
                        verificationStatus: value as 'full' | 'half' | 'quarter',
                        verificationAmount: value === 'full'
                          ? verifyDialog.paymentAmount
                          : value === 'half'
                          ? (parseFloat(verifyDialog.paymentAmount) / 2).toString()
                          : (parseFloat(verifyDialog.paymentAmount) / 4).toString(),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Payment</SelectItem>
                      <SelectItem value="half">Half Payment (50%)</SelectItem>
                      <SelectItem value="quarter">Quarter Payment (25%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="verify-notes" className="text-xs mb-2 block">Notes</Label>
                  <Textarea
                    id="verify-notes"
                    placeholder="Add any notes about this verification..."
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
                  onClick={handleVerifyPayment}
                  disabled={
                    verifying ||
                    !verifyDialog.verificationDate ||
                    !verifyDialog.verificationAmount
                  }
                  className="bg-green-600 hover:bg-green-700"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Verify Payment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppLayout>
  );
};

export default ClassPaymentSubmissionsPhysicalPage;
