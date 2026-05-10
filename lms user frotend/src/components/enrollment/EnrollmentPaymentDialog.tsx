import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { classPaymentsApi } from '@/api/classPayments.api';
import { Upload, Calendar, CreditCard, FileText, DollarSign, Building2, Globe, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';

interface EnrollmentPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string;
  subjectName: string;
  feeAmount: number;
  onSuccess?: () => void;
}

type PaymentMethod = 'physical' | 'online';

const EnrollmentPaymentDialog: React.FC<EnrollmentPaymentDialogProps> = ({
  open,
  onOpenChange,
  paymentId,
  subjectName,
  feeAmount,
  onSuccess
}) => {
  const { toast } = useToast();
  const { selectedInstitute } = useAuth();
  const { isTuition: isTuitionInstitute } = useInstituteLabels();
  const feeLabel = isTuitionInstitute ? 'Monthly Fee' : 'Subject Fee';
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submissionStep, setSubmissionStep] = useState<'idle' | 'uploading' | 'submitting' | 'success' | 'error'>('idle');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('physical');
  const [formData, setFormData] = useState({
    paymentDate: new Date().toISOString().slice(0, 16),
    transactionId: '',
    submittedAmount: String(feeAmount),
    notes: '',
    // Physical payment fields
    instituteReference: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a PDF, JPG, or PNG file.",
          variant: "destructive"
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please upload a file smaller than 5MB.",
          variant: "destructive"
        });
        return;
      }
      setReceiptFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.transactionId.trim()) {
      errors.transactionId = paymentMethod === 'physical'
        ? 'Institute reference / receipt number is required'
        : 'Transaction ID is required';
    }
    if (!receiptFile) errors.receiptFile = 'Receipt / payment slip upload is required';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setSubmissionStep('uploading');
    setUploadProgress(0);
    try {
      // Step 1: Upload receipt file
      const relativePath = await uploadWithSignedUrl(
        receiptFile,
        'enrollment-payment-receipts',
        (message, progress) => {
          setUploadMessage(message);
          setUploadProgress(progress);
        }
      );

      // Step 2: Build notes with payment method info
      setSubmissionStep('submitting');
      setUploadMessage('Submitting payment details...');
      setUploadProgress(80);
      const methodNote = paymentMethod === 'physical'
        ? `[Physical Payment] Institute Ref: ${formData.instituteReference || formData.transactionId}`
        : `[Online Payment] Transaction ID: ${formData.transactionId}`;
      const fullNotes = [methodNote, formData.notes].filter(Boolean).join('\n');

      // Step 3: Submit payment
      const isoDate = new Date(formData.paymentDate).toISOString();
      const amountNumber = parseFloat(formData.submittedAmount);

      await classPaymentsApi.submitPayment(paymentId, {
        paymentDate: isoDate,
        transactionId: paymentMethod === 'physical'
          ? (formData.instituteReference || formData.transactionId)
          : formData.transactionId,
        submittedAmount: amountNumber,
        notes: fullNotes,
        receiptUrl: relativePath
      });

      setSubmissionStep('success');
      setUploadProgress(100);
      setUploadMessage('Payment submitted successfully!');

      toast({
        title: "Payment Submitted",
        description: "Your payment has been submitted for verification. You'll be notified once approved."
      });

      // Brief delay so user sees success state before dialog closes
      setTimeout(() => {
        // Reset form
        setFormData({
          paymentDate: new Date().toISOString().slice(0, 16),
          transactionId: '',
          submittedAmount: String(feeAmount),
          notes: '',
          instituteReference: '',
        });
        setReceiptFile(null);
        setFieldErrors({});
        setSubmissionStep('idle');
        setUploadProgress(0);
        onOpenChange(false);
        onSuccess?.();
      }, 1500);
    } catch (error: any) {
      console.error('Enrollment payment submission error:', error);
      setSubmissionStep('error');
      let errorMessage = "Failed to submit payment.";
      if (error.message?.includes("already submitted") || error.message?.includes("DUPLICATE_SUBMISSION")) {
        errorMessage = "You have already submitted a payment for this enrollment. Please wait for verification or contact your admin.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      setUploadMessage(errorMessage);
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Enrollment Payment</span>
          </DialogTitle>
        </DialogHeader>

        {/* Fee Details */}
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 rounded-lg mb-4">
          <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
            {feeLabel} - {subjectName}
          </h3>
          <div className="flex justify-between items-center">
            <span className="text-sm text-green-700 dark:text-green-300">Amount Required:</span>
            <span className="text-xl font-bold text-green-900 dark:text-green-100">
              Rs. {feeAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="space-y-3 mb-4">
          <Label className="text-sm font-semibold">Payment Method</Label>
          <RadioGroup
            value={paymentMethod}
            onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
            className="grid grid-cols-2 gap-3"
          >
            <div className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer transition-colors ${
              paymentMethod === 'physical' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
            }`}>
              <RadioGroupItem value="physical" id="physical" />
              <label htmlFor="physical" className="flex items-center gap-2 cursor-pointer flex-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Physical</p>
                  <p className="text-[10px] text-muted-foreground">Paid at institute</p>
                </div>
              </label>
            </div>
            <div className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer transition-colors ${
              paymentMethod === 'online' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
            }`}>
              <RadioGroupItem value="online" id="online" />
              <label htmlFor="online" className="flex items-center gap-2 cursor-pointer flex-1">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Online</p>
                  <p className="text-[10px] text-muted-foreground">Bank transfer / online</p>
                </div>
              </label>
            </div>
          </RadioGroup>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment Date */}
          <div>
            <Label htmlFor="paymentDate" className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Payment Date</span>
            </Label>
            <Input
              id="paymentDate"
              type="datetime-local"
              value={formData.paymentDate}
              onChange={(e) => handleInputChange('paymentDate', e.target.value)}
              required
            />
          </div>

          {/* Conditional fields based on payment method */}
          {paymentMethod === 'physical' ? (
            <>
              {/* Institute Reference */}
              <div>
                <Label htmlFor="instituteReference" className="flex items-center space-x-2">
                  <Building2 className="h-4 w-4" />
                  <span>Institute Reference / Receipt No *</span>
                </Label>
                <Input
                  id="instituteReference"
                  placeholder="Enter institute receipt or reference number"
                  value={formData.instituteReference}
                  onChange={(e) => {
                    handleInputChange('instituteReference', e.target.value);
                    // Also set as transaction ID for backend
                    handleInputChange('transactionId', e.target.value);
                  }}
                  className={fieldErrors.transactionId ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {fieldErrors.transactionId && <p className="text-xs text-red-500 mt-1">{fieldErrors.transactionId}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  Enter the receipt number or reference given by the institute when you paid.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Transaction ID for online */}
              <div>
                <Label htmlFor="transactionId" className="flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Transaction ID / Reference *</span>
                </Label>
                <Input
                  id="transactionId"
                  placeholder="Enter bank transaction reference number"
                  value={formData.transactionId}
                  onChange={(e) => handleInputChange('transactionId', e.target.value)}
                  className={fieldErrors.transactionId ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {fieldErrors.transactionId && <p className="text-xs text-red-500 mt-1">{fieldErrors.transactionId}</p>}
              </div>
            </>
          )}

          {/* Amount */}
          <div>
            <Label htmlFor="submittedAmount" className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4" />
              <span>Amount Paid (Rs)</span>
            </Label>
            <Input
              id="submittedAmount"
              type="number"
              step="0.01"
              min="0"
              value={formData.submittedAmount}
              onChange={(e) => handleInputChange('submittedAmount', e.target.value)}
              required
            />
          </div>

          {/* Receipt Upload */}
          <div>
            <Label htmlFor="receipt" className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>{paymentMethod === 'physical' ? 'Receipt Photo / Scan *' : 'Payment Screenshot / Receipt *'}</span>
            </Label>
            <div className="mt-2">
              <Input
                id="receipt"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => { setFieldErrors(prev => ({ ...prev, receiptFile: '' })); handleFileChange(e); }}
                className={fieldErrors.receiptFile ? 'border-red-500' : ''}
              />
              {fieldErrors.receiptFile && <p className="text-xs text-red-500 mt-1">{fieldErrors.receiptFile}</p>}
              {receiptFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  Selected: {receiptFile.name} ({(receiptFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Accepted formats: PDF, JPG, PNG (Max 5MB)
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes about this payment..."
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={2}
            />
          </div>

          {/* Upload Progress / Status Feedback */}
          {submissionStep !== 'idle' && (
            <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    submissionStep === 'success' ? 'bg-green-500' : 
                    submissionStep === 'error' ? 'bg-red-500' : 'bg-primary'
                  }`}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              {/* Step Text */}
              <div className="flex items-center gap-2 text-sm">
                {submissionStep === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {submissionStep === 'submitting' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {submissionStep === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                {submissionStep === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                <span className={`text-xs ${
                  submissionStep === 'success' ? 'text-green-700 dark:text-green-400 font-medium' :
                  submissionStep === 'error' ? 'text-red-600 dark:text-red-400' :
                  'text-muted-foreground'
                }`}>
                  {uploadMessage}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => { 
                if (submissionStep !== 'idle') {
                  setSubmissionStep('idle');
                  setUploadProgress(0);
                  setUploadMessage('');
                }
                onOpenChange(false); 
              }}
              disabled={loading && submissionStep !== 'error'}
            >
              {submissionStep === 'error' ? 'Close' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              disabled={loading || !receiptFile || submissionStep === 'success'}
              className={`flex items-center space-x-2 ${
                submissionStep === 'success' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {submissionStep === 'success' ? (
                <><CheckCircle className="h-4 w-4" /><span>Payment Submitted!</span></>
              ) : loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /><span>{uploadMessage || 'Processing...'}</span></>
              ) : (
                <><CreditCard className="h-4 w-4" /><span>Submit Payment</span></>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EnrollmentPaymentDialog;
