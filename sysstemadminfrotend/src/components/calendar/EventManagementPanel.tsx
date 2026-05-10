import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

const EVENT_TYPES = ["REGULAR_CLASS", "EXAM", "PARENTS_MEETING", "SPORTS_DAY", "CULTURAL_EVENT", "FIELD_TRIP", "WORKSHOP", "ORIENTATION", "STAFF_MEETING", "TRAINING", "CUSTOM"];
const EVENT_STATUSES = ["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED", "POSTPONED"];
const TARGET_SCOPES = ["INSTITUTE", "CLASS", "SUBJECT"];
const ATTENDANCE_OPEN_TO = ["TARGET_ONLY", "ALL_ENROLLED", "ANYONE"];
const TARGET_USER_TYPES = ["STUDENT", "TEACHER", "PARENT", "STAFF", "ATTENDANCE_MARKER"];

interface Props { instituteId: string; }

export function EventManagementPanel({ instituteId }: Props) {
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    calendarDate: "",
    calendarDayId: "",
    eventType: "PARENTS_MEETING",
    title: "",
    description: "",
    eventDate: "",
    startTime: "",
    endTime: "",
    isAllDay: false,
    isAttendanceTracked: true,
    isDefault: false,
    targetUserTypes: ["STUDENT"] as string[],
    attendanceOpenTo: "TARGET_ONLY",
    targetScope: "INSTITUTE",
    targetClassIds: "",
    targetSubjectIds: "",
    venue: "",
    status: "SCHEDULED",
    isMandatory: false,
    maxParticipants: "",
    notes: "",
  });

  function update(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function toggleUserType(type: string) {
    setForm(f => ({
      ...f,
      targetUserTypes: f.targetUserTypes.includes(type)
        ? f.targetUserTypes.filter(t => t !== type)
        : [...f.targetUserTypes, type],
    }));
  }

  async function create() {
    if (!form.title || !form.eventType || !form.eventDate) {
      toast({ title: "Validation", description: "Title, event type, and event date are required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const payload: any = {
        eventType: form.eventType,
        title: form.title,
        eventDate: form.eventDate,
        isAttendanceTracked: form.isAttendanceTracked,
        isDefault: form.isDefault,
        targetUserTypes: form.targetUserTypes,
        attendanceOpenTo: form.attendanceOpenTo,
        targetScope: form.targetScope,
        status: form.status,
        isMandatory: form.isMandatory,
      };
      if (form.calendarDayId) payload.calendarDayId = form.calendarDayId;
      else if (form.calendarDate) payload.calendarDate = form.calendarDate;
      if (form.description) payload.description = form.description;
      if (form.startTime) payload.startTime = form.startTime;
      if (form.endTime) payload.endTime = form.endTime;
      if (form.isAllDay) payload.isAllDay = true;
      if (form.venue) payload.venue = form.venue;
      if (form.notes) payload.notes = form.notes;
      if (form.maxParticipants) payload.maxParticipants = parseInt(form.maxParticipants);
      if (form.targetScope === "CLASS" && form.targetClassIds) {
        payload.targetClassIds = form.targetClassIds.split(",").map(s => s.trim());
      }
      if (form.targetScope === "SUBJECT" && form.targetSubjectIds) {
        payload.targetSubjectIds = form.targetSubjectIds.split(",").map(s => s.trim());
      }

      await api.createCalendarEvent(instituteId, payload);
      toast({ title: "Success", description: "Event created!" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setCreating(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Create New Event</CardTitle>
        <CardDescription>Create an event linked to a calendar day</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Basic Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Event Type</Label>
              <Select value={form.eventType} onValueChange={v => update("eventType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Title</Label><Input value={form.title} onChange={e => update("title", e.target.value)} placeholder="Event title" /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={e => update("description", e.target.value)} placeholder="Optional description" /></div>
          <div><Label>Venue</Label><Input value={form.venue} onChange={e => update("venue", e.target.value)} placeholder="Location / venue" /></div>
        </div>

        {/* Date & Time */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Date & Time</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Event Date</Label><Input type="date" value={form.eventDate} onChange={e => update("eventDate", e.target.value)} /></div>
            <div><Label>Calendar Day ID (optional)</Label><Input value={form.calendarDayId} onChange={e => update("calendarDayId", e.target.value)} placeholder="Auto-resolve by date" /></div>
            <div><Label>Calendar Date (alt)</Label><Input type="date" value={form.calendarDate} onChange={e => update("calendarDate", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Start Time</Label><Input value={form.startTime} onChange={e => update("startTime", e.target.value)} placeholder="14:00:00" /></div>
            <div><Label>End Time</Label><Input value={form.endTime} onChange={e => update("endTime", e.target.value)} placeholder="16:00:00" /></div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.isAllDay} onCheckedChange={v => update("isAllDay", v)} />
              <Label>All Day Event</Label>
            </div>
          </div>
        </div>

        {/* Attendance */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Attendance Settings</h3>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2"><Switch checked={form.isAttendanceTracked} onCheckedChange={v => update("isAttendanceTracked", v)} /><Label>Track Attendance</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.isMandatory} onCheckedChange={v => update("isMandatory", v)} /><Label>Mandatory</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.isDefault} onCheckedChange={v => update("isDefault", v)} /><Label>Default Event</Label></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Open To</Label>
              <Select value={form.attendanceOpenTo} onValueChange={v => update("attendanceOpenTo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ATTENDANCE_OPEN_TO.map(o => <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Max Participants (optional)</Label><Input value={form.maxParticipants} onChange={e => update("maxParticipants", e.target.value)} placeholder="Leave empty for unlimited" type="number" /></div>
          </div>
        </div>

        {/* Target Scope */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Target Scope</h3>
          <div>
            <Label>Scope</Label>
            <Select value={form.targetScope} onValueChange={v => update("targetScope", v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>{TARGET_SCOPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.targetScope === "CLASS" && (
            <div><Label>Class IDs (comma-separated)</Label><Input value={form.targetClassIds} onChange={e => update("targetClassIds", e.target.value)} placeholder="201, 202" /></div>
          )}
          {form.targetScope === "SUBJECT" && (
            <div><Label>Subject IDs (comma-separated)</Label><Input value={form.targetSubjectIds} onChange={e => update("targetSubjectIds", e.target.value)} placeholder="301, 302" /></div>
          )}
          <div>
            <Label>Target User Types</Label>
            <div className="flex flex-wrap gap-3 mt-2">
              {TARGET_USER_TYPES.map(t => (
                <div key={t} className="flex items-center gap-2">
                  <Checkbox checked={form.targetUserTypes.includes(t)} onCheckedChange={() => toggleUserType(t)} />
                  <span className="text-sm text-foreground">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="Additional notes" /></div>

        <div className="flex justify-end">
          <Button onClick={create} disabled={creating}>{creating ? "Creating..." : "Create Event"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
