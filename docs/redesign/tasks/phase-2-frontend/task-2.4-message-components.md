# Task 2.4: Implement Chat Interface

> **Phase**: 2 - Frontend Implementation  
> **Priority**: Critical  
> **Estimated Time**: 2 hours  
> **Dependencies**: Task 2.1 (ChatWorkspace)

---

## 🎯 Objective

Implement the main **Chat Interface** (`ChatContainer`, `ChatInput`, and Messages) with the new **Glassmorphic** design.

---

## 📋 Prerequisites

- [x] Task 2.1 completed
- [x] AI SDK v6 installed

---

## 🔨 Implementation Steps

### Step 1: Create Chat Header

**File**: `frontend/src/components/chat/ChatHeader.tsx`

The top bar with "Online" status and avatars.

```tsx
'use client'

import { Search, MoreVertical, Verified } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ChatHeader() {
  return (
    <header className={cn(
      "h-20 flex items-center justify-between px-8 border-b shrink-0 backdrop-blur-xl z-10",
      "bg-white/30 border-white/30", // Light
      "dark:bg-black/40 dark:border-white/5" // Dark
    )}>
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
            VibeDigest AI
          </h2>
          <Verified className="w-[18px] h-[18px] text-indigo-500 dark:text-emerald-500" />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <span>Online • Ready to assist</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Avatars Stack */}
        <div className="flex -space-x-2 mr-2">
          <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-indigo-100" />
          <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-purple-100" />
        </div>
        
        <ActionButton icon={Search} />
        <ActionButton icon={MoreVertical} />
      </div>
    </header>
  )
}

function ActionButton({ icon: Icon }: any) {
  return (
    <button className={cn(
      "h-10 w-10 flex items-center justify-center rounded-full transition-colors border shadow-sm",
      "bg-white/40 hover:bg-white/60 border-white/50 text-slate-600",
      "dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-slate-300"
    )}>
      <Icon className="w-5 h-5" />
    </button>
  )
}
```

### Step 2: Create ChatInput (Floating Capsule)

**File**: `frontend/src/components/chat/ChatInput.tsx`

```tsx
'use client'

import { useState } from 'react'
import { PlusCircle, Mic, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSubmit: (text: string) => void
  isLoading?: boolean
}

export function ChatInput({ onSubmit, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isLoading) return
    onSubmit(input)
    setInput('')
  }

  return (
    <div className="absolute bottom-6 left-6 right-6 z-20 flex justify-center">
      <div className="w-full max-w-3xl">
        <form 
          onSubmit={handleSubmit}
          className={cn(
            "rounded-full p-2 pl-5 flex items-center gap-3 shadow-2xl ring-1 transition-all",
            "bg-white/70 backdrop-blur-xl ring-white/80 shadow-indigo-500/10",
            "dark:bg-[#1A1A1A]/80 dark:ring-white/10 dark:shadow-none"
          )}
        >
          <button type="button" className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-emerald-500 transition-colors">
            <PlusCircle className="w-6 h-6" />
          </button>
          
          <div className="h-6 w-px bg-slate-300 dark:bg-white/10" />
          
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white placeholder-slate-400 py-3 text-[15px] font-medium" 
            placeholder="Ask anything or paste a YouTube URL..." 
          />
          
          <button type="button" className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-emerald-500 transition-colors">
            <Mic className="w-6 h-6" />
          </button>
          
          <button 
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              "p-2.5 rounded-full text-white shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100",
              "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200",
              "dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:shadow-none"
            )}
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </form>
        
        <div className="text-center mt-3">
          <p className="text-[10px] text-slate-400 font-medium">
            AI can make mistakes. Please verify important information.
          </p>
        </div>
      </div>
    </div>
  )
}
```

### Step 3: Implement ChatContainer

**File**: `frontend/src/components/chat/ChatContainer.tsx`

Handles the message list scrolling and rendering.

```tsx
'use client'

import { useChat } from '@ai-sdk/react'
import { ChatHeader } from './ChatHeader'
import { ChatInput } from './ChatInput'
import { VideoCardMessage } from './messages/VideoCardMessage' // Reuse previous logic
import { cn } from '@/lib/utils'
import { useRef, useEffect } from 'react'

export function ChatContainer({ onTaskCreated, onOpenPanel }: any) {
  const { messages, append, isLoading } = useChat({
    api: '/api/chat',
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex flex-col h-full relative">
      <ChatHeader />
      
      {/* Messages List */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-8 py-8 space-y-10 pb-36 custom-scrollbar"
      >
        {messages.map(m => (
          <div 
            key={m.id} 
            className={cn(
              "flex gap-4 max-w-4xl group",
              m.role === 'user' ? "ml-auto flex-row-reverse" : ""
            )}
          >
            {/* Avatar */}
            <div className={cn(
              "h-10 w-10 rounded-full shrink-0 shadow-sm ring-2 ring-white dark:ring-white/10 flex items-center justify-center",
              m.role === 'user' ? "bg-indigo-100 dark:bg-emerald-900" : "bg-gradient-to-tr from-violet-500 to-fuchsia-500"
            )}>
              {m.role === 'assistant' && <span className="material-symbols-outlined text-white text-[20px]">smart_toy</span>}
            </div>

            <div className={cn(
              "flex flex-col gap-1",
              m.role === 'user' ? "items-end" : "w-full"
            )}>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 mx-4 mb-1">
                {m.role === 'user' ? 'Me' : 'Assistant'}
              </span>
              
              <div className={cn(
                "p-6 rounded-[24px] shadow-sm text-[15px] leading-relaxed relative overflow-hidden",
                // User Bubble
                m.role === 'user' && "bg-indigo-600 text-white rounded-br-sm shadow-indigo-500/20 dark:bg-emerald-600/20 dark:text-emerald-100 dark:border dark:border-emerald-500/20",
                // Assistant Bubble
                m.role === 'assistant' && "bg-white/80 backdrop-blur-md border border-white/60 rounded-bl-sm text-slate-700 dark:bg-[#1A1A1A] dark:border-white/5 dark:text-gray-300"
              )}>
                {m.content}
                
                {/* Render Video Card if applicable (logic from Task 2.4) */}
                {/* <VideoCardMessage ... /> */}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ChatInput onSubmit={(content) => append({ role: 'user', content })} isLoading={isLoading} />
    </div>
  )
}
```

---

## ✅ Validation Checklist

- [ ] Header includes "Online" status
- [ ] Input bar is floating and capsule-shaped
- [ ] User messages are Indigo (Light) / Emerald (Dark)
- [ ] Assistant messages are Glass (Light) / Dark Glass (Dark)
- [ ] Avatars have white rings in Light mode

## 📝 Next Steps

**Proceed to**: `task-2.6-integration.md` (Combining everything).
