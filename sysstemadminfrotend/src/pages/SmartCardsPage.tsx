import { useState, useEffect, useCallback, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import {
  Loader2, RefreshCw, Plus, Layers, Search, CreditCard, Building2,
  Trash2, BarChart3, AlertCircle, Upload, ChevronRight,
} from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────────────────────────

const CARD_TYPES = ['BARCODE', 'QR', 'RFID', 'NFC'] as const;
const SCOPES = ['GLOBAL', 'INSTITUTE'] as const;
const STATUSES = ['AVAILABLE', 'ASSIGNED_INSTITUTE', 'ASSIGNED_CLASS', 'ASSIGNED_USER', 'INACTIVE'] as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SmartCard {
  id: string;
  cardName: string;
  cardId: string;
  cardType: string;
  scope: string;
  status: string;
  instituteId?: string | null;
  classId?: string | null;
  assignedUserId?: string | null;
}

interface Institute { id: string; name: string }
interface ClassItem { id: string; name?: string; className?: string }

interface InstituteStats {
  instituteId: string;
  total: number;
  available: number;
  assignedToUser: number;
  onHand: number;
  byStatus: Record<string, number>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const statusVariant = (s: string) =>
  s === 'AVAILABLE' ? 'default'
    : s === 'ASSIGNED_USER' ? 'secondary'
      : s === 'INACTIVE' ? 'destructive'
        : 'outline';

const statusColor = (s: string) =>
  s === 'AVAILABLE' ? 'text-emerald-600'
    : s === 'ASSIGNED_USER' ? 'text-blue-600'
      : s === 'ASSIGNED_INSTITUTE' ? 'text-orange-500'
        : s === 'ASSIGNED_CLASS' ? 'text-purple-600'
          : 'text-gray-400';

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SmartCardsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState('overview');

  // ── Shared data ──────────────────────────────────────────────────────────────
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [classCache, setClassCache] = useState<Record<string, ClassItem[]>>({}); // instituteId → classes

  useEffect(() => {
    api.getInstitutes(1, 500, true)
      .then((r: any) => setInstitutes(r.data || r.items || r.institutes || []))
      .catch(() => {});
  }, []);

  const getClasses = useCallback(async (instituteId: string): Promise<ClassItem[]> => {
    if (classCache[instituteId]) return classCache[instituteId];
    try {
      const r: any = await api.getInstituteClassesForInstitute(instituteId);
      const cls = r.data || r.items || r.classes || r || [];
      setClassCache((prev) => ({ ...prev, [instituteId]: cls }));
      return cls;
    } catch { return []; }
  }, [classCache]);

  const instituteName = (id: string | null | undefined) =>
    id ? (institutes.find((i) => i.id === id)?.name || id.slice(0, 8) + '…') : '—';

  const className = (instituteId: string | null | undefined, cid: string | null | undefined) => {
    if (!cid) return null;
    const cls = classCache[instituteId || ''];
    const found = cls?.find((c) => c.id === cid);
    return found ? (found.name || found.className || cid.slice(0, 8) + '…') : cid.slice(0, 8) + '…';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6" /> Smart Cards
            </h1>
            <p className="text-muted-foreground text-sm">
              Pre-printed ID inventory — create, allocate to institutes &amp; classes, track status.
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview"><BarChart3 className="h-4 w-4 mr-2" />Overview</TabsTrigger>
            <TabsTrigger value="pool"><Layers className="h-4 w-4 mr-2" />Card Pool</TabsTrigger>
            <TabsTrigger value="assign"><Building2 className="h-4 w-4 mr-2" />Assign</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab institutes={institutes} />
          </TabsContent>

          <TabsContent value="pool">
            <PoolTab
              institutes={institutes}
              getClasses={getClasses}
              instituteName={instituteName}
              className={className}
            />
          </TabsContent>

          <TabsContent value="assign">
            <AssignTab
              institutes={institutes}
              getClasses={getClasses}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ institutes }: { institutes: Institute[] }) {
  const { toast } = useToast();
  const [stats, setStats] = useState<InstituteStats[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: InstituteStats[] = await api.smartCardAdminStats();
      setStats(res || []);
    } catch (e: any) {
      toast({ title: 'Failed to load stats', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const instituteName = (id: string) => institutes.find((i) => i.id === id)?.name || id.slice(0, 10) + '…';

  const totalAll = stats.reduce((s, r) => s + r.total, 0);
  const usedAll = stats.reduce((s, r) => s + r.assignedToUser, 0);
  const onHandAll = stats.reduce((s, r) => s + r.onHand, 0);
  const availAll = stats.reduce((s, r) => s + r.available, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Global summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard title="Total Allocated" value={totalAll} color="text-gray-700" />
        <SummaryCard title="With Students" value={usedAll} color="text-blue-600" />
        <SummaryCard title="On Hand (Institutes)" value={onHandAll} color="text-orange-500" />
        <SummaryCard title="Unallocated (Pool)" value={availAll} color="text-emerald-600" />
      </div>

      {/* Per-institute table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Institute Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : stats.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No institute cards found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-3">Institute</th>
                  <th className="p-3 text-right">Total Given</th>
                  <th className="p-3 text-right">Assigned to Students</th>
                  <th className="p-3 text-right">On Hand</th>
                  <th className="p-3 text-right">Available (Pool)</th>
                  <th className="p-3 text-right">Inactive</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.instituteId} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">{instituteName(row.instituteId)}</td>
                    <td className="p-3 text-right font-semibold">{row.total}</td>
                    <td className="p-3 text-right text-blue-600">{row.assignedToUser}</td>
                    <td className="p-3 text-right text-orange-500">{row.onHand}</td>
                    <td className="p-3 text-right text-emerald-600">{row.available}</td>
                    <td className="p-3 text-right text-gray-400">{row.byStatus['INACTIVE'] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ─── Pool Tab ──────────────────────────────────────────────────────────────────

function PoolTab({
  institutes, getClasses, instituteName, className,
}: {
  institutes: Institute[];
  getClasses: (id: string) => Promise<ClassItem[]>;
  instituteName: (id: string | null | undefined) => string;
  className: (instId: string | null | undefined, cid: string | null | undefined) => string | null;
}) {
  const { toast } = useToast();
  const [cards, setCards] = useState<SmartCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<{
    scope?: string; cardType?: string; status?: string; search?: string;
    instituteId?: string; classId?: string;
  }>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Classes for filter dropdown
  const [filterClasses, setFilterClasses] = useState<ClassItem[]>([]);
  useEffect(() => {
    if (filters.instituteId) {
      getClasses(filters.instituteId).then(setFilterClasses);
    } else {
      setFilterClasses([]);
    }
  }, [filters.instituteId, getClasses]);

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.smartCardsList({ ...filters, page, limit: 50 });
      setCards(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      toast({ title: 'Failed to load cards', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [filters, page, toast]);

  useEffect(() => { loadCards(); }, [loadCards]);

  // Preload class names when cards load
  useEffect(() => {
    const instituteIds = [...new Set(cards.map((c) => c.instituteId).filter(Boolean) as string[])];
    instituteIds.forEach((id) => getClasses(id));
  }, [cards, getClasses]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPageSelected = cards.length > 0 && cards.every((c) => selected.has(c.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allOnPageSelected) cards.forEach((c) => n.delete(c.id));
      else cards.forEach((c) => n.add(c.id));
      return n;
    });

  // ── Create dialogs ─────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  const deleteCard = async (id: string) => {
    try {
      await api.smartCardDelete(id);
      toast({ title: 'Card deleted' });
      loadCards();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  const toggleActive = async (c: SmartCard) => {
    const next = c.status === 'INACTIVE' ? 'AVAILABLE' : 'INACTIVE';
    try {
      await api.smartCardUpdate(c.id, { status: next });
      loadCards();
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label>Search</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="name or card id"
              value={filters.search ?? ''}
              onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, search: e.target.value || undefined })); }} />
          </div>
        </div>
        <FilterSelect label="Scope" value={filters.scope} options={SCOPES as any}
          onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, scope: v, instituteId: undefined, classId: undefined })); }} />
        <FilterSelect label="Type" value={filters.cardType} options={CARD_TYPES as any}
          onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, cardType: v })); }} />
        <FilterSelect label="Status" value={filters.status} options={STATUSES as any}
          onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, status: v })); }} />

        {/* Institute filter */}
        <div>
          <Label>Institute</Label>
          <Select value={filters.instituteId ?? '__all__'}
            onValueChange={(v) => { setPage(1); setFilters((f) => ({ ...f, instituteId: v === '__all__' ? undefined : v, classId: undefined })); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All institutes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All institutes</SelectItem>
              {institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Class filter (only when institute selected) */}
        {filters.instituteId && (
          <div>
            <Label>Class</Label>
            <Select value={filters.classId ?? '__all__'}
              onValueChange={(v) => { setPage(1); setFilters((f) => ({ ...f, classId: v === '__all__' ? undefined : v })); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All classes</SelectItem>
                {filterClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || c.className || c.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2 ml-auto">
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />New Card</Button>
          <Button variant="secondary" onClick={() => setBulkOpen(true)}><Layers className="h-4 w-4 mr-2" />Bulk</Button>
          <Button variant="outline" onClick={() => setCsvOpen(true)}><Upload className="h-4 w-4 mr-2" />CSV Import</Button>
          <Button variant="outline" size="sm" onClick={loadCards} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2 w-8"><Checkbox checked={allOnPageSelected} onCheckedChange={toggleAll} /></th>
                <th className="p-2">Card ID</th>
                <th className="p-2">Name</th>
                <th className="p-2">Type</th>
                <th className="p-2">Scope</th>
                <th className="p-2">Status</th>
                <th className="p-2">Institute</th>
                <th className="p-2">Class</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="p-2"><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} /></td>
                  <td className="p-2 font-mono text-xs">{c.cardId}</td>
                  <td className="p-2">{c.cardName}</td>
                  <td className="p-2">{c.cardType}</td>
                  <td className="p-2"><Badge variant="outline">{c.scope}</Badge></td>
                  <td className="p-2">
                    <span className={`text-xs font-medium ${statusColor(c.status)}`}>{c.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="p-2 text-xs">{instituteName(c.instituteId)}</td>
                  <td className="p-2 text-xs text-muted-foreground">{className(c.instituteId, c.classId) || '—'}</td>
                  <td className="p-2 text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(c)}>
                      {c.status === 'INACTIVE' ? 'Activate' : 'Deactivate'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteCard(c.id)}
                      disabled={c.status === 'ASSIGNED_USER'}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && cards.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No cards found.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={9} className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">{total} cards • {selected.size} selected</span>
        <div className="space-x-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </div>

      {/* Dialogs */}
      <CreateCardDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        institutes={institutes}
        getClasses={getClasses}
        onCreated={loadCards}
      />
      <BulkCreateDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        institutes={institutes}
        getClasses={getClasses}
        onCreated={loadCards}
      />
      <CsvImportDialog
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        institutes={institutes}
        getClasses={getClasses}
        onCreated={loadCards}
      />
    </div>
  );
}

// ─── Assign Tab ────────────────────────────────────────────────────────────────

function AssignTab({ institutes, getClasses }: { institutes: Institute[]; getClasses: (id: string) => Promise<ClassItem[]> }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // ── Assign selected cards to institute ───────────────────────────────────
  const [poolCards, setPoolCards] = useState<SmartCard[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolSearch, setPoolSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignInstituteId, setAssignInstituteId] = useState('');
  const [assignClassId, setAssignClassId] = useState('');
  const [assignClasses, setAssignClasses] = useState<ClassItem[]>([]);

  useEffect(() => {
    if (assignInstituteId) getClasses(assignInstituteId).then(setAssignClasses);
    else setAssignClasses([]);
    setAssignClassId('');
  }, [assignInstituteId, getClasses]);

  const loadPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const res = await api.smartCardsList({ status: 'AVAILABLE', search: poolSearch || undefined, limit: 200 });
      setPoolCards(res.items || []);
    } catch { } finally { setPoolLoading(false); }
  }, [poolSearch]);

  useEffect(() => { loadPool(); }, [loadPool]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const assignToInstitute = async () => {
    if (!assignInstituteId || selected.size === 0) {
      toast({ title: 'Pick an institute and select cards', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const res = await api.smartCardAssignToInstitute({ instituteId: assignInstituteId, cardRowIds: [...selected] });
      toast({ title: 'Assigned to institute', description: `Moved ${res.moved}, skipped ${res.skipped}.` });
      setSelected(new Set()); loadPool();
    } catch (e: any) {
      toast({ title: 'Assign failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const assignToClass = async () => {
    if (!assignInstituteId || !assignClassId || selected.size === 0) {
      toast({ title: 'Pick institute, class and cards', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const res = await api.smartCardAssignToClass(assignInstituteId, { classId: assignClassId, cardRowIds: [...selected] });
      toast({ title: 'Assigned to class', description: `Moved ${res.moved}, skipped ${res.skipped}.` });
      setSelected(new Set()); loadPool();
    } catch (e: any) {
      toast({ title: 'Assign failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  // ── Bulk assign to class by range ────────────────────────────────────────
  const [rangeOpen, setRangeOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: pool to pick from */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Cards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search by name or card id"
              value={poolSearch}
              onChange={(e) => setPoolSearch(e.target.value)} />
          </div>
          <div className="border rounded-md overflow-auto max-h-[400px]">
            {poolLoading
              ? <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
              : poolCards.length === 0
                ? <p className="p-4 text-center text-muted-foreground text-sm">No available cards.</p>
                : <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 w-8"></th>
                      <th className="p-2 text-left">Card ID</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poolCards.map((c) => (
                      <tr key={c.id} className={`border-t cursor-pointer hover:bg-muted/30 ${selected.has(c.id) ? 'bg-primary/10' : ''}`}
                        onClick={() => toggleSelect(c.id)}>
                        <td className="p-2"><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} /></td>
                        <td className="p-2 font-mono text-xs">{c.cardId}</td>
                        <td className="p-2">{c.cardName}</td>
                        <td className="p-2">{c.cardType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
          <p className="text-xs text-muted-foreground">{selected.size} card(s) selected</p>
        </CardContent>
      </Card>

      {/* Right: assign target */}
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Assign to Institute</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Institute</Label>
              <Select value={assignInstituteId} onValueChange={setAssignInstituteId}>
                <SelectTrigger><SelectValue placeholder="Choose an institute" /></SelectTrigger>
                <SelectContent>
                  {institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={assignToInstitute} disabled={saving || !assignInstituteId || selected.size === 0} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Building2 className="h-4 w-4 mr-2" />}
              Assign {selected.size} card(s) to institute
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Assign to Class</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setRangeOpen(true)} disabled={!assignInstituteId}>
                <Layers className="h-4 w-4 mr-2" />Bulk by Range
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!assignInstituteId && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> Select an institute above first.
              </p>
            )}
            <div>
              <Label>Class</Label>
              <Select value={assignClassId} onValueChange={setAssignClassId} disabled={!assignInstituteId}>
                <SelectTrigger><SelectValue placeholder="Choose a class" /></SelectTrigger>
                <SelectContent>
                  {assignClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || c.className || c.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="secondary" onClick={assignToClass} className="w-full"
              disabled={saving || !assignClassId || selected.size === 0}>
              <ChevronRight className="h-4 w-4 mr-2" />
              Assign {selected.size} card(s) to class
            </Button>
            <p className="text-xs text-muted-foreground">
              Cards must already be assigned to the institute before assignment to a class.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk by range dialog */}
      {assignInstituteId && (
        <BulkRangeAssignDialog
          open={rangeOpen}
          onClose={() => setRangeOpen(false)}
          instituteId={assignInstituteId}
          classes={assignClasses}
          onDone={() => { setRangeOpen(false); loadPool(); }}
        />
      )}
    </div>
  );
}

// ─── Create Card Dialog ────────────────────────────────────────────────────────

function CreateCardDialog({
  open, onClose, institutes, getClasses, onCreated,
}: {
  open: boolean; onClose: () => void;
  institutes: Institute[]; getClasses: (id: string) => Promise<ClassItem[]>;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ cardName: '', cardId: '', cardType: 'NFC', scope: 'GLOBAL', instituteId: '', classId: '' });
  const [classes, setClasses] = useState<ClassItem[]>([]);

  useEffect(() => {
    if (form.scope === 'INSTITUTE' && form.instituteId) {
      getClasses(form.instituteId).then(setClasses);
    } else {
      setClasses([]);
      setForm((f) => ({ ...f, classId: '' }));
    }
  }, [form.scope, form.instituteId, getClasses]);

  const create = async () => {
    if (!form.cardName.trim() || !form.cardId.trim()) {
      toast({ title: 'Name and card ID are required', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      await api.smartCardCreate({
        cardName: form.cardName,
        cardId: form.cardId,
        cardType: form.cardType,
        scope: form.scope,
        instituteId: form.scope === 'INSTITUTE' && form.instituteId ? form.instituteId : undefined,
        classId: form.scope === 'INSTITUTE' && form.classId ? form.classId : undefined,
      });
      toast({ title: 'Card created' });
      onClose();
      setForm({ cardName: '', cardId: '', cardType: 'NFC', scope: 'GLOBAL', instituteId: '', classId: '' });
      onCreated();
    } catch (e: any) {
      toast({ title: 'Create failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Smart Card</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Card name</Label><Input value={form.cardName} onChange={(e) => setForm({ ...form, cardName: e.target.value })} /></div>
          <div><Label>Card ID (printed value, ≤30 chars)</Label>
            <Input value={form.cardId} maxLength={30} onChange={(e) => setForm({ ...form, cardId: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label>
              <Select value={form.cardType} onValueChange={(v) => setForm({ ...form, cardType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CARD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Scope</Label>
              <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v, instituteId: '', classId: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {form.scope === 'INSTITUTE' && (
            <>
              <div><Label>Assign to Institute (optional)</Label>
                <Select value={form.instituteId} onValueChange={(v) => setForm({ ...form, instituteId: v, classId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Choose institute" /></SelectTrigger>
                  <SelectContent>
                    {institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.instituteId && classes.length > 0 && (
                <div><Label>Assign to Class (optional)</Label>
                  <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || c.className || c.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.instituteId && (
                <p className="text-xs text-muted-foreground">
                  {form.classId
                    ? 'Card will be created and immediately assigned to the selected class.'
                    : 'Card will be created and immediately assigned to the institute pool.'}
                </p>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Create Dialog ────────────────────────────────────────────────────────

function BulkCreateDialog({
  open, onClose, institutes, getClasses, onCreated,
}: {
  open: boolean; onClose: () => void;
  institutes: Institute[]; getClasses: (id: string) => Promise<ClassItem[]>;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [bulkMode, setBulkMode] = useState<'list' | 'range'>('list');
  const [bulk, setBulk] = useState({
    cardType: 'NFC', scope: 'GLOBAL', namePrefix: 'Card',
    csv: '', rangePrefix: 'CARD-', rangeStart: 1, rangeEnd: 100, pad: 4,
    instituteId: '', classId: '',
  });
  const [classes, setClasses] = useState<ClassItem[]>([]);

  useEffect(() => {
    if (bulk.scope === 'INSTITUTE' && bulk.instituteId) {
      getClasses(bulk.instituteId).then(setClasses);
    } else {
      setClasses([]);
      setBulk((b) => ({ ...b, classId: '' }));
    }
  }, [bulk.scope, bulk.instituteId, getClasses]);

  const create = async () => {
    setSaving(true);
    try {
      const payload: any = {
        cardType: bulk.cardType, scope: bulk.scope, namePrefix: bulk.namePrefix,
        instituteId: bulk.scope === 'INSTITUTE' && bulk.instituteId ? bulk.instituteId : undefined,
        classId: bulk.scope === 'INSTITUTE' && bulk.classId ? bulk.classId : undefined,
      };
      if (bulkMode === 'list') {
        const ids = bulk.csv.split(/[\s,;\n]+/).map((s) => s.trim()).filter(Boolean);
        if (ids.length === 0) { toast({ title: 'No card ids entered', variant: 'destructive' }); setSaving(false); return; }
        payload.cardIds = ids;
      } else {
        payload.rangePrefix = bulk.rangePrefix;
        payload.rangeStart = bulk.rangeStart;
        payload.rangeEnd = bulk.rangeEnd;
        payload.pad = bulk.pad;
      }
      const res = await api.smartCardBulkCreate(payload);
      toast({ title: 'Bulk create complete', description: `Created ${res.created}, skipped ${res.skippedDuplicates} duplicates.` });
      onClose();
      onCreated();
    } catch (e: any) {
      toast({ title: 'Bulk create failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Bulk Create Cards</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label>
              <Select value={bulk.cardType} onValueChange={(v) => setBulk({ ...bulk, cardType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CARD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Scope</Label>
              <Select value={bulk.scope} onValueChange={(v) => setBulk({ ...bulk, scope: v, instituteId: '', classId: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Name prefix</Label>
            <Input value={bulk.namePrefix} onChange={(e) => setBulk({ ...bulk, namePrefix: e.target.value })} />
          </div>

          {/* Institute / Class auto-assign */}
          {bulk.scope === 'INSTITUTE' && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Auto-assign on creation (optional)</p>
              <div><Label>Institute</Label>
                <Select value={bulk.instituteId} onValueChange={(v) => setBulk({ ...bulk, instituteId: v, classId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Choose institute" /></SelectTrigger>
                  <SelectContent>
                    {institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {bulk.instituteId && classes.length > 0 && (
                <div><Label>Class</Label>
                  <Select value={bulk.classId} onValueChange={(v) => setBulk({ ...bulk, classId: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose class (optional)" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || c.className || c.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {bulk.instituteId && (
                <p className="text-xs text-muted-foreground">
                  {bulk.classId
                    ? 'All cards will be assigned directly to the selected class.'
                    : 'All cards will be assigned to the institute pool.'}
                </p>
              )}
            </div>
          )}

          {/* Input mode */}
          <Tabs value={bulkMode} onValueChange={(v) => setBulkMode(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="list" className="flex-1">List / CSV</TabsTrigger>
              <TabsTrigger value="range" className="flex-1">Numeric range</TabsTrigger>
            </TabsList>
            <TabsContent value="list">
              <Label>Card IDs (comma / space / newline separated)</Label>
              <Textarea rows={5} placeholder="12312, 421241, efa, r3" value={bulk.csv}
                onChange={(e) => setBulk({ ...bulk, csv: e.target.value })} />
            </TabsContent>
            <TabsContent value="range" className="space-y-2">
              <div><Label>Prefix</Label>
                <Input value={bulk.rangePrefix} onChange={(e) => setBulk({ ...bulk, rangePrefix: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Start</Label><Input type="number" value={bulk.rangeStart} onChange={(e) => setBulk({ ...bulk, rangeStart: +e.target.value })} /></div>
                <div><Label>End</Label><Input type="number" value={bulk.rangeEnd} onChange={(e) => setBulk({ ...bulk, rangeEnd: +e.target.value })} /></div>
                <div><Label>Zero pad</Label><Input type="number" value={bulk.pad} onChange={(e) => setBulk({ ...bulk, pad: +e.target.value })} /></div>
              </div>
              <p className="text-xs text-muted-foreground">e.g. CARD-0001 … CARD-1000</p>
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={create} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create cards</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CSV Import Dialog ─────────────────────────────────────────────────────────

function CsvImportDialog({
  open, onClose, institutes, getClasses, onCreated,
}: {
  open: boolean; onClose: () => void;
  institutes: Institute[]; getClasses: (id: string) => Promise<ClassItem[]>;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState('');
  const [nameCol, setNameCol] = useState('name');
  const [idCol, setIdCol] = useState('id');
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ name: string; id: string }[]>([]);
  const [scope, setScope] = useState('GLOBAL');
  const [cardType, setCardType] = useState('NFC');
  const [instituteId, setInstituteId] = useState('');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState<ClassItem[]>([]);

  useEffect(() => {
    if (scope === 'INSTITUTE' && instituteId) getClasses(instituteId).then(setClasses);
    else { setClasses([]); setClassId(''); }
  }, [scope, instituteId, getClasses]);

  const parseCSV = (text: string): string[][] => {
    return text.trim().split('\n').map((row) =>
      row.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
    );
  };

  const processFile = (text: string) => {
    setCsvText(text);
    const rows = parseCSV(text);
    if (rows.length > 0) {
      setHeaders(rows[0]);
      // Auto-detect columns
      const hdr = rows[0].map((h) => h.toLowerCase());
      const nameGuess = hdr.find((h) => h.includes('name')) || rows[0][0];
      const idGuess = hdr.find((h) => h === 'id' || h.includes('card') || h.includes('barcode')) || rows[0][1] || rows[0][0];
      setNameCol(nameGuess);
      setIdCol(idGuess);
    }
  };

  useEffect(() => {
    if (!csvText || !nameCol || !idCol) { setPreview([]); return; }
    const rows = parseCSV(csvText);
    const hdr = rows[0];
    const nameIdx = hdr.findIndex((h) => h.toLowerCase() === nameCol.toLowerCase());
    const idIdx = hdr.findIndex((h) => h.toLowerCase() === idCol.toLowerCase());
    if (nameIdx < 0 || idIdx < 0) { setPreview([]); return; }
    setPreview(rows.slice(1, 6).map((r) => ({ name: r[nameIdx] || '', id: r[idIdx] || '' })).filter((r) => r.id));
  }, [csvText, nameCol, idCol]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => processFile(ev.target?.result as string || '');
    reader.readAsText(file);
  };

  const doImport = async () => {
    if (!csvText) { toast({ title: 'No CSV loaded', variant: 'destructive' }); return; }
    const rows = parseCSV(csvText);
    const hdr = rows[0];
    const nameIdx = hdr.findIndex((h) => h.toLowerCase() === nameCol.toLowerCase());
    const idIdx = hdr.findIndex((h) => h.toLowerCase() === idCol.toLowerCase());
    if (nameIdx < 0 || idIdx < 0) {
      toast({ title: 'Column not found', description: `Check column names: "${nameCol}", "${idCol}"`, variant: 'destructive' });
      return;
    }
    const cardIds = rows.slice(1).map((r) => r[idIdx]?.trim()).filter((v) => v && v.length <= 30);
    const namePrefix = 'Card'; // will be overridden per card via explicit cardIds list; use namePrefix for fallback
    if (cardIds.length === 0) { toast({ title: 'No valid card IDs found', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      const res = await api.smartCardBulkCreate({
        cardType, scope, namePrefix,
        cardIds,
        instituteId: scope === 'INSTITUTE' && instituteId ? instituteId : undefined,
        classId: scope === 'INSTITUTE' && classId ? classId : undefined,
      });
      toast({ title: 'Import complete', description: `Created ${res.created}, skipped ${res.skippedDuplicates} duplicates.` });
      onClose();
      onCreated();
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>CSV Import</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {/* File upload */}
          <div>
            <Label>Upload CSV file</Label>
            <div className="flex gap-2 mt-1">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />Choose file
              </Button>
              {csvText && <span className="text-xs text-emerald-600 self-center">File loaded ✓</span>}
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
          </div>

          {/* Column mapping */}
          {headers.length > 0 && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Column mapping</p>
              <p className="text-xs text-muted-foreground">Detected headers: {headers.join(', ')}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Card Name column</Label>
                  <Select value={nameCol} onValueChange={setNameCol}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Card ID column</Label>
                  <Select value={idCol} onValueChange={setIdCol}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {preview.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Preview (first 5 rows):</p>
                  <div className="text-xs font-mono space-y-0.5">
                    {preview.map((r, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-muted-foreground">id:</span><span>{r.id}</span>
                        <span className="text-muted-foreground ml-2">name:</span><span>{r.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scope + type */}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Card Type</Label>
              <Select value={cardType} onValueChange={setCardType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CARD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => { setScope(v); setInstituteId(''); setClassId(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Institute/Class assign */}
          {scope === 'INSTITUTE' && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">Auto-assign on import (optional)</p>
              <div><Label>Institute</Label>
                <Select value={instituteId} onValueChange={(v) => { setInstituteId(v); setClassId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Choose institute" /></SelectTrigger>
                  <SelectContent>
                    {institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {instituteId && classes.length > 0 && (
                <div><Label>Class</Label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger><SelectValue placeholder="Choose class (optional)" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || c.className || c.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={doImport} disabled={saving || !csvText}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Range Assign Dialog ──────────────────────────────────────────────────

function BulkRangeAssignDialog({
  open, onClose, instituteId, classes, onDone,
}: {
  open: boolean; onClose: () => void;
  instituteId: string; classes: ClassItem[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ classId: '', cardIdMin: '', cardIdMax: '' });

  const submit = async () => {
    if (!form.classId || !form.cardIdMin || !form.cardIdMax) {
      toast({ title: 'Fill all fields', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const res = await api.smartCardAssignToClassByRange(instituteId, form);
      toast({ title: 'Bulk assign complete', description: `Moved ${res.moved} card(s), skipped ${res.skipped}.` });
      onDone();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Bulk Assign to Class by Range</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Assigns all institute cards whose Card ID falls between the min and max values (string comparison) to the selected class in one click.
          </p>
          <div><Label>Class</Label>
            <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
              <SelectTrigger><SelectValue placeholder="Choose class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || c.className || c.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Card ID — From (min)</Label>
              <Input placeholder="CARD-2000" value={form.cardIdMin} onChange={(e) => setForm({ ...form, cardIdMin: e.target.value })} />
            </div>
            <div><Label>Card ID — To (max)</Label>
              <Input placeholder="CARD-2200" value={form.cardIdMax} onChange={(e) => setForm({ ...form, cardIdMax: e.target.value })} />
            </div>
          </div>
          {form.cardIdMin && form.cardIdMax && (
            <p className="text-xs text-muted-foreground">
              Will assign all institute cards with ID ≥ "{form.cardIdMin}" and ≤ "{form.cardIdMax}" to the selected class.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.classId || !form.cardIdMin || !form.cardIdMax}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Assign Range
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Small filter select ───────────────────────────────────────────────────────

function FilterSelect({ label, value, options, onChange }: {
  label: string; value?: string; options: string[]; onChange: (v: string | undefined) => void;
}) {
  const ALL = '__all__';
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
