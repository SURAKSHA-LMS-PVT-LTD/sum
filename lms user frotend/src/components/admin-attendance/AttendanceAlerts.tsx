import React, { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi from '@/api/adminAttendance.api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bell, RefreshCw, TrendingDown, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AlertConfig {
  lowAttendanceThreshold: number;
  consecutiveAbsentDays: number;
  lookbackDays: number;
}

interface StudentRate {
  name: string;
  id: string;
  rate: number;
  present: number;
  total: number;
}

interface ConsecutiveAbsent {
  name: string;
  id: string;
  days: number;
}

interface AlertResult {
  todayRate: number | null;
  todayPresent: number;
  todayTotal: number;
  overallRate: number;
  overallPresent: number;
  overallAbsent: number;
  lowAttendance: StudentRate[];
  consecutiveAbsent: ConsecutiveAbsent[];
}

const AttendanceAlerts: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [config, setConfig] = useState<AlertConfig>({
    lowAttendanceThreshold: 75,
    consecutiveAbsentDays: 3,
    lookbackDays: 30,
  });
  const [result, setResult] = useState<AlertResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const checkAlerts = useCallback(async () => {
    if (!currentInstituteId) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - (config.lookbackDays - 1));
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      const todayStr = endStr;

      // Single multi-window fetch — reuses cached windows on re-runs
      const { records, summary } = await adminAttendanceApi.getInstituteAttendanceRangeWithSummary(
        currentInstituteId,
        startStr,
        endStr,
        { ttl: 300 }
      );

      // Per-student aggregation (only students, skip admins/markers)
      const studentMap = new Map<string, {
        name: string;
        present: number;
        total: number;
        recentDates: { date: string; status: string }[];
      }>();

      for (const r of records) {
        if (r.userType && r.userType !== 'STUDENT' && r.userType !== 'NOT_ENROLLED') continue;
        const key = r.studentId || r.userId || '';
        if (!key) continue;
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            name: r.studentName || r.userName || key,
            present: 0,
            total: 0,
            recentDates: [],
          });
        }
        const s = studentMap.get(key)!;
        s.total++;
        if (r.status === 'present' || r.status === 'late') s.present++;
        const date = r.date || r.markedAt?.split('T')[0] || '';
        if (date) s.recentDates.push({ date, status: r.status });
      }

      // Today's stats
      const todayRecords = records.filter(r =>
        (r.date || r.markedAt?.split('T')[0]) === todayStr
      );
      const todayPresent = todayRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      const todayTotal = todayRecords.length;
      const todayRate = todayTotal > 0 ? Math.round((todayPresent / todayTotal) * 1000) / 10 : null;

      // Low attendance
      const lowAttendance: StudentRate[] = [];
      studentMap.forEach((s, id) => {
        if (s.total < 2) return; // skip students with too few records
        const rate = Math.round((s.present / s.total) * 1000) / 10;
        if (rate < config.lowAttendanceThreshold) {
          lowAttendance.push({ name: s.name, id, rate, present: s.present, total: s.total });
        }
      });
      lowAttendance.sort((a, b) => a.rate - b.rate);

      // Consecutive absent (check most recent N dates)
      const consecutiveAbsent: ConsecutiveAbsent[] = [];
      studentMap.forEach((s, id) => {
        const sorted = [...s.recentDates].sort((a, b) => b.date.localeCompare(a.date));
        let count = 0;
        for (const { status } of sorted) {
          if (status === 'absent') count++;
          else break;
        }
        if (count >= config.consecutiveAbsentDays) {
          consecutiveAbsent.push({ name: s.name, id, days: count });
        }
      });
      consecutiveAbsent.sort((a, b) => b.days - a.days);

      setResult({
        todayRate,
        todayPresent,
        todayTotal,
        overallRate: summary.attendanceRate,
        overallPresent: summary.totalPresent,
        overallAbsent: summary.totalAbsent,
        lowAttendance,
        consecutiveAbsent,
      });
      setHasLoaded(true);
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error(e.message || 'Failed to check alerts');
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, config]);

  return (
    <div className="space-y-4">
      {/* Config */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Attendance Alerts
            </CardTitle>
            <Button variant="outline" size="sm" onClick={checkAlerts} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              {hasLoaded ? 'Refresh' : 'Check Alerts'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Low Threshold (%)</Label>
              <Input
                type="number"
                value={config.lowAttendanceThreshold}
                onChange={e => setConfig(c => ({ ...c, lowAttendanceThreshold: Number(e.target.value) }))}
                className="text-xs"
                min={0} max={100}
              />
            </div>
            <div>
              <Label className="text-xs">Consecutive Absent Days</Label>
              <Input
                type="number"
                value={config.consecutiveAbsentDays}
                onChange={e => setConfig(c => ({ ...c, consecutiveAbsentDays: Number(e.target.value) }))}
                className="text-xs"
                min={1} max={30}
              />
            </div>
            <div>
              <Label className="text-xs">Lookback Days</Label>
              <Input
                type="number"
                value={config.lookbackDays}
                onChange={e => setConfig(c => ({ ...c, lookbackDays: Number(e.target.value) }))}
                className="text-xs"
                min={7} max={90}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Analyzing attendance data…
        </div>
      )}

      {!loading && result && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="text-center p-2 bg-muted rounded-lg">
              <div className="text-lg font-bold">{result.overallRate}%</div>
              <div className="text-xs text-muted-foreground">{config.lookbackDays}d Rate</div>
            </div>
            <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="text-lg font-bold text-emerald-600">{result.overallPresent}</div>
              <div className="text-xs text-muted-foreground">Present</div>
            </div>
            <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-lg font-bold text-red-500">{result.overallAbsent}</div>
              <div className="text-xs text-muted-foreground">Absent</div>
            </div>
            {result.todayRate !== null ? (
              <div className={`text-center p-2 rounded-lg ${result.todayRate < 85 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                <div className={`text-lg font-bold ${result.todayRate < 85 ? 'text-amber-600' : 'text-emerald-600'}`}>{result.todayRate}%</div>
                <div className="text-xs text-muted-foreground">Today ({result.todayPresent}/{result.todayTotal})</div>
              </div>
            ) : (
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="text-lg font-bold text-muted-foreground">—</div>
                <div className="text-xs text-muted-foreground">No data today</div>
              </div>
            )}
          </div>

          {/* Today's alert */}
          {result.todayRate !== null && result.todayRate < 85 && (
            <Card className="border-amber-500/50">
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <span className="text-sm">Today's attendance: <strong>{result.todayRate}%</strong> — below 85% target ({result.todayPresent} present of {result.todayTotal} marked)</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Low attendance */}
          {result.lowAttendance.length > 0 ? (
            <Card className="border-amber-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {result.lowAttendance.length} student{result.lowAttendance.length !== 1 ? 's' : ''} below {config.lowAttendanceThreshold}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {result.lowAttendance.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="truncate">{s.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{s.present}/{s.total}</span>
                        <Badge variant="destructive" className="text-xs">{s.rate}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-emerald-500/50">
              <CardContent className="py-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-emerald-600">No students below {config.lowAttendanceThreshold}% threshold</span>
              </CardContent>
            </Card>
          )}

          {/* Consecutive absent */}
          {result.consecutiveAbsent.length > 0 && (
            <Card className="border-red-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  {result.consecutiveAbsent.length} student{result.consecutiveAbsent.length !== 1 ? 's' : ''} absent {config.consecutiveAbsentDays}+ consecutive days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {result.consecutiveAbsent.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="truncate">{s.name}</span>
                      <Badge variant="destructive" className="text-xs">{s.days} days</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!loading && !hasLoaded && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Click "Check Alerts" to analyze attendance for the last {config.lookbackDays} days
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendanceAlerts;
