import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Users, Check, ArrowLeft, RefreshCw } from 'lucide-react';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';
import DataTable from '@/components/ui/data-table';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/apiError';

interface Subject {
  id: string;
  name: string;
  code: string;
}

interface ClassSubject {
  instituteId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  subject: Subject;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const AttendanceMarkerSubjectSelector = () => {
  const { selectedInstitute, selectedClass, setSelectedSubject } = useAuth();
  const { subjectLabel, subjectsLabel } = useInstituteLabels();
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [loading, setLoading] = useState(false); // Changed from true to false - no auto-loading
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [dataLoaded, setDataLoaded] = useState(false); // Add state to track if data has been loaded

  // Auto-load subjects when institute and class are selected (uses cache if available)
  useEffect(() => {
    if (selectedInstitute && selectedClass && !dataLoaded) {
      console.log('Auto-loading subjects from cache');
      fetchSubjects();
    }
  }, [selectedInstitute?.id, selectedClass?.id]);

  const fetchSubjects = async (forceRefresh = false) => {
    if (!selectedInstitute || !selectedClass) {
      console.log('Missing required selections:', { selectedInstitute, selectedClass });
      toast.error('Please select institute and class first');
      return;
    }

    setLoading(true);
    try {
      console.log('Fetching subjects for:', { 
        instituteId: selectedInstitute.id, 
        classId: selectedClass.id 
      });

      const endpoint = `/institutes/${selectedInstitute.id}/classes/${selectedClass.id}/subjects`;
      console.log('API endpoint:', endpoint);
      
      const response = await enhancedCachedClient.get(
        endpoint,
        {},
        {
          ttl: CACHE_TTL.SUBJECTS,
          forceRefresh: forceRefresh,
          userId: selectedInstitute.id,
          instituteId: selectedInstitute.id,
          classId: selectedClass.id
        }
      );
      console.log('Full API Response:', response);
      
      // Handle different response structures
      let subjectsData = [];
      
      if (response.data?.data) {
        console.log('Using response.data.data structure');
        subjectsData = response.data.data;
      } else if (response.data && Array.isArray(response.data)) {
        console.log('Using response.data array structure');
        subjectsData = response.data;
      } else if (Array.isArray(response)) {
        console.log('Using direct response array structure');
        subjectsData = response;
      } else {
        console.log('No valid subjects data found in response structure');
        subjectsData = [];
      }
      
      console.log('Final subjects data:', subjectsData);
      setSubjects(subjectsData);
      setDataLoaded(true);
      
      if (subjectsData.length === 0) {
        toast.error('No subjects found for this class');
      } else {
        toast.success(`Loaded ${subjectsData.length} subjects`);
      }
      
    } catch (error: any) {
      console.error('Error fetching subjects:', error);
      toast.error(`Failed to load subjects: ${getErrorMessage(error, 'Unknown error occurred')}`);
      setSubjects([]);
      setDataLoaded(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectSelect = (subject: ClassSubject) => {
    const subjectData = {
      id: subject.subjectId,
      name: subject.subject.name,
      code: subject.subject.code,
      description: '' // Add empty description to match Subject interface
    };
    
    setSelectedSubject(subjectData);
    setSelectedSubjectId(subject.subjectId);
    toast.success(`Selected subject: ${subject.subject.name}`);
  };

  const tableColumns = [
    {
      key: 'subject.name',
      header: 'Subject Name',
      render: (value: any, row: ClassSubject) => (
        <div className="flex items-center space-x-2">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span className="font-medium">{row.subject.name}</span>
        </div>
      ),
    },
    {
      key: 'subject.code',
      header: 'Subject Code',
      render: (value: any, row: ClassSubject) => (
        <Badge variant="outline">{row.subject.code}</Badge>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (value: any, row: ClassSubject) => (
        <Badge variant={row.isActive ? 'default' : 'secondary'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (value: any, row: ClassSubject) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSubjectSelect(row)}
          className="w-full"
        >
          <Check className="h-4 w-4 mr-2" />
          Select
        </Button>
      ),
    },
  ];

  if (!selectedInstitute || !selectedClass) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Institute or Class Selected
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Please select an institute and class first to view subjects.
          </p>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading subjects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Select {subjectLabel}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Choose a {subjectLabel.toLowerCase()} from {selectedClass.name} to mark attendance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSubjects(true)}
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
          {/* Debug Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              console.log('Debug Info:', {
                selectedInstitute,
                selectedClass,
                subjects
              });
              toast.info('Debug info logged to console');
            }}
          >
            Debug Info
          </Button>
        </div>
      </div>

      {/* Context Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Selection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="font-medium">Institute:</span>
              <span>{selectedInstitute.name}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">Class:</span>
              <span>{selectedClass.name}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subjects Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {subjects.map((subject) => (
          <Card 
            key={subject.subjectId} 
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedSubjectId === subject.subjectId 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : ''
            }`}
            onClick={() => handleSubjectSelect(subject)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">{subject.subject.name}</CardTitle>
                </div>
                {subject.isActive && (
                  <Badge variant="default" className="text-xs">
                    Active
                  </Badge>
                )}
              </div>
              <CardDescription>
                Code: {subject.subject.code}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                variant={selectedSubjectId === subject.subjectId ? "default" : "outline"}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubjectSelect(subject);
                }}
              >
                {selectedSubjectId === subject.subjectId ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Selected
                  </>
                ) : (
                  `Select ${subjectLabel}`
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5" />
            <span>Available {subjectsLabel}</span>
          </CardTitle>
          <CardDescription>
            Select a {subjectLabel.toLowerCase()} to mark attendance for {selectedClass.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subjects.length > 0 ? (
            <DataTable
              title="Subjects"
              columns={tableColumns}
              data={subjects}
              searchPlaceholder="Search subjects..."
            />
          ) : (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No {subjectsLabel} Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                No {subjectsLabel.toLowerCase()} are available for the selected class.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceMarkerSubjectSelector;