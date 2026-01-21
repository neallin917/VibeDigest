// @ts-nocheck
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, generateText, UIMessage, tool, createIdGenerator, stepCountIs } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Create OpenAI-compatible provider with custom baseURL (for local LLM)
const openai = createOpenAI({
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
});

// Model name from environment (default to gemini-3-flash for custom LLM)
const MODEL_NAME = process.env.OPENAI_MODEL || 'gemini-3-flash';

// Backend API URL (must match BACKEND_API_URL in .env.local)
const API_BASE_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:8000';

// --- Startup Logging ---
console.log('>>> [API/Chat] Route Initialized <<<');
console.log(`    Model:    ${MODEL_NAME}`);
console.log(`    Base URL: ${process.env.OPENAI_BASE_URL || 'Default'}`);
console.log(`    Backend:  ${API_BASE_URL}`);
console.log('>>> ---------------------------- <<<');

export const maxDuration = 30;

// Helper to extract text from UIMessage (AI SDK v6 Best Practice)
function getTextFromUIMessage(message: UIMessage): string {
    return (message.parts || [])
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('');
}

// Helper to sanitize and validate URLs (Fix for "Invalid video URL" 400 errors)
function extractUrl(text: string): string | null {
    if (!text || typeof text !== 'string' || text === 'undefined' || text === 'null') return null;
    // Extract first valid http/https URL, ignoring surrounding markdown or whitespace
    const match = text.match(/(https?:\/\/[^\s<>"')\]]+)/);
    return match ? match[0] : null;
}

export async function POST(req: Request) {
    try {
        // Parse request body - V6 DefaultChatTransport sends { message, threadId, taskId } in body
        const jsonBody = await req.json();
        console.log('[API/Chat] Request Body:', JSON.stringify(jsonBody, null, 2));

        const { message, threadId, taskId: bodyTaskId } = jsonBody;

        console.log(`[API/Chat] Incoming Request - Thread: ${threadId}, Task: ${bodyTaskId}`);

        // Fallback for taskId if passed via URL (legacy support)
        const url = new URL(req.url);
        const queryTaskId = url.searchParams.get('taskId');
        const taskId = bodyTaskId || queryTaskId;

        console.log(`[API/Chat] Resolved TaskID: ${taskId}`);

        // Initialize Supabase client
        const supabase = await createClient();

        // Verify authentication using getUser() (Secure)
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.error('[API/Chat] Auth Error:', authError);
            return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get session for access token (needed for external API calls)
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;

        // 1. Load Conversation History
        let messages: UIMessage[] = [];
        if (threadId) {
            // Ensure thread exists or create it
            const { data: thread, error: threadError } = await supabase
                .from('chat_threads')
                .select('id')
                .eq('id', threadId)
                .single();

            if (threadError && threadError.code !== 'PGRST116') { // PGRST116 is "not found"
                console.error('[API/Chat] Thread lookup error:', threadError);
            }

            if (!thread) {
                console.log('[API/Chat] Creating new thread:', threadId);
                // Auto-create thread if missing (Client-side ID generation case)
                const { error: createError } = await supabase.from('chat_threads').insert({
                    id: threadId,
                    user_id: user.id,
                    title: 'New Chat',
                });
                if (createError) console.error('[API/Chat] Thread creation failed:', createError);
            }

            const { data: dbMessages, error: msgError } = await supabase
                .from('chat_messages')
                .select('*')

                .eq('thread_id', threadId)
                .order('created_at', { ascending: true });

            if (msgError) console.error('[API/Chat] Message fetch failed:', msgError);

            if (dbMessages && dbMessages.length > 0) {
                messages = dbMessages.map((msg: any) => {
                    // Construct UIMessage from DB
                    // DB 'content' is JSONB (array of parts)
                    return {
                        id: msg.id,
                        role: msg.role,
                        // content: '', // V6 prefers parts - REMOVED for strict type safety
                        parts: Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: JSON.stringify(msg.content) }],
                        metadata: {
                            createdAt: new Date(msg.created_at)
                        }
                    } as UIMessage;
                });
            }
        }

        // Append the new incoming message
        if (message) {
            // Fix: Ensure message has 'parts' for convertToModelMessages compatibility
            // The error "Cannot read properties of undefined (reading 'map')" suggests it expects parts.
            if (!message.parts && typeof message.content === 'string') {
                message.parts = [{ type: 'text', text: message.content }];
            }
            messages.push(message);
        } else {
            console.warn('[API/Chat] No new message received in request body');
        }

        console.log(`[API/Chat] Processing ${messages.length} messages for thread ${threadId}`);

        // 2. Build Context (RAG)
        let context = '';

        if (taskId && taskId !== '00000000-0000-0000-0000-000000000000') {
            // ... (RAG Logic remains same, omitting detailed logs for brevity unless needed) ...
            const { data: task } = await supabase
                .from('tasks')
                .select('video_title, video_url, status, progress')
                .eq('id', taskId)
                .single();

            const { data: outputs } = await supabase
                .from('task_outputs')
                .select('kind, content, status')
                .eq('task_id', taskId)
                .in('kind', ['script', 'summary', 'summary_source']);

            const completedOutputs = outputs?.filter(o => o.status === 'completed') || [];

            if (task) {
                console.log(`[API/Chat] Task Found: ${task.video_title} (${task.status})`);
                const contextParts: string[] = [];
                if (task.video_title) contextParts.push(`Video Title: ${task.video_title}`);
                if (task.video_url) contextParts.push(`Video URL: ${task.video_url}`);
                if (task.status) contextParts.push(`Task Status: ${task.status} (${task.progress || 0}%)`);

                if (completedOutputs.length > 0) {
                    console.log(`[API/Chat] Found ${completedOutputs.length} completed outputs`);
                    const summary = completedOutputs.find(o => o.kind === 'summary');
                    const summarySource = completedOutputs.find(o => o.kind === 'summary_source');
                    const script = completedOutputs.find(o => o.kind === 'script');

                    const summaryContent = summary?.content || summarySource?.content || '';
                    const scriptContent = script?.content || '';

                    if (summaryContent) {
                        contextParts.push(`## Summary\n${summaryContent}`);
                    }
                    if (scriptContent) {
                        const truncatedScript = scriptContent.length > 8000
                            ? scriptContent.slice(0, 8000) + '\n\n[Transcript truncated...]'
                            : scriptContent;
                        contextParts.push(`## Transcript\n${truncatedScript}`);
                    }
                } else {
                    console.log('[API/Chat] No completed outputs found for this task');
                }
                context = contextParts.join('\n\n');
            } else {
                console.warn(`[API/Chat] Task ${taskId} not found in DB`);
            }
        }

        // 3. Build System Prompt
        let systemPrompt = `You are VibeDigest Assistant, an AI helper for video content analysis.

IMPORTANT: You MUST use tools proactively to provide accurate, up-to-date information. 

When a taskId is provided:
- ALWAYS call get_task_status first to check current progress
- If processing is complete, call get_task_outputs to retrieve the transcript and summary
- Use this real data to answer questions about the video content

When users provide video URLs:
- Use preview_video to show them what will be processed. Pass ONLY the raw URL string (no markdown, no XML tags).
- Use create_task if they want to proceed with processing.
- If you do not have a valid URL, DO NOT call these tools with "undefined" or placeholder strings. Ask the user for the URL first.

Your available tools:
- get_task_status: Check current processing status and progress
- get_task_outputs: Retrieve transcripts, summaries, and other processed content
- create_task: Start processing a new video URL
- preview_video: Get video metadata (title, thumbnail, duration) without full processing

Never make up information about video content. Always use tools to get real data before answering.`;

        if (context) {
            systemPrompt += `\n\nCURRENT VIDEO CONTEXT:\n${context}\n\nYou can use the above context to answer questions, but also use tools to get the latest status if needed.`;
        } else if (taskId && taskId !== '00000000-0000-0000-0000-000000000000') {
            systemPrompt += `\n\nCURRENT TASK: ${taskId}\nThe user is asking about a specific task. Use get_task_status to check progress, then get_task_outputs if completed.`;
        } else {
            systemPrompt += `\n\nNo specific task context. Use tools when users mention videos or ask about processing status.`;
        }

        // 4. Generate Response
        console.log('[API/Chat] Converting to model messages...');
        const coreMessages = await convertToModelMessages(messages);
        console.log('[API/Chat] Core messages count:', coreMessages.length);

        console.log('[API/Chat] Starting streamText...');
        const result = streamText({
            model: openai.chat(MODEL_NAME),
            system: systemPrompt,
            messages: coreMessages,
            stopWhen: stepCountIs(5), // V6 helper
            toolChoice: 'auto',
            tools: {
                // ... (Tools remain same) ...
                get_task_status: tool({
                    description: "Get the current processing status and progress of a video task",
                    parameters: z.object({
                        taskId: z.string().describe("The ID of the task to check"),
                    }) as any,
                    execute: async (args: any) => {
                        const { taskId } = args;
                        const { data, error } = await supabase
                            .from('tasks')
                            .select('*')
                            .eq('id', taskId)
                            .single();

                        if (error || !data) {
                            return { error: 'Task not found', taskId };
                        }
                        if (data.user_id !== user?.id && !data.is_demo) {
                            return { error: 'Access denied', taskId };
                        }
                        return {
                            taskId: data.id,
                            status: data.status,
                            progress: data.progress,
                            video_title: data.video_title,
                            thumbnail_url: data.thumbnail_url,
                            video_url: data.video_url,
                            error_message: data.error_message,
                            created_at: data.created_at,
                            updated_at: data.updated_at
                        };
                    },
                }),
                get_task_outputs: tool({
                    description: "Get the processed content (transcript, summary) for a specific task",
                    parameters: z.object({
                        taskId: z.string().describe("The ID of the task"),
                        kinds: z.array(z.enum(['script', 'summary', 'summary_source', 'audio'])).optional()
                            .describe("Specific output kinds to retrieve. If not provided, returns all completed outputs."),
                    }) as any,
                    execute: async (args: any) => {
                        const { taskId, kinds } = args;
                        const { data: task, error: taskError } = await supabase
                            .from('tasks')
                            .select('user_id, is_demo')
                            .eq('id', taskId)
                            .single();

                        if (taskError || !task) {
                            return { error: 'Task not found', taskId };
                        }
                        if (task.user_id !== user?.id && !task.is_demo) {
                            return { error: 'Access denied', taskId };
                        }

                        let query = supabase
                            .from('task_outputs')
                            .select('*')
                            .eq('task_id', taskId)
                            .eq('status', 'completed');

                        if (kinds && kinds.length > 0) {
                            query = query.in('kind', kinds);
                        }

                        const { data, error } = await query;
                        if (error) {
                            return { error: 'Failed to fetch outputs', taskId, details: error.message };
                        }
                        return {
                            taskId,
                            outputs: data || [],
                            count: data?.length || 0,
                        };
                    },
                }),
                create_task: tool({
                    description: "Start processing a new video URL (transcribe and summarize)",
                    parameters: z.object({
                        video_url: z.string().url().describe("The video URL to process"),
                        summaryLanguage: z.string().default('zh').describe("Target language for summary (default: zh)"),
                    }) as any,
                    execute: async (args: any) => {
                        console.log('[API/Chat] create_task args:', JSON.stringify(args));
                        // Support video_url (schema), videoUrl (legacy/LLM hallucination), and url (old schema)
                        const rawUrl = args.video_url || args.videoUrl || args.url;
                        const summaryLanguage = args.summaryLanguage || 'zh';

                        const cleanUrl = extractUrl(rawUrl);
                        if (!cleanUrl) {
                            console.error('[API/Chat] Invalid URL in create_task:', JSON.stringify(args));
                            return { error: "No valid URL found in input. Please provide a valid YouTube URL." };
                        }

                        if (!user?.id) {
                            return { error: 'Authentication required' };
                        }
                        try {
                            const response = await fetch(`${API_BASE_URL}/api/process-video`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded',
                                    'Authorization': `Bearer ${accessToken}`,
                                },
                                body: new URLSearchParams({
                                    video_url: cleanUrl,
                                    summary_language: summaryLanguage,
                                }),
                            });
                            const data = await response.json();
                            if (!response.ok) {
                                return { error: 'Failed to create task', details: data.detail || 'Unknown error', status: response.status };
                            }
                            return {
                                taskId: data.task_id,
                                status: 'started',
                                message: data.message || 'Task created successfully',
                                videoUrl: cleanUrl,
                                summaryLanguage,
                            };
                        } catch (error) {
                            return { error: 'Failed to create task', details: error instanceof Error ? error.message : 'Unknown error' };
                        }
                    },
                }),
                preview_video: tool({
                    description: "Get video metadata (title, thumbnail, duration) without processing the video",
                    parameters: z.object({
                        video_url: z.string().describe("The video URL to preview"),
                    }),
                    // @ts-ignore
                    execute: async (args: any) => {
                        console.log('[API/Chat] preview_video args:', JSON.stringify(args));
                        // Support video_url (schema), videoUrl (legacy/LLM hallucination), and url (old schema)
                        const rawUrl = args.video_url || args.videoUrl || args.url;
                        
                        const cleanUrl = extractUrl(rawUrl);
                        if (!cleanUrl) {
                            console.error('[API/Chat] Invalid URL in preview_video:', JSON.stringify(args));
                            return { error: "No valid URL found in input. Please provide a valid YouTube URL." };
                        }

                        try {
                            const response = await fetch(`${API_BASE_URL}/api/preview-video`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded',
                                    'Authorization': `Bearer ${accessToken}`,
                                },
                                body: new URLSearchParams({ url: cleanUrl }),
                            });
                            const data = await response.json();
                            if (!response.ok) {
                                return { error: 'Failed to preview video', details: data.detail || 'Unknown error', status: response.status };
                            }
                            return data;
                        } catch (error) {
                            return { error: 'Failed to preview video', details: error instanceof Error ? error.message : 'Unknown error' };
                        }
                    },
                }),
            },
        });

        // 5. Consume stream to ensure saving even if client disconnects
        result.consumeStream();

        // 6. Return response with persistence hook
        return result.toUIMessageStreamResponse({
            // V6 Persistence: Pass original messages so onFinish has full context
            originalMessages: messages,
            // V6 Persistence: Generate consistent IDs on server
            generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),

            onFinish: async ({ messages: finalMessages }) => {
                try {
                    console.log(`[API/Chat] onFinish called. Final messages count: ${finalMessages.length}`);
                    if (!threadId) {
                        console.warn('[API/Chat] No threadId in onFinish, skipping persistence.');
                        return;
                    }

                    // Robust Persistence: Upsert messages that don't exist
                    let savedCount = 0;

                    for (const msg of finalMessages) {
                        const { data: exists } = await supabase.from('chat_messages').select('id').eq('id', msg.id).single();
                        if (exists) continue;

                        const { error: insertError } = await supabase.from('chat_messages').insert({
                            id: msg.id,
                            thread_id: threadId,
                            role: msg.role,
                            content: msg.parts,
                            created_at: (msg.metadata as any)?.createdAt?.toISOString() || new Date().toISOString()
                        });

                        if (insertError) {
                            console.error('[API/Chat] Failed to save message:', msg.id, insertError);
                        } else {
                            savedCount++;
                        }
                    }
                    console.log(`[API/Chat] Saved ${savedCount} new messages to thread ${threadId}`);

                    await supabase.from('chat_threads')
                        .update({ updated_at: new Date().toISOString() })
                        .eq('id', threadId);

                    // Title Gen logic
                    if (messages.length <= 1 && message) {
                        const assistantMsg = finalMessages.find(m => m.role === 'assistant');
                        const assistantText = assistantMsg ? getTextFromUIMessage(assistantMsg) : '';

                        if (assistantText) {
                            try {
                                const { text: title } = await generateText({
                                    model: openai.chat(MODEL_NAME),
                                    system: 'Generate a very concise title (3-6 words) for this chat conversation based on the first message. Do not use quotes.',
                                    prompt: `User message: ${getTextFromUIMessage(message)}\nAssistant response: ${assistantText}`,
                                });

                                if (title) {
                                    await supabase
                                        .from('chat_threads')
                                        .update({ title: title.trim() })
                                        .eq('id', threadId);
                                }
                            } catch (e) {
                                console.error('[API/Chat] Failed to generate title:', e);
                            }
                        }
                    }
                } catch (persistError) {
                    console.error('[API/Chat] Persistence Error in onFinish:', persistError);
                }
            },
        });
    } catch (error: any) {
        console.error('[API/Chat] Fatal Error:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            details: error?.message || String(error),
            stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
