import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"
import { PopupRouteContext, usePopupRouteContent, usePopupRouteRoot } from "@/hooks/usePopupRoute"

const Drawer = ({
  shouldScaleBackground = true,
  children,
  open,
  defaultOpen,
  onOpenChange,
  routeName,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root> & { routeName?: string }) => {
  const routed = usePopupRouteRoot({ open, defaultOpen, onOpenChange, routeName })
  const rootProps = open === undefined
    ? { defaultOpen, onOpenChange: routed.onOpenChange }
    : { open: routed.open, onOpenChange: routed.onOpenChange }

  return (
    <PopupRouteContext.Provider value={routed.contextValue}>
      <DrawerPrimitive.Root
        shouldScaleBackground={shouldScaleBackground}
        {...rootProps}
        {...props}
      >
        {children}
      </DrawerPrimitive.Root>
    </PopupRouteContext.Provider>
  )
}
Drawer.displayName = "Drawer"

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & { routeName?: string }
>(({ className, children, ...props }, ref) => (
  <DrawerContentInner className={className} forwardedRef={ref} {...props}>
    {children}
  </DrawerContentInner>
))
DrawerContent.displayName = "DrawerContent"

const DrawerContentInner = ({ className, children, forwardedRef, routeName, ...props }: React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & { routeName?: string; forwardedRef: React.ForwardedRef<React.ElementRef<typeof DrawerPrimitive.Content>> }) => {
  const contentRef = React.useRef<React.ElementRef<typeof DrawerPrimitive.Content>>(null)
  usePopupRouteContent(contentRef, routeName || 'details', 'popup')

  return <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={(node) => {
        contentRef.current = node
        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<typeof node>).current = node
      }}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
        "overflow-hidden",
        className
      )}
      style={{ maxHeight: 'calc(var(--visual-vh, 100dvh) - 32px)' }}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain">
        {children}
      </div>
    </DrawerPrimitive.Content>
  </DrawerPortal>
}

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props}
  />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    data-popup-route-title="true"
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
