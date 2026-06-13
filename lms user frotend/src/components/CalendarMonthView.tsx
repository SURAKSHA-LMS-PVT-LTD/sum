import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ChevronLeft, ChevronRight, Calendar, Loader2, Clock, MapPin,
  CalendarDays, Info
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import calendarApi from '@/api/calendar.api';
import type { CalendarDay, CalendarEvent, CalendarDayType, CalendarViewData, CalendarViewSummary } from '@/types/calendar.types';
import { DAY_TYPE_META } from '@/components/calendar/calendarTheme';

// Day type color configuration
const DAY_TYPE_COLORS: Record<CalendarDayType, { dot: string; bg: string; text: string; label: string }> = DAY_TYPE_META as Record<CalendarDayType, { dot: string; bg: string; text: string; label: string }>;

// Event type color configuration - full color pills shown on calendar
const EVENT_TYPE_COLORS: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  REGULAR_CLASS:   { bg: 'bg-emerald-500',  text: 'text-white', label: 'Regular Class',    dot: 'bg-emerald-500' },
  EXAM:            { bg: 'bg-purple-600',   text: 'text-white', label: 'Exam',             dot: 'bg-purple-600' },
  PARENTS_MEETING: { bg: 'bg-amber-500',   text: 'text-white', label: 'Parents Meeting',  dot: 'bg-amber-500' },
  PRIZE_GIVING:    { bg: 'bg-yellow-500',  text: 'text-white', label: 'Prize Giving',     dot: 'bg-yellow-500' },
  SPORTS_DAY:      { bg: 'bg-cyan-500',    text: 'text-white', label: 'Sports Day',       dot: 'bg-cyan-500' },
  CULTURAL_EVENT:  { bg: 'bg-pink-500',    text: 'text-white', label: 'Cultural Event',   dot: 'bg-pink-500' },
  FIELD_TRIP:      { bg: 'bg-teal-500',    text: 'text-white', label: 'Field Trip',       dot: 'bg-teal-500' },
  WORKSHOP:        { bg: 'bg-indigo-500',  text: 'text-white', label: 'Workshop',         dot: 'bg-indigo-500' },
  ORIENTATION:     { bg: 'bg-sky-500',     text: 'text-white', label: 'Orientation',      dot: 'bg-sky-500' },
  OPEN_DAY:        { bg: 'bg-lime-500',    text: 'text-white', label: 'Open Day',         dot: 'bg-lime-500' },
  RELIGIOUS_EVENT: { bg: 'bg-orange-500',  text: 'text-white', label: 'Religious Event',  dot: 'bg-orange-500' },
  EXTRACURRICULAR: { bg: 'bg-violet-500',  text: 'text-white', label: 'Extracurricular',  dot: 'bg-violet-500' },
  STAFF_MEETING:   { bg: 'bg-slate-500',   text: 'text-white', label: 'Staff Meeting',    dot: 'bg-slate-500' },
  TRAINING:        { bg: 'bg-blue-500',    text: 'text-white', label: 'Training',         dot: 'bg-blue-500' },
  GRADUATION:      { bg: 'bg-rose-500',    text: 'text-white', label: 'Graduation',       dot: 'bg-rose-500' },
  ADMISSION:       { bg: 'bg-fuchsia-500', text: 'text-white', label: 'Admission',        dot: 'bg-fuchsia-500' },
  MAINTENANCE:     { bg: 'bg-stone-500',   text: 'text-white', label: 'Maintenance',      dot: 'bg-stone-500' },
  CUSTOM:          { bg: 'bg-gray-500',    text: 'text-white', label: 'Custom',           dot: 'bg-gray-500' },
};

const getEventColor = (eventType: string) =>
  EVENT_TYPE_COLORS[eventType] || { bg: 'bg-primary', text: 'text-primary-foreground', label: eventType, dot: 'bg-primary' };

const formatTime = (time: string | undefined | null): string => {
  if (!time) return '';
  const parts = time.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${minutes} ${ampm}`;
};

type MonthStats = CalendarViewSummary;

const EMPTY_MONTH_STATS: MonthStats = {
  working: 0,
  holidays: 0,
  weekends: 0,
  exams: 0,
  special: 0,
};

const normalizeMonthSummary = (summary?: Partial<CalendarViewSummary> | null): Partial<MonthStats> => {
  if (!summary) return {};

  const normalize = (value: unknown): number | undefined => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return {
    working: normalize(summary.working),
    holidays: normalize(summary.holidays),
    weekends: normalize(summary.weekends),
    exams: normalize(summary.exams),
    special: normalize(summary.special),
  };
};

// Module-level cache — persists across component remounts for the session lifetime
interface MonthCacheEntry {
  days: Map<string, CalendarDay>;
  events: Map<string, CalendarEvent[]>;
  calendarViewUserType: string;
  apiMonthSummary: Partial<MonthStats> | null;
}
const _monthCache = new Map<string, MonthCacheEntry>();
const _monthCacheKey = (instituteId: string, year: number, month: number) =>
  `${instituteId}-${year}-${month}`;

const extractCalendarViewData = (
  payload: CalendarDay[] | CalendarViewData | null | undefined
): { days: CalendarDay[]; userType?: string; monthSummary: Partial<MonthStats> } => {
  if (!payload) return { days: [], monthSummary: {} };

  const source = payload as CalendarViewData;
  const rawDays = [
    Array.isArray(payload) ? payload : null,
    Array.isArray(source.days) ? source.days : null,
    Array.isArray(source.calendarDays) ? source.calendarDays : null,
    Array.isArray(source.items) ? source.items : null,
    Array.isArray((source as any)?.calendar?.days) ? (source as any).calendar.days : null,
    Array.isArray((source as any)?.calendarView?.days) ? (source as any).calendarView.days : null,
  ].find(Array.isArray) || [];

  const days = rawDays
    .map((raw: any) => {
      const calendarDate = raw?.calendarDate || raw?.date || raw?.eventDate;
      if (!calendarDate) return null;

      return {
        ...raw,
        id: raw?.id ? String(raw.id) : undefined,
        calendarDate,
        dayType: raw?.effectiveDayType || raw?.dayType || 'REGULAR',
        isAttendanceExpected: raw?.effectiveIsAttendanceExpected ?? raw?.isAttendanceExpected ?? true,
      } as CalendarDay;
    })
    .filter((day): day is CalendarDay => Boolean(day));

  const userType = [source.userType, source.attendanceUserType, source.role, (source as any).viewerType]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return {
    days,
    userType,
    monthSummary: normalizeMonthSummary(source.monthSummary),
  };
};

const CalendarMonthView = () => {
  const { currentInstituteId } = useAuth();
  const instituteRole = useInstituteRole();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1); // 1-indexed
  const [dayMap, setDayMap] = useState<Map<string, CalendarDay>>(new Map());
  const [eventsByDate, setEventsByDate] = useState<Map<string, CalendarEvent[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [showDayDetail, setShowDayDetail] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [calendarViewUserType, setCalendarViewUserType] = useState('');
  const [apiMonthSummary, setApiMonthSummary] = useState<Partial<MonthStats> | null>(null);

  const isTeacherOrStudentView = instituteRole === 'Teacher' || instituteRole === 'Student';

  const fetchMonthDays = useCallback(async () => {
    if (!currentInstituteId) return;

    const cacheKey = _monthCacheKey(currentInstituteId, year, month);
    const cached = _monthCache.get(cacheKey);
    if (cached) {
      setDayMap(cached.days);
      setEventsByDate(cached.events);
      setCalendarViewUserType(cached.calendarViewUserType);
      setApiMonthSummary(cached.apiMonthSummary);
      return;
    }

    setLoading(true);
    try {
      let days: CalendarDay[] = [];

      // Use the new month API endpoint
      const res = await calendarApi.getMonth(currentInstituteId, year, month);
      const data = (res as any)?.data;
      
      if (data?.days && Array.isArray(data.days)) {
        days = data.days;
      } else if (Array.isArray(res?.data)) {
        days = res.data as CalendarDay[];
      }

      let newCalendarViewUserType = '';
      let newApiMonthSummary: Partial<MonthStats> | null = null;

      // Fallback: if month API fails or returns empty, try calendar-view for teacher/student
      if (days.length === 0 && isTeacherOrStudentView) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const fallbackRes = await calendarApi.getCalendarView(currentInstituteId, {
          startDate, endDate, year, month,
        });
        const parsed = extractCalendarViewData((fallbackRes as any)?.data);
        days = parsed.days;
        newCalendarViewUserType = parsed.userType || (instituteRole === 'Teacher' ? 'TEACHER' : 'STUDENT');
        newApiMonthSummary = Object.keys(parsed.monthSummary).length ? parsed.monthSummary : null;
      }

      setCalendarViewUserType(newCalendarViewUserType);
      setApiMonthSummary(newApiMonthSummary);

      const map = new Map<string, CalendarDay>();
      for (const day of days) {
        if (day?.calendarDate) {
          map.set(day.calendarDate, day);
        }
      }
      setDayMap(map);

      // Fetch events and store both in cache together
      try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const evRes = await calendarApi.getEvents(currentInstituteId, { startDate, endDate, limit: 200 });
        const events: CalendarEvent[] = Array.isArray(evRes?.data) ? evRes.data : [];
        const evMap = new Map<string, CalendarEvent[]>();
        for (const event of events) {
          const date = event.eventDate || event.calendarDate;
          if (!date) continue;
          if (!evMap.has(date)) evMap.set(date, []);
          evMap.get(date)!.push(event);
        }
        setEventsByDate(evMap);
        _monthCache.set(cacheKey, { days: map, events: evMap, calendarViewUserType: newCalendarViewUserType, apiMonthSummary: newApiMonthSummary });
      } catch {
        setEventsByDate(new Map());
        _monthCache.set(cacheKey, { days: map, events: new Map(), calendarViewUserType: newCalendarViewUserType, apiMonthSummary: newApiMonthSummary });
      }
    } catch (error: any) {
      console.error('Failed to load calendar days:', error);
      setDayMap(new Map());
      setApiMonthSummary(null);
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, year, month, isTeacherOrStudentView, instituteRole]);

  useEffect(() => {
    fetchMonthDays();
  }, [fetchMonthDays]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (month === 1) { setMonth(12); setYear(y => y - 1); }
      else setMonth(m => m - 1);
    } else {
      if (month === 12) { setMonth(1); setYear(y => y + 1); }
      else setMonth(m => m + 1);
    }
  };

  // Build calendar grid
  const calendarCells = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells: (CalendarDay | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push(dayMap.get(dateStr) || ({ calendarDate: dateStr, dayType: 'REGULAR', isAttendanceExpected: true } as CalendarDay));
    }
    // Pad to fill last row
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [dayMap, year, month]);

  // Month summary stats
  const monthStats = useMemo<MonthStats>(() => {
    const calculated: MonthStats = { ...EMPTY_MONTH_STATS };

    dayMap.forEach(day => {
      if (day.dayType === 'WEEKEND') calculated.weekends++;
      else if (['PUBLIC_HOLIDAY', 'INSTITUTE_HOLIDAY'].includes(day.dayType)) calculated.holidays++;
      else if (day.dayType === 'EXAM_DAY') calculated.exams++;
      else if (day.isAttendanceExpected) calculated.working++;
    });

    // Also count days that have EXAM events (not already counted as EXAM_DAY)
    eventsByDate.forEach((events, date) => {
      const day = dayMap.get(date);
      if (day?.dayType !== 'EXAM_DAY' && events.some(e => e.eventType === 'EXAM')) {
        calculated.exams++;
      }
    });

    if (!apiMonthSummary) return calculated;

    return {
      working: apiMonthSummary.working ?? calculated.working,
      holidays: apiMonthSummary.holidays ?? calculated.holidays,
      weekends: apiMonthSummary.weekends ?? calculated.weekends,
      // Always use locally calculated exams — includes both EXAM_DAY days + EXAM-type events
      exams: calculated.exams,
      special: 0,
    };
  }, [dayMap, eventsByDate, apiMonthSummary]);

  const handleDayClick = async (day: CalendarDay) => {
    setSelectedDay(day);
    setShowDayDetail(true);
    setDayEvents([]);

    if (!currentInstituteId) return;

    const isHolidayDay = ['PUBLIC_HOLIDAY', 'INSTITUTE_HOLIDAY'].includes(day.dayType);
    const filterHolidayEvents = (events: CalendarEvent[]) =>
      isHolidayDay ? events.filter(e => e.eventType !== 'REGULAR_CLASS') : events;

    // Use pre-fetched events first for instant render
    const prefetched = eventsByDate.get(day.calendarDate) || [];
    const embedded = Array.isArray(day.events) ? day.events : [];
    const mergedIds = new Set(embedded.map(e => e.id));
    const merged = filterHolidayEvents([...embedded, ...prefetched.filter(e => !mergedIds.has(e.id))]);
    if (merged.length > 0) {
      setDayEvents(merged);
    }

    setLoadingEvents(true);
    try {
      if (day.id) {
        const res = await calendarApi.getDayEvents(currentInstituteId, day.id);
        const fresh = filterHolidayEvents(Array.isArray(res?.data) ? res.data : []);
        if (fresh.length > 0) { setDayEvents(fresh); return; }
      }

      const res = await calendarApi.getByDate(currentInstituteId, day.calendarDate);
      const detailDay = (res as any)?.data;

      if (detailDay) {
        setSelectedDay(prev => (prev ? { ...prev, ...detailDay } as CalendarDay : prev));
        const detailEvents = filterHolidayEvents(Array.isArray(detailDay.events) ? detailDay.events : []);
        if (detailEvents.length > 0) setDayEvents(detailEvents);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date().toISOString().split('T')[0];
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const resolvedViewType = useMemo(() => {
    const normalized = calendarViewUserType.toUpperCase();
    if (normalized.includes('TEACH')) return 'Teacher';
    if (normalized.includes('STUDENT')) return 'Student';
    if (instituteRole === 'Teacher') return 'Teacher';
    if (instituteRole === 'Student') return 'Student';
    return '';
  }, [calendarViewUserType, instituteRole]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {monthName}
              {resolvedViewType && (
                <Badge variant="secondary" className="text-[10px] sm:text-xs">
                  {resolvedViewType} Type
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setShowLegend(true)} className="text-xs h-8 gap-1.5">
                <Info className="h-3.5 w-3.5" />
                View Calender Day/Event Types
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigateMonth('next')}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {/* Week day headers */}
                {weekDays.map(d => (
                  <div key={d} className="bg-muted p-1.5 sm:p-2 text-center text-xs font-medium text-muted-foreground">
                    {d}
                  </div>
                ))}

                {/* Calendar cells */}
                {calendarCells.map((day, i) => {
                  if (!day) {
                    return <div key={`empty-${i}`} className="bg-card p-1.5 sm:p-2 min-h-[80px] sm:min-h-[100px]" />;
                  }

                  const dayNum = parseInt(day.calendarDate.split('-')[2]);
                  const isToday = day.calendarDate === today;
                  const config = DAY_TYPE_COLORS[day.dayType] || DAY_TYPE_COLORS.REGULAR;
                  const isSpecialDay = !['REGULAR'].includes(day.dayType);

                  // Merge events from pre-fetched map + embedded
                  const embeddedEvents = Array.isArray(day.events) ? day.events : [];
                  const fetchedEvents = eventsByDate.get(day.calendarDate) || [];
                  const eventIds = new Set(embeddedEvents.map(e => e.id));
                  const isHoliday = ['PUBLIC_HOLIDAY', 'INSTITUTE_HOLIDAY'].includes(day.dayType);
                  const mergedEvents = [...embeddedEvents, ...fetchedEvents.filter(e => !eventIds.has(e.id))]
                    .filter(e => !(isHoliday && e.eventType === 'REGULAR_CLASS'));
                  const hasEvents = mergedEvents.length > 0;

                  return (
                    <div
                      key={day.calendarDate}
                      className={`
                        bg-card p-1 sm:p-1.5 min-h-[80px] sm:min-h-[100px] flex flex-col
                        relative group
                        ${isSpecialDay ? `${config.bg}` : ''}
                        ${isToday ? 'ring-2 ring-primary ring-inset' : ''}
                      `}
                    >
                      {/* Date number row */}
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`
                          text-xs sm:text-sm font-bold leading-none flex items-center justify-center
                          ${isToday
                            ? 'bg-primary text-primary-foreground w-5 h-5 sm:w-6 sm:h-6 rounded-full'
                            : config.text}
                        `}>
                          {dayNum}
                        </span>

                      </div>

                      {/* Day type chip — shown for ALL non-regular days */}
                      {isSpecialDay && (
                        <div
                          className={`text-[8px] sm:text-[9px] font-semibold px-1 py-0.5 rounded leading-tight mb-0.5 ${config.bg} ${config.text} border border-current/20 truncate cursor-pointer`}
                          onClick={() => handleDayClick(day)}
                        >
                          {config.label}{day.title ? `: ${day.title}` : ''}
                        </div>
                      )}

                      {/* Day title for regular days */}
                      {!isSpecialDay && day.title && (
                        <p className="text-[8px] sm:text-[9px] leading-tight text-muted-foreground truncate mb-0.5 cursor-pointer" onClick={() => handleDayClick(day)}>
                          {day.title}
                        </p>
                      )}

                      {/* Colored event pills */}
                      <div className="flex flex-col gap-px flex-1 cursor-pointer" onClick={() => handleDayClick(day)}>
                        {mergedEvents.slice(0, 2).map((event, idx) => {
                          const ec = getEventColor(event.eventType);
                          return (
                            <div
                              key={event.id || idx}
                              className={`${ec.bg} ${ec.text} rounded-sm px-1 py-px text-[8px] sm:text-[9px] leading-tight font-medium flex items-center gap-0.5 min-w-0`}
                              title={`${event.title}${event.startTime ? ' · ' + formatTime(event.startTime) + (event.endTime ? ' – ' + formatTime(event.endTime) : '') : ''}`}
                            >
                              <span className="truncate">{event.title}</span>
                              {event.startTime && (
                                <span className="opacity-75 flex-shrink-0 hidden sm:inline">
                                  {formatTime(event.startTime)}{event.endTime ? ` – ${formatTime(event.endTime)}` : ''}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {mergedEvents.length > 2 && (
                          <div className="text-[8px] text-muted-foreground leading-tight pl-0.5 font-medium">
                            +{mergedEvents.length - 2} more
                          </div>
                        )}
                      </div>


                    </div>
                  );
                })}
              </div>

              {/* Month Summary */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="text-center p-2 rounded-lg bg-emerald-500/10">
                  <div className="text-lg font-bold text-emerald-600">{monthStats.working}</div>
                  <div className="text-[10px] text-muted-foreground">Working</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-500/10">
                  <div className="text-lg font-bold text-red-500">{monthStats.holidays}</div>
                  <div className="text-[10px] text-muted-foreground">Holidays</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-blue-500/10">
                  <div className="text-lg font-bold text-blue-500">{monthStats.weekends}</div>
                  <div className="text-[10px] text-muted-foreground">Weekends</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Legend Dialog */}
      <Dialog open={showLegend} onOpenChange={setShowLegend} routeName="calendar-legend-popup">
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Calender Day/Event Types
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Day Types */}
            <div>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Day Types</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(DAY_TYPE_COLORS)
                  .filter(([key]) => !['STAFF_ONLY', 'CANCELLED'].includes(key))
                  .map(([key, config]) => (
                    <div key={key} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${config.bg} border border-current/10`}>
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${config.dot}`} />
                      <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
                    </div>
                  ))}
              </div>
            </div>
            {/* Event Types */}
            <div>
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Event Types</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(EVENT_TYPE_COLORS).map(([key, config]) => (
                  <div key={key} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${config.bg}`}>
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0 bg-white/40" />
                    <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day Detail Dialog */}
      <Dialog open={showDayDetail} onOpenChange={setShowDayDetail} routeName="calendar-day-detail-popup">
        <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {selectedDay && new Date(selectedDay.calendarDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
              })}
            </DialogTitle>
          </DialogHeader>

          {selectedDay && (() => {
            const cfg = DAY_TYPE_COLORS[selectedDay.dayType];
            return (
              <div className="space-y-4">
                {/* Day Type Banner */}
                <div className={`rounded-lg px-4 py-3 ${cfg?.bg || 'bg-muted'} border border-current/10`}>
                  <div className={`text-base font-bold ${cfg?.text || ''}`}>
                    {cfg?.label || selectedDay.dayType.replace(/_/g, ' ')}
                  </div>
                  {selectedDay.title && (
                    <div className={`text-sm mt-0.5 ${cfg?.text || 'text-muted-foreground'} opacity-80`}>
                      {selectedDay.title}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant={selectedDay.isAttendanceExpected ? 'default' : 'secondary'} className="text-xs">
                      {selectedDay.isAttendanceExpected ? '✅ Attendance Expected' : '❌ No Attendance'}
                    </Badge>
                    {selectedDay.startTime && selectedDay.endTime && (
                      <Badge variant="outline" className="text-xs bg-white/30">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatTime(selectedDay.startTime)} — {formatTime(selectedDay.endTime)}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Events */}
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Events
                    {dayEvents.length > 0 && (
                      <Badge variant="secondary" className="text-xs">{dayEvents.length}</Badge>
                    )}
                  </h4>
                  {loadingEvents ? (
                    <div className="flex items-center gap-2 py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading events...</span>
                    </div>
                  ) : dayEvents.length > 0 ? (
                    <div className="space-y-3">
                      {dayEvents.map(event => {
                        const ec = getEventColor(event.eventType);
                        return (
                          <div key={event.id} className="rounded-xl border overflow-hidden shadow-sm">
                            {/* Colored header */}
                            <div className={`${ec.bg} px-4 py-2.5 flex items-center justify-between`}>
                              <div>
                                <span className={`font-semibold text-sm ${ec.text}`}>{event.title}</span>
                                <div className={`text-[10px] ${ec.text} opacity-80 mt-0.5`}>
                                  {ec.label}
                                </div>
                              </div>
                              <div className="flex gap-1.5 flex-wrap justify-end">
                                {event.isDefault && (
                                  <Badge className="text-[10px] px-1.5 py-0 h-5 bg-white/25 text-white border-white/30">Default</Badge>
                                )}
                                {event.isMandatory && (
                                  <Badge className="text-[10px] px-1.5 py-0 h-5 bg-white/25 text-white border-white/30">Mandatory</Badge>
                                )}
                              </div>
                            </div>
                            {/* Details */}
                            <div className="px-4 py-2.5 bg-card space-y-1.5">
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {event.startTime && event.endTime && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatTime(event.startTime)} — {formatTime(event.endTime)}
                                  </span>
                                )}
                                {event.venue && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> {event.venue}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1.5 flex-wrap">
                                <Badge variant="secondary" className="text-[10px]">{event.status}</Badge>
                                {event.targetScope && (
                                  <Badge variant="outline" className="text-[10px]">{event.targetScope}</Badge>
                                )}
                                {event.attendanceOpenTo && (
                                  <Badge variant="outline" className="text-[10px]">{event.attendanceOpenTo.replace(/_/g,' ')}</Badge>
                                )}
                              </div>
                              {event.description && (
                                <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>
                              )}
                              {event.meetingLink && (
                                <a
                                  href={event.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary underline underline-offset-2 break-all"
                                >
                                  {event.meetingLink}
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-sm text-muted-foreground bg-muted/30 rounded-lg">
                      No events for this day.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarMonthView;
