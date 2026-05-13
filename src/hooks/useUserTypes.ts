import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userTypesApi, UserType } from '@/api/userTypes.api';

export const useUserTypes = () => {
  const { selectedInstitute } = useAuth();
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedInstitute?.id) { setUserTypes([]); setLoading(false); return; }
    setLoading(true);
    userTypesApi.list(selectedInstitute.id)
      .then(setUserTypes)
      .finally(() => setLoading(false));
  }, [selectedInstitute?.id]);

  return { userTypes, loading };
};
