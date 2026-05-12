import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/api/client';

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
        console.error('Failed to log activity:', error);
      }
    };

    logActivity();
  }, [location.pathname, user?.id, selectedInstitute?.id]);
};
