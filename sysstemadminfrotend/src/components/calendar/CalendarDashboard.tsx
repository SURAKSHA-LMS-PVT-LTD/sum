import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Settings, Clock, CheckCircle } from "lucide-react";

interface Props {
  instituteId: string;
}

export function CalendarDashboard({ instituteId }: Props) {
  const [today, setToday] = useState<any>(null);
  const [config, setConfig] = useState<any[]>([]);
  const [dayStats, setDayStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [instituteId]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [todayRes, configRes, daysRes] = await Promise.allSettled([
        api.getCalendarToday(instituteId),
        api.getOperatingConfig(instituteId),
        api.getCalendarDays(instituteId, { academicYear: new Date().getFullYear().toString(), limit: 400 }),
      ]);

      if (todayRes.status === "fulfilled") setToday(todayRes.value?.data);
      if (configRes.status === "fulfilled") setConfig(configRes.value?.data || []);
      if (daysRes.status === "fulfilled") {
        const days = daysRes.value?.data || [];
        setDayStats({
          total: daysRes.value?.total || days.length,
          working: days.filter((d: any) => d.isAttendanceExpected).length,
          holidays: days.filter((d: any) => ["PUBLIC_HOLIDAY", "INSTITUTE_HOLIDAY"].includes(d.dayType)).length,
          weekends: days.filter((d: any) => d.dayType === "WEEKEND").length,
          cancelled: days.filter((d: any) => d.dayType === "CANCELLED").length,
        });
      }
    } catch {
      // partial data is fine
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Loading dashboard...</div>;
  }

  const configuredDays = config.filter((c: any) => c.isOperating);
  const dayTypeColor: Record<string, string> = {
    REGULAR: "bg-success text-success-foreground",
    HALF_DAY: "bg-warning text-warning-foreground",
    CANCELLED: "bg-destructive text-destructive-foreground",
    PUBLIC_HOLIDAY: "bg-destructive text-destructive-foreground",
    WEEKEND: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Days</p>
                <p className="text-2xl font-bold text-foreground">{dayStats?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Working Days</p>
                <p className="text-2xl font-bold text-foreground">{dayStats?.working || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <CalendarDays className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Holidays</p>
                <p className="text-2xl font-bold text-foreground">{dayStats?.holidays || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Weekends</p>
                <p className="text-2xl font-bold text-foreground">{dayStats?.weekends || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Today</CardTitle>
        </CardHeader>
        <CardContent>
          {today ? (
            <div className="flex items-center gap-4">
              <p className="text-foreground font-medium">
                {new Date(today.calendarDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              <Badge className={dayTypeColor[today.dayType] || ""}>{today.dayType}</Badge>
              {today.title && <span className="text-muted-foreground">— {today.title}</span>}
            </div>
          ) : (
            <p className="text-muted-foreground">No calendar data for today. Generate a calendar first.</p>
          )}
        </CardContent>
      </Card>

      {/* Operating config summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="w-5 h-5" /> Operating Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {config.length > 0 ? (
            <div className="grid grid-cols-7 gap-2">
              {config.map((c: any) => (
                <div key={c.dayOfWeek} className={`rounded-lg p-3 text-center ${c.isOperating ? "bg-success/10 border border-success/20" : "bg-muted"}`}>
                  <p className="text-sm font-medium text-foreground">{c.dayName || ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][c.dayOfWeek]}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {c.isOperating ? `${c.startTime}-${c.endTime}` : "Off"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No operating schedule configured yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
