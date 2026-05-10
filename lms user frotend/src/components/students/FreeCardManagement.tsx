import React from 'react';
import { Gift, ArrowLeft, Building2, School, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import ClassEnrollmentTypePanel from '@/components/students/ClassEnrollmentTypePanel';
import FreeCardStudentsPanel from '@/components/students/FreeCardStudentsPanel';

const FreeCardManagement: React.FC = () => {
  const { selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const userRole = useInstituteRole();
  const { navigateToPage } = useAppNavigation();
  const { classLabel, subjectLabel, instituteLabel } = useInstituteLabels();

  if (!['InstituteAdmin', 'Teacher'].includes(userRole)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">
        <p className="text-sm">You do not have access to this section.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateToPage('students')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to Students</span>
        </Button>
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-purple-500" />
          <div>
            <h1 className="text-lg font-semibold leading-none">Free Card Management</h1>
          </div>
        </div>
      </div>

      {/* Context breadcrumb */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        {selectedInstitute && (
          <Badge variant="outline" className="flex items-center gap-1 font-normal">
            <Building2 className="h-3 w-3" />
            <span className="text-[10px] text-muted-foreground mr-0.5">{instituteLabel}:</span>
            <span className="font-medium text-foreground">{selectedInstitute.name}</span>
          </Badge>
        )}
        {selectedClass && (
          <>
            <span className="text-muted-foreground/40">›</span>
            <Badge variant="outline" className="flex items-center gap-1 font-normal">
              <School className="h-3 w-3" />
              <span className="text-[10px] text-muted-foreground mr-0.5">{classLabel}:</span>
              <span className="font-medium text-foreground">{selectedClass.name}</span>
            </Badge>
          </>
        )}
        {selectedSubject && (
          <>
            <span className="text-muted-foreground/40">›</span>
            <Badge variant="outline" className="flex items-center gap-1 font-normal">
              <BookOpen className="h-3 w-3" />
              <span className="text-[10px] text-muted-foreground mr-0.5">{subjectLabel}:</span>
              <span className="font-medium text-foreground">{selectedSubject.name}</span>
            </Badge>
          </>
        )}
      </div>

      {/* Guard: class required */}
      {!selectedClass ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center text-muted-foreground">
          <School className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Select a {classLabel} first</p>
          <p className="text-xs mt-1">Choose a {classLabel} from the sidebar to manage free cards.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => navigateToPage('select-class')}
          >
            Select {classLabel}
          </Button>
        </div>
      ) : selectedSubject ? (
        /* Subject level — per-subject enrollment type management */
        <FreeCardStudentsPanel />
      ) : (
        /* Class level — all students across all their subjects in this class */
        <ClassEnrollmentTypePanel />
      )}
    </div>
  );
};

export default FreeCardManagement;

