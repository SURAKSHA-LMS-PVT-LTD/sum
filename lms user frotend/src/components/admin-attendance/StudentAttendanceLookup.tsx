import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi, { AdminAttendanceRecord } from '@/api/adminAttendance.api';
import { getAuthHeadersSync } from '@/services/tokenStorageService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getImageUrl } from '@/utils/imageUrlHelper';

const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

const StudentAttendanceLookup: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [studentId, setStudentId] = useState('');
  const [records, setRecords] = useState<AdminAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [studentImageUrl, setStudentImageUrl] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchStudentAttendance = useCallback(async (targetPage: number) => {
    if (!currentInstituteId || !studentId.trim()) return;

    setLoading(true);
    try {
      const res = await adminAttendanceApi.getStudentAttendance(studentId.trim(), {
        instituteId: currentInstituteId,
        startDate,
        endDate,
        page: targetPage,
        limit: 50,
      });
      setRecords(res?.data || []);
      setTotalPages(res?.pagination?.totalPages || 1);
    } catch (e: any) {
      toast.error(e.message || 'Failed to look up student');
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, studentId, startDate, endDate]);

  const searchStudent = useCallback(async () => {
    if (!currentInstituteId || !studentId.trim()) {
      toast.error('Please enter a student ID');
      return;
    }

    setHasSearched(true);
    setPage(1);
    
    // ✅ NEW: Fetch student profile to get their image
    try {
      const response = await fetch(
        `${import.meta.env.VITE_LMS_BASE_URL || 'https://lmsapi.suraksha.lk'}/students/${studentId.trim()}`,
        { headers: getAuthHeadersSync() }
      );
      
      if (response.ok) {
        const data = await response.json();
        const student = data.data || data;
        if (student.imageUrl) {
          setStudentImageUrl(student.imageUrl);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch student profile:', error);
    }
    
    await fetchStudentAttendance(1);
  }, [currentInstituteId, studentId, fetchStudentAttendance]);

  useEffect(() => {
    if (!hasSearched || page === 1) return;
    fetchStudentAttendance(page);
  }, [hasSearched, page, fetchStudentAttendance]);

  const stats = React.useMemo(() => {
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const left = records.filter(r => ['left', 'left_early', 'left_lately'].includes(r.status)).length;
    const total = records.length;
    const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
    return { present, absent, late, left, total, rate };
  }, [records]);

  const pieData = [
    { name: 'Present', value: stats.present },
    { name: 'Absent', value: stats.absent },
    { name: 'Late', value: stats.late },
    { name: 'Left', value: stats.left },
  ].filter(d => d.value > 0);

  // Monthly trend
  const monthlyTrend = React.useMemo(() => {
    const byMonth = new Map<string, { present: number; total: number }>();
    for (const r of records) {
      const d = r.date || r.markedAt?.split('T')[0] || '';
      const monthKey = d.substring(0, 7);
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, { present: 0, total: 0 });
      const s = byMonth.get(monthKey)!;
      s.total++;
      if (r.status === 'present') s.present++;
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        month: new Date(key + '-01').toLocaleString('en-US', { month: 'short' }),
        rate: val.total > 0 ? Math.round((val.present / val.total) * 1000) / 10 : 0,
      }));
  }, [records]);

  const studentName = records.length > 0 ? (records[0].studentName || records[0].userName || studentId) : '';

  const statusIcon = (s: string) => {
    switch (s) { case 'present': return '✅'; case 'absent': return '❌'; case 'late': return '⏰'; default: return '→'; }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Student Attendance Lookup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Student ID</Label>
              <Input
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                placeholder="Enter student ID"
                className="text-xs"
                onKeyDown={e => e.key === 'Enter' && searchStudent()}
              />
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs" />
            </div>
            <div className="flex items-end">
              <Button size="sm" onClick={searchStudent} disabled={loading} className="w-full">
                <Search className="h-3 w-3 mr-1" />
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {records.length > 0 && (
        <>
          {/* Student Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Avatar className="h-10 w-10 shrink-0">
                  {/* ✅ NEW: Use fetched student image, fallback to records[0] image */}
                  <AvatarImage src={getImageUrl(studentImageUrl || records[0]?.studentImageUrl || '')} alt={studentName} />
                  <AvatarFallback className="text-sm">{getInitials(studentName)}</AvatarFallback>
                </Avatar>
                {studentName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Donut */}
                <div className="w-40 h-40">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="text-center -mt-[100px]">
                    <div className="text-xl font-bold">{stats.rate}%</div>
                    <div className="text-[10px] text-muted-foreground">rate</div>
                  </div>
                  <div className="h-[60px]" />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 flex-1">
                  <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded">
                    <div className="text-lg font-bold text-emerald-600">{stats.present}</div>
                    <div className="text-xs text-muted-foreground">Present</div>
                  </div>
                  <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <div className="text-lg font-bold text-red-500">{stats.absent}</div>
                    <div className="text-xs text-muted-foreground">Absent</div>
                  </div>
                  <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                    <div className="text-lg font-bold text-amber-600">{stats.late}</div>
                    <div className="text-xs text-muted-foreground">Late</div>
                  </div>
                  <div className="text-center p-2 bg-muted rounded">
                    <div className="text-lg font-bold">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          {monthlyTrend.length > 1 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Monthly Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Records Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Attendance Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="hidden md:block rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                      <TableHead className="text-xs">Class</TableHead>
                      <TableHead className="text-xs">Subject</TableHead>
                      <TableHead className="text-xs">Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">
                          {new Date(r.date || r.markedAt?.split('T')[0] || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-xs text-center">{statusIcon(r.status)} {r.status}</TableCell>
                        <TableCell className="text-xs">{r.className || '—'}</TableCell>
                        <TableCell className="text-xs">{r.subjectName || '—'}</TableCell>
                        <TableCell className="text-xs">{r.markingMethod || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Mobile List View */}
              <div className="md:hidden flex flex-col gap-3">
                {records.map((r, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-card flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        {new Date(r.date || r.markedAt?.split('T')[0] || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-1 text-xs font-medium">
                        {statusIcon(r.status)}
                        <span className="capitalize">{r.status}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-1">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider opacity-70">Class</span>
                        <span className="text-foreground">{r.className || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider opacity-70">Subject</span>
                        <span className="text-foreground">{r.subjectName || '—'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-[10px] uppercase tracking-wider opacity-70">Method</span>
                        <span className="text-foreground">{r.markingMethod || '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default StudentAttendanceLookup;
