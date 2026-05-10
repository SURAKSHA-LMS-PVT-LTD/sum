/**
 * SubmitPaymentDialog - Submit payment with file upload
 * Supports Cloud Storage (signed URL) and Google Drive upload methods
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload,
  Loader2,
  Receipt,
  FileImage,
  X,
  CheckCircle2,
  CloudUpload,
  HardDrive,
} from 'lucide-react';
import {
  UserIdCardOrder,
  PaymentType,
  userCardApi,
} from '@/api/userCard.api';
import {
  checkDriveConnection,
  getDriveAccessToken,
  getDriveFolder,
  getDriveConnectUrl,
} from '@/services/driveService';
import { formatPrice } from '@/utils/cardHelpers';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/api/apiError';

interface SubmitPaymentDialogProps {
  order: UserIdCardOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadingOrder?: boolean;
  onSuccess: () => void;
}

type UploadMethod = 'cloud' | 'drive';
type UploadStep = 'select-method' | 'upload' | 'submitting' | 'done';

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const SubmitPaymentDialog: React.FC<SubmitPaymentDialogProps> = ({
  order,
  open,
  onOpenChange,
  loadingOrder = false,
  onSuccess,
}) => {
  const [uploadMethod, setUploadMethod] = useState<UploadMethod>('cloud');
  const [step, setStep] = useState<UploadStep>('select-method');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const paymentType = PaymentType.SLIP_UPLOAD;
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadProgressPct, setUploadProgressPct] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);
  const [checkingDrive, setCheckingDrive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Animate upload progress percentage
  useEffect(() => {
    if (step === 'submitting') {
      if (uploadProgress.includes('Getting')) setUploadProgressPct(15);
      else if (uploadProgress.includes('Uploading')) setUploadProgressPct(55);
      else if (uploadProgress.includes('Submitting')) setUploadProgressPct(85);
    } else if (step === 'done') {
      setUploadProgressPct(100);
    } else {
      setUploadProgressPct(0);
    }
  }, [step, uploadProgress]);

  const resetForm = useCallback(() => {
    setStep('select-method');
    setSelectedFile(null);
    setFilePreview(null);
    setPaymentReference('');
    setNotes('');
    setLoading(false);
    setUploadProgress('');
    setUploadProgressPct(0);
    setIsDragging(false);
    setDriveConnected(null);
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetForm();
    onOpenChange(isOpen);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a JPG, PNG, WebP image or PDF file.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleMethodSelect = async () => {
    if (uploadMethod === 'drive') {
      // Check Drive connection
      setCheckingDrive(true);
      try {
        const status = await checkDriveConnection();
        setDriveConnected(status.isConnected);
        if (!status.isConnected) {
          toast({
            title: 'Google Drive Not Connected',
            description: 'Please connect your Google Drive first from settings.',
            variant: 'destructive',
          });
          // Try to redirect to connect
          try {
            const { authUrl } = await getDriveConnectUrl(window.location.pathname);
            window.open(authUrl, '_blank');
          } catch {
            // ignore
          }
          return;
        }
      } catch {
        toast({
          title: 'Error',
          description: 'Could not check Drive connection status.',
          variant: 'destructive',
        });
        return;
      } finally {
        setCheckingDrive(false);
      }
    }
    setStep('upload');
  };

  // ====== Cloud Storage Upload ======
  const uploadViaCloudStorage = async (file: File, orderId: number, paymentAmount: number) => {
    // Step 1: Get signed upload URL
    setUploadProgress('Getting upload URL...');
    const uploadData = await userCardApi.getPaymentSlipUploadUrl(orderId, {
      fileName: file.name,
      contentType: file.type,
    });

    // Step 2: Upload file directly
    setUploadProgress('Uploading file...');
    const { uploadUrl, fields } = uploadData;
    if (fields) {
      // AWS S3 — multipart/form-data POST with signed policy fields
      const formData = new FormData();
      // Add ALL policy fields FIRST (order matters for S3)
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      // File MUST be last
      formData.append('file', file);
      const res = await fetch(uploadUrl, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to upload file to storage');
    } else {
      // GCS — simple PUT with Content-Type header
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!res.ok) throw new Error('Failed to upload file to storage');
    }

    // Step 3: Submit payment record
    setUploadProgress('Submitting payment...');
    await userCardApi.submitPayment(orderId, {
      submissionUrl: uploadData.relativePath,
      paymentType,
      paymentAmount,
      paymentReference: paymentReference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  // ====== Google Drive Upload ======
  const uploadViaGoogleDrive = async (file: File, orderId: number, paymentAmount: number) => {
    // Step 1: Get Drive access token
    setUploadProgress('Getting Drive access...');
    const { accessToken } = await getDriveAccessToken();

    // Step 2: Get/create upload folder
    setUploadProgress('Preparing Drive folder...');
    const { folderId } = await getDriveFolder('ID_CARD_PAYMENT');

    // Step 3: Upload to Drive
    setUploadProgress('Uploading to Google Drive...');
    const metadata = { name: file.name, parents: [folderId] };
    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append('file', file);

    const driveRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      }
    );

    if (!driveRes.ok) {
      throw new Error('Failed to upload file to Google Drive');
    }

    const { id: driveFileId, webViewLink: driveWebViewLink } = await driveRes.json();

    // Step 4: Register payment
    setUploadProgress('Submitting payment...');
    await userCardApi.submitDrivePayment(orderId, {
      driveFileId,
      driveWebViewLink,
      driveFileName: file.name,
      paymentType,
      paymentAmount,
      paymentReference: paymentReference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const handleSubmit = async () => {
    if (!order || !selectedFile) return;

    const rawPrice = order.card?.price;
    const paymentAmount = typeof rawPrice === 'string' ? parseFloat(rawPrice) : rawPrice;
    if (!paymentAmount || paymentAmount <= 0 || isNaN(paymentAmount)) {
      toast({
        title: 'Order not ready',
        description: 'Order details are still loading. Please wait.',
        variant: 'destructive',
      });
      return;
    }

    const orderId = typeof order.id === 'string' ? parseInt(order.id, 10) : order.id;

    try {
      setLoading(true);
      setStep('submitting');

      if (uploadMethod === 'cloud') {
        await uploadViaCloudStorage(selectedFile, orderId, paymentAmount);
      } else {
        await uploadViaGoogleDrive(selectedFile, orderId, paymentAmount);
      }

      setStep('done');
      toast({
        title: 'Payment Submitted',
        description: 'Your payment has been submitted for verification.',
      });

      setTimeout(() => {
        resetForm();
        onSuccess();
      }, 1500);
    } catch (error: any) {
      console.error('Error submitting payment:', error);
      setStep('upload');
      toast({
        title: 'Upload Failed',
        description: getErrorMessage(error, 'Failed to submit payment. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Submit Payment
          </DialogTitle>
          <DialogDescription>
            Upload payment proof for order #{order.id}
          </DialogDescription>
        </DialogHeader>

        {/* Order Summary */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          {loadingOrder ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Card</span>
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount Due</span>
                <Skeleton className="h-7 w-24" />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Card</span>
                <span className="font-medium">{order.card?.cardName || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount Due</span>
                <span className="text-xl font-bold text-primary">
                  {order.card ? formatPrice(order.card.price) : '-'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Step: Select Upload Method */}
        {step === 'select-method' && (
          <div className="space-y-4 py-2">
            <Label className="text-sm font-medium">Choose Upload Method</Label>
            <RadioGroup
              value={uploadMethod}
              onValueChange={(v) => setUploadMethod(v as UploadMethod)}
              className="grid grid-cols-2 gap-4"
            >
              <div className="relative">
                <RadioGroupItem value="cloud" id="method-cloud" className="peer sr-only" />
                <Label
                  htmlFor="method-cloud"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer relative"
                >
                  <span className="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase tracking-wide bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Recommended</span>
                  <CloudUpload className="mb-3 h-6 w-6" />
                  <span className="text-sm font-medium">Cloud Upload</span>
                  <span className="text-xs text-muted-foreground mt-1">Direct upload</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="drive" id="method-drive" className="peer sr-only" />
                <Label
                  htmlFor="method-drive"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <HardDrive className="mb-3 h-6 w-6" />
                  <span className="text-sm font-medium">Google Drive</span>
                  <span className="text-xs text-muted-foreground mt-1">Requires OAuth</span>
                </Label>
              </div>
            </RadioGroup>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleMethodSelect} disabled={checkingDrive}>
                {checkingDrive ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Upload File & Details */}
        {step === 'upload' && (
          <div className="space-y-4 py-2">
            {/* File Upload Area */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Payment Slip / Receipt</Label>
              {!selectedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const fakeEvent = { target: { files: [file] } } as any;
                      handleFileSelect(fakeEvent);
                    }
                  }}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${isDragging
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                    }`}
                >
                  <FileImage className={`h-10 w-10 mx-auto mb-3 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground/50'}`} />
                  <p className="text-sm font-medium text-muted-foreground">
                    {isDragging ? 'Drop file here' : 'Click or drag & drop to upload'}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    JPG, PNG, WebP or PDF • Max 10MB
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg p-3 flex items-center gap-3 bg-muted/30">
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="h-16 w-16 rounded object-cover border"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded bg-muted flex items-center justify-center">
                      <Receipt className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={removeFile} className="shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>



            {/* Reference */}
            <div className="space-y-2">
              <Label htmlFor="paymentRef" className="text-sm">
                Reference Number <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Input
                id="paymentRef"
                placeholder="TXN-2025-001234"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm">
                Notes <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('select-method')}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedFile || loadingOrder || !order.card?.price || parseFloat(String(order.card?.price)) <= 0}
              >
                <Upload className="h-4 w-4 mr-2" />
                Submit Payment
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step: Submitting */}
        {step === 'submitting' && (
          <div className="py-8 flex flex-col items-center gap-4 w-full">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center w-full">
              <p className="font-medium">Uploading Payment</p>
              <p className="text-sm text-muted-foreground mt-1">{uploadProgress}</p>
              {/* Visual progress bar */}
              <div className="mt-4 w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${uploadProgressPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{uploadProgressPct}%</p>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <div className="text-center">
              <p className="font-medium text-primary">Payment Submitted!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your payment is pending verification.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubmitPaymentDialog;
