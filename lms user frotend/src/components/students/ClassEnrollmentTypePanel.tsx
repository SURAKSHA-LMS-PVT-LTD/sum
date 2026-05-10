import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Gift, RefreshCw, CreditCard, ShieldCheck, Users, ChevronDown, ChevronUp,
  BadgePercent, Coins,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { enrollmentApi, ClassEnrollmentSummaryItem } from '@/api/enrollment.api';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { toast } from '@/hooks/use-toast';

export type StudentTypeValue = 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid';
type FilterTab = 'all' | StudentTypeValue;

const TYPE_BADGE: Record<StudentTypeValue, string> = {
  free_card:    'text-purple-700 border-purple-300 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300',
  paid:         'text-green-700  border-green-300  bg-green-50  dark:bg-green-950/40  dark:text-green-300',
  half_paid:    'text-amber-700  border-amber-300  bg-amber-50  dark:bg-amber-950/40  dark:text-amber-300',
  quarter_paid: 'text-sky-700    border-sky-300    bg-sky-50    dark:bg-sky-950/40    dark:text-sky-300',
  normal:       'text-muted-foreground border-border',
};

const VerifBadge: Record<string, string> = {
  verified:           'text-green-600 border-green-200',
  enrolled_free_card: 'text-purple-600 border-purple-200',
  pending:            'text-amber-600 border-amber-200',
  pending_payment:    'text-orange-600 border-orange-200',
  payment_rejected:   'text-red-600 border-red-200',
  rejected:           'text-red-600 border-red-200',
};

const TYPE_LABELS: Record<StudentTypeValue, string> = {
  free_card:    'Free Card',
  paid:         'Paid',
  half_paid:    'Half Paid',
  quarter_paid: 'Quarter Paid',
  normal:       'Normal',
};

function TypeIcon({ type, className = 'h-2 w-2 mr-0.5' }: { type: StudentTypeValue; className?: string }) {
  if (type === 'free_card')    return <Gift         className={className} />;
  if (type === 'paid')         return <CreditCard    className={className} />;
  if (type === 'half_paid')    return <BadgePercent  className={className} />;
  if (type === 'quarter_paid') return <Coins         className={className} />;
  return <ShieldCheck className={className} />;
}

function SubjectTypeBadge({ type }: { type: StudentTypeValue }) {
  return (
    <Badge variant="outline" className={`text-[10px] py-0 h-4 ${TYPE_BADGE[type] || TYPE_BADGE.normal}`}>
      <TypeIcon type={type} />
      {TYPE_LABELS[type] ?? type}
    </Badge>
  );
}

/** Returns the "dominant" type for a student (used for the select default value) */
function dominantType(s: ClassEnrollmentSummaryItem): StudentTypeValue {
  const types = s.subjects.map(sub => sub.studentType as StudentTypeValue);
  if (types.includes('free_card'))    return 'free_card';
  if (types.includes('half_paid'))    return 'half_paid';
  if (types.includes('quarter_paid')) return 'quarter_paid';
  if (types.includes('paid'))         return 'paid';
  return 'normal';
}

const ClassEnrollmentTypePanel: React.FC = () => {
  const { selectedInstitute, selectedClass, user } = useAuth();
  const userRole = useInstituteRole();
  const { classLabel, subjectLabel, subjectsLabel } = useInstituteLabels();
  const canManage = ['InstituteAdmin', 'Teacher'].includes(userRole);

  const [students, setStudents] = useState<ClassEnrollmentSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetch = useCallback(async (forceRefresh = false) => {
    if (!selectedInstitute?.id || !selectedClass?.id) return;
    setLoading(true);
    try {
      const data = await enrollmentApi.getClassEnrollmentSummary(
        selectedInstitute.id,
        selectedClass.id,
        undefined,
        { userId: user?.id, role: userRole },
      );
      setStudents(Array.isArray(data) ? data : []);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedInstitute?.id, selectedClass?.id, user?.id, userRole]);

  useEffect(() => { fetch(false); }, [fetch]);

  const handleSetStudentType = async (studentId: string, newType: StudentTypeValue) => {
    if (!selectedInstitute?.id || !selectedClass?.id) return;
    setUpdatingId(studentId);
    try {
      const res = await enrollmentApi.updateClassStudentType(
        selectedInstitute.id,
        selectedClass.id,
        studentId,
        newType,
        { userId: user?.id, role: userRole },
      );
      setStudents(prev => prev.map(s => {
        if (s.studentId !== studentId) return s;
        return {
          ...s,
          hasFreeCard: newType === 'free_card',
          subjects: s.subjects.map(sub => ({ ...sub, studentType: newType })),
        };
      }));
      toast({
        title: `Type set to ${TYPE_LABELS[newType]}`,
        description: res.message,
      });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to update', variant: 'destructive' });
    } finally {
      setUpdatingId(null);
    }
  };

  // counts
  const countByType = (t: StudentTypeValue) =>
    students.filter(s => s.subjects.some(sub => sub.studentType === t)).length;
  const freeCardCount   = countByType('free_card');
  const paidCount       = countByType('paid');
  const halfPaidCount   = countByType('half_paid');
  const quarterPaidCount = countByType('quarter_paid');
  const normalCount     = students.filter(s => s.subjects.every(sub => sub.studentType === 'normal')).length;

  const filtered = students.filter(s => {
    if (filter === 'all')          return true;
    if (filter === 'free_card')    return s.hasFreeCard;
    if (filter === 'half_paid')    return s.subjects.some(sub => sub.studentType === 'half_paid');
    if (filter === 'quarter_paid') return s.subjects.some(sub => sub.studentType === 'quarter_paid');
    return s.subjects.some(sub => sub.studentType === filter);
  });

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: 'all',          label: `All (${students.length})` },
    { id: 'free_card',    label: `Free Card (${freeCardCount})` },
    { id: 'paid',         label: `Paid (${paidCount})` },
    { id: 'half_paid',    label: `Half Paid (${halfPaidCount})` },
    { id: 'quarter_paid', label: `Quarter Paid (${quarterPaidCount})` },
    { id: 'normal',       label: `Normal (${normalCount})` },
  ];

  if (!selectedClass) return null;

  return (
    <Card className="border-purple-200/60 dark:border-purple-800/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4 text-purple-500" />
            Enrollment Types â€” {selectedClass.name}
            {freeCardCount > 0 && (
              <Badge variant="outline" className="text-[10px] font-normal text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950/40">
                {freeCardCount} free card{freeCardCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => fetch(true)} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {canManage
            ? `Manage payment status for students in this ${classLabel} across all their enrolled ${subjectsLabel.toLowerCase()}.`
            : `View enrollment type per student in this ${classLabel}.`}
        </p>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          {filterTabs.map(({ id, label }) => (
            <Button
              key={id}
              size="sm"
              variant={filter === id ? 'default' : 'outline'}
              className="h-6 text-[11px] px-2.5"
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
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted/30 rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">
              {filter === 'all' ? `No enrolled students found` : `No ${TYPE_LABELS[filter as StudentTypeValue] ?? filter} students in this ${classLabel}`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(s => {
              const dominant  = dominantType(s);
              const isExpanded = expandedId === s.studentId;
              const imgUrl   = s.imageUrl ? getImageUrl(s.imageUrl) : '';
              const initials = s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              const rowBg = {
                free_card:    'border-purple-200 bg-purple-50/40 dark:border-purple-800/30 dark:bg-purple-950/10',
                paid:         'border-green-200  bg-green-50/40  dark:border-green-800/30  dark:bg-green-950/10',
                half_paid:    'border-amber-200  bg-amber-50/40  dark:border-amber-800/30  dark:bg-amber-950/10',
                quarter_paid: 'border-sky-200    bg-sky-50/40    dark:border-sky-800/30    dark:bg-sky-950/10',
                normal:       'border-border bg-muted/10',
              }[dominant];

              return (
                <div
                  key={s.studentId}
                  className={`rounded-lg border transition-colors ${rowBg}`}
                >
                  {/* Main row */}
                  <div className="flex items-center gap-3 p-2.5">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className={`text-xs ${dominant === 'free_card' ? 'bg-purple-100 text-purple-700' : ''}`}>{initials}</AvatarFallback>
                      {imgUrl && <AvatarFallback>{initials}</AvatarFallback>}
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <SubjectTypeBadge type={dominant} />
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{s.email}</p>
                    </div>

                    {/* Subject count pill */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : s.studentId)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      {s.subjects.length} {s.subjects.length !== 1 ? subjectsLabel.toLowerCase() : subjectLabel.toLowerCase()}
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {/* Type selector â€” admin/teacher only */}
                    {canManage && (
                      <Select
                        value={dominant}
                        onValueChange={(val) => handleSetStudentType(s.studentId, val as StudentTypeValue)}
                        disabled={updatingId === s.studentId}
                      >
                        <SelectTrigger className="h-7 text-xs w-[130px] shrink-0">
                          {updatingId === s.studentId
                            ? <RefreshCw className="h-3 w-3 animate-spin" />
                            : <SelectValue />
                          }
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="half_paid">Half Paid</SelectItem>
                          <SelectItem value="quarter_paid">Quarter Paid</SelectItem>
                          <SelectItem value="free_card">Free Card</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Expanded: per-subject breakdown */}
                  {isExpanded && (
                    <div className="border-t border-border/50 px-3 pb-3 pt-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">{subjectLabel} enrollments</p>
                      <div className="space-y-1">
                        {s.subjects.map(sub => (
                          <div key={sub.subjectId} className="flex items-center justify-between text-xs">
                            <span className="truncate text-foreground">{sub.subjectName}</span>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <SubjectTypeBadge type={sub.studentType as StudentTypeValue} />
                              <Badge
                                variant="outline"
                                className={`text-[10px] py-0 h-4 ${VerifBadge[sub.verificationStatus] || 'text-muted-foreground'}`}
                              >
                                {sub.verificationStatus.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
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

export default ClassEnrollmentTypePanel;
