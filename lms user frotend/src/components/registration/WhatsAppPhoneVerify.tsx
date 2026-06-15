import React, { useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircle, CheckCircle2, RefreshCw, QrCode, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  requestPhoneOtpWhatsApp,
  getPhoneOtpStatus,
} from '@/api/otpVerification.api';

interface WhatsAppPhoneVerifyProps {
  /** Cleaned phone number being verified (e.g. +94771234567). */
  phoneNumber: string;
  /** Called once the WhatsApp OTP is confirmed by the webhook. */
  onVerified: () => void;
}

/**
 * Reverse-OTP phone verification via WhatsApp.
 *
 * Flow: request a wa.me link → desktop shows a QR (scan on phone) + an
 * "Open WhatsApp Web" button; mobile shows a "Open WhatsApp" tap link →
 * user sends the pre-filled "OTP 123456" message → user clicks "I've sent it,
 * check now" → we hit the status endpoint once. No code is ever typed here.
 */
const WhatsAppPhoneVerify: React.FC<WhatsAppPhoneVerifyProps> = ({ phoneNumber, onVerified }) => {
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  // "Open WhatsApp Web" uses web.whatsapp.com; the wa.me link works for both
  // app and web, but on desktop we surface the web variant explicitly.
  const webWhatsAppLink = waLink ? waLink.replace('https://wa.me/', 'https://web.whatsapp.com/send/?phone=').replace('?text=', '&text=') : null;

  const handleRequest = useCallback(async () => {
    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 5) {
      toast({ title: 'Enter a phone number first', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await requestPhoneOtpWhatsApp(phoneNumber);
      setWaLink(res.waLink);
      // Generate a QR of the wa.me link for desktop scanning.
      const qr = await QRCode.toDataURL(res.waLink, { width: 240, margin: 1, errorCorrectionLevel: 'M' });
      setQrDataUrl(qr);
      toast({ title: 'Ready', description: 'Send the WhatsApp message, then check status.' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to start WhatsApp verification', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [phoneNumber, toast]);

  const handleCheckStatus = useCallback(async () => {
    setChecking(true);
    try {
      const res = await getPhoneOtpStatus(phoneNumber);
      if (res.verified) {
        setVerified(true);
        toast({ title: 'Phone Verified', description: 'Your phone number has been verified via WhatsApp.' });
        onVerified();
      } else if (res.expired) {
        toast({ title: 'Code expired', description: 'Please request a new WhatsApp verification.', variant: 'destructive' });
        setWaLink(null);
        setQrDataUrl(null);
      } else {
        toast({ title: 'Not verified yet', description: 'Make sure you sent the WhatsApp message, then check again.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Status check failed', variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  }, [phoneNumber, onVerified, toast]);

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

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={handleCheckStatus} disabled={checking} className="flex-1 h-10 gap-2">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          I've sent it — check now
        </Button>
        <Button variant="ghost" size="sm" onClick={handleRequest} disabled={loading} className="h-10 px-2" title="New code">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        ⚠️ You must send from <strong>this</strong> number ({phoneNumber}) — codes sent from another phone are rejected.
      </p>
    </div>
  );
};

export default WhatsAppPhoneVerify;
