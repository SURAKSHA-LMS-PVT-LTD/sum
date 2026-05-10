// src/stores/useNotificationStore.ts
// Global notification state — call initUnreadCount ONCE on app load, then manage locally.
import { useState, useCallback, useRef, useEffect } from 'react';
import { notificationApiService } from '@/services/notificationApiService';

// Simple singleton store pattern (no external dependencies)
let globalUnreadCount = 0;
let contextUnreadCount = 0;
let isCountLoaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

// Module-level stable function — safe to call from useEffect without deps
export async function refreshContextCount(instituteId?: string): Promise<void> {
  try {
    if (instituteId) {
      const { unreadCount } = await notificationApiService.getInstituteUnreadCount(instituteId);
      contextUnreadCount = unreadCount || 0;
    } else {
      const { unreadCount } = await notificationApiService.getSystemUnreadCount();
      contextUnreadCount = unreadCount || 0;
    }
    notify();
  } catch (e) {
    console.error('Failed to refresh context unread count:', e);
  }
}

export function useNotificationStore() {
  const [, forceUpdate] = useState(0);
  const registered = useRef(false);

  useEffect(() => {
    const listener = () => forceUpdate((c) => c + 1);
    listeners.add(listener);
    registered.current = true;
    // Cleanup removes the listener when the component unmounts, preventing memory leaks.
    // Module-level state (globalUnreadCount, isCountLoaded) is preserved independently.
    return () => { listeners.delete(listener); };
  }, []);

  const initUnreadCount = useCallback(async () => {
    if (isCountLoaded) return;
    try {
      const { unreadCount } = await notificationApiService.getMyUnreadCount();
      globalUnreadCount = unreadCount || 0;
      isCountLoaded = true;
      notify();
    } catch (e) {
      console.error('Failed to load unread count:', e);
    }
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const { unreadCount } = await notificationApiService.getMyUnreadCount();
      globalUnreadCount = unreadCount || 0;
      isCountLoaded = true;
      notify();
    } catch (e) {
      console.error('Failed to refresh unread count:', e);
    }
  }, []);

  const decrementUnread = useCallback((count = 1) => {
    globalUnreadCount = Math.max(0, globalUnreadCount - count);
    notify();
  }, []);

  const incrementUnread = useCallback((count = 1) => {
    globalUnreadCount = globalUnreadCount + count;
    notify();
  }, []);

  const resetUnread = useCallback(() => {
    globalUnreadCount = 0;
    notify();
  }, []);

  const setUnread = useCallback((count: number) => {
    globalUnreadCount = count;
    isCountLoaded = true;
    notify();
  }, []);

  return {
    globalUnreadCount,
    contextUnreadCount,
    isCountLoaded,
    initUnreadCount,
    refreshUnreadCount,
    decrementUnread,
    incrementUnread,
    resetUnread,
    setUnread,
  };
}
