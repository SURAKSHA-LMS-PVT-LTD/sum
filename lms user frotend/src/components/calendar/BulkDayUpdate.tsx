import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import calendarApi from '@/api/calendar.api';
import type { CalendarDay, CalendarDayType } from '@/types/calendar.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Zap, AlertTriangle } from 'lucide-react';
import ResponsiveDatePicker from './ResponsiveDatePicker';

const DAY_TYPES: CalendarDayType[] = ['REGULAR', 'HALF_DAY', 'EXAM_DAY', 'STAFF_ONLY', 'SPECIAL_EVENT', 'CANCELLED', 'PUBLIC_HOLIDAY', 'INSTITUTE_HOLIDAY'];

const BulkDayUpdate: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [applyTo, setApplyTo] = useState('REGULAR');
  const [newDayType, setNewDayType] = useState<CalendarDayType>('CANCELLED');
  const [title, setTitle] = useState('');
  const [attendanceExpected, setAttendanceExpected] = useState(false);
  const [preview, setPreview] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [results, setResults] = useState<Array<{ date: string; success: boolean; error?: string }>>([]);

  const loadPreview = async () => {
    if (!currentInstituteId || !startDate || !endDate) { toast.error('Select a date range'); return; }
    if (new Date(startDate) > new Date(endDate)) { toast.error('Start date must be before end date'); return; }
    setLoading(true);
    try {
      const res = await calendarApi.getDays(currentInstituteId, { startDate, endDate, limit: 400 });
      let days = Array.isArray(res?.data) ? res.data : [];
      if (applyTo === 'REGULAR') days = days.filter(d => d.dayType === 'REGULAR');
      else if (applyTo === 'HALF_DAY') days = days.filter(d => d.dayType === 'HALF_DAY');
      else if (applyTo === 'WORKING') days = days.filter(d => d.isAttendanceExpected);
      setPreview(days);
    } catch { toast.error('Failed to load days'); } finally { setLoading(false); }
  };

  const handleBulkUpdate = async () => {
    if (!currentInstituteId || preview.length === 0) return;
    setUpdating(true);
    const updateResults: typeof results = [];
    for (const day of preview) {
      try {
        await calendarApi.updateDay(currentInstituteId, day.id, {
          dayType: newDayType,
          title: title || `${newDayType.replace(/_/g, ' ')}: ${day.calendarDate}`,
          isAttendanceExpected: attendanceExpected,
        });
        updateResults.push({ date: day.calendarDate, success: true });
      } catch (error: any) {
        updateResults.push({ date: day.calendarDate, success: false, error: error.message });
      }
    }
    setResults(updateResults);
    const successCount = updateResults.filter(r => r.success).length;
    toast.success(`Updated ${successCount}/${updateResults.length} days`);
    setUpdating(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Bulk Update Calendar Days
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <div className="mt-1">
                <ResponsiveDatePicker value={startDate} onChange={setStartDate} placeholder="Select start date" />
              </div>
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <div className="mt-1">
                <ResponsiveDatePicker value={endDate} onChange={setEndDate} placeholder="Select end date" />
              </div>
            </div>
          </div>

          {/* Apply To */}
          <div>
            <Label className="text-xs">Apply To</Label>
            <Select value={applyTo} onValueChange={setApplyTo}>
              <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All days in range</SelectItem>
                <SelectItem value="REGULAR" className="text-xs">Only REGULAR days</SelectItem>
                <SelectItem value="HALF_DAY" className="text-xs">Only HALF_DAY days</SelectItem>
                <SelectItem value="WORKING" className="text-xs">Only working days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* New Settings */}
          <div>
            <Label className="text-xs">New Day Type</Label>
            <Select value={newDayType} onValueChange={(v) => setNewDayType(v as CalendarDayType)}>
              <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAY_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Title (optional)</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 text-xs" placeholder="e.g. School closed — flooding" />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={attendanceExpected} onCheckedChange={setAttendanceExpected} />
            <Label className="text-xs">Attendance Expected</Label>
          </div>

          <Button variant="outline" size="sm" onClick={loadPreview} disabled={loading}>
            {loading ? 'Loading...' : 'Preview Changes'}
          </Button>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{preview.length} days will be updated:</p>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                {preview.map(day => (
                  <div key={day.id} className="text-xs flex items-center justify-between">
                    <span>{day.calendarDate} ({new Date(day.calendarDate).toLocaleDateString('en-US', { weekday: 'short' })})</span>
                    <span className="text-muted-foreground">{day.dayType} → {newDayType}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                <p className="text-xs text-yellow-700 dark:text-yellow-300">This will update {preview.length} days. This action is hard to undo.</p>
              </div>

              <Button size="sm" onClick={handleBulkUpdate} disabled={updating}>
                <Zap className="h-4 w-4 mr-1" /> {updating ? 'Updating...' : `Update ${preview.length} Days`}
              </Button>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="border rounded-lg p-2 max-h-32 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className={`text-xs ${r.success ? 'text-green-600' : 'text-red-500'}`}>
                  {r.date}: {r.success ? 'Updated' : `Failed: ${r.error}`}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkDayUpdate;
