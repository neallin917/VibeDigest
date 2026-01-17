"use client"

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { Sidebar } from "@/components/layout/Sidebar"
import { MobileBottomNav, MobileHeader } from "@/components/layout/MobileNav"
import { TaskNotificationListener } from "@/components/tasks/TaskNotificationListener"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n/I18nProvider"
import { createClient } from "@/lib/supabase"

const SIDEBAR_HIDDEN_STORAGE_KEY = "vd.sidebarHidden"
const SIDEBAR_HIDDEN_EVENT = "vd:sidebarHidden"

function readSidebarHiddenFromStorage(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(SIDEBAR_HIDDEN_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

function writeSidebarHiddenToStorage(hidden: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_HIDDEN_STORAGE_KEY, hidden ? "1" : "0")
    // `storage` doesn't fire in the same tab; emit a custom event for local subscribers.
    window.dispatchEvent(new Event(SIDEBAR_HIDDEN_EVENT))
  } catch {
    // Ignore storage write errors (e.g. privacy mode).
  }
}

function subscribeSidebarHidden(onStoreChange: () => void) {
  function onStorage(e: StorageEvent) {
    if (e.key !== SIDEBAR_HIDDEN_STORAGE_KEY) return
    onStoreChange()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(SIDEBAR_HIDDEN_EVENT, onStoreChange)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(SIDEBAR_HIDDEN_EVENT, onStoreChange)
  }
}

function getSidebarHiddenSnapshot() {
  return readSidebarHiddenFromStorage()
}

function getSidebarHiddenServerSnapshot() {
  // Must match the server render to avoid hydration mismatch.
  return false
}

export function MainShell({ children }: { children: React.ReactNode }) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const supabase = createClient()

  // Public paths that don't require authentication
  // /tasks/* is public so unauthenticated users can view demo tasks
  // Check for paths like: /tasks/..., /explore, or /en/tasks/..., /en/explore
  const isPublicPath =
    pathname?.includes('/tasks/') ||
    pathname?.endsWith('/tasks') ||
    pathname?.includes('/explore') ||
    pathname?.endsWith('/explore')

  const sidebarHidden = useSyncExternalStore(
    subscribeSidebarHidden,
    getSidebarHiddenSnapshot,
    getSidebarHiddenServerSnapshot
  )

  const toggleSidebar = useCallback(() => {
    writeSidebarHiddenToStorage(!sidebarHidden)
  }, [sidebarHidden])

  const showLabel = t("nav.showSidebar")

  // Check authentication on mount and listen for auth changes
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session && !isPublicPath) {
        // Redirect to login page if not authenticated and not on public path
        router.replace(`/${locale}/login`)
        return
      }
      setIsAuthenticated(!!session)
      setIsLoading(false)
    }

    checkAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && !isPublicPath) {
        router.replace(`/${locale}/login`)
      } else {
        setIsAuthenticated(!!session)
        setIsLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, supabase.auth, isPublicPath])

  // Show loading spinner while checking auth (but allow public paths through)
  if (isLoading && !isPublicPath) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  // For protected paths, wait for authentication
  if (!isPublicPath && !isAuthenticated && !isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <TaskNotificationListener />

      {/* Grid background for entire app */}
      <div className="fixed inset-0 bg-grid opacity-30 pointer-events-none z-0" />

      {/* Background glow for glass effect - Adapted for both modes */}
      <div className="fixed top-0 left-0 w-[700px] h-[700px] bg-primary/5 blur-[150px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 z-0 mix-blend-multiply dark:mix-blend-normal" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-emerald-600/6 blur-[120px] rounded-full pointer-events-none translate-x-1/2 translate-y-1/2 z-0" />

      {sidebarHidden ? null : <Sidebar onHide={toggleSidebar} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {sidebarHidden ? (
            <div className="hidden md:flex absolute top-3 left-3 z-30">
              <Button
                variant="ghost"
                size="icon"
                aria-label={showLabel}
                title={showLabel}
                onClick={toggleSidebar}
                className="h-8 w-8 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-slate-200 dark:hover:bg-white/5 opacity-70 hover:opacity-100"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </div>
  )
}


