import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Edit } from "lucide-react";

const DAY_TYPES = ["REGULAR", "HALF_DAY", "EXAM_DAY", "STAFF_ONLY", "SPECIAL_EVENT", "CANCELLED", "PUBLIC_HOLIDAY", "INSTITUTE_HOLIDAY", "WEEKEND"];

interface Props { instituteId: string; }

export function CalendarDaysPanel({ instituteId }: Props) {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editDay, setEditDay] = useState<any>(null);
  const [editForm, setEditForm] = useState({ dayType: "", title: "", startTime: "", endTime: "", isAttendanceExpected: true });
  const [saving, setSaving] = useState(false);

  async function search() {
    if (!startDate || !endDate) { toast({ title: "Error", description: "Select date range", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await api.getCalendarDays(instituteId, {
        startDate, endDate,
        ...(filterType !== "ALL" ? { dayType: filterType } : {}),
        limit: 100,
      });
      setDays(res.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  function openEdit(day: any) {
    setEditDay(day);
    setEditForm({
      dayType: day.dayType,
      title: day.title || "",
      startTime: day.startTime || "",
      endTime: day.endTime || "",
      isAttendanceExpected: day.isAttendanceExpected ?? true,
    });
  }

  async function saveEdit() {
    if (!editDay) return;
    setSaving(true);
    try {
      await api.updateCalendarDay(instituteId, editDay.id, editForm);
      toast({ title: "Updated", description: `Day ${editDay.calendarDate} updated` });
      setEditDay(null);
      search(); // refresh
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  const typeColor: Record<string, string> = {
    REGULAR: "bg-success/10 text-success border-success/20",
    HALF_DAY: "bg-warning/10 text-warning border-warning/20",
    CANCELLED: "bg-destructive/10 text-destructive border-destructive/20",
    PUBLIC_HOLIDAY: "bg-destructive/10 text-destructive border-destructive/20",
    INSTITUTE_HOLIDAY: "bg-primary/10 text-primary border-primary/20",
    WEEKEND: "bg-muted text-muted-foreground",
    EXAM_DAY: "bg-accent/10 text-accent border-accent/20",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Calendar Days</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <Label>From</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-44" />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-44" />
            </div>
            <div>
              <Label>Day Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  {DAY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={search} disabled={loading}>
              <Search className="w-4 h-4 mr-1" /> {loading ? "Loading..." : "Search"}
            </Button>
          </div>

          {days.length > 0 && (
            <div className="border rounded-lg overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-3 text-foreground font-medium">Date</th>
                    <th className="text-left p-3 text-foreground font-medium">Type</th>
                    <th className="text-left p-3 text-foreground font-medium">Title</th>
                    <th className="text-center p-3 text-foreground font-medium">Time</th>
                    <th className="text-center p-3 text-foreground font-medium">Attendance</th>
                    <th className="text-center p-3 text-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map(day => (
                    <tr key={day.id} className="border-t border-border hover:bg-muted/50">
                      <td className="p-3 text-foreground">{day.calendarDate}</td>
                      <td className="p-3"><Badge variant="outline" className={typeColor[day.dayType] || ""}>{day.dayType}</Badge></td>
                      <td className="p-3 text-muted-foreground">{day.title || "—"}</td>
                      <td className="p-3 text-center text-muted-foreground">{day.startTime && day.endTime ? `${day.startTime}–${day.endTime}` : "—"}</td>
                      <td className="p-3 text-center">{day.isAttendanceExpected ? "✅" : "❌"}</td>
                      <td className="p-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(day)}><Edit className="w-4 h-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {days.length === 0 && !loading && (
            <p className="text-center py-8 text-muted-foreground">Select a date range and search to view calendar days</p>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editDay} onOpenChange={() => setEditDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Day — {editDay?.calendarDate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Day Type</Label>
              <Select value={editForm.dayType} onValueChange={v => setEditForm(f => ({ ...f, dayType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DAY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Time</Label><Input value={editForm.startTime} onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))} placeholder="08:00:00" /></div>
              <div><Label>End Time</Label><Input value={editForm.endTime} onChange={e => setEditForm(f => ({ ...f, endTime: e.target.value }))} placeholder="15:00:00" /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={editForm.isAttendanceExpected} onCheckedChange={v => setEditForm(f => ({ ...f, isAttendanceExpected: v }))} />
              <Label>Attendance Expected</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDay(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
