import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { History, Loader2, Search, Activity } from "lucide-react";

const auditActionColor = (action: string): "default" | "secondary" | "destructive" | "outline" => {
  if (["BLOCKED", "DELETED"].includes(action)) return "destructive";
  if (["ENABLED", "UNBLOCKED", "CREATED"].includes(action)) return "default";
  return "secondary";
};

const DeviceAuditPanel = () => {
  const { toast } = useToast();
  const [deviceId, setDeviceId] = useState("");
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchData = async () => {
    if (!deviceId.trim()) return;
    setLoading(true);
    try {
      const [auditRes, sessionRes] = await Promise.all([
        api.getDeviceAuditLog(deviceId),
        api.getDeviceSessions(deviceId),
      ]);
      setAuditLog(Array.isArray(auditRes) ? auditRes : auditRes.data || []);
      setSessions(Array.isArray(sessionRes) ? sessionRes : sessionRes.data || []);
      setLoaded(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="Enter Device ID" className="flex-1" />
            <Button onClick={fetchData} disabled={loading || !deviceId.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loaded && (
        <>
          {/* Active Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="w-5 h-5 text-primary" />
                Active Sessions ({sessions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No active sessions</p>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s: any) => (
                    <div key={s.id} className="p-3 rounded-lg border border-border bg-card text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Token: {s.sessionToken?.substring(0, 16)}...</span>
                        <Badge variant={s.isActive ? "default" : "secondary"}>{s.isActive ? "Active" : "Ended"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        User: {s.userId || "—"} | IP: {s.ipAddress || "—"} | Marks: {s.marksCount || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Started: {new Date(s.startedAt).toLocaleString()}
                        {s.expiresAt && ` | Expires: ${new Date(s.expiresAt).toLocaleString()}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Log */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="w-5 h-5 text-muted-foreground" />
                Audit Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLog.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No audit entries</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {auditLog.map((entry: any) => (
                    <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card text-sm">
                      <Badge variant={auditActionColor(entry.action)} className="shrink-0 text-xs">
                        {entry.action}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">
                          By: {entry.performedBy || "System"} | {new Date(entry.createdAt).toLocaleString()}
                        </p>
                        {entry.details && (
                          <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                            {typeof entry.details === "string" ? entry.details : JSON.stringify(entry.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default DeviceAuditPanel;
