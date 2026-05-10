import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Send, BarChart3, AlertTriangle, Eye } from "lucide-react";
import NotificationDashboard from "@/components/notifications/NotificationDashboard";
import NotificationAnalytics from "@/components/notifications/NotificationAnalytics";
import SystemAlerts from "@/components/notifications/SystemAlerts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, Column } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";

const NotificationsPage = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Delivery tracking state
  const [trackInstituteId, setTrackInstituteId] = useState("");
  const [instituteNotifications, setInstituteNotifications] = useState<any[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const fetchInstituteNotifications = async () => {
    if (!trackInstituteId.trim()) {
      toast({ title: "Validation", description: "Please enter an Institute ID", variant: "destructive" });
      return;
    }
    try {
      setTrackLoading(true);
      const response = await api.getInstituteNotifications(trackInstituteId);
      const data = response.notifications || response.data || response || [];
      const mapped = Array.isArray(data) ? data.map((n: any, i: number) => ({ ...n, id: n.id || n.notificationId || i })) : [];
      setInstituteNotifications(mapped);
    } catch {
      toast({ title: "Error", description: "Failed to fetch institute notifications", variant: "destructive" });
    } finally {
      setTrackLoading(false);
    }
  };

  const handleMarkAsRead = async (notification: any) => {
    try {
      await api.markNotificationAsRead(notification.id || notification.notificationId);
      toast({ title: "Success", description: "Notification marked as read" });
      fetchInstituteNotifications();
    } catch {
      toast({ title: "Error", description: "Failed to mark as read", variant: "destructive" });
    }
  };

  const deliveryColumns: Column[] = [
    { key: "id", label: "ID" },
    { key: "title", label: "Title" },
    { key: "body", label: "Body" },
    { key: "type", label: "Type", type: "badge" },
    { key: "status", label: "Status", type: "badge" },
    { key: "readAt", label: "Read At", type: "date" },
    { key: "createdAt", label: "Created", type: "date" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-8 w-8" />
            Push Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage broadcast notifications, delivery tracking, and system alerts
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="delivery" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Delivery Tracking
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              System Alerts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <NotificationDashboard />
          </TabsContent>

          <TabsContent value="delivery">
            <div className="space-y-4">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Institute Notification Delivery</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="space-y-2">
                      <Label>Institute ID</Label>
                      <Input
                        placeholder="Enter Institute ID"
                        value={trackInstituteId}
                        onChange={(e) => setTrackInstituteId(e.target.value)}
                        className="w-64"
                      />
                    </div>
                    <Button onClick={fetchInstituteNotifications} className="gradient-primary shadow-glow">
                      Search
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <DataTable
                columns={deliveryColumns}
                data={instituteNotifications}
                isLoading={trackLoading}
                onView={(n) => { setSelectedNotification(n); setViewDialogOpen(true); }}
                customActions={[
                  {
                    label: "Mark Read",
                    onClick: handleMarkAsRead,
                    show: (row) => !row.readAt,
                  },
                ]}
              />
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <NotificationAnalytics />
          </TabsContent>

          <TabsContent value="alerts">
            <SystemAlerts />
          </TabsContent>
        </Tabs>
      </div>

      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={selectedNotification}
        title={`Notification: ${selectedNotification?.title || selectedNotification?.id || ""}`}
      />
    </DashboardLayout>
  );
};

export default NotificationsPage;
