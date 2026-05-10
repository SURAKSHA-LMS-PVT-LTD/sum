import { useState, useEffect } from "react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Send,
  Plus,
  MoreHorizontal,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Building2,
  Loader2,
  RefreshCw,
  Calendar,
  Image,
  Link,
  GraduationCap,
  BookOpen,
  Search,
  Filter,
  Eye,
  RotateCcw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Globe,
  Ban,
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

interface AdminNotification extends PushNotification {}

interface SendNotificationResult {
  success: boolean;
  notificationId: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  usersWithoutTokens: number;
  usersWithTokens: number;
  message: string;
  details: {
    targetedUsers: number;
    usersWithTokens: number;
    usersWithoutTokens: number;
    successfulSends: number;
    failedSends: number;
    deliveryRate: string;
  };
}

const NotificationDashboard = () => {
  // Data state
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AdminNotification | null>(null);
  
  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SendNotificationResult | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: "",
    scope: "" as NotificationScope | "",
    status: "" as NotificationStatus | "",
    priority: "" as NotificationPriority | "",
    instituteId: "",
    dateFrom: "",
    dateTo: "",
  });
  
  const [showFilters, setShowFilters] = useState(false);
  
  // Form state
  const [newNotification, setNewNotification] = useState({
    title: "",
    body: "",
    scope: NotificationScope.GLOBAL,
    targetUserTypes: [NotificationTargetUserType.ALL] as NotificationTargetUserType[],
    priority: NotificationPriority.NORMAL,
    instituteId: "",
    classId: "",
    subjectId: "",
    imageUrl: "",
    actionUrl: "",
    sendImmediately: true,
    scheduledAt: "",
  });

  // Reference data
  const [institutes, setInstitutes] = useState<Array<{ id: string; name: string }>>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);

  // Fetch notifications
  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: filters.page,
        limit: filters.limit,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      };
      
      if (filters.search) params.search = filters.search;
      if (filters.scope) params.scope = filters.scope;
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.instituteId) params.instituteId = filters.instituteId;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      
      const response = await api.getAdminNotifications(params);
      if (response?.data) {
        setNotifications(response.data);
        setTotalPages(response.totalPages || 1);
        setTotalCount(response.total || response.data.length);
      } else if (Array.isArray(response)) {
        setNotifications(response);
        setTotalCount(response.length);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch notifications",
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

  const fetchClasses = async (instituteId: string) => {
    try {
      const response = await api.getClassesByInstitute(instituteId);
      if (response?.data) {
        setClasses(response.data.map((c: any) => ({ id: String(c.id), name: c.className || c.name })));
      } else if (Array.isArray(response)) {
        setClasses(response.map((c: any) => ({ id: String(c.id), name: c.className || c.name })));
      }
    } catch (error) {
      console.error("Failed to fetch classes:", error);
    }
  };

  const fetchSubjects = async (classId: string) => {
    try {
      const response = await api.getSubjectsByClass(classId, newNotification.instituteId);
      if (response?.data) {
        setSubjects(response.data.map((s: any) => ({ id: String(s.subjectId || s.subject?.id || s.id), name: s.subject?.name || s.subjectName || s.name })));
      } else if (Array.isArray(response)) {
        setSubjects(response.map((s: any) => ({ id: String(s.subjectId || s.subject?.id || s.id), name: s.subject?.name || s.subjectName || s.name })));
      }
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchInstitutes();
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [filters.page, filters.limit]);

  useEffect(() => {
    if (newNotification.instituteId) {
      fetchClasses(newNotification.instituteId);
    } else {
      setClasses([]);
    }
  }, [newNotification.instituteId]);

  useEffect(() => {
    if (newNotification.classId) {
      fetchSubjects(newNotification.classId);
    } else {
      setSubjects([]);
    }
  }, [newNotification.classId]);

  // Stats
  const stats = {
    total: totalCount,
    sent: notifications.filter((n) => n.status === NotificationStatus.SENT).length,
    scheduled: notifications.filter((n) => n.status === NotificationStatus.SCHEDULED).length,
    draft: notifications.filter((n) => n.status === NotificationStatus.DRAFT).length,
    failed: notifications.filter((n) => n.status === NotificationStatus.FAILED).length,
    totalFailed: notifications.reduce((sum, n) => sum + (n.failedCount || 0), 0),
  };

  // Badge renderers
  const getStatusBadge = (status: NotificationStatus) => {
    const config: Record<NotificationStatus, { className: string; label: string; icon: React.ReactNode }> = {
      [NotificationStatus.SENT]: { 
        className: "bg-green-100 text-green-800 hover:bg-green-100", 
        label: "Sent",
        icon: <CheckCircle className="h-3 w-3 mr-1" />
      },
      [NotificationStatus.SCHEDULED]: { 
        className: "bg-orange-100 text-orange-800 hover:bg-orange-100", 
        label: "Scheduled",
        icon: <Clock className="h-3 w-3 mr-1" />
      },
      [NotificationStatus.DRAFT]: { 
        className: "bg-blue-100 text-blue-800 hover:bg-blue-100", 
        label: "Draft",
        icon: <AlertCircle className="h-3 w-3 mr-1" />
      },
      [NotificationStatus.SENDING]: { 
        className: "bg-purple-100 text-purple-800 hover:bg-purple-100", 
        label: "Sending",
        icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      },
      [NotificationStatus.FAILED]: { 
        className: "bg-red-100 text-red-800 hover:bg-red-100", 
        label: "Failed",
        icon: <XCircle className="h-3 w-3 mr-1" />
      },
      [NotificationStatus.CANCELLED]: { 
        className: "bg-gray-100 text-gray-800 hover:bg-gray-100", 
        label: "Cancelled",
        icon: <Ban className="h-3 w-3 mr-1" />
      },
    };
    const c = config[status] || { className: "bg-gray-100", label: status, icon: null };
    return (
      <Badge className={`${c.className} flex items-center`}>
        {c.icon}
        {c.label}
      </Badge>
    );
  };

  const getScopeBadge = (scope: NotificationScope) => {
    const config: Record<NotificationScope, { className: string; icon: any; label: string }> = {
      [NotificationScope.GLOBAL]: { 
        label: "Global", 
        className: "bg-purple-100 text-purple-800", 
        icon: Globe 
      },
      [NotificationScope.INSTITUTE]: { 
        label: "Institute", 
        className: "bg-blue-100 text-blue-800", 
        icon: Building2 
      },
      [NotificationScope.CLASS]: { 
        label: "Class", 
        className: "bg-green-100 text-green-800", 
        icon: GraduationCap 
      },
      [NotificationScope.SUBJECT]: { 
        label: "Subject", 
        className: "bg-orange-100 text-orange-800", 
        icon: BookOpen 
      },
    };
    const c = config[scope] || config[NotificationScope.GLOBAL];
    const Icon = c.icon;
    return (
      <Badge className={`${c.className} hover:opacity-80 flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {c.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: NotificationPriority) => {
    const config: Record<NotificationPriority, string> = {
      [NotificationPriority.HIGH]: "bg-red-100 text-red-800",
      [NotificationPriority.NORMAL]: "bg-gray-100 text-gray-800",
      [NotificationPriority.LOW]: "bg-slate-100 text-slate-600",
    };
    return (
      <Badge className={config[priority] || config[NotificationPriority.NORMAL]}>
        {priority}
      </Badge>
    );
  };

  // Target type handling
  const handleTargetTypeChange = (type: NotificationTargetUserType, checked: boolean) => {
    if (type === NotificationTargetUserType.ALL) {
      if (checked) {
        setNewNotification({
          ...newNotification,
          targetUserTypes: [NotificationTargetUserType.ALL],
        });
      } else {
        setNewNotification({
          ...newNotification,
          targetUserTypes: [],
        });
      }
    } else {
      if (checked) {
        setNewNotification({
          ...newNotification,
          targetUserTypes: [...newNotification.targetUserTypes.filter(t => t !== NotificationTargetUserType.ALL), type],
        });
      } else {
        setNewNotification({
          ...newNotification,
          targetUserTypes: newNotification.targetUserTypes.filter((t) => t !== type),
        });
      }
    }
  };

  // Actions
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

    if (newNotification.scope !== NotificationScope.GLOBAL && !newNotification.instituteId) {
      toast({
        title: "Validation Error",
        description: "Institute is required for non-global notifications",
        variant: "destructive",
      });
      return;
    }

    if ((newNotification.scope === NotificationScope.CLASS || newNotification.scope === NotificationScope.SUBJECT) && !newNotification.classId) {
      toast({
        title: "Validation Error",
        description: "Class is required for class/subject notifications",
        variant: "destructive",
      });
      return;
    }

    if (newNotification.scope === NotificationScope.SUBJECT && !newNotification.subjectId) {
      toast({
        title: "Validation Error",
        description: "Subject is required for subject notifications",
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
        sendImmediately: newNotification.sendImmediately,
      };

      if (newNotification.imageUrl) payload.imageUrl = newNotification.imageUrl;
      if (newNotification.actionUrl) payload.actionUrl = newNotification.actionUrl;
      if (newNotification.scope !== NotificationScope.GLOBAL) payload.instituteId = newNotification.instituteId;
      if (newNotification.scope === NotificationScope.CLASS || newNotification.scope === NotificationScope.SUBJECT) {
        payload.classId = newNotification.classId;
      }
      if (newNotification.scope === NotificationScope.SUBJECT) payload.subjectId = newNotification.subjectId;
      if (!newNotification.sendImmediately && newNotification.scheduledAt) {
        payload.scheduledAt = new Date(newNotification.scheduledAt).toISOString();
      }

      await api.createPushNotification(payload);
      
      setIsCreateDialogOpen(false);
      resetForm();
      
      toast({
        title: "Notification Created",
        description: newNotification.sendImmediately 
          ? "Your notification has been sent." 
          : "Your notification has been scheduled.",
      });
      
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create notification",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewNotification({
      title: "",
      body: "",
      scope: NotificationScope.GLOBAL,
      targetUserTypes: [NotificationTargetUserType.ALL],
      priority: NotificationPriority.NORMAL,
      instituteId: "",
      classId: "",
      subjectId: "",
      imageUrl: "",
      actionUrl: "",
      sendImmediately: true,
      scheduledAt: "",
    });
  };

  const handleSendNotification = async (id: string) => {
    setActionLoadingId(id);
    try {
      const result: SendNotificationResult = await api.sendPushNotification(id);
      
      // Store result for detailed dialog
      setSendResult(result);
      setShowResultDialog(true);
      
      // Check if anyone received the notification
      if (result.sentCount === 0 && result.usersWithoutTokens === result.totalRecipients) {
        // All users don't have the app installed
        toast({
          title: "⚠️ No Notifications Delivered",
          description: `All ${result.totalRecipients} targeted users don't have the app installed or have notifications disabled. No notifications were sent.`,
          variant: "destructive",
        });
      } else if (result.sentCount === 0 && result.usersWithoutTokens > 0) {
        // Some users don't have tokens but none were delivered
        toast({
          title: "⚠️ Delivery Failed",
          description: `0 out of ${result.totalRecipients} users received the notification. ${result.usersWithoutTokens} users don't have the app installed.`,
          variant: "destructive",
        });
      } else if (result.usersWithoutTokens > 0) {
        // Partial delivery
        toast({
          title: "⚠️ Partially Delivered",
          description: `Successfully sent to ${result.sentCount} out of ${result.totalRecipients} users. ${result.usersWithoutTokens} users don't have the app installed. Delivery rate: ${result.details.deliveryRate}`,
        });
      } else if (result.failedCount > 0) {
        // Some failures
        toast({
          title: "⚠️ Sent with Errors",
          description: `Sent to ${result.sentCount} users, but ${result.failedCount} deliveries failed. Delivery rate: ${result.details.deliveryRate}`,
        });
      } else {
        // Perfect delivery
        toast({
          title: "✅ Notification Sent Successfully",
          description: `Successfully delivered to all ${result.sentCount} users (100% delivery rate)!`,
        });
      }
      
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResendNotification = async (id: string) => {
    setActionLoadingId(id);
    try {
      const result: SendNotificationResult = await api.resendPushNotification(id);
      
      // Store result for detailed dialog
      setSendResult(result);
      setShowResultDialog(true);
      
      // Same logic as send
      if (result.sentCount === 0 && result.usersWithoutTokens === result.totalRecipients) {
        toast({
          title: "⚠️ Resend Failed",
          description: `All ${result.totalRecipients} targeted users don't have the app installed. No notifications were delivered.`,
          variant: "destructive",
        });
      } else if (result.sentCount === 0) {
        toast({
          title: "⚠️ Resend Failed",
          description: `Failed to deliver to any users. ${result.usersWithoutTokens} users don't have the app.`,
          variant: "destructive",
        });
      } else if (result.usersWithoutTokens > 0) {
        toast({
          title: "⚠️ Resent with Limitations",
          description: `Delivered to ${result.sentCount}/${result.totalRecipients} users. ${result.usersWithoutTokens} users don't have the app. Delivery rate: ${result.details.deliveryRate}`,
        });
      } else {
        toast({
          title: "✅ Notification Resent",
          description: `Successfully delivered to ${result.sentCount} users (${result.details.deliveryRate} delivery rate)!`,
        });
      }
      
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resend notification",
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelNotification = async (id: string) => {
    setActionLoadingId(id);
    try {
      await api.cancelPushNotification(id);
      toast({
        title: "Notification Cancelled",
        description: "The scheduled notification has been cancelled.",
      });
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel notification",
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
        title: "Notification Deleted",
        description: "The notification has been deleted.",
      });
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete notification",
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleViewNotification = async (notification: AdminNotification) => {
    setSelectedNotification(notification);
    setIsViewDialogOpen(true);
  };

  const handleApplyFilters = () => {
    setFilters({ ...filters, page: 1 });
    fetchNotifications();
  };

  const handleClearFilters = () => {
    setFilters({
      page: 1,
      limit: 10,
      search: "",
      scope: "",
      status: "",
      priority: "",
      instituteId: "",
      dateFrom: "",
      dateTo: "",
    });
    setTimeout(() => fetchNotifications(), 0);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.scheduled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.draft}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            {stats.totalFailed > 0 && (
              <p className="text-xs text-muted-foreground">{stats.totalFailed} deliveries failed</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Push Notifications</CardTitle>
            <CardDescription>Create and manage push notifications for users</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchNotifications} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Notification
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Push Notification</DialogTitle>
                  <DialogDescription>
                    Create a new push notification to send to users.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {/* Title */}
                  <div className="grid gap-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={newNotification.title}
                      onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                      placeholder="Notification title"
                      maxLength={255}
                    />
                    <span className="text-xs text-muted-foreground text-right">{newNotification.title.length}/255</span>
                  </div>
                  
                  {/* Body */}
                  <div className="grid gap-2">
                    <Label htmlFor="body">Message *</Label>
                    <Textarea
                      id="body"
                      value={newNotification.body}
                      onChange={(e) => setNewNotification({ ...newNotification, body: e.target.value })}
                      placeholder="Notification message"
                      rows={4}
                      maxLength={5000}
                    />
                    <span className="text-xs text-muted-foreground text-right">{newNotification.body.length}/5000</span>
                  </div>

                  {/* Scope & Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Scope *</Label>
                      <Select
                        value={newNotification.scope}
                        onValueChange={(value) => setNewNotification({ 
                          ...newNotification, 
                          scope: value as NotificationScope,
                          instituteId: "",
                          classId: "",
                          subjectId: "",
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select scope" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NotificationScope.GLOBAL}>
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4" />
                              Global (All Users)
                            </div>
                          </SelectItem>
                          <SelectItem value={NotificationScope.INSTITUTE}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              Institute-wide
                            </div>
                          </SelectItem>
                          <SelectItem value={NotificationScope.CLASS}>
                            <div className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4" />
                              Specific Class
                            </div>
                          </SelectItem>
                          <SelectItem value={NotificationScope.SUBJECT}>
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-4 w-4" />
                              Specific Subject
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Priority</Label>
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

                  {/* Institute Selection */}
                  {newNotification.scope !== NotificationScope.GLOBAL && (
                    <div className="grid gap-2">
                      <Label>Institute *</Label>
                      <Select
                        value={newNotification.instituteId}
                        onValueChange={(value) => setNewNotification({ 
                          ...newNotification, 
                          instituteId: value,
                          classId: "",
                          subjectId: "",
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select institute" />
                        </SelectTrigger>
                        <SelectContent>
                          {institutes.map((inst) => (
                            <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Class Selection */}
                  {(newNotification.scope === NotificationScope.CLASS || newNotification.scope === NotificationScope.SUBJECT) && newNotification.instituteId && (
                    <div className="grid gap-2">
                      <Label>Class *</Label>
                      <Select
                        value={newNotification.classId}
                        onValueChange={(value) => setNewNotification({ 
                          ...newNotification, 
                          classId: value,
                          subjectId: "",
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Subject Selection */}
                  {newNotification.scope === NotificationScope.SUBJECT && newNotification.classId && (
                    <div className="grid gap-2">
                      <Label>Subject *</Label>
                      <Select
                        value={newNotification.subjectId}
                        onValueChange={(value) => setNewNotification({ ...newNotification, subjectId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((sub) => (
                            <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Target Audience */}
                  <div className="grid gap-2">
                    <Label>Target Audience *</Label>
                    <div className="space-y-4 p-4 border rounded-md">
                      {/* Basic User Types */}
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Basic Roles</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {Object.values(NotificationTargetUserType)
                            .filter(type => TARGET_USER_TYPE_CONFIG[type]?.category === 'basic')
                            .map((type) => (
                              <div key={type} className="flex items-start space-x-2">
                                <Checkbox
                                  id={type}
                                  checked={newNotification.targetUserTypes.includes(type)}
                                  onCheckedChange={(checked) => handleTargetTypeChange(type, !!checked)}
                                />
                                <div className="grid gap-0.5 leading-none">
                                  <label htmlFor={type} className="text-sm font-medium cursor-pointer">
                                    {TARGET_USER_TYPE_CONFIG[type]?.label || type}
                                  </label>
                                  <span className="text-xs text-muted-foreground">
                                    {TARGET_USER_TYPE_CONFIG[type]?.description}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                      
                      {/* Advanced Filters - Only show for GLOBAL scope */}
                      {newNotification.scope === NotificationScope.GLOBAL && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">Advanced Filters (Global Only)</p>
                          <div className="grid grid-cols-2 gap-3">
                            {Object.values(NotificationTargetUserType)
                              .filter(type => TARGET_USER_TYPE_CONFIG[type]?.category === 'advanced')
                              .map((type) => (
                                <div key={type} className="flex items-start space-x-2">
                                  <Checkbox
                                    id={type}
                                    checked={newNotification.targetUserTypes.includes(type)}
                                    onCheckedChange={(checked) => handleTargetTypeChange(type, !!checked)}
                                  />
                                  <div className="grid gap-0.5 leading-none">
                                    <label htmlFor={type} className="text-sm font-medium cursor-pointer">
                                      {TARGET_USER_TYPE_CONFIG[type]?.label || type}
                                    </label>
                                    <span className="text-xs text-muted-foreground">
                                      {TARGET_USER_TYPE_CONFIG[type]?.description}
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {newNotification.targetUserTypes.includes(NotificationTargetUserType.ALL) && (
                      <p className="text-xs text-muted-foreground">
                        "All Users" is selected - notification will be sent to everyone.
                      </p>
                    )}
                  </div>

                  {/* Image & Action URLs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="imageUrl" className="flex items-center gap-1">
                        <Image className="h-4 w-4" />
                        Image URL (Optional)
                      </Label>
                      <Input
                        id="imageUrl"
                        value={newNotification.imageUrl}
                        onChange={(e) => setNewNotification({ ...newNotification, imageUrl: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="actionUrl" className="flex items-center gap-1">
                        <Link className="h-4 w-4" />
                        Action URL (Optional)
                      </Label>
                      <Input
                        id="actionUrl"
                        value={newNotification.actionUrl}
                        onChange={(e) => setNewNotification({ ...newNotification, actionUrl: e.target.value })}
                        placeholder="app://path or https://..."
                      />
                    </div>
                  </div>

                  {/* Scheduling */}
                  <div className="grid gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sendImmediately"
                        checked={newNotification.sendImmediately}
                        onCheckedChange={(checked) => setNewNotification({ ...newNotification, sendImmediately: !!checked })}
                      />
                      <label htmlFor="sendImmediately" className="text-sm font-medium">
                        Send Immediately
                      </label>
                    </div>
                  </div>

                  {!newNotification.sendImmediately && (
                    <div className="grid gap-2">
                      <Label htmlFor="scheduledAt" className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Schedule For
                      </Label>
                      <Input
                        id="scheduledAt"
                        type="datetime-local"
                        value={newNotification.scheduledAt}
                        onChange={(e) => setNewNotification({ ...newNotification, scheduledAt: e.target.value })}
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateNotification} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {newNotification.sendImmediately ? "Send Now" : "Schedule"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        {/* Filters Section */}
        {showFilters && (
          <div className="px-6 pb-4">
            <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search title or body..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Scope</Label>
                  <Select
                    value={filters.scope}
                    onValueChange={(value) => setFilters({ ...filters, scope: value as NotificationScope })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All scopes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All scopes</SelectItem>
                      <SelectItem value={NotificationScope.GLOBAL}>Global</SelectItem>
                      <SelectItem value={NotificationScope.INSTITUTE}>Institute</SelectItem>
                      <SelectItem value={NotificationScope.CLASS}>Class</SelectItem>
                      <SelectItem value={NotificationScope.SUBJECT}>Subject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => setFilters({ ...filters, status: value as NotificationStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All statuses</SelectItem>
                      <SelectItem value={NotificationStatus.DRAFT}>Draft</SelectItem>
                      <SelectItem value={NotificationStatus.SCHEDULED}>Scheduled</SelectItem>
                      <SelectItem value={NotificationStatus.SENDING}>Sending</SelectItem>
                      <SelectItem value={NotificationStatus.SENT}>Sent</SelectItem>
                      <SelectItem value={NotificationStatus.FAILED}>Failed</SelectItem>
                      <SelectItem value={NotificationStatus.CANCELLED}>Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select
                    value={filters.priority}
                    onValueChange={(value) => setFilters({ ...filters, priority: value as NotificationPriority })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All priorities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All priorities</SelectItem>
                      <SelectItem value={NotificationPriority.LOW}>Low</SelectItem>
                      <SelectItem value={NotificationPriority.NORMAL}>Normal</SelectItem>
                      <SelectItem value={NotificationPriority.HIGH}>High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Institute</Label>
                  <Select
                    value={filters.instituteId}
                    onValueChange={(value) => setFilters({ ...filters, instituteId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All institutes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All institutes</SelectItem>
                      {institutes.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">From Date</Label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">To Date</Label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={handleClearFilters}>
                  Clear
                </Button>
                <Button size="sm" onClick={handleApplyFilters}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        )}

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notifications found. Create your first notification to get started.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <div className="font-medium truncate">{notification.title}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {notification.body}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getScopeBadge(notification.scope)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[120px]">
                          {notification.targetUserTypes?.slice(0, 2).map((type) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {TARGET_USER_TYPE_CONFIG[type]?.label || type}
                            </Badge>
                          ))}
                          {notification.targetUserTypes?.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{notification.targetUserTypes.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(notification.status)}</TableCell>
                      <TableCell>{getPriorityBadge(notification.priority)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="text-green-600">{notification.sentCount || 0}</span>
                          {" / "}
                          <span className="text-muted-foreground">{notification.totalRecipients || 0}</span>
                          {notification.failedCount > 0 && (
                            <span className="text-red-500 ml-1">({notification.failedCount} failed)</span>
                          )}
                        </div>
                        {notification.readCount > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {notification.readCount} read
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {notification.createdAt 
                            ? new Date(notification.createdAt).toLocaleDateString()
                            : "N/A"}
                        </div>
                        {notification.scheduledAt && notification.status === NotificationStatus.SCHEDULED && (
                          <div className="text-xs text-orange-600">
                            Scheduled: {new Date(notification.scheduledAt).toLocaleString()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={actionLoadingId === notification.id}>
                              {actionLoadingId === notification.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewNotification(notification)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {notification.status === NotificationStatus.DRAFT && (
                              <DropdownMenuItem onClick={() => handleSendNotification(notification.id)}>
                                <Send className="h-4 w-4 mr-2" />
                                Send Now
                              </DropdownMenuItem>
                            )}
                            {notification.status === NotificationStatus.FAILED && (
                              <DropdownMenuItem onClick={() => handleResendNotification(notification.id)}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Resend
                              </DropdownMenuItem>
                            )}
                            {(notification.status === NotificationStatus.SCHEDULED || notification.status === NotificationStatus.DRAFT) && (
                              <DropdownMenuItem onClick={() => handleCancelNotification(notification.id)}>
                                <Ban className="h-4 w-4 mr-2" />
                                Cancel
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteNotification(notification.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((filters.page - 1) * filters.limit) + 1} to {Math.min(filters.page * filters.limit, totalCount)} of {totalCount} notifications
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                    disabled={filters.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm">
                    Page {filters.page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                    disabled={filters.page >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
          </DialogHeader>
          {selectedNotification && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getScopeBadge(selectedNotification.scope)}
                {getStatusBadge(selectedNotification.status)}
                {getPriorityBadge(selectedNotification.priority)}
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-semibold text-lg">{selectedNotification.title}</h4>
                <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{selectedNotification.body}</p>
              </div>

              {selectedNotification.imageUrl && (
                <div>
                  <Label className="text-xs text-muted-foreground">Image URL</Label>
                  <a href={selectedNotification.imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm break-all">
                    {selectedNotification.imageUrl}
                  </a>
                </div>
              )}

              {selectedNotification.actionUrl && (
                <div>
                  <Label className="text-xs text-muted-foreground">Action URL</Label>
                  <p className="text-sm break-all">{selectedNotification.actionUrl}</p>
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Target Audience</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedNotification.targetUserTypes?.map((type) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {TARGET_USER_TYPE_CONFIG[type]?.label || type}
                      </Badge>
                    ))}
                  </div>
                </div>
                {selectedNotification.institute && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Institute</Label>
                    <p className="text-sm">{selectedNotification.institute.name}</p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Total Recipients</Label>
                  <p className="text-xl font-bold">{selectedNotification.totalRecipients}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Sent</Label>
                  <p className="text-xl font-bold text-green-600">{selectedNotification.sentCount}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Failed</Label>
                  <p className="text-xl font-bold text-red-600">{selectedNotification.failedCount}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Read</Label>
                  <p className="text-xl font-bold text-blue-600">{selectedNotification.readCount}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Created At</Label>
                  <p>{selectedNotification.createdAt ? new Date(selectedNotification.createdAt).toLocaleString() : 'N/A'}</p>
                </div>
                {selectedNotification.sentAt && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Sent At</Label>
                    <p>{new Date(selectedNotification.sentAt).toLocaleString()}</p>
                  </div>
                )}
                {selectedNotification.scheduledAt && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Scheduled For</Label>
                    <p>{new Date(selectedNotification.scheduledAt).toLocaleString()}</p>
                  </div>
                )}
                {selectedNotification.senderRole && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Sender Role</Label>
                    <p>{selectedNotification.senderRole}</p>
                  </div>
                )}
              </div>

              {selectedNotification.dataPayload && Object.keys(selectedNotification.dataPayload).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground">Data Payload</Label>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(selectedNotification.dataPayload, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            {selectedNotification?.status === NotificationStatus.DRAFT && (
              <Button onClick={() => {
                handleSendNotification(selectedNotification.id);
                setIsViewDialogOpen(false);
              }}>
                <Send className="h-4 w-4 mr-2" />
                Send Now
              </Button>
            )}
            {selectedNotification?.status === NotificationStatus.FAILED && (
              <Button onClick={() => {
                handleResendNotification(selectedNotification.id);
                setIsViewDialogOpen(false);
              }}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Resend
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Report Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Notification Delivery Report</DialogTitle>
            <DialogDescription>
              Detailed breakdown of notification delivery
            </DialogDescription>
          </DialogHeader>
          {sendResult && (
            <div className="space-y-4">
              {sendResult.usersWithoutTokens > 0 && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                  <div className="flex items-center gap-2 text-orange-800">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm font-medium">
                      {sendResult.usersWithoutTokens} user(s) don't have the app installed
                    </p>
                  </div>
                  <p className="text-xs text-orange-700 mt-1">
                    These users cannot receive push notifications until they install and configure the app.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Targeted Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{sendResult.details.targetedUsers}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Users with App</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-blue-600">
                      {sendResult.details.usersWithTokens}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Successfully Sent</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">
                      {sendResult.details.successfulSends}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Delivery Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-purple-600">
                      {sendResult.details.deliveryRate}
                    </p>
                  </CardContent>
                </Card>

                {sendResult.details.failedSends > 0 && (
                  <Card className="col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-red-600">Failed Deliveries</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-red-600">
                        {sendResult.details.failedSends}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Failed due to invalid tokens or network issues
                      </p>
                    </CardContent>
                  </Card>
                )}

                {sendResult.details.usersWithoutTokens > 0 && (
                  <Card className="col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-orange-600">Users Without App</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-orange-600">
                        {sendResult.details.usersWithoutTokens}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        These users were not sent notifications (no app installed)
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                <p className="font-medium mb-1">Summary:</p>
                <p>{sendResult.message}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowResultDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotificationDashboard;
