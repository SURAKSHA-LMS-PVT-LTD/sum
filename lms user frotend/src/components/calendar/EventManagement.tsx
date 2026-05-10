import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import calendarApi from '@/api/calendar.api';
import { getErrorMessage } from '@/api/apiError';
import type {
  CalendarEvent,
  CreateEventPayload,
  CalendarEventType,
  EventStatus,
  AttendanceOpenTo,
  TargetScope,
  AttendanceUserType,
} from '@/types/calendar.types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import ResponsiveDatePicker from './ResponsiveDatePicker';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';

import { ALL_CALENDAR_EVENT_TYPES, ALL_EVENT_STATUSES, ALL_ATTENDANCE_OPEN_TO, ALL_TARGET_SCOPES } from '@/types/calendar.types';

const EVENT_TYPES = ALL_CALENDAR_EVENT_TYPES;
const EVENT_STATUSES = ALL_EVENT_STATUSES;
const ATTENDANCE_OPEN_TO = ALL_ATTENDANCE_OPEN_TO;
const TARGET_SCOPES = ALL_TARGET_SCOPES;
const USER_TYPES: AttendanceUserType[] = ['STUDENT', 'TEACHER', 'PARENT', 'STAFF'];

const emptyFormFactory = (): CreateEventPayload => ({
  eventType: 'CUSTOM',
  title: '',
  eventDate: new Date().toISOString().split('T')[0],
  startTime: '08:00:00',
  endTime: '15:00:00',
  isAllDay: false,
  isAttendanceTracked: true,
  isDefault: false,
  targetUserTypes: ['STUDENT'],
  attendanceOpenTo: 'TARGET_ONLY',
  targetScope: 'INSTITUTE',
  targetClassIds: [],
  targetSubjectIds: [],
  status: 'SCHEDULED',
  isMandatory: false,
  meetingLink: '',
  venue: '',
  notes: '',
});

const csvToList = (value?: string[]) => value?.join(', ') || '';
const listFromCsv = (value: string) =>
  value.split(',').map(v => v.trim()).filter(Boolean);

const EventManagement: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [form, setForm] = useState<CreateEventPayload>(emptyFormFactory());
  const [targetClassCsv, setTargetClassCsv] = useState('');
  const [targetSubjectCsv, setTargetSubjectCsv] = useState('');

  useEffect(() => {
    if (currentInstituteId) { loadEvents(); return; }
    setEvents([]); setLoading(false);
  }, [currentInstituteId, filterDate]);

  const loadEvents = async () => {
    if (!currentInstituteId) return;
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 100 };
      if (filterDate) params.eventDate = filterDate;
      const res = await calendarApi.getEvents(currentInstituteId, params);
      setEvents(Array.isArray(res?.data) ? res.data : []);
    } catch { setEvents([]); } finally { setLoading(false); }
  };

  const validateEventForm = (isEdit: boolean) => {
    if (!form.title?.trim()) { toast.error('Title is required'); return false; }
    if (!isEdit && !form.eventDate) { toast.error('Event date is required'); return false; }
    if (!form.isAllDay && form.startTime && form.endTime && form.startTime >= form.endTime) { toast.error('End time must be after start time'); return false; }
    if (!isEdit && form.calendarDayId && form.calendarDate) { toast.error('Use calendar day OR calendar date, not both'); return false; }
    if (!isEdit && !form.calendarDayId && !form.calendarDate && !form.eventDate) { toast.error('Calendar day or date is required'); return false; }
    if (form.targetScope === 'CLASS' && (form.targetClassIds?.length || 0) === 0) { toast.error('Target class IDs are required when scope is CLASS'); return false; }
    if (form.targetScope === 'SUBJECT' && (form.targetSubjectIds?.length || 0) === 0) { toast.error('Target subject IDs are required when scope is SUBJECT'); return false; }
    if (form.maxParticipants !== undefined && form.maxParticipants !== null && Number(form.maxParticipants) <= 0) { toast.error('Max participants must be a positive number'); return false; }
    return true;
  };

  const handleCreate = async () => {
    if (!currentInstituteId || !validateEventForm(false)) return;
    setSaving(true);
    try {
      const payload: CreateEventPayload = {
        ...form,
        title: form.title.trim(),
        calendarDate: form.calendarDayId ? undefined : form.eventDate,
        startTime: form.isAllDay ? undefined : form.startTime,
        endTime: form.isAllDay ? undefined : form.endTime,
        targetClassIds: form.targetScope === 'CLASS' ? form.targetClassIds : undefined,
        targetSubjectIds: form.targetScope === 'SUBJECT' ? form.targetSubjectIds : undefined,
      };
      await calendarApi.createEvent(currentInstituteId, payload);
      toast.success('Event created successfully');
      setShowCreate(false);
      setForm(emptyFormFactory());
      setTargetClassCsv(''); setTargetSubjectCsv('');
      await loadEvents();
    } catch (error: any) { toast.error(getErrorMessage(error, 'Failed to create event')); } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!currentInstituteId || !editEvent || !validateEventForm(true)) return;
    setSaving(true);
    try {
      await calendarApi.updateEvent(currentInstituteId, editEvent.id, {
        eventType: form.eventType, title: form.title.trim(), description: form.description,
        startTime: form.isAllDay ? undefined : form.startTime, endTime: form.isAllDay ? undefined : form.endTime,
        status: form.status, notes: form.notes, venue: form.venue, meetingLink: form.meetingLink,
        isMandatory: form.isMandatory, isAttendanceTracked: form.isAttendanceTracked,
        targetUserTypes: form.targetUserTypes, attendanceOpenTo: form.attendanceOpenTo,
        targetScope: form.targetScope,
        targetClassIds: form.targetScope === 'CLASS' ? form.targetClassIds : undefined,
        targetSubjectIds: form.targetScope === 'SUBJECT' ? form.targetSubjectIds : undefined,
        maxParticipants: form.maxParticipants,
      });
      toast.success('Event updated successfully');
      setEditEvent(null);
      await loadEvents();
    } catch (error: any) { toast.error(getErrorMessage(error, 'Failed to update event')); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!currentInstituteId || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await calendarApi.deleteEvent(currentInstituteId, deleteTarget.id);
      toast.success('Event deleted');
      setDeleteTarget(null);
      await loadEvents();
    } catch (error: any) { toast.error(getErrorMessage(error, 'Failed to delete event')); } finally { setIsDeleting(false); }
  };

  const openCreate = () => {
    setForm(emptyFormFactory());
    setTargetClassCsv(''); setTargetSubjectCsv('');
    setShowCreate(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setEditEvent(event);
    setForm({
      ...emptyFormFactory(),
      eventType: event.eventType, title: event.title, eventDate: event.eventDate,
      description: event.description, startTime: event.startTime, endTime: event.endTime,
      isAllDay: event.isAllDay, isAttendanceTracked: event.isAttendanceTracked,
      targetUserTypes: event.targetUserTypes || [], attendanceOpenTo: event.attendanceOpenTo,
      targetScope: event.targetScope, targetClassIds: event.targetClassIds || [],
      targetSubjectIds: event.targetSubjectIds || [], venue: event.venue,
      meetingLink: event.meetingLink, status: event.status, notes: event.notes,
      isMandatory: event.isMandatory, maxParticipants: event.maxParticipants,
    });
    setTargetClassCsv(csvToList(event.targetClassIds));
    setTargetSubjectCsv(csvToList(event.targetSubjectIds));
  };

  const toggleUserType = (type: AttendanceUserType) => {
    const current = form.targetUserTypes || [];
    setForm({
      ...form,
      targetUserTypes: current.includes(type) ? current.filter(t => t !== type) : [...current, type],
    });
  };

  const renderForm = (isEdit: boolean) => (
    <div className="space-y-4 max-h-[64vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Event Type</Label>
          <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v as CalendarEventType })}>
            <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map(t => (
                <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EventStatus })}>
            <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_STATUSES.map(s => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Title *</Label>
        <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1 text-xs" />
      </div>

      <div>
        <Label className="text-xs">Description</Label>
        <Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 text-xs" rows={2} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Date</Label>
          <div className="mt-1">
            <ResponsiveDatePicker
              value={form.eventDate}
              onChange={(v) => setForm({ ...form, eventDate: v, calendarDate: v })}
              disabled={isEdit}
              placeholder="Event date"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Start</Label>
          <Input type="time" value={form.startTime?.slice(0, 5) || ''} onChange={e => setForm({ ...form, startTime: `${e.target.value}:00` })} className="mt-1 text-xs h-9" disabled={!!form.isAllDay} />
        </div>
        <div>
          <Label className="text-xs">End</Label>
          <Input type="time" value={form.endTime?.slice(0, 5) || ''} onChange={e => setForm({ ...form, endTime: `${e.target.value}:00` })} className="mt-1 text-xs h-9" disabled={!!form.isAllDay} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Venue</Label>
          <Input value={form.venue || ''} onChange={e => setForm({ ...form, venue: e.target.value })} className="mt-1 text-xs" />
        </div>
        <div>
          <Label className="text-xs">Meeting Link</Label>
          <Input value={form.meetingLink || ''} onChange={e => setForm({ ...form, meetingLink: e.target.value })} className="mt-1 text-xs" placeholder="https://..." />
        </div>
      </div>

      <div>
        <Label className="text-xs">Max Participants</Label>
        <Input
          type="number" min={1}
          value={form.maxParticipants ?? ''}
          onChange={e => setForm({ ...form, maxParticipants: e.target.value ? Number(e.target.value) : undefined })}
          className="mt-1 text-xs"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-2">
          <Switch checked={!!form.isAllDay} onCheckedChange={v => setForm({ ...form, isAllDay: v })} />
          <Label className="text-xs">All Day</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={!!form.isAttendanceTracked} onCheckedChange={v => setForm({ ...form, isAttendanceTracked: v })} />
          <Label className="text-xs">Track Attendance</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={!!form.isMandatory} onCheckedChange={v => setForm({ ...form, isMandatory: v })} />
          <Label className="text-xs">Mandatory</Label>
        </div>
      </div>

      <div>
        <Label className="text-xs">Attendance Open To</Label>
        <Select value={form.attendanceOpenTo} onValueChange={(v) => setForm({ ...form, attendanceOpenTo: v as AttendanceOpenTo })}>
          <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ATTENDANCE_OPEN_TO.map(a => (
              <SelectItem key={a} value={a} className="text-xs">{a.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Target Scope</Label>
        <Select value={form.targetScope} onValueChange={(v) => setForm({ ...form, targetScope: v as TargetScope })}>
          <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TARGET_SCOPES.map(s => (
              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {form.targetScope === 'CLASS' && (
        <div>
          <Label className="text-xs">Target Class IDs (comma-separated)</Label>
          <Input
            value={targetClassCsv}
            onChange={e => { setTargetClassCsv(e.target.value); setForm({ ...form, targetClassIds: listFromCsv(e.target.value) }); }}
            className="mt-1 text-xs" placeholder="201, 202"
          />
        </div>
      )}

      {form.targetScope === 'SUBJECT' && (
        <div>
          <Label className="text-xs">Target Subject IDs (comma-separated)</Label>
          <Input
            value={targetSubjectCsv}
            onChange={e => { setTargetSubjectCsv(e.target.value); setForm({ ...form, targetSubjectIds: listFromCsv(e.target.value) }); }}
            className="mt-1 text-xs" placeholder="math-10, science-10"
          />
        </div>
      )}

      <div>
        <Label className="text-xs mb-2 block">Target User Types</Label>
        <div className="flex flex-wrap gap-3">
          {USER_TYPES.map(ut => (
            <div key={ut} className="flex items-center gap-1">
              <Checkbox checked={form.targetUserTypes?.includes(ut)} onCheckedChange={() => toggleUserType(ut)} />
              <span className="text-xs">{ut}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} className="mt-1 text-xs" rows={2} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none sm:w-48">
            <ResponsiveDatePicker value={filterDate} onChange={setFilterDate} placeholder="Filter by date" />
          </div>
          {filterDate && (
            <Button variant="ghost" size="sm" className="text-xs h-9" onClick={() => setFilterDate('')}>
              Clear
            </Button>
          )}
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Create Event
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No events found. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map(event => (
            <Card key={event.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{event.title}</span>
                      <Badge variant="outline" className="text-[10px]">{event.eventType.replace(/_/g, ' ')}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{event.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{event.eventDate}</span>
                      {event.startTime && <span>{event.startTime.slice(0, 5)}-{event.endTime?.slice(0, 5)}</span>}
                      {event.venue && <span>📍 {event.venue}</span>}
                    </div>
                    {event.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{event.description}</p>}
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {event.isAttendanceTracked && <Badge variant="outline" className="text-[10px]">Tracked</Badge>}
                      {event.isMandatory && <Badge variant="outline" className="text-[10px]">Mandatory</Badge>}
                      {event.targetScope && <Badge variant="outline" className="text-[10px]">{event.targetScope}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(event)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {!event.isDefault && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteTarget({ id: event.id, title: event.title })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[95vh] overflow-hidden">
          <DialogHeader><DialogTitle className="text-base">Create New Event</DialogTitle></DialogHeader>
          {renderForm(false)}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Event'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editEvent} onOpenChange={(open) => !open && setEditEvent(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[95vh] overflow-hidden">
          <DialogHeader><DialogTitle className="text-base">✏️ Edit Event</DialogTitle></DialogHeader>
          {renderForm(true)}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditEvent(null)}>Cancel</Button>
            <Button size="sm" onClick={handleUpdate} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemName={deleteTarget?.title || ''}
        itemType="event"
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default EventManagement;
