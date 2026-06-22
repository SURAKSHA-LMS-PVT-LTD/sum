import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import {
  MessageCircle,
  Users,
  Send,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  CalendarDays,
  UserCheck,
  ChevronRight,
  AlertCircle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Institute {
  id: string;
  name: string;
}

interface WhatsAppUser {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  language: string | null;
  instituteUserId?: string;
  userType?: string;
  sessionOpen: boolean | null;
}

interface SendResult {
  userId: string;
  name: string;
  phone: string;
  status: "sent" | "skipped_no_phone" | "skipped_closed_session" | "failed";
  deliveryId?: string;
  error?: string;
}

type FilterTab = "attendance" | "institute-users";

const LANG_LABELS: Record<string, string> = { S: 'සිං', E: 'ENG', T: 'தமி' };
const LANG_COLORS: Record<string, string> = {
  S: 'bg-blue-100 text-blue-800 border-blue-200',
  E: 'bg-purple-100 text-purple-800 border-purple-200',
  T: 'bg-orange-100 text-orange-800 border-orange-200',
};

function LanguageBadge({ language }: { language: string | null }) {
  if (!language) return null;
  const key = language.toUpperCase();
  return (
    <Badge className={`text-xs ${LANG_COLORS[key] ?? 'bg-gray-100 text-gray-700'}`}>
      {LANG_LABELS[key] ?? language}
    </Badge>
  );
}

function SessionBadge({ open }: { open: boolean | null }) {
  if (open === null) return <Badge variant="secondary">No phone</Badge>;
  return open ? (
    <Badge className="bg-green-100 text-green-800 border-green-200">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      Session open
    </Badge>
  ) : (
    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
      <Clock className="w-3 h-3 mr-1" />
      Session closed
    </Badge>
  );
}

export default function WhatsAppMessagingPage() {
  const { toast } = useToast();

  // Institute picker
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [instituteSearch, setInstituteSearch] = useState("");
  const [selectedInstitute, setSelectedInstitute] = useState<Institute | null>(null);

  // Filter mode
  const [filterTab, setFilterTab] = useState<FilterTab>("attendance");
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [userSearch, setUserSearch] = useState("");

  // User list
  const [users, setUsers] = useState<WhatsAppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [userTotalPages, setUserTotalPages] = useState(1);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Message
  const [message, setMessage] = useState("");
  const [sessionOnly, setSessionOnly] = useState(false);

  // Send
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null);
  const [sendSummary, setSendSummary] = useState<{
    sent: number;
    failed: number;
    skipped: number;
    total: number;
  } | null>(null);

  // Load institutes on mount
  useEffect(() => {
    api
      .whatsappGetInstitutes(undefined, 1, 200)
      .then((r: any) => setInstitutes(r.institutes || []))
      .catch(() => {});
  }, []);

  const filteredInstitutes = institutes.filter(i =>
    i.name.toLowerCase().includes(instituteSearch.toLowerCase()),
  );

  const loadUsers = useCallback(
    async (page = 1) => {
      if (!selectedInstitute) return;
      setUsersLoading(true);
      try {
        let data: any;
        if (filterTab === "attendance") {
          data = await api.whatsappGetAttendanceUsers(
            selectedInstitute.id,
            attendanceDate,
            page,
            100,
          );
        } else {
          data = await api.whatsappGetInstituteUsers(
            selectedInstitute.id,
            userSearch || undefined,
            page,
            50,
          );
        }
        setUsers(data.users || []);
        setUserTotal(data.total || 0);
        setUserTotalPages(data.totalPages || 1);
        setUserPage(page);
        setSelectedIds(new Set());
      } catch (e: any) {
        toast({ title: "Failed to load users", description: e.message, variant: "destructive" });
      } finally {
        setUsersLoading(false);
      }
    },
    [selectedInstitute, filterTab, attendanceDate, userSearch, toast],
  );

  useEffect(() => {
    if (selectedInstitute) loadUsers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInstitute, filterTab, attendanceDate]);

  const toggleSelect = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const all = users.map(u => u.userId);
    if (all.every(id => selectedIds.has(id))) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        all.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        all.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const allSelected = users.length > 0 && users.every(u => selectedIds.has(u.userId));

  const selectedUsers = users.filter(u => selectedIds.has(u.userId));
  const selectedWithPhone = selectedUsers.filter(u => u.phone);
  const selectedWithOpenSession = selectedWithPhone.filter(u => u.sessionOpen === true);

  const handleSend = async () => {
    if (!message.trim()) {
      toast({ title: "Message is required", variant: "destructive" });
      return;
    }
    if (selectedIds.size === 0) {
      toast({ title: "Select at least one user", variant: "destructive" });
      return;
    }

    setSending(true);
    setSendResults(null);
    setSendSummary(null);

    try {
      const result: any = await api.whatsappSendBulk({
        userIds: Array.from(selectedIds),
        message: message.trim(),
        instituteId: selectedInstitute?.id,
        sessionOpen: sessionOnly,
      });

      setSendResults(result.results || []);
      setSendSummary(result.summary || null);

      toast({
        title: `Sent ${result.summary?.sent ?? 0} messages`,
        description: `${result.summary?.failed ?? 0} failed, ${result.summary?.skipped ?? 0} skipped`,
      });
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const statusIcon = (status: SendResult["status"]) => {
    switch (status) {
      case "sent":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const statusLabel = (status: SendResult["status"]) => {
    switch (status) {
      case "sent":
        return "Sent";
      case "failed":
        return "Failed";
      case "skipped_no_phone":
        return "No phone";
      case "skipped_closed_session":
        return "Session closed";
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <PageHeader
          title="WhatsApp Messaging"
          description="Send WhatsApp session messages to users across institutes"
          icon={MessageCircle}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: User selection */}
          <div className="lg:col-span-2 space-y-4">
            {/* Institute picker */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Select Institute
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search institutes..."
                    value={instituteSearch}
                    onChange={e => setInstituteSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredInstitutes.map(inst => (
                    <button
                      key={inst.id}
                      onClick={() => setSelectedInstitute(inst)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${
                        selectedInstitute?.id === inst.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      {inst.name}
                      {selectedInstitute?.id === inst.id && (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  ))}
                  {filteredInstitutes.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No institutes found
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* User filter + list */}
            {selectedInstitute && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Select Users — {selectedInstitute.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs
                    value={filterTab}
                    onValueChange={v => setFilterTab(v as FilterTab)}
                  >
                    <TabsList>
                      <TabsTrigger value="attendance">
                        <CalendarDays className="w-4 h-4 mr-1" />
                        Today's Attendees
                      </TabsTrigger>
                      <TabsTrigger value="institute-users">
                        <UserCheck className="w-4 h-4 mr-1" />
                        All Institute Users
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="attendance" className="mt-3 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={attendanceDate}
                          onChange={e => setAttendanceDate(e.target.value)}
                          className="w-44"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadUsers(1)}
                          disabled={usersLoading}
                        >
                          <RefreshCw className={`w-4 h-4 mr-1 ${usersLoading ? "animate-spin" : ""}`} />
                          Refresh
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="institute-users" className="mt-3 space-y-2">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            placeholder="Search by name or phone..."
                            value={userSearch}
                            onChange={e => setUserSearch(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && loadUsers(1)}
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadUsers(1)}
                          disabled={usersLoading}
                        >
                          <Search className="w-4 h-4" />
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{userTotal} total</span>
                    <span>{users.filter(u => u.sessionOpen).length} session open</span>
                    <span>{selectedIds.size} selected</span>
                  </div>

                  {/* Select all + user list */}
                  <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                    {users.length > 0 && (
                      <div className="flex items-center gap-3 px-2 py-1 border-b">
                        <Checkbox
                          id="select-all"
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                        />
                        <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                          Select all ({users.length})
                        </Label>
                      </div>
                    )}

                    {usersLoading ? (
                      <div className="py-8 text-center text-muted-foreground text-sm">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading users...
                      </div>
                    ) : users.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground text-sm">
                        No users found
                      </div>
                    ) : (
                      users.map(u => (
                        <div
                          key={u.userId}
                          className={`flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer transition-colors ${
                            selectedIds.has(u.userId) ? "bg-primary/8" : "hover:bg-muted"
                          }`}
                          onClick={() => toggleSelect(u.userId)}
                        >
                          <Checkbox
                            checked={selectedIds.has(u.userId)}
                            onCheckedChange={() => toggleSelect(u.userId)}
                            onClick={e => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {u.firstName} {u.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {u.phone || "No phone"}{u.userType ? ` · ${u.userType}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <LanguageBadge language={u.language} />
                            <SessionBadge open={u.phone ? u.sessionOpen : null} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Pagination */}
                  {userTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={userPage <= 1 || usersLoading}
                        onClick={() => loadUsers(userPage - 1)}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {userPage} of {userTotalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={userPage >= userTotalPages || usersLoading}
                        onClick={() => loadUsers(userPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Message composer + results */}
          <div className="space-y-4">
            {/* Composer */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Compose Message
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Selection summary */}
                {selectedIds.size > 0 && (
                  <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Selected</span>
                      <span className="font-medium">{selectedIds.size} users</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">With phone</span>
                      <span className="font-medium">{selectedWithPhone.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Session open</span>
                      <span className="font-medium text-green-700">{selectedWithOpenSession.length}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    placeholder="Type your WhatsApp message..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {message.length} chars
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="session-only"
                    checked={sessionOnly}
                    onCheckedChange={v => setSessionOnly(!!v)}
                  />
                  <Label htmlFor="session-only" className="text-sm cursor-pointer">
                    Only send to users with open session
                  </Label>
                </div>

                {!sessionOnly && (
                  <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Sending to users with a closed 24h session window may fail — WhatsApp only allows
                      free session messages within 24h of the last user interaction.
                    </span>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleSend}
                  disabled={sending || selectedIds.size === 0 || !message.trim()}
                >
                  {sending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send to {selectedIds.size} user{selectedIds.size !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Send results */}
            {sendSummary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Send Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-green-50 p-2">
                      <p className="text-xl font-bold text-green-700">{sendSummary.sent}</p>
                      <p className="text-xs text-green-600">Sent</p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-2">
                      <p className="text-xl font-bold text-red-700">{sendSummary.failed}</p>
                      <p className="text-xs text-red-600">Failed</p>
                    </div>
                    <div className="rounded-lg bg-yellow-50 p-2">
                      <p className="text-xl font-bold text-yellow-700">{sendSummary.skipped}</p>
                      <p className="text-xs text-yellow-600">Skipped</p>
                    </div>
                  </div>

                  {sendResults && sendResults.length > 0 && (
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {sendResults.map((r, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-2 py-1.5 rounded text-sm"
                        >
                          {statusIcon(r.status)}
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate block">
                              {r.name || r.userId}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {r.phone || "no phone"}
                            </span>
                          </div>
                          <span className={`text-xs font-medium ${
                            r.status === "sent" ? "text-green-600" :
                            r.status === "failed" ? "text-red-600" : "text-yellow-600"
                          }`}>
                            {statusLabel(r.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
