import React, { useCallback, useState } from 'react';
import { Institute, InstituteUserType, FeaturePermission } from './types/auth.types';
import { userTypesApi } from '../api/userTypes.api';

interface AuthContextType {
  selectedInstitute: (Institute & { userType?: InstituteUserType, permissions?: Record<string, FeaturePermission> }) | null;
  setSelectedInstitute: (institute: Institute | null) => void;
  user: any;
  setUser: (user: any) => void;
  isViewingAsParent: boolean;
  loadInstitutePermissions: (instituteId: string) => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedInstitute, setSelectedInstituteState] = useState<(Institute & { userType?: InstituteUserType, permissions?: Record<string, FeaturePermission> }) | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isViewingAsParent, setIsViewingAsParent] = useState(false);

  const loadInstitutePermissions = useCallback(async (instituteId: string) => {
    try {
      const ctx = await userTypesApi.getMyContext(instituteId);
      setUser((prev: any) => prev ? {
        ...prev,
        institutes: prev.institutes.map((inst: Institute) =>
          inst.id === instituteId
            ? { ...inst, userType: ctx.userType, permissions: ctx.permissions }
            : inst
        )
      } : null);
      setSelectedInstituteState(prev => prev ? {
        ...prev,
        userType: ctx.userType,
        permissions: ctx.permissions
      } : null);
    } catch (e) {
      // fallback: permissions = {} (all default to enabled)
    }
  }, []);

  const setSelectedInstitute = (institute: Institute | null) => {
    setSelectedInstituteState(institute);
    if (institute) {
      loadInstitutePermissions(institute.id);
    }
  };

  return (
    <AuthContext.Provider value={{ selectedInstitute, setSelectedInstitute, user, setUser, isViewingAsParent, loadInstitutePermissions }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);
