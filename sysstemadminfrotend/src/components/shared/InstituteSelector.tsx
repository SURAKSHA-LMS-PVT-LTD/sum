import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Institute {
  id: string;
  name: string;
  tier?: string;
  subdomain?: string | null;
  customDomain?: string | null;
  [key: string]: any;
}

interface InstituteSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onInstituteSelect?: (institute: Institute | null) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

// Cache institutes so we only fetch once per session
let cachedInstitutes: Institute[] | null = null;

export function InstituteSelector({
  value,
  onChange,
  onInstituteSelect,
  label = "Institute",
  placeholder = "Select an institute",
  className = "",
  required = false,
}: InstituteSelectorProps) {
  const [institutes, setInstitutes] = useState<Institute[]>(cachedInstitutes ?? []);
  const [loading, setLoading] = useState(!cachedInstitutes);

  useEffect(() => {
    if (cachedInstitutes) return;
    const fetchAll = async () => {
      try {
        // Fetch first page to get total, then fetch all
        const first = await api.getInstitutes(1, 1);
        const total = first?.total ?? first?.meta?.total ?? 50;
        const all = await api.getInstitutes(1, Math.min(total, 100));
        const list: Institute[] = (all?.institutes ?? all?.data ?? []).map((i: any) => ({
          id: i.id ?? i.instituteId,
          name: i.name ?? i.instituteName ?? i.id,
          ...i,
        }));
        cachedInstitutes = list;
        setInstitutes(list);
      } catch {
        setInstitutes([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Select value={value} onValueChange={(val) => {
        onChange(val);
        if (onInstituteSelect) {
          const inst = institutes.find((i) => i.id === val) || null;
          onInstituteSelect(inst);
        }
      }} disabled={loading}>
        <SelectTrigger className="w-full min-w-[220px]">
          <SelectValue placeholder={loading ? "Loading institutes..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {!required && (
            <SelectItem value="all">All Institutes</SelectItem>
          )}
          {institutes.map((inst) => (
            <SelectItem key={inst.id} value={inst.id}>
              <div className="flex items-center gap-2 w-full">
                <span className="truncate">{inst.name}</span>
                {inst.tier && inst.tier !== "FREE" && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                    {inst.tier}
                  </Badge>
                )}
                {inst.subdomain && (
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    {inst.subdomain}.suraksha.lk
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
          {!loading && institutes.length === 0 && (
            <SelectItem value="_none" disabled>No institutes found</SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Call this to clear the cache (e.g., after creating an institute) */
export function clearInstituteCache() {
  cachedInstitutes = null;
}
