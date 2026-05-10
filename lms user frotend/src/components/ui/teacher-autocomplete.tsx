import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, User, X } from 'lucide-react';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Teacher {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  phoneNumber?: string;
  userIdByInstitute?: string;
}

interface TeacherAutocompleteProps {
  value: string;
  onChange: (teacherId: string, teacher?: Teacher) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const TeacherAutocomplete: React.FC<TeacherAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Search teacher by name...",
  disabled = false,
  className
}) => {
  const { selectedInstitute, user } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch teachers on mount
  useEffect(() => {
    if (selectedInstitute?.id) {
      fetchTeachers();
    }
  }, [selectedInstitute?.id]);

  // Filter teachers based on search
  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = teachers.filter(teacher =>
        teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.id.includes(searchTerm)
      );
      setFilteredTeachers(filtered);
    } else {
      setFilteredTeachers(teachers);
    }
  }, [searchTerm, teachers]);

  // Find selected teacher when value changes externally
  useEffect(() => {
    if (value && teachers.length > 0) {
      const teacher = teachers.find(t => t.id === value);
      if (teacher) {
        setSelectedTeacher(teacher);
        setSearchTerm('');
      }
    } else if (!value) {
      setSelectedTeacher(null);
    }
  }, [value, teachers]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    } catch (error: any) {
      console.error('Error fetching teachers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTeacher = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setSearchTerm('');
    setIsOpen(false);
    onChange(teacher.id, teacher);
  };

  const handleClear = () => {
    setSelectedTeacher(null);
    setSearchTerm('');
    onChange('', undefined);
    inputRef.current?.focus();
  };

  const getInitials = (name: string) => {
    const nameParts = name?.split(' ') || ['T'];
    return nameParts.length > 1 
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : nameParts[0][0]?.toUpperCase() || 'T';
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {selectedTeacher ? (
        // Show selected teacher
        <div className="flex items-center gap-3 p-2 border rounded-md bg-primary/5 border-primary/20">
          <Avatar className="h-10 w-10">
            <AvatarImage src={selectedTeacher.imageUrl} alt={selectedTeacher.name} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {getInitials(selectedTeacher.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{selectedTeacher.name}</div>
            <div className="text-xs text-muted-foreground truncate">{selectedTeacher.email}</div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        // Show search input
        <div className="relative">
          <Input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled || loading}
            className="pr-10"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !selectedTeacher && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
              <User className="h-8 w-8 mb-1 opacity-50" />
              <p className="text-sm">{searchTerm ? 'No teachers found' : 'No teachers available'}</p>
            </div>
          ) : (
            <div className="py-1">
              {filteredTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  onClick={() => handleSelectTeacher(teacher)}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={teacher.imageUrl} alt={teacher.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(teacher.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{teacher.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{teacher.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
