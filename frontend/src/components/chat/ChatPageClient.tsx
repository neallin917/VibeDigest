"use client"

import { useState, useCallback, useEffect, useRef, useMemo, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ChatWorkspace } from "@/components/chat/ChatWorkspace"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { AppSidebarProvider } from "@/components/layout/AppSidebarContext"
import { mapDBMessageToUIMessage, DBMessage } from "@/lib/chat-utils"
import type { UIMessage } from "ai"
import { v4 as uuidv4 } from 'uuid'
import { createClient } from "@/lib/supabase"
import { fetchThreadTaskId } from "@/lib/thread-utils"
import { env } from "@/env"

interface Thread {
    id: string
    title: string
    updated_at: string
    task_id?: string | null
}

function ChatPageContent() {
    const searchParams = useSearchParams()
    const { replace } = useRouter()
    const pathname = usePathname()
    const queryThreadId = searchParams.get("threadId")
    const queryTaskId = searchParams.get("task")
    const searchParamsString = searchParams.toString()

    // Auth state (null = loading, true/false = resolved)
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
    const supabase = useMemo(() => createClient(), [])

    useEffect(() => {
        // E2E test mode: read auth state from VIBEDIGEST_E2E_AUTH_BYPASS cookie
        // This allows per-test control: isAuthenticated: true/false in setupApiMocks
        if (env.NEXT_PUBLIC_E2E_MOCK === '1') {
            const isE2EAuthenticated = document.cookie
                .split(';')
                .some(c => c.trim() === 'VIBEDIGEST_E2E_AUTH_BYPASS=true')
            setIsAuthenticated(isE2EAuthenticated)
            return
        }
        supabase.auth.getUser().then(({ data: { user } }) => {
            setIsAuthenticated(!!user)
        })
    }, [supabase])

    // State
    const [threads, setThreads] = useState<Thread[]>([])
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
    const [activeTaskId, setActiveTaskId] = useState<string | null>(queryTaskId)
    const [initialMessages, setInitialMessages] = useState<UIMessage[]>([])
    const [taskSelectionNonce, setTaskSelectionNonce] = useState(0)
    const [isBootstrapping, setIsBootstrapping] = useState(true)
    // Track newly created thread IDs to skip loading
    const newThreadIdsRef = useRef<Set<string>>(new Set())
    const hasBootstrappedRef = useRef(false)
    const latestSearchParamsRef = useRef(searchParamsString)
    const resolvedActiveThreadId = queryThreadId || activeThreadId
    const resolvedActiveTaskId = queryTaskId ?? activeTaskId

    useEffect(() => {
        latestSearchParamsRef.current = searchParamsString
    }, [searchParamsString])

    const getCurrentParams = useCallback(() => {
        return new URLSearchParams(latestSearchParamsRef.current)
    }, [])

    const safeReplace = useCallback((params: URLSearchParams) => {
        const nextSearch = params.toString()
        const currentSearch = latestSearchParamsRef.current
        if (nextSearch === currentSearch) return false

        latestSearchParamsRef.current = nextSearch
        const nextUrl = nextSearch ? `${pathname}?${nextSearch}` : pathname
        replace(nextUrl, { scroll: false })
        return true
    }, [pathname, replace])

    // Fetch threads list (silently skipped for unauthenticated users)
    const fetchThreads = useCallback(async () => {
        try {
            const res = await fetch('/api/chat/threads')
            if (res.status === 401) {
                setThreads([])
                return
            }
            if (res.ok) {
                const data = await res.json()
                setThreads(data)
            }
        } catch (error) {
            console.error('Failed to fetch threads', error)
        }
    }, [])

    const loadThreadMessages = useCallback(async (threadId: string) => {
        try {
            const res = await fetch(`/api/chat/threads/${threadId}/messages`)
            if (res.status === 401) {
                setInitialMessages([])
                return
            }
            if (res.ok) {
                const dbMessages: DBMessage[] = await res.json()
                const uiMessages = dbMessages.map(mapDBMessageToUIMessage)
                setInitialMessages(uiMessages)
                return
            }
            setInitialMessages([])
        } catch (error) {
            console.error('Failed to load thread messages', error)
            setInitialMessages([])
        }
    }, [])

    const resolveOrCreateThreadForTask = useCallback(async (taskId: string) => {
        try {
            const listRes = await fetch(`/api/threads?taskId=${encodeURIComponent(taskId)}`)
            if (listRes.status === 401) {
                // Unauthenticated: use a local ephemeral thread ID
                const fallbackId = uuidv4()
                newThreadIdsRef.current.add(fallbackId)
                return fallbackId
            }
            if (listRes.ok) {
                const taskThreads: Thread[] = await listRes.json()
                if (Array.isArray(taskThreads) && taskThreads.length > 0 && taskThreads[0]?.id) {
                    return taskThreads[0].id
                }
            }
        } catch (error) {
            console.error('Failed to resolve task threads', error)
        }

        try {
            const createRes = await fetch('/api/threads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId }),
            })

            if (createRes.status === 401) {
                const fallbackId = uuidv4()
                newThreadIdsRef.current.add(fallbackId)
                return fallbackId
            }

            if (createRes.ok) {
                const createdThread: Thread = await createRes.json()
                if (createdThread?.id) {
                    return createdThread.id
                }
            }
        } catch (error) {
            console.error('Failed to create task thread', error)
        }

        // Fallback for degraded mode: keep chat usable even if task-thread APIs fail.
        const fallbackId = uuidv4()
        newThreadIdsRef.current.add(fallbackId)
        return fallbackId
    }, [])

    // Keep local state synchronized with URL params and ensure a thread exists.
    useEffect(() => {
        let cancelled = false

        const initialize = async () => {
            if (!hasBootstrappedRef.current) {
                setIsBootstrapping(true)
            }
            await fetchThreads()

            if (queryTaskId) {
                const resolvedThreadId = queryThreadId || await resolveOrCreateThreadForTask(queryTaskId)
                if (cancelled) return

                setActiveTaskId(queryTaskId)
                setActiveThreadId(resolvedThreadId)

                if (!newThreadIdsRef.current.has(resolvedThreadId)) {
                    await loadThreadMessages(resolvedThreadId)
                } else {
                    setInitialMessages([])
                }

                const params = getCurrentParams()
                params.set("task", queryTaskId)
                params.set("threadId", resolvedThreadId)
                safeReplace(params)
            } else if (queryThreadId) {
                if (cancelled) return
                setActiveThreadId(queryThreadId)

                // Restore task association from the thread's persisted task_id
                if (!newThreadIdsRef.current.has(queryThreadId)) {
                    const restoredTaskId = await fetchThreadTaskId(queryThreadId)
                    if (cancelled) return

                    if (restoredTaskId) {
                        setActiveTaskId(restoredTaskId)
                        const params = getCurrentParams()
                        params.set("task", restoredTaskId)
                        params.set("threadId", queryThreadId)
                        safeReplace(params)
                    } else {
                        setActiveTaskId(null)
                    }

                    await loadThreadMessages(queryThreadId)
                } else {
                    setActiveTaskId(null)
                    setInitialMessages([])
                }
            } else {
                const newId = uuidv4()
                newThreadIdsRef.current.add(newId)
                if (cancelled) return

                setActiveTaskId(null)
                setActiveThreadId(newId)
                setInitialMessages([])
                const params = getCurrentParams()
                params.delete("task")
                params.set("threadId", newId)
                safeReplace(params)
            }

            if (!cancelled) {
                hasBootstrappedRef.current = true
                setIsBootstrapping(false)
            }
        }

        initialize()

        return () => {
            cancelled = true
        }
    }, [
        fetchThreads,
        loadThreadMessages,
        pathname,
        queryTaskId,
        queryThreadId,
        resolveOrCreateThreadForTask,
        getCurrentParams,
        safeReplace,
    ])

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
        const params = getCurrentParams()
        params.delete("task")
        params.set("threadId", newId)
        safeReplace(params)
    }, [getCurrentParams, safeReplace])

    // Handle Thread Selection (from sidebar)
    const handleSelectThread = useCallback(async (threadId: string) => {
        // Remove from new threads set (in case it was added but now has messages)
        newThreadIdsRef.current.delete(threadId)

        // Restore task association from the thread's persisted task_id
        const restoredTaskId = await fetchThreadTaskId(threadId)
        setActiveTaskId(restoredTaskId)

        // Update URL with restored task (if any)
        const params = getCurrentParams()
        if (restoredTaskId) {
            params.set("task", restoredTaskId)
        } else {
            params.delete("task")
        }
        params.set("threadId", threadId)
        safeReplace(params)

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
    }, [getCurrentParams, safeReplace])

    // Handle Task Selection (from Sidebar or Workspace)
    const handleSelectTask = useCallback(async (taskId: string | null) => {
        const params = getCurrentParams()

        if (!taskId) {
            // Case: Closing the panel / Deselecting task
            // Action: Keep current thread, just remove task param
            params.delete("task")
            setActiveTaskId(null)
            if (resolvedActiveThreadId) {
                params.set('threadId', resolvedActiveThreadId)
            }
            safeReplace(params)
            return
        }

        // Case: Selecting a task (History or Demo or Auto-open)
        setTaskSelectionNonce((prev) => prev + 1)
        setActiveTaskId(taskId)
        params.set('task', taskId)

        const resolvedThreadId = await resolveOrCreateThreadForTask(taskId)
        const isEphemeralThread = newThreadIdsRef.current.has(resolvedThreadId)
        newThreadIdsRef.current.delete(resolvedThreadId)

        setActiveThreadId(resolvedThreadId)
        params.set('threadId', resolvedThreadId)
        safeReplace(params)

        if (isEphemeralThread) {
            setInitialMessages([])
        } else {
            await loadThreadMessages(resolvedThreadId)
        }

        fetchThreads()
    }, [fetchThreads, getCurrentParams, loadThreadMessages, resolveOrCreateThreadForTask, resolvedActiveThreadId, safeReplace])

    // Handle Demo Selection from Welcome Screen
    const handleSelectExample = useCallback(async (taskId: string) => {
        await handleSelectTask(taskId)
    }, [handleSelectTask])

    // Handle Chat Started (first message sent)
    const handleChatStarted = useCallback((threadId: string) => {
        // Remove from new threads set since it now has messages
        newThreadIdsRef.current.delete(threadId)

        // Ensure URL is updated
        const params = getCurrentParams()
        if (params.get("threadId") !== threadId) {
            params.set('threadId', threadId)
            safeReplace(params)
        }

        // Refresh threads list
        fetchThreads()
    }, [fetchThreads, getCurrentParams, safeReplace])

    return (
        <AppSidebarProvider defaultCollapsed={true}>
            <div className="h-screen w-full flex text-foreground overflow-hidden">
                {/* Global Sidebar */}
                <AppSidebar
                    threads={threads}
                    activeThreadId={resolvedActiveThreadId}
                    onNewChat={handleNewChat}
                    onSelectThread={handleSelectThread}
                />

                {/* Workspace */}
                {isBootstrapping ? (
                    <div className="flex-1 h-screen bg-background" />
                ) : (
                    <ChatWorkspace
                        activeThreadId={resolvedActiveThreadId}
                        activeTaskId={resolvedActiveTaskId}
                        taskSelectionNonce={taskSelectionNonce}
                        initialMessages={initialMessages}
                        isAuthenticated={isAuthenticated ?? false}
                        onNewChat={handleNewChat}
                        onSelectThread={handleSelectThread}
                        onSelectTask={handleSelectTask}
                        onSelectExample={handleSelectExample}
                        onThreadCreated={fetchThreads}
                        onChatStarted={handleChatStarted}
                        threads={threads}
                    />
                )}
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
