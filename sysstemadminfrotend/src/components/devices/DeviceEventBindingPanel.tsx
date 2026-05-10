import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Link, Unlink, Loader2, Search, History } from "lucide-react";

const DeviceEventBindingPanel = () => {
  const { toast } = useToast();
  const [deviceId, setDeviceId] = useState("");
  const [bindings, setBindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [bindLoading, setBindLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Bind form
  const [bindForm, setBindForm] = useState({
    eventId: "",
    eventName: "",
    calendarDayId: "",
    statusOverride: "",
    notes: "",
  });

  const fetchBindings = async () => {
    if (!deviceId.trim()) return;
    setLoading(true);
    try {
      const res = await api.getDeviceBindings(deviceId);
      setBindings(Array.isArray(res) ? res : res.data || []);
      setLoaded(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleBind = async () => {
    if (!bindForm.eventId) {
      toast({ title: "Event ID required", variant: "destructive" });
      return;
    }
    setBindLoading(true);
    try {
      const payload: any = { eventId: parseInt(bindForm.eventId) };
      if (bindForm.eventName) payload.eventName = bindForm.eventName;
      if (bindForm.calendarDayId) payload.calendarDayId = parseInt(bindForm.calendarDayId);
      if (bindForm.statusOverride) payload.statusOverride = bindForm.statusOverride;
      if (bindForm.notes) payload.notes = bindForm.notes;

      await api.bindDeviceEvent(deviceId, payload);
      toast({ title: "Event bound successfully" });
      setBindForm({ eventId: "", eventName: "", calendarDayId: "", statusOverride: "", notes: "" });
      fetchBindings();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBindLoading(false);
    }
  };

  const handleUnbind = async () => {
    try {
      await api.unbindDeviceEvent(deviceId);
      toast({ title: "Event unbound" });
      fetchBindings();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="Enter Device ID" className="flex-1" />
            <Button onClick={fetchBindings} disabled={loading || !deviceId.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loaded && (
        <>
          {/* Bind form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link className="w-5 h-5 text-primary" />
                Bind Event to Device
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Event ID *</Label>
                  <Input value={bindForm.eventId} onChange={(e) => setBindForm({ ...bindForm, eventId: e.target.value })} placeholder="e.g. 42" />
                </div>
                <div className="space-y-2">
                  <Label>Event Name</Label>
                  <Input value={bindForm.eventName} onChange={(e) => setBindForm({ ...bindForm, eventName: e.target.value })} placeholder="e.g. Parents Meeting" />
                </div>
                <div className="space-y-2">
                  <Label>Calendar Day ID</Label>
                  <Input value={bindForm.calendarDayId} onChange={(e) => setBindForm({ ...bindForm, calendarDayId: e.target.value })} placeholder="Optional" />
                </div>
                <div className="space-y-2">
                  <Label>Status Override</Label>
                  <Input value={bindForm.statusOverride} onChange={(e) => setBindForm({ ...bindForm, statusOverride: e.target.value })} placeholder="e.g. present" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={bindForm.notes} onChange={(e) => setBindForm({ ...bindForm, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleBind} disabled={bindLoading}>
                  {bindLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Bind Event
                </Button>
                <Button variant="outline" onClick={handleUnbind}>
                  <Unlink className="w-4 h-4 mr-2" />
                  Unbind Current
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Binding History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="w-5 h-5 text-muted-foreground" />
                Binding History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bindings.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No bindings found</p>
              ) : (
                <div className="space-y-2">
                  {bindings.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                      <div>
                        <p className="font-medium text-sm text-foreground">{b.eventName || `Event #${b.eventId}`}</p>
                        <p className="text-xs text-muted-foreground">
                          Bound: {new Date(b.boundAt).toLocaleString()}
                          {b.unboundAt && ` → Unbound: ${new Date(b.unboundAt).toLocaleString()}`}
                        </p>
                        {b.statusOverride && <p className="text-xs text-muted-foreground">Override: {b.statusOverride}</p>}
                      </div>
                      <Badge variant={b.status === "ACTIVE" ? "default" : "secondary"}>{b.status}</Badge>
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

export default DeviceEventBindingPanel;
