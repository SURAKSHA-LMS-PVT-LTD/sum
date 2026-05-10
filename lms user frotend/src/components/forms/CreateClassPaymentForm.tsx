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
import { SRI_LANKAN_BANKS } from '@/config/sriLankanBanks';

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
  documentUrl?: string;
  lastDate: string;
  notes?: string;
  bankName: string;
  accountHolderName: string;
  accountHolderNumber: string;
}

const CreateClassPaymentForm: React.FC<CreateClassPaymentFormProps> = ({
  open, onOpenChange, instituteId, classId, onSuccess,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [showCustomBank, setShowCustomBank] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: '', description: '',
    targetType: 'STUDENTS', priority: 'MANDATORY',
    amount: 0, documentUrl: '', lastDate: '', notes: '',
    bankName: '', accountHolderName: '', accountHolderNumber: '',
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
    if (!formData.bankName?.trim()) errors.bankName = 'Bank name is required';
    if (formData.bankName && formData.bankName.length > 100) errors.bankName = 'Bank name must not exceed 100 characters';
    if (!formData.accountHolderName?.trim()) errors.accountHolderName = 'Account holder name is required';
    if (formData.accountHolderName && formData.accountHolderName.length > 150) errors.accountHolderName = 'Account holder name must not exceed 150 characters';
    if (!formData.accountHolderNumber?.trim()) errors.accountHolderNumber = 'Account number is required';
    if (formData.accountHolderNumber && formData.accountHolderNumber.length > 50) errors.accountHolderNumber = 'Account number must not exceed 50 characters';

    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setLoading(true);
    try {
      await classPaymentsApi.createPayment(instituteId, classId, {
        title: formData.title,
        description: formData.description,
        targetType: formData.targetType,
        priority: formData.priority,
        amount: parseFloat(formData.amount.toString()),
        documentUrl: formData.documentUrl?.trim() || undefined,
        lastDate: new Date(formData.lastDate).toISOString(),
        notes: formData.notes || undefined,
        bankName: formData.bankName.trim(),
        accountHolderName: formData.accountHolderName.trim(),
        accountHolderNumber: formData.accountHolderNumber.trim(),
      });
      toast({ title: 'Success', description: 'Class payment created successfully.' });
      setFieldErrors({});
      setFormData({ title: '', description: '', targetType: 'STUDENTS', priority: 'MANDATORY', amount: 0, documentUrl: '', lastDate: '', notes: '', bankName: '', accountHolderName: '', accountHolderNumber: '' });
      setSelectedBankId('');
      setShowCustomBank(false);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to create class payment.'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          {/* Bank Details */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Bank Details *</h3>

            <div className="space-y-2">
              <Label>Select Bank *</Label>
              <Select
                value={showCustomBank ? 'OTHER' : selectedBankId}
                onValueChange={value => {
                  if (value === 'OTHER') {
                    setShowCustomBank(true);
                    setSelectedBankId('');
                    handleInputChange('bankName', '');
                  } else {
                    setShowCustomBank(false);
                    setSelectedBankId(value);
                    const bank = SRI_LANKAN_BANKS.find(b => b.id === value);
                    if (bank) handleInputChange('bankName', bank.name);
                  }
                }}
              >
                <SelectTrigger className="h-auto p-2"><SelectValue placeholder="Choose a bank..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {SRI_LANKAN_BANKS.map(bank => (
                    <SelectItem key={bank.id} value={bank.id} className="py-2">
                      <div className="flex items-center gap-2">
                        <img src={bank.logoUrl} alt={bank.name} className="h-6 w-6 object-contain rounded" onError={e => { e.currentTarget.style.display = 'none'; }} />
                        <div>
                          <div className="font-medium text-sm">{bank.abbreviation}</div>
                          <div className="text-xs text-muted-foreground">{bank.name}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="OTHER" className="py-2 border-t mt-2 pt-2">
                    <div className="font-medium">Other (Custom)</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showCustomBank && (
              <div className="space-y-2">
                <Label>Bank Name (Custom) *</Label>
                <Input value={formData.bankName} onChange={e => handleInputChange('bankName', e.target.value.slice(0, 100))} placeholder="Enter your bank name" maxLength={100} className={fieldErrors.bankName ? 'border-red-500' : ''} />
                <div className="flex justify-between">
                  {fieldErrors.bankName && <p className="text-xs text-red-500">{fieldErrors.bankName}</p>}
                  <p className="text-xs text-muted-foreground ml-auto">{formData.bankName.length}/100</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Account Holder Name *</Label>
              <Input value={formData.accountHolderName} onChange={e => handleInputChange('accountHolderName', e.target.value.slice(0, 150))} placeholder="e.g., Sri Lanka Institute" maxLength={150} className={fieldErrors.accountHolderName ? 'border-red-500' : ''} />
              <div className="flex justify-between">
                {fieldErrors.accountHolderName && <p className="text-xs text-red-500">{fieldErrors.accountHolderName}</p>}
                <p className="text-xs text-muted-foreground ml-auto">{formData.accountHolderName.length}/150</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Account Number / Reference *</Label>
              <Input value={formData.accountHolderNumber} onChange={e => handleInputChange('accountHolderNumber', e.target.value.slice(0, 50))} placeholder="e.g., 1234567890123456" maxLength={50} className={fieldErrors.accountHolderNumber ? 'border-red-500' : ''} />
              <div className="flex justify-between">
                {fieldErrors.accountHolderNumber && <p className="text-xs text-red-500">{fieldErrors.accountHolderNumber}</p>}
                <p className="text-xs text-muted-foreground ml-auto">{formData.accountHolderNumber.length}/50</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Payment'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateClassPaymentForm;
