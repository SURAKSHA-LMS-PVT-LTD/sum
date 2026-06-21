import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ArrowLeft, Key, CheckCircle2, RotateCcw, Mail, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getBaseUrl,
  getAllMainResetContacts,
  type MainResetContact,
  initiateMainWaReset,
  getMainWaResetStatus,
  resetMainPasswordViaWa,
} from '@/contexts/utils/auth.api';
import { getErrorMessage } from '@/api/apiError';
import surakshaLogo from '@/assets/suraksha-logo.png';
import loginIllustration from '@/assets/login-illustration.png';

type Step =
  | 'identify'
  | 'pick-contact'
  | 'otp'
  | 'wa-verify';

function WaVerifyPanel({ waLink, verified }: { waLink: string; verified: boolean }) {
  const [qr, setQr] = React.useState('');
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const [showQr, setShowQr] = React.useState(isDesktop);
  React.useEffect(() => {
    if (!waLink) { setQr(''); return; }
    import('qrcode').then((m: any) => {
      (m.default || m).toDataURL(waLink, { width: 180, margin: 1 }).then(setQr).catch(() => setQr(''));
    });
  }, [waLink]);

  if (verified) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">WhatsApp verified!</p>
          <p className="text-xs opacity-80">Now set your new password below.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Step badge */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground font-bold text-[10px]">1</span>
        Send the code from WhatsApp
      </div>

      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:opacity-90 active:scale-[.98] transition-all shadow-sm"
        >
          <Phone className="h-4 w-4" />
          Open WhatsApp &amp; Send Code
        </a>
      )}

      {/* QR toggle — only show on desktop hint */}
      {qr && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowQr(v => !v)}
            className="text-xs text-primary underline underline-offset-2"
          >
            {showQr ? 'Hide QR code' : 'Show QR code (optional)'}
          </button>
          {showQr && (
            <div className="flex flex-col items-center gap-1 mt-2 p-3 rounded-xl bg-white border shadow-sm">
              <img src={qr} alt="WhatsApp QR" width={140} height={140} />
              <span className="text-[10px] text-muted-foreground">Scan with your phone camera</span>
            </div>
          )}
        </div>
      )}

      {/* Waiting status */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 rounded-lg bg-muted/60">
        <RotateCcw className="h-3.5 w-3.5 animate-spin shrink-0" />
        Waiting for your WhatsApp message…
      </div>

      {/* Divider before password section */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 border-t" />
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted font-bold text-[10px]">2</span>
          Then set new password
        </span>
        <div className="flex-1 border-t" />
      </div>
    </div>
  );
}

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const baseUrl = getBaseUrl();
  const panelRef = React.useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>('identify');

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);
  const [identifier, setIdentifier] = useState('');
  const [contacts, setContacts] = useState<MainResetContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<MainResetContact | null>(null);

  const [otp, setOtp] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  const [waLink, setWaLink] = useState('');
  const [waVerified, setWaVerified] = useState(false);
  const [waPolling, setWaPolling] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (otpTimer <= 0) return;
    const t = setTimeout(() => setOtpTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [otpTimer]);

  useEffect(() => {
    if (!waPolling || waVerified) return;
    let cancelled = false;
    const iv = setInterval(async () => {
      try {
        const { verified, expired } = await getMainWaResetStatus(identifier.trim());
        if (cancelled) return;
        if (verified) {
          setWaVerified(true);
          setWaPolling(false);
          toast({ title: 'Verified', description: 'WhatsApp code confirmed. Set your new password.' });
        } else if (expired) {
          setWaPolling(false);
          setError('WhatsApp verification expired. Please start over.');
        }
      } catch { /* keep polling */ }
    }, 3000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [waPolling, waVerified, identifier, toast]);

  const goLogin = () => navigate('/');
  const goBack = () => {
    setStep('identify');
    setError('');
    setContacts([]);
    setSelectedContact(null);
    setOtp('');
    setWaLink('');
    setWaVerified(false);
    setWaPolling(false);
  };

  const handleIdentifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setIsLoading(true);
    try {
      const { contacts: fetched } = await getAllMainResetContacts(identifier.trim());
      if (fetched.length === 0) {
        setError('No account found, or no contacts available. Please contact support.');
        return;
      }
      setContacts(fetched);
      setSelectedContact(fetched[0]);
      setStep('pick-contact');
    } catch (e: any) {
      setError(getErrorMessage(e, 'Failed to fetch contacts'));
    } finally { setIsLoading(false); }
  };

  const handleContactPick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact) { setError('Please select a contact.'); return; }
    setError(''); setIsLoading(true);
    try {
      if (selectedContact.type === 'email') {
        const res = await fetch(`${baseUrl}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: identifier.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to send code');
        toast({ title: 'Code Sent', description: `A 6-digit code was sent to ${selectedContact.masked}` });
        setStep('otp');
        setOtpTimer(60);
      } else {
        const result = await initiateMainWaReset(identifier.trim(), selectedContact.id);
        setWaLink(result.waLink);
        setWaVerified(false);
        setWaPolling(true);
        setStep('wa-verify');
      }
    } catch (e: any) {
      setError(getErrorMessage(e, 'Failed to proceed'));
    } finally { setIsLoading(false); }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    const pwdRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!pwdRe.test(newPassword)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
      return;
    }
    setError(''); setIsLoading(true);
    try {
      const res = await fetch(`${baseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), otp, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to reset password');
      toast({ title: 'Password Reset!', description: 'You can now log in with your new password.' });
      navigate('/');
    } catch (e: any) {
      setError(getErrorMessage(e, 'Failed to reset password'));
    } finally { setIsLoading(false); }
  };

  const resendOtp = async () => {
    setError(''); setIsLoading(true);
    try {
      const res = await fetch(`${baseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to resend');
      toast({ title: 'Code Resent' });
      setOtp('');
      setOtpTimer(60);
    } catch (e: any) {
      setError(getErrorMessage(e, 'Failed to resend'));
    } finally { setIsLoading(false); }
  };

  const handleWaVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waVerified) { setError('Send the WhatsApp code first.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setError(''); setIsLoading(true);
    try {
      await resetMainPasswordViaWa(identifier.trim(), newPassword);
      toast({ title: 'Password Reset!', description: 'You can now log in with your new password.' });
      navigate('/');
    } catch (e: any) {
      setError(getErrorMessage(e, 'Failed to reset password'));
    } finally { setIsLoading(false); }
  };

  const stepTitle: Record<Step, string> = {
    identify: 'Forgot Password',
    'pick-contact': 'Choose Verification Method',
    otp: 'Enter Reset Code',
    'wa-verify': 'WhatsApp Verification',
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row overflow-x-hidden bg-background md:bg-none">
      <div className="block md:hidden w-full relative h-[45vw] max-h-[40vh] shrink-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
        <img src={loginIllustration} alt="" className="absolute inset-0 w-full h-full object-cover object-top" loading="lazy" />
      </div>

      {/* Left panel — matches Login.tsx sizing exactly */}
      <div ref={panelRef} className="w-full md:w-3/5 lg:w-1/2 flex flex-col items-center justify-center px-5 py-7 sm:p-7 md:p-10 bg-background -mt-8 md:mt-0 rounded-t-[3rem] md:rounded-none relative z-10 flex-1 md:min-h-screen overflow-y-auto">
        <div className="w-full max-w-md md:max-w-lg space-y-6 md:space-y-7">
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden">
                <img src={surakshaLogo} alt="SurakshaLMS logo" className="w-full h-full object-contain" loading="lazy" />
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">SurakshaLMS</h1>
            <p className="text-sm text-muted-foreground">{stepTitle[step]}</p>
          </div>

          <Card className="border-border/50 shadow-md lg:shadow-lg">
            <CardContent className="p-5 md:p-8 lg:p-10 space-y-5">

              {step === 'identify' && (
                <form onSubmit={handleIdentifySubmit} className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Key className="h-4 w-4 text-primary" />
                    <h2 className="text-base font-semibold">Reset your password</h2>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fp-identifier" className="text-sm">Email, Phone, ID or Birth Certificate</Label>
                    <Input
                      id="fp-identifier"
                      type="text"
                      placeholder="Enter email, phone, ID…"
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      required
                      className="h-11 text-sm rounded-lg"
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground bg-primary/10 p-3 rounded-lg">
                    We will show all contacts linked to your account so you can choose how to verify.
                  </p>
                  {error && <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</p>}
                  <Button type="submit" className="w-full h-11 text-sm font-semibold rounded-lg" disabled={isLoading || !identifier.trim()}>
                    {isLoading ? 'Looking up…' : 'Continue'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={goLogin} className="w-full h-9 text-sm">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back to Login
                  </Button>
                </form>
              )}

              {step === 'pick-contact' && (
                <form onSubmit={handleContactPick} className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Key className="h-4 w-4 text-primary" />
                    <h2 className="text-base font-semibold">Where should we send the code?</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Phone numbers verify via WhatsApp. Emails receive a 6-digit OTP code.
                  </p>
                  <div className="space-y-2">
                    {contacts.map(c => (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedContact?.id === c.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                      >
                        <input
                          type="radio"
                          name="contact"
                          value={c.id}
                          checked={selectedContact?.id === c.id}
                          onChange={() => setSelectedContact(c)}
                          className="accent-primary w-4 h-4 shrink-0"
                        />
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {c.type === 'email'
                            ? <Mail className="h-4 w-4 text-blue-500 shrink-0" />
                            : <Phone className="h-4 w-4 text-[#25D366] shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{c.label}</p>
                            <p className="text-xs text-muted-foreground font-mono">{c.masked}</p>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${c.type === 'email' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                            {c.type === 'email' ? 'Email OTP' : 'WhatsApp'}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                  {error && <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</p>}
                  <Button type="submit" className="w-full h-11 text-sm font-semibold rounded-lg" disabled={isLoading || !selectedContact}>
                    {isLoading ? 'Sending…' : selectedContact?.type === 'email' ? 'Send Email Code' : 'Verify via WhatsApp'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={goBack} className="w-full h-9 text-sm">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                </form>
              )}

              {step === 'otp' && (
                <form onSubmit={handleOtpSubmit} className="space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Key className="h-4 w-4 text-primary" />
                    <h2 className="text-base font-semibold">Enter reset code</h2>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    We sent a 6-digit code to <span className="font-mono font-medium">{selectedContact?.masked}</span>.
                  </p>
                  <div className="flex justify-center py-1">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp} className="gap-2">
                      <InputOTPGroup className="gap-2">
                        {[0,1,2,3,4,5].map(i => (
                          <InputOTPSlot key={i} index={i} className="w-11 h-13 text-lg md:w-12 md:h-14" />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">New Password</Label>
                      <div className="relative">
                        <Input type={showNewPwd ? 'text' : 'password'} placeholder="Min 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} className="h-11 text-sm pr-12 rounded-lg" autoComplete="new-password" />
                        <button type="button" onClick={() => setShowNewPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs">{showNewPwd ? 'Hide' : 'Show'}</button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Confirm Password</Label>
                      <div className="relative">
                        <Input type={showConfirmPwd ? 'text' : 'password'} placeholder="Repeat new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} className="h-11 text-sm pr-12 rounded-lg" autoComplete="new-password" />
                        <button type="button" onClick={() => setShowConfirmPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs">{showConfirmPwd ? 'Hide' : 'Show'}</button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground bg-muted/50 p-2 rounded-md">
                    8+ chars · uppercase · lowercase · number · special (@$!%*?&amp;)
                  </p>
                  {error && <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</p>}
                  <Button type="submit" className="w-full h-11 text-sm font-semibold rounded-lg" disabled={isLoading || otp.length < 6 || !newPassword || !confirmPassword}>
                    {isLoading ? 'Resetting…' : 'Reset Password'}
                  </Button>
                  <div className="text-center text-xs text-muted-foreground">
                    {otpTimer > 0
                      ? `Resend in ${otpTimer}s`
                      : <button type="button" onClick={resendOtp} disabled={isLoading} className="underline underline-offset-2 text-primary">Resend code</button>
                    }
                  </div>
                  <Button type="button" variant="ghost" onClick={() => { setStep('pick-contact'); setError(''); setOtp(''); }} className="w-full h-9 text-sm">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                </form>
              )}

              {step === 'wa-verify' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    <h2 className="text-base font-semibold">WhatsApp Verification</h2>
                  </div>

                  {/* Always-visible WA action panel */}
                  <WaVerifyPanel waLink={waLink} verified={waVerified} />

                  {/* Password section — only shown after verification */}
                  {waVerified && (
                    <form onSubmit={handleWaVerifySubmit} className="space-y-4 pt-1">
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm">New Password</Label>
                          <div className="relative">
                            <Input type={showNewPwd ? 'text' : 'password'} placeholder="Min 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} className="h-11 text-sm pr-16 rounded-lg" autoComplete="new-password" />
                            <button type="button" onClick={() => setShowNewPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs">{showNewPwd ? 'Hide' : 'Show'}</button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm">Confirm Password</Label>
                          <div className="relative">
                            <Input type={showConfirmPwd ? 'text' : 'password'} placeholder="Repeat new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} className="h-11 text-sm pr-16 rounded-lg" autoComplete="new-password" />
                            <button type="button" onClick={() => setShowConfirmPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs">{showConfirmPwd ? 'Hide' : 'Show'}</button>
                          </div>
                        </div>
                      </div>
                      {error && <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</p>}
                      <Button type="submit" className="w-full h-11 text-sm font-semibold rounded-lg" disabled={isLoading}>
                        {isLoading ? 'Resetting…' : 'Reset Password'}
                      </Button>
                    </form>
                  )}

                  <Button type="button" variant="ghost" onClick={() => { setStep('pick-contact'); setError(''); setWaLink(''); setWaVerified(false); setWaPolling(false); }} className="w-full h-9 text-sm">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                </div>
              )}

            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right illustration — sticky so it stays fixed while left panel scrolls */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 relative min-h-[300px] md:min-h-screen">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5" />
        <img src={loginIllustration} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-multiply" loading="lazy" />
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
