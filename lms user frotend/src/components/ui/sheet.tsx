import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"
import { PopupRouteContext, usePopupRouteContent, usePopupRouteRoot } from "@/hooks/usePopupRoute"

type SheetProps = React.ComponentProps<typeof SheetPrimitive.Root> & { routeName?: string }

const Sheet = ({ children, open, defaultOpen, onOpenChange, routeName, ...props }: SheetProps) => {
  const routed = usePopupRouteRoot({ open, defaultOpen, onOpenChange, routeName })
  const rootProps = open === undefined
    ? { defaultOpen, onOpenChange: routed.onOpenChange }
    : { open: routed.open, onOpenChange: routed.onOpenChange }

  return (
    <PopupRouteContext.Provider value={routed.contextValue}>
      <SheetPrimitive.Root {...rootProps} {...props}>
        {children}
      </SheetPrimitive.Root>
    </PopupRouteContext.Provider>
  )
}

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background shadow-[0_24px_80px_-16px_rgba(0,0,0,0.14),0_8px_24px_-8px_rgba(0,0,0,0.08)] transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300 overflow-hidden",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b border-border/40 rounded-b-2xl data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t border-border/40 rounded-t-2xl data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r border-border/40 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm sm:rounded-r-2xl",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l border-border/40 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm sm:rounded-l-2xl",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
  VariantProps<typeof sheetVariants> { routeName?: string }

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetContentInner side={side} className={className} forwardedRef={ref} {...props}>
    {children}
  </SheetContentInner>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetContentInner = ({ side = "right", className, children, forwardedRef, ...props }: SheetContentProps & { forwardedRef: React.ForwardedRef<React.ElementRef<typeof SheetPrimitive.Content>> }) => {
  const contentRef = React.useRef<React.ElementRef<typeof SheetPrimitive.Content>>(null)
  const { routeName, ...contentProps } = props
  usePopupRouteContent(contentRef, routeName || 'details', 'popup')

  return <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={(node) => {
        contentRef.current = node
        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<typeof node>).current = node
      }}
      style={side === 'bottom' ? { maxHeight: 'calc(var(--visual-vh, 100dvh) - 32px)' } : undefined}
      className={cn(sheetVariants({ side }), "p-6 flex flex-col", className)}
      {...contentProps}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain">
        {children}
      </div>
      <SheetPrimitive.Close className="absolute right-3 top-3 rounded-full h-8 w-8 inline-flex items-center justify-center bg-muted/50 text-muted-foreground ring-offset-background transition-all duration-200 hover:bg-muted hover:text-foreground hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
}

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-left pr-8",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
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
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    data-popup-route-title="true"
    ref={ref}
    className={cn("text-lg font-semibold leading-tight tracking-tight text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-[13px] text-muted-foreground leading-relaxed", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet, SheetClose,
  SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetOverlay, SheetPortal, SheetTitle, SheetTrigger
}

