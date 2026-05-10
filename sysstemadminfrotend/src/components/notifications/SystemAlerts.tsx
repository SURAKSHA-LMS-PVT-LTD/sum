import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Plus,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
  Info,
  Shield,
  Server,
  Database,
  Activity,
  FileCheck,
  Cog,
  Send,
  Loader2,
  RefreshCw,
  Users,
  Building2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  NotificationScope,
  NotificationTargetUserType,
  NotificationStatus,
  NotificationPriority,
  TARGET_USER_TYPE_CONFIG,
  PushNotification,
} from "@/lib/notificationEnums";

interface SystemNotification extends PushNotification {}

const SystemAlerts = () => {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [institutes, setInstitutes] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  
  const [newNotification, setNewNotification] = useState({
    title: "",
    body: "",
    scope: NotificationScope.GLOBAL,
    targetUserTypes: [NotificationTargetUserType.STUDENTS] as NotificationTargetUserType[],
    priority: NotificationPriority.HIGH,
    instituteId: "",
  });

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      // Fetch system-wide notifications (GLOBAL scope or HIGH priority)
      const response = await api.getAdminNotifications({ 
        limit: 100,
        priority: 'HIGH' 
      });
      
      if (response?.data) {
        setNotifications(response.data);
      } else if (Array.isArray(response)) {
        setNotifications(response);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch system alerts",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInstitutes = async () => {
    try {
      const response = await api.getInstitutes(1, 100);
      if (response?.data) {
        setInstitutes(response.data.map((i: any) => ({ id: String(i.id), name: i.instituteName || i.name })));
      }
    } catch (error) {
      console.error("Failed to fetch institutes:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchInstitutes();
  }, []);

  // Summary statistics
  const stats = useMemo(() => {
    const totalAlerts = notifications.length;
    const sentAlerts = notifications.filter(n => n.status === NotificationStatus.SENT).length;
    const pendingAlerts = notifications.filter(n => n.status === NotificationStatus.SCHEDULED || n.status === NotificationStatus.DRAFT).length;
    const totalRecipients = notifications.reduce((sum, n) => sum + (n.totalRecipients || 0), 0);
    const failedCount = notifications.reduce((sum, n) => sum + (n.failedCount || 0), 0);
    
    return { totalAlerts, sentAlerts, pendingAlerts, totalRecipients, failedCount };
  }, [notifications]);

  const getStatusBadge = (status: NotificationStatus) => {
    switch (status) {
      case NotificationStatus.SENT:
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Sent</Badge>;
      case NotificationStatus.SCHEDULED:
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Scheduled</Badge>;
      case NotificationStatus.DRAFT:
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Draft</Badge>;
      case NotificationStatus.SENDING:
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Sending</Badge>;
      case NotificationStatus.FAILED:
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: NotificationPriority) => {
    switch (priority) {
      case NotificationPriority.HIGH:
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            High
          </Badge>
        );
      case NotificationPriority.NORMAL:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Normal
          </Badge>
        );
      case NotificationPriority.LOW:
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Low
          </Badge>
        );
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const getScopeIcon = (scope: NotificationScope) => {
    switch (scope) {
      case NotificationScope.GLOBAL:
        return <Users className="h-4 w-4 text-purple-500" />;
      case NotificationScope.INSTITUTE:
        return <Building2 className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const handleTargetTypeChange = (type: NotificationTargetUserType, checked: boolean) => {
    if (checked) {
      setNewNotification({
        ...newNotification,
        targetUserTypes: [...newNotification.targetUserTypes, type],
      });
    } else {
      setNewNotification({
        ...newNotification,
        targetUserTypes: newNotification.targetUserTypes.filter((t) => t !== type),
      });
    }
  };

  const handleCreateNotification = async () => {
    if (!newNotification.title || !newNotification.body) {
      toast({
        title: "Validation Error",
        description: "Title and message are required",
        variant: "destructive",
      });
      return;
    }

    if (newNotification.targetUserTypes.length === 0) {
      toast({
        title: "Validation Error",
        description: "Select at least one target audience",
        variant: "destructive",
      });
      return;
    }

    if (newNotification.scope === NotificationScope.INSTITUTE && !newNotification.instituteId) {
      toast({
        title: "Validation Error",
        description: "Please select an institute",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        title: newNotification.title,
        body: newNotification.body,
        scope: newNotification.scope,
        targetUserTypes: newNotification.targetUserTypes,
        priority: newNotification.priority,
        sendImmediately: true,
      };

      if (newNotification.scope === NotificationScope.INSTITUTE) {
        payload.instituteId = newNotification.instituteId;
      }

      await api.createPushNotification(payload);
      
      setIsCreateDialogOpen(false);
      setNewNotification({
        title: "",
        body: "",
        scope: NotificationScope.GLOBAL,
        targetUserTypes: [NotificationTargetUserType.STUDENTS],
        priority: NotificationPriority.HIGH,
        instituteId: "",
      });
      
      toast({
        title: "System Alert Created",
        description: "The system alert has been sent to all target users.",
      });
      
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create system alert",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendNotification = async (id: string) => {
    setActionLoadingId(id);
    try {
      await api.sendPushNotification(id);
      toast({
        title: "Alert Sent",
        description: "The system alert has been sent to all target users.",
      });
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send alert",
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    setActionLoadingId(id);
    try {
      await api.deletePushNotification(id);
      toast({
        title: "Alert Deleted",
        description: "The system alert has been deleted.",
      });
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete alert",
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
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
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAlerts}</div>
            <p className="text-xs text-muted-foreground">High priority notifications</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sentAlerts}</div>
            <p className="text-xs text-muted-foreground">Successfully sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRecipients.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Users reached</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failedCount}</div>
            <p className="text-xs text-muted-foreground">Failed deliveries</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              System Alerts
            </CardTitle>
            <CardDescription>
              Manage high-priority system-wide alerts and notifications
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchNotifications} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Alert
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create System Alert</DialogTitle>
                  <DialogDescription>
                    Create a new system alert to notify users about important updates, maintenance, or security issues.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="scope">Scope</Label>
                      <Select
                        value={newNotification.scope}
                        onValueChange={(value) => setNewNotification({ ...newNotification, scope: value as NotificationScope, instituteId: "" })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select scope" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NotificationScope.GLOBAL}>Global (All Users)</SelectItem>
                          <SelectItem value={NotificationScope.INSTITUTE}>Institute</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={newNotification.priority}
                        onValueChange={(value) => setNewNotification({ ...newNotification, priority: value as NotificationPriority })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NotificationPriority.LOW}>Low</SelectItem>
                          <SelectItem value={NotificationPriority.NORMAL}>Normal</SelectItem>
                          <SelectItem value={NotificationPriority.HIGH}>High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {newNotification.scope === NotificationScope.INSTITUTE && (
                    <div className="grid gap-2">
                      <Label htmlFor="institute">Institute</Label>
                      <Select
                        value={newNotification.instituteId}
                        onValueChange={(value) => setNewNotification({ ...newNotification, instituteId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select institute" />
                        </SelectTrigger>
                        <SelectContent>
                          {institutes.map((inst) => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="title">Alert Title</Label>
                    <Input
                      id="title"
                      value={newNotification.title}
                      onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                      placeholder="e.g., Scheduled System Maintenance"
                      maxLength={255}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="body">Alert Message</Label>
                    <Textarea
                      id="body"
                      value={newNotification.body}
                      onChange={(e) => setNewNotification({ ...newNotification, body: e.target.value })}
                      placeholder="Detailed description of the alert"
                      rows={4}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Target Audience</Label>
                    <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                      {Object.values(NotificationTargetUserType)
                        .filter(type => TARGET_USER_TYPE_CONFIG[type]?.category === 'basic')
                        .map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={type}
                            checked={newNotification.targetUserTypes.includes(type)}
                            onCheckedChange={(checked) => handleTargetTypeChange(type, checked as boolean)}
                          />
                          <label
                            htmlFor={type}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {TARGET_USER_TYPE_CONFIG[type]?.label || type}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateNotification} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create & Send Alert
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No system alerts found. Create your first alert to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alert</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.map((notification) => (
                  <TableRow key={notification.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{notification.title}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {notification.body}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getScopeIcon(notification.scope)}
                        <span className="text-sm">{notification.scope}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getPriorityBadge(notification.priority)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {notification.targetUserTypes?.map((type) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(notification.status)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <span className="font-medium">{notification.totalRecipients || 0}</span>
                        {notification.failedCount > 0 && (
                          <span className="text-red-500 ml-1">({notification.failedCount} failed)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            disabled={actionLoadingId === notification.id}
                          >
                            {actionLoadingId === notification.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(notification.status === "DRAFT" || notification.status === "SCHEDULED") && (
                            <DropdownMenuItem onClick={() => handleSendNotification(notification.id)}>
                              <Send className="h-4 w-4 mr-2" />
                              Send Now
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => handleDeleteNotification(notification.id)}
                            className="text-red-600"
                          >
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemAlerts;