import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, Package, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getBaseUrl, getAccessTokenAsync } from '@/contexts/utils/auth.api';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';

interface PackageDefinition {
  id: string;
  subscriptionPlan: string;
  name: string;
  description?: string;
  features?: string[];
  price: number;
  validityDays: number;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
}

interface ChangePlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: string;
  onSuccess: () => void;
}

type Step = 'select' | 'payment' | 'done';

const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'ONLINE_PAYMENT', label: 'Online Payment' },
  { value: 'CASH_DEPOSIT', label: 'Cash Deposit' },
];

const ChangePlanModal: React.FC<ChangePlanModalProps> = ({ open, onOpenChange, currentPlan, onSuccess }) => {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('select');
  const [packages, setPackages] = useState<PackageDefinition[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<PackageDefinition | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Payment form
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentSlip, setPaymentSlip] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  useEffect(() => {
    if (open) {
      setStep('select');
      setSelectedPkg(null);
      setQuantity(1);
      setPaymentMethod('');
      setPaymentReference('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentSlip(null);
      setNotes('');
      loadPackages();
    }
  }, [open]);

  const loadPackages = async () => {
    setLoadingPackages(true);
    try {
      const baseUrl = getBaseUrl();
      const token = await getAccessTokenAsync();
      const res = await fetch(`${baseUrl}/package-definitions/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load packages');
      const data = await res.json();
      setPackages(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load packages', variant: 'destructive' });
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleSelectPlan = (pkg: PackageDefinition) => {
    setSelectedPkg(pkg);
    setQuantity(1);
    setStep('payment');
  };

  const totalPrice = selectedPkg ? selectedPkg.price * quantity : 0;
  const totalDays = selectedPkg ? selectedPkg.validityDays * quantity : 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum 5MB allowed', variant: 'destructive' });
      return;
    }
    setPaymentSlip(file);
  };

  const handleSubmit = async () => {
    if (!selectedPkg) return;
    if (!paymentMethod) {
      toast({ title: 'Validation', description: 'Please select a payment method', variant: 'destructive' });
      return;
    }
    if (!paymentSlip) {
      toast({ title: 'Validation', description: 'Please upload a payment slip', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      setUploadMessage('Uploading payment slip...');
      const paymentSlipUrl = await uploadWithSignedUrl(
        paymentSlip,
        'institute-payment-receipts',
        (msg) => setUploadMessage(msg)
      );

      setUploadMessage('Submitting payment...');
      const baseUrl = getBaseUrl();
      const token = await getAccessTokenAsync();
      const today = new Date();
      const paymentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

      const payload = {
        paymentAmount: totalPrice,
        paymentMethod,
        paymentDate: new Date(paymentDate).toISOString(),
        paymentMonth,
        paymentSlipUrl,
        targetPlan: selectedPkg.subscriptionPlan,
        quantity,
        ...(paymentReference && { paymentReference }),
        ...(notes && { notes }),
      };

      const res = await fetch(`${baseUrl}/payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Submission failed');
      }

      setStep('done');
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit payment',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setUploadMessage('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' && 'Choose a Plan'}
            {step === 'payment' && 'Submit Payment'}
            {step === 'done' && 'Payment Submitted'}
          </DialogTitle>
        </DialogHeader>

        {/* ─── Step 1: Select package ─────────────────────────────── */}
        {step === 'select' && (
          <div className="space-y-4 py-2">
            {loadingPackages ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : packages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No packages available at this time.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`border rounded-lg p-4 space-y-2 cursor-pointer transition-all hover:border-primary ${
                      pkg.subscriptionPlan === currentPlan ? 'opacity-60' : ''
                    }`}
                    onClick={() => pkg.subscriptionPlan !== currentPlan && handleSelectPlan(pkg)}
                  >
                    {pkg.imageUrl && (
                      <img src={pkg.imageUrl} alt={pkg.name} className="w-full h-24 object-cover rounded-md" />
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{pkg.name}</h3>
                      {pkg.subscriptionPlan === currentPlan && (
                        <Badge variant="secondary" className="text-xs">Current</Badge>
                      )}
                    </div>
                    {pkg.description && <p className="text-xs text-muted-foreground">{pkg.description}</p>}
                    {pkg.features && pkg.features.length > 0 && (
                      <ul className="text-xs space-y-0.5">
                        {pkg.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-green-500">✓</span> {f}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-bold text-lg">Rs. {pkg.price.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">{pkg.validityDays} days</span>
                    </div>
                    {pkg.subscriptionPlan !== currentPlan && (
                      <Button size="sm" className="w-full mt-1" onClick={() => handleSelectPlan(pkg)}>
                        Select
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Step 2: Payment details ────────────────────────────── */}
        {step === 'payment' && selectedPkg && (
          <div className="space-y-4 py-2">
            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{selectedPkg.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit price</span>
                <span>Rs. {selectedPkg.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unit validity</span>
                <span>{selectedPkg.validityDays} days</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <Label className="text-xs mb-1 block">Quantity (how many units?)</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</Button>
                  <span className="w-8 text-center font-semibold">{quantity}</span>
                  <Button variant="outline" size="sm" onClick={() => setQuantity(q => Math.min(36, q + 1))}>+</Button>
                </div>
              </div>
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Total</span>
                <span>Rs. {totalPrice.toLocaleString()} / {totalDays} days</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Payment Date *</Label>
              <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} max={new Date().toISOString().split('T')[0]} />
            </div>

            <div className="space-y-1">
              <Label>Transaction Reference</Label>
              <Input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="Bank ref / transaction ID" maxLength={100} />
            </div>

            <div className="space-y-1">
              <Label>Payment Slip *</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                  id="plan-payment-slip"
                />
                <label htmlFor="plan-payment-slip" className="flex items-center gap-2 cursor-pointer border rounded-md px-3 py-2 text-sm hover:bg-muted/50 w-full">
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {paymentSlip ? paymentSlip.name : 'Upload receipt (PDF/JPG/PNG, max 5MB)'}
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" maxLength={255} />
            </div>

            {uploadMessage && (
              <p className="text-xs text-muted-foreground animate-pulse">{uploadMessage}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep('select')} disabled={isSubmitting} className="flex-1">
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : 'Submit Payment'}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Done ───────────────────────────────────────── */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <h3 className="text-lg font-semibold">Payment Submitted!</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your payment for <strong>{selectedPkg?.name}</strong> has been submitted. An admin will review and activate your plan within 1–2 business days.
            </p>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ChangePlanModal;
