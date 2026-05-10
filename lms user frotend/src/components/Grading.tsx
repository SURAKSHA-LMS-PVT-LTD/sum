import React, { useState, useEffect } from 'react';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { AccessControl } from '@/utils/permissions';
import { useToast } from '@/hooks/use-toast';
import DataTable from '@/components/ui/data-table';
import { cachedApiClient } from '@/api/cachedClient';

const Grading = () => {
  const { user, selectedInstitute, selectedClass, selectedSubject, currentInstituteId, currentClassId, currentSubjectId } = useAuth();
  const { toast } = useToast();
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Mock data - in real implementation, these would come from cached API calls
  const [mockGrades, setMockGrades] = useState([
    {
      id: '1',
      studentId: 'STU001',
      studentName: 'John Doe',
      subject: 'Mathematics',
      assignment: 'Mid-term Exam',
      maxMarks: 100,
      obtainedMarks: 85,
      grade: 'A',
      percentage: 85,
      date: '2024-01-15'
    },
    {
      id: '2',
      studentId: 'STU002',
      studentName: 'Sarah Smith',
      subject: 'Science',
      assignment: 'Lab Report',
      maxMarks: 50,
      obtainedMarks: 42,
      grade: 'B+',
      percentage: 84,
      date: '2024-01-16'
    }
  ]);

  const [mockAssignments, setMockAssignments] = useState([
    {
      id: '1',
      title: 'Mid-term Exam',
      subject: 'Mathematics',
      class: 'Grade 10-A',
      maxMarks: 100,
      dueDate: '2024-01-20',
      status: 'Active',
      graded: 15,
      total: 30
    },
    {
      id: '2',
      title: 'Physics Lab Report',
      subject: 'Physics',
      class: 'Grade 11-S',
      maxMarks: 50,
      dueDate: '2024-01-25',
      status: 'Draft',
      graded: 0,
      total: 25
    }
  ]);

  const [mockReportCards, setMockReportCards] = useState([
    {
      id: '1',
      studentId: 'STU001',
      studentName: 'John Doe',
      class: 'Grade 10-A',
      term: 'Term 1',
      overallGrade: 'A',
      percentage: 87.5,
      rank: 3,
      status: 'Published'
    },
    {
      id: '2',
      studentId: 'STU002',
      studentName: 'Sarah Smith',
      class: 'Grade 11-S',
      term: 'Term 1',
      overallGrade: 'B+',
      percentage: 82.3,
      rank: 8,
      status: 'Draft'
    }
  ]);

  const handleRefreshData = async () => {
    setIsLoading(true);
    console.log('Force refreshing grading data...');
    
    try {
      // In real implementation, you would make API calls here using cachedApiClient
      // For now, we'll simulate a refresh with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force refresh all grading-related data
      const params = {
        instituteId: currentInstituteId,
        classId: currentClassId,
        subjectId: currentSubjectId
      };

      // Example API calls that would be made:
      // await cachedApiClient.refresh('/grades', params);
      // await cachedApiClient.refresh('/assignments', params);
      // await cachedApiClient.refresh('/report-cards', params);
      
      setLastRefresh(new Date());
      
      toast({
        title: "Data Refreshed",
        description: "All grading data has been refreshed successfully."
      });
    } catch (error: any) {
      console.error('Error refreshing grading data:', error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh grading data.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Auto-refresh when context changes (using cached data)
    if (currentInstituteId) {
      console.log('Context changed, loading grading data from cache...');
      // In real implementation, this would load data using cachedApiClient
      setLastRefresh(new Date());
    }
  }, [currentInstituteId, currentClassId, currentSubjectId]);

  const gradesColumns = [
    { key: 'studentId', header: 'Student ID' },
    { key: 'studentName', header: 'Student Name' },
    { key: 'subject', header: 'Subject' },
    { key: 'assignment', header: 'Assignment' },
    { key: 'obtainedMarks', header: 'Marks', render: (value: number, row: any) => `${value}/${row.maxMarks}` },
    { key: 'percentage', header: 'Percentage', render: (value: number) => `${value}%` },
    { key: 'grade', header: 'Grade', render: (value: string) => <Badge>{value}</Badge> },
    { key: 'date', header: 'Date' }
  ];

  const assignmentsColumns = [
    { key: 'title', header: 'Assignment' },
    { key: 'subject', header: 'Subject' },
    { key: 'class', header: 'Class' },
    { key: 'maxMarks', header: 'Max Marks' },
    { key: 'dueDate', header: 'Due Date' },
    { key: 'graded', header: 'Progress', render: (value: number, row: any) => `${value}/${row.total}` },
    { key: 'status', header: 'Status', render: (value: string) => <Badge variant={value === 'Active' ? 'default' : 'secondary'}>{value}</Badge> }
  ];

  const reportCardsColumns = [
    { key: 'studentId', header: 'Student ID' },
    { key: 'studentName', header: 'Student Name' },
    { key: 'class', header: 'Class' },
    { key: 'term', header: 'Term' },
    { key: 'overallGrade', header: 'Grade', render: (value: string) => <Badge>{value}</Badge> },
    { key: 'percentage', header: 'Percentage', render: (value: number) => `${value}%` },
    { key: 'rank', header: 'Rank' },
    { key: 'status', header: 'Status', render: (value: string) => <Badge variant={value === 'Published' ? 'default' : 'secondary'}>{value}</Badge> }
  ];

  const handleAddGrade = () => {
    toast({
      title: "Add Grade",
      description: "Opening grade entry form..."
    });
  };

  const handleEditGrade = (grade: any) => {
    toast({
      title: "Edit Grade",
      description: `Editing grade for ${grade.studentName}`
    });
  };

  const handleDeleteGrade = async (grade: any) => {
    // In real implementation, use cachedApiClient.delete and then refresh
    toast({
      title: "Grade Deleted",
      description: `Grade for ${grade.studentName} has been deleted.`,
      variant: "destructive"
    });
    await handleRefreshData();
  };

  const handleCreateAssignment = () => {
    toast({
      title: "Create Assignment",
      description: "Opening assignment creation form..."
    });
  };

  const handleGradeAssignment = (assignment: any) => {
    toast({
      title: "Grade Assignment",
      description: `Opening grading interface for ${assignment.title}`
    });
  };

  const handleGenerateReportCard = () => {
    toast({
      title: "Generate Report Card",
      description: "Report card generation initiated..."
    });
  };

  const handlePublishReportCard = async (reportCard: any) => {
    // In real implementation, use cachedApiClient.put and then refresh
    toast({
      title: "Report Card Published",
      description: `Report card for ${reportCard.studentName} has been published.`
    });
    await handleRefreshData();
  };

  const userRole = useInstituteRole();
  const canGrade = AccessControl.hasPermission(userRole, 'grade-assignments');
  const canManageGrades = AccessControl.hasPermission(userRole, 'manage-grades');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Grading & Assessment
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage student grades, assignments, and generate report cards
          </p>
          {lastRefresh && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Last refreshed: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
        
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

      <Tabs defaultValue="grades" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="grades">Grades</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="reports">Report Cards</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Grade Management</CardTitle>
              <CardDescription>View and manage student grades</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Grade 10-A">Grade 10-A</SelectItem>
                    <SelectItem value="Grade 10-B">Grade 10-B</SelectItem>
                    <SelectItem value="Grade 11-S">Grade 11-S</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mathematics">Mathematics</SelectItem>
                    <SelectItem value="Science">Science</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <DataTable
                title="Student Grades"
                data={mockGrades}
                columns={gradesColumns}
                onAdd={canGrade ? handleAddGrade : undefined}
                onEdit={canGrade ? handleEditGrade : undefined}
                onDelete={canManageGrades ? handleDeleteGrade : undefined}
                searchPlaceholder="Search grades..."
                allowAdd={canGrade}
                allowEdit={canGrade}
                allowDelete={canManageGrades}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Management</CardTitle>
              <CardDescription>Create and manage assignments for grading</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                title="Assignments"
                data={mockAssignments}
                columns={assignmentsColumns}
                onAdd={canManageGrades ? handleCreateAssignment : undefined}
                onEdit={canGrade ? handleGradeAssignment : undefined}
                searchPlaceholder="Search assignments..."
                allowAdd={canManageGrades}
                allowEdit={canGrade}
                customActions={[
                  {
                    label: 'Grade',
                    action: handleGradeAssignment,
                    variant: 'default',
                    condition: (row: any) => row.status === 'Active' && canGrade
                  }
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Report Cards</CardTitle>
              <CardDescription>Generate and manage student report cards</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-4">
                  <Select>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select Term" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Term 1">Term 1</SelectItem>
                      <SelectItem value="Term 2">Term 2</SelectItem>
                      <SelectItem value="Final">Final</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Grade 10-A">Grade 10-A</SelectItem>
                      <SelectItem value="Grade 10-B">Grade 10-B</SelectItem>
                      <SelectItem value="Grade 11-S">Grade 11-S</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {canManageGrades && (
                  <Button onClick={handleGenerateReportCard}>
                    Generate Report Cards
                  </Button>
                )}
              </div>
              
              <DataTable
                title="Report Cards"
                data={mockReportCards}
                columns={reportCardsColumns}
                searchPlaceholder="Search report cards..."
                customActions={[
                  {
                    label: 'Publish',
                    action: handlePublishReportCard,
                    variant: 'default',
                    condition: (row: any) => row.status === 'Draft' && canManageGrades
                  },
                  {
                    label: 'Download',
                    action: (row: any) => toast({ title: 'Download', description: `Downloading report card for ${row.studentName}` }),
                    variant: 'outline'
                  }
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Class Average</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">84.5%</div>
                <p className="text-sm text-gray-600">+2.3% from last term</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Pass Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">92%</div>
                <p className="text-sm text-gray-600">28 out of 30 students</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Top Performer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">Sarah Smith</div>
                <p className="text-sm text-gray-600">95.2% average</p>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Grade Distribution</CardTitle>
              <CardDescription>Distribution of grades across all subjects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'].map((grade) => (
                  <div key={grade} className="flex items-center justify-between">
                    <span className="font-medium">{grade}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${Math.random() * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 w-12">
                        {Math.floor(Math.random() * 30)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Grading;
