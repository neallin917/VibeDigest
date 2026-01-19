'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import { ChatInput } from './ChatInput'
import { VideoCardMessage } from './messages/VideoCardMessage'
import { WelcomeScreen } from './WelcomeScreen'
import { cn } from '@/lib/utils'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

import { createClient } from '@/lib/supabase'
import { User, Loader2, Sparkles, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatContainerProps {
  activeTaskId?: string | null
  threadId?: string | null
  initialMessages?: UIMessage[] // Use UIMessage for better type safety, though loose parsing helps
  onOpenPanel?: (taskId: string) => void
  onSelectExample?: (taskId: string) => void
  onTaskCreated?: (taskId: string) => void
}

// --- Tool UI Components ---

function ToolPart({ part }: { part: any }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Extract clean tool name
  // V6 parts: toolName is usually top-level on the part object for 'tool-invocation' parts
  // or encoded in the type for some adapters. AI SDK v6 standardizes on 'tool-invocation' type usually,
  // but let's handle the specific shape coming from our backend (which might use tool-NAME types if not fully standardized yet).
  // Actually, standard v6 `streamText` + `toUIMessageStreamResponse` produces `tool-invocation` parts with `toolName`.
  const toolName = part.toolName || (part.type.startsWith('tool-') ? part.type.replace('tool-', '') : 'unknown-tool')
  
  // Format tool name for display
  const displayName = toolName.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  const toggleExpand = () => setIsExpanded(!isExpanded)

  switch (part.state) {
    case 'input-streaming':
    case 'input-available': // V6 state
    case 'call': // V5/V6 compat
      return (
        <div className="flex flex-col gap-1 my-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 px-3 py-2 rounded-md border border-slate-100 dark:border-white/5 w-fit">
            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
            <span className="font-medium">Running: {displayName}...</span>
          </div>
        </div>
      )
    
    case 'output-available': // V6 state
    case 'result': // V5/V6 compat
      return (
        <div className="flex flex-col gap-1 my-2 group">
          <button 
            onClick={toggleExpand}
            className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10 px-3 py-2 rounded-md border border-emerald-100/50 dark:border-emerald-500/20 w-fit hover:bg-emerald-100/50 dark:hover:bg-emerald-500/20 transition-colors"
          >
            <CheckCircle className="w-3 h-3" />
            <span className="font-medium">Completed: {displayName}</span>
            {isExpanded ? <ChevronDown className="w-3 h-3 opacity-50" /> : <ChevronRight className="w-3 h-3 opacity-50" />}
          </button>
          
          {isExpanded && (
            <div className="mt-1 ml-1 pl-3 border-l-2 border-slate-100 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400 font-mono overflow-x-auto">
               <pre>{JSON.stringify(part.output || part.result, null, 2)}</pre>
            </div>
          )}
        </div>
      )
    
    case 'output-error': // V6 state
    case 'error': // V5/V6 compat
      return (
        <div className="flex flex-col gap-1 my-2">
          <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 px-3 py-2 rounded-md border border-red-100 dark:border-red-900/20 w-fit">
            <XCircle className="w-3 h-3" />
            <span className="font-medium">Failed: {displayName}</span>
          </div>
          <div className="text-xs text-red-500 pl-8">
            {part.errorText || part.error || 'Unknown error'}
          </div>
        </div>
      )
    
    default:
      return null
  }
}

export function ChatContainer({
  activeTaskId,
  threadId,
  initialMessages = [],
  onOpenPanel,
  onSelectExample,
  onTaskCreated,
}: ChatContainerProps) {

  // Ensure we always have a valid UUID for the thread ID to satisfy DB requirements
  // Use lazy state initialization to generate once per component mount
  const [sessionId] = useState(() => threadId || uuidv4())
  const effectiveThreadId = threadId || sessionId

  // 1. Setup useChat with AI SDK v6 Best Practices
  const chat = useChat({
    // IMPORTANT: Use DefaultChatTransport for full v6 compatibility
    transport: new DefaultChatTransport({
      api: '/api/chat',
      // Optimize: Only send the new message and context, not the full history
      // The backend will load history from DB
      prepareSendMessagesRequest: ({ messages: currentMessages }) => {
        const lastMessage = currentMessages[currentMessages.length - 1]
        
        return {
          body: {
            message: lastMessage,
            threadId: effectiveThreadId,     // Persist to this thread
            taskId: activeTaskId    // RAG context
          }
        }
      }
    }),

    // Session ID
    id: effectiveThreadId,

    // Initial state
    initialMessages,

    // Error handling
    onError: (err) => {
      console.error('Chat error:', err);
    }
  })

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    error,
    reload,
    stop
  } = chat

  // Sync initialMessages when they change
  useEffect(() => {
    // If initialMessages are provided (and valid), update the chat state.
    // This allows the parent component to update the thread history asynchronously.
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages)
    } else if (initialMessages && initialMessages.length === 0) {
      // Also handle clearing if explicitly empty (for new chats)
      setMessages([])
    }
  }, [initialMessages, setMessages])

  const isLoading = status === 'streaming' || status === 'submitted'

  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])
  const [tasks, setTasks] = useState<
    Record<
      string,
      {
        id: string
        video_url: string
        video_title?: string;
        thumbnail_url?: string;
        status: 'processing' | 'completed' | 'pending' | 'failed';
        progress?: number
      }
    >
  >({})

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, status])

  // Handle pending landing page message
  useEffect(() => {
    const pendingMessage = localStorage.getItem('vibedigest_pending_message')
    if (pendingMessage) {
      localStorage.removeItem('vibedigest_pending_message')
      // Small delay to ensure hydration
      setTimeout(() => handleSendMessage(pendingMessage), 100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSendMessage = async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return

    // AI SDK v6: sendMessage expects { text: string } for simple text messages
    // The SDK converts this to the correct Message structure internally
    sendMessage({ text: trimmed })
  }
  
  const handleSubmit = (text: string) => {
    handleSendMessage(text);
  }

  const trackTask = useCallback(
    (taskId: string) => {
      supabase
        .channel(`chat_task_${taskId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` },
          (payload) =>
            setTasks((prev) => ({
              ...prev,
              [taskId]: payload.new as (typeof prev)[string],
            })),
        )
        .subscribe()

      supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()
        .then(({ data }) => {
          if (data) setTasks((prev) => ({ ...prev, [taskId]: data }))
        })
    },
    [supabase],
  )

  useEffect(() => {
    if (activeTaskId) {
      trackTask(activeTaskId)
    }
  }, [activeTaskId, trackTask])

  return (
    <div className="flex flex-col h-full relative">
      <div
        ref={scrollRef}
        className={cn(
          'flex-1 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar scroll-smooth',
          messages.length > 0 ? 'pb-36 space-y-8' : '',
        )}
      >
        {messages.length === 0 && (
          <WelcomeScreen
            onSelectExample={onSelectExample || (() => { })}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => {
            if (m.role === 'system') return null;

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className={cn('flex gap-4 max-w-4xl group', m.role === 'user' ? 'ml-auto flex-row-reverse' : '')}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'h-8 w-8 rounded-xl shrink-0 flex items-center justify-center shadow-sm ring-1 transition-all',
                    m.role === 'user'
                      ? 'bg-emerald-100 ring-emerald-200 dark:bg-emerald-900/30 dark:ring-emerald-500/30'
                      : 'bg-white ring-slate-200 dark:bg-white/10 dark:ring-white/20',
                  )}
                >
                  {m.role === 'user' ? (
                    <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  )}
                </div>

                {/* Content Bubble */}
                <div className={cn('flex flex-col gap-1 max-w-[85%]', m.role === 'user' ? 'items-end' : 'items-start w-full')}>
                  <div
                    className={cn(
                      'p-4 md:p-5 text-[15px] leading-7 relative overflow-hidden shadow-sm backdrop-blur-sm',
                      m.role === 'user'
                        ? 'rounded-2xl rounded-tr-sm bg-emerald-600 text-white shadow-emerald-500/20 dark:bg-emerald-600 dark:text-white dark:shadow-none'
                        : 'rounded-2xl rounded-tl-sm bg-white/60 border border-white/60 text-slate-700 dark:bg-white/5 dark:border-white/10 dark:text-slate-300',
                    )}
                  >
                    <div className="whitespace-pre-wrap">
                      {/* v6 Best Practice: Render parts */}
                      {m.parts ? (
                        m.parts.map((part, index) => {
                          if (part.type === 'text') {
                            return <span key={index}>{part.text}</span>
                          }
                          // Render Tools
                          if (part.type.startsWith('tool-') || (part as any).toolName) {
                             return <ToolPart key={index} part={part} />
                          }
                          return null
                        })
                      ) : (
                        // Fallback for simple messages
                        m.content
                      )}
                    </div>

                    {/* Logic to scan content for URLs and show cards */}
                    {Object.values(tasks).map((task) => {
                       const textContent = m.parts 
                         ? m.parts.filter(p => p.type === 'text').map(p => p.text).join('') 
                         : m.content;
                       
                       return task && textContent?.includes(task.video_url) ? (
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
                    })}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Loading Indicator - Only show when submitted but not yet streaming (waiting for first chunk) */}
        {status === 'submitted' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 max-w-4xl">
            <div className="h-8 w-8 rounded-xl bg-white ring-1 ring-slate-200 dark:bg-white/10 dark:ring-white/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-emerald-500 dark:text-emerald-400 animate-pulse" />
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="bg-white/40 dark:bg-white/5 px-5 py-3 rounded-2xl rounded-tl-sm border border-white/40 dark:border-white/5 flex items-center gap-2 w-fit">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                   Thinking...
                </span>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Error State */}
        {error && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 max-w-4xl">
             <div className="w-8 shrink-0" />
             <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 px-4 py-3 rounded-xl flex items-center gap-3">
               <XCircle className="w-4 h-4 text-red-500" />
               <div className="text-sm text-red-600 dark:text-red-400">
                 Something went wrong.
               </div>
               <button 
                 onClick={() => reload()}
                 className="text-xs bg-white dark:bg-white/10 px-2 py-1 rounded border border-red-100 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
               >
                 Retry
               </button>
             </div>
           </motion.div>
        )}
      </div>

      {messages.length > 0 && (
        <ChatInput 
          variant="floating" 
          onSubmit={handleSubmit} 
          isLoading={isLoading} 
          onStop={status === 'streaming' ? stop : undefined}
        />
      )}
    </div>
  )
}
