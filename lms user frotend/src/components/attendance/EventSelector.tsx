import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Loader2 } from 'lucide-react';
import { CalendarEventOption, DEFAULT_EVENT_ID } from '@/hooks/useTodayCalendarEvents';

interface EventSelectorProps {
  events: CalendarEventOption[];
  selectedEventId: string;
  onEventChange: (eventId: string) => void;
  loading?: boolean;
  disabled?: boolean;
  dayType?: string;
  isAttendanceExpected?: boolean;
  compact?: boolean;
}

const EventSelector: React.FC<EventSelectorProps> = ({
  events,
  selectedEventId,
  onEventChange,
  loading,
  disabled,
  dayType,
  isAttendanceExpected,
  compact,
}) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {!compact && <Label className="text-sm font-medium text-foreground">Event</Label>}
        <div className="flex items-center gap-2 text-xs text-muted-foreground h-10 px-3 border rounded-md">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading events...
        </div>
      </div>
    );
  }

  const trackedEvents = events.filter(e => e.isAttendanceTracked);

  return (
    <div className="space-y-2">
      {!compact && (
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium text-foreground">Event</Label>
          {dayType && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {dayType}
            </Badge>
          )}
          {isAttendanceExpected === false && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              No Attendance Expected
            </Badge>
          )}
        </div>
      )}
      <Select
        value={selectedEventId}
        onValueChange={onEventChange}
        disabled={disabled || trackedEvents.length === 0}
      >
        <SelectTrigger className={compact ? "h-10 text-xs" : "h-12 text-base border-2 border-input"}>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder="Regular Class (default)" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_EVENT_ID} className="text-sm">
            <div className="flex items-center gap-2">
              <span>Regular Class</span>
              <span className="text-xs text-muted-foreground">(auto-linked)</span>
            </div>
          </SelectItem>
          {trackedEvents.filter(e => !e.isDefault).map(event => (
            <SelectItem key={event.id} value={event.id} className="text-sm">
              <div className="flex items-center gap-2">
                <span>{event.title}</span>
                {event.startTime && (
                  <span className="text-xs text-muted-foreground">
                    {event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default EventSelector;
