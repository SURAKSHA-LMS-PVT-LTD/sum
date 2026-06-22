import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import {
  BarChart3,
  CheckCircle2,
  Eye,
  XCircle,
  Clock,
  Send,
  RefreshCw,
  Building2,
  CalendarDays,
  Megaphone,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ────────────────────────────────────────────────────────────────────

type GroupBy = "institute" | "day" | "ad";

interface StatRow {
  groupKey: string;
  label: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  deliveryRate: number | null;
  readRate: number | null;
}

interface StatsResponse {
  groupBy: GroupBy;
  window: { from: string; to: string };
  rows: StatRow[];
  totals: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    pending: number;
    deliveryRate: number | null;
    readRate: number | null;
  };
}

interface Institute {
  id: string;
  name: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function pct(v: number | null): string {
  return v === null || v === undefined ? "—" : `${v}%`;
}

// ── Summary metric card ──────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  tone: "blue" | "green" | "violet" | "red" | "amber";
}) {
  const tones: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50",
    green: "text-green-600 bg-green-50",
    violet: "text-violet-600 bg-violet-50",
    red: "text-red-600 bg-red-50",
    amber: "text-amber-600 bg-amber-50",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Horizontal rate bar (delivered + read within sent) ───────────────────────

function RateBar({ row }: { row: StatRow }) {
  const total = row.sent || 1;
  const deliveredOnly = Math.max(row.delivered - row.read, 0);
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100" title={`sent ${row.sent}`}>
      <div className="bg-violet-500" style={{ width: seg(row.read) }} title={`read ${row.read}`} />
      <div className="bg-green-500" style={{ width: seg(deliveredOnly) }} title={`delivered ${deliveredOnly}`} />
      <div className="bg-red-400" style={{ width: seg(row.failed) }} title={`failed ${row.failed}`} />
      <div className="bg-amber-300" style={{ width: seg(row.pending) }} title={`pending ${row.pending}`} />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function WhatsAppDeliveryStatsPage() {
  const { toast } = useToast();

  const [groupBy, setGroupBy] = useState<GroupBy>("institute");
  const [instituteId, setInstituteId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(daysAgoISO(30));
  const [dateTo, setDateTo] = useState<string>(todayISO());

  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Load institute list once for the filter dropdown.
  useEffect(() => {
    (async () => {
      try {
        const res: any = await api.whatsappGetInstitutes(undefined, 1, 200);
        setInstitutes(res?.institutes ?? []);
      } catch {
        /* non-fatal — filter just stays empty */
      }
    })();
  }, []);

  const load = useCallback(async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast({
        title: "Invalid date range",
        description: "“From” must be on or before “To”.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res: any = await api.whatsappDeliveryStats({
        groupBy,
        instituteId: instituteId === "all" ? undefined : instituteId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setData(res as StatsResponse);
    } catch (err: any) {
      toast({
        title: "Failed to load delivery stats",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [groupBy, instituteId, dateFrom, dateTo, toast]);

  // Auto-load on first mount and whenever grouping/filter changes.
  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals;
  const groupHeader =
    groupBy === "institute" ? "Institute" : groupBy === "day" ? "Date" : "Advertisement";

  return (
    <DashboardLayout>
      <PageHeader
        title="WhatsApp Delivery Analytics"
        description="Proof of delivery & read for attendance notifications and ad campaigns."
        icon={BarChart3}
      />

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Group by
            </Label>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="institute">Institute</SelectItem>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="ad">Advertisement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Institute
            </Label>
            <Select value={instituteId} onValueChange={setInstituteId}>
              <SelectTrigger>
                <SelectValue placeholder="All institutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All institutes</SelectItem>
                {institutes.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> From
            </Label>
            <Input type="date" value={dateFrom} max={dateTo} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <CalendarDays className="w-3 h-3" /> To
            </Label>
            <Input type="date" value={dateTo} min={dateFrom} max={todayISO()} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <Button onClick={load} disabled={loading} className="w-full">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </CardContent>
      </Card>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <MetricCard icon={Send} tone="blue" label="Sent" value={totals?.sent ?? 0} />
        <MetricCard
          icon={CheckCircle2}
          tone="green"
          label="Delivered"
          value={totals?.delivered ?? 0}
          sub={`${pct(totals?.deliveryRate ?? null)} of sent`}
        />
        <MetricCard
          icon={Eye}
          tone="violet"
          label="Read"
          value={totals?.read ?? 0}
          sub={`${pct(totals?.readRate ?? null)} of delivered`}
        />
        <MetricCard icon={XCircle} tone="red" label="Failed" value={totals?.failed ?? 0} />
        <MetricCard icon={Clock} tone="amber" label="Pending" value={totals?.pending ?? 0} sub="sent, awaiting delivery" />
      </div>

      {/* Breakdown table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            {groupBy === "ad" ? <Megaphone className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
            Breakdown by {groupHeader.toLowerCase()}
            {data?.window && (
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {data.window.from} → {data.window.to}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm bg-violet-500" /> Read</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm bg-green-500" /> Delivered</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm bg-red-400" /> Failed</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2.5 rounded-sm bg-amber-300" /> Pending</span>
          </div>

          {loading && !data ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : !data?.rows.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No WhatsApp deliveries in this window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3 font-medium">{groupHeader}</th>
                    <th className="py-2 px-3 font-medium w-48">Distribution</th>
                    <th className="py-2 px-3 font-medium text-right">Sent</th>
                    <th className="py-2 px-3 font-medium text-right">Delivered</th>
                    <th className="py-2 px-3 font-medium text-right">Read</th>
                    <th className="py-2 px-3 font-medium text-right">Failed</th>
                    <th className="py-2 px-3 font-medium text-right">Pending</th>
                    <th className="py-2 px-3 font-medium text-right">Deliv %</th>
                    <th className="py-2 pl-3 font-medium text-right">Read %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.groupKey} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2.5 pr-3 font-medium max-w-[16rem] truncate" title={row.label}>
                        {row.label || "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <RateBar row={row} />
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{row.sent}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-green-700">{row.delivered}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-violet-700">{row.read}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-red-600">{row.failed}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-amber-600">{row.pending}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{pct(row.deliveryRate)}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums">{pct(row.readRate)}</td>
                    </tr>
                  ))}
                </tbody>
                {totals && (
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2.5 pr-3">Total</td>
                      <td className="py-2.5 px-3" />
                      <td className="py-2.5 px-3 text-right tabular-nums">{totals.sent}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-green-700">{totals.delivered}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-violet-700">{totals.read}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-red-600">{totals.failed}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-amber-600">{totals.pending}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{pct(totals.deliveryRate)}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums">{pct(totals.readRate)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
