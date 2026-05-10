import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageComponents";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Banknote, Search, User, BookOpen, CheckCircle2,
  Loader2, RefreshCw, ClipboardList, Phone, Mail,
  Hash, IdCard, AlertCircle,
} from "lucide-react";
import { StudentPaymentSummaryDialog } from "@/components/forms/StudentPaymentSummaryDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassOption {
  id: string;
  name?: string;
  className?: string;
  grade?: number;
  isActive?: boolean;
}

interface SubjectOption {
  id: string;
  subjectName?: string;
  name?: string;
  subject?: { id: string; name: string };
}

interface SubjectPayment {
  id: string;
  title: string;
  description?: string;
  amount: number;
  lastDate?: string;
  dueDate?: string;
  status?: string;
  targetType?: string;
  priority?: string;
}

interface FoundStudent {
  userId: string;
  firstName: string;
  lastName: string;
  nameWithInitials?: string;
  email?: string;
  phoneNumber?: string;
  imageUrl?: string | null;
  instituteStudentId?: string;
}

type SearchType = "id" | "phone" | "email" | "instituteId";
type PaymentTier = "full" | "half" | "quarter";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<PaymentTier, string> = {
  full: "Full (100%)",
  half: "Half (50%)",
  quarter: "Quarter (25%)",
};
const TIER_FACTOR: Record<PaymentTier, number> = { full: 1, half: 0.5, quarter: 0.25 };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Data normalisers ─────────────────────────────────────────────────────────

function className(c: ClassOption): string {
  return c.className ?? c.name ?? `Class ${c.id}`;
}

function subjectName(s: SubjectOption): string {
  return s.subjectName ?? s.subject?.name ?? s.name ?? `Subject ${s.id}`;
}

function normalizeStudent(raw: any): FoundStudent | null {
  if (!raw) return null;
  // searchStudentForPayment wraps in { student: {...} }
  if (raw.student) raw = raw.student;
  // getInstituteUsers / getStudents returns data array; caller picks first
  if (Array.isArray(raw)) raw = raw[0];
  if (!raw) return null;

  // Nested user object (e.g. student entity with user relation)
  const u = raw.user ?? raw;
  return {
    userId: String(u.id ?? raw.userId ?? raw.uuid ?? raw.id ?? ""),
    firstName: u.firstName ?? u.first_name ?? raw.nameWithInitials?.split(" ")[0] ?? "",
    lastName: u.lastName ?? u.last_name ?? "",
    nameWithInitials: raw.nameWithInitials ?? u.nameWithInitials,
    email: u.email,
    phoneNumber: u.phoneNumber ?? u.phone,
    imageUrl: u.imageUrl ?? raw.image ?? null,
    instituteStudentId: raw.instituteUserId ?? raw.instituteStudentId ?? raw.userIdByInstitute ?? u.studentId,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CollectPhysicalPaymentPage() {
  // Institute / class / subject
  const [selectedInstituteId, setSelectedInstituteId] = useState("");
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  // Student search
  const [searchType, setSearchType] = useState<SearchType>("id");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundStudent, setFoundStudent] = useState<FoundStudent | null>(null);
  const [searchError, setSearchError] = useState("");

  // Payments
  const [payments, setPayments] = useState<SubjectPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");

  // Collection form
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentTier, setPaymentTier] = useState<PaymentTier>("full");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentNotes, setPaymentNotes] = useState("");
  const [isCollecting, setIsCollecting] = useState(false);

  // Summary dialog
  const [showSummary, setShowSummary] = useState(false);

  // ─── Effects ──────────────────────────────────────────────────────────────

  // Load classes when institute selected
  useEffect(() => {
    if (!selectedInstituteId) {
      setClasses([]);
      setSelectedClassId("");
      return;
    }
    setClassesLoading(true);
    api.getInstituteClassesByInstitute(selectedInstituteId)
      .then((res: any) => {
        const list: ClassOption[] = res?.classes ?? res?.data ?? (Array.isArray(res) ? res : []);
        setClasses(list.filter((c) => c.isActive !== false));
        setSelectedClassId("");
      })
      .catch(() => toast.error("Failed to load classes"))
      .finally(() => setClassesLoading(false));
  }, [selectedInstituteId]);

  // Load subjects when class selected
  useEffect(() => {
    setSubjects([]);
    setSelectedSubjectId("");
    if (!selectedInstituteId || !selectedClassId) return;
    setSubjectsLoading(true);
    api.getClassSubjects(selectedInstituteId, selectedClassId)
      .then((res: any) => {
        const list: SubjectOption[] = res?.subjects ?? res?.data ?? (Array.isArray(res) ? res : []);
        setSubjects(list);
      })
      .catch(() => toast.error("Failed to load subjects"))
      .finally(() => setSubjectsLoading(false));
  }, [selectedInstituteId, selectedClassId]);

  // Load payments when subject selected
  useEffect(() => {
    setPayments([]);
    setSelectedPaymentId("");
    setPaymentAmount("");
    if (!selectedInstituteId || !selectedClassId || !selectedSubjectId) return;
    setPaymentsLoading(true);
    api.getClassSubjectPayments(selectedInstituteId, selectedClassId, selectedSubjectId, { limit: 50 })
      .then((res: any) => {
        const list: SubjectPayment[] = res?.payments ?? res?.data ?? (Array.isArray(res) ? res : []);
        setPayments(list.filter((p) => p.status !== "EXPIRED" && p.status !== "INACTIVE"));
      })
      .catch(() => toast.error("Failed to load payments"))
      .finally(() => setPaymentsLoading(false));
  }, [selectedInstituteId, selectedClassId, selectedSubjectId]);

  // ─── Student search ───────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q || !selectedInstituteId) return;
    setIsSearching(true);
    setSearchError("");
    setFoundStudent(null);

    try {
      let raw: any = null;

      if (searchType === "phone") {
        raw = await api.getUserByPhone(q);
      } else if (searchType === "email") {
        raw = await api.getUserByEmail(q);
      } else if (searchType === "instituteId") {
        // search by institute-assigned user ID (e.g. "STU-001")
        // Uses searchStudentForPayment which now searches by both userId and userIdByInstitute
        raw = await api.searchStudentForPayment(selectedInstituteId, q).catch(() => null);
        if (!raw || raw.error) {
          // Fallback: search by name/email in institute users, filter by institute user ID
          const listRes = await api.getInstituteUsers(selectedInstituteId, "STUDENT", {
            search: q, limit: 5,
          }).catch(() => null);
          const list = listRes?.users ?? listRes?.data ?? (Array.isArray(listRes) ? listRes : []);
          raw = list[0] ?? null;
        }
      } else {
        // System ID — try student endpoint first, then generic user
        raw = await api.getStudentById(q).catch(() => null)
          ?? await api.getUserById(q).catch(() => null);
      }

      const student = normalizeStudent(raw);
      if (student && student.userId) {
        setFoundStudent(student);
      } else {
        setSearchError("No student found with that detail. Check and try again.");
      }
    } catch {
      setSearchError("Student not found. Check the detail and try again.");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, searchType, selectedInstituteId]);

  // ─── Payment selection ────────────────────────────────────────────────────

  const handlePaymentSelect = (payment: SubjectPayment) => {
    setSelectedPaymentId(payment.id);
    const base = payment.amount ?? 0;
    setPaymentAmount(String(Math.round(base * TIER_FACTOR[paymentTier] * 100) / 100));
  };

  const handleTierChange = (tier: PaymentTier) => {
    setPaymentTier(tier);
    const sel = payments.find((p) => p.id === selectedPaymentId);
    if (sel) {
      const base = sel.amount ?? 0;
      setPaymentAmount(String(Math.round(base * TIER_FACTOR[tier] * 100) / 100));
    }
  };

  // ─── Collect ──────────────────────────────────────────────────────────────

  const handleCollect = async () => {
    if (!foundStudent || !selectedPaymentId) return;
    const amt = parseFloat(paymentAmount);
    if (!paymentDate || isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount and date.");
      return;
    }
    setIsCollecting(true);
    try {
      await api.adminVerifyStudentCspPayment(selectedPaymentId, foundStudent.userId, {
        amount: amt,
        date: new Date(paymentDate).toISOString(),
        notes: paymentNotes || undefined,
        paymentTier,
      });
      toast.success(
        `Payment of Rs. ${amt.toFixed(2)} recorded for ${foundStudent.nameWithInitials ?? `${foundStudent.firstName} ${foundStudent.lastName}`}`
      );
      // Reset collection form but keep student/subject context
      setSelectedPaymentId("");
      setPaymentAmount("");
      setPaymentTier("full");
      setPaymentNotes("");
      setPaymentDate(todayISO());
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to record payment");
    } finally {
      setIsCollecting(false);
    }
  };

  // ─── Reset ────────────────────────────────────────────────────────────────

  const resetAll = () => {
    setFoundStudent(null);
    setSearchQuery("");
    setSearchError("");
    setSelectedPaymentId("");
    setPaymentAmount("");
    setPaymentTier("full");
    setPaymentNotes("");
    setPaymentDate(todayISO());
  };

  // ─── Derived ──────────────────────────────────────────────────────────────

  const canSearch = !!selectedInstituteId && !!selectedClassId && searchQuery.trim().length > 0;
  const selectedPayment = payments.find((p) => p.id === selectedPaymentId);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title="Collect Physical Payment"
          description="Record cash or on-site payment for a student's subject enrollment"
          icon={Banknote}
          actions={
            <Button variant="outline" size="sm" onClick={resetAll}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          }
        />

        {/* ── Step 1: Institute / Class / Subject ────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Step 1 — Select Institute, Class & Subject
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InstituteSelector
              value={selectedInstituteId}
              onChange={(val) => {
                setSelectedInstituteId(val === "all" ? "" : val);
                resetAll();
              }}
              required
            />

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Class */}
              <div className="space-y-1.5">
                <Label>Class</Label>
                <Select
                  value={selectedClassId}
                  onValueChange={(v) => {
                    setSelectedClassId(v);
                    setFoundStudent(null);
                    setSearchQuery("");
                    setSearchError("");
                  }}
                  disabled={!selectedInstituteId || classesLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        classesLoading
                          ? "Loading classes…"
                          : !selectedInstituteId
                          ? "Select institute first"
                          : classes.length === 0
                          ? "No classes found"
                          : "Select a class"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {className(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Select
                  value={selectedSubjectId}
                  onValueChange={setSelectedSubjectId}
                  disabled={!selectedClassId || subjectsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        subjectsLoading
                          ? "Loading subjects…"
                          : !selectedClassId
                          ? "Select class first"
                          : subjects.length === 0
                          ? "No subjects found"
                          : "Select a subject"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {subjectName(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Step 2: Student Search ─────────────────────────────────────── */}
        <Card className={!selectedClassId ? "opacity-50 pointer-events-none" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              Step 2 — Find Student
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search type pills */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "id", label: "System ID", icon: Hash },
                  { value: "phone", label: "Phone", icon: Phone },
                  { value: "email", label: "Email", icon: Mail },
                  { value: "instituteId", label: "Institute User ID", icon: IdCard },
                ] as { value: SearchType; label: string; icon: any }[]
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setSearchType(value);
                    setSearchQuery("");
                    setFoundStudent(null);
                    setSearchError("");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    searchType === value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Search input */}
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canSearch && !isSearching && handleSearch()}
                placeholder={
                  searchType === "id"
                    ? "Enter student system ID…"
                    : searchType === "phone"
                    ? "Enter phone number…"
                    : searchType === "email"
                    ? "Enter email address…"
                    : "Enter institute user ID (e.g. STU-001)…"
                }
                disabled={isSearching}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={!canSearch || isSearching}>
                {isSearching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span className="ml-2">Search</span>
              </Button>
            </div>

            {/* Error */}
            {searchError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {searchError}
              </div>
            )}

            {/* Student card */}
            {foundStudent && (
              <div className="p-4 rounded-lg border bg-muted/40 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {foundStudent.imageUrl ? (
                    <img
                      src={foundStudent.imageUrl}
                      alt="Student"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-7 h-7 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">
                    {foundStudent.nameWithInitials
                      ?? `${foundStudent.firstName} ${foundStudent.lastName}`.trim()}
                  </p>
                  {foundStudent.email && (
                    <p className="text-sm text-muted-foreground truncate">{foundStudent.email}</p>
                  )}
                  {foundStudent.phoneNumber && (
                    <p className="text-sm text-muted-foreground">{foundStudent.phoneNumber}</p>
                  )}
                  {foundStudent.instituteStudentId && (
                    <p className="text-xs text-muted-foreground">
                      Institute ID: {foundStudent.instituteStudentId}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSummary(true)}
                >
                  <ClipboardList className="w-4 h-4 mr-1.5" />
                  View Summary
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Step 3: Select Payment & Collect ──────────────────────────── */}
        {foundStudent && selectedSubjectId && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Banknote className="w-4 h-4 text-primary" />
                Step 3 — Select Payment & Collect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {paymentsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading payments…
                </div>
              ) : payments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No active payments defined for this subject.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label>Available Payments</Label>
                  <div className="grid gap-2">
                    {payments.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handlePaymentSelect(p)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedPaymentId === p.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40 bg-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                selectedPaymentId === p.id
                                  ? "border-primary"
                                  : "border-muted-foreground/40"
                              }`}
                            >
                              {selectedPaymentId === p.id && (
                                <div className="w-2 h-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{p.title}</p>
                              {p.description && (
                                <p className="text-xs text-muted-foreground">{p.description}</p>
                              )}
                              {(p.lastDate ?? p.dueDate) && (
                                <p className="text-xs text-muted-foreground">
                                  Due: {new Date(p.lastDate ?? p.dueDate!).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {p.priority && (
                              <Badge variant="outline" className="text-xs">
                                {p.priority}
                              </Badge>
                            )}
                            <span className="font-semibold text-primary">
                              Rs. {Number(p.amount).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedPayment && (
                <>
                  <Separator />

                  {/* Tier selector */}
                  <div className="space-y-1.5">
                    <Label>Payment Tier</Label>
                    <div className="flex gap-2 flex-wrap">
                      {(["full", "half", "quarter"] as PaymentTier[]).map((tier) => (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => handleTierChange(tier)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            paymentTier === tier
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {TIER_LABEL[tier]}
                          <span className="ml-1.5 opacity-75 text-xs">
                            Rs.{" "}
                            {Math.round(
                              Number(selectedPayment.amount) * TIER_FACTOR[tier] * 100,
                            ) / 100}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="amount">Amount (Rs.)</Label>
                      <Input
                        id="amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="payDate">Payment Date</Label>
                      <Input
                        id="payDate"
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        max={todayISO()}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="Cash collected at counter, receipt no. …"
                      rows={2}
                      maxLength={500}
                    />
                  </div>

                  {/* Pre-collect summary */}
                  <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">Student: </span>
                      <strong>
                        {foundStudent.nameWithInitials
                          ?? `${foundStudent.firstName} ${foundStudent.lastName}`.trim()}
                      </strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Payment: </span>
                      <strong>{selectedPayment.title}</strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Amount: </span>
                      <strong className="text-primary">
                        Rs. {paymentAmount || "0.00"}{" "}
                        <span className="font-normal text-muted-foreground">
                          ({TIER_LABEL[paymentTier]})
                        </span>
                      </strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Date: </span>
                      <strong>{paymentDate}</strong>
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleCollect}
                    disabled={!selectedPaymentId || isCollecting || !paymentAmount}
                  >
                    {isCollecting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    {isCollecting ? "Recording Payment…" : "Collect & Record Payment"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Prompt to select subject when student found but no subject */}
        {foundStudent && !selectedSubjectId && (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Select a subject above to see available payments and collect.
            </CardContent>
          </Card>
        )}

        {/* ── Summary Dialog ─────────────────────────────────────────────── */}
        {foundStudent && showSummary && (
          <StudentPaymentSummaryDialog
            open={showSummary}
            onOpenChange={setShowSummary}
            student={foundStudent}
            instituteId={selectedInstituteId}
            classId={selectedClassId}
            subjectId={selectedSubjectId || undefined}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
