import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient as api } from '@/api/client';

export const useActivityLogger = () => {
  const { user, selectedInstitute } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user?.id) return;

    const logActivity = async () => {
      try {
        await api.post('/activity/log', {
          userId: user.id,
          instituteId: selectedInstitute?.id,
          activity: location.pathname,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        // Silently ignore 404 errors - activity logging endpoint may not be implemented
        // Only log other errors
        if (error instanceof Error) {
          const errorMsg = error.message;
          if (!errorMsg.includes('404') && !errorMsg.includes('Cannot POST')) {
            console.debug('Activity logging error (non-critical):', errorMsg);
          }
        }
      }
    };

    logActivity();
  }, [location.pathname, user?.id, selectedInstitute?.id]);
};
