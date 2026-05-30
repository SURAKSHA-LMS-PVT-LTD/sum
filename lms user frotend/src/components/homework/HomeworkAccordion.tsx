import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  ChevronDown, 
  Upload, 
  ExternalLink, 
  RefreshCw,
  Users,
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  MessageSquare,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useToast } from '@/hooks/use-toast';
import { useRefreshWithCooldown } from '@/hooks/useRefreshWithCooldown';
import { homeworkApi, Homework } from '@/api/homework.api';
// Removed: homeworkSubmissionsApi import - submissions are viewed on separate page
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CreateHomeworkForm from '@/components/forms/CreateHomeworkForm';
import UpdateHomeworkForm from '@/components/forms/UpdateHomeworkForm';
import SubmitHomeworkForm from '@/components/forms/SubmitHomeworkForm';
import { format } from 'date-fns';
// Removed: Avatar, getImageUrl imports - not needed since submissions view is on separate page
import { useNavigate } from 'react-router-dom';
import { HomeworkReferencesSection } from '@/components/homework/index';
import { getErrorMessage } from '@/api/apiError';

interface HomeworkAccordionProps {
  apiLevel?: 'institute' | 'class' | 'subject';
}

const HomeworkAccordion: React.FC<HomeworkAccordionProps> = ({ apiLevel = 'subject' }) => {
  const navigate = useNavigate();
  const { 
    user, 
    selectedInstitute, 
    selectedClass, 
    selectedSubject, 
    currentInstituteId, 
    currentClassId, 
    currentSubjectId,
    isViewingAsParent 
  } = useAuth();
  const instituteRole = useInstituteRole();
  const { toast } = useToast();
  const { refresh, isRefreshing, canRefresh, cooldownRemaining } = useRefreshWithCooldown(10);

  const [homeworkList, setHomeworkList] = useState<Homework[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);

  // Note: Submissions are viewed on a separate page via handleViewSubmissions

  // Track context
  const contextKey = `${currentInstituteId}-${currentClassId}-${currentSubjectId}`;
  const [lastLoadedContext, setLastLoadedContext] = useState<string>('');

  const isTeacherOrAdmin = instituteRole === 'Teacher' || instituteRole === 'InstituteAdmin';
  const isStudent = instituteRole === 'Student';

  // Auto-load when context changes
  useEffect(() => {
    if (currentInstituteId && currentClassId && currentSubjectId && contextKey !== lastLoadedContext) {
      setLastLoadedContext(contextKey);
      handleLoadData(false);
    }
  }, [contextKey]);

  const handleLoadData = async (forceRefresh = false) => {
    if (!currentInstituteId || !currentClassId || !currentSubjectId) {
      toast({
        title: "Missing Selection",
        description: "Please select institute, class, and subject to view homework.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const params = {
        instituteId: currentInstituteId,
        classId: currentClassId,
        subjectId: currentSubjectId,
        userId: user?.id,
        role: instituteRole,
        includeReferences: true,
        includeSubmissions: isStudent // Only for students
      };

      const result = await homeworkApi.getHomework(params, forceRefresh);
      const homework = Array.isArray(result) ? result : (result as any)?.data || [];
      
      setHomeworkList(homework);
      setDataLoaded(true);
      setLastRefresh(new Date());

      if (forceRefresh) {
        toast({
          title: "Data Refreshed",
          description: `Successfully refreshed ${homework.length} homework assignments.`
        });
      }
    } catch (error: any) {
      console.error('Failed to load homework:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load homework data.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshData = async () => {
    await refresh(async () => {
      await handleLoadData(true);
    }, {
      successMessage: 'Homework data refreshed successfully'
    });
  };

  // Handle accordion expansion (submissions are viewed on separate page)
  const handleAccordionChange = (value: string[]) => {
    setExpandedItems(value);
  };

  const handleCreateHomework = async () => {
    setIsCreateDialogOpen(false);
    await handleLoadData(true);
  };

  const handleUpdateHomework = async () => {
    setIsEditDialogOpen(false);
    setSelectedHomework(null);
    await handleLoadData(true);
  };

  const handleDeleteHomework = async (homework: Homework) => {
    if (!confirm(`Are you sure you want to delete "${homework.title}"?`)) return;
    
    try {
      await homeworkApi.deleteHomework(homework.id, {
        instituteId: currentInstituteId || undefined,
        classId: currentClassId || undefined,
        subjectId: currentSubjectId || undefined
      });
      toast({
        title: "Homework Deleted",
        description: `"${homework.title}" has been deleted.`
      });
      await handleLoadData(true);
    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: getErrorMessage(error, 'Failed to delete homework.'),
        variant: "destructive"
      });
    }
  };

  const handleSubmitSuccess = async () => {
    setIsSubmitDialogOpen(false);
    setSelectedHomework(null);
    toast({
      title: "Submission Successful",
      description: "Your homework has been submitted!"
    });
    await handleLoadData(true);
  };

  const handleViewSubmissions = (homework: Homework) => {
    navigate(`/institute/${currentInstituteId}/class/${currentClassId}/subject/${currentSubjectId}/homework/${homework.id}/submissions`);
  };

  // Filter homework
  const filteredHomework = useMemo(() => {
    if (!searchTerm) return homeworkList;
    const term = searchTerm.toLowerCase();
    return homeworkList.filter(hw => 
      hw.title.toLowerCase().includes(term) ||
      hw.description?.toLowerCase().includes(term)
    );
  }, [homeworkList, searchTerm]);

  const getStatusBadge = (homework: Homework) => {
    const now = new Date();
    const endDate = homework.endDate ? new Date(homework.endDate) : null;
    const startDate = homework.startDate ? new Date(homework.startDate) : null;

    if (!homework.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (endDate && endDate < now) {
      return <Badge variant="destructive">Past Due</Badge>;
    }
    if (startDate && startDate > now) {
      return <Badge variant="outline">Upcoming</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">Active</Badge>;
  };

  const getTitle = () => {
    const contexts = [];
    if (selectedInstitute) contexts.push(selectedInstitute.name);
    if (selectedClass) contexts.push(selectedClass.name);
    if (selectedSubject) contexts.push(selectedSubject.name);
    return contexts.length > 0 ? `Homework (${contexts.join(' → ')})` : 'Homework';
  };

  if (!dataLoaded) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground mb-4">{getTitle()}</h2>
          <p className="text-muted-foreground mb-6">
            {!currentInstituteId || !currentClassId || !currentSubjectId
              ? 'Please select institute, class, and subject to view homework.'
              : 'Click the button below to load homework data'}
          </p>
          <Button 
            onClick={() => handleLoadData(false)} 
            disabled={isLoading || !currentInstituteId || !currentClassId || !currentSubjectId}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Load Data
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{getTitle()}</h1>
          {lastRefresh && (
            <p className="text-sm text-muted-foreground mt-1">
              Last refreshed: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshData}
            disabled={isLoading || isRefreshing || !canRefresh}
            title={!canRefresh ? `Wait ${cooldownRemaining}s` : 'Refresh data'}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />
            {!canRefresh ? `${cooldownRemaining}s` : 'Refresh'}
          </Button>
          {isTeacherOrAdmin && !isViewingAsParent && (
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Homework
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search homework..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Button variant="outline" onClick={() => setSearchTerm('')}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Homework Count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <BookOpen className="h-4 w-4" />
        <span>{filteredHomework.length} homework assignment{filteredHomework.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Homework Accordion */}
      {filteredHomework.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Homework Found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'No homework matches your search.' : 'No homework assignments yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion 
          type="multiple" 
          value={expandedItems}
          onValueChange={handleAccordionChange}
          className="space-y-3"
        >
          {filteredHomework.map((homework) => (
            <AccordionItem 
              key={homework.id} 
              value={homework.id}
              className="border rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>div>.chevron]:rotate-180">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1 text-left">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <BookOpen className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground truncate">{homework.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {homework.teacher?.firstName} {homework.teacher?.lastName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(homework)}
                    {homework.endDate && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {format(new Date(homework.endDate), 'MMM dd, yyyy')}
                      </span>
                    )}
                    {isStudent && homework.hasSubmitted && (
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">Submitted</Badge>
                    )}
                    {isTeacherOrAdmin && homework.submissionCount !== undefined && (
                      <Badge variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        {homework.submissionCount}
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground chevron transition-transform duration-200" />
                </div>
              </AccordionTrigger>
              
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4 pt-2">
                  {/* Description */}
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <h4 className="text-sm font-medium mb-1">Description</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {homework.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    {homework.startDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Start:</span>
                        <span>{format(new Date(homework.startDate), 'MMM dd, yyyy')}</span>
                      </div>
                    )}
                    {homework.endDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Due:</span>
                        <span>{format(new Date(homework.endDate), 'MMM dd, yyyy')}</span>
                      </div>
                    )}
                  </div>

                  {/* References */}
                  <HomeworkReferencesSection
                    homeworkId={homework.id}
                    editable={isTeacherOrAdmin && !isViewingAsParent}
                  />

                  {/* Legacy Reference Link */}
                  {homework.referenceLink && (
                    <a
                      href={homework.referenceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                      View Reference Link
                    </a>
                  )}

                  {/* Student Submissions View */}
                  {isStudent && homework.mySubmissions && homework.mySubmissions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        My Submissions ({homework.mySubmissions.length})
                      </h4>
                      <div className="space-y-2">
                        {homework.mySubmissions.map((sub) => (
                          <div 
                            key={sub.id} 
                            className="flex items-center justify-between p-3 rounded-lg border bg-background"
                          >
                            <div className="flex items-center gap-3">
                              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                              <div>
                                <p className="text-sm font-medium">
                                  Submitted: {format(new Date(sub.submissionDate), 'MMM dd, yyyy HH:mm')}
                                </p>
                                {sub.remarks && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {sub.remarks}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {sub.fileUrl && (
                                <Button size="sm" variant="outline" asChild>
                                  <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer">
                                    <Eye className="h-3 w-3 mr-1" />
                                    View
                                  </a>
                                </Button>
                              )}
                              {sub.teacherCorrectionFileUrl && (
                                <Button size="sm" variant="destructive" asChild>
                                  <a href={sub.teacherCorrectionFileUrl} target="_blank" rel="noopener noreferrer">
                                    <Eye className="h-3 w-3 mr-1" />
                                    Correction
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Note: Submissions are viewed on the separate submissions page */}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                    {isStudent && !isViewingAsParent && !homework.hasSubmitted && (
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setSelectedHomework(homework);
                          setIsSubmitDialogOpen(true);
                        }}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Submit
                      </Button>
                    )}
                    {isTeacherOrAdmin && !isViewingAsParent && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedHomework(homework);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleViewSubmissions(homework)}
                        >
                          <Users className="h-4 w-4 mr-1" />
                          All Submissions
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleDeleteHomework(homework)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} routeName="create-homework-accordion-popup">
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Homework</DialogTitle>
          </DialogHeader>
          <CreateHomeworkForm onSuccess={handleCreateHomework} onClose={() => setIsCreateDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} routeName="edit-homework-accordion-popup">
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Homework</DialogTitle>
          </DialogHeader>
          {selectedHomework && (
            <UpdateHomeworkForm 
              homework={selectedHomework} 
              onSuccess={handleUpdateHomework}
              onClose={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Submit Dialog */}
      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen} routeName="submit-homework-accordion-popup">
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Homework</DialogTitle>
          </DialogHeader>
          {selectedHomework && (
            <SubmitHomeworkForm 
              homework={selectedHomework}
              onSuccess={handleSubmitSuccess}
              onClose={() => setIsSubmitDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomeworkAccordion;
