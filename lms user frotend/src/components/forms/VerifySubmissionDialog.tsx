import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, FileText, CircleDollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { institutePaymentsApi, VerifySubmissionRequest, PaymentSubmission } from '@/api/institutePayments.api';

interface VerifySubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: PaymentSubmission | null;
  instituteId: string;
  onSuccess?: () => void;
}

const VerifySubmissionDialog = ({ open, onOpenChange, submission, instituteId, onSuccess }: VerifySubmissionDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<VerifySubmissionRequest>({
    status: 'VERIFIED',
    rejectionReason: '',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submission) return;

    if (formData.status === 'REJECTED' && !formData.rejectionReason) {
      toast({
        title: "Error",
        description: "Rejection reason is required when rejecting a submission",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Call the specific institute payment verification API
      const response = await institutePaymentsApi.verifySubmissionDetailed(instituteId, submission.id, {
        status: formData.status,
        rejectionReason: formData.rejectionReason || undefined,
        notes: formData.notes || undefined
      });
      
      toast({
        title: "Success",
        description: `Payment submission ${formData.status.toLowerCase()} successfully`,
      });
      onOpenChange(false);
      onSuccess?.();
      // Reset form
      setFormData({
        status: 'VERIFIED',
        rejectionReason: '',
        notes: ''
      });
    } catch (error: any) {
      console.error('Failed to verify submission:', error);
      toast({
        title: "Verification Failed",
        description: (error as any).message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!submission) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[93vh] overflow-y-auto mx-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-base leading-tight">Verify Payment Submission</p>
              <p className="text-[13px] text-muted-foreground font-normal">Review and approve or reject the submission</p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {/* Submission Details */}
        <div className="space-y-5 mb-6">
          <div>
            <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Submission Details <span className="flex-1 h-px bg-border/40" /></p>
            <div className="divide-y divide-border/40">
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Submission ID</span>
                <span className="text-sm font-mono font-semibold text-primary break-all">{submission.id}</span>
              </div>
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-sm font-medium">Rs {parseFloat((submission as any).paymentAmount || (submission as any).submittedAmount || '0').toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Student</span>
                <span className="text-sm font-medium">{(submission as any).studentName || (submission as any).username || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Transaction Ref</span>
                <span className="text-xs font-mono font-medium break-all">{(submission as any).transactionRef || (submission as any).transactionId || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Payment Method</span>
                <span className="text-sm font-medium">{(submission as any).paymentMethod || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-3.5">
                <span className="text-sm text-muted-foreground">Payment Date</span>
                <span className="text-sm font-medium">{new Date(submission.paymentDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {((submission as any).remarks || (submission as any).notes) && (
            <div>
              <p className="text-[13px] text-muted-foreground mb-1.5">Remarks</p>
              <p className="text-sm">{(submission as any).remarks || (submission as any).notes}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="status">Verification Decision *</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value: 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED') => {
                setFormData(prev => ({ ...prev, status: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VERIFIED">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Full Verified</span>
                  </div>
                </SelectItem>
                <SelectItem value="HALF_VERIFIED">
                  <div className="flex items-center space-x-2">
                    <CircleDollarSign className="h-4 w-4 text-orange-500" />
                    <span>Half Paid</span>
                  </div>
                </SelectItem>
                <SelectItem value="QUARTER_VERIFIED">
                  <div className="flex items-center space-x-2">
                    <CircleDollarSign className="h-4 w-4 text-purple-600" />
                    <span>Quarter Paid</span>
                  </div>
                </SelectItem>
                <SelectItem value="REJECTED">
                  <div className="flex items-center space-x-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span>Rejected</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.status === 'REJECTED' && (
            <div>
              <Label htmlFor="rejectionReason">Rejection Reason *</Label>
              <Textarea
                id="rejectionReason"
                value={formData.rejectionReason}
                onChange={(e) => setFormData(prev => ({ ...prev, rejectionReason: e.target.value }))}
                placeholder="Please provide a reason for rejection..."
                required
              className={`${fieldErrors.rejectionReason ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />

              {fieldErrors.rejectionReason && <p className="text-xs text-red-500 mt-1">{fieldErrors.rejectionReason}</p>}
            </div>
          )}

          <div>
            <Label htmlFor="notes">Admin Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes (visible to the submitter)..."
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              variant={formData.status === 'REJECTED' ? 'destructive' : 'default'}
            >
              {loading ? 'Processing...' :
                formData.status === 'VERIFIED' ? 'Verify Submission' :
                formData.status === 'HALF_VERIFIED' ? 'Mark Half Paid' :
                formData.status === 'QUARTER_VERIFIED' ? 'Mark Quarter Paid' :
                'Reject Submission'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VerifySubmissionDialog;