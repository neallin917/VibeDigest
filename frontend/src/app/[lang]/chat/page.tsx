"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ChatWorkspace } from "@/components/chat/ChatWorkspace"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { AppSidebarProvider } from "@/components/layout/AppSidebarContext"
import { createClient } from "@/lib/supabase"
import { mapDBMessageToUIMessage, DBMessage } from "@/lib/chat-utils"
import type { UIMessage } from "ai"
import { v4 as uuidv4 } from 'uuid'

interface Thread {
    id: string
    title: string
    updated_at: string
}

export default function ChatPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const queryThreadId = searchParams.get("threadId")
    const queryTaskId = searchParams.get("task")

    // State
    const [threads, setThreads] = useState<Thread[]>([])
    const [activeThreadId, setActiveThreadId] = useState<string | null>(queryThreadId)
    const [activeTaskId, setActiveTaskId] = useState<string | null>(queryTaskId)
    const [initialMessages, setInitialMessages] = useState<UIMessage[]>([])
    const supabase = createClient()

    // Track newly created thread IDs to skip loading
    const newThreadIdsRef = useRef<Set<string>>(new Set())
    // Track if initial setup is done
    const hasInitializedRef = useRef(false)

    // Fetch threads list
    const fetchThreads = useCallback(async () => {
        try {
            const res = await fetch('/api/chat/threads')
            if (res.ok) {
                const data = await res.json()
                setThreads(data)
            }
        } catch (error) {
            console.error('Failed to fetch threads', error)
        }
    }, [])

    // Helper: Load task context
    const loadTaskContext = useCallback(async (taskId: string) => {
        try {
            const { data: task } = await supabase
                .from('tasks')
                .select('video_title')
                .eq('id', taskId)
                .single()
            
            const { data: outputs } = await supabase
                .from('task_outputs')
                .select('content')
                .eq('task_id', taskId)
                .eq('kind', 'summary')
                .eq('status', 'completed')
                .single()

            const welcomeContent = task ? 
                `I've loaded the context for **"${task.video_title || 'Untitled Video'}"**.\n\n${outputs?.content ? `Here is the summary:\n\n${outputs.content}` : 'I am ready to answer your questions about this video.'}` 
                : 'I am ready to discuss the video.'

            const contextMessage: UIMessage = {
                id: uuidv4(),
                role: 'assistant',
                content: welcomeContent,
                parts: [{ type: 'text', text: welcomeContent }]
            }
            
            setInitialMessages([contextMessage])
        } catch (e) {
            console.error("Failed to load task context", e)
            setInitialMessages([])
        }
    }, [supabase])

    // Initial setup: ensure thread ID exists
    useEffect(() => {
        if (hasInitializedRef.current) return
        hasInitializedRef.current = true

        fetchThreads()

        if (queryThreadId) {
            // URL has threadId, will load messages in next effect
            setActiveThreadId(queryThreadId)
        } else {
            // No threadId in URL, create new one
            const newId = uuidv4()
            newThreadIdsRef.current.add(newId)
            setActiveThreadId(newId)

            // Check if there is a task param (Deep Link from Explore)
            const deepLinkTaskId = searchParams.get("task")
            if (deepLinkTaskId) {
                setActiveTaskId(deepLinkTaskId)
                const params = new URLSearchParams(searchParams.toString())
                params.set('threadId', newId)
                router.replace(`${pathname}?${params.toString()}`, { scroll: false })
                
                // Load context immediately
                loadTaskContext(deepLinkTaskId)
            } else {
                router.replace(`${pathname}?threadId=${newId}`, { scroll: false })
            }
        }
    }, [fetchThreads, pathname, queryThreadId, router, searchParams, loadTaskContext])

    // Keep active task in sync with URL (back/forward)
    useEffect(() => {
        setActiveTaskId(queryTaskId)
    }, [queryTaskId])

    // Load messages when URL threadId changes (but skip for new threads)
    useEffect(() => {
        if (!queryThreadId) return

        // Skip loading for newly created threads
        if (newThreadIdsRef.current.has(queryThreadId)) {
            return
        }

        const loadMessages = async () => {
            try {
                const res = await fetch(`/api/chat/threads/${queryThreadId}/messages`)
                if (res.ok) {
                    const dbMessages: DBMessage[] = await res.json()
                    const uiMessages = dbMessages.map(mapDBMessageToUIMessage)
                    setInitialMessages(uiMessages)
                } else {
                    setInitialMessages([])
                }
            } catch (error) {
                console.error('Failed to load thread messages', error)
                setInitialMessages([])
            }
        }

        loadMessages()
    }, [queryThreadId])

    // Handle New Chat
    const handleNewChat = useCallback(() => {
        const newId = uuidv4()

        // Mark as new thread to skip loading
        newThreadIdsRef.current.add(newId)

        // Update state first
        setActiveThreadId(newId)
        setActiveTaskId(null)
        setInitialMessages([])

        // Then update URL
        router.replace(`${pathname}?threadId=${newId}`, { scroll: false })
    }, [pathname, router])

    // Handle Thread Selection (from sidebar)
    const handleSelectThread = useCallback(async (threadId: string) => {
        // Remove from new threads set (in case it was added but now has messages)
        newThreadIdsRef.current.delete(threadId)

        // Update URL
        const params = new URLSearchParams(searchParams.toString())
        params.delete("task")
        setActiveTaskId(null)
        params.set("threadId", threadId)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })

        // Load messages
        try {
            const res = await fetch(`/api/chat/threads/${threadId}/messages`)
            if (res.ok) {
                const dbMessages: DBMessage[] = await res.json()
                const uiMessages = dbMessages.map(mapDBMessageToUIMessage)
                setInitialMessages(uiMessages)
                setActiveThreadId(threadId)
            } else {
                setInitialMessages([])
                setActiveThreadId(threadId)
            }
        } catch (e) {
            console.error("Failed to load thread messages", e)
            setInitialMessages([])
            setActiveThreadId(threadId)
        }
    }, [pathname, router, searchParams])

    // Handle Task Selection (from Sidebar or Workspace)
    // CORE LOGIC: Clicking a task starts a NEW, fresh chat session to ensure clean context.
    const handleSelectTask = useCallback(async (taskId: string | null) => {
        const params = new URLSearchParams(searchParams.toString())

        if (!taskId) {
            // Case: Closing the panel / Deselecting task
            // Action: Keep current thread, just remove task param
            params.delete("task")
            setActiveTaskId(null)
            if (activeThreadId) {
                params.set('threadId', activeThreadId)
            }
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
            return
        }

        // Case: Selecting a task (History or Demo)
        // Action: Start a FRESH chat session with Context Pre-loaded
        const newId = uuidv4()
        
        // Mark as new thread to skip loading
        newThreadIdsRef.current.add(newId)
        
        // Update State
        setActiveThreadId(newId)
        setActiveTaskId(taskId)
        
        // Pre-load context message
        // This gives immediate visual feedback that the task is loaded
        loadTaskContext(taskId)
        
        // Update URL
        params.set('threadId', newId)
        params.set('task', taskId)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })

    }, [activeThreadId, pathname, router, searchParams, loadTaskContext])

    // Handle Chat Started (first message sent)
    const handleChatStarted = useCallback((threadId: string) => {
        // Remove from new threads set since it now has messages
        newThreadIdsRef.current.delete(threadId)

        // Ensure URL is updated
        const params = new URLSearchParams(searchParams.toString())
        params.set('threadId', threadId)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })

        // Refresh threads list
        fetchThreads()
    }, [fetchThreads, pathname, router, searchParams])

    return (
        <AppSidebarProvider defaultCollapsed={true}>
            <div className="h-screen w-full flex bg-background text-foreground overflow-hidden">
                {/* Global Sidebar */}
                <AppSidebar
                    threads={threads}
                    activeThreadId={activeThreadId}
                    onNewChat={handleNewChat}
                    onSelectThread={handleSelectThread}
                    onSelectTask={handleSelectTask}
                />

                {/* Workspace */}
                <ChatWorkspace
                    activeThreadId={activeThreadId}
                    activeTaskId={activeTaskId}
                    initialMessages={initialMessages}
                    onNewChat={handleNewChat}
                    onSelectThread={handleSelectThread}
                    onSelectTask={handleSelectTask}
                    onThreadCreated={fetchThreads}
                    onChatStarted={handleChatStarted}
                    threads={threads}
                />
            </div>
        </AppSidebarProvider>
    )
}
