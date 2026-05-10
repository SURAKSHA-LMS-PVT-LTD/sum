import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Video, Search, Filter, Eye, EyeOff, Plus, MapPin, Calendar, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { organizationApi, OrganizationLecture, OrganizationQueryParams } from '@/api/organization.api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import CreateOrganizationLectureForm from './forms/CreateOrganizationLectureForm';
import { format } from 'date-fns';

interface OrganizationLecturesProps {
  organizationId?: string;
  courseId?: string;
}

const OrganizationLectures = ({ organizationId, courseId }: OrganizationLecturesProps) => {
  const [lectures, setLectures] = useState<OrganizationLecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [publicFilter, setPublicFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = useInstituteRole();

  const fetchLectures = async () => {
    try {
      setLoading(true);
      
      const params: OrganizationQueryParams = {
        page: currentPage,
        limit: 10,
        ...(searchTerm && { search: searchTerm }),
        ...(publicFilter !== 'all' && { isPublic: publicFilter === 'public' }),
        userId: user?.id,
        role: userRole || 'User'
      };

      const response = await organizationApi.getLectures(params);
      setLectures(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch (error: any) {
      console.error('Error fetching lectures:', error);
      toast({
        title: "Error",
        description: "Failed to load lectures",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLecture = () => {
    setShowCreateForm(true);
  };

  const handleCreateSuccess = (lecture: any) => {
    console.log('Lecture created successfully:', lecture);
    setShowCreateForm(false);
    fetchLectures(); // Refresh the list
    toast({
      title: "Success",
      description: "Lecture created successfully",
    });
  };

  const handleCreateCancel = () => {
    setShowCreateForm(false);
  };

  useEffect(() => {
    fetchLectures();
  }, [currentPage, searchTerm, modeFilter, publicFilter, organizationId, courseId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLectures();
  };

  const resetFilters = () => {
    setSearchTerm('');
    setModeFilter('all');
    setPublicFilter('all');
    setCurrentPage(1);
  };

  if (showCreateForm) {
    return (
      <CreateOrganizationLectureForm
        courseId={courseId || ''}
        organizationId={organizationId}
        onSuccess={handleCreateSuccess}
        onCancel={handleCreateCancel}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getHeaderInfo = () => {
    if (courseId) {
      return {
        title: 'Course Lectures',
        description: 'Browse lectures for this course'
      };
    } else if (organizationId) {
      return {
        title: 'Organization Lectures',
        description: 'Browse lectures for this organization'
      };
    }
    return {
      title: 'Lectures',
      description: 'Browse and manage organization lectures'
    };
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{headerInfo.title}</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {headerInfo.description}
          </p>
        </div>
        {user?.role === 'OrganizationManager' && (
          <Button onClick={handleCreateLecture} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Lecture
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search lectures..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Mode</label>
                <Select value={modeFilter} onValueChange={setModeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="physical">Physical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Visibility</label>
                <Select value={publicFilter} onValueChange={setPublicFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2 flex items-end">
                <div className="flex gap-2 w-full">
                  <Button type="submit" className="flex-1">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lectures.map((lecture) => (
          <Card key={lecture.lectureId} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {lecture.mode === 'online' ? (
                    <Video className="h-6 w-6 text-blue-600" />
                  ) : (
                    <MapPin className="h-6 w-6 text-green-600" />
                  )}
                  <div>
                    <CardTitle className="text-lg">{lecture.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {lecture.description}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={lecture.isPublic ? "default" : "secondary"}>
                    {lecture.isPublic ? (
                      <><Eye className="h-3 w-3 mr-1" /> Public</>
                    ) : (
                      <><EyeOff className="h-3 w-3 mr-1" /> Private</>
                    )}
                  </Badge>
                  
                  <Badge variant={lecture.mode === 'online' ? "default" : "secondary"}>
                    {lecture.mode === 'online' ? (
                      <><Video className="h-3 w-3 mr-1" /> Online</>
                    ) : (
                      <><MapPin className="h-3 w-3 mr-1" /> Physical</>
                    )}
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{lecture.venue}</span>
                  </div>
                  
                  {lecture.timeStart && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{format(new Date(lecture.timeStart), 'MMM dd, yyyy')}</span>
                    </div>
                  )}
                  
                  {lecture.timeStart && lecture.timeEnd && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        {format(new Date(lecture.timeStart), 'HH:mm')} - {format(new Date(lecture.timeEnd), 'HH:mm')}
                      </span>
                    </div>
                  )}
                  
                  {lecture.documentCount > 0 && (
                    <div className="text-xs text-blue-600">
                      {lecture.documentCount} document{lecture.documentCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {lectures.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Lectures Found</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              {searchTerm || modeFilter !== 'all' || publicFilter !== 'all'
                ? 'No lectures match your current filters.'
                : 'No lectures available at the moment.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OrganizationLectures;
