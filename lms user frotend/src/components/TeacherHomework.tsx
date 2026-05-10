import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MUITable from '@/components/ui/mui-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, BookOpen, Plus, Filter, FileText, Edit, Eye, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CreateHomeworkForm from '@/components/forms/CreateHomeworkForm';
import UpdateHomeworkForm from '@/components/forms/UpdateHomeworkForm';
import { useTableData } from '@/hooks/useTableData';

interface TeacherHomework {
  id: string;
  instituteId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description: string;
  startDate: string;
  endDate?: string;
  referenceLink?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  institute: {
    id: string;
    name: string;
  };
  class: {
    id: string;
    name: string;
  };
  subject: {
    id: string;
    name: string;
  };
  teacher: {
    id: string;
    name: string;
    email: string;
  };
}

interface Column {
  id: 'title' | 'startDate' | 'endDate' | 'referenceLink' | 'isActive' | 'actions';
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  format?: (value: any, row?: TeacherHomework) => React.ReactNode;
}

const TeacherHomework = () => {
  const navigate = useNavigate();
  const { user, selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const { subjectLabel } = useInstituteLabels();
  const effectiveRole = useInstituteRole();
  const { toast } = useToast();
  
  const [showFilters, setShowFilters] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState<TeacherHomework | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Role check - only teachers can access this component
  if (effectiveRole !== 'Teacher') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">
          Access denied. This section is only available for teachers.
        </p>
      </div>
    );
  }

  // Table data hook with pagination
  const tableData = useTableData<TeacherHomework>({
    endpoint: '/institute-class-subject-homeworks',
    defaultParams: {
      instituteId: selectedInstitute?.id,
      classId: selectedClass?.id,
      subjectId: selectedSubject?.id,
      teacherId: user?.id
    },
    dependencies: [], // Remove dependencies to prevent auto-reloading on context changes
    pagination: { defaultLimit: 50, availableLimits: [25, 50, 100] },
    autoLoad: true, // Enable auto-loading from cache
  });

  const { state: { data: homework, loading }, pagination, actions } = tableData;

  const homeworkColumns = [
    {
      key: 'title',
      header: 'Title',
      render: (value: string, row: TeacherHomework) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-sm text-muted-foreground truncate">{row?.description || ''}</div>
        </div>
      )
    },
    {
      key: 'startDate',
      header: 'Start Date',
      render: (value: string) => value ? new Date(value).toLocaleDateString() : 'N/A'
    },
    {
      key: 'endDate',
      header: 'Due Date',
      render: (value: string | undefined) => value ? new Date(value).toLocaleDateString() : '-'
    },
    {
      key: 'referenceLink',
      header: 'Reference',
      render: (value: string | undefined) => value ? (
        <Button
          size="sm"
          variant="default"
          className="bg-blue-900 hover:bg-blue-800 text-white"
          onClick={() => window.open(value, '_blank', 'noopener,noreferrer')}
        >
          <FileText className="h-3 w-3 mr-1" />
          Reference
        </Button>
      ) : (
        <span className="text-muted-foreground">No reference</span>
      )
    },
    {
      key: 'submissions',
      header: 'Submissions',
      render: (value: any, row: TeacherHomework) => (
        <Button
          size="sm"
          variant="default"
          onClick={() => handleViewSubmissions(row)}
          className="flex items-center gap-2"
        >
          <Eye className="h-3 w-3" />
          View
        </Button>
      )
    }
  ];

  const customActions = [
    {
      label: '',
      action: (homework: any) => handleEditHomework(homework),
      icon: <Edit className="h-4 w-4" />,
      variant: 'outline' as const,
      tooltip: 'Edit homework',
      show: ['InstituteAdmin', 'Teacher'].includes(effectiveRole)
    }
  ].filter(action => action.show !== false);
  
  const canCreateEdit = ['InstituteAdmin', 'Teacher'].includes(effectiveRole);

  const handleEditHomework = (homework: TeacherHomework) => {
    setSelectedHomework(homework);
    setIsUpdateDialogOpen(true);
  };

  const handleViewSubmissions = (homework: TeacherHomework) => {
    // 🛡️ SECURE: Use full hierarchical URL
    if (!selectedInstitute?.id || !selectedClass?.id || !selectedSubject?.id) {
      toast({
        title: "Missing Context",
        description: "Please select institute, class, and subject first",
        variant: "destructive"
      });
      return;
    }
    
    navigate(`/institute/${selectedInstitute.id}/class/${selectedClass.id}/subject/${selectedSubject.id}/homework/${homework.id}/submissions`);
  };

  const handleUpdateHomework = () => {
    setIsUpdateDialogOpen(false);
    setSelectedHomework(null);
    actions.refresh();
  };

  const handleLoadData = () => {
    actions.loadData();
  };

  const handleRefreshData = () => {
    actions.refresh();
    setLastRefresh(new Date());
  };

  const filteredHomework = homework.filter(hw => {
    const matchesSearch = !searchTerm || 
      hw.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hw.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && hw.isActive) || 
      (statusFilter === 'inactive' && !hw.isActive);
    
    return matchesSearch && matchesStatus;
  });

  const getCurrentSelection = () => {
    const parts = [];
    if (selectedInstitute) parts.push(`Institute: ${selectedInstitute.name}`);
    if (selectedClass) parts.push(`Class: ${selectedClass.name}`);
    if (selectedSubject) parts.push(`Subject: ${selectedSubject.name}`);
    return parts.join(' → ');
  };

  if (!selectedInstitute || !selectedClass || !selectedSubject) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center py-12">
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-4">
            Select {subjectLabel}
          </h2>
          <p className="text-muted-foreground">
            Please select an institute, class, and {subjectLabel.toLowerCase()} to view homework.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              My Subject Homework
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Current Selection: {getCurrentSelection()}
            </p>
            {lastRefresh && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Last refreshed: {lastRefresh.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button 
              onClick={handleRefreshData} 
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
                  Refresh Data
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Search Homework
              </label>
              <Input
                placeholder="Search homework..."
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
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end col-span-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {/* Add Create Button */}
        {canCreateEdit && (
          <div className="flex justify-end gap-2 mb-4">
            <Button 
              onClick={() => setIsCreateDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Homework
            </Button>
          </div>
        )}

        {/* MUI Table View */}
        <MUITable
          title=""
          data={homework}
          columns={homeworkColumns.map(col => ({
            id: col.key,
            label: col.header,
            minWidth: 170,
            format: col.render
          }))}
          onAdd={undefined}
          onEdit={undefined}
          onView={undefined}
          page={pagination.page}
          rowsPerPage={pagination.limit}
          totalCount={pagination.totalCount}
          onPageChange={(newPage) => actions.setPage(newPage)}
          onRowsPerPageChange={(newLimit) => {
            actions.setLimit(newLimit);
            actions.setPage(0);
          }}
          customActions={customActions}
        />
      </>

      {/* Create Homework Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Homework</DialogTitle>
          </DialogHeader>
          <CreateHomeworkForm
            onClose={() => setIsCreateDialogOpen(false)}
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              actions.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Update Homework Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Homework</DialogTitle>
          </DialogHeader>
          {selectedHomework && (
            <UpdateHomeworkForm
              homework={selectedHomework}
              onClose={() => setIsUpdateDialogOpen(false)}
              onSuccess={handleUpdateHomework}
            />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default TeacherHomework;