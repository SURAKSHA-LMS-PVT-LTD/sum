import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, X } from "lucide-react";
import { useState } from "react";
import { safeOpenUrl } from "@/lib/api";

const formatNameWithInitials = (value: string) => {
  const parts = value.split(' ').filter(Boolean);
  if (parts.length <= 1) return value;
  const lastName = parts.pop();
  const initials = parts.map((part) => `${part[0].toUpperCase()}.`).join(' ');
  return `${initials} ${lastName}`;
};

const getStudentProfileUrl = (child: any) => {
  const instituteId = child?.instituteId || child?.institute?.id || child?.institute?.instituteId;
  const studentId = child?.studentId || child?.id || child?.userId || child?.uuid;
  if (!instituteId || !studentId) return null;
  return `/institute/${instituteId}/student/${studentId}/profile`;
};

interface ViewDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: any | null;
  title: string;
  imageKey?: string;
}

const formatValue = (key: string, value: any): React.ReactNode => {
  if (value === null || value === undefined) return "-";

  if ((key.toLowerCase() === "children" || key.toLowerCase() === "students") && Array.isArray(value)) {
    return (
      <div className="space-y-2">
        {value.length === 0 ? (
          <span>-</span>
        ) : value.map((child: any, index: number) => {
          const profileUrl = getStudentProfileUrl(child);
          const childName = child?.nameWithInitials || child?.name || child?.fullName || "Student";
          const displayName = typeof childName === "string" ? formatNameWithInitials(childName) : "Student";

          return (
            <div key={child?.studentId || child?.id || index} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-3 py-2">
              <span className="font-medium">{displayName}</span>
              {child?.studentId && <span className="text-xs text-muted-foreground">{child.studentId}</span>}
              {profileUrl ? (
                <a href={profileUrl} className="text-xs font-medium text-primary hover:underline">Open profile</a>
              ) : (
                <span className="text-xs text-muted-foreground">No profile link</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  
  if (key.toLowerCase().includes("url") && typeof value === "string" && value.startsWith("http")) {
    return (
      <Button
        variant="link"
        className="p-0 h-auto"
        onClick={() => safeOpenUrl(value)}
      >
        <ExternalLink className="h-4 w-4 mr-1" />
        Open Link
      </Button>
    );
  }
  
  if (key.toLowerCase().includes("date") || key.toLowerCase().includes("at")) {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }
  
  if (key.toLowerCase().includes("amount") || key.toLowerCase() === "credithours") {
    return typeof value === "string" ? `Rs. ${parseFloat(value).toLocaleString()}` : value.toLocaleString();
  }

  if (key.toLowerCase().includes("name") && typeof value === "string") {
    return formatNameWithInitials(value);
  }
  
  return String(value);
};

const formatLabel = (key: string): string => {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/url/gi, "URL")
    .replace(/id/gi, "ID");
};

export function ViewDetailsDialog({ open, onOpenChange, data, title, imageKey }: ViewDetailsDialogProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  if (!data) return null;

  const imageUrl = imageKey ? data[imageKey] : data.imageUrl || data.imgUrl || data.logoUrl;
  
  const excludeKeys = ["password", "access_token", "token"];
  const entries = Object.entries(data).filter(
    ([key]) => !excludeKeys.includes(key.toLowerCase())
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {imageUrl && (
                <Avatar 
                  className="h-12 w-12 cursor-pointer hover:ring-2 ring-primary transition-all"
                  onClick={() => setImagePreview(imageUrl)}
                >
                  <AvatarImage src={imageUrl} alt={title} />
                  <AvatarFallback>{title.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
              {title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {entries.map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {formatLabel(key)}
                  </p>
                  <div className="text-sm">
                    {key.toLowerCase().includes("status") || 
                     key.toLowerCase().includes("type") || 
                     key.toLowerCase().includes("plan") ? (
                      <Badge variant="secondary">{String(value) || "-"}</Badge>
                    ) : (
                      formatValue(key, value)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
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
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
