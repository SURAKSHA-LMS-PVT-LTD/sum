import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, CheckCircle, Package, Upload,
  CreditCard, Zap, ShieldCheck, CheckCircle2, XCircle, AlertCircle, RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getBaseUrl, getAccessTokenAsync } from '@/contexts/utils/auth.api';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';
import { paymentGatewayApi, UserPackageOrderStatus } from '@/api/paymentGateway.api';
import { isPaymentGatewayEnabled } from '@/utils/featureFlags';

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
type PaymentTab = 'slip' | 'gateway';
type GatewayStep = 'idle' | 'initiating' | 'redirect' | 'polling' | 'success' | 'failed' | 'cancelled';

const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'ONLINE_PAYMENT', label: 'Online Payment' },
  { value: 'CASH_DEPOSIT', label: 'Cash Deposit' },
];

const isCapacitor = () =>
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor.isNativePlatform?.();

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ChangePlanModal: React.FC<ChangePlanModalProps> = ({ open, onOpenChange, currentPlan, onSuccess }) => {
  const { toast } = useToast();
  const gatewayEnabled = isPaymentGatewayEnabled();
  const [step, setStep] = useState<Step>('select');
  const [packages, setPackages] = useState<PackageDefinition[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<PackageDefinition | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentTab, setPaymentTab] = useState<PaymentTab>(gatewayEnabled ? 'gateway' : 'slip');

  // Slip upload state
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentSlip, setPaymentSlip] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  // Gateway state
  const [gatewayStep, setGatewayStep] = useState<GatewayStep>('idle');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [gatewayOrderStatus, setGatewayOrderStatus] = useState<UserPackageOrderStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetGateway = useCallback(() => {
    setGatewayStep('idle');
    setCurrentOrderId(null);
    setGatewayOrderStatus(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (open) {
      setStep('select');
      setSelectedPkg(null);
      setQuantity(1);
      setPaymentTab('gateway');
      setPaymentMethod('');
      setPaymentReference('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentSlip(null);
      setNotes('');
      resetGateway();
      loadPackages();
    }
  }, [open]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

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
    resetGateway();
    setStep('payment');
  };

  const totalPrice = selectedPkg ? selectedPkg.price * quantity : 0;
  const totalDays = selectedPkg ? selectedPkg.validityDays * quantity : 0;

  // ── Slip upload flow ──────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum 5MB allowed', variant: 'destructive' });
      return;
    }
    setPaymentSlip(file);
  };

  const handleSlipSubmit = async () => {
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

  // ── Gateway (PayHere) flow ────────────────────────────────────────────────────

  const startPolling = useCallback((orderId: string) => {
    let attempts = 0;
    const MAX = 60;

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const status = await paymentGatewayApi.getUserPackageOrderStatus(orderId);
        setGatewayOrderStatus(status);

        if (status.status === 'SUCCESS') {
          clearInterval(pollRef.current!);
          setGatewayStep('success');
          onSuccess();
          toast({ title: 'Plan activated!', description: `Your ${status.subscriptionPlan} plan is now active.` });
        } else if (status.status === 'FAILED') {
          clearInterval(pollRef.current!);
          setGatewayStep('failed');
        } else if (status.status === 'CANCELLED') {
          clearInterval(pollRef.current!);
          setGatewayStep('cancelled');
        } else if (attempts >= MAX) {
          clearInterval(pollRef.current!);
        }
      } catch {
        // keep polling on transient errors
      }
    }, 5000);
  }, [onSuccess, toast]);

  const submitWebForm = (gatewayUrl: string, fields: Record<string, string>) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = gatewayUrl;
    form.style.display = 'none';
    for (const [key, value] of Object.entries(fields)) {
      const inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = key;
      inp.value = value;
      form.appendChild(inp);
    }
    document.body.appendChild(form);
    setGatewayStep('redirect');
    form.submit();
  };

  const buildAutoSubmitHtml = (url: string, fields: Record<string, string>) => {
    const inputs = Object.entries(fields)
      .map(([k, v]) => `<input type="hidden" name="${escHtml(k)}" value="${escHtml(v)}">`)
      .join('');
    return `<!DOCTYPE html><html><body><form id="f" method="POST" action="${escHtml(url)}">${inputs}</form><script>document.getElementById('f').submit();<\/script></body></html>`;
  };

  const openCapacitorBrowser = async (gatewayUrl: string, fields: Record<string, string>, orderId: string) => {
    try {
      const { Browser } = await import('@capacitor/browser');
      const html = buildAutoSubmitHtml(gatewayUrl, fields);
      await Browser.open({ url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html), presentationStyle: 'popover' });
      await Browser.addListener('browserFinished', () => {
        setGatewayStep('polling');
        startPolling(orderId);
      });
    } catch {
      window.open(buildAutoSubmitHtml(gatewayUrl, fields), '_blank');
      setGatewayStep('polling');
      startPolling(orderId);
    }
  };

  const handleGatewayPay = async () => {
    if (!selectedPkg) return;
    setGatewayStep('initiating');
    try {
      const platform = isCapacitor() ? 'app' : 'web';
      const returnBaseUrl = isCapacitor() ? undefined : window.location.origin;
      const result = await paymentGatewayApi.initiateUserPackageCheckout(
        selectedPkg.id, quantity, 'PAYHERE', platform, returnBaseUrl
      );
      setCurrentOrderId(result.orderId);

      if (isCapacitor()) {
        await openCapacitorBrowser(result.gatewayUrl, result.fields, result.orderId);
      } else {
        submitWebForm(result.gatewayUrl, result.fields);
      }
    } catch (err: any) {
      toast({
        title: 'Could not initiate payment',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
      setGatewayStep('idle');
    }
  };

  const manualRefresh = () => {
    if (!currentOrderId) return;
    paymentGatewayApi.getUserPackageOrderStatus(currentOrderId)
      .then(s => {
        setGatewayOrderStatus(s);
        if (s.status === 'SUCCESS') { setGatewayStep('success'); onSuccess(); }
        else if (s.status === 'FAILED')    setGatewayStep('failed');
        else if (s.status === 'CANCELLED') setGatewayStep('cancelled');
      })
      .catch(() => {});
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' && 'Choose a Plan'}
            {step === 'payment' && 'Payment'}
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

        {/* ─── Step 2: Payment ────────────────────────────────────── */}
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
                <Label className="text-xs mb-1 block">Quantity</Label>
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

            {/* Payment method tabs — only show switcher when gateway is enabled */}
            {gatewayEnabled && (
              <div className="flex gap-1 rounded-lg border p-1 bg-muted/30">
                <button
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-sm rounded-md transition-all ${
                    paymentTab === 'gateway' ? 'bg-white shadow-sm font-medium text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setPaymentTab('gateway')}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Pay Online – Instant
                </button>
                <button
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 text-sm rounded-md transition-all ${
                    paymentTab === 'slip' ? 'bg-white shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => { setPaymentTab('slip'); resetGateway(); }}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Slip
                </button>
              </div>
            )}

            {/* ── Gateway tab ───────────────────────────────────── */}
            {gatewayEnabled && paymentTab === 'gateway' && (
              <div>
                {gatewayStep === 'idle' && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 flex items-start gap-2">
                      <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>Your plan will be activated <strong>instantly</strong> after payment — no waiting for admin review.</span>
                    </div>
                    <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
                      <ShieldCheck className="h-3 w-3 mt-0.5 text-green-600 shrink-0" />
                      <span>Secured by PayHere. Your card details are never stored on our servers.</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setStep('select')} className="flex-1">Back</Button>
                      <Button onClick={handleGatewayPay} className="flex-1 gap-2">
                        <Zap className="h-4 w-4" />
                        Pay Rs. {totalPrice.toLocaleString()}
                      </Button>
                    </div>
                  </div>
                )}

                {gatewayStep === 'initiating' && (
                  <div className="flex flex-col items-center py-10 gap-3 text-muted-foreground">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <p className="text-sm font-medium">Preparing payment…</p>
                  </div>
                )}

                {gatewayStep === 'redirect' && (
                  <div className="flex flex-col items-center py-10 gap-3 text-muted-foreground text-center">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <p className="text-sm font-medium">Redirecting to PayHere…</p>
                    <p className="text-xs">Complete payment on PayHere and you'll be brought back automatically.</p>
                  </div>
                )}

                {gatewayStep === 'polling' && (
                  <div className="flex flex-col items-center py-8 gap-4 text-center">
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium">Waiting for confirmation…</p>
                      <p className="text-xs text-muted-foreground mt-1">Updates automatically every 5 seconds.</p>
                    </div>
                    {currentOrderId && (
                      <Button variant="outline" size="sm" onClick={manualRefresh} className="gap-1.5 h-7 text-xs">
                        <RefreshCw className="h-3 w-3" />Check now
                      </Button>
                    )}
                  </div>
                )}

                {gatewayStep === 'success' && (
                  <div className="flex flex-col items-center py-8 gap-4 text-center">
                    <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="h-7 w-7 text-green-600" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-green-700">Plan Activated!</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Your <span className="font-semibold text-foreground">{selectedPkg.name}</span> plan is now active.
                      </p>
                    </div>
                    <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
                  </div>
                )}

                {gatewayStep === 'failed' && (
                  <div className="flex flex-col items-center py-8 gap-4 text-center">
                    <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
                      <XCircle className="h-7 w-7 text-red-600" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-red-700">Payment Failed</p>
                      <p className="text-xs text-muted-foreground mt-1">No charge was made. Please try again.</p>
                    </div>
                    <div className="flex gap-2 w-full">
                      <Button variant="outline" className="flex-1" onClick={() => setStep('select')}>Back</Button>
                      <Button className="flex-1" onClick={resetGateway}>Try Again</Button>
                    </div>
                  </div>
                )}

                {gatewayStep === 'cancelled' && (
                  <div className="flex flex-col items-center py-8 gap-4 text-center">
                    <div className="h-14 w-14 rounded-full bg-yellow-100 flex items-center justify-center">
                      <AlertCircle className="h-7 w-7 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-base font-bold">Payment Cancelled</p>
                      <p className="text-xs text-muted-foreground mt-1">No charge was made.</p>
                    </div>
                    <div className="flex gap-2 w-full">
                      <Button variant="outline" className="flex-1" onClick={() => setStep('select')}>Back</Button>
                      <Button className="flex-1" onClick={resetGateway}>Try Again</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Slip upload tab ───────────────────────────────── */}
            {(!gatewayEnabled || paymentTab === 'slip') && (
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Payment slip will be reviewed by an admin within 1–2 business days before your plan is activated.
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
                  <Button onClick={handleSlipSubmit} disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</> : 'Submit Payment'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Step 3: Done (slip submitted) ──────────────────────── */}
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
