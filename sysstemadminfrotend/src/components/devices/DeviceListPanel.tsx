import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { DeviceType, DeviceStatus } from "@/lib/enums";
import {
  Search, RefreshCw, Smartphone, Power, PowerOff, ShieldBan, ShieldCheck,
  Building2, Trash2, Edit, Eye, ChevronLeft, ChevronRight, Loader2
} from "lucide-react";

interface Device {
  id: string;
  deviceUid: string;
  deviceName: string;
  deviceType: string;
  instituteId: string | null;
  instituteName: string | null;
  isEnabled: number;
  status: string;
  lastHeartbeatAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
}

const DeviceListPanel = () => {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loaded, setLoaded] = useState(false);

  // Detail dialog
  const [detailDevice, setDetailDevice] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDeviceId, setAssignDeviceId] = useState("");
  const [assignInstituteId, setAssignInstituteId] = useState("");
  const [assignInstituteName, setAssignInstituteName] = useState("");

  // Block dialog
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockDeviceId, setBlockDeviceId] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;
      if (typeFilter !== "all") params.deviceType = typeFilter;
      const res = await api.getDevices(params);
      setDevices(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
      setLoaded(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, deviceId: string) => {
    try {
      if (action === "enable") await api.enableDevice(deviceId);
      else if (action === "disable") await api.disableDevice(deviceId);
      else if (action === "unblock") await api.unblockDevice(deviceId);
      else if (action === "unassign") await api.unassignDevice(deviceId);
      else if (action === "delete") await api.deleteDevice(deviceId);
      toast({ title: "Success", description: `Device ${action}d successfully` });
      fetchDevices();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleBlock = async () => {
    try {
      await api.blockDevice(blockDeviceId, blockReason);
      toast({ title: "Device blocked" });
      setBlockOpen(false);
      setBlockReason("");
      fetchDevices();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAssign = async () => {
    try {
      await api.assignDeviceToInstitute(assignDeviceId, {
        instituteId: assignInstituteId,
        instituteName: assignInstituteName,
      });
      toast({ title: "Device assigned to institute" });
      setAssignOpen(false);
      fetchDevices();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const viewDetail = async (deviceId: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const res = await api.getDeviceDetail(deviceId);
      setDetailDevice(res);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "default";
      case "INACTIVE": return "secondary";
      case "BLOCKED": return "destructive";
      case "MAINTENANCE": return "outline";
      default: return "secondary";
    }
  };

  if (!loaded) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-4">Click to load attendance devices</p>
          <Button onClick={fetchDevices} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Load Devices
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search devices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                onKeyDown={(e) => e.key === "Enter" && fetchDevices()}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.values(DeviceStatus).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.values(DeviceType).map((t) => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={fetchDevices} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Device list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Devices ({total})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No devices found</p>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div key={device.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{device.deviceName}</span>
                      <Badge variant={statusColor(device.status)}>{device.status}</Badge>
                      <Badge variant="outline" className="text-xs">{device.deviceType.replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">UID: {device.deviceUid}</p>
                    {device.instituteName && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {device.instituteName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Button size="sm" variant="ghost" onClick={() => viewDetail(device.id)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {device.status !== "BLOCKED" ? (
                      <>
                        {device.isEnabled ? (
                          <Button size="sm" variant="ghost" onClick={() => handleAction("disable", device.id)}>
                            <PowerOff className="w-4 h-4 text-warning" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => handleAction("enable", device.id)}>
                            <Power className="w-4 h-4 text-success" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setBlockDeviceId(device.id); setBlockOpen(true); }}>
                          <ShieldBan className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleAction("unblock", device.id)}>
                        <ShieldCheck className="w-4 h-4 text-success" />
                      </Button>
                    )}
                    {!device.instituteId ? (
                      <Button size="sm" variant="ghost" onClick={() => { setAssignDeviceId(device.id); setAssignOpen(true); }}>
                        <Building2 className="w-4 h-4 text-primary" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleAction("unassign", device.id)}>
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleAction("delete", device.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => { setPage(page - 1); setTimeout(fetchDevices, 0); }}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => { setPage(page + 1); setTimeout(fetchDevices, 0); }}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Device Details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : detailDevice ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Name:</span></div>
                <div className="font-medium">{detailDevice.device?.deviceName}</div>
                <div><span className="text-muted-foreground">UID:</span></div>
                <div className="font-medium">{detailDevice.device?.deviceUid}</div>
                <div><span className="text-muted-foreground">Type:</span></div>
                <div><Badge variant="outline">{detailDevice.device?.deviceType}</Badge></div>
                <div><span className="text-muted-foreground">Status:</span></div>
                <div><Badge variant={statusColor(detailDevice.device?.status)}>{detailDevice.device?.status}</Badge></div>
                <div><span className="text-muted-foreground">Institute:</span></div>
                <div className="font-medium">{detailDevice.device?.instituteName || "—"}</div>
                <div><span className="text-muted-foreground">Active Sessions:</span></div>
                <div className="font-medium">{detailDevice.activeSessions ?? 0}</div>
                <div><span className="text-muted-foreground">Last Heartbeat:</span></div>
                <div>{detailDevice.device?.lastHeartbeatAt ? new Date(detailDevice.device.lastHeartbeatAt).toLocaleString() : "—"}</div>
              </div>
              {detailDevice.config && (
                <div className="border-t border-border pt-3">
                  <p className="font-medium mb-2">Configuration</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-muted-foreground">Max Sessions:</span><span>{detailDevice.config.maxSessions}</span>
                    <span className="text-muted-foreground">Rate/min:</span><span>{detailDevice.config.rateLimitPerMinute}</span>
                    <span className="text-muted-foreground">Rate/hour:</span><span>{detailDevice.config.rateLimitPerHour}</span>
                    <span className="text-muted-foreground">Status Mode:</span><span>{detailDevice.config.allowedStatusMode}</span>
                    <span className="text-muted-foreground">Operating:</span>
                    <span>{detailDevice.config.operatingStartTime || "—"} - {detailDevice.config.operatingEndTime || "—"}</span>
                  </div>
                </div>
              )}
              {detailDevice.activeBinding && (
                <div className="border-t border-border pt-3">
                  <p className="font-medium mb-2">Active Event Binding</p>
                  <p className="text-xs">Event: {detailDevice.activeBinding.eventName} (ID: {detailDevice.activeBinding.eventId})</p>
                  {detailDevice.activeBinding.statusOverride && (
                    <p className="text-xs text-muted-foreground">Override: {detailDevice.activeBinding.statusOverride}</p>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Device to Institute</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Institute ID</Label>
              <Input value={assignInstituteId} onChange={(e) => setAssignInstituteId(e.target.value)} placeholder="e.g. 109" />
            </div>
            <div>
              <Label>Institute Name</Label>
              <Input value={assignInstituteName} onChange={(e) => setAssignInstituteName(e.target.value)} placeholder="e.g. Suraksha Academy" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!assignInstituteId}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Dialog */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Block Device</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason</Label>
              <Textarea value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Reason for blocking..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBlock}>Block Device</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeviceListPanel;
