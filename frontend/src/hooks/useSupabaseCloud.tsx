import { createClient } from "@/lib/supabase";
import { useMemo } from "react";
import { Client } from "@langchain/langgraph-sdk";

// Default task_id for chat - in production this should come from context
const DEFAULT_TASK_ID = "00000000-0000-0000-0000-000000000000";

export function useSupabaseCloud(taskId?: string) {
    const effectiveTaskId = taskId || DEFAULT_TASK_ID;

    return useMemo(() => {
        const supabase = createClient();

        return {
            threads: {
                async list() {
                    const { data } = await supabase
                        .from("chat_threads")
                        .select("*")
                        .eq("task_id", effectiveTaskId)
                        .neq("status", "deleted")
                        .order("updated_at", { ascending: false });
                    return {
                        threads: data?.map((t) => ({
                            id: t.id,
                            title: t.title || "New Chat",
                            is_archived: t.status === "archived",
                            externalId: t.metadata?.external_id,
                            external_id: t.metadata?.external_id,
                        })) || [],
                    };
                },
                async create(params: { externalId?: string }) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) throw new Error("User not authenticated");

                    // First, ensure we have a valid task_id
                    // If using default, we may need to create a dummy task
                    let taskIdToUse = effectiveTaskId;

                    // Check if the task exists
                    const { data: existingTask } = await supabase
                        .from("tasks")
                        .select("id")
                        .eq("id", taskIdToUse)
                        .single();

                    if (!existingTask) {
                        // Create a default task for chat
                        const { data: newTask, error: taskError } = await supabase
                            .from("tasks")
                            .insert({
                                id: taskIdToUse,
                                user_id: user.id,
                                video_url: "",
                                status: "completed",
                                video_title: "Chat Session",
                            })
                            .select()
                            .single();

                        if (taskError) {
                            console.error("Failed to create default task:", taskError);
                            // If task creation fails (e.g., already exists from race), continue anyway
                        }
                    }

                    const { data, error } = await supabase
                        .from("chat_threads")
                        .insert({
                            user_id: user.id,
                            task_id: taskIdToUse,
                            title: "New Chat",
                            status: "active",
                            metadata: params.externalId ? { external_id: params.externalId } : {},
                        })
                        .select()
                        .single();

                    if (error) throw error;
                    return { thread_id: data.id };
                },
                async update(threadId: string, params: { title?: string; is_archived?: boolean }) {
                    const updates: Record<string, unknown> = {};
                    if (params.title !== undefined) updates.title = params.title;
                    if (params.is_archived !== undefined) {
                        updates.status = params.is_archived ? "archived" : "active";
                    }
                    if (Object.keys(updates).length > 0) {
                        await supabase.from("chat_threads").update(updates).eq("id", threadId);
                    }
                },
                async delete(threadId: string) {
                    // Soft delete by setting status
                    await supabase.from("chat_threads").update({ status: "deleted" }).eq("id", threadId);
                },
                async get(threadId: string) {
                    console.log("useSupabaseCloud.threads.get called for:", threadId);
                    const { data, error } = await supabase.from("chat_threads").select("*").eq("id", threadId).single();
                    if (error) {
                        console.error("useSupabaseCloud.threads.get error:", error);
                    }
                    if (!data) {
                        console.error("useSupabaseCloud.threads.get: Thread not found");
                        throw new Error("Thread not found");
                    }
                    console.log("useSupabaseCloud.threads.get success:", data);
                    return {
                        id: data.id,
                        title: data.title,
                        is_archived: data.status === "archived",
                        externalId: data.metadata?.external_id,
                        external_id: data.metadata?.external_id,
                    };
                },
                async generateTitle(threadId: string, messages: unknown) {
                    return new ReadableStream({
                        start(controller) {
                            // 1. Start a "text" part at index 0
                            controller.enqueue({
                                type: "part-start",
                                part: { type: "text" },
                                path: [0]
                            });

                            // 2. Send the text content at index 0
                            controller.enqueue({
                                type: "text-delta",
                                textDelta: "New Chat",
                                path: [0]
                            });

                            // 3. Send finish event
                            controller.enqueue({
                                type: "message-finish",
                                finishReason: "stop",
                                usage: { promptTokens: 0, completionTokens: 0 },
                                path: []
                            });

                            controller.close();
                        }
                    });
                },

                messages: {
                    async list(threadId: string) {
                        console.log("SupabaseCloud: messages.list called for", threadId);
                        // 1. Get externalId from metadata
                        const { data } = await supabase
                            .from("chat_threads")
                            .select("metadata")
                            .eq("id", threadId)
                            .single();

                        const externalId = data?.metadata?.external_id;
                        if (!externalId) {
                            console.log("SupabaseCloud: No external_id found for", threadId);
                            return { messages: [] };
                        }

                        // 2. Fetch from LangGraph
                        const origin = typeof window !== "undefined" ? window.location.origin : "";
                        const client = new Client({ apiUrl: `${origin}/lg` });

                        try {
                            const state = await client.threads.getState(externalId);
                            const langGraphMessages = (state.values as Record<string, unknown>).messages || [];

                            // 3. Convert to Assistant UI format
                            const messages = (langGraphMessages as Array<Record<string, unknown>>).map((msg) => {
                                const role = msg.type === "human" ? "user" : "assistant";
                                return {
                                    id: (msg.id as string) || Math.random().toString(36),
                                    role,
                                    content: [{ type: "text", text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }],
                                };
                            });

                            console.log("SupabaseCloud: Loaded messages", messages);
                            return { messages };

                        } catch (e) {
                            console.error("SupabaseCloud: Failed to load LangGraph state", e);
                            return { messages: [] };
                        }
                    }
                },
            },
            runs: {
                async stream() {
                    return new ReadableStream({
                        start(controller) {
                            controller.enqueue({
                                type: "part-start",
                                part: { type: "text" },
                                path: [0]
                            });

                            controller.enqueue({
                                type: "text-delta",
                                textDelta: "Chat",
                                path: [0]
                            });

                            controller.enqueue({
                                type: "message-finish",
                                finishReason: "stop",
                                usage: { promptTokens: 0, completionTokens: 0 },
                                path: []
                            });

                            controller.close();
                        }
                    });
                },
            },
        };
    }, [effectiveTaskId]);
}

