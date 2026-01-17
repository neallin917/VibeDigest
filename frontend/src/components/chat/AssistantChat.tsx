"use client";

import { useChat, UIMessage } from "@ai-sdk/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Menu, PanelLeftClose, PanelLeftOpen, Send, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

// Default task_id for standalone chat mode (when no video context)
const DEFAULT_TASK_ID = "00000000-0000-0000-0000-000000000000";

interface AssistantChatProps {
    taskId?: string;
}

interface ChatThread {
    id: string;
    title: string;
    status: string;
    updated_at: string;
    created_at: string;
}

export function AssistantChat({ taskId: propTaskId }: AssistantChatProps) {
    // Use default taskId if none provided (standalone chat mode)
    const taskId = propTaskId || DEFAULT_TASK_ID;
    const isStandaloneMode = !propTaskId;

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
    const [isLoadingThreads, setIsLoadingThreads] = useState(true);
    const [inputValue, setInputValue] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesRef = useRef<UIMessage[]>([]);
    // Ref to track current threadId for sendMessage calls (to avoid stale closure)
    const threadIdRef = useRef<string | null>(null);
    // Ref to track if we are currently creating a thread (to skip initial fetch)
    const isCreatingThreadRef = useRef(false);

    // Keep ref in sync with state
    useEffect(() => {
        threadIdRef.current = currentThreadId;
    }, [currentThreadId]);

    // Fetch threads on mount
    useEffect(() => {
        const fetchThreads = async () => {
            setIsLoadingThreads(true);
            try {
                const res = await fetch(`/api/threads?taskId=${taskId}`);
                if (res.ok) {
                    const data = await res.json();
                    setThreads(data);
                    // Auto-select first thread if exists
                    if (data.length > 0 && !currentThreadId) {
                        setCurrentThreadId(data[0].id);
                    }
                }
            } catch (error) {
                console.error("[AssistantChat] Failed to fetch threads:", error);
            } finally {
                setIsLoadingThreads(false);
            }
        };

        fetchThreads();
    }, [taskId]);

    // AI SDK v6 useChat hook
    const {
        messages,
        sendMessage,
        status,
        setMessages,
        error,
    } = useChat({
        api: "/api/chat",
        // Note: body with dynamic values passed via sendMessage options
        onError: (err: Error) => {
            console.error("[AssistantChat] useChat error:", err);
        },
        onFinish: (options: { message: UIMessage }) => {
            console.log("[AssistantChat] onFinish message:", options.message);
            // Refresh thread list to update timestamps
            fetch(`/api/threads?taskId=${taskId}`)
                .then((res) => res.json())
                .then((data) => setThreads(data))
                .catch(console.error);
        },
        onResponse: (response: Response) => {
            console.log("[AssistantChat] onResponse:", response.status, response.headers);
        },
    } as any);

    // Log status and error changes
    useEffect(() => {
        console.log("[AssistantChat] status:", status, "error:", error);
    }, [status, error]);

    const isLoading = status === "streaming" || status === "submitted";

    // Keep ref in sync with current messages
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Fetch initial messages when thread changes
    useEffect(() => {
        if (!currentThreadId) {
            messagesRef.current = [];
            setMessages([]);
            return;
        }

        // Skip fetch if we just created this thread (state is already handled by useChat)
        if (isCreatingThreadRef.current) {
            isCreatingThreadRef.current = false;
            return;
        }

        messagesRef.current = [];
        setMessages([]);

        const fetchMessages = async () => {
            try {
                const res = await fetch(`/api/threads/${currentThreadId}/messages`);
                if (res.ok) {
                    const data = await res.json();
                    // Convert to AI SDK UIMessage format
                    const msgs: UIMessage[] = data.map((m: { id: string; role: string; content: string }) => ({
                        id: m.id,
                        role: m.role as "user" | "assistant",
                        parts: [{ type: "text" as const, text: m.content }],
                    }));
                    if (messagesRef.current.length === 0) {
                        setMessages(msgs);
                    }
                }
            } catch (error) {
                console.error("[AssistantChat] Failed to fetch messages:", error);
            }
        };

        fetchMessages();
    }, [currentThreadId, setMessages]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Create new thread - simplified to just reset state (don't create in DB until message sent)
    const handleNewChat = useCallback(() => {
        setCurrentThreadId(null);
        messagesRef.current = [];
        setMessages([]);
        setInputValue("");
    }, [setMessages]);

    // Handle form submit - create thread if none exists
    const onSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!inputValue.trim()) return;

            // If no thread, create one first
            if (!currentThreadId) {
                try {
                    const res = await fetch("/api/threads", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ taskId }),
                    });
                    if (res.ok) {
                        const newThread = await res.json();
                        // Prevent useEffect from clearing messages
                        isCreatingThreadRef.current = true;
                        setThreads((prev) => [newThread, ...prev]);
                        setCurrentThreadId(newThread.id);
                        messagesRef.current = [];
                        setMessages([]); // Ensure we start fresh for useChat
                        threadIdRef.current = newThread.id; // Update ref immediately
                        // Send message with the new threadId
                        sendMessage(
                            { text: inputValue },
                            { body: { taskId, threadId: newThread.id } }
                        );
                        setInputValue("");
                        return;
                    }
                } catch (error) {
                    console.error("[AssistantChat] Failed to create thread:", error);
                    return;
                }
            }

            sendMessage(
                { text: inputValue },
                { body: { taskId, threadId: threadIdRef.current } }
            );
            setInputValue("");
        },
        [inputValue, taskId, currentThreadId, sendMessage]
    );

    // Helper to extract text content from UIMessage
    const getMessageContent = (message: UIMessage): string => {
        if (typeof (message as any).content === 'string') return (message as any).content;
        if (message.parts) {
            return message.parts
                .filter((part): part is { type: "text"; text: string } => part.type === "text")
                .map((part) => part.text)
                .join("");
        }
        return "";
    };

    // Thread list item component
    const ThreadItem = ({ thread }: { thread: ChatThread }) => {
        // Format date for display if title is generic
        const dateStr = new Date(thread.updated_at || thread.created_at || Date.now()).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });

        const displayName = thread.title === "New Chat"
            ? `New Chat (${dateStr})`
            : thread.title;

        return (
            <button
                onClick={() => setCurrentThreadId(thread.id)}
                className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm truncate hover:bg-muted/50 transition-colors flex flex-col gap-0.5",
                    currentThreadId === thread.id && "bg-muted font-medium"
                )}
            >
                <span className="truncate w-full">{displayName}</span>
            </button>
        );
    };

    // Sidebar content
    const SidebarContent = () => (
        <div className="flex flex-col h-full">
            <div className="p-3 border-b">
                <Button
                    onClick={handleNewChat}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                >
                    <Plus className="size-4" />
                    New Chat
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {isLoadingThreads ? (
                    <div className="text-sm text-muted-foreground px-3 py-2">Loading...</div>
                ) : threads.length === 0 ? (
                    <div className="text-sm text-muted-foreground px-3 py-2">No conversations yet</div>
                ) : (
                    threads.map((thread) => <ThreadItem key={thread.id} thread={thread} />)
                )}
            </div>
        </div>
    );

    return (
        <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
            {/* Desktop Sidebar */}
            <div
                className={cn(
                    "hidden border-r bg-muted/10 transition-all duration-300 ease-in-out md:flex md:flex-col",
                    isSidebarOpen ? "w-[260px]" : "w-0 opacity-0 overflow-hidden"
                )}
            >
                <div className="flex items-center justify-between p-3 border-b">
                    <div className="font-semibold px-2">Chat</div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSidebarOpen(false)}
                        className="size-8 text-muted-foreground hover:text-foreground"
                    >
                        <PanelLeftClose className="size-4" />
                    </Button>
                </div>
                <SidebarContent />
            </div>

            {/* Main Chat Area */}
            <div className="relative flex min-w-0 flex-1 flex-col">
                {/* Floating Toggle for Desktop (when closed) */}
                {!isSidebarOpen && (
                    <div className="absolute left-2 top-2 z-20 hidden md:block">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarOpen(true)}
                            className="size-8 text-muted-foreground hover:text-foreground"
                        >
                            <PanelLeftOpen className="size-4" />
                        </Button>
                    </div>
                )}

                {/* Mobile Header / Toggle */}
                <div className="flex items-center p-2 md:hidden border-b">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Menu className="size-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[80%] sm:w-[320px] p-0">
                            <VisuallyHidden>
                                <SheetTitle>Chat History</SheetTitle>
                            </VisuallyHidden>
                            <SidebarContent />
                        </SheetContent>
                    </Sheet>
                    <span className="ml-2 font-semibold">Chat</span>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <p>{isStandaloneMode ? "Start chatting with AI" : "Start a conversation about this video"}</p>
                        </div>
                    ) : (
                        messages.map((message) => (
                            <div
                                key={message.id}
                                className={cn(
                                    "flex gap-3 max-w-[80%]",
                                    message.role === "user" ? "ml-auto flex-row-reverse" : ""
                                )}
                            >
                                <div
                                    className={cn(
                                        "rounded-lg px-4 py-2",
                                        message.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                    )}
                                >
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <ReactMarkdown>
                                            {getMessageContent(message)}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t p-4">
                    <form onSubmit={onSubmit} className="flex gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={isStandaloneMode ? "Ask anything..." : "Ask about the video..."}
                            className="flex-1 rounded-lg border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            disabled={isLoading}
                        />
                        <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()}>
                            <Send className="size-4" />
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
