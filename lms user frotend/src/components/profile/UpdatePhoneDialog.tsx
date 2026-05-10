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

interface UpdatePhoneDialogProps {
  currentPhone: string;
  onUpdate: (newPhone: string) => void;
}

export default function UpdatePhoneDialog({ currentPhone, onUpdate }: UpdatePhoneDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState(currentPhone || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleRequestOtp = async () => {
    if (!phone || phone === currentPhone) {
      toast({ title: 'Error', description: 'Please enter a new phone number.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>('/users/phone/change/request-otp', {
        phoneNumber: phone,
      });
      if (res.success || (res as any).message) {
        toast({ title: 'OTP Sent', description: (res as any).message || 'Check your phone for the OTP.' });
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
      const res = await apiClient.post<{ success: boolean; message: string; newPhoneNumber: string }>('/users/phone/change/verify-otp', {
        phoneNumber: phone,
        otpCode: otp,
      });
      
      // Handle success
      toast({ title: 'Success', description: 'Phone number updated successfully.' });
      onUpdate(phone);
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
    setPhone(currentPhone || '');
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
          <DialogTitle>Change Phone Number</DialogTitle>
          <DialogDescription>
            {step === 1 
              ? "Enter your new phone number. We'll send an OTP to verify it." 
              : `Enter the 6-digit OTP sent to ${phone}`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {step === 1 ? (
            <div className="space-y-2">
              <Label htmlFor="phone">New Phone Number</Label>
              <Input
                id="phone"
                placeholder="e.g. 0771234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
            <Button onClick={handleRequestOtp} disabled={loading || !phone || phone === currentPhone}>
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
