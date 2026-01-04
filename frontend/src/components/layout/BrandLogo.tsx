import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface BrandLogoProps {
    className?: string
    showText?: boolean
    textClassName?: string
}

export function BrandLogo({ className, showText = true, textClassName }: BrandLogoProps) {
    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/20 transition-shadow">
                <Sparkles className="w-3.5 h-3.5 text-black fill-black/20" />
            </div>
            {showText && (
                <span className={cn("font-semibold text-white/90", textClassName)}>
                    VibeDigest
                </span>
            )}
        </div>
    )
}
