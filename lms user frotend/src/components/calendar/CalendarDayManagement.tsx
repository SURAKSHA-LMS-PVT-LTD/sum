import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import calendarApi from '@/api/calendar.api';
import type { CalendarDay, CalendarDayType, UpdateCalendarDayPayload } from '@/types/calendar.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Edit3, Trash2 } from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';

const DAY_TYPES: CalendarDayType[] = [
  'REGULAR',
  'HALF_DAY',
  'EXAM_DAY',
  'STAFF_ONLY',
  'SPECIAL_EVENT',
  'CANCELLED',
  'PUBLIC_HOLIDAY',
  'INSTITUTE_HOLIDAY',
];

const DAY_TYPE_EMOJI: Record<string, string> = {
  REGULAR: '🟢',
  HALF_DAY: '🟡',
  EXAM_DAY: '🟠',
  STAFF_ONLY: '🟣',
  SPECIAL_EVENT: '🩷',
  CANCELLED: '🔴',
  PUBLIC_HOLIDAY: '🔴',
  INSTITUTE_HOLIDAY: '🔴',
  WEEKEND: '🔵',
};

const CalendarDayManagement: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDay, setEditDay] = useState<CalendarDay | null>(null);
  const [editForm, setEditForm] = useState<UpdateCalendarDayPayload>({});
  const [saving, setSaving] = useState(false);
  const [deleteDay, setDeleteDay] = useState<CalendarDay | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dayTypeFilter, setDayTypeFilter] = useState<string>('ALL');
  const [attendanceFilter, setAttendanceFilter] = useState<string>('ALL');

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  useEffect(() => {
    if (currentInstituteId) {
      loadDays();
      return;
    }
    setLoading(false);
    setDays([]);
  }, [currentInstituteId, year, month, dayTypeFilter, attendanceFilter]);

  const loadDays = async () => {
    if (!currentInstituteId) return;
    setLoading(true);
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

    try {
      const params: Record<string, string | number> = { startDate, endDate, limit: 50 };
      if (dayTypeFilter !== 'ALL') params.dayType = dayTypeFilter;

      const res = await calendarApi.getDays(currentInstituteId, params);
      let list = Array.isArray(res?.data) ? res.data : [];

      if (attendanceFilter === 'EXPECTED') list = list.filter(d => d.isAttendanceExpected);
      if (attendanceFilter === 'NOT_EXPECTED') list = list.filter(d => !d.isAttendanceExpected);

      setDays(list);
    } catch {
      setDays([]);
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const calendarGrid = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    const dayMap = new Map<string, CalendarDay>();
    days.forEach(d => dayMap.set(d.calendarDate, d));

    const grid: Array<{ date: number; dateStr: string; day?: CalendarDay } | null> = [];

    for (let i = 0; i < offset; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      grid.push({ date: d, dateStr, day: dayMap.get(dateStr) });
    }

    return grid;
  }, [days, year, month]);

  const openEdit = (day: CalendarDay) => {
    setEditDay(day);
    setEditForm({
      dayType: day.dayType,
      title: day.title || '',
      description: day.description || '',
      startTime: day.startTime || '',
      endTime: day.endTime || '',
      isAttendanceExpected: day.isAttendanceExpected,
    });
  };

  const handleSaveEdit = async () => {
    if (!currentInstituteId || !editDay) return;

    if (editForm.startTime && editForm.endTime && editForm.startTime >= editForm.endTime) {
      toast.error('End time must be after start time');
      return;
    }

    setSaving(true);
    try {
      await calendarApi.updateDay(currentInstituteId, editDay.id, editForm);
      toast.success('Day updated successfully');
      setEditDay(null);
      await loadDays();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to update day'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDay = async () => {
    if (!currentInstituteId || !deleteDay) return;
    setDeleting(true);
    try {
      await calendarApi.deleteDay(currentInstituteId, deleteDay.id);
      toast.success('Calendar day deleted');
      setDeleteDay(null);
      setEditDay(null);
      await loadDays();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to delete day'));
    } finally {
      setDeleting(false);
    }
  };

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-base">{monthName}</CardTitle>
            <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Day Type</Label>
              <Select value={dayTypeFilter} onValueChange={setDayTypeFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All Types</SelectItem>
                  {[...DAY_TYPES, 'WEEKEND'].map(type => (
                    <SelectItem key={type} value={type} className="text-xs">
                      {type.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Attendance</Label>
              <Select value={attendanceFilter} onValueChange={setAttendanceFilter}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">All</SelectItem>
                  <SelectItem value="EXPECTED" className="text-xs">Attendance Expected</SelectItem>
                  <SelectItem value="NOT_EXPECTED" className="text-xs">Attendance Not Expected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(DAY_TYPE_EMOJI).map(([type, emoji]) => (
              <span key={type} className="text-[10px] text-muted-foreground">
                {emoji} {type.replace(/_/g, ' ')}
              </span>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
              ))}
              {calendarGrid.map((cell, i) => (
                <div
                  key={i}
                  className={`min-h-[50px] p-1 rounded border text-center text-xs ${cell ? (cell.day ? 'cursor-pointer hover:border-primary' : 'border-dashed border-muted') : 'border-transparent'
                    }`}
                  onClick={() => cell?.day && openEdit(cell.day)}
                >
                  {cell && (
                    <>
                      <div className="font-medium">{cell.date}</div>
                      {cell.day && (
                        <div className="mt-0.5">
                          <span className="text-[10px]">{DAY_TYPE_EMOJI[cell.day.dayType] || '⚪'}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editDay} onOpenChange={(open) => !open && setEditDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              Edit Calendar Day
            </DialogTitle>
          </DialogHeader>
          {editDay && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">
                  {new Date(editDay.calendarDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                <Badge variant="outline" className="text-xs">{editDay.dayType.replace(/_/g, ' ')}</Badge>
              </div>

              <div>
                <Label className="text-xs">Day Type</Label>
                <Select value={editForm.dayType} onValueChange={(v) => setEditForm({ ...editForm, dayType: v as CalendarDayType })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAY_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="text-xs">
                        {DAY_TYPE_EMOJI[t]} {t.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Title</Label>
                <Input value={editForm.title || ''} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="mt-1 text-xs" />
              </div>

              <div>
                <Label className="text-xs">Description</Label>
                <Input value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="mt-1 text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Start Time</Label>
                  <Input type="time" value={editForm.startTime?.slice(0, 5) || ''} onChange={e => setEditForm({ ...editForm, startTime: `${e.target.value}:00` })} className="mt-1 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">End Time</Label>
                  <Input type="time" value={editForm.endTime?.slice(0, 5) || ''} onChange={e => setEditForm({ ...editForm, endTime: `${e.target.value}:00` })} className="mt-1 text-xs" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={editForm.isAttendanceExpected ?? true} onCheckedChange={(v) => setEditForm({ ...editForm, isAttendanceExpected: v })} />
                <Label className="text-xs">Attendance Expected</Label>
              </div>

              <p className="text-[10px] text-muted-foreground">Changing day type impacts attendance reporting for this date.</p>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
            <Button variant="destructive" size="sm" onClick={() => editDay && setDeleteDay(editDay)} className="sm:mr-auto">
              <Trash2 className="h-4 w-4 mr-1" /> Delete Day
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditDay(null)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteDay}
        onOpenChange={(open) => !open && setDeleteDay(null)}
        itemName={deleteDay?.calendarDate || ''}
        itemType="calendar day"
        bullets={[
          'This removes the day record — use only when you need to regenerate or correct bad data',
          'This action is irreversible',
        ]}
        onConfirm={handleDeleteDay}
        isDeleting={deleting}
      />
    </div>
  );
};

export default CalendarDayManagement;
