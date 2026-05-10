import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { BookOpen, X, CheckCircle, XCircle, RefreshCw, Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { DataTable, Column, PaginationMeta } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ClassOption {
  id: string;
  className: string;
  grade?: number;
}

interface SubjectOption {
  id: string;
  subjectName?: string;
  name?: string;
  subject?: { name: string; id: string };
}

interface SubjectPayment {
  id: string;
  title: string;
  amount: number;
  dueDate: string | null;
  status: string;
  description: string | null;
  createdAt: string;
}

interface PaymentSubmission {
  id: string;
  studentId: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentSlipUrl: string | null;
  status: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
}

type Tab = "payments" | "submissions";

export default function SubjectPaymentsPage() {
  const { toast } = useToast();

  // Selection
  const [selectedInstituteId, setSelectedInstituteId] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [tab, setTab] = useState<Tab>("payments");

  // Payments list
  const [payments, setPayments] = useState<SubjectPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");

  // Submissions
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [subPage, setSubPage] = useState(1);
  const [subLimit, setSubLimit] = useState(10);
  const [subPagination, setSubPagination] = useState<PaginationMeta | null>(null);

  // Create payment dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createData, setCreateData] = useState({ title: "", amount: "", dueDate: "", description: "" });
  const [creating, setCreating] = useState(false);

  // Verify submission dialog
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<PaymentSubmission | null>(null);
  const [verifyAction, setVerifyAction] = useState<"VERIFIED" | "REJECTED">("VERIFIED");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [verifying, setVerifying] = useState(false);

  // View
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewData, setViewData] = useState<any>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Fetch classes when institute changes
  useEffect(() => {
    if (selectedInstituteId) {
      fetchClasses();
    } else {
      setClasses([]);
      setSelectedClassId("");
    }
  }, [selectedInstituteId]);

  // Fetch subjects when class changes
  useEffect(() => {
    if (selectedInstituteId && selectedClassId) {
      fetchSubjects();
    } else {
      setSubjects([]);
      setSelectedSubjectId("");
    }
  }, [selectedInstituteId, selectedClassId]);

  // Fetch payments when subject changes
  useEffect(() => {
    if (selectedInstituteId && selectedClassId && selectedSubjectId) {
      fetchPayments();
    } else {
      setPayments([]);
    }
  }, [selectedInstituteId, selectedClassId, selectedSubjectId]);

  // Fetch submissions when payment selected
  useEffect(() => {
    if (selectedPaymentId) {
      fetchSubmissions();
    } else {
      setSubmissions([]);
    }
  }, [selectedPaymentId, subPage, subLimit]);

  const fetchClasses = async () => {
    try {
      const response = await api.getInstituteClassesByInstitute(selectedInstituteId);
      setClasses(response.classes || response.data || response || []);
    } catch {
      setClasses([]);
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await api.getClassSubjects(selectedInstituteId, selectedClassId);
      setSubjects(response.subjects || response.data || response || []);
    } catch {
      setSubjects([]);
    }
  };

  const fetchPayments = async () => {
    try {
      setPaymentsLoading(true);
      const response = await api.getClassSubjectPayments(
        selectedInstituteId,
        selectedClassId,
        selectedSubjectId,
        { page: 1, limit: 100 }
      );
      setPayments(response.payments || response.data || []);
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      setSubmissionsLoading(true);
      const response = await api.getClassSubjectPaymentSubmissions(selectedPaymentId, {
        page: subPage,
        limit: subLimit,
      });
      const items = response.submissions || response.data || [];
      setSubmissions(items);
      const total = response.total ?? response.meta?.total ?? items.length;
      setSubPagination({
        page: response.page || subPage,
        limit: response.limit || subLimit,
        total,
        totalPages: Math.ceil(total / (response.limit || subLimit)),
      });
    } catch (error) {
      console.error("Failed to fetch submissions:", error);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!createData.title || !createData.amount) return;
    try {
      setCreating(true);
      await api.createClassSubjectPayment(
        selectedInstituteId,
        selectedClassId,
        selectedSubjectId,
        {
          title: createData.title,
          amount: Number(createData.amount),
          dueDate: createData.dueDate || undefined,
          description: createData.description || undefined,
        }
      );
      toast({ title: "Success", description: "Payment created successfully" });
      setCreateDialogOpen(false);
      setCreateData({ title: "", amount: "", dueDate: "", description: "" });
      fetchPayments();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create payment", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleVerifySubmission = async () => {
    if (!selectedSubmission) return;
    try {
      setVerifying(true);
      await api.verifyClassSubjectPaymentSubmission(selectedSubmission.id, {
        status: verifyAction,
        rejectionReason: verifyAction === "REJECTED" ? rejectionReason : undefined,
        notes: verifyNotes || undefined,
      });
      toast({ title: "Success", description: `Submission ${verifyAction.toLowerCase()} successfully` });
      setVerifyDialogOpen(false);
      setVerifyNotes("");
      setRejectionReason("");
      fetchSubmissions();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to verify", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const paymentColumns: Column[] = [
    { key: "id", label: "ID" },
    { key: "title", label: "Title" },
    {
      key: "amount",
      label: "Amount",
      render: (v: number) => `Rs. ${Number(v).toLocaleString()}`,
    },
    { key: "dueDate", label: "Due Date", type: "date" },
    { key: "status", label: "Status", type: "badge" },
    { key: "createdAt", label: "Created", type: "date" },
  ];

  const submissionColumns: Column[] = [
    { key: "id", label: "ID" },
    { key: "studentId", label: "Student ID" },
    {
      key: "paymentAmount",
      label: "Amount",
      render: (v: number) => `Rs. ${Number(v).toLocaleString()}`,
    },
    { key: "paymentMethod", label: "Method", type: "badge" },
    { key: "status", label: "Status", type: "badge" },
    { key: "createdAt", label: "Submitted", type: "date" },
  ];

  const getSubjectName = (s: SubjectOption) => {
    return s.subjectName || s.name || s.subject?.name || s.id;
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Subject Payments"
        description="Manage class subject payments and verify student submissions"
        icon={BookOpen}
      />

      {/* Selection Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Institute</Label>
          <InstituteSelector
            value={selectedInstituteId}
            onChange={(id) => {
              setSelectedInstituteId(id);
              setSelectedClassId("");
              setSelectedSubjectId("");
              setSelectedPaymentId("");
            }}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Class</Label>
          <Select
            value={selectedClassId}
            onValueChange={(id) => {
              setSelectedClassId(id);
              setSelectedSubjectId("");
              setSelectedPaymentId("");
            }}
            disabled={!selectedInstituteId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.className} {c.grade ? `(Grade ${c.grade})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Subject</Label>
          <Select
            value={selectedSubjectId}
            onValueChange={(id) => {
              setSelectedSubjectId(id);
              setSelectedPaymentId("");
            }}
            disabled={!selectedClassId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id || s.subject?.id} value={s.id || s.subject?.id || ""}>
                  {getSubjectName(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedSubjectId ? (
        <>
          {/* Tab navigation */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mb-6">
            <TabsList className="grid w-full max-w-sm grid-cols-2">
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="submissions">Submissions</TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === "payments" && (
            <>
              <div className="flex justify-end mb-4">
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Payment
                </Button>
              </div>
              <DataTable
                columns={paymentColumns}
                data={payments}
                isLoading={paymentsLoading}
                onView={(row) => { setViewData(row); setViewDialogOpen(true); }}
                customActions={[
                  {
                    label: "View Submissions",
                    icon: <Search className="w-4 h-4" />,
                    onClick: (row) => {
                      setSelectedPaymentId(row.id);
                      setTab("submissions");
                    },
                  },
                ]}
              />
            </>
          )}

          {tab === "submissions" && (
            <>
              {!selectedPaymentId ? (
                <div className="mb-4">
                  <Label className="text-sm font-medium">Select Payment</Label>
                  <Select value={selectedPaymentId} onValueChange={setSelectedPaymentId}>
                    <SelectTrigger className="mt-1 max-w-md">
                      <SelectValue placeholder="Select a payment to view submissions" />
                    </SelectTrigger>
                    <SelectContent>
                      {payments.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title} - Rs. {Number(p.amount).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm text-muted-foreground">
                    Showing submissions for: <strong>{payments.find(p => p.id === selectedPaymentId)?.title}</strong>
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setSelectedPaymentId("")}>
                    Change
                  </Button>
                  <Button variant="outline" size="sm" onClick={fetchSubmissions} disabled={submissionsLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${submissionsLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              )}

              {selectedPaymentId && (
                <DataTable
                  columns={submissionColumns}
                  data={submissions}
                  isLoading={submissionsLoading}
                  onView={(row) => { setViewData(row); setViewDialogOpen(true); }}
                  showViewSlip={true}
                  slipUrlKey="paymentSlipUrl"
                  onImageClick={(url) => setImagePreview(url)}
                  pagination={subPagination ?? undefined}
                  onPageChange={setSubPage}
                  onLimitChange={(l) => { setSubLimit(l); setSubPage(1); }}
                  customActions={[
                    {
                      label: "Approve",
                      icon: <CheckCircle className="w-4 h-4" />,
                      onClick: (row) => {
                        setSelectedSubmission(row);
                        setVerifyAction("VERIFIED");
                        setVerifyDialogOpen(true);
                      },
                      show: (row) => row.status === "PENDING",
                    },
                    {
                      label: "Reject",
                      icon: <XCircle className="w-4 h-4" />,
                      onClick: (row) => {
                        setSelectedSubmission(row);
                        setVerifyAction("REJECTED");
                        setVerifyDialogOpen(true);
                      },
                      show: (row) => row.status === "PENDING",
                      variant: "destructive",
                    },
                  ]}
                />
              )}
            </>
          )}
        </>
      ) : (
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {!selectedInstituteId
                ? "Select an institute to get started"
                : !selectedClassId
                ? "Select a class"
                : "Select a subject to view payments"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* View Details Dialog */}
      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={viewData}
        title="Details"
      />

      {/* Create Payment Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Subject Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={createData.title}
                onChange={(e) => setCreateData((d) => ({ ...d, title: e.target.value }))}
                placeholder="e.g., Monthly Fee - January"
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (Rs.) *</Label>
              <Input
                type="number"
                value={createData.amount}
                onChange={(e) => setCreateData((d) => ({ ...d, amount: e.target.value }))}
                placeholder="1000"
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={createData.dueDate}
                onChange={(e) => setCreateData((d) => ({ ...d, dueDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={createData.description}
                onChange={(e) => setCreateData((d) => ({ ...d, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePayment} disabled={creating || !createData.title || !createData.amount}>
              {creating ? "Creating..." : "Create Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify/Reject Submission Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {verifyAction === "VERIFIED" ? "Approve" : "Reject"} Submission
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm">Student ID</span>
              <span className="font-medium">{selectedSubmission?.studentId}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm">Amount</span>
              <span className="font-medium">Rs. {Number(selectedSubmission?.paymentAmount || 0).toLocaleString()}</span>
            </div>
            {verifyAction === "REJECTED" && (
              <div className="space-y-2">
                <Label>Rejection Reason *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleVerifySubmission}
              disabled={verifying || (verifyAction === "REJECTED" && !rejectionReason)}
              variant={verifyAction === "REJECTED" ? "destructive" : "default"}
            >
              {verifying ? "Processing..." : verifyAction === "VERIFIED" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview */}
      {imagePreview && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setImagePreview(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setImagePreview(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={imagePreview}
            alt="Payment Slip"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
