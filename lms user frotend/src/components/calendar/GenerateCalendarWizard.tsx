import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import calendarApi from '@/api/calendar.api';
import type { PublicHoliday, TermBreak, GenerateCalendarPayload } from '@/types/calendar.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Plus, Trash2, Rocket, AlertTriangle } from 'lucide-react';
import ResponsiveDatePicker from './ResponsiveDatePicker';
import { getErrorMessage } from '@/api/apiError';

// Sri Lanka 2026 public holidays preset
const SRI_LANKA_2026_HOLIDAYS: PublicHoliday[] = [
  { date: '2026-01-14', title: 'Tamil Thai Pongal Day' },
  { date: '2026-01-15', title: 'Duruthu Full Moon Poya Day' },
  { date: '2026-02-04', title: 'National Day' },
  { date: '2026-02-12', title: 'Navam Full Moon Poya Day' },
  { date: '2026-03-13', title: 'Medin Full Moon Poya Day' },
  { date: '2026-04-13', title: 'Day prior to Sinhala/Tamil New Year' },
  { date: '2026-04-14', title: 'Sinhala/Tamil New Year Day' },
  { date: '2026-05-01', title: 'May Day' },
  { date: '2026-05-11', title: 'Vesak Full Moon Poya Day' },
  { date: '2026-05-12', title: 'Day following Vesak' },
  { date: '2026-06-10', title: 'Poson Full Moon Poya Day' },
  { date: '2026-12-25', title: 'Christmas Day' },
];

const DEFAULT_TERM_BREAKS: TermBreak[] = [
  { startDate: '2026-04-06', endDate: '2026-04-19', title: 'First Term Break' },
  { startDate: '2026-08-01', endDate: '2026-08-16', title: 'Second Term Break' },
  { startDate: '2026-12-11', endDate: '2026-12-20', title: 'Third Term Break' },
];

const GenerateCalendarWizard: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-06`);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear()}-12-20`);
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([]);
  const [termBreaks, setTermBreaks] = useState<TermBreak[]>([]);

  const validateStep1 = () => {
    if (!/^\d{4}$/.test(academicYear)) { toast.error('Academic year must be 4 digits'); return false; }
    if (!startDate || !endDate) { toast.error('Start and end date required'); return false; }
    if (new Date(startDate) >= new Date(endDate)) { toast.error('Start must be before end date'); return false; }
    return true;
  };

  const validateStep2 = () => {
    for (const h of publicHolidays) {
      if (!h.title.trim()) { toast.error('All holidays must have a title'); return false; }
      if (h.date < startDate || h.date > endDate) { toast.error(`Holiday "${h.title}" is outside the date range`); return false; }
    }
    const dates = publicHolidays.map(h => h.date);
    if (new Set(dates).size !== dates.length) { toast.error('Duplicate holiday dates found'); return false; }
    return true;
  };

  const validateStep3 = () => {
    for (const tb of termBreaks) {
      if (!tb.title.trim()) { toast.error('All term breaks must have a title'); return false; }
      if (tb.startDate < startDate || tb.endDate > endDate) { toast.error(`Term break "${tb.title}" is outside range`); return false; }
      if (new Date(tb.startDate) >= new Date(tb.endDate)) { toast.error(`Term break "${tb.title}" start must be before end`); return false; }
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(s => s + 1);
  };

  const addHoliday = () => setPublicHolidays([...publicHolidays, { date: '', title: '' }]);
  const removeHoliday = (i: number) => setPublicHolidays(publicHolidays.filter((_, idx) => idx !== i));
  const updateHoliday = (i: number, field: keyof PublicHoliday, value: string) => {
    setPublicHolidays(publicHolidays.map((h, idx) => idx === i ? { ...h, [field]: value } : h));
  };

  const addTermBreak = () => setTermBreaks([...termBreaks, { startDate: '', endDate: '', title: '' }]);
  const removeTermBreak = (i: number) => setTermBreaks(termBreaks.filter((_, idx) => idx !== i));
  const updateTermBreak = (i: number, field: keyof TermBreak, value: string) => {
    setTermBreaks(termBreaks.map((tb, idx) => idx === i ? { ...tb, [field]: value } : tb));
  };

  const handleGenerate = async () => {
    if (!validateStep3()) return;
    setShowConfirm(true);
  };

  const confirmGenerate = async () => {
    if (!currentInstituteId) return;
    setShowConfirm(false);
    setGenerating(true);

    const payload: GenerateCalendarPayload = {
      academicYear, startDate, endDate, publicHolidays, termBreaks,
    };

    try {
      const res = await calendarApi.generateCalendar(currentInstituteId, payload);
      toast.success(res.message || 'Calendar generated successfully!');
      setResult(res.data);
    } catch (error: any) {
      if (error.message?.includes('409') || error.message?.includes('already exists')) {
        toast.error('Calendar already exists for this year. Delete it first to regenerate.');
      } else {
        toast.error(getErrorMessage(error, 'Failed to generate calendar'));
      }
    } finally {
      setGenerating(false);
    }
  };

  const totalDays = startDate && endDate ? Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1) : 0;

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-green-600">Calendar Generated!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-lg text-center">
              <div className="text-xl font-bold">{result.totalDays}</div>
              <div className="text-xs text-muted-foreground">Total Days</div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <div className="text-xl font-bold text-green-600">{result.breakdown?.regular}</div>
              <div className="text-xs text-muted-foreground">Working Days</div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
              <div className="text-xl font-bold text-blue-500">{result.breakdown?.weekend}</div>
              <div className="text-xs text-muted-foreground">Weekends</div>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
              <div className="text-xl font-bold text-red-500">{(result.breakdown?.publicHoliday || 0) + (result.breakdown?.instituteHoliday || 0)}</div>
              <div className="text-xs text-muted-foreground">Holidays</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Events created: {result.eventsCreated}</p>
          <Button variant="outline" onClick={() => { setResult(null); setStep(1); }}>Generate Another</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-4">
        {[1, 2, 3].map(s => (
          <React.Fragment key={s}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {s}
            </div>
            {s < 3 && <div className={`flex-1 h-1 rounded ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Step 1: Basic Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Academic Year</Label>
              <Input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2026" className="mt-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Date</Label>
                <div className="mt-1">
                  <ResponsiveDatePicker value={startDate} onChange={setStartDate} placeholder="Select start date" />
                </div>
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <div className="mt-1">
                  <ResponsiveDatePicker value={endDate} onChange={setEndDate} placeholder="Select end date" />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Estimated {totalDays} days will be generated.</p>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleNext}>Next: Public Holidays <ArrowRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Public Holidays */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Step 2: Public Holidays</CardTitle>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setPublicHolidays(SRI_LANKA_2026_HOLIDAYS)}>
                Load Sri Lanka 2026
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">These dates will be marked as PUBLIC_HOLIDAY. No attendance expected.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {publicHolidays.map((h, i) => (
              <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="w-full sm:w-44">
                  <ResponsiveDatePicker value={h.date} onChange={(v) => updateHoliday(i, 'date', v)} placeholder="Holiday date" />
                </div>
                <Input value={h.title} onChange={e => updateHoliday(i, 'title', e.target.value)} placeholder="Holiday name" className="flex-1 text-xs h-9" />
                <Button variant="ghost" size="sm" onClick={() => removeHoliday(i)} className="text-destructive h-9 w-9 p-0 flex-shrink-0 self-end sm:self-auto">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addHoliday} className="text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add Holiday
            </Button>

            <div className="flex justify-between pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button size="sm" onClick={handleNext}>
                Next: Term Breaks <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Term Breaks + Summary */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 3: Term Breaks</CardTitle>
            <p className="text-xs text-muted-foreground">Date ranges marked as INSTITUTE_HOLIDAY.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {termBreaks.map((tb, i) => (
              <div key={i} className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-2 border rounded-lg p-2 sm:border-0 sm:p-0">
                <div className="grid grid-cols-2 gap-2 sm:contents">
                  <div className="sm:w-40">
                    <ResponsiveDatePicker value={tb.startDate} onChange={(v) => updateTermBreak(i, 'startDate', v)} placeholder="Start" />
                  </div>
                  <div className="sm:w-40">
                    <ResponsiveDatePicker value={tb.endDate} onChange={(v) => updateTermBreak(i, 'endDate', v)} placeholder="End" />
                  </div>
                </div>
                <Input value={tb.title} onChange={e => updateTermBreak(i, 'title', e.target.value)} placeholder="Break name" className="flex-1 min-w-[120px] text-xs h-9" />
                <Button variant="ghost" size="sm" onClick={() => removeTermBreak(i)} className="text-destructive h-9 w-9 p-0 flex-shrink-0 self-end sm:self-auto">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addTermBreak} className="text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add Term Break
            </Button>

            {/* Summary */}
            <div className="p-3 bg-muted rounded-lg space-y-1 mt-4">
              <h4 className="text-sm font-medium">Summary</h4>
              <p className="text-xs text-muted-foreground">Total days: ~{totalDays}</p>
              <p className="text-xs text-muted-foreground">Public holidays: {publicHolidays.length}</p>
              <p className="text-xs text-muted-foreground">Term breaks: {termBreaks.length}</p>
            </div>

            <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
              <p className="text-xs text-yellow-700 dark:text-yellow-300">This will create {totalDays}+ records. Review before proceeding.</p>
            </div>

            <div className="flex justify-between pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button size="sm" onClick={handleGenerate} disabled={generating}>
                <Rocket className="h-4 w-4 mr-1" /> {generating ? 'Generating...' : 'Generate Calendar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create calendar records from {startDate} to {endDate} (~{totalDays} days).
              {publicHolidays.length > 0 && ` ${publicHolidays.length} public holidays will be marked.`}
              {termBreaks.length > 0 && ` ${termBreaks.length} term breaks will be marked.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmGenerate}>Generate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GenerateCalendarWizard;
