import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Copy, Check } from 'lucide-react';
import { SubjectPayment } from '@/api/subjectPayments.api';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { SRI_LANKAN_BANKS } from '@/config/sriLankanBanks';

interface SubjectPaymentBankDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: SubjectPayment | null;
}

const SubjectPaymentBankDetailsDialog: React.FC<SubjectPaymentBankDetailsDialogProps> = ({ open, onOpenChange, payment }) => {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!payment) return null;

  const hasBankDetails = payment.bankName || payment.accountHolderName || payment.accountHolderNumber;
  if (!hasBankDetails) return null;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      toast({
        title: "Copied",
        description: `${fieldName} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    }).catch(() => {
      toast({
        title: "Failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} routeName="subject-payment-bank-details-dialog-popup">
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Building2 className="h-5 w-5 text-primary" />
            Bank Details
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-normal mt-2">
            For Payment: <span className="font-semibold text-foreground">{payment.title}</span>
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Payment Amount & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">
                  Amount
                </p>
                <p className="text-2xl font-extrabold text-primary">
                  Rs {Number(payment.amount || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">
                  Due Date
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {payment.lastDate ? new Date(payment.lastDate).toLocaleDateString() : 'Not specified'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Bank Details Cards */}
          <div className="space-y-3">
            {/* Bank Name */}
            {payment.bankName && (
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 flex items-center gap-3">
                    {(() => {
                      const bank = SRI_LANKAN_BANKS.find(b => b.name.toLowerCase() === payment.bankName!.toLowerCase());
                      return bank ? (
                        <img
                          src={bank.logoUrl}
                          alt={bank.name}
                          className="h-8 w-8 object-contain rounded flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null;
                    })()}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">
                        Bank Name
                      </p>
                      <p className="text-base font-semibold text-foreground break-words">
                        {payment.bankName}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(payment.bankName!, 'Bank Name')}
                    className="shrink-0"
                  >
                    {copiedField === 'bankName' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Account Holder Name */}
            {payment.accountHolderName && (
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">
                      Account Holder Name
                    </p>
                    <p className="text-base font-semibold text-foreground break-words">
                      {payment.accountHolderName}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(payment.accountHolderName!, 'Account Holder Name')}
                    className="shrink-0"
                  >
                    {copiedField === 'accountHolderName' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Account Holder Number */}
            {payment.accountHolderNumber && (
              <Card className="hover:shadow-md transition-shadow border-blue-200 bg-blue-50/30 dark:bg-blue-900/10 dark:border-blue-800">
                <CardContent className="pt-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">
                      Account Number
                    </p>
                    <p className="text-lg font-mono font-extrabold text-blue-700 dark:text-blue-300 break-all">
                      {payment.accountHolderNumber}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(payment.accountHolderNumber!, 'Account Number')}
                    className="shrink-0"
                  >
                    {copiedField === 'accountHolderNumber' ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Info Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 dark:bg-amber-900/20 dark:border-amber-800">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Note:</span> Please ensure you enter the correct details when making your payment. Verify all information before submitting.
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubjectPaymentBankDetailsDialog;
