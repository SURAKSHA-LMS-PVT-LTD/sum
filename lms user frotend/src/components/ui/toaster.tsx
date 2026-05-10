import React from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { getImageUrl } from "@/utils/imageUrlHelper"
import { AttendanceStatus, ATTENDANCE_STATUS_CONFIG } from "@/types/attendance.types"

export function Toaster() {
  const { toasts } = useToast()

  // Separate attendance alerts from other messages
  const attendanceAlerts = toasts.filter(t => t.isAttendanceAlert);
  const errorToasts = toasts.filter(t => !t.isAttendanceAlert && t.variant === 'destructive');
  const successToasts = toasts.filter(t => !t.isAttendanceAlert && t.variant !== 'destructive');

  // Get toast variant based on status
  const getToastVariant = (status?: string) => {
    if (!status) return 'default';
    const normalizedStatus = status.toLowerCase() as AttendanceStatus;
    switch (normalizedStatus) {
      case 'present': return 'success';
      case 'absent': return 'absent';
      case 'late': return 'late';
      case 'left':
      case 'left_early':
      case 'left_lately':
        return 'default'; // Use default for new departure statuses
      default: return 'default';
    }
  };

  return (
    <>
      {/* Attendance Alerts - Top Left */}
      <ToastProvider swipeDirection="right">
      {attendanceAlerts.map(function ({ id, title, description, action, imageUrl, status, isAttendanceAlert, ...props }) {
          const variant = getToastVariant(status);
          
          return (
            <Toast key={id} {...props} duration={2500} variant={variant} className="min-w-[350px] py-4 px-4">
              <div className="flex items-center gap-4">
                {/* User Image - Larger */}
                {imageUrl && (
                  <div className="flex-shrink-0">
                    <img 
                      src={getImageUrl(imageUrl)} 
                      alt="User" 
                      className="w-16 h-16 rounded-full object-cover border-3 border-white shadow-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="grid gap-1 flex-1">
                  {title && <ToastTitle className="text-base font-semibold">{title}</ToastTitle>}
                  {description && (
                    <ToastDescription className="text-sm leading-normal">{description}</ToastDescription>
                  )}
                </div>
              </div>
              <ToastClose />
            </Toast>
          )
        })}
        <ToastViewport position="top-left" />
      </ToastProvider>

      {/* Success Messages - Bottom Right */}
      <ToastProvider swipeDirection="right">
        {successToasts.map(function ({ id, title, description, action, imageUrl, status, isAttendanceAlert, variant: _variant, ...props }) {
          return (
            <Toast key={id} {...props} duration={2500} variant="success">
              <div className="grid gap-0.5 flex-1">
                {title && <ToastTitle className="text-sm font-semibold text-white">{title}</ToastTitle>}
                {description && (
                  <ToastDescription className="text-xs leading-tight text-white/90">{description}</ToastDescription>
                )}
              </div>
              <ToastClose className="text-white hover:text-white/80" />
            </Toast>
          )
        })}
        <ToastViewport position="bottom-right" />
      </ToastProvider>

      {/* Error Messages - Bottom Right */}
      <ToastProvider swipeDirection="right">
        {errorToasts.map(function ({ id, title, description, action, imageUrl, status, isAttendanceAlert, variant: _variant, ...props }) {
          return (
            <Toast key={id} {...props} duration={2500} variant="destructive">
              <div className="grid gap-0.5 flex-1">
                {title && <ToastTitle className="text-xs font-medium">{title}</ToastTitle>}
                {description && (
                  <ToastDescription className="text-[11px] leading-tight">{description}</ToastDescription>
                )}
              </div>
              <ToastClose />
            </Toast>
          )
        })}
        <ToastViewport position="bottom-right" />
      </ToastProvider>
    </>
  )
}
