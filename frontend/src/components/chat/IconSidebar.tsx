"use client"

import { MessageSquare, FolderOpen, Settings, PieChart, Sun, Moon, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FeedbackDialog } from "@/components/layout/FeedbackDialog"

interface IconSidebarProps {
  onOpenLibrary: () => void
  onNewChat: () => void
}

export function IconSidebar({ onOpenLibrary, onNewChat }: IconSidebarProps) {
  const { theme, setTheme } = useTheme()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
      supabase.auth.getUser().then(({ data: { user } }) => {
          setUserEmail(user?.email || null)
      })
  }, [supabase])

  const handleLogout = async () => {
      if (typeof window !== 'undefined' && window.google?.accounts?.id) {
          window.google.accounts.id.disableAutoSelect()
      }
      await supabase.auth.signOut()
      window.location.href = '/login' // Redirect to login
  }

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
      <button 
        onClick={onNewChat}
        className={cn(
          "p-2.5 rounded-xl text-white shadow-lg cursor-pointer transition-all hover:scale-105 active:scale-95",
          "bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700",
          "dark:bg-emerald-600 dark:shadow-emerald-900/20 dark:hover:bg-emerald-700"
        )}
        title="New Chat"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      <div className="w-8 h-px bg-slate-200/60 dark:bg-white/10" />

      {/* Nav Actions */}
      <nav className="flex-1 flex flex-col gap-5 w-full items-center">
        <NavButton icon={FolderOpen} label="Projects" onClick={onOpenLibrary} />
        <NavButton icon={PieChart} label="Analytics" onClick={() => alert("Analytics coming soon!")} />
      </nav>

      <div className="mt-auto flex flex-col gap-5 items-center w-full pb-2">
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-white/60 dark:hover:bg-white/10 hover:text-indigo-600 transition-all"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </button>

        {/* Feedback / Settings */}
        <FeedbackDialog>
            <NavButton icon={Settings} label="Feedback" />
        </FeedbackDialog>
        
        {/* User Avatar Menu */}
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button 
                  className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border-2 border-white dark:border-white/20 shadow-sm hover:scale-105 transition-transform flex items-center justify-center text-xs text-white font-bold"
                >
                    {userEmail?.charAt(0).toUpperCase() || "U"}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="w-56 glass border-white/10 ml-2">
                <div className="px-3 py-2 border-b border-white/10">
                    <p className="text-sm font-medium text-foreground truncate">
                        {userEmail?.split('@')[0] || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
                <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-400 focus:text-red-400 cursor-pointer"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

import { forwardRef } from "react"

// ... imports ...

// ... IconSidebar component ...

const NavButton = forwardRef<HTMLButtonElement, { icon: any, label: string, onClick?: () => void }>(
  ({ icon: Icon, label, onClick, ...props }, ref) => {
    return (
      <button 
        ref={ref}
        onClick={onClick}
        {...props}
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-xl transition-all relative group",
          "text-slate-400 hover:bg-white/60 hover:text-indigo-600",
          "dark:hover:bg-white/10 dark:hover:text-emerald-500"
        )}
      >
        <Icon className="w-6 h-6" />
        <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 font-medium tracking-wide shadow-sm">
          {label}
        </div>
      </button>
    )
  }
)
NavButton.displayName = "NavButton"
