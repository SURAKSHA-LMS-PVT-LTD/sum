import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { DeviceType } from "@/lib/enums";
import { Smartphone, Loader2 } from "lucide-react";

const RegisterDevicePanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    deviceUid: "",
    deviceName: "",
    deviceType: "TABLET",
    instituteId: "",
    instituteName: "",
    description: "",
  });

  const handleSubmit = async () => {
    if (!form.deviceUid.trim() || !form.deviceName.trim()) {
      toast({ title: "Validation", description: "Device UID and Name are required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        deviceUid: form.deviceUid,
        deviceName: form.deviceName,
        deviceType: form.deviceType,
      };
      if (form.instituteId) payload.instituteId = form.instituteId;
      if (form.instituteName) payload.instituteName = form.instituteName;
      if (form.description) payload.description = form.description;

      await api.registerDevice(payload);
      toast({ title: "Device registered successfully" });
      setForm({ deviceUid: "", deviceName: "", deviceType: "TABLET", instituteId: "", instituteName: "", description: "" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" />
          Register New Device
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Device UID *</Label>
            <Input value={form.deviceUid} onChange={(e) => setForm({ ...form, deviceUid: e.target.value })} placeholder="e.g. DEVICE-SN-00129" />
          </div>
          <div className="space-y-2">
            <Label>Device Name *</Label>
            <Input value={form.deviceName} onChange={(e) => setForm({ ...form, deviceName: e.target.value })} placeholder="e.g. Front Gate Tablet" />
          </div>
          <div className="space-y-2">
            <Label>Device Type</Label>
            <Select value={form.deviceType} onValueChange={(v) => setForm({ ...form, deviceType: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(DeviceType).map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Institute ID (optional)</Label>
            <Input value={form.instituteId} onChange={(e) => setForm({ ...form, instituteId: e.target.value })} placeholder="Assign immediately" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Institute Name (optional)</Label>
            <Input value={form.instituteName} onChange={(e) => setForm({ ...form, instituteName: e.target.value })} placeholder="For display purposes" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description (optional)</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Notes about this device..." rows={3} />
        </div>
        <Button onClick={handleSubmit} disabled={loading} className="w-full sm:w-auto">
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Register Device
        </Button>
      </CardContent>
    </Card>
  );
};

export default RegisterDevicePanel;
