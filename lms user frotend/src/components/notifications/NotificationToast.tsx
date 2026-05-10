// src/components/notifications/NotificationToast.tsx
import React, { useEffect, useState } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { X, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';

export const NotificationToast: React.FC = () => {
  const { latestNotification, showToast, dismissToast, handleNotificationClick } = usePushNotifications();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if running on mobile platform
    setIsMobile(Capacitor.isNativePlatform() || window.innerWidth < 768);
    
    const handleResize = () => {
      setIsMobile(Capacitor.isNativePlatform() || window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!showToast || !latestNotification) return null;

  const notification = latestNotification.notification;
  const data = latestNotification.data;

  return (
    <div 
      className={cn(
        "fixed z-[100] max-w-sm w-full mx-4",
        "animate-in slide-in-from-top-2 fade-in duration-300",
        // Mobile: center at top with safe area
        isMobile && "left-1/2 -translate-x-1/2 pt-safe-top top-4",
        // Desktop: top right
        !isMobile && "top-4 right-4"
      )}
    >
      <div 
        className={cn(
          "bg-card border border-border rounded-xl shadow-2xl p-4 cursor-pointer",
          "hover:shadow-xl transition-shadow",
          "flex items-start gap-3",
          // Extra shadow for visibility on mobile
          isMobile && "shadow-black/20"
        )}
        onClick={handleNotificationClick}
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          {notification?.icon ? (
            <img 
              src={notification.icon} 
              alt="" 
              className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Bell className="w-6 h-6 text-primary" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-base line-clamp-1">
            {notification?.title || 'New Notification'}
          </p>
          <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
            {notification?.body}
          </p>
          {data?.actionUrl && (
            <p className="text-primary text-xs mt-2 font-medium">
              Tap to view →
            </p>
          )}
        </div>

        {/* Close button */}
        <button 
          className={cn(
            "flex-shrink-0 p-2 hover:bg-muted rounded-full transition-colors",
            // Larger touch target on mobile
            isMobile && "p-3 -mr-1 -mt-1"
          )}
          onClick={(e) => { 
            e.stopPropagation(); 
            dismissToast(); 
          }}
          aria-label="Dismiss notification"
        >
          <X className={cn("text-muted-foreground", isMobile ? "w-5 h-5" : "w-4 h-4")} />
        </button>
      </div>

      {/* Optional image preview */}
      {notification?.image && (
        <div className="mt-2 rounded-xl overflow-hidden shadow-lg">
          <img 
            src={notification.image} 
            alt="" 
            className="w-full h-32 object-cover"
          />
        </div>
      )}
    </div>
  );
};
