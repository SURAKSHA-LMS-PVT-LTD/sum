import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { classPaymentsApi } from '@/api/classPayments.api';
import { DollarSign } from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';
import { BankAccountSelector } from './BankAccountSelector';
import type { InstituteBankAccount } from '@/api/instituteBankAccounts.api';

interface CreateClassPaymentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instituteId: string;
  classId: string;
  onSuccess: () => void;
}

interface FormData {
  title: string;
  description: string;
  targetType: 'PARENTS' | 'STUDENTS' | 'BOTH';
  priority: 'MANDATORY' | 'OPTIONAL' | 'DONATION';
  amount: number;
  teacherCommissionPct: number;
  documentUrl?: string;
  lastDate: string;
  notes?: string;
}

const CreateClassPaymentForm: React.FC<CreateClassPaymentFormProps> = ({
  open, onOpenChange, instituteId, classId, onSuccess,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<InstituteBankAccount | null>(null);
  const [formData, setFormData] = useState<FormData>({
    title: '', description: '',
    targetType: 'STUDENTS', priority: 'MANDATORY',
    amount: 0, teacherCommissionPct: 0, documentUrl: '', lastDate: '', notes: '',
  });

  const handleInputChange = (field: keyof FormData, value: any) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.title) errors.title = 'Title is required';
    if (!formData.description) errors.description = 'Description is required';
    if (!formData.amount || formData.amount <= 0) errors.amount = 'Amount must be greater than 0';
    if (!formData.lastDate) errors.lastDate = 'Last date is required';
    if (!selectedAccount) errors.bankAccount = 'Select a bank account';

    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setLoading(true);
    try {
      await classPaymentsApi.createPayment(instituteId, classId, {
        title: formData.title,
        description: formData.description,
        targetType: formData.targetType,
        priority: formData.priority,
        amount: parseFloat(formData.amount.toString()),
        teacherCommissionPct: formData.teacherCommissionPct > 0 ? formData.teacherCommissionPct : undefined,
        documentUrl: formData.documentUrl?.trim() || undefined,
        lastDate: new Date(formData.lastDate).toISOString(),
        notes: formData.notes || undefined,
        bankName: selectedAccount!.bankName,
        accountHolderName: selectedAccount!.accountHolderName,
        accountHolderNumber: selectedAccount!.accountNumber,
      });
      toast({ title: 'Success', description: 'Class payment created successfully.' });
      setFieldErrors({});
      setFormData({ title: '', description: '', targetType: 'STUDENTS', priority: 'MANDATORY', amount: 0, teacherCommissionPct: 0, documentUrl: '', lastDate: '', notes: '' });
      setSelectedAccountId('');
      setSelectedAccount(null);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to create class payment.'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setFormData({ title: '', description: '', targetType: 'STUDENTS', priority: 'MANDATORY', amount: 0, teacherCommissionPct: 0, documentUrl: '', lastDate: '', notes: '' });
      setSelectedAccountId('');
      setSelectedAccount(null);
      setFieldErrors({});
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Create Class Payment</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={formData.title} onChange={e => handleInputChange('title', e.target.value)} placeholder="e.g., Monthly Class Fee" className={fieldErrors.title ? 'border-red-500' : ''} />
            {fieldErrors.title && <p className="text-xs text-red-500">{fieldErrors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" value={formData.description} onChange={e => handleInputChange('description', e.target.value)} placeholder="Detailed description of the payment" className={fieldErrors.description ? 'border-red-500' : ''} />
            {fieldErrors.description && <p className="text-xs text-red-500">{fieldErrors.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Target Type *</Label>
              <Select value={formData.targetType} onValueChange={v => handleInputChange('targetType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENTS">Students</SelectItem>
                  <SelectItem value="PARENTS">Parents</SelectItem>
                  <SelectItem value="BOTH">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority *</Label>
              <Select value={formData.priority} onValueChange={v => handleInputChange('priority', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANDATORY">Mandatory</SelectItem>
                  <SelectItem value="OPTIONAL">Optional</SelectItem>
                  <SelectItem value="DONATION">Donation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (Rs) *</Label>
            <Input id="amount" type="number" step="0.01" min="0" value={formData.amount} onChange={e => handleInputChange('amount', parseFloat(e.target.value) || 0)} placeholder="0.00" className={fieldErrors.amount ? 'border-red-500' : ''} />
            {fieldErrors.amount && <p className="text-xs text-red-500">{fieldErrors.amount}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacherCommissionPct">Teacher Commission % (Optional)</Label>
            <Input
              id="teacherCommissionPct"
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={formData.teacherCommissionPct || ''}
              onChange={e => handleInputChange('teacherCommissionPct', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              When this payment is approved, this % of the collected amount is credited to the teacher's wallet. Leave 0 for no commission.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastDate">Due Date *</Label>
            <Input id="lastDate" type="datetime-local" value={formData.lastDate} onChange={e => handleInputChange('lastDate', e.target.value)} className={fieldErrors.lastDate ? 'border-red-500' : ''} />
            {fieldErrors.lastDate && <p className="text-xs text-red-500">{fieldErrors.lastDate}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="documentUrl">Document URL (Optional)</Label>
            <Input id="documentUrl" value={formData.documentUrl} onChange={e => handleInputChange('documentUrl', e.target.value)} placeholder="https://example.com/document.pdf" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea id="notes" value={formData.notes} onChange={e => handleInputChange('notes', e.target.value)} placeholder="Additional notes or instructions" />
          </div>

          {/* Bank Account */}
          <div className="border-t pt-4">
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
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Payment'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateClassPaymentForm;
