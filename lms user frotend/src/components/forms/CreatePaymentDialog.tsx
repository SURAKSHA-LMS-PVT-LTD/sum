import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { institutePaymentsApi, CreatePaymentRequest } from '@/api/institutePayments.api';
import { getErrorMessage } from '@/api/apiError';
import { BankAccountSelector } from './BankAccountSelector';
import type { InstituteBankAccount } from '@/api/instituteBankAccounts.api';

interface CreatePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instituteId: string;
  onSuccess?: () => void;
}

const CreatePaymentDialog = ({ open, onOpenChange, instituteId, onSuccess }: CreatePaymentDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<InstituteBankAccount | null>(null);
  const [formData, setFormData] = useState<Omit<CreatePaymentRequest, 'bankDetails'>>({
    paymentType: '',
    description: '',
    amount: 0,
    dueDate: '',
    targetType: 'STUDENTS',
    priority: 'MANDATORY',
    paymentInstructions: '',
    lateFeeAmount: 0,
    lateFeeAfterDays: 5,
    reminderDaysBefore: 3,
  });

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.paymentType) errors.paymentType = 'Payment type is required';
    if (!formData.description) errors.description = 'Description is required';
    if (!formData.amount || formData.amount <= 0) errors.amount = 'Amount must be greater than 0';
    if (!formData.dueDate) errors.dueDate = 'Due date is required';
    if (!selectedAccount) errors.bankAccount = 'Select a bank account';
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setLoading(true);
    try {
      const payload: CreatePaymentRequest = {
        ...formData,
        bankDetails: {
          bankName: selectedAccount!.bankName,
          accountNumber: selectedAccount!.accountNumber,
          accountHolderName: selectedAccount!.accountHolderName,
        },
      };

      await institutePaymentsApi.createPayment(instituteId, payload);
      toast({ title: 'Success', description: 'Payment created successfully' });
      onOpenChange(false);
      onSuccess?.();
      setFieldErrors({});
      setFormData({ paymentType: '', description: '', amount: 0, dueDate: '', targetType: 'STUDENTS', priority: 'MANDATORY', paymentInstructions: '', lateFeeAmount: 0, lateFeeAfterDays: 5, reminderDaysBefore: 3 });
      setSelectedAccountId('');
      setSelectedAccount(null);
    } catch (error: any) {
      toast({ title: 'Failed to Create Payment', description: getErrorMessage(error, 'Something went wrong. Please try again.'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setFormData({ paymentType: '', description: '', amount: 0, dueDate: '', targetType: 'STUDENTS', priority: 'MANDATORY', paymentInstructions: '', lateFeeAmount: 0, lateFeeAfterDays: 5, reminderDaysBefore: 3 });
      setSelectedAccountId('');
      setSelectedAccount(null);
      setFieldErrors({});
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Payment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentType">Payment Type *</Label>
                  <Input id="paymentType" value={formData.paymentType} onChange={e => handleInputChange('paymentType', e.target.value)} placeholder="e.g., Tuition Fee" className={fieldErrors.paymentType ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                  {fieldErrors.paymentType && <p className="text-xs text-red-500 mt-1">{fieldErrors.paymentType}</p>}
                </div>
                <div>
                  <Label htmlFor="amount">Amount *</Label>
                  <Input id="amount" type="number" min="0" step="0.01" value={formData.amount} onChange={e => handleInputChange('amount', parseFloat(e.target.value) || 0)} placeholder="0.00" className={fieldErrors.amount ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                  {fieldErrors.amount && <p className="text-xs text-red-500 mt-1">{fieldErrors.amount}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" value={formData.description} onChange={e => handleInputChange('description', e.target.value)} placeholder="Describe the payment purpose" className={fieldErrors.description ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                {fieldErrors.description && <p className="text-xs text-red-500 mt-1">{fieldErrors.description}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="dueDate">Due Date *</Label>
                  <Input id="dueDate" type="datetime-local" value={formData.dueDate} onChange={e => handleInputChange('dueDate', e.target.value)} className={fieldErrors.dueDate ? 'border-red-500 focus-visible:ring-red-500' : ''} />
                  {fieldErrors.dueDate && <p className="text-xs text-red-500 mt-1">{fieldErrors.dueDate}</p>}
                </div>
                <div>
                  <Label htmlFor="targetType">Target Type</Label>
                  <Select value={formData.targetType} onValueChange={value => handleInputChange('targetType', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STUDENTS">Students</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={value => handleInputChange('priority', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANDATORY">Mandatory</SelectItem>
                      <SelectItem value="OPTIONAL">Optional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Account */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Account</CardTitle>
            </CardHeader>
            <CardContent>
              <BankAccountSelector
                instituteId={instituteId}
                value={selectedAccountId}
                onChange={(id, acc) => {
                  setSelectedAccountId(id);
                  setSelectedAccount(acc);
                  setFieldErrors(p => ({ ...p, bankAccount: '' }));
                }}
                error={fieldErrors.bankAccount}
                required
              />
            </CardContent>
          </Card>

          {/* Additional Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="paymentInstructions">Payment Instructions</Label>
                <Textarea id="paymentInstructions" value={formData.paymentInstructions || ''} onChange={e => handleInputChange('paymentInstructions', e.target.value)} placeholder="Please transfer the amount to the bank account listed below..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="lateFeeAmount">Late Fee Amount</Label>
                  <Input id="lateFeeAmount" type="number" min="0" step="0.01" value={formData.lateFeeAmount || 0} onChange={e => handleInputChange('lateFeeAmount', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label htmlFor="lateFeeAfterDays">Late Fee After Days</Label>
                  <Input id="lateFeeAfterDays" type="number" min="0" value={formData.lateFeeAfterDays || 5} onChange={e => handleInputChange('lateFeeAfterDays', parseInt(e.target.value) || 5)} />
                </div>
                <div>
                  <Label htmlFor="reminderDaysBefore">Reminder Days Before</Label>
                  <Input id="reminderDaysBefore" type="number" min="0" value={formData.reminderDaysBefore || 3} onChange={e => handleInputChange('reminderDaysBefore', parseInt(e.target.value) || 3)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Payment'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePaymentDialog;
