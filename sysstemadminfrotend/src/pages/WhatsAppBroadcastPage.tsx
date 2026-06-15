import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import {
  Send, Users, RefreshCw, CheckCircle2, AlertCircle, Building2,
  Save, Trash2, FileJson, Image as ImageIcon, Type, History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── Option lists (mirror backend whitelists) ──
const USER_TYPES = ["USER", "USER_WITHOUT_PARENT", "USER_WITHOUT_STUDENT"];
const INSTITUTE_USER_TYPES = ["STUDENT", "TEACHER", "STAFF", "ADMIN", "PARENT", "ATTENDANCE_MARKER"];
const INSTITUTE_STATUSES = ["ACTIVE", "PENDING", "INACTIVE", "SUSPENDED", "FORMER"];
const GENDERS = ["MALE", "FEMALE", "OTHER"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const CARD_STATUSES = ["ACTIVE", "INACTIVE", "EXPIRED", "LOST", "DAMAGED", "REPLACED"];
const SUBSCRIPTION_PLANS = ["FREE", "WHATSAPP", "TELEGRAM", "EMAIL", "PRO_WHATSAPP", "PRO_SMS", "PRO_TELEGRAM", "PRO_EMAIL", "DYNAMAD"];
const OCCUPATIONS = ["TEACHER", "ENGINEER", "DOCTOR", "NURSE", "ACCOUNTANT", "BUSINESS_OWNER", "DRIVER", "FARMER", "POLICE_OFFICER", "HOUSEWIFE", "UNEMPLOYED", "RETIRED_PERSON"];
const ATTENDANCE_STATUSES = [
  { v: 1, l: "Present" }, { v: 0, l: "Absent" }, { v: 2, l: "Late" },
  { v: 3, l: "Left" }, { v: 4, l: "Left Early" }, { v: 5, l: "Left Lately" },
];
const PLACEHOLDERS = ["{firstname}", "{lastname}", "{fullname}", "{studentid}", "{instituteid}", "{phone}"];

interface Institute { id: string; name: string; }
interface AudienceFilter {
  instituteId?: string;
  classId?: string;
  notInClassId?: string;
  userTypes?: string[];
  instituteUserTypes?: string[];
  instituteUserStatuses?: string[];
  isActive?: boolean;
  hasParent?: boolean;
  parentOccupations?: string[];
  bloodGroups?: string[];
  genders?: string[];
  subscriptionPlans?: string[];
  packageExpired?: boolean;
  freePackage?: boolean;
  cardStatuses?: string[];
  attendanceStatus?: number;
  attendanceFrom?: string;
  attendanceTo?: string;
  hasPhone?: boolean;
}

/** A multi-select rendered as a wrap of toggleable chips. */
function ChipMulti({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o]);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={`text-xs px-2 py-1 rounded-full border transition ${
              selected.includes(o)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:border-primary/50"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function WhatsAppBroadcastPage() {
  const { toast } = useToast();

  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [filter, setFilter] = useState<AudienceFilter>({ hasPhone: true });

  const [count, setCount] = useState<{ total: number; withPhone: number } | null>(null);
  const [counting, setCounting] = useState(false);

  // Message composer
  const [messageType, setMessageType] = useState<"text" | "image" | "document" | "interactive">("text");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [interactiveJson, setInteractiveJson] = useState("");
  const [sessionOpenOnly, setSessionOpenOnly] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState("");

  // Campaign history
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    api.waBroadcastGetInstitutes().then(r => setInstitutes(r.institutes || [])).catch(() => {});
    refreshTemplates();
    refreshCampaigns();
  }, []);

  const refreshTemplates = () => api.waBroadcastListTemplates().then(setTemplates).catch(() => {});
  const refreshCampaigns = () => api.waBroadcastListCampaigns(20).then(setCampaigns).catch(() => {});

  const set = (patch: Partial<AudienceFilter>) => setFilter(f => ({ ...f, ...patch }));

  const handlePreview = useCallback(async () => {
    setCounting(true);
    setCount(null);
    try {
      const res = await api.waBroadcastPreview(filter);
      setCount(res);
    } catch (e: any) {
      toast({ title: "Preview failed", description: e.message, variant: "destructive" });
    } finally {
      setCounting(false);
    }
  }, [filter, toast]);

  const insertPlaceholder = (p: string) => setMessage(m => `${m}${p}`);

  const handleSend = async () => {
    if (messageType === "interactive") {
      try { JSON.parse(interactiveJson); }
      catch { toast({ title: "Invalid JSON", description: "The interactive/flow JSON is not valid.", variant: "destructive" }); return; }
    } else if (!message.trim() && messageType === "text") {
      toast({ title: "Message required", variant: "destructive" }); return;
    } else if ((messageType === "image" || messageType === "document") && !mediaUrl.trim()) {
      toast({ title: "Media URL required", variant: "destructive" }); return;
    }

    if (!count || count.withPhone === 0) {
      toast({ title: "Run preview first", description: "No recipients with a phone matched.", variant: "destructive" });
      return;
    }
    if (!confirm(`Send to ${count.withPhone} recipient(s) with a phone number?`)) return;

    setSending(true);
    setLastResult(null);
    try {
      const res = await api.waBroadcastSend({
        filter,
        message,
        name: templateName || undefined,
        sessionOpenOnly,
        messageType,
        mediaUrl: mediaUrl || undefined,
        fileName: fileName || undefined,
        interactive: messageType === "interactive" ? JSON.parse(interactiveJson) : undefined,
      });
      setLastResult(res.summary);
      toast({ title: "Broadcast sent", description: `Sent ${res.summary.sent}, failed ${res.summary.failed}.` });
      refreshCampaigns();
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { toast({ title: "Template name required", variant: "destructive" }); return; }
    try {
      await api.waBroadcastSaveTemplate({
        name: templateName,
        body: message,
        flowJson: messageType === "interactive" ? interactiveJson : undefined,
        placeholders: PLACEHOLDERS.filter(p => message.includes(p)).map(p => p.replace(/[{}]/g, "")),
      });
      toast({ title: "Template saved" });
      refreshTemplates();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const loadTemplate = (t: any) => {
    setMessage(t.body || "");
    setTemplateName(t.name || "");
    if (t.flowJson) { setMessageType("interactive"); setInteractiveJson(t.flowJson); }
  };

  return (
    <DashboardLayout>
      <PageHeader title="WhatsApp Broadcast" description="Filter an audience, preview the count, personalize, and send in one click." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Audience filter ── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="w-4 h-4" /> Audience filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> Institute</Label>
                <Select value={filter.instituteId || "all"} onValueChange={v => set({ instituteId: v === "all" ? undefined : v })}>
                  <SelectTrigger><SelectValue placeholder="All institutes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All institutes</SelectItem>
                    {institutes.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Enrolled in class ID</Label>
                <Input value={filter.classId || ""} onChange={e => set({ classId: e.target.value || undefined })} placeholder="optional class id" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">NOT enrolled in class ID</Label>
                <Input value={filter.notInClassId || ""} onChange={e => set({ notInClassId: e.target.value || undefined })} placeholder="e.g. students not taking science" />
              </div>
            </div>

            <ChipMulti label="User type" options={USER_TYPES} selected={filter.userTypes || []} onChange={v => set({ userTypes: v })} />
            <ChipMulti label="Institute role" options={INSTITUTE_USER_TYPES} selected={filter.instituteUserTypes || []} onChange={v => set({ instituteUserTypes: v })} />
            <ChipMulti label="Institute membership status" options={INSTITUTE_STATUSES} selected={filter.instituteUserStatuses || []} onChange={v => set({ instituteUserStatuses: v })} />
            <ChipMulti label="Parent occupation (student's father/mother/guardian)" options={OCCUPATIONS} selected={filter.parentOccupations || []} onChange={v => set({ parentOccupations: v })} />
            <ChipMulti label="Blood group" options={BLOOD_GROUPS} selected={filter.bloodGroups || []} onChange={v => set({ bloodGroups: v })} />
            <ChipMulti label="Gender" options={GENDERS} selected={filter.genders || []} onChange={v => set({ genders: v })} />
            <ChipMulti label="Subscription plan" options={SUBSCRIPTION_PLANS} selected={filter.subscriptionPlans || []} onChange={v => set({ subscriptionPlans: v })} />
            <ChipMulti label="Card status" options={CARD_STATUSES} selected={filter.cardStatuses || []} onChange={v => set({ cardStatuses: v })} />

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={filter.hasParent === true} onCheckedChange={c => set({ hasParent: c ? true : undefined })} />
                Students WITH a parent
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={filter.hasParent === false} onCheckedChange={c => set({ hasParent: c ? false : undefined })} />
                Students WITHOUT a parent
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!filter.freePackage} onCheckedChange={c => set({ freePackage: c ? true : undefined })} />
                Free package only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!filter.packageExpired} onCheckedChange={c => set({ packageExpired: c ? true : undefined })} />
                Package expired
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={filter.isActive === true} onCheckedChange={c => set({ isActive: c ? true : undefined })} />
                Active accounts only
              </label>
            </div>

            {/* Attendance */}
            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs font-medium">Attendance-based (optional)</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Select value={filter.attendanceStatus?.toString() ?? "any"} onValueChange={v => set({ attendanceStatus: v === "any" ? undefined : Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Any status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any status</SelectItem>
                    {ATTENDANCE_STATUSES.map(s => <SelectItem key={s.v} value={s.v.toString()}>{s.l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="date" value={filter.attendanceFrom || ""} onChange={e => set({ attendanceFrom: e.target.value || undefined })} />
                <Input type="date" value={filter.attendanceTo || ""} onChange={e => set({ attendanceTo: e.target.value || undefined })} />
              </div>
            </div>

            <Button onClick={handlePreview} disabled={counting} className="w-full gap-2">
              {counting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Preview count
            </Button>

            {count && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm flex items-center justify-between">
                <span>Matched: <strong>{count.total}</strong></span>
                <span className="text-green-600">With phone (sendable): <strong>{count.withPhone}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Message + send ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Send className="w-4 h-4" /> Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-1">
                {([["text", Type], ["image", ImageIcon], ["document", FileJson], ["interactive", FileJson]] as const).map(([t, Icon]) => (
                  <Button key={t} variant={messageType === t ? "default" : "outline"} size="sm" className="flex-1 gap-1 text-xs" onClick={() => setMessageType(t as any)}>
                    <Icon className="w-3 h-3" /> {t}
                  </Button>
                ))}
              </div>

              {(messageType === "image" || messageType === "document") && (
                <Input placeholder="Media URL (https://...)" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} />
              )}
              {messageType === "document" && (
                <Input placeholder="File name (optional)" value={fileName} onChange={e => setFileName(e.target.value)} />
              )}

              {messageType === "interactive" ? (
                <Textarea
                  placeholder='Paste WhatsApp interactive / Flow JSON here'
                  value={interactiveJson}
                  onChange={e => setInteractiveJson(e.target.value)}
                  className="font-mono text-xs h-40"
                />
              ) : (
                <>
                  <div className="flex flex-wrap gap-1">
                    {PLACEHOLDERS.map(p => (
                      <button key={p} type="button" onClick={() => insertPlaceholder(p)}
                        className="text-[11px] px-1.5 py-0.5 rounded border bg-background hover:border-primary/50">
                        {p}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder={messageType === "text" ? "Message body (use placeholders above)" : "Caption (optional)"}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="h-32"
                  />
                </>
              )}

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={sessionOpenOnly} onCheckedChange={c => setSessionOpenOnly(!!c)} />
                Only send to open sessions
              </label>

              <Button onClick={handleSend} disabled={sending} className="w-full gap-2">
                {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send broadcast
              </Button>

              {lastResult && (
                <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3 h-3" /> Sent: {lastResult.sent}</div>
                  <div>Failed: {lastResult.failed}</div>
                  <div>Open sessions: {lastResult.openSession} / {lastResult.matched}</div>
                  <div className="text-muted-foreground">Skipped (no phone): {lastResult.skippedNoPhone}, (closed session): {lastResult.skippedClosedSession}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Templates */}
          <Card>
            <CardHeader><CardTitle className="text-base">Templates</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Template name" value={templateName} onChange={e => setTemplateName(e.target.value)} />
                <Button size="icon" variant="outline" onClick={handleSaveTemplate} title="Save"><Save className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-1 max-h-40 overflow-auto">
                {templates.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-sm rounded border px-2 py-1">
                    <button className="truncate text-left flex-1" onClick={() => loadTemplate(t)}>{t.name}</button>
                    <button onClick={async () => { await api.waBroadcastDeleteTemplate(t.id); refreshTemplates(); }} className="text-destructive ml-2"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                {templates.length === 0 && <p className="text-xs text-muted-foreground">No templates yet.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Campaign history ── */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="w-4 h-4" /> Recent broadcasts</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm">
            {campaigns.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded border px-3 py-2">
                <div className="truncate flex-1">
                  <span className="font-medium">{c.name || "(unnamed)"}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge className="bg-green-100 text-green-800">sent {c.sentCount}</Badge>
                  {c.failedCount > 0 && <Badge className="bg-red-100 text-red-800">failed {c.failedCount}</Badge>}
                  <span className="text-muted-foreground">open {c.openSessionCount}/{c.totalMatched}</span>
                  <Badge variant="outline">{c.status}</Badge>
                </div>
              </div>
            ))}
            {campaigns.length === 0 && <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3" /> No broadcasts yet.</p>}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
