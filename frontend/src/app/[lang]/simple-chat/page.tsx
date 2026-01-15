"use client";

import { useChatRuntime, AssistantChatTransport } from "@assistant-ui/react-ai-sdk";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";

export default function SimpleChatPage() {
    const runtime = useChatRuntime({
        transport: new AssistantChatTransport({
            api: "/api/chat",
        }),
    });

    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 p-4">
            <div className="w-full max-w-4xl h-[90vh] bg-background border rounded-2xl shadow-xl overflow-hidden flex flex-col">
                <div className="bg-muted/50 p-3 border-b text-center">
                    <h1 className="text-sm font-semibold text-muted-foreground">
                        Simple Chat Debugger (Mock Mode) • /api/chat
                    </h1>
                </div>
                <AssistantRuntimeProvider runtime={runtime}>
                    <Thread />
                </AssistantRuntimeProvider>
            </div>
        </div>
    );
}
