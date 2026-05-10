// src/services/pushNotificationService.ts
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { messaging, getToken, onMessage, VAPID_KEY, ON_NATIVE_PLATFORM as isNativePlatform, isFirebaseConfigured } from '../config/firebase';
import { apiClient } from '../api/client';

// Device type enum matching backend
export enum DeviceType {
  ANDROID = 'android',
  IOS = 'ios',
  WEB = 'web'
}

interface FcmTokenPayload {
  userId: string;
  fcmToken: string;
  deviceId: string;
  deviceType: DeviceType;
  deviceName?: string;
  appVersion?: string;
  osVersion?: string;
  isActive?: boolean;
}

interface FcmTokenResponse {
  id: string;
  userId: string;
  fcmToken: string;
  deviceId: string;
  deviceType: DeviceType;
  deviceName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Unified notification payload interface
export interface NotificationPayload {
  notification?: {
    title?: string;
    body?: string;
    icon?: string;
    image?: string;
  };
  data?: {
    notificationId?: string;
    actionUrl?: string;
    scope?: string;
    instituteId?: string;
    [key: string]: string | undefined;
  };
}

class PushNotificationService {
  private fcmToken: string | null = null;
  private deviceId: string | null = null;
  private nativeListeners: (() => void)[] = [];
  private foregroundCallbacks: ((payload: NotificationPayload) => void)[] = [];
  private notificationClickCallbacks: ((payload: NotificationPayload) => void)[] = [];

  // Cold-start: notification tapped when app was killed.
  // The native listener fires before React mounts, so we store the URL here
  // and the useNotificationNavigation hook drains it after mounting.
  private pendingNavigationUrl: string | null = null;

  constructor() {
    // Initialize native listeners if on native platform
    if (isNativePlatform) {
      this.initNativeListeners();
    }
  }

  /**
   * Initialize Capacitor Push Notification listeners for native apps
   */
  private async initNativeListeners(): Promise<void> {
    try {
      // Registration success
      const registrationListener = await PushNotifications.addListener('registration', (token: Token) => {
        console.log('📱 Native Push Registration success, token:', token.value.substring(0, 20) + '...');
        this.fcmToken = token.value;
      });
      this.nativeListeners.push(() => registrationListener.remove());

      // Registration error
      const errorListener = await PushNotifications.addListener('registrationError', (error) => {
        console.error('📱 Native Push Registration error:', error);
      });
      this.nativeListeners.push(() => errorListener.remove());

      // Foreground notification received
      const receivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('📱 Native Push notification received:', notification);

        // Extract image from multiple possible sources (FCM can send in different fields)
        const imageUrl = notification.data?.image
          || notification.data?.imageUrl
          || (notification as any).largeIcon
          || (notification as any).image
          || undefined;

        const payload: NotificationPayload = {
          notification: {
            title: notification.title,
            body: notification.body,
            image: imageUrl
          },
          data: notification.data as NotificationPayload['data']
        };
        this.foregroundCallbacks.forEach(cb => cb(payload));
      });
      this.nativeListeners.push(() => receivedListener.remove());

      // Notification tapped/clicked
      const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('📱 Native Push notification action performed:', action);
        const notification = action.notification;

        // Extract image from multiple possible sources
        const imageUrl = notification.data?.image
          || notification.data?.imageUrl
          || (notification as any).largeIcon
          || (notification as any).image
          || undefined;

        const payload: NotificationPayload = {
          notification: {
            title: notification.title,
            body: notification.body,
            image: imageUrl
          },
          data: notification.data as NotificationPayload['data']
        };

        const targetUrl = (notification.data?.actionUrl as string | undefined) || '/notifications';

        if (this.notificationClickCallbacks.length > 0) {
          // React is already mounted — navigate immediately
          this.notificationClickCallbacks.forEach(cb => cb(payload));
        } else {
          // Cold start: React not mounted yet — store for later
          console.log('📱 Cold start notification tap — storing pending URL:', targetUrl);
          this.pendingNavigationUrl = targetUrl;
        }
      });
      this.nativeListeners.push(() => actionListener.remove());

      console.log('📱 Native push notification listeners initialized');
    } catch (error: any) {
      console.error('Failed to initialize native push listeners:', error);
    }
  }

  /**
   * Generate a unique device ID
   */
  private generateDeviceId(): string {
    const prefix = isNativePlatform 
      ? (Capacitor.getPlatform() === 'android' ? 'android_' : 'ios_')
      : 'web_';
    
    let deviceId = localStorage.getItem('suraksha_device_id');
    if (!deviceId || !deviceId.startsWith(prefix)) {
      deviceId = prefix + crypto.randomUUID();
      localStorage.setItem('suraksha_device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Get current platform/device type
   */
  private getDeviceType(): DeviceType {
    if (isNativePlatform) {
      const platform = Capacitor.getPlatform();
      return platform === 'android' ? DeviceType.ANDROID : DeviceType.IOS;
    }
    return DeviceType.WEB;
  }

  /**
   * Get browser/device information
   */
  private getDeviceInfo(): { deviceName: string; osVersion: string } {
    const userAgent = navigator.userAgent;
    let deviceName = 'Unknown';
    let osVersion = 'Unknown OS';

    if (isNativePlatform) {
      const platform = Capacitor.getPlatform();
      deviceName = platform === 'android' ? 'Android Device' : 'iOS Device';
      osVersion = platform === 'android' ? 'Android' : 'iOS';
    } else {
      // Detect browser
      if (userAgent.includes('Chrome')) {
        deviceName = 'Chrome';
      } else if (userAgent.includes('Firefox')) {
        deviceName = 'Firefox';
      } else if (userAgent.includes('Safari')) {
        deviceName = 'Safari';
      } else if (userAgent.includes('Edge')) {
        deviceName = 'Edge';
      }

      // Detect OS
      if (userAgent.includes('Windows')) {
        osVersion = 'Windows';
      } else if (userAgent.includes('Mac OS')) {
        osVersion = 'macOS';
      } else if (userAgent.includes('Linux')) {
        osVersion = 'Linux';
      } else if (userAgent.includes('Android')) {
        osVersion = 'Android';
      } else if (userAgent.includes('iOS')) {
        osVersion = 'iOS';
      }
    }

    return { deviceName, osVersion };
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    if (isNativePlatform) {
      // Native platforms always support push notifications
      return true;
    }
    // Web requires Notification API and Firebase to be configured
    return typeof window !== 'undefined' && 'Notification' in window && isFirebaseConfigured && messaging !== null;
  }

  /**
   * Get current permission status
   */
  async getPermissionStatus(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
    if (isNativePlatform) {
      try {
        const result = await PushNotifications.checkPermissions();
        if (result.receive === 'granted') return 'granted';
        if (result.receive === 'denied') return 'denied';
        return 'default';
      } catch {
        return 'unsupported';
      }
    }
    
    // Web
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<boolean> {
    if (isNativePlatform) {
      try {
        // Request permission on native
        const result = await PushNotifications.requestPermissions();
        console.log('📱 Native permission result:', result);
        
        if (result.receive === 'granted') {
          // Register with APNs / FCM
          await PushNotifications.register();
          return true;
        }
        return false;
      } catch (error: any) {
        console.error('📱 Native permission request failed:', error);
        return false;
      }
    }

    // Web
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    const permission = await Notification.requestPermission();
    console.log('🌐 Web notification permission:', permission);
    return permission === 'granted';
  }

  /**
   * Get FCM/APNs token
   */
  async getToken(): Promise<string | null> {
    if (isNativePlatform) {
      // For native, token is received via listener after registration
      // Wait a bit for the registration callback
      if (!this.fcmToken) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return this.fcmToken;
    }

    // Web - use Firebase
    if (!messaging) {
      console.warn('Firebase messaging not initialized');
      return null;
    }

    try {
      const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
      
      if (currentToken) {
        console.log('🌐 Web FCM Token obtained:', currentToken.substring(0, 20) + '...');
        this.fcmToken = currentToken;
        return currentToken;
      } else {
        console.warn('No FCM token available. Request permission first.');
        return null;
      }
    } catch (error: any) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Register push token with backend
   * Call this after user logs in
   */
  async registerToken(userId: string): Promise<FcmTokenResponse | null> {
    // Check if supported
    if (!this.isSupported()) {
      console.warn('Push notifications not supported on this platform/browser');
      return null;
    }

    // Step 1: Request permission
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      console.warn('Notification permission denied');
      return null;
    }

    // Step 2: Get token
    const token = await this.getToken();
    if (!token) {
      console.error('Failed to get push token');
      return null;
    }

    // Step 3: Prepare payload
    this.deviceId = this.generateDeviceId();
    const { deviceName, osVersion } = this.getDeviceInfo();
    const deviceType = this.getDeviceType();

    const payload: FcmTokenPayload = {
      userId,
      fcmToken: token,
      deviceId: this.deviceId,
      deviceType,
      deviceName,
      osVersion,
      appVersion: '1.0.0',
      isActive: true
    };

    // Step 4: Send to backend
    try {
      const response = await apiClient.post<FcmTokenResponse>(
        '/users/fcm-tokens',
        payload
      );

      console.log(`${isNativePlatform ? '📱' : '🌐'} Push token registered successfully:`, response);
      
      // Store token ID for later use (e.g., logout)
      if (response?.id) {
        localStorage.setItem('fcm_token_id', response.id);
      }
      
      return response;
    } catch (error: any) {
      console.error('Failed to register push token:', error);
      return null;
    }
  }

  /**
   * Unregister push token when user logs out
   */
  async unregisterToken(): Promise<boolean> {
    const tokenId = localStorage.getItem('fcm_token_id');
    
    if (!tokenId) {
      console.warn('No push token ID found to unregister');
      return false;
    }

    try {
      await apiClient.delete(`/users/fcm-tokens/${tokenId}`);
      console.log(`${isNativePlatform ? '📱' : '🌐'} Push token unregistered successfully`);
      this.fcmToken = null;
      localStorage.removeItem('fcm_token_id');
      return true;
    } catch (error: any) {
      console.error('Failed to unregister push token:', error);
      return false;
    }
  }

  /**
   * Listen for foreground messages
   */
  onForegroundMessage(callback: (payload: NotificationPayload) => void): () => void {
    if (isNativePlatform) {
      // For native, add to callbacks array (listeners already set up)
      this.foregroundCallbacks.push(callback);
      return () => {
        const index = this.foregroundCallbacks.indexOf(callback);
        if (index > -1) {
          this.foregroundCallbacks.splice(index, 1);
        }
      };
    }

    // Web - use Firebase
    if (!messaging) {
      console.warn('Firebase messaging not initialized');
      return () => {};
    }

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('🌐 Web foreground message received:', payload);
      callback(payload as NotificationPayload);
    });

    return unsubscribe;
  }

  /**
   * Listen for notification click/tap actions (native foreground/background + web).
   * For cold-start taps use getPendingNavigationUrl() on hook mount instead.
   */
  onNotificationClick(callback: (payload: NotificationPayload) => void): () => void {
    this.notificationClickCallbacks.push(callback);
    return () => {
      const index = this.notificationClickCallbacks.indexOf(callback);
      if (index > -1) {
        this.notificationClickCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Returns the actionUrl stored during a cold-start notification tap
   * (i.e. the notification was tapped before React mounted).
   * Call clearPendingNavigationUrl() after reading.
   */
  getPendingNavigationUrl(): string | null {
    return this.pendingNavigationUrl;
  }

  /**
   * Clear the pending navigation URL after it has been consumed.
   */
  clearPendingNavigationUrl(): void {
    this.pendingNavigationUrl = null;
  }

  /**
   * Get stored push token
   */
  getStoredToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Get stored device ID
   */
  getStoredDeviceId(): string | null {
    return localStorage.getItem('suraksha_device_id');
  }

  /**
   * Check if running on native platform
   */
  isNative(): boolean {
    return isNativePlatform;
  }

  /**
   * Get current platform
   */
  getPlatform(): 'web' | 'android' | 'ios' {
    if (isNativePlatform) {
      return Capacitor.getPlatform() as 'android' | 'ios';
    }
    return 'web';
  }

  /**
   * Cleanup listeners (call on app unmount if needed)
   */
  cleanup(): void {
    this.nativeListeners.forEach(remove => remove());
    this.nativeListeners = [];
    this.foregroundCallbacks = [];
    this.notificationClickCallbacks = [];
  }
}

export const pushNotificationService = new PushNotificationService();
