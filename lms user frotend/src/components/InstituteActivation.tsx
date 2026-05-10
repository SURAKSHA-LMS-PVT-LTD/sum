/**
 * InstituteActivation.tsx
 *
 * In-app flow for users to activate their institute profile by setting an
 * institute-specific password. This is separate from the main SurakshLMS account
 * password and only works on the linked institute domain/session.
 *
 * Steps:
 *   1. Load institute profile → check hasPassword + extraData
 *   2. Let user fill EMPTY extraData fields (can't overwrite existing values)
 *   3. Select contact for OTP delivery (own phone, own email, or parent phone)
 *   4. Enter OTP
 *   5. Set institute password (with clear explanation of what it is)
 *   6. Success
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Eye, EyeOff, Key, Plus, Trash2, Info, Building2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getSelfActivateProfile,
  getSelfActivateContacts,
  selfActivateRequestOtp,
  selfActivateVerify,
  changeInstitutePassword,
  type InstituteAvailableContact,
} from '@/contexts/utils/auth.api';

type Step = 'loading' | 'profile' | 'select-contact' | 'otp' | 'set-password' | 'done' | 'change-password' | 'change-done';

interface Props {
  /** The institute to activate. Must be an institute the logged-in user belongs to. */
  instituteId: string;
  /** Human-readable institute name for display */
  instituteName?: string;
  /** Called after successful activation */
  onComplete?: () => void;
  /** Called when user cancels */
  onCancel?: () => void;
}

const InstituteActivation: React.FC<Props> = ({
  instituteId,
  instituteName,
  onComplete,
  onCancel,
}) => {
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('loading');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Profile data
  const [existingExtraData, setExistingExtraData] = useState<Record<string, any>>({});
  const [userIdByInstitute, setUserIdByInstitute] = useState<string | null>(null);

  // Extra data editing (empty fields only)
  const [extraDataRows, setExtraDataRows] = useState<{ key: string; value: string }[]>([]);

  // Contact selection
  const [contacts, setContacts] = useState<InstituteAvailableContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');

  // OTP
  const [otp, setOtp] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);

  // Set-password (first-time activation)
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Change-password (already has password)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showNewPwConfirm, setShowNewPwConfirm] = useState(false);

  // OTP countdown
  useEffect(() => {
    if (otpTimer > 0) {
      const t = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpTimer]);

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, [instituteId]);

  const loadProfile = async () => {
    setStep('loading');
    setError('');
    try {
      const profile = await getSelfActivateProfile(instituteId);
      setUserIdByInstitute(profile.userIdByInstitute);
      if (profile.hasPassword) {
        setStep('change-password');
        return;
      }
      setExistingExtraData(profile.extraData || {});
      setStep('profile');
    } catch (err: any) {
      setError(err.message || 'Failed to load institute profile.');
      setStep('profile');
    }
  };

  const addExtraDataRow = () => setExtraDataRows(r => [...r, { key: '', value: '' }]);
  const removeExtraDataRow = (i: number) => setExtraDataRows(r => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: 'key' | 'value', val: string) => {
    setExtraDataRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  };

  const goSelectContact = async () => {
    setError('');
    setIsLoading(true);
    try {
      const result = await getSelfActivateContacts(instituteId);
      setContacts(result.contacts);
      setSelectedContactId(result.contacts[0]?.id || '');
      setStep('select-contact');
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts.');
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!selectedContactId) { setError('Please select a contact.'); return; }
    setError('');
    setIsLoading(true);
    try {
      const result = await selfActivateRequestOtp({ instituteId, selectedContactId });
      setSentTo(result.sentTo);
      setOtp('');
      setOtpTimer(60);
      setStep('otp');
      toast({ title: 'OTP Sent', description: `Verification code sent to ${result.sentTo}` });
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async () => {
    if (otpTimer > 0) return;
    await sendOtp();
  };

  const goSetPassword = () => {
    if (otp.length < 6) { setError('Please enter the 6-digit code.'); return; }
    setError('');
    setStep('set-password');
  };

  const finalActivate = async () => {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setError('');
    setIsLoading(true);

    // Build extraData from rows (only non-empty keys)
    const extraData: Record<string, string> = {};
    for (const row of extraDataRows) {
      const k = row.key.trim();
      if (k && !(k in existingExtraData)) {
        extraData[k] = row.value;
      }
    }

    try {
      await selfActivateVerify({
        instituteId,
        otpCode: otp,
        newPassword: password,
        extraData: Object.keys(extraData).length > 0 ? extraData : undefined,
      });
      setStep('done');
      toast({ title: 'Activated!', description: 'Your institute profile is now active.' });
    } catch (err: any) {
      setError(err.message || 'Activation failed.');
      // If OTP-related error, go back to OTP step
      if (err.message?.toLowerCase().includes('otp') || err.message?.toLowerCase().includes('code')) {
        setStep('otp');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) { setError('Please enter your current password.'); return; }
    if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPassword !== newPasswordConfirm) { setError('New passwords do not match.'); return; }
    setError('');
    setIsLoading(true);
    try {
      await changeInstitutePassword({ instituteId, currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      setStep('change-done');
      toast({ title: 'Password changed', description: 'Your institute password has been updated.' });
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render helpers ────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Loading institute profile…</p>
      </div>
    );
  }

  if (step === 'change-password') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary shrink-0" />
          <div>
            <h3 className="text-base font-semibold leading-tight">Change Institute Password</h3>
            {instituteName && <p className="text-xs text-muted-foreground">{instituteName}</p>}
          </div>
        </div>

        {userIdByInstitute && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/60 text-sm">
            <Key className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Your institute login ID:</span>
            <span className="font-mono font-semibold">{userIdByInstitute}</span>
          </div>
        )}

        <div className="space-y-3">
          {/* Current password */}
          <div className="space-y-1.5">
            <Label className="text-sm">Current institute password</Label>
            <div className="relative">
              <Input
                type={showCurrentPw ? 'text' : 'password'}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-10 pr-12"
              />
              <Button
                type="button" variant="ghost" size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowCurrentPw(v => !v)}
              >
                {showCurrentPw ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <Label className="text-sm">New password</Label>
            <div className="relative">
              <Input
                type={showNewPw ? 'text' : 'password'}
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 pr-12"
              />
              <Button
                type="button" variant="ghost" size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowNewPw(v => !v)}
              >
                {showNewPw ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>

          {/* Confirm new password */}
          <div className="space-y-1.5">
            <Label className="text-sm">Confirm new password</Label>
            <div className="relative">
              <Input
                type={showNewPwConfirm ? 'text' : 'password'}
                placeholder="Repeat new password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                className="h-10 pr-12"
                onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
              />
              <Button
                type="button" variant="ghost" size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowNewPwConfirm(v => !v)}
              >
                {showNewPwConfirm ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
            {newPassword && newPasswordConfirm && newPassword !== newPasswordConfirm && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>
        </div>

        {error && <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</div>}

        <Button
          className="w-full h-10 font-semibold"
          onClick={handleChangePassword}
          disabled={isLoading || !currentPassword || newPassword.length < 8 || newPassword !== newPasswordConfirm}
        >
          {isLoading ? 'Updating…' : 'Change Password'}
        </Button>
        {onCancel && (
          <Button variant="ghost" className="w-full h-9" onClick={onCancel}>Cancel</Button>
        )}
      </div>
    );
  }

  if (step === 'change-done') {
    return (
      <div className="text-center space-y-4 py-6">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
        <div>
          <p className="text-lg font-semibold">Password Updated!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your institute password for {instituteName || 'the institute'} has been changed successfully.
          </p>
          {userIdByInstitute && (
            <p className="text-xs text-muted-foreground mt-2 font-mono">Login ID: {userIdByInstitute}</p>
          )}
        </div>
        {onComplete && (
          <Button className="w-full" onClick={onComplete}>Done</Button>
        )}
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="text-center space-y-4 py-6">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
        <div>
          <p className="text-lg font-semibold">Institute Profile Activated!</p>
          {userIdByInstitute && (
            <p className="text-sm text-muted-foreground mt-1">User ID: <span className="font-mono font-medium">{userIdByInstitute}</span></p>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            You can now log in to {instituteName || 'the institute'} using your institute user ID and the password you just set.
          </p>
        </div>
        {onComplete && (
          <Button className="w-full" onClick={onComplete}>Done</Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary shrink-0" />
        <div>
          <h3 className="text-base font-semibold leading-tight">Activate Institute Profile</h3>
          {instituteName && <p className="text-xs text-muted-foreground">{instituteName}</p>}
        </div>
      </div>

      {/* Step: profile — fill empty extraData + continue */}
      {step === 'profile' && (
        <div className="space-y-4">
          {/* Existing data (read-only) */}
          {Object.keys(existingExtraData).length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Existing institute data</Label>
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
                {Object.entries(existingExtraData).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs">
                    <span className="text-muted-foreground font-medium min-w-[80px]">{k}:</span>
                    <span>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add empty fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Add custom data <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Button type="button" variant="outline" size="sm" onClick={addExtraDataRow} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" /> Add field
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Add any extra info your institute may use (phone, email, notes). You can only add to empty fields — existing values cannot be changed.</p>
            {extraDataRows.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="Field name"
                  value={row.key}
                  onChange={(e) => updateRow(i, 'key', e.target.value)}
                  className="h-9 text-sm flex-1"
                />
                <Input
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => updateRow(i, 'value', e.target.value)}
                  className="h-9 text-sm flex-1"
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeExtraDataRow(i)} className="h-9 w-9 p-0 shrink-0">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          {error && <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</div>}

          <Button className="w-full h-10 font-semibold" onClick={goSelectContact} disabled={isLoading}>
            {isLoading ? 'Loading…' : 'Continue — Choose OTP Contact'}
          </Button>
          {onCancel && (
            <Button variant="ghost" className="w-full h-9" onClick={onCancel}>Cancel</Button>
          )}
        </div>
      )}

      {/* Step: select-contact */}
      {step === 'select-contact' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select where to receive your one-time verification code. Phone numbers show last 2 digits only.
          </p>

          {contacts.length === 0 && (
            <div className="text-xs text-destructive bg-destructive/10 p-3 rounded-lg">
              No contact information found. Please contact your institute administrator.
            </div>
          )}

          <div className="space-y-2">
            {contacts.map((c) => (
              <label
                key={c.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedContactId === c.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                }`}
              >
                <input
                  type="radio"
                  name="contact"
                  value={c.id}
                  checked={selectedContactId === c.id}
                  onChange={() => setSelectedContactId(c.id)}
                  className="accent-primary w-4 h-4 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs font-mono text-muted-foreground">{c.masked}</p>
                </div>
                <span className="text-xs rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0">
                  {c.type === 'EMAIL' ? 'Email' : 'SMS'}
                </span>
              </label>
            ))}
          </div>

          {error && <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</div>}

          <Button className="w-full h-10 font-semibold" onClick={sendOtp} disabled={isLoading || !selectedContactId || contacts.length === 0}>
            {isLoading ? 'Sending…' : 'Send Verification Code'}
          </Button>
          <Button variant="ghost" className="w-full h-9 text-sm" onClick={() => { setStep('profile'); setError(''); }}>
            Back
          </Button>
        </div>
      )}

      {/* Step: otp */}
      {step === 'otp' && (
        <div className="space-y-4">
          <div className="text-sm bg-primary/10 p-3 rounded-lg text-center">
            Verification code sent to <span className="font-mono font-medium">{sentTo}</span>
          </div>

          <div className="flex justify-center py-2">
            <InputOTP maxLength={6} value={otp} onChange={setOtp} className="gap-1.5">
              <InputOTPGroup className="gap-1.5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="w-10 h-12 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            {otpTimer > 0
              ? `Resend in ${otpTimer}s`
              : <button type="button" onClick={resendOtp} className="text-primary hover:underline">Resend code</button>}
          </div>

          {error && <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</div>}

          <Button className="w-full h-10 font-semibold" onClick={goSetPassword} disabled={otp.length < 6}>
            Continue
          </Button>
          <Button variant="ghost" className="w-full h-9 text-sm" onClick={() => { setStep('select-contact'); setError(''); setOtp(''); }}>
            Back
          </Button>
        </div>
      )}

      {/* Step: set-password */}
      {step === 'set-password' && (
        <div className="space-y-4">
          {/* Important explanation */}
          <div className="flex gap-2 items-start bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="space-y-1">
              <p className="font-semibold">Two separate passwords</p>
              <p>
                This password is <strong>only for {instituteName || 'this institute'}</strong> login.
                It is completely separate from your main SurakshLMS account password.
              </p>
              <p className="text-amber-700">
                Next time logging in with your institute ID, use <strong>this password</strong>. Your main app password stays the same.
              </p>
            </div>
          </div>

          {userIdByInstitute && (
            <div className="flex items-center gap-2 text-sm">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Your institute user ID:</span>
              <span className="font-mono font-semibold">{userIdByInstitute}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm">New institute password</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 text-sm pr-12 rounded-lg"
                minLength={8}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Confirm password</Label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10 text-sm pr-12 rounded-lg"
                minLength={8}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          </div>

          {error && <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</div>}

          <Button
            className="w-full h-10 font-semibold"
            onClick={finalActivate}
            disabled={isLoading || password.length < 8 || password !== confirmPassword}
          >
            {isLoading ? 'Activating…' : 'Activate Institute Access'}
          </Button>
          <Button variant="ghost" className="w-full h-9 text-sm" onClick={() => { setStep('otp'); setError(''); }}>
            Back
          </Button>
        </div>
      )}
    </div>
  );
};

export default InstituteActivation;
