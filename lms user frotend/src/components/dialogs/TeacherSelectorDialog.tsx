import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Search, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { useAuth } from '@/contexts/AuthContext';

interface Teacher {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  phoneNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  dateOfBirth?: string;
  userIdByInstitute?: string;
}

interface TeacherSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (teacherId: string) => Promise<void>;
  title: string;
  description?: string;
}

export const TeacherSelectorDialog: React.FC<TeacherSelectorDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  title,
  description
}) => {
  const { selectedInstitute, user } = useAuth();
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (isOpen && selectedInstitute?.id) {
      fetchTeachers();
    }
  }, [isOpen, selectedInstitute?.id]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = teachers.filter(teacher =>
        teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredTeachers(filtered);
    } else {
      setFilteredTeachers(teachers);
    }
  }, [searchTerm, teachers]);

  const fetchTeachers = async () => {
    if (!selectedInstitute?.id) return;
    
    setLoading(true);
    try {
      const response = await enhancedCachedClient.get(
        `/institute-users/institute/${selectedInstitute.id}/users/TEACHER`,
        { page: 1, limit: 100 },
        {
          ttl: 15,
          userId: user?.id,
          role: 'InstituteAdmin',
          instituteId: selectedInstitute.id
        }
      );
      
      const teacherList = response?.data || response || [];
      setTeachers(teacherList);
      setFilteredTeachers(teacherList);
    } catch (error: any) {
      console.error('Error fetching teachers:', error);
      toast({
        title: "Error",
        description: "Failed to load teachers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedTeacherId) {
      toast({
        title: "Error",
        description: "Please select a teacher",
        variant: "destructive"
      });
      return;
    }

    setAssigning(true);
    try {
      await onSelect(selectedTeacherId);
      onClose();
      setSelectedTeacherId('');
      setSearchTerm('');
    } catch (error: any) {
      console.error('Error assigning teacher:', error);
    } finally {
      setAssigning(false);
    }
  };

  const handleClose = () => {
    setSelectedTeacherId('');
    setSearchTerm('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <p className="text-sm text-muted-foreground mt-2">{description}</p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teachers by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Teacher List */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mb-2 opacity-50" />
                <p>No teachers found</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredTeachers.map((teacher) => {
                  const nameParts = teacher.name?.split(' ') || ['T'];
                  const initials = nameParts.length > 1 
                    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}` 
                    : nameParts[0][0];
                  
                  return (
                    <div
                      key={teacher.id}
                      onClick={() => setSelectedTeacherId(teacher.id)}
                      className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedTeacherId === teacher.id ? 'bg-primary/10 border-l-4 border-primary' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={teacher.imageUrl} alt={teacher.name} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {teacher.name}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {teacher.email}
                          </div>
                          {teacher.phoneNumber && (
                            <div className="text-xs text-muted-foreground truncate">
                              {teacher.phoneNumber}
                            </div>
                          )}
                        </div>
                        {selectedTeacherId === teacher.id && (
                          <div className="text-primary font-bold text-lg">✓</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={assigning}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={!selectedTeacherId || assigning}
          >
            {assigning ? 'Assigning...' : 'Assign Teacher'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
