import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, generateText, UIMessage, tool, createIdGenerator, stepCountIs } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const AI_SDK_DEBUG = process.env.AI_SDK_DEBUG === '1';

const debugFetch: typeof fetch = async (input, init) => {
    if (AI_SDK_DEBUG) {
        try {
            const url = typeof input === 'string' ? input : input.toString();
            console.log('[AI SDK] Request URL:', url);
            if (init?.body) {
                console.log('[AI SDK] Request body:', init.body.toString());
            }
        } catch (e) {
            console.warn('[AI SDK] Failed to log request:', e);
        }
    }
    const response = await fetch(input, init);
    if (AI_SDK_DEBUG && !response.ok) {
        try {
            const text = await response.clone().text();
            console.log('[AI SDK] Response status:', response.status);
            console.log('[AI SDK] Response body:', text);
        } catch (e) {
            console.warn('[AI SDK] Failed to log response:', e);
        }
    }
    return response;
};

// Create OpenAI-compatible provider with custom baseURL (for local LLM)
const openai = createOpenAI({
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
    fetch: AI_SDK_DEBUG ? debugFetch : undefined,
});

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
type ModelTier = 'smart' | 'fast';
const cachedModelNameByTier: Record<ModelTier, string | null> = {
    smart: null,
    fast: null
};
const cachedModelAtByTier: Record<ModelTier, number> = {
    smart: 0,
    fast: 0
};

const SHORT_QUERY_CHAR_LIMIT = 200;
const INVALID_TASK_ID = '00000000-0000-0000-0000-000000000000';

// Backend API URL (must match BACKEND_API_URL in .env.local)
const API_BASE_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:8000';

// AI SDK v6: Use Zod schemas for tool parameters
const taskStatusSchema = z.object({
    taskId: z.string().describe('The ID of the task to check'),
});

const taskOutputsSchema = z.object({
    taskId: z.string().describe('The ID of the task'),
    kinds: z.array(z.enum(['script', 'summary', 'audio']))
        .optional()
        .describe('Specific output kinds to retrieve. If not provided, returns all completed outputs.'),
});

const createTaskSchema = z.object({
    video_url: z.string().describe('REQUIRED: Complete YouTube URL. Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
});

const previewVideoSchema = z.object({
    video_url: z.string().describe('REQUIRED: Complete YouTube URL. Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
});

// --- Startup Logging ---
console.log('>>> [API/Chat] Route Initialized <<<');
console.log(`    Model:    ${process.env.OPENAI_MODEL || 'dynamic (from backend)'}`);
console.log(`    Base URL: ${process.env.OPENAI_BASE_URL || 'Default'}`);
console.log(`    Backend:  ${API_BASE_URL}`);
console.log('>>> ---------------------------- <<<');

export const maxDuration = 30;

type ProviderDefaults = {
    fast?: string;
    smart?: string;
};

type ProviderEntry = {
    provider?: string;
    defaults?: ProviderDefaults;
};

type RequestPayload = {
    message?: UIMessage & { content?: string };
    threadId?: string;
    taskId?: string;
};

type ChatMessageRow = {
    id: string;
    role: UIMessage['role'];
    content: unknown;
    created_at: string;
};

type TextPart = {
    type: 'text';
    text: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isTextPart(part: unknown): part is TextPart {
    return (
        isRecord(part) &&
        part.type === 'text' &&
        typeof part.text === 'string'
    );
}

function getLegacyContent(message: UIMessage): string {
    const content = (message as { content?: unknown }).content;
    return typeof content === 'string' ? content : '';
}

function getMessageCreatedAtIso(message: UIMessage): string {
    const metadata = (message as { metadata?: { createdAt?: unknown } }).metadata;
    const createdAt = metadata?.createdAt;
    if (createdAt instanceof Date) return createdAt.toISOString();
    if (typeof createdAt === 'string') {
        const parsed = new Date(createdAt);
        if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    return new Date().toISOString();
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return String(error);
}

function getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) return error.stack;
    return undefined;
}

function isUsableTaskId(taskId: string | null | undefined): taskId is string {
    return typeof taskId === 'string' && taskId.length > 0 && taskId !== INVALID_TASK_ID;
}

function extractTaskIdFromCreateTaskMessages(messages: UIMessage[]): string | null {
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (!Array.isArray(message.parts)) continue;

        for (const part of message.parts) {
            if (!isRecord(part) || typeof part.type !== 'string') continue;

            const isCreateTaskTool =
                (part.type === 'dynamic-tool' && part.toolName === 'create_task') ||
                (part.type.startsWith('tool-') && part.type.replace('tool-', '') === 'create_task');

            if (!isCreateTaskTool) continue;

            const output = isRecord(part.output) ? part.output : null;
            const taskId = output && typeof output.taskId === 'string' ? output.taskId : null;
            if (isUsableTaskId(taskId)) {
                return taskId;
            }
        }
    }
    return null;
}

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

    // 1. Extract first valid http/https URL, ignoring surrounding markdown or whitespace
    const match = text.match(/(https?:\/\/[^\s<>"')\]]+)/);
    if (match) return match[0];

    // 2. Fallback: Check if it is a raw YouTube Video ID (11 chars)
    // Only accept if the text is JUST the ID (trimmed), to avoid matching random 11-char words in sentences
    const idMatch = text.trim().match(/^([a-zA-Z0-9_-]{11})$/);
    if (idMatch) {
        return `https://www.youtube.com/watch?v=${idMatch[1]}`;
    }

    return null;
}

// Helper to find the most recent URL in the conversation history
function findLastUrlInMessages(messages: UIMessage[]): string | null {
    // Search backwards from the most recent message
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'user') {
            // Check parts
            if (msg.parts) {
                for (const part of msg.parts) {
                    if (part.type === 'text') {
                        const url = extractUrl(part.text);
                        if (url) return url;
                    }
                }
            }
            // Check legacy content string
            const legacyContent = getLegacyContent(msg);
            if (legacyContent) {
                const url = extractUrl(legacyContent);
                if (url) return url;
            }
        }
    }
    return null;
}

async function resolveModelName(tier: ModelTier): Promise<string> {
    if (process.env.OPENAI_MODEL) return process.env.OPENAI_MODEL;

    const now = Date.now();
    const cachedName = cachedModelNameByTier[tier];
    const cachedAt = cachedModelAtByTier[tier];
    if (cachedName && now - cachedAt < MODEL_CACHE_TTL_MS) {
        return cachedName;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/models/providers`);
        if (!response.ok) {
            throw new Error(`Failed to load providers (${response.status})`);
        }
        const data: unknown = await response.json();
        const dataRecord = isRecord(data) ? data : {};
        const activeProvider =
            typeof dataRecord.active_provider === 'string'
                ? dataRecord.active_provider
                : undefined;

        const providersRaw = Array.isArray(dataRecord.providers) ? dataRecord.providers : [];
        const providers: ProviderEntry[] = providersRaw
            .filter(isRecord)
            .map((provider) => {
                const defaultsRaw = isRecord(provider.defaults) ? provider.defaults : undefined;
                return {
                    provider: typeof provider.provider === 'string' ? provider.provider : undefined,
                    defaults: defaultsRaw
                        ? {
                            fast: typeof defaultsRaw.fast === 'string' ? defaultsRaw.fast : undefined,
                            smart: typeof defaultsRaw.smart === 'string' ? defaultsRaw.smart : undefined,
                        }
                        : undefined,
                };
            });
        const selected = providers.find((p) => p.provider === activeProvider) || providers[0];
        const defaults = selected?.defaults || {};
        const fallback = tier === 'fast' ? 'gpt-4o-mini' : 'gpt-4o';
        const modelName = (tier === 'fast' ? defaults.fast : defaults.smart) || fallback;

        cachedModelNameByTier[tier] = modelName;
        cachedModelAtByTier[tier] = now;
        return modelName;
    } catch (error) {
        console.warn('[API/Chat] Failed to resolve model from backend:', error);
        return tier === 'fast' ? 'gpt-4o-mini' : 'gpt-4o';
    }
}

export async function POST(req: Request) {
    try {
        // Parse request body - V6 DefaultChatTransport sends { message, threadId, taskId } in body
        const jsonBody = (await req.json()) as RequestPayload;
        console.log('[API/Chat] Request Body:', JSON.stringify(jsonBody, null, 2));

        const { message, threadId, taskId: bodyTaskId } = jsonBody;

        console.log(`[API/Chat] Incoming Request - Thread: ${threadId}, Task: ${bodyTaskId}`);

        // Fallback for taskId if passed via URL (legacy support)
        const url = new URL(req.url);
        const queryTaskId = url.searchParams.get('taskId');
        const taskId = bodyTaskId || queryTaskId;
        const requestTaskId = isUsableTaskId(taskId) ? taskId : null;

        console.log(`[API/Chat] Resolved TaskID: ${taskId}`);

        // Initialize Supabase client
        const supabase = await createClient();

        // Verify authentication using getUser() (Secure)
        // Bypass for E2E testing
        let user;
        let accessToken;

        if (process.env.NEXT_PUBLIC_E2E_MOCK === '1') {
            user = { id: 'test-user-id', email: 'tester@vibedigest.io' };
            accessToken = 'mock-access-token';
        } else {
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
            if (authError || !authUser) {
                console.error('[API/Chat] Auth Error:', authError);
                return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            user = authUser;
            const { data: { session } } = await supabase.auth.getSession();
            accessToken = session?.access_token;
        }

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
                const threadInsertPayload: Record<string, unknown> = {
                    id: threadId,
                    user_id: user.id,
                    title: 'New Chat',
                };
                if (requestTaskId) {
                    threadInsertPayload.task_id = requestTaskId;
                }
                const { error: createError } = await supabase.from('chat_threads').insert(threadInsertPayload);
                if (createError) console.error('[API/Chat] Thread creation failed:', createError);
            }

            const { data: dbMessages, error: msgError } = await supabase
                .from('chat_messages')
                .select('*')

                .eq('thread_id', threadId)
                .order('created_at', { ascending: true });

            if (msgError) console.error('[API/Chat] Message fetch failed:', msgError);

            if (dbMessages && dbMessages.length > 0) {
                messages = (dbMessages as ChatMessageRow[]).map((msg) => {
                    // Construct UIMessage from DB
                    // DB 'content' is JSONB (array of parts)
                    const parts = Array.isArray(msg.content)
                        ? msg.content
                        : [{ type: 'text', text: JSON.stringify(msg.content) }];
                    return {
                        id: msg.id,
                        role: msg.role,
                        // content: '', // V6 prefers parts - REMOVED for strict type safety
                        parts: parts as UIMessage['parts'],
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
                .in('kind', ['summary']);

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

                    const summaryContent = summary?.content || '';

                    if (summaryContent) {
                        contextParts.push(`## Summary\n${summaryContent}`);
                    }
                } else {
                    console.log('[API/Chat] No completed outputs found for this task');
                }
                context = contextParts.join('\n\n');
            } else {
                console.warn(`[API/Chat] Task ${taskId} not found in DB`);
            }
        }

        const messageText = message
            ? (getTextFromUIMessage(message) || getLegacyContent(message))
            : '';
        const detectedUrl = extractUrl(messageText || '');
        const allowVideoTools = Boolean(detectedUrl);
        const isShortFollowup = Boolean(
            taskId &&
            !detectedUrl &&
            messageText.trim().length > 0 &&
            messageText.trim().length <= SHORT_QUERY_CHAR_LIMIT
        );
        const modelTier: ModelTier = isShortFollowup ? 'fast' : 'smart';
        const modelName = await resolveModelName(modelTier);

        // 3. Build System Prompt
        let systemPrompt = `You are VibeDigest Assistant, an AI helper for video content analysis.

IMPORTANT: You MUST use tools proactively to provide accurate, up-to-date information. 

When a taskId is provided:
- ONLY call get_task_status if the user asks about status/progress/completion (e.g. "status", "progress", "done?", "still processing?")
- If you need transcript/summary content and it is NOT already present in CURRENT VIDEO CONTEXT, call get_task_outputs
- If the user is asking a general question (e.g. translation, clarification) and CURRENT VIDEO CONTEXT already contains the needed info, answer directly without calling tools
- If the user asks for examples/quotes/verbatim wording ("举例", "原文", "引用", "quote", "具体说法") and the summary evidence is insufficient, call get_task_outputs with kinds: ["script"] to cite the transcript

When users provide video URLs in their latest message:
- ALWAYS call preview_video first to show the video metadata
- THEN call create_task to start processing immediately (no confirmation needed)
- THEN call get_task_status to display the progress plan card
- If you do not have a valid URL in the latest user message, DO NOT call preview_video/create_task. Ask the user for the URL first.

=== CRITICAL: TOOL PARAMETER FORMAT ===
For preview_video, use EXACTLY: {"video_url": "https://www.youtube.com/watch?v=VIDEO_ID"}
For create_task, use EXACTLY: {"video_url": "https://www.youtube.com/watch?v=VIDEO_ID"}

WRONG (NEVER USE):
- {"reason": "..."} - use "video_url" not "reason"
- {"url": "..."} - use "video_url" not "url"
- {"query": "..."} - use "video_url" not "query"
=== END CRITICAL ===
`;

        systemPrompt += allowVideoTools
            ? `\n\nYour available tools:\n- get_task_status: Check current processing status and progress\n- get_task_outputs: Retrieve transcripts, summaries, and other processed content\n- create_task: Start processing a new video URL\n- preview_video: Get video metadata (title, thumbnail, duration) without full processing`
            : `\n\nYour available tools:\n- get_task_status: Check current processing status and progress\n- get_task_outputs: Retrieve transcripts, summaries, and other processed content`;

        systemPrompt += `\n\nNever make up information about video content. Always use tools to get real data before answering.`;

        if (context) {
            systemPrompt += `\n\nCURRENT VIDEO CONTEXT:\n${context}\n\nYou can use the above context to answer questions, but also use tools to get the latest status if needed.`;
        } else if (taskId && taskId !== '00000000-0000-0000-0000-000000000000') {
            systemPrompt += `\n\nCURRENT TASK: ${taskId}\nThe user is asking about a specific task. Use get_task_status to check progress, then get_task_outputs if completed.`;
        } else {
            systemPrompt += `\n\nNo specific task context. Use tools when users mention videos or ask about processing status.`;
        }

        if (detectedUrl) {
            systemPrompt += `\n\nAUTO-PROCESS: The user provided a valid video URL (${detectedUrl}). You MUST call preview_video with that URL, then create_task, then get_task_status. Do not ask for confirmation.`;
        }

        let previewCache: { url: string; title?: string; thumbnail?: string } | null = null;

        // 4. Generate Response
        console.log('[API/Chat] Converting to model messages...');
        const messagesForModel = messages
            .map((msg) => {
                const textParts = (msg.parts || []).filter((part) => isTextPart(part));
                if (!textParts.length) return null;
                return { ...msg, parts: textParts } as UIMessage;
            })
            .filter((msg): msg is UIMessage => Boolean(msg));
        const coreMessages = await convertToModelMessages(messagesForModel);
        console.log('[API/Chat] Core messages count:', coreMessages.length);

        console.log('[API/Chat] Starting streamText...');
        const tools: Record<string, unknown> = {
            get_task_status: tool({
                description: "Get the current processing status and progress of a video task",
                inputSchema: taskStatusSchema,
                execute: async ({ taskId }: z.infer<typeof taskStatusSchema>) => {
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
                    const normalizedTaskUrl = extractUrl(data.video_url || '')
                    const canUsePreview = Boolean(
                        previewCache && normalizedTaskUrl && previewCache.url === normalizedTaskUrl
                    )
                    const previewTitle = canUsePreview ? previewCache?.title : undefined
                    const previewThumbnail = canUsePreview ? previewCache?.thumbnail : undefined
                    const normalizedTitle = data.video_title && data.video_title !== 'Unknown'
                        ? data.video_title
                        : previewTitle

                    return {
                        taskId: data.id,
                        status: data.status,
                        progress: data.progress,
                        video_title: normalizedTitle,
                        thumbnail_url: data.thumbnail_url || previewThumbnail,
                        video_url: data.video_url,
                        error_message: data.error_message,
                        created_at: data.created_at,
                        updated_at: data.updated_at
                    };
                },
            }),
            get_task_outputs: tool({
                description: "Get the processed content (transcript, summary) for a specific task",
                inputSchema: taskOutputsSchema,
                execute: async ({ taskId, kinds }: z.infer<typeof taskOutputsSchema>) => {
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
        };

        if (allowVideoTools) {
            tools.create_task = tool({
                description: "Start video processing (transcribe+summarize). IMPORTANT: Pass URL in 'video_url' parameter ONLY.",
                inputSchema: createTaskSchema,
                execute: async (args: z.infer<typeof createTaskSchema>) => {
                    console.log('[API/Chat] create_task args:', JSON.stringify(args));

                    let fallbackSource: string | null = null;

                    // Zod schema ensures video_url is present - extract clean URL
                    let cleanUrl = extractUrl(args.video_url);

                    // Fallback: Look in conversation history if URL extraction failed
                    if (!cleanUrl) {
                         console.log('[API/Chat] No valid URL in args, checking history...');
                         cleanUrl = findLastUrlInMessages(messages);
                         if (cleanUrl) fallbackSource = 'message_history';
                    }

                    // Log fallback usage for monitoring
                    if (fallbackSource) {
                        console.warn(`[API/Chat] URL fallback: source=${fallbackSource}, tool=create_task, args=${JSON.stringify(args)}`);
                    }

                    if (!cleanUrl) {
                        console.error('[API/Chat] Invalid URL in create_task:', JSON.stringify(args));
                        return { error: "No valid URL found in input or history. Please provide a valid YouTube URL." };
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
                        };
                    } catch (error) {
                        return { error: 'Failed to create task', details: error instanceof Error ? error.message : 'Unknown error' };
                    }
                },
            });

            tools.preview_video = tool({
                description: "Fetch video metadata (title, thumbnail, duration). IMPORTANT: Pass URL in 'video_url' parameter ONLY.",
                inputSchema: previewVideoSchema,
                execute: async (args: z.infer<typeof previewVideoSchema>) => {
                    console.log('[API/Chat] preview_video args:', JSON.stringify(args));

                    let fallbackSource: string | null = null;

                    // Zod schema ensures video_url is present - extract clean URL
                    let cleanUrl = extractUrl(args.video_url);

                    // Fallback: Look in conversation history if URL extraction failed
                    if (!cleanUrl) {
                         console.log('[API/Chat] No valid URL in args, checking history...');
                         cleanUrl = findLastUrlInMessages(messages);
                         if (cleanUrl) fallbackSource = 'message_history';
                    }

                    // Log fallback usage for monitoring
                    if (fallbackSource) {
                        console.warn(`[API/Chat] URL fallback: source=${fallbackSource}, tool=preview_video, args=${JSON.stringify(args)}`);
                    }

                    if (!cleanUrl) {
                        console.error('[API/Chat] Invalid URL in preview_video:', JSON.stringify(args));
                        return { error: "No valid URL found in input or history. Please provide a valid YouTube URL." };
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
                        if (data?.title || data?.thumbnail) {
                            previewCache = {
                                url: cleanUrl,
                                title: data.title,
                                thumbnail: data.thumbnail
                            };
                        }
                        return data;
                    } catch (error) {
                        return { error: 'Failed to preview video', details: error instanceof Error ? error.message : 'Unknown error' };
                    }
                },
            });
        }

        const result = streamText({
            model: openai.chat(modelName),
            system: systemPrompt,
            messages: coreMessages,
            stopWhen: stepCountIs(5), // V6 helper
            tools: tools as Parameters<typeof streamText>[0]['tools'],
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
                            created_at: getMessageCreatedAtIso(msg)
                        });

                        if (insertError) {
                            console.error('[API/Chat] Failed to save message:', msg.id, insertError);
                        } else {
                            savedCount++;
                        }
                    }
                    console.log(`[API/Chat] Saved ${savedCount} new messages to thread ${threadId}`);

                    const createdTaskId = extractTaskIdFromCreateTaskMessages(finalMessages);
                    const taskIdToBind = createdTaskId || requestTaskId;
                    const threadUpdatePayload: Record<string, unknown> = {
                        updated_at: new Date().toISOString(),
                    };
                    if (taskIdToBind) {
                        threadUpdatePayload.task_id = taskIdToBind;
                    }

                    await supabase.from('chat_threads')
                        .update(threadUpdatePayload)
                        .eq('id', threadId);

                    // Title Gen logic
                    if (messages.length <= 1 && message) {
                        const assistantMsg = finalMessages.find(m => m.role === 'assistant');
                        const assistantText = assistantMsg ? getTextFromUIMessage(assistantMsg) : '';

                        if (assistantText) {
                            try {
                                const { text: title } = await generateText({
                                    model: openai.chat(modelName),
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
    } catch (error: unknown) {
        console.error('[API/Chat] Fatal Error:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            details: getErrorMessage(error),
            stack: process.env.NODE_ENV === 'development' ? getErrorStack(error) : undefined
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
