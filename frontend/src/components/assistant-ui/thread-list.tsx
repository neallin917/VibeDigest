import {
    ThreadListItemPrimitive,
    ThreadListPrimitive,
    useThreadListItem,
    useAssistantRuntime,
} from "@assistant-ui/react";
import { Button } from "@/components/ui/button";
import { MessageSquarePlusIcon, TrashIcon } from "lucide-react";
import type { FC } from "react";

export const ThreadList: FC = () => {
    return (
        <ThreadListPrimitive.Root className="flex h-full flex-col gap-2">
            <div className="flex items-center justify-between px-4 py-2">
                <ThreadListPrimitive.New asChild>
                    <Button variant="ghost" className="flex-1 justify-start gap-2 px-2 text-muted-foreground hover:text-foreground">
                        <MessageSquarePlusIcon className="size-4" />
                        <span className="text-sm font-medium">New Chat</span>
                    </Button>
                </ThreadListPrimitive.New>
            </div>

            <div className="flex-1 overflow-y-auto px-2">
                <ThreadListPrimitive.Items components={{ ThreadListItem }} />
            </div>
        </ThreadListPrimitive.Root>
    );
};

const ThreadListItem: FC = () => {
    const thread = useThreadListItem();
    const runtime = useAssistantRuntime();

    return (
        <ThreadListItemPrimitive.Root
            className="group relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted data-[active]:bg-muted data-[active]:font-medium"
            onClick={(e) => {
                e.preventDefault();
                console.log("ThreadListItem clicked:", thread.id);
                try {
                    runtime.switchToThread(thread.id);
                    console.log("runtime.switchToThread called for:", thread.id);
                } catch (e) {
                    console.error("Error calling switchToThread:", e);
                }
            }}
        >
            <div className="flex-1 truncate pointer-events-none">
                <ThreadListItemPrimitive.Title />
            </div>

            <ThreadListItemPrimitive.Archive asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="invisible size-6 p-0 text-muted-foreground hover:text-destructive group-hover:visible"
                    onClick={(e) => e.stopPropagation()}
                >
                    <TrashIcon className="size-3" />
                    <span className="sr-only">Archive thread</span>
                </Button>
            </ThreadListItemPrimitive.Archive>
        </ThreadListItemPrimitive.Root>
    );
};
