import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader, StatsCard } from "@/components/shared/PageComponents";
import { MessageSquare, Send, BarChart3, Clock, CheckCircle2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { DataTable, Column, PaginationMeta } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { VerifySMSApprovalDialog } from "@/components/forms/VerifySMSApprovalDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface SMSApproval {
  messageId: string;
  maskIdUsed?: string;
  instituteId?: string;
  instituteName?: string;
  senderName?: string;
  messageTemplate?: string;
  totalRecipients?: number;
  estimatedCredits?: number;
  status?: string;
  [key: string]: any;
}

export default function SMSPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("approvals");

  // Approvals state
  const [approvals, setApprovals] = useState<SMSApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<SMSApproval | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  // Sending state
  const [sendPhone, setSendPhone] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Statistics state
  const [smsStats, setSmsStats] = useState<any>(null);
  const [credStatus, setCredStatus] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState<PaginationMeta | null>(null);

  useEffect(() => {
    fetchApprovals();
  }, [page, limit]);

  useEffect(() => {
    if (activeTab === "statistics") fetchStatistics();
    if (activeTab === "history") fetchHistory();
  }, [activeTab]);

  const fetchApprovals = async () => {
    try {
      setIsLoading(true);
      const response = await api.getSMSApprovals(page, limit);
      const mappedApprovals = (response.approvals || []).map((item: any) => ({
        ...item,
        id: item.messageId,
      }));
      setApprovals(mappedApprovals);
      setPagination({
        page: response.page || page,
        limit: response.limit || limit,
        total: response.total || 0,
        totalPages: response.totalPages || Math.ceil((response.total || 0) / (response.limit || limit)),
      });
    } catch {
      toast({ title: "Error", description: "Failed to load SMS approvals", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      setStatsLoading(true);
      const [statsRes, credRes] = await Promise.allSettled([
        api.getSmsStatistics(),
        api.getSmsCredentialsStatus(),
      ]);
      if (statsRes.status === "fulfilled") setSmsStats(statsRes.value);
      if (credRes.status === "fulfilled") setCredStatus(credRes.value);
    } catch {
      // ignore
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      // Message history requires an instituteId — use statistics as fallback
      const response = await api.getSmsStatistics();
      setHistory([]);
      setHistoryPagination({
        page: 1,
        limit: 10,
        total: response?.totalSent ?? 0,
        totalPages: 1,
      });
    } catch {
      toast({ title: "Error", description: "Failed to load SMS history", variant: "destructive" });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSendSMS = async () => {
    if (!sendPhone.trim() || !sendMessage.trim()) {
      toast({ title: "Validation", description: "Phone number and message are required", variant: "destructive" });
      return;
    }
    try {
      setSending(true);
      await api.sendCustomSms({ customRecipients: [sendPhone], messageTemplate: sendMessage });
      toast({ title: "Success", description: "SMS sent successfully" });
      setSendPhone("");
      setSendMessage("");
    } catch {
      toast({ title: "Error", description: "Failed to send SMS", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleView = (approval: SMSApproval) => {
    setSelectedApproval(approval);
    setViewDialogOpen(true);
  };

  const handleVerify = (approval: SMSApproval) => {
    setSelectedApproval(approval);
    setVerifyDialogOpen(true);
  };

  const approvalColumns: Column[] = [
    { key: "messageId", label: "Message ID" },
    { key: "maskIdUsed", label: "Sender ID" },
    { key: "instituteName", label: "Institute" },
    { key: "senderName", label: "Sender Name" },
    { key: "messageTemplate", label: "Message" },
    { key: "totalRecipients", label: "Recipients" },
    { key: "estimatedCredits", label: "Est. Credits" },
    { key: "status", label: "Status", type: "badge" },
    { key: "createdAt", label: "Created", type: "date" },
  ];

  const historyColumns: Column[] = [
    { key: "id", label: "ID" },
    { key: "phone", label: "Phone" },
    { key: "message", label: "Message" },
    { key: "status", label: "Status", type: "badge" },
    { key: "sentAt", label: "Sent At", type: "date" },
    { key: "creditUsed", label: "Credits" },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="SMS Management"
        description="Manage SMS approvals, sending, statistics, and history"
        icon={MessageSquare}
        actions={
          <Button variant="outline" onClick={fetchApprovals} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="approvals" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Approvals
          </TabsTrigger>
          <TabsTrigger value="send" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send SMS
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistics
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Approvals Tab */}
        <TabsContent value="approvals">
          <DataTable
            columns={approvalColumns}
            data={approvals}
            isLoading={isLoading}
            onView={handleView}
            onVerify={handleVerify}
            pagination={pagination || undefined}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
          />
        </TabsContent>

        {/* Send SMS Tab */}
        <TabsContent value="send">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Custom SMS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="+94XXXXXXXXX"
                  value={sendPhone}
                  onChange={(e) => setSendPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Type your message here..."
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">{sendMessage.length} characters</p>
              </div>
              <Button onClick={handleSendSMS} disabled={sending} className="gradient-primary shadow-glow">
                <Send className="w-4 h-4 mr-2" />
                {sending ? "Sending..." : "Send SMS"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Total Sent"
                value={statsLoading ? "..." : (smsStats?.totalSent ?? smsStats?.sent ?? 0).toLocaleString()}
                icon={Send}
              />
              <StatsCard
                title="Total Delivered"
                value={statsLoading ? "..." : (smsStats?.totalDelivered ?? smsStats?.delivered ?? 0).toLocaleString()}
                icon={CheckCircle2}
              />
              <StatsCard
                title="Total Failed"
                value={statsLoading ? "..." : (smsStats?.totalFailed ?? smsStats?.failed ?? 0).toLocaleString()}
                icon={MessageSquare}
              />
              <StatsCard
                title="Credits Remaining"
                value={statsLoading ? "..." : (credStatus?.creditsRemaining ?? credStatus?.balance ?? "N/A").toLocaleString()}
                icon={BarChart3}
              />
            </div>

            {credStatus && (
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>SMS Credentials Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Provider</p>
                      <p className="font-medium">{credStatus.provider ?? "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge className={credStatus.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {credStatus.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Mask ID</p>
                      <p className="font-medium">{credStatus.maskId ?? "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Updated</p>
                      <p className="font-medium">{credStatus.updatedAt ? new Date(credStatus.updatedAt).toLocaleDateString() : "N/A"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <DataTable
            columns={historyColumns}
            data={history}
            isLoading={historyLoading}
            onView={(row) => { setSelectedApproval(row); setViewDialogOpen(true); }}
            pagination={historyPagination || undefined}
            onPageChange={(p) => { setHistoryPage(p); fetchHistory(); }}
          />
        </TabsContent>
      </Tabs>

      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={selectedApproval}
        title={`SMS Details #${selectedApproval?.messageId || selectedApproval?.id || ""}`}
      />

      <VerifySMSApprovalDialog
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        approval={selectedApproval}
        onSuccess={fetchApprovals}
      />
    </DashboardLayout>
  );
}
