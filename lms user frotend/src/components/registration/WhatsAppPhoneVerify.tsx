import React, { useState, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircle, CheckCircle2, RefreshCw, QrCode, ExternalLink, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  requestPhoneOtpWhatsApp,
  getPhoneOtpStatus,
} from '@/api/otpVerification.api';

interface WhatsAppRequestResult {
  waLink: string;
  expiresAt?: string;
  /** When the contact already belongs to an account (public self-registration claim flow). */
  existingUserId?: string | null;
}
interface WhatsAppStatusResult {
  verified: boolean;
  expired: boolean;
}

interface WhatsAppPhoneVerifyProps {
  /** Cleaned phone number being verified (e.g. +94771234567). */
  phoneNumber: string;
  /** Called once the WhatsApp OTP is confirmed by the webhook. */
  onVerified: () => void;
  /**
   * Optional injected request fn. Defaults to the standard registration OTP endpoint.
   * The public /forms flow injects its token-scoped variant so the same UI is reused.
   */
  requestFn?: (phoneNumber: string) => Promise<WhatsAppRequestResult>;
  /** Optional injected status-check fn. Defaults to the standard endpoint. */
  statusFn?: (phoneNumber: string) => Promise<WhatsAppStatusResult>;
  /** Called with the existing account id (if the request fn reports one). */
  onExisting?: (existingUserId: string) => void;
  /**
   * Phased auto-check after requesting (forgot-password pattern): wait `initialDelayMs`,
   * then run a few spaced status checks, then stop and leave the manual button.
   * Off by default (manual-only). Pass `autoPoll` to enable the default schedule.
   */
  autoPoll?: boolean;
}

// Default phased schedule (mirrors ForgotPasswordPage): first check at 30s, second at 55s
// (i.e. +25s), then stop — manual button remains. No continuous polling.
const AUTO_CHECK_DELAYS_MS = [30_000, 25_000];

/**
 * Reverse-OTP phone verification via WhatsApp.
 *
 * Flow: request a wa.me link → desktop shows a QR (scan on phone) + an
 * "Open WhatsApp Web" button; mobile shows a "Open WhatsApp" tap link →
 * user sends the pre-filled "OTP 123456" message → user clicks "I've sent it,
 * check now" → we hit the status endpoint once. No code is ever typed here.
 */
const defaultRequestFn = (phone: string): Promise<WhatsAppRequestResult> => requestPhoneOtpWhatsApp(phone);
const defaultStatusFn = (phone: string): Promise<WhatsAppStatusResult> => getPhoneOtpStatus(phone);

/** mm:ss countdown to an ISO expiry; null when none/elapsed. */
function useCountdown(expiresAt: string | null): number | null {
  const [secs, setSecs] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) { setSecs(null); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecs(remaining);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return secs;
}

export function fmtMMSS(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const WhatsAppPhoneVerify: React.FC<WhatsAppPhoneVerifyProps> = ({
  phoneNumber, onVerified, requestFn = defaultRequestFn, statusFn = defaultStatusFn, onExisting, autoPoll = false,
}) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const remaining = useCountdown(verified ? null : expiresAt);
  const expired = remaining !== null && remaining <= 0;

  const webWhatsAppLink = waLink ? waLink.replace('https://wa.me/', 'https://web.whatsapp.com/send/?phone=').replace('?text=', '&text=') : null;

  const markVerified = useCallback(() => {
    setVerified(true);
    onVerified();
  }, [onVerified]);

  const handleRequest = useCallback(async () => {
    if (loading) return; // double-submit guard
    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 5) {
      toast({ title: 'Enter a phone number first', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await requestFn(phoneNumber);
      setWaLink(res.waLink);
      setExpiresAt(res.expiresAt ?? null);
      if (res.existingUserId && onExisting) onExisting(res.existingUserId);
      const qr = await QRCode.toDataURL(res.waLink, { width: 240, margin: 1, errorCorrectionLevel: 'M' });
      setQrDataUrl(qr);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to start WhatsApp verification', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [phoneNumber, toast, requestFn, onExisting, loading]);

  const handleCheckStatus = useCallback(async (silent = false) => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await statusFn(phoneNumber);
      if (res.verified) {
        if (!silent) toast({ title: 'Phone Verified', description: 'Your phone number has been verified via WhatsApp.' });
        markVerified();
      } else if (res.expired) {
        if (!silent) toast({ title: 'Code expired', description: 'Please request a new WhatsApp verification.', variant: 'destructive' });
        setWaLink(null); setQrDataUrl(null); setExpiresAt(null);
      } else if (!silent) {
        toast({ title: 'Not verified yet', description: 'Make sure you sent the WhatsApp message, then check again.', variant: 'destructive' });
      }
    } catch (err) {
      if (!silent) toast({ title: 'Error', description: err instanceof Error ? err.message : 'Status check failed', variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  }, [phoneNumber, markVerified, toast, statusFn, checking]);

  // Phased auto-check after a link is issued (forgot-password pattern): a couple of
  // spaced silent checks, then stop — the manual "Check now" button remains. No
  // continuous polling. Re-runs whenever a fresh link is requested (waLink changes).
  useEffect(() => {
    if (!autoPoll || !waLink || verified) return;
    let cancelled = false;
    const run = async () => {
      for (const delay of AUTO_CHECK_DELAYS_MS) {
        await new Promise(r => setTimeout(r, delay));
        if (cancelled || verified) return;
        await handleCheckStatus(true);
      }
    };
    void run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPoll, waLink]);

  if (verified) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 p-2 rounded-lg">
        <CheckCircle2 className="h-4 w-4" />
        <span>Phone verified via WhatsApp</span>
      </div>
    );
  }

  if (!waLink) {
    return (
      <Button onClick={handleRequest} disabled={loading} className="h-10 px-4 gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
        Verify via WhatsApp
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-green-500/30 bg-green-50/40 dark:bg-green-950/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
        <MessageCircle className="h-4 w-4" />
        Verify with WhatsApp
      </div>

      {isMobile ? (
        // ── Mobile: tap to open WhatsApp directly ──
        <a href={waLink} target="_blank" rel="noopener noreferrer" className="block">
          <Button className="w-full h-11 gap-2 bg-green-600 hover:bg-green-700">
            <ExternalLink className="h-4 w-4" />
            Open WhatsApp & send code
          </Button>
        </a>
      ) : (
        // ── Desktop: QR to scan on phone + WhatsApp Web fallback ──
        <div className="flex flex-col items-center gap-3">
          {qrDataUrl && (
            <div className="rounded-lg bg-white p-3 border">
              <img src={qrDataUrl} alt="Scan to verify via WhatsApp" className="h-40 w-40" />
            </div>
          )}
          <p className="text-xs text-muted-foreground flex items-center gap-1 text-center">
            <QrCode className="h-3.5 w-3.5" />
            Scan with your phone's camera, or use WhatsApp Web below. The message is pre-filled — just press send.
          </p>
          {webWhatsAppLink && (
            <a href={webWhatsAppLink} target="_blank" rel="noopener noreferrer" className="w-full">
              <Button variant="outline" className="w-full h-10 gap-2">
                <ExternalLink className="h-4 w-4" />
                Open WhatsApp Web
              </Button>
            </a>
          )}
        </div>
      )}

      {/* Expiry countdown */}
      {remaining !== null && (
        <p className={`text-[11px] text-center flex items-center justify-center gap-1 ${expired ? 'text-red-600' : 'text-muted-foreground'}`}>
          <Clock className="h-3 w-3" />
          {expired ? 'Code expired — request a new one' : `Code expires in ${fmtMMSS(remaining)}`}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={() => handleCheckStatus(false)} disabled={checking || expired} className="flex-1 h-10 gap-2">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {autoPoll ? 'Check now' : "I've sent it — check now"}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleRequest} disabled={loading} className="h-10 px-2" title="New code">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        ⚠️ You must send from <strong>this</strong> number ({phoneNumber}) — codes sent from another phone are rejected.
      </p>
    </div>
  );
};

export default WhatsAppPhoneVerify;
