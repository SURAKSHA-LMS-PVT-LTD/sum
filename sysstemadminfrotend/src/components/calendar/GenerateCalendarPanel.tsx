import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, AlertTriangle, Rocket } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const SL_HOLIDAYS_2026 = [
  { date: "2026-01-14", title: "Tamil Thai Pongal Day" },
  { date: "2026-01-15", title: "Duruthu Full Moon Poya Day" },
  { date: "2026-02-04", title: "National Day" },
  { date: "2026-02-12", title: "Navam Full Moon Poya Day" },
  { date: "2026-03-13", title: "Medin Full Moon Poya Day" },
  { date: "2026-04-13", title: "Day prior to Sinhala/Tamil New Year" },
  { date: "2026-04-14", title: "Sinhala/Tamil New Year Day" },
  { date: "2026-05-01", title: "May Day" },
  { date: "2026-05-11", title: "Vesak Full Moon Poya Day" },
  { date: "2026-05-12", title: "Day following Vesak" },
  { date: "2026-06-10", title: "Poson Full Moon Poya Day" },
  { date: "2026-12-25", title: "Christmas Day" },
];

interface Props { instituteId: string; }

export function GenerateCalendarPanel({ instituteId }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [form, setForm] = useState({
    academicYear: "2026",
    startDate: "2026-01-06",
    endDate: "2026-12-20",
    publicHolidays: [] as Array<{ date: string; title: string }>,
    termBreaks: [
      { startDate: "2026-04-06", endDate: "2026-04-19", title: "First Term Break" },
      { startDate: "2026-08-01", endDate: "2026-08-16", title: "Second Term Break" },
      { startDate: "2026-12-11", endDate: "2026-12-20", title: "Third Term Break" },
    ] as Array<{ startDate: string; endDate: string; title: string }>,
  });

  function loadPresetHolidays() {
    setForm(f => ({ ...f, publicHolidays: [...SL_HOLIDAYS_2026] }));
  }

  function addHoliday() {
    setForm(f => ({ ...f, publicHolidays: [...f.publicHolidays, { date: "", title: "" }] }));
  }

  function removeHoliday(i: number) {
    setForm(f => ({ ...f, publicHolidays: f.publicHolidays.filter((_, idx) => idx !== i) }));
  }

  function updateHoliday(i: number, field: string, value: string) {
    setForm(f => {
      const next = [...f.publicHolidays];
      next[i] = { ...next[i], [field]: value };
      return { ...f, publicHolidays: next };
    });
  }

  function addTermBreak() {
    setForm(f => ({ ...f, termBreaks: [...f.termBreaks, { startDate: "", endDate: "", title: "" }] }));
  }

  function removeTermBreak(i: number) {
    setForm(f => ({ ...f, termBreaks: f.termBreaks.filter((_, idx) => idx !== i) }));
  }

  function updateTermBreak(i: number, field: string, value: string) {
    setForm(f => {
      const next = [...f.termBreaks];
      next[i] = { ...next[i], [field]: value };
      return { ...f, termBreaks: next };
    });
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await api.generateCalendar(instituteId, form);
      setResult(res.data || res);
      toast({ title: "Success", description: res.message || "Calendar generated!" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setGenerating(false); }
  }

  async function deleteCalendar() {
    setDeleting(true);
    try {
      await api.deleteCalendar(instituteId, form.academicYear);
      toast({ title: "Deleted", description: `Calendar for ${form.academicYear} deleted.` });
      setDeleteConfirm(false);
      setResult(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setDeleting(false); }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-4">
        {[1, 2, 3].map(s => (
          <button key={s} onClick={() => setStep(s)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${step === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            Step {s}: {s === 1 ? "Basic Info" : s === 2 ? "Public Holidays" : "Term Breaks"}
          </button>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Basic Info</CardTitle>
            <CardDescription>Set the academic year and date range</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Academic Year</Label>
                <Input value={form.academicYear} onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))} placeholder="2026" />
              </div>
              <div>
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Next: Public Holidays →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Public Holidays</CardTitle>
            <CardDescription>These dates will be marked as PUBLIC_HOLIDAY</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" size="sm" onClick={loadPresetHolidays}>📋 Load Sri Lanka 2026 Holidays</Button>

            <div className="space-y-2">
              {form.publicHolidays.map((h, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input type="date" value={h.date} onChange={e => updateHoliday(i, "date", e.target.value)} className="w-44" />
                  <Input value={h.title} onChange={e => updateHoliday(i, "title", e.target.value)} placeholder="Holiday name" className="flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => removeHoliday(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addHoliday}><Plus className="w-4 h-4 mr-1" /> Add Holiday</Button>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)}>Next: Term Breaks →</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Term Breaks</CardTitle>
            <CardDescription>These date ranges will be marked as INSTITUTE_HOLIDAY</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {form.termBreaks.map((tb, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap">
                  <Input type="date" value={tb.startDate} onChange={e => updateTermBreak(i, "startDate", e.target.value)} className="w-44" />
                  <span className="text-muted-foreground">to</span>
                  <Input type="date" value={tb.endDate} onChange={e => updateTermBreak(i, "endDate", e.target.value)} className="w-44" />
                  <Input value={tb.title} onChange={e => updateTermBreak(i, "title", e.target.value)} placeholder="Term break name" className="flex-1 min-w-[200px]" />
                  <Button variant="ghost" size="icon" onClick={() => removeTermBreak(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addTermBreak}><Plus className="w-4 h-4 mr-1" /> Add Term Break</Button>

            {result && (
              <Card className="bg-success/10 border-success/20">
                <CardContent className="pt-4">
                  <p className="font-medium text-foreground">Calendar Generated!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Working: {result.breakdown?.regular} | Weekends: {result.breakdown?.weekend} | Holidays: {result.breakdown?.publicHoliday} | Institute Holidays: {result.breakdown?.instituteHoliday} | Events: {result.eventsCreated}
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)}>
                  <Trash2 className="w-4 h-4 mr-1" /> Delete Calendar
                </Button>
              </div>
              <Button onClick={generate} disabled={generating}>
                <Rocket className="w-4 h-4 mr-1" />
                {generating ? "Generating..." : "Generate Calendar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Delete Calendar?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all calendar days and events for {form.academicYear}. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteCalendar} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
