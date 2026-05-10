import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Download, CheckCircle, Clock, XCircle, User, Calendar, FileText, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { subjectPaymentsApi, SubjectPaymentSubmission } from '@/api/subjectPayments.api';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface PaymentSubmissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
  paymentTitle: string;
}

const PaymentSubmissionsDialog: React.FC<PaymentSubmissionsDialogProps> = ({
  open,
  onOpenChange,
  paymentId,
  paymentTitle
}) => {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<SubjectPaymentSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadSubmissions = async () => {
    if (loading || loaded) return;
    
    setLoading(true);
    try {
      const response = await subjectPaymentsApi.getPaymentSubmissions(paymentId);
      setSubmissions(response.data);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <CheckCircle className="h-4 w-4" />;
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const handleDialogOpenChange = (newOpen: boolean) => {
    if (newOpen && !loaded) {
      loadSubmissions();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto w-full sm:w-[95vw]">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-base leading-tight">Payment Submissions</p>
              <p className="text-xs text-muted-foreground font-normal">{paymentTitle}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!loaded ? (
            <div className="flex justify-center py-8">
              <Button
                onClick={loadSubmissions}
                disabled={loading}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Eye className="h-3.5 w-3.5" />
                {loading ? 'Loading...' : 'Load Submissions'}
              </Button>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-10 px-4">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No submissions found for this payment yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <div key={submission.id} className="rounded-xl border bg-muted/20 p-3 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className={`px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1 ${getStatusColor(submission.status)}`}>
                        {getStatusIcon(submission.status)}
                        {submission.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-2.5 w-2.5" />
                        <span className="font-medium text-foreground">{submission.submitterName || 'Unknown'}</span>
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-primary/5 border border-primary/15 text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/60">Amount</span>
                      <span className="text-sm font-bold text-primary">Rs {parseFloat(submission.paymentAmount.toString()).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/60 border border-border/50 col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><DollarSign className="h-2.5 w-2.5" />Transaction</span>
                      <span className="text-xs font-mono font-medium break-all">{submission.transactionReference}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/60 border border-border/50">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><FileText className="h-2.5 w-2.5" />Method</span>
                      <span className="text-xs font-medium">{submission.paymentMethod}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/60 border border-border/50">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />Payment Date</span>
                      <span className="text-xs font-medium">{new Date(submission.paymentDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/60 border border-border/50">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />Submitted</span>
                      <span className="text-xs font-medium">{new Date(submission.createdAt).toLocaleDateString()}</span>
                    </div>
                    {submission.verifiedAt && (
                      <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle className="h-2.5 w-2.5" />Verified</span>
                        <span className="text-xs font-medium text-green-700 dark:text-green-300">{new Date(submission.verifiedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    {submission.verifierName && (
                      <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/60 border border-border/50">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><User className="h-2.5 w-2.5" />Verified By</span>
                        <span className="text-xs font-medium break-all">{submission.verifierName}</span>
                      </div>
                    )}
                  </div>

                  {submission.notes && (
                    <div className="p-2.5 rounded-lg bg-muted/60 border border-border/50">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
                      <p className="text-xs break-words">{submission.notes}</p>
                    </div>
                  )}

                  {submission.rejectionReason && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-800">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">Rejection Reason</p>
                      <p className="text-xs text-red-700 dark:text-red-300 break-words">{submission.rejectionReason}</p>
                    </div>
                  )}

                  {submission.receiptFileUrl && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(getImageUrl(submission.receiptFileUrl), '_blank')}
                        className="flex items-center gap-1.5 text-xs h-7"
                      >
                        <Download className="h-3 w-3" />
                        Download Receipt
                      </Button>
                      {submission.receiptFileName && (
                        <span className="text-xs text-muted-foreground truncate">{submission.receiptFileName}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentSubmissionsDialog;