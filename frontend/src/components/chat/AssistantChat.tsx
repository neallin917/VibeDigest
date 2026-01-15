"use client";

import { useLangGraphRuntime } from "@assistant-ui/react-langgraph";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Client } from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import { Thread } from "@/components/assistant-ui/thread";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

import { createClient } from "@/lib/supabase";

import { useSupabaseCloud } from "@/hooks/useSupabaseCloud";

// ... inside component ...

export function AssistantChat() {
    const supabaseCloud = useSupabaseCloud();
    const runtime = useLangGraphRuntime(useMemo(() => {
        const getClient = () => {
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            return new Client({ apiUrl: `${origin}/lg` });
        };

        return {
            cloud: supabaseCloud as any,
            async create() {
                const client = getClient();
                const thread = await client.threads.create();
                return { externalId: thread.thread_id };
            },
            async stream(messages, { initialize }) {
                const client = getClient();
                let { externalId: threadId } = await initialize();

                if (!threadId) {
                    // This should technically not happen if cloud adapter works correctly
                    // creating the thread via our create() -> cloud.create() logic.
                    // But if it does (e.g. first run), initialize() calls create(),
                    // which returns { externalId }.
                    // The cloud adapter should catch that and store it.
                    // So threadId SHOULD be defined.
                    const thread = await client.threads.create();
                    threadId = thread.thread_id;
                }

                // Get Auth Token
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                return client.runs.stream(
                    threadId!,
                    "agent",
                    {
                        input: { messages },
                        streamMode: "messages",
                        config: {
                            configurable: {
                                thread_id: threadId,
                                user_id: token ? undefined : "anonymous",
                            }
                        },
                        metadata: token ? { "authorization": `Bearer ${token}` } : {}
                    }
                );
            },
            async load(threadId) {
                console.log("Loading thread:", threadId);

                // Get Auth Token
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;

                const origin = typeof window !== "undefined" ? window.location.origin : "";
                const client = new Client({
                    apiUrl: `${origin}/lg`,
                    defaultHeaders: token ? { "Authorization": `Bearer ${token}` } : {}
                });

                try {
                    // Look up the external ID (LangGraph ID) using the Supabase ID
                    let langGraphThreadId = threadId;
                    try {
                        const threadData = await (supabaseCloud as any).threads.get(threadId);
                        if (threadData?.externalId) {
                            langGraphThreadId = threadData.externalId;
                            console.log("Resolved external ID:", langGraphThreadId);
                        }
                    } catch (lookupError) {
                        console.warn("Failed to lookup external ID, assuming direct ID usage:", lookupError);
                    }

                    const state = await client.threads.getState(langGraphThreadId);
                    console.log("Loaded context for thread:", langGraphThreadId);
                    return {
                        messages: (state.values as any).messages || [],
                    };
                } catch (e) {
                    console.error("Failed to load thread state:", e);
                }
                return { messages: [] };
            },
        };
    }, [supabaseCloud]));

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    return (
        <AssistantRuntimeProvider runtime={runtime}>
            <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
                {/* Desktop Sidebar */}
                <div
                    className={cn(
                        "hidden border-r bg-muted/10 transition-all duration-300 ease-in-out md:flex md:flex-col",
                        isSidebarOpen ? "w-[260px]" : "w-0 opacity-0 overflow-hidden"
                    )}
                >
                    <div className="flex items-center justify-between p-3">
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
                    <div className="flex-1 overflow-hidden hover:overflow-y-auto">
                        <ThreadList />
                    </div>
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
                    <div className="flex items-center p-2 md:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Menu className="size-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[80%] sm:w-[320px] p-0">
                                <div className="flex flex-col h-full">
                                    <div className="p-4 border-b font-semibold">
                                        Chat
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2">
                                        <ThreadList />
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                        <span className="ml-2 font-semibold">ChatGPT Clone</span>
                    </div>

                    <Thread />
                </div>
            </div>
        </AssistantRuntimeProvider>
    );
}
