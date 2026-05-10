import React, { useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { myAttendanceHistoryApi, type MyAttendanceHistoryResponse } from '@/api/myAttendanceHistory.api';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, UserCheck, UserX, Clock, ChevronRight, LogOut, DoorOpen } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getImageUrl } from '@/utils/imageUrlHelper';

const STATUS_COLORS: Record<string, string> = {
  present: 'hsl(var(--chart-2))',
  absent: 'hsl(var(--destructive))',
  late: 'hsl(var(--chart-4))',
  left: 'hsl(var(--chart-5))',
  leftEarly: 'hsl(var(--chart-3))',
  leftLately: 'hsl(var(--chart-1))',
};

const MyAttendanceHistoryCard = () => {
  const navigate = useNavigate();
  const { selectedInstitute } = useAuth();
  const [data, setData] = useState<MyAttendanceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(false);
        const endDate = format(new Date(), 'yyyy-MM-dd');
        const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
        const result = await myAttendanceHistoryApi.getMyHistory(
          { startDate, endDate, limit: 10 },
          true // forceRefresh on every institute change
        );
        setData(result);
      } catch (err: any) {
        console.warn('Attendance history not available:', err?.message || err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedInstitute?.id]);

  // Show empty state if error or no data instead of hiding
  if (error || (!loading && !data)) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10">
            <UserCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">My Attendance</h3>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <UserCheck className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No attendance data yet</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Your attendance records will appear here</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10">
            <UserCheck className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">My Attendance</h3>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const { summary, byInstitute, data: records } = data!;
  const rate = summary.attendanceRate;

  const pieData = [
    { name: 'Present', value: summary.totalPresent, color: STATUS_COLORS.present },
    { name: 'Absent', value: summary.totalAbsent, color: STATUS_COLORS.absent },
    { name: 'Late', value: summary.totalLate, color: STATUS_COLORS.late },
    { name: 'Left', value: summary.totalLeft, color: STATUS_COLORS.left },
    { name: 'Left Early', value: summary.totalLeftEarly, color: STATUS_COLORS.leftEarly },
    { name: 'Left Lately', value: summary.totalLeftLately, color: STATUS_COLORS.leftLately },
  ].filter(d => d.value > 0);

  const totalRecords = summary.totalPresent + summary.totalAbsent + summary.totalLate +
    summary.totalLeft + summary.totalLeftEarly + summary.totalLeftLately;

  const instituteEntries = Object.entries(byInstitute || {});

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10">
            <UserCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">My Attendance</h3>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/my-attendance')}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          View All <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Rate + Pie */}
      <div className="flex items-center gap-4">
        {totalRecords > 0 && (
          <div className="w-20 h-20 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={22} outerRadius={36} dataKey="value" strokeWidth={0}>
                  {pieData.map((entry, i) => (
                    <Cell key={`${entry.name}-${i}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-3xl font-bold text-foreground">
            {rate != null ? `${Math.round(rate)}%` : '—'}
          </div>
          <p className="text-xs text-muted-foreground">Attendance Rate</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <StatBadge icon={<UserCheck className="h-3 w-3" />} count={summary.totalPresent} label="Present" className="text-emerald-600 dark:text-emerald-400" />
            <StatBadge icon={<UserX className="h-3 w-3" />} count={summary.totalAbsent} label="Absent" className="text-red-600 dark:text-red-400" />
            <StatBadge icon={<Clock className="h-3 w-3" />} count={summary.totalLate} label="Late" className="text-amber-600 dark:text-amber-400" />
            {summary.totalLeftEarly > 0 && (
              <StatBadge icon={<DoorOpen className="h-3 w-3" />} count={summary.totalLeftEarly} label="Early" className="text-pink-600 dark:text-pink-400" />
            )}
            {summary.totalLeft > 0 && (
              <StatBadge icon={<LogOut className="h-3 w-3" />} count={summary.totalLeft} label="Left" className="text-purple-600 dark:text-purple-400" />
            )}
          </div>
        </div>
      </div>

      {/* By Institute breakdown */}
      {instituteEntries.length > 1 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">By Institute</p>
          {instituteEntries.map(([id, inst]) => (
            <div key={id} className="flex items-center gap-3 py-1.5">
              {inst.instituteLogoUrl ? (
                <img src={inst.instituteLogoUrl} alt="" loading="lazy" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                  {inst.instituteName?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{inst.instituteName}</p>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {inst.attendanceRate != null ? `${Math.round(inst.attendanceRate)}%` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Recent records */}
      {records.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recent</p>
          {records.slice(0, 3).map((rec, index) => (
            <div key={`${rec.date}-${index}`} className="flex items-center justify-between py-1.5 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-muted-foreground shrink-0">{format(new Date(rec.date), 'MMM d')}</span>
                {rec.instituteLogoUrl ? (
                  <img src={getImageUrl(rec.instituteLogoUrl)} alt="" loading="lazy" className="h-4 w-4 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">
                    {(rec.instituteName || '?')[0]}
                  </div>
                )}
                <span className="text-foreground truncate">{rec.instituteName}</span>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusClasses(rec.status)}`}>
                {rec.statusLabel}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const StatBadge = ({ icon, count, label, className }: { icon: React.ReactNode; count: number; label: string; className?: string }) => (
  <span className={`inline-flex items-center gap-1 text-xs font-medium ${className}`}>
    {icon} {count}
  </span>
);

const getStatusClasses = (status: string): string => {
  const s = status.toLowerCase();
  if (s === 'present') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (s === 'absent') return 'bg-red-500/10 text-red-600 dark:text-red-400';
  if (s === 'late') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  if (s === 'left_early') return 'bg-pink-500/10 text-pink-600 dark:text-pink-400';
  if (s === 'left_lately') return 'bg-orange-500/10 text-orange-600 dark:text-orange-400';
  if (s === 'left') return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
  return 'bg-muted text-muted-foreground';
};

export default MyAttendanceHistoryCard;
