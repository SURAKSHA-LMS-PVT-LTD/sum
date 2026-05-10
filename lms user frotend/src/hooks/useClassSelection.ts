
import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Custom hook to handle class selection without triggering additional API calls
export const useClassSelection = () => {
  const { setSelectedClass } = useAuth();

  const selectClass = useCallback((classData: any) => {
    console.log('Class selection - preventing automatic API calls');
    
    // Only update the selected class state, no additional API calls
    setSelectedClass({
      id: classData.id,
      name: classData.name,
      code: classData.code,
      description: classData.description || `${classData.name} - ${classData.specialty || 'General'}`,
      grade: classData.grade || 0,
      specialty: classData.specialty || 'General'
    });

    // Explicitly prevent any follow-up requests
    return Promise.resolve();
  }, [setSelectedClass]);

  return { selectClass };
};
