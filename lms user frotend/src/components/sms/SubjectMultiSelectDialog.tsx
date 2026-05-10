import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { enhancedCachedClient } from "@/api/enhancedCachedClient";
import { apiClient } from "@/api/client";
import { CACHE_TTL } from "@/config/cacheTTL";
import { getImageUrl } from "@/utils/imageUrlHelper";
import { Image as ImageIcon, Search } from "lucide-react";

export interface SmsSubjectOption {
  id: string;
  name: string;
  code: string;
  imgUrl?: string | null;
  instituteId?: string | null;
  classId?: string | null;
  className?: string | null;
}

interface Props {
  instituteId: string;
  userId?: string;
  role?: string;
  selectedIds: string[];
  onChange: (ids: string[], items?: SmsSubjectOption[]) => void;
  triggerLabel?: string;
  /** When classIds are provided, only fetch subjects for those classes */
  classIds?: string[];
}

export default function SubjectMultiSelectDialog({
  instituteId,
  userId,
  role,
  selectedIds,
  onChange,
  triggerLabel = "Select subjects",
  classIds,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<SmsSubjectOption[]>([]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        let normalized: SmsSubjectOption[] = [];

        if (classIds && classIds.length > 0) {
          // Fetch subjects scoped to selected classes
          const results = await Promise.all(
            classIds.map((classId) =>
              apiClient.get(
                `/institutes/${instituteId}/classes/${classId}/subjects?page=1&limit=100`
              ).then((data: any) => {
                const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
                return arr.map((s: any) => ({
                  id: String(s.subjectId ?? s.id ?? ""),
                  name: String(s.subject?.name ?? s.name ?? ""),
                  code: String(s.subject?.code ?? s.code ?? ""),
                  imgUrl: s.subject?.imgUrl ?? s.imgUrl ?? null,
                  instituteId: String(instituteId),
                  classId: String(classId),
                  className: null,
                }));
              }).catch(() => [] as SmsSubjectOption[])
            )
          );
          // Deduplicate by subject id (same subject may be in multiple classes)
          const seen = new Set<string>();
          for (const batch of results) {
            for (const s of batch) {
              if (s.id && !seen.has(s.id)) {
                seen.add(s.id);
                normalized.push(s);
              }
            }
          }
        } else {
          // No classes selected — fall back to all institute subjects
          const data: any = await enhancedCachedClient.get(
            "/subjects/all",
            {},
            {
              ttl: CACHE_TTL.SUBJECTS,
              forceRefresh: false,
              userId,
              role: role || "User",
              instituteId,
            }
          );
          const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
          normalized = arr.map((s: any) => ({
            id: String(s.id),
            name: String(s.name || ""),
            code: String(s.code || ""),
            imgUrl: s.imgUrl ?? s.imageUrl ?? s.image ?? null,
            instituteId: s.instituteId ?? null,
          }));
          // Keep only current institute
          if (normalized.some((x) => x.instituteId)) {
            normalized = normalized.filter((x) => String(x.instituteId) === String(instituteId));
          }
        }

        if (!cancelled) setItems(normalized);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
   
  }, [open, instituteId, userId, role, classIds?.join(",")]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [items, search]);

  const toggle = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    const newItems = items.filter((s) => newIds.includes(s.id));
    onChange(newIds, newItems);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Select Subjects
            {classIds && classIds.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (filtered for {classIds.length} selected class{classIds.length > 1 ? 'es' : ''})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subject" />
        </div>

        <ScrollArea className="h-[420px] rounded-md border bg-card">
          <div className="divide-y">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading subjects…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No subjects found.</div>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/60"
                >
                  <Checkbox checked={selectedIds.includes(s.id)} />
                  <div className="h-10 w-10 rounded-md overflow-hidden bg-muted shrink-0">
                    <img
                      src={getImageUrl(s.imgUrl)}
                      alt={s.name ? `Subject ${s.name} image` : "Subject image"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.code}</div>
                  </div>

                  {selectedIds.includes(s.id) && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">Selected</Badge>
                  )}
                  {!s.imgUrl && <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Selected: {selectedIds.length}</div>
          <Button type="button" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
