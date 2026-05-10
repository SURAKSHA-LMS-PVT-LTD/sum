// src/components/notifications/CreateNotificationButton.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CreateNotificationForm } from './CreateNotificationForm';

interface Props {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  onSuccess?: () => void;
}

/**
 * Create Notification Button
 * 
 * Visibility Rules:
 * - SUPERADMIN: Always visible
 * - Institute Admin: Visible when institute is selected
 * - Teacher: Visible when institute is selected
 */
export const CreateNotificationButton: React.FC<Props> = ({ 
  variant = 'default',
  size = 'default',
  className,
  onSuccess 
}) => {
  const { user, selectedInstitute } = useAuth();
  const [showForm, setShowForm] = useState(false);
  
  const isSuperAdmin = user?.userType === 'SUPERADMIN' || user?.userType === 'SA';
  
  // Check for both formats: INSTITUTEADMIN and INSTITUTE_ADMIN (API returns underscore format)
  const instituteUserType = selectedInstitute?.instituteUserType || selectedInstitute?.userRole;
  const isInstituteAdmin = instituteUserType === 'INSTITUTEADMIN' || instituteUserType === 'INSTITUTE_ADMIN';
  const isTeacher = instituteUserType === 'TEACHER';

  // Check if user can create notifications
  const canCreateNotification = isSuperAdmin || 
    (selectedInstitute && (isInstituteAdmin || isTeacher));

  if (!canCreateNotification) {
    return null;
  }

  return (
    <>
      <Button 
        variant={variant}
        size={size}
        onClick={() => setShowForm(true)}
        className={className}
      >
        <Plus className="h-4 w-4 mr-1" />
        <Bell className="h-4 w-4 mr-1" />
        Create Notification
      </Button>

      <CreateNotificationForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={() => {
          onSuccess?.();
        }}
      />
    </>
  );
};
