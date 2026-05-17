import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronRight, ChevronLeft, School, BookOpen, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { useToast } from '@/hooks/use-toast';
import { cachedApiClient } from '@/api/cachedClient';
import AssignUsersDialog from '@/components/forms/AssignUsersDialog';
import AssignSubjectStudentsDialog from '@/components/forms/AssignSubjectStudentsDialog';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EnrollStep = 'institute' | 'class' | 'subject';

interface InstituteItem {
  id: string;
  name: string;
  shortName?: string;
  logo?: string;
  code?: string;
}

interface ClassItem {
  id: string;
  name: string;
  code?: string;
  grade?: number;
  description?: string;
}

interface SubjectItem {
  id: string;
  name: string;
  code?: string;
  imgUrl?: string;
  category?: string;
}

interface StudentEnrollDrilldownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which step to start from. Defaults to 'institute'. */
  startStep?: EnrollStep;
}

// ─── Component ────────────────────────────────────────────────────────────────

const StudentEnrollDrilldown: React.FC<StudentEnrollDrilldownProps> = ({
  open,
  onOpenChange,
  startStep = 'institute',
}) => {
  const { user, loadUserInstitutes, selectedInstitute, selectedClass } = useAuth();
  const { toast } = useToast();
  const { subjectLabel, subjectsLabel } = useInstituteLabels();

  // ── Step & selection state ────────────────────────────────────────────────
  const [step, setStep] = useState<EnrollStep>(startStep);
  const [pickedInstitute, setPickedInstitute] = useState<InstituteItem | null>(null);
  const [pickedClass, setPickedClass] = useState<ClassItem | null>(null);

  // ── Data ─────────────────────────────────────────────────────────────────
  const [institutes, setInstitutes] = useState<InstituteItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Downstream dialog state ───────────────────────────────────────────────
  const [showAssignClass, setShowAssignClass] = useState(false);
  const [showAssignSubject, setShowAssignSubject] = useState(false);

  // ── Reset on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setStep(startStep);
      // Pre-seed with current context to skip steps the user already selected
      if (startStep === 'class' && selectedInstitute) {
        setPickedInstitute(selectedInstitute as InstituteItem);
      } else if (startStep === 'subject' && selectedInstitute && selectedClass) {
        setPickedInstitute(selectedInstitute as InstituteItem);
        setPickedClass(selectedClass as ClassItem);
      } else {
        setPickedInstitute(null);
        setPickedClass(null);
      }
      setInstitutes([]);
      setClasses([]);
      setSubjects([]);
    }
  }, [open, startStep, selectedInstitute, selectedClass]);

  // ── Fetch institutes on institute step ──────────────────────────────────
  useEffect(() => {
    if (!open || step !== 'institute' || !user?.id) return;
    setLoading(true);
    loadUserInstitutes()
      .then((res) => setInstitutes(res as InstituteItem[]))
      .catch(() => toast({ title: 'Error', description: 'Failed to load institutes', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [open, step, user?.id]);

  // ── Fetch classes on class step ──────────────────────────────────────────
  useEffect(() => {
    if (!open || step !== 'class' || !pickedInstitute?.id) return;
    setLoading(true);
    cachedApiClient
      .get(`/institute-classes/institute/${pickedInstitute.id}?page=1&limit=200`)
      .then((res: any) => setClasses(res?.data ?? res ?? []))
      .catch(() => toast({ title: 'Error', description: 'Failed to load classes', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [open, step, pickedInstitute?.id]);

  // ── Fetch subjects on subject step ───────────────────────────────────────
  useEffect(() => {
    if (!open || step !== 'subject' || !pickedInstitute?.id || !pickedClass?.id) return;
    setLoading(true);
    cachedApiClient
      .get(`/institute-class-subjects?instituteId=${pickedInstitute.id}&classId=${pickedClass.id}&page=1&limit=200`)
      .then((res: any) => setSubjects(res?.data ?? res ?? []))
      .catch(() => toast({ title: 'Error', description: 'Failed to load subjects', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [open, step, pickedInstitute?.id, pickedClass?.id]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePickInstitute = useCallback((inst: InstituteItem) => {
    setPickedInstitute(inst);
    setPickedClass(null);
    setStep('class');
  }, []);

  const handlePickClass = useCallback((cls: ClassItem) => {
    setPickedClass(cls);
    setStep('subject');
  }, []);

  const handlePickSubject = useCallback((_sub: SubjectItem) => {
    // Open the assign-subject dialog (it reads institute/class/subject from AuthContext)
    // We close the drilldown and open the existing subject-assign dialog
    setShowAssignSubject(true);
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'class') setStep('institute');
    else if (step === 'subject') setStep('class');
  }, [step]);

  // ── Title helpers ─────────────────────────────────────────────────────────
  const stepTitle: Record<EnrollStep, string> = {
    institute: 'Select Institute',
    class: `Select Class — ${pickedInstitute?.shortName ?? pickedInstitute?.name ?? ''}`,
    subject: `Select ${subjectLabel} — ${pickedClass?.name ?? ''}`,
  };

  const stepIcon: Record<EnrollStep, React.ReactNode> = {
    institute: <School className="h-4 w-4" />,
    class: <Users className="h-4 w-4" />,
    subject: <BookOpen className="h-4 w-4" />,
  };

  return (
    <>
      <Dialog open={open && !showAssignClass && !showAssignSubject} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-border/60 bg-muted/40">
            <div className="flex items-center gap-3">
              {step !== 'institute' && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-md p-1 hover:bg-muted text-muted-foreground transition-colors"
                  aria-label="Go back"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <div className="flex items-center gap-2 text-sm font-medium">
                {stepIcon[step]}
                <DialogTitle className="text-sm font-semibold leading-none">
                  {stepTitle[step]}
                </DialogTitle>
              </div>
            </div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
              <span className={step === 'institute' ? 'text-primary font-medium' : ''}>Institute</span>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span className={step === 'class' ? 'text-primary font-medium' : step === 'subject' ? '' : 'opacity-40'}>
                Class
              </span>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span className={step === 'subject' ? 'text-primary font-medium' : 'opacity-40'}>Subject</span>
            </div>
          </DialogHeader>

          <ScrollArea className="h-[380px]">
            {loading ? (
              <div className="flex items-center justify-center h-full py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : (
              <div className="p-3">
                {/* ── Institute step ────────────────────────────────── */}
                {step === 'institute' && (
                  <div className="grid grid-cols-2 gap-2">
                    {institutes.length === 0 ? (
                      <p className="col-span-2 text-center text-sm text-muted-foreground py-8">No institutes found</p>
                    ) : institutes.map((inst) => (
                      <button
                        key={inst.id}
                        onClick={() => handlePickInstitute(inst)}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all text-center group"
                      >
                        <Avatar className="h-14 w-14 rounded-xl shadow-sm">
                          <AvatarImage src={inst.logo} alt={inst.name} className="object-cover" />
                          <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-bold text-lg">
                            {(inst.shortName ?? inst.name).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 w-full">
                          <p className="text-xs font-semibold text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                            {inst.shortName ?? inst.name}
                          </p>
                          {inst.code && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{inst.code}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Class step ────────────────────────────────────── */}
                {step === 'class' && (
                  <>
                    <div className="mb-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowAssignClass(true)}
                        className="w-full text-xs gap-1.5"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Assign students to a class directly
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {classes.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-8">No classes found</p>
                      ) : classes.map((cls) => (
                        <button
                          key={cls.id}
                          onClick={() => handlePickClass(cls)}
                          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all text-left group"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 text-sm font-bold">
                            {cls.grade ?? cls.name.slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {cls.name}
                            </p>
                            {cls.code && <p className="text-[11px] text-muted-foreground">{cls.code}</p>}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* ── Subject step ─────────────────────────────────── */}
                {step === 'subject' && (
                  <div className="space-y-1">
                    {subjects.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-8">No {subjectsLabel.toLowerCase()} found</p>
                    ) : subjects.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => handlePickSubject(sub)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all text-left group"
                      >
                        <Avatar className="h-9 w-9 rounded-lg shrink-0">
                          <AvatarImage src={sub.imgUrl} alt={sub.name} className="object-cover" />
                          <AvatarFallback className="rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400 text-xs font-bold">
                            {sub.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {sub.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {sub.code && <span className="text-[11px] text-muted-foreground">{sub.code}</span>}
                            {sub.category && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{sub.category}</Badge>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Downstream dialogs — they read institute/class/subject from AuthContext,
          so we rely on the globally selected context. If the user picked a different
          institute via this drilldown we show a note. */}
      <AssignUsersDialog
        open={showAssignClass}
        onOpenChange={(v) => { setShowAssignClass(v); if (!v) onOpenChange(false); }}
        onAssignmentComplete={() => { setShowAssignClass(false); onOpenChange(false); }}
      />
      <AssignSubjectStudentsDialog
        open={showAssignSubject}
        onOpenChange={(v) => { setShowAssignSubject(v); if (!v) onOpenChange(false); }}
        onAssignmentComplete={() => { setShowAssignSubject(false); onOpenChange(false); }}
      />
    </>
  );
};

export default StudentEnrollDrilldown;

