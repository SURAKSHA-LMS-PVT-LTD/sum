import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { Users2, RefreshCw, Search } from "lucide-react";
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

export default function ParentsPage() {
  const { toast } = useToast();
  const [parents, setParents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedParent, setSelectedParent] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const fetchParents = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = { page, limit };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (statusFilter !== "ALL") params.isActive = statusFilter === "ACTIVE";

      const response = await api.getParents(params);
      setParents(response.data || []);
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
      console.error("Failed to fetch parents:", error);
      toast({ title: "Error", description: "Failed to load parents", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, searchQuery, statusFilter]);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  const handleSearch = () => {
    setPage(1);
    fetchParents();
  };

  const handleView = async (parent: any) => {
    try {
      const withChildren = await api.getParentWithChildren(parent.userId || parent.id);
      setSelectedParent(withChildren);
    } catch {
      setSelectedParent(parent);
    }
    setViewDialogOpen(true);
  };

  const handleDeactivate = async (parent: any) => {
    try {
      await api.deactivateParent(parent.userId || parent.id);
      toast({ title: "Success", description: "Parent deactivated" });
      fetchParents();
    } catch {
      toast({ title: "Error", description: "Failed to deactivate parent", variant: "destructive" });
    }
  };

  const columns: Column[] = [
    { key: "userId", label: "User ID" },
    { key: "firstName", label: "First Name" },
    { key: "lastName", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phoneNumber", label: "Phone" },
    { key: "occupation", label: "Occupation" },
    { key: "workplace", label: "Workplace" },
    {
      key: "isActive",
      label: "Status",
      render: (val: boolean) => (
        <Badge className={val ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
          {val ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    { key: "createdAt", label: "Created", type: "date" },
  ];

  const customActions: CustomAction[] = [
    {
      label: "View Children",
      onClick: handleView,
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
        title="Parents"
        description="Manage parent records and their children"
        icon={Users2}
        actions={
          <Button variant="outline" onClick={fetchParents} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Search</Label>
          <Input
            placeholder="Name, email, occupation..."
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
        data={parents}
        isLoading={isLoading}
        onView={handleView}
        pagination={pagination || undefined}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        customActions={customActions}
      />

      {selectedParent && (
        <ViewDetailsDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          title="Parent Details"
          data={selectedParent}
        />
      )}
    </DashboardLayout>
  );
}
