import { useState, useEffect, useCallback } from 'react';
import calendarApi from '@/api/calendar.api';
import { getSriLankaDate } from '@/utils/timezone';

export interface CalendarEventOption {
  id: string;
  title: string;
  eventType: string;
  isDefault: boolean;
  isAttendanceTracked: boolean;
  startTime?: string;
  endTime?: string;
  status?: string;
}

export interface TodayCalendarInfo {
  calendarDayId: string | null;
  defaultEventId: string | null;
  isAttendanceExpected: boolean;
  dayType: string;
  events: CalendarEventOption[];
  loading: boolean;
  error: string | null;
}

const DEFAULT_EVENT_ID = '__default__';

export { DEFAULT_EVENT_ID };

function parseCalendarResponse(data: any): Omit<TodayCalendarInfo, 'loading' | 'error'> {
  const events: CalendarEventOption[] = (data.events || []).map((e: any) => ({
    id: e.id,
    title: e.title || e.eventType,
    eventType: e.eventType,
    isDefault: !!e.isDefault,
    isAttendanceTracked: e.isAttendanceTracked !== false,
    startTime: e.startTime,
    endTime: e.endTime,
    status: e.status,
  }));

  return {
    calendarDayId: data.id || null,
    defaultEventId: data.defaultEventId || null,
    isAttendanceExpected: data.effectiveIsAttendanceExpected ?? data.isAttendanceExpected ?? true,
    dayType: data.effectiveDayType || data.dayType || '',
    events,
  };
}

/**
 * Fetch calendar events for today (or a specific date) using GET /institutes/:id/calendar/date/:date.
 * Automatically uses the current date if no date is provided.
 */
export function useTodayCalendarEvents(
  instituteId: string | null | undefined,
  classId?: string | null,
  date?: string | null
): TodayCalendarInfo & { updateFromResponse: (availableEvents?: any[]) => void; currentDate: string } {
  // Always compute today's date in Sri Lanka timezone (UTC+5:30) as YYYY-MM-DD
  const todayDate = date || getSriLankaDate();

  const [info, setInfo] = useState<TodayCalendarInfo>({
    calendarDayId: null,
    defaultEventId: null,
    isAttendanceExpected: true,
    dayType: '',
    events: [],
    loading: false,
    error: null,
  });

  // Helper to update events from attendance response's availableEvents
  const updateFromResponse = useCallback((availableEvents?: any[]) => {
    if (!availableEvents || availableEvents.length === 0) return;
    const merged = mergeAvailableEvents(info.events, availableEvents);
    setInfo(prev => ({ ...prev, events: merged }));
  }, [info.events]);

  useEffect(() => {
    if (!instituteId) return;

    let cancelled = false;
    setInfo(prev => ({ ...prev, loading: true, error: null }));

    const fetchData = async () => {
      try {
        // Always use date-specific endpoint for accurate event loading
        const res = await calendarApi.getByDate(instituteId, todayDate);

        if (cancelled) return;

        const data = (res as any)?.data;
        if (!data) {
          setInfo(prev => ({
            ...prev,
            loading: false,
            error: 'No calendar day found. Calendar may not be generated.',
          }));
          return;
        }

        const parsed = parseCalendarResponse(data);
        setInfo({ ...parsed, loading: false, error: null });
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to fetch calendar:', err);
        setInfo(prev => ({
          ...prev,
          loading: false,
          error: null, // Don't block attendance if calendar fails
        }));
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [instituteId, todayDate]);

  return { ...info, updateFromResponse, currentDate: todayDate };
}

/**
 * Update calendar info from availableEvents in an attendance response.
 * Returns merged CalendarEventOption[] suitable for the EventSelector.
 */
export function mergeAvailableEvents(
  currentEvents: CalendarEventOption[],
  availableEvents?: Array<{ id: string; eventType: string; title: string; isDefault: boolean; isAttendanceTracked: boolean; startTime?: string | null; endTime?: string | null }>
): CalendarEventOption[] {
  if (!availableEvents || availableEvents.length === 0) return currentEvents;
  return availableEvents.map(e => ({
    id: e.id,
    title: e.title || e.eventType,
    eventType: e.eventType,
    isDefault: e.isDefault,
    isAttendanceTracked: e.isAttendanceTracked,
    startTime: e.startTime || undefined,
    endTime: e.endTime || undefined,
  }));
}
