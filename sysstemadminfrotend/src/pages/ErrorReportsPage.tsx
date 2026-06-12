import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import {
  AlertTriangle, RefreshCw, ChevronLeft, ChevronRight,
  Monitor, Wifi, Code, Zap, Eye, Wrench, CheckCircle2, XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──────────────────────────────────────────────────────────────────────

type ErrorReportStatus = 'NEW' | 'VIEWED' | 'FIXING' | 'FIXED' | 'IGNORED';
type ErrorReportKind   = 'REACT_BOUNDARY' | 'API_5XX' | 'API_CLIENT' | 'UNHANDLED_JS';

interface ErrorReport {
  id: string;
  kind: ErrorReportKind;
  status: ErrorReportStatus;
  errorMessage: string;
  errorStack?: string;
  componentStack?: string;
  httpStatus?: number;
  requestId?: string;
  apiPath?: string;
  pageUrl: string;
  userAgent: string;
  appVersion?: string;
  platform?: string;
  context?: Record<string, any>;
  screenshotDataUrl?: string;
  userId?: string;
  adminNote?: string;
  resolvedByUserId?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Config ─────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ErrorReportStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.FC<{ className?: string }>;
  color: string;
}> = {
  NEW:     { label: 'New',     variant: 'destructive', icon: AlertTriangle, color: 'text-destructive' },
  VIEWED:  { label: 'Viewed',  variant: 'secondary',   icon: Eye,           color: 'text-muted-foreground' },
  FIXING:  { label: 'Fixing',  variant: 'default',     icon: Wrench,        color: 'text-primary' },
  FIXED:   { label: 'Fixed',   variant: 'outline',     icon: CheckCircle2,  color: 'text-emerald-600' },
  IGNORED: { label: 'Ignored', variant: 'outline',     icon: XCircle,       color: 'text-muted-foreground' },
};

const KIND_CONFIG: Record<ErrorReportKind, { label: string; icon: React.FC<{ className?: string }> }> = {
  REACT_BOUNDARY: { label: 'UI Crash',      icon: Monitor },
  API_5XX:        { label: 'Server Error',  icon: Zap },
  API_CLIENT:     { label: 'API Error',     icon: Wifi },
  UNHANDLED_JS:   { label: 'JS Error',      icon: Code },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as ErrorReportStatus[];
const ALL_KINDS    = Object.keys(KIND_CONFIG)   as ErrorReportKind[];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ErrorReportsPage() {
  const { toast } = useToast();

  const [reports,       setReports]       = useState<ErrorReport[]>([]);
  const [meta,          setMeta]          = useState({ total: 0, page: 1, totalPages: 1 });
  const [counts,        setCounts]        = useState<Partial<Record<ErrorReportStatus, number>>>({});
  const [isLoading,     setIsLoading]     = useState(true);
  const [filterStatus,  setFilterStatus]  = useState<ErrorReportStatus | 'ALL'>('NEW');
  const [filterKind,    setFilterKind]    = useState<ErrorReportKind   | 'ALL'>('ALL');
  const [page,          setPage]          = useState(1);

  const [selected,      setSelected]      = useState<ErrorReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [noteText,      setNoteText]      = useState('');
  const [updating,      setUpdating]      = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [res, cnts] = await Promise.all([
        api.getErrorReports({
          page,
          limit: 20,
          status: filterStatus !== 'ALL' ? filterStatus : undefined,
          kind:   filterKind   !== 'ALL' ? filterKind   : undefined,
        }),
        api.getErrorReportStatusCounts(),
      ]);
      setReports(res?.data ?? []);
      setMeta({
        total:      res?.meta?.total      ?? 0,
        page:       res?.meta?.page       ?? 1,
        totalPages: res?.meta?.totalPages ?? 1,
      });
      setCounts(cnts ?? {});
    } catch {
      toast({ title: "Error", description: "Failed to load error reports", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [page, filterStatus, filterKind]);

  useEffect(() => { void load(); }, [load]);

  // ── Detail open ────────────────────────────────────────────────────────────

  const openDetail = async (report: ErrorReport) => {
    setSelected(report);
    setNoteText(report.adminNote ?? '');

    if (report.status === 'NEW') {
      setDetailLoading(true);
      try {
        const fresh = await api.getErrorReportById(report.id);
        setSelected(fresh);
        setReports(prev => prev.map(r => r.id === fresh.id ? fresh : r));
        setCounts(prev => ({
          ...prev,
          NEW:    Math.max(0, (prev.NEW    ?? 0) - 1),
          VIEWED: (prev.VIEWED ?? 0) + 1,
        }));
      } catch {
        // non-critical
      } finally {
        setDetailLoading(false);
      }
    }
  };

  // ── Status update ──────────────────────────────────────────────────────────

  const handleUpdateStatus = async (status: ErrorReportStatus) => {
    if (!selected) return;
    setUpdating(true);
    try {
      const updated = await api.updateErrorReportStatus(selected.id, {
        status,
        adminNote: noteText || undefined,
      });
      setSelected(updated);
      setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
      toast({ title: "Status updated" });
      void load();
    } catch {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const totalNew = counts['NEW'] ?? 0;

  const toggleStatusFilter = (s: ErrorReportStatus) => {
    setFilterStatus(prev => prev === s ? 'ALL' : s);
    setPage(1);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <PageHeader
        title={totalNew > 0 ? `Error Reports (${totalNew} new)` : "Error Reports"}
        description="User-submitted error reports from the LMS app — review, triage, and resolve"
        icon={AlertTriangle}
      />

      {/* Status filter pills + refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map(s => {
            const cfg = STATUS_CONFIG[s];
            const Icon = cfg.icon;
            const active = filterStatus === s;
            return (
              <button
                key={s}
                onClick={() => toggleStatusFilter(s)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-3 h-3" />
                {cfg.label}
                {counts[s] !== undefined && (
                  <span className={`ml-0.5 tabular-nums ${active ? 'opacity-75' : ''}`}>
                    ({counts[s]})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Select value={filterKind} onValueChange={v => { setFilterKind(v as any); setPage(1); }}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="All kinds" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All kinds</SelectItem>
              {ALL_KINDS.map(k => (
                <SelectItem key={k} value={k}>{KIND_CONFIG[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-soft">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No reports found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {filterStatus !== 'ALL' ? `No ${STATUS_CONFIG[filterStatus as ErrorReportStatus].label.toLowerCase()} reports` : 'All clear!'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {reports.map(r => {
                const StatusIcon = STATUS_CONFIG[r.status].icon;
                const KindIcon   = KIND_CONFIG[r.kind].icon;
                return (
                  <button
                    key={r.id}
                    onClick={() => openDetail(r)}
                    className="w-full text-left px-4 py-3.5 hover:bg-muted/40 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Status icon */}
                      <div className={`mt-0.5 shrink-0 ${STATUS_CONFIG[r.status].color}`}>
                        <StatusIcon className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={STATUS_CONFIG[r.status].variant} className="text-[10px] h-5">
                            {STATUS_CONFIG[r.status].label}
                          </Badge>
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">
                            <KindIcon className="w-3 h-3" />
                            {KIND_CONFIG[r.kind].label}
                          </span>
                          {r.httpStatus && (
                            <span className="text-[10px] font-mono bg-destructive/10 text-destructive rounded px-1.5 py-0.5">
                              {r.httpStatus}
                            </span>
                          )}
                          {r.platform && (
                            <span className="text-[10px] text-muted-foreground">{r.platform}</span>
                          )}
                        </div>

                        <p className="text-sm font-medium text-foreground truncate leading-snug">
                          {r.errorMessage}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="truncate max-w-[340px]">{r.pageUrl}</span>
                          {r.requestId && (
                            <span className="font-mono shrink-0">#{r.requestId.slice(-8)}</span>
                          )}
                        </div>
                      </div>

                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums pt-0.5">
                        {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">
            {meta.total} total · page {meta.page} of {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Detail Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              Error Report Detail
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-5 pr-4 pb-2">
                {detailLoading && (
                  <p className="text-xs text-muted-foreground animate-pulse">Loading details…</p>
                )}

                {/* Status + meta badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant={STATUS_CONFIG[selected.status].variant} className="gap-1">
                    {(() => { const Icon = STATUS_CONFIG[selected.status].icon; return <Icon className="w-3 h-3" />; })()}
                    {STATUS_CONFIG[selected.status].label}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-xs border rounded px-2 py-0.5">
                    {(() => { const Icon = KIND_CONFIG[selected.kind].icon; return <Icon className="w-3 h-3" />; })()}
                    {KIND_CONFIG[selected.kind].label}
                  </span>
                  {selected.httpStatus && (
                    <span className="text-xs font-mono bg-destructive/10 text-destructive border border-destructive/20 rounded px-2 py-0.5">
                      HTTP {selected.httpStatus}
                    </span>
                  )}
                  {selected.appVersion && <span className="text-xs text-muted-foreground border rounded px-2 py-0.5">v{selected.appVersion}</span>}
                  {selected.platform   && <span className="text-xs text-muted-foreground border rounded px-2 py-0.5">{selected.platform}</span>}
                </div>

                {/* Error message */}
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Error</p>
                  <p className="text-sm font-medium">{selected.errorMessage}</p>
                </div>

                {/* Page / API path / requestId */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Page URL</p>
                    <p className="text-xs font-mono break-all text-muted-foreground bg-muted rounded px-2 py-1.5">{selected.pageUrl}</p>
                  </div>
                  {selected.apiPath && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">API Path</p>
                      <p className="text-xs font-mono text-muted-foreground bg-muted rounded px-2 py-1.5">{selected.apiPath}</p>
                    </div>
                  )}
                  {selected.requestId && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Request ID</p>
                      <p className="text-xs font-mono text-muted-foreground bg-muted rounded px-2 py-1.5">{selected.requestId}</p>
                    </div>
                  )}
                  {selected.userId && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">User ID</p>
                      <p className="text-xs font-mono text-muted-foreground bg-muted rounded px-2 py-1.5">{selected.userId}</p>
                    </div>
                  )}
                </div>

                {/* Stack traces */}
                {selected.errorStack && (
                  <details className="group/details">
                    <summary className="text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-foreground select-none flex items-center gap-1">
                      <span className="group-open/details:rotate-90 transition-transform inline-block">▶</span>
                      Stack Trace
                    </summary>
                    <pre className="mt-2 text-[10px] font-mono bg-muted rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap border">
                      {selected.errorStack}
                    </pre>
                  </details>
                )}

                {selected.componentStack && (
                  <details className="group/details">
                    <summary className="text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-foreground select-none flex items-center gap-1">
                      <span className="group-open/details:rotate-90 transition-transform inline-block">▶</span>
                      Component Stack
                    </summary>
                    <pre className="mt-2 text-[10px] font-mono bg-muted rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap border">
                      {selected.componentStack}
                    </pre>
                  </details>
                )}

                {/* Context */}
                {selected.context && (
                  <details className="group/details">
                    <summary className="text-xs font-semibold text-muted-foreground uppercase cursor-pointer hover:text-foreground select-none flex items-center gap-1">
                      <span className="group-open/details:rotate-90 transition-transform inline-block">▶</span>
                      Context
                    </summary>
                    <pre className="mt-2 text-[10px] font-mono bg-muted rounded-lg p-3 overflow-auto max-h-36 whitespace-pre-wrap border">
                      {JSON.stringify(selected.context, null, 2)}
                    </pre>
                  </details>
                )}

                {/* Screenshot */}
                {selected.screenshotDataUrl && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Screenshot</p>
                    <img
                      src={selected.screenshotDataUrl}
                      alt="Error screenshot"
                      className="rounded-lg border w-full max-h-56 object-cover object-top cursor-pointer"
                      onClick={() => window.open(selected.screenshotDataUrl, '_blank')}
                      title="Click to open full size"
                    />
                  </div>
                )}

                {/* Browser / timestamps */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground border-t pt-3">
                  <span>Reported: {new Date(selected.createdAt).toLocaleString()}</span>
                  {selected.resolvedAt && <span>Resolved: {new Date(selected.resolvedAt).toLocaleString()}</span>}
                  {selected.userAgent && <span className="truncate max-w-xs">{selected.userAgent}</span>}
                </div>

                {/* Admin note */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Admin Note (internal)</p>
                  <Textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Add an internal note…"
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>

                {/* Action buttons */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Change Status</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_STATUSES.filter(s => s !== selected.status).map(s => {
                      const cfg = STATUS_CONFIG[s];
                      const Icon = cfg.icon;
                      return (
                        <Button
                          key={s}
                          variant={s === 'FIXED' ? 'default' : s === 'IGNORED' ? 'ghost' : 'outline'}
                          size="sm"
                          disabled={updating}
                          onClick={() => handleUpdateStatus(s)}
                          className="gap-1.5"
                        >
                          <Icon className="w-3.5 h-3.5" />
                          Mark {cfg.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
