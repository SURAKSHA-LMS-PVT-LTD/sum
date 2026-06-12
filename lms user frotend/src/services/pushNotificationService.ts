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

const DEV = import.meta.env.DEV;

class PushNotificationService {
  private fcmToken: string | null = null;
  private deviceId: string | null = null;
  private nativeListeners: (() => void)[] = [];
  private foregroundCallbacks: ((payload: NotificationPayload) => void)[] = [];
  private notificationClickCallbacks: ((payload: NotificationPayload) => void)[] = [];

  // Prevent duplicate backend registration within the same session
  private registeredUserId: string | null = null;
  private registrationPromise: Promise<FcmTokenResponse | null> | null = null;

  // Native token readiness: resolves when the registration listener fires
  private nativeTokenResolvers: Array<(token: string) => void> = [];

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
      // Registration success — resolve any pending getToken() callers
      const registrationListener = await PushNotifications.addListener('registration', (token: Token) => {
        this.fcmToken = token.value;
        this.nativeTokenResolvers.forEach(resolve => resolve(token.value));
        this.nativeTokenResolvers = [];
      });
      this.nativeListeners.push(() => registrationListener.remove());

      // Registration error
      const errorListener = await PushNotifications.addListener('registrationError', (error) => {
        if (DEV) console.error('Native push registration error:', error);
        // Drain resolvers with empty string so callers don't hang
        this.nativeTokenResolvers.forEach(resolve => resolve(''));
        this.nativeTokenResolvers = [];
      });
      this.nativeListeners.push(() => errorListener.remove());

      // Foreground notification received
      const receivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        const imageUrl = notification.data?.image
          || notification.data?.imageUrl
          || (notification as any).largeIcon
          || (notification as any).image
          || undefined;

        const payload: NotificationPayload = {
          notification: { title: notification.title, body: notification.body, image: imageUrl },
          data: notification.data as NotificationPayload['data'],
        };
        this.foregroundCallbacks.forEach(cb => cb(payload));
      });
      this.nativeListeners.push(() => receivedListener.remove());

      // Notification tapped/clicked
      const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        const notification = action.notification;
        const imageUrl = notification.data?.image
          || notification.data?.imageUrl
          || (notification as any).largeIcon
          || (notification as any).image
          || undefined;

        const payload: NotificationPayload = {
          notification: { title: notification.title, body: notification.body, image: imageUrl },
          data: notification.data as NotificationPayload['data'],
        };

        const targetUrl = (notification.data?.actionUrl as string | undefined) || '/notifications';

        if (this.notificationClickCallbacks.length > 0) {
          this.notificationClickCallbacks.forEach(cb => cb(payload));
        } else {
          // Cold start: React not mounted yet — store for later
          this.pendingNavigationUrl = targetUrl;
        }
      });
      this.nativeListeners.push(() => actionListener.remove());
    } catch (error: any) {
      if (DEV) console.error('Failed to initialize native push listeners:', error);
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
        const result = await PushNotifications.requestPermissions();
        if (result.receive === 'granted') {
          await PushNotifications.register();
          return true;
        }
        return false;
      } catch (error: any) {
        if (DEV) console.error('Native permission request failed:', error);
        return false;
      }
    }

    // Web
    if (!('Notification' in window)) return false;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Get FCM/APNs token
   */
  async getToken(): Promise<string | null> {
    if (isNativePlatform) {
      // Token arrives via the 'registration' listener after PushNotifications.register().
      // If it's already cached return immediately; otherwise wait up to 8s for the callback.
      if (this.fcmToken) return this.fcmToken;
      const token = await new Promise<string>((resolve) => {
        const timer = setTimeout(() => {
          const idx = this.nativeTokenResolvers.indexOf(resolve);
          if (idx > -1) this.nativeTokenResolvers.splice(idx, 1);
          resolve('');
        }, 8000);
        this.nativeTokenResolvers.push((t) => { clearTimeout(timer); resolve(t); });
      });
      return token || null;
    }

    // Web — Firebase
    if (!messaging) return null;

    try {
      const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (currentToken) {
        this.fcmToken = currentToken;
        return currentToken;
      }
      return null;
    } catch (error: any) {
      if (DEV) console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Register push token with backend.
   * Idempotent — returns the cached result if called twice for the same user session.
   */
  async registerToken(userId: string): Promise<FcmTokenResponse | null> {
    if (!this.isSupported()) return null;

    // Already registered for this user in this session — return cached promise
    if (this.registeredUserId === userId && this.registrationPromise) {
      return this.registrationPromise;
    }

    // Different user (e.g. account switch) — reset
    if (this.registeredUserId && this.registeredUserId !== userId) {
      this.registrationPromise = null;
    }

    this.registeredUserId = userId;
    this.registrationPromise = this._doRegisterToken(userId);
    return this.registrationPromise;
  }

  private async _doRegisterToken(userId: string): Promise<FcmTokenResponse | null> {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) return null;

    const token = await this.getToken();
    if (!token) return null;

    this.deviceId = this.generateDeviceId();
    const { deviceName, osVersion } = this.getDeviceInfo();
    const deviceType = this.getDeviceType();

    const appVersion = __APP_BUILD_HASH__ ? __APP_BUILD_HASH__.substring(0, 8) : '1.0.0';

    const payload: FcmTokenPayload = {
      userId,
      fcmToken: token,
      deviceId: this.deviceId,
      deviceType,
      deviceName,
      osVersion,
      appVersion,
      isActive: true,
    };

    try {
      const response = await apiClient.post<FcmTokenResponse>('/users/fcm-tokens', payload);
      if (response?.id) {
        localStorage.setItem('fcm_token_id', response.id);
      }
      return response;
    } catch (error: any) {
      if (DEV) console.error('Failed to register push token:', error);
      // Reset so next login can retry
      this.registeredUserId = null;
      this.registrationPromise = null;
      return null;
    }
  }

  /**
   * Unregister push token when user logs out
   */
  async unregisterToken(): Promise<boolean> {
    const tokenId = localStorage.getItem('fcm_token_id');
    if (!tokenId) return false;

    try {
      await apiClient.delete(`/users/fcm-tokens/${tokenId}`);
      this.fcmToken = null;
      this.registeredUserId = null;
      this.registrationPromise = null;
      localStorage.removeItem('fcm_token_id');
      return true;
    } catch (error: any) {
      if (DEV) console.error('Failed to unregister push token:', error);
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

    // Web — Firebase
    if (!messaging) return () => {};

    const unsubscribe = onMessage(messaging, (payload) => {
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
