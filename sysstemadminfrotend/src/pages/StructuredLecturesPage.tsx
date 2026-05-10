import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader, ActionButton } from "@/components/shared/PageComponents";
import { GraduationCap, Search, EyeOff, Eye, Trash2, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { DataTable, Column, PaginationMeta } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { CreateLectureForm } from "@/components/forms/CreateLectureForm";
import { EditLectureForm } from "@/components/forms/EditLectureForm";
import { DocumentsPopover } from "@/components/shared/DocumentsPopover";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LectureDocument {
  documentName: string;
  documentUrl: string;
  documentDescription?: string;
}

interface Lecture {
  _id: string;
  title: string;
  description?: string;
  instituteId?: string;
  classId?: number | null;
  subjectId: string;
  grade: number;
  lessonNumber?: number;
  lectureNumber?: number;
  provider?: string;
  lectureLink?: string;
  coverImageUrl?: string;
  documents?: LectureDocument[];
  isActive: boolean;
  createdBy?: string;
  createdAt: string | null;
  updatedAt: string | null;
}

interface LectureStats {
  totalLectures: number;
  activeLectures: number;
  inactiveLectures: number;
  lecturesByGrade: Record<string, number>;
}

export default function StructuredLecturesPage() {
  const { toast } = useToast();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false);
  const [lectureToDelete, setLectureToDelete] = useState<Lecture | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [instituteId, setInstituteId] = useState("");
  const [filterGrade, setFilterGrade] = useState<string>("");
  const [filterActive, setFilterActive] = useState<string>("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("DESC");

  // Statistics
  const [stats, setStats] = useState<LectureStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  const fetchLectures = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: any = { page, limit, sortBy, sortOrder };
      if (search) params.search = search;
      if (instituteId && instituteId !== "all") params.instituteId = instituteId;
      if (filterGrade) params.grade = Number(filterGrade);
      if (filterActive === "true") params.isActive = true;
      if (filterActive === "false") params.isActive = false;

      const response = await api.getStructuredLectures(params);
      setLectures(response.lectures || []);
      setPagination({
        page: response.currentPage || page,
        limit: response.limit || limit,
        total: response.total || 0,
        totalPages: response.totalPages || 1,
      });
    } catch (error) {
      console.error("Failed to fetch lectures:", error);
      toast({ title: "Error", description: "Failed to load lectures", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, instituteId, filterGrade, filterActive, sortBy, sortOrder]);

  useEffect(() => {
    fetchLectures();
  }, [fetchLectures]);

  const handleView = (lecture: Lecture) => {
    setSelectedLecture(lecture);
    setViewDialogOpen(true);
  };

  const handleEdit = (lecture: Lecture) => {
    setSelectedLecture(lecture);
    setEditDialogOpen(true);
  };

  const handleSoftDelete = (lecture: Lecture) => {
    setLectureToDelete(lecture);
    setDeleteDialogOpen(true);
  };

  const handlePermanentDelete = (lecture: Lecture) => {
    setLectureToDelete(lecture);
    setPermanentDeleteDialogOpen(true);
  };

  const confirmSoftDelete = async () => {
    if (!lectureToDelete) return;
    try {
      await api.softDeleteStructuredLecture(lectureToDelete._id);
      toast({ title: "Success", description: "Lecture hidden from students" });
      fetchLectures();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setLectureToDelete(null);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!lectureToDelete) return;
    try {
      await api.permanentDeleteStructuredLecture(lectureToDelete._id);
      toast({ title: "Success", description: "Lecture permanently deleted" });
      fetchLectures();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" });
    } finally {
      setPermanentDeleteDialogOpen(false);
      setLectureToDelete(null);
    }
  };

  const handleRestore = async (lecture: Lecture) => {
    try {
      await api.updateStructuredLecture(lecture._id, { isActive: true });
      toast({ title: "Success", description: "Lecture restored" });
      fetchLectures();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to restore", variant: "destructive" });
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchLectures();
  };

  const columns: Column[] = [
    { key: "coverImageUrl", label: "Cover", type: "image" },
    { key: "title", label: "Title" },
    { key: "grade", label: "Grade", type: "badge" },
    { key: "lessonNumber", label: "Lesson #" },
    { key: "lectureNumber", label: "Lecture #" },
    {
      key: "classId",
      label: "Scope",
      render: (value) => (
        <Badge variant={value ? "secondary" : "outline"}>
          {value ? `Class ${value}` : "Institute-wide"}
        </Badge>
      ),
    },
    {
      key: "documents",
      label: "Documents",
      render: (value) => <DocumentsPopover documents={value || []} />,
    },
    {
      key: "isActive",
      label: "Status",
      render: (value) => (
        <Badge variant={value ? "default" : "destructive"}>
          {value ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "_actions",
      label: "Actions",
      render: (_, row: any) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
            Edit
          </Button>
          {row.isActive ? (
            <Button variant="ghost" size="sm" onClick={() => handleSoftDelete(row)} title="Hide from students">
              <EyeOff className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => handleRestore(row)} title="Restore">
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => handlePermanentDelete(row)} title="Permanently delete" className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Structured Lectures"
        description="Manage all structured lectures and learning materials"
        icon={GraduationCap}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowStats(!showStats)}>
              <BarChart3 className="h-4 w-4 mr-1" />
              Stats
            </Button>
            <ActionButton label="Create Lecture" onClick={() => setCreateDialogOpen(true)} />
          </div>
        }
      />

      {/* Statistics Panel */}
      {showStats && stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Lectures</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.totalLectures}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">{stats.activeLectures}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Inactive</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-destructive">{stats.inactiveLectures}</div></CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <InstituteSelector
          value={instituteId}
          onChange={(val) => { setInstituteId(val); setPage(1); }}
          placeholder="Select institute"
        />
        <div className="flex gap-2 flex-1 min-w-[200px]">
          <Input
            placeholder="Search by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <Select value={filterGrade} onValueChange={(v) => { setFilterGrade(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All Grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {Array.from({ length: 13 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>Grade {i + 1}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterActive || "all"} onValueChange={(v) => { setFilterActive(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Date Created</SelectItem>
            <SelectItem value="lessonNumber">Lesson Number</SelectItem>
            <SelectItem value="title">Title</SelectItem>
            <SelectItem value="grade">Grade</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => { setSortOrder(sortOrder === "ASC" ? "DESC" : "ASC"); setPage(1); }}>
          {sortOrder === "ASC" ? "↑ ASC" : "↓ DESC"}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={lectures}
        isLoading={isLoading}
        onView={handleView}
        pagination={pagination || undefined}
        onPageChange={setPage}
        onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
      />

      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={selectedLecture}
        title={selectedLecture?.title || "Lecture Details"}
        imageKey="coverImageUrl"
      />

      <CreateLectureForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchLectures}
      />

      <EditLectureForm
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchLectures}
        lecture={selectedLecture}
      />

      {/* Soft Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hide Lecture?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide "{lectureToDelete?.title}" from students. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSoftDelete}>Hide</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation */}
      <AlertDialog open={permanentDeleteDialogOpen} onOpenChange={setPermanentDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{lectureToDelete?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
