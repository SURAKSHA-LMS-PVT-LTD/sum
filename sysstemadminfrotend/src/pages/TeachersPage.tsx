import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { DataTable, Column, PaginationMeta } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { GraduationCap, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function TeachersPage() {
  const { toast } = useToast();
  const [instituteId, setInstituteId] = useState("");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  const fetchTeachers = async () => {
    if (!instituteId || instituteId === "all") {
      toast({ title: "Validation", description: "Please select an institute", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      const response = await api.getInstituteUsers(instituteId, "TEACHER", { page, limit });
      const mapped = (response.users || response.data || []).map((u: any) => ({ ...u, id: u.id || u.userId }));
      setTeachers(mapped);
      setPagination({
        page: response.page || page,
        limit: response.limit || limit,
        total: response.total || 0,
        totalPages: response.totalPages || Math.ceil((response.total || 0) / limit),
      });
    } catch {
      toast({ title: "Error", description: "Failed to fetch teachers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (instituteId && instituteId !== "all") fetchTeachers();
  }, [page, limit]);

  const columns: Column[] = [
    { key: "id", label: "ID" },
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "status", label: "Status", type: "badge" },
    { key: "createdAt", label: "Joined", type: "date" },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Teachers"
        description="View teachers by institute"
        icon={GraduationCap}
      />

      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <InstituteSelector
          value={instituteId}
          onChange={(val) => { setInstituteId(val); setPage(1); }}
          required
          placeholder="Select an institute"
        />
        <div className="flex gap-2">
          <Button onClick={() => { setPage(1); fetchTeachers(); }} className="gradient-primary shadow-glow">
            Search
          </Button>
          <Button variant="outline" onClick={fetchTeachers} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={teachers}
        isLoading={loading}
        onView={(t) => { setSelectedTeacher(t); setViewDialogOpen(true); }}
        pagination={pagination || undefined}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
      />

      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={selectedTeacher}
        title={`Teacher: ${selectedTeacher?.firstName || ""} ${selectedTeacher?.lastName || ""}`}
      />
    </DashboardLayout>
  );
}
