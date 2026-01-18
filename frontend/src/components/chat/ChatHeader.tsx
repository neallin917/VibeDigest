'use client'

import { Search, MoreVertical, Verified } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/components/i18n/I18nProvider'
import { UserAvatarDropdown } from './UserAvatarDropdown'

export function ChatHeader() {
  const { t } = useI18n()

  return (
    <header className={cn(
      "h-16 md:h-20 flex items-center justify-between px-4 md:px-8 border-b shrink-0 backdrop-blur-xl z-10 transition-colors",
      "bg-white/30 border-white/30", // Light
      "dark:bg-black/40 dark:border-white/5" // Dark
    )}>
      {/* Left side with padding for mobile menu button */}
      <div className="flex flex-col pl-10 md:pl-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white tracking-tight">
            {t('brand.appName')}
          </h2>
          <Verified className="w-4 h-4 md:w-[18px] md:h-[18px] text-indigo-500 dark:text-emerald-500" />
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <span>Online</span>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Action Buttons */}
        <ActionButton icon={Search} className="hidden sm:flex" />
        <ActionButton icon={MoreVertical} className="hidden sm:flex" />
        
        {/* User Avatar Dropdown - Now in header */}
        <UserAvatarDropdown align="end" side="bottom" />
      </div>
    </header>
  )
}

function ActionButton({ icon: Icon, className }: { icon: React.ComponentType<{ className?: string }>, className?: string }) {
  return (
    <button className={cn(
      "h-9 w-9 md:h-10 md:w-10 flex items-center justify-center rounded-full transition-all border shadow-sm",
      "bg-white/40 hover:bg-white/60 border-white/50 text-slate-600 hover:text-indigo-600",
      "dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-slate-300 dark:hover:text-emerald-500",
      className
    )}>
      <Icon className="w-4 h-4 md:w-5 md:h-5" />
    </button>
  )
}
