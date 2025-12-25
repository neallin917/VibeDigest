"use client"

import React, { useCallback, useSyncExternalStore } from "react"
import { ChevronRight } from "lucide-react"

import { Sidebar } from "@/components/layout/Sidebar"
import { MobileBottomNav, MobileHeader } from "@/components/layout/MobileNav"
import { TaskNotificationListener } from "@/components/tasks/TaskNotificationListener"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n/I18nProvider"

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
  const { t } = useI18n()
  const sidebarHidden = useSyncExternalStore(
    subscribeSidebarHidden,
    getSidebarHiddenSnapshot,
    getSidebarHiddenServerSnapshot
  )

  const toggleSidebar = useCallback(() => {
    writeSidebarHiddenToStorage(!sidebarHidden)
  }, [sidebarHidden])

  const showLabel = t("nav.showSidebar")

  return (
    <div className="flex h-dvh overflow-hidden">
      <TaskNotificationListener />

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
                className="h-8 w-8 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-white/5 opacity-70 hover:opacity-100"
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


