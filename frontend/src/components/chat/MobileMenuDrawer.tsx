'use client'

import Link from 'next/link'
import {
  MessageSquarePlus,
  FolderOpen,
  Settings,
  CreditCard,
  Sparkles,
  MessageSquare
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useI18n } from '@/components/i18n/I18nProvider'

interface Thread {
  id: string
  title: string
  updated_at: string
}

interface MobileMenuDrawerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onNewChat: () => void
  onOpenLibrary: () => void
  threads?: Thread[]
  activeThreadId?: string | null
  onSelectThread?: (threadId: string) => void
}

export function MobileMenuDrawer({ 
  isOpen, 
  onOpenChange, 
  onNewChat, 
  onOpenLibrary,
  threads = [],
  activeThreadId,
  onSelectThread
}: MobileMenuDrawerProps) {
  const { t, locale } = useI18n()

  const handleNewChat = () => {
    onOpenChange(false)
    onNewChat()
  }

  const handleOpenLibrary = () => {
    onOpenChange(false)
    onOpenLibrary()
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className={cn(
          "w-[280px] p-0 flex flex-col border-r shadow-2xl backdrop-blur-xl",
          "bg-white/95 border-white/40",
          "dark:bg-zinc-900/95 dark:border-white/10"
        )}
      >
        {/* Header */}
        <SheetHeader className="p-5 border-b border-slate-200/60 dark:border-white/10">
          <SheetTitle className="flex items-center gap-2.5 text-slate-800 dark:text-white">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-emerald-500 dark:to-teal-600">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold tracking-tight">{t('brand.appName')}</span>
          </SheetTitle>
        </SheetHeader>

        {/* Menu Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {/* New Chat */}
          <MenuButton
            icon={MessageSquarePlus}
            label={t('chat.newChat') || 'New Chat'}
            onClick={handleNewChat}
            primary
          />

          {/* Library */}
          <MenuButton
            icon={FolderOpen}
            label={t('chat.library') || 'My Library'}
            onClick={handleOpenLibrary}
          />

          <div className="h-px bg-slate-200/60 dark:bg-white/10 my-3" />

          {/* Chats Section */}
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-3 py-2 uppercase tracking-wider">
            Chats
          </div>
          
          <div className="space-y-0.5">
            {threads.length === 0 ? (
               <div className="px-3 py-2 text-xs text-slate-400">No chats yet</div>
            ) : (
              threads.map(thread => (
                <button
                  key={thread.id}
                  onClick={() => onSelectThread?.(thread.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3",
                    activeThreadId === thread.id
                      ? "bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                  )}
                >
                  <MessageSquare className={cn(
                    "w-4 h-4 shrink-0", 
                    activeThreadId === thread.id ? "text-emerald-500" : "text-slate-400"
                  )} />
                  <span className="text-sm font-medium truncate">{thread.title || 'New Chat'}</span>
                </button>
              ))
            )}
          </div>

          <div className="h-px bg-slate-200/60 dark:bg-white/10 my-3" />

          {/* Settings */}
          <MenuLink
            icon={Settings}
            label={t('nav.settings')}
            href={`/${locale}/settings`}
            onClick={() => onOpenChange(false)}
          />

          {/* Pricing */}
          <MenuLink
            icon={CreditCard}
            label={t('nav.pricing')}
            href={`/${locale}/settings/pricing`}
            onClick={() => onOpenChange(false)}
          />
        </nav>

        {/* Footer - Simplified hint */}
        <div className="p-4 border-t border-slate-200/60 dark:border-white/10">
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Tap your avatar for more options
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Menu Button (action)
function MenuButton({
  icon: Icon,
  label,
  onClick,
  primary = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
        primary
          ? "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}

// Menu Link (navigation)
function MenuLink({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href: string
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
        "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}
