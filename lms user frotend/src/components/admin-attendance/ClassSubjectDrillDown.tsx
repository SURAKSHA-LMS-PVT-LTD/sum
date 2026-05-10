import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi, { AdminAttendanceRecord } from '@/api/adminAttendance.api';
import { normalizeAttendanceSummary, AttendanceSummary } from '@/types/attendance.types';
import { cachedApiClient } from '@/api/cachedClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface ClassOption { id: string; name: string }
interface SubjectOption { id: string; name: string }

const ALL_SUBJECTS_VALUE = '__all_subjects__';

const ClassSubjectDrillDown: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(ALL_SUBJECTS_VALUE);
  const [records, setRecords] = useState<AdminAttendanceRecord[]>([]);
  const [apiSummary, setApiSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 4);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Load classes
  useEffect(() => {
    if (!currentInstituteId) return;
    cachedApiClient.get(`/institutes/${currentInstituteId}/classes`, undefined, { ttl: 60 })
      .then((res: any) => setClasses(res?.data || res || []))
      .catch(() => {});
  }, [currentInstituteId]);

  // Load subjects when class changes
  useEffect(() => {
    if (!currentInstituteId || !selectedClass) { setSubjects([]); return; }
    cachedApiClient.get(`/institutes/${currentInstituteId}/classes/${selectedClass}/subjects`, undefined, { ttl: 60 })
      .then((res: any) => {
        const raw: any[] = res?.data || res || [];
        setSubjects(raw.map((s: any) => ({
          id: s.subjectId ?? s.subject?.id ?? s.id,
          name: s.subject?.name ?? s.name ?? s.subjectName ?? s.subjectId ?? s.id,
        })));
      })
      .catch(() => {});
  }, [currentInstituteId, selectedClass]);

  const loadAttendance = useCallback(async () => {
    if (!currentInstituteId || !selectedClass) return;
    setLoading(true);
    try {
      const params = { startDate, endDate, limit: 100, page: 1 };
      const normalizedSubjectId = selectedSubject && selectedSubject !== ALL_SUBJECTS_VALUE
        ? selectedSubject
        : '';

      let res;
      if (normalizedSubjectId) {
        res = await adminAttendanceApi.getSubjectAttendance(currentInstituteId, selectedClass, normalizedSubjectId, params);
      } else {
        res = await adminAttendanceApi.getClassAttendance(currentInstituteId, selectedClass, params);
      }
      setRecords(res?.data || []);
      setApiSummary(normalizeAttendanceSummary(res?.summary));
    } catch (e: any) {
      toast.error(e.message || 'Failed to load drill-down data');
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, selectedClass, selectedSubject, startDate, endDate]);

  // Group by subject for the overview table
  const subjectBreakdown = React.useMemo(() => {
    if (selectedSubject && selectedSubject !== ALL_SUBJECTS_VALUE) return null;
    const map = new Map<string, { subjectId: string; name: string; present: number; absent: number; late: number; total: number }>();
    for (const r of records) {
      const key = r.subjectId || 'unknown';
      if (!map.has(key)) map.set(key, { subjectId: r.subjectId || '', name: r.subjectName || key, present: 0, absent: 0, late: 0, total: 0 });
      const s = map.get(key)!;
      s.total++;
      if (r.status === 'present') s.present++;
      else if (r.status === 'absent') s.absent++;
      else if (r.status === 'late') s.late++;
    }
    return Array.from(map.values()).sort((a, b) => {
      const rateA = a.total > 0 ? a.present / a.total : 0;
      const rateB = b.total > 0 ? b.present / b.total : 0;
      return rateB - rateA;
    });
  }, [records, selectedSubject]);

  // Group by student for per-student breakdown
  const studentBreakdown = React.useMemo(() => {
    if (!selectedSubject || selectedSubject === ALL_SUBJECTS_VALUE) return null;
    const map = new Map<string, { studentId: string; name: string; imageUrl?: string; dates: Map<string, string> }>();
    for (const r of records) {
      const key = r.studentId || r.userId || 'unknown';
      if (!map.has(key)) {
        map.set(key, {
          studentId: r.studentId || r.userId || '',
          name: r.studentName || r.userName || key,
          imageUrl: r.studentImageUrl || r.imageUrl,
          dates: new Map(),
        });
      }
      const date = r.date || r.markedAt?.split('T')[0] || '';
      map.get(key)!.dates.set(date, r.status);
    }
    return Array.from(map.values());
  }, [records, selectedSubject]);

  const uniqueDates = React.useMemo(() => {
    const dates = new Set<string>();
    records.forEach(r => {
      const d = r.date || r.markedAt?.split('T')[0];
      if (d) dates.add(d);
    });
    return Array.from(dates).sort();
  }, [records]);

  const statusIcon = (s: string) => {
    switch (s) {
      case 'present': return 'P';
      case 'absent': return 'A';
      case 'late': return 'L';
      default: return '→';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Attendance Drill-Down</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Class</Label>
            <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSubject(ALL_SUBJECTS_VALUE); }}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="Select Class" /></SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Subject</Label>
            <Select value={selectedSubject || ALL_SUBJECTS_VALUE} onValueChange={setSelectedSubject}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="All Subjects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SUBJECTS_VALUE} className="text-xs">All Subjects</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Start</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs" />
          </div>
          <div>
            <Label className="text-xs">End</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs" />
          </div>
        </div>
        <Button size="sm" onClick={loadAttendance} disabled={!selectedClass || loading}>
          <Search className="h-3 w-3 mr-1" />
          {loading ? 'Loading...' : 'Search'}
        </Button>

        {/* Subject overview */}
        {subjectBreakdown && subjectBreakdown.length > 0 && (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Subject</TableHead>
                  <TableHead className="text-xs text-center">Rate</TableHead>
                  <TableHead className="text-xs text-center">Present</TableHead>
                  <TableHead className="text-xs text-center">Absent</TableHead>
                  <TableHead className="text-xs text-center">Late</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjectBreakdown.map((s, i) => {
                  const rate = s.total > 0 ? Math.round((s.present / s.total) * 1000) / 10 : 0;
                  return (
                    <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                      if (s.subjectId) setSelectedSubject(s.subjectId);
                    }}>
                      <TableCell className="text-xs font-medium">{s.name}</TableCell>
                      <TableCell className="text-xs text-center">
                        <Badge variant={rate >= 85 ? 'default' : rate >= 75 ? 'secondary' : 'destructive'} className="text-xs">
                          {rate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-center text-emerald-600">{s.present}</TableCell>
                      <TableCell className="text-xs text-center text-red-500">{s.absent}</TableCell>
                      <TableCell className="text-xs text-center text-amber-500">{s.late}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="p-2 border-t">
              <p className="text-xs text-muted-foreground">Click a subject to see per-student breakdown</p>
            </div>
          </div>
        )}

        {/* Per-student breakdown */}
        {studentBreakdown && studentBreakdown.length > 0 && (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Student</TableHead>
                  <TableHead className="text-xs">Student ID</TableHead>
                  {uniqueDates.map(d => (
                    <TableHead key={d} className="text-xs text-center">
                      {new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentBreakdown.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={getImageUrl(s.imageUrl || '')} alt={s.name} />
                          <AvatarFallback className="text-[10px]">{(s.name || '?').charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span>{s.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground font-mono">{s.studentId || '—'}</TableCell>
                    {uniqueDates.map(d => (
                      <TableCell key={d} className="text-xs text-center">
                        {statusIcon(s.dates.get(d) || '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && records.length === 0 && selectedClass && (
          apiSummary && (apiSummary.totalPresent > 0 || apiSummary.totalAbsent > 0) ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <div className="text-lg font-bold text-emerald-600">{apiSummary.totalPresent}</div>
                <div className="text-xs text-muted-foreground">Present</div>
              </div>
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-lg font-bold text-red-500">{apiSummary.totalAbsent}</div>
                <div className="text-xs text-muted-foreground">Absent</div>
              </div>
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <div className="text-lg font-bold text-amber-600">{apiSummary.totalLate}</div>
                <div className="text-xs text-muted-foreground">Late</div>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <div className="text-lg font-bold text-primary">{apiSummary.attendanceRate}%</div>
                <div className="text-xs text-muted-foreground">Rate</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No records found for selected filters</p>
          )
        )}
      </CardContent>
    </Card>
  );
};

export default ClassSubjectDrillDown;
