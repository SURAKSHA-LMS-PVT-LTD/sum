import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi from '@/api/adminAttendance.api';
import calendarApi from '@/api/calendar.api';
import type { CalendarDay } from '@/types/calendar.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getDayTypeMeta } from '@/components/calendar/calendarTheme';

interface CalendarDayWithAttendance extends CalendarDay {
  attendanceCount: number;
  presentCount: number;
  attendanceRate: number | null;
}

const CalendarAttendanceOverlay: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [days, setDays] = useState<CalendarDayWithAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<CalendarDayWithAttendance | null>(null);

  const loadMonth = useCallback(async () => {
    if (!currentInstituteId) return;
    setLoading(true);
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

      // Fetch calendar days and a SINGLE attendance API call for the whole month range
      const [calendarRes, attendanceRes] = await Promise.allSettled([
        calendarApi.getDays(currentInstituteId, { startDate, endDate, limit: 400 }),
        adminAttendanceApi.getInstituteAttendance(
          currentInstituteId,
          { startDate, endDate, limit: 500 },
          { ttl: 120 }
        ),
      ]);

      const calDays = calendarRes.status === 'fulfilled' ? (calendarRes.value?.data || []) : [];
      const attData = attendanceRes.status === 'fulfilled' ? attendanceRes.value : null;
      const allRecords = attData?.data || [];
      const apiSummary = attData?.summary;

      // Group records by date
      const recordsByDate = new Map<string, typeof allRecords>();
      for (const record of allRecords) {
        const dateKey = record.date || record.markedAt?.split('T')[0];
        if (dateKey) {
          if (!recordsByDate.has(dateKey)) recordsByDate.set(dateKey, []);
          recordsByDate.get(dateKey)!.push(record);
        }
      }

      const overlay: CalendarDayWithAttendance[] = calDays.map(day => {
        const dayRecords = recordsByDate.get(day.calendarDate) || [];
        
        let present = 0, total = 0;
        
        if (dayRecords.length > 0) {
          present = dayRecords.filter(r => r.status === 'present').length;
          total = dayRecords.length;
        }
        
        return {
          ...day,
          attendanceCount: total,
          presentCount: present,
          attendanceRate: total > 0 ? Math.round((present / total) * 100) : null,
        };
      });

      setDays(overlay);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load calendar overlay');
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, year, month]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  const shiftMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  const monthLabel = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Build grid
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayMap = new Map(days.map(d => [d.calendarDate, d]));

  const getRateColor = (rate: number | null) => {
    if (rate === null) return '';
    if (rate >= 90) return 'bg-emerald-100 dark:bg-emerald-900/30';
    if (rate >= 80) return 'bg-yellow-100 dark:bg-yellow-900/30';
    if (rate >= 70) return 'bg-orange-100 dark:bg-orange-900/30';
    return 'bg-red-100 dark:bg-red-900/30';
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // Adjust first day to Monday-based (0=Mon)
  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Calendar + Attendance — {monthLabel}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)} disabled={loading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={loadMonth} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => shiftMonth(1)} disabled={loading}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <>
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Headers */}
                {weekDays.map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
                ))}
                {/* Empty cells */}
                {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const day = dayMap.get(dateStr);
                  const isToday = dateStr === new Date().toISOString().split('T')[0];

                  return (
                    <div
                      key={dayNum}
                      className={`
                        p-1 rounded-md text-center cursor-pointer border transition-colors min-h-[60px] flex flex-col items-center justify-center gap-0.5
                        ${isToday ? 'border-primary ring-1 ring-primary/30' : 'border-transparent hover:border-border'}
                        ${day ? getRateColor(day.attendanceRate) : 'bg-muted/30'}
                      `}
                      onClick={() => day && setSelectedDay(day)}
                    >
                      <span className="text-xs font-medium">{dayNum}</span>
                      {day && (
                        <>
                          <span className={`w-2 h-2 rounded-full ${getDayTypeMeta(day.dayType).dot}`} />
                          {day.attendanceRate !== null && (
                            <span className="text-[10px] font-semibold">{day.attendanceRate}%</span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/30 border" /> ≥90%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/30 border" /> 80-89%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-orange-100 dark:bg-orange-900/30 border" /> 70-79%
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 border" /> &lt;70%
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Selected Day Detail */}
      {selectedDay && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                {new Date(selectedDay.calendarDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>✕</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2 bg-muted rounded">
                <div className="text-xs text-muted-foreground">Type</div>
                <div className="text-sm font-medium flex items-center justify-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${getDayTypeMeta(selectedDay.dayType).dot}`} /> {getDayTypeMeta(selectedDay.dayType).label}</div>
              </div>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded">
                <div className="text-xs text-muted-foreground">Present</div>
                <div className="text-lg font-bold text-emerald-600">{selectedDay.presentCount}</div>
              </div>
              <div className="p-2 bg-muted rounded">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-lg font-bold">{selectedDay.attendanceCount}</div>
              </div>
              <div className="p-2 bg-primary/10 rounded">
                <div className="text-xs text-muted-foreground">Rate</div>
                <div className="text-lg font-bold text-primary">{selectedDay.attendanceRate ?? '—'}%</div>
              </div>
            </div>
            {selectedDay.title && <p className="text-xs text-muted-foreground mt-2">{selectedDay.title}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CalendarAttendanceOverlay;
