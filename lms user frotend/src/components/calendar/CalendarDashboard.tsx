import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import calendarApi from '@/api/calendar.api';
import type { CalendarDay, OperatingConfig } from '@/types/calendar.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Settings, PlusCircle, BarChart3, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface CalendarDashboardProps {
  onNavigate: (tab: string) => void;
}

const DAY_TYPE_COLORS: Record<string, string> = {
  REGULAR: 'bg-green-500',
  HALF_DAY: 'bg-yellow-500',
  EXAM_DAY: 'bg-orange-500',
  STAFF_ONLY: 'bg-purple-500',
  SPECIAL_EVENT: 'bg-pink-500',
  CANCELLED: 'bg-red-500',
  PUBLIC_HOLIDAY: 'bg-red-400',
  INSTITUTE_HOLIDAY: 'bg-red-300',
  WEEKEND: 'bg-blue-400',
};

interface DashboardCache {
  todayData: CalendarDay | null;
  operatingConfig: OperatingConfig[];
  dayStats: Record<string, number>;
  calendarGenerated: boolean;
}
const _dashboardCache = new Map<string, DashboardCache>(); // keyed by `${instituteId}-${year}`

const CalendarDashboard: React.FC<CalendarDashboardProps> = ({ onNavigate }) => {
  const { currentInstituteId } = useAuth();
  const [todayData, setTodayData] = useState<CalendarDay | null>(null);
  const [operatingConfig, setOperatingConfig] = useState<OperatingConfig[]>([]);
  const [dayStats, setDayStats] = useState<Record<string, number>>({});
  const [calendarGenerated, setCalendarGenerated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentInstituteId) return;
    const year = new Date().getFullYear().toString();
    const cacheKey = `${currentInstituteId}-${year}`;
    const cached = _dashboardCache.get(cacheKey);
    if (cached) {
      setTodayData(cached.todayData);
      setOperatingConfig(cached.operatingConfig);
      setDayStats(cached.dayStats);
      setCalendarGenerated(cached.calendarGenerated);
      setLoading(false);
      return;
    }
    loadDashboard();
  }, [currentInstituteId]);

  const loadDashboard = async () => {
    if (!currentInstituteId) return;
    setLoading(true);
    try {
      const [todayRes, configRes, daysRes] = await Promise.allSettled([
        calendarApi.getToday(currentInstituteId),
        calendarApi.getOperatingConfig(currentInstituteId),
        calendarApi.getDays(currentInstituteId, { academicYear: new Date().getFullYear().toString(), limit: 400 }),
      ]);

      if (todayRes.status === 'fulfilled') setTodayData(todayRes.value?.data || null);
      if (configRes.status === 'fulfilled') setOperatingConfig(configRes.value?.data || []);
      if (daysRes.status === 'fulfilled') {
        const days = daysRes.value?.data || [];
        const isArray = Array.isArray(days);
        const dayList = isArray ? days : [];
        setCalendarGenerated(dayList.length > 0);
        
        const stats: Record<string, number> = {
          total: dayList.length,
          working: dayList.filter((d: CalendarDay) => d.isAttendanceExpected).length,
          holidays: dayList.filter((d: CalendarDay) => ['PUBLIC_HOLIDAY', 'INSTITUTE_HOLIDAY'].includes(d.dayType)).length,
          weekends: dayList.filter((d: CalendarDay) => d.dayType === 'WEEKEND').length,
          examDays: dayList.filter((d: CalendarDay) => d.dayType === 'EXAM_DAY').length,
          halfDays: dayList.filter((d: CalendarDay) => d.dayType === 'HALF_DAY').length,
          cancelled: dayList.filter((d: CalendarDay) => d.dayType === 'CANCELLED').length,
        };
        setDayStats(stats);

        // Store in module-level cache
        const year = new Date().getFullYear().toString();
        _dashboardCache.set(`${currentInstituteId}-${year}`, {
          todayData: todayRes.status === 'fulfilled' ? todayRes.value?.data || null : null,
          operatingConfig: configRes.status === 'fulfilled' ? configRes.value?.data || [] : [],
          dayStats: stats,
          calendarGenerated: dayList.length > 0,
        });
      }
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const operatingDays = operatingConfig.filter(c => c.isOperating);
  const operatingSummary = operatingDays.length > 0
    ? `${operatingDays.map(d => d.dayName?.slice(0, 3)).join(', ')}: ${operatingDays[0]?.startTime || '08:00'}-${operatingDays[0]?.endTime || '15:00'}`
    : 'Not configured';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calendar Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Calendar Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Academic Year {new Date().getFullYear()}</span>
            {calendarGenerated ? (
              <Badge className="bg-green-500 text-white">GENERATED</Badge>
            ) : (
              <Badge variant="destructive">NOT GENERATED</Badge>
            )}
          </div>
          {calendarGenerated && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-foreground">{dayStats.total || 0}</div>
                <div className="text-xs text-muted-foreground">Total Days</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{dayStats.working || 0}</div>
                <div className="text-xs text-muted-foreground">Working Days</div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-500">{dayStats.holidays || 0}</div>
                <div className="text-xs text-muted-foreground">Holidays</div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-500">{dayStats.weekends || 0}</div>
                <div className="text-xs text-muted-foreground">Weekends</div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">Operating Schedule</span>
            {operatingConfig.length > 0 ? (
              <Badge className="bg-green-500 text-white text-xs">{operatingSummary}</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Not configured</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Today */}
      {todayData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${DAY_TYPE_COLORS[todayData.dayType] || 'bg-gray-400'}`} />
              <span className="font-medium">
                {new Date(todayData.calendarDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              <Badge variant="outline" className="text-xs">{todayData.dayType.replace(/_/g, ' ')}</Badge>
            </div>
            {todayData.title && <p className="text-sm text-muted-foreground mt-2">{todayData.title}</p>}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => onNavigate('calendar')}>
              <Calendar className="h-5 w-5 text-primary" />
              <span className="text-xs">View Calendar</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => onNavigate('config')}>
              <Settings className="h-5 w-5 text-primary" />
              <span className="text-xs">Operating Config</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => onNavigate('generate')}>
              <PlusCircle className="h-5 w-5 text-primary" />
              <span className="text-xs">Generate Calendar</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => onNavigate('events')}>
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="text-xs">Events</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => onNavigate('bulk')}>
              <Zap className="h-5 w-5 text-primary" />
              <span className="text-xs">Bulk Update</span>
            </Button>
            <Button variant="outline" className="h-auto py-3 flex flex-col gap-1" onClick={() => onNavigate('cache')}>
              <RefreshCw className="h-5 w-5 text-primary" />
              <span className="text-xs">Cache</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CalendarDashboard;
