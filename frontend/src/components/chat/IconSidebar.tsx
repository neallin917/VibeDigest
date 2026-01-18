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
      "w-16 flex-none flex flex-col items-center py-4 gap-6 hidden md:flex",
      "rounded-[2rem] border shadow-sm backdrop-blur-xl transition-all",
      // Light Mode
      "bg-white/65 border-white/40",
      // Dark Mode
      "dark:bg-black/40 dark:border-white/10"
    )}>
      {/* Active Chat Tab / New Chat */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            onClick={onNewChat}
            className={cn(
              "p-2.5 rounded-xl text-white shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95",
              "bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700",
              "dark:bg-emerald-600 dark:shadow-emerald-900/20 dark:hover:bg-emerald-700"
            )}
          >
            <MessageSquare className="w-6 h-6" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          New Chat
        </TooltipContent>
      </Tooltip>

      <div className="w-8 h-px bg-slate-200/60 dark:bg-white/10" />

      {/* Nav Actions */}
      <nav className="flex-1 flex flex-col gap-5 w-full items-center">
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
              "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
              "text-slate-400 hover:bg-white/60 hover:text-emerald-600",
              "dark:hover:bg-white/10 dark:hover:text-emerald-500"
            )}
          >
            <Icon className="w-6 h-6" />
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
