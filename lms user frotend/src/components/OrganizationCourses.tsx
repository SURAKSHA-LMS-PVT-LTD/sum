
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { BookOpen, Search, Filter, Eye, EyeOff, Plus, ChevronDown, Play, ExternalLink } from 'lucide-react';
import { organizationApi, Course, OrganizationQueryParams } from '@/api/organization.api';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import CreateCourseForm from './forms/CreateCourseForm';

interface OrganizationCoursesProps {
  organizationId?: string;
  onSelectCourse?: (course: Course) => void;
  organization?: any;
}

const OrganizationCourses = ({ organizationId, onSelectCourse, organization }: OrganizationCoursesProps) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [publicFilter, setPublicFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user, selectedOrganization } = useAuth();
  const userRole = useInstituteRole();

  // Debug logging
  console.log('OrganizationCourses props:', { organizationId, organization });
  console.log('OrganizationCourses selectedOrganization from context:', selectedOrganization);

  const fetchCourses = async () => {
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

      let response;
      if (organizationId) {
        // Fetch courses for specific organization
        response = await organizationApi.getOrganizationCourses(organizationId, params);
      } else {
        // Fetch all courses globally
        response = await organizationApi.getCourses(params);
      }
      
      setCourses(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch (error: any) {
      console.error('Error fetching courses:', error);
      toast({
        title: "Error",
        description: "Failed to load courses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = () => {
    setShowCreateForm(true);
  };

  const handleCreateSuccess = (course: any) => {
    console.log('Course created successfully:', course);
    setShowCreateForm(false);
    fetchCourses(); // Refresh the list
    toast({
      title: "Success",
      description: "Course created successfully",
    });
  };

  const handleCreateCancel = () => {
    setShowCreateForm(false);
  };

  const handleVideoClick = (videoUrl: string) => {
    setSelectedVideoUrl(videoUrl);
    setShowVideoModal(true);
  };

  const handleCloseVideoModal = () => {
    setShowVideoModal(false);
    setSelectedVideoUrl(null);
  };

  const toggleCardExpanded = (courseId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
  };

  const getEmbedUrl = (url: string) => {
    try {
      // Check for non-embeddable URLs
      if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
        return null; // Cannot embed Google Drive/Docs
      }
      
      // Convert YouTube URLs to embed format
      if (url.includes('youtube.com/watch?v=')) {
        const videoId = url.split('v=')[1]?.split('&')[0];
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`;
        }
      }
      if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1]?.split('?')[0];
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`;
        }
      }
      if (url.includes('youtube.com/embed/')) {
        // Already an embed URL, just add origin parameter if not present
        if (!url.includes('origin=')) {
          const separator = url.includes('?') ? '&' : '?';
          return `${url}${separator}enablejsapi=1&origin=${window.location.origin}`;
        }
        return url;
      }
      
      // For iframe embed URLs (like from other platforms), return as is
      if (url.includes('/embed/') || url.includes('player.vimeo.com') || url.includes('iframe')) {
        return url;
      }
      
      // For other URLs, return as is but warn they might not work
      return url;
    } catch (error: any) {
      console.error('Error parsing video URL:', error);
      return url;
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [currentPage, searchTerm, publicFilter, organizationId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchCourses();
  };

  const resetFilters = () => {
    setSearchTerm('');
    setPublicFilter('all');
    setCurrentPage(1);
  };

  if (showCreateForm) {
    return (
      <CreateCourseForm
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
    if (organizationId) {
      return {
        title: 'Organization Courses',
        description: 'Browse courses for this organization'
      };
    }
    return {
      title: 'All Organization Courses',
      description: 'Browse all courses across organizations'
    };
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{headerInfo.title}</h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {headerInfo.description}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Filter Button */}
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="h-4 w-4" />
                Filters
                <ChevronDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-background border shadow-lg" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search courses..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Visibility</label>
                  <Select value={publicFilter} onValueChange={setPublicFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={() => { setCurrentPage(1); fetchCourses(); }} className="flex-1">
                    <Search className="h-4 w-4 mr-2" />
                    Apply
                  </Button>
                  <Button variant="outline" onClick={resetFilters}>
                    Reset
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {((selectedOrganization?.userRole === 'ADMIN' || selectedOrganization?.userRole === 'PRESIDENT') || 
            (organization?.userRole === 'ADMIN' || organization?.userRole === 'PRESIDENT') ||
            (user?.role === 'OrganizationManager')) && (
            <Button onClick={handleCreateCourse} className="flex items-center gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Course</span>
              <span className="sm:hidden">Create</span>
            </Button>
          )}
        </div>
      </div>


      {/* Courses Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => {
          const isExpanded = expandedCards.has(course.causeId);
          
          return (
            <div
              key={course.causeId}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden h-full flex flex-col"
            >
              {/* Image */}
              <div className="h-40 overflow-hidden">
                {course.imageUrl ? (
                  <img 
                    src={getImageUrl(course.imageUrl)} 
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-gray-400" />
                  </div>
                )}
              </div>
              
              {/* Content */}
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
                  {course.title}
                </h3>
                
                {/* Badges */}
                <div className="flex gap-2 mb-3">
                  <Badge variant={course.isPublic ? "default" : "secondary"}>
                    {course.isPublic ? 'Public' : 'Private'}
                  </Badge>
                  
                  {course.introVideoUrl && (
                    <Badge variant="outline" className="text-red-600 border-red-200">
                      Intro Video
                    </Badge>
                  )}
                </div>
                
                {/* Video Link */}
                {course.introVideoUrl && (
                  <button
                    onClick={() => handleVideoClick(course.introVideoUrl!)}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm mb-3"
                  >
                    <Play className="h-4 w-4" />
                    Watch Introduction Video
                  </button>
                )}

                {/* Description (expandable) */}
                {isExpanded && (
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
                    {course.description}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-auto space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => toggleCardExpanded(course.causeId)}
                    className="w-full"
                  >
                    {isExpanded ? 'Show Less' : 'See More'}
                  </Button>

                  <Button
                    onClick={() => onSelectCourse && onSelectCourse(course)}
                    className="w-full"
                  >
                    Select Course
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="w-full sm:w-auto"
          >
            Previous
          </Button>
          
          <span className="text-sm text-gray-600 order-first sm:order-none">
            Page {currentPage} of {totalPages}
          </span>
          
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="w-full sm:w-auto"
          >
            Next
          </Button>
        </div>
      )}

      {courses.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Courses Found</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              {searchTerm || publicFilter !== 'all'
                ? 'No courses match your current filters.'
                : 'No courses available at the moment.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Video Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-4xl w-full p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Introduction Video</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-0">
            {selectedVideoUrl && (
              <div className="space-y-4">
                {getEmbedUrl(selectedVideoUrl) ? (
                  <div className="relative w-full h-0 pb-[56.25%] bg-black rounded-lg overflow-hidden">
                    <iframe
                      src={getEmbedUrl(selectedVideoUrl)}
                      title="Course Introduction Video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                      className="absolute top-0 left-0 w-full h-full"
                      onError={() => {
                        console.error('Failed to load video in iframe');
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <Play className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-center text-gray-600 dark:text-gray-300 mb-4">
                      This video cannot be embedded directly. 
                      {selectedVideoUrl.includes('drive.google.com') && (
                        <span className="block text-sm mt-2">Google Drive videos require direct access.</span>
                      )}
                    </p>
                    <button
                      onClick={() => window.open(selectedVideoUrl, '_blank')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Watch Video
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>Having trouble?</span>
                  <button
                    onClick={() => window.open(selectedVideoUrl, '_blank')}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                  >
                    Open in new tab
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizationCourses;
