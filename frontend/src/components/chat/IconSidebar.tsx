"use client"

import { forwardRef } from "react"
import { MessageSquare, FolderOpen, PieChart } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface IconSidebarProps {
  onOpenLibrary: () => void
  onNewChat: () => void
}

export function IconSidebar({ onOpenLibrary, onNewChat }: IconSidebarProps) {
  return (
    <aside className={cn(
      "w-16 flex-none flex flex-col items-center py-5 gap-6 hidden md:flex",
      "glass-panel rounded-[2rem]",
      // Refined Overrides for Sidebar specifically if needed
      "border-white/30 dark:border-white/5"
    )}>
      {/* Active Chat Tab / New Chat */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            onClick={onNewChat}
            className={cn(
              "p-3 rounded-[18px] text-white shadow-lg cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 group",
              "bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-emerald-900/20",
              "dark:from-emerald-600 dark:to-emerald-700 dark:shadow-emerald-900/30"
            )}
          >
            <MessageSquare className="w-5 h-5 group-hover:rotate-3 transition-transform" strokeWidth={2.5} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          New Chat
        </TooltipContent>
      </Tooltip>

      <div className="w-6 h-[1px] bg-slate-200/50 dark:bg-white/5" />

      {/* Nav Actions */}
      <nav className="flex-1 flex flex-col gap-4 w-full items-center">
        <NavButton icon={FolderOpen} label="Library" onClick={onOpenLibrary} />
        <NavButton icon={PieChart} label="Analytics" onClick={() => alert("Analytics coming soon!")} />
      </nav>
    </aside>
  )
}

interface NavButtonProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
}

const NavButton = forwardRef<HTMLButtonElement, NavButtonProps>(
  ({ icon: Icon, label, onClick, ...props }, ref) => {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            ref={ref}
            onClick={onClick}
            {...props}
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-300",
              "text-slate-400 hover:bg-black/5 hover:text-emerald-600",
              "dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-emerald-400"
            )}
          >
            <Icon className="w-5 h-5" strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          {label}
        </TooltipContent>
      </Tooltip>
    )
  }
)
NavButton.displayName = "NavButton"
