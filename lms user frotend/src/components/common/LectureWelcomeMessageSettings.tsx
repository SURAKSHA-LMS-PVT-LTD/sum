import React, { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export interface WelcomeMessageSettingsData {
  welcomeMessageEnabled: boolean;
  welcomeMessageText: string;
  welcomeMessageVoiceEnabled: boolean;
}

interface LectureWelcomeMessageSettingsProps {
  data: WelcomeMessageSettingsData;
  onChange: (data: WelcomeMessageSettingsData) => void;
}

const TOKENS = [
  { label: 'Name', token: '{{name}}', hint: 'Student name' },
  { label: 'Greeting', token: '{{greeting}}', hint: 'Good morning/afternoon/evening' },
  { label: 'Time Of Day', token: '{{timeOfDay}}', hint: 'morning/afternoon/evening' },
];

const LectureWelcomeMessageSettings: React.FC<LectureWelcomeMessageSettingsProps> = ({ data, onChange }) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const updateField = (field: keyof WelcomeMessageSettingsData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const insertToken = (token: string) => {
    const current = data.welcomeMessageText || '';
    const el = textareaRef.current;
    if (!el) {
      updateField('welcomeMessageText', `${current}${token}`);
      return;
    }

    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    updateField('welcomeMessageText', next);

    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + token.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const token = e.dataTransfer.getData('text/plain');
    if (token) insertToken(token);
  };

  return (
    <Card className="border-sky-100 dark:border-sky-900/50">
      <CardHeader className="pb-3 bg-sky-50/60 dark:bg-sky-900/10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-md">Welcome Message</CardTitle>
            <CardDescription>Show a short message before the lecture starts</CardDescription>
          </div>
          <Switch
            checked={data.welcomeMessageEnabled}
            onCheckedChange={(v) => updateField('welcomeMessageEnabled', v)}
          />
        </div>
      </CardHeader>

      {data.welcomeMessageEnabled && (
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="welcomeMessageText">Message</Label>
            <Textarea
              id="welcomeMessageText"
              ref={textareaRef}
              rows={4}
              value={data.welcomeMessageText}
              onChange={(e) => updateField('welcomeMessageText', e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              placeholder="{{greeting}} {{name}}, welcome to this lecture. Please stay connected and complete the session."
            />
          </div>

          <div className="space-y-2">
            <Label>Dynamic keywords</Label>
            <div className="flex flex-wrap gap-2">
              {TOKENS.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', item.token)}
                  onClick={() => insertToken(item.token)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  title={item.hint}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Drag or click a keyword to insert it into the message.</p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <div>
              <Label htmlFor="welcomeMessageVoiceEnabled" className="text-sm font-medium">Enable voice narration</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Uses the browser default voice (male if available).</p>
            </div>
            <Switch
              id="welcomeMessageVoiceEnabled"
              checked={data.welcomeMessageVoiceEnabled}
              onCheckedChange={(v) => updateField('welcomeMessageVoiceEnabled', v)}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default LectureWelcomeMessageSettings;
