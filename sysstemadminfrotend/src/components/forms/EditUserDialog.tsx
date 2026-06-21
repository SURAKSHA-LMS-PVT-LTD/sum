import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { District, Province } from "@/lib/enums";
import { Loader2, Save, User } from "lucide-react";

const USER_TYPES = [
  { value: "USER", label: "User (Student)" },
  { value: "USER_WITHOUT_PARENT", label: "User (No Parent)" },
  { value: "USER_WITHOUT_STUDENT", label: "User (No Student / Parent)" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ORGANIZATION_MANAGER", label: "Organization Manager" },
];

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const LANGUAGES = [
  { value: "ENGLISH", label: "English" },
  { value: "SINHALA", label: "Sinhala" },
  { value: "TAMIL", label: "Tamil" },
];

const SUBSCRIPTION_PLANS = [
  { value: "FREE", label: "Free" },
  { value: "BASIC", label: "Basic" },
  { value: "PREMIUM", label: "Premium" },
  { value: "ENTERPRISE", label: "Enterprise" },
];

const RFID_CARD_STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DEACTIVATED", label: "Deactivated" },
  { value: "EXPIRED", label: "Expired" },
  { value: "LOST", label: "Lost" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "REPLACED", label: "Replaced" },
];

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId: string | null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-2">
      <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">{children}</p>
      <Separator className="mb-4" />
    </div>
  );
}

export function EditUserDialog({ open, onOpenChange, onSuccess, userId }: EditUserDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (open && userId) {
      setLoading(true);
      setForm({});
      api.getUserById(userId)
        .then((user: any) => setForm(user))
        .catch(() => toast({ title: "Error", description: "Failed to load user", variant: "destructive" }))
        .finally(() => setLoading(false));
    }
  }, [open, userId]);

  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      // Strip read-only / server-set fields before sending
      const {
        id, createdAt, updatedAt, passwordSetAt, lastLoginAt, createdByAdminId,
        imageVerificationStatus, imageVerifiedBy, imageVerifiedAt, imageRejectionReason,
        profileCompletionStatus, profileCompletionPercentage, firstLoginCompleted,
        isPhoneVerified, isEmailVerified, password,
        ...payload
      } = form;

      // Clean empty strings → undefined so the backend ignores them
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (v === "" || v === null || v === undefined) continue;
        cleaned[k] = v;
      }

      await api.updateUser(userId, cleaned);
      toast({ title: "Saved", description: "User updated successfully" });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "Failed to update user", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            Edit User
            {form.id && (
              <Badge variant="outline" className="ml-1 text-xs font-mono"># {form.id}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="px-6 py-4 space-y-5">

              {/* ── Identity ── */}
              <SectionTitle>Identity</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name">
                  <Input value={form.firstName ?? ""} onChange={e => set("firstName", e.target.value)} className="h-9 text-sm" />
                </Field>
                <Field label="Last Name">
                  <Input value={form.lastName ?? ""} onChange={e => set("lastName", e.target.value)} className="h-9 text-sm" />
                </Field>
                <Field label="Name With Initials">
                  <Input value={form.nameWithInitials ?? ""} onChange={e => set("nameWithInitials", e.target.value)} className="h-9 text-sm" />
                </Field>
                <Field label="Date of Birth">
                  <Input type="date" value={form.dateOfBirth ? String(form.dateOfBirth).split("T")[0] : ""} onChange={e => set("dateOfBirth", e.target.value)} className="h-9 text-sm" />
                </Field>
                <Field label="Gender">
                  <Select value={form.gender ?? ""} onValueChange={v => set("gender", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      {GENDERS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="NIC">
                  <Input value={form.nic ?? ""} onChange={e => set("nic", e.target.value)} className="h-9 text-sm" placeholder="e.g. 123456789V" />
                </Field>
                <Field label="Birth Certificate No">
                  <Input value={form.birthCertificateNo ?? ""} onChange={e => set("birthCertificateNo", e.target.value)} className="h-9 text-sm" />
                </Field>
              </div>

              {/* ── Contact ── */}
              <SectionTitle>Contact</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email">
                  <Input type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} className="h-9 text-sm" />
                </Field>
                <Field label="Phone Number">
                  <Input value={form.phoneNumber ?? ""} onChange={e => set("phoneNumber", e.target.value)} className="h-9 text-sm" placeholder="+94771234567" />
                </Field>
                <Field label="Telegram ID">
                  <Input value={form.telegramId ?? ""} onChange={e => set("telegramId", e.target.value)} className="h-9 text-sm" placeholder="@username or chat ID" />
                </Field>
              </div>

              {/* ── Address ── */}
              <SectionTitle>Address</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Address Line 1">
                  <Input value={form.addressLine1 ?? ""} onChange={e => set("addressLine1", e.target.value)} className="h-9 text-sm" />
                </Field>
                <Field label="Address Line 2">
                  <Input value={form.addressLine2 ?? ""} onChange={e => set("addressLine2", e.target.value)} className="h-9 text-sm" />
                </Field>
                <Field label="City">
                  <Input value={form.city ?? ""} onChange={e => set("city", e.target.value)} className="h-9 text-sm" />
                </Field>
                <Field label="Postal Code">
                  <Input value={form.postalCode ?? ""} onChange={e => set("postalCode", e.target.value)} className="h-9 text-sm" maxLength={6} />
                </Field>
                <Field label="District">
                  <Select value={form.district ?? ""} onValueChange={v => set("district", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select district" /></SelectTrigger>
                    <SelectContent>
                      {Object.values(District).map(d => (
                        <SelectItem key={d} value={d}>{d.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Province">
                  <Select value={form.province ?? ""} onValueChange={v => set("province", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select province" /></SelectTrigger>
                    <SelectContent>
                      {Object.values(Province).map(p => (
                        <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {/* ── Account ── */}
              <SectionTitle>Account</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Field label="User Type">
                  <Select value={form.userType ?? ""} onValueChange={v => set("userType", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {USER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Language">
                  <Select value={form.language ?? ""} onValueChange={v => set("language", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select language" /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Subscription Plan">
                  <Select value={form.subscriptionPlan ?? ""} onValueChange={v => set("subscriptionPlan", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>
                      {SUBSCRIPTION_PLANS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Payment Expires At">
                  <Input type="datetime-local" value={form.paymentExpiresAt ? String(form.paymentExpiresAt).slice(0, 16) : ""} onChange={e => set("paymentExpiresAt", e.target.value ? new Date(e.target.value).toISOString() : "")} className="h-9 text-sm" />
                </Field>
                <div className="flex items-center justify-between col-span-2 p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Account Active</p>
                    <p className="text-xs text-muted-foreground">Inactive users cannot log in</p>
                  </div>
                  <Switch checked={form.isActive ?? true} onCheckedChange={v => set("isActive", v)} />
                </div>
              </div>

              {/* ── Cards & RFID ── */}
              <SectionTitle>Cards & RFID</SectionTitle>
              <div className="grid grid-cols-2 gap-4">
                <Field label="RFID">
                  <Input value={form.rfid ?? ""} onChange={e => set("rfid", e.target.value)} className="h-9 text-sm font-mono" placeholder="RFID card value" />
                </Field>
                <Field label="RFID Status">
                  <Select value={form.rfidCardStatus ?? ""} onValueChange={v => set("rfidCardStatus", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      {RFID_CARD_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="RFID Expiry Date">
                  <Input type="datetime-local" value={form.rfidExpiryDate ? String(form.rfidExpiryDate).slice(0, 16) : ""} onChange={e => set("rfidExpiryDate", e.target.value ? new Date(e.target.value).toISOString() : "")} className="h-9 text-sm" />
                </Field>
                <Field label="Card ID (QR/Barcode)">
                  <Input value={form.cardId ?? ""} onChange={e => set("cardId", e.target.value)} className="h-9 text-sm font-mono" />
                </Field>
                <Field label="Card Status">
                  <Select value={form.cardStatus ?? ""} onValueChange={v => set("cardStatus", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      {RFID_CARD_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Card Expiry Date">
                  <Input type="datetime-local" value={form.cardExpiryDate ? String(form.cardExpiryDate).slice(0, 16) : ""} onChange={e => set("cardExpiryDate", e.target.value ? new Date(e.target.value).toISOString() : "")} className="h-9 text-sm" />
                </Field>
              </div>

              {/* ── Media ── */}
              <SectionTitle>Media URLs</SectionTitle>
              <div className="grid grid-cols-1 gap-4">
                <Field label="Profile Image URL">
                  <Input value={form.imageUrl ?? ""} onChange={e => set("imageUrl", e.target.value)} className="h-9 text-sm font-mono text-xs" placeholder="profile-images/..." />
                </Field>
                <Field label="ID Document URL">
                  <Input value={form.idUrl ?? ""} onChange={e => set("idUrl", e.target.value)} className="h-9 text-sm font-mono text-xs" placeholder="id-documents/..." />
                </Field>
              </div>

              {/* ── Read-only info ── */}
              <SectionTitle>System Info (Read-only)</SectionTitle>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  ["System ID", form.id],
                  ["Created At", form.createdAt ? new Date(form.createdAt).toLocaleString() : "—"],
                  ["Last Login", form.lastLoginAt ? new Date(form.lastLoginAt).toLocaleString() : "—"],
                  ["Password Set At", form.passwordSetAt ? new Date(form.passwordSetAt).toLocaleString() : "—"],
                  ["Phone Verified", form.isPhoneVerified ? "Yes" : "No"],
                  ["Email Verified", form.isEmailVerified ? "Yes" : "No"],
                  ["Profile Completion", `${form.profileCompletionPercentage ?? 0}% (${form.profileCompletionStatus ?? "—"})`],
                  ["First Login Done", form.firstLoginCompleted ? "Yes" : "No"],
                  ["Image Verification", form.imageVerificationStatus ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5 p-2 rounded bg-muted/40">
                    <span className="text-muted-foreground font-medium">{label}</span>
                    <span className="font-mono break-all">{value ?? "—"}</span>
                  </div>
                ))}
              </div>

              <div className="pb-2" />
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0 flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
