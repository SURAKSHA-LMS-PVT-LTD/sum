
import React, { createContext, useState, useContext, useMemo, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import AppLoadingScreen from '@/components/AppLoadingScreen';
import { 
  User, 
  Institute, 
  Class, 
  Subject, 
  Child, 
  Organization,
  LoginCredentials, 
  AuthContextType 
} from './types/auth.types';
import { loginUser, instituteLogin as apiInstituteLogin, instituteLoginForce as apiInstituteLoginForce, validateToken, logoutUser } from './utils/auth.api';
import { mapUserData } from './utils/user.utils';
type ApiInstitute = any;
import { cachedApiClient } from '@/api/cachedClient';
import { apiCache } from '@/utils/apiCache';
import { useAuthAutoRefresh } from '@/hooks/useAuthAutoRefresh';
import { secureCache } from '@/utils/secureCache';
import { attendanceDuplicateChecker } from '@/utils/attendanceDuplicateCheck';
import { attendanceApiClient } from '@/api/attendanceClient';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedInstitute, setSelectedInstituteState] = useState<Institute | null>(null);
  const [selectedClass, setSelectedClassState] = useState<Class | null>(null);
  const [selectedSubject, setSelectedSubjectState] = useState<Subject | null>(null);
  const [selectedChild, setSelectedChildState] = useState<Child | null>(null);
  const [selectedOrganization, setSelectedOrganizationState] = useState<Organization | null>(null);
  const [selectedTransport, setSelectedTransportState] = useState<{ id: string; vehicleNumber: string; bookhireId: string } | null>(null);
  const [selectedInstituteType, setSelectedInstituteType] = useState<string | null>(null);
  const [selectedClassGrade, setSelectedClassGrade] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with true to show loading on init
  const [isInitialized, setIsInitialized] = useState(false);
  const [isViewingAsParent, setIsViewingAsParentState] = useState(false); // Parent viewing child's data
  const [childrenList, setChildrenList] = useState<Child[]>([]); // Cached children list (for parents)

  // ✅ Keep session alive (web + mobile) by refreshing access token before expiry.
  useAuthAutoRefresh(isInitialized && !!user);

  // Public variables for current IDs - no localStorage sync
  const [currentInstituteId, setCurrentInstituteId] = useState<string | null>(null);
  const [currentClassId, setCurrentClassId] = useState<string | null>(null);
  const [currentSubjectId, setCurrentSubjectId] = useState<string | null>(null);
  const [currentChildId, setCurrentChildId] = useState<string | null>(null);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null);
  const [currentTransportId, setCurrentTransportId] = useState<string | null>(null);

  // Use ref to access latest user in event handlers without re-subscribing
  const userRef = useRef(user);
  userRef.current = user;

  // Listen for token refresh events from API clients
  React.useEffect(() => {
    const handleRefreshSuccess = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { user: refreshedUser } = customEvent.detail;

      const currentUser = userRef.current;
      if (refreshedUser && currentUser) {
        setUser(prev => prev ? {
          ...prev,
          nameWithInitials: refreshedUser.nameWithInitials || prev.nameWithInitials,
          name: refreshedUser.nameWithInitials || prev.name,
          email: refreshedUser.email || prev.email,
          imageUrl: refreshedUser.imageUrl || prev.imageUrl,
          userType: refreshedUser.userType || prev.userType,
        } : prev);
      }
    };

    const handleRefreshFailed = () => {
      if (userRef.current) {
        logoutUser()
          .catch(() => {})
          .finally(() => {
            apiCache.clearAllCache();
            setUser(null);
            setIsViewingAsParentState(false);
            setChildrenList([]);
          });
      }
    };
    
    window.addEventListener('auth:refresh-success', handleRefreshSuccess);
    window.addEventListener('auth:refresh-failed', handleRefreshFailed);
    
    return () => {
      window.removeEventListener('auth:refresh-success', handleRefreshSuccess);
      window.removeEventListener('auth:refresh-failed', handleRefreshFailed);
    };
  }, []); // Stable effect — uses refs for latest state

  const fetchUserInstitutes = async (userId: string, forceRefresh = false): Promise<Institute[]> => {
    try {
      const apiInstitutesResponse = await cachedApiClient.get<
        ApiInstitute[] | { data?: ApiInstitute[]; meta?: any }
      >(
        `/users/${userId}/institutes`, 
        undefined, 
        { 
          forceRefresh,
          ttl: 60,
          useStaleWhileRevalidate: false
        }
      );
      

      // The backend sometimes returns a wrapped shape: { data: [...], meta: {...} }
      // Normalize it to a plain array for downstream mapping.
      const apiInstitutes = Array.isArray(apiInstitutesResponse)
        ? apiInstitutesResponse
        : Array.isArray(apiInstitutesResponse?.data)
          ? apiInstitutesResponse.data
          : [];
      
      // Ensure apiInstitutes is an array and filter out any undefined/null values
      const validInstitutes = Array.isArray(apiInstitutes)
        ? apiInstitutes.filter((institute: any) => institute && (institute.id || institute.instituteId))
        : [];
      
      // Map API response to AuthContext Institute type with safe property access
      const institutes = validInstitutes.map((institute: any): Institute => ({
        id: institute.instituteId || institute.id || '',
        name: institute.instituteName || institute.name || 'Unknown Institute',
        code: institute.code || '',
        description: `${institute.instituteAddress || institute.address || ''}, ${institute.instituteCity || institute.city || ''}`.trim() || 'No description available',
        isActive: institute.instituteIsActive !== undefined ? institute.instituteIsActive : (institute.isActive !== undefined ? institute.isActive : true),
        type: (() => { const t = institute.instituteType || institute.type; return t ? String(t).toLowerCase() : undefined; })(),
        instituteUserType: institute.instituteUserType, // Preserve raw API value
        userRole: institute.instituteUserType, // Keep for backward compatibility
        userIdByInstitute: institute.userIdByInstitute,
        shortName: institute.instituteShortName || institute.name || 'Unknown Institute',
        instituteUserImageUrl: institute.instituteUserImageUrl || institute.userImageUrl || institute.imageUrl || '',
        logo: institute.logoUrl || institute.instituteLogo || '',
        loadingGifUrl: institute.loadingGifUrl || undefined
      }));

      return institutes;
    } catch {
      return [];
    }
  };

  // Fetch children from backend for parent users — cached via enhancedCachedClient
  const fetchChildren = async (forceRefresh = false): Promise<Child[]> => {
    if (!user?.id) return [];
    try {
      const data = await enhancedCachedClient.get(
        `/parents/${user.id}/children`,
        {},
        { ttl: 300, forceRefresh, userId: user.id, role: 'Parent' }
      );
      const rawChildren: any[] = data?.children || (Array.isArray(data) ? data : []);
      const mapped: Child[] = rawChildren.map((c: any) => ({
        id: c.id || c.studentId || '',
        userId: c.id || c.studentId || '',    // Backend returns userId as "id"
        name: c.name || c.nameWithInitials || '',
        nameWithInitials: c.nameWithInitials || c.name || '',
        email: c.email || '',
        imageUrl: c.imageUrl || c.profileImageUrl || '',
        relationship: c.relationship || '',
        studentId: c.studentIdNumber || '',
        emergencyContact: c.emergencyContact || '',
        bloodGroup: c.bloodGroup || '',
        user: {
          id: c.id || c.studentId || '',
          nameWithInitials: c.nameWithInitials || c.name || '',
          email: c.email || '',
          imageUrl: c.imageUrl || c.profileImageUrl || '',
        }
      }));
      setChildrenList(mapped);
      return mapped;
    } catch {
      return childrenList;
    }
  };

  const instituteLogin = async (credentials: any) => {
    setIsLoading(true);
    try {
      const data = await apiInstituteLogin(credentials);
      
      // If device limit reached, return early so frontend can prompt user
      if (data.deviceLimitReached) {
        return data;
      }
      
      // Map user data. Institute login returns a slightly different user shape but mapUserData handles it.
      const mappedUser = mapUserData(data.user as any, []);
      setUser(mappedUser);
      fetchUserInstitutes(data.user.userId, true).then(institutes => {
        const updatedUser = mapUserData(data.user as any, institutes);
        setUser(updatedUser);
      }).catch(() => {});
      
      return data;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const instituteLoginForce = async (credentials: any) => {
    setIsLoading(true);
    try {
      const data = await apiInstituteLoginForce(credentials);
      
      const mappedUser = mapUserData(data.user as any, []);
      setUser(mappedUser);
      fetchUserInstitutes(data.user.userId, true).then(institutes => {
        const updatedUser = mapUserData(data.user as any, institutes);
        setUser(updatedUser);
      }).catch(() => {});
      
      return data;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const data = await loginUser(credentials);

      // Map user data WITHOUT fetching institutes (lazy load later)
      const mappedUser = mapUserData(data.user, []); // Empty institutes initially
      setUser(mappedUser);
      
      fetchUserInstitutes(data.user.id, true).then(institutes => {
        const updatedUser = mapUserData(data.user, institutes);
        setUser(updatedUser);
      }).catch(() => {});
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Load user institutes.
  // When viewing as parent, loads the child's STUDENT institutes via /parent-institutes endpoint.
  // Otherwise loads the user's own institutes.
  const loadUserInstitutes = async (forceRefresh = false): Promise<Institute[]> => {
    if (!user?.id) {
      throw new Error('No user found');
    }

    if (isViewingAsParent && selectedChild) {
      const childUserId = selectedChild.userId || selectedChild.id;
      try {
        const resp = await cachedApiClient.get<any>(
          `/users/${childUserId}/parent-institutes`,
          { page: 1, limit: 50 },
          { forceRefresh, ttl: 60, useStaleWhileRevalidate: false },
        );
        const raw = Array.isArray(resp) ? resp : Array.isArray(resp?.data) ? resp.data : [];
        return raw.filter((i: any) => i).map((institute: any): Institute => ({
          id: institute.instituteId || institute.id || '',
          name: institute.instituteName || institute.name || 'Unknown Institute',
          code: institute.code || '',
          description: `${institute.instituteAddress || institute.address || ''}`.trim() || '',
          isActive: institute.isActive ?? institute.instituteIsActive ?? true,
          type: (() => { const t = institute.instituteType || institute.type; return t ? String(t).toLowerCase() : undefined; })(),
          instituteUserType: institute.instituteUserType || institute.role || 'STUDENT',
          userRole: institute.instituteUserType || institute.role || 'STUDENT',
          userIdByInstitute: institute.userIdByInstitute || institute.instituteUserId,
          shortName: institute.shortName || institute.name || '',
          instituteUserImageUrl: institute.studentInstituteImageUrl || institute.instituteUserImageUrl || '',
          logo: institute.logoUrl || institute.instituteLogo || '',
          loadingGifUrl: institute.loadingGifUrl || undefined,
        }));
      } catch {
        return [];
      }
    }

    setIsLoading(true);
    try {
      const institutes = await fetchUserInstitutes(user.id, forceRefresh);
      const updatedUser = { ...user, institutes };
      setUser(updatedUser);
      return institutes;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await logoutUser();
    await apiCache.clearAllCache();
    await secureCache.clearAllCache();
    attendanceDuplicateChecker.clearAll();
    cachedApiClient.clearPendingRequests();
    attendanceApiClient.clearPendingRequests();
    enhancedCachedClient.clearPendingRequests();

    // Clear all state
    setUser(null);
    setSelectedInstituteState(null);
    setSelectedClassState(null);
    setSelectedSubjectState(null);
    setSelectedChildState(null);
    setSelectedOrganizationState(null);
    setSelectedTransportState(null);
    setSelectedInstituteType(null);
    setSelectedClassGrade(null);
    setIsViewingAsParentState(false);
    setChildrenList([]);
    
    setCurrentInstituteId(null);
    setCurrentClassId(null);
    setCurrentSubjectId(null);
    setCurrentChildId(null);
    setCurrentOrganizationId(null);
    setCurrentTransportId(null);
  };

  const setSelectedInstitute = useCallback((institute: Institute | any | null) => {
    const previousInstituteId = currentInstituteId;

    // Normalize various possible payload shapes into our Institute type
    const normalized = institute
      ? {
          id: institute.id || institute.instituteId || '',
          name: institute.name || institute.instituteName || 'Unknown Institute',
          code: institute.code || institute.instituteCode || institute.id || '',
          description:
            institute.description ||
            `${institute.address || institute.instituteAddress || ''}, ${
              institute.city || institute.instituteCity || ''
            }`.trim(),
          isActive:
            typeof institute.isActive === 'boolean'
              ? institute.isActive
              : typeof institute.instituteIsActive === 'boolean'
              ? institute.instituteIsActive
              : true,
          type: (() => { const t = institute.type || institute.instituteType; return t ? String(t).toLowerCase() : undefined; })(),
          instituteUserType: institute.instituteUserType,
          userRole: institute.userRole || institute.instituteUserType,
          userIdByInstitute: institute.userIdByInstitute,
          shortName:
            institute.shortName || institute.instituteShortName || institute.name || 'Unknown',
          // CRITICAL: prefer logoUrl over imageUrl (imageUrl is NOT profile image)
          instituteUserImageUrl: institute.instituteUserImageUrl || institute.userImageUrl || institute.imageUrl || '',
          logo: institute.logo || institute.logoUrl || institute.instituteLogo || ''
        }
      : null;

    setSelectedInstituteState(normalized);
    setCurrentInstituteId(normalized?.id || null);
    setSelectedInstituteType(normalized?.type || null);

    // Clear dependent selections
    setSelectedClassState(null);
    setSelectedSubjectState(null);
    setSelectedClassGrade(null);
    setCurrentClassId(null);
    setCurrentSubjectId(null);
  }, [currentInstituteId]);

  const setSelectedClass = useCallback((classData: Class | null) => {
    setSelectedClassState(classData);
    setCurrentClassId(classData?.id || null);
    setSelectedClassGrade(classData?.grade ?? null);
    
    // Clear dependent selections
    setSelectedSubjectState(null);
    setCurrentSubjectId(null);
  }, []);

  const setSelectedSubject = useCallback((subject: Subject | null) => {
    setSelectedSubjectState(subject);
    setCurrentSubjectId(subject?.id || null);
  }, []);

  const setSelectedChild = useCallback((child: Child | null, viewAsParent = false) => {
    setSelectedChildState(child);
    setCurrentChildId(child?.id || null);
    setIsViewingAsParentState(viewAsParent);
    
    // Clear dependent selections and ALL caches when switching child context
    if (viewAsParent && child) {
      setSelectedInstituteState(null);
      setSelectedClassState(null);
      setSelectedSubjectState(null);
      setCurrentInstituteId(null);
      setCurrentClassId(null);
      setCurrentSubjectId(null);

      // Clear all caches to prevent stale parent/child data mixing
      apiCache.clearAllCache();
      secureCache.clearAllCache();
    }

    // Also clear caches when deselecting child (going back to parent context)
    if (!child && !viewAsParent) {
      apiCache.clearAllCache();
      secureCache.clearAllCache();
    }
  }, []);

  const setSelectedOrganization = useCallback((organization: Organization | null) => {
    setSelectedOrganizationState(organization);
    setCurrentOrganizationId(organization?.id || null);
  }, []);

  const setSelectedTransport = useCallback((transport: { id: string; vehicleNumber: string; bookhireId: string } | null) => {
    setSelectedTransportState(transport);
    setCurrentTransportId(transport?.id || null);
  }, []);

  const refreshUserData = async (_forceRefresh = true) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const institutes = await fetchUserInstitutes(user.id, true);
      const mappedUser = mapUserData(user, institutes);
      setUser(mappedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const validateUserToken = async () => {
    setIsLoading(true);
    try {
      const userData = await validateToken();
      const mappedUser = mapUserData(userData, []);
      setUser(mappedUser);
    } catch (error) {
      await logout();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // 🔐 CRITICAL: Auto-restore session on mount
  // On web, access token is memory-only, so we ALWAYS attempt a cookie-based
  // refresh to restore the session after page load / browser restart.
  React.useEffect(() => {
    const initializeAuth = async () => {
      try {
        // validateToken will try memory token first, then cookie refresh
        const userData = await validateToken();
        if (!userData?.id) throw new Error('No user data returned');
        const institutes = await fetchUserInstitutes(userData.id, true);
        const mappedUser = mapUserData(userData, institutes);
        setUser(mappedUser);
      } catch {
        // No valid session — user needs to login
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
        // Hide splash screen once auth resolves and React has had time to fully paint
        // the new content. 600 ms gives React enough time to finish the Login→App
        // transition so the WebView never flashes a blank white screen.
        if (Capacitor.isNativePlatform()) {
          setTimeout(() => {
            import('@capacitor/splash-screen').then(({ SplashScreen }) => {
              SplashScreen.hide();
            }).catch(() => {});
          }, 600);
        }
      }
    };

    initializeAuth();

    // Listen for logout from other tabs (BroadcastChannel)
    const handleOtherTabLogout = () => {
      setUser(null);
    };
    window.addEventListener('auth:logged-out-other-tab', handleOtherTabLogout);
    return () => {
      window.removeEventListener('auth:logged-out-other-tab', handleOtherTabLogout);
    };
  }, []); // Run once on mount

  const value = useMemo(() => ({
    user,
    selectedInstitute,
    selectedClass,
    selectedSubject,
    selectedChild,
    selectedOrganization,
    selectedTransport,
    selectedInstituteType,
    selectedClassGrade,
    currentInstituteId,
    currentClassId,
    currentSubjectId,
    currentChildId,
    currentOrganizationId,
    currentTransportId,
    isViewingAsParent,
    children: childrenList,
    fetchChildren,
    login,
    instituteLogin,
    instituteLoginForce,
    logout,
    setSelectedInstitute,
    setSelectedClass,
    setSelectedSubject,
    setSelectedChild,
    setSelectedOrganization,
    setSelectedTransport,
    loadUserInstitutes,
    refreshUserData,
    validateUserToken,
    isAuthenticated: !!user,
    isLoading,
    isInitialized
  }), [
    user, selectedInstitute, selectedClass, selectedSubject,
    selectedChild, selectedOrganization, selectedTransport,
    selectedInstituteType, selectedClassGrade,
    currentInstituteId, currentClassId, currentSubjectId,
    currentChildId, currentOrganizationId, currentTransportId,
    isViewingAsParent, isLoading, isInitialized, childrenList,
    setSelectedInstitute, setSelectedClass, setSelectedSubject,
    setSelectedChild, setSelectedOrganization, setSelectedTransport
  ]);

  // Show branded loading screen during initialization
  if (!isInitialized) {
    return (
      <AuthContext.Provider value={value}>
        <AppLoadingScreen message="Starting up..." />
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Re-export types for backward compatibility
export type { User, UserRole, SubjectVerificationStatus } from './types/auth.types';
