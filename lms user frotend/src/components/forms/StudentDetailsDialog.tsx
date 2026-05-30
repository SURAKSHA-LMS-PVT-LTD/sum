import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getImageUrl } from '@/utils/imageUrlHelper';
import adminAttendanceApi, { type AdminAttendanceRecord } from '@/api/adminAttendance.api';
import { normalizeAttendanceSummary, type AttendanceSummary } from '@/types/attendance.types';
import {
  Mail,
  Phone,
  Calendar,
  Heart,
  AlertCircle,
  Hash,
  MapPin,
  User,
  Briefcase,
  Building2,
  RefreshCw,
} from 'lucide-react';

interface ParentInfo {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  imageUrl?: string;
  occupation?: string;
  workPlace?: string;
  workplace?: string;
  children?: any[];
}

interface StudentDetails {
  id: string;
  name: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  phoneNumber?: string;
  imageUrl?: string;
  dateOfBirth?: string;
  userIdByInstitute?: string;
  studentId?: string;
  instituteUserImageUrl?: string;
  fatherId?: string;
  emergencyContact?: string;
  medicalConditions?: string;
  allergies?: string;
  father?: ParentInfo;
  mother?: ParentInfo;
  parentDetails?: {
    father?: ParentInfo;
    mother?: ParentInfo;
  };
}

interface StudentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentDetails | null;
}

/** Simple label→value row used throughout the detail view */
const InfoRow = ({ icon, label, value, mono, accent }: { icon?: React.ReactNode; label: string; value?: string | null; mono?: boolean; accent?: boolean }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4 py-4">
      {icon && <span className="mt-0.5 text-muted-foreground/60 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground leading-none mb-1.5">{label}</p>
        <p className={`text-lg leading-snug ${mono ? 'font-mono' : ''} ${accent ? 'font-semibold text-primary' : 'text-foreground'}`}>{value}</p>
      </div>
    </div>
  );
};

/** Section divider with a clean label */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 pt-3">
    <p className="text-sm font-semibold text-muted-foreground whitespace-nowrap">{children}</p>
    <div className="h-px flex-1 bg-border/50" />
  </div>
);

const StudentDetailsDialog: React.FC<StudentDetailsDialogProps> = ({
  open,
  onOpenChange,
  student
}) => {
  const { currentInstituteId } = useAuth();
  const [attendanceRange, setAttendanceRange] = useState<'1m' | '3m' | '1y'>('1m');
  const [attendanceRecords, setAttendanceRecords] = useState<AdminAttendanceRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary>(normalizeAttendanceSummary(undefined));
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');

  // Shows all words except the last as initials, last word in full
  const formatNameWithInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    const initials = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + '.').join(' ');
    const last = parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1).toLowerCase();
    return `${initials} ${last}`;
  };

  const father = student?.father || student?.parentDetails?.father;
  const mother = student?.mother || student?.parentDetails?.mother;
  const hasParents = father || mother;
  const hasMedical = student?.medicalConditions || student?.allergies;
  const hasAddress = student?.addressLine1 || student?.addressLine2;
  const attendanceStudentId = student?.studentId || student?.userIdByInstitute || student?.id;

  const attendanceWindow = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    if (attendanceRange === '1y') {
      start.setFullYear(start.getFullYear() - 1);
    } else if (attendanceRange === '3m') {
      start.setMonth(start.getMonth() - 3);
    } else {
      start.setMonth(start.getMonth() - 1);
    }
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [attendanceRange]);

  useEffect(() => {
    if (!open || !currentInstituteId || !attendanceStudentId) return;

    let cancelled = false;
    const loadAttendance = async () => {
      setAttendanceLoading(true);
      setAttendanceError('');
      try {
        const response = await adminAttendanceApi.getStudentAttendance(attendanceStudentId, {
          instituteId: String(currentInstituteId),
          startDate: attendanceWindow.startDate,
          endDate: attendanceWindow.endDate,
          page: 1,
          limit: 50,
        });
        if (cancelled) return;
        setAttendanceRecords(response?.data || []);
        setAttendanceSummary(normalizeAttendanceSummary(response?.summary));
      } catch (error: any) {
        if (cancelled) return;
        setAttendanceRecords([]);
        setAttendanceSummary(normalizeAttendanceSummary(undefined));
        setAttendanceError(error?.message || 'Failed to load attendance history');
      } finally {
        if (!cancelled) setAttendanceLoading(false);
      }
    };

    loadAttendance();
    return () => {
      cancelled = true;
    };
  }, [open, currentInstituteId, attendanceStudentId, attendanceWindow.startDate, attendanceWindow.endDate]);

  const attendanceStats = useMemo(() => ({
    present: attendanceSummary.totalPresent,
    absent: attendanceSummary.totalAbsent,
    late: attendanceSummary.totalLate,
    left: attendanceSummary.totalLeft + attendanceSummary.totalLeftEarly + attendanceSummary.totalLeftLately,
    total: attendanceRecords.length,
  }), [attendanceRecords.length, attendanceSummary]);

  const formatAttendanceStatus = (status: string) => String(status || '').replace(/_/g, ' ');

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} routeName="student-details-dialog-popup">
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
              <Avatar className="h-[84px] w-[84px] ring-2 ring-primary/20 shadow-md">
                <AvatarImage src={getImageUrl(student.imageUrl)} alt={student.name} />
                <AvatarFallback className="text-2xl font-semibold bg-primary/8 text-primary">
                  {student.name.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 w-full">
                <p className="text-xl sm:text-2xl font-bold leading-tight break-words whitespace-normal">{student.name}</p>
                <p className="text-base text-muted-foreground font-mono font-normal mt-1.5 break-all">
                  {student.studentId || student.userIdByInstitute || student.id}
                </p>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Global Image</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-16 w-16 rounded-xl ring-1 ring-border/60">
                    <AvatarImage src={getImageUrl(student.imageUrl)} alt={student.name} className="object-cover" />
                    <AvatarFallback className="rounded-xl bg-muted">No image</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-all">{student.imageUrl ? 'Available' : 'Not uploaded'}</p>
                    <p className="text-xs text-muted-foreground">Profile image from the main user account.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Institute Image</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-16 w-16 rounded-xl ring-1 ring-border/60">
                    <AvatarImage src={getImageUrl(student.instituteUserImageUrl || '')} alt={student.name} className="object-cover" />
                    <AvatarFallback className="rounded-xl bg-muted">No image</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-all">{student.instituteUserImageUrl ? 'Available' : 'Not uploaded'}</p>
                    <p className="text-xs text-muted-foreground">Institute-scoped image used for identification.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className={`${!(hasMedical || hasParents) ? '' : 'lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start'}`}>
            <div className={`space-y-4 ${!(hasMedical || hasParents) ? '' : ''}`}>
            {/* ── Personal ── */}
            <SectionLabel>Personal</SectionLabel>
            <div className="divide-y divide-border/40">
              <InfoRow icon={<Hash className="h-4 w-4" />} label="System ID" value={student.id} mono accent />
              {student.userIdByInstitute && (
                <InfoRow icon={<Hash className="h-4 w-4" />} label="Institute ID" value={student.userIdByInstitute} mono />
              )}
              {student.studentId && student.studentId !== student.userIdByInstitute && (
                <InfoRow icon={<Hash className="h-4 w-4" />} label="Student ID" value={student.studentId} mono />
              )}
              <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={student.email} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={student.phoneNumber} />
              {student.dateOfBirth && (
                <InfoRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Date of Birth"
                  value={new Date(student.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                />
              )}
              {student.emergencyContact && (
                <div className="flex items-start gap-4 py-4">
                  <span className="mt-0.5 text-red-500/70 shrink-0"><Phone className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-red-500/80 leading-none mb-1.5">Emergency Contact</p>
                    <p className="text-lg font-medium text-red-600 dark:text-red-400">{student.emergencyContact}</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Address ── */}
            {hasAddress && (
              <>
                <SectionLabel>Address</SectionLabel>
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Address"
                  value={[student.addressLine1, student.addressLine2].filter(Boolean).join(', ')}
                />
              </>
            )}
            </div>

            {(hasMedical || hasParents) && (
              <div className="space-y-4">
              {/* ── Medical ── */}
              {hasMedical && (
                <>
                  <SectionLabel>Medical</SectionLabel>
                  <div className="divide-y divide-border/40">
                    {student.medicalConditions && (
                      <InfoRow icon={<Heart className="h-4 w-4" />} label="Medical Conditions" value={student.medicalConditions} />
                    )}
                    {student.allergies && (
                      <InfoRow icon={<AlertCircle className="h-4 w-4" />} label="Allergies" value={student.allergies} />
                    )}
                  </div>
                </>
              )}

              {/* ── Parents ── */}
              {hasParents && (
                <>
                  <SectionLabel>Parents / Guardians</SectionLabel>
                  <div className="space-y-4 pt-2">
                    {[
                      { data: father, label: 'Father' },
                      { data: mother, label: 'Mother' },
                    ].filter(p => p.data).map(({ data: parent, label }) => (
                      <div key={label} className="rounded-xl border border-border/50 bg-muted/20 p-5">
                        <div className="flex items-center gap-4 mb-4">
                          <Avatar className="h-12 w-12 ring-2 ring-primary/15">
                            <AvatarImage src={getImageUrl(parent?.imageUrl)} alt={label} />
                            <AvatarFallback className="text-sm font-semibold bg-primary/8 text-primary">
                              {parent?.name?.split(' ').map((n: string) => n.charAt(0)).join('').slice(0, 2) || label[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm text-muted-foreground leading-none mb-1">{label}</p>
                            <p className="text-base font-semibold leading-tight truncate">{formatNameWithInitials(parent?.name || '')}</p>
                          </div>
                        </div>
                        <div className="divide-y divide-border/30 ml-16">
                          {parent?.email && (
                            <div className="py-2.5">
                              <p className="text-sm text-muted-foreground leading-none mb-1">Email</p>
                              <p className="text-sm mt-0.5 break-all">{parent.email}</p>
                            </div>
                          )}
                          {parent?.phoneNumber && (
                            <div className="py-2.5">
                              <p className="text-sm text-muted-foreground leading-none mb-1">Phone</p>
                              <p className="text-sm mt-0.5">{parent.phoneNumber}</p>
                            </div>
                          )}
                          {parent?.occupation && (
                            <div className="py-2.5">
                              <p className="text-sm text-muted-foreground leading-none mb-1">Occupation</p>
                              <p className="text-sm mt-0.5">{parent.occupation}</p>
                            </div>
                          )}
                          {(parent?.workPlace || parent?.workplace) && (
                            <div className="py-2.5">
                              <p className="text-sm text-muted-foreground leading-none mb-1">Workplace</p>
                              <p className="text-sm mt-0.5">{parent.workPlace || parent.workplace}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <SectionLabel>Attendance</SectionLabel>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {(['1m', '3m', '1y'] as const).map(range => (
                  <Button
                    key={range}
                    type="button"
                    size="sm"
                    variant={attendanceRange === range ? 'default' : 'outline'}
                    onClick={() => setAttendanceRange(range)}
                    className="h-8 px-3"
                  >
                    {range === '1m' ? 'Last Month' : range === '3m' ? '3 Months' : '1 Year'}
                  </Button>
                ))}
              </div>
            </div>

            <Card className="border-border/60">
              <CardContent className="pt-6 space-y-4">
                {attendanceLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading attendance history...
                  </div>
                ) : attendanceError ? (
                  <div className="rounded-lg border border-dashed border-destructive/30 bg-destructive/5 px-3 py-4 text-sm text-destructive">
                    {attendanceError}
                  </div>
                ) : attendanceRecords.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
                    No attendance records found for the selected range.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Present</p>
                        <p className="text-xl font-bold text-emerald-600">{attendanceStats.present}</p>
                      </div>
                      <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Absent</p>
                        <p className="text-xl font-bold text-red-600">{attendanceStats.absent}</p>
                      </div>
                      <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Late</p>
                        <p className="text-xl font-bold text-amber-600">{attendanceStats.late}</p>
                      </div>
                      <div className="rounded-xl border border-purple-500/15 bg-purple-500/5 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Left</p>
                        <p className="text-xl font-bold text-purple-600">{attendanceStats.left}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/30 p-3 col-span-2 sm:col-span-1">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
                        <p className="text-xl font-bold text-foreground">{attendanceStats.total}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {attendanceRecords.map((record, index) => (
                        <div key={record.attendanceId || record.id || index} className="rounded-xl border border-border/60 bg-background px-3 py-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground break-words">
                                {record.date ? new Date(record.date).toLocaleDateString() : record.markedAt ? new Date(record.markedAt).toLocaleDateString() : 'Unknown date'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {record.className || 'No class'}{record.subjectName ? ` · ${record.subjectName}` : ''}
                              </p>
                            </div>
                            <Badge variant="outline" className="shrink-0 capitalize">
                              {formatAttendanceStatus(record.status)}
                            </Badge>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div>
                              <span className="block uppercase tracking-wide text-[10px] opacity-70">Method</span>
                              <span className="text-foreground">{record.markingMethod || '—'}</span>
                            </div>
                            <div>
                              <span className="block uppercase tracking-wide text-[10px] opacity-70">Marked By</span>
                              <span className="text-foreground break-all">{record.markedBy || '—'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentDetailsDialog;
