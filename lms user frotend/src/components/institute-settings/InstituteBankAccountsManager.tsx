import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  instituteBankAccountsApi,
  type InstituteBankAccount,
  type CreateBankAccountPayload,
} from '@/api/instituteBankAccounts.api';
import { SRI_LANKAN_BANKS } from '@/config/sriLankanBanks';
import { Building2, Plus, Pencil, Trash2, Loader2, CheckCircle, AlertTriangle, CreditCard } from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';

interface Props {
  instituteId: string;
  isAdmin: boolean;
}

const EMPTY_FORM = {
  label: '',
  bankId: '',
  customBank: '',
  branch: '',
  accountHolderName: '',
  accountNumber: '',
};

export const InstituteBankAccountsManager: React.FC<Props> = ({ instituteId, isAdmin }) => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<InstituteBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InstituteBankAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showCustomBank, setShowCustomBank] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await instituteBankAccountsApi.list(instituteId, true);
      setAccounts(data);
    } catch (e: any) {
      toast({ title: 'Error', description: getErrorMessage(e, 'Failed to load bank accounts'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [instituteId, toast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowCustomBank(false);
    setFieldErrors({});
    setDialogOpen(true);
  };

  const openEdit = (acc: InstituteBankAccount) => {
    setEditTarget(acc);
    const known = SRI_LANKAN_BANKS.find(b => b.name === acc.bankName);
    setShowCustomBank(!known);
    setForm({
      label: acc.label,
      bankId: known ? known.id : 'OTHER',
      customBank: known ? '' : acc.bankName,
      branch: acc.branch || '',
      accountHolderName: acc.accountHolderName,
      accountNumber: acc.accountNumber,
    });
    setFieldErrors({});
    setDialogOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.label.trim()) errors.label = 'Label is required';
    const bankName = showCustomBank ? form.customBank.trim() : form.bankId ? (SRI_LANKAN_BANKS.find(b => b.id === form.bankId)?.name || '') : '';
    if (!bankName) errors.bank = 'Select a bank';
    if (!form.accountHolderName.trim()) errors.accountHolderName = 'Account holder name is required';
    if (!form.accountNumber.trim()) errors.accountNumber = 'Account number is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const bankName = showCustomBank
      ? form.customBank.trim()
      : SRI_LANKAN_BANKS.find(b => b.id === form.bankId)?.name || '';

    const payload: CreateBankAccountPayload = {
      label: form.label.trim(),
      bankName,
      branch: form.branch.trim() || undefined,
      accountHolderName: form.accountHolderName.trim(),
      accountNumber: form.accountNumber.trim(),
    };

    setSaving(true);
    try {
      if (editTarget) {
        await instituteBankAccountsApi.update(instituteId, editTarget.id, payload);
        toast({ title: 'Updated', description: 'Bank account updated successfully.' });
      } else {
        await instituteBankAccountsApi.create(instituteId, payload);
        toast({ title: 'Created', description: 'Bank account added successfully.' });
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast({ title: 'Error', description: getErrorMessage(e, 'Failed to save bank account'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (acc: InstituteBankAccount) => {
    try {
      await instituteBankAccountsApi.update(instituteId, acc.id, { isActive: !acc.isActive });
      setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, isActive: !acc.isActive } : a));
      toast({ title: acc.isActive ? 'Deactivated' : 'Activated', description: `"${acc.label}" is now ${acc.isActive ? 'inactive' : 'active'}.` });
    } catch (e: any) {
      toast({ title: 'Error', description: getErrorMessage(e), variant: 'destructive' });
    }
  };

  const handleDelete = async (acc: InstituteBankAccount) => {
    if (!window.confirm(`Delete "${acc.label}"? This cannot be undone.`)) return;
    setDeletingId(acc.id);
    try {
      await instituteBankAccountsApi.remove(instituteId, acc.id);
      setAccounts(prev => prev.filter(a => a.id !== acc.id));
      toast({ title: 'Deleted', description: 'Bank account removed.' });
    } catch (e: any) {
      toast({ title: 'Error', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const bankLogo = (bankName: string) => SRI_LANKAN_BANKS.find(b => b.name === bankName)?.logoUrl;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Bank Accounts
              </CardTitle>
              <CardDescription className="mt-1">
                Manage institute bank accounts used for payment collection. When creating a payment, admins select from these accounts — students see the details automatically.
              </CardDescription>
            </div>
            {isAdmin && (
              <Button size="sm" onClick={openCreate} className="shrink-0">
                <Plus className="h-4 w-4 mr-1.5" /> Add Account
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No bank accounts added yet.</p>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add your first bank account
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map(acc => {
                const logo = bankLogo(acc.bankName);
                return (
                  <div
                    key={acc.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                      acc.isActive ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-60'
                    }`}
                  >
                    {/* Bank logo */}
                    <div className="w-10 h-10 rounded-lg border border-border bg-white flex items-center justify-center shrink-0 overflow-hidden">
                      {logo ? (
                        <img src={logo} alt={acc.bankName} className="w-8 h-8 object-contain" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{acc.label}</p>
                        <Badge variant={acc.isActive ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                          {acc.isActive ? <CheckCircle className="h-2.5 w-2.5 mr-1 inline" /> : <AlertTriangle className="h-2.5 w-2.5 mr-1 inline" />}
                          {acc.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {acc.bankName}{acc.branch ? ` · ${acc.branch}` : ''}
                      </p>
                      <p className="text-xs text-foreground/80 mt-0.5">
                        {acc.accountHolderName} · <span className="font-mono">{acc.accountNumber}</span>
                      </p>
                    </div>

                    {/* Actions — admin only */}
                    {isAdmin && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={acc.isActive}
                          onCheckedChange={() => handleToggleActive(acc)}
                          title={acc.isActive ? 'Deactivate' : 'Activate'}
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(acc)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(acc)}
                          disabled={deletingId === acc.id}
                        >
                          {deletingId === acc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Label */}
            <div className="space-y-1.5">
              <Label>Account Label *</Label>
              <Input
                value={form.label}
                onChange={e => { setForm(p => ({ ...p, label: e.target.value })); setFieldErrors(p => ({ ...p, label: '' })); }}
                placeholder="e.g. Main Payments Account"
                maxLength={100}
                className={fieldErrors.label ? 'border-red-500' : ''}
              />
              {fieldErrors.label && <p className="text-xs text-red-500">{fieldErrors.label}</p>}
            </div>

            {/* Bank selector */}
            <div className="space-y-1.5">
              <Label>Bank *</Label>
              <Select
                value={showCustomBank ? 'OTHER' : form.bankId}
                onValueChange={val => {
                  setFieldErrors(p => ({ ...p, bank: '' }));
                  if (val === 'OTHER') { setShowCustomBank(true); setForm(p => ({ ...p, bankId: '' })); }
                  else { setShowCustomBank(false); setForm(p => ({ ...p, bankId: val, customBank: '' })); }
                }}
              >
                <SelectTrigger className={`h-auto p-2 ${fieldErrors.bank ? 'border-red-500' : ''}`}>
                  <SelectValue placeholder="Choose a bank…" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {SRI_LANKAN_BANKS.map(b => (
                    <SelectItem key={b.id} value={b.id} className="py-2">
                      <div className="flex items-center gap-2">
                        <img src={b.logoUrl} alt={b.name} className="h-6 w-6 object-contain rounded"
                          onError={e => { e.currentTarget.style.display = 'none'; }} />
                        <div>
                          <div className="font-medium text-sm">{b.abbreviation}</div>
                          <div className="text-xs text-muted-foreground">{b.name}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="OTHER" className="py-2 border-t mt-1 pt-2">
                    <span className="font-medium">Other (custom)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.bank && <p className="text-xs text-red-500">{fieldErrors.bank}</p>}
            </div>

            {showCustomBank && (
              <div className="space-y-1.5">
                <Label>Bank Name *</Label>
                <Input
                  value={form.customBank}
                  onChange={e => setForm(p => ({ ...p, customBank: e.target.value }))}
                  placeholder="Enter bank name"
                  maxLength={100}
                />
              </div>
            )}

            {/* Branch */}
            <div className="space-y-1.5">
              <Label>Branch <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                value={form.branch}
                onChange={e => setForm(p => ({ ...p, branch: e.target.value }))}
                placeholder="e.g. Colombo 03"
                maxLength={100}
              />
            </div>

            {/* Account holder name */}
            <div className="space-y-1.5">
              <Label>Account Holder Name *</Label>
              <Input
                value={form.accountHolderName}
                onChange={e => { setForm(p => ({ ...p, accountHolderName: e.target.value })); setFieldErrors(p => ({ ...p, accountHolderName: '' })); }}
                placeholder="e.g. Sri Lanka Academy"
                maxLength={150}
                className={fieldErrors.accountHolderName ? 'border-red-500' : ''}
              />
              {fieldErrors.accountHolderName && <p className="text-xs text-red-500">{fieldErrors.accountHolderName}</p>}
            </div>

            {/* Account number */}
            <div className="space-y-1.5">
              <Label>Account Number *</Label>
              <Input
                value={form.accountNumber}
                onChange={e => { setForm(p => ({ ...p, accountNumber: e.target.value })); setFieldErrors(p => ({ ...p, accountNumber: '' })); }}
                placeholder="e.g. 0001234567890"
                maxLength={50}
                className={fieldErrors.accountNumber ? 'border-red-500' : ''}
              />
              {fieldErrors.accountNumber && <p className="text-xs text-red-500">{fieldErrors.accountNumber}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editTarget ? 'Save Changes' : 'Add Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
