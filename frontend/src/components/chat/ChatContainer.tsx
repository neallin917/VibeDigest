'use client'

import { useChat } from '@ai-sdk/react'
import { ChatHeader } from './ChatHeader'
import { ChatInput } from './ChatInput'
import { VideoCardMessage } from './messages/VideoCardMessage'
import { WelcomeScreen } from './WelcomeScreen'
import { cn } from '@/lib/utils'
import { useRef, useEffect, useState, useMemo } from 'react'
import { detectVideoURLs } from '@/lib/url-utils'
import { createClient } from '@/lib/supabase'
import { Bot, User, Loader2 } from 'lucide-react'

interface ChatContainerProps {
  onTaskCreated?: (taskId: string) => void
  onOpenPanel?: (taskId: string) => void
  onSelectExample?: (taskId: string) => void
}

export function ChatContainer({ onTaskCreated, onOpenPanel, onSelectExample }: ChatContainerProps) {
  const { messages, append, isLoading } = useChat({
    api: '/api/chat',
  })
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])
  const [tasks, setTasks] = useState<Record<string, { id: string; video_url: string; video_title?: string; thumbnail_url?: string; status: 'processing' | 'completed' | 'pending' | 'failed'; progress?: number }>>({})

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = async (content: string) => {
    // 1. Check for URLs
    const urls = detectVideoURLs(content)
    
    // 2. If URL found, create task
    if (urls.length > 0) {
      // Logic for multi-URL warning
      if (urls.length > 1) {
        await append({
          role: 'assistant',
          content: "I noticed multiple video URLs. Please send them one at a time for the best analysis."
        })
        return
      }

      const url = urls[0]
      let taskId = null
      
      try {
        const response = await fetch('/api/process-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_url: url })
        })
        const data = await response.json()
        
        if (data.taskId) {
          console.log('[ChatContainer] Task started:', data.taskId)
          taskId = data.taskId
          if (onTaskCreated) onTaskCreated(data.taskId)
          trackTask(data.taskId)
        } else {
          console.warn('[ChatContainer] No taskId returned from API', data)
        }
      } catch (e) {
        console.error('Failed to start processing', e)
      }

      // 3. Send to AI with taskId if available
      await append({ role: 'user', content }, { body: { taskId } })
      return
    }

    // 3. Send to AI (Normal chat)
    await append({ role: 'user', content })
  }

  const trackTask = (taskId: string) => {
    supabase.channel(`chat_task_${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` }, 
        (payload) => setTasks(prev => ({ ...prev, [taskId]: payload.new as typeof prev[string] }))
      )
      .subscribe()
    
    supabase.from('tasks').select('*').eq('id', taskId).single()
      .then(({ data }) => { if (data) setTasks(prev => ({ ...prev, [taskId]: data })) })
  }

  return (
    <div className="flex flex-col h-full relative">
      <ChatHeader />
      
      {/* Messages List */}
      <div 
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto px-4 md:px-8 py-8 custom-scrollbar",
          // Only add bottom padding for floating input when there are messages
          messages.length > 0 ? "pb-36 space-y-10" : ""
        )}
      >
        {messages.length === 0 && (
          <WelcomeScreen 
            onSelectExample={onSelectExample || (() => {})} 
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        )}

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
              m.role === 'user' 
                ? "bg-indigo-100 dark:bg-emerald-900" 
                : "bg-gradient-to-tr from-violet-500 to-fuchsia-500"
            )}>
              {m.role === 'user' ? <User className="w-5 h-5 text-indigo-600 dark:text-emerald-400" /> : <Bot className="w-5 h-5 text-white" />}
            </div>

            <div className={cn(
              "flex flex-col gap-1",
              m.role === 'user' ? "items-end" : "w-full"
            )}>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 mx-4 mb-1">
                {m.role === 'user' ? 'Me' : 'Assistant'}
              </span>
              
              <div className={cn(
                "p-6 rounded-[24px] shadow-sm text-[15px] leading-relaxed relative overflow-hidden max-w-full",
                // User Bubble
                m.role === 'user' && "bg-indigo-600 text-white rounded-br-sm shadow-indigo-500/20 dark:bg-emerald-600/20 dark:text-emerald-100 dark:border dark:border-emerald-500/20",
                // Assistant Bubble
                m.role === 'assistant' && "bg-white/80 backdrop-blur-md border border-white/60 rounded-bl-sm text-slate-700 dark:bg-[#1A1A1A] dark:border-white/5 dark:text-gray-300"
              )}>
                <div className="whitespace-pre-wrap">{m.content}</div>
                
                {/* Render Task Card if this message contains a tracked video URL */}
                {Object.values(tasks).map(task => (
                   task && m.content.includes(task.video_url) ? (
                     <div key={task.id} className="mt-4">
                       <VideoCardMessage
                         taskId={task.id}
                         videoUrl={task.video_url}
                         title={task.video_title}
                         thumbnailUrl={task.thumbnail_url}
                         status={task.status}
                         progress={task.progress}
                         onViewClick={onOpenPanel}
                       />
                     </div>
                   ) : null
                ))}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4 max-w-4xl">
             <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
               <Loader2 className="w-5 h-5 animate-spin text-white" />
             </div>
             <div className="bg-white/80 dark:bg-[#1A1A1A] px-6 py-4 rounded-[24px] rounded-bl-sm border border-white/60 dark:border-white/5">
                <span className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">Thinking...</span>
             </div>
          </div>
        )}
      </div>

      {/* Floating ChatInput - Only show when there are messages */}
      {messages.length > 0 && (
        <ChatInput 
          variant="floating"
          onSubmit={handleSubmit} 
          isLoading={isLoading} 
        />
      )}
    </div>
  )
}
