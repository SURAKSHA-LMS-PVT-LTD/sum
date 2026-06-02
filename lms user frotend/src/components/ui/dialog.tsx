import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { PopupRouteContext, usePopupRouteContent, usePopupRouteRoot } from "@/hooks/usePopupRoute";

type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root> & { routeName?: string };

const Dialog = ({ children, open, defaultOpen, onOpenChange, routeName, ...props }: DialogProps) => {
  const routed = usePopupRouteRoot({ open, defaultOpen, onOpenChange, routeName });
  const rootProps = open === undefined
    ? { defaultOpen, onOpenChange: routed.onOpenChange }
    : { open: routed.open, onOpenChange: routed.onOpenChange };

  return (
    <PopupRouteContext.Provider value={routed.contextValue}>
      <DialogPrimitive.Root {...rootProps} {...props}>
        {children}
      </DialogPrimitive.Root>
    </PopupRouteContext.Provider>
  );
};
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
  ({ className, ...props }, ref) =>
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300",
      className
    )}
    {...props} />

);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Set to true to allow closing by clicking outside (default: false — prevents accidental data loss) */
    allowOutsideClose?: boolean;
    routeName?: string;
  }>(
  ({ className, children, allowOutsideClose = false, routeName, ...props }, ref) => {
    const isMobile = useIsMobile();
    const routeContext = React.useContext(PopupRouteContext);
    const contentRef = React.useRef<React.ElementRef<typeof DialogPrimitive.Content>>(null);
    
    // Use routeName from context first (from Dialog), then prop, then default
    const finalRouteName = routeContext?.routeName || routeName || 'details';
    usePopupRouteContent(contentRef, finalRouteName, 'popup');

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={(node) => {
            contentRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<typeof node>).current = node;
          }}
          onInteractOutside={(e) => {
            if (!allowOutsideClose) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            if (!allowOutsideClose) {
              e.preventDefault();
            }
          }}
          style={isMobile ? { maxHeight: 'calc(var(--visual-vh, 100dvh) - 32px)' } : undefined}
          className={cn(
            isMobile
              // Mobile: full-width bottom sheet — uses --visual-vh so it shrinks when the keyboard opens
              ? "fixed bottom-0 left-0 right-0 z-50 flex flex-col w-full bg-background border-t border-border/50 rounded-t-3xl shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.2)] overflow-hidden duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
              // Desktop: modern centered dialog with glass border + layered shadow
              : "fixed left-[50%] top-[50%] z-50 grid w-full max-w-2xl max-h-[90vh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 bg-background border border-border/40 p-0 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.14),0_8px_24px_-8px_rgba(0,0,0,0.08)] duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.97] data-[state=open]:zoom-in-[0.97] data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl",
            className
          )}
          {...props}
        >
          {isMobile ? (
            <>
              {/* Mobile: drag pill + close button */}
              <div className="flex items-center justify-between px-5 pt-3 pb-1 shrink-0">
                <div className="w-8" />
                <div className="w-12 h-1.5 rounded-full bg-muted-foreground/20" />
                <DialogPrimitive.Close className="rounded-full h-8 w-8 inline-flex items-center justify-center bg-muted/60 text-muted-foreground ring-offset-background transition-all hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>
              {/* Mobile: scrollable content — keyboard-aware */}
              <div
                className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-8"
                onFocusCapture={(e) => {
                  const el = e.target as HTMLElement;
                  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
                    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
                  }
                }}
              >
                {children}
              </div>
            </>
          ) : (
            <>
              {/* Desktop: accent top line */}
              <div className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-primary/80 via-primary to-primary/60 shrink-0" />
              <div className="px-8 pt-5 pb-8 space-y-6">
                {children}
              </div>
              <DialogPrimitive.Close className="absolute right-4 top-5 rounded-full h-9 w-9 inline-flex items-center justify-center bg-muted/50 text-muted-foreground ring-offset-background transition-all duration-200 hover:bg-muted hover:text-foreground hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  });
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) =>
<div
  className={cn("flex flex-col space-y-3 text-left pr-12", className)}
  {...props} />;


DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) =>
<div
  className={cn("flex flex-col-reverse gap-3 pt-4 border-t border-border/30 sm:flex-row sm:justify-end sm:gap-3", className)}
  {...props} />;


DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title
      data-popup-route-title="true"
      ref={ref}
      className={cn(
        "text-xl font-semibold leading-tight tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  )
);
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  ({ className, ...props }, ref) =>
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props} />

);
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };