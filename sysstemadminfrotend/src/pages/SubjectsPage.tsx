import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader, ActionButton } from "@/components/shared/PageComponents";
import { BookOpen, Pencil, Search, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { InstituteType } from "@/lib/enums";
import { DataTable, Column, PaginationMeta, CustomAction } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { CreateSubjectForm } from "@/components/forms/CreateSubjectForm";
import { UpdateSubjectForm } from "@/components/forms/UpdateSubjectForm";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Subject {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  creditHours: number;
  isActive: boolean;
  subjectType: string;
  basketCategory: string;
  instituteId: string;
  imgUrl: string;
  createdAt: string | null;
  updatedAt: string | null;
}

const SUBJECT_TYPES = [
  { value: "ALL", label: "All Types" },
  { value: "MAIN", label: "Main" },
  { value: "BASKET", label: "Basket" },
  { value: "COMMON", label: "Common" },
  { value: "GRADE_6TO9_BASKET", label: "Grade 6-9 Basket" },
  { value: "GRADE_10TO11_BASKET_1", label: "Grade 10-11 Basket 1" },
];

const BASKET_CATEGORIES = [
  { value: "ALL", label: "All Categories" },
  { value: "LANGUAGE", label: "Language" },
  { value: "ARTS", label: "Arts" },
  { value: "TECHNOLOGY", label: "Technology" },
  { value: "COMMERCE", label: "Commerce" },
  { value: "SCIENCE", label: "Science" },
  { value: "RELIGION", label: "Religion" },
];

export default function SubjectsPage() {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  // Filters
  const [instituteId, setInstituteId] = useState("");
  const [instituteType, setInstituteType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const isTuition = instituteType === InstituteType.TUITION_INSTITUTE;
  const subjectLabel = isTuition ? 'Month' : 'Subject';
  const [subjectType, setSubjectType] = useState("ALL");
  const [basketCategory, setBasketCategory] = useState("ALL");

  const fetchSubjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = { page, limit };
      if (instituteId && instituteId !== "all") params.instituteId = instituteId;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (subjectType !== "ALL") params.subjectType = subjectType;
      if (basketCategory !== "ALL") params.basketCategory = basketCategory;

      const response = await api.getSubjects(params);
      if (Array.isArray(response)) {
        setSubjects(response);
        setPagination({ page, limit, total: response.length, totalPages: 1 });
      } else {
        setSubjects(response.data || []);
        if (response.meta) {
          setPagination({
            page: response.meta.page,
            limit: response.meta.limit,
            total: response.meta.total,
            totalPages: response.meta.totalPages,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch subjects:", error);
      toast({ title: "Error", description: "Failed to load subjects", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, instituteId, searchQuery, subjectType, basketCategory]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleSearch = () => { setPage(1); fetchSubjects(); };

  const handleView = (subject: Subject) => {
    setSelectedSubject(subject);
    setViewDialogOpen(true);
  };

  const handleUpdate = (subject: Subject) => {
    setSelectedSubject(subject);
    setUpdateDialogOpen(true);
  };

  const columns: Column[] = [
    { key: "imgUrl", label: "Image", type: "image" },
    { key: "id", label: "ID" },
    { key: "code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "subjectType", label: "Type", type: "badge" },
    { key: "basketCategory", label: "Basket", type: "badge" },
    { key: "instituteId", label: "Institute" },
  ];

  const customActions: CustomAction[] = [
    {
      label: "Update",
      icon: <Pencil className="w-4 h-4" />,
      onClick: (row) => handleUpdate(row as Subject),
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title={`${subjectLabel}s`}
        description={`Manage all ${subjectLabel.toLowerCase()}s and courses`}
        icon={BookOpen}
        actions={<ActionButton label={`Create ${subjectLabel}`} onClick={() => setCreateDialogOpen(true)} />}
      />

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3 items-end">
        <InstituteSelector
          value={instituteId}
          onChange={(val) => { setInstituteId(val); setPage(1); }}
          onInstituteSelect={(inst) => setInstituteType(inst?.type || '')}
          placeholder="Select institute"
        />
        <div className="space-y-1">
          <Label className="text-xs">Search</Label>
          <Input
            placeholder="Code, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-44"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={subjectType} onValueChange={(v) => { setSubjectType(v); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBJECT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Basket</Label>
          <Select value={basketCategory} onValueChange={(v) => { setBasketCategory(v); setPage(1); }}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASKET_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSearch} size="sm">
          <Search className="w-4 h-4 mr-1" />
          Search
        </Button>
        <Button variant="outline" size="sm" onClick={() => {
          setSearchQuery(""); setSubjectType("ALL"); setBasketCategory("ALL"); setPage(1);
        }}>
          Clear
        </Button>
        <Button variant="ghost" size="icon" onClick={fetchSubjects} disabled={isLoading} className="h-9 w-9">
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      
      <DataTable
        columns={columns}
        data={subjects}
        isLoading={isLoading}
        onView={handleView}
        pagination={pagination || undefined}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1); }}
        customActions={customActions}
      />

      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={selectedSubject}
        title={selectedSubject?.name || `${subjectLabel} Details`}
        imageKey="imgUrl"
      />

      <CreateSubjectForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchSubjects}
      />

      <UpdateSubjectForm
        open={updateDialogOpen}
        onOpenChange={setUpdateDialogOpen}
        onSuccess={fetchSubjects}
        subject={selectedSubject}
      />
    </DashboardLayout>
  );
}
