import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi from '@/api/adminAttendance.api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bell, RefreshCw, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

interface AlertConfig {
  lowAttendanceThreshold: number;
  consecutiveAbsentDays: number;
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

const AttendanceAlerts: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [config, setConfig] = useState<AlertConfig>({ lowAttendanceThreshold: 75, consecutiveAbsentDays: 3 });
  const [lowAttendanceStudents, setLowAttendanceStudents] = useState<StudentRate[]>([]);
  const [consecutiveAbsent, setConsecutiveAbsent] = useState<ConsecutiveAbsent[]>([]);
  const [todayRate, setTodayRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const checkAlerts = useCallback(async () => {
    if (!currentInstituteId) return;
    setLoading(true);
    try {
      // Get last 30 days of attendance
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const records = await adminAttendanceApi.getInstituteAttendanceRange(
        currentInstituteId,
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0],
        { ttl: 300 }
      );

      // Calculate per-student rates
      const studentMap = new Map<string, { name: string; present: number; total: number; dates: Map<string, string> }>();
      for (const r of records) {
        const key = r.studentId || r.userId || '';
        if (!key) continue;
        if (!studentMap.has(key)) studentMap.set(key, { name: r.studentName || r.userName || key, present: 0, total: 0, dates: new Map() });
        const s = studentMap.get(key)!;
        s.total++;
        if (r.status === 'present') s.present++;
        const date = r.date || r.markedAt?.split('T')[0] || '';
        s.dates.set(date, r.status);
      }

      // Low attendance students
      const low: StudentRate[] = [];
      studentMap.forEach((s, id) => {
        const rate = s.total > 0 ? Math.round((s.present / s.total) * 1000) / 10 : 0;
        if (rate < config.lowAttendanceThreshold) {
          low.push({ name: s.name, id, rate, present: s.present, total: s.total });
        }
      });
      low.sort((a, b) => a.rate - b.rate);
      setLowAttendanceStudents(low);

      // Consecutive absent detection
      const consec: ConsecutiveAbsent[] = [];
      studentMap.forEach((s, id) => {
        const sortedDates = Array.from(s.dates.entries())
          .sort(([a], [b]) => b.localeCompare(a)); // most recent first
        let count = 0;
        for (const [, status] of sortedDates) {
          if (status === 'absent') count++;
          else break;
        }
        if (count >= config.consecutiveAbsentDays) {
          consec.push({ name: s.name, id, days: count });
        }
      });
      consec.sort((a, b) => b.days - a.days);
      setConsecutiveAbsent(consec);

      // Today's rate
      const today = end.toISOString().split('T')[0];
      const todayRecords = records.filter(r => (r.date || r.markedAt?.split('T')[0]) === today);
      const todayPresent = todayRecords.filter(r => r.status === 'present').length;
      setTodayRate(todayRecords.length > 0 ? Math.round((todayPresent / todayRecords.length) * 1000) / 10 : null);

    } catch (e: any) {
      toast.error(e.message || 'Failed to check alerts');
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, config]);

  useEffect(() => { checkAlerts(); }, [checkAlerts]);

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
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Low Attendance Threshold (%)</Label>
              <Input
                type="number"
                value={config.lowAttendanceThreshold}
                onChange={e => setConfig(c => ({ ...c, lowAttendanceThreshold: Number(e.target.value) }))}
                className="text-xs"
                min={0}
                max={100}
              />
            </div>
            <div>
              <Label className="text-xs">Consecutive Absent Days</Label>
              <Input
                type="number"
                value={config.consecutiveAbsentDays}
                onChange={e => setConfig(c => ({ ...c, consecutiveAbsentDays: Number(e.target.value) }))}
                className="text-xs"
                min={1}
                max={30}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's rate alert */}
      {todayRate !== null && todayRate < 85 && (
        <Card className="border-amber-500/50">
          <CardContent className="py-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Today's attendance: <strong>{todayRate}%</strong> (below 85% target)</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Low attendance students */}
      {lowAttendanceStudents.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {lowAttendanceStudents.length} students below {config.lowAttendanceThreshold}% attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowAttendanceStudents.slice(0, 10).map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{s.name}</span>
                  <Badge variant="destructive" className="text-xs">{s.rate}%</Badge>
                </div>
              ))}
              {lowAttendanceStudents.length > 10 && (
                <p className="text-xs text-muted-foreground">...and {lowAttendanceStudents.length - 10} more</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consecutive absent */}
      {consecutiveAbsent.length > 0 && (
        <Card className="border-red-500/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              {consecutiveAbsent.length} students absent {config.consecutiveAbsentDays}+ consecutive days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {consecutiveAbsent.slice(0, 10).map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{s.name}</span>
                  <Badge variant="destructive" className="text-xs">{s.days} days</Badge>
                </div>
              ))}
              {consecutiveAbsent.length > 10 && (
                <p className="text-xs text-muted-foreground">...and {consecutiveAbsent.length - 10} more</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All good */}
      {!loading && lowAttendanceStudents.length === 0 && consecutiveAbsent.length === 0 && (
        <Card className="border-emerald-500/50">
          <CardContent className="py-4 text-center">
            <span className="text-sm text-emerald-600">No attendance alerts at this time</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendanceAlerts;
