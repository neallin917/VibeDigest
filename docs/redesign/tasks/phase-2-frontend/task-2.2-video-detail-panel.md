# Task 2.2: Implement Context Panel (Video & Insights)

> **Phase**: 2 - Frontend Implementation  
> **Priority**: Critical  
> **Estimated Time**: 1.5 hours  
> **Dependencies**: Task 2.1 (ChatWorkspace)

---

## 🎯 Objective

Implement the **Context Panel** (formerly VideoDetailPanel), which serves as the right-hand column. It displays the video player and extracted insights using the new Glassmorphic cards.

---

## 📋 Prerequisites

- [x] Task 2.1 completed
- [ ] `components/tasks/shared` directory created

---

## 🔨 Implementation Steps

### Step 1: Create Glass Card Utilities

Ensure these classes are available (via `index.css` or Tailwind).

**Usage**:
- **Light**: `glass-card-active` (Gradient + Blur)
- **Dark**: `bg-black/40 border-white/10`

### Step 2: Extract VideoPlayer Component

**File**: `frontend/src/components/tasks/shared/VideoPlayer.tsx`

Wraps the video embed in a styled card.

```tsx
'use client'

import { VideoEmbed } from '@/components/tasks/VideoEmbed'
import { AudioEmbed } from '@/components/tasks/AudioEmbed'
import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  videoUrl: string
  title?: string
  coverUrl?: string
  audioUrl?: string | null
  audioCoverUrl?: string
  onMediaReady?: (ctrl: any) => void
  className?: string
}

export function VideoPlayer({
  videoUrl,
  title,
  coverUrl,
  audioUrl,
  audioCoverUrl,
  onMediaReady,
  className
}: VideoPlayerProps) {
  return (
    <div className={cn(
      "glass-panel rounded-[24px] p-2 transition-all hover:shadow-lg",
      "bg-white/65 dark:bg-black/40 dark:border-white/10",
      className
    )}>
      <div className="relative aspect-video rounded-[20px] overflow-hidden shadow-inner bg-black">
        {audioUrl ? (
          <AudioEmbed 
            audioUrl={audioUrl}
            coverUrl={audioCoverUrl || coverUrl}
            onReady={onMediaReady}
          />
        ) : (
          <VideoEmbed 
            videoUrl={videoUrl}
            onReady={onMediaReady}
          />
        )}
      </div>
      
      {/* Title & Metadata */}
      <div className="px-2 pt-3 pb-1">
        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 line-clamp-1">
          {title || "Loading..."}
        </h4>
      </div>
    </div>
  )
}
```

### Step 3: Create Context Panel

**File**: `frontend/src/components/chat/VideoDetailPanel.tsx`

Implements the "Extracted Points" list using the new card styles.

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { VideoPlayer } from '@/components/tasks/shared/VideoPlayer'
import { Button } from '@/components/ui/button'
import { X, Lightbulb, CheckCircle, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoDetailPanelProps {
  taskId: string
  onClose?: () => void
  className?: string
}

export function VideoDetailPanel({ 
  taskId, 
  onClose, 
  className 
}: VideoDetailPanelProps) {
  const [task, setTask] = useState<any>(null)
  const [outputs, setOutputs] = useState<any[]>([])
  const [mediaController, setMediaController] = useState<any>(null)
  const supabase = createClient()

  // Fetch logic (same as before)
  useEffect(() => {
    if (!taskId) return
    // ... fetch task & outputs from supabase ...
    // Placeholder for brevity - reuse logic from previous task definition
    const fetchData = async () => {
        const { data: t } = await supabase.from('tasks').select('*').eq('id', taskId).single()
        if (t) setTask(t)
    }
    fetchData()
  }, [taskId])

  const handleSeek = (seconds: number) => {
    mediaController?.seek(seconds)
  }

  if (!task) return null

  return (
    <div className={cn("h-full flex flex-col gap-5 overflow-hidden px-2 pt-2 pb-4", className)}>
      
      {/* Header */}
      <div className="flex items-center justify-between px-2 shrink-0">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <span className="p-1.5 bg-white/50 dark:bg-white/10 rounded-lg shadow-sm ring-1 ring-white dark:ring-white/20">
            <StickyNote className="w-5 h-5 text-indigo-500 dark:text-emerald-500" />
          </span>
          Context Panel
        </h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto space-y-5 px-1 pb-4 custom-scrollbar">
        
        {/* Video Player Card */}
        <VideoPlayer 
          videoUrl={task.video_url}
          title={task.video_title}
          coverUrl={task.thumbnail_url}
          onMediaReady={setMediaController}
        />

        {/* Divider */}
        <div className="flex items-center gap-3 px-2">
          <span className="text-[11px] font-bold text-indigo-400 dark:text-emerald-400 uppercase tracking-widest">
            Extracted Points
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent dark:from-emerald-900" />
        </div>

        {/* Insights Cards (Placeholder Data for now) */}
        <div className={cn(
          "rounded-[28px] p-5 cursor-pointer group relative overflow-hidden transition-all duration-300",
          // Light: Active Glass
          "bg-gradient-to-br from-white/90 to-white/60 shadow-glass border border-white/80",
          // Dark: Dark Glass
          "dark:bg-[#1A1A1A] dark:border-white/10"
        )}>
          <div className="flex justify-between items-start mb-3">
            <span className="bg-indigo-100/90 text-indigo-700 dark:bg-emerald-500/20 dark:text-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-indigo-200 dark:border-emerald-500/30 uppercase tracking-wider flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              Key Insight
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-white/50 dark:bg-white/10 px-1.5 py-0.5 rounded">
              02:14
            </span>
          </div>
          <h5 className="text-[15px] font-bold text-slate-800 dark:text-slate-100 mb-2 leading-tight">
            Revenue Growth Discussion
          </h5>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
            15% increase in Q3 revenue. Unexpected surge in the enterprise sector.
          </p>
        </div>

        {/* Action Item Card */}
        <div className={cn(
          "rounded-[24px] p-5 cursor-pointer group transition-all",
          "bg-white/35 backdrop-blur-md border border-white/30 hover:bg-white/50",
          "dark:bg-white/5 dark:border-white/5 dark:hover:bg-white/10"
        )}>
          <div className="flex justify-between items-start mb-2">
            <span className="bg-emerald-50/80 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Action Item
            </span>
          </div>
          <h5 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1.5">
            Mobile App Beta
          </h5>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
            Start beta testing next month. Focus on AI integration.
          </p>
        </div>

      </div>
    </div>
  )
}
```

### Step 4: Extract Summary Logic

(Same as previous plan - Create `SummarySection.tsx` if needed for the detailed view, but here we focus on the "Cards" view first per the design draft).

---

## ✅ Validation Checklist

- [ ] Context Panel renders in 3-column layout
- [ ] Video Player card looks like a "Glass Panel"
- [ ] "Key Insight" cards use the active gradient style
- [ ] Dark Mode colors are legible and consistent
- [ ] Clicking a card timestamp seeks video

## 📝 Next Steps

**Proceed to**: `task-2.3-library-sidebar.md`
