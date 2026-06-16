import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader, StatsCard } from "@/components/shared/PageComponents";
import { BarChart3, Users, UserCheck, UserX, Clock, Search, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClassOption {
  id: string;
  className: string;
  grade?: number;
}

interface EventOption {
  id: string;
  title?: string;
  name?: string;
  eventDate?: string;
  date?: string;
}

interface DailyCount {
  date: string;
  day?: number;
  present: number;
  absent: number;
  late: number;
  left?: number;
  leftEarly?: number;
  leftLate?: number;
  total?: number;
}

interface MonthlySummary {
  present: number;
  absent: number;
  late: number;
  left?: number;
  leftEarly?: number;
  leftLate?: number;
  total?: number;
  uniqueStudents?: number;
  totalClasses?: number;
}

type ViewMode = "daily" | "monthly";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function AttendanceReportingPage() {
  const { toast } = useToast();

  const [selectedInstituteId, setSelectedInstituteId] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [loading, setLoading] = useState(false);

  const [dailyData, setDailyData] = useState<DailyCount[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);

  useEffect(() => {
    if (selectedInstituteId) {
      fetchClasses();
    } else {
      setClasses([]);
      setSelectedClassId("");
    }
  }, [selectedInstituteId]);

  useEffect(() => {
    if (selectedInstituteId) {
      fetchEvents();
    } else {
      setEvents([]);
      setSelectedEventId("");
    }
  }, [selectedInstituteId, year, month]);

  useEffect(() => {
    if (selectedInstituteId) {
      fetchData();
    }
  }, [selectedInstituteId, selectedClassId, selectedEventId, year, month, viewMode]);

  const fetchClasses = async () => {
    try {
      const response = await api.getInstituteClassesByInstitute(selectedInstituteId);
      setClasses(response.classes || response.data || response || []);
    } catch {
      setClasses([]);
    }
  };

  const fetchEvents = async () => {
    try {
      const lastDay = new Date(year, month, 0).getDate();
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const response = await api.listCalendarEvents(selectedInstituteId, { startDate, endDate, limit: 200 });
      const list = response.data || response.events || response || [];
      setEvents(Array.isArray(list) ? list : []);
      setSelectedEventId("");
    } catch {
      setEvents([]);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const effectiveClassId = selectedClassId && selectedClassId !== "all" ? selectedClassId : "";
      const eventId = selectedEventId && selectedEventId !== "all" ? selectedEventId : undefined;
      if (viewMode === "daily") {
        const fn = effectiveClassId
          ? api.getAttendanceClassDailyCount(selectedInstituteId, effectiveClassId, { year, month, eventId })
          : api.getAttendanceDailyCount(selectedInstituteId, { year, month, eventId });
        const response = await fn;
        const items = response.days || response.data || response.dailyCounts || [];
        setDailyData(
          Array.isArray(items)
            ? items.map((d: any, idx: number) => ({
                date: d.date || `${year}-${String(month).padStart(2, "0")}-${String(d.day || idx + 1).padStart(2, "0")}`,
                day: d.day || idx + 1,
                present: d.present || 0,
                absent: d.absent || 0,
                late: d.late || 0,
                left: d.left || 0,
                leftEarly: d.leftEarly || 0,
                leftLate: d.leftLate || 0,
                total: (d.present || 0) + (d.absent || 0) + (d.late || 0),
              }))
            : []
        );
        setMonthlySummary(null);
      } else {
        const fn = effectiveClassId
          ? api.getAttendanceClassMonthlyCount(selectedInstituteId, effectiveClassId, { year, month, eventId })
          : api.getAttendanceMonthlyCount(selectedInstituteId, { year, month, eventId });
        const response = await fn;
        const summary = response.summary || response.data || response;
        setMonthlySummary({
          present: summary.present || 0,
          absent: summary.absent || 0,
          late: summary.late || 0,
          left: summary.left || 0,
          leftEarly: summary.leftEarly || 0,
          leftLate: summary.leftLate || 0,
          total: summary.total || (summary.present || 0) + (summary.absent || 0) + (summary.late || 0),
          uniqueStudents: summary.uniqueStudents,
          totalClasses: summary.totalClasses,
        });
        setDailyData([]);
      }
    } catch (error: any) {
      console.error("Failed to fetch attendance data:", error);
      if (error.message?.includes("404") || error.status === 404) {
        setDailyData([]);
        setMonthlySummary(null);
      } else {
        toast({ title: "Error", description: "Failed to fetch data", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  const totalPresent = dailyData.reduce((s, d) => s + d.present, 0);
  const totalAbsent = dailyData.reduce((s, d) => s + d.absent, 0);
  const totalLate = dailyData.reduce((s, d) => s + d.late, 0);
  const totalRecords = totalPresent + totalAbsent + totalLate;

  const dailyColumns: Column[] = [
    { key: "date", label: "Date", type: "date" },
    { key: "present", label: "Present" },
    { key: "absent", label: "Absent" },
    { key: "late", label: "Late" },
    { key: "left", label: "Left" },
    {
      key: "total",
      label: "Total",
      render: (_, row) => (row.present || 0) + (row.absent || 0) + (row.late || 0),
    },
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <DashboardLayout>
      <PageHeader
        title="Attendance Reports"
        description="View daily and monthly attendance statistics for institutes and classes"
        icon={BarChart3}
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Institute</Label>
          <InstituteSelector
            value={selectedInstituteId}
            onChange={(id) => {
              setSelectedInstituteId(id);
              setSelectedClassId("");
            }}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Class (optional)</Label>
          <Select
            value={selectedClassId}
            onValueChange={setSelectedClassId}
            disabled={!selectedInstituteId}
          >
            <SelectTrigger>
              <SelectValue placeholder="All classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.className} {c.grade ? `(Grade ${c.grade})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Event (optional)</Label>
          <Select
            value={selectedEventId || "all"}
            onValueChange={(v) => setSelectedEventId(v === "all" ? "" : v)}
            disabled={!selectedInstituteId || events.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.title || e.name || e.id} {e.eventDate || e.date ? `(${(e.eventDate || e.date)?.slice(0, 10)})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Year</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Month</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((name, i) => (
                <SelectItem key={i} value={String(i + 1)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">&nbsp;</Label>
          <Button onClick={fetchData} disabled={!selectedInstituteId || loading} className="w-full">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {selectedInstituteId ? (
        <>
          {/* View mode tabs */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="mb-6">
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>

          {viewMode === "daily" && (
            <>
              {/* Summary stats for daily view */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatsCard title="Total Records" value={totalRecords} icon={Users} />
                <StatsCard title="Present" value={totalPresent} icon={UserCheck} />
                <StatsCard title="Absent" value={totalAbsent} icon={UserX} />
                <StatsCard title="Late" value={totalLate} icon={Clock} />
              </div>

              <DataTable
                columns={dailyColumns}
                data={dailyData}
                isLoading={loading}
              />
            </>
          )}

          {viewMode === "monthly" && monthlySummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCard title="Present" value={monthlySummary.present} icon={UserCheck} />
              <StatsCard title="Absent" value={monthlySummary.absent} icon={UserX} />
              <StatsCard title="Late" value={monthlySummary.late} icon={Clock} />
              <StatsCard title="Total" value={monthlySummary.total || 0} icon={Users} />
              {monthlySummary.uniqueStudents !== undefined && (
                <StatsCard title="Unique Students" value={monthlySummary.uniqueStudents} icon={Users} />
              )}
              {monthlySummary.totalClasses !== undefined && (
                <StatsCard title="Total Classes" value={monthlySummary.totalClasses} icon={BarChart3} />
              )}
            </div>
          )}

          {viewMode === "monthly" && !monthlySummary && !loading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No monthly data available for the selected period</p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select an institute to view attendance reports</p>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
