import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

/**
 * 🔒 INDUSTRIAL SECURITY - Context-Aware Routing
 * 
 * Automatically includes institute/class/subject context in URLs
 * Example: /classes → /institute/6/classes
 * Example: /subjects → /institute/6/class/12/subjects
 */

export interface RouteContext {
  instituteId?: string;
  classId?: string;
  subjectId?: string;
  childId?: string;
  organizationId?: string;
  transportId?: string;
}

/**
 * Build URL with context parameters
 */
export const buildContextUrl = (
  basePath: string,
  context: RouteContext
): string => {
  let url = '';
  
  // Build hierarchical URL structure
  if (context.instituteId) {
    url += `/institute/${context.instituteId}`;
    
    if (context.classId) {
      url += `/class/${context.classId}`;
      
      if (context.subjectId) {
        url += `/subject/${context.subjectId}`;
      }
    }
  } else if (context.childId) {
    url += `/child/${context.childId}`;
  } else if (context.organizationId) {
    url += `/organization/${context.organizationId}`;
  } else if (context.transportId) {
    url += `/transport/${context.transportId}`;
  }
  
  // Append base path
  url += basePath;
  
  return url;
};

/**
 * Parse context from URL parameters
 */
export const parseContextFromUrl = (params: any): RouteContext => {
  return {
    instituteId: params.instituteId,
    classId: params.classId,
    subjectId: params.subjectId,
    childId: params.childId,
    organizationId: params.organizationId,
    transportId: params.transportId
  };
};

/**
 * Hook for context-aware navigation
 */
export const useContextNavigation = () => {
  const navigate = useNavigate();
  const { 
    selectedInstitute, 
    selectedClass, 
    selectedSubject,
    selectedChild,
    selectedOrganization,
    selectedTransport
  } = useAuth();
  
  /**
   * Navigate with current context included in URL
   */
  const navigateWithContext = (path: string, options?: any) => {
    const context: RouteContext = {
      instituteId: selectedInstitute?.id,
      classId: selectedClass?.id,
      subjectId: selectedSubject?.id,
      childId: selectedChild?.id,
      organizationId: selectedOrganization?.id,
      transportId: selectedTransport?.id
    };
    
    const contextUrl = buildContextUrl(path, context);
    
    navigate(contextUrl, options);
  };
  
  return navigateWithContext;
};

/**
 * Hook to sync URL with auth context
 */
export const useSyncUrlWithContext = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { 
    selectedInstitute, 
    selectedClass, 
    selectedSubject,
    setSelectedInstitute,
    setSelectedClass,
    setSelectedSubject
  } = useAuth();
  
  useEffect(() => {
    const urlContext = parseContextFromUrl(params);
    
    // If URL has context but auth doesn't, update auth
    if (urlContext.instituteId && !selectedInstitute) {
      // Would need to fetch institute data here
    }
    
    if (urlContext.classId && !selectedClass) {
      // Would need to fetch class data here
    }
    
    if (urlContext.subjectId && !selectedSubject) {
      // Would need to fetch subject data here
    }
    
    // If auth has context but URL doesn't, update URL
    const hasAuthContext = selectedInstitute || selectedClass || selectedSubject;
    const hasUrlContext = urlContext.instituteId || urlContext.classId || urlContext.subjectId;
    
    if (hasAuthContext && !hasUrlContext) {
      const currentPath = location.pathname;
      const context: RouteContext = {
        instituteId: selectedInstitute?.id,
        classId: selectedClass?.id,
        subjectId: selectedSubject?.id
      };
      
      const newUrl = buildContextUrl(currentPath, context);
      
      if (newUrl !== currentPath) {
        navigate(newUrl, { replace: true });
      }
    }
  }, [
    location.pathname,
    params,
    selectedInstitute,
    selectedClass,
    selectedSubject,
    navigate
  ]);
};

/**
 * Extract base path from context URL
 */
export const extractBasePath = (fullPath: string): string => {
  // Remove context segments
  let basePath = fullPath
    .replace(/\/institute\/[^\/]+/g, '')
    .replace(/\/class\/[^\/]+/g, '')
    .replace(/\/subject\/[^\/]+/g, '')
    .replace(/\/child\/[^\/]+/g, '')
    .replace(/\/organization\/[^\/]+/g, '')
    .replace(/\/transport\/[^\/]+/g, '');
  
  // Ensure it starts with /
  if (!basePath.startsWith('/')) {
    basePath = '/' + basePath;
  }
  
  return basePath;
};

/**
 * Check if current route matches path (ignoring context)
 */
export const isRouteActive = (currentPath: string, targetPath: string): boolean => {
  const currentBase = extractBasePath(currentPath);
  const targetBase = extractBasePath(targetPath);
  
  return currentBase === targetBase || currentBase.startsWith(targetBase + '/');
};

export default {
  buildContextUrl,
  parseContextFromUrl,
  useContextNavigation,
  useSyncUrlWithContext,
  extractBasePath,
  isRouteActive
};
