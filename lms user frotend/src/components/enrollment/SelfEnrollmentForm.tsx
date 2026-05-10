import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { enrollmentApi, SelfEnrollResponse } from '@/api/enrollment.api';
import {
  Loader2, Key, CheckCircle, Gift, CreditCard, AlertTriangle,
  ArrowRight, Calendar, DollarSign, RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildSidebarUrl } from '@/utils/pageNavigation';

interface SelfEnrollFormData {
  enrollmentKey: string;
}

const SelfEnrollmentForm = () => {
  const { user, selectedInstitute, selectedClass } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [enrollmentResult, setEnrollmentResult] = useState<SelfEnrollResponse | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimDone, setClaimDone] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<SelfEnrollFormData>();

  const onSubmit = async (data: SelfEnrollFormData) => {
    setIsLoading(true);
    setEnrollmentResult(null);

    try {
      const result = await enrollmentApi.selfEnroll(data.enrollmentKey || undefined, {
        userId: user?.id,
        instituteId: selectedInstitute?.id,
        classId: selectedClass?.id,
      });
      setEnrollmentResult(result);
      toast({
        title: result.verificationStatus === 'verified' ? 'Enrolled!' : 'Enrollment Submitted',
        description: result.message,
      });
      reset();
    } catch (error: any) {
      const msg = error?.message || 'Enrollment failed. Please check your key and try again.';
      toast({ title: 'Enrollment Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnrollAnother = () => {
    setEnrollmentResult(null);
    setClaimDone(false);
  };

  const handleClaimFreeCard = async () => {
    if (!enrollmentResult) return;
    setIsClaiming(true);
    try {
      await enrollmentApi.claimFreeCard(
        enrollmentResult.instituteId,
        enrollmentResult.classId,
        enrollmentResult.subjectId,
        { userId: user?.id },
      );
      setClaimDone(true);
      toast({ title: 'Free Card Claimed', description: 'You are now fully enrolled — no payment required.' });
    } catch (error: any) {
      toast({
        title: 'Free Card Claim Failed',
        description: error.message || 'Could not claim free card. Please contact your teacher.',
        variant: 'destructive',
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const navigateToClassPayments = () => {
    if (!enrollmentResult) return;
    const url = buildSidebarUrl('class-payments', {
      instituteId: enrollmentResult.instituteId,
      classId: enrollmentResult.classId,
    });
    navigate(url);
  };

  const navigateToInstitutePayments = () => {
    const url = buildSidebarUrl('institute-payments', {
      instituteId: enrollmentResult?.instituteId || selectedInstitute?.id,
    });
    navigate(url);
  };

  // Determine if this is a payment-gated pending (class payment required)
  const isPaymentGated = !!enrollmentResult?.enrollmentPaymentId && !enrollmentResult?.feeAmount;
  const isFeeEnrollment = !isPaymentGated && !!enrollmentResult?.feeAmount;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />Subject Enrollment
          </CardTitle>
          <CardDescription>
            Enter the enrollment key provided by your teacher to enroll in a subject
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!enrollmentResult ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="enrollmentKey">Enrollment Key</Label>
                <Input
                  id="enrollmentKey"
                  type="text"
                  placeholder="Enter enrollment key (e.g., MATH-ABC123)"
                  {...register('enrollmentKey', {
                    maxLength: { value: 50, message: 'Key must not exceed 50 characters' },
                  })}
                  disabled={isLoading}
                />
                {errors.enrollmentKey && (
                  <Alert variant="destructive">
                    <AlertDescription>{errors.enrollmentKey.message}</AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground">
                  Leave blank if your teacher uses payment-based enrollment.
                </p>
              </div>

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enrolling…</>
                ) : (
                  <><Key className="h-4 w-4 mr-2" />Enroll in Subject</>
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              {/* ── Status banner ── */}
              {claimDone ? (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="font-medium text-green-700 dark:text-green-300">
                    Free card verified — you are fully enrolled!
                  </AlertDescription>
                </Alert>
              ) : enrollmentResult.studentType === 'free_card' ? (
                <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-950/30">
                  <Gift className="h-4 w-4 text-purple-600" />
                  <AlertDescription className="font-medium text-purple-700 dark:text-purple-300">
                    Enrolled Free! Your teacher pre-approved you — no payment required.
                  </AlertDescription>
                </Alert>
              ) : enrollmentResult.verificationStatus === 'verified' ? (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-950/30">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="font-medium text-green-700 dark:text-green-300">
                    Enrollment confirmed!
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="font-medium text-amber-700 dark:text-amber-300">
                    {enrollmentResult.verificationStatus === 'pending_payment'
                      ? 'Enrolled — payment required to activate'
                      : 'Enrolled — awaiting teacher verification'}
                  </AlertDescription>
                </Alert>
              )}

              {/* ── Enrollment details ── */}
              <div className="space-y-2 p-4 bg-muted/40 rounded-lg border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subject</span>
                  <span className="font-medium">{enrollmentResult.subjectName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Class</span>
                  <span className="font-medium">{enrollmentResult.className}</span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className={
                    claimDone || enrollmentResult.studentType === 'free_card'
                      ? 'text-purple-600 border-purple-300'
                      : enrollmentResult.verificationStatus === 'verified'
                        ? 'text-green-600 border-green-300'
                        : enrollmentResult.verificationStatus === 'pending_payment'
                          ? 'text-orange-600 border-orange-300'
                          : 'text-amber-600 border-amber-300'
                  }>
                    {claimDone ? 'Free Card Verified'
                      : enrollmentResult.studentType === 'free_card' ? 'Enrolled Free'
                      : enrollmentResult.verificationStatus === 'verified' ? 'Verified'
                      : enrollmentResult.verificationStatus === 'pending_payment' ? 'Payment Required'
                      : 'Pending Verification'}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Enrolled At</span>
                  <span>{new Date(enrollmentResult.enrolledAt).toLocaleString()}</span>
                </div>
              </div>

              {/* ── Payment-gated pending: show specific class payment details ── */}
              {enrollmentResult.verificationStatus === 'pending_payment' && isPaymentGated && !claimDone && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <CreditCard className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">Class Payment Required</p>
                      <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                        Submit the following payment to activate your enrollment:
                      </p>
                    </div>
                  </div>

                  {/* Payment info card */}
                  <div className="bg-white/60 dark:bg-black/20 rounded-lg border border-orange-100 dark:border-orange-900 p-3 space-y-2">
                    {enrollmentResult.enrollmentPaymentTitle && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Payment</span>
                        <span className="font-semibold">{enrollmentResult.enrollmentPaymentTitle}</span>
                      </div>
                    )}
                    {enrollmentResult.enrollmentPaymentAmount != null && (
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Amount</span>
                        <span className="font-bold text-orange-700 dark:text-orange-300">
                          Rs {enrollmentResult.enrollmentPaymentAmount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {enrollmentResult.enrollmentPaymentDueDate && (
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Due Date</span>
                        <span className={new Date(enrollmentResult.enrollmentPaymentDueDate) < new Date() ? 'text-red-600 font-medium' : ''}>
                          {new Date(enrollmentResult.enrollmentPaymentDueDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button className="w-full gap-2" onClick={navigateToClassPayments}>
                      <CreditCard className="h-4 w-4" />Pay Now <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950 gap-2"
                      onClick={handleClaimFreeCard}
                      disabled={isClaiming}
                    >
                      {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                      {isClaiming ? 'Claiming…' : 'Claim Free Card'}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Fee-based pending (no payment gate, just upload slip) ── */}
              {enrollmentResult.verificationStatus === 'pending_payment' && isFeeEnrollment && !claimDone && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Payment Required</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                        Upload a payment slip for Rs {enrollmentResult.feeAmount?.toLocaleString()} through the payments section.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button className="w-full gap-2" onClick={navigateToInstitutePayments}>
                      <CreditCard className="h-4 w-4" />Go to Payments <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950 gap-2"
                      onClick={handleClaimFreeCard}
                      disabled={isClaiming}
                    >
                      {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                      {isClaiming ? 'Claiming…' : 'Claim Free Card'}
                    </Button>
                  </div>
                </div>
              )}

              {claimDone && (
                <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 p-3">
                  <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    You are now fully enrolled and can attend classes in this subject.
                  </p>
                </div>
              )}

              <Button onClick={handleEnrollAnother} variant="outline" className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />Enroll in Another Subject
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SelfEnrollmentForm;
