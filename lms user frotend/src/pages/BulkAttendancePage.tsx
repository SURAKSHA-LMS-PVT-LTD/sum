import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi from '@/api/adminAttendance.api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Loader2, CheckCircle, XCircle, ArrowLeft, RefreshCw, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSriLankaDate } from '@/utils/timezone';
import {
  AttendanceStatus,
  MarkingMethod,
  ALL_ATTENDANCE_STATUSES,
  ALL_MARKING_METHODS,
  ATTENDANCE_STATUS_CONFIG,
  type BulkAttendancePayload,
  type BulkAttendanceResponse,
} from '@/types/attendance.types';
import { useTodayCalendarEvents, DEFAULT_EVENT_ID } from '@/hooks/useTodayCalendarEvents';
import EventSelector from '@/components/attendance/EventSelector';
import { instituteStudentsApi } from '@/api/instituteStudents.api';

interface StudentEntry {
  id: string;
  studentId: string;
  studentName: string;
  imageUrl?: string;
  status: AttendanceStatus;
  remarks: string;
  /** true = loaded from class API (name/ID pre-filled) */
  fromClass?: boolean;
}

const BulkAttendancePage: React.FC = () => {
  const { selectedInstitute, selectedClass, selectedSubject, currentInstituteId } = useAuth();
  const navigate = useNavigate();
  const [markingMethod, setMarkingMethod] = useState<MarkingMethod>('manual');
  const [location, setLocation] = useState('');
  const [selectedEventId, setSelectedEventId] = useState(DEFAULT_EVENT_ID);
  const [selectedDate, setSelectedDate] = useState(() => getSriLankaDate());

  // Auto-advance date when Sri Lanka rolls past midnight
  useEffect(() => {
    const checkDate = () => {
      const sriLankaToday = getSriLankaDate();
      setSelectedDate(prev => prev < sriLankaToday ? sriLankaToday : prev);
    };
    const interval = setInterval(checkDate, 60_000);
    checkDate();
    return () => clearInterval(interval);
  }, []);
  const [students, setStudents] = useState<StudentEntry[]>([
    { id: '1', studentId: '', studentName: '', status: 'present', remarks: '' },
  ]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<BulkAttendanceResponse | null>(null);

  const calendarInfo = useTodayCalendarEvents(
    currentInstituteId,
    selectedClass?.id?.toString(),
    selectedDate
  );

  // ── Auto-load students from selected class ──────────────────
  const loadStudentsFromClass = useCallback(async () => {
    const instId = currentInstituteId;
    const classId = selectedClass?.id?.toString();
    if (!instId || !classId) {
      toast.error('Select a class first');
      return;
    }
    setLoadingStudents(true);
    try {
      const res = await instituteStudentsApi.getStudentsByClass(instId, classId, { limit: 200 });
      const rows: StudentEntry[] = (res?.data ?? []).map((s, idx) => ({
        id: `class-${s.id}-${idx}`,
        studentId: s.id,
        studentName: s.name,
        imageUrl: s.imageUrl,
        status: 'present' as AttendanceStatus,
        remarks: '',
        fromClass: true,
      }));
      if (rows.length === 0) {
        toast.error('No students found in this class');
        return;
      }
      setStudents(rows);
      toast.success(`Loaded ${rows.length} students from ${selectedClass?.name}`);
    } catch {
      toast.error('Failed to load students from class');
    } finally {
      setLoadingStudents(false);
    }
  }, [currentInstituteId, selectedClass]);

  const addStudent = () => {
    setStudents(prev => [
      ...prev,
      { id: Date.now().toString(), studentId: '', studentName: '', status: 'present', remarks: '' },
    ]);
  };

  const removeStudent = (id: string) => {
    if (students.length <= 1) return;
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  const updateStudent = (id: string, field: keyof StudentEntry, value: string) => {
    setStudents(prev =>
      prev.map(s => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const setAllStatus = (status: AttendanceStatus) => {
    setStudents(prev => prev.map(s => ({ ...s, status })));
  };

  const handleSubmit = async () => {
    if (!currentInstituteId || !selectedInstitute?.name) {
      toast.error('Please select an institute first');
      return;
    }

    const validStudents = students.filter(s => s.studentId.trim());
    if (validStudents.length === 0) {
      toast.error('Add at least one student with a valid ID');
      return;
    }

    if (validStudents.length > 100) {
      toast.error('Maximum 100 students per bulk operation');
      return;
    }

    setIsSubmitting(true);
    setResults(null);

    try {
      const isInstituteScope = !selectedClass;

      const payload: BulkAttendancePayload = {
        instituteId: currentInstituteId,
        instituteName: selectedInstitute.name,
        classId: selectedClass?.id?.toString(),
        className: selectedClass?.name,
        subjectId: selectedSubject?.id?.toString(),
        subjectName: selectedSubject?.name,
        date: selectedDate,
        // Only include eventId for institute scope (class/subject → eventId is always null)
        eventId: isInstituteScope && selectedEventId !== DEFAULT_EVENT_ID ? selectedEventId : undefined,
        location: location || undefined,
        markingMethod,
        students: validStudents.map(s => ({
          studentId: s.studentId.trim(),
          studentName: s.studentName.trim() || undefined,
          status: s.status,
          remarks: s.remarks.trim() || undefined,
        })),
      };

      const res = await adminAttendanceApi.markBulkAttendance(payload);
      setResults(res);
      toast.success(`Bulk attendance: ${res.summary?.successful || 0} successful, ${res.summary?.failed || 0} failed`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit bulk attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Bulk Attendance</h1>
          <p className="text-xs text-muted-foreground">
            Mark attendance for up to 100 students at once
          </p>
        </div>
      </div>

      {/* Context Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{selectedInstitute?.name || 'No institute'}</Badge>
            {selectedClass && <Badge variant="secondary">{selectedClass.name}</Badge>}
            {selectedSubject && <Badge variant="secondary">{selectedSubject.name}</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Marking Method</Label>
              <Select value={markingMethod} onValueChange={(v) => setMarkingMethod(v as MarkingMethod)}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_MARKING_METHODS.map(m => (
                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Event Selector — only for institute scope */}
            {!selectedClass && (
              <div>
                <EventSelector
                  events={calendarInfo.events}
                  selectedEventId={selectedEventId}
                  onEventChange={setSelectedEventId}
                  loading={calendarInfo.loading}
                  disabled={isSubmitting}
                  dayType={calendarInfo.dayType}
                  isAttendanceExpected={calendarInfo.isAttendanceExpected}
                  compact
                />
              </div>
            )}
            <div>
              <Label className="text-xs">Location</Label>
              <Input
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="mt-1 text-xs"
                placeholder="Optional location..."
              />
            </div>
          </div>
          <div className="flex gap-2">
            <span className="text-xs text-muted-foreground">Set all:</span>
            {ALL_ATTENDANCE_STATUSES.map(s => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setAllStatus(s)}
              >
                {ATTENDANCE_STATUS_CONFIG[s].icon} {ATTENDANCE_STATUS_CONFIG[s].label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Student Entries */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Students ({students.length})
            </CardTitle>
            <div className="flex gap-2">
              {selectedClass && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadStudentsFromClass}
                  disabled={loadingStudents || isSubmitting}
                  className="text-xs h-7"
                >
                  {loadingStudents
                    ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading…</>
                    : <><UserCheck className="h-3 w-3 mr-1" /> Load from {selectedClass.name}</>}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={addStudent} className="text-xs h-7">
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingStudents ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))
          ) : (
            students.map((student, idx) => (
              <div key={student.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                <span className="text-xs text-muted-foreground w-6 shrink-0">{idx + 1}</span>
                {student.fromClass ? (
                  // Pre-loaded from class — show name+photo, no manual ID input
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={student.imageUrl} />
                      <AvatarFallback className="text-[10px]">{student.studentName?.charAt(0) ?? '?'}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{student.studentName}</span>
                  </div>
                ) : (
                  // Manual entry — show ID + name fields
                  <>
                    <Input
                      value={student.studentId}
                      onChange={e => updateStudent(student.id, 'studentId', e.target.value)}
                      placeholder="Student ID *"
                      className="text-xs h-8 flex-1"
                    />
                    <Input
                      value={student.studentName}
                      onChange={e => updateStudent(student.id, 'studentName', e.target.value)}
                      placeholder="Name (optional)"
                      className="text-xs h-8 flex-1"
                    />
                  </>
                )}
                <Select
                  value={student.status}
                  onValueChange={v => updateStudent(student.id, 'status', v)}
                >
                  <SelectTrigger className="text-xs h-8 w-28 shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_ATTENDANCE_STATUSES.map(s => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {ATTENDANCE_STATUS_CONFIG[s].icon} {ATTENDANCE_STATUS_CONFIG[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={student.remarks}
                  onChange={e => updateStudent(student.id, 'remarks', e.target.value)}
                  placeholder="Remarks"
                  className="text-xs h-8 w-24 shrink-0"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStudent(student.id)}
                  disabled={students.length <= 1}
                  className="h-8 w-8 p-0 shrink-0"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || !currentInstituteId}
        className="w-full"
        size="lg"
      >
        {isSubmitting ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
        ) : (
          <><Users className="h-4 w-4 mr-2" /> Mark {students.filter(s => s.studentId.trim()).length} Students</>
        )}
      </Button>

      {/* Results */}
      {results && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-3">
              <Badge className="bg-green-500 text-white">✓ {results.summary?.successful || 0} Successful</Badge>
              <Badge variant="destructive">✗ {results.summary?.failed || 0} Failed</Badge>
              <Badge variant="outline">Total: {results.summary?.total || 0}</Badge>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {results.results?.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-1">
                  {r.success ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span>{r.studentId || r.studentCardId}</span>
                  {r.studentName && <span className="text-muted-foreground">({r.studentName})</span>}
                  {r.error && <span className="text-destructive">{r.error}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BulkAttendancePage;
