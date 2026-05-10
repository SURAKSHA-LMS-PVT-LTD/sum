import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Gift, RefreshCw, ShieldCheck, Users, CreditCard, BadgePercent, CircleDollarSign } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { enrollmentApi } from '@/api/enrollment.api';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { toast } from '@/hooks/use-toast';

interface EnrolledStudent {
  studentId: string;
  studentType: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid';
  verificationStatus: string;
  enrollmentMethod: string;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    imageUrl?: string;
  };
}

type FilterType = 'all' | 'free_card' | 'paid' | 'half_paid' | 'quarter_paid' | 'normal';

const typeLabel: Record<string, string> = {
  free_card: 'Free Card',
  paid: 'Paid',
  half_paid: 'Half Paid',
  quarter_paid: 'Quarter Paid',
  normal: 'Normal',
};

const typeBadgeStyle: Record<string, string> = {
  free_card: 'text-purple-700 border-purple-300 bg-purple-50 dark:bg-purple-950 dark:text-purple-300',
  paid: 'text-green-700 border-green-300 bg-green-50 dark:bg-green-950 dark:text-green-300',
  half_paid: 'text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:text-amber-300',
  quarter_paid: 'text-sky-700 border-sky-300 bg-sky-50 dark:bg-sky-950 dark:text-sky-300',
  normal: 'text-muted-foreground border-border',
};

const FreeCardStudentsPanel: React.FC = () => {
  const { selectedInstitute, selectedClass, selectedSubject, user } = useAuth();
  const userRole = useInstituteRole();
  const { subjectLabel, classLabel } = useInstituteLabels();
  const canManage = ['InstituteAdmin', 'Teacher'].includes(userRole);

  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchEnrolledStudents = useCallback(async (forceRefresh = false) => {
    if (!selectedInstitute?.id || !selectedClass?.id || !selectedSubject?.id) return;
    setLoading(true);
    try {
      const data: EnrolledStudent[] = await enhancedCachedClient.get(
        `/institute-class-subject-students/class-subject/${selectedInstitute.id}/${selectedClass.id}/${selectedSubject.id}`,
        {},
        {
          ttl: 60,
          forceRefresh,
          userId: user?.id,
          role: userRole,
          instituteId: selectedInstitute.id,
          classId: selectedClass.id,
          subjectId: selectedSubject.id,
        }
      );
      setStudents(Array.isArray(data) ? data : []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedInstitute?.id, selectedClass?.id, selectedSubject?.id, user?.id, userRole]);

  useEffect(() => {
    fetchEnrolledStudents(false);
  }, [fetchEnrolledStudents]);

  const handleSetStudentType = async (studentId: string, newType: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid') => {
    if (!selectedInstitute?.id || !selectedClass?.id || !selectedSubject?.id) return;
    setUpdatingId(studentId);
    try {
      await enrollmentApi.updateStudentType(
        selectedInstitute.id,
        selectedClass.id,
        selectedSubject.id,
        studentId,
        newType,
        { userId: user?.id, role: userRole }
      );
      setStudents(prev =>
        prev.map(s => s.studentId === studentId ? { ...s, studentType: newType } : s)
      );
      toast({
        title: 'Student Type Updated',
        description: `Set to ${typeLabel[newType] || newType}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update student type',
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = students.filter(s => {
    if (filter === 'all') return true;
    return s.studentType === filter;
  });

  const freeCardCount = students.filter(s => s.studentType === 'free_card').length;
  const paidCount = students.filter(s => s.studentType === 'paid').length;
  const halfPaidCount = students.filter(s => s.studentType === 'half_paid').length;
  const quarterPaidCount = students.filter(s => s.studentType === 'quarter_paid').length;
  const normalCount = students.filter(s => s.studentType === 'normal').length;

  if (!selectedSubject) return null;

  return (
    <Card className="border-purple-200 dark:border-purple-800/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-purple-500" />
            Free Cards — {selectedSubject?.name ?? subjectLabel}
            <Badge variant="outline" className="text-[10px] font-normal text-purple-600 border-purple-300">
              {freeCardCount} free card{freeCardCount !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => fetchEnrolledStudents(true)}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Students with a free card are exempt from enrollment fees for this {subjectLabel.toLowerCase()}.
          {!canManage && ' (View only)'}
        </p>

        {/* Summary badges */}
        <div className="flex items-center gap-2 flex-wrap mt-1">
          {[
            { id: 'all' as FilterType, label: `All (${students.length})` },
            { id: 'free_card' as FilterType, label: `Free Card (${freeCardCount})` },
            { id: 'paid' as FilterType, label: `Paid (${paidCount})` },
            { id: 'half_paid' as FilterType, label: `Half Paid (${halfPaidCount})` },
            { id: 'quarter_paid' as FilterType, label: `Quarter Paid (${quarterPaidCount})` },
            { id: 'normal' as FilterType, label: `Normal (${normalCount})` },
          ].map(({ id, label }) => (
            <Button
              key={id}
              size="sm"
              variant={filter === id ? 'default' : 'outline'}
              className="h-6 text-[11px] px-2"
              onClick={() => setFilter(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">
              {filter === 'free_card' ? 'No free card students' : 'No students found'}
            </p>
            {filter === 'free_card' && canManage && (
              <p className="text-xs mt-1">Toggle any student below to grant free card status for this {subjectLabel.toLowerCase()}.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => {
              const name = s.student
                ? `${s.student.firstName} ${s.student.lastName}`
                : `Student ${s.studentId.slice(-6)}`;
              const initials = s.student
                ? `${s.student.firstName[0] || '?'}${s.student.lastName[0] || '?'}`
                : '??';
              const imgUrl = s.student?.imageUrl ? getImageUrl(s.student.imageUrl) : '';
              return (
                <div
                  key={s.studentId}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                    s.studentType === 'free_card'
                      ? 'border-purple-200 bg-purple-50/50 dark:border-purple-800/40 dark:bg-purple-950/20'
                      : s.studentType === 'paid'
                      ? 'border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-950/20'
                      : s.studentType === 'half_paid'
                      ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/20'
                      : s.studentType === 'quarter_paid'
                      ? 'border-sky-200 bg-sky-50/50 dark:border-sky-800/40 dark:bg-sky-950/20'
                      : 'border-border bg-muted/20'
                  }`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={imgUrl} alt={name} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    {s.student?.email && (
                      <p className="text-[11px] text-muted-foreground truncate">{s.student.email}</p>
                    )}
                  </div>

                  {/* Student type badge */}
                  <Badge
                    variant="outline"
                    className={`text-[11px] shrink-0 ${typeBadgeStyle[s.studentType] || typeBadgeStyle.normal}`}
                  >
                    {s.studentType === 'free_card' && <Gift className="h-2.5 w-2.5 mr-1" />}
                    {s.studentType === 'paid' && <CreditCard className="h-2.5 w-2.5 mr-1" />}
                    {s.studentType === 'half_paid' && <BadgePercent className="h-2.5 w-2.5 mr-1" />}
                    {s.studentType === 'quarter_paid' && <CircleDollarSign className="h-2.5 w-2.5 mr-1" />}
                    {s.studentType === 'normal' && <ShieldCheck className="h-2.5 w-2.5 mr-1" />}
                    {typeLabel[s.studentType] || s.studentType}
                  </Badge>

                  {/* Student type selector — admin/teacher only */}
                  {canManage && (
                    updatingId === s.studentId ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                    ) : (
                      <Select
                        value={s.studentType}
                        onValueChange={(val) => handleSetStudentType(s.studentId, val as 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid')}
                        disabled={updatingId !== null}
                      >
                        <SelectTrigger className="h-7 w-[120px] text-[11px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="free_card">Free Card</SelectItem>
                          <SelectItem value="half_paid">Half Paid</SelectItem>
                          <SelectItem value="quarter_paid">Quarter Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FreeCardStudentsPanel;
