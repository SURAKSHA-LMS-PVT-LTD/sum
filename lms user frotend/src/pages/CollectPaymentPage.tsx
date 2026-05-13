import React, { useState, useEffect } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { financeApi, FinanceAccount, FinanceCategory } from '@/api/finance.api';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';

const CollectPaymentPage: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledClassId = searchParams.get('classId') || '';

  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);

  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [classId, setClassId] = useState(prefilledClassId);
  const [amount, setAmount] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([financeApi.getAccounts(), financeApi.getCategories()])
      .then(([accs, cats]) => {
        setAccounts(accs);
        setCategories(cats.filter(c => c.type === 'INCOME'));
        const cashLocker = accs.find(a => a.name === 'Cash Locker' && a.isActive);
        if (cashLocker) setTargetAccountId(cashLocker.id);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!studentId || !classId || !amount || !targetAccountId) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await financeApi.collectPhysical({
        studentId,
        studentName: studentName || undefined,
        classId,
        amount: parseFloat(amount),
        targetAccountId,
        categoryId: categoryId || undefined,
        description: description || undefined,
      });
      setSuccess(true);
      toast({ title: 'Payment collected', description: `Rs.${amount} recorded successfully` });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const reset = () => {
    setStudentId(''); setStudentName(''); setClassId(prefilledClassId);
    setAmount(''); setDescription(''); setSuccess(false);
  };

  return (
    <PageContainer>
      <div className="max-w-lg mx-auto space-y-6 pb-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-xl font-bold">Collect Payment</h1>
            <p className="text-muted-foreground text-sm">Record physical cash payment from a student</p>
          </div>
        </div>

        {success ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
              <p className="text-lg font-semibold">Payment Recorded</p>
              <p className="text-muted-foreground text-sm">Rs.{amount} has been credited to the selected account.</p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={reset}>Record Another</Button>
                <Button onClick={() => navigate(-1)}>Done</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base">Payment Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Student ID <span className="text-red-500">*</span></label>
                <Input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="Enter student user ID" />
              </div>
              <div>
                <label className="text-sm font-medium">Student Name</label>
                <Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Display name (optional)" />
              </div>
              <div>
                <label className="text-sm font-medium">Class ID <span className="text-red-500">*</span></label>
                <Input value={classId} onChange={e => setClassId(e.target.value)} placeholder="Class identifier" readOnly={!!prefilledClassId} />
              </div>
              <div>
                <label className="text-sm font-medium">Amount (Rs.) <span className="text-red-500">*</span></label>
                <Input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium">Credit Account <span className="text-red-500">*</span></label>
                <Select value={targetAccountId} onValueChange={setTargetAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name} — Rs.{parseFloat(a.currentBalance).toLocaleString()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Select category (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional note" />
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Processing…' : 'Record Payment'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
};

export default CollectPaymentPage;
