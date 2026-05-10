import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Bell,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import {
  NotificationScope,
  NotificationStatus,
  NotificationPriority,
  NotificationTargetUserType,
  PushNotification,
} from "@/lib/notificationEnums";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

interface AdminNotification extends PushNotification {}

interface AnalyticsData {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  successRate: number;
  totalRecipients: number;
  byScope: Record<string, number>;
  byPriority: Record<string, number>;
  timeline: Array<{
    date: string;
    sent: number;
    delivered: number;
    failed: number;
  }>;
}

const NotificationAnalytics = () => {
  const [dateRange, setDateRange] = useState("7d");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const params: any = { limit: 500 };
      
      // Calculate date range
      if (dateRange !== "custom") {
        const now = new Date();
        const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
        const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        params.fromDate = fromDate.toISOString().split('T')[0];
        params.toDate = now.toISOString().split('T')[0];
      } else if (customStartDate && customEndDate) {
        params.fromDate = customStartDate;
        params.toDate = customEndDate;
      }
      
      const response = await api.getAdminNotifications(params);
      if (response?.data) {
        setNotifications(response.data);
      } else if (Array.isArray(response)) {
        setNotifications(response);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch analytics data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [dateRange, customStartDate, customEndDate]);

  // Compute analytics from notifications
  const analytics: AnalyticsData = useMemo(() => {
    const totalSent = notifications.filter(n => n.status === 'SENT' || n.status === 'SENDING').length;
    const totalDelivered = notifications.reduce((sum, n) => sum + (n.sentCount || 0), 0);
    const totalFailed = notifications.reduce((sum, n) => sum + (n.failedCount || 0), 0);
    const totalRecipients = notifications.reduce((sum, n) => sum + (n.totalRecipients || 0), 0);
    const successRate = totalRecipients > 0 
      ? ((totalRecipients - totalFailed) / totalRecipients * 100) 
      : 0;

    // Group by scope
    const byScope: Record<string, number> = {};
    notifications.forEach(n => {
      byScope[n.scope] = (byScope[n.scope] || 0) + 1;
    });

    // Group by priority
    const byPriority: Record<string, number> = {};
    notifications.forEach(n => {
      byPriority[n.priority] = (byPriority[n.priority] || 0) + 1;
    });

    // Create timeline from notifications (group by date)
    const timelineMap: Record<string, { sent: number; delivered: number; failed: number }> = {};
    
    // Generate last N days based on range
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : dateRange === "90d" ? 90 : 7;
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      timelineMap[dateStr] = { sent: 0, delivered: 0, failed: 0 };
    }

    // Populate with actual data
    notifications.forEach(n => {
      const dateStr = n.sentAt?.split('T')[0] || n.createdAt?.split('T')[0];
      if (dateStr && timelineMap[dateStr]) {
        timelineMap[dateStr].sent += 1;
        timelineMap[dateStr].delivered += n.sentCount || 0;
        timelineMap[dateStr].failed += n.failedCount || 0;
      }
    });

    const timeline = Object.entries(timelineMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalSent,
      totalDelivered,
      totalFailed,
      successRate,
      totalRecipients,
      byScope,
      byPriority,
      timeline,
    };
  }, [notifications, dateRange]);

  const scopeChartData = Object.entries(analytics.byScope).map(([name, value]) => ({
    name,
    value,
  }));

  const priorityChartData = Object.entries(analytics.byPriority).map(([name, value]) => ({
    name,
    value,
  }));

  const handleRefresh = () => {
    fetchNotifications();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="col-span-2">
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="90d">Last 90 Days</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {dateRange === "custom" && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm">Start Date</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-[150px]"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm">End Date</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-[150px]"
                    />
                  </div>
                </>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              All notifications in period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalRecipients.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Target audience reached
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalDelivered.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.successRate.toFixed(1)}% success rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalFailed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Failed deliveries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Timeline Chart */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Notification Delivery Timeline</CardTitle>
            <CardDescription>Daily notification delivery metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {analytics.timeline.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: number) => [value.toLocaleString(), ""]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="sent"
                      stroke="#8884d8"
                      name="Sent"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="delivered"
                      stroke="#82ca9d"
                      name="Delivered"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="failed"
                      stroke="#ff7c7c"
                      name="Failed"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data available for the selected period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Distribution by Scope */}
        <Card>
          <CardHeader>
            <CardTitle>Distribution by Scope</CardTitle>
            <CardDescription>Notifications sent by scope level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {scopeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={scopeChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {scopeChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Distribution by Priority */}
        <Card>
          <CardHeader>
            <CardTitle>Distribution by Priority</CardTitle>
            <CardDescription>Notifications sent by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {priorityChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Bar dataKey="value" fill="#8884d8" name="Notifications" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NotificationAnalytics;