import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader, ActionButton } from "@/components/shared/PageComponents";
import { Users, CreditCard, ShieldCheck, Search, RefreshCw, UserCheck, UserMinus, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { DataTable, Column, PaginationMeta, CustomAction } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { AssignRfidDialog } from "@/components/forms/AssignRfidDialog";
import { ChangeUserTypeDialog } from "@/components/forms/ChangeUserTypeDialog";
import { CreateUserForm } from "@/components/forms/CreateUserForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const USER_TYPES = [
  { value: "ALL", label: "All Types" },
  { value: "USER", label: "User" },
  { value: "USER_WITHOUT_PARENT", label: "User (No Parent)" },
  { value: "USER_WITHOUT_STUDENT", label: "User (No Student)" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ORGANIZATION_MANAGER", label: "Org Manager" },
];

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  userType: string;
  dateOfBirth: string;
  gender: string;
  isActive: boolean;
  createdAt: string;
  imageUrl: string | null;
  subscriptionPlan: string;
  telegramId: string | null;
  rfid: string | null;
  language: string;
  isFirstLoginCompleted?: boolean;
}

export default function UsersPage() {
  const { toast } = useToast();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [rfidDialogOpen, setRfidDialogOpen] = useState(false);
  const [changeTypeDialogOpen, setChangeTypeDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [genderFilter, setGenderFilter] = useState("ALL");

  // Phone lookup dialog
  const [phoneLookupOpen, setPhoneLookupOpen] = useState(false);
  const [phoneLookupValue, setPhoneLookupValue] = useState("");
  const [phoneLookupResult, setPhoneLookupResult] = useState<any>(null);
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = { page, limit };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (phoneSearch.trim()) params.phone = phoneSearch.trim();
      if (userTypeFilter !== "ALL") params.userType = userTypeFilter;
      if (statusFilter !== "ALL") params.isActive = statusFilter === "ACTIVE";
      if (genderFilter !== "ALL") params.gender = genderFilter;

      const response = await api.getUsers(params);
      setAllUsers(response.data || []);
      if (response.meta) {
        setPagination({
          page: response.meta.page,
          limit: response.meta.limit,
          total: response.meta.total,
          totalPages: response.meta.totalPages,
          hasNextPage: response.meta.hasNextPage,
          hasPreviousPage: response.meta.hasPreviousPage,
        });
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, searchQuery, phoneSearch, userTypeFilter, statusFilter, genderFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = () => {
    setPage(1);
    fetchUsers();
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setPhoneSearch("");
    setUserTypeFilter("ALL");
    setStatusFilter("ALL");
    setGenderFilter("ALL");
    setPage(1);
  };

  const handlePhoneLookup = async () => {
    if (!phoneLookupValue.trim()) return;
    setPhoneLookupLoading(true);
    setPhoneLookupResult(null);
    try {
      const result = await api.getUserByPhone(phoneLookupValue.trim());
      setPhoneLookupResult(result);
    } catch {
      toast({ title: "Not Found", description: "No user found with that phone number", variant: "destructive" });
    } finally {
      setPhoneLookupLoading(false);
    }
  };

  const handleActivate = async (user: User) => {
    try {
      await api.activateUser(user.id);
      toast({ title: "Success", description: `${user.firstName} activated` });
      fetchUsers();
    } catch {
      toast({ title: "Error", description: "Failed to activate user", variant: "destructive" });
    }
  };

  const handleDeactivate = async (user: User) => {
    try {
      await api.deactivateUser(user.id);
      toast({ title: "Success", description: `${user.firstName} deactivated` });
      fetchUsers();
    } catch {
      toast({ title: "Error", description: "Failed to deactivate user", variant: "destructive" });
    }
  };

  const handleView = (user: User) => {
    setSelectedUser(user);
    setViewDialogOpen(true);
  };

  const handleAssignRfid = (user: User) => {
    setSelectedUser(user);
    setRfidDialogOpen(true);
  };

  const handleChangeUserType = (user: User) => {
    setSelectedUser(user);
    setChangeTypeDialogOpen(true);
  };

  const columns: Column[] = [
    { key: "imageUrl", label: "Image", type: "image" },
    { key: "id", label: "ID" },
    { key: "firstName", label: "Name", render: (_, row) => `${row.firstName || ""} ${row.lastName || ""}`.trim() || "-" },
    { key: "email", label: "Email" },
    { key: "phoneNumber", label: "Phone" },
    { key: "userType", label: "Type", type: "badge" },
    {
      key: "isActive",
      label: "Status",
      render: (val: boolean) => (
        <Badge className={val ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
          {val ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    { key: "subscriptionPlan", label: "Plan", type: "badge" },
    { key: "rfid", label: "RFID" },
    { key: "createdAt", label: "Created", type: "date" },
  ];

  const customActions: CustomAction[] = [
    {
      label: "Assign RFID",
      icon: <CreditCard className="w-4 h-4" />,
      onClick: (row) => handleAssignRfid(row as User),
    },
    {
      label: "Change Role",
      icon: <ShieldCheck className="w-4 h-4" />,
      onClick: (row) => handleChangeUserType(row as User),
    },
    {
      label: "Activate",
      icon: <UserCheck className="w-4 h-4" />,
      onClick: (row) => handleActivate(row as User),
      show: (row) => row.isActive === false,
    },
    {
      label: "Deactivate",
      icon: <UserMinus className="w-4 h-4" />,
      onClick: (row) => handleDeactivate(row as User),
      variant: "destructive",
      show: (row) => row.isActive !== false,
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Users"
        description="Manage all users in the system"
        icon={Users}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPhoneLookupOpen(true)}>
              <Phone className="w-4 h-4 mr-1" />
              Phone Lookup
            </Button>
            <ActionButton label="Create User" onClick={() => setCreateDialogOpen(true)} />
          </div>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Search (name, email, NIC)</Label>
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-48"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone</Label>
          <Input
            placeholder="Phone number..."
            value={phoneSearch}
            onChange={(e) => setPhoneSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">User Type</Label>
          <Select value={userTypeFilter} onValueChange={(v) => { setUserTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USER_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Gender</Label>
          <Select value={genderFilter} onValueChange={(v) => { setGenderFilter(v); setPage(1); }}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="MALE">Male</SelectItem>
              <SelectItem value="FEMALE">Female</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSearch} size="sm">
            <Search className="w-4 h-4 mr-1" />
            Search
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            Clear
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchUsers} disabled={isLoading} className="h-9 w-9">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      
      <DataTable
        columns={columns}
        data={allUsers}
        isLoading={isLoading}
        onView={handleView}
        pagination={pagination || undefined}
        onPageChange={setPage}
        onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
        customActions={customActions}
      />

      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={selectedUser}
        title={selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : "User Details"}
      />

      {selectedUser && (
        <AssignRfidDialog
          open={rfidDialogOpen}
          onOpenChange={setRfidDialogOpen}
          onSuccess={fetchUsers}
          userId={selectedUser.id}
          userName={`${selectedUser.firstName} ${selectedUser.lastName}`}
          currentRfid={selectedUser.rfid}
        />
      )}

      {selectedUser && (
        <ChangeUserTypeDialog
          open={changeTypeDialogOpen}
          onOpenChange={setChangeTypeDialogOpen}
          onSuccess={fetchUsers}
          userId={selectedUser.id}
          userName={`${selectedUser.firstName} ${selectedUser.lastName}`}
          currentUserType={selectedUser.userType}
        />
      )}

      <CreateUserForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchUsers}
      />

      {/* Phone Lookup Dialog */}
      <Dialog open={phoneLookupOpen} onOpenChange={setPhoneLookupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lookup User by Phone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                placeholder="Enter phone number..."
                value={phoneLookupValue}
                onChange={(e) => setPhoneLookupValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePhoneLookup()}
              />
              <Button onClick={handlePhoneLookup} disabled={phoneLookupLoading}>
                {phoneLookupLoading ? "Searching..." : "Search"}
              </Button>
            </div>
            {phoneLookupResult && (
              <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
                <p className="font-medium">{phoneLookupResult.fullName || `${phoneLookupResult.firstName || ""} ${phoneLookupResult.lastName || ""}`.trim()}</p>
                <p className="text-sm text-muted-foreground">ID: {phoneLookupResult.id}</p>
                <p className="text-sm text-muted-foreground">Type: {phoneLookupResult.userType}</p>
                {phoneLookupResult.email && <p className="text-sm text-muted-foreground">Email: {phoneLookupResult.email}</p>}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    setPhoneLookupOpen(false);
                    setSelectedUser(phoneLookupResult);
                    setViewDialogOpen(true);
                  }}
                >
                  View Full Details
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPhoneLookupOpen(false); setPhoneLookupResult(null); setPhoneLookupValue(""); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}