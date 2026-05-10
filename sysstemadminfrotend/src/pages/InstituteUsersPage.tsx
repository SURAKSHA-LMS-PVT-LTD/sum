import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { DataTable, Column, PaginationMeta, CustomAction } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { Users, RefreshCw, UserCheck, UserMinus, UserCog, Shield, Search, KeyRound } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type ViewTab = "active" | "inactive" | "pending";

const USER_TYPES = [
  { value: "STUDENT", label: "Student" },
  { value: "TEACHER", label: "Teacher" },
  { value: "PARENT", label: "Parent" },
  { value: "INSTITUTE_ADMIN", label: "Institute Admin" },
  { value: "ATTENDANCE_MARKER", label: "Attendance Marker" },
];

const ROLE_OPTIONS = [
  { value: "STUDENT", label: "Student" },
  { value: "TEACHER", label: "Teacher" },
  { value: "INSTITUTE_ADMIN", label: "Institute Admin" },
  { value: "ATTENDANCE_MARKER", label: "Attendance Marker" },
  { value: "ACCOUNTANT", label: "Accountant" },
  { value: "LIBRARIAN", label: "Librarian" },
  { value: "PARENT", label: "Parent" },
];

export default function InstituteUsersPage() {
  const { toast } = useToast();
  const [instituteId, setInstituteId] = useState("");
  const [userType, setUserType] = useState("STUDENT");
  const [viewTab, setViewTab] = useState<ViewTab>("active");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Change role dialog
  const [changeRoleDialogOpen, setChangeRoleDialogOpen] = useState(false);
  const [changeRoleUser, setChangeRoleUser] = useState<any>(null);
  const [newRole, setNewRole] = useState("");
  const [changingRole, setChangingRole] = useState(false);

  // Set password dialog
  const [setPasswordDialogOpen, setSetPasswordDialogOpen] = useState(false);
  const [setPasswordUser, setSetPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!instituteId || instituteId === "all") return;
    try {
      setLoading(true);
      let response: any;
      const params = { page, limit, search: searchQuery || undefined };

      if (viewTab === "inactive") {
        response = await api.getInactiveInstituteUsers(instituteId, params);
      } else if (viewTab === "pending") {
        response = await api.getUnverifiedInstituteUsers(instituteId, userType, params);
      } else {
        response = await api.getInstituteUsers(instituteId, userType, params);
      }

      const mappedUsers = (response.users || response.data || []).map((u: any) => ({
        ...u,
        id: u.id || u.userId,
      }));
      setUsers(mappedUsers);
      setPagination({
        page: response.page || page,
        limit: response.limit || limit,
        total: response.total || 0,
        totalPages: response.totalPages || Math.ceil((response.total || 0) / limit),
      });
    } catch {
      toast({ title: "Error", description: "Failed to fetch institute users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [instituteId, userType, viewTab, page, limit, searchQuery]);

  useEffect(() => {
    if (instituteId && instituteId !== "all") fetchUsers();
  }, [fetchUsers]);

  const handleActivate = async (user: any) => {
    try {
      await api.activateInstituteUser(instituteId, user.id);
      toast({ title: "Success", description: "User activated successfully" });
      fetchUsers();
    } catch {
      toast({ title: "Error", description: "Failed to activate user", variant: "destructive" });
    }
  };

  const handleDeactivate = async (user: any) => {
    try {
      await api.deactivateInstituteUser(instituteId, user.id);
      toast({ title: "Success", description: "User deactivated successfully" });
      fetchUsers();
    } catch {
      toast({ title: "Error", description: "Failed to deactivate user", variant: "destructive" });
    }
  };

  const handleVerify = async (user: any) => {
    try {
      await api.verifyInstituteUser(instituteId, user.id);
      toast({ title: "Success", description: "User verified successfully" });
      fetchUsers();
    } catch {
      toast({ title: "Error", description: "Failed to verify user", variant: "destructive" });
    }
  };

  const handleRemove = async (user: any) => {
    if (!confirm(`Remove user ${user.firstName || ""} ${user.lastName || ""} from this institute? This cannot be undone.`)) return;
    try {
      await api.removeInstituteUser(instituteId, user.id);
      toast({ title: "Success", description: "User removed from institute" });
      fetchUsers();
    } catch {
      toast({ title: "Error", description: "Failed to remove user", variant: "destructive" });
    }
  };

  const openChangeRoleDialog = (user: any) => {
    setChangeRoleUser(user);
    setNewRole(user.userType || user.instituteUserType || "");
    setChangeRoleDialogOpen(true);
  };

  const handleChangeRole = async () => {
    if (!changeRoleUser || !newRole) return;
    setChangingRole(true);
    try {
      await api.changeInstituteUserRole(instituteId, changeRoleUser.id, newRole);
      toast({ title: "Success", description: `Role changed to ${newRole}` });
      setChangeRoleDialogOpen(false);
      setChangeRoleUser(null);
      fetchUsers();
    } catch {
      toast({ title: "Error", description: "Failed to change role", variant: "destructive" });
    } finally {
      setChangingRole(false);
    }
  };

  const openSetPasswordDialog = (user: any) => {
    setSetPasswordUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setSetPasswordDialogOpen(true);
  };

  const handleSetPassword = async () => {
    if (!setPasswordUser || !newPassword) return;
    if (newPassword.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSettingPassword(true);
    try {
      await api.setInstituteUserPassword(instituteId, setPasswordUser.id, newPassword);
      toast({ title: "Success", description: "Institute password set successfully" });
      setSetPasswordDialogOpen(false);
      setSetPasswordUser(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to set password", variant: "destructive" });
    } finally {
      setSettingPassword(false);
    }
  };

  const columns: Column[] = [
    { key: "id", label: "User ID" },
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone", render: (_, row) => row.phone || row.phoneNumber || "-" },
    {
      key: "userType",
      label: "User Type",
      render: (val, row) => {
        const type = val || row.instituteUserType || "-";
        return <Badge variant="outline">{type}</Badge>;
      },
    },
    {
      key: "status",
      label: "Status",
      render: (val) => {
        const status = String(val || "").toUpperCase();
        return (
          <Badge variant={status === "ACTIVE" ? "default" : status === "PENDING" ? "secondary" : "destructive"}>
            {status || "N/A"}
          </Badge>
        );
      },
    },
    { key: "createdAt", label: "Joined", type: "date" },
  ];

  const customActions: CustomAction[] = [];

  if (viewTab === "active") {
    customActions.push(
      {
        label: "Set Password",
        icon: <KeyRound className="w-4 h-4" />,
        onClick: openSetPasswordDialog,
      },
      {
        label: "Change Role",
        icon: <UserCog className="w-4 h-4" />,
        onClick: openChangeRoleDialog,
      },
      {
        label: "Deactivate",
        icon: <UserMinus className="w-4 h-4" />,
        onClick: handleDeactivate,
        variant: "destructive",
      },
      {
        label: "Remove",
        onClick: handleRemove,
        variant: "destructive",
      }
    );
  } else if (viewTab === "inactive") {
    customActions.push(
      {
        label: "Activate",
        icon: <UserCheck className="w-4 h-4" />,
        onClick: handleActivate,
      },
      {
        label: "Remove",
        onClick: handleRemove,
        variant: "destructive",
      }
    );
  } else if (viewTab === "pending") {
    customActions.push(
      {
        label: "Verify",
        icon: <Shield className="w-4 h-4" />,
        onClick: handleVerify,
      }
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Institute Users"
        description="View and manage users by institute — change roles, activate, deactivate, verify"
        icon={Users}
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <InstituteSelector
          value={instituteId}
          onChange={(val) => { setInstituteId(val); setPage(1); }}
          required
          placeholder="Select an institute"
        />
        <div className="space-y-2">
          <Label>User Type</Label>
          <Select value={userType} onValueChange={(val) => { setUserType(val); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USER_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>View</Label>
          <Select value={viewTab} onValueChange={(val) => { setViewTab(val as ViewTab); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Search</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); fetchUsers(); } }}
              className="w-48"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setPage(1); fetchUsers(); }} className="gradient-primary shadow-glow">
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={loading}
        onView={(user) => { setSelectedUser(user); setViewDialogOpen(true); }}
        pagination={pagination || undefined}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        customActions={customActions}
      />

      {/* View Details */}
      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={selectedUser}
        title={`User: ${selectedUser?.firstName || ""} ${selectedUser?.lastName || ""}`}
      />

      {/* Change Role Dialog */}
      <Dialog open={changeRoleDialogOpen} onOpenChange={setChangeRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Changing role for <strong>{changeRoleUser?.firstName} {changeRoleUser?.lastName}</strong>
            </p>
            <div className="space-y-2">
              <Label>Current Role</Label>
              <Badge variant="outline" className="text-sm">
                {changeRoleUser?.userType || changeRoleUser?.instituteUserType || "Unknown"}
              </Badge>
            </div>
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeRoleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleChangeRole} disabled={changingRole || !newRole}>
              {changingRole ? "Changing..." : "Change Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Institute Password Dialog */}
      <Dialog open={setPasswordDialogOpen} onOpenChange={(open) => { if (!open) { setSetPasswordDialogOpen(false); setSetPasswordUser(null); setNewPassword(""); setConfirmPassword(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Institute Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Setting institute password for <strong>{setPasswordUser?.firstName} {setPasswordUser?.lastName}</strong>
            </p>
            <p className="text-xs text-muted-foreground">
              This will set or reset the institute-level login password for this user. The current password cannot be viewed.
            </p>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                placeholder="Min 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSetPasswordDialogOpen(false); setSetPasswordUser(null); setNewPassword(""); setConfirmPassword(""); }}>Cancel</Button>
            <Button onClick={handleSetPassword} disabled={settingPassword || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword}>
              {settingPassword ? "Setting..." : "Set Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
