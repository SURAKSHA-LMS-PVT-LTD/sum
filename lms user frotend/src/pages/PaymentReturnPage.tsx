import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { paymentGatewayApi, GatewayOrderStatus } from '@/api/paymentGateway.api';
import { useAuth } from '@/contexts/AuthContext';

type ViewState = 'loading' | 'success' | 'failed' | 'cancelled' | 'error';

const MAX_POLLS = 24; // 2 minutes at 5s

const PaymentReturnPage: React.FC<{ cancelled?: boolean }> = ({ cancelled = false }) => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { currentInstituteId } = useAuth();

  const orderId = params.get('order_id');

  const [view, setView]     = useState<ViewState>(cancelled ? 'cancelled' : 'loading');
  const [order, setOrder]   = useState<GatewayOrderStatus | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (cancelled || !orderId || !currentInstituteId) {
      if (!orderId) setView('error');
      return;
    }

    let count = 0;
    const timer = setInterval(async () => {
      count++;
      try {
        const status = await paymentGatewayApi.getOrderStatus(currentInstituteId, orderId);
        setOrder(status);
        setAttempts(count);
        if (status.status === 'SUCCESS') { clearInterval(timer); setView('success'); }
        else if (status.status === 'FAILED') { clearInterval(timer); setView('failed'); }
        else if (status.status === 'CANCELLED') { clearInterval(timer); setView('cancelled'); }
        else if (count >= MAX_POLLS) { clearInterval(timer); setView('failed'); }
      } catch {
        if (count >= MAX_POLLS) { clearInterval(timer); setView('error'); }
      }
    }, 5000);

    // First poll immediately
    paymentGatewayApi.getOrderStatus(currentInstituteId, orderId)
      .then(s => {
        setOrder(s);
        if (s.status === 'SUCCESS') { clearInterval(timer); setView('success'); }
        else if (s.status === 'FAILED') { clearInterval(timer); setView('failed'); }
        else if (s.status === 'CANCELLED') { clearInterval(timer); setView('cancelled'); }
      }).catch(() => {});

    return () => clearInterval(timer);
  }, [orderId, currentInstituteId, cancelled]);

  const goBack = () => navigate(-1);
  const goBilling = () => navigate('/institute-billing');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-lg p-8 flex flex-col items-center gap-5 text-center">

        {view === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div>
              <p className="text-base font-bold">Confirming payment…</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please wait while we verify your payment with PayHere.
              </p>
              {attempts > 0 && (
                <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                  Checking… ({attempts}/{MAX_POLLS})
                </p>
              )}
            </div>
          </>
        )}

        {view === 'success' && (
          <>
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-green-700">Payment Successful!</p>
              {order && (
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-semibold text-foreground">{order.credits}</span> credits
                  have been added to your wallet.
                </p>
              )}
            </div>
            <Button className="w-full" onClick={goBilling}>View Billing</Button>
          </>
        )}

        {view === 'failed' && (
          <>
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-red-700">Payment Failed</p>
              <p className="text-xs text-muted-foreground mt-1">
                No credits were deducted. Please try again.
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={goBack}>Go Back</Button>
              <Button className="flex-1" onClick={goBilling}>Billing</Button>
            </div>
          </>
        )}

        {view === 'cancelled' && (
          <>
            <div className="h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
            <div>
              <p className="text-lg font-bold">Payment Cancelled</p>
              <p className="text-xs text-muted-foreground mt-1">
                You cancelled the payment. No credits were charged.
              </p>
            </div>
            <Button className="w-full" onClick={goBack}>Go Back</Button>
          </>
        )}

        {view === 'error' && (
          <>
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-bold">Unable to verify</p>
              <p className="text-xs text-muted-foreground mt-1">
                We could not confirm your payment status. Please check your billing page.
              </p>
            </div>
            <Button className="w-full" onClick={goBilling}>View Billing</Button>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentReturnPage;
