import React, { useState } from 'react';
import MUITable from '@/components/ui/mui-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Filter, Plus, Video, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CreateLectureForm from '@/components/forms/CreateLectureForm';
import UpdateLectureForm from '@/components/forms/UpdateLectureForm';
import { useTableData } from '@/hooks/useTableData';
import { cachedApiClient } from '@/api/cachedClient';
import VideoPreviewDialog from '@/components/VideoPreviewDialog';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';

interface TeacherLecture {
  id: string;
  instituteId: string;
  classId: string;
  subjectId: string;
  instructorId: string;
  title: string;
  description: string;
  lectureType: 'physical' | 'online';
  venue?: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  meetingLink?: string;
  meetingId?: string;
  meetingPassword?: string;
  recordingUrl?: string;
  isRecorded: boolean;
  maxParticipants?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}


const TeacherLectures = () => {
  const { user, selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const { subjectLabel } = useInstituteLabels();
  const effectiveRole = useInstituteRole();
  const { toast } = useToast();
  
  const canCreateEdit = ['InstituteAdmin', 'Teacher'].includes(effectiveRole);
  
  const [showFilters, setShowFilters] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [selectedLecture, setSelectedLecture] = useState<TeacherLecture | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoPreviewTitle, setVideoPreviewTitle] = useState<string>('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

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

  // Table data hook with pagination - Remove dependencies to prevent auto-reloading
  const tableData = useTableData<TeacherLecture>({
    endpoint: '/institute-class-subject-lectures',
    defaultParams: {
      instituteId: selectedInstitute?.id,
      classId: selectedClass?.id,
      subjectId: selectedSubject?.id,
      instructorId: user?.id
    },
    dependencies: [], // Remove dependencies to prevent auto-reloading on context changes
    pagination: { defaultLimit: 50, availableLimits: [25, 50, 100] },
    autoLoad: true // Enable auto-loading from cache
  });

  const { state: { data: lectures, loading }, pagination, actions } = tableData;
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const lecturesColumns = [
    { key: 'title', header: 'Title' },
    { key: 'description', header: 'Description' },
    { key: 'lectureType', header: 'Type', render: (value: string) => <Badge variant="outline">{value}</Badge> },
    { key: 'venue', header: 'Venue' },
    { key: 'startTime', header: 'Start Time', render: (value: any) => { const d = value instanceof Date ? value : new Date(value); return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString(); } },
    { key: 'endTime', header: 'End Time', render: (value: any) => { const d = value instanceof Date ? value : new Date(value); return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString(); } },
    { 
      key: 'status', 
      header: 'Status',
      render: (value: string) => (
        <Badge variant={value === 'scheduled' ? 'default' : value === 'completed' ? 'secondary' : 'destructive'}>
          {value}
        </Badge>
      )
    },
    {
      key: 'meetingLink',
      header: 'Join Lecture',
      render: (value: string, row: any) => value ? (
        <Button
          size="sm"
          variant="default"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => window.open(value, '_blank')}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Join
        </Button>
      ) : (
        <span className="text-gray-400">No link</span>
      )
    },
    {
      key: 'recordingUrl',
      header: 'Recording',
      render: (value: string, row: any) => {
        const recUrl = value || row.recordingUrl || row.recording_url || row.recUrl || row.videoUrl || row.video_url;
        
        const isYouTubeOrDrive = (url: string) => {
          return url.includes('youtube.com') || 
                 url.includes('youtu.be') || 
                 url.includes('drive.google.com');
        };
        
        const handleRecordingClick = (url: string) => {
          if (isYouTubeOrDrive(url)) {
            setVideoPreviewUrl(url);
            setVideoPreviewTitle(row.title || 'Lecture Recording');
          } else {
            window.open(url, '_blank');
          }
        };
        
        return recUrl ? (
          <Button
            size="sm"
            variant="default"
            className="hover:opacity-90"
            onClick={() => handleRecordingClick(recUrl)}
          >
            <Video className="h-3 w-3 mr-1" />
            View Rec
          </Button>
        ) : (
          <span className="text-gray-400">No recording</span>
        );
      }
    }
  ];

  const handleEditLecture = (lectureData: any) => {
    console.log('Opening update lecture dialog:', lectureData);
    setSelectedLecture(lectureData);
    setIsUpdateDialogOpen(true);
  };

  const handleUpdateLecture = async () => {
    setIsUpdateDialogOpen(false);
    setSelectedLecture(null);
    actions.refresh();
  };

  const handleDeleteLecture = (lectureData: any) => {
    setDeleteDialog({ open: true, item: lectureData });
  };
  const confirmDeleteLecture = async () => {
    if (!deleteDialog.item) return;
    setIsDeleting(true);
    try {
      // Backend DELETE is SUPERADMIN-only; use PATCH to soft-deactivate instead
      await cachedApiClient.patch(`/institute-class-subject-lectures/${deleteDialog.item.id}`, { isActive: false });
      toast({ title: "Lecture Deleted", description: `Lecture ${deleteDialog.item.title} has been deleted successfully.` });
      setDeleteDialog({ open: false, item: null });
      actions.refresh();
    } catch (error: any) {
      toast({ title: "Delete Failed", description: "Failed to delete lecture. Please try again.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateLecture = async () => {
    setIsCreateDialogOpen(false);
    actions.refresh();
  };

  const handleLoadData = () => {
    actions.loadData();
  };

  const handleRefreshData = async () => {
    console.log('Force refreshing lectures data...');
    actions.refresh();
    setLastRefresh(new Date());
  };

  const filteredLectures = lectures.filter(lecture => {
    const matchesSearch = !searchTerm || 
      lecture.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lecture.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lecture.venue && lecture.venue.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || lecture.status === statusFilter;
    const matchesType = typeFilter === 'all' || lecture.lectureType === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getTitle = () => {
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
    
    let title = 'Lectures';
    if (contexts.length > 0) {
      title += ` (${contexts.join(' → ')})`;
    }
    
    return title;
  };

  if (!selectedInstitute || !selectedClass || !selectedSubject) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center py-12">
          <Video className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-4">
            Select {subjectLabel}
          </h2>
          <p className="text-muted-foreground">
            Please select an institute, class, and {subjectLabel.toLowerCase()} to view lectures.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {getTitle()}
          </h1>
          {lastRefresh && (
            <p className="text-sm text-muted-foreground mt-1">
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
              Search Lectures
            </label>
            <Input
              placeholder="Search lectures..."
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
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
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
                <SelectItem value="physical">Physical</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setTypeFilter('all');
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
        <div className="flex justify-end mb-4">
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Lecture
          </Button>
        </div>
      )}

      {/* MUI Table View */}
      <MUITable
        title=""
        data={lectures}
        columns={lecturesColumns.map(col => ({
          id: col.key,
          label: col.header,
          minWidth: 170,
          format: col.render
        }))}
        onAdd={() => setIsCreateDialogOpen(true)}
        onEdit={handleEditLecture}
        onDelete={handleDeleteLecture}
        page={pagination.page}
        rowsPerPage={pagination.limit}
        totalCount={pagination.totalCount}
        onPageChange={(newPage: number) => actions.setPage(newPage)}
        onRowsPerPageChange={(newLimit: number) => actions.setLimit(newLimit)}
        sectionType="lectures"
        allowEdit={true}
        allowDelete={true}
      />

      {/* Create Lecture Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} routeName="create-lecture-popup">
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Lecture</DialogTitle>
          </DialogHeader>
          <CreateLectureForm
            onClose={() => setIsCreateDialogOpen(false)}
            onSuccess={handleCreateLecture}
          />
        </DialogContent>
      </Dialog>

      {/* Update Lecture Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen} routeName="update-lecture-popup">
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Lecture</DialogTitle>
          </DialogHeader>
          {selectedLecture && (
            <UpdateLectureForm
              lecture={selectedLecture}
              onClose={() => setIsUpdateDialogOpen(false)}
              onSuccess={handleUpdateLecture}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Video Preview Dialog */}
      <VideoPreviewDialog
        open={!!videoPreviewUrl}
        onOpenChange={(open) => !open && setVideoPreviewUrl(null)}
        url={videoPreviewUrl || ''}
        title={videoPreviewTitle}
      />

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        itemName={deleteDialog.item?.title || ''}
        itemType="lecture"
        onConfirm={confirmDeleteLecture}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default TeacherLectures;