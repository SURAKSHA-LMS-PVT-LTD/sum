import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader, ActionButton } from "@/components/shared/PageComponents";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { School, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { DataTable, Column, PaginationMeta } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function InstituteClassesPage() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  // Create form state
  const [formData, setFormData] = useState({
    instituteId: "",
    className: "",
    grade: "",
    specialty: "",
    academicYear: "",
  });

  useEffect(() => {
    fetchClasses();
  }, [page, limit]);

  const fetchClasses = async () => {
    try {
      setIsLoading(true);
      const response = await api.getInstituteClasses({ page, limit });
      setClasses(response.data || []);
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
      console.error("Failed to fetch classes:", error);
      toast({ title: "Error", description: "Failed to load classes", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (cls: any) => {
    setSelectedClass(cls);
    setViewDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.instituteId || !formData.className) {
      toast({ title: "Validation", description: "Institute ID and Class Name are required", variant: "destructive" });
      return;
    }
    try {
      await api.createInstituteClass({
        instituteId: formData.instituteId,
        className: formData.className,
        grade: formData.grade ? parseInt(formData.grade) : undefined,
        specialty: formData.specialty || undefined,
        academicYear: formData.academicYear || undefined,
      });
      toast({ title: "Success", description: "Class created successfully" });
      setCreateDialogOpen(false);
      setFormData({ instituteId: "", className: "", grade: "", specialty: "", academicYear: "" });
      fetchClasses();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create class", variant: "destructive" });
    }
  };

  const handleDeactivate = async (cls: any) => {
    try {
      await api.deactivateInstituteClass(cls.id);
      toast({ title: "Success", description: "Class deactivated" });
      fetchClasses();
    } catch (error) {
      toast({ title: "Error", description: "Failed to deactivate class", variant: "destructive" });
    }
  };

  const handleActivate = async (cls: any) => {
    try {
      await api.activateInstituteClass(cls.id);
      toast({ title: "Success", description: "Class activated" });
      fetchClasses();
    } catch (error) {
      toast({ title: "Error", description: "Failed to activate class", variant: "destructive" });
    }
  };

  const handleDelete = async (cls: any) => {
    try {
      await api.deleteInstituteClass(cls.id);
      toast({ title: "Success", description: "Class deleted" });
      fetchClasses();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete class", variant: "destructive" });
    }
  };

  const columns: Column[] = [
    { key: "id", label: "ID" },
    { key: "className", label: "Class Name" },
    { key: "grade", label: "Grade", render: (val: any) => val ?? "-" },
    { key: "specialty", label: "Specialty", render: (val: any) => val || "-" },
    { key: "academicYear", label: "Academic Year", render: (val: any) => val || "-" },
    { key: "instituteId", label: "Institute ID" },
    {
      key: "isActive",
      label: "Status",
      type: "badge",
      render: (val: boolean) => (
        <Badge className={val ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
          {val ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Institute Classes"
        description="Manage classes, subjects, and teacher assignments"
        icon={School}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchClasses} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <ActionButton label="Create Class" onClick={() => setCreateDialogOpen(true)} />
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={classes}
        isLoading={isLoading}
        onView={handleView}
        onDelete={handleDelete}
        pagination={pagination || undefined}
        onPageChange={setPage}
        onLimitChange={setLimit}
        customActions={[
          {
            label: "Activate",
            onClick: handleActivate,
            show: (row: any) => row.isActive === false,
          },
          {
            label: "Deactivate",
            onClick: handleDeactivate,
            show: (row: any) => row.isActive !== false,
            variant: "destructive",
          },
        ]}
      />

      {selectedClass && (
        <ViewDetailsDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          title="Class Details"
          data={selectedClass}
        />
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Institute *</Label>
              <InstituteSelector
                value={formData.instituteId}
                onChange={(val) => setFormData(prev => ({ ...prev, instituteId: val }))}
                required
              />
            </div>
            <div>
              <Label>Class Name *</Label>
              <Input value={formData.className} onChange={(e) => setFormData(prev => ({ ...prev, className: e.target.value }))} />
            </div>
            <div>
              <Label>Grade</Label>
              <Input type="number" value={formData.grade} onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))} />
            </div>
            <div>
              <Label>Specialty</Label>
              <Input value={formData.specialty} onChange={(e) => setFormData(prev => ({ ...prev, specialty: e.target.value }))} />
            </div>
            <div>
              <Label>Academic Year</Label>
              <Input value={formData.academicYear} onChange={(e) => setFormData(prev => ({ ...prev, academicYear: e.target.value }))} placeholder="e.g. 2025" />
            </div>
            <Button onClick={handleCreate} className="w-full gradient-primary">Create Class</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
