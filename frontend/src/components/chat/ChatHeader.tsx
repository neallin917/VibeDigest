'use client'

import { Search, MoreVertical, Verified } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ChatHeader() {
  return (
    <header className={cn(
      "h-20 flex items-center justify-between px-8 border-b shrink-0 backdrop-blur-xl z-10 transition-colors",
      "bg-white/30 border-white/30", // Light
      "dark:bg-black/40 dark:border-white/5" // Dark
    )}>
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
            VibeDigest AI
          </h2>
          <Verified className="w-[18px] h-[18px] text-indigo-500 dark:text-emerald-500" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <span>Online • Ready to assist</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Avatars Stack */}
        <div className="flex -space-x-2 mr-2">
          <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-indigo-100 dark:bg-emerald-900" />
          <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-purple-100 dark:bg-emerald-800" />
        </div>
        
        <ActionButton icon={Search} />
        <ActionButton icon={MoreVertical} />
      </div>
    </header>
  )
}

function ActionButton({ icon: Icon }: any) {
  return (
    <button className={cn(
      "h-10 w-10 flex items-center justify-center rounded-full transition-all border shadow-sm",
      "bg-white/40 hover:bg-white/60 border-white/50 text-slate-600 hover:text-indigo-600",
      "dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-slate-300 dark:hover:text-emerald-500"
    )}>
      <Icon className="w-5 h-5" />
    </button>
  )
}
