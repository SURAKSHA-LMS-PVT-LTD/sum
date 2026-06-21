/**
 * ManageSmartCardsPage — institute-admin view of the smart-card pool.
 *
 * Institute admins don't manage raw card ids (those are system-admin owned). They:
 *  - see COUNTS of available / assigned cards by scope, and
 *  - assign a card to a user by SEARCHING their own pool and picking one (or auto).
 *
 * Gated on the 'smart-cards' feature being enabled for the institute.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Search, Loader2, UserCheck, RefreshCw } from 'lucide-react';
import { smartCardsApi, SmartCard, SmartCardScope, InstituteSmartCardCounts } from '@/api/smartCards.api';
import { usersApi } from '@/api/users.api';

const ManageSmartCardsPage: React.FC = () => {
  const { selectedInstitute, currentInstituteId } = useAuth();
  const { isFeatureEnabled } = useFeatures();
  const { toast } = useToast();
  const instituteId = currentInstituteId ?? selectedInstitute?.id?.toString() ?? '';

  const enabled = isFeatureEnabled('smart-cards');

  const [counts, setCounts] = useState<InstituteSmartCardCounts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);

  const [scope, setScope] = useState<SmartCardScope>('INSTITUTE');

  // user search
  const [userQuery, setUserQuery] = useState('');
  const [foundUser, setFoundUser] = useState<{ id: string; name?: string } | null>(null);
  const [searchingUser, setSearchingUser] = useState(false);

  // card search
  const [cardQuery, setCardQuery] = useState('');
  const [cards, setCards] = useState<SmartCard[]>([]);
  const [searchingCards, setSearchingCards] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const loadCounts = useCallback(async () => {
    if (!instituteId || !enabled) return;
    setLoadingCounts(true);
    try {
      setCounts(await smartCardsApi.getCounts(instituteId));
    } catch (e: any) {
      toast({ title: 'Failed to load counts', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingCounts(false);
    }
  }, [instituteId, enabled, toast]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const searchUser = async () => {
    const q = userQuery.trim();
    if (!q) return;
    setSearchingUser(true);
    setFoundUser(null);
    try {
      let res: any;
      if (/^\d+$/.test(q) && q.length < 12) {
        // numeric & short → treat as system user id
        res = await usersApi.getBasicInfo(q);
      } else if (q.includes('@')) {
        res = await usersApi.lookupByEmail(q);
      } else {
        res = await usersApi.lookupByPhone(q);
      }
      const u = res?.data ?? res;
      if (!u?.id) throw new Error('User not found');
      setFoundUser({ id: String(u.id), name: u.nameWithInitials || u.firstName || u.name || `User ${u.id}` });
    } catch (e: any) {
      toast({ title: 'User not found', description: e.message, variant: 'destructive' });
    } finally {
      setSearchingUser(false);
    }
  };

  const searchCards = async () => {
    setSearchingCards(true);
    try {
      const res = await smartCardsApi.search(instituteId, { scope, search: cardQuery.trim() || undefined, limit: 30 });
      // Only show cards still in the pool (not already held by a user).
      setCards((res.items || []).filter((c) => c.status === 'ASSIGNED_INSTITUTE' || c.status === 'ASSIGNED_CLASS'));
    } catch (e: any) {
      toast({ title: 'Search failed', description: e.message, variant: 'destructive' });
    } finally {
      setSearchingCards(false);
    }
  };

  const assign = async (cardValue?: string) => {
    if (!foundUser) { toast({ title: 'Find a user first', variant: 'destructive' }); return; }
    setAssigning(true);
    try {
      const res = await smartCardsApi.assignToUser(instituteId, { userId: foundUser.id, scope, cardValue });
      toast({ title: 'Card assigned', description: res.message });
      setCards([]);
      setCardQuery('');
      loadCounts();
    } catch (e: any) {
      toast({ title: 'Assign failed', description: e.message, variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  if (!enabled) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            The Smart Cards feature is not enabled for this institute. Contact a system administrator to enable it.
          </CardContent>
        </Card>
      </div>
    );
  }

  const scopeCounts = counts?.[scope];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Manage Smart Cards</h1>
            <p className="text-sm text-muted-foreground">Assign pre-printed cards from your institute pool to users.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadCounts} disabled={loadingCounts}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loadingCounts ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Scope selector */}
      <Tabs value={scope} onValueChange={(v) => { setScope(v as SmartCardScope); setCards([]); }}>
        <TabsList>
          <TabsTrigger value="INSTITUTE">Institute Cards</TabsTrigger>
          <TabsTrigger value="GLOBAL">Suraksha Cards</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Counts */}
      <div className="grid grid-cols-3 gap-3">
        <CountCard label="Total" value={scopeCounts?.total ?? 0} />
        <CountCard label="Available to assign" value={scopeCounts?.available ?? 0} highlight />
        <CountCard label="Assigned to users" value={scopeCounts?.assignedToUser ?? 0} />
      </div>

      {/* Assign to user */}
      <Card>
        <CardHeader><CardTitle className="text-base">Assign a card to a user</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* 1. find user */}
          <div>
            <Label>1. Find the user (phone, email, or system user ID)</Label>
            <div className="flex gap-2">
              <Input value={userQuery} onChange={(e) => setUserQuery(e.target.value)}
                placeholder="07XXXXXXXX / email / 123"
                onKeyDown={(e) => e.key === 'Enter' && searchUser()} />
              <Button onClick={searchUser} disabled={searchingUser}>
                {searchingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {foundUser && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <UserCheck className="h-4 w-4 text-green-600" />
                <span className="font-medium">{foundUser.name}</span>
                <Badge variant="outline">ID {foundUser.id}</Badge>
              </div>
            )}
          </div>

          {/* 2. pick card */}
          <div className="border-t pt-4">
            <Label>2. Pick a card from your {scope === 'GLOBAL' ? 'Suraksha' : 'institute'} pool</Label>
            <div className="flex gap-2">
              <Input value={cardQuery} onChange={(e) => setCardQuery(e.target.value)}
                placeholder="search card name or id"
                onKeyDown={(e) => e.key === 'Enter' && searchCards()} />
              <Button variant="secondary" onClick={searchCards} disabled={searchingCards}>
                {searchingCards ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
              <Button onClick={() => assign(undefined)} disabled={assigning || !foundUser}>
                Auto-assign next
              </Button>
            </div>

            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
              {cards.map((c) => (
                <div key={c.id} className="flex items-center justify-between border rounded-md p-2">
                  <div>
                    <div className="font-medium">{c.cardName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{c.cardId} • {c.cardType}</div>
                  </div>
                  <Button size="sm" disabled={assigning || !foundUser} onClick={() => assign(c.cardId)}>
                    Assign
                  </Button>
                </div>
              ))}
              {!searchingCards && cards.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  Search to list available cards, or use "Auto-assign next".
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

function CountCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-primary/40' : ''}>
      <CardContent className="py-4 text-center">
        <div className={`text-2xl font-bold ${highlight ? 'text-primary' : ''}`}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

export default ManageSmartCardsPage;
