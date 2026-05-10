import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, UserCheck, UserX, RefreshCw, Users, CreditCard, Eye, Gift } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';
import { getBaseUrl, getApiHeadersAsync, getCredentialsMode } from '@/contexts/utils/auth.api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { useViewMode } from '@/hooks/useViewMode';
import { enrollmentApi } from '@/api/enrollment.api';

interface UnverifiedStudent {
  id: string;
  userId: string;
  studentId: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    imageUrl: string;
    dateOfBirth: string;
    gender: string;
  };
}

interface NewUnverifiedStudent {
  id: string;
  name: string;
  phoneNumber: string;
  imageUrl: string;
  userIdByInstitute: string;
  studentUserId: string;
  enrollmentDate: string;
  enrollmentMethod: string;
  isVerified: number;
  isActive: number;
  studentType?: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid';
}

interface SubjectUnverifiedStudent {
  instituteId: string;
  classId: string;
  subjectId: string;
  studentId: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  studentImageUrl: string;
  enrollmentMethod: string;
  verificationStatus: string;
  studentType: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid';
  enrollmentPaymentId: string | null;
  rejectionReason: string | null;
  enrolledAt: any;
}

interface InstituteClassUnverifiedResponse {
  message: string;
  classId: string;
  className: string;
  classCode: string;
  instituteId: string;
  students: NewUnverifiedStudent[];
  count: number;
  totalPendingVerifications: number;
}

const UnverifiedStudents = () => {
  const { user, selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const userRole = useInstituteRole();
  const [students, setStudents] = useState<(UnverifiedStudent | NewUnverifiedStudent | SubjectUnverifiedStudent)[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [hasData, setHasData] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(50);
  const [rowsPerPageOptions] = useState([25, 50, 100]);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const { viewMode, setViewMode } = useViewMode();
  const [paymentDetails, setPaymentDetails] = useState<Record<string, any>>({});

  // ── Column config ──
  const uvColDefs = useMemo<ColumnDef[]>(() => [
    { key: 'avatar',       header: 'Avatar',       defaultVisible: true, locked: false, defaultWidth: 70,  minWidth: 50  },
    { key: 'name',         header: 'Name',         defaultVisible: true, locked: true,  defaultWidth: 160, minWidth: 120 },
    { key: 'joinDate',     header: 'Join Date',    defaultVisible: true, locked: false, defaultWidth: 120, minWidth: 80  },
    { key: 'enrollment',   header: 'Enrollment',   defaultVisible: true, locked: false, defaultWidth: 130, minWidth: 80  },
    { key: 'status',       header: 'Status',       defaultVisible: true, locked: false, defaultWidth: 100, minWidth: 70  },
    { key: 'verification', header: 'Verification', defaultVisible: true, locked: false, defaultWidth: 150, minWidth: 100 },
    { key: 'payment',      header: 'Payment',      defaultVisible: true, locked: false, defaultWidth: 140, minWidth: 80  },
    { key: 'actions',      header: 'Actions',      defaultVisible: true, locked: false, defaultWidth: 180, minWidth: 140 },
  ], []);
  const uvColIds  = useMemo(() => uvColDefs.map(c => c.key), [uvColDefs]);
  const uvColDefaultWidths = useMemo(() => Object.fromEntries(uvColDefs.map(c => [c.key, c.defaultWidth!])), [uvColDefs]);
  const { getWidth: getUVWidth, totalWidth: uvTotalWidth, setHoveredCol: setUVHoveredCol, ResizeHandle: UVResizeHandle } =
    useResizableColumns(uvColIds, uvColDefaultWidths);
  const { colState: uvColState, visibleColumns: uvVisDefs, toggleColumn: toggleUVCol, resetColumns: resetUVCols } =
    useColumnConfig(uvColDefs, 'unverified-students');
  const [loadingPaymentFor, setLoadingPaymentFor] = useState<string | null>(null);
  const [updatingTypeFor, setUpdatingTypeFor] = useState<string | null>(null);

  const fetchPaymentDetails = async (studentId: string, enrollmentPaymentId: string) => {
    if (paymentDetails[studentId]) return; // Already loaded
    setLoadingPaymentFor(studentId);
    try {
      const data = await enhancedCachedClient.get(
        `/institute-class-payment-submissions/payment/${enrollmentPaymentId}/submissions`,
        { page: '1', limit: '5' },
        { ttl: 30, forceRefresh: true }
      );
      const submissions = data?.data || (Array.isArray(data) ? data : []);
      setPaymentDetails(prev => ({ ...prev, [studentId]: submissions }));
    } catch (error) {
      console.error('Failed to fetch payment details:', error);
    } finally {
      setLoadingPaymentFor(null);
    }
  };

  const fetchUnverifiedStudents = async (page: number = 0, forceRefresh = false) => {
    if (!selectedInstitute || !selectedClass) return;
    
    setLoading(true);
    try {
      let endpoint = '';
      
      if (selectedSubject) {
        endpoint = `/institute-class-subject-students/unverified-students/${selectedInstitute.id}/${selectedClass.id}/${selectedSubject.id}`;
      } else {
        endpoint = `/institute-classes/${selectedClass.id}/unverified-students?limit=${limit}&page=${page + 1}`;
      }

      const data = await enhancedCachedClient.get(
        endpoint,
        {},
        {
          ttl: CACHE_TTL.UNVERIFIED_STUDENTS,
          forceRefresh,
          userId: user?.id,
          role: userRole,
          instituteId: selectedInstitute.id,
          classId: selectedClass.id,
          ...(selectedSubject ? { subjectId: selectedSubject.id } : {})
        }
      );
      
      if (selectedSubject) {
        const subjectStudents = Array.isArray(data) ? data : [];
        setStudents(subjectStudents);
        setTotalCount(subjectStudents.length);
        setTotalPages(1);
      } else {
        const responseData = data as InstituteClassUnverifiedResponse;
        const unverifiedStudents = responseData.students.filter(student => student.isVerified === 0);
        setStudents(unverifiedStudents);
        setTotalCount(responseData.totalPendingVerifications);
        setTotalPages(Math.ceil(responseData.totalPendingVerifications / limit));
        setCurrentPage(page);
      }
      
      setHasData(true);
    } catch (error: any) {
      console.error('Error fetching unverified students:', error);
      toast({
        title: "Error",
        description: "Failed to load unverified students",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedInstitute && selectedClass) {
      fetchUnverifiedStudents(0, false);
    }
  }, [selectedInstitute?.id, selectedClass?.id, selectedSubject?.id, limit]);

  const handleVerifyStudent = async (studentIdentifier: string, approve: boolean) => {
    if (!selectedInstitute || !selectedClass) return;

    setVerifyingIds(prev => new Set(prev).add(studentIdentifier));

    try {
      const headers = await getApiHeadersAsync();
      let endpoint = '';
      let method = 'POST';
      let requestBody: any = {};

      if (selectedSubject) {
        const basePath = approve ? 'verify-enrollment' : 'reject-enrollment';
        endpoint = `${getBaseUrl()}/institute-class-subject-students/${basePath}/${selectedInstitute.id}/${selectedClass.id}/${selectedSubject.id}/${studentIdentifier}`;
        method = 'PATCH';
        requestBody = !approve ? { rejectionReason: 'Rejected by admin' } : {};
      } else {
        endpoint = `${getBaseUrl()}/institutes/${selectedInstitute.id}/classes/${selectedClass.id}/students/verify-students`;
        method = 'POST';
        requestBody = {
          verifications: [
            {
              id: studentIdentifier,
              approve: approve,
              notes: approve ? "Approved by admin" : "Rejected by admin"
            }
          ]
        };
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
        credentials: getCredentialsMode(),
        body: JSON.stringify(requestBody)
      };

      const response = await fetch(endpoint, fetchOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to verify student');
      }

      toast({
        title: approve ? "Student Approved" : "Student Rejected",
        description: `Student has been ${approve ? 'approved' : 'rejected'} successfully`
      });

      // Force-refresh to bypass cache so the verified/rejected student disappears immediately
      fetchUnverifiedStudents(currentPage, true);
    } catch (error: any) {
      console.error('Error verifying student:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to verify student",
        variant: "destructive"
      });
    } finally {
      setVerifyingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentIdentifier);
        return newSet;
      });
    }
  };

  const getStudentKey = (student: UnverifiedStudent | NewUnverifiedStudent | SubjectUnverifiedStudent): string => {
    if ('studentId' in student && 'studentFirstName' in student) {
      return student.studentId;
    }
    // For class-level students (NewUnverifiedStudent), use the enrollment ID
    return student.id;
  };

  const getStudentId = (student: UnverifiedStudent | NewUnverifiedStudent | SubjectUnverifiedStudent): string => {
    if ('studentFirstName' in student) {
      return student.studentId;
    }
    if ('userIdByInstitute' in student) {
      return student.userIdByInstitute;
    }
    if ('studentId' in student) {
      return (student as UnverifiedStudent).studentId;
    }
    return (student as any).id || '';
  };

  const getStudentUser = (student: UnverifiedStudent | NewUnverifiedStudent | SubjectUnverifiedStudent) => {
    if ('studentFirstName' in student) {
      return {
        firstName: student.studentFirstName,
        lastName: student.studentLastName,
        email: student.studentEmail || 'N/A',
        phone: 'N/A',
        imageUrl: student.studentImageUrl || ''
      };
    }
    if ('user' in student && student.user) {
      return student.user;
    }
    if ('name' in student) {
      const nameParts = student.name.split(' ');
      return {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: 'N/A',
        phone: student.phoneNumber || 'N/A',
        imageUrl: student.imageUrl || ''
      };
    }
    return {
      firstName: 'Unknown',
      lastName: 'Student',
      email: 'N/A',
      phone: 'N/A',
      imageUrl: ''
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getEnrollmentMethodBadge = (method: string) => {
    if (method === 'self_enrollment' || method === 'self_enrolled') {
      return <Badge variant="outline" className="text-blue-600 border-blue-200">Self Enrolled</Badge>;
    }
    return <Badge variant="outline" className="text-purple-600 border-purple-200">Teacher Assigned</Badge>;
  };

  const getContextTitle = () => {
    if (selectedSubject) {
      return `Unverified Students - ${selectedSubject.name}`;
    }
    return `Unverified Students - ${selectedClass?.name}`;
  };

  if (!['InstituteAdmin', 'Teacher'].includes(userRole)) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to view unverified students.
        </AlertDescription>
      </Alert>
    );
  }

  if (!selectedInstitute || !selectedClass) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please select an institute and class to view unverified students.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{getContextTitle()}</h1>
          <p className="text-muted-foreground">
            {selectedSubject 
              ? `Students pending verification for ${selectedClass?.name} - ${selectedSubject.name}`
              : `Students pending verification for ${selectedClass?.name}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ColumnConfigurator allColumns={uvColDefs} colState={uvColState} onToggle={toggleUVCol} onReset={resetUVCols} />
          <Button 
            onClick={() => fetchUnverifiedStudents(0, true)}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {hasData ? (
        viewMode === 'card' ? (
          loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <RefreshCw className="h-7 w-7 animate-spin opacity-40" />
              <p className="text-sm">Loading students...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <Users className="h-7 w-7 opacity-40" />
              </div>
              <div>
                <p className="font-medium text-foreground">No unverified students</p>
                <p className="text-sm mt-1">All students are verified for this class.</p>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-4">
            {students.map((student) => {
              const userData = getStudentUser(student);
              const studentKey = getStudentKey(student);
              const isSubjectStudent = 'studentFirstName' in student;
              const subjectStudent = isSubjectStudent ? (student as SubjectUnverifiedStudent) : null;
              const classStudent = !isSubjectStudent && 'name' in student ? (student as NewUnverifiedStudent) : null;
              const effectiveStudentType = subjectStudent?.studentType ?? classStudent?.studentType ?? 'normal';
              const isPendingPayment = subjectStudent?.verificationStatus === 'pending_payment';
              const isPaymentRejected = subjectStudent?.verificationStatus === 'payment_rejected';
              const isFreeCard = effectiveStudentType === 'free_card';
              const hasEnrollmentPayment = subjectStudent?.enrollmentPaymentId;
              const studentPaymentSubs = paymentDetails[studentKey];
              
              return (
                <Card key={studentKey} className="hover:shadow-md transition-shadow">
                  {/* Always-visible header with action buttons */}
                  <div className="p-4 flex items-center gap-3">
                    <Avatar className="h-12 w-12 shrink-0 cursor-pointer" onClick={() => { if (userData.imageUrl) setPreviewImage({ url: getImageUrl(userData.imageUrl), name: `${userData.firstName} ${userData.lastName}` }); }}>
                      <AvatarImage src={getImageUrl(userData.imageUrl)} alt={userData.firstName} />
                      <AvatarFallback>{userData.firstName[0]}{userData.lastName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{userData.firstName} {userData.lastName}</p>
                      <p className="text-xs text-muted-foreground">ID: {getStudentId(student)}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${
                          isPendingPayment ? 'text-orange-600 border-orange-200' :
                          isPaymentRejected ? 'text-red-600 border-red-200' :
                          'text-orange-600 border-orange-200'
                        }`}>
                          {isPendingPayment ? (
                            <><CreditCard className="h-3 w-3 mr-1" />Pending Payment</>
                          ) : isPaymentRejected ? (
                            <>Payment Rejected</>
                          ) : (
                            isSubjectStudent ? subjectStudent!.verificationStatus : 'Pending'
                          )}
                        </Badge>
                        {isFreeCard && (
                          <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">
                            <Gift className="h-3 w-3 mr-1" />Free Card
                          </Badge>
                        )}
                        {effectiveStudentType === 'paid' && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                            Paid
                          </Badge>
                        )}
                        {effectiveStudentType === 'half_paid' && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                            Half Paid
                          </Badge>
                        )}
                        {effectiveStudentType === 'quarter_paid' && (
                          <Badge variant="outline" className="text-xs text-sky-600 border-sky-200">
                            Quarter Paid
                          </Badge>
                        )}
                        {hasEnrollmentPayment && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => fetchPaymentDetails(studentKey, hasEnrollmentPayment)}
                            disabled={loadingPaymentFor === studentKey}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {loadingPaymentFor === studentKey ? 'Loading...' : 'View Payment'}
                          </Button>
                        )}
                      </div>
                      {/* Show rejection reason */}
                      {isPaymentRejected && subjectStudent?.rejectionReason && (
                        <p className="text-xs text-red-500 mt-1">Reason: {subjectStudent.rejectionReason}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => handleVerifyStudent(studentKey, true)} disabled={verifyingIds.has(studentKey)} style={{ backgroundColor: '#28A158', color: 'white' }} className="h-8 px-3">
                        <UserCheck className="h-3.5 w-3.5 mr-1" />Approve
                      </Button>
                      <Button size="sm" onClick={() => handleVerifyStudent(studentKey, false)} disabled={verifyingIds.has(studentKey)} style={{ backgroundColor: '#CF0F0F', color: 'white' }} className="h-8 px-3">
                        <UserX className="h-3.5 w-3.5 mr-1" />Reject
                      </Button>
                    </div>
                  </div>

                  {/* Payment Details Section (shown when loaded) */}
                  {studentPaymentSubs && studentPaymentSubs.length > 0 && (
                    <div className="px-4 pb-4 border-t border-border pt-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                        <CreditCard className="h-3 w-3" /> Payment Submissions
                      </p>
                      {studentPaymentSubs.map((sub: any) => (
                        <div key={sub.id} className="bg-muted/50 rounded-md p-3 mb-2 text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="font-medium">Amount: Rs. {parseFloat(sub.submittedAmount || sub.submitted_amount || 0).toLocaleString()}</span>
                            <Badge variant="outline" className={`text-[10px] ${
                              sub.status === 'VERIFIED' ? 'text-green-600 border-green-300' :
                              sub.status === 'REJECTED' ? 'text-red-600 border-red-300' :
                              'text-amber-600 border-amber-300'
                            }`}>
                              {sub.status}
                            </Badge>
                          </div>
                          {sub.transactionId && <p>Transaction: {sub.transactionId}</p>}
                          {sub.notes && <p className="text-muted-foreground">{sub.notes}</p>}
                          {sub.receiptUrl && (
                            <a
                              href={getImageUrl(sub.receiptUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" /> View Receipt
                            </a>
                          )}
                          {sub.paymentDate && <p className="text-muted-foreground">Paid: {new Date(sub.paymentDate).toLocaleDateString()}</p>}
                          {sub.rejectionReason && <p className="text-red-500">Rejected: {sub.rejectionReason}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {studentPaymentSubs && studentPaymentSubs.length === 0 && (
                    <div className="px-4 pb-3 border-t border-border pt-2">
                      <p className="text-xs text-muted-foreground italic">No payment submissions yet.</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
          )
        ) : (
          <Paper sx={{ width: '100%', overflow: 'hidden', height: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column' }}>
          <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
            <Table stickyHeader aria-label="unverified students table" sx={{ tableLayout: 'fixed', minWidth: uvVisDefs.reduce((s, c) => s + getUVWidth(c.key), 0) }}>
              <TableHead>
                <TableRow>
                  {uvVisDefs.map(col => (
                    <TableCell
                      key={col.key}
                      onMouseEnter={() => setUVHoveredCol(col.key)}
                      onMouseLeave={() => setUVHoveredCol(null)}
                      style={{ position: 'relative', width: getUVWidth(col.key), minWidth: getUVWidth(col.key), userSelect: 'none' }}
                      sx={{ fontWeight: 'bold', backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', borderBottom: '1px solid hsl(var(--border))', whiteSpace: 'nowrap' }}
                    >
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 12 }}>{col.header}</div>
                      <UVResizeHandle colId={col.key} />
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {students.map((student) => {
                    const userData = getStudentUser(student);
                    const studentKey = getStudentKey(student);
                    const isNewStudent = 'enrollmentDate' in student;
                    const isSubjectStudent = 'studentFirstName' in student;
                    
                    return (
                      <TableRow hover role="checkbox" tabIndex={-1} key={studentKey}>
                        {/* Avatar - clickable */}
                        {uvVisDefs.some(c => c.key === 'avatar') && (
                        <TableCell style={{ width: getUVWidth('avatar'), maxWidth: getUVWidth('avatar'), overflow: 'hidden' }}>
                          <div 
                            className="cursor-pointer"
                            onClick={() => {
                              const imgUrl = userData.imageUrl;
                              if (imgUrl) {
                                setPreviewImage({ 
                                  url: getImageUrl(imgUrl), 
                                  name: `${userData.firstName} ${userData.lastName}` 
                                });
                              }
                            }}
                          >
                            <Avatar className="h-10 w-10 hover:ring-2 hover:ring-primary transition-all">
                              <AvatarImage src={getImageUrl(userData.imageUrl)} alt={userData.firstName} />
                              <AvatarFallback>
                                {userData.firstName[0]}{userData.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        </TableCell>
                        )}
                        {uvVisDefs.some(c => c.key === 'name') && (
                        <TableCell style={{ width: getUVWidth('name'), maxWidth: getUVWidth('name'), overflow: 'hidden' }}>
                          <div>
                            <div className="font-medium">{userData.firstName} {userData.lastName}</div>
                            <div className="text-sm text-muted-foreground">ID: {getStudentId(student)}</div>
                          </div>
                        </TableCell>
                        )}
                        {uvVisDefs.some(c => c.key === 'joinDate') && (
                        <TableCell style={{ width: getUVWidth('joinDate'), maxWidth: getUVWidth('joinDate'), overflow: 'hidden' }}>
                          {isNewStudent ? (
                            <div className="text-sm">{formatDate((student as NewUnverifiedStudent).enrollmentDate)}</div>
                          ) : isSubjectStudent && (student as SubjectUnverifiedStudent).enrolledAt ? (
                            <div className="text-sm">{formatDate((student as SubjectUnverifiedStudent).enrolledAt)}</div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        )}
                        {uvVisDefs.some(c => c.key === 'enrollment') && (
                        <TableCell style={{ width: getUVWidth('enrollment'), maxWidth: getUVWidth('enrollment'), overflow: 'hidden' }}>
                          {isNewStudent ? (
                            getEnrollmentMethodBadge((student as NewUnverifiedStudent).enrollmentMethod)
                          ) : isSubjectStudent ? (
                            getEnrollmentMethodBadge((student as SubjectUnverifiedStudent).enrollmentMethod)
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        )}
                        {uvVisDefs.some(c => c.key === 'status') && (
                        <TableCell style={{ width: getUVWidth('status'), maxWidth: getUVWidth('status'), overflow: 'hidden' }}>
                          {isNewStudent ? (
                            <Badge variant={(student as NewUnverifiedStudent).isActive ? 'default' : 'secondary'}>
                              {(student as NewUnverifiedStudent).isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          ) : 'isActive' in student ? (
                            <Badge variant={(student as UnverifiedStudent).isActive ? 'default' : 'secondary'}>
                              {(student as UnverifiedStudent).isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        )}
                        {uvVisDefs.some(c => c.key === 'verification') && (
                        <TableCell style={{ width: getUVWidth('verification'), maxWidth: getUVWidth('verification'), overflow: 'hidden' }}>
                          <div>
                            <Badge variant="outline" className={`${
                              isSubjectStudent && (student as SubjectUnverifiedStudent).verificationStatus === 'pending_payment'
                                ? 'text-orange-600 border-orange-200'
                                : isSubjectStudent && (student as SubjectUnverifiedStudent).verificationStatus === 'payment_rejected'
                                ? 'text-red-600 border-red-200'
                                : 'text-orange-600 border-orange-200'
                            }`}>
                              {isSubjectStudent ? (student as SubjectUnverifiedStudent).verificationStatus : 'Pending Verification'}
                            </Badge>
                            {isSubjectStudent && (student as SubjectUnverifiedStudent).studentType === 'free_card' && (
                              <Badge variant="outline" className="text-purple-600 border-purple-200 ml-1">
                                <Gift className="h-3 w-3 mr-0.5" />Free Card
                              </Badge>
                            )}
                            {isSubjectStudent && (student as SubjectUnverifiedStudent).studentType === 'half_paid' && (
                              <Badge variant="outline" className="text-amber-600 border-amber-200 ml-1">
                                Half Paid
                              </Badge>
                            )}
                            {isSubjectStudent && (student as SubjectUnverifiedStudent).studentType === 'quarter_paid' && (
                              <Badge variant="outline" className="text-sky-600 border-sky-200 ml-1">
                                Quarter Paid
                              </Badge>
                            )}
                            {isSubjectStudent && (student as SubjectUnverifiedStudent).rejectionReason && (
                              <p className="text-[10px] text-red-500 mt-0.5 max-w-[150px] truncate">
                                {(student as SubjectUnverifiedStudent).rejectionReason}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        )}
                        {uvVisDefs.some(c => c.key === 'payment') && (
                        <TableCell style={{ width: getUVWidth('payment'), maxWidth: getUVWidth('payment'), overflow: 'hidden' }}>
                          {isSubjectStudent && (student as SubjectUnverifiedStudent).enrollmentPaymentId ? (
                            <div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => fetchPaymentDetails(studentKey, (student as SubjectUnverifiedStudent).enrollmentPaymentId!)}
                                disabled={loadingPaymentFor === studentKey}
                              >
                                <CreditCard className="h-3 w-3 mr-1" />
                                {loadingPaymentFor === studentKey ? '...' : 'View'}
                              </Button>
                              {paymentDetails[studentKey] && paymentDetails[studentKey].length > 0 && (
                                <div className="mt-1 space-y-1">
                                  {paymentDetails[studentKey].map((sub: any) => (
                                    <div key={sub.id} className="text-[10px] bg-muted/50 rounded p-1">
                                      <span className="font-medium">Rs. {parseFloat(sub.submittedAmount || sub.submitted_amount || 0).toLocaleString()}</span>
                                      {' - '}
                                      <Badge variant="outline" className={`text-[9px] py-0 px-1 ${
                                        sub.status === 'VERIFIED' ? 'text-green-600' :
                                        sub.status === 'REJECTED' ? 'text-red-600' : 'text-amber-600'
                                      }`}>
                                        {sub.status}
                                      </Badge>
                                      {sub.receiptUrl && (
                                        <a href={getImageUrl(sub.receiptUrl)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                                          <Eye className="h-3 w-3 inline" />
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {paymentDetails[studentKey] && paymentDetails[studentKey].length === 0 && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 italic">No submissions</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        )}
                        {uvVisDefs.some(c => c.key === 'actions') && (
                        <TableCell style={{ width: getUVWidth('actions'), maxWidth: getUVWidth('actions'), overflow: 'hidden' }}>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleVerifyStudent(studentKey, true)}
                              disabled={verifyingIds.has(studentKey)}
                              style={{ backgroundColor: '#28A158', color: 'white' }}
                              className="hover:opacity-90"
                            >
                              <UserCheck className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleVerifyStudent(studentKey, false)}
                              disabled={verifyingIds.has(studentKey)}
                              style={{ backgroundColor: '#CF0F0F', color: 'white' }}
                              className="hover:opacity-90"
                            >
                              <UserX className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                {students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={uvVisDefs.length} align="center">
                      <div className="text-center py-8 text-muted-foreground">
                        No unverified students found
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={rowsPerPageOptions}
            component="div"
            count={totalCount}
            rowsPerPage={limit}
            page={currentPage}
            onPageChange={(event: unknown, newPage: number) => {
              fetchUnverifiedStudents(newPage);
            }}
            onRowsPerPageChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const newLimit = parseInt(event.target.value, 10);
              setLimit(newLimit);
              setCurrentPage(0);
              fetchUnverifiedStudents(0);
            }}
          />
        </Paper>
          )
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            {loading ? <RefreshCw className="h-7 w-7 animate-spin opacity-40" /> : <Users className="h-7 w-7 opacity-40" />}
          </div>
          <p className="text-sm">{loading ? 'Loading students...' : 'No unverified students found.'}</p>
        </div>
      )}

      {/* Avatar Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{previewImage?.name}</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {previewImage && (
              <img 
                src={previewImage.url} 
                alt={previewImage.name}
                className="w-full h-auto max-h-[60vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UnverifiedStudents;
