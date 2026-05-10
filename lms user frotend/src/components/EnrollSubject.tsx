import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';

const EnrollSubject = () => {
  const { selectedInstitute, selectedClass, user } = useAuth();
  const effectiveRole = useInstituteRole();

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
          <p className="text-muted-foreground">Please select an institute first.</p>
        </div>
      </div>
    );
  }

  if (!selectedClass) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">No Class Selected</h2>
          <p className="text-muted-foreground">Please select a class to view available subjects.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Enroll in Subjects</h1>
        <p className="text-muted-foreground">
          Browse and enroll in subjects for {selectedClass.name} at {selectedInstitute.name}
        </p>
      </div>

      <div className="text-center py-8">
        <p className="text-muted-foreground">Subject enrollment functionality will be available soon.</p>
      </div>
    </div>
  );
};

export default EnrollSubject;