import * as React from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { PopupRouteContext, usePopupRouteContent, usePopupRouteRoot } from "@/hooks/usePopupRoute"

type AlertDialogProps = React.ComponentProps<typeof AlertDialogPrimitive.Root> & { routeName?: string }

const AlertDialog = ({ children, open, defaultOpen, onOpenChange, routeName, ...props }: AlertDialogProps) => {
  const routed = usePopupRouteRoot({ open, defaultOpen, onOpenChange, routeName })
  const rootProps = open === undefined
    ? { defaultOpen, onOpenChange: routed.onOpenChange }
    : { open: routed.open, onOpenChange: routed.onOpenChange }

  return (
    <PopupRouteContext.Provider value={routed.contextValue}>
      <AlertDialogPrimitive.Root {...rootProps} {...props}>
        {children}
      </AlertDialogPrimitive.Root>
    </PopupRouteContext.Provider>
  )
}

const AlertDialogTrigger = AlertDialogPrimitive.Trigger

const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300",
      className
    )}
    {...props}
    ref={ref}
  />
))
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & { routeName?: string }
>(({ className, children, ...props }, ref) => (
  <AlertDialogContentInner className={className} forwardedRef={ref} {...props}>
    {children}
  </AlertDialogContentInner>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogContentInner = ({ className, children, forwardedRef, routeName, ...props }: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & { routeName?: string; forwardedRef: React.ForwardedRef<React.ElementRef<typeof AlertDialogPrimitive.Content>> }) => {
  const contentRef = React.useRef<React.ElementRef<typeof AlertDialogPrimitive.Content>>(null)
  usePopupRouteContent(contentRef, routeName || 'confirm-action', 'popup')

  return <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={(node) => {
        contentRef.current = node
        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<typeof node>).current = node
      }}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg max-h-[78vh] translate-x-[-50%] translate-y-[-50%] gap-4 border border-border/40 bg-background p-0 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.14),0_8px_24px_-8px_rgba(0,0,0,0.08)] duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.97] data-[state=open]:zoom-in-[0.97] data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl overflow-y-auto",
        className
      )}
      {...props}
    >
      <div className="h-1 w-full bg-gradient-to-r from-destructive/80 via-destructive to-destructive/60 shrink-0" />
      <div className="px-6 pt-2 pb-6 space-y-4">
        {children}
      </div>
    </AlertDialogPrimitive.Content>
  </AlertDialogPortal>
}

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-left",
      className
    )}
    {...props}
  />
)
AlertDialogHeader.displayName = "AlertDialogHeader"

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 pt-2 border-t border-border/30 sm:flex-row sm:justify-end sm:gap-3",
      className
    )}
    {...props}
  />
)
AlertDialogFooter.displayName = "AlertDialogFooter"

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    data-popup-route-title="true"
    ref={ref}
    className={cn("text-lg font-semibold leading-tight tracking-tight text-foreground", className)}
    {...props}
  />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-[13px] text-muted-foreground leading-relaxed", className)}
    {...props}
  />
))
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants(), className)}
    {...props}
  />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      buttonVariants({ variant: "outline" }),
      "mt-2 sm:mt-0",
      className
    )}
    {...props}
  />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
