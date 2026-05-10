import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { lectureTrackingApi, RecordingSessionRow } from '@/api/lectureTracking.api';
import { lectureApi, Lecture } from '@/api/lecture.api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, PlayCircle, Clock, Loader2, User, ChevronDown, ChevronRight, Video } from 'lucide-react';
import { buildSidebarUrl, useContextUrlSync } from '@/utils/pageNavigation';
import PageContainer from '@/components/layout/PageContainer';

export default function StudentRecordingActivityPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedInstitute, selectedClass, selectedSubject, currentInstituteId, currentClassId, currentSubjectId } = useAuth();

  useContextUrlSync('lecture-recording-student');

  const studentId = searchParams.get('studentId') || '';
  const studentName = decodeURIComponent(searchParams.get('studentName') || 'Student');
  const lectureIds = (searchParams.get('ids') || '').split(',').filter(Boolean);

  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [sessions, setSessions] = useState<Record<string, RecordingSessionRow[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Load lecture metadata
  useEffect(() => {
    if (!lectureIds.length || !currentInstituteId) return;
    const fetchAll = async () => {
      const results: Lecture[] = [];
      for (const id of lectureIds) {
        try {
          const l = await lectureApi.getLectureById(id, false, { instituteId: currentInstituteId, classId: currentClassId, subjectId: currentSubjectId });
          results.push(l);
        } catch { /* skip */ }
      }
      setLectures(results);
    };
    fetchAll();
  }, [lectureIds.join(','), currentInstituteId]);

  // Load sessions for a lecture (filter by studentId)
  const loadSessions = useCallback(async (lectureId: string) => {
    if (sessions[lectureId] || loading[lectureId]) return;
    setLoading(p => ({ ...p, [lectureId]: true }));
    try {
      const rows = await lectureTrackingApi.getRecordingActivityReport(lectureId);
      // Filter to this student only
      const studentSessions = rows.filter(r => r.userId === studentId);
      setSessions(p => ({ ...p, [lectureId]: studentSessions }));
    } catch {
      setSessions(p => ({ ...p, [lectureId]: [] }));
    } finally {
      setLoading(p => ({ ...p, [lectureId]: false }));
    }
  }, [studentId, sessions, loading]);

  const toggleLecture = (lectureId: string) => {
    const isExp = !!expanded[lectureId];
    setExpanded(p => ({ ...p, [lectureId]: !isExp }));
    if (!isExp) loadSessions(lectureId);
  };

  const goBack = () => navigate(buildSidebarUrl('lecture-recording-attendance', {
    instituteId: currentInstituteId, classId: currentClassId, subjectId: currentSubjectId,
  }) + `?step=students&ids=${lectureIds.join(',')}`);

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
      {/* Header */}
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

      {/* Instruction */}
      <p className="text-xs text-muted-foreground px-1">
        Click on a lecture to expand and view this student's recording sessions. The activity chart shows
        how the student engaged with the recording (play, pause, seek, watching patterns).
      </p>

      {/* Lecture cards */}
      <div className="space-y-3">
        {lectureIds.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <PlayCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No lectures selected.</p>
          </div>
        ) : (
          lectureIds.map((lId, idx) => {
            const lecture = lectures.find(l => l.id === lId);
            const isExp = !!expanded[lId];
            const lectSessions = sessions[lId];
            return (
              <Card key={lId} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleLecture(lId)}
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
                    {loading[lId] ? <Loader2 className="h-4 w-4 animate-spin" /> : isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </div>

                {isExp && (
                  <div className="border-t border-border bg-muted/10">
                    {loading[lId] ? (
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

// ── Session card with GitHub-style heatmap ────────────────────────────────────

function SessionCard({ session, index }: { session: RecordingSessionRow; index: number }) {
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
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Watched: {formatSeconds(session.totalWatchedSeconds)}
          </span>
          <span>Last pos: {formatSeconds(session.lastPositionSeconds)}</span>
        </div>
      </div>
      <div className="p-4">
        <ActivityTimeline activities={session.activities} />
      </div>
    </div>
  );
}

// ── Activity Timeline (GitHub commit history style) ───────────────────────────

function ActivityTimeline({ activities }: {
  activities: Array<{ type: string; videoTimestamp: number; at: string }>;
}) {
  if (activities.length === 0) {
    return <p className="text-xs text-muted-foreground">No activity events recorded.</p>;
  }

  const BUCKET_SECS = 30;
  const maxTs = Math.max(...activities.map(a => a.videoTimestamp));
  const bucketCount = Math.max(Math.ceil(maxTs / BUCKET_SECS), 1);

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const from = i * BUCKET_SECS;
    const to = from + BUCKET_SECS;
    const acts = activities.filter(a => a.videoTimestamp >= from && a.videoTimestamp < to);
    return { from, to, acts, count: acts.length };
  });

  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  const colorForType = (type: string) => {
    if (type === 'PLAY') return 'bg-emerald-500';
    if (type === 'PAUSE') return 'bg-amber-400';
    if (type === 'SEEK') return 'bg-blue-500';
    if (type === 'HEARTBEAT') return 'bg-green-400';
    return 'bg-muted';
  };

  const intensityClass = (count: number) => {
    const ratio = count / maxCount;
    if (ratio === 0) return 'bg-muted/30';
    if (ratio < 0.25) return 'bg-emerald-200 dark:bg-emerald-900';
    if (ratio < 0.5) return 'bg-emerald-300 dark:bg-emerald-700';
    if (ratio < 0.75) return 'bg-emerald-400 dark:bg-emerald-600';
    return 'bg-emerald-600 dark:bg-emerald-400';
  };

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-medium text-muted-foreground">Activity map ({bucketCount} × 30s buckets)</span>
        {(['PLAY', 'HEARTBEAT', 'PAUSE', 'SEEK'] as const).map(t => (
          <span key={t} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${colorForType(t)}`} />
            {t.toLowerCase()}
          </span>
        ))}
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-2">
          Less <span className="inline-flex gap-px">{['bg-muted/30','bg-emerald-200 dark:bg-emerald-900','bg-emerald-300 dark:bg-emerald-700','bg-emerald-400 dark:bg-emerald-600','bg-emerald-600 dark:bg-emerald-400'].map((c,i) => <span key={i} className={`inline-block w-2.5 h-2.5 rounded-sm ${c}`} />)}</span> More
        </span>
      </div>

      {/* Heatmap grid */}
      <TooltipProvider delayDuration={80}>
        <div className="flex flex-wrap gap-0.5">
          {buckets.map((b, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div className={`w-3.5 h-3.5 rounded-sm cursor-default transition-colors ${intensityClass(b.count)}`} />
              </TooltipTrigger>
              <TooltipContent className="text-xs max-w-[200px]">
                <div className="font-medium mb-1">{formatSeconds(b.from)} – {formatSeconds(b.to)}</div>
                {b.acts.length === 0 ? <div className="text-muted-foreground">No activity</div> : (
                  <div className="space-y-0.5">
                    {b.acts.slice(0, 6).map((a, j) => (
                      <div key={j} className="flex items-center gap-1.5">
                        <span className={`inline-block w-2 h-2 rounded-sm ${colorForType(a.type)}`} />
                        <span>{a.type.toLowerCase()}</span>
                        <span className="text-muted-foreground text-[10px]">@{formatSeconds(a.videoTimestamp)}</span>
                      </div>
                    ))}
                    {b.acts.length > 6 && <div className="text-muted-foreground">+{b.acts.length - 6} more</div>}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* Summary stats */}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span><strong className="text-foreground">{activities.filter(a => a.type === 'PLAY').length}</strong> plays</span>
        <span><strong className="text-foreground">{activities.filter(a => a.type === 'PAUSE').length}</strong> pauses</span>
        <span><strong className="text-foreground">{activities.filter(a => a.type === 'SEEK').length}</strong> seeks</span>
        <span><strong className="text-foreground">{activities.filter(a => a.type === 'HEARTBEAT').length}</strong> heartbeats</span>
        <span>Total events: <strong className="text-foreground">{activities.length}</strong></span>
      </div>
    </div>
  );
}

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}
