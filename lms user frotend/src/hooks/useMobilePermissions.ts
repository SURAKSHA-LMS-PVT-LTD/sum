/**
 * Hook to handle mobile permission prompts after login
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { mobilePermissionService, PermissionStatus, PermissionRequestResult } from '@/services/mobilePermissionService';

export const useMobilePermissions = () => {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    notifications: 'unsupported',
    camera: 'unsupported',
    location: 'unsupported'
  });
  const [isRequesting, setIsRequesting] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);

  // Check permission statuses on mount
  useEffect(() => {
    const checkStatuses = async () => {
      const statuses = await mobilePermissionService.getPermissionStatuses();
      setPermissionStatus(statuses);
    };
    
    if (mobilePermissionService.isNativePlatform()) {
      checkStatuses();
    }
  }, []);

  // Auto-request permissions after login on mobile
  useEffect(() => {
    if (!user?.id) {
      // Reset on logout
      mobilePermissionService.resetSession();
      setHasRequested(false);
      return;
    }

    // Only prompt if we should and haven't already this session
    if (mobilePermissionService.shouldPromptForPermissions() && !hasRequested) {
      // Small delay to let the app settle after login
      const timeout = setTimeout(async () => {
        console.log('📱 Auto-requesting permissions after login...');
        setIsRequesting(true);
        
        try {
          const results = await mobilePermissionService.requestAllPermissions(user.id);
          setHasRequested(true);
          
          // Update status after request
          const newStatuses = await mobilePermissionService.getPermissionStatuses();
          setPermissionStatus(newStatuses);
          
          console.log('📱 Permission request complete:', results);
        } catch (e) {
          console.error('Failed to request permissions:', e);
        } finally {
          setIsRequesting(false);
        }
      }, 1500); // Wait 1.5s after login

      return () => clearTimeout(timeout);
    }
  }, [user?.id, hasRequested]);

  // Manual request function
  const requestPermissions = useCallback(async (): Promise<PermissionRequestResult> => {
    if (isRequesting) {
      return { notifications: false, camera: false, location: false };
    }

    setIsRequesting(true);
    try {
      const results = await mobilePermissionService.requestAllPermissions(user?.id);
      setHasRequested(true);
      
      // Update status
      const newStatuses = await mobilePermissionService.getPermissionStatuses();
      setPermissionStatus(newStatuses);
      
      return results;
    } finally {
      setIsRequesting(false);
    }
  }, [user?.id, isRequesting]);

  // Individual permission requests
  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    const result = await mobilePermissionService.requestNotificationPermission(user?.id);
    const newStatuses = await mobilePermissionService.getPermissionStatuses();
    setPermissionStatus(newStatuses);
    return result;
  }, [user?.id]);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    const result = await mobilePermissionService.requestCameraPermission();
    const newStatuses = await mobilePermissionService.getPermissionStatuses();
    setPermissionStatus(newStatuses);
    return result;
  }, []);

  return {
    permissionStatus,
    isRequesting,
    hasRequested,
    isNativePlatform: mobilePermissionService.isNativePlatform(),
    requestPermissions,
    requestNotificationPermission,
    requestCameraPermission,
    clearCooldown: () => mobilePermissionService.clearCooldown()
  };
};
