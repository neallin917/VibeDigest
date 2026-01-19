"use client"

import { useState, useCallback, useEffect } from "react"
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

export default function ChatPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const queryThreadId = searchParams.get("threadId")

    // State
    const [threads, setThreads] = useState<Thread[]>([])
    const [activeThreadId, setActiveThreadId] = useState<string | null>(queryThreadId)
    const [initialMessages, setInitialMessages] = useState<UIMessage[]>([])

    // Fetch threads
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

    // Initial fetch
    useEffect(() => {
        fetchThreads()
    }, [fetchThreads])

    // Handle New Chat
    const handleNewChat = useCallback(() => {
        const newId = uuidv4()
        setActiveThreadId(newId)
        setInitialMessages([])
        
        // Update URL to remove task param if any
        router.push(pathname, { scroll: false })
    }, [pathname, router])

    // Handle Thread Selection
    const handleSelectThread = useCallback(async (threadId: string) => {
        setInitialMessages([])
        setActiveThreadId(threadId)

        // Clear task param
        const params = new URLSearchParams(searchParams.toString())
        if (params.has("task")) {
            params.delete("task")
            router.push(`${pathname}?${params.toString()}`, { scroll: false })
        }

        try {
            const res = await fetch(`/api/chat/threads/${threadId}/messages`)
            if (res.ok) {
                const dbMessages: DBMessage[] = await res.json()
                const uiMessages = dbMessages.map(mapDBMessageToUIMessage)
                setInitialMessages(uiMessages)
            }
        } catch (e) {
            console.error("Failed to load thread messages", e)
        }
    }, [pathname, router, searchParams])

    // Handle Task Selection (for AppSidebar)
    const handleSelectTask = useCallback((taskId: string) => {
        // Just navigate
        router.push(`${pathname}?task=${taskId}`)
    }, [pathname, router])

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
                    initialMessages={initialMessages}
                    onNewChat={handleNewChat}
                    onSelectThread={handleSelectThread}
                    onThreadCreated={fetchThreads}
                    threads={threads}
                />
            </div>
        </AppSidebarProvider>
    );
}
