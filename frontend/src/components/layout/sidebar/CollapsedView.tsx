"use client"

import { Plus, Library } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface CollapsedViewProps {
    onNewChat: () => void
    onCommunityClick: () => void
    t: (key: string) => string
}

export function CollapsedView({ onNewChat, onCommunityClick, t }: CollapsedViewProps) {
    return (
        <nav className="flex-1 flex flex-col gap-1.5 pt-2">
            {/* New Task */}
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <button
                        onClick={onNewChat}
                        className={cn(
                            "p-3 rounded-xl flex items-center justify-center transition-all",
                            "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
                            "dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10"
                        )}
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>
                    {t("chat.newChat") || "New task"}
                </TooltipContent>
            </Tooltip>

            {/* Community */}
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <button
                        onClick={onCommunityClick}
                        className={cn(
                            "p-3 rounded-xl flex items-center justify-center transition-all",
                            "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
                            "dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10"
                        )}
                    >
                        <Library className="w-5 h-5" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>
                    {t("chat.community") || "Community"}
                </TooltipContent>
            </Tooltip>
        </nav>
    )
}
