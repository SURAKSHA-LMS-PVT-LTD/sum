import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { Calendar, Clock, FileText, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, BookOpen, CreditCard, Loader2, UserCheck, UserX, Building2, ChevronRight, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import { format, subDays, formatDistanceToNowStrict, isSameDay, isAfter } from 'date-fns';
import adminAttendanceApi from '@/api/adminAttendance.api';
import { institutePaymentsApi, type PaymentStatsResponse } from '@/api/institutePayments.api';
import { lectureApi, type Lecture } from '@/api/lecture.api';
import { homeworkApi, type Homework } from '@/api/homework.api';
import { myAttendanceHistoryApi } from '@/api/myAttendanceHistory.api';
import { getImageUrl } from '@/utils/imageUrlHelper';
import type { AttendanceSummary } from '@/types/attendance.types';

// ── Shared helpers ──────────────────────────────────────────────

const WidgetSkeleton = () => (
  <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex items-center justify-center min-h-[140px]">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
);

const EmptyWidget = ({ icon: Icon, title, message }: { icon: React.ElementType; title: string; message: string }) => (
  <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center text-center min-h-[140px]">
    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
      <Icon className="h-5 w-5 text-muted-foreground" />
    </div>
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
  </div>
);

const formatTime = (iso?: string) => {
  if (!iso) return '';
  try { return format(new Date(iso), 'hh:mm a'); } catch { return ''; }
};

// ── Shared: status pill ────────────────────────────────────────

const STATUS_PILL_COLORS: Record<string, string> = {
  present: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  absent:  'bg-red-500/10 text-red-600 dark:text-red-400',
  late:    'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  left:    'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  left_early:   'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  left_lately:  'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
};

const StatusPill = ({ status, label }: { status: string; label: string }) => (
  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap capitalize ${STATUS_PILL_COLORS[status.toLowerCase()] || STATUS_PILL_COLORS.present}`}>
    {label.replace(/_/g, ' ')}
  </span>
);

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);

const toLabel = (status: string) =>
  status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');

const AVATAR_COLORS = [
  'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  'bg-purple-500/20 text-purple-700 dark:text-purple-300',
  'bg-pink-500/20 text-pink-700 dark:text-pink-300',
  'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  'bg-teal-500/20 text-teal-700 dark:text-teal-300',
  'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300',
  'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  'bg-green-500/20 text-green-700 dark:text-green-300',
];
const getAvatarColor = (name: string) =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] || AVATAR_COLORS[0];

// ── Attendance Feed (pre-institute & parent view) ───────────────

type FeedRecord = {
  key: string;
  date: string;
  markedAt?: string;
  status: string;
  statusLabel: string;
  instituteName: string;
  instituteLogoUrl?: string;
  instituteId: string;
  className?: string;
  subjectName?: string;
  userName: string;
  userImageUrl?: string;
  isChild?: boolean;
  sortTs: number;
};

// Constants for localStorage keys
const ATTENDANCE_DAYS_KEY = 'attendance-widget-days';
const ATTENDANCE_CACHE_KEY = 'attendance-widget-cache';
const ATTENDANCE_CACHE_TIME_KEY = 'attendance-widget-cache-time';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour in milliseconds

export const AttendanceFeedWidget = ({ filterInstituteId }: { filterInstituteId?: string }) => {
  const navigate = useNavigate();
  const { user, isViewingAsParent } = useAuth();
  const userRole = useInstituteRole();
  const isParent = userRole === 'Parent';

  // Load saved preference from localStorage, default to 30 days
  const [days, setDays] = useState<7 | 14 | 30>(() => {
    try {
      const saved = localStorage.getItem(ATTENDANCE_DAYS_KEY);
      if (saved && ['7', '14', '30'].includes(saved)) {
        return parseInt(saved) as 7 | 14 | 30;
      }
    } catch (error) {
      console.warn('Failed to load attendance days preference:', error);
    }
    return 30; // Default to 30 days
  });

  const [records, setRecords] = useState<FeedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [instituteFilter, setInstituteFilter] = useState<string>('all');
  const [cacheTime, setCacheTime] = useState<number>(0);
  const [isStale, setIsStale] = useState(false);

  // Save days preference to localStorage whenever it changes
  const handleDaysChange = (newDays: 7 | 14 | 30) => {
    setDays(newDays);
    try {
      localStorage.setItem(ATTENDANCE_DAYS_KEY, String(newDays));
    } catch (error) {
      console.warn('Failed to save attendance days preference:', error);
    }
  };

  const instituteMetaById = useMemo(() => {
    const map = new Map<string, { logo?: string; instituteUserImageUrl?: string }>();
    // Don't use parent's institute metadata when viewing as child
    if (!isViewingAsParent) {
      for (const inst of (user?.institutes || [])) {
        if (!inst?.id) continue;
        map.set(String(inst.id), {
          logo: inst.logo || undefined,
          instituteUserImageUrl: inst.instituteUserImageUrl || undefined,
        });
      }
    }
    return map;
  }, [user?.institutes, isViewingAsParent]);

  // Use callback to make load available to both useEffect and refresh button
  const load = React.useCallback(async (useCache = true) => {
    setLoading(true);
    // Scope cache keys to the institute so pre-institute and institute-level data
    // never contaminate each other.
    const cacheKey = filterInstituteId
      ? `${ATTENDANCE_CACHE_KEY}-${filterInstituteId}-${days}`
      : `${ATTENDANCE_CACHE_KEY}-${days}`;
    const cacheTimeKey = filterInstituteId
      ? `${ATTENDANCE_CACHE_TIME_KEY}-${filterInstituteId}-${days}`
      : `${ATTENDANCE_CACHE_TIME_KEY}-${days}`;
    try {
      // Check if we have valid cache
      let cachedData: FeedRecord[] | null = null;
      let cachedTime = 0;
      
      if (useCache) {
        try {
          const cached = localStorage.getItem(cacheKey);
          const cachedTimeStr = localStorage.getItem(cacheTimeKey);
          if (cached && cachedTimeStr) {
            cachedTime = parseInt(cachedTimeStr);
            const now = Date.now();
            // If cache is still valid, use it
            if (now - cachedTime < CACHE_DURATION_MS) {
              cachedData = JSON.parse(cached);
            } else {
              // Cache is stale, mark for refresh
              setIsStale(true);
            }
          }
        } catch (err) {
          console.warn('Failed to load cached attendance:', err);
        }
      }

      // If we have valid cache, use it
      if (cachedData && cachedData.length > 0) {
        setRecords(cachedData);
        setCacheTime(cachedTime);
        setIsStale(false);
        setLoading(false);
        return;
      }

      // Otherwise, fetch from API
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), days - 1), 'yyyy-MM-dd');
      const all: FeedRecord[] = [];

      // Fetch attendance (backend auto-handles parent + children via JWT)
      const histRes = await myAttendanceHistoryApi.getMyHistory({
        startDate, endDate, limit: 50,
        child: true, // Request children's attendance for parents
        ...(filterInstituteId ? { instituteId: filterInstituteId } : {}),
      });

      const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
        || user?.nameWithInitials || 'Me';

      // Process all records (parent + children auto-included by backend)
      for (const rec of (histRes?.data || [])) {
        const localInst = instituteMetaById.get(String(rec.instituteId));
        const userImageUrl = rec.studentImageUrl || localInst?.instituteUserImageUrl || user?.imageUrl || undefined;
        const recordUserName = rec.studentName || userName; // Use student name from record
        const isChildRecord = rec.studentId && Number(rec.studentId) !== Number(user?.id); // Detect child records

        all.push({
          key: `${isChildRecord ? 'child' : 'own'}-${rec.date}-${rec.instituteId}-${rec.subjectId || rec.classId || 'x'}`,
          date: rec.date,
          markedAt: rec.markedAt && rec.markedAt !== rec.date ? rec.markedAt : undefined,
          status: rec.status,
          statusLabel: rec.statusLabel || toLabel(rec.status),
          instituteName: rec.instituteName,
          instituteLogoUrl: localInst?.logo || rec.instituteLogoUrl,
          instituteId: rec.instituteId,
          className: rec.className,
          subjectName: rec.subjectName,
          userName: recordUserName,
          userImageUrl,
          isChild: isChildRecord,
          sortTs: rec.timestamp || new Date(rec.date).getTime(),
        });
      }

      // Deduplicate by composite key (prevents duplicate DynamoDB records)
      const seen = new Set<string>();
      const deduped = all.filter(r => {
        if (seen.has(r.key)) return false;
        seen.add(r.key);
        return true;
      });
      deduped.sort((a, b) => b.sortTs - a.sortTs);
      
      setRecords(deduped);
      const now = Date.now();
      setCacheTime(now);
      setIsStale(false);
      
      // Cache the data
      try {
        localStorage.setItem(cacheKey, JSON.stringify(deduped));
        localStorage.setItem(cacheTimeKey, String(now));
      } catch (err) {
        console.warn('Failed to cache attendance data:', err);
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [days, filterInstituteId, user?.id, user?.imageUrl, user?.firstName, user?.lastName, user?.nameWithInitials, instituteMetaById]);

  useEffect(() => {
    load(true);
  }, [load]);

  const uniqueInstitutes = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of records) {
      if (r.instituteId && !map.has(r.instituteId)) map.set(r.instituteId, r.instituteName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [records]);

  // When filterInstituteId is provided (institute/class dashboard), always scope
  // the displayed records to that institute — even if the cache returned more.
  const filtered = filterInstituteId
    ? records.filter(r => r.instituteId === filterInstituteId)
    : (instituteFilter === 'all' ? records : records.filter(r => r.instituteId === instituteFilter));
  const displayed = filtered.slice(0, 8);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          Recent Attendance
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Day range toggle */}
          <div className="flex rounded-lg overflow-hidden border border-border text-xs">
            {([7, 14, 30] as const).map(d => (
              <button
                key={d}
                onClick={() => handleDaysChange(d)}
                className={`px-2.5 py-1 font-medium transition-colors ${
                  days === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >{d}d</button>
            ))}
          </div>
          {/* Institute filter */}
          {uniqueInstitutes.length > 1 && !filterInstituteId && (
            <select
              value={instituteFilter}
              onChange={e => setInstituteFilter(e.target.value)}
              className="text-xs border border-border rounded-lg px-2 py-1 bg-background text-foreground cursor-pointer max-w-[130px] truncate"
            >
              <option value="all">All Institutes</option>
              {uniqueInstitutes.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          )}
          {/* Refresh button - Show when data is stale (>1 hour) */}
          {isStale && cacheTime > 0 && (
            <button
              onClick={() => load(false)}
              disabled={loading}
              className="text-xs bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 disabled:opacity-50 px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1"
              title={cacheTime ? `Last updated: ${formatDistanceToNowStrict(cacheTime, { addSuffix: true })}` : ''}
            >
              <Clock className="h-3 w-3" />
              Refresh
            </button>
          )}
          {displayed.length > 0 && (
            <button
              onClick={() => navigate('/my-attendance')}
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >View All <ChevronRight className="h-3 w-3" /></button>
          )}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 px-2 py-2.5 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-2 bg-muted rounded w-2/3" />
              </div>
              <div className="h-5 w-16 bg-muted rounded-full" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <UserCheck className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No attendance records in the last {days} days</p>
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto pr-2 -mr-2 space-y-0.5 -mx-1">
          {displayed.map(rec => {
            const timeStr = rec.markedAt ? formatTime(rec.markedAt) : '';
            return (
              <div key={rec.key} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/40 transition-colors">
                {/* Avatar with institute badge */}
                <div className="relative flex-shrink-0">
                  {rec.userImageUrl ? (
                    <img
                      src={getImageUrl(rec.userImageUrl)}
                      alt={rec.userName}
                      loading="lazy"
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-border"
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-border text-sm font-bold ${getAvatarColor(rec.userName)}`}>
                      {getInitials(rec.userName)}
                    </div>
                  )}
                  {rec.instituteLogoUrl ? (
                    <img
                      src={getImageUrl(rec.instituteLogoUrl)}
                      alt=""
                      loading="lazy"
                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded object-cover ring-1 ring-background"
                    />
                  ) : (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded bg-primary/10 flex items-center justify-center ring-1 ring-background">
                      <Building2 className="h-2.5 w-2.5 text-primary" />
                    </div>
                  )}
                </div>
                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-semibold text-foreground truncate">{rec.userName}</span>
                    {rec.isChild && (
                      <span className="text-[9px] font-medium text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0">child</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {format(new Date(rec.date), 'MMM d')}
                    {timeStr ? ` at ${timeStr}` : ''}
                    {rec.instituteName ? ` · ${rec.instituteName}` : ''}
                    {rec.className ? ` · ${rec.className}` : ''}
                    {rec.subjectName ? ` · ${rec.subjectName}` : ''}
                  </p>
                </div>
                {/* Status */}
                <StatusPill status={rec.status} label={rec.statusLabel} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Quick Mark Attendance Widget (Teacher / Admin / Marker) ────

const QuickMarkAttendanceWidget = ({ onNavigate }: { onNavigate: (id: string) => void }) => (
  <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
    <div className="flex items-center gap-2 mb-3">
      <div className="p-1.5 rounded-lg bg-primary/10">
        <QrCode className="h-4 w-4 text-primary" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">Quick Mark Attendance</h3>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <button
        onClick={() => onNavigate('qr-attendance')}
        className="flex items-center justify-center gap-2 p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all text-sm font-medium"
      >
        <QrCode className="h-4 w-4" />
        QR / Scan
      </button>
      <button
        onClick={() => onNavigate('daily-attendance')}
        className="flex items-center justify-center gap-2 p-3 rounded-xl bg-muted hover:bg-accent text-foreground active:scale-95 transition-all text-sm font-medium border border-border"
      >
        <FileText className="h-4 w-4" />
        Manual Mark
      </button>
    </div>
  </div>
);

// ── Admin: Today's Attendance Widget ────────────────────────────

const AdminAttendanceWidget = ({ instituteId, onNavigate }: { instituteId: string; onNavigate: (id: string) => void }) => {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [yesterdayRate, setYesterdayRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const res = await adminAttendanceApi.getInstituteAttendance(instituteId, { startDate: today, endDate: today, limit: 1, page: 1 });
        if (!cancelled && res?.summary) setSummary(res.summary);

        // Yesterday for comparison
        const yd = new Date(); yd.setDate(yd.getDate() - 1);
        const ydStr = format(yd, 'yyyy-MM-dd');
        const yRes = await adminAttendanceApi.getInstituteAttendance(instituteId, { startDate: ydStr, endDate: ydStr, limit: 1, page: 1 });
        if (!cancelled && yRes?.summary) setYesterdayRate(yRes.summary.attendanceRate ?? null);
      } catch { /* silent */ } finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [instituteId]);

  if (loading) return <WidgetSkeleton />;
  if (!summary) return <EmptyWidget icon={UserCheck} title="No Attendance Data" message="No attendance recorded today" />;

  const rate = Math.round(summary.attendanceRate ?? 0);
  const total = summary.totalPresent + summary.totalAbsent + summary.totalLate + summary.totalLeft + summary.totalLeftEarly + summary.totalLeftLately;
  const diff = yesterdayRate != null ? Math.round(rate - yesterdayRate) : null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate('daily-attendance')}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Today's Overview
        </h3>
        <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">Live</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Attendance Rate</p>
          <p className="text-2xl font-bold text-foreground">{rate}%</p>
          {diff != null && (
            <p className={`text-[10px] flex items-center gap-1 mt-1 ${diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {diff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {diff >= 0 ? '+' : ''}{diff}% from yesterday
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Present / Total</p>
          <p className="text-2xl font-bold text-foreground">{summary.totalPresent}/{total}</p>
          {summary.totalAbsent > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">{summary.totalAbsent} absent</p>
          )}
        </div>
      </div>
      {(summary.totalLate > 0 || summary.totalLeftEarly > 0) && (
        <div className="flex gap-3 mt-3 pt-3 border-t border-border/50">
          {summary.totalLate > 0 && (
            <span className="text-[10px] text-amber-500 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {summary.totalLate} late
            </span>
          )}
          {summary.totalLeftEarly > 0 && (
            <span className="text-[10px] text-pink-500 flex items-center gap-1">
              <UserX className="h-3 w-3" /> {summary.totalLeftEarly} left early
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ── Admin: Payment Stats Widget ─────────────────────────────────

const AdminPaymentWidget = ({ instituteId, onNavigate }: { instituteId: string; onNavigate: (id: string) => void }) => {
  const [stats, setStats] = useState<PaymentStatsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await institutePaymentsApi.getPaymentStats(instituteId);
        if (!cancelled && res?.data) setStats(res.data);
      } catch { /* silent */ } finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [instituteId]);

  if (loading) return <WidgetSkeleton />;
  if (!stats) return <EmptyWidget icon={CreditCard} title="No Payment Data" message="No payment records available" />;

  const collectionPct = parseFloat(stats.collectionPercentage) || 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate('institute-payments')}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-blue-500" />
          Payment Collections
        </h3>
        <span className="text-xs text-muted-foreground">{stats.activePayments} active</span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Collected</p>
          <p className="text-2xl font-bold text-foreground">{Math.round(collectionPct)}%</p>
          <p className="text-[10px] text-muted-foreground mt-1">Rs. {stats.totalCollectedAmount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Expected</p>
          <p className="text-2xl font-bold text-foreground">Rs. {stats.totalExpectedAmount.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{stats.totalPayments} total payments</p>
        </div>
      </div>
      {stats.submissionStats.pendingSubmissions > 0 && (
        <div className="flex items-center gap-2 pt-3 border-t border-border/50">
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            {stats.submissionStats.pendingSubmissions} pending verification
          </span>
        </div>
      )}
    </div>
  );
};

// ── Teacher: Today's Schedule Widget ────────────────────────────

const TeacherScheduleWidget = ({ instituteId, onNavigate }: { instituteId: string; onNavigate: (id: string) => void }) => {
  const { user } = useAuth();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await lectureApi.getInstituteLectures({ instituteId, status: 'scheduled', limit: 20, sortBy: 'startTime', sortOrder: 'ASC' });
        if (!cancelled) {
          const now = new Date();
          const todayLectures = (res?.data || []).filter(l => l.startTime && isSameDay(new Date(l.startTime), now));
          setLectures(todayLectures.slice(0, 3));
        }
      } catch { /* silent */ } finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [instituteId, user?.id]);

  if (loading) return <WidgetSkeleton />;
  if (lectures.length === 0) return <EmptyWidget icon={Calendar} title="No Classes Today" message="Your schedule is clear for today" />;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate('lectures')}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4 text-indigo-500" />
          Today's Schedule
        </h3>
        <span className="text-xs font-medium text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded-full">
          {lectures.length} {lectures.length === 1 ? 'Class' : 'Classes'}
        </span>
      </div>
      <div className="space-y-3">
        {lectures.map((lecture, i) => {
          const isUpcoming = lecture.startTime && isAfter(new Date(lecture.startTime), new Date());
          return (
            <div key={lecture.id} className="flex items-start gap-3 relative">
              {i < lectures.length - 1 && <div className="w-1.5 h-full absolute left-[11px] top-6 bg-border -z-10" />}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 border-card mt-0.5 ${isUpcoming ? 'bg-indigo-500' : 'bg-muted'}`}>
                <div className={`w-2 h-2 rounded-full ${isUpcoming ? 'bg-white' : 'bg-muted-foreground'}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{lecture.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" /> {formatTime(lecture.startTime)}{lecture.endTime ? ` - ${formatTime(lecture.endTime)}` : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Teacher: Pending Homework Widget ────────────────────────────

const TeacherHomeworkWidget = ({ instituteId, onNavigate }: { instituteId: string; onNavigate: (id: string) => void }) => {
  const { selectedClass, selectedSubject } = useAuth();
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await homeworkApi.getHomework({ instituteId, isActive: true, limit: 10, sortBy: 'endDate', sortOrder: 'ASC' });
        if (!cancelled) {
          const active = (res?.data || []).filter(h => h.isActive && (h.submissionCount ?? 0) > 0);
          setHomeworks(active.slice(0, 3));
        }
      } catch { /* silent */ } finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [instituteId, selectedClass?.id, selectedSubject?.id]);

  if (loading) return <WidgetSkeleton />;
  if (homeworks.length === 0) return <EmptyWidget icon={CheckCircle2} title="All Caught Up" message="No pending homework to review" />;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate('homework')}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-orange-500" />
          Homework Activity
        </h3>
        <span className="text-xs text-muted-foreground">Recent</span>
      </div>
      <div className="space-y-2">
        {homeworks.map(hw => (
          <div key={hw.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-orange-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{hw.title}</p>
              <p className="text-xs text-muted-foreground">
                {hw.submissionCount ?? 0} submission{(hw.submissionCount ?? 0) !== 1 ? 's' : ''}
                {hw.class?.name ? ` · ${hw.class.name}` : ''}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Student: Upcoming Classes Widget ────────────────────────────

const StudentScheduleWidget = ({ instituteId, onNavigate }: { instituteId: string; onNavigate: (id: string) => void }) => {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await lectureApi.getLectures({ instituteId, status: 'scheduled', limit: 20, sortBy: 'startTime', sortOrder: 'ASC' });
        if (!cancelled) {
          const now = new Date();
          const todayLectures = (res?.data || []).filter(l => l.startTime && isSameDay(new Date(l.startTime), now));
          setLectures(todayLectures.slice(0, 3));
        }
      } catch { /* silent */ } finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [instituteId]);

  const accentColors = ['violet', 'emerald', 'blue'];

  if (loading) return <WidgetSkeleton />;
  if (lectures.length === 0) return <EmptyWidget icon={Calendar} title="No Classes Today" message="Enjoy your free time!" />;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate('lectures')}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4 text-violet-500" />
          Upcoming Classes
        </h3>
        <span className="text-xs font-medium text-violet-500 bg-violet-500/10 px-2 py-1 rounded-full">Today</span>
      </div>
      <div className="space-y-3">
        {lectures.map((lecture, i) => {
          const color = accentColors[i % accentColors.length];
          return (
            <div key={lecture.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/50 bg-muted/30">
              <div className={`w-10 h-10 rounded-lg bg-${color}-500/10 flex flex-col items-center justify-center shrink-0`}>
                {lecture.startTime ? (
                  <>
                    <span className={`text-[10px] font-bold text-${color}-600 uppercase`}>{format(new Date(lecture.startTime), 'hh:mm')}</span>
                    <span className={`text-[9px] text-${color}-500`}>{format(new Date(lecture.startTime), 'a')}</span>
                  </>
                ) : (
                  <Clock className={`h-4 w-4 text-${color}-500`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{lecture.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {lecture.venue || lecture.lectureType === 'online' ? 'Online' : ''}
                  {lecture.endTime ? ` · Until ${formatTime(lecture.endTime)}` : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Student: Assignments Due Widget ─────────────────────────────

const StudentHomeworkWidget = ({ instituteId, onNavigate }: { instituteId: string; onNavigate: (id: string) => void }) => {
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await homeworkApi.getHomework({ instituteId, isActive: true, limit: 10, sortBy: 'endDate', sortOrder: 'ASC' });
        if (!cancelled) {
          const now = new Date();
          const upcoming = (res?.data || []).filter(h => h.isActive && h.endDate && isAfter(new Date(h.endDate), now) && !h.hasSubmitted);
          setHomeworks(upcoming.slice(0, 3));
        }
      } catch { /* silent */ } finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [instituteId]);

  if (loading) return <WidgetSkeleton />;
  if (homeworks.length === 0) return <EmptyWidget icon={CheckCircle2} title="No Pending Assignments" message="You're all caught up!" />;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate('homework')}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-rose-500" />
          Assignments Due
        </h3>
        <span className="text-xs text-muted-foreground">Upcoming</span>
      </div>
      <div className="space-y-0">
        {homeworks.map(hw => {
          const dueDate = hw.endDate ? new Date(hw.endDate) : null;
          const isUrgent = dueDate && (dueDate.getTime() - Date.now()) < 2 * 24 * 60 * 60 * 1000; // within 2 days
          return (
            <div key={hw.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{hw.title}</p>
                {dueDate && (
                  <p className={`text-xs font-medium ${isUrgent ? 'text-rose-500' : 'text-amber-500'}`}>
                    Due {formatDistanceToNowStrict(dueDate, { addSuffix: true })}
                  </p>
                )}
              </div>
              <div className={`w-2 h-2 rounded-full shrink-0 ml-2 ${isUrgent ? 'bg-rose-500' : 'bg-amber-500'}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────

const DashboardWidgets = () => {
  const { selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const userRole = useInstituteRole();
  const navigate = useNavigate();

  const handleNavigate = (itemId: string) => {
    const context = {
      instituteId: selectedInstitute?.id,
      classId: selectedClass?.id,
      subjectId: selectedSubject?.id,
    };
    navigate(buildSidebarUrl(itemId, context));
  };

  if (!selectedInstitute) {
    return <AttendanceFeedWidget />;
  }

  const instituteId = selectedInstitute.id;

  // --- Admin Widgets ---
  if (userRole === 'InstituteAdmin') {
    return (
      <div className="space-y-3">
        <QuickMarkAttendanceWidget onNavigate={handleNavigate} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AdminAttendanceWidget instituteId={instituteId} onNavigate={handleNavigate} />
          <AdminPaymentWidget instituteId={instituteId} onNavigate={handleNavigate} />
        </div>
      </div>
    );
  }

  // --- Teacher Widgets ---
  if (userRole === 'Teacher') {
    return (
      <div className="space-y-3">
        <QuickMarkAttendanceWidget onNavigate={handleNavigate} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TeacherScheduleWidget instituteId={instituteId} onNavigate={handleNavigate} />
          <TeacherHomeworkWidget instituteId={instituteId} onNavigate={handleNavigate} />
        </div>
      </div>
    );
  }

  // --- Attendance Marker ---
  if (userRole === 'AttendanceMarker') {
    return (
      <div className="space-y-3">
        <QuickMarkAttendanceWidget onNavigate={handleNavigate} />
        <AdminAttendanceWidget instituteId={instituteId} onNavigate={handleNavigate} />
      </div>
    );
  }

  // --- Student Widgets ---
  if (userRole === 'Student') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StudentScheduleWidget instituteId={instituteId} onNavigate={handleNavigate} />
        <StudentHomeworkWidget instituteId={instituteId} onNavigate={handleNavigate} />
      </div>
    );
  }

  // --- Parent (institute selected) ---
  if (userRole === 'Parent') {
    return <AttendanceFeedWidget filterInstituteId={instituteId} />;
  }

  // Fallback
  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center min-h-[150px]">
      <CheckCircle2 className="h-6 w-6 text-primary mb-2" />
      <p className="text-sm text-muted-foreground">No widgets available for your role.</p>
    </div>
  );
};

export default DashboardWidgets;
