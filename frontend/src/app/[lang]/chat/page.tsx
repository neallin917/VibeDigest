"use client"

import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppSidebarProvider } from "@/components/layout/AppSidebarContext";

export default function ChatPage() {
    return (
        <AppSidebarProvider defaultCollapsed={true}>
            <div className="h-screen w-full flex bg-background text-foreground overflow-hidden">
                {/* Global Sidebar - Full Height (Gemini Style) */}
                <AppSidebar />
                
                {/* Workspace - Contains its own Header */}
                <ChatWorkspace />
            </div>
        </AppSidebarProvider>
    );
}
