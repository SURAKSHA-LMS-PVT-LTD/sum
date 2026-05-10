import React, { useState, useMemo } from 'react';
import DataTable from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DataCardView } from '@/components/ui/data-card-view';
import { RefreshCw, Filter, Eye, Edit, Trash2 } from 'lucide-react';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { AccessControl } from '@/utils/permissions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import CreateTeacherForm from '@/components/forms/CreateTeacherForm';
import TeacherProfile from '@/components/TeacherProfile';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';

const Teachers = () => {
  const { user, selectedInstitute, selectedClass, selectedSubject, currentInstituteId, currentClassId, currentSubjectId } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [teachersData, setTeachersData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const userRole = useInstituteRole();

  const handleLoadData = async (forceRefresh = false) => {
    if (!currentInstituteId) {
      toast({
        title: "No Institute Selected",
        description: "Please select an institute first.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    console.log('Loading teachers data...');
    console.log(`Current context - Institute: ${selectedInstitute?.name}, Class: ${selectedClass?.name}, Subject: ${selectedSubject?.name}`);
    
    try {
      const apiData = await enhancedCachedClient.get(
        `/institute-users/institute/${currentInstituteId}/teachers`,
        {},
        {
          ttl: CACHE_TTL.TEACHERS,
          forceRefresh,
          userId: user?.id,
          instituteId: currentInstituteId,
          role: userRole
        }
      );
      
      console.log('API Response:', apiData);
      
      const dataArray = Array.isArray(apiData) ? apiData : [];
      
      // Transform the API data to match the expected format
      const transformedData = dataArray.map((item: any) => ({
        id: item.userId,
        employeeId: item.userIdByInstitute || `EMP${item.userId}`,
        name: item.user?.name ?? 'N/A',
        email: item.user?.email ?? 'N/A',
        phone: item.user?.phoneNumber || 'N/A',
        subjects: 'N/A',
        classes: 'N/A',
        qualification: 'N/A',
        experience: 'N/A',
        joinDate: item.user?.createdAt ? new Date(item.user.createdAt).toLocaleDateString() : 'N/A',
        status: item.status,
        imageUrl: item.user?.imageUrl
      }));

      // Apply client-side filters
      let filteredData = transformedData;
      
      if (searchTerm) {
        filteredData = filteredData.filter((teacher: any) =>
          teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      if (statusFilter !== 'all') {
        filteredData = filteredData.filter((teacher: any) => teacher.status === statusFilter);
      }
      
      setTeachersData(filteredData);
      setDataLoaded(true);
    } catch (error: any) {
      console.error('Error loading teachers:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load teachers data.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const allColumnDefs: ColumnDef[] = useMemo(() => [
    { key: 'employeeId', header: 'Employee ID', locked: true, defaultVisible: true, defaultWidth: 130, minWidth: 90 },
    { key: 'name', header: 'Full Name', defaultVisible: true, defaultWidth: 180, minWidth: 120 },
    { key: 'email', header: 'Email', defaultVisible: true, defaultWidth: 200, minWidth: 140 },
    { key: 'phone', header: 'Phone', defaultVisible: true, defaultWidth: 150, minWidth: 110 },
    { key: 'subjects', header: 'Subjects', defaultVisible: false, defaultWidth: 150, minWidth: 100 },
    { key: 'classes', header: 'Classes', defaultVisible: false, defaultWidth: 150, minWidth: 100 },
    { key: 'qualification', header: 'Qualification', defaultVisible: false, defaultWidth: 150, minWidth: 100 },
    { key: 'experience', header: 'Experience', defaultVisible: false, defaultWidth: 130, minWidth: 90 },
    { key: 'joinDate', header: 'Join Date', defaultVisible: false, defaultWidth: 130, minWidth: 100 },
    { 
      key: 'status', 
      header: 'Status',
      defaultVisible: true,
      defaultWidth: 120,
      minWidth: 90,
      render: (value: any) => (
        <Badge variant={
          value === 'Active' || value === 'ACTIVE' ? 'default' : 
          value === 'On Leave' ? 'secondary' : 
          'destructive'
        }>
          {value}
        </Badge>
      )
    }
  ], []);

  const { colState, visibleColumns, toggleColumn, setColumnWidth, resetColumns } = useColumnConfig(allColumnDefs, 'teachers');

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

  const handleAddTeacher = () => {
    console.log('Add new teacher');
  };

  const handleEditTeacher = (teacher: any) => {
    console.log('Edit teacher:', teacher);
    setSelectedTeacher(teacher);
    setIsEditDialogOpen(true);
  };

  const handleUpdateTeacher = (teacherData: any) => {
    console.log('Updating teacher:', teacherData);
    
    // In real scenario, would include context in request body:
    // const requestBody = buildRequestBody(teacherData);
    
    toast({
      title: "Teacher Updated",
      description: `Teacher ${teacherData.name} has been updated successfully.`
    });
    setIsEditDialogOpen(false);
    setSelectedTeacher(null);
  };

  const handleDeleteTeacher = (teacher: any) => {
    setDeleteDialog({ open: true, item: teacher });
  };
  const confirmDeleteTeacher = async () => {
    if (!deleteDialog.item) return;
    setIsDeleting(true);
    try {
      toast({ title: "Teacher Deleted", description: `Teacher ${deleteDialog.item.name} has been deleted.`, variant: "destructive" });
      setDeleteDialog({ open: false, item: null });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewTeacher = (teacher: any) => {
    console.log('View teacher details:', teacher);
    toast({
      title: "View Teacher",
      description: `Viewing teacher: ${teacher.name}`
    });
  };

  const handleCreateTeacher = (teacherData: any) => {
    console.log('Creating teacher:', teacherData);
    
    // In real scenario, would include context in request body:
    // const requestBody = buildRequestBody(teacherData);
    
    toast({
      title: "Teacher Created",
      description: `Teacher ${teacherData.name} has been created successfully.`
    });
    setIsCreateDialogOpen(false);
  };

  const canAdd = AccessControl.hasPermission(userRole, 'create-teacher');
  const canEdit = AccessControl.hasPermission(userRole, 'edit-teacher');
  const canDelete = AccessControl.hasPermission(userRole, 'delete-teacher');

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
    
    let title = 'Teachers Management';
    if (contexts.length > 0) {
      title += ` (${contexts.join(' → ')})`;
    }
    
    return title;
  };

  const customActions = [
    {
      label: 'View',
      action: (teacher: any) => handleViewTeacher(teacher),
      icon: <Eye className="h-3 w-3" />,
      variant: 'outline' as const
    },
    ...(canEdit ? [{
      label: 'Edit',
      action: (teacher: any) => handleEditTeacher(teacher),
      icon: <Edit className="h-3 w-3" />,
      variant: 'outline' as const
    }] : []),
    ...(canDelete ? [{
      label: 'Delete',
      action: (teacher: any) => handleDeleteTeacher(teacher),
      icon: <Trash2 className="h-3 w-3" />,
      variant: 'destructive' as const
    }] : [])
  ];

  return (
    <div className="space-y-6">
      {!dataLoaded ? (
        <div className="text-center py-12">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {getContextTitle()}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Click the button below to load teachers data
          </p>
          <Button 
            onClick={() => handleLoadData(false)} 
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading Data...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Load Data
              </>
            )}
          </Button>
        </div>
      ) : (
        <>
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {getContextTitle()}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage teaching staff, assignments, and professional information
            </p>
          </div>

          {/* Show Teacher Profile when institute, class, and subject are selected */}
          {currentInstituteId && currentClassId && currentSubjectId && (
            <div className="mb-6">
              <TeacherProfile 
                instituteId={currentInstituteId}
                classId={currentClassId}
                subjectId={currentSubjectId}
              />
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="md:hidden flex items-center gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="md:hidden flex flex-col max-h-[80vh] rounded-t-2xl">
                  <SheetHeader>
                    <SheetTitle>Filter Teachers</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto py-4">
                    <div className="space-y-4 px-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                          Search Teachers
                        </label>
                        <Input
                          placeholder="Search teachers..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                          Status
                        </label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="All Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchTerm('');
                          setStatusFilter('all');
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
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="hidden md:flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </div>
            
            <Button 
              onClick={() => handleLoadData(true)} 
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border mb-6">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Search Teachers
                </label>
                <Input
                  placeholder="Search teachers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
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
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="On Leave">On Leave</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Subject
                </label>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    <SelectItem value="Mathematics">Mathematics</SelectItem>
                    <SelectItem value="Physics">Physics</SelectItem>
                    <SelectItem value="Chemistry">Chemistry</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Mobile View Content - Always Card View */}
          <div className="md:hidden">
            <DataCardView
              data={teachersData}
              columns={tableColumns}
              customActions={customActions}
              allowEdit={false}
              allowDelete={false}
            />
          </div>

          {/* Desktop View */}
          <div className="hidden md:block">
            <DataTable
              title="Teachers"
              data={teachersData}
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
              onAdd={canAdd ? () => setIsCreateDialogOpen(true) : undefined}
              onEdit={canEdit ? handleEditTeacher : undefined}
              onDelete={canDelete ? handleDeleteTeacher : undefined}
              onView={handleViewTeacher}
              searchPlaceholder="Search teachers..."
              allowAdd={canAdd}
              allowEdit={canEdit}
              allowDelete={canDelete}
            />
          </div>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Teacher</DialogTitle>
          </DialogHeader>
          <CreateTeacherForm
            onSubmit={handleCreateTeacher}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
          </DialogHeader>
          <CreateTeacherForm
            initialData={selectedTeacher}
            onSubmit={handleUpdateTeacher}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setSelectedTeacher(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        itemName={deleteDialog.item?.name || ''}
        itemType="teacher"
        onConfirm={confirmDeleteTeacher}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default Teachers;
