import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Calendar, Clock, BookOpen, QrCode, ClipboardList, Search,
  UserCheck, UserX, Users, AlertTriangle, Loader2, ChevronRight,
  MapPin, Star, Video, Award, Briefcase, Music, Bus, Wrench, GraduationCap,
  CalendarDays, Smartphone
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import calendarApi from '@/api/calendar.api';
import type { CalendarDay, CalendarEvent, CalendarDayType, CalendarEventType } from '@/types/calendar.types';
import { useNavigate } from 'react-router-dom';
import { buildSidebarUrl } from '@/utils/pageNavigation';

// Day type configuration with colors and icons
const DAY_TYPE_CONFIG: Record<CalendarDayType, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  REGULAR: { label: 'Regular Day', color: 'text-emerald-600', bgColor: 'bg-emerald-500/10 border-emerald-500/20', icon: <BookOpen className="h-4 w-4" /> },
  WEEKEND: { label: 'Weekend', color: 'text-blue-600', bgColor: 'bg-blue-500/10 border-blue-500/20', icon: <Calendar className="h-4 w-4" /> },
  PUBLIC_HOLIDAY: { label: 'Public Holiday', color: 'text-red-600', bgColor: 'bg-red-500/10 border-red-500/20', icon: <Calendar className="h-4 w-4" /> },
  INSTITUTE_HOLIDAY: { label: 'Institute Holiday', color: 'text-orange-600', bgColor: 'bg-orange-500/10 border-orange-500/20', icon: <GraduationCap className="h-4 w-4" /> },
  HALF_DAY: { label: 'Half Day', color: 'text-amber-600', bgColor: 'bg-amber-500/10 border-amber-500/20', icon: <Clock className="h-4 w-4" /> },
  EXAM_DAY: { label: 'Exam Day', color: 'text-purple-600', bgColor: 'bg-purple-500/10 border-purple-500/20', icon: <Award className="h-4 w-4" /> },
  STAFF_ONLY: { label: 'Staff Only', color: 'text-slate-600', bgColor: 'bg-slate-500/10 border-slate-500/20', icon: <Briefcase className="h-4 w-4" /> },
  SPECIAL_EVENT: { label: 'Special Event', color: 'text-cyan-600', bgColor: 'bg-cyan-500/10 border-cyan-500/20', icon: <Star className="h-4 w-4" /> },
  CANCELLED: { label: 'Cancelled', color: 'text-slate-500', bgColor: 'bg-slate-500/10 border-slate-500/20', icon: <AlertTriangle className="h-4 w-4" /> },
};

// Event type icons
const getEventIcon = (type: CalendarEventType | string): React.ReactNode => {
  const iconMap: Record<string, React.ReactNode> = {
    REGULAR_CLASS: <BookOpen className="h-4 w-4" />,
    EXAM: <Award className="h-4 w-4" />,
    PARENTS_MEETING: <Users className="h-4 w-4" />,
    SPORTS_DAY: <Star className="h-4 w-4" />,
    CULTURAL_EVENT: <Music className="h-4 w-4" />,
    FIELD_TRIP: <Bus className="h-4 w-4" />,
    WORKSHOP: <Wrench className="h-4 w-4" />,
    ORIENTATION: <GraduationCap className="h-4 w-4" />,
    STAFF_MEETING: <Briefcase className="h-4 w-4" />,
    TRAINING: <BookOpen className="h-4 w-4" />,
    CUSTOM: <CalendarDays className="h-4 w-4" />,
  };
  return iconMap[type] || <CalendarDays className="h-4 w-4" />;
};

const formatTime = (time: string | undefined | null): string => {
  if (!time) return '';
  const parts = time.split(':');
  const hours = parseInt(parts[0]);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${minutes} ${ampm}`;
};

const TodayDashboard = () => {
  const { currentInstituteId, selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const userRole = useInstituteRole();
  const navigate = useNavigate();

  const [todayData, setTodayData] = useState<(CalendarDay & { events?: CalendarEvent[]; defaultEventId?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [noCalendar, setNoCalendar] = useState(false);

  const canMarkAttendance = ['InstituteAdmin', 'Teacher', 'AttendanceMarker'].includes(userRole);

  useEffect(() => {
    if (currentInstituteId) {
      fetchToday();
    }
  }, [currentInstituteId]);

  const fetchToday = async () => {
    if (!currentInstituteId) return;
    setLoading(true);
    try {
      const res = await calendarApi.getToday(currentInstituteId);
      if (res?.data) {
        setTodayData(res.data as any);
        setNoCalendar(false);
      } else {
        setNoCalendar(true);
      }
    } catch (err) {
      console.warn('No calendar data for today:', err);
      setNoCalendar(true);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (page: string) => {
    const context = {
      instituteId: selectedInstitute?.id,
      classId: selectedClass?.id,
      subjectId: selectedSubject?.id,
    };
    const url = buildSidebarUrl(page, context);
    navigate(url);
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading today's info...</span>
        </CardContent>
      </Card>
    );
  }

  if (noCalendar) {
    return (
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="py-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">No Calendar Data</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No calendar has been generated for this institute yet.
                {userRole === 'InstituteAdmin' && ' Go to Calendar Management to generate one.'}
              </p>
              {userRole === 'InstituteAdmin' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => handleNavigate('calendar-management')}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Calendar Management
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const dayConfig = todayData ? DAY_TYPE_CONFIG[todayData.dayType] || DAY_TYPE_CONFIG.REGULAR : DAY_TYPE_CONFIG.REGULAR;
  const events = (todayData as any)?.events || [];
  const defaultEvent = events.find((e: CalendarEvent) => e.isDefault);
  const todayDate = todayData?.calendarDate 
    ? new Date(todayData.calendarDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Today's Info Card */}
      <Card className="border-border/50 overflow-hidden">
        <div className={`h-1.5 w-full ${dayConfig.color.replace('text-', 'bg-').replace('-600', '-500')}`} />
        <CardHeader className="pb-3 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${dayConfig.bgColor}`}>
                <Calendar className={`h-5 w-5 ${dayConfig.color}`} />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl">Today</CardTitle>
                <p className="text-sm text-muted-foreground">{todayDate}</p>
              </div>
            </div>
            <Badge className={`${dayConfig.bgColor} ${dayConfig.color} border gap-1.5 self-start sm:self-auto`}>
              {dayConfig.icon}
              {dayConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Day Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {todayData?.startTime && todayData?.endTime && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">
                  {formatTime(todayData.startTime)} — {formatTime(todayData.endTime)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <UserCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">
                Attendance: {todayData?.isAttendanceExpected ? '✅ Expected' : '❌ Not Expected'}
              </span>
            </div>
          </div>

          {todayData?.title && (
            <p className="text-sm font-medium text-foreground">{todayData.title}</p>
          )}
          {todayData?.description && (
            <p className="text-sm text-muted-foreground">{todayData.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Today's Events */}
      {events.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Today's Events
              <Badge variant="secondary" className="ml-auto">{events.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.map((event: CalendarEvent) => (
              <div
                key={event.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  event.isDefault ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border/50'
                }`}
              >
                <div className={`p-2 rounded-lg ${event.isDefault ? 'bg-primary/10' : 'bg-muted'}`}>
                  {getEventIcon(event.eventType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{event.title}</span>
                    {event.isDefault && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary border-primary/20">
                        ⭐ Default
                      </Badge>
                    )}
                    {event.isMandatory && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                        Mandatory
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {event.startTime && event.endTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(event.startTime)} — {formatTime(event.endTime)}
                      </span>
                    )}
                    {event.isAllDay && <span>All Day</span>}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {event.status}
                    </Badge>
                    {event.venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.venue}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      {todayData?.isAttendanceExpected && canMarkAttendance && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="h-auto py-3 flex flex-col gap-1.5 text-xs"
                onClick={() => handleNavigate('qr-attendance')}
              >
                <QrCode className="h-5 w-5 text-primary" />
                Scan QR
              </Button>
              <Button
                variant="outline"
                className="h-auto py-3 flex flex-col gap-1.5 text-xs"
                onClick={() => handleNavigate('daily-attendance')}
              >
                <ClipboardList className="h-5 w-5 text-primary" />
                Daily Attendance
              </Button>
              <Button
                variant="outline"
                className="h-auto py-3 flex flex-col gap-1.5 text-xs"
                onClick={() => handleNavigate('rfid-attendance')}
              >
                <Smartphone className="h-5 w-5 text-primary" />
                RFID/NFC
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TodayDashboard;
