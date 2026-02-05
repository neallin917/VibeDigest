"use client"

import { useState, useCallback, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ChatWorkspace } from "@/components/chat/ChatWorkspace"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { AppSidebarProvider } from "@/components/layout/AppSidebarContext"
import { mapDBMessageToUIMessage, DBMessage } from "@/lib/chat-utils"
import type { UIMessage } from "ai"
import { v4 as uuidv4 } from 'uuid'

interface Thread {
    id: string
    title: string
    updated_at: string
}

function ChatPageContent() {
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
    const [taskSelectionNonce, setTaskSelectionNonce] = useState(0)
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
                
                // Keep chat area clean; summary is shown in the context panel
                setInitialMessages([])
            } else {
                router.replace(`${pathname}?threadId=${newId}`, { scroll: false })
            }
        }
    }, [fetchThreads, pathname, queryThreadId, router, searchParams])

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
    // CORE LOGIC: Clicking a task switches context. 
    // If we are already in a thread, we PRESERVE it to avoid jarring resets.
    // If we are not in a thread, we create a new one.
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

        // Case: Selecting a task (History or Demo or Auto-open)
        setTaskSelectionNonce((prev) => prev + 1)
        setActiveTaskId(taskId)
        params.set('task', taskId)

        // Check if we have an active thread
        if (activeThreadId) {
            // KEEP current thread
            params.set('threadId', activeThreadId)
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
            // We do NOT call loadTaskContext here because we don't want to wipe the chat history.
            // The VideoDetailPanel will load the context/summary.
        } else {
            // Start a FRESH chat session
            const newId = uuidv4()
            
            // Mark as new thread to skip loading
            newThreadIdsRef.current.add(newId)
            
            // Update State
            setActiveThreadId(newId)
            
            // Keep chat area clean; summary is shown in the context panel
            setInitialMessages([])
            
            // Update URL
            params.set('threadId', newId)
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        }

    }, [activeThreadId, pathname, router, searchParams])

    // Handle Demo Selection from Welcome Screen
    const handleSelectExample = useCallback(async (taskId: string) => {
        const params = new URLSearchParams(searchParams.toString())

        let nextThreadId = activeThreadId
        if (!nextThreadId) {
            const newId = uuidv4()
            newThreadIdsRef.current.add(newId)
            setActiveThreadId(newId)
            nextThreadId = newId
        }

        setActiveTaskId(taskId)
        setTaskSelectionNonce((prev) => prev + 1)
        params.set('task', taskId)
        params.set('threadId', nextThreadId)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })

        // Keep chat area clean; summary is shown in the context panel
        setInitialMessages([])
    }, [activeThreadId, pathname, router, searchParams])

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
            <div className="h-screen w-full flex text-foreground overflow-hidden">
                {/* Global Sidebar */}
                <AppSidebar
                    threads={threads}
                    activeThreadId={activeThreadId}
                    onNewChat={handleNewChat}
                    onSelectThread={handleSelectThread}
                />

                {/* Workspace */}
                <ChatWorkspace
                    activeThreadId={activeThreadId}
                    activeTaskId={activeTaskId}
                    taskSelectionNonce={taskSelectionNonce}
                    initialMessages={initialMessages}
                    onNewChat={handleNewChat}
                    onSelectThread={handleSelectThread}
                    onSelectTask={handleSelectTask}
                    onSelectExample={handleSelectExample}
                    onThreadCreated={fetchThreads}
                    onChatStarted={handleChatStarted}
                    threads={threads}
                />
            </div>
        </AppSidebarProvider>
    )
}

export function ChatPageClient() {
    return (
        <Suspense fallback={<div className="h-screen w-full bg-background" />}>
            <ChatPageContent />
        </Suspense>
    )
}
