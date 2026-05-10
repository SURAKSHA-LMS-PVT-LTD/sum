import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSriLankaDateTime } from '@/utils/timezone';
import classAttendanceSessionsApi, {
  SessionGridResponse, GridStudentRow,
} from '@/api/classAttendanceSessions.api';
import { ArrowLeft, RefreshCw, Search, Download } from 'lucide-react';

interface Props {
  instituteId: string;
  classId: string;
  sessionIds: string[];
  onBack: () => void;
}

const STATUS_STYLE: Record<number, { bg: string; text: string; short: string }> = {
  1: { bg: '#dcfce7', text: '#166534', short: 'P' },
  0: { bg: '#fee2e2', text: '#991b1b', short: 'A' },
  2: { bg: '#fef9c3', text: '#854d0e', short: 'L' },
  3: { bg: '#dbeafe', text: '#1e40af', short: 'L' },
  4: { bg: '#ffedd5', text: '#9a3412', short: 'LE' },
  5: { bg: '#f3e8ff', text: '#6b21a8', short: 'LL' },
};

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function ClassAttendanceSessionGrid({ instituteId, classId, sessionIds, onBack }: Props) {
  const [data, setData] = useState<SessionGridResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await classAttendanceSessionsApi.getSessionGrid(instituteId, classId, sessionIds);
      setData(res);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load grid');
    } finally {
      setLoading(false);
    }
  }, [instituteId, classId, sessionIds.join(',')]);

  useEffect(() => { load(); }, [load]);

  const filteredStudents = (data?.students ?? []).filter(s =>
    !search ||
    s.studentName.toLowerCase().includes(search.toLowerCase()) ||
    (s.userIdInstitute ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (s.cardId ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  // Group sessions by group name for header display
  const sessionColumns = data?.sessions ?? [];

  // Count present/absent per session
  const sessionStats = sessionColumns.map(sess => {
    const present = filteredStudents.filter(s => s.sessions[sess.id]?.statusCode === 1 || s.sessions[sess.id]?.statusCode === 2).length;
    const absent  = filteredStudents.filter(s => s.sessions[sess.id]?.statusCode === 0).length;
    const marked  = filteredStudents.filter(s => s.sessions[sess.id]?.statusCode !== null).length;
    return { present, absent, marked, total: filteredStudents.length };
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Session Grid View</h2>
          <p className="text-sm text-muted-foreground">
            {sessionColumns.length} sessions · {filteredStudents.length} students
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-56">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search students..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Grid table */}
      {loading && !data ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              {/* Group header row — always shown */}
              <tr className="bg-muted/40">
                <th className="sticky left-0 z-10 bg-muted/40 px-3 py-1.5 text-left text-xs font-semibold border-r min-w-[200px] text-muted-foreground">
                  Group
                </th>
                {(() => {
                  const grouped: { groupName: string; color?: string; count: number }[] = [];
                  for (const sess of sessionColumns) {
                    const gn = sess.group?.name ?? '';
                    const color = sess.group?.color;
                    const last = grouped[grouped.length - 1];
                    if (last && last.groupName === gn) {
                      last.count++;
                    } else {
                      grouped.push({ groupName: gn, color, count: 1 });
                    }
                  }
                  return grouped.map((g, i) => (
                    <th
                      key={i}
                      colSpan={g.count}
                      className="px-2 py-1.5 text-center text-xs font-semibold border-r"
                      style={g.color ? { background: `${g.color}18`, color: g.color } : undefined}
                    >
                      {g.groupName || <span className="text-muted-foreground/50">—</span>}
                    </th>
                  ));
                })()}
              </tr>
              {/* Session header row */}
              <tr className="bg-muted">
                <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left text-xs font-semibold border-r min-w-[200px]">
                  Student
                </th>
                {sessionColumns.map((sess, i) => (
                  <th key={sess.id} className="px-2 py-2 text-center border-r min-w-[80px]">
                    <div className="text-xs font-semibold truncate max-w-[90px]">{sess.name}</div>
                    <div className="text-xs text-muted-foreground">{sess.startTime}</div>
                    {sess.isClosed && <Badge variant="outline" className="text-[10px] py-0 mt-0.5">Closed</Badge>}
                    {/* Stats */}
                    <div className="flex justify-center gap-1 mt-1">
                      <span style={{ color: '#166534', fontSize: 10 }}>{sessionStats[i]?.present ?? 0}P</span>
                      <span style={{ color: '#991b1b', fontSize: 10 }}>{sessionStats[i]?.absent ?? 0}A</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={sessionColumns.length + 1} className="text-center py-8 text-muted-foreground">
                    No students found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, rowIdx) => (
                  <tr
                    key={student.studentId}
                    className={rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                  >
                    {/* Student info (sticky) */}
                    <td className={`sticky left-0 z-10 px-3 py-2 border-r ${rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={student.imageUrl ? getImageUrl(student.imageUrl) : undefined} />
                          <AvatarFallback className="text-xs">{initials(student.studentName)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate max-w-[140px]">{student.studentName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {student.userIdInstitute && <span className="mr-1">{student.userIdInstitute}</span>}
                            {student.cardId && <span>{student.cardId}</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    {/* Session cells */}
                    {sessionColumns.map(sess => {
                      const cell = student.sessions[sess.id];
                      const code = cell?.statusCode ?? null;
                      const style = code !== null ? STATUS_STYLE[code] : null;
                      return (
                        <td key={sess.id} className="px-1 py-2 text-center border-r">
                          {style ? (
                            <div className="inline-block">
                              <span
                                className="text-xs font-bold px-2 py-0.5 rounded"
                                style={{ background: style.bg, color: style.text }}
                              >
                                {style.short}
                              </span>
                              {cell?.markedAt && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{formatSriLankaDateTime(cell.markedAt)}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_STYLE).map(([code, s]) => (
          <span key={code} className="flex items-center gap-1">
            <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.text }}>
              {s.short}
            </span>
            {['Absent','Present','Late','Left','Left Early','Left Lately'][Number(code)]}
          </span>
        ))}
        <span className="text-muted-foreground">— = Not Marked</span>
      </div>
    </div>
  );
}
