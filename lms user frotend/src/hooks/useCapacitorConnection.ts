import { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

export const useCapacitorConnection = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(Capacitor.isNativePlatform());

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setIsLoading(false);
      return;
    }

    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const init = async () => {
      try {
        const status = await Network.getStatus();
        setIsOnline(status.connected);
      } catch {
        setIsOnline(true);
      } finally {
        setIsLoading(false);
      }

      try {
        listenerHandle = await Network.addListener('networkStatusChange', (status) => {
          setIsOnline(status.connected);
        });
      } catch {
        // Network plugin unavailable — assume online
      }
    };

    void init();

    return () => {
      if (listenerHandle) void listenerHandle.remove();
    };
  }, []);

  const retry = () => {
    window.location.reload();
  };

  return { isOnline, isLoading, retry };
};
