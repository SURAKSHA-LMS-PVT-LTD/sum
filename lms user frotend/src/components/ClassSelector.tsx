import React, { useState, useEffect } from 'react';
import { useForceRefresh } from '@/hooks/useForceRefresh';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { DataCardView } from '@/components/ui/data-card-view';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { School, Users, BookOpen, Clock, RefreshCw, User, Search, Filter, Image, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { getBaseUrl } from '@/contexts/utils/auth.api';
import { Input } from '@/components/ui/input';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cachedApiClient } from '@/api/cachedClient';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { instituteClassesApi, type EnrollClassData } from '@/api/instituteClasses.api';
import ChildCurrentSelection from '@/components/ChildCurrentSelection';

const enrollFormSchema = z.object({
  classId: z.string().min(1, 'Class is required'),
  enrollmentCode: z.string().min(1, 'Enrollment code is required')
});

interface EnrollableClass {
  id: string;
  name: string;
  code?: string;
  grade?: number;
}

const resolveImageUrl = (val?: string) => {
  if (!val) return '';
  if (val.startsWith('http')) return val;
  const base = getBaseUrl();
  return `${base}${val.startsWith('/') ? '' : '/'}${val}`;
};
interface ClassData {
  id: string;
  name: string;
  code: string;
  grade?: number;
  level?: number;
  capacity?: number;
  enrollmentCode?: string;
  academicYear?: string;
  specialty?: string;
  classType?: string;
  description?: string;
  classTeacherId?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  instituteId?: string;
  imageUrl?: string;
  _count?: {
    students: number;
    subjects: number;
  };
}
interface StudentClassData {
  instituteId: string;
  classId: string;
  isActive: boolean;
  isVerified: boolean;
  enrolledAt: string;
  class: {
    id: string;
    name: string;
    code: string;
    grade: number;
    specialty: string;
    academicYear: string;
    classType: string;
    imageUrl?: string;
  };
}
interface StudentEnrolledClassData {
  ics_institute_id: string;
  ics_institute_class_id: string;
  ics_student_user_id: string;
  ics_is_active: number;
  ics_is_verified: number;
  ics_enrollment_method: string;
  ics_verified_by: string | null;
  ics_verified_at: string | null;
  enrolledAt: string;
  className: string;
  classDescription: string;
  classCode: string;
  grade: number;
  teacher_id: string;
  specialty: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  instituteName: string;
  instituteCode: string;
}
interface TeacherClassSubjectData {
  instituteId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  subject: {
    id: string;
    name: string;
    code: string;
  };
  class: {
    id: string;
    name: string;
    code: string;
    classTeacherId?: string;
  };
  isActive: boolean;
  schedule?: any;
  notes?: any;
  createdAt: string;
  updatedAt: string;
}
interface ClassCardData {
  id: string;
  name: string;
  code: string;
  description: string;
  capacity: number;
  studentCount: number;
  subjectCount: number;
  academicYear: string;
  specialty: string;
  classType: string;
  isActive: boolean;
  imageUrl?: string;
  isVerified?: boolean; // For student enrolled classes - true means verified, false means pending
  enrollmentStatus?: 'VERIFIED' | 'PENDING' | 'REJECTED'; // Explicit enrollment status for students
}
const ClassSelector = () => {
  const {
    user,
    selectedInstitute,
    setSelectedClass,
    currentInstituteId,
    isViewingAsParent,
    selectedChild
  } = useAuth();
  const navigate = useNavigate();
  const { triggerForceRefresh } = useForceRefresh();
  const {
    toast
  } = useToast();
  const effectiveRole = useInstituteRole();
  const { navigateToPage } = useAppNavigation();
  const [classesData, setClassesData] = useState<ClassCardData[]>([]);
  const [filteredClasses, setFilteredClasses] = useState<ClassCardData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollableClasses, setEnrollableClasses] = useState<EnrollableClass[]>([]);
  const [loadingEnrollableClasses, setLoadingEnrollableClasses] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const enrollForm = useForm<z.infer<typeof enrollFormSchema>>({
    resolver: zodResolver(enrollFormSchema) as any,
    defaultValues: {
      classId: '',
      enrollmentCode: ''
    }
  });

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
    const handler = () => {
      setSidebarCollapsed(document.documentElement.classList.contains('sidebar-collapsed'))
    };
    window.addEventListener('sidebar:state', handler as any);
    return () => window.removeEventListener('sidebar:state', handler as any);
  }, []);

  // Load enrollable classes when dialog opens
  useEffect(() => {
    if (enrollDialogOpen && currentInstituteId) {
      setLoadingEnrollableClasses(true);
      instituteClassesApi.getByInstitute(currentInstituteId, { limit: 500 })
        .then(res => {
          setEnrollableClasses(res.map(c => ({ id: c.id, name: c.name, code: c.code, grade: c.grade })));
        })
        .catch(err => {
          console.error('Failed to load enrollable classes:', err);
          setEnrollableClasses([]);
        })
        .finally(() => setLoadingEnrollableClasses(false));
    }
  }, [enrollDialogOpen, currentInstituteId]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');
  const [classTypeFilter, setClassTypeFilter] = useState<string>('all');
  const [academicYearFilter, setAcademicYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const fetchClassesByRole = async (page: number = 1, limit: number = 10, forceRefresh = false) => {
    if (!currentInstituteId) return;
    setIsLoading(true);
    console.log('Loading classes data for institute role:', effectiveRole, {
      page,
      limit,
      forceRefresh,
      dataLoaded,
      isViewingAsParent
    });
    try {
      let endpoint = '';
      let params: Record<string, any> = {};
      if (effectiveRole === 'Student') {
        // CRITICAL: When parent views as child, use the CHILD's ID, not the parent's
        const studentUserId = isViewingAsParent && selectedChild ? selectedChild.id : user?.id;
        endpoint = `/institute-classes/${currentInstituteId}/student/${studentUserId}`;
        params = {
          page: page,
          limit: limit
        };
      } else if (effectiveRole === 'Teacher') {
        endpoint = `/institute-classes/${currentInstituteId}/teacher/${user?.id}`;
        params = {
          page,
          limit
        };
      } else if (effectiveRole === 'InstituteAdmin' || effectiveRole === 'AttendanceMarker') {
        endpoint = `/institute-classes/institute/${currentInstituteId}`;
        params = {
          page,
          limit
        };
      } else {
        throw new Error('Unsupported user role for class selection');
      }
      console.log(`Making API call for ${endpoint}:`, params);

      // Use cached API client which will handle caching and proper base URL
      const result = await cachedApiClient.get(endpoint, params, {
        forceRefresh,
        ttl: 60 // Cache for 1 hour
      });
      console.log('Raw API response:', result);
      processClassesData(result, effectiveRole, page);
    } catch (error: any) {
      console.error('Failed to load classes:', error);

      // Fallback: try alternative endpoint for admin users (not for students)
      if ((effectiveRole === 'InstituteAdmin' || effectiveRole === 'AttendanceMarker') && !forceRefresh) {
        try {
          console.log('Trying alternative endpoint...');
          const fallbackEndpoint = '/classes';
          const fallbackParams = {
            instituteId: currentInstituteId,
            page,
            limit
          };
          const fallbackResult = await cachedApiClient.get(fallbackEndpoint, fallbackParams, {
            forceRefresh,
            ttl: 60
          });
          console.log('Fallback API response:', fallbackResult);
          processClassesData(fallbackResult, effectiveRole, page);
          return;
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        }
      }
      toast({
        title: "Load Failed",
        description: "Failed to load classes data.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  const processClassesData = (result: any, userRole: UserRole, page: number) => {
    // eslint-disable-next-line no-useless-assignment
    let classesArray: ClassData[] = [];
    let pagination = {
      total: 0,
      totalPages: 1
    };

    // Extract pagination info if available
    if (result.meta) {
      pagination.total = result.meta.total || 0;
      pagination.totalPages = result.meta.totalPages || 1;
    }
    if (userRole === 'Student') {
      // Handle new student classes response
      let studentClasses: StudentClassData[] = [];
      if (Array.isArray(result)) {
        studentClasses = result;
        pagination.total = result.length;
        pagination.totalPages = 1;
      } else if (result.data && Array.isArray(result.data)) {
        studentClasses = result.data;
        // Handle new pagination structure from API response
        pagination.total = result.total || result.data.length;
        pagination.totalPages = result.totalPages || Math.ceil(pagination.total / (result.limit || 10));
      }
      classesArray = studentClasses.map((item: StudentClassData): ClassData & { isVerified?: boolean; enrollmentStatus?: string } => {
        const raw = item as any;
        let enrollmentStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
        if (raw.status === 'REJECTED' || raw.enrollmentStatus === 'REJECTED') {
          enrollmentStatus = 'REJECTED';
        } else if (item.isVerified === false && raw.isActive === false) {
          enrollmentStatus = 'REJECTED';
        } else if (item.isVerified) {
          enrollmentStatus = 'VERIFIED';
        } else {
          enrollmentStatus = 'PENDING';
        }
        return {
          id: item.class.id,
          name: item.class.name,
          code: item.class.code,
          description: `${item.class.name} - ${item.class.specialty}`,
          specialty: item.class.specialty,
          classType: item.class.classType,
          academicYear: item.class.academicYear,
          isActive: item.isActive,
          capacity: 0,
          grade: item.class.grade,
          instituteId: item.instituteId,
          imageUrl: item.class.imageUrl,
          isVerified: item.isVerified,
          enrollmentStatus,
          _count: { students: 0, subjects: 0 },
        };
      });
    } else if (userRole === 'Teacher') {
      // Handle new teacher classes response with proper pagination
      let teacherClassAssignments: any[] = [];
      if (Array.isArray(result)) {
        teacherClassAssignments = result;
        pagination.total = result.length;
        pagination.totalPages = 1;
      } else if (result.data && Array.isArray(result.data)) {
        teacherClassAssignments = result.data;
        // Use the new response structure pagination
        pagination.total = result.total || result.data.length;
        pagination.totalPages = result.totalPages || Math.ceil(pagination.total / (result.limit || 10));
      }

      // Remove duplicates by class ID - keep the first occurrence
      const uniqueClasses = new Map();
      teacherClassAssignments.forEach((item: any) => {
        if (!uniqueClasses.has(item.class.id)) {
          uniqueClasses.set(item.class.id, item);
        }
      });
      classesArray = Array.from(uniqueClasses.values()).map((item: any): ClassData => ({
        id: item.class.id,
        name: item.class.name,
        code: item.class.code,
        description: `${item.class.name} - ${item.class.specialty} (${item.teacherRole})`,
        specialty: item.class.specialty,
        classType: item.class.classType,
        academicYear: item.class.academicYear,
        isActive: item.isActive,
        capacity: 0,
        // Not provided in teacher response
        grade: item.class.grade,
        instituteId: item.instituteId,
        imageUrl: item.class.imageUrl,
        _count: {
          students: 0,
          // Not provided in teacher response
          subjects: 0 // Not provided in teacher response
        }
      }));
    } else {
      if (Array.isArray(result)) {
        classesArray = result;
        pagination.total = result.length;
        // Fallback: compute totalPages based on current pageSize when API doesn't provide it
        pagination.totalPages = Math.ceil((pagination.total || 0) / (pageSize || 10)) || 1;
      } else if (result.data && Array.isArray(result.data)) {
        classesArray = result.data;
        // Prefer API-provided totals, otherwise compute using current pageSize
        const totalFromMeta = result.meta?.total ?? result.total ?? result.data.length;
        const totalPagesFromMeta = result.meta?.totalPages ?? result.totalPages;
        pagination.total = totalFromMeta;
        pagination.totalPages = totalPagesFromMeta || Math.ceil((totalFromMeta || 0) / (pageSize || 10)) || 1;
      } else {
        console.warn('Unexpected response structure:', result);
        classesArray = [];
      }
    }

    // Remove duplicates and ensure stable ordering
    const uniqueClasses = Array.from(new Map(classesArray.map(c => [c.id, c])).values());
    const sortedClasses = uniqueClasses.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // If API didn't provide pagination meta, do client-side pagination to respect pageSize
    const hasServerPagination = Boolean(result && (result.meta?.total || result.total || result.totalPages));
    let displayClasses = sortedClasses;
    if (!hasServerPagination) {
      const total = sortedClasses.length;
      const totalPagesComputed = Math.max(1, Math.ceil(total / (pageSize || 10)));
      const startIndex = (Math.max(1, page) - 1) * (pageSize || 10);
      const endIndex = startIndex + (pageSize || 10);
      displayClasses = sortedClasses.slice(startIndex, endIndex);
      pagination.total = total;
      pagination.totalPages = totalPagesComputed;
    }
    const transformedClasses = displayClasses.map((classItem: ClassData): ClassCardData => ({
      id: classItem.id,
      name: classItem.name,
      code: classItem.code,
      description: classItem.description || `${classItem.name} - ${classItem.specialty || classItem.classType || 'General'}`,
      capacity: classItem.capacity || 0,
      studentCount: (classItem as any)._count?.students || 0,
      subjectCount: (classItem as any)._count?.subjects || 0,
      academicYear: classItem.academicYear || 'N/A',
      specialty: classItem.specialty || classItem.classType || 'General',
      classType: classItem.classType || 'Regular',
      isActive: (classItem as any).isActive !== false,
      imageUrl: resolveImageUrl((classItem as any).imageUrl || (classItem as any).image || (classItem as any).logo || (classItem as any).coverImageUrl),
      isVerified: (classItem as any).isVerified,
      enrollmentStatus: (classItem as any).enrollmentStatus as 'VERIFIED' | 'PENDING' | 'REJECTED' | undefined,
    }));
    console.log('Transformed classes:', transformedClasses);
    setClassesData(transformedClasses);
    setFilteredClasses(transformedClasses);
    setTotalItems(pagination.total);
    setTotalPages(pagination.totalPages);
    setCurrentPage(page);
    setDataLoaded(true);
    toast({
      title: "Classes Loaded",
      description: `Successfully loaded ${transformedClasses.length} classes.`
    });
  };
  useEffect(() => {
    let filtered = classesData;
    if (searchTerm) {
      filtered = filtered.filter(classItem => (classItem.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (classItem.code || '').toLowerCase().includes(searchTerm.toLowerCase()) || (classItem.description || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (gradeFilter !== 'all') {
      filtered = filtered.filter(classItem => (classItem.name || '').toLowerCase().includes(`grade ${gradeFilter}`) || (classItem.description || '').toLowerCase().includes(`grade ${gradeFilter}`));
    }
    if (specialtyFilter !== 'all') {
      filtered = filtered.filter(classItem => (classItem.specialty || '').toLowerCase().includes(specialtyFilter.toLowerCase()));
    }
    if (classTypeFilter !== 'all') {
      filtered = filtered.filter(classItem => (classItem.classType || '').toLowerCase().includes(classTypeFilter.toLowerCase()));
    }
    if (academicYearFilter !== 'all') {
      filtered = filtered.filter(classItem => classItem.academicYear === academicYearFilter);
    }
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter(classItem => classItem.isActive === isActive);
    }
    setFilteredClasses(filtered);
  }, [classesData, searchTerm, gradeFilter, specialtyFilter, classTypeFilter, academicYearFilter, statusFilter]);

  // Auto-load classes when institute changes (uses cache if available)
  useEffect(() => {
    if (currentInstituteId && !dataLoaded) {
      console.log('Auto-loading classes from cache for institute:', currentInstituteId);
      fetchClassesByRole(1, pageSize, false);
    }
  }, [currentInstituteId]);

  const handleSelectClass = (classData: ClassCardData) => {
    console.log('Selecting class - no additional API calls will be made:', classData);

    // Only update the selected class state
    setSelectedClass({
      id: classData.id,
      name: classData.name,
      code: classData.code,
      description: classData.description,
      grade: 0,
      specialty: classData.specialty || 'General'
    });

    // When parent is viewing child's data, navigate to child's subject selection.
    // replace:true removes /select-class from the back stack — same reason as select-institute.
    if (isViewingAsParent && selectedChild) {
      console.log('Parent viewing child - navigating to child subject selection');
      navigate(`/child/${selectedChild.id}/select-subject`, { replace: true });
      return;
    }

    const shouldNavigateToSubject =
      effectiveRole === 'AttendanceMarker' ||
      effectiveRole === 'Teacher' ||
      effectiveRole === 'InstituteAdmin' ||
      effectiveRole === 'Student';

    if (shouldNavigateToSubject) {
      console.log(`${effectiveRole} detected - auto-navigating to select subject`);
      // IMPORTANT: navigate directly using IDs to avoid using stale selection state
      // (stale state caused /institute/:id/select-subject or /select-subject and then auto-clearing).
      // replace:true removes /select-class from history — back returns to the page before the
      // entire selection flow, not to this class-selection screen.
      const instituteId = currentInstituteId || selectedInstitute?.id;
      if (instituteId) {
        navigate(`/institute/${instituteId}/class/${classData.id}/select-subject`, { replace: true });
      } else {
        navigate('/select-institute');
      }
    }

    // Explicitly log that no further API calls should happen
    console.log('Class selection complete - blocking any follow-up requests');
  };
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      console.log('Changing page from', currentPage, 'to', newPage);
      fetchClassesByRole(newPage, pageSize, false);
    }
  };
  const handlePageSizeChange = (newPageSize: number) => {
    console.log('Changing page size from', pageSize, 'to', newPageSize);
    setPageSize(newPageSize);
    fetchClassesByRole(1, newPageSize, false);
  };
  const handleEnrollSubmit = async (values: z.infer<typeof enrollFormSchema>) => {
    setIsEnrolling(true);
    try {
      const enrollData: EnrollClassData = {
        classId: values.classId,
        enrollmentCode: values.enrollmentCode
      };
      const result = await instituteClassesApi.enroll(enrollData);
      setEnrollDialogOpen(false);
      if (result.requiresVerification) {
        toast({
          title: "Enrollment Submitted",
          description: result.message || "Waiting for teacher verification."
        });
      } else {
        toast({
          title: "Successfully Enrolled",
          description: result.message || "You have been enrolled in the class!"
        });
      }
      enrollForm.reset();
      setEnrollableClasses([]);
      fetchClassesByRole(currentPage, pageSize, true);
    } catch (error: any) {
      console.error('Enrollment error:', error);
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('code') || errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('incorrect')) {
        toast({
          title: "Invalid Enrollment Code",
          description: "The enrollment code is invalid. Please try again.",
          variant: "destructive"
        });
      } else if (errorMessage.toLowerCase().includes('already enrolled')) {
        toast({
          title: "Already Enrolled",
          description: "You are already enrolled in this class.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Enrollment Success",
          description: "Please wait for verification."
        });
      }
    } finally {
      setIsEnrolling(false);
    }
  };
  const tableColumns = [{
    key: 'imageUrl',
    header: 'Image',
    render: (value: any, row: ClassCardData) => <Avatar className="h-12 w-12">
          <AvatarImage src={getImageUrl(value)} alt={row.name} className="object-cover" />
          <AvatarFallback className="bg-blue-100 text-blue-600">
            <Image className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
  }, {
    key: 'name',
    header: 'Class Name',
    render: (value: any, row: ClassCardData) => <div>
          <div className="font-medium">{value}</div>
          <div className="text-sm text-gray-500">{row.code}</div>
        </div>
  }, {
    key: 'specialty',
    header: 'Type',
    render: (value: any, row: ClassCardData) => <div className="text-sm">
          <div>{value}</div>
          <div className="text-gray-500">{row.classType}</div>
        </div>
  }, {
    key: 'academicYear',
    header: 'Academic Year',
    render: (value: any) => <span className="text-sm">{value}</span>
  }, {
    key: 'studentCount',
    header: 'Students',
    render: (value: any, row: ClassCardData) => `${value}/${row.capacity || 'N/A'}`
  }, {
    key: 'isActive',
    header: 'Status',
    render: (value: any) => <Badge variant={value ? 'default' : 'secondary'}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
  }];
  const customActions = [{
    label: 'Select',
    action: (classData: ClassCardData) => handleSelectClass(classData),
    icon: <School className="h-3 w-3" />,
    variant: 'default' as const
  }];
  const handleOpenEnrollDialog = () => {
    enrollForm.reset({
      classId: '',
      enrollmentCode: ''
    });
    setEnrollDialogOpen(true);
  };
  if (!user) {
    return <div className="text-center py-8 px-4">
        <p className="text-gray-600 dark:text-gray-400">Please log in to view classes.</p>
      </div>;
  }
  if (!currentInstituteId) {
    return <div className="text-center py-8 px-4">
        <p className="text-gray-600 dark:text-gray-400">Please select an institute first.</p>
      </div>;
  }
  const handleRefreshClick = () => {
    console.log('Manual refresh requested');
    triggerForceRefresh();
    fetchClassesByRole(currentPage, pageSize, true);
  };
  const handleLoadDataClick = () => {
    console.log('Manual load requested');
    fetchClassesByRole(1, pageSize, false);
  };
  return <div className="space-y-2 sm:space-y-3 p-1 sm:p-2 md:p-3">
      {/* Show Current Child Selection for Parent flow */}
      {isViewingAsParent && <ChildCurrentSelection className="mb-3" />}
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1.5 sm:gap-2 mb-2 sm:mb-4">
        <div className="flex-1">
          <h1 className="text-sm sm:text-base md:text-lg font-semibold text-foreground mb-0.5">
            Select Class
          </h1>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            Choose a class to manage lectures
          </p>
          {selectedInstitute && <p className="text-[9px] sm:text-[10px] text-primary mt-0.5">
              Institute: {selectedInstitute.name}
            </p>}
          {effectiveRole === 'Student' && <Button onClick={handleOpenEnrollDialog} variant="default" size="sm" className="mt-1.5 w-full sm:w-auto h-6 sm:h-7 text-[10px] sm:text-xs">
              <School className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
              Enroll
            </Button>}
        </div>
        <div className="flex gap-1 sm:gap-1.5 w-full sm:w-auto">
          <Button onClick={() => setShowFilters(!showFilters)} variant="outline" size="sm" className="flex-1 sm:flex-none h-6 sm:h-7 text-[10px] sm:text-xs px-1.5 sm:px-2">
            <Filter className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />
            <span className="hidden xs:inline">Filters</span>
          </Button>
          <Button onClick={handleRefreshClick} disabled={isLoading} variant="outline" size="sm" className="flex-1 sm:flex-none h-6 sm:h-7 text-[10px] sm:text-xs px-1.5 sm:px-2">
            {isLoading ? <>
                <RefreshCw className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 animate-spin" />
              </> : <>
                <RefreshCw className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5" />
                <span className="hidden sm:inline">Refresh</span>
              </>}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {dataLoaded && showFilters && <Card>
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
              <Filter className="h-4 w-4" />
              Filter Classes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              <div className="col-span-2 sm:col-span-1 space-y-1">
                <Label htmlFor="search" className="text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input id="search" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-8 text-xs" />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="grade" className="text-xs">Grade</Label>
                <Select value={gradeFilter} onValueChange={setGradeFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grades</SelectItem>
                    {Array.from({
                  length: 13
                }, (_, i) => i).map(grade => <SelectItem key={grade} value={grade.toString()}>
                        {grade === 0 ? 'KG' : `G${grade}`}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="specialty" className="text-xs">Specialty</Label>
                <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="science">Science</SelectItem>
                    <SelectItem value="commerce">Commerce</SelectItem>
                    <SelectItem value="arts">Arts</SelectItem>
                    <SelectItem value="mathematics">Maths</SelectItem>
                    <SelectItem value="technology">Tech</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="classType" className="text-xs">Type</Label>
                <Select value={classTypeFilter} onValueChange={setClassTypeFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="special">Special</SelectItem>
                    <SelectItem value="remedial">Remedial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="academicYear" className="text-xs">Year</Label>
                <Select value={academicYearFilter} onValueChange={setAcademicYearFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="status" className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredClasses.length} of {classesData.length} classes
              </p>
              <Button variant="outline" size="sm" onClick={() => {
            setSearchTerm('');
            setGradeFilter('all');
            setSpecialtyFilter('all');
            setClassTypeFilter('all');
            setAcademicYearFilter('all');
            setStatusFilter('all');
          }}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>}

      {filteredClasses.length === 0 && !isLoading ? <div className="text-center py-10">
          <p className="text-muted-foreground">
            {searchTerm || gradeFilter !== 'all' || specialtyFilter !== 'all' || classTypeFilter !== 'all' || academicYearFilter !== 'all' || statusFilter !== 'all' ? 'No classes match your current filters.' : 'No enrolled classes found.'}
          </p>
        </div> : <div className="flex flex-col min-h-[calc(100vh-180px)]">
          {/* Unified Card View - Same size on all devices */}
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 ${sidebarCollapsed ? 'lg:grid-cols-4 md:grid-cols-3' : 'lg:grid-cols-3 md:grid-cols-2'} gap-x-3 gap-y-8 sm:gap-x-4 sm:gap-y-10 pt-3 md:pt-6 mb-8`}
          >
            {filteredClasses.map(classItem => (
              <div key={classItem.id} className="relative flex w-full flex-col rounded-lg bg-card bg-clip-border text-card-foreground shadow-sm hover:shadow-md transition-all duration-300 border-2 border-primary/30 hover:border-primary/60">
                {/* Enrollment Status Banner for Students */}
                {effectiveRole === 'Student' && classItem.isVerified === false && (
                  classItem.enrollmentStatus === 'REJECTED' ? (
                    <div className="absolute top-0 left-0 right-0 z-10 bg-red-500/90 text-white text-[10px] font-medium py-0.5 px-2 rounded-t-lg text-center">
                      ❌ Enrollment Rejected
                    </div>
                  ) : (
                    <div className="absolute top-0 left-0 right-0 z-10 bg-amber-500/90 text-white text-[10px] font-medium py-0.5 px-2 rounded-t-lg text-center">
                      ⏳ Pending Verification
                    </div>
                  )
                )}
                
                {/* Class Image - Gradient Header */}
                <div className={`relative mx-3 ${effectiveRole === 'Student' && classItem.isVerified === false ? 'mt-2' : '-mt-5'} h-28 overflow-hidden rounded-lg bg-clip-border text-white shadow-md shadow-primary/30 bg-gradient-to-r from-primary to-primary/80`}>
                  {classItem.imageUrl ? (
                    <img 
                      src={getImageUrl(classItem.imageUrl)} 
                      alt={classItem.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-primary to-primary/80">
                      <School className="w-8 h-8 text-white" />
                    </div>
                  )}
                </div>

                <div className="p-4">
                  {/* Class Name */}
                  <h5 className="mb-1.5 block font-sans text-sm font-semibold leading-snug tracking-normal text-foreground antialiased line-clamp-2">
                    {classItem.name}
                  </h5>
                  
                  {/* Info badges */}
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {classItem.specialty}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {classItem.academicYear}
                    </Badge>
                  </div>

                  {/* Description */}
                  <p className="block font-sans text-xs font-light leading-relaxed text-muted-foreground antialiased line-clamp-2">
                    {classItem.description || `${classItem.classType} class`}
                  </p>

                  {/* Additional Details - Shown when Read More is clicked */}
                  {expandedIds[classItem.id] && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300 space-y-1.5 border-t border-border pt-2">
                      <div className="text-xs">
                        <span className="font-semibold text-foreground">Code:</span>
                        <span className="text-muted-foreground ml-1.5">{classItem.code}</span>
                      </div>
                      <div className="text-xs">
                        <span className="font-semibold text-foreground">Type:</span>
                        <span className="text-muted-foreground ml-1.5">{classItem.classType}</span>
                      </div>
                      <div className="text-xs">
                        <span className="font-semibold text-foreground">Capacity:</span>
                        <span className="text-muted-foreground ml-1.5">{classItem.capacity || 'N/A'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="p-4 pt-0 space-y-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedIds(prev => ({
                        ...prev,
                        [classItem.id]: !prev[classItem.id]
                      }));
                    }}
                    className="w-full select-none rounded-md bg-muted py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-foreground shadow-sm transition-all hover:shadow active:opacity-90"
                  >
                    {expandedIds[classItem.id] ? 'Show Less' : 'Read More'}
                  </button>
                  
                  {/* Show Select button only for verified classes (or non-student roles) */}
                  {classItem.isVerified === false ? (
                    classItem.enrollmentStatus === 'REJECTED' ? (
                      <div className="w-full select-none rounded-md bg-red-100 dark:bg-red-900/30 py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700">
                        <XCircle className="h-3 w-3 inline-block mr-1" />
                        Rejected
                      </div>
                    ) : (
                      <div className="w-full select-none rounded-md bg-amber-100 dark:bg-amber-900/30 py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                        <Clock className="h-3 w-3 inline-block mr-1" />
                        Pending
                      </div>
                    )
                  ) : (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectClass(classItem);
                      }}
                      className="w-full select-none rounded-md bg-primary py-2 px-4 text-center align-middle font-sans text-[10px] font-semibold uppercase text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/30 active:opacity-90"
                    >
                      Select Class
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination - Always at bottom */}
          <div className="mt-auto bg-background border-t border-border py-2 sm:py-3 px-2 sm:px-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2">
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                {totalItems} classes total
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
        </div>}

      {/* Enrollment Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll in Class</DialogTitle>
            <DialogDescription>
              Enter the class ID and enrollment code to join a class.
            </DialogDescription>
          </DialogHeader>

          <Form {...enrollForm}>
            <form onSubmit={enrollForm.handleSubmit(handleEnrollSubmit)} className="space-y-4">
              <FormField control={enrollForm.control} name="classId" render={({
              field
            }) => <FormItem>
                    <FormLabel>Class</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange} disabled={loadingEnrollableClasses}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder={loadingEnrollableClasses ? "Loading classes..." : "Select a class to enroll"} />
                        </SelectTrigger>
                        <SelectContent>
                          {enrollableClasses.length === 0 ? (
                            <SelectItem value="_empty" disabled className="text-xs text-muted-foreground">
                              {loadingEnrollableClasses ? "Loading..." : "No classes available"}
                            </SelectItem>
                          ) : (
                            enrollableClasses.map(cls => (
                              <SelectItem key={cls.id} value={cls.id} className="text-sm">
                                {cls.name} {cls.code ? `(${cls.code})` : ''} {cls.grade ? `• Grade ${cls.grade}` : ''}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />

              <FormField control={enrollForm.control} name="enrollmentCode" render={({
              field
            }) => <FormItem>
                    <FormLabel>Enrollment Code</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter enrollment code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setEnrollDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isEnrolling}>
                  {isEnrolling ? 'Enrolling...' : 'Enroll'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>;
};
export default ClassSelector;