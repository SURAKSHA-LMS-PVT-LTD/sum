import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MUITable from '@/components/ui/mui-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, FileText, Plus, Filter, Calendar, Clock, ExternalLink, BarChart3, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CreateExamForm from '@/components/forms/CreateExamForm';
import CreateResultsForm from '@/components/forms/CreateResultsForm';
import { UpdateExamForm } from '@/components/forms/UpdateExamForm';
import { useTableData } from '@/hooks/useTableData';
interface TeacherExam {
  id: string;
  instituteId: string;
  classId: string;
  subjectId: string;
  title: string;
  description: string;
  examType: 'online' | 'physical';
  durationMinutes: number;
  totalMarks: string;
  passingMarks: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  venue?: string;
  examLink?: string;
  instructions?: string;
  status: 'scheduled' | 'draft' | 'completed' | 'cancelled';
  createdBy: string;
  toWhom: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  institute: {};
  class: {};
  subject: {};
  creator: {};
}
interface Column {
  id: 'title' | 'examType' | 'durationMinutes' | 'totalMarks' | 'scheduleDate' | 'venue' | 'status' | 'actions';
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  format?: (value: any, row?: TeacherExam) => React.ReactNode;
}
const TeacherExams = () => {
  const navigate = useNavigate();
  const {
    user,
    selectedInstitute,
    selectedClass,
    selectedSubject
  } = useAuth();
  const { subjectLabel } = useInstituteLabels();
  const effectiveRole = useInstituteRole();
  const {
    toast
  } = useToast();
  const canCreateEdit = ['InstituteAdmin', 'Teacher'].includes(effectiveRole);
  const [showFilters, setShowFilters] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateResultsDialogOpen, setIsCreateResultsDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<TeacherExam | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Role check - only teachers can access this component
  if (effectiveRole !== 'Teacher') {
    return <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">
          Access denied. This section is only available for teachers.
        </p>
      </div>;
  }

  // Table data hook with pagination
  const tableData = useTableData<TeacherExam>({
    endpoint: '/institute-class-subject-exams',
    defaultParams: {
      instituteId: selectedInstitute?.id,
      classId: selectedClass?.id,
      subjectId: selectedSubject?.id,
      teacherId: user?.id
    },
    dependencies: [],
    // Remove dependencies to prevent auto-reloading on context changes
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
        autoLoad: true, // Enable auto-loading from cache // Keep disabled
  });
  const {
    state: {
      data: exams,
      loading
    },
    pagination,
    actions
  } = tableData;
  const examsColumns = [{
    key: 'title',
    header: 'Title',
    render: (value: string, row: TeacherExam) => <div>
          <div className="font-medium">{value}</div>
          <div className="text-sm text-muted-foreground truncate">{row?.description || ''}</div>
        </div>
  }, {
    key: 'examType',
    header: 'Type',
    render: (value: string) => <Badge variant={value === 'online' ? 'default' : 'secondary'}>
          {value}
        </Badge>
  }, {
    key: 'durationMinutes',
    header: 'Duration (min)',
    render: (value: number) => `${value} minutes`
  }, {
    key: 'totalMarks',
    header: 'Total Marks'
  }, {
    key: 'passingMarks',
    header: 'Passing Marks'
  }, {
    key: 'scheduleDate',
    header: 'Schedule Date',
    render: (value: string) => value ? new Date(value).toLocaleDateString() : 'Not set'
  }, {
    key: 'startTime',
    header: 'Start Time',
    render: (value: string) => value ? new Date(value).toLocaleString() : 'Not set'
  }, {
    key: 'endTime',
    header: 'End Time',
    render: (value: string) => value ? new Date(value).toLocaleString() : 'Not set'
  }, {
    key: 'venue',
    header: 'Venue'
  }, {
    key: 'examLink',
    header: 'Exam Link',
    render: (value: string, row: any) => value ? <Button size="sm" variant="destructive" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => window.open(value, '_blank')}>
          <ExternalLink className="h-3 w-3 mr-1" />
          Exam Link
        </Button> : <span className="text-muted-foreground">No link</span>
  }, {
    key: 'status',
    header: 'Status',
    render: (value: string) => <Badge variant={value === 'scheduled' ? 'default' : value === 'draft' ? 'secondary' : value === 'completed' ? 'outline' : 'destructive'}>
          {value}
        </Badge>
  }, ...(['InstituteAdmin', 'Teacher'].includes(effectiveRole) ? [{
    key: 'createResults',
    header: 'Create Results',
    render: (value: any, row: TeacherExam) => <Button size="sm" variant="outline" onClick={() => {
      if (!selectedInstitute?.id || !selectedClass?.id || !selectedSubject?.id) {
        toast({
          title: "Missing Context",
          description: "Please select institute, class, and subject first",
          variant: "destructive"
        });
        return;
      }
      navigate(`/institute/${selectedInstitute.id}/class/${selectedClass.id}/subject/${selectedSubject.id}/exam/${row.id}/create-results`);
    }} className="flex items-center gap-2">
          <BarChart3 className="h-3 w-3" />
          Create
        </Button>
  }] : []), {
    key: 'results',
    header: 'View Results',
    render: (value: any, row: TeacherExam) => <Button size="sm" variant="default" onClick={() => handleViewResults(row)} className="flex items-center gap-2">
          <Eye className="h-3 w-3" />
          View
        </Button>
  }];
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'scheduled':
        return 'default';
      case 'draft':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };
  const handleCreateResults = () => {
    console.log('Create results clicked');
    setIsCreateResultsDialogOpen(true);
  };
  const handleViewResults = (exam: TeacherExam) => {
    // 🛡️ SECURE: Use full hierarchical URL
    if (!selectedInstitute?.id || !selectedClass?.id || !selectedSubject?.id) {
      toast({
        title: "Missing Context",
        description: "Please select institute, class, and subject first",
        variant: "destructive"
      });
      return;
    }
    
    navigate(`/institute/${selectedInstitute.id}/class/${selectedClass.id}/subject/${selectedSubject.id}/exam/${exam.id}/results`);
  };
  const handleEditExam = (exam: TeacherExam) => {
    setSelectedExam(exam);
    setIsUpdateDialogOpen(true);
  };
  const handleUpdateExam = () => {
    setIsUpdateDialogOpen(false);
    setSelectedExam(null);
    actions.refresh();
  };
  const handleLoadData = () => {
    actions.loadData();
  };
  const handleRefreshData = () => {
    actions.refresh();
    setLastRefresh(new Date());
  };
  const filteredExams = exams.filter(exam => {
    const matchesSearch = !searchTerm || exam.title.toLowerCase().includes(searchTerm.toLowerCase()) || exam.description.toLowerCase().includes(searchTerm.toLowerCase()) || exam.venue && exam.venue.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || exam.status === statusFilter;
    const matchesType = typeFilter === 'all' || exam.examType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });
  const getCurrentSelection = () => {
    const parts = [];
    if (selectedInstitute) parts.push(`Institute: ${selectedInstitute.name}`);
    if (selectedClass) parts.push(`Class: ${selectedClass.name}`);
    if (selectedSubject) parts.push(`Subject: ${selectedSubject.name}`);
    return parts.join(' → ');
  };
  if (!selectedInstitute || !selectedClass || !selectedSubject) {
    return <div className="container mx-auto p-6 space-y-6">
        <div className="text-center py-12">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-4">
            Select {subjectLabel}
          </h2>
          <p className="text-muted-foreground">
            Please select an institute, class, and {subjectLabel.toLowerCase()} to view your exams.
          </p>
        </div>
      </div>;
  }
  return <div className="container mx-auto p-6 space-y-6">
      <>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              My Subject Exams
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Current Selection: {getCurrentSelection()}
            </p>
            {lastRefresh && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Last refreshed: {lastRefresh.toLocaleTimeString()}
              </p>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button onClick={handleRefreshData} disabled={loading} variant="outline" size="sm">
              {loading ? <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </> : <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Data
                </>}
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        {showFilters && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Search Exams
              </label>
              <Input placeholder="Search exams..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full" />
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
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Type
              </label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="physical">Physical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={() => {
            setSearchTerm('');
            setStatusFilter('all');
            setTypeFilter('all');
          }} className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>}

        {/* Add Create Buttons */}
        {canCreateEdit && <div className="flex justify-end gap-2 mb-4">
            
            <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Exam
            </Button>
          </div>}

        {/* MUI Table View */}
        <MUITable title="" data={exams} columns={examsColumns.map(col => ({
        id: col.key,
        label: col.header,
        minWidth: 170,
        format: col.render
      }))} onAdd={undefined} onEdit={handleEditExam} onView={undefined} page={pagination.page} rowsPerPage={pagination.limit} totalCount={pagination.totalCount} onPageChange={newPage => actions.setPage(newPage)} onRowsPerPageChange={newLimit => {
        actions.setLimit(newLimit);
        actions.setPage(0);
      }} />
      </>

      {/* Create Exam Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Exam</DialogTitle>
          </DialogHeader>
          <CreateExamForm onClose={() => setIsCreateDialogOpen(false)} onSuccess={() => {
          setIsCreateDialogOpen(false);
          actions.refresh();
        }} />
        </DialogContent>
      </Dialog>

      {/* Create Results Dialog */}
      <Dialog open={isCreateResultsDialogOpen} onOpenChange={setIsCreateResultsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Exam Results</DialogTitle>
          </DialogHeader>
          <CreateResultsForm onClose={() => setIsCreateResultsDialogOpen(false)} onSuccess={() => {
          setIsCreateResultsDialogOpen(false);
          actions.refresh();
        }} />
        </DialogContent>
      </Dialog>

      {/* Update Exam Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Exam</DialogTitle>
          </DialogHeader>
          {selectedExam && <UpdateExamForm exam={selectedExam} onClose={() => setIsUpdateDialogOpen(false)} onSuccess={handleUpdateExam} />}
        </DialogContent>
      </Dialog>

    </div>;
};
export default TeacherExams;