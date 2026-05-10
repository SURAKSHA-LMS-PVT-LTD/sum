import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { lectureApi, Lecture } from '@/api/lecture.api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft, PlayCircle, RefreshCw, Search, ChevronRight,
  Loader2, User, BookOpen, Hash, IdCard, Video, Users,
  CheckCircle2, Circle,
} from 'lucide-react';
import { buildSidebarUrl, useContextUrlSync } from '@/utils/pageNavigation';
import { enrollmentApi } from '@/api/enrollment.api';
import { getImageUrl } from '@/utils/imageUrlHelper';
import PageContainer from '@/components/layout/PageContainer';

interface Student {
  id: string;
  name: string;
  imageUrl?: string;
  userIdByInstitute?: string;
  email?: string;
}

export default function LectureRecordingAttendancePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, selectedInstitute, selectedClass, selectedSubject, currentInstituteId, currentClassId, currentSubjectId } = useAuth();
  const role = useInstituteRole();
  const canManage = role === 'InstituteAdmin' || role === 'Teacher';

  useContextUrlSync('lecture-recording-attendance');

  // Lecture list
  const [classLectures, setClassLectures] = useState<Lecture[]>([]);
  const [subjectLectures, setSubjectLectures] = useState<Lecture[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [includeSubject, setIncludeSubject] = useState(
    () => searchParams.get('incSubj') === '1' && !!currentSubjectId
  );

  // Selected IDs in URL
  const selectedIds = (searchParams.get('ids') || '').split(',').filter(Boolean);
  const setSelectedIds = (ids: string[]) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (ids.length) next.set('ids', ids.join(',')); else next.delete('ids');
      return next;
    }, { replace: true });
  };

  // Student list
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Active step: 'select' or 'students'
  const step = (searchParams.get('step') as 'select' | 'students') || 'select';
  const setStep = (s: 'select' | 'students') => {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('step', s); return n; }, { replace: true });
  };

  // Load lectures
  const fetchLectures = useCallback(async () => {
    if (!currentInstituteId || !currentClassId) return;
    setLoadingLectures(true);
    try {
      const clsRes = await lectureApi.getLectures({ classId: currentClassId, instituteId: currentInstituteId });
      const clsArr: Lecture[] = (clsRes as any)?.data ?? [];
      setClassLectures(clsArr.filter(l => l.recAttendanceEnabled));
      if (includeSubject && currentSubjectId) {
        const res = await lectureApi.getLectures({
          instituteId: currentInstituteId, classId: currentClassId, subjectId: currentSubjectId,
        });
        const arr: Lecture[] = (res as any)?.data ?? [];
        setSubjectLectures(arr.filter(l => l.recAttendanceEnabled));
      } else {
        setSubjectLectures([]);
      }
    } catch {
      setClassLectures([]); setSubjectLectures([]);
    } finally {
      setLoadingLectures(false);
    }
  }, [currentInstituteId, currentClassId, currentSubjectId, includeSubject]);

  useEffect(() => { fetchLectures(); }, [fetchLectures]);

  // Load students using the same API as the /students page
  const fetchStudents = useCallback(async () => {
    if (!currentInstituteId || !currentClassId) return;
    setLoadingStudents(true);
    try {
      const summary = await enrollmentApi.getClassEnrollmentSummary(
        currentInstituteId,
        currentClassId,
        'all',
        { userId: user?.id, role: role || 'User', instituteId: currentInstituteId, classId: currentClassId }
      );
      const seen = new Set<string>();
      const studentList: Student[] = [];
      for (const s of summary) {
        if (seen.has(s.studentId)) continue;
        seen.add(s.studentId);
        studentList.push({
          id: s.studentId,
          name: s.name || 'Unknown',
          imageUrl: s.imageUrl || undefined,
          userIdByInstitute: (s as any).userIdByInstitute || (s as any).studentIdByInstitute || undefined,
          email: s.email || undefined,
        });
      }
      setStudents(studentList);
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [currentInstituteId, currentClassId, user?.id, role]);

  useEffect(() => { if (step === 'students') fetchStudents(); }, [step, fetchStudents]);

  const allLectures = [...classLectures, ...subjectLectures];
  const selectedLectures = allLectures.filter(l => selectedIds.includes(l.id));
  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()));

  const toggleLecture = (id: string) =>
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);

  const goToStudent = (studentId: string) => {
    const url = buildSidebarUrl('lecture-recording-student', {
      instituteId: currentInstituteId, classId: currentClassId, subjectId: currentSubjectId,
    });
    navigate(`${url}?studentId=${studentId}&ids=${selectedIds.join(',')}&studentName=${encodeURIComponent(filteredStudents.find(s => s.id === studentId)?.name || '')}`);
  };

  const goBack = () => {
    if (step === 'students') {
      setStep('select');
    } else {
      navigate(buildSidebarUrl('dashboard', {
        instituteId: currentInstituteId, classId: currentClassId, subjectId: currentSubjectId,
      }));
    }
  };

  if (!selectedInstitute || !selectedClass) {
    return (
      <PageContainer maxWidth="full" className="h-full">
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="h-14 w-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
            <PlayCircle className="h-7 w-7 text-purple-500" />
          </div>
          <p className="text-sm text-muted-foreground">Select a class to view recording attendance.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full" className="h-full">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={goBack}
          className="rounded-xl h-9 w-9 shrink-0 border-border/60"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <Video className="h-4 w-4 text-purple-500" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight leading-none">Recording Session Attendance</h1>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {selectedClass.name}{selectedSubject ? ` · ${selectedSubject.name}` : ''} · {selectedInstitute.name}
              </p>
            </div>
          </div>
        </div>

        {/* Subject toggle */}
        {canManage && currentSubjectId && (
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none bg-muted/60 hover:bg-muted px-3 py-2 rounded-xl border border-border/40 transition-colors shrink-0">
            <Checkbox
              checked={includeSubject}
              onCheckedChange={v => {
                setIncludeSubject(!!v);
                setSearchParams(prev => {
                  const n = new URLSearchParams(prev);
                  if (v) n.set('incSubj', '1'); else n.delete('incSubj');
                  return n;
                }, { replace: true });
              }}
            />
            <BookOpen className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium">Subject Lectures</span>
          </label>
        )}
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-0 mb-6">
        {[
          { key: 'select', label: 'Select Lectures', icon: Video, num: 1 },
          { key: 'students', label: 'Select Student', icon: Users, num: 2 },
          { key: 'activity', label: 'View Activity', icon: CheckCircle2, num: 3 },
        ].map((s, i, arr) => {
          const isActive = s.key === step;
          const isDone = (step === 'students' && s.key === 'select') || (step === 'activity' && s.key !== 'activity');
          return (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                isActive ? 'bg-primary text-primary-foreground shadow-sm' :
                isDone ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'
              }`}>
                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isActive ? 'bg-primary-foreground/20' : isDone ? 'bg-primary/20' : 'bg-background/50'
                }`}>
                  {isDone ? <CheckCircle2 className="h-3 w-3" /> : s.num}
                </div>
                <span className="text-xs font-medium hidden sm:block">{s.label}</span>
              </div>
              {i < arr.length - 1 && (
                <div className={`h-px w-6 shrink-0 ${isDone ? 'bg-primary/40' : 'bg-border'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* STEP 1 — Select Lectures */}
      {step === 'select' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Lecture List */}
          <div className="lg:col-span-2">
            <Card className="border-border/60">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div>
                  <h2 className="text-sm font-semibold">Recording Lectures</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {allLectures.length} lecture{allLectures.length !== 1 ? 's' : ''} with recording tracking
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedIds(allLectures.map(l => l.id))}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-border">·</span>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="text-[11px] text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchLectures}
                    disabled={loadingLectures}
                    className="h-7 text-xs px-2.5 ml-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingLectures ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              <CardContent className="p-3 space-y-1 max-h-[calc(100vh-360px)] overflow-y-auto">
                {loadingLectures ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))
                ) : allLectures.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                      <PlayCircle className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">No recording-tracked lectures</p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">Enable recording attendance on lectures first</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {classLectures.length > 0 && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 pt-1 pb-0.5">
                        Class Lectures
                      </p>
                    )}
                    {classLectures.map(lec => (
                      <RecordingLectureItem
                        key={lec.id}
                        lec={lec}
                        selected={selectedIds.includes(lec.id)}
                        onToggle={toggleLecture}
                      />
                    ))}
                    {subjectLectures.length > 0 && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 pt-2 pb-0.5">
                        <BookOpen className="h-2.5 w-2.5 inline mr-1" />
                        {selectedSubject?.name} Lectures
                      </p>
                    )}
                    {subjectLectures.map(lec => (
                      <RecordingLectureItem
                        key={lec.id}
                        lec={lec}
                        selected={selectedIds.includes(lec.id)}
                        onToggle={toggleLecture}
                        subjectLabel={selectedSubject?.name}
                      />
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Selection Summary Sidebar */}
          <div className="space-y-4">
            <Card className="border-border/60">
              <div className="px-5 py-4 border-b border-border/50">
                <h2 className="text-sm font-semibold">Selection Summary</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Review before continuing</p>
              </div>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Selected lectures</span>
                  <span className="text-sm font-bold text-primary">{selectedIds.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Total available</span>
                  <span className="text-sm font-medium">{allLectures.length}</span>
                </div>

                {selectedLectures.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-border/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Selected</p>
                    <div className="space-y-1 max-h-[160px] overflow-y-auto">
                      {selectedLectures.map(l => (
                        <div key={l.id} className="flex items-center gap-2 text-xs py-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                          <span className="truncate text-foreground/80">{l.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  disabled={selectedIds.length === 0}
                  onClick={() => setStep('students')}
                >
                  Continue to Students
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                {selectedIds.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center">
                    Select at least one lecture to continue
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* STEP 2 — Select Student */}
      {step === 'students' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Student List */}
          <div className="lg:col-span-2">
            <Card className="border-border/60">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div>
                  <h2 className="text-sm font-semibold">Select a Student</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {loadingStudents ? 'Loading…' : `${filteredStudents.length} student${filteredStudents.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchStudents}
                  disabled={loadingStudents}
                  className="h-7 text-xs px-2.5"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingStudents ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Search */}
              <div className="px-4 py-3 border-b border-border/40">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name…"
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-border/50 rounded-lg bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  />
                </div>
              </div>

              <CardContent className="p-3 max-h-[calc(100vh-380px)] overflow-y-auto space-y-1">
                {loadingStudents ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-2.5 w-24" />
                      </div>
                    </div>
                  ))
                ) : filteredStudents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                      <User className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {studentSearch ? 'No students match your search' : 'No students found'}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {studentSearch ? 'Try a different name' : 'Enroll students to this class first'}
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredStudents.map(student => {
                    const initials = student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <button
                        key={student.id}
                        onClick={() => goToStudent(student.id)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-primary/5 hover:border-primary/20 border border-transparent transition-all group text-left"
                      >
                        <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border/60">
                          {student.imageUrl && (
                            <AvatarImage src={getImageUrl(student.imageUrl)} alt={student.name} />
                          )}
                          <AvatarFallback className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-primary text-xs font-bold">
                            {initials || <User className="h-4 w-4" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                            {student.name}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {student.userIdByInstitute && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <IdCard className="h-2.5 w-2.5" />{student.userIdByInstitute}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Hash className="h-2.5 w-2.5" />{student.id}
                            </span>
                            {student.email && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                                {student.email}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Selected Lectures Panel */}
          <div className="space-y-4">
            <Card className="border-border/60">
              <div className="px-5 py-4 border-b border-border/50">
                <h2 className="text-sm font-semibold">Selected Lectures</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedIds.length} lecture{selectedIds.length !== 1 ? 's' : ''} selected</p>
              </div>
              <CardContent className="p-4 space-y-2">
                {selectedLectures.map(l => (
                  <div key={l.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10">
                    <div className="h-6 w-6 rounded-md bg-purple-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Video className="h-3 w-3 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{l.title}</p>
                      {l.startTime && (
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(l.startTime).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs mt-2"
                  onClick={() => setStep('select')}
                >
                  <ArrowLeft className="h-3 w-3 mr-1.5" />
                  Change Selection
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RecordingLectureItem({ lec, selected, onToggle, subjectLabel }: {
  lec: Lecture; selected: boolean; onToggle: (id: string) => void; subjectLabel?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all border ${
        selected
          ? 'bg-purple-500/8 border-purple-500/25 shadow-sm'
          : 'hover:bg-muted/50 border-transparent hover:border-border/40'
      }`}
      onClick={() => onToggle(lec.id)}
    >
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
        selected ? 'bg-purple-500/15' : 'bg-muted'
      }`}>
        {selected
          ? <CheckCircle2 className="h-4 w-4 text-purple-600" />
          : <Circle className="h-4 w-4 text-muted-foreground/40" />
        }
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium truncate transition-colors ${selected ? 'text-purple-700 dark:text-purple-400' : ''}`}>
          {lec.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <Badge
            variant="outline"
            className="text-[9px] h-3.5 px-1.5 text-purple-600 border-purple-200 bg-purple-50 dark:bg-purple-950/30"
          >
            Rec
          </Badge>
          {subjectLabel && (
            <Badge variant="outline" className="text-[9px] h-3.5 px-1.5 text-blue-600 border-blue-200">
              {subjectLabel}
            </Badge>
          )}
          {lec.startTime && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(lec.startTime).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <Checkbox
        checked={selected}
        onCheckedChange={() => onToggle(lec.id)}
        onClick={e => e.stopPropagation()}
        className="shrink-0"
      />
    </div>
  );
}
