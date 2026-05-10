import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import {
  User, Phone, Mail, IdCard, CalendarDays,
  CheckCircle2, XCircle, Clock, Loader2, BookOpen,
  TrendingUp, AlertCircle,
} from "lucide-react";

interface StudentSummaryStudent {
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  imageUrl?: string | null;
  instituteStudentId?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentSummaryStudent;
  instituteId: string;
  classId: string;
  subjectId?: string;
}

interface AttendanceRecord {
  id?: string | number;
  date?: string;
  createdAt?: string;
  status?: string;
  className?: string;
  subjectName?: string;
}

interface SubjectPayment {
  id: string;
  title: string;
  amount: number;
  lastDate?: string;
  status?: string;
  priority?: string;
}

interface PaymentStatus {
  paymentId: string;
  submissionStatus?: string; // VERIFIED / PENDING / REJECTED / HALF_VERIFIED / QUARTER_VERIFIED
  submittedAmount?: number;
  verifiedAt?: string;
}

const statusIcon: Record<string, any> = {
  VERIFIED: CheckCircle2,
  HALF_VERIFIED: CheckCircle2,
  QUARTER_VERIFIED: CheckCircle2,
  PENDING: Clock,
  REJECTED: XCircle,
};

const statusColor: Record<string, string> = {
  VERIFIED: "text-green-600",
  HALF_VERIFIED: "text-blue-600",
  QUARTER_VERIFIED: "text-teal-600",
  PENDING: "text-yellow-600",
  REJECTED: "text-red-600",
};

const statusBadge: Record<string, string> = {
  VERIFIED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  HALF_VERIFIED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  QUARTER_VERIFIED: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const attendanceBadge: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  ABSENT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  LATE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
};

function humanStatus(s?: string): string {
  if (!s) return "Not Submitted";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(d?: string) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

export function StudentPaymentSummaryDialog({
  open, onOpenChange, student, instituteId, classId, subjectId,
}: Props) {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [attendanceMeta, setAttendanceMeta] = useState({ total: 0, present: 0, absent: 0, late: 0 });
  const [payments, setPayments] = useState<SubjectPayment[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, PaymentStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !student.userId) return;
    setLoading(true);
    setError("");
    setAttendance([]);
    setPayments([]);
    setPaymentStatuses({});

    const now = new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const startDate = threeMonthsAgo.toISOString().slice(0, 10);
    const endDate = now.toISOString().slice(0, 10);

    const tasks: Promise<any>[] = [
      // Attendance: last 3 months, scoped to class
      api.getStudentAttendance(student.userId, {
        instituteId,
        classId: classId || undefined,
        startDate,
        endDate,
        limit: 30,
        page: 1,
      }).catch(() => null),
    ];

    // Payments for the selected subject
    if (subjectId && classId && instituteId) {
      tasks.push(
        api.getClassSubjectPayments(instituteId, classId, subjectId, { limit: 50 })
          .catch(() => null)
      );
    } else {
      tasks.push(Promise.resolve(null));
    }

    Promise.all(tasks).then(async ([attRes, payRes]) => {
      // Process attendance
      const attList: AttendanceRecord[] = Array.isArray(attRes)
        ? attRes
        : (attRes?.data ?? attRes?.records ?? attRes?.attendance ?? []);
      setAttendance(attList.slice(0, 20));
      const present = attList.filter((a: AttendanceRecord) => a.status === "PRESENT").length;
      const absent = attList.filter((a: AttendanceRecord) => a.status === "ABSENT").length;
      const late = attList.filter((a: AttendanceRecord) => a.status === "LATE").length;
      setAttendanceMeta({ total: attList.length, present, absent, late });

      // Process payments
      const payList: SubjectPayment[] = Array.isArray(payRes)
        ? payRes
        : (payRes?.data ?? []);
      setPayments(payList);

      // For each payment, check this student's status
      if (payList.length > 0) {
        const statuses: Record<string, PaymentStatus> = {};
        await Promise.allSettled(
          payList.map(async (p) => {
            try {
              const res = await api.getStudentsForPayment(p.id, { limit: 200 });
              const students: any[] = Array.isArray(res)
                ? res
                : (res?.data ?? res?.students ?? []);
              const found = students.find(
                (s: any) =>
                  String(s.userId ?? s.id ?? s.studentId) === String(student.userId)
              );
              statuses[p.id] = {
                paymentId: p.id,
                submissionStatus: found?.submissionStatus ?? found?.status ?? undefined,
                submittedAmount: found?.submittedAmount ?? found?.amount ?? undefined,
                verifiedAt: found?.verifiedAt ?? undefined,
              };
            } catch {
              statuses[p.id] = { paymentId: p.id };
            }
          })
        );
        setPaymentStatuses(statuses);
      }

      setLoading(false);
    }).catch(() => {
      setError("Failed to load summary data.");
      setLoading(false);
    });
  }, [open, student.userId, instituteId, classId, subjectId]);

  const attendanceRate =
    attendanceMeta.total > 0
      ? Math.round((attendanceMeta.present / attendanceMeta.total) * 100)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardListIcon className="w-5 h-5 text-primary" />
            Student Payment Summary
          </DialogTitle>
        </DialogHeader>

        {/* Student Profile */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {student.imageUrl ? (
              <img src={student.imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-primary" />
            )}
          </div>
          <div className="flex-1 space-y-1 min-w-0">
            <p className="font-semibold text-lg leading-tight">
              {student.firstName} {student.lastName}
            </p>
            {student.email && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{student.email}</span>
              </div>
            )}
            {student.phoneNumber && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                {student.phoneNumber}
              </div>
            )}
            {student.instituteStudentId && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <IdCard className="w-3.5 h-3.5 shrink-0" />
                {student.instituteStudentId}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading summary…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-destructive py-6 justify-center">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        ) : (
          <>
            {/* Attendance Summary */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Attendance (Last 3 Months)</h3>
              </div>

              {attendanceMeta.total === 0 ? (
                <p className="text-sm text-muted-foreground pl-6">No attendance records in this period.</p>
              ) : (
                <>
                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Total", value: attendanceMeta.total, color: "text-foreground" },
                      { label: "Present", value: attendanceMeta.present, color: "text-green-600" },
                      { label: "Absent", value: attendanceMeta.absent, color: "text-red-600" },
                      { label: "Late", value: attendanceMeta.late, color: "text-yellow-600" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center p-2 rounded-lg bg-muted">
                        <p className={`text-xl font-bold ${color}`}>{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                  {attendanceRate !== null && (
                    <div className="flex items-center gap-2 text-sm pl-1">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span>
                        Attendance rate:{" "}
                        <span
                          className={
                            attendanceRate >= 75
                              ? "text-green-600 font-semibold"
                              : attendanceRate >= 50
                              ? "text-yellow-600 font-semibold"
                              : "text-red-600 font-semibold"
                          }
                        >
                          {attendanceRate}%
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Recent records */}
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-muted-foreground">
                        <tr>
                          <th className="text-left p-2 pl-3 font-medium">Date</th>
                          <th className="text-left p-2 font-medium">Class / Subject</th>
                          <th className="text-right p-2 pr-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {attendance.slice(0, 10).map((a, i) => (
                          <tr key={a.id ?? i} className="hover:bg-muted/30 transition-colors">
                            <td className="p-2 pl-3 text-muted-foreground">
                              {fmtDate(a.date ?? a.createdAt)}
                            </td>
                            <td className="p-2 text-xs text-muted-foreground">
                              {[a.className, a.subjectName].filter(Boolean).join(" / ") || "—"}
                            </td>
                            <td className="p-2 pr-3 text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  attendanceBadge[a.status ?? ""] ?? "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {a.status ?? "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <Separator />

            {/* Payment Status */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">
                  {subjectId ? "Subject Payment Status" : "Payment Status"}
                </h3>
                {!subjectId && (
                  <span className="text-xs text-muted-foreground">(Select a subject to see payments)</span>
                )}
              </div>

              {!subjectId ? (
                <p className="text-sm text-muted-foreground pl-6">
                  No subject selected. Select a subject in the main form to view payment history.
                </p>
              ) : payments.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-6">
                  No payments defined for this subject.
                </p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => {
                    const ps = paymentStatuses[p.id];
                    const status = ps?.submissionStatus;
                    const StatusIcon = status ? statusIcon[status] : AlertCircle;
                    const isPaid = status === "VERIFIED" || status === "HALF_VERIFIED" || status === "QUARTER_VERIFIED";

                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-lg border ${
                          isPaid ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-muted/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <StatusIcon
                              className={`w-4 h-4 mt-0.5 shrink-0 ${
                                status ? statusColor[status] : "text-muted-foreground"
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{p.title}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                <span className="text-xs text-muted-foreground">
                                  Due: {fmtDate(p.lastDate)}
                                </span>
                                {ps?.submittedAmount && (
                                  <span className="text-xs text-muted-foreground">
                                    Paid: Rs. {ps.submittedAmount.toFixed(2)}
                                  </span>
                                )}
                                {ps?.verifiedAt && (
                                  <span className="text-xs text-muted-foreground">
                                    Verified: {fmtDate(ps.verifiedAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-sm font-semibold">Rs. {p.amount?.toFixed(2)}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                status
                                  ? (statusBadge[status] ?? "bg-gray-100 text-gray-600")
                                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                              }`}
                            >
                              {humanStatus(status)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Quick totals */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      {
                        label: "Paid",
                        count: payments.filter((p) => {
                          const s = paymentStatuses[p.id]?.submissionStatus;
                          return s === "VERIFIED" || s === "HALF_VERIFIED" || s === "QUARTER_VERIFIED";
                        }).length,
                        color: "text-green-600",
                      },
                      {
                        label: "Pending",
                        count: payments.filter((p) => paymentStatuses[p.id]?.submissionStatus === "PENDING").length,
                        color: "text-yellow-600",
                      },
                      {
                        label: "Unpaid",
                        count: payments.filter((p) => !paymentStatuses[p.id]?.submissionStatus).length,
                        color: "text-muted-foreground",
                      },
                    ].map(({ label, count, color }) => (
                      <div key={label} className="text-center p-2 rounded-lg bg-muted">
                        <p className={`text-lg font-bold ${color}`}>{count}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ClipboardListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}
