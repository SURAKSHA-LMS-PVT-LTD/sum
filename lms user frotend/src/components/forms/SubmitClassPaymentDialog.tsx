import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { classPaymentsApi, ClassPayment } from '@/api/classPayments.api';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { Upload, Calendar, CreditCard, FileText, DollarSign, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface SubmitClassPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: ClassPayment | null;
  onSuccess?: () => void;
}

const SubmitClassPaymentDialog: React.FC<SubmitClassPaymentDialogProps> = ({
  open, onOpenChange, payment, onSuccess,
}) => {
  const { selectedInstitute, selectedClass } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submissionStep, setSubmissionStep] = useState<'idle' | 'uploading' | 'submitting' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({
    paymentDate: new Date().toISOString().slice(0, 16),
    transactionId: '',
    submittedAmount: payment?.amount || '',
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Update submitted amount when payment changes
  React.useEffect(() => {
    if (payment?.amount) {
      setFormData(prev => ({ ...prev, submittedAmount: payment.amount }));
    }
  }, [payment?.amount]);

  if (!payment) return null;

  const handleInputChange = (field: string, value: string) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      toast({ title: 'Invalid File Type', description: 'Please upload a PDF, JPG, or PNG file.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File Too Large', description: 'Please upload a file smaller than 5MB.', variant: 'destructive' });
      return;
    }
    setReceiptFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.transactionId.trim()) errors.transactionId = 'Transaction ID is required';
    if (!receiptFile) errors.receiptFile = 'Receipt upload is required';
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    if (!selectedInstitute?.id || !selectedClass?.id) {
      toast({ title: 'Error', description: 'Institute and class must be selected', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setSubmissionStep('submitting');
    setUploadProgress(0);
    setUploadMessage('Submitting payment...');
    try {
      setUploadProgress(50);
      
      const response = await classPaymentsApi.submitClassPayment(
        selectedInstitute.id,
        selectedClass.id,
        payment.id,
        {
          paymentDate: new Date(formData.paymentDate).toISOString(),
          submittedAmount: parseFloat(formData.submittedAmount),
          transactionId: formData.transactionId,
          notes: formData.notes || undefined,
          receiptFile: receiptFile,
        }
      );

      setSubmissionStep('success');
      setUploadProgress(100);
      setUploadMessage('Payment submitted successfully!');

      // Invalidate all caches to force fresh data on next load
      enhancedCachedClient.enableGlobalForceRefresh(5000);

      toast({
        title: 'Success',
        description: response.message || 'Payment submitted successfully! Awaiting verification.',
      });

      setTimeout(() => {
        setFormData({ paymentDate: new Date().toISOString().slice(0, 16), transactionId: '', submittedAmount: payment.amount, notes: '' });
        setReceiptFile(null);
        setFieldErrors({});
        setSubmissionStep('idle');
        setUploadProgress(0);
        onOpenChange(false);
        onSuccess?.();
      }, 1500);
    } catch (error: any) {
      setSubmissionStep('error');
      let msg = 'Failed to submit payment.';
      if (error.message?.includes('already submitted') || error.message?.includes('DUPLICATE_SUBMISSION')) {
        msg = 'You have already submitted a payment for this request. Please wait for verification.';
      } else if (error.message) {
        msg = error.message;
      }
      setUploadMessage(msg);
      toast({ title: 'Submission Failed', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" /><span>Submit Class Payment</span>
          </DialogTitle>
        </DialogHeader>

        <div className="bg-muted/50 p-4 rounded-lg mb-4">
          <h3 className="font-semibold mb-2">{payment.title}</h3>
          <p className="text-sm text-muted-foreground mb-2">{payment.description}</p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Amount Required:</span>
            <span className="text-xl font-bold">Rs {parseFloat(payment.amount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm text-muted-foreground">Due Date:</span>
            <span className="text-sm">{new Date(payment.lastDate).toLocaleDateString()}</span>
          </div>
          {payment.bankName && (
            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground space-y-0.5">
              <p>Bank: <span className="font-medium text-foreground">{payment.bankName}</span></p>
              <p>Account: <span className="font-medium text-foreground">{payment.accountHolderName} — {payment.accountHolderNumber}</span></p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="paymentDate" className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span>Payment Date</span></Label>
            <Input id="paymentDate" type="datetime-local" value={formData.paymentDate} onChange={e => handleInputChange('paymentDate', e.target.value)} required />
          </div>

          <div>
            <Label htmlFor="transactionId" className="flex items-center gap-2"><FileText className="h-4 w-4" /><span>Transaction ID *</span></Label>
            <Input id="transactionId" placeholder="Enter transaction reference number" value={formData.transactionId} onChange={e => handleInputChange('transactionId', e.target.value)} className={fieldErrors.transactionId ? 'border-red-500' : ''} />
            {fieldErrors.transactionId && <p className="text-xs text-red-500 mt-1">{fieldErrors.transactionId}</p>}
          </div>

          <div>
            <Label htmlFor="submittedAmount" className="flex items-center gap-2"><DollarSign className="h-4 w-4" /><span>Amount Paid (Rs)</span></Label>
            <Input id="submittedAmount" type="number" step="0.01" min="0" value={formData.submittedAmount} onChange={e => handleInputChange('submittedAmount', e.target.value)} required />
          </div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea id="notes" placeholder="Add any additional notes..." value={formData.notes} onChange={e => handleInputChange('notes', e.target.value)} rows={3} />
          </div>

          <div>
            <Label htmlFor="receipt" className="flex items-center gap-2"><Upload className="h-4 w-4" /><span>Receipt File *</span></Label>
            <div className="mt-2">
              <Input id="receipt" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => { setFieldErrors(prev => ({ ...prev, receiptFile: '' })); handleFileChange(e); }} className={fieldErrors.receiptFile ? 'border-red-500' : ''} />
              {fieldErrors.receiptFile && <p className="text-xs text-red-500 mt-1">{fieldErrors.receiptFile}</p>}
              {receiptFile && <p className="text-sm text-muted-foreground mt-1">Selected: {receiptFile.name} ({(receiptFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
              <p className="text-xs text-muted-foreground mt-1">Accepted formats: PDF, JPG, PNG (Max 5MB)</p>
            </div>
          </div>

          {submissionStep !== 'idle' && (
            <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${submissionStep === 'success' ? 'bg-green-500' : submissionStep === 'error' ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${uploadProgress}%` }} />
              </div>
              <div className="flex items-center gap-2 text-sm">
                {(submissionStep === 'uploading' || submissionStep === 'submitting') && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {submissionStep === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                {submissionStep === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                <span className={`text-xs ${submissionStep === 'success' ? 'text-green-700 dark:text-green-400 font-medium' : submissionStep === 'error' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{uploadMessage}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => { if (submissionStep !== 'idle') { setSubmissionStep('idle'); setUploadProgress(0); setUploadMessage(''); } onOpenChange(false); }} disabled={loading && submissionStep !== 'error'}>
              {submissionStep === 'error' ? 'Close' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={loading || !receiptFile || submissionStep === 'success'} className="flex items-center space-x-2">
              {submissionStep === 'success' ? (<><CheckCircle className="h-4 w-4" /><span>Submitted!</span></>) :
               loading ? (<><Loader2 className="h-4 w-4 animate-spin" /><span>{uploadMessage || 'Processing...'}</span></>) :
               (<><CreditCard className="h-4 w-4" /><span>Submit Payment</span></>)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SubmitClassPaymentDialog;
