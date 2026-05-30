import React, { useState } from 'react';
import MUITable from '@/components/ui/mui-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { getImageUrl } from '@/utils/imageUrlHelper';

import { RefreshCw, Filter, Eye, Edit, Trash2, Plus, UserPlus, UserMinus } from 'lucide-react';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { AccessControl } from '@/utils/permissions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import CreateSubjectForm from '@/components/forms/CreateSubjectForm';
import AssignSubjectToClassForm from '@/components/forms/AssignSubjectToClassForm';
import { useTableData } from '@/hooks/useTableData';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { TeacherSelectorDialog } from '@/components/dialogs/TeacherSelectorDialog';
import { instituteApi } from '@/api/institute.api';
import { SUBJECT_TYPE_OPTIONS, BASKET_CATEGORY_OPTIONS } from '@/api/subjects.api';

interface TeacherInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl?: string;
}

interface SubjectData {
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
  imgUrl: string | null;
  createdAt: string;
  updatedAt: string;
  teacherId?: string;
  teacher?: TeacherInfo | null;
  classId?: string;
  subjectId?: string;
}

const Subjects = () => {
  const {
    user,
    selectedInstitute,
    selectedClass,
    selectedSubject,
    currentInstituteId,
    currentClassId,
    currentSubjectId
  } = useAuth();
  const {
    toast
  } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedSubjectData, setSelectedSubjectData] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [subjectTypeFilter, setSubjectTypeFilter] = useState('all');
  const [basketCategoryFilter, setBasketCategoryFilter] = useState('all');
  const userRole = useInstituteRole();

  // Image preview state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Teacher assignment state
  const [isTeacherSelectorOpen, setIsTeacherSelectorOpen] = useState(false);
  const [selectedSubjectForTeacher, setSelectedSubjectForTeacher] = useState<{
    subjectId: string;
    instituteId: string;
    classId: string;
  } | null>(null);
  const [isAssigningTeacher, setIsAssigningTeacher] = useState(false);
  const [isUnassigningTeacher, setIsUnassigningTeacher] = useState(false);
  const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
  const [subjectToUnassign, setSubjectToUnassign] = useState<SubjectData | null>(null);

  // Enhanced pagination with useTableData hook - fetch from correct endpoint
  const isClassLevel = !!currentClassId;
  
  // NEW: Use instituteId parameter instead of instituteType
  const endpoint = isClassLevel && currentInstituteId && currentClassId
    ? `/institutes/${currentInstituteId}/classes/${currentClassId}/subjects`
    : '/subjects';

  const tableData = useTableData<SubjectData>({
    endpoint,
    defaultParams: {
      // NEW: Always pass instituteId for subjects endpoint
      ...(currentInstituteId && { instituteId: currentInstituteId }),
      ...(statusFilter !== 'all' && { isActive: statusFilter === 'active' }),
      ...(searchTerm && { search: searchTerm }),
      ...(categoryFilter !== 'all' && { category: categoryFilter }),
      ...(subjectTypeFilter !== 'all' && { subjectType: subjectTypeFilter }),
      ...(basketCategoryFilter !== 'all' && { basketCategory: basketCategoryFilter }),
    },
    cacheOptions: {
      ttl: 15,
      userId: user?.id,
      role: userRole || 'User',
      instituteId: currentInstituteId || undefined,
      classId: currentClassId || undefined
    },
    dependencies: [currentInstituteId, currentClassId, statusFilter, searchTerm, categoryFilter, subjectTypeFilter, basketCategoryFilter],
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
    autoLoad: !!currentInstituteId, // Only auto-load if institute is selected
  });

  const {
    state: {
      data: subjectsData,
      loading: isLoading
    },
    pagination,
    actions
  } = tableData;
  
  // Transform nested API response to flattened structure for table
  // Handle both nested (class-level) and flat (all subjects) response formats
  const transformedData = subjectsData.map((item: any) => {
    // If item has a 'subject' property, it's from class-level endpoint (nested)
    if (item.subject) {
      return {
        ...item.subject,
        teacher: item.teacher,
        teacherId: item.teacherId,
        instituteId: item.instituteId,
        classId: item.classId,
        subjectId: item.subjectId || item.subject?.id
      };
    }
    // Otherwise it's from /subjects/all endpoint (flat structure)
    return {
      ...item,
      teacher: item.teacher || null,
      teacherId: item.teacherId || null,
      subjectId: item.id
    };
  });
  
  const dataLoaded = subjectsData.length > 0;
  const isInstituteAdmin = userRole === 'InstituteAdmin';
  const canEdit = AccessControl.hasPermission(userRole, 'edit-subject') && !isInstituteAdmin;
  const canDelete = AccessControl.hasPermission(userRole, 'delete-subject') && !isInstituteAdmin;
  const canCreate = userRole === 'InstituteAdmin';
  const canAssignSubjects = userRole === 'InstituteAdmin' || userRole === 'Teacher';
  const handleLoadData = async () => {
    if (!currentInstituteId) {
      toast({
        title: "Error",
        description: "Please select an institute first.",
        variant: "destructive"
      });
      return;
    }

    // Refresh data with current institute context
    actions.refresh();
  };
  const getBaseUrl = () => {
    return import.meta.env.VITE_LMS_BASE_URL || 'https://lmsapi.suraksha.lk';
  };

  const resolveImageUrl = (url?: string | null) => {
    if (!url) return '/placeholder.svg';
    return getImageUrl(url);
  };

  const handleAssignTeacher = (subject: SubjectData) => {
    if (!currentInstituteId || !currentClassId) {
      toast({
        title: "Error",
        description: "Please select a class first to assign teachers to subjects",
        variant: "destructive"
      });
      return;
    }
    setSelectedSubjectForTeacher({
      subjectId: subject.subjectId || subject.id,
      instituteId: subject.instituteId || currentInstituteId,
      classId: subject.classId || currentClassId
    });
    setIsTeacherSelectorOpen(true);
  };

  const handleUnassignTeacher = (subject: SubjectData) => {
    if (!currentInstituteId || !currentClassId) {
      toast({
        title: "Error",
        description: "Please select a class first to manage subject teachers",
        variant: "destructive"
      });
      return;
    }
    setSubjectToUnassign(subject);
    setShowUnassignConfirm(true);
  };

  const confirmUnassignTeacher = async () => {
    if (!subjectToUnassign || isUnassigningTeacher) return;

    try {
      setIsUnassigningTeacher(true);
      await instituteApi.unassignTeacherFromSubject(
        subjectToUnassign.instituteId || currentInstituteId!,
        subjectToUnassign.classId || currentClassId!,
        subjectToUnassign.subjectId || subjectToUnassign.id
      );
      toast({
        title: "Success",
        description: "Teacher unassigned successfully"
      });
      setShowUnassignConfirm(false);
      setSubjectToUnassign(null);
      actions.refresh();
    } catch (error: any) {
      console.error('Error unassigning teacher:', error);
      toast({
        title: "Error",
        description: "Failed to unassign teacher",
        variant: "destructive"
      });
    } finally {
      setIsUnassigningTeacher(false);
    }
  };

  const handleTeacherSelect = async (teacherId: string) => {
    if (!selectedSubjectForTeacher || isAssigningTeacher) return;

    try {
      setIsAssigningTeacher(true);
      await instituteApi.assignTeacherToSubject(
        selectedSubjectForTeacher.instituteId,
        selectedSubjectForTeacher.classId,
        selectedSubjectForTeacher.subjectId,
        teacherId
      );
      toast({
        title: "Success",
        description: "Teacher assigned successfully"
      });
      actions.refresh();
    } catch (error: any) {
      console.error('Error assigning teacher:', error);
      toast({
        title: "Error",
        description: "Failed to assign teacher",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsAssigningTeacher(false);
    }
  };

  const subjectsColumns = [{
    id: 'imgUrl',
    key: 'imgUrl',
    header: 'Image',
    format: (value: string | null, row: any) => (
      <div 
        className="w-16 h-16 rounded-lg overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
        onClick={() => {
          const imgUrl = row?.imgUrl || value;
          if (imgUrl) {
            setPreviewImage({ url: resolveImageUrl(imgUrl), title: `${row?.name || 'Subject'} - Subject Image` });
          }
        }}
      >
        <img
          src={resolveImageUrl(row?.imgUrl || value)}
          alt={row?.name ? `Subject ${row.name}` : 'Subject image'}
          className="w-full h-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
        />
      </div>
    )
  }, {
    key: 'code',
    header: 'Code'
  }, {
    key: 'name',
    header: 'Name',
    format: (value: string | null) => value || <span className="text-muted-foreground italic">No name</span>
  }, {
    key: 'description',
    header: 'Description',
    format: (value: string | null) => value || <span className="text-muted-foreground italic">No description</span>
  }, {
    key: 'category',
    header: 'Category',
    format: (value: string | null) => value || <span className="text-muted-foreground italic">N/A</span>
  }, {
    key: 'creditHours',
    header: 'Credit Hours',
    format: (value: number | null) => value !== null && value !== undefined ? value : <span className="text-muted-foreground italic">N/A</span>
  }, {
    key: 'subjectType',
    header: 'Type',
    format: (value: string | null) => {
      if (!value) return <span className="text-muted-foreground italic">N/A</span>;
      const option = SUBJECT_TYPE_OPTIONS.find(o => o.value === value);
      const isBasket = value.includes('BASKET');
      return (
        <Badge variant={isBasket ? 'outline' : 'secondary'} className={isBasket ? 'border-purple-500 text-purple-700 dark:text-purple-300' : ''}>
          {option?.label || value}
        </Badge>
      );
    }
  }, {
    key: 'basketCategory',
    header: 'Basket',
    format: (value: string | null, row: SubjectData) => {
      if (!value || !row.subjectType?.includes('BASKET')) {
        return <span className="text-muted-foreground italic">—</span>;
      }
      const option = BASKET_CATEGORY_OPTIONS.find(o => o.value === value);
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-300">
          {option?.label || value}
        </Badge>
      );
    }
  }, {
    key: 'teacher',
    header: 'Teacher',
    format: (value: TeacherInfo | null, row: SubjectData) => (
      <div className="min-w-[180px]">
        {isClassLevel ? (
          value ? (
            <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
                <AvatarImage src={getImageUrl(value.imageUrl)} alt={value.firstName ? `${value.firstName} ${value.lastName}` : 'Teacher'} />
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                  {value.firstName?.[0] || 'T'}{value.lastName?.[0] || 'R'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {value.firstName} {value.lastName}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {value.email}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">No teacher</span>
          )
        ) : (
          <span className="text-sm text-muted-foreground italic">Select a class to view</span>
        )}
      </div>
    )
  }, {
    key: 'isActive',
    header: 'Status',
    render: (value: boolean) => <Badge variant={value ? 'default' : 'secondary'}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
  }, ...(isInstituteAdmin && isClassLevel ? [{
    key: 'teacherActions',
    header: 'Teacher Actions',
    format: (value: any, row: SubjectData) => (
      <div className="flex items-center gap-2">
        {row.teacher ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleUnassignTeacher(row)}
            disabled={isUnassigningTeacher || isAssigningTeacher}
            className="h-8 px-3"
            title="Remove teacher"
          >
            {isUnassigningTeacher && subjectToUnassign?.id === row.id ? (
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <UserMinus className="h-4 w-4 mr-1" />
            )}
            {isUnassigningTeacher && subjectToUnassign?.id === row.id ? 'Removing...' : 'Remove'}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAssignTeacher(row)}
            disabled={isUnassigningTeacher || isAssigningTeacher}
            className="h-8 px-3"
            title="Assign teacher"
          >
            {isAssigningTeacher && selectedSubjectForTeacher?.subjectId === (row.subjectId || row.id) ? (
              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-1" />
            )}
            {isAssigningTeacher && selectedSubjectForTeacher?.subjectId === (row.subjectId || row.id) ? 'Assigning...' : 'Assign'}
          </Button>
        )}
      </div>
    )
  }] : [])];
  const handleCreateSubject = async (subjectData: any) => {
    if (!currentInstituteId) {
      toast({
        title: "Error",
        description: "Please select an institute first.",
        variant: "destructive"
      });
      return;
    }
    try {
      toast({
        title: "Subject Created",
        description: `Subject ${subjectData.name} has been created successfully.`
      });
      setIsCreateDialogOpen(false);
      // Refresh data after creation
      actions.refresh();
    } catch (error: any) {
      console.error('Error in handleCreateSubject:', error);
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create subject.",
        variant: "destructive"
      });
    }
  };
  const handleEditSubject = (subject: any) => {
    console.log('Edit subject:', subject);
    setSelectedSubjectData(subject);
    setIsEditDialogOpen(true);
  };
  const handleUpdateSubject = (subjectData: any) => {
    console.log('Updating subject:', subjectData);
    toast({
      title: "Subject Updated",
      description: `Subject ${subjectData.name} has been updated successfully.`
    });
    setIsEditDialogOpen(false);
    setSelectedSubjectData(null);
    // Refresh data after update
    actions.refresh();
  };
  const handleDeleteSubject = (subject: any) => {
    console.log('Delete subject:', subject);
    toast({
      title: "Subject Deleted",
      description: `Subject ${subject.name} has been deleted.`,
      variant: "destructive"
    });
  };
  const handleViewSubject = (subject: any) => {
    console.log('View subject details:', subject);
    toast({
      title: "View Subject",
      description: `Viewing subject: ${subject.name}`
    });
  };
  const getContextTitle = () => {
    const contexts = [];
    if (selectedInstitute) {
      contexts.push(selectedInstitute.name);
    }
    if (selectedClass) {
      contexts.push(selectedClass.name);
    }
    if (selectedSubject) {
      contexts.push(selectedSubject.name);
    }
    let title = 'Subjects Management';
    if (contexts.length > 0) {
      title += ` (${contexts.join(' → ')})`;
    }
    return title;
  };
  const customActions = isInstituteAdmin ? [] : [{
    label: 'View',
    action: (subject: any) => handleViewSubject(subject),
    icon: <Eye className="h-3 w-3" />,
    variant: 'outline' as const
  }, ...(canEdit ? [{
    label: 'Edit',
    action: (subject: any) => handleEditSubject(subject),
    icon: <Edit className="h-3 w-3" />,
    variant: 'outline' as const
  }] : []), ...(canDelete ? [{
    label: 'Delete',
    action: (subject: any) => handleDeleteSubject(subject),
    icon: <Trash2 className="h-3 w-3" />,
    variant: 'destructive' as const
  }] : [])];
  return <div className="space-y-6">
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {getContextTitle()}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {isClassLevel 
                ? "Manage class subjects, assign teachers, and configure subject settings"
                : "Manage academic subjects and curriculum planning. Select a class to assign teachers."
              }
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filters</span>
              </Button>
              
              <Button variant="outline" size="sm" onClick={() => actions.refresh()} disabled={isLoading} className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              
                
                {(userRole === 'InstituteAdmin' || canAssignSubjects) && (
                  <Button onClick={() => setIsAssignDialogOpen(true)} style={{ backgroundColor: '#06923E' }} className="hover:opacity-90 text-white flex items-center gap-2" size="sm">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Assign Subject</span>
                    <span className="sm:hidden">Assign</span>
                  </Button>
                 )}
            </div>
          </div>

          {showFilters && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border mb-6">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Search Subjects
                </label>
                <Input placeholder="Search by code, name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full" />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Category
                </label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Science">Science</SelectItem>
                    <SelectItem value="Mathematics">Mathematics</SelectItem>
                    <SelectItem value="Languages">Languages</SelectItem>
                    <SelectItem value="Arts">Arts</SelectItem>
                    <SelectItem value="Commerce">Commerce</SelectItem>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Humanities">Humanities</SelectItem>
                    <SelectItem value="Religion">Religion</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Subject Type
                </label>
                <Select value={subjectTypeFilter} onValueChange={setSubjectTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Subject Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {SUBJECT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Basket Category
                </label>
                <Select value={basketCategoryFilter} onValueChange={setBasketCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Basket Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Baskets</SelectItem>
                    {BASKET_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>}

          {/* Unified Table View for all devices */}
          <div className="w-full overflow-x-auto">
            <MUITable
              title="Subjects"
              data={transformedData || []}
              columns={subjectsColumns.map(col => ({
                id: col.key,
                label: col.header,
                minWidth: 170,
                format: col.render || col.format
              }))}
              onEdit={!isInstituteAdmin && canEdit ? handleEditSubject : undefined}
              onDelete={!isInstituteAdmin && canDelete ? handleDeleteSubject : undefined}
              onView={!isInstituteAdmin ? handleViewSubject : undefined}
              page={pagination.page}
              rowsPerPage={pagination.limit}
              totalCount={pagination.totalCount}
              onPageChange={(newPage: number) => actions.setPage(newPage)}
              onRowsPerPageChange={(newLimit: number) => actions.setLimit(newLimit)}
              sectionType="subjects"
              allowEdit={!isInstituteAdmin && canEdit}
              allowDelete={!isInstituteAdmin && canDelete}
            />
          </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} routeName="create-subject-popup">
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle>Create New Subject</DialogTitle>
          </DialogHeader>
          <CreateSubjectForm onSubmit={handleCreateSubject} onCancel={() => setIsCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} routeName="edit-subject-popup">
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
          </DialogHeader>
          <CreateSubjectForm initialData={selectedSubjectData} onSubmit={handleUpdateSubject} onCancel={() => {
          setIsEditDialogOpen(false);
          setSelectedSubjectData(null);
        }} />
        </DialogContent>
      </Dialog>

      {/* Assign Subject Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen} routeName="assign-subjects-popup">
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto mx-auto">
          <DialogHeader>
            <DialogTitle>Assign Subjects to Class</DialogTitle>
          </DialogHeader>
          <AssignSubjectToClassForm onSuccess={() => {
          setIsAssignDialogOpen(false);
        }} onCancel={() => setIsAssignDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Teacher Selector Dialog */}
      <TeacherSelectorDialog
        isOpen={isTeacherSelectorOpen}
        onClose={() => {
          if (!isAssigningTeacher) {
            setIsTeacherSelectorOpen(false);
            setSelectedSubjectForTeacher(null);
          }
        }}
        onSelect={handleTeacherSelect}
        title="Assign Subject Teacher"
        description="Select a teacher to assign to this subject"
      />

      {/* Unassign Teacher Confirmation Dialog */}
      <AlertDialog open={showUnassignConfirm} onOpenChange={(open) => !isUnassigningTeacher && setShowUnassignConfirm(open)} routeName="unassign-teacher-popup">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Teacher Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{subjectToUnassign?.teacher?.firstName} {subjectToUnassign?.teacher?.lastName}</strong> from teaching <strong>{subjectToUnassign?.name}</strong>?
              <br /><br />
              This will unassign the teacher from this subject but will not delete any related data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnassigningTeacher}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnassignTeacher}
              disabled={isUnassigningTeacher}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnassigningTeacher ? 'Removing...' : 'Remove Teacher'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)} routeName="subject-image-preview-popup">
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{previewImage?.title}</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {previewImage && (
              <img 
                src={previewImage.url} 
                alt={previewImage.title}
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};
export default Subjects;