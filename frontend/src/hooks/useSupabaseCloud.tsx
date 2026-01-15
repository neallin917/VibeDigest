import { createClient } from "@/lib/supabase";
import { useMemo } from "react";
import { Client } from "@langchain/langgraph-sdk";

export function useSupabaseCloud() {
    return useMemo(() => {
        const supabase = createClient();

        return {
            threads: {
                async list() {
                    const { data } = await supabase.from("threads").select("*").order("updated_at", { ascending: false });
                    return {
                        threads: data?.map((t) => ({
                            id: t.id,
                            title: t.title || "New Chat",
                            is_archived: t.archived,
                            externalId: t.external_id,
                            external_id: t.external_id,
                        })) || [],
                    };
                },
                async create(params: { externalId?: string }) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) throw new Error("User not authenticated");

                    const { data, error } = await supabase
                        .from("threads")
                        .insert({
                            user_id: user.id,
                            external_id: params.externalId,
                            title: "New Chat",
                        })
                        .select()
                        .single();

                    if (error) throw error;
                    return { thread_id: data.id };
                },
                async update(threadId: string, params: { title?: string; is_archived?: boolean }) {
                    const updates: any = {};
                    if (params.title !== undefined) updates.title = params.title;
                    if (params.is_archived !== undefined) updates.archived = params.is_archived;
                    if (Object.keys(updates).length > 0) {
                        await supabase.from("threads").update(updates).eq("id", threadId);
                    }
                },
                async delete(threadId: string) {
                    await supabase.from("threads").delete().eq("id", threadId);
                },
                async get(threadId: string) {
                    console.log("useSupabaseCloud.threads.get called for:", threadId);
                    const { data, error } = await supabase.from("threads").select("*").eq("id", threadId).single();
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
                        is_archived: data.archived,
                        externalId: data.external_id,
                        external_id: data.external_id,
                    };
                },
                async generateTitle(threadId: string, messages: any) {
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
                        // 1. Get externalId from keys/db
                        const { data } = await supabase.from("threads").select("external_id").eq("id", threadId).single();
                        if (!data || !data.external_id) {
                            console.log("SupabaseCloud: No external_id found for", threadId);
                            return { messages: [] };
                        }

                        const externalId = data.external_id;

                        // 2. Fetch from LangGraph
                        // We need to construct the client here. 
                        // Assuming /lg proxy exists as per AssistantChat
                        const origin = typeof window !== "undefined" ? window.location.origin : "";
                        const client = new Client({ apiUrl: `${origin}/lg` });

                        try {
                            const state = await client.threads.getState(externalId);
                            const langGraphMessages = (state.values as any).messages || [];

                            // 3. Convert to Assistant UI format
                            const messages = langGraphMessages.map((msg: any) => {
                                const role = msg.type === "human" ? "user" : "assistant";
                                // Simple text conversion. Complex content might need more work.
                                return {
                                    id: msg.id || Math.random().toString(36),
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
                            // 1. Start a "text" part at index 0
                            controller.enqueue({
                                type: "part-start",
                                part: { type: "text" },
                                path: [0]
                            });

                            // 2. Send the text content at index 0
                            controller.enqueue({
                                type: "text-delta",
                                textDelta: "Chat",
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
            },
        };
    }, []);
}
