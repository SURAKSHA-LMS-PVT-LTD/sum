import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Smartphone, ShieldCheck, ShieldBan, Building2, Activity, RefreshCw, Loader2 } from "lucide-react";

const DeviceStatsPanel = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.getDeviceStats();
      setStats(res);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-4">Load system-wide device statistics</p>
          <Button onClick={fetchStats} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Load Stats
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statCards = [
    { label: "Total Devices", value: stats.totalDevices, icon: Smartphone, color: "text-primary" },
    { label: "Active Devices", value: stats.activeDevices, icon: ShieldCheck, color: "text-success" },
    { label: "Blocked Devices", value: stats.blockedDevices, icon: ShieldBan, color: "text-destructive" },
    { label: "Unassigned", value: stats.unassignedDevices, icon: Building2, color: "text-warning" },
    { label: "Active Sessions", value: stats.totalActiveSessions, icon: Activity, color: "text-accent" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6 text-center">
              <s.icon className={`w-8 h-8 mx-auto mb-2 ${s.color}`} />
              <p className="text-2xl font-bold text-foreground">{s.value ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.devicesByType && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Devices by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(stats.devicesByType).map(([type, count]) => (
                <div key={type} className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-lg font-semibold text-foreground">{count as number}</p>
                  <p className="text-xs text-muted-foreground">{type.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DeviceStatsPanel;
