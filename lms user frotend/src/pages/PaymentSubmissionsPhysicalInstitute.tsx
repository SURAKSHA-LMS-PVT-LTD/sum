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
  const base = "gap-1.5 px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider text-[10px] border";
  switch (status) {
    case 'VERIFIED':
      return <Badge className={`${base} bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800`}><CheckCircle className="h-3 w-3" />Verified</Badge>;
    case 'PENDING':
      return <Badge className={`${base} bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800`}><Clock className="h-3 w-3" />Pending</Badge>;
    case 'REJECTED':
      return <Badge className={`${base} bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800`}><XCircle className="h-3 w-3" />Rejected</Badge>;
    default:
      return <Badge variant="outline" className={`${base} text-muted-foreground`}><AlertCircle className="h-3 w-3" />Not Submitted</Badge>;
  }
};

const DetailRow: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({ label, children, mono }) => (
  <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border/40 last:border-0">
    <span className="text-[11px] uppercase tracking-[0.14em] font-medium text-muted-foreground/80">{label}</span>
    <span className={`text-sm font-medium text-foreground text-right ${mono ? 'font-mono' : ''}`}>{children}</span>
  </div>
);

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
      <div className="relative w-full min-h-full">
        {/* Ambient gradient backdrop */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-20 right-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="w-full px-4 sm:px-8 lg:px-12 py-6 sm:py-10 space-y-8">
        {/* Modern Hero Header */}
        <div className="relative w-full overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent backdrop-blur-sm shadow-xl shadow-primary/5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.15),transparent_60%)]" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 px-6 sm:px-10 py-8">
            <div className="flex items-start gap-4 min-w-0">
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                size="sm"
                className="shrink-0 h-10 w-10 p-0 rounded-xl bg-background/60 backdrop-blur hover:bg-background border border-border/50"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-primary mb-2">
                  Physical Payment · Verify
                </p>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
                  Payment Counter
                </h1>
                <p className="text-sm text-muted-foreground mt-2 truncate">
                  <span className="font-mono px-2 py-0.5 rounded-md bg-background/60 border border-border/50">#{paymentId}</span>
                  {selectedInstitute && <span className="ml-2">· {selectedInstitute.name}</span>}
                </p>
              </div>
            </div>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-2xl shadow-primary/40 ring-4 ring-background/60">
              <Banknote className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>

        {/* Search */}
        <Card className="border-border/50 shadow-lg shadow-primary/5 overflow-hidden bg-card/80 backdrop-blur-sm rounded-3xl">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Search className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs uppercase tracking-[0.18em] font-bold text-foreground">
                Look up Student
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  placeholder="Enter student User ID"
                  className="pl-11 h-14 text-base bg-muted/30 border-border/50 focus-visible:bg-background rounded-2xl"
                  value={studentIdInput}
                  onChange={e => setStudentIdInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button
                onClick={() => handleSearch()}
                disabled={searching}
                className="shrink-0 h-14 px-8 bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg shadow-primary/30 rounded-2xl text-base font-semibold"
              >
                {searching
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <Search className="h-5 w-5" />}
                <span className="ml-2 font-semibold">Search</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search Result */}
        {hasSearched && !searching && searchResult && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Student Hero Card */}
            <Card className="border-border/50 shadow-xl shadow-primary/5 overflow-hidden rounded-3xl bg-card/80 backdrop-blur-sm">
              <div className="relative bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 px-6 sm:px-10 py-8 border-b border-border/40">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,hsl(var(--primary)/0.18),transparent_55%)]" />
                <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-7">
                  {searchResult.student.image ? (
                    <img
                      src={searchResult.student.image}
                      alt={searchResult.student.nameWithInitials}
                      className="h-24 w-24 sm:h-28 sm:w-28 rounded-3xl object-cover ring-4 ring-background shadow-2xl shadow-primary/30 shrink-0"
                    />
                  ) : (
                    <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-3xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center ring-4 ring-background shadow-2xl shadow-primary/30 shrink-0">
                      <span className="text-4xl sm:text-5xl font-bold text-white">
                        {(searchResult.student.nameWithInitials?.[0] ?? '?').toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-primary mb-2">
                      Student Profile
                    </p>
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                      {searchResult.student.nameWithInitials}
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <div className="inline-flex items-center gap-2 rounded-xl bg-background/70 backdrop-blur px-3 py-1.5 border border-border/50">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">System ID</span>
                        <span className="font-mono text-xs font-bold text-foreground">{searchResult.student.uuid}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-xl bg-background/70 backdrop-blur px-3 py-1.5 border border-border/50">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Institute ID</span>
                        <span className="font-mono text-xs font-bold text-foreground">{searchResult.student.instituteUserId}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Payment Info */}
              {searchResult.payment && (
                <Card className="border-border/50 shadow-lg shadow-primary/5 rounded-3xl bg-card/80 backdrop-blur-sm overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
                        Payment Details
                      </p>
                      <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider">
                        {searchResult.payment.paymentType}
                      </Badge>
                    </div>
                    <div className="mb-4 pb-4 border-b border-border/40">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80 mb-1">Amount Due</p>
                      <p className="text-3xl font-bold text-foreground tracking-tight">
                        Rs <span className="text-primary">{Number(searchResult.payment.amount).toLocaleString()}</span>
                      </p>
                    </div>
                    <DetailRow label="Description">
                      <span className="block max-w-[180px] truncate" title={searchResult.payment.description}>
                        {searchResult.payment.description}
                      </span>
                    </DetailRow>
                    <DetailRow label="Due Date">
                      {new Date(searchResult.payment.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </DetailRow>
                  </CardContent>
                </Card>
              )}

              {/* Submission Status */}
              {(() => {
                const st = paymentHistoryForThisPayment?.status;
                const statusCard =
                  st === 'VERIFIED'
                    ? 'border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800'
                    : st === 'REJECTED'
                    ? 'border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800'
                    : st === 'PENDING'
                    ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800'
                    : 'border-border/60';
                const statusLabel =
                  st === 'VERIFIED'
                    ? 'text-green-700 dark:text-green-300'
                    : st === 'REJECTED'
                    ? 'text-rose-700 dark:text-rose-300'
                    : st === 'PENDING'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-muted-foreground';
                const statusAmount =
                  st === 'VERIFIED'
                    ? 'text-green-700 dark:text-green-300'
                    : st === 'REJECTED'
                    ? 'text-rose-700 dark:text-rose-300'
                    : st === 'PENDING'
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-foreground';
                return (
              <Card className={`shadow-lg shadow-primary/5 border rounded-3xl bg-card/80 backdrop-blur-sm overflow-hidden ${statusCard}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className={`text-[11px] uppercase tracking-[0.16em] font-semibold ${statusLabel}`}>
                      Submission Status
                    </p>
                    {paymentHistoryForThisPayment && statusBadge(paymentHistoryForThisPayment.status)}
                  </div>
                  {paymentHistoryForThisPayment ? (
                    <>
                      <div className="mb-4 pb-4 border-b border-border/40">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80 mb-1">Recorded Amount</p>
                        <p className={`text-3xl font-bold tracking-tight ${statusAmount}`}>
                          Rs <span>{Number(paymentHistoryForThisPayment.amount).toLocaleString()}</span>
                        </p>
                      </div>
                      {paymentHistoryForThisPayment.date && (
                        <DetailRow label="Date">
                          {new Date(paymentHistoryForThisPayment.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </DetailRow>
                      )}
                      {paymentHistoryForThisPayment.note && (
                        <div className="pt-2.5">
                          <p className="text-[11px] uppercase tracking-[0.14em] font-medium text-muted-foreground/80 mb-1.5">Notes</p>
                          <p className="text-sm text-foreground/90 leading-relaxed">{paymentHistoryForThisPayment.note}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <AlertCircle className="h-8 w-8 text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">No payment recorded yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
                );
              })()}
            </div>

            {/* Action */}
            {canRecord && (
              <Button
                size="lg"
                className="w-full h-16 text-lg font-bold bg-gradient-to-br from-primary via-primary to-primary/70 hover:from-primary/90 hover:to-primary/60 text-white shadow-2xl shadow-primary/40 rounded-2xl"
                onClick={() => setRecordDialog({
                  amount: searchResult?.payment?.amount?.toString() || '',
                  date: new Date().toISOString().slice(0, 10),
                  notes: ''
                })}
              >
                <Banknote className="h-5 w-5 mr-2" />
                Verify & Record Payment
              </Button>
            )}
            {alreadyVerified && (
              <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/40 dark:to-green-900/20 border border-green-300/70 dark:border-green-800/60 px-5 py-4 shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-green-600 flex items-center justify-center shrink-0 shadow-md shadow-green-600/30">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-900 dark:text-green-100">Payment Verified</p>
                  <p className="text-xs text-green-700/80 dark:text-green-300/80">This student's payment has already been recorded.</p>
                </div>
              </div>
            )}
            {alreadyRejected && (
              <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/40 dark:to-rose-900/20 border border-rose-200/60 dark:border-rose-800/60 px-5 py-4 shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-rose-500 flex items-center justify-center shrink-0 shadow-md shadow-rose-500/30">
                  <XCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">Payment Rejected</p>
                  <p className="text-xs text-rose-700/80 dark:text-rose-300/80">This student's payment was rejected.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No result state */}
        {hasSearched && !searching && !searchResult && (
          <Card className="border-dashed border-border/60">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted/40 flex items-center justify-center">
                <User className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">Student not found</p>
                <p className="text-sm text-muted-foreground mt-1">No student matches that ID in this institute.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setHasSearched(false); setStudentIdInput(''); }}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Try Again
              </Button>
            </CardContent>
          </Card>
        )}
        </div>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={!!recordDialog} onOpenChange={open => { if (!open) setRecordDialog(null); }} routeName="record-physical-payment-popup">
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-lg">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary flex items-center justify-center shadow-md shadow-primary/30">
                <Banknote className="h-5 w-5 text-white" />
              </div>
              Verify Payment
            </DialogTitle>
          </DialogHeader>
          {searchResult && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/40 px-4 py-3 border border-border/40">
                <p className="text-sm font-semibold text-foreground">{searchResult.student.nameWithInitials}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                  {searchResult.student.uuid} · {searchResult.student.instituteUserId}
                </p>
              </div>
              {recordDialog && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Amount (Rs) *</Label>
                    <Input type="number" min={0} placeholder="e.g. 5000" className="h-11 text-base font-medium" value={recordDialog.amount}
                      onChange={e => setRecordDialog(d => d ? { ...d, amount: e.target.value } : d)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Payment Date</Label>
                    <Input type="date" className="h-11" value={recordDialog.date}
                      onChange={e => setRecordDialog(d => d ? { ...d, date: e.target.value } : d)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">Notes (optional)</Label>
                    <Textarea placeholder="Receipt no., remarks…" rows={2} value={recordDialog.notes}
                      onChange={e => setRecordDialog(d => d ? { ...d, notes: e.target.value } : d)} />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setRecordDialog(null)} disabled={recording}>Cancel</Button>
            <Button onClick={handleRecord} disabled={recording} className="bg-gradient-to-br from-primary to-primary hover:from-primary/90 hover:to-primary/90 text-white shadow-md shadow-primary/30">
              {recording ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
              {recording ? 'Recording…' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default PaymentSubmissionsPhysicalInstitute;