import { Suspense } from "react"
import { ChatPageContent } from "./ChatPageContent"

export default function ChatPage() {
    return (
        <Suspense fallback={
            <div className="h-screen w-full flex items-center justify-center bg-background">
                <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
        }>
            <ChatPageContent />
        </Suspense>
    )
}
