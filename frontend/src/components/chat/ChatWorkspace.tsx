"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { ChatContainer } from "./ChatContainer"
import { VideoDetailPanel } from "./VideoDetailPanel"
import { LibrarySidebar } from "./LibrarySidebar"
import { MobileMenuDrawer } from "./MobileMenuDrawer"
import { TopHeader } from "./TopHeader"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

export function ChatWorkspace() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const taskId = searchParams.get("task")
  const libraryParam = searchParams.get("library")

  const [isLibraryOpen, setIsLibraryOpen] = useState(libraryParam === "open")
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(taskId)
  const [isMobile, setIsMobile] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  // Detect mobile (XL breakpoint)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1280)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Sync URL
  useEffect(() => {
    if (taskId) setActiveTaskId(taskId)
  }, [taskId])

  const handleTaskSelect = (id: string) => {
    setActiveTaskId(id)
    setIsLibraryOpen(false)
    router.push(`?task=${id}`, { scroll: false })
  }

  const handleNewChat = () => {
    setActiveTaskId(null)
    router.push('/chat', { scroll: false })
    setResetKey(prev => prev + 1)
  }

  return (
    <div className="flex-1 flex flex-col h-screen relative overflow-hidden bg-transparent">
      {/* Background Blobs (Light Mode Only) - defined in globals.css */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none dark:hidden -z-10">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Top Header - Inside Workspace (Gemini Style) */}
      <TopHeader onMobileMenuClick={() => setIsMobileMenuOpen(true)} />

      {/* Mobile Menu Drawer (controlled by TopHeader hamburger) */}
      <MobileMenuDrawer 
        isOpen={isMobileMenuOpen}
        onOpenChange={setIsMobileMenuOpen}
        onNewChat={handleNewChat}
        onOpenLibrary={() => setIsLibraryOpen(true)}
      />

      {/* Unified Frame: Chat + Context Panel */}
      <main className={cn(
        "flex-1 flex m-3 lg:m-4 rounded-[2rem] shadow-glass overflow-hidden ring-1 backdrop-blur-xl",
        "bg-white/65 ring-white/60",
        "dark:bg-[#1A1A1A]/50 dark:ring-white/5 dark:shadow-none"
      )}>
        {/* Chat Area (flex-1) */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <ChatContainer
            key={resetKey}
            activeTaskId={activeTaskId}
            onTaskCreated={handleTaskSelect}
            onOpenPanel={(id: string) => setActiveTaskId(id)}
            onSelectExample={handleTaskSelect}
          />
        </div>

        {/* Context Panel (XL screens only) - Inside the same container */}
        <aside className={cn(
          "hidden xl:flex flex-col transition-all duration-500 ease-in-out",
          activeTaskId
            ? "w-[420px] opacity-100 border-l border-slate-200/50 dark:border-white/10"
            : "w-0 opacity-0 overflow-hidden"
        )}>
          {activeTaskId && (
            <VideoDetailPanel
              taskId={activeTaskId}
              onClose={() => setActiveTaskId(null)}
            />
          )}
        </aside>
      </main>

      {/* Mobile/Tablet Modal for Context Panel */}
      <Sheet open={!!(isMobile && activeTaskId)} onOpenChange={(open) => !open && setActiveTaskId(null)}>
        <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-[2rem] border-t border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-900 [&>button]:hidden">
          <SheetTitle className="sr-only">Video Details</SheetTitle>
          {activeTaskId && (
            <VideoDetailPanel
              taskId={activeTaskId}
              onClose={() => setActiveTaskId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Mobile Library Drawer (only for mobile) */}
      <LibrarySidebar
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelectTask={handleTaskSelect}
      />
    </div>
  )
}
