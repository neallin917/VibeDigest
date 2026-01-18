"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { IconSidebar } from "./IconSidebar"
import { ChatContainer } from "./ChatContainer"
import { VideoDetailPanel } from "./VideoDetailPanel"
import { LibrarySidebar } from "./LibrarySidebar"
import { MobileMenuDrawer } from "./MobileMenuDrawer"
import { Sheet, SheetContent } from "@/components/ui/sheet"

export function ChatWorkspace() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const taskId = searchParams.get("task")
  const libraryParam = searchParams.get("library")

  const [isLibraryOpen, setIsLibraryOpen] = useState(libraryParam === "open")
  const [activeTaskId, setActiveTaskId] = useState<string | null>(taskId)
  const [isMobile, setIsMobile] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1280) // XL breakpoint
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
    <div className="h-screen w-full p-3 lg:p-5 gap-5 flex relative overflow-hidden bg-transparent">
      {/* Background Blobs (Light Mode Only) - defined in globals.css */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none dark:hidden -z-10">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Mobile Menu (Hamburger + Drawer) */}
      <MobileMenuDrawer 
        onNewChat={handleNewChat}
        onOpenLibrary={() => setIsLibraryOpen(true)}
      />

      {/* 1. Icon Sidebar (Left) - Desktop only */}
      <IconSidebar 
        onOpenLibrary={() => setIsLibraryOpen(true)} 
        onNewChat={handleNewChat}
      />

      {/* 2. Main Chat (Center) */}
      <main className={cn(
        "flex-1 flex flex-col min-w-0 rounded-[2.5rem] shadow-glass relative overflow-hidden ring-1 transition-all backdrop-blur-xl",
        "bg-white/65 ring-white/60", // Light
        "dark:bg-[#1A1A1A]/50 dark:ring-white/5 dark:shadow-none" // Dark
      )}>
        <ChatContainer 
          key={resetKey}
          onTaskCreated={handleTaskSelect} 
          onOpenPanel={(id: string) => setActiveTaskId(id)}
          onSelectExample={handleTaskSelect}
        />
      </main>

      {/* 3. Context Panel (Right) - Visible on XL screens */}
      <aside className={cn(
        "w-96 flex-none hidden xl:flex flex-col gap-5 transition-all duration-500 ease-in-out transform",
        activeTaskId ? "w-96 opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-20 overflow-hidden"
      )}>
        {activeTaskId && (
          <VideoDetailPanel 
            taskId={activeTaskId} 
            onClose={() => setActiveTaskId(null)} 
          />
        )}
      </aside>

      {/* Mobile/Tablet Modal for Context Panel */}
      <Sheet open={!!(isMobile && activeTaskId)} onOpenChange={(open) => !open && setActiveTaskId(null)}>
        <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-[2rem] border-t border-slate-200 dark:border-white/20 bg-white dark:bg-zinc-900">
          {activeTaskId && (
            <VideoDetailPanel 
              taskId={activeTaskId} 
              onClose={() => setActiveTaskId(null)} 
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Library Drawer */}
      <LibrarySidebar 
        isOpen={isLibraryOpen} 
        onClose={() => setIsLibraryOpen(false)}
        onSelectTask={handleTaskSelect}
      />
    </div>
  )
}
