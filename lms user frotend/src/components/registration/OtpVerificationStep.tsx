import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { PhoneInput } from '@/components/ui/phone-input';
import { Mail, Phone, CheckCircle2, Loader2, RefreshCw, Lock, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  requestEmailOtp, verifyEmailOtp, reRequestEmailOtp,
  requestPhoneOtp, verifyPhoneOtp, reRequestPhoneOtp,
} from '@/api/otpVerification.api';

interface OtpVerificationStepProps {
  title: string;
  subtitle?: string;
  emailRequired?: boolean;
  phoneRequired?: boolean;
  showPhone?: boolean;
  onVerified: (data: { email: string; phone: string; emailVerified: boolean; phoneVerified: boolean }) => void;
  onBack?: () => void;
  initialEmail?: string;
  initialPhone?: string;
}

const OtpVerificationStep: React.FC<OtpVerificationStepProps> = ({
  title,
  subtitle,
  emailRequired = true,
  phoneRequired = false,
  showPhone = true,
  onVerified,
  onBack,
  initialEmail = '',
  initialPhone = '+94',
}) => {
  const { toast } = useToast();

  // Email state
  const [email, setEmail] = useState(initialEmail);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailTimer, setEmailTimer] = useState(0);

  // Phone state
  const [phone, setPhone] = useState(initialPhone);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneTimer, setPhoneTimer] = useState(0);

  // Timers
  useEffect(() => {
    if (emailTimer <= 0) return;
    const t = setInterval(() => setEmailTimer(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [emailTimer]);

  useEffect(() => {
    if (phoneTimer <= 0) return;
    const t = setInterval(() => setPhoneTimer(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [phoneTimer]);

  // Check if can proceed
  const canProceed = useCallback(() => {
    const emailOk = emailRequired ? emailVerified : (!email || emailVerified);
    if (!showPhone) return emailOk;
    const phoneOk = phoneRequired ? phoneVerified : true;
    const phoneEntered = phone && phone.replace(/\D/g, '').length > 2;
    const phoneCheck = phoneEntered ? phoneVerified : true;
    return emailOk && phoneOk && phoneCheck;
  }, [emailRequired, phoneRequired, emailVerified, phoneVerified, email, phone, showPhone]);

  // Email handlers
  const handleSendEmailOtp = async () => {
    if (!email) return;
    setEmailLoading(true);
    try {
      await requestEmailOtp(email);
      setEmailOtpSent(true);
      setEmailTimer(60);
      toast({ title: 'OTP Sent', description: `Verification code sent to ${email}` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to send OTP', variant: 'destructive' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!emailOtp || emailOtp.length < 6) return;
    setEmailLoading(true);
    try {
      await verifyEmailOtp(email, emailOtp);
      setEmailVerified(true);
      toast({ title: 'Email Verified', description: 'Your email has been verified successfully.' });
    } catch (err) {
      toast({ title: 'Verification Failed', description: err instanceof Error ? err.message : 'Invalid OTP', variant: 'destructive' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleResendEmailOtp = async () => {
    setEmailLoading(true);
    try {
      const res = await reRequestEmailOtp(email);
      setEmailTimer(60);
      setEmailOtp('');
      toast({ title: 'OTP Resent', description: res.message });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to resend', variant: 'destructive' });
    } finally {
      setEmailLoading(false);
    }
  };

  // Phone handlers
  const getCleanPhone = () => phone.replace(/\s/g, '');

  const handleSendPhoneOtp = async () => {
    const clean = getCleanPhone();
    if (!clean || clean.length < 5) return;
    setPhoneLoading(true);
    try {
      await requestPhoneOtp(clean);
      setPhoneOtpSent(true);
      setPhoneTimer(60);
      toast({ title: 'OTP Sent', description: `Verification code sent via SMS` });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to send OTP', variant: 'destructive' });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyPhone = async () => {
    if (!phoneOtp || phoneOtp.length < 6) return;
    setPhoneLoading(true);
    try {
      await verifyPhoneOtp(getCleanPhone(), phoneOtp);
      setPhoneVerified(true);
      toast({ title: 'Phone Verified', description: 'Your phone number has been verified successfully.' });
    } catch (err) {
      toast({ title: 'Verification Failed', description: err instanceof Error ? err.message : 'Invalid OTP', variant: 'destructive' });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleResendPhoneOtp = async () => {
    setPhoneLoading(true);
    try {
      const res = await reRequestPhoneOtp(getCleanPhone());
      setPhoneTimer(60);
      setPhoneOtp('');
      toast({ title: 'OTP Resent', description: res.message });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to resend', variant: 'destructive' });
    } finally {
      setPhoneLoading(false);
    }
  };

  const phoneEntered = phone && phone.replace(/\D/g, '').length > 2;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-foreground text-base">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>

      {/* Email Verification */}
      <div className="space-y-3 p-4 rounded-xl border border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium">Email Address {emailRequired && <span className="text-destructive">*</span>}</Label>
          {emailVerified && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
        </div>

        <div className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="h-10 flex-1"
            disabled={emailVerified || emailOtpSent}
          />
          {!emailVerified && !emailOtpSent && (
            <Button
              size="sm"
              onClick={handleSendEmailOtp}
              disabled={!email || emailLoading}
              className="h-10 px-4 shrink-0"
            >
              {emailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
            </Button>
          )}
        </div>

        {emailOtpSent && !emailVerified && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Enter 6-digit code sent to your email</Label>
            </div>
            <div className="flex items-center gap-3">
              <InputOTP maxLength={6} value={emailOtp} onChange={setEmailOtp}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <Button
                size="sm"
                onClick={handleVerifyEmail}
                disabled={emailOtp.length < 6 || emailLoading}
                className="h-10 px-4"
              >
                {emailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {emailTimer > 0 ? (
                <span className="text-xs text-muted-foreground">Resend in {emailTimer}s</span>
              ) : (
                <Button variant="ghost" size="sm" onClick={handleResendEmailOtp} disabled={emailLoading} className="text-xs h-7 px-2">
                  <RefreshCw className="h-3 w-3 mr-1" /> Resend OTP
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEmailOtpSent(false); setEmailOtp(''); setEmailTimer(0); }}
                className="text-xs h-7 px-2"
              >
                Change Email
              </Button>
            </div>
          </div>
        )}

        {emailVerified && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 p-2 rounded-lg">
            <Lock className="h-3.5 w-3.5" />
            <span>Email verified and locked</span>
          </div>
        )}
      </div>

      {/* Phone Verification - only shown when showPhone is true */}
      {showPhone && (
        <div className="space-y-3 p-4 rounded-xl border border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Phone Number {phoneRequired ? <span className="text-destructive">*</span> : <span className="text-muted-foreground text-xs">(optional)</span>}</Label>
            {phoneVerified && <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />}
          </div>

          <div className="flex gap-2">
            <PhoneInput
              value={phone}
              onChange={setPhone}
              className="h-10 flex-1"
              disabled={phoneVerified || phoneOtpSent}
            />
            {!phoneVerified && !phoneOtpSent && phoneEntered && (
              <Button
                size="sm"
                onClick={handleSendPhoneOtp}
                disabled={phoneLoading}
                className="h-10 px-4 shrink-0"
              >
                {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
              </Button>
            )}
          </div>

          {phoneOtpSent && !phoneVerified && (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Enter 6-digit code sent via SMS</Label>
              <div className="flex items-center gap-3">
                <InputOTP maxLength={6} value={phoneOtp} onChange={setPhoneOtp}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <Button
                  size="sm"
                  onClick={handleVerifyPhone}
                  disabled={phoneOtp.length < 6 || phoneLoading}
                  className="h-10 px-4"
                >
                  {phoneLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {phoneTimer > 0 ? (
                  <span className="text-xs text-muted-foreground">Resend in {phoneTimer}s</span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={handleResendPhoneOtp} disabled={phoneLoading} className="text-xs h-7 px-2">
                    <RefreshCw className="h-3 w-3 mr-1" /> Resend OTP
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setPhoneOtpSent(false); setPhoneOtp(''); setPhoneTimer(0); }}
                  className="text-xs h-7 px-2"
                >
                  Change Number
                </Button>
              </div>
            </div>
          )}

          {phoneVerified && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 p-2 rounded-lg">
              <Lock className="h-3.5 w-3.5" />
              <span>Phone verified and locked</span>
            </div>
          )}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        {onBack && (
          <Button variant="outline" className="flex-1 h-11" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        )}
        <Button
          onClick={() => onVerified({ email, phone: showPhone ? getCleanPhone() : '', emailVerified, phoneVerified })}
          disabled={!canProceed()}
          className={`h-11 ${onBack ? 'flex-1' : 'w-full'}`}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

export default OtpVerificationStep;
