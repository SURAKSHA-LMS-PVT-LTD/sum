import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) => [`${String(h).padStart(2, "0")}:00`, `${String(h).padStart(2, "0")}:30`]).flat();

interface Config {
  dayOfWeek: number;
  isOperating: boolean;
  startTime: string;
  endTime: string;
}

interface Props { instituteId: string; }

export function OperatingConfigPanel({ instituteId }: Props) {
  const { toast } = useToast();
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [configs, setConfigs] = useState<Config[]>(
    Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i + 1,
      isOperating: i < 5,
      startTime: "08:00",
      endTime: "15:00",
    }))
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadConfig(); }, [instituteId]);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await api.getOperatingConfig(instituteId);
      if (res.data?.length > 0) {
        setConfigs(res.data.map((d: any) => ({
          dayOfWeek: d.dayOfWeek,
          isOperating: d.isOperating,
          startTime: d.startTime || "08:00",
          endTime: d.endTime || "15:00",
        })));
      }
    } catch {} finally { setLoading(false); }
  }

  function applyPreset(type: string) {
    if (type === "mon-fri") {
      setConfigs(configs.map(c => ({ ...c, isOperating: c.dayOfWeek <= 5, startTime: "08:00", endTime: "15:00" })));
    } else if (type === "mon-sat") {
      setConfigs(configs.map(c => ({ ...c, isOperating: c.dayOfWeek <= 6, startTime: "08:00", endTime: c.dayOfWeek === 6 ? "13:00" : "15:00" })));
    }
  }

  async function saveAll() {
    setSaving(true);
    try {
      await api.setOperatingConfigBulk(instituteId, {
        academicYear,
        configs: configs.map(c => ({
          dayOfWeek: c.dayOfWeek,
          isOperating: c.isOperating,
          ...(c.isOperating ? { startTime: c.startTime, endTime: c.endTime } : {}),
        })),
      });
      toast({ title: "Success", description: "Operating schedule saved!" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  function updateConfig(index: number, updates: Partial<Config>) {
    const next = [...configs];
    next[index] = { ...next[index], ...updates };
    setConfigs(next);
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Operating Schedule</CardTitle>
        <CardDescription>Set the default operating hours for each day of the week</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-foreground">Academic Year:</label>
          <Select value={academicYear} onValueChange={setAcademicYear}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["2025", "2026", "2027"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => applyPreset("mon-fri")}>Mon–Fri 8–3</Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset("mon-sat")}>Mon–Sat 8–1</Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-3 text-sm font-medium text-foreground">Day</th>
                <th className="text-center p-3 text-sm font-medium text-foreground">Operating</th>
                <th className="text-center p-3 text-sm font-medium text-foreground">Start Time</th>
                <th className="text-center p-3 text-sm font-medium text-foreground">End Time</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c, i) => (
                <tr key={c.dayOfWeek} className="border-t border-border">
                  <td className="p-3 text-foreground font-medium">{DAY_NAMES[c.dayOfWeek]}</td>
                  <td className="p-3 text-center">
                    <Switch checked={c.isOperating} onCheckedChange={(v) => updateConfig(i, { isOperating: v })} />
                  </td>
                  <td className="p-3 text-center">
                    <Select value={c.startTime} onValueChange={(v) => updateConfig(i, { startTime: v })} disabled={!c.isOperating}>
                      <SelectTrigger className="w-24 mx-auto"><SelectValue /></SelectTrigger>
                      <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-center">
                    <Select value={c.endTime} onValueChange={(v) => updateConfig(i, { endTime: v })} disabled={!c.isOperating}>
                      <SelectTrigger className="w-24 mx-auto"><SelectValue /></SelectTrigger>
                      <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={loadConfig}>Reset</Button>
          <Button onClick={saveAll} disabled={saving}>{saving ? "Saving..." : "Save All"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
