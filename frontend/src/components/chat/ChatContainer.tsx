'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatInput } from './ChatInput'
import { WelcomeScreen } from './WelcomeScreen'
import { cn } from '@/lib/utils'
import { useRef, useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

// AI SDK v6: Import typed Tool UI components
import {
  GetTaskStatusTool,
  CreateTaskTool,
  PreviewVideoTool,
  GetTaskOutputsTool,
  UnknownTool
} from './tools'

import { Loader2, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatContainerProps {
  activeTaskId?: string | null
  threadId?: string | null
  initialMessages?: UIMessage[]
  onOpenPanel?: (taskId: string) => void
  onSelectExample?: (taskId: string) => void
  onChatStarted?: (threadId: string) => void
}

// Helper function to render tool invocations using AI SDK v6 standard ToolInvocation type
// Helper function to render tool parts using AI SDK v6 standard UIMessage types
function renderToolPart(part: any, index: number, onOpenPanel?: (taskId: string) => void) {
  // We explicitly handle parts that are tool invocations.
  if (!part.type.startsWith('tool-') && part.type !== 'dynamic-tool') {
    return null;
  }

  const toolCallId = part.toolCallId || part.id // Fallback ID if needed
  const state = part.state
  const args = part.input
  const result = part.output
  const errorText = part.errorText

  // Map state to UI expectations if necessary, but standard UIMessage states overlap well.

  // Extract proper tool name
  let toolName = ''
  if (part.type === 'dynamic-tool') {
    toolName = part.toolName
  } else {
    toolName = part.type.replace('tool-', '')
  }

  switch (toolName) {
    case 'get_task_status':
      return (
        <GetTaskStatusTool
          key={toolCallId || index}
          toolCallId={toolCallId}
          state={state}
          input={args}
          output={result}
          errorText={errorText}
          onViewClick={onOpenPanel}
        />
      )

    case 'create_task':
      return (
        <CreateTaskTool
          key={toolCallId || index}
          toolCallId={toolCallId}
          state={state}
          input={args}
          output={result}
          errorText={errorText}
          onViewClick={onOpenPanel}
        />
      )

    case 'preview_video':
      return (
        <PreviewVideoTool
          key={toolCallId || index}
          toolCallId={toolCallId}
          state={state}
          input={args}
          output={result}
          errorText={errorText}
        />
      )

    case 'get_task_outputs':
      return (
        <GetTaskOutputsTool
          key={toolCallId || index}
          toolCallId={toolCallId}
          state={state}
          input={args}
          output={result}
          errorText={errorText}
        />
      )

    default:
      return (
        <UnknownTool
          key={toolCallId || index}
          toolName={toolName}
          toolCallId={toolCallId}
          state={state}
          input={args}
          output={result}
          errorText={errorText}
        />
      )
  }
}

export function ChatContainer({
  activeTaskId,
  threadId,
  initialMessages = [],
  onOpenPanel,
  onSelectExample,
  onChatStarted
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
    // Pass initial messages if provided
    // Note: useChat in strict mode options might not have 'initialMessages', 
    // but the hook signature usually accepts it. 
    // If TSC complains, we rely on the useEffect below to set messages.
    // However, to avoid flashing empty state, passing it here is better if accepted.
    // Since TS complained about 'initialMessages' not existing in options, we try 'messages' (if ChatInit is mixed in).
    messages: initialMessages,

    // Error handling
    onError: (err: any) => {
      console.error('Chat error:', err);
    },

    // Notify parent once a chat is persisted
    onFinish: () => {
      if (onChatStarted) {
        onChatStarted(effectiveThreadId)
      }
    }
  })

  // Destructure with standard types (no casting needed)
  const {
    messages,
    setMessages,
    sendMessage: sendMessageToApi,
    status,
    error,
    regenerate,
    stop
  } = chat

  /* 
   * wrapper for sending messages that matches the previous append signature if needed,
   * but strictly we should use sendMessageToApi({ text }) 
   */
  const handleSendMessage = async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return

    // AI SDK v6: sendMessage expects { text: string }
    sendMessageToApi({ text: trimmed })
  }

  // Sync initialMessages when they change
  useEffect(() => {
    // If initialMessages are provided (and valid), update the chat state.
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages)
    } else if (initialMessages && initialMessages.length === 0) {
      setMessages([])
    }
  }, [initialMessages, setMessages])

  const isLoading = status === 'streaming' || status === 'submitted'

  const scrollRef = useRef<HTMLDivElement>(null)

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

  /* handleSendMessage is already defined above */

  const handleSubmit = (text: string) => {
    handleSendMessage(text);
  }

  // Auto-open panel when a task is created
  const lastAutoOpenedTaskId = useRef<string | null>(null)

  useEffect(() => {
    if (!onOpenPanel || messages.length === 0) return

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'assistant' || !lastMessage.parts) return

    // Check for create_task tool output
    for (const part of lastMessage.parts) {
      // Identify tool name
      let toolName = ''
      if (part.type === 'dynamic-tool') {
        toolName = part.toolName
      } else if (part.type.startsWith('tool-')) {
        toolName = part.type.replace('tool-', '')
      }

      if (toolName === 'create_task' && part.output && part.output.taskId) {
        const newTaskId = part.output.taskId

        // Only trigger if we haven't already opened this specific task
        // AND if it's not the currently active task (to avoid redundant calls)
        if (newTaskId !== lastAutoOpenedTaskId.current && newTaskId !== activeTaskId) {
          lastAutoOpenedTaskId.current = newTaskId
          onOpenPanel(newTaskId)
        }
      }
    }
  }, [messages, onOpenPanel, activeTaskId])

  return (
    <div className="flex flex-col h-full relative">
      <div
        ref={scrollRef}
        className={cn(
          'flex-1 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar scroll-smooth',
          messages.length > 0 ? 'pb-36' : '',
        )}
      >
        {messages.length === 0 ? (
          <WelcomeScreen
            onSelectExample={onSelectExample || (() => { })}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        ) : (
          <div className="max-w-3xl mx-auto w-full space-y-8">
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                if (m.role === 'system') return null;

                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className={cn('flex w-full group', m.role === 'user' ? 'ml-auto flex-row-reverse' : '')}
                  >
                    {/* Content Bubble */}
                    <div className={cn('flex flex-col gap-1 max-w-[85%]', m.role === 'user' ? 'items-end' : 'items-start w-full')}>
                      <div
                        className={cn(
                          'px-6 py-5 text-[15.5px] leading-7 relative overflow-hidden backdrop-blur-md',
                          m.role === 'user'
                            ? 'rounded-[20px] rounded-tr-sm bg-emerald-600/10 dark:bg-emerald-500/10 border border-emerald-600/10 dark:border-emerald-500/20 text-slate-800 dark:text-zinc-200'
                            : 'rounded-[20px] rounded-tl-sm bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/5 text-slate-800 dark:text-zinc-200 shadow-sm',
                        )}
                      >
                        <div className="w-full min-w-0">
                          {/* Part 1: Render Parts (Text + Tools) */}
                          {m.parts && m.parts.length > 0 ? (
                            m.parts.map((part, index) => {
                              // Handle Text parts
                              if (part.type === 'text') {
                                return (
                                  <div key={index} className="prose prose-sm md:prose-base prose-slate dark:prose-invert max-w-none break-words">
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                        pre: ({ node, ...props }) => (
                                          <div className="overflow-hidden w-full my-3 bg-slate-950 dark:bg-black/40 rounded-lg border border-slate-200 dark:border-white/10 group relative">
                                            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 dark:bg-white/5 border-b border-slate-800 dark:border-white/5">
                                              <div className="flex gap-1.5">
                                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
                                              </div>
                                            </div>
                                            <div className="p-4 overflow-x-auto custom-scrollbar">
                                              <pre {...props} className="bg-transparent p-0 m-0 font-mono text-sm leading-relaxed" />
                                            </div>
                                          </div>
                                        ),
                                        code: ({ node, className, children, ...props }) => {
                                          const match = /language-(\w+)/.exec(className || '')
                                          const isInline = !match && !String(children).includes('\n')
                                          return (
                                            <code
                                              className={cn(
                                                isInline
                                                  ? "bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono text-[0.9em] before:content-[''] after:content-[''] text-emerald-700 dark:text-emerald-300"
                                                  : "bg-transparent font-mono text-sm",
                                                className
                                              )}
                                              {...props}
                                            >
                                              {children}
                                            </code>
                                          )
                                        },
                                        a: ({ node, ...props }) => (
                                          <a
                                            {...props}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 hover:underline transition-colors font-medium"
                                          />
                                        ),
                                        ul: ({ node, ...props }) => (
                                          <ul {...props} className="my-2 list-disc pl-4 space-y-1" />
                                        ),
                                        ol: ({ node, ...props }) => (
                                          <ol {...props} className="my-2 list-decimal pl-4 space-y-1" />
                                        ),
                                        li: ({ node, ...props }) => (
                                          <li {...props} className="pl-1" />
                                        )
                                      }}
                                    >
                                      {part.text}
                                    </ReactMarkdown>
                                  </div>
                                )
                              }

                              // Handle Tool parts
                              if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
                                return (
                                  <div key={index}>
                                    {renderToolPart(part, index, onOpenPanel)}
                                  </div>
                                )
                              }

                              return null
                            })
                          ) : null}

                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {/* Loading Indicator - Only show when submitted but not yet streaming (waiting for first chunk) */}
            {status === 'submitted' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex w-full">
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex w-full">
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 px-4 py-3 rounded-xl flex items-center gap-3">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <div className="text-sm text-red-600 dark:text-red-400">
                    Something went wrong.
                  </div>
                  <button
                    onClick={() => regenerate()}
                    className="text-xs bg-white dark:bg-white/10 px-2 py-1 rounded border border-red-100 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {
        messages.length > 0 && (
          <ChatInput
            variant="floating"
            onSubmit={handleSubmit}
            isLoading={isLoading}
            onStop={status === 'streaming' ? stop : undefined}
          />
        )
      }
    </div >
  )
}
