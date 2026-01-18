'use client'

import { useChat } from '@ai-sdk/react'
import { ChatInput } from './ChatInput'
import { VideoCardMessage } from './messages/VideoCardMessage'
import { WelcomeScreen } from './WelcomeScreen'
import { cn } from '@/lib/utils'
import { useRef, useEffect, useState, useMemo } from 'react'

import { createClient } from '@/lib/supabase'
import { User, Loader2, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatContainerProps {
  activeTaskId?: string | null
  onTaskCreated?: (taskId: string) => void
  onOpenPanel?: (taskId: string) => void
  onSelectExample?: (taskId: string) => void
}

export function ChatContainer({ activeTaskId, onTaskCreated, onOpenPanel, onSelectExample }: ChatContainerProps) {
  console.log('[ChatContainer] render with activeTaskId:', activeTaskId)
  
  const { messages, append, isLoading } = useChat({
    api: activeTaskId ? `/api/chat?taskId=${activeTaskId}` : '/api/chat',
    id: activeTaskId || 'default',
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

  // Check for pending message from landing page
  useEffect(() => {
    const pendingMessage = localStorage.getItem('vibedigest_pending_message')
    if (pendingMessage) {
      localStorage.removeItem('vibedigest_pending_message')
      // Small delay to ensure initialization
      setTimeout(() => {
        handleSubmit(pendingMessage)
      }, 500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (content: string) => {
    console.log('[ChatContainer] handleSubmit', { activeTaskId, content })
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

  useEffect(() => {
    if (activeTaskId) {
      trackTask(activeTaskId)
    }
  }, [activeTaskId])

  return (
    <div className="flex flex-col h-full relative">
      {/* Messages List */}
      <div 
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar scroll-smooth",
          // Only add bottom padding for floating input when there are messages
          messages.length > 0 ? "pb-36 space-y-8" : ""
        )}
      >
        {messages.length === 0 && (
          <WelcomeScreen 
            onSelectExample={onSelectExample || (() => {})} 
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div 
              key={m.id} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn(
                "flex gap-4 max-w-4xl group",
                m.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              {/* Avatar */}
              <div className={cn(
                "h-8 w-8 rounded-xl shrink-0 flex items-center justify-center shadow-sm ring-1 transition-all",
                m.role === 'user' 
                  ? "bg-emerald-100 ring-emerald-200 dark:bg-emerald-900/30 dark:ring-emerald-500/30" 
                  : "bg-white ring-slate-200 dark:bg-white/10 dark:ring-white/20"
              )}>
                {m.role === 'user' ? (
                  <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                )}
              </div>

              <div className={cn(
                "flex flex-col gap-1 max-w-[85%]",
                m.role === 'user' ? "items-end" : "items-start w-full"
              )}>
                
                <div className={cn(
                  "p-4 md:p-5 text-[15px] leading-7 relative overflow-hidden shadow-sm backdrop-blur-sm",
                  // User Bubble
                  m.role === 'user' && "rounded-2xl rounded-tr-sm bg-emerald-600 text-white shadow-emerald-500/20 dark:bg-emerald-600 dark:text-white dark:shadow-none",
                  // Assistant Bubble
                  m.role === 'assistant' && "rounded-2xl rounded-tl-sm bg-white/60 border border-white/60 text-slate-700 dark:bg-white/5 dark:border-white/10 dark:text-slate-300"
                )}>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  
                  {/* Render Task Card if this message contains a tracked video URL */}
                  {Object.values(tasks).map(task => (
                     task && m.content.includes(task.video_url) ? (
                       <div key={task.id} className="mt-4 -mx-2 mb-[-8px]">
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
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 max-w-4xl"
          >
             <div className="h-8 w-8 rounded-xl bg-white ring-1 ring-slate-200 dark:bg-white/10 dark:ring-white/20 flex items-center justify-center shrink-0">
               <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400 animate-pulse" />
             </div>
             <div className="bg-white/40 dark:bg-white/5 px-5 py-3 rounded-2xl rounded-tl-sm border border-white/40 dark:border-white/5 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Thinking...</span>
             </div>
          </motion.div>
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
