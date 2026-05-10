import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

/**
 * ChildDashboard - Redirects to child's institute selection
 * 
 * This component ensures the child context is set and redirects to 
 * the institute selection page. The actual UI is rendered by AppContent
 * using the same system layout as all other pages.
 */
const ChildDashboard = () => {
  const { childId } = useParams();
  const navigate = useNavigate();
  const { selectedChild, isViewingAsParent } = useAuth();

  useEffect(() => {
    // If we have a child ID but no selected child yet, 
    // useRouteContext will load it. Just wait.
    if (childId && !selectedChild) {
      console.log('ChildDashboard: Waiting for child context to load...');
      return;
    }

    // If child is selected and viewing as parent, redirect to institute selection
    if (selectedChild && isViewingAsParent) {
      console.log('ChildDashboard: Redirecting to child institute selection');
      navigate(`/child/${childId}/select-institute`, { replace: true });
    }
  }, [childId, selectedChild, isViewingAsParent, navigate]);

  // Show loading while context is being set
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Loading child data...</p>
      </div>
    </div>
  );
};

export default ChildDashboard;
