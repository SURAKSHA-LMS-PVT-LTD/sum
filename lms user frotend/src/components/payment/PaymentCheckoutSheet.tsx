/**
 * PaymentCheckoutSheet
 *
 * Provider-agnostic credit top-up sheet.
 * - Web:      POSTs a hidden form to the gateway URL (standard redirect flow).
 * - Capacitor: Opens the gateway URL in the in-app browser plugin and polls
 *              order status until settled.
 *
 * Switching provider (PayHere → SmartPay) requires no change here —
 * the backend returns the correct gatewayUrl + fields per provider.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard, Loader2, CheckCircle2, XCircle, AlertCircle,
  Zap, RefreshCw, ExternalLink, ShieldCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { paymentGatewayApi, GatewayOrderStatus } from '@/api/paymentGateway.api';

// ─── Capacitor detection ──────────────────────────────────────────────────────
const isCapacitor = () =>
  typeof (window as any).Capacitor !== 'undefined' &&
  (window as any).Capacitor.isNativePlatform?.();

// ─── Credit packages ──────────────────────────────────────────────────────────
const PACKAGES = [
  { credits: 100,  price: 100,  label: '100 Credits',  tag: '' },
  { credits: 250,  price: 250,  label: '250 Credits',  tag: 'Popular' },
  { credits: 500,  price: 500,  label: '500 Credits',  tag: '' },
  { credits: 1000, price: 1000, label: '1000 Credits', tag: 'Best Value' },
];

// ─── Types ─────────────────────────────────────────────────────────────────────

type CheckoutStep = 'select' | 'initiating' | 'redirect' | 'polling' | 'success' | 'failed' | 'cancelled';

interface PaymentCheckoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (credits: number) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

const PaymentCheckoutSheet: React.FC<PaymentCheckoutSheetProps> = ({
  open, onOpenChange, onSuccess,
}) => {
  const { toast } = useToast();
  const { currentInstituteId } = useAuth();

  const [step, setStep] = useState<CheckoutStep>('select');
  const [selectedCredits, setSelectedCredits] = useState<number>(250);
  const [customCredits, setCustomCredits] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<GatewayOrderStatus | null>(null);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const formRef  = useRef<HTMLFormElement | null>(null);

  const credits = useCustom ? (parseInt(customCredits) || 0) : selectedCredits;
  const price   = credits; // 1 credit = 1 LKR

  const reset = useCallback(() => {
    setStep('select');
    setCurrentOrderId(null);
    setOrderStatus(null);
    setUseCustom(false);
    setCustomCredits('');
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // ── Poll order status ────────────────────────────────────────────────────────
  const startPolling = useCallback((orderId: string) => {
    if (!currentInstituteId) return;
    let attempts = 0;
    const MAX = 60; // 5 minutes at 5s interval

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const status = await paymentGatewayApi.getOrderStatus(currentInstituteId, orderId);
        setOrderStatus(status);

        if (status.status === 'SUCCESS') {
          clearInterval(pollRef.current!);
          setStep('success');
          onSuccess?.(status.credits);
          toast({ title: `${status.credits} credits added to your wallet!` });
        } else if (status.status === 'FAILED') {
          clearInterval(pollRef.current!);
          setStep('failed');
        } else if (status.status === 'CANCELLED') {
          clearInterval(pollRef.current!);
          setStep('cancelled');
        } else if (attempts >= MAX) {
          clearInterval(pollRef.current!);
          // Still pending — leave in polling state so user can manually refresh
        }
      } catch {
        // Network error — keep polling
      }
    }, 5000);
  }, [currentInstituteId, onSuccess, toast]);

  // ── Initiate checkout ────────────────────────────────────────────────────────
  const initiateCheckout = async () => {
    if (!currentInstituteId || credits < 1) return;
    setStep('initiating');

    try {
      // Tell backend which secret to use: app secret for Capacitor, web secret for browser
      const platform = isCapacitor() ? 'app' : 'web';
      // Pass the current origin so return_url / cancel_url point back to whichever
      // domain (lms.suraksha.lk or a custom domain) the institute admin is using.
      const returnBaseUrl = isCapacitor() ? undefined : window.location.origin;
      const result = await paymentGatewayApi.initiateCheckout(currentInstituteId, credits, 'PAYHERE', platform, returnBaseUrl);
      setCurrentOrderId(result.orderId);

      if (isCapacitor()) {
        // ── Capacitor: open in-app browser ─────────────────────────────────────
        await openCapacitorBrowser(result.gatewayUrl, result.fields, result.orderId);
      } else {
        // ── Web: hidden form POST ──────────────────────────────────────────────
        submitWebForm(result.gatewayUrl, result.fields);
      }
    } catch (err: any) {
      toast({
        title: 'Could not initiate payment',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
      setStep('select');
    }
  };

  // ── Web: build and submit hidden form ────────────────────────────────────────
  const submitWebForm = (gatewayUrl: string, fields: Record<string, string>) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = gatewayUrl;
    form.style.display = 'none';

    for (const [key, value] of Object.entries(fields)) {
      const input = document.createElement('input');
      input.type  = 'hidden';
      input.name  = key;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    setStep('redirect');
    form.submit();
    // Page will navigate to PayHere — on return the return_url page
    // calls back to this component via URL param or re-open with orderId.
  };

  // ── Capacitor: browser plugin ────────────────────────────────────────────────
  const openCapacitorBrowser = async (
    gatewayUrl: string,
    fields: Record<string, string>,
    orderId: string,
  ) => {
    try {
      // Build a URL-encoded POST equivalent for the in-app browser.
      // We open a small intermediate page that auto-submits the form.
      const formHtml = buildAutoSubmitHtml(gatewayUrl, fields);
      const dataUrl  = 'data:text/html;charset=utf-8,' + encodeURIComponent(formHtml);

      // Try @capacitor/browser plugin
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: dataUrl, presentationStyle: 'popover' });

      // Listen for close event — start polling
      await Browser.addListener('browserFinished', () => {
        setStep('polling');
        startPolling(orderId);
      });
    } catch {
      // Fallback: open system browser
      window.open(buildAutoSubmitHtml(gatewayUrl, fields), '_blank');
      setStep('polling');
      startPolling(orderId);
    }
  };

  const buildAutoSubmitHtml = (url: string, fields: Record<string, string>): string => {
    const inputs = Object.entries(fields)
      .map(([k, v]) => `<input type="hidden" name="${escHtml(k)}" value="${escHtml(v)}">`)
      .join('');
    return `<!DOCTYPE html><html><body><form id="f" method="POST" action="${escHtml(url)}">${inputs}</form><script>document.getElementById('f').submit();<\/script></body></html>`;
  };

  const escHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ── Manual poll refresh ──────────────────────────────────────────────────────
  const manualRefresh = () => {
    if (!currentOrderId || !currentInstituteId) return;
    paymentGatewayApi.getOrderStatus(currentInstituteId, currentOrderId)
      .then(s => {
        setOrderStatus(s);
        if (s.status === 'SUCCESS') { setStep('success'); onSuccess?.(s.credits); }
        else if (s.status === 'FAILED')    setStep('failed');
        else if (s.status === 'CANCELLED') setStep('cancelled');
      })
      .catch(() => {});
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={v => { if (step === 'select' || step === 'success' || step === 'failed' || step === 'cancelled') { if (!v) reset(); onOpenChange(v); } }}>
      <SheetContent side="right" className="w-80 sm:w-96 p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 text-sm font-bold">
            <CreditCard className="h-4 w-4 text-primary" />Top Up Credits
          </SheetTitle>
          <SheetDescription className="text-xs">
            Credits are added instantly after payment
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* ── SELECT ────────────────────────────────────────────────── */}
          {step === 'select' && (
            <>
              {/* Package grid */}
              <div className="grid grid-cols-2 gap-2">
                {PACKAGES.map(pkg => (
                  <button key={pkg.credits}
                    onClick={() => { setUseCustom(false); setSelectedCredits(pkg.credits); }}
                    className={`relative rounded-xl border p-3 text-left transition-all active:scale-95 ${
                      !useCustom && selectedCredits === pkg.credits
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40 hover:bg-muted/30'
                    }`}>
                    {pkg.tag && (
                      <span className="absolute -top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                        {pkg.tag}
                      </span>
                    )}
                    <p className="text-sm font-bold">{pkg.label}</p>
                    <p className="text-xs text-muted-foreground">LKR {pkg.price.toLocaleString()}</p>
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div>
                <button onClick={() => setUseCustom(u => !u)}
                  className="text-xs text-primary underline underline-offset-2">
                  {useCustom ? 'Use a preset' : 'Enter custom amount'}
                </button>
                {useCustom && (
                  <div className="mt-2 space-y-1">
                    <Label className="text-xs">Credits</Label>
                    <Input
                      type="number" min={10} step={10}
                      value={customCredits}
                      onChange={e => setCustomCredits(e.target.value)}
                      placeholder="e.g. 300"
                      className="h-8 text-sm"
                    />
                    {credits > 0 && (
                      <p className="text-xs text-muted-foreground">Cost: LKR {credits.toLocaleString()}</p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Summary */}
              <div className="rounded-xl bg-muted/40 border p-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Credits</span><span className="font-semibold">{credits}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">LKR {price.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Auto-verified</span><span className="text-green-600 font-semibold">Instant</span></div>
              </div>

              {/* Security note */}
              <div className="flex items-start gap-2 text-[10px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3 mt-0.5 text-green-600 shrink-0" />
                <span>Payment secured by PayHere. Your card details are never stored on our servers.</span>
              </div>

              <Button
                className="w-full gap-2 h-9"
                onClick={initiateCheckout}
                disabled={credits < 10}
              >
                <Zap className="h-4 w-4" />
                Pay LKR {price > 0 ? price.toLocaleString() : '—'}
              </Button>
            </>
          )}

          {/* ── INITIATING ────────────────────────────────────────────── */}
          {step === 'initiating' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Preparing payment…</p>
            </div>
          )}

          {/* ── REDIRECT (web — user left the page) ──────────────────── */}
          {step === 'redirect' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground text-center">
              <ExternalLink className="h-8 w-8 text-primary" />
              <p className="text-sm font-medium">Redirecting to payment gateway…</p>
              <p className="text-xs">Complete your payment and you will be brought back automatically.</p>
            </div>
          )}

          {/* ── POLLING (Capacitor / manual) ──────────────────────────── */}
          {step === 'polling' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">Waiting for payment confirmation…</p>
                <p className="text-xs text-muted-foreground mt-1">This updates automatically every 5 seconds.</p>
              </div>
              {currentOrderId && (
                <Button variant="outline" size="sm" onClick={manualRefresh} className="gap-1.5 h-7 text-xs">
                  <RefreshCw className="h-3 w-3" />Check now
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground font-mono">Order: {currentOrderId?.slice(0, 8)}…</p>
            </div>
          )}

          {/* ── SUCCESS ───────────────────────────────────────────────── */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <p className="text-base font-bold text-green-700">Payment Successful!</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  <span className="font-semibold text-foreground">{orderStatus?.credits}</span> credits added to your wallet.
                </p>
              </div>
              <Button className="w-full h-8 text-sm" onClick={() => { reset(); onOpenChange(false); }}>
                Done
              </Button>
            </div>
          )}

          {/* ── FAILED ────────────────────────────────────────────────── */}
          {step === 'failed' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-7 w-7 text-red-600" />
              </div>
              <div>
                <p className="text-base font-bold text-red-700">Payment Failed</p>
                <p className="text-xs text-muted-foreground mt-1">No credits were deducted. Please try again.</p>
              </div>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1 h-8 text-xs" onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
                <Button className="flex-1 h-8 text-xs" onClick={reset}>Try Again</Button>
              </div>
            </div>
          )}

          {/* ── CANCELLED ─────────────────────────────────────────────── */}
          {step === 'cancelled' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div className="h-14 w-14 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-yellow-600" />
              </div>
              <div>
                <p className="text-base font-bold">Payment Cancelled</p>
                <p className="text-xs text-muted-foreground mt-1">You cancelled the payment. No credits were charged.</p>
              </div>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1 h-8 text-xs" onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
                <Button className="flex-1 h-8 text-xs" onClick={reset}>Try Again</Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PaymentCheckoutSheet;
