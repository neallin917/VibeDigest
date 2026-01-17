# Task 2.1: Create ChatWorkspace & IconSidebar

> **Phase**: 2 - Frontend Implementation  
> **Priority**: Critical  
> **Estimated Time**: 1.5 hours  
> **Dependencies**: Task 2.0 (Setup Workspace)

---

## 🎯 Objective

Implement the core **3-Column Layout** structure:
1.  **IconSidebar** (Left, fixed 64px)
2.  **ChatWorkspace** (Center, flex)
3.  **ContextPanel** (Right, 384px)

---

## 📋 Prerequisites

- [x] Task 2.0 completed
- [ ] Tailwind Config updated for `darkMode: 'class'`
- [ ] Global CSS has `.blob` animations

---

## 🔨 Implementation Steps

### Step 1: Create IconSidebar Component

**File**: `frontend/src/components/chat/IconSidebar.tsx`

The fixed navigation bar on the left.

```tsx
"use client"

import { MessageSquare, FolderOpen, Settings, PieChart } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface IconSidebarProps {
  onOpenLibrary: () => void
}

export function IconSidebar({ onOpenLibrary }: IconSidebarProps) {
  return (
    <aside className={cn(
      "w-16 flex-none flex flex-col items-center py-4 gap-6 hidden md:flex",
      "rounded-[2rem] border shadow-sm backdrop-blur-xl transition-all",
      // Light Mode
      "bg-white/65 border-white/40",
      // Dark Mode
      "dark:bg-black/40 dark:border-white/10"
    )}>
      {/* Active Chat Tab */}
      <div className={cn(
        "p-2.5 rounded-xl text-white shadow-lg cursor-pointer transition-colors",
        "bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700",
        "dark:bg-emerald-600 dark:shadow-emerald-900/20 dark:hover:bg-emerald-700"
      )}>
        <MessageSquare className="w-6 h-6" />
      </div>

      <div className="w-8 h-px bg-slate-200/60 dark:bg-white/10" />

      {/* Nav Actions */}
      <nav className="flex-1 flex flex-col gap-5 w-full items-center">
        <NavButton icon={FolderOpen} label="Projects" onClick={onOpenLibrary} />
        <NavButton icon={PieChart} label="Analytics" />
      </nav>

      <div className="mt-auto flex flex-col gap-5 items-center w-full pb-2">
        <NavButton icon={Settings} label="Settings" />
        {/* User Avatar Placeholder */}
        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 border-2 border-white dark:border-white/20" />
      </div>
    </aside>
  )
}

function NavButton({ icon: Icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-10 h-10 flex items-center justify-center rounded-xl transition-all relative group",
        "text-slate-400 hover:bg-white/60 hover:text-indigo-600",
        "dark:hover:bg-white/10 dark:hover:text-emerald-500"
      )}
    >
      <Icon className="w-6 h-6" />
      <div className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 font-medium tracking-wide">
        {label}
      </div>
    </button>
  )
}
```

### Step 2: Create ChatWorkspace Layout

**File**: `frontend/src/components/chat/ChatWorkspace.tsx`

Manages the layout grid and state.

```tsx
"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { IconSidebar } from "./IconSidebar"
import { ChatContainer } from "./ChatContainer"
import { VideoDetailPanel } from "./VideoDetailPanel" // Renaming to ContextPanel later
import { LibrarySidebar } from "./LibrarySidebar"

export function ChatWorkspace() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const taskId = searchParams.get("task")

  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(taskId)

  // Sync URL
  useEffect(() => {
    if (taskId) setActiveTaskId(taskId)
  }, [taskId])

  const handleTaskSelect = (id: string) => {
    setActiveTaskId(id)
    setIsLibraryOpen(false)
    router.push(`?task=${id}`, { scroll: false })
  }

  return (
    <div className="h-screen w-full p-3 lg:p-5 gap-5 flex relative overflow-hidden">
      {/* Background Blobs (Light Mode Only) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none dark:hidden">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* 1. Icon Sidebar (Left) */}
      <IconSidebar onOpenLibrary={() => setIsLibraryOpen(true)} />

      {/* 2. Main Chat (Center) */}
      <main className={cn(
        "flex-1 flex flex-col min-w-0 rounded-[2.5rem] shadow-glass relative overflow-hidden ring-1 transition-all",
        "bg-white/65 ring-white/60", // Light
        "dark:bg-[#1A1A1A]/50 dark:ring-white/5 dark:shadow-none" // Dark
      )}>
        <ChatContainer 
          onTaskCreated={handleTaskSelect} 
          onOpenPanel={(id) => setActiveTaskId(id)}
        />
      </main>

      {/* 3. Context Panel (Right) - Visible on XL screens */}
      <aside className={cn(
        "w-96 flex-none flex flex-col gap-5 hidden xl:flex",
        "transition-all duration-300",
        !activeTaskId && "w-0 opacity-0 overflow-hidden"
      )}>
        {activeTaskId && (
          <VideoDetailPanel 
            taskId={activeTaskId} 
            onClose={() => setActiveTaskId(null)} 
          />
        )}
      </aside>

      {/* Drawers/Modals */}
      <LibrarySidebar 
        isOpen={isLibraryOpen} 
        onClose={() => setIsLibraryOpen(false)}
        onSelectTask={handleTaskSelect}
      />
    </div>
  )
}
```

### Step 3: Stubs for Child Components

Create placeholder files so the build passes.

**File**: `frontend/src/components/chat/ChatContainer.tsx`
```tsx
export function ChatContainer({ onTaskCreated, onOpenPanel }: any) {
  return <div className="p-10">Chat Container Stub</div>
}
```

**File**: `frontend/src/components/chat/VideoDetailPanel.tsx`
```tsx
export function VideoDetailPanel({ taskId, onClose }: any) {
  return <div className="p-10">Context Panel Stub</div>
}
```

---

## ✅ Validation Checklist

- [ ] Layout renders 3 columns on large screens
- [ ] Background blobs appear in Light Mode
- [ ] Dark Mode background is solid black
- [ ] Sidebar icons have hover tooltips
- [ ] "Projects" button opens Library sheet

## 📝 Next Steps

**Proceed to**: `task-2.2-video-detail-panel.md` (Implementing the Context Panel).
