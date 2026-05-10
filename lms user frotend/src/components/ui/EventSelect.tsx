import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, Loader2 } from 'lucide-react';
import calendarApi from '@/api/calendar.api';
import type { CalendarEvent, CalendarDay } from '@/types/calendar.types';
import { getSriLankaDate } from '@/utils/timezone';

interface EventSelectProps {
  instituteId: string;
  /** Selected date in YYYY-MM-DD format (defaults to today) */
  date?: string;
  onDateChange?: (date: string) => void;
  /** Selected event ID */
  value: string;
  onChange: (eventId: string, calendarDayId: string, event: CalendarEvent | null) => void;
  label?: string;
  showDatePicker?: boolean;
  disabled?: boolean;
  className?: string;
}

const todayStr = () => getSriLankaDate();

/**
 * Combined date-picker + event dropdown for a given institute.
 * Calls GET /institutes/:instituteId/calendar/date/:date → auto-selects default event.
 */
const EventSelect: React.FC<EventSelectProps> = ({
  instituteId,
  date: externalDate,
  onDateChange,
  value,
  onChange,
  label = 'Event',
  showDatePicker = true,
  disabled = false,
  className,
}) => {
  const [internalDate, setInternalDate] = useState(externalDate ?? todayStr());
  const date = externalDate ?? internalDate;
  const [dayData, setDayData] = useState<CalendarDay | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!instituteId || !date) { setDayData(null); return; }
    setLoading(true);
    calendarApi.getByDate(instituteId, date)
      .then((res: any) => {
        const day: CalendarDay = res?.data ?? res;
        setDayData(day);
        // Auto-select default event
        const defaultId = day?.defaultEventId ?? day?.events?.find((e: any) => e.isDefault)?.id;
        if (defaultId && !value) {
          onChange(defaultId, day.id, day.events?.find((e: any) => e.id === defaultId) ?? null);
        }
      })
      .catch(() => setDayData(null))
      .finally(() => setLoading(false));
  }, [instituteId, date]);

  const events = dayData?.events ?? [];

  const handleDateChange = (d: string) => {
    setInternalDate(d);
    onDateChange?.(d);
    // clear event selection when date changes
    onChange('', '', null);
  };

  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      {showDatePicker && (
        <div className="space-y-1">
          <Label className="text-sm font-medium">Date</Label>
          <Input
            type="date"
            value={date}
            onChange={e => handleDateChange(e.target.value)}
            disabled={disabled}
            className="text-sm"
          />
        </div>
      )}
      <div className="space-y-1">
        {label && <Label className="text-sm font-medium">{label}</Label>}
        {loading ? (
          <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading events…
          </div>
        ) : (
          <Select
            value={value}
            onValueChange={id => {
              const ev = events.find((e: any) => e.id === id) ?? null;
              onChange(id, dayData?.id ?? '', ev);
            }}
            disabled={disabled || events.length === 0}
          >
            <SelectTrigger>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder={events.length === 0 ? (date ? 'No events on this date' : 'Pick a date first') : 'Select event…'} />
              </div>
            </SelectTrigger>
            <SelectContent>
              {events.map((e: any) => (
                <SelectItem key={e.id} value={e.id}>
                  <span>{e.title ?? e.eventName}</span>
                  {e.isDefault && <span className="text-xs text-muted-foreground ml-1">(default)</span>}
                  {e.startTime && (
                    <span className="text-xs text-muted-foreground ml-1">
                      {e.startTime}{e.endTime ? ` – ${e.endTime}` : ''}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
};

export default EventSelect;
