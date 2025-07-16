import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-bleu text-white hover:bg-bleu/90",
        secondary: "bg-bleuClair text-khmerCurry hover:bg-bleuClair/90",
        greenOutline: "bg-transparent border-2 border-vert text-vert hover:bg-vert/10",
        redOutline: "bg-transparent border-2 border-khmerCurry text-khmerCurry hover:bg-khmerCurry/10",
        blueOutline: "bg-transparent border-2 border-bleu text-bleu hover:bg-bleu/10",
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        oauth: "bg-transparent border-2 border-darkIron text-darkIron hover:textaf3a-bleuClair/80",
      },
      size: {
        default: "py-2 px-4",
        sm: "py-1 px-2 text-xs",
        lg: "py-3 px-6 text-lg",
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
