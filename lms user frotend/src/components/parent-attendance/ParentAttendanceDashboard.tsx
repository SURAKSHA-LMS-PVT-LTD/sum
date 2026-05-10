import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { studentAttendanceApi, StudentAttendanceRecord } from '@/api/studentAttendance.api';
import adminAttendanceApi from '@/api/adminAttendance.api';
import calendarApi from '@/api/calendar.api';
import type { CalendarDay } from '@/types/calendar.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  PieChart, Pie, Cell, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { RefreshCw, Calendar, TrendingUp, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const CHART_COLORS = {
  present: 'hsl(var(--chart-1))',
  absent: 'hsl(var(--chart-2))',
  late: 'hsl(var(--chart-3))',
  left: 'hsl(var(--chart-4))',
};

function toSriLankaTime(utcStr: string): string {
  try {
    return new Date(utcStr).toLocaleString('en-LK', {
      timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return utcStr; }
}

const statusIcon = (s: string) => {
  switch (s) {
    case 'present': return '✅'; case 'absent': return '❌'; case 'late': return '⏰';
    case 'left': return '→'; default: return '⏳';
  }
};

const ParentAttendanceDashboard: React.FC = () => {
  const { user, selectedChild, currentInstituteId, selectedInstitute } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [todayRecord, setTodayRecord] = useState<any | null>(null);
  const [calendarDay, setCalendarDay] = useState<CalendarDay | null>(null);

  const childId = selectedChild?.id || selectedChild?.userId || '';
  const childName = selectedChild?.user?.nameWithInitials || selectedChild?.user?.firstName || 'Child';

  // Load attendance data
  const loadAttendance = useCallback(async () => {
    if (!currentInstituteId || !childId) return;
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 3);

      // Fetch student attendance
      const res = await adminAttendanceApi.getStudentAttendance(childId, {
        instituteId: currentInstituteId,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        limit: 500,
      });
      const data = res?.data || [];
      setRecords(data);

      // Today's attendance
      const today = end.toISOString().split('T')[0];
      const todayRec = data.find((r: any) => (r.date || r.markedAt?.split('T')[0]) === today);
      setTodayRecord(todayRec || null);

      // Get today's calendar info
      try {
        const calRes = await calendarApi.getToday(currentInstituteId);
        setCalendarDay(calRes?.data || null);
      } catch {}
    } catch (e: any) {
      toast.error(e.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, childId]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  // Stats
  const stats = useMemo(() => {
    const present = records.filter((r: any) => r.status === 'present').length;
    const absent = records.filter((r: any) => r.status === 'absent').length;
    const late = records.filter((r: any) => r.status === 'late').length;
    const left = records.filter((r: any) => ['left', 'left_early', 'left_lately'].includes(r.status)).length;
    const total = records.length;
    const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
    return { present, absent, late, left, total, rate };
  }, [records]);

  // Weekly view
  const thisWeek = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    
    const days = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const rec = records.find((r: any) => (r.date || r.markedAt?.split('T')[0]) === dateStr);
      days.push({
        date: dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
        status: rec?.status || null,
        markedAt: rec?.markedAt || null,
        isPast: d <= today,
        isToday: dateStr === today.toISOString().split('T')[0],
      });
    }
    return days;
  }, [records]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    const grouped = new Map<string, { present: number; total: number }>();
    for (const r of records) {
      const date = r.date || r.markedAt?.split('T')[0] || '';
      const monthKey = date.substring(0, 7);
      if (!grouped.has(monthKey)) grouped.set(monthKey, { present: 0, total: 0 });
      const g = grouped.get(monthKey)!;
      g.total++;
      if (r.status === 'present') g.present++;
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, g]) => ({
        month: new Date(key + '-01').toLocaleString('en-US', { month: 'short' }),
        rate: g.total > 0 ? Math.round((g.present / g.total) * 1000) / 10 : 0,
      }));
  }, [records]);

  // Subject radar
  const subjectData = useMemo(() => {
    const subjMap = new Map<string, { name: string; present: number; total: number }>();
    for (const r of records) {
      if (!r.subjectName && !r.subjectId) continue;
      const key = r.subjectId || r.subjectName;
      if (!subjMap.has(key)) subjMap.set(key, { name: r.subjectName || key, present: 0, total: 0 });
      const g = subjMap.get(key)!;
      g.total++;
      if (r.status === 'present') g.present++;
    }
    return Array.from(subjMap.values())
      .filter(s => s.total >= 3)
      .slice(0, 8)
      .map(s => ({
        subject: s.name.length > 10 ? s.name.substring(0, 10) + '…' : s.name,
        rate: s.total > 0 ? Math.round((s.present / s.total) * 1000) / 10 : 0,
      }));
  }, [records]);

  // Pie data
  const pieData = [
    { name: 'Present', value: stats.present, color: CHART_COLORS.present },
    { name: 'Absent', value: stats.absent, color: CHART_COLORS.absent },
    { name: 'Late', value: stats.late, color: CHART_COLORS.late },
    { name: 'Left', value: stats.left, color: CHART_COLORS.left },
  ].filter(d => d.value > 0);

  if (!selectedChild) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <User className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Please select a child to view attendance</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Child Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                👨‍👩‍👧 Parent Dashboard
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                👦 {childName} — {selectedInstitute?.name || 'Institute'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadAttendance} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Overall Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="text-center p-3 bg-primary/10 rounded-lg">
              <div className="text-2xl font-bold text-primary">{stats.rate}%</div>
              <div className="text-xs text-muted-foreground">Attendance Rate</div>
            </div>
            <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="text-xl font-bold text-emerald-600">{stats.present}</div>
              <div className="text-xs text-muted-foreground">Present</div>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-xl font-bold text-red-500">{stats.absent}</div>
              <div className="text-xs text-muted-foreground">Absent</div>
            </div>
            <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="text-xl font-bold text-amber-600">{stats.late}</div>
              <div className="text-xs text-muted-foreground">Late</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {!loading && (
        <>
          {/* Today's Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                📅 Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                {calendarDay && <Badge variant="outline" className="ml-2 text-xs">{calendarDay.dayType.replace(/_/g, ' ')}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayRecord ? (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <span className="text-2xl">{statusIcon(todayRecord.status)}</span>
                  <div>
                    <div className="text-sm font-medium capitalize">{todayRecord.status}</div>
                    <div className="text-xs text-muted-foreground">
                      Marked at {todayRecord.markedAt ? toSriLankaTime(todayRecord.markedAt) : '—'}
                      {todayRecord.markingMethod && ` • ${todayRecord.markingMethod}`}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <span className="text-2xl">⏳</span>
                  <div>
                    <div className="text-sm font-medium">Not marked yet</div>
                    <div className="text-xs text-muted-foreground">Attendance has not been recorded today</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* This Week */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">📅 This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {thisWeek.map(day => (
                  <div
                    key={day.date}
                    className={`text-center p-2 rounded-lg border transition-colors ${
                      day.isToday ? 'border-primary bg-primary/5 ring-1 ring-primary/30' :
                      day.status === 'present' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' :
                      day.status === 'absent' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
                      day.status === 'late' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
                      'bg-muted/30 border-transparent'
                    }`}
                  >
                    <div className="text-xs font-semibold text-muted-foreground">{day.dayName}</div>
                    <div className="text-sm font-bold">{day.dayNum}</div>
                    <div className="text-lg">{day.status ? statusIcon(day.status) : (day.isPast ? '—' : '⏳')}</div>
                    {day.markedAt && (
                      <div className="text-[10px] text-muted-foreground">{toSriLankaTime(day.markedAt)}</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Donut */}
            {pieData.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Status Breakdown (3 Months)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="w-40 h-40">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value">
                            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {pieData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                          <span>{d.name}: {d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Monthly Trend */}
            {monthlyTrend.length > 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Monthly Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <ReferenceLine y={85} stroke="hsl(var(--chart-3))" strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Subject Radar */}
          {subjectData.length >= 3 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Subject-wise Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={subjectData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar dataKey="rate" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Recent Records */}
          {records.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Recent Attendance Records</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs text-center">Status</TableHead>
                        <TableHead className="text-xs">Subject</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.slice(0, 20).map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">
                            {new Date(r.date || r.markedAt?.split('T')[0] || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                          </TableCell>
                          <TableCell className="text-xs text-center">{statusIcon(r.status)} {r.status}</TableCell>
                          <TableCell className="text-xs">{r.subjectName || r.className || '—'}</TableCell>
                          <TableCell className="text-xs">{r.markedAt ? toSriLankaTime(r.markedAt) : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ParentAttendanceDashboard;
