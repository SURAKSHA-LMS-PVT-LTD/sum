import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { systemConfigApi, SystemConfigEntry, GroupSummary } from "@/api/systemConfig.api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Plus, Pencil, Trash2, Power, PowerOff, Search, Settings, Database } from "lucide-react";

const GROUP_ICONS: Record<string, string> = {
  ATTENDANCE: "📊", RATE_LIMIT: "🚦", AUTH: "🔒", FEATURE: "🏳️",
  SMS: "📱", CACHE: "💾", UPLOAD: "📁", PAGINATION: "📄",
  SECURITY: "🛡️", ADVERTISEMENT: "📢", NOTIFICATION: "🔔",
};

const GROUP_COLORS: Record<string, string> = {
  ATTENDANCE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  RATE_LIMIT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  AUTH: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  FEATURE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  SMS: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  CACHE: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  UPLOAD: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  PAGINATION: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  SECURITY: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  ADVERTISEMENT: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  NOTIFICATION: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
};

const ENUM_OPTIONS: Record<string, string[]> = {
  "ATTENDANCE.SYNC_MODE": ["IMMEDIATE", "DYNAMO_FIRST", "BACKEND_SCHEDULE"],
  "ADVERTISEMENT.DEFAULT_TYPE": ["text", "image", "video"],
};

const VALUE_TYPES = ["STRING", "NUMBER", "BOOLEAN", "ENUM", "JSON"];

export default function SystemConfigPage() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SystemConfigEntry[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("ALL");
  const [activeOnly, setActiveOnly] = useState(false);
  const [cacheRefreshing, setCacheRefreshing] = useState(false);

  // Edit modal
  const [editEntry, setEditEntry] = useState<SystemConfigEntry | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createGroup, setCreateGroup] = useState("");
  const [createKey, setCreateKey] = useState("");
  const [createValue, setCreateValue] = useState("");
  const [createType, setCreateType] = useState("STRING");
  const [createDesc, setCreateDesc] = useState("");

  // Delete/deactivate dialog
  const [deleteEntry, setDeleteEntry] = useState<SystemConfigEntry | null>(null);
  const [deleteMode, setDeleteMode] = useState<"deactivate" | "delete">("deactivate");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, groupRes] = await Promise.all([
        systemConfigApi.getAll(filterGroup !== "ALL" ? filterGroup : undefined, activeOnly ? true : undefined),
        systemConfigApi.getGroupSummaries(),
      ]);
      setConfigs(configRes.data || []);
      setGroups(groupRes.data || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to load configs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filterGroup, activeOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefreshCache = async () => {
    setCacheRefreshing(true);
    try {
      const res = await systemConfigApi.refreshCache();
      toast({ title: "Cache Refreshed", description: `${res.entriesCached} entries cached` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCacheRefreshing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editEntry) return;
    setSaving(true);
    try {
      await systemConfigApi.update(editEntry.configGroup, editEntry.configKey, {
        value: editValue,
        description: editDesc || undefined,
      });
      toast({ title: "Updated", description: `${editEntry.configGroup}.${editEntry.configKey} updated` });
      setEditEntry(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!createGroup || !createKey || !createValue) {
      toast({ title: "Validation", description: "Group, Key and Value are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await systemConfigApi.create({
        group: createGroup,
        key: createKey,
        value: createValue,
        valueType: createType,
        description: createDesc || undefined,
      });
      toast({ title: "Created", description: `${createGroup}.${createKey} created` });
      setShowCreate(false);
      setCreateGroup(""); setCreateKey(""); setCreateValue(""); setCreateType("STRING"); setCreateDesc("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrDeactivate = async () => {
    if (!deleteEntry) return;
    try {
      if (deleteMode === "deactivate") {
        await systemConfigApi.deactivate(deleteEntry.configGroup, deleteEntry.configKey);
        toast({ title: "Deactivated", description: `${deleteEntry.configGroup}.${deleteEntry.configKey} deactivated` });
      } else {
        await systemConfigApi.delete(deleteEntry.configGroup, deleteEntry.configKey);
        toast({ title: "Deleted", description: `${deleteEntry.configGroup}.${deleteEntry.configKey} permanently deleted` });
      }
      setDeleteEntry(null);
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleReactivate = async (entry: SystemConfigEntry) => {
    try {
      await systemConfigApi.reactivate(entry.configGroup, entry.configKey);
      toast({ title: "Reactivated", description: `${entry.configGroup}.${entry.configKey} reactivated` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleBoolean = async (entry: SystemConfigEntry) => {
    const newVal = entry.configValue === "true" ? "false" : "true";
    try {
      await systemConfigApi.update(entry.configGroup, entry.configKey, { value: newVal });
      toast({ title: "Toggled", description: `${entry.configKey} = ${newVal}` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Group configs by configGroup
  const grouped = configs.reduce<Record<string, SystemConfigEntry[]>>((acc, c) => {
    (acc[c.configGroup] = acc[c.configGroup] || []).push(c);
    return acc;
  }, {});

  // Filter by search
  const filteredGroups = Object.entries(grouped)
    .map(([group, entries]) => ({
      group,
      entries: entries.filter(
        (e) =>
          !searchTerm ||
          e.configKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (e.description || "").toLowerCase().includes(searchTerm.toLowerCase())
      ),
    }))
    .filter((g) => g.entries.length > 0)
    .sort((a, b) => a.group.localeCompare(b.group));

  const openEdit = (entry: SystemConfigEntry) => {
    setEditEntry(entry);
    setEditValue(entry.configValue);
    setEditDesc(entry.description || "");
  };

  const renderValueInput = (
    valueType: string,
    value: string,
    onChange: (v: string) => void,
    groupKey?: string
  ) => {
    const enumKey = groupKey;
    if (valueType === "BOOLEAN") {
      return (
        <div className="flex items-center gap-3">
          <Switch checked={value === "true"} onCheckedChange={(c) => onChange(c ? "true" : "false")} />
          <span className="text-sm text-muted-foreground">{value === "true" ? "Enabled" : "Disabled"}</span>
        </div>
      );
    }
    if (valueType === "ENUM" && enumKey && ENUM_OPTIONS[enumKey]) {
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ENUM_OPTIONS[enumKey].map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (valueType === "NUMBER") {
      return <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />;
    }
    if (valueType === "JSON") {
      return <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} className="font-mono text-sm" />;
    }
    return <Input value={value} onChange={(e) => onChange(e.target.value)} />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="System Configuration"
            description="Manage all runtime system settings across 11 groups"
            icon={Settings}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefreshCache} disabled={cacheRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-1 ${cacheRefreshing ? "animate-spin" : ""}`} />
              Refresh Cache
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" />
              New Config
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {groups.map((g) => (
            <Card
              key={g.group}
              className="cursor-pointer hover:shadow-soft transition-shadow"
              onClick={() => setFilterGroup(filterGroup === g.group ? "ALL" : g.group)}
            >
              <CardContent className="p-3 text-center">
                <span className="text-2xl">{GROUP_ICONS[g.group] || "⚙️"}</span>
                <p className="text-xs font-medium text-muted-foreground mt-1">{g.group}</p>
                <p className="text-lg font-bold text-foreground">{g.activeCount}/{g.count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search configs..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Groups" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Groups</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.group} value={g.group}>
                  {GROUP_ICONS[g.group]} {g.group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch checked={activeOnly} onCheckedChange={setActiveOnly} id="active-only" />
            <Label htmlFor="active-only" className="text-sm">Active Only</Label>
          </div>
        </div>

        {/* Config Groups Accordion */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No configurations found</CardContent></Card>
        ) : (
          <Accordion type="multiple" defaultValue={filteredGroups.map((g) => g.group)} className="space-y-3">
            {filteredGroups.map(({ group, entries }) => {
              const summary = groups.find((g) => g.group === group);
              return (
                <AccordionItem key={group} value={group} className="border rounded-lg bg-card shadow-soft overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xl">{GROUP_ICONS[group] || "⚙️"}</span>
                      <span className="font-semibold text-foreground">{group}</span>
                      <Badge variant="secondary" className={GROUP_COLORS[group] || ""}>
                        {summary?.activeCount ?? entries.length} active / {summary?.count ?? entries.length} total
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pb-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-t bg-muted/50">
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Key</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Value</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Type</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden lg:table-cell">Description</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden xl:table-cell">Updated</th>
                            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((entry) => (
                            <tr
                              key={entry.id}
                              className={`border-t hover:bg-muted/30 transition-colors ${!entry.isActive ? "opacity-50" : ""}`}
                            >
                              <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                                {entry.configKey}
                                {!entry.isActive && (
                                  <Badge variant="outline" className="ml-2 text-[10px]">Inactive</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {entry.valueType === "BOOLEAN" && entry.isActive ? (
                                  <Switch
                                    checked={entry.configValue === "true"}
                                    onCheckedChange={() => handleToggleBoolean(entry)}
                                  />
                                ) : (
                                  <span className="font-mono text-xs text-foreground max-w-[200px] truncate block">
                                    {entry.configValue}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <Badge variant="outline" className="text-[10px]">{entry.valueType}</Badge>
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground max-w-[250px] truncate">
                                {entry.description || "—"}
                              </td>
                              <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">
                                <div>{entry.updatedBy || "—"}</div>
                                <div>{new Date(entry.updatedAt).toLocaleDateString()}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(entry)}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  {entry.isActive ? (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-warning"
                                      onClick={() => { setDeleteEntry(entry); setDeleteMode("deactivate"); }}
                                    >
                                      <PowerOff className="w-3.5 h-3.5" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-success"
                                      onClick={() => handleReactivate(entry)}
                                    >
                                      <Power className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => { setDeleteEntry(entry); setDeleteMode("delete"); }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="w-3.5 h-3.5" />
          <span>{configs.length} entries loaded</span>
          <span>•</span>
          <span>{groups.length} groups</span>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editEntry} onOpenChange={(open) => !open && setEditEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Configuration</DialogTitle>
            <DialogDescription>
              {editEntry?.configGroup}.{editEntry?.configKey}
            </DialogDescription>
          </DialogHeader>
          {editEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Group</Label>
                  <p className="font-mono text-sm font-medium">{editEntry.configGroup}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Key</Label>
                  <p className="font-mono text-sm font-medium">{editEntry.configKey}</p>
                </div>
              </div>
              <div>
                <Label>Value</Label>
                {renderValueInput(
                  editEntry.valueType,
                  editValue,
                  setEditValue,
                  `${editEntry.configGroup}.${editEntry.configKey}`
                )}
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} />
              </div>
              <div className="text-xs text-muted-foreground">
                Type: <Badge variant="outline" className="text-[10px]">{editEntry.valueType}</Badge>
                {" • "}Last updated by {editEntry.updatedBy || "unknown"} on {new Date(editEntry.updatedAt).toLocaleString()}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Configuration</DialogTitle>
            <DialogDescription>Add a new config entry to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Group</Label>
              <Select value={createGroup} onValueChange={setCreateGroup}>
                <SelectTrigger><SelectValue placeholder="Select group..." /></SelectTrigger>
                <SelectContent>
                  {["ATTENDANCE", "RATE_LIMIT", "AUTH", "FEATURE", "SMS", "CACHE", "UPLOAD", "PAGINATION", "SECURITY", "ADVERTISEMENT", "NOTIFICATION"].map((g) => (
                    <SelectItem key={g} value={g}>{GROUP_ICONS[g]} {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Key</Label>
              <Input
                placeholder="NEW_CONFIG_KEY"
                value={createKey}
                onChange={(e) => setCreateKey(e.target.value.toUpperCase().replace(/\s/g, "_"))}
              />
            </div>
            <div>
              <Label>Value Type</Label>
              <Select value={createType} onValueChange={setCreateType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALUE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              {renderValueInput(createType, createValue, setCreateValue)}
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete/Deactivate Confirmation */}
      <AlertDialog open={!!deleteEntry} onOpenChange={(open) => !open && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteMode === "deactivate" ? "Deactivate Configuration" : "Delete Configuration"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMode === "deactivate"
                ? `This will deactivate ${deleteEntry?.configGroup}.${deleteEntry?.configKey}. It will be preserved but ignored at runtime.`
                : `This will permanently delete ${deleteEntry?.configGroup}.${deleteEntry?.configKey}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrDeactivate}
              className={deleteMode === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {deleteMode === "deactivate" ? "Deactivate" : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
