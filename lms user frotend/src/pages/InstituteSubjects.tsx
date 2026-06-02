import React, { useState, useEffect, useMemo, useRef } from 'react';
import MUITable from '@/components/ui/mui-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { RefreshCw, Filter, Eye, Edit, Trash2, Plus, BookOpen, AlertCircle, Power, PowerOff, Link2, ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown, LayoutGrid, Table2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { subjectsApi, Subject, CreateSubjectDto, UpdateSubjectDto, SUBJECT_TYPE_OPTIONS, BASKET_CATEGORY_OPTIONS, requiresBasketCategory } from '@/api/subjects.api';

import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';
import SubjectImageUpload from '@/components/SubjectImageUpload';
import AssignSubjectToClassForm from '@/components/forms/AssignSubjectToClassForm';
import { useViewMode } from '@/hooks/useViewMode';

/**
 * Institute Subjects Management Page
 * 
 * Shows all subjects for the current institute:
 * ✅ View all institute subjects in a table
 * ✅ Create new subjects
 * ✅ Update existing subjects
 * ✅ Delete/Deactivate subjects
 */
const InstituteSubjects = () => {
  const {
    user,
    currentInstituteId,
    selectedInstitute
  } = useAuth();
  const { toast } = useToast();
  const userRole = useInstituteRole();
  const { subjectLabel: itemLabel, subjectsLabel, isTuition: isTuitionInstitute } = useInstituteLabels();
  const pageTitle = `Institute ${subjectsLabel || 'Subjects'}`;
  const createButtonLabel = isTuitionInstitute ? 'Months' : 'Subject';
  
  // Data states
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSubjectsData, setActiveSubjectsData] = useState<Subject[]>([]);
  const [inactiveSubjectsData, setInactiveSubjectsData] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Image preview state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // View dialog
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  // Create dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createImageUrl, setCreateImageUrl] = useState('');
  const createImageUploadRef = useRef<(() => Promise<string | null>) | null>(null);
  const [createForm, setCreateForm] = useState<CreateSubjectDto>({
    code: '',
    name: '',
    description: '',
    category: '',
    creditHours: 1,
    isActive: true,
    subjectType: 'MAIN',
    basketCategory: undefined,
    instituteId: '',
    imgUrl: ''
  });

  // Edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editForm, setEditForm] = useState<UpdateSubjectDto & { id: string }>({
    id: '',
    code: '',
    name: '',
    description: '',
    category: '',
    creditHours: 1,
    isActive: true,
    subjectType: 'MAIN',
    basketCategory: undefined,
    imgUrl: ''
  });

  // Delete dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Deactivate dialog
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [subjectToDeactivate, setSubjectToDeactivate] = useState<Subject | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Assign to Class dialog
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  // Permission checks
  const isInstituteAdmin = userRole === 'InstituteAdmin';
  const isSuperAdmin = user?.role === 'SystemAdmin';
  const isTeacher = userRole === 'Teacher';
  const canCreate = isInstituteAdmin || isSuperAdmin;
  const canEdit = isInstituteAdmin || isSuperAdmin;
  const canDelete = isSuperAdmin;
  const canDeactivate = isInstituteAdmin || isSuperAdmin;
  const canAssignSubjects = isInstituteAdmin || isTeacher;
  const { viewMode, setViewMode } = useViewMode();
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const CARD_INITIAL_SHOW = 6;
  const [showAllCards, setShowAllCards] = useState(false);
  const fetchSubjects = async (forceRefresh = false) => {
    if (!currentInstituteId) return;

    setIsLoading(true);
    try {
      // Fetch active subjects
      const activeResponse = await subjectsApi.getAll(
        currentInstituteId,
        { userId: user?.id, role: userRole || 'User', isActive: true },
        forceRefresh
      );
      const activeData = Array.isArray(activeResponse) ? activeResponse : (activeResponse as any)?.data || [];

      // Also fetch inactive subjects so "All" and "Inactive" filters work
      const inactiveResponse = await subjectsApi.getAll(
        currentInstituteId,
        { userId: user?.id, role: userRole || 'User', isActive: false },
        forceRefresh
      );
      const inactiveData = Array.isArray(inactiveResponse) ? inactiveResponse : (inactiveResponse as any)?.data || [];

      // Store each group separately so filters use the right API results
      setActiveSubjectsData(activeData);
      setInactiveSubjectsData(inactiveData);

      // Merge both, deduplicate by id (used for 'all' filter and stats)
      const allMap = new Map<string, Subject>();
      [...activeData, ...inactiveData].forEach((s: Subject) => allMap.set(s.id, s));
      setSubjects(Array.from(allMap.values()));
    } catch (error: any) {
      console.error('Error fetching subjects:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load subjects",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentInstituteId) {
      fetchSubjects();
    }
  }, [currentInstituteId]);

  const resolveImageUrl = (url?: string | null) => {
    if (!url) return '/placeholder.svg';
    return getImageUrl(url);
  };

  // Get unique categories
  const categories = [...new Set(subjects.map(s => s.category).filter(Boolean))];

  // Select the correct dataset based on filter so we trust the API, not client-side isActive
  const baseSubjects = statusFilter === 'inactive'
    ? inactiveSubjectsData
    : statusFilter === 'active'
      ? activeSubjectsData
      : subjects; // 'all' uses merged set

  // Filter subjects
  const filteredSubjects = baseSubjects.filter(s => {
    const matchesSearch = !searchTerm || 
      (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.code || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // View subject
  const handleViewSubject = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsViewDialogOpen(true);
  };

  // Create subject
  const handleOpenCreate = () => {
    setCreateForm({
      code: '',
      name: '',
      description: '',
      category: '',
      creditHours: 1,
      isActive: true,
      subjectType: 'MAIN',
      basketCategory: undefined,
      instituteId: currentInstituteId || '',
      imgUrl: ''
    });
    setCreateImageUrl('');
    setIsCreateDialogOpen(true);
  };

  const handleCreateSubject = async () => {
    if (!currentInstituteId || isCreating) return;
    
    if (!createForm.code || !createForm.name) {
      toast({
        title: "Validation Error",
        description: "Code and Name are required",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsCreating(true);

      // Upload pending image only on form submission
      let finalImageUrl = createImageUrl;
      if (createImageUrl === '__pending__' && createImageUploadRef.current) {
        const uploadedUrl = await createImageUploadRef.current();
        finalImageUrl = uploadedUrl || '';
      }

      await subjectsApi.create({
        ...createForm,
        instituteId: currentInstituteId,
        imgUrl: (finalImageUrl && finalImageUrl !== '__pending__') ? finalImageUrl : undefined
      });
      
      toast({
        title: "Subject Created",
        description: `${createForm.name} has been created successfully`
      });
      
      setIsCreateDialogOpen(false);
      fetchSubjects(true);
    } catch (error: any) {
      console.error('Error creating subject:', error);
      toast({
        title: "Creation Failed",
        description: error?.message || "Failed to create subject",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Edit subject
  const handleOpenEdit = (subject: Subject) => {
    setEditForm({
      id: subject.id,
      code: subject.code,
      name: subject.name,
      description: subject.description || '',
      category: subject.category || '',
      creditHours: subject.creditHours || 1,
      isActive: subject.isActive,
      subjectType: subject.subjectType,
      basketCategory: subject.basketCategory || undefined,
      imgUrl: subject.imgUrl || ''
    });
    setEditImageUrl(subject.imgUrl || '');
    setIsEditDialogOpen(true);
  };

  const handleUpdateSubject = async () => {
    if (!currentInstituteId || isUpdating) return;
    
    if (!editForm.code || !editForm.name) {
      toast({
        title: "Validation Error",
        description: "Code and Name are required",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsUpdating(true);
      const { id, ...updateData } = editForm;
      await subjectsApi.update(id, { ...updateData, imgUrl: editImageUrl || undefined }, currentInstituteId);
      
      toast({
        title: "Subject Updated",
        description: `${editForm.name} has been updated successfully`
      });
      
      setIsEditDialogOpen(false);
      fetchSubjects(true);
    } catch (error: any) {
      console.error('Error updating subject:', error);
      toast({
        title: "Update Failed",
        description: error?.message || "Failed to update subject",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete subject
  const handleDeleteClick = (subject: Subject) => {
    setSubjectToDelete(subject);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSubject = async () => {
    if (!subjectToDelete || !currentInstituteId || isDeleting) return;

    try {
      setIsDeleting(true);
      await subjectsApi.delete(subjectToDelete.id, currentInstituteId);
      
      toast({
        title: "Subject Deleted",
        description: `${subjectToDelete.name} has been permanently deleted`
      });
      
      setShowDeleteConfirm(false);
      setSubjectToDelete(null);
      fetchSubjects(true);
    } catch (error: any) {
      console.error('Error deleting subject:', error);
      toast({
        title: "Delete Failed",
        description: error?.message || "Failed to delete subject",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Deactivate / Activate subject (toggle)
  const handleDeactivateClick = (subject: Subject) => {
    setSubjectToDeactivate(subject);
    setShowDeactivateConfirm(true);
  };

  const confirmDeactivateSubject = async () => {
    if (!subjectToDeactivate || !currentInstituteId || isDeactivating) return;

    const isCurrentlyActive = subjectToDeactivate.isActive;

    try {
      setIsDeactivating(true);
      if (isCurrentlyActive) {
        await subjectsApi.deactivate(subjectToDeactivate.id, currentInstituteId);
      } else {
        await subjectsApi.activate(subjectToDeactivate.id, currentInstituteId);
      }

      toast({
        title: isCurrentlyActive ? "Subject Deactivated" : "Subject Activated",
        description: `${subjectToDeactivate.name} has been ${isCurrentlyActive ? 'deactivated' : 'activated'}`
      });

      setShowDeactivateConfirm(false);
      setSubjectToDeactivate(null);
      fetchSubjects(true);
    } catch (error: any) {
      console.error(`Error ${isCurrentlyActive ? 'deactivating' : 'activating'} subject:`, error);
      toast({
        title: isCurrentlyActive ? "Deactivate Failed" : "Activate Failed",
        description: error?.message || `Failed to ${isCurrentlyActive ? 'deactivate' : 'activate'} subject`,
        variant: "destructive"
      });
    } finally {
      setIsDeactivating(false);
    }
  };

  // Table columns
  const subjectsColumns = [
    {
      id: 'imgUrl',
      key: 'imgUrl',
      header: 'Image',
      format: (_: any, row: Subject) => (
        <div 
          className="w-14 h-14 rounded-lg overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
          onClick={() => {
            if (row.imgUrl) {
              setPreviewImage({ url: resolveImageUrl(row.imgUrl), title: `${row.name} - Image` });
            }
          }}
        >
          <img
            src={resolveImageUrl(row.imgUrl)}
            alt={row.name ? `Subject ${row.name}` : 'Subject image'}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
          />
        </div>
      )
    },
    {
      key: 'id',
      header: 'Subject ID',
      format: (_: any, row: Subject) => (
        <span className="font-mono text-sm font-semibold">{row.id || 'N/A'}</span>
      )
    },
    {
      key: 'code',
      header: 'Code',
      format: (_: any, row: Subject) => (
        <span className="font-mono text-sm font-medium">{row.code || 'N/A'}</span>
      )
    },
    {
      key: 'name',
      header: 'Subject Name',
      format: (_: any, row: Subject) => row.name || <span className="text-muted-foreground italic">No name</span>
    },
    {
      key: 'category',
      header: 'Category',
      format: (_: any, row: Subject) => row.category ? (
        <Badge variant="outline">{row.category}</Badge>
      ) : (
        <span className="text-muted-foreground italic">N/A</span>
      )
    },
    {
      key: 'subjectType',
      header: 'Type',
      format: (_: any, row: Subject) => {
        const typeOption = SUBJECT_TYPE_OPTIONS.find(o => o.value === row.subjectType);
        return (
          <Badge variant="secondary">{typeOption?.label || row.subjectType || 'N/A'}</Badge>
        );
      }
    },
    {
      key: 'creditHours',
      header: 'Credits',
      format: (_: any, row: Subject) => (
        <span className="font-medium">{row.creditHours || 0}</span>
      )
    },
    {
      key: 'isActive',
      header: 'Status',
      format: (_: any, row: Subject) => (
        <Badge variant={row.isActive ? 'default' : 'secondary'} className={row.isActive ? 'bg-green-600' : 'bg-gray-500'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      format: (_: any, row: Subject) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewSubject(row)}
            title="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>
          
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEdit(row)}
              className="text-blue-600 hover:text-blue-700"
              title="Edit subject"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          
          {canDeactivate && row.isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeactivateClick(row)}
              className="text-orange-600 hover:text-orange-700"
              title="Deactivate subject"
            >
              <PowerOff className="h-4 w-4" />
            </Button>
          )}

          {canDeactivate && !row.isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeactivateClick(row)}
              className="text-green-600 hover:text-green-700"
              title="Activate subject"
            >
              <Power className="h-4 w-4" />
            </Button>
          )}
          
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteClick(row)}
              className="text-red-600 hover:text-red-700"
              title="Delete subject"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )
    }
  ];

  // Show message if no institute selected
  if (!currentInstituteId) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              No Institute Selected
            </CardTitle>
            <CardDescription>
              Please select an institute from the dashboard to manage subjects.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:gap-3">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">
            {pageTitle}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            Manage all {(subjectsLabel || 'subjects').toLowerCase()} for {selectedInstitute?.name || 'this institute'}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {canCreate && (
            <Button onClick={handleOpenCreate} size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3">
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
              <span className="hidden xs:inline">Add</span> {createButtonLabel}
            </Button>
          )}
          
          {canAssignSubjects && (
            <Button variant="secondary" onClick={() => setIsAssignDialogOpen(true)} size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3">
              <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
              <span className="hidden sm:inline">Assign to Class</span>
              <span className="sm:hidden">Assign</span>
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowFilters(!showFilters)}
            className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
          >
            <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
            <span className="hidden xs:inline">Filters</span>
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchSubjects(true)} 
            disabled={isLoading}
            className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button onClick={() => setViewMode('card')} className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Card View"><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setViewMode('table')} className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Table View"><Table2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-3 sm:pt-4 pb-3 sm:pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div>
                <label className="text-xs sm:text-sm font-medium mb-1 block">Search</label>
                <Input 
                  placeholder="Search by code, name..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                />
              </div>
              
              <div>
                <label className="text-xs sm:text-sm font-medium mb-1 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
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
                <label className="text-xs sm:text-sm font-medium mb-1 block">Category</label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card>
          <CardContent className="p-2.5 sm:p-4">
            <div className="text-lg sm:text-xl font-bold">{subjects.length}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5 sm:p-4">
            <div className="text-lg sm:text-xl font-bold text-green-600">
              {subjects.filter(s => s.isActive).length}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5 sm:p-4">
            <div className="text-lg sm:text-xl font-bold text-gray-600">
              {subjects.filter(s => !s.isActive).length}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Inactive</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5 sm:p-4">
            <div className="text-lg sm:text-xl font-bold text-blue-600">
              {categories.length}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Subjects Table / Card View */}
      <div className="w-full overflow-x-auto">
        {viewMode === 'card' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(showAllCards ? filteredSubjects : filteredSubjects.slice(0, CARD_INITIAL_SHOW)).map(subject => {
                const typeOption = SUBJECT_TYPE_OPTIONS.find(o => o.value === subject.subjectType);
                const basketOption = BASKET_CATEGORY_OPTIONS.find(o => o.value === subject.basketCategory);
                const hasLongDesc = (subject.description?.length || 0) > 120;
                const isDescExpanded = expandedSubjectId === subject.id;

                return (
                  <Card key={subject.id} className="hover:shadow-lg hover:border-primary/30 transition-all duration-200 flex flex-col overflow-hidden">
                    {/* Image banner with Gradient Overlay */}
                    <div
                      className="relative h-40 bg-gradient-to-r from-primary to-primary/80 overflow-hidden cursor-pointer rounded-t-lg"
                      onClick={() => {
                        if (subject.imgUrl) setPreviewImage({ url: resolveImageUrl(subject.imgUrl), title: `${subject.name} - Image` });
                      }}
                    >
                      <img
                        src={resolveImageUrl(subject.imgUrl)}
                        alt={subject.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
                      />
                      <div className="absolute top-2 right-2">
                        <Badge variant={subject.isActive ? 'default' : 'secondary'} className={`text-xs ${subject.isActive ? 'bg-green-600' : 'bg-gray-500'}`}>
                          {subject.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>

                    {/* Card body — always visible */}
                    <div className="p-4 flex-1 flex flex-col gap-3">
                      <div>
                        <h3 className="font-semibold text-base truncate line-clamp-2">{subject.name}</h3>
                        <p className="text-[13px] text-muted-foreground font-mono">{subject.code}</p>
                      </div>

                      {/* Badges row */}
                      <div className="flex flex-wrap gap-1">
                        {subject.category && <Badge variant="outline" className="text-[10px]">{subject.category}</Badge>}
                        {subject.subjectType && (
                          <Badge variant="secondary" className="text-[10px]">{typeOption?.label || subject.subjectType}</Badge>
                        )}
                        {subject.basketCategory && (
                          <Badge variant="outline" className="text-[10px] border-purple-500 text-purple-700 dark:text-purple-300">{basketOption?.label || subject.basketCategory}</Badge>
                        )}
                      </div>

                      {/* Info grid — always visible */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <div className="text-muted-foreground">Credits: <span className="text-foreground font-medium">{subject.creditHours ?? 0}</span></div>
                        <div className="text-muted-foreground">Type: <span className="text-foreground font-medium">{typeOption?.label || subject.subjectType || 'N/A'}</span></div>
                      </div>

                      {/* Description — with expand/collapse for long text */}
                      {subject.description && (
                        <div className="text-[13px] text-muted-foreground mt-1">
                          <p className={!isDescExpanded && hasLongDesc ? 'line-clamp-2' : ''}>
                            {subject.description}
                          </p>
                          {hasLongDesc && (
                            <button
                              className="text-primary text-[10px] font-medium mt-0.5 hover:underline"
                              onClick={() => setExpandedSubjectId(isDescExpanded ? null : subject.id)}
                            >
                              {isDescExpanded ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                      {/* Action buttons */}
                      <div className="px-4 py-3 border-t space-y-2 last:rounded-b-lg">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 flex-1 border-primary/30" onClick={() => handleViewSubject(subject)}>
                            <Eye className="h-3 w-3 mr-1" />View
                          </Button>
                          {canEdit && (
                            <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 flex-1 text-blue-600 hover:text-blue-700 border-primary/30" onClick={() => handleOpenEdit(subject)}>
                              <Edit className="h-3 w-3 mr-1" />Edit
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {canDeactivate && (
                            <Button variant="outline" size="sm" className={`h-7 text-[10px] px-2 flex-1 border-primary/30 ${subject.isActive ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}`} onClick={() => handleDeactivateClick(subject)}>
                              {subject.isActive ? <><PowerOff className="h-3 w-3 mr-1" />Deactivate</> : <><Power className="h-3 w-3 mr-1" />Activate</>}
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 flex-1 text-destructive hover:text-destructive border-primary/30" onClick={() => handleDeleteClick(subject)}>
                              <Trash2 className="h-3 w-3 mr-1" />Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                );
              })}
            </div>

            {/* Show More / Show Less toggle */}
            {filteredSubjects.length > CARD_INITIAL_SHOW && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllCards(!showAllCards)}
                  className="gap-1.5"
                >
                  {showAllCards ? (
                    <><ChevronsDownUp className="h-4 w-4" />Show Less ({CARD_INITIAL_SHOW} of {filteredSubjects.length})</>
                  ) : (
                    <><ChevronsUpDown className="h-4 w-4" />Show All ({filteredSubjects.length} subjects)</>
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <MUITable
            title={pageTitle}
            data={filteredSubjects}
            columns={subjectsColumns.map(col => ({
              id: col.key,
              label: col.header,
              minWidth: col.key === 'actions' ? 180 : col.key === 'name' ? 200 : 120,
              format: col.format
            }))}
            page={0}
            rowsPerPage={50}
            totalCount={filteredSubjects.length}
            onPageChange={() => {}}
            onRowsPerPageChange={() => {}}
            sectionType="subjects"
          />
        )}
      </div>

      {/* Create Subject Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} routeName="create-subject-popup">
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New {createButtonLabel}</DialogTitle>
            <DialogDescription>
              Add a new {createButtonLabel.toLowerCase()} to the institute
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Subject Image (4:3 ratio)</Label>
              <SubjectImageUpload
                value={createImageUrl}
                onChange={(url) => setCreateImageUrl(url)}
                onRemove={() => setCreateImageUrl('')}
                uploadImmediately={false}
                uploadRef={createImageUploadRef}
              />
              <p className="text-sm text-muted-foreground">
                Recommended: 4:3 aspect ratio, max 5MB (JPG, PNG, WebP)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code *</Label>
                <Input 
                  value={createForm.code}
                  onChange={e => setCreateForm({ ...createForm, code: e.target.value })}
                  placeholder="e.g., MATH101"
                />
              </div>
              <div>
                <Label>Name *</Label>
                <Input 
                  value={createForm.name}
                  onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g., Mathematics"
                />
              </div>
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea 
                value={createForm.description}
                onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Subject description..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Input 
                  value={createForm.category}
                  onChange={e => setCreateForm({ ...createForm, category: e.target.value })}
                  placeholder="e.g., Science"
                  list="create-category-options"
                />
                <datalist id="create-category-options">
                  <option value="Science" />
                  <option value="Mathematics" />
                  <option value="Languages" />
                  <option value="Arts" />
                  <option value="Commerce" />
                  <option value="Technology" />
                  <option value="Humanities" />
                  <option value="Religion" />
                  <option value="Physical Education" />
                </datalist>
              </div>
              <div>
                <Label>Credit Hours</Label>
                <Input 
                  type="number"
                  min={0}
                  value={createForm.creditHours}
                  onChange={e => setCreateForm({ ...createForm, creditHours: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subject Type</Label>
                <Input 
                  value={createForm.subjectType}
                  onChange={e => setCreateForm({ ...createForm, subjectType: e.target.value })}
                  placeholder="Type or select subject type"
                  list="create-subject-type-options"
                />
                <datalist id="create-subject-type-options">
                  {SUBJECT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </datalist>
                <p className="text-[13px] text-muted-foreground mt-1">
                  {SUBJECT_TYPE_OPTIONS.find(o => o.value === createForm.subjectType)?.description || 'Enter custom type or select from suggestions'}
                </p>
              </div>
              
              {requiresBasketCategory(createForm.subjectType || '') && (
                <div>
                  <Label>Basket Category *</Label>
                  <Input 
                    value={createForm.basketCategory || ''}
                    onChange={e => setCreateForm({ ...createForm, basketCategory: e.target.value })}
                    placeholder="Type or select basket category"
                    list="create-basket-category-options"
                  />
                  <datalist id="create-basket-category-options">
                    {BASKET_CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </datalist>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    Required for basket subject types
                  </p>
                </div>
              )}
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Enable this subject for students and classes
                </p>
              </div>
              <Switch
                checked={createForm.isActive}
                onCheckedChange={(checked) => setCreateForm({ ...createForm, isActive: checked })}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubject} disabled={isCreating}>
              {isCreating ? 'Creating...' : `Create ${createButtonLabel}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Subject Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} routeName="edit-subject-popup">
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>
              Update subject details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Subject Image (4:3 ratio)</Label>
              <SubjectImageUpload
                value={editImageUrl}
                onChange={(url) => setEditImageUrl(url)}
                onRemove={() => setEditImageUrl('')}
              />
              <p className="text-sm text-muted-foreground">
                Recommended: 4:3 aspect ratio, max 5MB (JPG, PNG, WebP)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code *</Label>
                <Input 
                  value={editForm.code}
                  onChange={e => setEditForm({ ...editForm, code: e.target.value })}
                  placeholder="e.g., MATH101"
                />
              </div>
              <div>
                <Label>Name *</Label>
                <Input 
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="e.g., Mathematics"
                />
              </div>
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea 
                value={editForm.description}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Subject description..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Input 
                  value={editForm.category}
                  onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                  placeholder="e.g., Science"
                  list="edit-category-options"
                />
                <datalist id="edit-category-options">
                  <option value="Science" />
                  <option value="Mathematics" />
                  <option value="Languages" />
                  <option value="Arts" />
                  <option value="Commerce" />
                  <option value="Technology" />
                  <option value="Humanities" />
                  <option value="Religion" />
                  <option value="Physical Education" />
                </datalist>
              </div>
              <div>
                <Label>Credit Hours</Label>
                <Input 
                  type="number"
                  min={0}
                  value={editForm.creditHours}
                  onChange={e => setEditForm({ ...editForm, creditHours: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subject Type</Label>
                <Input 
                  value={editForm.subjectType}
                  onChange={e => setEditForm({ ...editForm, subjectType: e.target.value })}
                  placeholder="Type or select subject type"
                  list="edit-subject-type-options"
                />
                <datalist id="edit-subject-type-options">
                  {SUBJECT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </datalist>
                <p className="text-[13px] text-muted-foreground mt-1">
                  {SUBJECT_TYPE_OPTIONS.find(o => o.value === editForm.subjectType)?.description || 'Enter custom type or select from suggestions'}
                </p>
              </div>
              
              {requiresBasketCategory(editForm.subjectType || '') && (
                <div>
                  <Label>Basket Category *</Label>
                  <Input 
                    value={editForm.basketCategory || ''}
                    onChange={e => setEditForm({ ...editForm, basketCategory: e.target.value })}
                    placeholder="Type or select basket category"
                    list="edit-basket-category-options"
                  />
                  <datalist id="edit-basket-category-options">
                    {BASKET_CATEGORY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </datalist>
                  <p className="text-[13px] text-muted-foreground mt-1">
                    Required for basket subject types
                  </p>
                </div>
              )}
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Enable this subject for students and classes
                </p>
              </div>
              <Switch
                checked={editForm.isActive}
                onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSubject} disabled={isUpdating}>
              {isUpdating ? 'Updating...' : 'Update Subject'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Subject Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen} routeName="subject-details-popup">
        <DialogContent className="w-[95vw] max-w-4xl max-h-[93vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted border border-border/50 shrink-0">
                <img
                  src={resolveImageUrl(selectedSubject?.imgUrl)}
                  alt={selectedSubject?.name || 'Subject image'}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
                />
              </div>
              <div>
                <p className="font-bold text-base leading-tight">{selectedSubject?.name || 'Subject Details'}</p>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">{selectedSubject?.code || 'No code'}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedSubject && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Overview <span className="flex-1 h-px bg-border/40" /></p>
                <div className="divide-y divide-border/40">
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Code</span>
                    <span className="text-sm font-mono font-semibold text-primary">{selectedSubject.code || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Category</span>
                    <span className="text-sm font-medium">{selectedSubject.category || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Credit Hours</span>
                    <span className="text-sm font-medium">{selectedSubject.creditHours || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className={`text-xs font-semibold ${selectedSubject.isActive ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>{selectedSubject.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              </div>

              {selectedSubject.description && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Description <span className="flex-1 h-px bg-border/40" /></p>
                  <p className="text-sm leading-6">{selectedSubject.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Configuration <span className="flex-1 h-px bg-border/40" /></p>
                <div className="divide-y divide-border/40">
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Subject Type</span>
                    <span className="text-sm font-medium">
                      {SUBJECT_TYPE_OPTIONS.find(o => o.value === selectedSubject.subjectType)?.label || selectedSubject.subjectType || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-3.5">
                    <span className="text-sm text-muted-foreground">Basket Category</span>
                    <span className="text-sm font-medium">
                      {BASKET_CATEGORY_OPTIONS.find(o => o.value === selectedSubject.basketCategory)?.label || selectedSubject.basketCategory || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {canEdit && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsViewDialogOpen(false);
                      handleOpenEdit(selectedSubject);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Subject
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => !isDeleting && setShowDeleteConfirm(open)}
        itemName={subjectToDelete?.name || ''}
        itemType="subject"
        onConfirm={confirmDeleteSubject}
        isDeleting={isDeleting}
        routeName="delete-subject-confirmation-popup"
      />

      {/* Deactivate / Activate Confirmation */}
      <AlertDialog open={showDeactivateConfirm} onOpenChange={(open) => !isDeactivating && setShowDeactivateConfirm(open)} routeName="deactivate-subject-confirmation-popup">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {subjectToDeactivate?.isActive ? 'Deactivate Subject' : 'Activate Subject'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {subjectToDeactivate?.isActive ? (
                <>
                  Are you sure you want to deactivate <strong>{subjectToDeactivate?.name}</strong>?
                  <br /><br />
                  The subject will be hidden but can be reactivated later.
                </>
              ) : (
                <>
                  Are you sure you want to activate <strong>{subjectToDeactivate?.name}</strong>?
                  <br /><br />
                  The subject will become visible and available for classes.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivateSubject}
              disabled={isDeactivating}
              className={subjectToDeactivate?.isActive ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}
            >
              {isDeactivating
                ? (subjectToDeactivate?.isActive ? 'Deactivating...' : 'Activating...')
                : (subjectToDeactivate?.isActive ? 'Deactivate Subject' : 'Activate Subject')
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)} routeName="preview-subject-image-popup">
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

      {/* Assign Subject to Class Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen} routeName="assign-subjects-to-class-popup">
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign {subjectsLabel} to Class</DialogTitle>
            <DialogDescription>
              Select a class and assign {subjectsLabel.toLowerCase()} with optional default teacher
            </DialogDescription>
          </DialogHeader>
          <AssignSubjectToClassForm
            onSuccess={() => {
              setIsAssignDialogOpen(false);
              fetchSubjects(true);
            }}
            onCancel={() => setIsAssignDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstituteSubjects;
