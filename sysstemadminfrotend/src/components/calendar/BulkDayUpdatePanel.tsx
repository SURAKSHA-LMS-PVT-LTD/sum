import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";

const DAY_TYPES = ["REGULAR", "HALF_DAY", "EXAM_DAY", "STAFF_ONLY", "SPECIAL_EVENT", "CANCELLED", "PUBLIC_HOLIDAY", "INSTITUTE_HOLIDAY"];

interface Props { instituteId: string; }

export function BulkDayUpdatePanel({ instituteId }: Props) {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applyTo, setApplyTo] = useState("REGULAR");
  const [newDayType, setNewDayType] = useState("CANCELLED");
  const [title, setTitle] = useState("");
  const [isAttendanceExpected, setIsAttendanceExpected] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  async function loadPreview() {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const res = await api.getCalendarDays(instituteId, { startDate, endDate, limit: 400 });
      const days = (res.data || []).filter((d: any) => {
        if (applyTo === "ALL") return true;
        if (applyTo === "WORKING") return d.isAttendanceExpected;
        return d.dayType === applyTo;
      });
      setPreview(days);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function executeBulk() {
    setUpdating(true);
    const res: any[] = [];
    for (const day of preview) {
      try {
        await api.updateCalendarDay(instituteId, day.id, {
          dayType: newDayType,
          title: title || `${newDayType}: ${day.calendarDate}`,
          isAttendanceExpected,
        });
        res.push({ date: day.calendarDate, success: true });
      } catch (e: any) {
        res.push({ date: day.calendarDate, success: false, error: e.message });
      }
    }
    setResults(res);
    const successes = res.filter(r => r.success).length;
    toast({ title: "Done", description: `${successes}/${res.length} days updated` });
    setUpdating(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5" /> Bulk Update Calendar Days</CardTitle>
        <CardDescription>Quickly change multiple days at once (e.g., emergency closure)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>From</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Apply To</Label>
            <Select value={applyTo} onValueChange={setApplyTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All days in range</SelectItem>
                <SelectItem value="REGULAR">Only REGULAR days</SelectItem>
                <SelectItem value="HALF_DAY">Only HALF_DAY days</SelectItem>
                <SelectItem value="WORKING">Only working days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>New Day Type</Label>
            <Select value={newDayType} onValueChange={setNewDayType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DAY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="School closed — reason" /></div>

        <div className="flex items-center gap-3">
          <Switch checked={isAttendanceExpected} onCheckedChange={setIsAttendanceExpected} />
          <Label>Attendance Expected</Label>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={loadPreview} disabled={loading}>{loading ? "Loading..." : "Preview"}</Button>
          {preview.length > 0 && (
            <Button onClick={executeBulk} disabled={updating}>
              <Zap className="w-4 h-4 mr-1" /> {updating ? "Updating..." : `Update ${preview.length} Days`}
            </Button>
          )}
        </div>

        {preview.length > 0 && (
          <div className="border rounded-lg p-4 max-h-64 overflow-auto space-y-1">
            {preview.map(d => (
              <div key={d.id} className="text-sm text-foreground flex justify-between">
                <span>{d.calendarDate} ({new Date(d.calendarDate).toLocaleDateString("en", { weekday: "short" })})</span>
                <span className="text-muted-foreground">{d.dayType} → {newDayType}</span>
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div className="border rounded-lg p-4 max-h-48 overflow-auto space-y-1">
            {results.map((r, i) => (
              <div key={i} className={`text-sm ${r.success ? "text-success" : "text-destructive"}`}>
                {r.date}: {r.success ? "✅ Updated" : `❌ ${r.error}`}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
