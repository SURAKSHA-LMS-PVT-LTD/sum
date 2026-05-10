import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { Edit2, Loader2 } from 'lucide-react';

interface UpdateEmailDialogProps {
  currentEmail: string;
  onUpdate: (newEmail: string) => void;
}

export default function UpdateEmailDialog({ currentEmail, onUpdate }: UpdateEmailDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(currentEmail || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleRequestOtp = async () => {
    if (!email || email === currentEmail) {
      toast({ title: 'Error', description: 'Please enter a new email address.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>('/users/email/change/request-otp', {
        email: email,
      });
      if (res.success || (res as any).message) {
        toast({ title: 'OTP Sent', description: (res as any).message || 'Check your email for the OTP.' });
        setStep(2);
      } else {
        toast({ title: 'Error', description: 'Failed to send OTP.', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to send OTP.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast({ title: 'Error', description: 'Please enter a valid 6-digit OTP.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; message: string; newEmail: string }>('/users/email/change/verify-otp', {
        email: email,
        otpCode: otp,
      });
      
      // Handle success
      toast({ title: 'Success', description: 'Email updated successfully.' });
      onUpdate(email);
      setOpen(false);
      
      // Reset state for next time
      setTimeout(() => {
        setStep(1);
        setOtp('');
      }, 300);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || error.message || 'Failed to verify OTP.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setEmail(currentEmail || '');
    setOtp('');
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) resetState();
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Edit2 className="h-3 w-3" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] data-[state=open]:duration-300 data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-bottom-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-bottom-[48%] data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100">
        <DialogHeader>
          <DialogTitle>Change Email Address</DialogTitle>
          <DialogDescription>
            {step === 1 
              ? "Enter your new email address. We'll send an OTP to verify it." 
              : `Enter the 6-digit OTP sent to ${email}`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {step === 1 ? (
            <div className="space-y-2">
              <Label htmlFor="email">New Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="e.g. user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="otp">OTP Code</Label>
              <Input
                id="otp"
                placeholder="123456"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 1 ? (
            <Button onClick={handleRequestOtp} disabled={loading || !email || email === currentEmail}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send OTP
            </Button>
          ) : (
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>
                Back
              </Button>
              <Button onClick={handleVerifyOtp} disabled={loading || otp.length !== 6}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Update
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
