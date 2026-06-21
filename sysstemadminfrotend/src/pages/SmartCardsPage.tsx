import { useState, useEffect, useCallback } from 'react';
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
import { Loader2, RefreshCw, Plus, Layers, Search, CreditCard, Building2, Trash2 } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

const CARD_TYPES = ['BARCODE', 'QR', 'RFID', 'NFC'] as const;
const SCOPES = ['GLOBAL', 'INSTITUTE'] as const;
const STATUSES = ['AVAILABLE', 'ASSIGNED_INSTITUTE', 'ASSIGNED_CLASS', 'ASSIGNED_USER', 'INACTIVE'] as const;

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

const statusVariant = (s: string) =>
  s === 'AVAILABLE' ? 'default'
    : s === 'ASSIGNED_USER' ? 'secondary'
      : s === 'INACTIVE' ? 'destructive'
        : 'outline';

export default function SmartCardsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState('pool');

  // ── Pool list state ──────────────────────────────────────────────────────────
  const [cards, setCards] = useState<SmartCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<{ scope?: string; cardType?: string; status?: string; search?: string }>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.smartCardsList({ ...filters, page, limit: 50 });
      setCards(res.items || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      toast({ title: 'Failed to load cards', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filters, page, toast]);

  useEffect(() => { loadCards(); }, [loadCards]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const allOnPageSelected = cards.length > 0 && cards.every((c) => selected.has(c.id));
  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) cards.forEach((c) => next.delete(c.id));
      else cards.forEach((c) => next.add(c.id));
      return next;
    });
  };

  // ── Single create ──────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [single, setSingle] = useState({ cardName: '', cardId: '', cardType: 'NFC', scope: 'GLOBAL' });
  const [saving, setSaving] = useState(false);

  const createSingle = async () => {
    if (!single.cardName.trim() || !single.cardId.trim()) {
      toast({ title: 'Name and card id are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await api.smartCardCreate(single);
      toast({ title: 'Card created' });
      setCreateOpen(false);
      setSingle({ cardName: '', cardId: '', cardType: 'NFC', scope: 'GLOBAL' });
      loadCards();
    } catch (e: any) {
      toast({ title: 'Create failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  // ── Bulk create ──────────────────────────────────────────────────────────
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'list' | 'range'>('list');
  const [bulk, setBulk] = useState({
    cardType: 'NFC', scope: 'GLOBAL', namePrefix: 'Card',
    csv: '', rangePrefix: 'CARD-', rangeStart: 1, rangeEnd: 100, pad: 4,
  });

  const createBulk = async () => {
    setSaving(true);
    try {
      const payload: any = { cardType: bulk.cardType, scope: bulk.scope, namePrefix: bulk.namePrefix };
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
      setBulkOpen(false);
      loadCards();
    } catch (e: any) {
      toast({ title: 'Bulk create failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

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

  // ── Assign (institutes + classes) ────────────────────────────────────────────
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [assignInstituteId, setAssignInstituteId] = useState('');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignClassId, setAssignClassId] = useState('');

  useEffect(() => {
    api.getInstitutes(1, 200, true)
      .then((r: any) => setInstitutes(r.data || r.items || r.institutes || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!assignInstituteId) { setClasses([]); return; }
    api.getInstituteClassesForInstitute(assignInstituteId)
      .then((r: any) => setClasses(r.data || r.items || r.classes || r || []))
      .catch(() => setClasses([]));
  }, [assignInstituteId]);

  const assignToInstitute = async () => {
    if (!assignInstituteId || selected.size === 0) {
      toast({ title: 'Pick an institute and select cards', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await api.smartCardAssignToInstitute({ instituteId: assignInstituteId, cardRowIds: [...selected] });
      toast({ title: 'Assigned to institute', description: `Moved ${res.moved}, skipped ${res.skipped}.` });
      setSelected(new Set());
      loadCards();
    } catch (e: any) {
      toast({ title: 'Assign failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const assignToClass = async () => {
    if (!assignInstituteId || !assignClassId || selected.size === 0) {
      toast({ title: 'Pick institute, class and cards', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await api.smartCardAssignToClass(assignInstituteId, { classId: assignClassId, cardRowIds: [...selected] });
      toast({ title: 'Assigned to class', description: `Moved ${res.moved}, skipped ${res.skipped}.` });
      setSelected(new Set());
      loadCards();
    } catch (e: any) {
      toast({ title: 'Assign failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="h-6 w-6" /> Smart Cards</h1>
            <p className="text-muted-foreground text-sm">Pre-printed ID inventory — create, allocate to institutes & classes.</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadCards} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pool"><Layers className="h-4 w-4 mr-2" /> Card Pool ({total})</TabsTrigger>
            <TabsTrigger value="assign"><Building2 className="h-4 w-4 mr-2" /> Assign ({selected.size} selected)</TabsTrigger>
          </TabsList>

          {/* ── POOL TAB ── */}
          <TabsContent value="pool" className="space-y-4">
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
                onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, scope: v })); }} />
              <FilterSelect label="Type" value={filters.cardType} options={CARD_TYPES as any}
                onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, cardType: v })); }} />
              <FilterSelect label="Status" value={filters.status} options={STATUSES as any}
                onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, status: v })); }} />
              <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Card</Button>
              <Button variant="secondary" onClick={() => setBulkOpen(true)}><Layers className="h-4 w-4 mr-2" /> Bulk</Button>
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="p-2 w-8"><Checkbox checked={allOnPageSelected} onCheckedChange={toggleSelectAll} /></th>
                      <th className="p-2">Card ID</th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Scope</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Institute / Class</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((c) => (
                      <tr key={c.id} className="border-t hover:bg-muted/30">
                        <td className="p-2"><Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} /></td>
                        <td className="p-2 font-mono">{c.cardId}</td>
                        <td className="p-2">{c.cardName}</td>
                        <td className="p-2">{c.cardType}</td>
                        <td className="p-2"><Badge variant="outline">{c.scope}</Badge></td>
                        <td className="p-2"><Badge variant={statusVariant(c.status) as any}>{c.status}</Badge></td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {c.instituteId ? `${c.instituteId.slice(0, 8)}…` : '—'}{c.classId ? ` / ${c.classId.slice(0, 8)}…` : ''}
                        </td>
                        <td className="p-2 text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => toggleActive(c)}>
                            {c.status === 'INACTIVE' ? 'Activate' : 'Deactivate'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteCard(c.id)} disabled={c.status === 'ASSIGNED_USER'}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!loading && cards.length === 0 && (
                      <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No cards found.</td></tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{total} cards • {selected.size} selected</span>
              <div className="space-x-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </TabsContent>

          {/* ── ASSIGN TAB ── */}
          <TabsContent value="assign" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Allocate {selected.size} selected card(s)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {selected.size === 0 && (
                  <p className="text-sm text-muted-foreground">Select cards in the Card Pool tab first.</p>
                )}
                <div>
                  <Label>Institute</Label>
                  <Select value={assignInstituteId} onValueChange={setAssignInstituteId}>
                    <SelectTrigger><SelectValue placeholder="Choose an institute" /></SelectTrigger>
                    <SelectContent>
                      {institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={assignToInstitute} disabled={saving || !assignInstituteId || selected.size === 0}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Building2 className="h-4 w-4 mr-2" />}
                  Assign to institute
                </Button>

                <div className="border-t pt-4">
                  <Label>Then optionally allocate to a class</Label>
                  <Select value={assignClassId} onValueChange={setAssignClassId} disabled={!assignInstituteId}>
                    <SelectTrigger><SelectValue placeholder="Choose a class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || c.className || c.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button className="mt-2" variant="secondary" onClick={assignToClass}
                    disabled={saving || !assignClassId || selected.size === 0}>
                    Assign to class
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Cards must already belong to the institute to be assigned to a class.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Single create dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Smart Card</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Card name</Label><Input value={single.cardName} onChange={(e) => setSingle({ ...single, cardName: e.target.value })} /></div>
            <div><Label>Card ID (printed value, ≤30 chars)</Label><Input value={single.cardId} maxLength={30} onChange={(e) => setSingle({ ...single, cardId: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={single.cardType} onValueChange={(v) => setSingle({ ...single, cardType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CARD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Scope</Label>
                <Select value={single.scope} onValueChange={(v) => setSingle({ ...single, scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createSingle} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk create dialog ── */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
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
                <Select value={bulk.scope} onValueChange={(v) => setBulk({ ...bulk, scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Name prefix</Label><Input value={bulk.namePrefix} onChange={(e) => setBulk({ ...bulk, namePrefix: e.target.value })} /></div>

            <Tabs value={bulkMode} onValueChange={(v) => setBulkMode(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="list" className="flex-1">List / CSV</TabsTrigger>
                <TabsTrigger value="range" className="flex-1">Numeric range</TabsTrigger>
              </TabsList>
              <TabsContent value="list">
                <Label>Card IDs (comma / space / newline separated)</Label>
                <Textarea rows={5} placeholder="12312, 421241, efa, r3" value={bulk.csv} onChange={(e) => setBulk({ ...bulk, csv: e.target.value })} />
              </TabsContent>
              <TabsContent value="range" className="space-y-2">
                <div><Label>Prefix</Label><Input value={bulk.rangePrefix} onChange={(e) => setBulk({ ...bulk, rangePrefix: e.target.value })} /></div>
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
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={createBulk} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create cards</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ─── Small filter select with an "All" reset ────────────────────────────────────
function FilterSelect({ label, value, options, onChange }: {
  label: string; value?: string; options: string[]; onChange: (v: string | undefined) => void;
}) {
  const ALL = '__all__';
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
        <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
