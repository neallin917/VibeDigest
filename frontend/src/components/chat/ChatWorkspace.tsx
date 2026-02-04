"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ChatContainer } from "./ChatContainer"
import dynamic from "next/dynamic"
import { Loader2, GripVertical } from "lucide-react"

const VideoDetailPanel = dynamic(
  () => import("./VideoDetailPanel").then((mod) => mod.VideoDetailPanel),
  {
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }
)
import { MobileMenuDrawer } from "./MobileMenuDrawer"
import { TopHeader } from "./TopHeader"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import type { UIMessage } from "ai"
import { useI18n } from "@/components/i18n/I18nProvider"

interface Thread {
  id: string
  title: string
  updated_at: string
}

interface ChatWorkspaceProps {
  activeThreadId: string | null
  activeTaskId: string | null
  initialMessages: UIMessage[]
  onNewChat: () => void
  onSelectThread: (threadId: string) => void
  onSelectTask: (taskId: string | null) => void
  onSelectExample?: (taskId: string) => void
  onThreadCreated?: () => void
  onChatStarted?: (threadId: string) => void
  threads?: Thread[]
}


export function ChatWorkspace({
  activeThreadId,
  activeTaskId,
  initialMessages,
  onNewChat,
  onSelectThread,
  onSelectTask,
  onSelectExample,
  onThreadCreated,
  onChatStarted,
  threads
}: ChatWorkspaceProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const { locale } = useI18n()

  // Resizable logic
  const [panelWidth, setPanelWidth] = useState(420)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  // Load width from localStorage or set default to 60%
  useEffect(() => {
    const savedWidth = localStorage.getItem("vibe_panel_width")
    if (savedWidth) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPanelWidth(parseInt(savedWidth, 10))
    } else {
      // Default to 60% of screen width if no saved preference
      // This provides a better reading experience for the transcript/summary
      const defaultWidth = Math.floor(window.innerWidth * 0.6)
      // Ensure it respects min/max constraints we'll enforce later
      const constrainedWidth = Math.max(320, Math.min(defaultWidth, window.innerWidth - 320))
      setPanelWidth(constrainedWidth)
    }
  }, [])

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

  const setTaskParam = useCallback((nextTaskId: string | null) => {
    onSelectTask(nextTaskId)
  }, [onSelectTask])

  const startResizing = useCallback(() => {
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
    localStorage.setItem("vibe_panel_width", panelWidth.toString())
  }, [panelWidth])

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        // Calculate new width: window width - mouse X - right margin (approx 16px)
        const newWidth = document.body.clientWidth - mouseMoveEvent.clientX - 16

        // Min 320px, Max 80% of screen (relaxed from 60% to allow wider context)
        // Also ensure left chat panel maintains at least 320px
        const maxAllowed = Math.max(320, document.body.clientWidth - 320)

        if (newWidth > 320 && newWidth < maxAllowed) {
          setPanelWidth(newWidth)
        }
      }
    },
    [isResizing]
  )

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize)
      window.addEventListener("mouseup", stopResizing)
    }
    return () => {
      window.removeEventListener("mousemove", resize)
      window.removeEventListener("mouseup", stopResizing)
    }
  }, [isResizing, resize, stopResizing])


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
          router.push(`/${locale}/explore`)
          setIsMobileMenuOpen(false)
        }}
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={(id) => {
          onSelectThread(id)
          setIsMobileMenuOpen(false)
        }}
        onSelectTask={(taskId) => {
          setTaskParam(taskId)
        }}
      />

      {/* Main Layout: Chat + Details */}
      <main className="flex-1 flex m-3 lg:m-4 overflow-hidden gap-0"> {/* gap-0 because handle adds spacing if needed */}

        {/* Chat Area */}
        <div className={cn(
          "flex-1 flex flex-col min-h-0 glass-panel relative z-10",
        )}>
          <div className="flex-1 flex flex-col min-w-0 min-h-0 relative h-full">
            <ChatContainer
              // Key ensures complete remount when switching threads to reset useChat state completely
              key={activeThreadId || 'new-chat'}
              threadId={activeThreadId}
              initialMessages={initialMessages}
              activeTaskId={activeTaskId}
              onOpenPanel={setTaskParam}
              onSelectExample={onSelectExample || setTaskParam}
              onChatStarted={onChatStarted}
            />
          </div>
        </div>

        {/* Resizer Handle (Desktop Only) */}
        {activeTaskId && (
          <div
            className="hidden lg:flex w-4 cursor-col-resize items-center justify-center hover:bg-white/5 transition-colors z-20"
            onMouseDown={startResizing}
          >
            <div className="w-1 h-8 rounded-full bg-slate-300 dark:bg-white/20" />
          </div>
        )}

        {/* Video Context Panel (Desktop) */}
        <aside
          ref={sidebarRef}
          className={cn(
            "hidden lg:flex flex-col glass-panel overflow-hidden",
            activeTaskId
              ? "opacity-100 ml-0 translate-x-0"
              : "w-0 opacity-0 ml-0 border-none translate-x-10",
            // Disable transition during resize to avoid lag/rubber-banding
            !isResizing && "transition-all duration-700 cubic-bezier(0.19, 1, 0.22, 1)"
          )}
          style={{
            width: activeTaskId ? panelWidth : 0
          }}
        >
          {activeTaskId && (
            <VideoDetailPanel
              key={activeTaskId}
              taskId={activeTaskId}
              onClose={() => setTaskParam(null)}
            />
          )}
        </aside>

      </main>

      {/* Mobile Context Panel */}
      <Sheet
        open={!!(isMobile && activeTaskId)}
        onOpenChange={(open) => {
          if (isMobile && !open) {
            setTaskParam(null)
          }
        }}
      >
        <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-[2rem] border-t border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-900 [&>button]:hidden">
          <SheetTitle className="sr-only">Video Details</SheetTitle>
          {activeTaskId && (
            <VideoDetailPanel
              key={activeTaskId}
              taskId={activeTaskId}
              onClose={() => setTaskParam(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
