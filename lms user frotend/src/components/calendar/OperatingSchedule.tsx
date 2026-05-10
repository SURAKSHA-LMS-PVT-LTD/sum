import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import calendarApi from '@/api/calendar.api';
import type { OperatingConfig } from '@/types/calendar.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, RotateCcw } from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, '0');
  const m = (i % 2 === 0 ? '00' : '30');
  return `${h}:${m}`;
});

const DEFAULT_CONFIGS: OperatingConfig[] = DAY_NAMES.map((name, i) => ({
  dayOfWeek: i + 1,
  dayName: name,
  isOperating: i < 5,
  startTime: i < 5 ? '08:00' : null,
  endTime: i < 5 ? '15:00' : null,
}));

const OperatingSchedule: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [configs, setConfigs] = useState<OperatingConfig[]>(DEFAULT_CONFIGS);
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentInstituteId) loadConfig();
  }, [currentInstituteId]);

  const loadConfig = async () => {
    if (!currentInstituteId) return;
    setLoading(true);
    try {
      const res = await calendarApi.getOperatingConfig(currentInstituteId);
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        setConfigs(res.data.map((d: any) => ({
          dayOfWeek: d.dayOfWeek,
          dayName: d.dayName || DAY_NAMES[d.dayOfWeek - 1],
          isOperating: d.isOperating,
          startTime: d.startTime || '08:00',
          endTime: d.endTime || '15:00',
        })));
      }
    } catch {
      // Keep defaults
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (index: number, updates: Partial<OperatingConfig>) => {
    setConfigs(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const applyPreset = (preset: string) => {
    switch (preset) {
      case 'mon-fri-8-3':
        setConfigs(DAY_NAMES.map((name, i) => ({
          dayOfWeek: i + 1, dayName: name,
          isOperating: i < 5, startTime: i < 5 ? '08:00' : null, endTime: i < 5 ? '15:00' : null,
        })));
        break;
      case 'mon-sat-8-1':
        setConfigs(DAY_NAMES.map((name, i) => ({
          dayOfWeek: i + 1, dayName: name,
          isOperating: i < 6, startTime: i < 6 ? '08:00' : null, endTime: i < 6 ? '13:00' : null,
        })));
        break;
      case '6-day':
        setConfigs(DAY_NAMES.map((name, i) => ({
          dayOfWeek: i + 1, dayName: name,
          isOperating: i < 6, startTime: i < 6 ? '07:30' : null, endTime: i < 6 ? '14:30' : null,
        })));
        break;
    }
  };

  const handleSave = async () => {
    if (!currentInstituteId) return;
    
    // Validate: operating days must have times
    for (const c of configs) {
      if (c.isOperating && (!c.startTime || !c.endTime)) {
        toast.error(`${c.dayName}: Start and end time required for operating days`);
        return;
      }
      if (c.isOperating && c.startTime && c.endTime && c.startTime >= c.endTime) {
        toast.error(`${c.dayName}: End time must be after start time`);
        return;
      }
    }

    setSaving(true);
    try {
      await calendarApi.saveOperatingConfigBulk(currentInstituteId, {
        academicYear,
        configs: configs.map(c => ({
          dayOfWeek: c.dayOfWeek,
          isOperating: c.isOperating,
          ...(c.isOperating ? { startTime: c.startTime!, endTime: c.endTime! } : {}),
        })),
      });
      toast.success('Operating schedule saved!');
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to save schedule'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">⚙️ Weekly Operating Schedule</CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Academic Year:</Label>
              <Select value={academicYear} onValueChange={setAcademicYear}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['2025', '2026', '2027'].map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Set the default operating hours for each day. This is used when generating the calendar.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden sm:block border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr,80px,100px,100px] gap-0 bg-muted/50 text-xs font-medium text-muted-foreground p-2 border-b">
              <div>Day</div>
              <div className="text-center">Operating</div>
              <div className="text-center">Start</div>
              <div className="text-center">End</div>
            </div>
            {configs.map((config, i) => (
              <div key={config.dayOfWeek} className={`grid grid-cols-[1fr,80px,100px,100px] gap-0 items-center p-2 text-sm ${i < configs.length - 1 ? 'border-b' : ''} ${!config.isOperating ? 'bg-muted/30' : ''}`}>
                <div className="font-medium">{config.dayName}</div>
                <div className="flex justify-center">
                  <Switch
                    checked={config.isOperating}
                    onCheckedChange={(checked) => updateConfig(i, {
                      isOperating: checked,
                      startTime: checked ? '08:00' : null,
                      endTime: checked ? '15:00' : null,
                    })}
                  />
                </div>
                <div className="flex justify-center">
                  {config.isOperating ? (
                    <Select value={config.startTime || '08:00'} onValueChange={(v) => updateConfig(i, { startTime: v })}>
                      <SelectTrigger className="w-20 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {TIME_OPTIONS.map(t => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="flex justify-center">
                  {config.isOperating ? (
                    <Select value={config.endTime || '15:00'} onValueChange={(v) => updateConfig(i, { endTime: v })}>
                      <SelectTrigger className="w-20 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {TIME_OPTIONS.map(t => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-2">
            {configs.map((config, i) => (
              <div key={config.dayOfWeek} className={`border rounded-lg p-3 space-y-2 ${!config.isOperating ? 'bg-muted/30' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{config.dayName}</span>
                  <Switch
                    checked={config.isOperating}
                    onCheckedChange={(checked) => updateConfig(i, {
                      isOperating: checked,
                      startTime: checked ? '08:00' : null,
                      endTime: checked ? '15:00' : null,
                    })}
                  />
                </div>
                {config.isOperating && (
                  <div className="flex items-center gap-2">
                    <Select value={config.startTime || '08:00'} onValueChange={(v) => updateConfig(i, { startTime: v })}>
                      <SelectTrigger className="flex-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {TIME_OPTIONS.map(t => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">to</span>
                    <Select value={config.endTime || '15:00'} onValueChange={(v) => updateConfig(i, { endTime: v })}>
                      <SelectTrigger className="flex-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-48">
                        {TIME_OPTIONS.map(t => (
                          <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground self-center">Presets:</span>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => applyPreset('mon-fri-8-3')}>Mon-Fri 8-3</Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => applyPreset('mon-sat-8-1')}>Mon-Sat 8-1</Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => applyPreset('6-day')}>6-Day Week</Button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={loadConfig}>
              <RotateCcw className="h-4 w-4 mr-1" /> Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save All'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OperatingSchedule;
