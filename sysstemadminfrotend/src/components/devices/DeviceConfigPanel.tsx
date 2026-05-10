import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { AllowedStatusMode } from "@/lib/enums";
import { Settings, Loader2, Search } from "lucide-react";

const DeviceConfigPanel = () => {
  const { toast } = useToast();
  const [deviceId, setDeviceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);

  const fetchConfig = async () => {
    if (!deviceId.trim()) return;
    setLoading(true);
    try {
      const res = await api.getDeviceConfig(deviceId);
      setConfig(res);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await api.updateDeviceConfig(deviceId, {
        maxSessions: config.maxSessions,
        rateLimitPerMinute: config.rateLimitPerMinute,
        rateLimitPerHour: config.rateLimitPerHour,
        allowedStatusMode: config.allowedStatusMode,
        allowedStatusList: config.allowedStatusList,
        autoStatus: config.autoStatus || undefined,
        requireLocation: !!config.requireLocation,
        requirePhoto: !!config.requirePhoto,
        allowedIpRanges: config.allowedIpRanges,
        operatingStartTime: config.operatingStartTime || undefined,
        operatingEndTime: config.operatingEndTime || undefined,
      });
      toast({ title: "Config updated successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="Enter Device ID" className="flex-1" />
            <Button onClick={fetchConfig} disabled={loading || !deviceId.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {config && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="w-5 h-5 text-primary" />
              Device Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Max Sessions (1-10)</Label>
                <Input type="number" min={1} max={10} value={config.maxSessions} onChange={(e) => setConfig({ ...config, maxSessions: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-2">
                <Label>Rate Limit / Min</Label>
                <Input type="number" min={1} max={200} value={config.rateLimitPerMinute} onChange={(e) => setConfig({ ...config, rateLimitPerMinute: parseInt(e.target.value) || 30 })} />
              </div>
              <div className="space-y-2">
                <Label>Rate Limit / Hour</Label>
                <Input type="number" min={1} max={5000} value={config.rateLimitPerHour} onChange={(e) => setConfig({ ...config, rateLimitPerHour: parseInt(e.target.value) || 500 })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Allowed Status Mode</Label>
                <Select value={config.allowedStatusMode} onValueChange={(v) => setConfig({ ...config, allowedStatusMode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(AllowedStatusMode).map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Auto Status</Label>
                <Input value={config.autoStatus || ""} onChange={(e) => setConfig({ ...config, autoStatus: e.target.value })} placeholder="e.g. present" />
              </div>
            </div>

            {config.allowedStatusMode === "ONLY" && (
              <div className="space-y-2">
                <Label>Allowed Status List (comma-separated)</Label>
                <Input
                  value={(config.allowedStatusList || []).join(", ")}
                  onChange={(e) => setConfig({ ...config, allowedStatusList: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                  placeholder="present, late"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Operating Start Time</Label>
                <Input type="time" value={config.operatingStartTime || ""} onChange={(e) => setConfig({ ...config, operatingStartTime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Operating End Time</Label>
                <Input type="time" value={config.operatingEndTime || ""} onChange={(e) => setConfig({ ...config, operatingEndTime: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Allowed IP Ranges (comma-separated CIDR)</Label>
              <Input
                value={(config.allowedIpRanges || []).join(", ")}
                onChange={(e) => setConfig({ ...config, allowedIpRanges: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                placeholder="192.168.1.0/24"
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={!!config.requireLocation} onCheckedChange={(v) => setConfig({ ...config, requireLocation: v })} />
                <Label>Require Location</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!config.requirePhoto} onCheckedChange={(v) => setConfig({ ...config, requirePhoto: v })} />
                <Label>Require Photo</Label>
              </div>
            </div>

            <Button onClick={saveConfig} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DeviceConfigPanel;
