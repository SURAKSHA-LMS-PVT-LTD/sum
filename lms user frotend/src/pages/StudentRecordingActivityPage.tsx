import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { lectureTrackingApi, RecordingSessionRow, RecordingActivityRow } from '@/api/lectureTracking.api';
import { lectureApi, Lecture } from '@/api/lecture.api';
import { subjectRecordingsApi } from '@/api/subjectRecordings.api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, PlayCircle, Clock, Loader2, User, ChevronDown, ChevronRight, Video, BarChart2, List } from 'lucide-react';
import { buildSidebarUrl, useContextUrlSync } from '@/utils/pageNavigation';
import PageContainer from '@/components/layout/PageContainer';

export default function StudentRecordingActivityPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedInstitute, selectedClass, selectedSubject, currentInstituteId, currentClassId, currentSubjectId } = useAuth();

  useContextUrlSync('lecture-recording-student');

  const studentId = searchParams.get('studentId') || '';
  const studentName = decodeURIComponent(searchParams.get('studentName') || 'Student');
  const allIds = (searchParams.get('ids') || '').split(',').filter(Boolean);
  // IDs prefixed with "sr:" are subject recordings; plain IDs are old-system lectures
  const lectureIds = allIds.filter(id => !id.startsWith('sr:'));
  const subjectRecordingIds = allIds.filter(id => id.startsWith('sr:')).map(id => id.slice(3));

  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [sessions, setSessions] = useState<Record<string, RecordingSessionRow[]>>({});
  // Subject recordings: a SINGLE call returns metadata + watching data for ALL of the
  // student's recordings, indexed here by recording id ("sr:<id>"). No per-item fetch.
  const [srActivity, setSrActivity] = useState<Record<string, any>>({});
  const [srLoaded, setSrLoaded] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // BUG-02: loadingRef tracks in-flight requests to prevent stale-closure races
  const loadingRef = useRef<Record<string, boolean>>({});

  // Fetch old-system lecture metadata (one call per id — no batch endpoint exists)
  useEffect(() => {
    if (!currentInstituteId || !lectureIds.length) return;
    let cancelled = false;
    const fetchLectures = async () => {
      const results: Lecture[] = [];
      for (const id of lectureIds) {
        try {
          const l = await lectureApi.getLectureById(id, false, { instituteId: currentInstituteId, classId: currentClassId, subjectId: currentSubjectId });
          results.push(l);
        } catch { /* skip */ }
      }
      if (!cancelled) setLectures(results);
    };
    fetchLectures();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureIds.join(','), currentInstituteId, currentClassId, currentSubjectId]);

  // Fetch ALL subject-recording activity for this student in ONE call, index by id.
  useEffect(() => {
    if (!currentInstituteId || !currentClassId || !studentId || !subjectRecordingIds.length) return;
    let cancelled = false;
    setSrLoaded(false);
    const fetchActivity = async () => {
      try {
        const all = await subjectRecordingsApi.getStudentActivities(
          studentId, currentInstituteId, currentClassId, currentSubjectId || undefined,
        );
        if (cancelled) return;
        const indexed: Record<string, any> = {};
        for (const a of all as any[]) {
          if (a?.recording?.id) indexed[`sr:${a.recording.id}`] = a;
        }
        setSrActivity(indexed);
      } catch {
        if (!cancelled) setSrActivity({});
      } finally {
        if (!cancelled) setSrLoaded(true);
      }
    };
    fetchActivity();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectRecordingIds.join(','), studentId, currentInstituteId, currentClassId, currentSubjectId]);

  // Old-system lectures load their per-session detail lazily on expand.
  const loadSessions = useCallback(async (id: string) => {
    // Subject recordings are already loaded in bulk — nothing to fetch on expand.
    if (id.startsWith('sr:')) return;
    // BUG-02: use ref to guard against stale closure reading old `loading` state
    if (loadingRef.current[id]) return;
    loadingRef.current = { ...loadingRef.current, [id]: true };
    setLoading(p => ({ ...p, [id]: true }));
    try {
      // BUG-01: use per-student endpoint instead of fetching all students and filtering
      const studentSessions = await lectureTrackingApi.getStudentRecordingSessions(id, studentId);
      setSessions(p => ({ ...p, [id]: studentSessions }));
    } catch {
      setSessions(p => ({ ...p, [id]: [] }));
    } finally {
      loadingRef.current = { ...loadingRef.current, [id]: false };
      setLoading(p => ({ ...p, [id]: false }));
    }
  }, [studentId]);

  const toggleLecture = (id: string) => {
    const isExp = !!expanded[id];
    setExpanded(p => ({ ...p, [id]: !isExp }));
    if (!isExp) loadSessions(id);
  };

  const goBack = () => navigate(buildSidebarUrl('lecture-recording-attendance', {
    instituteId: currentInstituteId, classId: currentClassId, subjectId: currentSubjectId,
  }) + `?step=students&ids=${allIds.join(',')}`);

  if (!selectedInstitute || !selectedClass) {
    return (
      <PageContainer maxWidth="full" className="h-full">
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="h-14 w-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
            <Video className="h-7 w-7 text-purple-500" />
          </div>
          <p className="text-sm text-muted-foreground">Invalid context.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full" className="h-full">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={goBack} className="rounded-full shrink-0 h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">{studentName}</h1>
                <p className="text-xs text-muted-foreground">
                  Recording activity · {selectedClass.name}{selectedSubject ? ` · ${selectedSubject.name}` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {allIds.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PlayCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No recordings selected.</p>
            </div>
          ) : (
            allIds.map((rawId, idx) => {
              const isSR = rawId.startsWith('sr:');
              const isExp = !!expanded[rawId];
              if (isSR) {
                const activity = srActivity[rawId];
                const watching = activity?.watching ?? null;
                const title = activity?.recording?.title || `Monthly Recording ${idx + 1}`;
                return (
                  <Card key={rawId} className="overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleLecture(rawId)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                          <Video className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{title}</p>
                          <Badge variant="outline" className="text-[9px] h-3.5 px-1.5 text-blue-600 border-blue-200 mt-0.5">Monthly</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {srLoaded && (
                          <Badge variant={watching ? 'secondary' : 'outline'} className="text-xs">
                            {watching ? `${watching.sessionCount} session${watching.sessionCount !== 1 ? 's' : ''}` : 'Not watched'}
                          </Badge>
                        )}
                        {!srLoaded ? <Loader2 className="h-4 w-4 animate-spin" /> : isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </div>
                    {isExp && (
                      <div className="border-t border-border bg-muted/10">
                        {!srLoaded ? (
                          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                        ) : !watching ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <PlayCircle className="h-6 w-6 mx-auto mb-1 opacity-30" />
                            <p className="text-sm">This student has not watched this recording.</p>
                          </div>
                        ) : (
                          <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <div className="rounded-lg bg-card border border-border/60 p-3">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sessions</p>
                                <p className="text-lg font-bold text-primary">{watching.sessionCount}</p>
                              </div>
                              <div className="rounded-lg bg-card border border-border/60 p-3">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Watched</p>
                                <p className="text-lg font-bold">{watching.totalWatchedMinutes}m</p>
                              </div>
                              {watching.completionPercent !== null && (
                                <div className="rounded-lg bg-card border border-border/60 p-3">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Progress</p>
                                  <p className="text-lg font-bold text-green-600">{watching.completionPercent}%</p>
                                </div>
                              )}
                            </div>
                            {watching.firstWatchedAt && (
                              <p className="text-xs text-muted-foreground">
                                First watched: {new Date(watching.firstWatchedAt).toLocaleString()}
                                {watching.lastWatchedAt && ` · Last: ${new Date(watching.lastWatchedAt).toLocaleString()}`}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              }
              // Old-system lecture
              const lecture = lectures.find(l => l.id === rawId);
              const lectSessions = sessions[rawId];
              return (
                <Card key={rawId} className="overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleLecture(rawId)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <Video className="h-4 w-4 text-purple-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{lecture?.title || `Lecture ${idx + 1}`}</p>
                        {lecture?.startTime && (
                          <p className="text-xs text-muted-foreground">{new Date(lecture.startTime).toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {lectSessions && (
                        <Badge variant={lectSessions.length > 0 ? 'secondary' : 'outline'} className="text-xs">
                          {lectSessions.length} session{lectSessions.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                      {loading[rawId] ? <Loader2 className="h-4 w-4 animate-spin" /> : isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </div>

                  {isExp && (
                    <div className="border-t border-border bg-muted/10">
                      {loading[rawId] ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                      ) : !lectSessions || lectSessions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <PlayCircle className="h-6 w-6 mx-auto mb-1 opacity-30" />
                          <p className="text-sm">No recording sessions for this student.</p>
                        </div>
                      ) : (
                        <div className="p-4 space-y-4">
                          {lectSessions.map((session, si) => (
                            <SessionCard key={session.sessionId} session={session} index={si} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </PageContainer>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({ session, index }: { session: RecordingSessionRow; index: number }) {
  const [view, setView] = useState<'log' | 'heatmap'>('log');

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-semibold text-foreground">Session {index + 1}</p>
          <p className="text-[11px] text-muted-foreground">
            Started: {new Date(session.startTime).toLocaleString()}
            {session.endTime && ` · Ended: ${new Date(session.endTime).toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Watched: {fmtSec(session.totalWatchedSeconds)}</span>
            <span>Last pos: {fmtSec(session.lastPositionSeconds)}</span>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setView('log')}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] font-semibold transition-colors ${view === 'log' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            >
              <List className="h-3 w-3" /> Log
            </button>
            <button
              type="button"
              onClick={() => setView('heatmap')}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] font-semibold transition-colors ${view === 'heatmap' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            >
              <BarChart2 className="h-3 w-3" /> Map
            </button>
          </div>
        </div>
      </div>
      <div className="p-4">
        {view === 'log'
          ? <ActivityLog activities={session.activities} sessionStart={session.startTime} />
          : <ActivityHeatmap activities={session.activities} />
        }
      </div>
    </div>
  );
}

// ── Activity Log — grouped rows ───────────────────────────────────────────────
// Format: video range | wall time range | activity | speed | browser size %

function ActivityLog({ activities, sessionStart }: {
  activities: RecordingActivityRow[];
  sessionStart: string;
}) {
  if (activities.length === 0) {
    return <p className="text-xs text-muted-foreground">No activity events recorded.</p>;
  }

  // Build display rows: merge WATCH_RANGE as primary; individual events as fallback
  const rows = buildLogRows(activities);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
            <th className="text-left py-1.5 pr-3 whitespace-nowrap">Video range</th>
            <th className="text-left py-1.5 pr-3 whitespace-nowrap">Wall time</th>
            <th className="text-left py-1.5 pr-3">Activity</th>
            <th className="text-left py-1.5 pr-3 whitespace-nowrap">Speed</th>
            <th className="text-left py-1.5 whitespace-nowrap">Browser</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              <td className="py-1.5 pr-3 font-mono whitespace-nowrap text-foreground">
                {fmtSec(row.videoFrom)}
                {row.videoTo !== null && row.videoTo !== row.videoFrom ? ` – ${fmtSec(row.videoTo)}` : ''}
              </td>
              <td className="py-1.5 pr-3 font-mono whitespace-nowrap text-muted-foreground">
                {row.wallFrom ? fmtWallTime(row.wallFrom) : '—'}
                {row.wallTo && row.wallTo !== row.wallFrom ? ` – ${fmtWallTime(row.wallTo)}` : ''}
              </td>
              <td className="py-1.5 pr-3">
                <ActivityBadge type={row.type} />
              </td>
              <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">
                {row.speed != null && row.speed !== 1 ? `${row.speed}×` : 'normal'}
              </td>
              <td className="py-1.5 text-muted-foreground whitespace-nowrap">
                {row.browserPct != null ? `${row.browserPct}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface LogRow {
  videoFrom: number;
  videoTo: number | null;
  wallFrom: number | null;
  wallTo: number | null;
  type: string;
  speed: number | null;
  browserPct: number | null;
}

function buildLogRows(activities: RecordingActivityRow[]): LogRow[] {
  return activities.map(a => {
    const isRange = a.type === 'WATCH_RANGE';
    const browserPct = (a.tabWidth != null && a.screenWidth != null && a.screenWidth > 0)
      ? Math.round((a.tabWidth / a.screenWidth) * 100)
      : null;
    const wallTo = (isRange && a.watchedSeconds != null && a.wallTime != null)
      ? a.wallTime + a.watchedSeconds * 1000
      : null;
    return {
      videoFrom: isRange ? (a.rangeFrom ?? a.videoTimestamp) : a.videoTimestamp,
      videoTo: isRange ? (a.rangeTo ?? null) : null,
      wallFrom: a.wallTime,
      wallTo,
      type: a.type,
      speed: a.speed,
      browserPct,
    };
  });
}

function ActivityBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    WATCH_RANGE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    PLAY:        'bg-green-100 text-green-700 border-green-200',
    PAUSE:       'bg-amber-100 text-amber-700 border-amber-200',
    SEEK:        'bg-blue-100 text-blue-700 border-blue-200',
    HEARTBEAT:   'bg-slate-100 text-slate-600 border-slate-200',
    SPEED_CHANGE:'bg-purple-100 text-purple-700 border-purple-200',
    TAB_HIDDEN:  'bg-rose-100 text-rose-600 border-rose-200',
    TAB_VISIBLE: 'bg-sky-100 text-sky-600 border-sky-200',
  };
  const cls = styles[type] ?? 'bg-muted text-muted-foreground border-border';
  const label = type === 'WATCH_RANGE' ? 'Watching' : type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ');
  return <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold ${cls}`}>{label}</span>;
}

// ── Activity Heatmap (GitHub-style) ──────────────────────────────────────────

function ActivityHeatmap({ activities }: { activities: RecordingActivityRow[] }) {
  if (activities.length === 0) {
    return <p className="text-xs text-muted-foreground">No activity events recorded.</p>;
  }

  const BUCKET_SECS = 30;
  // For WATCH_RANGE, spread coverage across buckets
  const bucketHits = new Map<number, { count: number; types: string[] }>();
  for (const a of activities) {
    const from = a.type === 'WATCH_RANGE' ? (a.rangeFrom ?? a.videoTimestamp) : a.videoTimestamp;
    const to   = a.type === 'WATCH_RANGE' ? (a.rangeTo ?? from) : from;
    const startBucket = Math.floor(from / BUCKET_SECS);
    const endBucket   = Math.floor(to   / BUCKET_SECS);
    for (let b = startBucket; b <= endBucket; b++) {
      const cur = bucketHits.get(b) ?? { count: 0, types: [] };
      cur.count++;
      if (!cur.types.includes(a.type)) cur.types.push(a.type);
      bucketHits.set(b, cur);
    }
  }

  const maxBucket = Math.max(...bucketHits.keys(), 0);
  const buckets = Array.from({ length: maxBucket + 1 }, (_, i) => ({
    i,
    from: i * BUCKET_SECS,
    to: (i + 1) * BUCKET_SECS,
    ...(bucketHits.get(i) ?? { count: 0, types: [] }),
  }));
  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  const intensityClass = (count: number) => {
    const r = count / maxCount;
    if (r === 0) return 'bg-muted/30';
    if (r < 0.25) return 'bg-emerald-200 dark:bg-emerald-900';
    if (r < 0.5)  return 'bg-emerald-300 dark:bg-emerald-700';
    if (r < 0.75) return 'bg-emerald-400 dark:bg-emerald-600';
    return 'bg-emerald-600 dark:bg-emerald-400';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Activity map ({buckets.length} × 30s buckets)</span>
        <span className="flex items-center gap-0.5 ml-2">
          Less {['bg-muted/30','bg-emerald-200','bg-emerald-300','bg-emerald-400','bg-emerald-600'].map((c,i) => (
            <span key={i} className={`inline-block w-2.5 h-2.5 rounded-sm ${c}`} />
          ))} More
        </span>
      </div>
      <TooltipProvider delayDuration={80}>
        <div className="flex flex-wrap gap-0.5">
          {buckets.map(b => (
            <Tooltip key={b.i}>
              <TooltipTrigger asChild>
                <div className={`w-3.5 h-3.5 rounded-sm cursor-default transition-colors ${intensityClass(b.count)}`} />
              </TooltipTrigger>
              <TooltipContent className="text-xs max-w-[180px]">
                <div className="font-medium mb-0.5">{fmtSec(b.from)} – {fmtSec(b.to)}</div>
                {b.count === 0
                  ? <span className="text-muted-foreground">No activity</span>
                  : <span>{b.types.join(', ')}</span>
                }
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {(['WATCH_RANGE','PLAY','PAUSE','SEEK','HEARTBEAT','SPEED_CHANGE'] as const).map(t => {
          const n = activities.filter(a => a.type === t).length;
          return n > 0 ? <span key={t}><strong className="text-foreground">{n}</strong> {t.toLowerCase().replace('_',' ')}</span> : null;
        })}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSec(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

function fmtWallTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-LK', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
