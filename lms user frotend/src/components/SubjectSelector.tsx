import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataCardView } from '@/components/ui/data-card-view';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import type { SubjectVerificationStatus } from '@/contexts/types/auth.types';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { BookOpen, Clock, CheckCircle, RefreshCw, User, School, ChevronLeft, ChevronRight, LogIn, Loader2, XCircle, CreditCard, Gift, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getBaseUrl } from '@/contexts/utils/auth.api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { instituteApi } from '@/api/institute.api';
import { useApiRequest } from '@/hooks/useApiRequest';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ChildCurrentSelection from '@/components/ChildCurrentSelection';
import { enrollmentApi } from '@/api/enrollment.api';
import { buildSidebarUrl } from '@/utils/pageNavigation';

interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string;
  category?: string;
  creditHours?: number;
  isActive?: boolean;
  subjectType?: string;
  basketCategory?: string;
  instituteType?: string;
  imgUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}
interface StudentSubjectData {
  instituteId: string;
  classId: string;
  subjectId: string;
  subject: Subject;
}
interface ClassSubjectData {
  instituteId: string;
  classId: string;
  subjectId: string;
  teacherId?: string;
  subject: Subject;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
interface SubjectCardData {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  creditHours: number;
  isActive: boolean;
  subjectType: string;
  basketCategory: string;
  instituteType: string;
  imgUrl?: string;
  createdAt: string;
  updatedAt: string;
  enrollmentStatus?: 'VERIFIED' | 'PENDING' | 'NONE';
}
const SubjectSelector = () => {
  const {
    user,
    selectedInstitute,
    selectedClass,
    setSelectedSubject,
    currentInstituteId,
    currentClassId,
    isViewingAsParent,
    selectedChild
  } = useAuth();
  const navigate = useNavigate();
  const instituteRole = useInstituteRole();
  const { navigateToPage } = useAppNavigation();
  const {
    toast
  } = useToast();
  const [subjectsData, setSubjectsData] = useState<SubjectCardData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [enrollmentLoaded, setEnrollmentLoaded] = useState(false);
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

  // Enrollment state
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollSubject, setEnrollSubject] = useState<SubjectCardData | null>(null);
  const [enrollmentKey, setEnrollmentKey] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [pendingSubjects, setPendingSubjects] = useState<Set<string>>(new Set());
  const [enrolledSubjects, setEnrolledSubjects] = useState<Set<string>>(new Set());
  const [rejectedSubjects, setRejectedSubjects] = useState<Set<string>>(new Set());
  const [pendingPaymentSubjects, setPendingPaymentSubjects] = useState<Set<string>>(new Set());
  const [paymentRejectedSubjects, setPaymentRejectedSubjects] = useState<Set<string>>(new Set());
  const [subjectPaymentIds, setSubjectPaymentIds] = useState<Record<string, string>>({});
  const [subjectFeeAmounts, setSubjectFeeAmounts] = useState<Record<string, number>>({});

  // Payment redirect state (no longer uses a dialog — goes to class-payments page)
  const [paymentSubject, setPaymentSubject] = useState<SubjectCardData | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Sidebar collapse awareness for grid columns
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    typeof document !== 'undefined' && document.documentElement.classList.contains('sidebar-collapsed')
  );
  useEffect(() => {
    const handler = () => setSidebarCollapsed(document.documentElement.classList.contains('sidebar-collapsed'));
    window.addEventListener('sidebar:state', handler as any);
    return () => window.removeEventListener('sidebar:state', handler as any);
  }, []);

  const fetchSubjectsByRole = async (page: number = 1, limit: number = 10, forceRefresh = false) => {
    setIsLoading(true);
    console.log('Loading subjects data for role:', instituteRole);
    try {
      let endpoint: string;
      const params = { page: page.toString(), limit: limit.toString() };

      // Determine endpoint based on role
      if (instituteRole === 'InstituteAdmin' || instituteRole === 'AttendanceMarker') {
        if (!currentInstituteId || !currentClassId) {
          throw new Error('Missing required parameters for institute admin/attendance marker subject fetch');
        }
        endpoint = `/institutes/${currentInstituteId}/classes/${currentClassId}/subjects`;
      } else if (instituteRole === 'Teacher') {
        // Teacher uses the same class subjects endpoint as admin
        if (!currentInstituteId || !currentClassId) {
          throw new Error('Missing required parameters for teacher subject fetch');
        }
        endpoint = `/institutes/${currentInstituteId}/classes/${currentClassId}/subjects`;
      } else if (instituteRole === 'Student') {
        // Student uses the same class subjects endpoint
        if (!currentInstituteId || !currentClassId) {
          throw new Error('Missing required parameters for student subject fetch');
        }
        endpoint = `/institutes/${currentInstituteId}/classes/${currentClassId}/subjects`;
      } else {
        // For other roles, use the original subjects endpoint
        endpoint = '/subjects';
      }

      console.log('Fetching from endpoint:', endpoint);
      
      // Use enhanced cached client
      const result = await enhancedCachedClient.get(
        endpoint,
        params,
        {
          ttl: CACHE_TTL.SUBJECTS * 5, // 5x longer cache to enforce local caching
          forceRefresh,
          useStaleWhileRevalidate: forceRefresh, // Only revalidate in background if forcing a refresh
          userId: user?.id,
          role: instituteRole,
          instituteId: currentInstituteId,
          classId: currentClassId
        }
      );

      console.log('Raw API response:', result);
      let subjects: SubjectCardData[] = [];
      if (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher' || instituteRole === 'AttendanceMarker' || instituteRole === 'Student') {
        // Handle the new API response format for Institute Admin and Teacher
        if (Array.isArray(result)) {
          // Direct array response
          subjects = result.map((item: any) => ({
            id: item.subject.id,
            name: item.subject.name,
            code: item.subject.code,
            description: item.subject.description || '',
            category: item.subject.category || '',
            creditHours: item.subject.creditHours || 0,
            isActive: item.subject.isActive,
            subjectType: item.subject.subjectType || '',
            basketCategory: item.subject.basketCategory || '',
            instituteType: item.subject.instituteType || '',
            imgUrl: item.subject.imgUrl,
            createdAt: item.subject.createdAt,
            updatedAt: item.subject.updatedAt
          }));
        } else if (result.data && Array.isArray(result.data)) {
          subjects = result.data.map((item: any) => ({
            id: item.subject.id,
            name: item.subject.name,
            code: item.subject.code,
            description: item.subject.description || '',
            category: item.subject.category || '',
            creditHours: item.subject.creditHours || 0,
            isActive: item.subject.isActive,
            subjectType: item.subject.subjectType || '',
            basketCategory: item.subject.basketCategory || '',
            instituteType: item.subject.instituteType || '',
            imgUrl: item.subject.imgUrl,
            createdAt: item.subject.createdAt,
            updatedAt: item.subject.updatedAt
          }));
        }

        // Deduplicate and ensure stable ordering
        const uniqueSubjects = Array.from(new Map(subjects.map((s) => [s.id, s])).values());
        uniqueSubjects.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        // Use server pagination if provided, otherwise slice client-side
        const hasServerPagination = Boolean(result && (result.total || result.totalPages || result.page || result.limit));
        let totalSubjects = uniqueSubjects.length;
        let totalPagesFromApi = Math.max(1, Math.ceil(totalSubjects / limit));
        let displaySubjects = uniqueSubjects;

        if (hasServerPagination && result.data && Array.isArray(result.data)) {
          totalSubjects = result.total || uniqueSubjects.length;
          totalPagesFromApi = result.totalPages || Math.max(1, Math.ceil(totalSubjects / limit));
          // displaySubjects already corresponds to current page from server
          displaySubjects = uniqueSubjects;
        } else {
          const startIndex = (Math.max(1, page) - 1) * limit;
          const endIndex = startIndex + limit;
          displaySubjects = uniqueSubjects.slice(startIndex, endIndex);
        }

        setSubjectsData(displaySubjects);
        setTotalItems(totalSubjects);
        setTotalPages(totalPagesFromApi);
        setCurrentPage(result.page || page);

        // For students, fetch their enrolled subjects to determine enrollment status
        if (instituteRole === 'Student') {
          setEnrollmentLoaded(false);
          try {
            const studentUserId = isViewingAsParent && selectedChild ? selectedChild.id : user.id;
            const enrolledResult = await enhancedCachedClient.get(
              `/institute-class-subject-students/${currentInstituteId}/student-subjects/class/${currentClassId}/student/${studentUserId}`,
              { page: '1', limit: '100' },
              { 
                ttl: CACHE_TTL.SUBJECTS * 5, // 5x longer cache to enforce local caching
                forceRefresh, 
                useStaleWhileRevalidate: forceRefresh, // Only revalidate in background if forcing a refresh
                userId: user?.id, 
                role: instituteRole, 
                instituteId: currentInstituteId, 
                classId: currentClassId 
              }
            );
            const enrolledData = enrolledResult?.data || (Array.isArray(enrolledResult) ? enrolledResult : []);
            console.log('[SubjectSelector] raw enrollment response:', enrolledResult);
            console.log('[SubjectSelector] enrollment items:', enrolledData);
            const verifiedIds = new Set<string>();
            const pendingIds = new Set<string>();
            const rejectedIds = new Set<string>();
            const pendingPaymentIds = new Set<string>();
            const paymentRejectedIds = new Set<string>();
            const paymentIdMap: Record<string, string> = {};
            const feeAmountMap: Record<string, number> = {};
            enrolledData.forEach((item: any) => {
              const subId = String(item.subjectId ?? item.subject_id ?? item.subject?.id ?? '');
              if (!subId) return;
              // verificationStatus from API is lowercase: "verified" | "pending" | "rejected" | "pending_payment" | "payment_rejected" | "enrolled_free_card"
              const vs = (item.verificationStatus ?? item.verification_status ?? item.status ?? '').toString().toLowerCase();
              // isVerified boolean fallback for older API responses
              const isVerifiedBool = item.isVerified === true || item.isVerified === 1 || item.isVerified === '1'
                || item.ics_is_verified === true || item.is_verified === true || item.verified === true;
              const isRejectedBool = item.isRejected === true;
              console.log(`[SubjectSelector] item subId=${subId} vs="${vs}" isVerifiedBool=${isVerifiedBool} enrollmentMethod=${item.enrollmentMethod}`);
              
              // Store payment info if available
              if (item.enrollmentPaymentId || item.enrollment_payment_id) {
                paymentIdMap[subId] = String(item.enrollmentPaymentId ?? item.enrollment_payment_id);
              }
              if (item.feeAmount || item.fee_amount || item.enrollmentFeeAmount) {
                feeAmountMap[subId] = Number(item.feeAmount ?? item.fee_amount ?? item.enrollmentFeeAmount);
              }
              
              if (vs === 'pending_payment') {
                pendingPaymentIds.add(subId);
              } else if (vs === 'payment_rejected') {
                paymentRejectedIds.add(subId);
              } else if (vs === 'rejected' || isRejectedBool) {
                rejectedIds.add(subId);
              } else if (vs === 'verified' || vs === 'enrolled_free_card' || isVerifiedBool || item.enrollmentMethod === 'teacher_assigned') {
                // verified or enrolled_free_card: explicit status, or isVerified=true, or teacher-assigned (always auto-verified)
                verifiedIds.add(subId);
              } else if (vs === 'pending') {
                pendingIds.add(subId);
              } else {
                // verificationStatus missing entirely — treat as verified (they are enrolled, just old data)
                verifiedIds.add(subId);
              }
            });
            console.log('[SubjectSelector] verifiedIds:', [...verifiedIds], 'pendingIds:', [...pendingIds], 'rejectedIds:', [...rejectedIds], 'pendingPayment:', [...pendingPaymentIds], 'paymentRejected:', [...paymentRejectedIds]);
            setEnrolledSubjects(verifiedIds);
            setPendingSubjects(pendingIds);
            setRejectedSubjects(rejectedIds);
            setPendingPaymentSubjects(pendingPaymentIds);
            setPaymentRejectedSubjects(paymentRejectedIds);
            setSubjectPaymentIds(paymentIdMap);
            setSubjectFeeAmounts(feeAmountMap);
          } catch (enrollErr) {
            console.error('Failed to fetch student enrollment status:', enrollErr);
          } finally {
            setEnrollmentLoaded(true);
          }
        } else {
          setEnrollmentLoaded(true);
        }
      } else {
        // Handle the original response for other roles
        if (Array.isArray(result)) {
          subjects = result;
        } else if (result.data && Array.isArray(result.data)) {
          subjects = result.data;
        }

        // Apply pagination for other roles
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedSubjects = subjects.slice(startIndex, endIndex);
        const totalSubjects = subjects.length;
        const totalPages = Math.ceil(totalSubjects / limit);
        setSubjectsData(paginatedSubjects);
        setTotalItems(totalSubjects);
        setTotalPages(totalPages);
        setCurrentPage(page);
      }
      setDataLoaded(true);
      toast({
        title: "Subjects Loaded",
        description: `Successfully loaded ${subjects.length} subjects.`
      });
    } catch (error: any) {
      console.error('Failed to load subjects:', error);
      toast({
        title: "Load Failed",
        description: error instanceof Error ? error.message : "Failed to load subjects data.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load subjects when class changes (uses cache if available)
  useEffect(() => {
    if (currentInstituteId && selectedClass?.id) {
      console.log('Auto-loading subjects for class:', selectedClass.id);
      setDataLoaded(false);
      fetchSubjectsByRole(1, pageSize);
    }
  }, [currentInstituteId, selectedClass?.id]);

  const handleSelectSubject = (subject: SubjectCardData, verificationStatus?: SubjectVerificationStatus) => {
    console.log('Selecting subject:', subject, 'verificationStatus:', verificationStatus);
    setSelectedSubject({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      description: subject.description,
      category: subject.category,
      creditHours: subject.creditHours,
      isActive: subject.isActive,
      subjectType: subject.subjectType,
      basketCategory: subject.basketCategory,
      instituteType: subject.instituteType,
      imgUrl: subject.imgUrl,
      verificationStatus: verificationStatus ?? 'verified',
    });
    
    toast({
      title: "Subject Selected",
      description: `Selected ${subject.name} (${subject.code})`
    });
    
    // When parent is viewing child's data, navigate to child's dashboard
    if (isViewingAsParent && selectedChild) {
      console.log('Parent viewing child - navigating to child dashboard');
      // replace:true removes /select-subject from the back stack.
      navigate(`/child/${selectedChild.id}/dashboard`, { replace: true });
      return;
    }
    
    // Auto-navigate to dashboard after selection.
    // replace:true removes /select-subject from history so back returns to the page the
    // user was on BEFORE the entire select-institute → select-class → select-subject flow.
    // IMPORTANT: navigate directly using IDs to avoid stale selection state causing URL to miss /subject/:id.
    const instituteId = currentInstituteId || selectedInstitute?.id;
    const classId = currentClassId || selectedClass?.id;

    if (instituteId && classId) {
      navigate(`/institute/${instituteId}/class/${classId}/subject/${subject.id}/dashboard`, { replace: true });
    } else {
      navigateToPage('dashboard');
    }
  };
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      console.log('Changing page from', currentPage, 'to', newPage);
      fetchSubjectsByRole(newPage, pageSize);
    }
  };
  const handlePageSizeChange = (newPageSize: number) => {
    console.log('Changing page size from', pageSize, 'to', newPageSize);
    setPageSize(newPageSize);
    fetchSubjectsByRole(1, newPageSize);
  };
  const handleEnrollClick = (subject: SubjectCardData) => {
    setEnrollSubject(subject);
    setEnrollmentKey('');
    setEnrollDialogOpen(true);
  };

  const handleEnrollSubmit = async () => {
    if (!enrollSubject || !currentInstituteId || !currentClassId) return;
    setIsEnrolling(true);
    try {
      const enrollPayload: Record<string, any> = {
        instituteId: currentInstituteId,
        classId: currentClassId,
        subjectId: enrollSubject.id,
        enrollmentKey
      };
      // Parent enrolling on behalf of child — pass child's ID
      if (isViewingAsParent && selectedChild) {
        enrollPayload.targetStudentId = selectedChild.id;
      }
      const result = await enhancedCachedClient.post('/institute-class-subject-students/self-enroll', enrollPayload);
      
      const verificationStatus = result.verificationStatus || '';
      
      if (verificationStatus === 'pending_payment' && result.paymentRequired) {
        // Payment required — redirect to class-payments page for class-level payment submission
        setPendingPaymentSubjects(prev => new Set(prev).add(enrollSubject.id));
        if (result.enrollmentPaymentId) {
          setSubjectPaymentIds(prev => ({ ...prev, [enrollSubject.id]: result.enrollmentPaymentId }));
        }
        if (result.feeAmount) {
          setSubjectFeeAmounts(prev => ({ ...prev, [enrollSubject.id]: result.feeAmount }));
        }
        setEnrollDialogOpen(false);
        toast({
          title: 'Enrollment Submitted — Payment Required',
          description: `Please submit your class payment slip to complete enrollment.`,
        });
        // Navigate to class-payments page
        const url = buildSidebarUrl('class-payments', { instituteId: currentInstituteId, classId: currentClassId });
        navigate(url);
      } else {
        setPendingSubjects(prev => new Set(prev).add(enrollSubject.id));
        setEnrollDialogOpen(false);
        toast({
          title: "Enrollment Submitted",
          description: result.message || "Awaiting verification by teacher or admin."
        });
      }
      
      // CRITICAL: Immediately refetch subjects to update enrollment status
      fetchSubjectsByRole(currentPage, pageSize, true);
    } catch (error: any) {
      console.error('Enrollment error:', error);
      toast({
        title: "Enrollment Failed",
        description: error.message || "Failed to enroll in subject",
        variant: "destructive"
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  const handlePayNowClick = (subject: SubjectCardData) => {
    // Navigate to class-payments page so the student can submit their class-level payment slip
    const url = buildSidebarUrl('class-payments', {
      instituteId: currentInstituteId,
      classId: currentClassId,
    });
    navigate(url);
  };

  const handleClaimFreeCard = async (subject: SubjectCardData) => {
    if (!currentInstituteId || !currentClassId) return;
    setFreeCardClaimingFor(subject.id);
    try {
      await enrollmentApi.claimFreeCard(currentInstituteId, currentClassId, subject.id, {
        userId: isViewingAsParent && selectedChild ? selectedChild.id : user?.id,
        targetStudentId: isViewingAsParent && selectedChild ? selectedChild.id : undefined
      });
      // Free card students are auto-enrolled (enrolled_free_card) — move to enrolled subjects
      setPendingPaymentSubjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(subject.id);
        return newSet;
      });
      setEnrolledSubjects(prev => new Set(prev).add(subject.id));
      toast({
        title: "Free Card Enrolled",
        description: "You are enrolled as a free card student. No payment required."
      });
      fetchSubjectsByRole(currentPage, pageSize, true);
    } catch (error: any) {
      toast({
        title: "Claim Failed",
        description: error.message || "Failed to claim free card status",
        variant: "destructive"
      });
    } finally {
      setFreeCardClaimingFor(null);
    }
  };

  if (!user) {
    return <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Please log in to view subjects.</p>
      </div>;
  }
  if (!currentInstituteId) {
    return <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Please select an institute first.</p>
      </div>;
  }
  if ((['Student','InstituteAdmin','Teacher','AttendanceMarker'].includes(instituteRole)) && !currentClassId) {
    return <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Please select a class first.</p>
      </div>;
  }
  const isTuitionInstitute = selectedInstitute?.type === 'tuition_institute';
  // useInstituteLabels doesn't provide subject-related labels, so we use defaults
  const subjectLabel = 'Subject';
  const subjectLabelPlural = 'Subjects';

  return <div className="space-y-2 sm:space-y-4 p-1 sm:p-2 md:p-0">
      {/* Show Current Child Selection for Parent flow */}
      {isViewingAsParent && <ChildCurrentSelection className="mb-3" />}
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1.5 sm:gap-2 mb-2 sm:mb-4">
        <div className="flex-1">
          <h1 className="text-sm sm:text-base md:text-lg font-semibold text-foreground mb-0.5">
            Select {subjectLabelPlural}
          </h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            Choose a {subjectLabel.toLowerCase()} to manage lectures and attendance
          </p>
          {selectedInstitute && <p className="text-[9px] sm:text-[10px] text-primary mt-0.5">
              Institute: {selectedInstitute.name}
            </p>}
          {selectedClass && <p className="text-[9px] sm:text-[10px] text-green-600 dark:text-green-400 mt-0.5">
              Class: {selectedClass.name}
            </p>}
        </div>
        <Button onClick={() => fetchSubjectsByRole(currentPage, pageSize, true)} disabled={isLoading} variant="outline" size="sm" className="w-full sm:w-auto h-6 sm:h-7 text-[10px] sm:text-xs px-2">
          {isLoading ? <>
              <RefreshCw className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 animate-spin" />
              <span className="hidden sm:inline">Loading...</span>
            </> : <>
              <RefreshCw className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
              <span className="hidden sm:inline">Refresh</span>
            </>}
        </Button>
      </div>

      {subjectsData.length === 0 && !isLoading ? <div className="text-center py-10">
          <p className="text-muted-foreground">
            No subjects found for this class
          </p>
        </div> : <div className="flex flex-col min-h-[calc(100vh-180px)]">
          {/* Unified Card View - Same size on all devices */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${sidebarCollapsed ? 'lg:grid-cols-4 md:grid-cols-3' : 'lg:grid-cols-3 md:grid-cols-2'} gap-x-3 gap-y-8 sm:gap-x-4 sm:gap-y-10 pt-3 md:pt-6 mb-8`}>
            {subjectsData.map(subject => {
              const showMore = expandedSubjectId === subject.id;
              
              return (
                <div 
                  key={subject.id} 
                  className="relative flex w-full flex-col rounded-lg bg-card bg-clip-border text-card-foreground shadow-sm hover:shadow-md transition-all duration-300 border-2 border-primary/30 hover:border-primary/60"
                >
                  {/* Subject Image - Gradient Header */}
                  <div className="relative mx-3 -mt-5 h-28 overflow-hidden rounded-lg bg-clip-border text-white shadow-md shadow-primary/30 bg-gradient-to-r from-primary to-primary/80">
                    {subject.imgUrl ? (
                      <img 
                        src={getImageUrl(subject.imgUrl)} 
                        alt={subject.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-primary to-primary/80">
                        <BookOpen className="w-8 h-8 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    {/* Subject Name */}
                    <h5 className="mb-1.5 block font-sans text-sm font-semibold leading-snug tracking-normal text-foreground antialiased line-clamp-2">
                      {subject.name}
                    </h5>

                    {/* Subject Code and Category */}
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <Badge variant={subject.category === 'Core' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {subject.category}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {subject.code}
                      </Badge>
                    </div>

                    {/* Description */}
                    <p className="block font-sans text-xs font-light leading-relaxed text-muted-foreground antialiased line-clamp-2">
                      {subject.description || 'No description available'}
                    </p>

                    {/* Additional Info - Shown when Read More is clicked */}
                    {showMore && (
                      <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300 space-y-1.5 border-t border-border pt-2">
                        {subject.creditHours > 0 && (
                          <div className="text-xs">
                            <span className="font-semibold text-foreground">Credits:</span>
                            <span className="text-muted-foreground ml-1.5">{subject.creditHours}</span>
                          </div>
                        )}
                        {subject.subjectType && (
                          <div className="text-xs">
                            <span className="font-semibold text-foreground">Type:</span>
                            <span className="text-muted-foreground ml-1.5">{subject.subjectType}</span>
                          </div>
                        )}
                        {subject.basketCategory && (
                          <div className="text-xs">
                            <span className="font-semibold text-foreground">Basket:</span>
                            <span className="text-muted-foreground ml-1.5">{subject.basketCategory}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="p-4 pt-0 space-y-2">
                    <button
                      onClick={() => setExpandedSubjectId(showMore ? null : subject.id)}
                      className="w-full select-none rounded-md bg-muted py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-foreground shadow-sm transition-all hover:shadow active:opacity-90"
                    >
                      {showMore ? 'Show Less' : 'Read More'}
                    </button>
                    
                    {/* Select Subject button - for students, only enabled if enrolled & verified */}
                    {instituteRole === 'Student' ? (
                      !enrollmentLoaded ? (
                        <div className="w-full flex justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : enrolledSubjects.has(String(subject.id)) ? (
                        <button 
                          onClick={() => handleSelectSubject(subject, 'verified')}
                          className="w-full select-none rounded-md bg-primary py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/30 active:opacity-90"
                        >
                          Select {subjectLabel}
                        </button>
                      ) : pendingPaymentSubjects.has(String(subject.id)) ? (
                        <div className="w-full space-y-1.5">
                          <div className="w-full text-center py-1">
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              <CreditCard className="h-3 w-3 mr-1" />
                              Payment Required
                            </Badge>
                            {subjectFeeAmounts[subject.id] && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Rs. {subjectFeeAmounts[subject.id]?.toLocaleString()}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handlePayNowClick(subject)}
                            className="w-full select-none rounded-md bg-green-600 py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-white shadow-sm transition-all hover:bg-green-700 active:opacity-90"
                          >
                            <CreditCard className="h-3 w-3 inline mr-1" />
                            Pay Now
                          </button>
                          <button
                            onClick={() => handleClaimFreeCard(subject)}
                            disabled={freeCardClaimingFor === subject.id}
                            className="w-full select-none rounded-md border border-purple-400 py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-purple-600 shadow-sm transition-all hover:bg-purple-50 dark:hover:bg-purple-950/20 active:opacity-90 disabled:opacity-50"
                          >
                            {freeCardClaimingFor === subject.id ? (
                              <><Loader2 className="h-3 w-3 inline mr-1 animate-spin" />Claiming...</>
                            ) : (
                              <><Gift className="h-3 w-3 inline mr-1" />I am a Free Card Student</>
                            )}
                          </button>
                          <button
                            onClick={() => handleSelectSubject(subject, 'pending_payment')}
                            className="w-full select-none rounded-md border border-blue-400 py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-blue-600 shadow-sm transition-all hover:bg-blue-50 dark:hover:bg-blue-950/20 active:opacity-90"
                          >
                            <Eye className="h-3 w-3 inline mr-1" />
                            View Free Recordings & Pay
                          </button>
                        </div>
                      ) : paymentRejectedSubjects.has(String(subject.id)) ? (
                        <div className="w-full space-y-1.5">
                          <div className="w-full text-center py-1">
                            <Badge variant="outline" className="text-red-600 border-red-300">
                              <XCircle className="h-3 w-3 mr-1" />
                              Payment Rejected
                            </Badge>
                          </div>
                          <button
                            onClick={() => handlePayNowClick(subject)}
                            className="w-full select-none rounded-md bg-orange-600 py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-white shadow-sm transition-all hover:bg-orange-700 active:opacity-90"
                          >
                            <CreditCard className="h-3 w-3 inline mr-1" />
                            Resubmit Payment
                          </button>
                          <button
                            onClick={() => handleSelectSubject(subject, 'payment_rejected')}
                            className="w-full select-none rounded-md border border-blue-400 py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-blue-600 shadow-sm transition-all hover:bg-blue-50 dark:hover:bg-blue-950/20 active:opacity-90"
                          >
                            <Eye className="h-3 w-3 inline mr-1" />
                            View Free Recordings & Pay
                          </button>
                        </div>
                      ) : pendingSubjects.has(String(subject.id)) ? (
                        <div className="w-full space-y-1.5">
                          <div className="w-full text-center py-1">
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending Verification
                            </Badge>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Payment submitted - awaiting admin approval</p>
                          </div>
                          <button
                            onClick={() => handleSelectSubject(subject, 'pending')}
                            className="w-full select-none rounded-md border border-blue-400 py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-blue-600 shadow-sm transition-all hover:bg-blue-50 dark:hover:bg-blue-950/20 active:opacity-90"
                          >
                            <Eye className="h-3 w-3 inline mr-1" />
                            View Free Recordings & Status
                          </button>
                        </div>
                      ) : rejectedSubjects.has(String(subject.id)) ? (
                        <div className="w-full space-y-1.5">
                          <div className="w-full text-center py-1">
                            <Badge variant="outline" className="text-red-600 border-red-300">
                              <XCircle className="h-3 w-3 mr-1" />
                              Enrollment Rejected
                            </Badge>
                          </div>
                          <button
                            onClick={() => handleEnrollClick(subject)}
                            className="w-full select-none rounded-md border border-red-400 py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-red-600 shadow-sm transition-all hover:bg-red-50 dark:hover:bg-red-950/20 active:opacity-90"
                          >
                            <LogIn className="h-3 w-3 inline mr-1" />
                            Enroll Again
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEnrollClick(subject)}
                          className="w-full select-none rounded-md border border-primary py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-primary shadow-sm transition-all hover:bg-primary/10 active:opacity-90"
                        >
                          <LogIn className="h-3 w-3 inline mr-1" />
                          Enroll
                        </button>
                      )
                    ) : (
                      <button 
                        onClick={() => handleSelectSubject(subject, 'verified')}
                        className="w-full select-none rounded-md bg-primary py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/30 active:opacity-90"
                      >
                        Select {subjectLabel}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {dataLoaded && totalPages > 0 && (
            <div className="mt-auto bg-background border-t border-border py-2 sm:py-3 px-2 sm:px-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2">
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {totalItems} {subjectLabelPlural.toLowerCase()} total
                </span>
                
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)} 
                    disabled={currentPage <= 1 || isLoading}
                    className="h-6 sm:h-7 text-[10px] sm:text-xs px-1.5 sm:px-2"
                  >
                    <ChevronLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5" />
                    Prev
                  </Button>
                  
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                    {currentPage} / {totalPages}
                  </span>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)} 
                    disabled={currentPage >= totalPages || isLoading}
                    className="h-6 sm:h-7 text-[10px] sm:text-xs px-1.5 sm:px-2"
                  >
                    Next
                    <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 ml-0.5" />
                  </Button>
                </div>

                <Select value={pageSize.toString()} onValueChange={value => handlePageSizeChange(parseInt(value, 10))}>
                  <SelectTrigger className="w-[80px] sm:w-[100px] h-6 sm:h-7 text-[10px] sm:text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="50">50 / page</SelectItem>
                    <SelectItem value="100">100 / page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>}

      {/* Enrollment Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll in {enrollSubject?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="enrollmentKey">Enrollment Key</Label>
              <Input
                id="enrollmentKey"
                placeholder="Enter enrollment key"
                value={enrollmentKey}
                onChange={(e) => setEnrollmentKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the enrollment key provided by your teacher or admin.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollDialogOpen(false)} disabled={isEnrolling}>
              Cancel
            </Button>
            <Button onClick={handleEnrollSubmit} disabled={isEnrolling || !enrollmentKey.trim()}>
              {isEnrolling ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Enrolling...
                </>
              ) : (
                'Enroll'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
};
export default SubjectSelector;