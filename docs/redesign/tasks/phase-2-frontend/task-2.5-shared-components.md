# Task 2.5: Extract & Refactor Shared Components

> **Phase**: 2 - Frontend Implementation  
> **Priority**: High  
> **Estimated Time**: 1 hour  
> **Dependencies**: Task 2.2 (VideoDetailPanel needs these)

---

## 🎯 Objective

Extract `VideoPlayer` and `SummarySection` from the monolithic `TaskDetailClient` into reusable standalone components. This allows them to be used in both the old route pages and the new split-screen chat interface.

---

## 📋 Prerequisites

- [x] Task 2.0 (Directories created)
- [x] Access to `TaskDetailClient.tsx` (Source)

---

## 🔨 Implementation Steps

### Step 1: Create Shared VideoPlayer

**File**: `frontend/src/components/tasks/shared/VideoPlayer.tsx`

This wraps the existing `VideoEmbed` and `AudioEmbed` logic.

```typescript
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
  onMediaReady?: (ctrl: { seek: (seconds: number) => void }) => void
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
  // 1. Audio Mode (Xiaoyuzhou / Podcast)
  if (audioUrl) {
    return (
      <div className={cn("w-full aspect-video bg-black rounded-lg overflow-hidden shadow-sm", className)}>
        <AudioEmbed 
          audioUrl={audioUrl}
          coverUrl={audioCoverUrl || coverUrl}
          onReady={onMediaReady}
        />
      </div>
    )
  }

  // 2. Video Mode (YouTube / Bilibili)
  return (
    <div className={cn("w-full aspect-video bg-black rounded-lg overflow-hidden shadow-sm border border-white/5", className)}>
      <VideoEmbed 
        videoUrl={videoUrl}
        onReady={onMediaReady}
      />
    </div>
  )
}
```

### Step 2: Create Shared SummarySection

**File**: `frontend/src/components/tasks/shared/SummarySection.tsx`

Extracts the Markdown rendering and keypoints logic.

```typescript
'use client'

import ReactMarkdown from 'react-markdown'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatSeconds } from '@/components/tasks/transcript'
import { FileText, Target, Zap, AlertTriangle } from 'lucide-react'

// Type for your summary output content
interface SummaryContent {
  overview?: string
  keypoints?: Array<{
    title: string
    detail: string
    startSeconds?: number
  }>
  // Add other fields as per your schema
}

interface SummarySectionProps {
  summaryContent?: string // Could be raw markdown or JSON string
  isLoading?: boolean
  onTimeClick?: (seconds: number) => void
  className?: string
}

export function SummarySection({
  summaryContent,
  isLoading,
  onTimeClick,
  className
}: SummarySectionProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-4 animate-pulse", className)}>
        <div className="h-4 w-3/4 bg-white/5 rounded" />
        <div className="h-32 w-full bg-white/5 rounded" />
      </div>
    )
  }

  if (!summaryContent) {
    return (
      <div className="text-center p-8 text-muted-foreground bg-white/5 rounded-lg border border-dashed border-white/10">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No summary generated yet.</p>
      </div>
    )
  }

  // Try parsing JSON if it's structured data
  let content: SummaryContent | string = summaryContent
  try {
    if (summaryContent.trim().startsWith('{')) {
      content = JSON.parse(summaryContent)
    }
  } catch (e) {
    // Keep as string if parse fails (Markdown)
  }

  // 1. Render Structured Summary (JSON)
  if (typeof content === 'object') {
    return (
      <div className={cn("space-y-6", className)}>
        {/* Overview */}
        {content.overview && (
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" />
              Overview
            </h3>
            <div className="prose prose-invert max-w-none text-sm text-gray-300">
              <ReactMarkdown>{content.overview}</ReactMarkdown>
            </div>
          </section>
        )}

        {/* Keypoints */}
        {content.keypoints && content.keypoints.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              Key Insights
            </h3>
            <div className="space-y-3">
              {content.keypoints.map((kp, idx) => (
                <Card key={idx} className="p-4 bg-white/5 border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex gap-3">
                    <div className="shrink-0 mt-1">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/10 text-xs font-medium text-muted-foreground">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-medium text-sm text-gray-200">
                        {kp.title}
                      </h4>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {kp.detail}
                      </p>
                      {typeof kp.startSeconds === 'number' && (
                        <button
                          onClick={() => onTimeClick?.(kp.startSeconds!)}
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors mt-2"
                        >
                          ▶ {formatSeconds(kp.startSeconds)}
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  // 2. Render Markdown Summary (Fallback)
  return (
    <div className={cn("prose prose-invert max-w-none", className)}>
      <ReactMarkdown
        components={{
          // Custom timestamp link handler could go here
        }}
      >
        {summaryContent}
      </ReactMarkdown>
    </div>
  )
}
```

### Step 3: Refactor TaskDetailClient (Optional/Post-MVP)

*Note: For this task, we just ensure the new components work. We will NOT refactor the old `TaskDetailClient.tsx` yet to avoid regression risks during this phase. The new components will be used exclusively in the new Chat UI for now.*

---

## ✅ Validation Checklist

- [ ] `VideoPlayer` handles video mode correctly
- [ ] `VideoPlayer` handles audio mode correctly
- [ ] `SummarySection` parses JSON output correctly
- [ ] `SummarySection` falls back to Markdown correctly
- [ ] Timestamp clicks in summary triggers `onTimeClick` callback

## 📝 Next Task

**Proceed to**: `task-2.6-integration.md`
