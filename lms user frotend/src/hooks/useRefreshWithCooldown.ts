import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * Custom hook to handle refresh with cooldown period
 * Prevents rapid refresh button clicks (default 10 seconds cooldown)
 */
export function useRefreshWithCooldown(cooldownSeconds: number = 10) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRefresh, setCanRefresh] = useState(true);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const { toast } = useToast();
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startCooldown = useCallback(() => {
    setCanRefresh(false);
    setCooldownRemaining(cooldownSeconds);

    // Countdown timer (update every second)
    let remaining = cooldownSeconds;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setCooldownRemaining(remaining);
      if (remaining <= 0 && countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    }, 1000);

    // Cooldown timer (reset canRefresh after cooldown)
    cooldownTimerRef.current = setTimeout(() => {
      setCanRefresh(true);
      setCooldownRemaining(0);
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    }, cooldownSeconds * 1000);
  }, [cooldownSeconds]);

  const refresh = useCallback(async (
    refreshFn: () => Promise<void>,
    options?: {
      successMessage?: string | false;
      errorMessage?: string;
      skipCooldown?: boolean;
    }
  ) => {
    if (!canRefresh && !options?.skipCooldown) {
      toast({
        title: "Please Wait",
        description: `You can refresh again in ${cooldownRemaining} seconds`,
        variant: "default",
      });
      return false;
    }

    setIsRefreshing(true);
    try {
      // Just call the refresh function - it passes forceRefresh=true to individual API calls
      // No global cache bypass needed; cache stays valid for other data
      await refreshFn();
      
      if (options?.successMessage !== false) {
        toast({
          title: "Refreshed Successfully",
          description: typeof options?.successMessage === 'string' ? options.successMessage : "Data has been refreshed from server",
        });
      }

      if (!options?.skipCooldown) {
        startCooldown();
      }
      
      return true;
    } catch (error: any) {
      console.error('Refresh error:', error);
      toast({
        title: "Refresh Failed",
        description: options?.errorMessage || (error instanceof Error ? error.message : "Failed to refresh data"),
        variant: "destructive",
      });
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [canRefresh, cooldownRemaining, startCooldown, toast]);

  // Cleanup timers on unmount
  const cleanup = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }
  }, []);

  return {
    refresh,
    isRefreshing,
    canRefresh,
    cooldownRemaining,
    cleanup
  };
}
