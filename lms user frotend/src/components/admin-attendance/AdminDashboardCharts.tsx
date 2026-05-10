import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi from '@/api/adminAttendance.api';
import { normalizeAttendanceSummary } from '@/types/attendance.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { RefreshCw, Activity } from 'lucide-react';

const CHART_COLORS = {
  present: 'hsl(var(--chart-1))',
  absent: 'hsl(var(--chart-2))',
  late: 'hsl(var(--chart-3))',
  left: 'hsl(var(--chart-4))',
};

const AdminDashboardCharts: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [todayStats, setTodayStats] = useState<{ present: number; absent: number; late: number; left: number; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCharts = useCallback(async () => {
    if (!currentInstituteId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get today's date in local timezone (not UTC)
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;
      
      // Load today's data
      const todayRes = await adminAttendanceApi.getInstituteAttendance(
        currentInstituteId,
        { startDate: today, endDate: today, limit: 1000 }
      );
      
      const todayRecords = todayRes?.data || [];
      const todaySummary = normalizeAttendanceSummary(todayRes?.summary);
      
      let stats: { present: number; absent: number; late: number; left: number; total: number };
      
      if (todayRecords.length > 0) {
        // Use individual records if available
        stats = {
          present: todayRecords.filter(r => r.status === 'present').length,
          absent: todayRecords.filter(r => r.status === 'absent').length,
          late: todayRecords.filter(r => r.status === 'late').length,
          left: todayRecords.filter(r => ['left', 'left_early', 'left_lately'].includes(r.status)).length,
          total: todayRecords.length,
        };
      } else if (todaySummary && (todaySummary.totalPresent > 0 || todaySummary.totalAbsent > 0 || todaySummary.totalLate > 0)) {
        // Fall back to summary data
        const left = (todaySummary.totalLeft || 0) + (todaySummary.totalLeftEarly || 0) + (todaySummary.totalLeftLately || 0);
        const total = (todaySummary.totalPresent || 0) + (todaySummary.totalAbsent || 0) + (todaySummary.totalLate || 0) + left;
        stats = { 
          present: todaySummary.totalPresent || 0, 
          absent: todaySummary.totalAbsent || 0, 
          late: todaySummary.totalLate || 0, 
          left, 
          total 
        };
      } else {
        // No data available
        stats = { present: 0, absent: 0, late: 0, left: 0, total: 0 };
      }
      
      setTodayStats(stats);
    } catch (e: any) {
      console.error('Failed to load analytics:', e);
      setError(e.message || 'Failed to load analytics');
      setTodayStats({ present: 0, absent: 0, late: 0, left: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId]);

  useEffect(() => { loadCharts(); }, [loadCharts]);

  const todayRate = todayStats && todayStats.total > 0
    ? Math.round((todayStats.present / todayStats.total) * 1000) / 10
    : 0;

  const pieData = todayStats ? [
    { name: 'Present', value: todayStats.present, color: CHART_COLORS.present },
    { name: 'Absent', value: todayStats.absent, color: CHART_COLORS.absent },
    { name: 'Late', value: todayStats.late, color: CHART_COLORS.late },
    { name: 'Left', value: todayStats.left, color: CHART_COLORS.left },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="w-full space-y-4">
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Today's Live Attendance
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadCharts} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <Button size="sm" variant="outline" onClick={loadCharts} className="mt-3">
                Retry
              </Button>
            </div>
          ) : todayStats && todayStats.total > 0 ? (
            <div className="flex flex-col items-center gap-8 w-full">
              {/* Pie Chart */}
              <div className="w-64 h-64 sm:w-72 sm:h-72">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      dataKey="value"
                      labelLine={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center -mt-[155px] sm:-mt-[165px]">
                  <div className="text-4xl font-bold text-foreground">{todayRate}%</div>
                  <div className="text-sm text-muted-foreground">Attendance</div>
                </div>
                <div className="h-[90px] sm:h-[100px]" />
              </div>

              {/* Stats - Full Width */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-center">
                  <div className="text-3xl font-bold text-emerald-600">{todayStats.present}</div>
                  <div className="text-sm text-muted-foreground mt-1">Present</div>
                </div>
                <div className="p-5 rounded-xl bg-red-50 dark:bg-red-900/20 text-center">
                  <div className="text-3xl font-bold text-red-500">{todayStats.absent}</div>
                  <div className="text-sm text-muted-foreground mt-1">Absent</div>
                </div>
                <div className="p-5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-center">
                  <div className="text-3xl font-bold text-amber-600">{todayStats.late}</div>
                  <div className="text-sm text-muted-foreground mt-1">Late</div>
                </div>
                <div className="p-5 rounded-xl bg-muted text-center">
                  <div className="text-3xl font-bold text-foreground">{todayStats.total}</div>
                  <div className="text-sm text-muted-foreground mt-1">Total Records</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 p-8 text-center">
              <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-foreground mb-1">No Attendance Data</h3>
              <p className="text-xs text-muted-foreground mb-4">
                No attendance records found for today. 
                {todayStats?.total === 0 && ' Attendance data will appear here once sessions are recorded.'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-lg bg-white dark:bg-slate-800/50">
                  <div className="text-2xl font-bold text-emerald-600">0</div>
                  <div className="text-xs text-muted-foreground mt-1">Present</div>
                </div>
                <div className="p-4 rounded-lg bg-white dark:bg-slate-800/50">
                  <div className="text-2xl font-bold text-red-500">0</div>
                  <div className="text-xs text-muted-foreground mt-1">Absent</div>
                </div>
                <div className="p-4 rounded-lg bg-white dark:bg-slate-800/50">
                  <div className="text-2xl font-bold text-amber-600">0</div>
                  <div className="text-xs text-muted-foreground mt-1">Late</div>
                </div>
                <div className="p-4 rounded-lg bg-white dark:bg-slate-800/50">
                  <div className="text-2xl font-bold text-foreground">0</div>
                  <div className="text-xs text-muted-foreground mt-1">Total</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboardCharts;
