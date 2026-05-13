import React, { useState, useEffect, useCallback } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Wallet, TrendingUp, TrendingDown, ArrowRightLeft, RefreshCw,
  Plus, Settings, BarChart3, BookOpen, CreditCard, Banknote, Building2,
  ChevronLeft, ChevronRight, Download,
} from 'lucide-react';
import {
  financeApi, FinanceAccount, FinanceCategory, LedgerEntry,
  AnalyticsResult, FinanceSummary,
} from '@/api/finance.api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ── Balance Card ───────────────────────────────────────────────────────────────

function AccountCard({ account, onEdit }: { account: FinanceAccount; onEdit: (a: FinanceAccount) => void }) {
  const Icon = account.type === 'BANK' ? Building2 : Banknote;
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-2">
              <Icon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{account.type}</p>
              <p className="font-semibold truncate max-w-[160px]">{account.name}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onEdit(account)}><Settings className="h-4 w-4" /></Button>
        </div>
        <p className="mt-4 text-2xl font-bold text-green-700">
          Rs.{parseFloat(account.currentBalance).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
        </p>
        {account.bankName && <p className="text-xs text-muted-foreground mt-1">{account.bankName} · {account.accountNumber}</p>}
        {!account.isActive && <Badge variant="destructive" className="mt-2">Inactive</Badge>}
      </CardContent>
    </Card>
  );
}

// ── Settle Dialog ──────────────────────────────────────────────────────────────

function SettleDialog({ accounts, open, onClose, onDone }: {
  accounts: FinanceAccount[];
  open: boolean;
  onClose: () => void;
  onDone: () => void;
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
      onDone();
      onClose();
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
          <Button onClick={handle} disabled={loading || !from || !to || !amount}>
            {loading ? 'Processing…' : 'Transfer'}
          </Button>
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
            <Select value={type} onValueChange={v => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="BANK">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === 'BANK' && <>
            <div>
              <label className="text-sm font-medium">Bank Name</label>
              <Input value={bankName} onChange={e => setBankName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Account Number</label>
              <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
            </div>
          </>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handle} disabled={loading || !name}>{loading ? 'Creating…' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Ledger Table ───────────────────────────────────────────────────────────────

function LedgerTable({ entries, page, totalPages, onPage }: {
  entries: LedgerEntry[];
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  return (
    <div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Source</th>
              <th className="p-3 text-left">Account</th>
              <th className="p-3 text-left">Student / Teacher</th>
              <th className="p-3 text-left">Description</th>
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
                <td className="p-3 whitespace-nowrap">{new Date(e.createdAt).toLocaleDateString()}</td>
                <td className="p-3"><Badge variant="outline" className="text-xs">{e.txSource.replace(/_/g, ' ')}</Badge></td>
                <td className="p-3 text-xs">{e.toAccount?.name || e.fromAccount?.name || '—'}</td>
                <td className="p-3 text-xs">{e.studentName || (e.teacherId ? `Teacher #${e.teacherId}` : '—')}</td>
                <td className="p-3 text-xs max-w-[180px] truncate">{e.description || '—'}</td>
                <td className={`p-3 text-right font-semibold ${e.type === 'CREDIT' ? 'text-green-700' : 'text-red-600'}`}>
                  {e.type === 'CREDIT' ? '+' : '-'}Rs.{parseFloat(e.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </td>
                <td className="p-3 text-center">
                  <Badge className={e.type === 'CREDIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {e.type}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const FinanceHubPage: React.FC = () => {
  const { toast } = useToast();

  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [ledger, setLedger] = useState<{ data: LedgerEntry[]; total: number; totalPages: number }>({ data: [], total: 0, totalPages: 1 });
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);

  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerType, setLedgerType] = useState<'' | 'CREDIT' | 'DEBIT'>('');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

  const [settleOpen, setSettleOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'analytics'>('overview');
  const [loading, setLoading] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const [s, cats] = await Promise.all([financeApi.getSummary(), financeApi.getCategories()]);
      setSummary(s);
      setAccounts(s.accounts);
      setCategories(cats);
    } catch (e: any) {
      toast({ title: 'Failed to load finance data', description: e.message, variant: 'destructive' });
    }
  }, []);

  const loadLedger = useCallback(async () => {
    try {
      const res = await financeApi.getLedger({ page: ledgerPage, limit: 20, type: ledgerType || undefined });
      setLedger(res);
    } catch {}
  }, [ledgerPage, ledgerType]);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await financeApi.getAnalytics({ period: analyticsPeriod });
      setAnalytics(res);
    } catch {}
  }, [analyticsPeriod]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { if (activeTab === 'ledger') loadLedger(); }, [activeTab, loadLedger]);
  useEffect(() => { if (activeTab === 'analytics') loadAnalytics(); }, [activeTab, loadAnalytics]);

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Wallet },
    { key: 'ledger', label: 'Ledger', icon: BookOpen },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  ] as const;

  return (
    <PageContainer>
      <div className="max-w-7xl mx-auto space-y-6 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Finance Hub</h1>
            <p className="text-muted-foreground text-sm">Manage accounts, ledger, and teacher earnings</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadSummary}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
            <Button variant="outline" size="sm" onClick={() => setAddAccountOpen(true)}><Plus className="h-4 w-4 mr-1" />Account</Button>
            <Button size="sm" onClick={() => setSettleOpen(true)}><ArrowRightLeft className="h-4 w-4 mr-1" />Settle Funds</Button>
          </div>
        </div>

        {/* Summary Strip */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Balance', value: summary.totalBalance, icon: Wallet, color: 'text-blue-700 bg-blue-50' },
              { label: 'Cash', value: summary.cashBalance, icon: Banknote, color: 'text-amber-700 bg-amber-50' },
              { label: 'Bank', value: summary.bankBalance, icon: Building2, color: 'text-violet-700 bg-violet-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`rounded-full p-3 ${color.split(' ')[1]}`}>
                    <Icon className={`h-5 w-5 ${color.split(' ')[0]}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold">Rs.{parseFloat(value).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map(a => (
              <AccountCard key={a.id} account={a} onEdit={() => {}} />
            ))}
          </div>
        )}

        {/* Ledger Tab */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              <Select value={ledgerType} onValueChange={v => { setLedgerType(v as any); setLedgerPage(1); }}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
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

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <div className="flex gap-3 items-center flex-wrap">
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
                <Button
                  key={p}
                  size="sm"
                  variant={analyticsPeriod === p ? 'default' : 'outline'}
                  onClick={() => setAnalyticsPeriod(p)}
                  className="capitalize"
                >{p}</Button>
              ))}
            </div>

            {analytics && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Total Income', value: analytics.summary.totalIncome, color: 'text-green-700' },
                    { label: 'Total Expense', value: analytics.summary.totalExpense, color: 'text-red-600' },
                    { label: 'Net', value: analytics.summary.net, color: parseFloat(analytics.summary.net) >= 0 ? 'text-blue-700' : 'text-red-700' },
                  ].map(({ label, value, color }) => (
                    <Card key={label}>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`text-xl font-bold ${color}`}>Rs.{parseFloat(value).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card>
                  <CardContent className="p-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analytics.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: any) => `Rs.${parseFloat(String(v)).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`} />
                        <Legend />
                        <Bar dataKey="income" name="Income" fill="#22c55e" />
                        <Bar dataKey="expense" name="Expense" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>

      <SettleDialog accounts={accounts} open={settleOpen} onClose={() => setSettleOpen(false)} onDone={loadSummary} />
      <AddAccountDialog open={addAccountOpen} onClose={() => setAddAccountOpen(false)} onDone={loadSummary} />
    </PageContainer>
  );
};

export default FinanceHubPage;
