import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { enhancedCachedClient } from "@/api/enhancedCachedClient";
import { CACHE_TTL } from "@/config/cacheTTL";
import { getImageUrl } from "@/utils/imageUrlHelper";
import { Image as ImageIcon, Search } from "lucide-react";

export interface SmsClassOption {
  id: string;
  name: string;
  grade: number;
  academicYear: string;
  imageUrl?: string;
}

interface Props {
  instituteId: string;
  userId?: string;
  role?: string;
  selectedIds: string[];
  onChange: (ids: string[], items?: SmsClassOption[]) => void;
  triggerLabel?: string;
}

export default function ClassMultiSelectDialog({
  instituteId,
  userId,
  role,
  selectedIds,
  onChange,
  triggerLabel = "Select classes",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<SmsClassOption[]>([]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const data: any = await enhancedCachedClient.get(
          "/institute-classes",
          { instituteId, page: 1, limit: 100 },
          {
            ttl: CACHE_TTL.INSTITUTE_CLASSES,
            forceRefresh: false,
            userId,
            role: role || "User",
            instituteId,
          }
        );

        const arr: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        const normalized: SmsClassOption[] = arr.map((c: any) => ({
          id: String(c.id),
          name: String(c.name || ""),
          grade: Number(c.grade ?? 0),
          academicYear: String(c.academicYear || ""),
          imageUrl: c.imageUrl || c.image || c.logo || c.coverImageUrl || undefined,
        }));

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
  }, [open, instituteId, userId, role]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) => c.name.toLowerCase().includes(q) || String(c.grade).includes(q) || c.academicYear.toLowerCase().includes(q)
    );
  }, [items, search]);

  const toggle = (id: string) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    const selectedItems = items.filter((item) => newIds.includes(item.id));
    onChange(newIds, selectedItems);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select classes</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search class" />
        </div>

        <ScrollArea className="h-[420px] rounded-md border bg-card">
          <div className="divide-y">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading classes…</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No classes found.</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/60"
                >
                  <Checkbox checked={selectedIds.includes(c.id)} />
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getImageUrl(c.imageUrl)} alt={`Class ${c.name} image`} />
                    <AvatarFallback>
                      <ImageIcon className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      Grade {c.grade} • {c.academicYear}
                    </div>
                  </div>
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
