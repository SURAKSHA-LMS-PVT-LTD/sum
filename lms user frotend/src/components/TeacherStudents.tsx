import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RefreshCw, Users, Mail, Phone, Search, Filter, UserPlus, Gift, CreditCard, User, ChevronDown, BadgePercent, CircleDollarSign, Pencil, Eye, X, PlusCircle } from 'lucide-react';
import EnrollByPaymentDialog from '@/components/forms/EnrollByPaymentDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useToast } from '@/hooks/use-toast';
import { DataCardView } from '@/components/ui/data-card-view';
import DataTable from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';
import AssignStudentsDialog from '@/components/forms/AssignStudentsDialog';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { enrollmentApi, type ClassEnrollmentSummaryItem } from '@/api/enrollment.api';
import { CACHE_TTL } from '@/config/cacheTTL';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { instituteApi } from '@/api/institute.api';
import { getErrorMessage } from '@/api/apiError';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';
import { useInstituteUserColumns } from '@/hooks/useInstituteUserColumns';

interface ClassSubjectStudent {
  id: string;
  name: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  phoneNumber?: string;
  imageUrl?: string;
  dateOfBirth?: string;
  userIdByInstitute?: string | null;
  fatherId?: string;
  motherId?: string;
  guardianId?: string;
  extraData?: Record<string, any> | null;
  nameWithInitials?: string;
}

interface ClassSubjectStudentsResponse {
  data: ClassSubjectStudent[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const TeacherStudents = () => {
  const { user, selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const effectiveRole = useInstituteRole();
  const { toast } = useToast();
  const { columns: extraColumns } = useInstituteUserColumns(selectedInstitute?.id || '');
  
  const [students, setStudents] = useState<ClassSubjectStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showEnrollByPaymentDialog, setShowEnrollByPaymentDialog] = useState(false);
  
  // Student type tracking
  const [studentTypeMap, setStudentTypeMap] = useState<Record<string, 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid'>>({});
  const [updatingTypeFor, setUpdatingTypeFor] = useState<string | null>(null);

  // Class-level enrollment summary (for subject breakdown)
  const [classSummary, setClassSummary] = useState<ClassEnrollmentSummaryItem[]>([]);

  // Give Free Card / Update Type dialog (class level)
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [typeDialogSearch, setTypeDialogSearch] = useState('');
  const [typeDialogStudentId, setTypeDialogStudentId] = useState('');
  const [typeDialogType, setTypeDialogType] = useState<'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid'>('free_card');
  const [typeDialogLoading, setTypeDialogLoading] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [studentTypeFilter, setStudentTypeFilter] = useState<'all' | 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid'>('all');
  const [imagePreview, setImagePreview] = useState<{ isOpen: boolean; url: string; title: string }>({
    isOpen: false,
    url: '',
    title: ''
  });
  const [editExtraDataDialog, setEditExtraDataDialog] = useState<{ open: boolean; student: ClassSubjectStudent | null }>({ open: false, student: null });
  const [extraDataRows, setExtraDataRows] = useState<{ key: string; value: string }[]>([]);
  const [savingExtraData, setSavingExtraData] = useState(false);

  const canManageType = ['InstituteAdmin', 'Teacher'].includes(effectiveRole || '');

  // Role check
  if (!effectiveRole || !['InstituteAdmin', 'Teacher', 'AttendanceMarker'].includes(effectiveRole)) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">
          Access denied. This section is only available for teachers and institute admins.
        </p>
      </div>
    );
  }


  const fetchClassStudents = async (forceRefresh = false) => {
    if (!selectedInstitute?.id || !selectedClass?.id) return;

    setLoading(true);
    try {
      // Single call: class enrollment summary has student info + per-subject studentType
      const summary = await enrollmentApi.getClassEnrollmentSummary(
        selectedInstitute.id,
        selectedClass.id,
        'all',
        { userId: user?.id, role: effectiveRole, instituteId: selectedInstitute.id, classId: selectedClass.id }
      );

      setClassSummary(summary);

      // Build student list and type map from summary (deduplicate by studentId)
      const typeMap: Record<string, 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid'> = {};
      const seenClassIds = new Set<string>();
      const studentList: ClassSubjectStudent[] = [];
      for (const s of summary) {
        if (seenClassIds.has(s.studentId)) continue;
        seenClassIds.add(s.studentId);
        // Dominant type: free_card > paid > half_paid > quarter_paid > normal
        const dominantType: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid' =
          s.hasFreeCard ? 'free_card' :
          s.subjects.some(sub => sub.studentType === 'paid') ? 'paid' :
          s.subjects.some(sub => sub.studentType === 'half_paid') ? 'half_paid' :
          s.subjects.some(sub => sub.studentType === 'quarter_paid') ? 'quarter_paid' : 'normal';
        typeMap[s.studentId] = dominantType;
        studentList.push({
          id: s.studentId,
          name: s.name,
          email: s.email,
          imageUrl: s.imageUrl || undefined,
        });
      }

      setStudents(studentList);
      setStudentTypeMap(typeMap);
      setDataLoaded(true);

      toast({
        title: "Class Students Loaded",
        description: `Successfully loaded ${studentList.length} students.`
      });
    } catch (error: any) {
      console.error('Error fetching class students:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error, 'Failed to load class students'),
        variant: "destructive"
      });

    } finally {
      setLoading(false);
    }
  };

  const fetchSubjectStudents = async (forceRefresh = false) => {
    if (!selectedInstitute?.id || !selectedClass?.id || !selectedSubject?.id) {
      return;
    }

    setLoading(true);
    try {
      // Single optimized call: fetch enrollment data which includes student info + studentType
      const enrollments = await enhancedCachedClient.get(
        `/institute-class-subject-students/class-subject/${selectedInstitute.id}/${selectedClass.id}/${selectedSubject.id}`,
        {},
        {
          ttl: CACHE_TTL.STUDENTS,
          forceRefresh,
          userId: user?.id,
          role: effectiveRole,
          instituteId: selectedInstitute.id,
          classId: selectedClass.id,
          subjectId: selectedSubject.id
        }
      );
      const enrollList = Array.isArray(enrollments) ? enrollments : (enrollments?.data || []);

      // Map enrollment data to student list format and build studentType map simultaneously
      const typeMap: Record<string, 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid'> = {};
      const seenIds = new Set<string>();
      const studentList: ClassSubjectStudent[] = [];
      for (const e of enrollList) {
        const sid = String(e.studentId ?? e.student_id ?? '');
        if (!sid || seenIds.has(sid)) continue; // Deduplicate
        seenIds.add(sid);
        const student = e.student || {};
        typeMap[sid] = (e.studentType ?? e.student_type ?? 'normal') as 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid';
        studentList.push({
          id: sid,
          name: [student.firstName, student.lastName].filter(Boolean).join(' ') || `Student ${sid}`,
          email: student.email || undefined,
          phoneNumber: student.phoneNumber || undefined,
          imageUrl: student.imageUrl || undefined,
          nameWithInitials: student.nameWithInitials || undefined,
          userIdByInstitute: student.userIdByInstitute || null,
        });
      }

      setStudents(studentList);
      setStudentTypeMap(typeMap);
      setDataLoaded(true);
      
      toast({
        title: "Subject Students Loaded",
        description: `Successfully loaded ${studentList.length} students.`
      });
    } catch (error: any) {
      console.error('Error fetching subject students:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error, 'Failed to load subject students'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-load data when context changes (uses cache if available)
  useEffect(() => {
    if (selectedInstitute && selectedClass) {
      if (selectedSubject) {
        // Load subject students automatically from cache
        fetchSubjectStudents(false);
      } else {
        // Load class students automatically from cache
        fetchClassStudents(false);
      }
    }
  }, [selectedInstitute?.id, selectedClass?.id, selectedSubject?.id]);

  const handleStudentTypeChange = async (studentId: string, newType: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid') => {
    if (!selectedInstitute?.id || !selectedClass?.id || !selectedSubject?.id) return;
    setUpdatingTypeFor(studentId);
    try {
      await enrollmentApi.updateStudentType(
        selectedInstitute.id, selectedClass.id, selectedSubject.id,
        studentId, newType,
        { userId: user?.id, role: effectiveRole }
      );
      setStudentTypeMap(prev => ({ ...prev, [studentId]: newType }));
      toast({
        title: "Student Type Updated",
        description: `Changed to ${newType === 'free_card' ? 'Free Card' : newType === 'half_paid' ? 'Half Paid' : newType === 'quarter_paid' ? 'Quarter Paid' : newType === 'paid' ? 'Paid' : 'Normal'}`
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: getErrorMessage(error, 'Failed to update student type'),
        variant: "destructive"
      });
    } finally {
      setUpdatingTypeFor(null);
    }
  };

  // Dialog filtered students for Give Free Card (class-level)
  const dialogFilteredStudents = useMemo(() => {
    if (!typeDialogSearch.trim()) return classSummary.slice(0, 20);
    const q = typeDialogSearch.toLowerCase();
    return classSummary.filter(s =>
      s.name.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.studentId.includes(q)
    ).slice(0, 20);
  }, [classSummary, typeDialogSearch]);

  const handleClassTypeDialogSubmit = async () => {
    if (!selectedInstitute?.id || !selectedClass?.id || !typeDialogStudentId) return;
    setTypeDialogLoading(true);
    try {
      await enrollmentApi.updateClassStudentType(
        selectedInstitute.id, selectedClass.id, typeDialogStudentId, typeDialogType,
        { userId: user?.id, role: effectiveRole }
      );
      setStudentTypeMap(prev => ({ ...prev, [typeDialogStudentId]: typeDialogType }));
      // Update class summary too
      setClassSummary(prev => prev.map(s =>
        s.studentId === typeDialogStudentId
          ? { ...s, hasFreeCard: typeDialogType === 'free_card', subjects: s.subjects.map(sub => ({ ...sub, studentType: typeDialogType })) }
          : s
      ));
      toast({
        title: "Student Type Updated",
        description: `All subject enrollments updated to ${typeDialogType === 'free_card' ? 'Free Card' : typeDialogType === 'half_paid' ? 'Half Paid' : typeDialogType === 'quarter_paid' ? 'Quarter Paid' : typeDialogType === 'paid' ? 'Paid' : 'Normal'}`
      });
      setShowTypeDialog(false);
      setTypeDialogStudentId('');
      setTypeDialogSearch('');
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: getErrorMessage(error, 'Failed to update student type'),
        variant: "destructive"
      });
    } finally {
      setTypeDialogLoading(false);
    }
  };

  // --- Extra Data Edit Handlers ---
  const handleOpenEditExtraData = (student: ClassSubjectStudent) => {
    const rows = student.extraData && Object.keys(student.extraData).length > 0
      ? Object.entries(student.extraData).map(([key, value]) => ({ key, value: String(value) }))
      : [{ key: '', value: '' }];
    setExtraDataRows(rows);
    setEditExtraDataDialog({ open: true, student });
  };

  const handleSaveExtraData = async () => {
    if (!selectedInstitute?.id || !editExtraDataDialog.student) return;
    setSavingExtraData(true);
    try {
      const filtered = extraDataRows.filter(r => r.key.trim() !== '');
      const extraData = filtered.length > 0
        ? Object.fromEntries(filtered.map(r => [r.key.trim(), r.value]))
        : null;
      await instituteApi.updateInstituteUserExtraData(
        selectedInstitute.id,
        editExtraDataDialog.student.id,
        extraData,
      );
      setStudents(prev => prev.map(s =>
        s.id === editExtraDataDialog.student!.id ? { ...s, extraData } : s
      ));
      toast({ title: 'Extra Data Updated', description: 'Custom data saved successfully.' });
      setEditExtraDataDialog({ open: false, student: null });
    } catch (e: any) {
      toast({ title: 'Update Failed', description: getErrorMessage(e, 'Failed to update extra data'), variant: 'destructive' });
    } finally {
      setSavingExtraData(false);
    }
  };


  const allColumnDefs: ColumnDef[] = useMemo(() => {
    const baseCols: ColumnDef[] = [
    {
      key: 'student',
      header: 'Student',
      locked: true,
      defaultVisible: true,
      defaultWidth: 220,
      minWidth: 160,
      render: (value: any, row: ClassSubjectStudent) => (
        <div className="flex items-center space-x-3">
          <div 
            className="cursor-pointer flex-shrink-0"
            onClick={() => {
              if (row.imageUrl) {
                setImagePreview({ isOpen: true, url: row.imageUrl, title: row.name });
              }
            }}
          >
            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 hover:opacity-80 transition-opacity">
              <AvatarImage src={getImageUrl(row.imageUrl || '')} alt={row.name} />
              <AvatarFallback className="text-xs">
                {row.name.split(' ').map(n => n.charAt(0)).join('')}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{row.name}</p>
          </div>
        </div>
      )
    },
    {
      key: 'studentId',
      header: 'Student ID',
      defaultVisible: true,
      defaultWidth: 130,
      minWidth: 90,
      render: (_: any, row: ClassSubjectStudent) => (
        <span className="text-sm">{row.userIdByInstitute || row.id}</span>
      )
    },
    {
      key: 'email',
      header: 'Email',
      defaultVisible: false,
      defaultWidth: 200,
      minWidth: 140,
      render: (_: any, row: ClassSubjectStudent) => (
        <div className="flex items-center text-sm">
          <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
          <span className="truncate">{row.email || 'N/A'}</span>
        </div>
      )
    },
    {
      key: 'phone',
      header: 'Phone',
      defaultVisible: true,
      defaultWidth: 150,
      minWidth: 110,
      render: (_: any, row: ClassSubjectStudent) => (
        <div className="flex items-center text-sm">
          <Phone className="h-3 w-3 mr-1 flex-shrink-0" />
          <span className="truncate">{row.phoneNumber || 'N/A'}</span>
        </div>
      )
    },
    {
      key: 'address',
      header: 'Address',
      defaultVisible: false,
      defaultWidth: 200,
      minWidth: 120,
      render: (_: any, row: ClassSubjectStudent) => (
        <div className="space-y-1 text-sm">
          <p className="truncate">{row.addressLine1 || 'N/A'}</p>
          {row.addressLine2 && (
            <p className="text-muted-foreground truncate">{row.addressLine2}</p>
          )}
        </div>
      )
    },
    {
      key: 'dateOfBirth',
      header: 'Date of Birth',
      defaultVisible: false,
      defaultWidth: 140,
      minWidth: 100,
      render: (_: any, row: ClassSubjectStudent) => (
        <div className="text-sm">
          {row.dateOfBirth 
            ? new Date(row.dateOfBirth).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric'
              })
            : 'N/A'
          }
        </div>
      )
    },
    {
      key: 'guardians',
      header: 'Parent/Guardian',
      defaultVisible: false,
      defaultWidth: 180,
      minWidth: 120,
      render: (_: any, row: ClassSubjectStudent) => (
        <div className="space-y-1">
          {row.fatherId && <Badge variant="outline" className="text-xs">Father: {row.fatherId}</Badge>}
          {row.motherId && <Badge variant="outline" className="text-xs">Mother: {row.motherId}</Badge>}
          {row.guardianId && <Badge variant="outline" className="text-xs">Guardian: {row.guardianId}</Badge>}
          {!row.fatherId && !row.motherId && !row.guardianId && (
            <span className="text-sm text-muted-foreground">N/A</span>
          )}
        </div>
      )
    },
    {
      key: 'studentType',
      header: 'Student Type',
      defaultVisible: true,
      defaultWidth: 240,
      minWidth: 180,
      render: (_: any, row: ClassSubjectStudent) => {
        const sType = studentTypeMap[row.id] || 'normal';
        const isUpdating = updatingTypeFor === row.id;
        const isSubjectLevel = !!selectedSubject;
        const summaryEntry = !isSubjectLevel ? classSummary.find(s => s.studentId === row.id) : null;

        const TypeBadge = ({ type }: { type: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid' }) => (
          type === 'free_card' ? (
            <Badge variant="outline" className="text-purple-600 border-purple-200 dark:text-purple-400 dark:border-purple-800">
              <Gift className="h-3 w-3 mr-1" />Free Card
            </Badge>
          ) : type === 'paid' ? (
            <Badge variant="outline" className="text-green-600 border-green-200 dark:text-green-400 dark:border-green-800">
              <CreditCard className="h-3 w-3 mr-1" />Paid
            </Badge>
          ) : type === 'half_paid' ? (
            <Badge variant="outline" className="text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800">
              <BadgePercent className="h-3 w-3 mr-1" />Half Paid
            </Badge>
          ) : type === 'quarter_paid' ? (
            <Badge variant="outline" className="text-sky-600 border-sky-200 dark:text-sky-400 dark:border-sky-800">
              <CircleDollarSign className="h-3 w-3 mr-1" />Quarter Paid
            </Badge>
          ) : (
            <Badge variant="outline" className="text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-800">
              <User className="h-3 w-3 mr-1" />Normal
            </Badge>
          )
        );

        if (isSubjectLevel && canManageType) {
          // Subject level: show badge + inline dropdown to change
          return (
            <div className="flex items-center gap-2">
              <TypeBadge type={sType} />
              <Select
                value={sType}
                onValueChange={(val) => handleStudentTypeChange(row.id, val as 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid')}
                disabled={isUpdating}
              >
                <SelectTrigger className="h-7 w-[130px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="free_card">Free Card</SelectItem>
                  <SelectItem value="half_paid">Half Paid</SelectItem>
                  <SelectItem value="quarter_paid">Quarter Paid</SelectItem>
                </SelectContent>
              </Select>
              {isUpdating && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
          );
        }

        // Class level or read-only: show badge + subject breakdown tooltip
        return (
          <div className="flex flex-col gap-1">
            <TypeBadge type={sType} />
            {summaryEntry && summaryEntry.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {summaryEntry.subjects.slice(0, 3).map(sub => (
                  <span key={sub.subjectId} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {sub.subjectName.length > 10 ? sub.subjectName.slice(0, 10) + '…' : sub.subjectName}:&nbsp;
                  <span className={sub.studentType === 'free_card' ? 'text-purple-600' : sub.studentType === 'paid' ? 'text-green-600' : sub.studentType === 'half_paid' ? 'text-amber-600' : sub.studentType === 'quarter_paid' ? 'text-sky-600' : 'text-blue-600'}>
                      {sub.studentType === 'free_card' ? 'Free' : sub.studentType === 'paid' ? 'Paid' : sub.studentType === 'half_paid' ? 'Half' : sub.studentType === 'quarter_paid' ? 'Qtr' : 'Normal'}
                    </span>
                  </span>
                ))}
                {summaryEntry.subjects.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{summaryEntry.subjects.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        );
      }
    },

    {
      key: 'actions',
      header: 'Actions',
      defaultVisible: true,
      defaultWidth: 100,
      minWidth: 80,
      render: (_: any, row: ClassSubjectStudent) => (
        <div className="flex items-center gap-1">
          {canManageType && (
            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleOpenEditExtraData(row)} title="Edit Extra Data">
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      )
    },
  ];

  // Add schema-driven extra data columns right before the "actions" column
  // Each extraData key becomes its own individual column (defaultVisible: true)
  extraColumns.forEach(col => {
    baseCols.splice(baseCols.length - 1, 0, {
      key: `extra_${col.key}`,
      header: col.label,
      defaultVisible: true,
      minWidth: 120,
      defaultWidth: 160,
      render: (_: any, row: ClassSubjectStudent) => {
        const val = row.extraData?.[col.key];
        return <span className="text-sm">{val !== undefined && val !== null && val !== '' ? String(val) : '-'}</span>;
      }
    });
  });

  return baseCols;
}, [studentTypeMap, updatingTypeFor, selectedSubject, classSummary, canManageType, extraColumns]);


  const { colState, visibleColumns, toggleColumn, setColumnWidth, resetColumns } = useColumnConfig(allColumnDefs, 'teacher-students-v2');

  // Build column widths map + visible columns for DataTable
  const columnWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    for (const col of visibleColumns) {
      widths[col.key] = colState[col.key]?.width || col.defaultWidth || 180;
    }
    return widths;
  }, [visibleColumns, colState]);

  const tableColumns = useMemo(() =>
    visibleColumns.map(col => ({
      key: col.key,
      header: col.header,
      render: col.render,
    })),
    [visibleColumns]
  );

  const filteredStudents = students.filter(student => {
    const name = student.name.toLowerCase();
    const email = (student.email || '').toLowerCase();
    const matchesSearch = !searchTerm || name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
    
    // Student type filter (only when subject selected)
    const sType = studentTypeMap[student.id] || 'normal';
    const matchesType = studentTypeFilter === 'all' || sType === studentTypeFilter;
    
    return matchesSearch && matchesType;
  });

  const getTitle = () => {
    if (selectedSubject) {
      return `Students - ${selectedSubject.name}`;
    }
    if (selectedClass) {
      return `Students`;
    }
    return 'Students';
  };

  const getCurrentSelection = () => {
    const parts = [];
    if (selectedInstitute) parts.push(`Institute: ${selectedInstitute.name}`);
    if (selectedClass) parts.push(`Class: ${selectedClass.name}`);
    if (selectedSubject) parts.push(`Subject: ${selectedSubject.name}`);
    return parts.join(' → ');
  };

  const getLoadFunction = () => {
    return selectedSubject 
      ? () => fetchSubjectStudents(true)  // Force refresh from backend
      : () => fetchClassStudents(true);   // Force refresh from backend
  };

  const getLoadButtonText = () => {
    if (selectedSubject) {
      return loading ? 'Loading Subject Students...' : 'Load My Subject Students';
    }
    return loading ? 'Loading Class Students...' : 'Load My Class Students';
  };

  if (!selectedInstitute || !selectedClass) {
    return (
      <div className="h-full w-full p-6 space-y-6">
        <div className="text-center py-12">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-4">
            Select Class
          </h2>
          <p className="text-muted-foreground">
            Please select an institute and class to view your students.
          </p>
        </div>
      </div>
    );
  }

  if (!dataLoaded) {
    return (
      <div className="h-full w-full p-6 space-y-6">
        <div className="text-center py-12">
          <Users className="h-16 w-16 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-bold mb-4">
            {getTitle()}
          </h2>
          <p className="text-muted-foreground mb-2">
            Current Selection: {getCurrentSelection()}
          </p>
          <p className="text-muted-foreground mb-6">
            Click the button below to load your students
          </p>
          <Button 
            onClick={getLoadFunction()} 
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                {getLoadButtonText()}
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                {getLoadButtonText()}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {getTitle()}
          </h1>
          <p className="text-muted-foreground mt-1">
            Current Selection: {getCurrentSelection()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {students.length} Students
          </Badge>
          {canManageType && !selectedSubject && (
            <Button
              variant="outline"
              onClick={() => { setTypeDialogSearch(''); setTypeDialogStudentId(''); setTypeDialogType('free_card'); setShowTypeDialog(true); }}
              className="flex items-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950"
            >
              <Gift className="h-4 w-4" />
              Give Free Card
            </Button>
          )}
          {canManageType && !!selectedSubject && (
            <Button
              variant="outline"
              onClick={() => setShowEnrollByPaymentDialog(true)}
              className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950"
            >
              <CreditCard className="h-4 w-4" />
              Enroll by Payment
            </Button>
          )}
          <Button
            onClick={() => setShowAssignDialog(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Assign Students
          </Button>
          <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="md:hidden flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="md:hidden flex flex-col max-h-[80vh] rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Filter Students</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto py-4">
                <div className="space-y-4 px-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search students..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {selectedSubject && (
                    <Select
                      value={studentTypeFilter}
                      onValueChange={(val) => setStudentTypeFilter(val as 'all' | 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Student Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="free_card">Free Card</SelectItem>
                        <SelectItem value="half_paid">Half Paid</SelectItem>
                        <SelectItem value="quarter_paid">Quarter Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setStudentTypeFilter('all');
                      setIsFilterSheetOpen(false);
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="hidden md:flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button 
            onClick={getLoadFunction()} 
            disabled={loading}
            variant="outline"
            size="sm"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      {/* Filter Controls - Desktop Only */}
      {showFilters && (
        <ScrollAnimationWrapper animationType="slide-up" className="hidden md:block">
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Filter Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {selectedSubject && (
                <Select
                  value={studentTypeFilter}
                  onValueChange={(val) => setStudentTypeFilter(val as 'all' | 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Student Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="free_card">Free Card</SelectItem>
                    <SelectItem value="half_paid">Half Paid</SelectItem>
                    <SelectItem value="quarter_paid">Quarter Paid</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setStudentTypeFilter('all');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      </ScrollAnimationWrapper>
      )}

      {filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Students Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {(searchTerm || studentTypeFilter !== 'all')
                ? 'No students match your current filters.' 
                : 'No students are enrolled in this selection.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <DataTable
              title=""
              data={filteredStudents}
              columns={tableColumns}
              columnWidths={columnWidths}
              onColumnResize={setColumnWidth}
              headerExtra={
                <ColumnConfigurator
                  allColumns={allColumnDefs}
                  colState={colState}
                  onToggle={toggleColumn}
                  onReset={resetColumns}
                />
              }
              searchPlaceholder="Search students..."
              allowAdd={false}
              allowEdit={false}
              allowDelete={false}
            />
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden">
            <DataCardView
              data={filteredStudents}
              columns={tableColumns}
              allowEdit={false}
              allowDelete={false}
            />
          </div>
        </>
      )}

      {/* Assign Students Dialog */}
      <AssignStudentsDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        onAssignmentComplete={() => {
          getLoadFunction()(); // Refresh the list
        }}
      />

      <ImagePreviewModal
        isOpen={imagePreview.isOpen}
        onClose={() => setImagePreview({ isOpen: false, url: '', title: '' })}
        imageUrl={imagePreview.url}
        title={imagePreview.title}
      />

      {/* Give Free Card / Update Type Dialog (class level) */}
      {canManageType && (
        <Dialog open={showTypeDialog} onOpenChange={setShowTypeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-purple-600" />
                Update Student Type (All Subjects)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Type selector */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Student Type</label>
                <Select value={typeDialogType} onValueChange={(v) => setTypeDialogType(v as 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">
                      <span className="flex items-center gap-2"><User className="h-4 w-4 text-blue-600" />Normal</span>
                    </SelectItem>
                    <SelectItem value="paid">
                      <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-green-600" />Paid</span>
                    </SelectItem>
                    <SelectItem value="free_card">
                      <span className="flex items-center gap-2"><Gift className="h-4 w-4 text-purple-600" />Free Card</span>
                    </SelectItem>
                    <SelectItem value="half_paid">
                      <span className="flex items-center gap-2"><BadgePercent className="h-4 w-4 text-amber-600" />Half Paid</span>
                    </SelectItem>
                    <SelectItem value="quarter_paid">
                      <span className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-sky-600" />Quarter Paid</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Student search */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Search Student</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Name, email or ID…"
                    value={typeDialogSearch}
                    onChange={(e) => { setTypeDialogSearch(e.target.value); setTypeDialogStudentId(''); }}
                    className="pl-9"
                  />
                </div>
                {/* Student list */}
                <div className="max-h-52 overflow-y-auto border rounded-md divide-y divide-border">
                  {dialogFilteredStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {classSummary.length === 0 ? 'Load class students first' : 'No students match'}
                    </p>
                  ) : (
                    dialogFilteredStudents.map(s => {
                      const currentType = s.hasFreeCard ? 'free_card' : s.subjects.some(sub => sub.studentType === 'paid') ? 'paid' : 'normal';
                      return (
                        <button
                          key={s.studentId}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${typeDialogStudentId === s.studentId ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
                          onClick={() => setTypeDialogStudentId(s.studentId)}
                        >
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src={getImageUrl(s.imageUrl || '')} />
                            <AvatarFallback className="text-xs">{s.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                          </div>
                          <div className="flex-shrink-0">
                            {currentType === 'free_card' ? (
                              <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-200"><Gift className="h-2.5 w-2.5 mr-0.5" />Free</Badge>
                            ) : currentType === 'paid' ? (
                              <Badge variant="outline" className="text-[10px] text-green-600 border-green-200"><CreditCard className="h-2.5 w-2.5 mr-0.5" />Paid</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200"><User className="h-2.5 w-2.5 mr-0.5" />Normal</Badge>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {typeDialogStudentId && (
                <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                  This will update the student type across <strong>all enrolled subjects</strong> in this class.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTypeDialog(false)} disabled={typeDialogLoading}>
                Cancel
              </Button>
              <Button
                onClick={handleClassTypeDialogSubmit}
                disabled={!typeDialogStudentId || typeDialogLoading}
                className={typeDialogType === 'free_card' ? 'bg-purple-600 hover:bg-purple-700' : typeDialogType === 'paid' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {typeDialogLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Gift className="h-4 w-4 mr-2" />}
                Apply {typeDialogType === 'free_card' ? 'Free Card' : typeDialogType === 'paid' ? 'Paid' : 'Normal'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Extra Data Dialog */}
      <Dialog open={editExtraDataDialog.open} onOpenChange={(open) => !open && setEditExtraDataDialog({ open: false, student: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Extra Data — {editExtraDataDialog.student?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {extraDataRows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  placeholder="Key"
                  value={row.key}
                  onChange={(e) => {
                    const updated = [...extraDataRows];
                    updated[idx] = { ...updated[idx], key: e.target.value };
                    setExtraDataRows(updated);
                  }}
                  className="flex-1"
                />
                <Input
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => {
                    const updated = [...extraDataRows];
                    updated[idx] = { ...updated[idx], value: e.target.value };
                    setExtraDataRows(updated);
                  }}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={() => {
                    const updated = extraDataRows.filter((_, i) => i !== idx);
                    setExtraDataRows(updated.length === 0 ? [{ key: '', value: '' }] : updated);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1"
              onClick={() => setExtraDataRows([...extraDataRows, { key: '', value: '' }])}
            >
              <PlusCircle className="h-3.5 w-3.5" /> Add Field
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExtraDataDialog({ open: false, student: null })} disabled={savingExtraData}>Cancel</Button>
            <Button onClick={handleSaveExtraData} disabled={savingExtraData}>
              {savingExtraData ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll by Payment Dialog */}
      {selectedInstitute && selectedClass && selectedSubject && (
        <EnrollByPaymentDialog
          open={showEnrollByPaymentDialog}
          onOpenChange={setShowEnrollByPaymentDialog}
          instituteId={selectedInstitute.id}
          classId={selectedClass.id}
          subjectId={selectedSubject.id}
          subjectName={selectedSubject.name}
          onSuccess={() => fetchSubjectStudents(true)}
        />
      )}
    </div>
  );
};

export default TeacherStudents;

