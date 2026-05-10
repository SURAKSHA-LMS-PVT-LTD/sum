import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader, StatsCard } from "@/components/shared/PageComponents";
import { GraduationCap, Users, BarChart3, RefreshCw, Search, UserPlus, UserMinus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { DataTable, Column, PaginationMeta, CustomAction } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function StudentsPage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Assign parent dialog
  const [assignParentOpen, setAssignParentOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [parentUserId, setParentUserId] = useState("");
  const [relationship, setRelationship] = useState("FATHER");
  const [assigning, setAssigning] = useState(false);

  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = { page, limit };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (statusFilter !== "ALL") params.isActive = statusFilter === "ACTIVE";

      const response = await api.getStudents(params);
      setStudents(response.data || []);
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
      console.error("Failed to fetch students:", error);
      toast({ title: "Error", description: "Failed to load students", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, searchQuery, statusFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    api.getStudentStats().then(setStats).catch(() => {});
  }, []);

  const handleSearch = () => {
    setPage(1);
    fetchStudents();
  };

  const handleView = (student: any) => {
    setSelectedStudent(student);
    setViewDialogOpen(true);
  };

  const handleDeactivate = async (student: any) => {
    try {
      await api.deactivateStudent(student.userId || student.id);
      toast({ title: "Success", description: "Student deactivated" });
      fetchStudents();
    } catch {
      toast({ title: "Error", description: "Failed to deactivate student", variant: "destructive" });
    }
  };

  const handleOpenAssignParent = (student: any) => {
    setAssignTarget(student);
    setParentUserId("");
    setRelationship("FATHER");
    setAssignParentOpen(true);
  };

  const handleAssignParent = async () => {
    if (!assignTarget || !parentUserId.trim()) return;
    setAssigning(true);
    try {
      await api.assignParentToStudent(assignTarget.userId || assignTarget.id, {
        parentUserId: parentUserId.trim(),
        relationship,
      });
      toast({ title: "Success", description: "Parent assigned to student" });
      setAssignParentOpen(false);
      fetchStudents();
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to assign parent", variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveParent = async (student: any) => {
    const parentId = student.parentUserId || student.parentId;
    if (!parentId) {
      toast({ title: "Error", description: "No parent linked to this student", variant: "destructive" });
      return;
    }
    try {
      await api.removeParentFromStudent(student.userId || student.id, { parentUserId: parentId });
      toast({ title: "Success", description: "Parent removed from student" });
      fetchStudents();
    } catch {
      toast({ title: "Error", description: "Failed to remove parent", variant: "destructive" });
    }
  };

  const columns: Column[] = [
    { key: "userId", label: "User ID" },
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phoneNumber", label: "Phone" },
    {
      key: "isActive",
      label: "Status",
      render: (val: boolean) => (
        <Badge className={val ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
          {val ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    { key: "bloodGroup", label: "Blood Group" },
    { key: "createdAt", label: "Created", type: "date" },
  ];

  const customActions: CustomAction[] = [
    {
      label: "Assign Parent",
      icon: <UserPlus className="w-4 h-4" />,
      onClick: handleOpenAssignParent,
    },
    {
      label: "Remove Parent",
      icon: <UserMinus className="w-4 h-4" />,
      onClick: handleRemoveParent,
      show: (row) => !!(row.parentUserId || row.parentId),
      variant: "destructive",
    },
    {
      label: "Deactivate",
      onClick: handleDeactivate,
      show: (row) => row.isActive !== false,
      variant: "destructive",
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Students"
        description="Manage student records and parent assignments"
        icon={GraduationCap}
        actions={
          <Button variant="outline" onClick={fetchStudents} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatsCard title="Total Students" value={stats.totalStudents ?? stats.total ?? 0} icon={GraduationCap} />
          <StatsCard title="Active Students" value={stats.activeStudents ?? stats.active ?? 0} icon={Users} />
          <StatsCard title="With Parents" value={stats.withParents ?? 0} icon={BarChart3} />
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Search</Label>
          <Input
            placeholder="Name, email, student ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-56"
          />
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
        <Button onClick={handleSearch} size="sm">
          <Search className="w-4 h-4 mr-1" />
          Search
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setStatusFilter("ALL"); setPage(1); }}>
          Clear
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={students}
        isLoading={isLoading}
        onView={handleView}
        pagination={pagination || undefined}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        customActions={customActions}
      />

      {selectedStudent && (
        <ViewDetailsDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          title="Student Details"
          data={selectedStudent}
        />
      )}

      {/* Assign Parent Dialog */}
      <Dialog open={assignParentOpen} onOpenChange={setAssignParentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Parent to Student</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Assigning parent to <strong>{assignTarget?.firstName} {assignTarget?.lastName}</strong>
            </p>
            <div className="space-y-2">
              <Label>Parent User ID</Label>
              <Input
                placeholder="Enter parent user ID"
                value={parentUserId}
                onChange={(e) => setParentUserId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FATHER">Father</SelectItem>
                  <SelectItem value="MOTHER">Mother</SelectItem>
                  <SelectItem value="GUARDIAN">Guardian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignParentOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignParent} disabled={assigning || !parentUserId.trim()}>
              {assigning ? "Assigning..." : "Assign Parent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
