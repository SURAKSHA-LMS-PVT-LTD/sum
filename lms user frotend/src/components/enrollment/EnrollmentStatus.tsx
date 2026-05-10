import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { GraduationCap, User } from 'lucide-react';

interface EnrollmentStatusProps {
  enrollmentMethod: 'teacher_assigned' | 'self_enrolled';
  enrolledBy?: string;
  enrolledByTeacher?: string;
  enrolledAt: string;
  className?: string;
}

const EnrollmentStatus: React.FC<EnrollmentStatusProps> = ({
  enrollmentMethod,
  enrolledBy,
  enrolledByTeacher,
  enrolledAt,
  className = ''
}) => {
  const getStatusIcon = () => {
    return enrollmentMethod === 'self_enrolled' ? (
      <GraduationCap className="h-4 w-4" />
    ) : (
      <User className="h-4 w-4" />
    );
  };

  const getStatusText = () => {
    if (enrollmentMethod === 'self_enrolled') {
      return 'Self-enrolled';
    } else {
      return enrolledByTeacher ? `Assigned by ${enrolledByTeacher}` : 'Teacher assigned';
    }
  };

  const getStatusVariant = () => {
    return enrollmentMethod === 'self_enrolled' ? 'default' : 'secondary';
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error: any) {
      return dateString;
    }
  };

  return (
    <Card className={`${className}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <div className="flex flex-col gap-1">
              <Badge variant={getStatusVariant()} className="w-fit">
                {getStatusText()}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(enrolledAt)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Simplified version for inline display
export const EnrollmentStatusBadge: React.FC<{
  enrollmentMethod: 'teacher_assigned' | 'self_enrolled';
}> = ({ enrollmentMethod }) => {
  const getStatusDetails = () => {
    if (enrollmentMethod === 'self_enrolled') {
      return {
        icon: <GraduationCap className="h-3 w-3" />,
        text: 'Self-enrolled',
        variant: 'default' as const
      };
    } else {
      return {
        icon: <User className="h-3 w-3" />,
        text: 'Teacher assigned',
        variant: 'secondary' as const
      };
    }
  };

  const { icon, text, variant } = getStatusDetails();

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      {icon}
      {text}
    </Badge>
  );
};

export default EnrollmentStatus;