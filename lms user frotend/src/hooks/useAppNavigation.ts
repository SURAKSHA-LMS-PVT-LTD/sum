import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const useAppNavigation = () => {
  const { currentChildId, selectedChild, selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const navigate = useNavigate();

  // CRITICAL: Use React Router's navigate for proper history management
  const navigateToPage = useCallback((page: string) => {
    
    
    // Build context-aware URL
    // eslint-disable-next-line no-useless-assignment
    let route = '';
    
    // Pages that are always global (no context prefix)
    const globalPages = ['my-children', 'transport', 'settings', 'appearance', 'id-cards', 'card-demo', 'payments', 'system-payment'];
    
    if (globalPages.includes(page)) {
      const routeMap: Record<string, string> = {
        'my-children': '/my-children',
        'transport': '/transport',
        'profile': '/profile',
        'settings': '/settings',
        'appearance': '/appearance',
        'id-cards': '/id-cards',
        'card-demo': '/card-demo',
        'payments': '/payments',
        'system-payment': '/payments',
      };
      route = routeMap[page] || `/${page}`;
    } else if (page.startsWith('child-') || page === 'child-dashboard') {
      // Child-related pages
      const cid = (currentChildId ?? selectedChild?.id) as string | undefined;
      if (!cid) {
        route = '/my-children';
      } else {
        const childPageMap: Record<string, string> = {
          'child-dashboard': `/child/${cid}/dashboard`,
          'child-select-institute': `/child/${cid}/select-institute`,
          'child-select-class': `/child/${cid}/select-class`,
          'child-select-subject': `/child/${cid}/select-subject`,
          'child-homework': `/child/${cid}/homework`,
          'child-lectures': `/child/${cid}/lectures`,
          'child-exams': `/child/${cid}/exams`,
          'child-results': `/child/${cid}/results`,
          'child-attendance': `/child/${cid}/attendance`,
          'child-transport': `/child/${cid}/transport`,
        };
        route = childPageMap[page] || `/child/${cid}/${page.replace('child-', '')}`;
      }
    } else if (selectedInstitute) {
      // Institute context pages
      const instId = selectedInstitute.id;
      
      if (page === 'select-class') {
        route = `/institute/${instId}/select-class`;
      } else if (page === 'select-subject' && selectedClass) {
        route = `/institute/${instId}/class/${selectedClass.id}/select-subject`;
      } else if (page === 'select-institute') {
        route = '/select-institute';
      } else if (selectedClass && selectedSubject) {
        // Full context: institute + class + subject
        route = `/institute/${instId}/class/${selectedClass.id}/subject/${selectedSubject.id}/${page === 'dashboard' ? 'dashboard' : page}`;
      } else if (selectedClass) {
        // Institute + class context
        route = `/institute/${instId}/class/${selectedClass.id}/${page === 'dashboard' ? 'dashboard' : page}`;
      } else {
        // Just institute context
        route = `/institute/${instId}/${page === 'dashboard' ? 'dashboard' : page}`;
      }
    } else {
      // No context - use simple routes
      const simpleRouteMap: Record<string, string> = {
        'dashboard': '/dashboard',
        'select-institute': '/select-institute',
        'institutes': '/institutes',
        'organizations': '/organizations',
      };
      route = simpleRouteMap[page] || `/${page}`;
    }

    // Use React Router navigate for proper history stack
    navigate(route);
  }, [currentChildId, selectedChild?.id, selectedInstitute, selectedClass, selectedSubject, navigate]);

  const getPageFromPath = useCallback((pathname: string): string => {
    if (pathname === '/') return 'dashboard';
    if (pathname === '/institutes/users') return 'institute-user';
    if (pathname === '/institutes/classes') return 'institute-classes';
    if (pathname === '/subject-pay-submission') return 'subject-pay-submission';
    
    // Extract page from context URLs
    const parts = pathname.split('/').filter(Boolean);
    // Return last meaningful segment
    return parts[parts.length - 1] || 'dashboard';
  }, []);

  return {
    navigateToPage,
    getPageFromPath
  };
};
