import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { ClipboardCheck, Search, RefreshCw } from "lucide-react";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export default function AttendancePage() {
  const { toast } = useToast();
  const [studentId, setStudentId] = useState("");
  const [instituteId, setInstituteId] = useState("");
  const [status, setStatus] = useState("PRESENT");
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchStudentId, setSearchStudentId] = useState("");
  const [cardId, setCardId] = useState("");
  const [notes, setNotes] = useState("");
  const [advertisementId, setAdvertisementId] = useState("");
  const [cacheInfo, setCacheInfo] = useState("");
  const [lastCacheRefresh, setLastCacheRefresh] = useState<number | null>(null);

  const getTodayCacheKey = (student: string) => {
    const today = new Date().toISOString().slice(0, 10);
    return `attendance:daily:${student}:${today}`;
  };

  const getCacheExpiry = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  };

  const handleMarkAttendance = async () => {
    if (!studentId || !instituteId) {
      toast({ title: "Validation", description: "Student ID and Institute ID are required", variant: "destructive" });
      return;
    }
    try {
      const payload: any = {
        studentId,
        instituteId,
        status,
        notes: notes || undefined,
      };
      if (advertisementId) {
        payload.advertisementId = advertisementId;
      }
      const result = await api.markAttendance(payload);
      toast({ title: "Success", description: `Attendance marked successfully${advertisementId ? ' with ad delivery tracked' : ''}. Notification sent to student.` });
      setStudentId("");
      setNotes("");
      setAdvertisementId("");
      // Invalidate cache for this student
      const cacheKey = getTodayCacheKey(studentId);
      localStorage.removeItem(cacheKey);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to mark attendance", variant: "destructive" });
    }
  };

  const handleMarkByCard = async () => {
    if (!cardId || !instituteId) {
      toast({ title: "Validation", description: "Card ID and Institute ID are required", variant: "destructive" });
      return;
    }
    try {
      await api.markAttendanceByCard({
        cardId,
        instituteId,
        status,
      });
      toast({ title: "Success", description: "Attendance marked by card" });
      setCardId("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to mark attendance by card", variant: "destructive" });
    }
  };

  const handleSearch = async (forceRefresh = false) => {
    if (!searchStudentId) return;

    const normalizedStudentId = searchStudentId.trim();
    const cacheKey = getTodayCacheKey(normalizedStudentId);
    const cacheExpiry = getCacheExpiry();

    if (!forceRefresh) {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const now = Date.now();
          // Check if cache is still valid (expires at midnight)
          if (now < (parsed.expiryTime || cacheExpiry)) {
            if (Array.isArray(parsed?.records)) {
              setRecords(parsed.records);
              const lastRefresh = parsed.cachedAt ? new Date(parsed.cachedAt).toLocaleTimeString() : 'unknown time';
              setCacheInfo(`✅ Loaded from local cache (refreshed at ${lastRefresh}). Cache will expire at midnight.`);
              setLastCacheRefresh(parsed.cachedAt);
              return;
            }
          }
        } catch {
          // Ignore malformed cache and continue with API fetch.
        }
      }
    }

    try {
      setIsLoading(true);
      const res = await api.getStudentAttendance(normalizedStudentId, { limit: 50 });
      const nextRecords = Array.isArray(res) ? res : res?.data || [];
      const now = Date.now();
      setRecords(nextRecords);
      const cacheData = {
        cachedAt: now,
        expiryTime: cacheExpiry,
        records: nextRecords
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      setCacheInfo(forceRefresh ? `🔄 Refreshed from API at ${new Date(now).toLocaleTimeString()}. Cache will expire at midnight.` : `📡 Loaded from API and cached for today (expires at midnight).`);
      setLastCacheRefresh(now);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch attendance records", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (s: string) => {
    const colors: Record<string, string> = {
      PRESENT: "bg-green-100 text-green-800",
      ABSENT: "bg-red-100 text-red-800",
      LATE: "bg-yellow-100 text-yellow-800",
      EXCUSED: "bg-blue-100 text-blue-800",
    };
    return <Badge className={colors[s] || "bg-muted text-muted-foreground"}>{s}</Badge>;
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Attendance"
        description="Mark and view student attendance records"
        icon={ClipboardCheck}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Mark Attendance */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Mark Attendance</CardTitle>
            <CardDescription>Mark attendance for individual student</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Institute</Label>
              <InstituteSelector value={instituteId} onChange={setInstituteId} required placeholder="Select institute" />
            </div>
            <div>
              <Label>Student ID</Label>
              <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Enter student ID" />
            </div>
            <div>
              <Label>Advertisement ID (optional)</Label>
              <Input
                value={advertisementId}
                onChange={(e) => setAdvertisementId(e.target.value)}
                placeholder="Enter ad ID to track delivery"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENT">Present</SelectItem>
                  <SelectItem value="ABSENT">Absent</SelectItem>
                  <SelectItem value="LATE">Late</SelectItem>
                  <SelectItem value="EXCUSED">Excused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
            </div>
            <Button onClick={handleMarkAttendance} className="w-full gradient-primary">Mark Attendance</Button>
          </CardContent>
        </Card>

        {/* Mark by Card */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Mark by RFID Card</CardTitle>
            <CardDescription>Mark attendance using RFID card ID</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Institute</Label>
              <InstituteSelector value={instituteId} onChange={setInstituteId} required placeholder="Select institute" />
            </div>
            <div>
              <Label>Card ID (RFID)</Label>
              <Input value={cardId} onChange={(e) => setCardId(e.target.value)} placeholder="Scan or enter RFID card" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENT">Present</SelectItem>
                  <SelectItem value="ABSENT">Absent</SelectItem>
                  <SelectItem value="LATE">Late</SelectItem>
                  <SelectItem value="EXCUSED">Excused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleMarkByCard} className="w-full gradient-primary">Mark by Card</Button>
          </CardContent>
        </Card>
      </div>

      {/* Search Attendance Records */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Student Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Enter student ID..."
              value={searchStudentId}
              onChange={(e) => setSearchStudentId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(false)}
            />
            <Button onClick={() => handleSearch(false)}>Search</Button>
            <Button variant="outline" onClick={() => handleSearch(true)} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (!searchStudentId.trim()) return;
                localStorage.removeItem(getTodayCacheKey(searchStudentId.trim()));
                setCacheInfo("Local cache cleared for this student.");
                setLastCacheRefresh(null);
              }}
            >
              Clear Cache
            </Button>
          </div>
          {cacheInfo ? <p className="text-xs text-muted-foreground mb-3">{cacheInfo}</p> : null}
          {lastCacheRefresh ? (
            <p className="text-xs text-muted-foreground mb-3">
              Last cache refresh: {new Date(lastCacheRefresh).toLocaleString()}
            </p>
          ) : null}
          {isLoading ? (
            <p className="text-center py-4 text-muted-foreground">Loading...</p>
          ) : records.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Institute</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Ad ID</TableHead>
                  <TableHead>Marked By</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>{record.date ? new Date(record.date).toLocaleDateString() : record.attendanceDate || "-"}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>{record.instituteName || record.instituteId || "-"}</TableCell>
                    <TableCell>{record.className || record.classId || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{record.advertisementId || "-"}</TableCell>
                    <TableCell>{record.markedBy || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{record.notes || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : searchStudentId ? (
            <p className="text-center py-4 text-muted-foreground">No records found</p>
          ) : null}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
