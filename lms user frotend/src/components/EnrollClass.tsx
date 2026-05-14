import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useApiRequest } from '@/hooks/useApiRequest';
import { instituteClassesApi, type InstituteClass, type EnrollClassData } from '@/api/instituteClasses.api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Users, Calendar, MapPin, GraduationCap, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { getBaseUrl, refreshAccessToken } from '@/contexts/utils/auth.api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';

const enrollFormSchema = z.object({
  enrollmentCode: z.string().min(1, 'Enrollment code is required'),
});

type EnrollFormValues = z.infer<typeof enrollFormSchema>;

const EnrollClass = () => {
  const { selectedInstitute, user } = useAuth();
  const effectiveRole = useInstituteRole();
  const [classes, setClasses] = useState<InstituteClass[]>([]);
  const [hasData, setHasData] = useState(false);
  const [selectedClass, setSelectedClass] = useState<InstituteClass | null>(null);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrolledClasses, setEnrolledClasses] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(6);
  const [totalPages, setTotalPages] = useState(1);

  console.log('EnrollClass component rendered', { 
    selectedInstitute, 
    classes: classes?.length,
    hasData,
    classesArray: classes
  });

  const { execute: loadClasses, loading: loadingClasses } = useApiRequest(
    instituteClassesApi.getByInstitute
  );

  const { execute: enrollInClass, loading: enrolling } = useApiRequest(
    instituteClassesApi.enroll
  );

  const form = useForm<EnrollFormValues>({
    resolver: zodResolver(enrollFormSchema) as any,
    defaultValues: {
      enrollmentCode: '',
    },
  });

  const loadEnrolledClasses = async (forceRefresh = false) => {
    if (!selectedInstitute || !user) return;
    
    try {
      // Use enhanced cached client for enrollment status
      const enrolledData = await enhancedCachedClient.get(
        `/institute-classes/${selectedInstitute.id}/student/${user.id}`,
        {},
        {
          ttl: CACHE_TTL.ENROLLMENT_STATUS,
          forceRefresh,
          userId: user?.id,
          instituteId: selectedInstitute.id,
          role: effectiveRole
        }
      );
      
      const enrolledIds = enrolledData.data?.map((item: any) => item.classId) || [];
      setEnrolledClasses(enrolledIds);
    } catch (error: any) {
      console.error('Error loading enrolled classes:', error);
    }
  };

  const handleLoadClasses = async () => {
    // Also load enrolled classes to check enrollment status
    await loadEnrolledClasses();
    console.log('🚀 Load Classes button clicked!');
    console.log('Selected Institute:', selectedInstitute);
    
    if (!selectedInstitute) {
      console.log('❌ No institute selected');
      toast.error('Please select an institute first');
      return;
    }

    console.log('✅ Making API call to load classes...');

    try {
      console.log('🚀 About to call API with institute ID:', selectedInstitute.id, 'page:', currentPage, 'limit:', limit);
      const data = await loadClasses(selectedInstitute.id, { 
        page: currentPage, 
        limit: limit,
        userId: user?.id,
        role: effectiveRole || 'User'
      });
      console.log('🔍 RECEIVED DATA:', data);
      
      if (!data) {
        console.log('❌ No data received from API');
        setClasses([]);
        setHasData(true);
        return;
      }
      
      // Convert the backend object format to array
      let classesArray: InstituteClass[] = [];
      
      if (Array.isArray(data)) {
        console.log('✅ Data is array');
        classesArray = data;
      } else if (data && typeof data === 'object') {
        console.log('✅ Data is object, extracting values');
        // Handle object with numbered keys (0, 1, 2, etc.) and filter out non-class properties
        const allValues = Object.values(data).filter(item => 
          item && 
          typeof item === 'object' && 
          'id' in item && 
          'name' in item &&
          'instituteId' in item &&
          !('data' in item) && // Exclude pagination metadata
          !('_truncated' in item) // Exclude response metadata
        );
        console.log('📋 Filtered class objects:', allValues);
        
        classesArray = allValues as InstituteClass[];
      }
      
      console.log('🎯 Final array length:', classesArray.length);
      console.log('🎯 Final array:', classesArray);
      
      if (classesArray.length > 0) {
        console.log('✅ Setting classes in state');
        setClasses(classesArray);
        setHasData(true);
        toast.success(`Found ${classesArray.length} available classes`);
      } else {
        console.log('❌ No valid classes found in response');
        setClasses([]);
        setHasData(true); // Still show the section but with "no classes" message
        toast.error('No classes found');
      }
    } catch (error: any) {
      console.error('❌ Error loading classes:', error);
      toast.error('Failed to load classes');
      setHasData(false);
    }
  };

  const handleEnrollClick = (classItem: InstituteClass) => {
    // Check if user is already enrolled
    if (enrolledClasses.includes(classItem.id)) {
      toast.error('User Already Enrolled');
      return;
    }
    
    setSelectedClass(classItem);
    form.reset({ enrollmentCode: classItem.enrollmentCode || '' });
    setEnrollDialogOpen(true);
  };

  const onSubmit = async (values: EnrollFormValues) => {
    if (!selectedClass) return;

    try {
      const enrollData: EnrollClassData = {
        classId: selectedClass.id,
        enrollmentCode: values.enrollmentCode,
      };

      const result = await enrollInClass(enrollData);
      console.log('Enrollment result:', result);
      
      // Close the dialog first
      setEnrollDialogOpen(false);
      
      // Show appropriate message based on verification requirements
      if (result.requiresVerification) {
        toast.success(result.message || "Enrollment submitted. Waiting for teacher verification.");
      } else {
        toast.success(result.message || "Successfully enrolled in class!");
        // Refresh access token so the new JWT includes the updated institute access
        try { await refreshAccessToken(); } catch { /* ignore refresh errors */ }
      }

      // Refresh classes to show updated enrollment status
      handleLoadClasses();
    } catch (error: any) {
      console.error('Error enrolling in class:', error);
      // Better error handling
      const errorMessage = error instanceof Error ? error.message : '';
      console.error('Enrollment error details:', errorMessage);
      
      if (errorMessage.toLowerCase().includes('invalid') ||
          errorMessage.toLowerCase().includes('code') ||
          errorMessage.toLowerCase().includes('not found') ||
          errorMessage.toLowerCase().includes('incorrect')) {
        toast.error("Enrollment key is invalid. Please try again.");
      } else if (errorMessage.toLowerCase().includes('already enrolled')) {
        toast.error("You are already enrolled in this class.");
      } else if (errorMessage.toLowerCase().includes('enrollment') && errorMessage.toLowerCase().includes('not enabled')) {
        toast.error("Enrollment is not open for this class.");
      } else {
        toast.error("Enrollment failed. Please try again or contact your teacher.");
      }
      // Don't close dialog on error, let user try again
    }
  };

  // Only show for students
  if (effectiveRole !== 'Student') {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive">Access Denied</h2>
          <p className="text-muted-foreground">This section is only available for students.</p>
        </div>
      </div>
    );
  }

  if (!selectedInstitute) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">No Institute Selected</h2>
          <p className="text-muted-foreground">Please select an institute to view available classes.</p>
        </div>
      </div>
    );
  }

  console.log('🏗️ About to render main component - hasData:', hasData, 'classes:', (classes || []).length);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Enroll in Classes</h1>
        <p className="text-muted-foreground">
          Current Selection - Institute: {selectedInstitute?.name || 'Unknown'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and enroll in available classes
        </p>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <Button
            onClick={() => {
              console.log('🔥 BUTTON CLICKED!');
              handleLoadClasses();
            }}
            disabled={loadingClasses}
            size="lg"
            className="w-full sm:w-auto"
          >
            {loadingClasses ? 'Loading Classes...' : 'Load Available Classes'}
          </Button>
          
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Per page:</label>
              <Select value={limit.toString()} onValueChange={(value) => setLimit(Number(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="18">18</SelectItem>
                  <SelectItem value="24">24</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {hasData && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Available Classes ({(classes || []).length})</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loadingClasses}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || loadingClasses}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {(classes || []).length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto max-w-md">
                <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No Classes Available</h3>
                <p className="mt-2 text-muted-foreground">
                  There are currently no classes available for enrollment at this institute.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8">
              {(classes || []).map((classItem) => (
                <div
                  key={classItem.id}
                  className="relative flex w-64 flex-col rounded-xl bg-gradient-to-br from-white to-gray-50 bg-clip-border text-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="relative mx-4 -mt-6 h-32 overflow-hidden rounded-xl bg-clip-border shadow-lg group">
                    {classItem.imageUrl ? (
                      <img 
                        src={getImageUrl(classItem.imageUrl)} 
                        alt={classItem.name}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 opacity-90"></div>
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px] animate-pulse"></div>
                    <div className="absolute top-3 right-3">
                      <Badge variant={classItem.isActive ? 'default' : 'secondary'} className="text-xs">
                        {classItem.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col">
                    <h5 className="mb-2 block font-sans text-lg font-semibold leading-snug tracking-normal text-gray-900 antialiased">
                      {classItem.name}
                    </h5>
                    <p className="block font-sans text-sm font-medium text-gray-600 mb-2">
                      Code: {classItem.code}
                    </p>
                    
                    {/* Scrollable content area - show only 2 items by default */}
                    <div className="flex-1 overflow-y-auto max-h-16 space-y-2 text-xs text-gray-600 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                      {classItem.description && (
                        <p className="text-gray-700 mb-2">
                          {classItem.description}
                        </p>
                      )}
                      
                      <div className="space-y-1">
                        {/* Show only first 2 items, rest are scrollable */}
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-3 w-3 text-gray-500" />
                          <span>Grade {classItem.grade} - Level {classItem.level}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-gray-500" />
                          <span>{classItem.specialty}</span>
                        </div>
                        {/* These items require scrolling to see */}
                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3 text-gray-500" />
                          <span>Capacity: {classItem.capacity} students</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-gray-500" />
                          <span>{classItem.academicYear}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-gray-500" />
                          <span>{classItem.startDate} to {classItem.endDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {classItem.classType}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 pt-0">
                    <button 
                      onClick={() => handleEnrollClick(classItem)}
                      disabled={!classItem.enrollmentEnabled || !classItem.isActive || enrolledClasses.includes(classItem.id)}
                      className="group relative w-full inline-flex items-center justify-center px-4 py-2 font-bold text-white rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all duration-300 hover:-translate-y-0.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
                    >
                      <span className="relative flex items-center gap-2">
                        {enrolledClasses.includes(classItem.id)
                          ? 'Enrolled'
                          : !classItem.isActive 
                          ? 'Inactive' 
                          : !classItem.enrollmentEnabled 
                          ? 'Closed' 
                          : 'Enroll'
                        }
                        {classItem.isActive && classItem.enrollmentEnabled && !enrolledClasses.includes(classItem.id) && (
                          <svg
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            fill="none"
                            className="w-4 h-4 transform transition-transform group-hover:translate-x-1"
                          >
                            <path
                              d="M17 8l4 4m0 0l-4 4m4-4H3"
                              strokeWidth="2"
                              strokeLinejoin="round"
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll in {selectedClass?.name}</DialogTitle>
            <DialogDescription>
              Enter the enrollment code to join this class. You can get this code from your teacher or institute.
            </DialogDescription>
            {selectedClass && (
              <div className="mt-2 p-3 bg-muted rounded-md space-y-1">
                <p className="text-sm"><span className="font-medium">Class ID:</span> {selectedClass.id}</p>
                <p className="text-sm"><span className="font-medium">Enrollment Code:</span> {selectedClass.enrollmentCode || 'N/A'}</p>
                <p className="text-sm"><span className="font-medium">Enrollment Enabled:</span> {selectedClass.enrollmentEnabled ? 'Yes' : 'No'}</p>
                <p className="text-sm"><span className="font-medium">Requires Verification:</span> {selectedClass.requireTeacherVerification ? 'Yes' : 'No'}</p>
              </div>
            )}
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="enrollmentCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enrollment Code</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter enrollment code" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedClass?.requireTeacherVerification && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> This class requires teacher verification. 
                    Your enrollment will be pending until approved.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEnrollDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={enrolling}>
                  {enrolling ? 'Enrolling...' : 'Enroll Now'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnrollClass;