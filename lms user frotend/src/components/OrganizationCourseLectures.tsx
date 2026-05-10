
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock, MapPin, Monitor, Users, FileText, ExternalLink, Eye, Plus, Edit } from 'lucide-react';
import { organizationSpecificApi, OrganizationLecture, LectureDocument } from '@/api/organization.api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import CreateOrganizationLectureForm from './forms/CreateOrganizationLectureForm';
import UpdateOrganizationLectureForm from './forms/UpdateOrganizationLectureForm';
import { useAuth } from '@/contexts/AuthContext';

interface Course {
  causeId: string;
  title: string;
  description: string;
  isPublic: boolean;
  organizationId: string;
}

interface OrganizationCourseLecturesProps {
  course: Course | null;
  onBack: () => void;
  organization?: any;
}

const OrganizationCourseLectures = ({ course, onBack, organization }: OrganizationCourseLecturesProps) => {
  const [lectures, setLectures] = useState<OrganizationLecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLectureDocuments, setSelectedLectureDocuments] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [selectedLecture, setSelectedLecture] = useState<OrganizationLecture | null>(null);
  const { toast } = useToast();
  const { selectedOrganization } = useAuth();

  const fetchLectures = async () => {
    if (!course) return;
    
    try {
      setLoading(true);
      
      // Build query parameters for lectures API
      const params = new URLSearchParams({
        causeId: course.causeId,
        page: currentPage.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm })
      });

      const response = await organizationSpecificApi.get<{
        data: OrganizationLecture[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
          hasNext: boolean;
          hasPrev: boolean;
        };
      }>(`/organization/api/v1/lectures?${params.toString()}`);
      
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

  useEffect(() => {
    fetchLectures();
  }, [currentPage, searchTerm, course]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLectures();
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return format(date, 'MMM dd, yyyy HH:mm');
    } catch (error: any) {
      return 'Invalid date';
    }
  };

  const getDuration = (start: string, end: string) => {
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return 'Duration unavailable';
      }
      const durationMs = endDate.getTime() - startDate.getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    } catch (error: any) {
      return 'Duration unavailable';
    }
  };

  const handleViewDocuments = (lectureId: string) => {
    setSelectedLectureDocuments(selectedLectureDocuments === lectureId ? null : lectureId);
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

  const handleUpdateLecture = (lecture: OrganizationLecture) => {
    setSelectedLecture(lecture);
    setShowUpdateForm(true);
  };

  const handleUpdateSuccess = () => {
    setShowUpdateForm(false);
    setSelectedLecture(null);
    fetchLectures(); // Refresh the list
    toast({
      title: "Success",
      description: "Lecture updated successfully",
    });
  };

  const handleUpdateCancel = () => {
    setShowUpdateForm(false);
    setSelectedLecture(null);
  };

  // Check if user has permission to update lectures
  // Use selectedOrganization from AuthContext, fallback to prop organization
  const currentOrg = selectedOrganization || organization;
  const canUpdateLectures = currentOrg?.userRole === 'PRESIDENT' || 
                           currentOrg?.userRole === 'ADMIN' || 
                           currentOrg?.userRole === 'MODERATOR';

  if (!course) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Courses
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Course Selected</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Please select a course to view its lectures.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showCreateForm && course) {
    return (
      <CreateOrganizationLectureForm
        courseId={course.causeId}
        organizationId={course.organizationId}
        onSuccess={handleCreateSuccess}
        onCancel={handleCreateCancel}
      />
    );
  }

  if (showUpdateForm && selectedLecture) {
    return (
      <UpdateOrganizationLectureForm
        lecture={selectedLecture}
        onSuccess={handleUpdateSuccess}
        onClose={handleUpdateCancel}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Courses
        </Button>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <Button variant="outline" onClick={onBack} className="w-fit">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{course.title}</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Course Lectures</p>
          </div>
        </div>
        
        {canUpdateLectures && (
          <Button onClick={handleCreateLecture} className="flex items-center gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create Lecture</span>
            <span className="sm:hidden">Create</span>
          </Button>
        )}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search lectures..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto">Search</Button>
          </form>
        </CardContent>
      </Card>

      {/* Lectures List */}
      <div className="space-y-4">
        {lectures.map((lecture) => (
          <Card key={lecture.lectureId} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base sm:text-lg line-clamp-2">{lecture.title}</CardTitle>
                  <CardDescription className="mt-2 line-clamp-3">
                    {lecture.description}
                  </CardDescription>
                </div>
                <Badge variant={lecture.isPublic ? "default" : "secondary"} className="w-fit flex-shrink-0">
                  {lecture.isPublic ? 'Public' : 'Private'}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{formatDateTime(lecture.timeStart)}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span>{getDuration(lecture.timeStart, lecture.timeEnd)}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {lecture.mode === 'online' ? (
                    <><Monitor className="h-4 w-4 flex-shrink-0" /> <span>Online</span></>
                  ) : (
                    <><MapPin className="h-4 w-4 flex-shrink-0" /> <span className="truncate">{lecture.venue}</span></>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span>{lecture.documentCount} documents</span>
                </div>
              </div>

              {/* View Documents Button */}
              {lecture.documents && lecture.documents.length > 0 && (
                <div className="mb-4">
                  <Button 
                    variant="outline" 
                    onClick={() => handleViewDocuments(lecture.lectureId)}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Documents
                  </Button>
                </div>
              )}

              {/* Documents - Show only when selected */}
              {selectedLectureDocuments === lecture.lectureId && lecture.documents && lecture.documents.length > 0 && (
                <div className="space-y-2 mb-4">
                  <h4 className="font-medium text-sm">Documents:</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {lecture.documents.map((doc: LectureDocument) => (
                      <div key={doc.documentationId} className="flex items-center justify-between p-2 bg-muted rounded gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.title}</p>
                        </div>
                        <Button size="sm" variant="outline" asChild className="flex-shrink-0">
                          <a href={doc.docUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t space-y-2">
                {/* Live Link */}
                {lecture.liveLink && (
                  <Button asChild className="w-full">
                    <a href={lecture.liveLink} target="_blank" rel="noopener noreferrer">
                      <span className="hidden sm:inline">Join Live Session ({lecture.liveMode})</span>
                      <span className="sm:hidden">Join Live ({lecture.liveMode})</span>
                    </a>
                  </Button>
                )}

                {/* Recording */}
                {lecture.recordingUrl && (
                  <Button variant="outline" asChild className="w-full">
                    <a href={lecture.recordingUrl} target="_blank" rel="noopener noreferrer">
                      <span className="hidden sm:inline">View Recording</span>
                      <span className="sm:hidden">Recording</span>
                    </a>
                  </Button>
                )}

                {/* Update Button - Only for PRESIDENT, ADMIN, MODERATOR */}
                {canUpdateLectures && (
                  <Button 
                    variant="outline" 
                    onClick={() => handleUpdateLecture(lecture)}
                    className="w-full flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    <span className="hidden sm:inline">Update Lecture</span>
                    <span className="sm:hidden">Update</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
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
            <Calendar className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Lectures Found</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              {searchTerm
                ? 'No lectures match your search criteria.'
                : 'No lectures available for this course at the moment.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OrganizationCourseLectures;
