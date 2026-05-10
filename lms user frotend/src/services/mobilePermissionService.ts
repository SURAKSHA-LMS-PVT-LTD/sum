/**
 * Mobile Permission Service
 * Handles requesting all necessary permissions after user login on mobile devices
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Camera } from '@capacitor/camera';
import { pushNotificationService } from './pushNotificationService';

export interface PermissionStatus {
  notifications: 'granted' | 'denied' | 'prompt' | 'unsupported';
  camera: 'granted' | 'denied' | 'prompt' | 'unsupported';
  location: 'granted' | 'denied' | 'prompt' | 'unsupported';
}

export interface PermissionRequestResult {
  notifications: boolean;
  camera: boolean;
  location: boolean;
}

class MobilePermissionService {
  private hasPromptedThisSession = false;
  private readonly PERMISSION_PROMPT_KEY = 'lastPermissionPromptTime';
  private readonly PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Check if running on native mobile platform
   */
  isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Check if we should prompt for permissions
   * - Only on native platform
   * - Only once per session
   * - Respects cooldown period if user previously denied
   */
  shouldPromptForPermissions(): boolean {
    if (!this.isNativePlatform()) {
      return false;
    }

    if (this.hasPromptedThisSession) {
      return false;
    }

    // Check cooldown
    const lastPromptTime = localStorage.getItem(this.PERMISSION_PROMPT_KEY);
    if (lastPromptTime) {
      const timeSinceLastPrompt = Date.now() - parseInt(lastPromptTime, 10);
      if (timeSinceLastPrompt < this.PROMPT_COOLDOWN_MS) {
        console.log('📱 Permission prompt on cooldown, skipping');
        return false;
      }
    }

    return true;
  }

  /**
   * Get current permission statuses
   */
  async getPermissionStatuses(): Promise<PermissionStatus> {
    const result: PermissionStatus = {
      notifications: 'unsupported',
      camera: 'unsupported',
      location: 'unsupported'
    };

    if (!this.isNativePlatform()) {
      return result;
    }

    try {
      // Check notification permission
      const notifStatus = await PushNotifications.checkPermissions();
      if (notifStatus.receive === 'granted') {
        result.notifications = 'granted';
      } else if (notifStatus.receive === 'denied') {
        result.notifications = 'denied';
      } else {
        result.notifications = 'prompt';
      }
    } catch (e) {
      console.warn('Failed to check notification permission:', e);
    }

    try {
      // Check camera permission
      const cameraStatus = await Camera.checkPermissions();
      if (cameraStatus.camera === 'granted') {
        result.camera = 'granted';
      } else if (cameraStatus.camera === 'denied') {
        result.camera = 'denied';
      } else {
        result.camera = 'prompt';
      }
    } catch (e) {
      console.warn('Failed to check camera permission:', e);
    }

    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const locStatus = await Geolocation.checkPermissions();
      if (locStatus.location === 'granted') {
        result.location = 'granted';
      } else if (locStatus.location === 'denied') {
        result.location = 'denied';
      } else {
        result.location = 'prompt';
      }
    } catch (e) {
      console.warn('Failed to check location permission:', e);
    }

    return result;
  }

  /**
   * Request all necessary permissions
   * Call this after user login on mobile
   */
  async requestAllPermissions(userId?: string): Promise<PermissionRequestResult> {
    const result: PermissionRequestResult = {
      notifications: false,
      camera: false,
      location: false
    };

    if (!this.isNativePlatform()) {
      console.log('📱 Not on native platform, skipping permission requests');
      return result;
    }

    this.hasPromptedThisSession = true;
    localStorage.setItem(this.PERMISSION_PROMPT_KEY, Date.now().toString());

    console.log('📱 Requesting mobile permissions...');

    // Request notification permission and register token
    try {
      const notifResult = await PushNotifications.requestPermissions();
      console.log('📱 Notification permission result:', notifResult);
      
      if (notifResult.receive === 'granted') {
        result.notifications = true;
        // Register for push notifications
        await PushNotifications.register();
        console.log('✅ Push notifications registered');
        
        // Register FCM token with backend if userId provided
        if (userId) {
          try {
            await pushNotificationService.registerToken(userId);
            console.log('✅ FCM token registered with backend');
          } catch (e) {
            console.warn('Failed to register FCM token:', e);
          }
        }
      }
    } catch (e) {
      console.error('❌ Failed to request notification permission:', e);
    }

    // Request camera permission
    try {
      const cameraResult = await Camera.requestPermissions({ permissions: ['camera'] });
      console.log('📱 Camera permission result:', cameraResult);
      
      if (cameraResult.camera === 'granted') {
        result.camera = true;
        console.log('✅ Camera permission granted');
      }
    } catch (e) {
      console.error('❌ Failed to request camera permission:', e);
    }

    // Request location permission
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const locResult = await Geolocation.requestPermissions();
      console.log('📱 Location permission result:', locResult);
      
      if (locResult.location === 'granted') {
        result.location = true;
        console.log('✅ Location permission granted');
      }
    } catch (e) {
      console.error('❌ Failed to request location permission:', e);
    }

    console.log('📱 Permission request results:', result);
    return result;
  }

  /**
   * Request only notification permission
   */
  async requestNotificationPermission(userId?: string): Promise<boolean> {
    if (!this.isNativePlatform()) {
      return false;
    }

    try {
      const result = await PushNotifications.requestPermissions();
      
      if (result.receive === 'granted') {
        await PushNotifications.register();
        
        if (userId) {
          await pushNotificationService.registerToken(userId);
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to request notification permission:', e);
      return false;
    }
  }

  /**
   * Request only camera permission
   */
  async requestCameraPermission(): Promise<boolean> {
    if (!this.isNativePlatform()) {
      return false;
    }

    try {
      const result = await Camera.requestPermissions({ permissions: ['camera'] });
      return result.camera === 'granted';
    } catch (e) {
      console.error('Failed to request camera permission:', e);
      return false;
    }
  }

  /**
   * Reset the session flag (e.g., after logout)
   */
  resetSession(): void {
    this.hasPromptedThisSession = false;
  }

  /**
   * Clear the cooldown (for testing or user-initiated re-prompt)
   */
  clearCooldown(): void {
    localStorage.removeItem(this.PERMISSION_PROMPT_KEY);
    this.hasPromptedThisSession = false;
  }
}

export const mobilePermissionService = new MobilePermissionService();
