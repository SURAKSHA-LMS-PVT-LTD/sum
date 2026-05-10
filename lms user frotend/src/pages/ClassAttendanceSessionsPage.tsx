import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ClassAttendanceSessions from '@/components/class-sessions/ClassAttendanceSessions';
import { parseContextIds } from '@/utils/pageNavigation';

export default function ClassAttendanceSessionsPage() {
  const { selectedInstitute, selectedClass, currentInstituteId } = useAuth();
  const location = useLocation();

  // Parse directly from URL so the page works even before auth context state loads
  const urlCtx = parseContextIds(location.pathname);

  const instituteId =
    (currentInstituteId ?? selectedInstitute?.id)?.toString() ??
    urlCtx.instituteId ??
    null;
  const classId =
    selectedClass?.id?.toString() ??
    urlCtx.classId ??
    null;

  if (!instituteId || !classId) {
    return (
      <div className="p-4">
        <Alert>
          <AlertDescription>
            Please select an institute and a class to view attendance sessions.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4">
      <ClassAttendanceSessions
        instituteId={instituteId}
        classId={classId}
        className={selectedClass?.name}
      />
    </div>
  );
}
