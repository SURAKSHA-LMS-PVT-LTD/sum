import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Wallet, ArrowRightLeft, RefreshCw, Plus,
  BarChart3, BookOpen, Banknote, Building2,
  ChevronLeft, ChevronRight, Users, ArrowLeft,
} from 'lucide-react';
import {
  financeApi, FinanceAccount, FinanceCategory, LedgerEntry,
  AnalyticsResult, FinanceSummary, TeacherWalletSummary, CategoryAnalyticsRow,
} from '@/api/finance.api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

type Tab = 'overview' | 'ledger' | 'analytics' | 'teachers';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'overview',  label: 'Overview',  icon: Wallet },
  { key: 'ledger',    label: 'Ledger',    icon: BookOpen },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'teachers',  label: 'Teachers',  icon: Users },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (v: string | number) =>
  `Rs.${parseFloat(String(v)).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;

// ── Account Card ───────────────────────────────────────────────────────────────

function AccountCard({ account }: { account: FinanceAccount }) {
  const Icon = account.type === 'BANK' ? Building2 : Banknote;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <Icon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{account.type}</p>
              <p className="font-semibold truncate max-w-[160px]">{account.name}</p>
            </div>
          </div>
          {!account.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
        </div>
        <p className="mt-4 text-2xl font-bold text-green-700">{fmt(account.currentBalance)}</p>
        {account.bankName && (
          <p className="text-xs text-muted-foreground mt-1">{account.bankName} · {account.accountNumber}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Settle Dialog ──────────────────────────────────────────────────────────────

function SettleDialog({ accounts, open, onClose, onDone }: {
  accounts: FinanceAccount[]; open: boolean; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!from || !to || !amount) return;
    if (from === to) { toast({ title: 'Error', description: 'Source and destination must differ', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      await financeApi.settleFunds({ fromAccountId: from, toAccountId: to, amount: parseFloat(amount), description: desc || undefined });
      toast({ title: 'Funds settled', description: `Rs.${amount} transferred successfully` });
      onDone(); onClose();
      setFrom(''); setTo(''); setAmount(''); setDesc('');
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Settle Funds</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">From Account</label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">To Account</label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Amount (Rs.)</label>
            <Input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Reason for transfer" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handle} disabled={loading || !from || !to || !amount}>{loading ? 'Processing…' : 'Transfer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Account Dialog ─────────────────────────────────────────────────────────

function AddAccountDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<'CASH' | 'BANK'>('CASH');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!name) return;
    setLoading(true);
    try {
      await financeApi.createAccount({ name, type, bankName: bankName || undefined, accountNumber: accountNumber || undefined });
      toast({ title: 'Account created' });
      setName(''); setBankName(''); setAccountNumber('');
      onDone(); onClose();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>New Finance Account</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. BOC Main Account" />
          </div>
          <div>
            <label className="text-sm font-medium">Type</label>
            <Select value={type} onValueChange={v => setType(v as 'CASH' | 'BANK')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="BANK">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === 'BANK' && (
            <>
              <div>
                <label className="text-sm font-medium">Bank Name</label>
                <Input value={bankName} onChange={e => setBankName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Account Number</label>
                <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handle} disabled={loading || !name}>{loading ? 'Creating…' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Manual Record Dialog ───────────────────────────────────────────────────────

function ManualRecordDialog({ accounts, categories, open, onClose, onDone }: {
  accounts: FinanceAccount[]; categories: FinanceCategory[];
  open: boolean; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [recordType, setRecordType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [recordDate, setRecordDate] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredCats = categories.filter(c => c.type === recordType && c.isActive);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !accountId || !description) return;
    setLoading(true);
    try {
      await financeApi.addManualRecord({
        recordType, amount: parseFloat(amount), accountId,
        categoryId: categoryId || undefined,
        description, adminNote: adminNote || undefined,
        recordDate: recordDate || undefined,
      });
      toast({ title: 'Record added successfully' });
      onDone(); onClose();
      setAmount(''); setAccountId(''); setCategoryId(''); setDescription(''); setAdminNote(''); setRecordDate('');
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Manual Record</DialogTitle></DialogHeader>
        <form onSubmit={handle} className="space-y-4">
          <div className="flex gap-2">
            {(['INCOME', 'EXPENSE'] as const).map(t => (
              <button key={t} type="button"
                className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors
                  ${recordType === t
                    ? t === 'INCOME' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                    : 'bg-background border-input'}`}
                onClick={() => { setRecordType(t); setCategoryId(''); }}>
                {t === 'INCOME' ? '+ Income' : '− Expense'}
              </button>
            ))}
          </div>
          <div>
            <label className="text-sm font-medium">Amount (Rs.) *</label>
            <Input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium">Account *</label>
            <Select value={accountId} onValueChange={setAccountId} required>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Category</label>
            <Select value={categoryId || 'none'} onValueChange={v => setCategoryId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {filteredCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Description *</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Electricity bill - March" required />
          </div>
          <div>
            <label className="text-sm font-medium">Date (optional, defaults to today)</label>
            <Input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Admin Note</label>
            <Textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Add Record'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Category Manager ───────────────────────────────────────────────────────────

function CategoryManager({ categories, onCategoryChange }: {
  categories: FinanceCategory[]; onCategoryChange: (cats: FinanceCategory[]) => void;
}) {
  const { toast } = useToast();
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const created = await financeApi.createCategory({ name: newName.trim(), type: newType });
      onCategoryChange([...categories, created]);
      setNewName('');
      toast({ title: 'Category added' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setAdding(false); }
  };

  const toggleActive = async (cat: FinanceCategory) => {
    try {
      const updated = await financeApi.updateCategory(cat.id, { isActive: !cat.isActive });
      onCategoryChange(categories.map(c => c.id === cat.id ? updated : c));
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  const incomeCategories = categories.filter(c => c.type === 'INCOME');
  const expenseCategories = categories.filter(c => c.type === 'EXPENSE');

  return (
    <div className="border rounded-md p-4 mt-2 space-y-4">
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-40">
          <label className="text-xs text-muted-foreground">Category Name</label>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Electricity Bill"
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())} />
        </div>
        <div className="w-36">
          <label className="text-xs text-muted-foreground">Type</label>
          <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="INCOME">Income</SelectItem>
              <SelectItem value="EXPENSE">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAdd} disabled={adding || !newName.trim()} size="sm">Add</Button>
      </div>
      <div>
        <p className="text-xs font-semibold text-green-700 mb-2">Income Categories</p>
        <div className="flex flex-wrap gap-2">
          {incomeCategories.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
          {incomeCategories.map(c => (
            <span key={c.id} title={c.isActive ? 'Click to deactivate' : 'Click to activate'}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border cursor-pointer transition-opacity
                ${c.isActive ? 'bg-green-50 border-green-200 text-green-800' : 'opacity-40 line-through bg-muted'}`}
              onClick={() => toggleActive(c)}>
              {c.name}
            </span>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-red-700 mb-2">Expense Categories</p>
        <div className="flex flex-wrap gap-2">
          {expenseCategories.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
          {expenseCategories.map(c => (
            <span key={c.id} title={c.isActive ? 'Click to deactivate' : 'Click to activate'}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border cursor-pointer transition-opacity
                ${c.isActive ? 'bg-red-50 border-red-200 text-red-800' : 'opacity-40 line-through bg-muted'}`}
              onClick={() => toggleActive(c)}>
              {c.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Teacher Action Dialogs ─────────────────────────────────────────────────────

function TeacherAdvanceDialog({ teacherId, accounts, open, onClose, onDone }: {
  teacherId: string; accounts: FinanceAccount[];
  open: boolean; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !fromAccountId || !description) return;
    setLoading(true);
    try {
      await financeApi.giveTeacherAdvance({ teacherId, amount: parseFloat(amount), fromAccountId, description, adminNote: adminNote || undefined });
      toast({ title: 'Advance recorded successfully' });
      onDone(); onClose();
      setAmount(''); setFromAccountId(''); setDescription(''); setAdminNote('');
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Give Teacher Advance</DialogTitle></DialogHeader>
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Amount (Rs.) *</label>
            <Input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium">Debit From Account *</label>
            <Select value={fromAccountId} onValueChange={setFromAccountId} required>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({fmt(a.currentBalance)})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Description *</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. February advance" required />
          </div>
          <div>
            <label className="text-sm font-medium">Admin Note (optional)</label>
            <Textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Give Advance'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TeacherDeductDialog({ teacherId, accounts, categories, open, onClose, onDone }: {
  teacherId: string; accounts: FinanceAccount[]; categories: FinanceCategory[];
  open: boolean; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !adminNote) return;
    setLoading(true);
    try {
      await financeApi.deductTeacher({
        teacherId, amount: parseFloat(amount),
        toAccountId: toAccountId || undefined,
        categoryId: categoryId || undefined,
        adminNote,
      });
      toast({ title: 'Deduction applied' });
      onDone(); onClose();
      setAmount(''); setToAccountId(''); setCategoryId(''); setAdminNote('');
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Apply Deduction</DialogTitle></DialogHeader>
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Amount (Rs.) *</label>
            <Input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium">Credit To Account (optional)</label>
            <Select value={toAccountId || 'none'} onValueChange={v => setToAccountId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Category (optional)</label>
            <Select value={categoryId || 'none'} onValueChange={v => setCategoryId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {categories.filter(c => c.type === 'EXPENSE' && c.isActive).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Reason *</label>
            <Textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Reason for deduction (e.g. Printing charges)" rows={2} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Apply Deduction'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TeacherPayoutDialog({ teacherId, accounts, open, onClose, onDone }: {
  teacherId: string; accounts: FinanceAccount[];
  open: boolean; onClose: () => void; onDone: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !fromAccountId) return;
    setLoading(true);
    try {
      await financeApi.payoutTeacher({ teacherId, amount: parseFloat(amount), fromAccountId, description: description || undefined });
      toast({ title: 'Payout processed' });
      onDone(); onClose();
      setAmount(''); setFromAccountId(''); setDescription('');
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Pay Out to Teacher</DialogTitle></DialogHeader>
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Amount (Rs.) *</label>
            <Input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm font-medium">Debit From Account *</label>
            <Select value={fromAccountId} onValueChange={setFromAccountId} required>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({fmt(a.currentBalance)})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. March salary payout" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Processing…' : 'Process Payout'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Ledger Table ───────────────────────────────────────────────────────────────

function LedgerTable({ entries, page, totalPages, onPage }: {
  entries: LedgerEntry[]; page: number; totalPages: number; onPage: (p: number) => void;
}) {
  return (
    <div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Source</th>
              <th className="p-3 text-left hidden sm:table-cell">Account</th>
              <th className="p-3 text-left hidden md:table-cell">Student / Teacher</th>
              <th className="p-3 text-left hidden sm:table-cell">Description</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-center">Type</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No entries found</td></tr>
            )}
            {entries.map(e => (
              <tr key={e.id} className="border-t hover:bg-muted/20">
                <td className="p-3 whitespace-nowrap text-xs">{new Date(e.createdAt).toLocaleDateString()}</td>
                <td className="p-3"><Badge variant="outline" className="text-xs">{e.txSource.replace(/_/g, ' ')}</Badge></td>
                <td className="p-3 text-xs hidden sm:table-cell">{e.toAccount?.name || e.fromAccount?.name || '—'}</td>
                <td className="p-3 text-xs hidden md:table-cell">{e.studentName || (e.teacherId ? `Teacher #${e.teacherId}` : '—')}</td>
                <td className="p-3 text-xs max-w-[180px] truncate hidden sm:table-cell">{e.description || '—'}</td>
                <td className={`p-3 text-right font-semibold text-xs ${e.type === 'CREDIT' ? 'text-green-700' : 'text-red-600'}`}>
                  <div>{e.type === 'CREDIT' ? '+' : '-'}{fmt(e.amount)}</div>
                  {e.teacherAmount && parseFloat(e.teacherAmount) > 0 && (
                    <div className="text-[10px] text-muted-foreground font-normal leading-tight">
                      Teacher: {fmt(e.teacherAmount)} ({e.commissionPct}%)
                      <br />Inst: {fmt(e.instituteAmount ?? '0')}
                    </div>
                  )}
                </td>
                <td className="p-3 text-center">
                  <Badge className={e.type === 'CREDIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{e.type}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const FinanceHubPage: React.FC = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab) || 'overview';
  const setTab = (tab: Tab) => setSearchParams(prev => { prev.set('tab', tab); return prev; }, { replace: true });

  // Global data
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);

  // Ledger state
  const [ledger, setLedger] = useState<{ data: LedgerEntry[]; total: number; totalPages: number }>({ data: [], total: 0, totalPages: 1 });
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerType, setLedgerType] = useState<'all' | 'CREDIT' | 'DEBIT'>('all');

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [categoryAnalytics, setCategoryAnalytics] = useState<CategoryAnalyticsRow[]>([]);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  // Teachers state
  const [teachers, setTeachers] = useState<TeacherWalletSummary[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [teacherLedger, setTeacherLedger] = useState<LedgerEntry[]>([]);
  const [teacherLedgerLoading, setTeacherLedgerLoading] = useState(false);
  const [teacherLedgerPage, setTeacherLedgerPage] = useState(1);
  const [teacherLedgerTotal, setTeacherLedgerTotal] = useState(0);
  const [teacherLedgerTotalPages, setTeacherLedgerTotalPages] = useState(1);

  // Dialog state
  const [settleOpen, setSettleOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [manualRecordOpen, setManualRecordOpen] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [advanceTeacherId, setAdvanceTeacherId] = useState<string | null>(null);
  const [deductTeacherId, setDeductTeacherId] = useState<string | null>(null);
  const [payoutTeacherId, setPayoutTeacherId] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const s = await financeApi.getSummary();
      setSummary(s);
      setAccounts(s.accounts);
    } catch (e: any) {
      toast({ title: 'Failed to load finance data', description: e.message, variant: 'destructive' });
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try { setCategories(await financeApi.getCategories()); } catch {}
  }, []);

  const loadLedger = useCallback(async () => {
    try {
      const res = await financeApi.getLedger({ page: ledgerPage, limit: 20, type: ledgerType === 'all' ? undefined : ledgerType });
      setLedger(res);
    } catch {}
  }, [ledgerPage, ledgerType]);

  const loadAnalytics = useCallback(async () => {
    try {
      const [res, catRes] = await Promise.all([
        financeApi.getAnalytics({ period: analyticsPeriod }),
        financeApi.getAnalyticsByCategory(),
      ]);
      setAnalytics(res);
      setCategoryAnalytics(catRes.data);
    } catch {}
  }, [analyticsPeriod]);

  const loadTeachers = useCallback(async () => {
    setTeachersLoading(true);
    try {
      const res = await financeApi.getTeachersSummary();
      setTeachers(res.data);
    } catch (e: any) {
      toast({ title: 'Failed to load teacher wallets', description: e.message, variant: 'destructive' });
    } finally { setTeachersLoading(false); }
  }, []);

  const loadTeacherLedger = useCallback(async (teacherId: string, page: number) => {
    setTeacherLedgerLoading(true);
    try {
      const res = await financeApi.getTeacherLedger(teacherId, { page, limit: 20 });
      setTeacherLedger(res.data);
      setTeacherLedgerTotal(res.total);
      setTeacherLedgerTotalPages(res.totalPages);
    } catch (e: any) {
      toast({ title: 'Failed to load teacher ledger', description: e.message, variant: 'destructive' });
    } finally { setTeacherLedgerLoading(false); }
  }, []);

  useEffect(() => { loadSummary(); loadCategories(); }, []);
  useEffect(() => { if (activeTab === 'ledger') loadLedger(); }, [activeTab, loadLedger]);
  useEffect(() => { if (activeTab === 'analytics') loadAnalytics(); }, [activeTab, loadAnalytics]);
  useEffect(() => { if (activeTab === 'teachers') loadTeachers(); }, [activeTab, loadTeachers]);
  useEffect(() => {
    if (selectedTeacherId) loadTeacherLedger(selectedTeacherId, teacherLedgerPage);
  }, [selectedTeacherId, teacherLedgerPage]);

  const handleSelectTeacher = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setTeacherLedgerPage(1);
  };

  const handleBackToTeacherList = () => {
    setSelectedTeacherId(null);
    setTeacherLedgerPage(1);
  };

  const selectedWallet = teachers.find(t => t.teacherId === selectedTeacherId);

  return (
    <PageContainer>
      <div className="max-w-7xl mx-auto space-y-5 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Finance Hub</h1>
            <p className="text-muted-foreground text-sm">Manage accounts, ledger, teacher earnings, and analytics</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={loadSummary}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
            <Button variant="outline" size="sm" onClick={() => setAddAccountOpen(true)}><Plus className="h-4 w-4 mr-1" />Account</Button>
            <Button variant="outline" size="sm" onClick={() => setManualRecordOpen(true)}><Plus className="h-4 w-4 mr-1" />Record</Button>
            <Button size="sm" onClick={() => setSettleOpen(true)}><ArrowRightLeft className="h-4 w-4 mr-1" />Settle Funds</Button>
          </div>
        </div>

        {/* Summary strip */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Balance', value: summary.totalBalance, icon: Wallet,    color: 'text-blue-700 bg-blue-50' },
              { label: 'Cash',          value: summary.cashBalance,  icon: Banknote,  color: 'text-amber-700 bg-amber-50' },
              { label: 'Bank',          value: summary.bankBalance,  icon: Building2, color: 'text-violet-700 bg-violet-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`rounded-full p-3 ${color.split(' ')[1]}`}>
                    <Icon className={`h-5 w-5 ${color.split(' ')[0]}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold">{fmt(value)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex border-b gap-0 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ─────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.length === 0 && (
                <p className="text-muted-foreground text-sm col-span-3">No accounts found. Create one to get started.</p>
              )}
              {accounts.map(a => <AccountCard key={a.id} account={a} />)}
            </div>

            {/* Category Manager toggle */}
            <div>
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 border rounded-md text-sm font-medium hover:bg-muted/30 transition-colors"
                onClick={() => setShowCategoryManager(v => !v)}>
                <span>Manage Categories</span>
                <span className="text-muted-foreground text-xs">{showCategoryManager ? '▲ Hide' : '▼ Show'}</span>
              </button>
              {showCategoryManager && (
                <CategoryManager categories={categories} onCategoryChange={setCategories} />
              )}
            </div>
          </div>
        )}

        {/* ── Ledger Tab ───────────────────────────────────────────────── */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <Select value={ledgerType} onValueChange={v => { setLedgerType(v as typeof ledgerType); setLedgerPage(1); }}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                  <SelectItem value="DEBIT">Debit</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadLedger}><RefreshCw className="h-4 w-4 mr-1" />Reload</Button>
              <span className="text-sm text-muted-foreground ml-auto">{ledger.total} entries</span>
            </div>
            <LedgerTable entries={ledger.data} page={ledgerPage} totalPages={ledger.totalPages} onPage={setLedgerPage} />
          </div>
        )}

        {/* ── Analytics Tab ────────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex gap-2 flex-wrap">
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
                <Button key={p} size="sm" variant={analyticsPeriod === p ? 'default' : 'outline'} onClick={() => setAnalyticsPeriod(p)} className="capitalize">{p}</Button>
              ))}
            </div>

            {analytics && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Income',  value: analytics.summary.totalIncome,  color: 'text-green-700' },
                    { label: 'Expense', value: analytics.summary.totalExpense, color: 'text-red-600' },
                    { label: 'Net',     value: analytics.summary.net,          color: parseFloat(analytics.summary.net) >= 0 ? 'text-blue-700' : 'text-red-700' },
                  ].map(({ label, value, color }) => (
                    <Card key={label}>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`text-lg font-bold ${color}`}>{fmt(value)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card>
                  <CardContent className="p-4">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={analytics.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: any) => fmt(String(v))} />
                        <Legend />
                        <Bar dataKey="income"  name="Income"  fill="#22c55e" />
                        <Bar dataKey="expense" name="Expense" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Category breakdown */}
                {categoryAnalytics.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm font-semibold text-green-700 mb-3">Income by Category</p>
                        {categoryAnalytics.filter(r => r.categoryType === 'INCOME').map(r => (
                          <div key={r.category ?? 'uncategorized'} className="flex justify-between items-center py-1.5 border-b text-sm last:border-0">
                            <span className="text-muted-foreground">{r.category ?? 'Uncategorized'}</span>
                            <span className="font-medium text-green-600">{fmt(r.total)}</span>
                          </div>
                        ))}
                        {categoryAnalytics.filter(r => r.categoryType === 'INCOME').length === 0 && (
                          <p className="text-xs text-muted-foreground">No categorized income</p>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm font-semibold text-red-700 mb-3">Expenses by Category</p>
                        {categoryAnalytics.filter(r => r.categoryType === 'EXPENSE').map(r => (
                          <div key={r.category ?? 'uncategorized'} className="flex justify-between items-center py-1.5 border-b text-sm last:border-0">
                            <span className="text-muted-foreground">{r.category ?? 'Uncategorized'}</span>
                            <span className="font-medium text-red-600">{fmt(r.total)}</span>
                          </div>
                        ))}
                        {categoryAnalytics.filter(r => r.categoryType === 'EXPENSE').length === 0 && (
                          <p className="text-xs text-muted-foreground">No categorized expenses</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Source breakdown */}
                {analytics.bySource && analytics.bySource.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm font-semibold mb-3">Breakdown by Transaction Source</p>
                      <div className="space-y-1">
                        {analytics.bySource.map(s => (
                          <div key={s.source} className="flex justify-between items-center py-1.5 border-b text-sm last:border-0">
                            <span className="text-muted-foreground">{s.source.replace(/_/g, ' ')}</span>
                            <span className="flex gap-3">
                              {parseFloat(s.income) > 0 && <span className="text-green-600">+{fmt(s.income)}</span>}
                              {parseFloat(s.expense) > 0 && <span className="text-red-500">-{fmt(s.expense)}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
            {!analytics && <div className="text-center text-muted-foreground py-10">Loading analytics…</div>}
          </div>
        )}

        {/* ── Teachers Tab ─────────────────────────────────────────────── */}
        {activeTab === 'teachers' && (
          <div className="space-y-4">
            {!selectedTeacherId ? (
              // Teachers list — ALL institute teachers
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h2 className="text-lg font-semibold">Teachers</h2>
                    <p className="text-xs text-muted-foreground">{teachers.length} teacher{teachers.length !== 1 ? 's' : ''} · click a row to view ledger</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadTeachers}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
                </div>
                {teachersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading…</div>
                ) : teachers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No active teachers found in this institute.</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-4 py-3 text-left">Teacher</th>
                          <th className="px-4 py-3 text-right">Total Earned</th>
                          <th className="px-4 py-3 text-right hidden md:table-cell">Deductions</th>
                          <th className="px-4 py-3 text-right hidden md:table-cell">Paid Out</th>
                          <th className="px-4 py-3 text-right font-semibold">Balance</th>
                          <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teachers.map(t => {
                          const hasWallet = !!t.walletId;
                          return (
                            <tr key={t.teacherId}
                              className={`border-t hover:bg-muted/20 ${hasWallet ? 'cursor-pointer' : ''}`}
                              onClick={() => hasWallet && handleSelectTeacher(t.teacherId)}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {t.teacherImageUrl ? (
                                    <img src={t.teacherImageUrl} alt=""
                                      className="h-9 w-9 rounded-full object-cover shrink-0 border" />
                                  ) : (
                                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 border">
                                      <span className="text-xs font-semibold text-muted-foreground">
                                        {(t.teacherName || '?').charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium text-sm">{t.teacherName || `Teacher #${t.teacherId}`}</div>
                                    {t.teacherEmail && <div className="text-xs text-muted-foreground">{t.teacherEmail}</div>}
                                    {t.instituteUserId && <div className="text-xs text-muted-foreground">ID: {t.instituteUserId}</div>}
                                  </div>
                                </div>
                              </td>
                              {hasWallet ? (
                                <>
                                  <td className="px-4 py-3 text-right text-green-600">{fmt(t.totalEarned ?? '0')}</td>
                                  <td className="px-4 py-3 text-right text-red-500 hidden md:table-cell">{fmt(t.totalDeductions ?? '0')}</td>
                                  <td className="px-4 py-3 text-right text-blue-500 hidden md:table-cell">{fmt(t.totalPaidOut ?? '0')}</td>
                                  <td className="px-4 py-3 text-right font-bold">{fmt(t.balance ?? '0')}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex gap-1 justify-center flex-wrap" onClick={e => e.stopPropagation()}>
                                      <Button size="sm" variant="outline" className="text-xs h-7"
                                        onClick={() => setPayoutTeacherId(t.teacherId)}>Payout</Button>
                                      <Button size="sm" variant="outline" className="text-xs h-7"
                                        onClick={() => setAdvanceTeacherId(t.teacherId)}>Advance</Button>
                                      <Button size="sm" variant="outline" className="text-xs h-7"
                                        onClick={() => setDeductTeacherId(t.teacherId)}>Deduct</Button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td colSpan={4} className="px-4 py-3 text-xs text-muted-foreground italic">
                                    No wallet — initialize to enable earnings tracking
                                  </td>
                                  <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                    <InitWalletButton teacherId={t.teacherId} onDone={loadTeachers} />
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              // Teacher drill-down
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={handleBackToTeacherList}>
                    <ArrowLeft className="h-4 w-4 mr-1" />Back
                  </Button>
                  {selectedWallet?.teacherImageUrl ? (
                    <img src={selectedWallet.teacherImageUrl} alt=""
                      className="h-9 w-9 rounded-full object-cover border shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center border shrink-0">
                      <span className="text-sm font-semibold text-muted-foreground">
                        {(selectedWallet?.teacherName || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <h2 className="text-lg font-semibold">
                    {selectedWallet?.teacherName ? `${selectedWallet.teacherName}'s Ledger` : `Teacher Ledger`}
                  </h2>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPayoutTeacherId(selectedTeacherId)}>Payout</Button>
                    <Button size="sm" variant="outline" onClick={() => setAdvanceTeacherId(selectedTeacherId)}>Advance</Button>
                    <Button size="sm" variant="outline" onClick={() => setDeductTeacherId(selectedTeacherId)}>Deduct</Button>
                  </div>
                </div>

                {/* Wallet summary cards */}
                {selectedWallet && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Earned', value: selectedWallet.totalEarned, color: 'text-green-600' },
                      { label: 'Deductions',   value: selectedWallet.totalDeductions, color: 'text-red-500' },
                      { label: 'Paid Out',      value: selectedWallet.totalPaidOut, color: 'text-blue-500' },
                      { label: 'Balance',       value: selectedWallet.balance, color: 'text-foreground font-bold' },
                    ].map(c => (
                      <Card key={c.label}>
                        <CardContent className="p-3">
                          <p className="text-xs text-muted-foreground">{c.label}</p>
                          <p className={`text-base mt-1 ${c.color}`}>{fmt(c.value)}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Teacher ledger */}
                {teacherLedgerLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading ledger…</div>
                ) : (
                  <LedgerTable
                    entries={teacherLedger}
                    page={teacherLedgerPage}
                    totalPages={teacherLedgerTotalPages}
                    onPage={p => setTeacherLedgerPage(p)}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Global dialogs */}
      <SettleDialog accounts={accounts} open={settleOpen} onClose={() => setSettleOpen(false)} onDone={loadSummary} />
      <AddAccountDialog open={addAccountOpen} onClose={() => setAddAccountOpen(false)} onDone={loadSummary} />
      <ManualRecordDialog
        accounts={accounts} categories={categories}
        open={manualRecordOpen} onClose={() => setManualRecordOpen(false)} onDone={loadSummary}
      />

      {/* Teacher dialogs */}
      {advanceTeacherId && (
        <TeacherAdvanceDialog
          teacherId={advanceTeacherId} accounts={accounts}
          open onClose={() => setAdvanceTeacherId(null)}
          onDone={() => { loadSummary(); loadTeachers(); if (selectedTeacherId) loadTeacherLedger(selectedTeacherId, teacherLedgerPage); }}
        />
      )}
      {deductTeacherId && (
        <TeacherDeductDialog
          teacherId={deductTeacherId} accounts={accounts} categories={categories}
          open onClose={() => setDeductTeacherId(null)}
          onDone={() => { loadSummary(); loadTeachers(); if (selectedTeacherId) loadTeacherLedger(selectedTeacherId, teacherLedgerPage); }}
        />
      )}
      {payoutTeacherId && (
        <TeacherPayoutDialog
          teacherId={payoutTeacherId} accounts={accounts}
          open onClose={() => setPayoutTeacherId(null)}
          onDone={() => { loadSummary(); loadTeachers(); if (selectedTeacherId) loadTeacherLedger(selectedTeacherId, teacherLedgerPage); }}
        />
      )}
    </PageContainer>
  );
};

export default FinanceHubPage;
