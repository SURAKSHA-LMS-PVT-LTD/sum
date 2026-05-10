import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader, StatsCard } from "@/components/shared/PageComponents";
import { Shield, AlertTriangle, Activity, Eye, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function SecurityMonitoringPage() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [threats, setThreats] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [ipEvents, setIpEvents] = useState<any[]>([]);
  const [ipSearch, setIpSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      setIsLoading(true);
      const [metricsRes, statusRes, threatsRes, reportRes] = await Promise.all([
        api.getSecurityMetrics().catch(() => null),
        api.getSecurityStatus().catch(() => null),
        api.getSecurityThreats().catch(() => null),
        api.getSecurityReport().catch(() => null),
      ]);
      setMetrics(metricsRes);
      setStatus(statusRes);
      setThreats(Array.isArray(threatsRes) ? threatsRes : threatsRes?.data || []);
      setReport(reportRes);
    } catch (error) {
      console.error("Failed to fetch security data:", error);
      toast({ title: "Error", description: "Failed to load security data", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleIpSearch = async () => {
    if (!ipSearch.trim()) return;
    try {
      const res = await api.getSecurityEventsForIp(ipSearch.trim());
      setIpEvents(Array.isArray(res) ? res : res?.data || []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch IP events", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <PageHeader title="Security Monitoring" description="Monitor system security metrics and threats" icon={Shield} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Security Monitoring"
        description="Monitor system security metrics, threats, and events"
        icon={Shield}
        actions={<Button onClick={fetchSecurityData} variant="outline">Refresh</Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatsCard title="System Status" value={status?.status || "Unknown"} icon={Activity} />
        <StatsCard title="Active Threats" value={threats.length} icon={AlertTriangle} />
        <StatsCard title="Total Events" value={metrics?.totalEvents ?? 0} icon={Eye} />
        <StatsCard title="Blocked IPs" value={metrics?.blockedIps ?? 0} icon={Shield} />
      </div>

      {/* Security Report */}
      {report && (
        <Card className="shadow-soft mb-6">
          <CardHeader>
            <CardTitle>Security Report</CardTitle>
            <CardDescription>Comprehensive system security overview</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-64">
              {JSON.stringify(report, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Active Threats */}
      <Card className="shadow-soft mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Active Threats
          </CardTitle>
        </CardHeader>
        <CardContent>
          {threats.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No active threats detected</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Source IP</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {threats.map((threat: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{threat.type || threat.eventType}</TableCell>
                    <TableCell>
                      <Badge variant={threat.severity === "HIGH" ? "destructive" : "secondary"}>
                        {threat.severity || "MEDIUM"}
                      </Badge>
                    </TableCell>
                    <TableCell>{threat.ip || threat.sourceIp || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{threat.details || threat.description || "-"}</TableCell>
                    <TableCell>{threat.createdAt ? new Date(threat.createdAt).toLocaleString() : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* IP Event Search */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            IP Event Lookup
          </CardTitle>
          <CardDescription>Search security events by IP address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Enter IP address..."
              value={ipSearch}
              onChange={(e) => setIpSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleIpSearch()}
            />
            <Button onClick={handleIpSearch}>Search</Button>
          </div>
          {ipEvents.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ipEvents.map((event: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{event.eventType || event.type}</TableCell>
                    <TableCell>
                      <Badge variant={event.severity === "HIGH" ? "destructive" : "secondary"}>
                        {event.severity || "INFO"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{event.details || "-"}</TableCell>
                    <TableCell>{event.createdAt ? new Date(event.createdAt).toLocaleString() : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
