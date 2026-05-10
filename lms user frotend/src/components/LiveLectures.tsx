
import React, { useState } from 'react';
import DataTable from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Filter, Calendar, Clock, MapPin, Users } from 'lucide-react';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { AccessControl } from '@/utils/permissions';
import { useToast } from '@/hooks/use-toast';
import { DataCardView } from '@/components/ui/data-card-view';
import { cachedApiClient } from '@/api/cachedClient';

interface LiveLecturesProps {
  apiLevel?: 'institute' | 'class' | 'subject';
}

const LiveLectures = ({ apiLevel = 'institute' }: LiveLecturesProps) => {
  const { user, selectedInstitute, selectedClass, selectedSubject, currentInstituteId, currentClassId, currentSubjectId } = useAuth();
  const userRole = useInstituteRole();
  const { toast } = useToast();
  const [lecturesData, setLecturesData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const buildQueryParams = () => {
    const params: Record<string, any> = {
      page: 1,
      limit: 10
    };

    // Add context-aware filtering for InstituteAdmin
    if (userRole === 'InstituteAdmin' && currentInstituteId) {
      params.instituteId = currentInstituteId;
      
      if (currentClassId) {
        params.classId = currentClassId;
      }
      
      if (currentSubjectId) {
        params.subjectId = currentSubjectId;
      }
    }

    // Add filter parameters
    if (searchTerm.trim()) {
      params.search = searchTerm.trim();
    }

    if (statusFilter !== 'all') {
      params.status = statusFilter;
    }

    if (typeFilter !== 'all') {
      params.lectureType = typeFilter;
    }

    return params;
  };

  const handleLoadData = async (forceRefresh = false) => {
    if (userRole !== 'InstituteAdmin') {
      toast({
        title: "Access Denied",
        description: "Only Institute Admins can view this data.",
        variant: "destructive"
      });
      return;
    }

    if (!currentInstituteId) {
      toast({
        title: "Selection Required",
        description: "Please select an institute to view lectures.",
        variant: "destructive"
      });
      return;
    }

    const endpoint = '/institute-class-subject-lectures';
    const params = buildQueryParams();
    
    setIsLoading(true);
    console.log(`Loading lectures data for InstituteAdmin:`, { forceRefresh, params });
    
    try {
      const result = await cachedApiClient.get(endpoint, params, { 
        forceRefresh,
        ttl: 10 // Cache lectures for 10 minutes
      });

      console.log('Lectures loaded successfully:', result);
      
      // Handle both array response and paginated response
      const lectures = Array.isArray(result) ? result : (result as any)?.data || [];
      setLecturesData(lectures);
      setDataLoaded(true);
      setLastRefresh(new Date());
      
      
    } catch (error: any) {
      console.error('Failed to load lectures:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load lectures data.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshData = async () => {
    console.log('Force refreshing lectures data...');
    await handleLoadData(true);
  };

  const handleViewLecture = (lectureData: any) => {
    console.log('View lecture:', lectureData);
    toast({
      title: "Lecture Viewed",
      description: `Viewing lecture: ${lectureData.title}`
    });
  };

  const lecturesColumns = [
    { key: 'title', header: 'Title' },
    { key: 'description', header: 'Description' },
    { 
      key: 'lectureType', 
      header: 'Type',
      render: (value: string) => (
        <Badge variant={value === 'online' ? 'default' : 'secondary'}>
          {value}
        </Badge>
      )
    },
    { key: 'venue', header: 'Venue' },
    { 
      key: 'startTime', 
      header: 'Start Time', 
      render: (value: string) => value ? new Date(value).toLocaleString() : 'Not set'
    },
    { 
      key: 'endTime', 
      header: 'End Time', 
      render: (value: string) => value ? new Date(value).toLocaleString() : 'Not set'
    },
    { 
      key: 'status', 
      header: 'Status',
      render: (value: string) => (
        <Badge variant={
          value === 'scheduled' ? 'default' : 
          value === 'in_progress' ? 'secondary' : 
          value === 'completed' ? 'outline' : 'destructive'
        }>
          {value}
        </Badge>
      )
    },
    { key: 'maxParticipants', header: 'Max Participants' }
  ];

  const canView = userRole === 'InstituteAdmin';

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
    
    let title = 'Live Lectures';
    if (contexts.length > 0) {
      title += ` (${contexts.join(' → ')})`;
    }
    
    return title;
  };

  // Filter the lectures based on local filters for mobile view
  const filteredLectures = lecturesData.filter(lecture => {
    const matchesSearch = !searchTerm || 
      Object.values(lecture).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesStatus = statusFilter === 'all' || 
      lecture.status === statusFilter;
    
    const matchesType = typeFilter === 'all' || 
      lecture.lectureType === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  if (!canView) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Only Institute Admins can view live lectures data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {!dataLoaded ? (
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {getTitle()}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {!currentInstituteId
              ? 'Please select institute to view lectures.'
              : 'Click the button below to load lectures data'
            }
          </p>
          <Button 
            onClick={() => handleLoadData(false)} 
            disabled={isLoading || !currentInstituteId}
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {getTitle()}
              </h1>
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
                    <SelectItem value="in_progress">In Progress</SelectItem>
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

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <DataTable
              title=""
              data={lecturesData}
              columns={lecturesColumns}
              onView={handleViewLecture}
              searchPlaceholder="Search lectures..."
            />
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden">
            <DataCardView
              data={filteredLectures}
              columns={lecturesColumns}
              onView={handleViewLecture}
              allowEdit={false}
              allowDelete={false}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default LiveLectures;
