import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 dark:bg-primary dark:text-white dark:hover:bg-primary/80 dark:shadow-primary/20",
        destructive:
          "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/30 dark:bg-destructive dark:text-white dark:hover:bg-destructive/80",
        outline:
          "border-2 border-input bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary dark:border-border dark:bg-transparent dark:text-foreground dark:hover:bg-primary dark:hover:text-white dark:hover:border-primary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-primary dark:hover:text-white",
        ghost: "hover:bg-primary/10 hover:text-primary dark:text-foreground dark:hover:bg-primary/20 dark:hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline dark:text-primary",
        premium: "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl hover:shadow-primary/25 hover:from-primary/90 hover:to-primary/70 dark:from-primary dark:to-primary/70 dark:hover:from-primary/90 dark:hover:to-primary/60",
        accent: "bg-accent text-accent-foreground shadow-md hover:bg-primary hover:text-primary-foreground hover:shadow-lg hover:shadow-primary/20 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary dark:hover:text-white",
        success: "bg-success text-success-foreground shadow-md hover:bg-success/90 hover:shadow-lg hover:shadow-success/20 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500",
        danger: "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/30 dark:bg-destructive dark:text-white dark:hover:bg-destructive/80",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-2xl px-10 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
