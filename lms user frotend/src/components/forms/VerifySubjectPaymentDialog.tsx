import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, User, Calendar, DollarSign, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SubjectPaymentSubmission } from '@/api/subjectPayments.api';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface VerifySubjectPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: SubjectPaymentSubmission | null;
  onVerify: (status: 'VERIFIED' | 'REJECTED', rejectionReason?: string, notes?: string) => Promise<void>;
}

const VerifySubjectPaymentDialog = ({ open, onOpenChange, submission, onVerify }: VerifySubjectPaymentDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'VERIFIED' | 'REJECTED'>('VERIFIED');
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submission) return;

    if (status === 'REJECTED' && !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Rejection reason is required when rejecting a submission",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await onVerify(status, rejectionReason || undefined, notes || undefined);
      
      // Reset form
      setStatus('VERIFIED');
      setRejectionReason('');
      setNotes('');
    } catch (error: any) {
      console.error('Failed to verify submission:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!submission) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} routeName="verify-subject-payment-dialog-popup">
      <DialogContent className="w-[95vw] max-w-3xl max-h-[93vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-base leading-tight">Verify Payment Submission</p>
              <p className="text-[13px] text-muted-foreground font-normal">Review payment evidence before approval</p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {/* Submission Details */}
        <div className="space-y-5 mb-6">
          <div>
            <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Submission Details <span className="flex-1 h-px bg-border/40" /></p>
            <div className="divide-y divide-border/40">
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Submitter</span>
                <span className="text-sm font-medium">{submission.username || 'Unknown User'}</span>
              </div>
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-sm font-semibold text-primary">Rs {submission.submittedAmount ? parseFloat(submission.submittedAmount.toString()).toLocaleString() : '0'}</span>
              </div>
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">User Type</span>
                <span className="text-sm font-medium">{submission.userType}</span>
              </div>
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Transaction ID</span>
                <span className="text-xs font-mono font-medium break-all">{submission.transactionId}</span>
              </div>
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Payment Date</span>
                <span className="text-sm font-medium">{new Date(submission.paymentDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Submitted</span>
                <span className="text-sm font-medium">{new Date(submission.uploadedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {submission.notes && (
            <div>
              <p className="text-[13px] text-muted-foreground mb-1.5">Notes</p>
              <p className="text-sm">{submission.notes}</p>
            </div>
          )}
          {submission.receiptUrl && (
            <div>
              <a 
                target="_blank"
                rel="noopener noreferrer"
                href={getImageUrl(submission.receiptUrl)}
                className="text-primary hover:underline text-sm font-medium"
              >
                View Receipt →
              </a>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="status">Verification Status</Label>
            <Select value={status} onValueChange={(value: 'VERIFIED' | 'REJECTED') => setStatus(value)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VERIFIED">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    Verify
                  </div>
                </SelectItem>
                <SelectItem value="REJECTED">
                  <div className="flex items-center">
                    <XCircle className="h-4 w-4 mr-2 text-red-500" />
                    Reject
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === 'REJECTED' && (
            <div>
              <Label htmlFor="rejectionReason">
                Rejection Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejection"
                rows={3}
                required
              />
            </div>
          )}

          <div>
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional comments or observations"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || (status === 'REJECTED' && !rejectionReason.trim())}
            >
              {loading ? 'Processing...' : status === 'VERIFIED' ? 'Verify Submission' : 'Reject Submission'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VerifySubjectPaymentDialog;
