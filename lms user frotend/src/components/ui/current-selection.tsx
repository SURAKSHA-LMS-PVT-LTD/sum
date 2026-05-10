import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Building, BookOpen, Truck, ChevronLeft, UserCheck, Users } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
interface CurrentSelectionProps {
  institute?: {
    id: string;
    name: string;
  };
  class?: {
    id: string;
    name: string;
  };
  subject?: {
    id: string;
    name: string;
  };
  transport?: {
    id: string;
    vehicleModel: string;
  };
  onBack?: () => void;
  showNavigation?: boolean;
}
const CurrentSelection: React.FC<CurrentSelectionProps> = ({
  institute: instituteProp,
  class: classProp,
  subject: subjectProp,
  transport,
  onBack,
  showNavigation = true
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const userRole = useInstituteRole();
  const {
    setSelectedClass,
    setSelectedSubject,
    setSelectedInstitute,
    selectedChild,
    selectedInstitute: contextInstitute,
    selectedClass: contextClass,
    selectedSubject: contextSubject
  } = useAuth();

  // Use props if provided, otherwise fall back to context values
  const institute = instituteProp || contextInstitute;
  const selectedClass = classProp || contextClass;
  const subject = subjectProp || contextSubject;

  const isChildRoute = location.pathname.startsWith('/child/');
  const childId = (selectedChild as any)?.id as string | undefined;

  const { subjectLabel } = useInstituteLabels();

  // Check if user is InstituteAdmin or Teacher
  const canVerifyStudents = ['InstituteAdmin', 'Teacher'].includes(userRole);
  if (!institute && !selectedClass && !subject && !transport) return null;

  // Determine the current step for better context
  const getCurrentStep = () => {
    if (subject) return 'subject';
    if (selectedClass) return 'class';
    if (institute) return 'institute';
    return 'none';
  };

  // Determine context-aware back navigation
  const handleContextBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    const currentStep = getCurrentStep();

    // If we have subject selected, go back to subject selection (clear subject)
    if (currentStep === 'subject' && selectedClass && institute) {
      setSelectedSubject(null);
      if (isChildRoute && childId) {
        navigate(`/child/${childId}/select-subject`);
      } else {
        navigate(`/institute/${institute.id}/class/${selectedClass.id}/select-subject`);
      }
      return;
    }

    // If we have class selected, go back to class selection (clear class)
    if (currentStep === 'class' && institute) {
      setSelectedClass(null);
      if (isChildRoute && childId) {
        navigate(`/child/${childId}/select-class`);
      } else {
        navigate(`/institute/${institute.id}/select-class`);
      }
      return;
    }

    // If we have institute selected, go back to institute selection (clear institute)
    if (currentStep === 'institute') {
      setSelectedInstitute(null);
      if (isChildRoute && childId) {
        navigate(`/child/${childId}/select-institute`);
      } else {
        navigate('/select-institute');
      }
      return;
    }

    // Default: go back in history
    navigate(-1);
  };
  const handleVerifyStudentsClick = () => {
    if (institute && selectedClass) {
      navigate(`/institute/${institute.id}/class/${selectedClass.id}/unverified-students`);
    } else if (institute) {
      // Navigate to class selection first if no class selected
      navigate(`/institute/${institute.id}/select-class`);
    }
  };

  // Get back button label based on current context
  const getBackLabel = () => {
    const currentStep = getCurrentStep();
    if (currentStep === 'subject') return 'Change Subject';
    if (currentStep === 'class') return 'Change Class';
    if (currentStep === 'institute') return 'Change Institute';
    return 'Back';
  };

  // Get the description of what back action will do
  const getBackDescription = () => {
    const currentStep = getCurrentStep();
    if (currentStep === 'subject') return 'Go to subject selection';
    if (currentStep === 'class') return 'Go to class selection';
    if (currentStep === 'institute') return 'Go to institute selection';
    return 'Go back';
  };
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Back Button */}
          {showNavigation && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleContextBack}
              className="h-7 px-2 text-xs gap-1"
            >
              <ChevronLeft className="h-3 w-3" />
              {getBackLabel()}
            </Button>
          )}

          <Separator orientation="vertical" className="h-4 hidden sm:block" />

          {/* Context Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            {institute && (
              <Badge variant="secondary" className="gap-1 text-xs h-6">
                <Building className="h-3 w-3" />
                <span className="truncate max-w-[120px] sm:max-w-[180px]">{institute.name}</span>
              </Badge>
            )}

            {selectedChild && (
              <Badge variant="secondary" className="gap-1 text-xs h-6">
                <Users className="h-3 w-3" />
                <span className="truncate max-w-[120px] sm:max-w-[180px]">
                  {(selectedChild as any).name ||
                    selectedChild?.user?.nameWithInitials ||
                    [selectedChild?.user?.firstName, selectedChild?.user?.lastName].filter(Boolean).join(' ') ||
                    `#${selectedChild.id}`}
                </span>
              </Badge>
            )}
            
            {selectedClass && (
              <Badge variant="secondary" className="gap-1 text-xs h-6">
                <BookOpen className="h-3 w-3" />
                <span className="truncate max-w-[100px] sm:max-w-[150px]">{selectedClass.name}</span>
              </Badge>
            )}
            
            {subject && (
              <Badge variant="secondary" className="gap-1 text-xs h-6">
                <BookOpen className="h-3 w-3" />
                <span className="truncate max-w-[100px] sm:max-w-[150px]">{subject.name}</span>
              </Badge>
            )}
            
            {transport && (
              <Badge variant="secondary" className="gap-1 text-xs h-6">
                <Truck className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{transport.vehicleModel}</span>
              </Badge>
            )}
          </div>

          {/* Verify Students Button (for InstituteAdmin/Teacher) */}
          {canVerifyStudents && institute && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyStudentsClick}
              className="h-7 px-2 text-xs gap-1 ml-auto"
            >
              <UserCheck className="h-3 w-3" />
              <span className="hidden sm:inline">Verify Students</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
export default CurrentSelection;