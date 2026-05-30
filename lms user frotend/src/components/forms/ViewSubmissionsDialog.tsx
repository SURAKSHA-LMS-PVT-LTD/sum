import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, CheckCircle, AlertCircle, Calendar, DollarSign, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { institutePaymentsApi, PaymentSubmissionsResponse, PaymentSubmission, InstitutePayment } from '@/api/institutePayments.api';
import { useToast } from '@/hooks/use-toast';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface ViewSubmissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: InstitutePayment | null;
  instituteId: string;
}

const ViewSubmissionsDialog = ({ open, onOpenChange, payment, instituteId }: ViewSubmissionsDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submissionsData, setSubmissionsData] = useState<PaymentSubmissionsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSubmissions = async () => {
    if (!payment) return;
    
    setLoading(true);
    try {
      const response = await institutePaymentsApi.getPaymentSubmissions(
        instituteId, 
        payment.id, 
        { page: 1, limit: 50, sortBy: 'submissionDate', sortOrder: 'DESC' }
      );
      setSubmissionsData(response);
    } catch (error: any) {
      console.error('Failed to load submissions:', error);
      toast({
        title: "Error",
        description: "Failed to load payment submissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Load submissions when dialog opens and payment is available
  useEffect(() => {
    if (open && payment) {
      loadSubmissions();
    }
  }, [open, payment]);

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
        return <CheckCircle className="h-5 w-5" />;
      case 'PENDING':
        return <AlertCircle className="h-4 w-4" />;
      case 'REJECTED':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} routeName="view-submissions-dialog-popup">
      <DialogContent className="max-w-4xl max-h-[95vh]">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-bold text-xl leading-tight">Payment Submissions</p>
              {payment && (
                <p className="text-sm text-muted-foreground font-normal mt-0.5">{payment.paymentType}</p>
              )}
            </div>
            <Button
              onClick={loadSubmissions}
              disabled={loading}
              variant="outline"
              size="sm"
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {payment && (
          <div className="divide-y divide-border/40">
            <div className="flex items-center justify-between py-3.5">
              <span className="text-sm text-muted-foreground flex items-center gap-2.5"><DollarSign className="h-5 w-5" />Amount</span>
              <span className="text-lg font-bold text-primary">Rs {payment.amount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <span className="text-sm text-muted-foreground flex items-center gap-2.5"><Calendar className="h-5 w-5" />Due Date</span>
              <span className="text-sm font-medium">{new Date(payment.dueDate).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <span className="text-sm text-muted-foreground flex items-center gap-2.5"><FileText className="h-5 w-5" />Type</span>
              <span className="text-sm font-medium">{payment.paymentType}</span>
            </div>
          </div>
        )}

        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-5">
            {/* Summary Stats */}
            {submissionsData && (
              <div className="text-sm text-muted-foreground">
                {submissionsData.data.pagination.totalItems} submissions · {submissionsData.data.submissions.filter(s => s.status === 'VERIFIED').length} verified · {submissionsData.data.submissions.filter(s => s.status === 'PENDING').length} pending
              </div>
            )}

            {/* Submissions List */}
            {!submissionsData ? (
              <div className="text-center py-16">
                <FileText className="h-14 w-14 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">
                  {loading ? 'Loading payment submissions...' : 'Click refresh to load submissions'}
                </p>
              </div>
            ) : submissionsData.data.submissions.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="h-14 w-14 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">No submissions found for this payment yet.</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Submissions <span className="flex-1 h-px bg-border/40" /></p>
                <div className="space-y-4">
                  {submissionsData.data.submissions.map((submission) => (
                    <div key={submission.id} className="rounded-xl border border-border/40 overflow-hidden">
                      {/* Header row */}
                      <div className="flex items-center justify-between px-5 py-3.5 bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Badge className={`px-3 py-1.5 text-sm font-semibold flex items-center gap-2 ${getStatusColor(submission.status)}`}>
                            {getStatusIcon(submission.status)}
                            {submission.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">by <span className="font-medium text-foreground">{submission.username}</span></span>
                        </div>
                        <span className="text-lg font-bold text-primary">Rs {submission.submittedAmount.toLocaleString()}</span>
                      </div>

                      {/* Details rows */}
                      <div className="divide-y divide-border/40">
                        <div className="flex items-center justify-between px-5 py-3">
                          <span className="text-sm text-muted-foreground flex items-center gap-2.5"><DollarSign className="h-5 w-5" />Transaction</span>
                          <span className="text-sm font-mono font-medium">{submission.transactionId}</span>
                        </div>
                        <div className="flex items-center justify-between px-5 py-3">
                          <span className="text-sm text-muted-foreground flex items-center gap-2.5"><FileText className="h-5 w-5" />User Type</span>
                          <span className="text-sm font-medium">{submission.userType}</span>
                        </div>
                        <div className="flex items-center justify-between px-5 py-3">
                          <span className="text-sm text-muted-foreground flex items-center gap-2.5"><Calendar className="h-5 w-5" />Payment Date</span>
                          <span className="text-sm font-medium">{new Date(submission.paymentDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center justify-between px-5 py-3">
                          <span className="text-sm text-muted-foreground flex items-center gap-2.5"><Calendar className="h-5 w-5" />Uploaded</span>
                          <span className="text-sm font-medium">{new Date(submission.uploadedAt).toLocaleDateString()}</span>
                        </div>
                        {submission.verifiedAt && (
                          <div className="flex items-center justify-between px-5 py-3">
                            <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2.5"><CheckCircle className="h-5 w-5" />Verified</span>
                            <span className="text-sm font-medium text-green-700 dark:text-green-300">{new Date(submission.verifiedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      {submission.notes && (
                        <div className="px-5 py-3.5 border-t border-border/40">
                          <p className="text-[13px] text-muted-foreground mb-1.5">Notes</p>
                          <p className="text-base leading-relaxed">{submission.notes}</p>
                        </div>
                      )}

                      {submission.rejectionReason && (
                        <div className="px-5 py-3.5 border-t border-border/40 bg-red-50/50 dark:bg-red-950/20">
                          <p className="text-[13px] text-red-600 dark:text-red-400 mb-1.5">Rejection Reason</p>
                          <p className="text-base leading-relaxed text-red-700 dark:text-red-300">{submission.rejectionReason}</p>
                        </div>
                      )}

                      {submission.receiptUrl && (
                        <div className="px-5 py-3 border-t border-border/40">
                          <button
                            onClick={() => window.open(getImageUrl(submission.receiptUrl), '_blank')}
                            className="text-sm text-primary hover:underline font-medium"
                          >
                            View Receipt →
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ViewSubmissionsDialog;