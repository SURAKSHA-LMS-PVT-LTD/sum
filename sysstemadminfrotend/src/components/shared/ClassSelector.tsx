import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ClassItem {
  id: string;
  name: string;
  [key: string]: any;
}

interface ClassSelectorProps {
  instituteId: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function ClassSelector({
  instituteId,
  value,
  onChange,
  label = "Class",
  placeholder = "Select a class",
  className = "",
}: ClassSelectorProps) {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!instituteId || instituteId === "all") {
      setClasses([]);
      onChange("");
      return;
    }
    const fetchClasses = async () => {
      try {
        setLoading(true);
        // Try institute-scoped classes first, fall back to global
        const response = await api.getInstituteClasses({ page: 1, limit: 200 });
        const all: ClassItem[] = (response?.data ?? []).map((c: any) => ({
          id: c.id ?? c.classId,
          name: c.className ?? c.name ?? c.id,
          ...c,
        }));
        // Filter by instituteId if available
        const filtered = all.filter((c: any) =>
          !c.instituteId || c.instituteId === instituteId
        );
        setClasses(filtered.length > 0 ? filtered : all);
      } catch {
        setClasses([]);
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, [instituteId]);

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label>{label}</Label>}
      <Select
        value={value}
        onValueChange={onChange}
        disabled={loading || !instituteId || instituteId === "all"}
      >
        <SelectTrigger className="w-full min-w-[200px]">
          <SelectValue
            placeholder={
              !instituteId || instituteId === "all"
                ? "Select institute first"
                : loading
                ? "Loading classes..."
                : placeholder
            }
          />
        </SelectTrigger>
        <SelectContent>
          {classes.map((cls) => (
            <SelectItem key={cls.id} value={cls.id}>
              {cls.name}
            </SelectItem>
          ))}
          {!loading && classes.length === 0 && (
            <SelectItem value="_none" disabled>No classes found</SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
