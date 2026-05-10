import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi from '@/api/adminAttendance.api';
import { cachedApiClient } from '@/api/cachedClient';
import { getAuthHeadersSync } from '@/services/tokenStorageService';
import { normalizeAttendanceSummary, getAttendanceStatusConfig } from '@/types/attendance.types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, Users, UserCheck, UserX, Clock, Search, TrendingUp, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getImageUrl } from '@/utils/imageUrlHelper';

const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

interface Option { id: string; name: string }

const SubjectDailyAttendance: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [classes, setClasses] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<Option[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedClassName, setSelectedClassName] = useState('');
  const [selectedSubjectName, setSelectedSubjectName] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentImagesMap, setStudentImagesMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!currentInstituteId) return;
    cachedApiClient.get(`/institutes/${currentInstituteId}/classes`, undefined, { ttl: 60 })
      .then((res: any) => setClasses(res?.data || res || []))
      .catch(() => {});
  }, [currentInstituteId]);

  useEffect(() => {
    if (!currentInstituteId || !selectedClass) { setSubjects([]); return; }
    cachedApiClient.get(`/institutes/${currentInstituteId}/classes/${selectedClass}/subjects`, undefined, { ttl: 60 })
      .then((res: any) => {
        const raw: any[] = res?.data || res || [];
        setSubjects(raw.map((s: any) => ({
          id: s.subjectId ?? s.subject?.id ?? s.id,
          name: s.subject?.name ?? s.name ?? s.subjectName ?? s.subjectId ?? s.id,
        })));
      })
      .catch(() => {});
  }, [currentInstituteId, selectedClass]);

  // Load student images for the selected class
  useEffect(() => {
    if (!currentInstituteId || !selectedClass) {
      setStudentImagesMap(new Map());
      return;
    }

    const fetchStudentImages = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_LMS_BASE_URL || 'https://lmsapi.suraksha.lk'}/institutes/${currentInstituteId}/classes/${selectedClass}/students`,
          { headers: getAuthHeadersSync() }
        );
        
        if (response.ok) {
          const data = await response.json();
          const studentsData = data.data || [];
          
          // Create a map of studentId -> imageUrl
          const imagesMap = new Map<string, string>();
          studentsData.forEach((student: any) => {
            if (student.id && student.imageUrl) {
              imagesMap.set(student.id.toString(), student.imageUrl);
            }
          });
          
          setStudentImagesMap(imagesMap);
          console.log('📸 Loaded student images for', imagesMap.size, 'students in class');
        }
      } catch (error: any) {
        console.error('Failed to fetch student images:', error);
      }
    };

    fetchStudentImages();
  }, [currentInstituteId, selectedClass]);

  const loadAttendance = useCallback(async () => {
    if (!currentInstituteId || !selectedClass || !selectedSubject) return;
    setLoading(true);
    try {
      const res = await adminAttendanceApi.getSubjectAttendance(
        currentInstituteId, selectedClass, selectedSubject,
        { startDate: date, endDate: date, limit: 100, page: 1 }
      );
      setRecords(res?.data || []);
      setSummary(normalizeAttendanceSummary(res?.summary));
    } catch (e: any) {
      toast.error(e.message || 'Failed to load subject attendance');
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, selectedClass, selectedSubject, date]);

  useEffect(() => {
    if (selectedClass && selectedSubject) loadAttendance();
  }, [selectedClass, selectedSubject, date]);

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
    setSelectedSubject('');
    setSelectedSubjectName('');
    const cls = classes.find(c => c.id === classId);
    setSelectedClassName(cls?.name || '');
  };

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubject(subjectId);
    const subj = subjects.find(s => s.id === subjectId);
    setSelectedSubjectName(subj?.name || '');
  };

  const filteredRecords = records.filter(r =>
    !searchTerm ||
    (r.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.studentId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStudents = summary
    ? summary.totalPresent + summary.totalAbsent + summary.totalLate + summary.totalLeft + summary.totalLeftEarly + summary.totalLeftLately
    : 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs font-medium">Class</Label>
              <Select value={selectedClass} onValueChange={handleClassChange}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select Class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id} className="text-sm">{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Subject</Label>
              <Select value={selectedSubject} onValueChange={handleSubjectChange} disabled={!selectedClass}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select Subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id} className="text-sm">{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="text-sm" />
            </div>
            <div className="flex items-end">
              <Button size="sm" onClick={loadAttendance} disabled={!selectedClass || !selectedSubject || loading} className="w-full">
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && selectedSubject && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <SummaryCard label="Total" value={totalStudents} icon={<Users className="h-4 w-4" />} className="bg-primary/5 border-primary/20" />
          <SummaryCard label="Present" value={summary.totalPresent} icon={<UserCheck className="h-4 w-4" />} className="bg-emerald-500/5 border-emerald-500/20 text-emerald-600" />
          <SummaryCard label="Absent" value={summary.totalAbsent} icon={<UserX className="h-4 w-4" />} className="bg-red-500/5 border-red-500/20 text-red-600" />
          <SummaryCard label="Late" value={summary.totalLate} icon={<Clock className="h-4 w-4" />} className="bg-amber-500/5 border-amber-500/20 text-amber-600" />
          <SummaryCard label="Left" value={summary.totalLeft} className="bg-purple-500/5 border-purple-500/20 text-purple-600" />
          <SummaryCard label="Left Early" value={summary.totalLeftEarly} className="bg-pink-500/5 border-pink-500/20 text-pink-600" />
          <SummaryCard label="Rate" value={`${summary.attendanceRate}%`} icon={<TrendingUp className="h-4 w-4" />}
            className={summary.attendanceRate >= 85 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600' :
              summary.attendanceRate >= 70 ? 'bg-amber-500/5 border-amber-500/20 text-amber-600' :
              'bg-red-500/5 border-red-500/20 text-red-600'} />
        </div>
      )}

      {/* Header */}
      {selectedSubject && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{selectedClassName} → {selectedSubjectName} — {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search student..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-xs" />
          </div>
        </div>
      )}

      {/* Records Table */}
      {selectedSubject && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Student ID</TableHead>
                <TableHead className="text-xs">Student Name</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs">Method</TableHead>
                <TableHead className="text-xs">Time</TableHead>
                <TableHead className="text-xs">Marked By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length > 0 ? filteredRecords.map((r, i) => {
                const config = getAttendanceStatusConfig(r.status);
                return (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-mono">{r.studentId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          {/* ✅ NEW: Try to get image from studentImagesMap first, then fall back to API response */}
                          {(() => {
                            const mappedImage = studentImagesMap.get(r.studentId);
                            const imageUrl = mappedImage || r.studentImageUrl || r.imageUrl || '';
                            return <AvatarImage src={getImageUrl(imageUrl)} />;
                          })()}
                          <AvatarFallback className="text-[10px]">{getInitials(r.studentName || '')}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium">{r.studentName || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center">
                      <Badge className={`${config.bgColor} ${config.color} border text-[10px]`}>
                        {config.icon} {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{r.markingMethod || '—'}</TableCell>
                    <TableCell className="text-xs">{r.markedAt ? new Date(r.markedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                    <TableCell className="text-xs">{r.markedBy || '—'}</TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                    No attendance records found for this date and subject
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{ label: string; value: number | string; icon?: React.ReactNode; className?: string }> = ({ label, value, icon, className }) => (
  <div className={`p-3 rounded-lg border ${className || ''}`}>
    <div className="flex items-center gap-1.5 mb-1">
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</span>
    </div>
    <div className="text-lg font-bold">{value}</div>
  </div>
);

export default SubjectDailyAttendance;
