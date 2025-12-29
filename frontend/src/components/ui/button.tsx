import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    {
        variants: {
            variant: {
                default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(62,207,142,0.3)]",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                outline:
                    "border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-white/10",
                ghost: "hover:bg-white/5 hover:text-foreground",
                link: "text-primary underline-offset-4 hover:underline",
                supa: "bg-[#3ECF8E] text-white hover:bg-[#34b27b] shadow-[0_0_15px_rgba(62,207,142,0.25)] hover:shadow-[0_0_25px_rgba(62,207,142,0.4)]",
                // New: Pill style with purple accent (anygen.io inspired)
                pill: "rounded-full bg-black text-white border border-white/10 hover:bg-white/5 hover:border-white/20",
                "pill-primary": "rounded-full bg-primary text-black font-semibold hover:bg-primary/90 shadow-[0_0_20px_rgba(62,207,142,0.25)] hover:shadow-[0_0_30px_rgba(62,207,142,0.4)] hover:scale-[1.02]",
                "pill-purple": "rounded-full bg-gradient-to-r from-[#7377DD] to-[#8B5CF6] text-white font-semibold hover:opacity-90 shadow-[0_0_20px_rgba(115,119,221,0.3)] hover:shadow-[0_0_30px_rgba(115,119,221,0.5)] hover:scale-[1.02]",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-xl px-3",
                lg: "h-11 rounded-xl px-8",
                xl: "h-12 rounded-xl px-6 text-base",
                icon: "h-10 w-10 rounded-xl",
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
