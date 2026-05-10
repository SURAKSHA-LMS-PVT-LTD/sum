import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import calendarApi from '@/api/calendar.api';
import type { CalendarDay, CalendarEvent } from '@/types/calendar.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, Clock, MapPin, Users, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

const ClassCalendarPage: React.FC = () => {
  const { selectedInstitute, selectedClass, currentInstituteId } = useAuth();
  const navigate = useNavigate();
  const [todayData, setTodayData] = useState<CalendarDay | null>(null);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().split('T')[0];
  });

  const classId = selectedClass?.id?.toString();

  useEffect(() => {
    if (currentInstituteId && classId) loadData();
  }, [currentInstituteId, classId, startDate, endDate]);

  const loadData = async () => {
    if (!currentInstituteId || !classId) return;
    setLoading(true);
    try {
      const [todayRes, daysRes, eventsRes] = await Promise.allSettled([
        calendarApi.getClassToday(currentInstituteId, classId),
        calendarApi.getClassDays(currentInstituteId, classId, { startDate, endDate, limit: 400 }),
        calendarApi.getClassEvents(currentInstituteId, classId, { startDate, endDate, limit: 100 }),
      ]);

      if (todayRes.status === 'fulfilled') setTodayData(todayRes.value?.data || null);
      if (daysRes.status === 'fulfilled') setDays(Array.isArray(daysRes.value?.data) ? daysRes.value.data : []);
      if (eventsRes.status === 'fulfilled') setEvents(Array.isArray(eventsRes.value?.data) ? eventsRes.value.data : []);
    } catch (error: any) {
      console.error('Failed to load class calendar:', error);
      toast.error('Failed to load class calendar');
    } finally {
      setLoading(false);
    }
  };

  if (!currentInstituteId || !classId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground mb-3" />
          <h3 className="text-base font-semibold mb-1">No Class Selected</h3>
          <p className="text-sm text-muted-foreground">Select an institute and class to view the class calendar.</p>
        </CardContent>
      </Card>
    );
  }

  const workingDays = days.filter(d => d.effectiveIsAttendanceExpected ?? d.isAttendanceExpected);
  const holidays = days.filter(d => ['PUBLIC_HOLIDAY', 'INSTITUTE_HOLIDAY'].includes(d.effectiveDayType || d.dayType));
  const nonDefaultEvents = events.filter(e => !e.isDefault);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Class Calendar</h1>
          <p className="text-xs text-muted-foreground">
            {selectedInstitute?.name} — {selectedClass?.name}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Today */}
      {todayData && (
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${DAY_TYPE_COLORS[todayData.effectiveDayType || todayData.dayType] || 'bg-gray-400'}`} />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  Today — {new Date(todayData.calendarDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(todayData.effectiveDayType || todayData.dayType).replace(/_/g, ' ')}
                  {todayData.startTime && ` • ${todayData.startTime} - ${todayData.endTime}`}
                </p>
              </div>
              <Badge variant={todayData.effectiveIsAttendanceExpected ?? todayData.isAttendanceExpected ? 'default' : 'secondary'}>
                {(todayData.effectiveIsAttendanceExpected ?? todayData.isAttendanceExpected) ? 'Attendance Expected' : 'No Attendance'}
              </Badge>
            </div>
            {todayData.classOverride && (
              <Badge variant="outline" className="mt-2 text-xs">
                Class Override: {todayData.classOverride.classDayType?.replace(/_/g, ' ')}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Date Range Filter */}
      <div className="flex items-center gap-3">
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs h-8 w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs h-8 w-40" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{days.length}</div>
            <div className="text-xs text-muted-foreground">Total Days</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{workingDays.length}</div>
            <div className="text-xs text-muted-foreground">Working Days</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-500">{holidays.length}</div>
            <div className="text-xs text-muted-foreground">Holidays</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-500">{nonDefaultEvents.length}</div>
            <div className="text-xs text-muted-foreground">Special Events</div>
          </CardContent>
        </Card>
      </div>

      {/* Events List */}
      {nonDefaultEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nonDefaultEvents.map(event => (
              <div key={event.id} className="flex items-start gap-3 p-2 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium">{event.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(event.eventDate).toLocaleDateString()}</span>
                    {event.startTime && (
                      <>
                        <Clock className="h-3 w-3 ml-1" />
                        <span>{event.startTime?.slice(0, 5)} - {event.endTime?.slice(0, 5)}</span>
                      </>
                    )}
                    {event.venue && (
                      <>
                        <MapPin className="h-3 w-3 ml-1" />
                        <span>{event.venue}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Badge variant="outline" className="text-xs">{event.eventType.replace(/_/g, ' ')}</Badge>
                  <Badge variant={event.status === 'CANCELLED' ? 'destructive' : 'secondary'} className="text-xs">
                    {event.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Calendar Days List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Calendar Days ({days.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {days.map(day => {
                const effectiveType = day.effectiveDayType || day.dayType;
                return (
                  <div key={day.id} className="flex items-center gap-2 p-1.5 hover:bg-muted/50 rounded text-xs">
                    <div className={`w-2 h-2 rounded-full ${DAY_TYPE_COLORS[effectiveType] || 'bg-gray-400'}`} />
                    <span className="w-24 text-muted-foreground">
                      {new Date(day.calendarDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <Badge variant="outline" className="text-xs py-0">
                      {effectiveType.replace(/_/g, ' ')}
                    </Badge>
                    {day.title && <span className="text-muted-foreground">{day.title}</span>}
                    {day.classOverride && (
                      <Badge variant="secondary" className="text-xs py-0">Override</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClassCalendarPage;
