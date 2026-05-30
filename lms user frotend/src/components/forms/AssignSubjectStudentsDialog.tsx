import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Users, UserPlus, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { enrollmentApi } from '@/api/enrollment.api';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { usePermission } from '@/hooks/usePermission';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { getBaseUrl, getApiHeadersAsync } from '@/contexts/utils/auth.api';
import { CACHE_TTL } from '@/config/cacheTTL';

interface Student {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  imageUrl?: string;
  dateOfBirth?: string;
}

interface StudentsResponse {
  data: Student[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface AssignSubjectStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignmentComplete: () => void;
}

const AssignSubjectStudentsDialog: React.FC<AssignSubjectStudentsDialogProps> = ({
  open,
  onOpenChange,
  onAssignmentComplete
}) => {
  const { selectedInstitute, selectedClass, selectedSubject, user } = useAuth();
  const instituteRole = useInstituteRole();
  const { hasCustomType, canCreate: rbacCanCreate } = usePermission('academics.subjects');
  const { toast } = useToast();

  const hasPermission = hasCustomType ? rbacCanCreate : (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher');
  
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);

  const fetchAvailableStudents = async (forceRefresh = false) => {
    if (!selectedInstitute?.id || !selectedClass?.id) return;

    setLoading(true);
    try {
      const data: StudentsResponse = await enhancedCachedClient.get(
        `/institute-users/institute/${selectedInstitute.id}/users/STUDENT/class/${selectedClass.id}`,
        { limit: 1000, page: 1, isActive: 'true' },
        {
          ttl: CACHE_TTL.STUDENTS,
          forceRefresh,
          userId: user?.id,
          role: instituteRole,
          instituteId: selectedInstitute.id,
          classId: selectedClass.id
        }
      );

      const list = (data?.data ?? (Array.isArray(data) ? data : [])) as any[];
      const mapped: Student[] = list.map((u: any) => ({
        id: u.id ?? u.user_id ?? u.userId,
        name: u.name ?? [u.first_name, u.last_name].filter(Boolean).join(' '),
        email: u.email,
        phoneNumber: u.phoneNumber ?? u.phone_number,
        imageUrl: u.imageUrl ?? u.institute_user_image_url ?? u.user_image_url,
      }));
      setStudents(mapped);
      setDataLoaded(true);
    } catch (error: any) {
      console.error('Error fetching students:', error);
      toast({
        title: "Error",
        description: "Failed to load available students",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStudentToggle = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map(student => student.id));
    }
  };

  const handleAssignStudents = async () => {
    if (!selectedInstitute?.id || !selectedClass?.id || !selectedSubject?.id || selectedStudentIds.length === 0) return;

    setAssigning(true);
    try {
      console.log('🚀 Assigning students to subject using bulk-enroll API:', {
        instituteId: selectedInstitute.id,
        classId: selectedClass.id,
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        className: selectedClass.name,
        studentIds: selectedStudentIds,
        timestamp: new Date().toISOString()
      });
      
      // Use new bulk-enroll API endpoint
      const headers = await getApiHeadersAsync();
      const response = await fetch(
        `${getBaseUrl()}/institute-class-subject-students/bulk-enroll`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            instituteId: selectedInstitute.id,
            classId: selectedClass.id,
            subjectId: selectedSubject.id,
            studentIds: selectedStudentIds,
            isActive: true
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Assignment failed:', errorData);
        throw new Error(`Assignment failed: ${errorData.message || 'Unknown error'}`);
      }

      const result = await response.json();
      
      console.log('Subject assignment result:', result);
      
      // Handle response - result is an array of enrollment objects
      if (Array.isArray(result) && result.length > 0) {
        const successCount = result.length;
        const failedCount = selectedStudentIds.length - successCount;
        
        if (failedCount === 0) {
          // All assignments succeeded
          toast({
            title: "Success!",
            description: `Successfully assigned ${successCount} student(s) to ${selectedSubject.name}`
          });
        } else {
          // Some failed
          toast({
            title: "Partial Success",
            description: `${successCount} students assigned successfully, ${failedCount} failed`,
          });
        }
        
        onAssignmentComplete();
        onOpenChange(false);
        setSelectedStudentIds([]);
      } else {
        // Unexpected response format
        toast({
          title: "Assignment Complete",
          description: "Students have been assigned to the subject"
        });
        
        onAssignmentComplete();
        onOpenChange(false);
        setSelectedStudentIds([]);
      }
    } catch (error: any) {
      console.error('Error assigning students to subject:', error);
      toast({
        title: "Network Error",
        description: "Failed to communicate with the server. Please try again.",
        variant: "destructive"
      });
    } finally {
      setAssigning(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const name = student.name.toLowerCase();
    const email = (student.email || '').toLowerCase();
    return !searchTerm || 
           name.includes(searchTerm.toLowerCase()) || 
           email.includes(searchTerm.toLowerCase());
  });

  useEffect(() => {
    if (open && !dataLoaded && hasPermission && selectedClass?.id) {
      fetchAvailableStudents(true);
    } else if (open && !hasPermission) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to assign students. This feature is only available for Institute Admins and Teachers.",
        variant: "destructive"
      });
      onOpenChange(false);
    }
  }, [open, dataLoaded, hasPermission, selectedClass?.id]);

  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setSelectedStudentIds([]);
      setStudents([]);
      setDataLoaded(false);
    }
  }, [open]);

  // Don't render if no subject is selected
  if (!selectedSubject) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} routeName="assign-subject-students-dialog-popup">
      <DialogContent className="max-w-2xl max-h-[95vh] sm:max-h-[80vh] p-0 sm:p-6 gap-0 w-[calc(100%-1rem)] mx-auto sm:w-full rounded-2xl sm:rounded-lg">
        <DialogHeader className="px-4 pt-5 pb-3 sm:px-0 sm:pt-0 sm:pb-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <UserPlus className="h-5 w-5 text-primary" />
            Assign Students to Subject
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Select students to assign to <strong>{selectedSubject.name}</strong> in <strong>{selectedClass?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-4 sm:px-0 py-3 sm:py-4">
          {/* Search and Select All */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleSelectAll}
              disabled={filteredStudents.length === 0}
              className="h-10 text-xs sm:text-sm shrink-0"
            >
              {selectedStudentIds.length === filteredStudents.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          {/* Selected Count */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="flex items-center gap-1 text-xs">
              <Users className="h-3.5 w-3.5" />
              {selectedStudentIds.length} Selected
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1 text-xs">
              <Users className="h-3.5 w-3.5" />
              {filteredStudents.length} Available
            </Badge>
          </div>

          {/* Students List */}
          <ScrollArea className="h-[45vh] sm:h-96">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2 text-sm">Loading students...</span>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-10">
                <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <h3 className="text-base font-medium mb-1">No Students Found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? 'No students match your search.' : 'No students available.'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer active:scale-[0.98] transition-all ${
                      selectedStudentIds.includes(student.id) 
                        ? 'bg-primary/5 border-primary/20' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleStudentToggle(student.id)}
                  >
                    <Checkbox
                      checked={selectedStudentIds.includes(student.id)}
                      onChange={() => handleStudentToggle(student.id)}
                    />
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={student.imageUrl || ''} alt={student.name} />
                      <AvatarFallback className="text-xs">
                        {student.name.split(' ').map(n => n.charAt(0)).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{student.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        ID: {student.id}{student.email ? ` · ${student.email}` : student.phoneNumber ? ` · ${student.phoneNumber}` : ''}
                      </p>
                    </div>
                    {selectedStudentIds.includes(student.id) && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="px-4 pb-4 sm:px-0 sm:pb-0 flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none h-11 sm:h-10">
            Cancel
          </Button>
          <Button 
            onClick={handleAssignStudents}
            disabled={selectedStudentIds.length === 0 || assigning}
            className="flex-1 sm:flex-none h-11 sm:h-10"
          >
            {assigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign {selectedStudentIds.length}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignSubjectStudentsDialog;