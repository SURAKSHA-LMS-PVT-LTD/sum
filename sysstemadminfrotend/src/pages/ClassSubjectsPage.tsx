import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { DataTable, Column } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { ClassSelector } from "@/components/shared/ClassSelector";
import { BookOpen, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { InstituteType } from "@/lib/enums";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function ClassSubjectsPage() {
  const { toast } = useToast();

  // View state
  const [instituteId, setInstituteId] = useState("");
  const [instituteType, setInstituteType] = useState("");
  const [classId, setClassId] = useState("");
  const isTuition = instituteType === InstituteType.TUITION_INSTITUTE;
  const subjectLabel = isTuition ? 'Month' : 'Subject';
  const [classSubjects, setClassSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  // Add subject state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [adding, setAdding] = useState(false);

  // Bulk add state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkSubjectIds, setBulkSubjectIds] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);

  // Assign teacher state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignClassSubjectId, setAssignClassSubjectId] = useState("");
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const fetchClassSubjects = async () => {
    if (!instituteId || !classId) {
      toast({ title: "Validation", description: "Please select an institute and class", variant: "destructive" });
      return;
    }
    try {
      setLoading(true);
      const response = await api.getClassSubjects(instituteId, classId);
      const data = response.subjects || response.data || response || [];
      const mapped = Array.isArray(data) ? data.map((s: any, i: number) => ({ ...s, id: s.id || s.classSubjectId || i })) : [];
      setClassSubjects(mapped);
    } catch {
      toast({ title: "Error", description: "Failed to fetch class subjects", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubject = async () => {
    if (!instituteId || !classId || !subjectId.trim()) {
      toast({ title: "Validation", description: "All fields are required", variant: "destructive" });
      return;
    }
    try {
      setAdding(true);
      await api.addSubjectToClass(instituteId, classId, { subjectId, teacherId: teacherId || undefined });
      toast({ title: "Success", description: "Subject added to class" });
      setAddDialogOpen(false);
      setSubjectId("");
      setTeacherId("");
      fetchClassSubjects();
    } catch {
      toast({ title: "Error", description: "Failed to add subject", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!instituteId || !classId || !bulkSubjectIds.trim()) {
      toast({ title: "Validation", description: "All fields are required", variant: "destructive" });
      return;
    }
    try {
      setBulkAdding(true);
      const subjectIds = bulkSubjectIds.split(",").map((s) => s.trim()).filter(Boolean);
      await api.addSubjectsToClassBulk(instituteId, classId, {
        subjects: subjectIds.map((id) => ({ subjectId: id })),
      });
      toast({ title: "Success", description: `${subjectIds.length} subjects added to class` });
      setBulkDialogOpen(false);
      setBulkSubjectIds("");
      fetchClassSubjects();
    } catch {
      toast({ title: "Error", description: "Failed to bulk add subjects", variant: "destructive" });
    } finally {
      setBulkAdding(false);
    }
  };

  const handleAssignTeacher = async () => {
    if (!instituteId || !classId || !assignClassSubjectId.trim() || !assignTeacherId.trim()) {
      toast({ title: "Validation", description: "All fields are required", variant: "destructive" });
      return;
    }
    try {
      setAssigning(true);
      await api.assignTeacherToClassSubject(instituteId, classId, assignClassSubjectId, { teacherId: assignTeacherId });
      toast({ title: "Success", description: "Teacher assigned successfully" });
      setAssignDialogOpen(false);
      setAssignClassSubjectId("");
      setAssignTeacherId("");
      fetchClassSubjects();
    } catch {
      toast({ title: "Error", description: "Failed to assign teacher", variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const columns: Column[] = [
    { key: "id", label: "ID" },
    { key: "subjectName", label: `${subjectLabel} Name` },
    { key: "subjectId", label: `${subjectLabel} ID` },
    { key: "teacherName", label: "Teacher" },
    { key: "teacherId", label: "Teacher ID" },
    { key: "status", label: "Status", type: "badge" },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title={`Class ${subjectLabel}s`}
        description={`Manage ${subjectLabel.toLowerCase()} assignments to institute classes`}
        icon={BookOpen}
      />

      {/* Search Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <InstituteSelector
          value={instituteId}
          onChange={(val) => { setInstituteId(val); setClassId(""); }}
          onInstituteSelect={(inst) => setInstituteType(inst?.type || '')}
          required
          placeholder="Select an institute"
        />
        <ClassSelector
          instituteId={instituteId}
          value={classId}
          onChange={setClassId}
        />
        <div className="flex gap-2">
          <Button onClick={fetchClassSubjects} className="gradient-primary shadow-glow">
            Search
          </Button>
          <Button variant="outline" onClick={fetchClassSubjects} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      {instituteId && classId && (
        <div className="mb-4 flex gap-2">
          <Button onClick={() => setAddDialogOpen(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" /> Add {subjectLabel}
          </Button>
          <Button onClick={() => setBulkDialogOpen(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" /> Bulk Add {subjectLabel}s
          </Button>
          <Button onClick={() => setAssignDialogOpen(true)} variant="outline">
            Assign Teacher
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={classSubjects}
        isLoading={loading}
        onView={(item) => { setSelectedItem(item); setViewDialogOpen(true); }}
      />

      {/* Add Subject Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {subjectLabel} to Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{subjectLabel} ID</Label>
              <Input value={subjectId} onChange={(e) => setSubjectId(e.target.value)} placeholder={`Enter ${subjectLabel} ID`} />
            </div>
            <div className="space-y-2">
              <Label>Teacher ID (optional)</Label>
              <Input value={teacherId} onChange={(e) => setTeacherId(e.target.value)} placeholder="Enter Teacher ID" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSubject} disabled={adding}>{adding ? "Adding..." : `Add ${subjectLabel}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Add {subjectLabel}s</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{subjectLabel} IDs (comma-separated)</Label>
              <Textarea
                value={bulkSubjectIds}
                onChange={(e) => setBulkSubjectIds(e.target.value)}
                placeholder="subject-id-1, subject-id-2, subject-id-3"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkAdd} disabled={bulkAdding}>{bulkAdding ? "Adding..." : "Bulk Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Teacher Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teacher to Class {subjectLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Class {subjectLabel} ID</Label>
              <Input value={assignClassSubjectId} onChange={(e) => setAssignClassSubjectId(e.target.value)} placeholder={`Enter Class ${subjectLabel} ID`} />
            </div>
            <div className="space-y-2">
              <Label>Teacher ID</Label>
              <Input value={assignTeacherId} onChange={(e) => setAssignTeacherId(e.target.value)} placeholder="Enter Teacher ID" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignTeacher} disabled={assigning}>{assigning ? "Assigning..." : "Assign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={selectedItem}
        title={`Class ${subjectLabel}: ${selectedItem?.subjectName || selectedItem?.id || ""}`}
      />
    </DashboardLayout>
  );
}
