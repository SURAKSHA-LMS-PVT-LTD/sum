import React, { useState, useEffect, useCallback } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, Minus, ArrowDownLeft, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { financeApi, TeacherWallet, LedgerEntry } from '@/api/finance.api';
import { useToast } from '@/hooks/use-toast';

const TeacherFinancePage: React.FC = () => {
  const { toast } = useToast();
  const [wallet, setWallet] = useState<TeacherWallet | null>(null);
  const [ledger, setLedger] = useState<{ data: LedgerEntry[]; totalPages: number; total: number }>({ data: [], totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, l] = await Promise.all([
        financeApi.getMyWallet(),
        financeApi.getMyLedger({ page, limit: 20 }),
      ]);
      setWallet(w);
      setLedger(l);
    } catch (e: any) {
      toast({ title: 'Failed to load finance data', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const fmt = (v: string) => `Rs.${parseFloat(v).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto space-y-6 pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Earnings</h1>
            <p className="text-muted-foreground text-sm">Your wallet and earnings history</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>

        {/* Wallet summary */}
        {wallet ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Available Balance', value: wallet.balance, icon: Wallet, color: 'text-green-700 bg-green-50' },
              { label: 'Total Earned', value: wallet.totalEarned, icon: TrendingUp, color: 'text-blue-700 bg-blue-50' },
              { label: 'Deductions', value: wallet.totalDeductions, icon: Minus, color: 'text-red-600 bg-red-50' },
              { label: 'Paid Out', value: wallet.totalPaidOut, icon: ArrowDownLeft, color: 'text-violet-700 bg-violet-50' },
            ].map(({ label, value, icon: Icon, color }) => (
              <Card key={label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`rounded-full p-2 ${color.split(' ')[1]}`}>
                    <Icon className={`h-4 w-4 ${color.split(' ')[0]}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-bold text-sm">{fmt(value)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No wallet found. Earnings will appear here once a payment is processed.
            </CardContent>
          </Card>
        )}

        {/* Ledger */}
        <Card>
          <CardHeader><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Source</th>
                    <th className="p-3 text-left">Student</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.data.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No transactions yet</td></tr>
                  )}
                  {ledger.data.map(e => (
                    <tr key={e.id} className="border-t hover:bg-muted/20">
                      <td className="p-3 whitespace-nowrap">{new Date(e.createdAt).toLocaleDateString()}</td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{e.txSource.replace(/_/g, ' ')}</Badge></td>
                      <td className="p-3 text-xs">{e.studentName || '—'}</td>
                      <td className="p-3 text-xs max-w-[160px] truncate">{e.description || '—'}</td>
                      <td className={`p-3 text-right font-semibold ${e.type === 'CREDIT' ? 'text-green-700' : 'text-red-600'}`}>
                        {e.type === 'CREDIT' ? '+' : '-'}{fmt(e.teacherAmount || e.amount)}
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
            {ledger.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">Page {page} of {ledger.totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= ledger.totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
};

export default TeacherFinancePage;
