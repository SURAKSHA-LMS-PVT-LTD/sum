import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi from '@/api/adminAttendance.api';
import type { DailySummaryResult } from '@/api/adminAttendance.api';
import calendarApi from '@/api/calendar.api';
import type { CalendarDay } from '@/types/calendar.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { ChevronLeft, ChevronRight, RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { getDayTypeMeta } from '@/components/calendar/calendarTheme';

interface AdminDayOverview {
  date: string;
  dayType: string;
  isAttendanceExpected: boolean;
  present: number;
  absent: number;
  late: number;
  left: number;
  total: number;
  rate: number;
}

const AdminAttendanceOverview: React.FC = () => {
  const { currentInstituteId, selectedInstitute } = useAuth();
  const [weekData, setWeekData] = useState<AdminDayOverview[]>([]);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    return d.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);

  const getWeekEnd = (start: string) => {
    const d = new Date(start);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
  };

  const loadWeekData = useCallback(async () => {
    if (!currentInstituteId) return;
    setLoading(true);
    try {
      const endDate = getWeekEnd(weekStart);
      const [calendarRes, dailySummaries] = await Promise.allSettled([
        calendarApi.getDays(currentInstituteId, { startDate: weekStart, endDate, limit: 10 }),
        adminAttendanceApi.getInstituteDailySummaries(currentInstituteId, weekStart, endDate, { ttl: 10 }),
      ]);

      const calDays: CalendarDay[] = calendarRes.status === 'fulfilled' ? (calendarRes.value?.data || []) : [];
      const dailyResults: DailySummaryResult[] = dailySummaries.status === 'fulfilled' ? (dailySummaries.value || []) : [];

      // Build overview for each day of the week
      const overview: AdminDayOverview[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const calDay = calDays.find(c => c.calendarDate === dateStr);
        const dayResult = dailyResults.find(r => r.date === dateStr);
        
        // Use summary data from API (works even when data[] is empty)
        const summary = dayResult?.summary;
        const records = dayResult?.records || [];
        
        let present: number, absent: number, late: number, left: number, total: number, rate: number;
        
        if (records.length > 0) {
          // If we have individual records, count from them
          present = records.filter(r => r.status === 'present').length;
          absent = records.filter(r => r.status === 'absent').length;
          late = records.filter(r => r.status === 'late').length;
          left = records.filter(r => ['left', 'left_early', 'left_lately'].includes(r.status)).length;
          total = records.length;
          rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
        } else if (summary && (summary.totalPresent > 0 || summary.totalAbsent > 0 || summary.totalLate > 0)) {
          // Fall back to summary data from API
          present = summary.totalPresent;
          absent = summary.totalAbsent;
          late = summary.totalLate;
          left = summary.totalLeft + summary.totalLeftEarly + summary.totalLeftLately;
          total = present + absent + late + left;
          rate = summary.attendanceRate;
        } else {
          present = 0; absent = 0; late = 0; left = 0; total = 0; rate = 0;
        }

        overview.push({
          date: dateStr,
          dayType: calDay?.dayType || (d.getDay() === 0 || d.getDay() === 6 ? 'WEEKEND' : 'REGULAR'),
          isAttendanceExpected: calDay?.isAttendanceExpected ?? (d.getDay() !== 0 && d.getDay() !== 6),
          present, absent, late, left, total, rate,
        });
      }

      setWeekData(overview);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load attendance overview');
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, weekStart]);

  useEffect(() => { loadWeekData(); }, [loadWeekData]);

  const shiftWeek = (dir: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dir * 7);
    setWeekStart(d.toISOString().split('T')[0]);
  };

  const workingDays = weekData.filter(d => d.isAttendanceExpected && d.total > 0);
  const weekAvg = workingDays.length > 0
    ? Math.round(workingDays.reduce((s, d) => s + d.rate, 0) / workingDays.length * 10) / 10
    : 0;
  const bestDay = workingDays.length > 0 ? workingDays.reduce((a, b) => a.rate > b.rate ? a : b) : null;
  const worstDay = workingDays.length > 0 ? workingDays.reduce((a, b) => a.rate < b.rate ? a : b) : null;

  const chartData = weekData.filter(d => d.isAttendanceExpected).map(d => ({
    name: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
    Present: d.present,
    Absent: d.absent,
    Late: d.late,
    Left: d.left,
  }));

  const weekLabel = (() => {
    const s = new Date(weekStart);
    return `Week of ${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  })();

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Institute Attendance — {weekLabel}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)} disabled={loading}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={loadWeekData} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => shiftWeek(1)} disabled={loading}>
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
              {/* Weekly Table */}
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs text-center">Present</TableHead>
                      <TableHead className="text-xs text-center">Absent</TableHead>
                      <TableHead className="text-xs text-center">Late</TableHead>
                      <TableHead className="text-xs text-center">Left</TableHead>
                      <TableHead className="text-xs text-center">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weekData.map(d => (
                      <TableRow key={d.date} className={!d.isAttendanceExpected ? 'opacity-50' : ''}>
                        <TableCell className="text-xs font-medium">
                          {new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${getDayTypeMeta(d.dayType).dot}`} />
                            {getDayTypeMeta(d.dayType).label}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-center font-medium text-emerald-600">
                          {d.isAttendanceExpected ? d.present : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-center font-medium text-red-500">
                          {d.isAttendanceExpected ? d.absent : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-center font-medium text-amber-500">
                          {d.isAttendanceExpected ? d.late : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-center font-medium text-purple-500">
                          {d.isAttendanceExpected ? d.left : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {d.isAttendanceExpected && d.total > 0 ? (
                            <Badge variant={d.rate >= 85 ? 'default' : d.rate >= 75 ? 'secondary' : 'destructive'} className="text-xs">
                              {d.rate}%
                            </Badge>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Week Stats */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-lg font-bold text-foreground">{weekAvg}%</div>
                  <div className="text-xs text-muted-foreground">Week Average</div>
                </div>
                {bestDay && (
                  <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <div className="text-lg font-bold text-emerald-600">{bestDay.rate}%</div>
                    <div className="text-xs text-muted-foreground">
                      Best: {new Date(bestDay.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                  </div>
                )}
                {worstDay && (
                  <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-lg font-bold text-red-500">{worstDay.rate}%</div>
                    <div className="text-xs text-muted-foreground">
                      Worst: {new Date(worstDay.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Stacked Bar Chart */}
      {!loading && chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Daily Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Present" stackId="a" fill="hsl(var(--chart-1))" />
                <Bar dataKey="Absent" stackId="a" fill="hsl(var(--chart-2))" />
                <Bar dataKey="Late" stackId="a" fill="hsl(var(--chart-3))" />
                <Bar dataKey="Left" stackId="a" fill="hsl(var(--chart-4))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminAttendanceOverview;
