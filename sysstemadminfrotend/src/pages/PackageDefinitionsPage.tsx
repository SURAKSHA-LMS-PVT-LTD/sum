import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { SubscriptionPlan } from "@/lib/enums";
import { Plus, Pencil, Trash2, Package, EyeOff, Eye } from "lucide-react";

interface PackageDefinition {
  id: string;
  subscriptionPlan: string;
  name: string;
  description?: string;
  features?: string[];
  price: number;
  validityDays: number;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  subscriptionPlan: "",
  name: "",
  description: "",
  features: "",
  price: "",
  validityDays: "30",
  imageUrl: "",
  sortOrder: "0",
  isActive: true,
};

export default function PackageDefinitionsPage() {
  const { toast } = useToast();
  const [packages, setPackages] = useState<PackageDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPackageDefinitions();
      setPackages(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      toast({ title: "Error", description: "Failed to load packages", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (pkg: PackageDefinition) => {
    setEditingId(pkg.id);
    setForm({
      subscriptionPlan: pkg.subscriptionPlan,
      name: pkg.name,
      description: pkg.description ?? "",
      features: (pkg.features ?? []).join("\n"),
      price: String(pkg.price),
      validityDays: String(pkg.validityDays ?? 30),
      imageUrl: pkg.imageUrl ?? "",
      sortOrder: String(pkg.sortOrder),
      isActive: pkg.isActive as any,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.subscriptionPlan || !form.name || !form.price) {
      toast({ title: "Validation", description: "Plan, name and price are required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        subscriptionPlan: form.subscriptionPlan,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        features: form.features.trim() ? form.features.split("\n").map(s => s.trim()).filter(Boolean) : undefined,
        price: parseFloat(form.price),
        validityDays: parseInt(form.validityDays) || 30,
        imageUrl: form.imageUrl.trim() || undefined,
        sortOrder: parseInt(form.sortOrder) || 0,
        isActive: form.isActive,
      };

      if (editingId) {
        const { subscriptionPlan: _sp, ...updatePayload } = payload;
        await api.updatePackageDefinition(editingId, updatePayload);
        toast({ title: "Updated", description: "Package updated" });
      } else {
        await api.createPackageDefinition(payload);
        toast({ title: "Created", description: "Package created" });
      }
      setDialogOpen(false);
      fetchPackages();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message ?? "Failed to save package", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (pkg: PackageDefinition) => {
    try {
      await api.updatePackageDefinition(pkg.id, { isActive: !pkg.isActive });
      toast({
        title: pkg.isActive ? "Package deactivated" : "Package activated",
        description: pkg.isActive
          ? `"${pkg.name}" is now hidden from users.`
          : `"${pkg.name}" is now visible to users.`,
      });
      fetchPackages();
    } catch {
      toast({ title: "Error", description: "Failed to update package status", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deletePackageDefinition(id);
      toast({ title: "Deleted", description: "Package deleted" });
      setDeleteId(null);
      fetchPackages();
    } catch {
      toast({ title: "Error", description: "Failed to delete package", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Package Definitions"
        description="Manage subscription packages shown to users when upgrading their plan"
        icon={Package}
      />

      <div className="p-6">
        <div className="flex justify-end mb-4">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Package
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : packages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No packages defined yet. Add one to get started.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className={`border rounded-lg p-4 space-y-3 bg-card shadow-sm transition-opacity ${!pkg.isActive ? "opacity-60" : ""}`}>
                {pkg.imageUrl && (
                  <img src={pkg.imageUrl} alt={pkg.name} className="w-full h-32 object-cover rounded-md" />
                )}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-lg">{pkg.name}</h3>
                    <Badge variant="outline" className="text-xs mt-0.5">{pkg.subscriptionPlan}</Badge>
                  </div>
                  <Badge variant={pkg.isActive ? "default" : "secondary"} className="shrink-0">
                    {pkg.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {pkg.description && <p className="text-sm text-muted-foreground">{pkg.description}</p>}
                {pkg.features && pkg.features.length > 0 && (
                  <ul className="text-sm space-y-1">
                    {pkg.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-end justify-between">
                  <div className="text-xl font-bold">Rs. {Number(pkg.price).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{pkg.validityDays} days / unit</div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(pkg)} className="flex-1">
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={pkg.isActive ? "secondary" : "outline"}
                    onClick={() => handleToggleActive(pkg)}
                    title={pkg.isActive ? "Deactivate (hide from users)" : "Activate (show to users)"}
                  >
                    {pkg.isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeleteId(pkg.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Package" : "New Package"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingId && (
              <div className="space-y-1">
                <Label>Subscription Plan *</Label>
                <Select value={form.subscriptionPlan} onValueChange={(v) => setForm(f => ({ ...f, subscriptionPlan: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>
                    {Object.values(SubscriptionPlan).filter(p => p !== SubscriptionPlan.FREE).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. WhatsApp Pro" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description shown on card" rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Features (one per line)</Label>
              <Textarea value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} placeholder={"Unlimited messages\nPriority support\nCustom branding"} rows={4} />
            </div>
            <div className="space-y-1">
              <Label>Price (LKR) *</Label>
              <Input type="number" min={0} step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="1500.00" />
            </div>
            <div className="space-y-1">
              <Label>Validity Days (per unit)</Label>
              <Input type="number" min={1} value={form.validityDays} onChange={e => setForm(f => ({ ...f, validityDays: e.target.value }))} placeholder="30" />
              <p className="text-xs text-muted-foreground">Users can multiply — e.g. ×3 = 3× this amount and 3× these days</p>
            </div>
            <div className="space-y-1">
              <Label>Image URL</Label>
              <Input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label>Sort Order</Label>
              <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={!!form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label>Active (visible to users)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader><DialogTitle>Delete Package?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">This cannot be undone. Users will no longer see this package.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
