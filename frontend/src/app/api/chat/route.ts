import { createOpenAI } from '@ai-sdk/openai';
import { streamText, UIMessage, convertToModelMessages, generateText } from 'ai';
import { createClient } from '@/lib/supabase/server';

// Create OpenAI-compatible provider with custom baseURL (for local LLM)
// Create OpenAI-compatible provider with custom baseURL (for local LLM)
const openai = createOpenAI({
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
});

// Model name from environment (default to gemini-3-flash for custom LLM)
const MODEL_NAME = process.env.OPENAI_MODEL || 'gemini-3-flash';

export const maxDuration = 30;

export async function POST(req: Request) {
    // 1. Parse request body
    const body = await req.json();
    // AI SDK v6 useChat sends UIMessage[] format
    const { messages, taskId, threadId } = body as {
        messages: UIMessage[];
        taskId?: string;
        threadId?: string;
    };

    // Validate messages exist
    if (!messages || messages.length === 0) {
        console.error('[API /chat] Missing messages');
        return new Response(JSON.stringify({ error: 'Missing required field: messages' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 2. Initialize Supabase client (server-side)
    const supabase = await createClient();

    // 3. Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        console.error('[API /chat] Auth error:', authError);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 4. Fetch context from task_outputs (RAG) - only if taskId provided
    let context = '';
    if (taskId && taskId !== '00000000-0000-0000-0000-000000000000') {
        const { data: outputs } = await supabase
            .from('task_outputs')
            .select('kind, content')
            .eq('task_id', taskId)
            .in('kind', ['transcription', 'summary'])
            .eq('status', 'completed');

        if (outputs && outputs.length > 0) {
            const summary = outputs.find((o) => o.kind === 'summary');
            const transcription = outputs.find((o) => o.kind === 'transcription');
            context = summary?.content || transcription?.content || '';
        }
    }

    // 5. Build system prompt with context
    const systemPrompt = `You are VibeDigest Assistant, an AI helper for video content analysis.
Your role is to answer questions about the video content provided below.
Be concise, helpful, and accurate.

${context ? `## Video Context\n${context}` : '(No video context available yet.)'}`;

    // 6. Extract latest user message content for saving
    const latestUserMessage = messages.filter((m) => m.role === 'user').pop();
    const getTextContent = (msg: UIMessage): string => {
        if (msg.parts) {
            return msg.parts
                .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                .map((p) => p.text)
                .join('');
        }
        return '';
    };

    // 7. Save user message to DB (async, don't block stream) - only if threadId provided
    // 7. Save user message to DB (async, don't block stream) - only if threadId provided
    if (threadId && latestUserMessage) {
        const userContent = getTextContent(latestUserMessage);
        if (userContent) {
            // FIX: await to ensure persistence
            await supabase
                .from('chat_messages')
                .insert({
                    thread_id: threadId,
                    role: 'user',
                    content: userContent,
                });

            await supabase
                .from('chat_threads')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', threadId);
        }
    }

    // 8. Stream response using AI SDK v6
    // Use convertToModelMessages to properly convert UIMessage[] to model format
    // Use openai.chat() to use Chat Completions API instead of Responses API
    const modelMessages = await convertToModelMessages(messages);
    const result = streamText({
        model: openai.chat(MODEL_NAME),
        system: systemPrompt,
        messages: modelMessages,
        onFinish: async ({ text }) => {
            // Save assistant message to DB - only if threadId provided
            if (threadId && text) {
                await supabase.from('chat_messages').insert({
                    thread_id: threadId,
                    role: 'assistant',
                    content: text,
                });
                await supabase
                    .from('chat_threads')
                    .update({ updated_at: new Date().toISOString() })
                    .eq('id', threadId);

                // Generate Title for new conversations (first message)
                if (messages.length === 1 && latestUserMessage) {
                    try {
                        const { text: title } = await generateText({
                            model: openai.chat(MODEL_NAME),
                            system: 'Generate a very concise title (3-6 words) for this chat conversation based on the first message. Do not use quotes.',
                            prompt: `User message: ${getTextContent(latestUserMessage)}\nAssistant response: ${text}`,
                        });

                        if (title) {
                            await supabase
                                .from('chat_threads')
                                .update({ title: title.trim() })
                                .eq('id', threadId);
                        }
                    } catch (error) {
                        console.error('[API /chat] Failed to generate title:', error);
                    }
                }
            }
        },
    });

    // 9. Return AI SDK UI message stream response
    return result.toUIMessageStreamResponse();
}
