"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ChatContainer } from "./ChatContainer"
import { VideoDetailPanel } from "./VideoDetailPanel"
import { MobileMenuDrawer } from "./MobileMenuDrawer"
import { TopHeader } from "./TopHeader"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import type { UIMessage } from "ai"

interface Thread {
    id: string
    title: string
    updated_at: string
}

interface ChatWorkspaceProps {
    activeThreadId: string | null
    initialMessages: UIMessage[]
    onNewChat: () => void
    onSelectThread: (threadId: string) => void
    onThreadCreated?: () => void
    threads?: Thread[]
}

export function ChatWorkspace({
    activeThreadId,
    initialMessages,
    onNewChat,
    onSelectThread,
    onThreadCreated,
    threads
}: ChatWorkspaceProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Existing task params
  const taskId = searchParams.get("task")

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024
      setIsMobile(mobile)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const activeTaskId = taskId

  const setTaskParam = (nextTaskId: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextTaskId) {
      params.set("task", nextTaskId)
    } else {
      params.delete("task")
    }
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div className="flex-1 flex flex-col h-screen relative overflow-hidden bg-transparent">
      {/* Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none dark:hidden -z-10">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <TopHeader onMobileMenuClick={() => setIsMobileMenuOpen(true)} />

      <MobileMenuDrawer
        isOpen={isMobileMenuOpen}
        onOpenChange={setIsMobileMenuOpen}
        onNewChat={() => {
            onNewChat()
            setIsMobileMenuOpen(false)
        }}
        onOpenLibrary={() => { 
            // Library functionality is handled by AppSidebar mostly, 
            // but on mobile this might need to open something or just close menu
            setIsMobileMenuOpen(false)
        }} 
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={(id) => {
            onSelectThread(id)
            setIsMobileMenuOpen(false)
        }}
      />

      {/* Main Layout: Chat + Details */}
      <main className="flex-1 flex m-3 lg:m-4 overflow-hidden gap-4">

        {/* Chat Area */}
        <div className={cn(
          "flex-1 flex flex-col glass-panel relative z-10",
        )}>
          <div className="flex-1 flex flex-col min-w-0 relative h-full">
            <ChatContainer
              // Key ensures complete remount when switching threads to reset useChat state completely
              key={activeThreadId || 'new-chat'}
              threadId={activeThreadId}
              initialMessages={initialMessages}
              activeTaskId={activeTaskId}
              onOpenPanel={(id) => setTaskParam(id)}
              onSelectExample={(id) => setTaskParam(id)} // Might want to link this to task creation too
            />
          </div>
        </div>

        {/* Video Context Panel (Desktop) */}
        <aside className={cn(
          "hidden xl:flex flex-col transition-all duration-700 cubic-bezier(0.19, 1, 0.22, 1) glass-panel",
          activeTaskId
            ? "w-[420px] opacity-100 ml-0 translate-x-0"
            : "w-0 opacity-0 ml-0 border-none translate-x-10"
        )}>
          {activeTaskId && (
            <VideoDetailPanel
              taskId={activeTaskId}
              onClose={() => setTaskParam(null)}
            />
          )}
        </aside>

      </main>

      {/* Mobile Context Panel */}
      <Sheet open={!!(isMobile && activeTaskId)} onOpenChange={(open) => !open && setTaskParam(null)}>
        <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-[2rem] border-t border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-900 [&>button]:hidden">
          <SheetTitle className="sr-only">Video Details</SheetTitle>
          {activeTaskId && (
            <VideoDetailPanel
              taskId={activeTaskId}
              onClose={() => setTaskParam(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
