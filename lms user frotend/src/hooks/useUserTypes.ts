import { useState, useEffect } from 'react';
import { userTypesApi, UserType } from '@/api/userTypes.api';
import { useAuth } from '@/contexts/AuthContext';

export const useUserTypes = () => {
  const { currentInstituteId } = useAuth();
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!currentInstituteId) {
      setLoading(false);
      setUserTypes([]);
      return;
    }

    const fetchUserTypes = async () => {
      try {
        setLoading(true);
        const types = await userTypesApi.list(currentInstituteId);
        setUserTypes(types);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserTypes();
  }, [currentInstituteId]);

  return { userTypes, loading, error };
};
