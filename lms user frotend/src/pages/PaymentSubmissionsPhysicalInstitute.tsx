import React, { useState, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ArrowLeft, Search, CheckCircle, Loader2, User,
  Banknote, XCircle, Clock, AlertCircle, RefreshCw,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';

//  Types
interface StudentInfo {
  uuid: string;
  nameWithInitials: string;
  image?: string;
  instituteUserId: string;
}

interface PaymentInfo {
  id: string;
  paymentType: string;
  description: string;
  amount: number;
  dueDate: string;
  status: string;
}

interface PaymentHistoryItem {
  status: 'VERIFIED' | 'PENDING' | 'REJECTED' | string;
  amount: number;
  date: string;
  note?: string;
}

interface ApiSearchResult {
  success: boolean;
  message: string;
  student: StudentInfo;
  payment: PaymentInfo;
  paymentHistory: PaymentHistoryItem[];
}

interface SearchResult {
  student: StudentInfo;
  payment: PaymentInfo;
  paymentHistory: PaymentHistoryItem[];
}

interface RecordDialogState {
  amount: string;
  date: string;
  notes: string;
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'VERIFIED':
      return <Badge className="bg-green-100 text-green-800 border-green-200 gap-1"><CheckCircle className="h-3 w-3" />Verified</Badge>;
    case 'PENDING':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
    case 'REJECTED':
      return <Badge className="bg-red-100 text-red-800 border-red-200 gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
    default:
      return <Badge variant="outline" className="text-gray-600 gap-1"><AlertCircle className="h-3 w-3" />Not Submitted</Badge>;
  }
};

//  Component 
const PaymentSubmissionsPhysicalInstitute: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { paymentId } = useParams<{ paymentId: string }>();
  const { selectedInstitute } = useAuth();

  const [studentIdInput, setStudentIdInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [recordDialog, setRecordDialog] = useState<RecordDialogState | null>(null);
  const [recording, setRecording] = useState(false);

  const instituteId = selectedInstitute?.id;

  // Cache: key = `${instituteId}-${studentId}-${paymentId}`
  const searchCache = useRef<Record<string, SearchResult>>({});

  // Get the first payment history item (most recent)
  const paymentHistoryForThisPayment = searchResult?.paymentHistory?.[0] ?? null;

  const alreadyVerified = paymentHistoryForThisPayment?.status === 'VERIFIED';
  const alreadyRejected = paymentHistoryForThisPayment?.status === 'REJECTED';
  const canRecord = !alreadyVerified && !alreadyRejected;

  const handleSearch = async (bypassCache = false) => {
    if (!studentIdInput.trim()) {
      toast({ title: 'Error', description: 'Please enter a student ID.', variant: 'destructive' });
      return;
    }
    if (!instituteId) {
      toast({ title: 'Error', description: 'No institute selected.', variant: 'destructive' });
      return;
    }

    const cacheKey = `${instituteId}-${studentIdInput.trim()}-${paymentId}`;

    // Use cache unless bypassed (e.g. after verify)
    if (!bypassCache && searchCache.current[cacheKey]) {
      setSearchResult(searchCache.current[cacheKey]);
      setHasSearched(true);
      return;
    }

    setSearching(true);
    setSearchResult(null);
    setHasSearched(true);
    try {
      const params: Record<string, any> = { studentId: studentIdInput.trim(), paymentId };
      // Add cache-busting param on force refresh to prevent browser caching stale GET response
      if (bypassCache) params._t = Date.now();
      const res: ApiSearchResult = await apiClient.get(
        `/institute-payments/institute/${instituteId}/search-student`,
        params
      );

      if (!res.success || !res.student) {
        throw new Error('Student data not found in response');
      }

      const searchData: SearchResult = {
        student: res.student,
        payment: res.payment,
        paymentHistory: res.paymentHistory || []
      };

      // Store in cache
      searchCache.current[cacheKey] = searchData;

      setSearchResult(searchData);
      if (!bypassCache) {
        toast({ title: 'Success', description: res.message || 'Student found successfully.' });
      }
    } catch (err: any) {
      if (err?.status === 404) {
        toast({ title: 'Not Found', description: 'Student not found or not enrolled in this institute.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: err.message || 'Failed to search student.', variant: 'destructive' });
      }
    } finally {
      setSearching(false);
    }
  };

  const handleRecord = async () => {
    if (!recordDialog) return;
    if (!recordDialog.amount || isNaN(Number(recordDialog.amount)) || Number(recordDialog.amount) <= 0) {
      toast({ title: 'Error', description: 'Enter a valid amount.', variant: 'destructive' });
      return;
    }
    if (!instituteId || !paymentId || !searchResult?.student?.uuid) return;
    setRecording(true);
    try {
      await apiClient.post(
        `/institute-payments/institute/${instituteId}/payment/${paymentId}/admin-verify-student/${searchResult.student.uuid}`,
        { amount: Number(recordDialog.amount), date: recordDialog.date, notes: recordDialog.notes || undefined }
      );
      toast({ title: 'Success', description: `Payment recorded for ${searchResult.student.nameWithInitials}.` });
      setRecordDialog(null);
      // Refresh with fresh API call (bypass cache) to show updated status
      await handleSearch(true);
    } catch (err: any) {
      const msg = err?.status === 409
        ? 'This student already has a verified payment recorded.'
        : err.message || 'Failed to record payment.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setRecording(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4 px-2 sm:px-4 py-3 sm:py-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)} size="sm" className="shrink-0 px-2">
            <ArrowLeft className="h-4 w-4" /><span className="ml-1 hidden sm:inline text-xs">Back</span>
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <Banknote className="h-5 w-5 text-green-600 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">Institute Physical Payment</h1>
              <p className="text-xs text-muted-foreground truncate">
                Payment ID: {paymentId} {selectedInstitute ? ` ${selectedInstitute.name}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />Search Student
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter student ID"
                  className="pl-9 text-sm"
                  value={studentIdInput}
                  onChange={e => setStudentIdInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={() => handleSearch()} disabled={searching} size="sm" className="shrink-0">
                {searching
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Search className="h-4 w-4" />}
                <span className="ml-1.5 hidden sm:inline">Search</span>
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Enter the student&apos;s user ID to look up their payment status for this payment.</p>
          </CardContent>
        </Card>

        {/* Search Result */}
        {hasSearched && !searching && searchResult && (
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />Student Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-4">
              {/* Student Profile */}
              <div className="flex items-center gap-3">
                {searchResult.student.image ? (
                  <img
                    src={searchResult.student.image}
                    alt={searchResult.student.nameWithInitials}
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-border shrink-0"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border shrink-0">
                    <span className="text-lg font-bold text-primary">
                      {(searchResult.student.nameWithInitials?.[0] ?? '?').toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{searchResult.student.nameWithInitials}</p>
                  <p className="text-xs text-muted-foreground">Student ID: {searchResult.student.uuid}</p>
                  <p className="text-xs text-muted-foreground">Institute ID: {searchResult.student.instituteUserId}</p>
                </div>
              </div>

              {/* Payment Info */}
              {searchResult.payment && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Payment Details</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Description</span>
                      <span className="text-xs font-medium">{searchResult.payment.description}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Amount</span>
                      <span className="text-xs font-medium">Rs {Number(searchResult.payment.amount).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Due Date</span>
                      <span className="text-xs">{new Date(searchResult.payment.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Type</span>
                      <Badge variant="outline" className="text-[10px]">{searchResult.payment.paymentType}</Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Status for this payment */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Payment Submission Status</p>
                {paymentHistoryForThisPayment ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Status</span>
                      {statusBadge(paymentHistoryForThisPayment.status)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Amount</span>
                      <span className="text-xs font-medium">Rs {Number(paymentHistoryForThisPayment.amount).toLocaleString()}</span>
                    </div>
                    {paymentHistoryForThisPayment.date && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Date</span>
                        <span className="text-xs">{new Date(paymentHistoryForThisPayment.date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {paymentHistoryForThisPayment.note && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs text-muted-foreground shrink-0">Notes</span>
                        <span className="text-xs text-right">{paymentHistoryForThisPayment.note}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No payment recorded for this payment yet.</p>
                )}
              </div>

              {/* Action */}
              {canRecord && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setRecordDialog({
                    amount: searchResult?.payment?.amount?.toString() || '',
                    date: new Date().toISOString().slice(0, 10),
                    notes: ''
                  })}
                >
                  <Banknote className="h-4 w-4 mr-2" />
                  {paymentHistoryForThisPayment ? 'Verify Payment' : 'Verify Payment'}
                </Button>
              )}
              {alreadyVerified && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  <p className="text-xs text-green-700 font-medium">Payment already verified for this student.</p>
                </div>
              )}
              {alreadyRejected && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <p className="text-xs text-red-700 font-medium">Payment has been rejected for this student.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* No result state */}
        {hasSearched && !searching && !searchResult && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <User className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No student found with that ID in this institute.</p>
              <Button variant="outline" size="sm" onClick={() => { setHasSearched(false); setStudentIdInput(''); }}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Clear & Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={!!recordDialog} onOpenChange={open => { if (!open) setRecordDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-5 w-5 text-green-600" />Verify Payment
            </DialogTitle>
          </DialogHeader>
          {searchResult && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-sm font-medium">{searchResult.student.nameWithInitials}</p>
                <p className="text-xs text-muted-foreground">Student ID: {searchResult.student.uuid}</p>
                <p className="text-xs text-muted-foreground">Institute ID: {searchResult.student.instituteUserId}</p>
              </div>
              {recordDialog && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Amount (Rs) *</Label>
                    <Input type="number" min={0} placeholder="e.g. 5000" value={recordDialog.amount}
                      onChange={e => setRecordDialog(d => d ? { ...d, amount: e.target.value } : d)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Payment Date</Label>
                    <Input type="date" value={recordDialog.date}
                      onChange={e => setRecordDialog(d => d ? { ...d, date: e.target.value } : d)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Notes (optional)</Label>
                    <Textarea placeholder="Receipt no., remarks" rows={2} value={recordDialog.notes}
                      onChange={e => setRecordDialog(d => d ? { ...d, notes: e.target.value } : d)} />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 pt-1">
            <Button variant="outline" onClick={() => setRecordDialog(null)} disabled={recording}>Cancel</Button>
            <Button onClick={handleRecord} disabled={recording} className="bg-green-600 hover:bg-green-700 text-white">
              {recording ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
              {recording ? 'Recording' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default PaymentSubmissionsPhysicalInstitute;