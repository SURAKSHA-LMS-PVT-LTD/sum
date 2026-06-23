import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, X, User, Mail, MapPin, CreditCard, Shield, Building2, BookOpen } from "lucide-react";
import { useState } from "react";
import { safeOpenUrl } from "@/lib/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (v: any) => {
  if (!v) return null;
  try { return new Date(v).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" }); }
  catch { return String(v); }
};

const fmtDateTime = (v: any) => {
  if (!v) return null;
  try { return new Date(v).toLocaleString("en-GB", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return String(v); }
};

const getStudentProfileUrl = (child: any) => {
  const instituteId = child?.instituteId || child?.institute?.id || child?.institute?.instituteId;
  const studentId = child?.studentId || child?.id || child?.userId || child?.uuid;
  if (!instituteId || !studentId) return null;
  return `/institute/${instituteId}/student/${studentId}/profile`;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, children }: { icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="pt-1">
      <p className="text-[11px] font-semibold text-primary uppercase tracking-widest flex items-center gap-1.5 mb-2">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {children}
      </p>
      <Separator className="mb-3" />
    </div>
  );
}

function Row({ label, value, mono, badge, full }: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  badge?: boolean;
  full?: boolean;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className={full ? "col-span-2 space-y-0.5" : "space-y-0.5"}>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {badge ? (
        <Badge variant="secondary" className="text-xs">{String(value)}</Badge>
      ) : (
        <p className={`text-sm ${mono ? "font-mono" : "font-medium"} break-all`}>{value}</p>
      )}
    </div>
  );
}

function UrlRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <Button variant="link" className="p-0 h-auto text-sm" onClick={() => safeOpenUrl(value)}>
        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
      </Button>
    </div>
  );
}

// ── User-specific structured view ─────────────────────────────────────────────

function UserDetailView({ data }: { data: any }) {
  const fullName = data.fullName || `${data.firstName || ""} ${data.lastName || ""}`.trim() || data.nameWithInitials || "—";

  const addressParts = [data.addressLine1, data.addressLine2, data.city].filter(Boolean).join(", ");
  const locationParts = [data.district, data.province, data.postalCode].filter(Boolean).join(", ");

  return (
    <div className="space-y-5 py-1">

      {/* ── Identity ── */}
      <div>
        <SectionTitle icon={User}>Identity</SectionTitle>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Row label="Full Name" value={fullName} full />
          <Row label="First Name" value={data.firstName} />
          <Row label="Last Name" value={data.lastName} />
          <Row label="Name with Initials" value={data.nameWithInitials} />
          <Row label="Gender" value={data.gender} badge />
          <Row label="Date of Birth" value={fmtDate(data.dateOfBirth)} />
          <Row label="Religion" value={data.religion} />
          <Row label="NIC" value={data.nic} mono />
          <Row label="Birth Certificate No." value={data.birthCertificateNo} mono />
        </div>
      </div>

      {/* ── Contact ── */}
      <div>
        <SectionTitle icon={Mail}>Contact</SectionTitle>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Row label="Email" value={data.email} />
          <Row label="Phone" value={data.phoneNumber} mono />
          <Row label="Telegram" value={data.telegramId} mono />
          <Row label="Emergency Contact" value={data.emergencyContact} mono />
        </div>
      </div>

      {/* ── Address ── */}
      {(addressParts || locationParts) && (
        <div>
          <SectionTitle icon={MapPin}>Address</SectionTitle>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {addressParts && <Row label="Street" value={addressParts} full />}
            <Row label="District" value={data.district} />
            <Row label="Province" value={data.province} />
            <Row label="Postal Code" value={data.postalCode} mono />
            <Row label="Country" value={data.country} />
          </div>
        </div>
      )}

      {/* ── Account ── */}
      <div>
        <SectionTitle icon={Shield}>Account</SectionTitle>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Row label="User ID" value={data.id} mono />
          <Row label="User Type" value={data.userType} badge />
          <Row label="Status" value={data.isActive ? "Active" : "Inactive"} badge />
          <Row label="Language" value={data.language} badge />
          <Row label="Subscription Plan" value={data.subscriptionPlan} badge />
          <Row label="Profile Completion" value={data.profileCompletionStatus ? `${data.profileCompletionStatus} (${data.profileCompletionPercentage ?? 0}%)` : undefined} />
          <Row label="Phone Verified" value={data.isPhoneVerified != null ? (data.isPhoneVerified ? "Yes" : "No") : undefined} />
          <Row label="Email Verified" value={data.isEmailVerified != null ? (data.isEmailVerified ? "Yes" : "No") : undefined} />
          <Row label="First Login Done" value={data.firstLoginCompleted != null ? (data.firstLoginCompleted ? "Yes" : "No") : undefined} />
          <Row label="Created" value={fmtDateTime(data.createdAt)} />
          <Row label="Last Login" value={fmtDateTime(data.lastLoginAt)} />
          <Row label="Payment Expires" value={fmtDate(data.paymentExpiresAt)} />
        </div>
      </div>

      {/* ── Student data ── */}
      {(data.studentId || data.bloodGroup || data.medicalConditions || data.allergies) && (
        <div>
          <SectionTitle icon={BookOpen}>Student</SectionTitle>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Row label="Student ID" value={data.studentId} mono />
            <Row label="Blood Group" value={data.bloodGroup} badge />
            <Row label="Medical Conditions" value={data.medicalConditions} />
            <Row label="Allergies" value={data.allergies} />
            <Row label="Card Delivery Recipient" value={data.cardDeliveryRecipient} />
          </div>
        </div>
      )}

      {/* ── Cards & RFID ── */}
      {(data.rfid || data.cardId) && (
        <div>
          <SectionTitle icon={CreditCard}>Cards & RFID</SectionTitle>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Row label="RFID" value={data.rfid} mono />
            <Row label="RFID Status" value={data.rfidCardStatus} badge />
            <Row label="RFID Expiry" value={fmtDate(data.rfidExpiryDate)} />
            <Row label="Card ID" value={data.cardId} mono />
            <Row label="Card Status" value={data.cardStatus} badge />
            <Row label="Card Expiry" value={fmtDate(data.cardExpiryDate)} />
          </div>
        </div>
      )}

      {/* ── Media ── */}
      {(data.imageUrl || data.idUrl) && (
        <div>
          <SectionTitle>Media</SectionTitle>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <UrlRow label="Profile Image" value={data.imageUrl} />
            <UrlRow label="ID Document" value={data.idUrl} />
            <Row label="Image Status" value={data.imageVerificationStatus} badge />
          </div>
        </div>
      )}

      {/* ── Institutes ── */}
      {Array.isArray(data.institutes) && data.institutes.length > 0 && (
        <div>
          <SectionTitle icon={Building2}>Institutes</SectionTitle>
          <div className="space-y-2">
            {data.institutes.map((inst: any, i: number) => (
              <div key={inst.id || i} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-3 py-2">
                <span className="text-sm font-medium flex-1">{inst.name}</span>
                {inst.role && <Badge variant="outline" className="text-xs">{inst.role}</Badge>}
                {inst.status && <Badge variant="secondary" className="text-xs">{inst.status}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Children / Students ── */}
      {Array.isArray(data.children || data.students) && (data.children || data.students).length > 0 && (
        <div>
          <SectionTitle icon={User}>Children / Students</SectionTitle>
          <div className="space-y-2">
            {(data.children || data.students).map((child: any, i: number) => {
              const profileUrl = getStudentProfileUrl(child);
              const name = child?.nameWithInitials || child?.fullName || child?.name || "Student";
              return (
                <div key={child?.studentId || child?.id || i} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-3 py-2">
                  <span className="text-sm font-medium">{name}</span>
                  {child?.studentId && <span className="text-xs text-muted-foreground font-mono">{child.studentId}</span>}
                  {profileUrl ? (
                    <a href={profileUrl} className="text-xs font-medium text-primary hover:underline ml-auto">Open profile</a>
                  ) : (
                    <span className="text-xs text-muted-foreground ml-auto">No profile link</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Generic fallback view (for non-user data) ─────────────────────────────────

const formatLabel = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).replace(/url/gi, "URL").replace(/\bid\b/gi, "ID");

const formatGenericValue = (key: string, value: any): React.ReactNode => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key.toLowerCase().includes("url") && typeof value === "string" && value.startsWith("http")) {
    return <Button variant="link" className="p-0 h-auto text-sm" onClick={() => safeOpenUrl(value)}><ExternalLink className="h-3.5 w-3.5 mr-1" />Open</Button>;
  }
  if ((key.toLowerCase().includes("date") || key.toLowerCase().endsWith("at")) && typeof value === "string") {
    try { return new Date(value).toLocaleString(); } catch { return value; }
  }
  if (Array.isArray(value)) return value.length ? `${value.length} item(s)` : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

function GenericDetailView({ data }: { data: any }) {
  const excludeKeys = ["password", "access_token", "token"];
  const entries = Object.entries(data).filter(([k]) => !excludeKeys.includes(k.toLowerCase()));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
      {entries.map(([key, value]) => (
        <div key={key} className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{formatLabel(key)}</p>
          <div className="text-sm">
            {key.toLowerCase().includes("status") || key.toLowerCase().includes("type") || key.toLowerCase().includes("plan")
              ? <Badge variant="secondary">{String(value) || "—"}</Badge>
              : formatGenericValue(key, value)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

const USER_KEYS = new Set(["firstName", "lastName", "fullName", "nameWithInitials", "email", "phoneNumber", "userType", "gender", "nic", "birthCertificateNo", "religion"]);

function isUserObject(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  return USER_KEYS.has(Object.keys(data).find(k => USER_KEYS.has(k)) ?? "");
}

interface ViewDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: any | null;
  title: string;
  imageKey?: string;
}

export function ViewDetailsDialog({ open, onOpenChange, data, title, imageKey }: ViewDetailsDialogProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  if (!data) return null;

  const imageUrl = imageKey ? data[imageKey] : data.imageUrl || data.imgUrl || data.logoUrl;
  const displayName = data.fullName || `${data.firstName || ""} ${data.lastName || ""}`.trim() || data.nameWithInitials || title;
  const useStructured = isUserObject(data);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-3">
              {imageUrl && (
                <Avatar
                  className="h-10 w-10 cursor-pointer hover:ring-2 ring-primary transition-all shrink-0"
                  onClick={() => setImagePreview(imageUrl)}
                >
                  <AvatarImage src={imageUrl} alt={displayName} />
                  <AvatarFallback className="text-sm bg-primary/10 text-primary">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0">
                <p className="text-base font-semibold truncate">{displayName}</p>
                {data.id && <p className="text-xs text-muted-foreground font-mono">#{data.id}</p>}
              </div>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 pb-6">
              {useStructured ? <UserDetailView data={data} /> : <GenericDetailView data={data} />}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {imagePreview && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setImagePreview(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setImagePreview(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={imagePreview}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
