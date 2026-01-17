import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToCoreMessages, generateText, Message } from 'ai';
import { createClient } from '@/lib/supabase/server';

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
    const { messages, taskId, threadId } = body as {
        messages: Message[];
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
    console.log('[API /chat] taskId:', taskId, 'threadId:', threadId);
    
    if (taskId && taskId !== '00000000-0000-0000-0000-000000000000') {
        // Fetch task info first to get video title/url
        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('video_title, video_url')
            .eq('id', taskId)
            .single();
        
        console.log('[API /chat] Task query result:', { task, taskError });

        // Fetch relevant outputs - note: kind is 'script' not 'transcription'
        const { data: outputs, error: outputsError } = await supabase
            .from('task_outputs')
            .select('kind, content, status')
            .eq('task_id', taskId)
            .in('kind', ['script', 'summary', 'summary_source']);
        
        console.log('[API /chat] Outputs query result:', { 
            count: outputs?.length, 
            kinds: outputs?.map(o => `${o.kind}:${o.status}`),
            outputsError 
        });

        // Filter to completed only
        const completedOutputs = outputs?.filter(o => o.status === 'completed') || [];
        console.log('[API /chat] Completed outputs:', completedOutputs.length);

        if (completedOutputs.length > 0) {
            const summary = completedOutputs.find((o) => o.kind === 'summary');
            const summarySource = completedOutputs.find((o) => o.kind === 'summary_source');
            const script = completedOutputs.find((o) => o.kind === 'script');
            
            // Build context: prefer summary, then summary_source, then script
            const summaryContent = summary?.content || summarySource?.content || '';
            const scriptContent = script?.content || '';
            
            console.log('[API /chat] Context sizes:', {
                summaryLen: summaryContent?.length || 0,
                scriptLen: scriptContent?.length || 0
            });
            
            // Include both summary and transcript for better context
            const contextParts: string[] = [];
            if (task?.video_title) {
                contextParts.push(`Video Title: ${task.video_title}`);
            }
            if (task?.video_url) {
                contextParts.push(`Video URL: ${task.video_url}`);
            }
            if (summaryContent) {
                contextParts.push(`## Summary\n${summaryContent}`);
            }
            if (scriptContent) {
                // Truncate script if too long (keep first 8000 chars)
                const truncatedScript = scriptContent.length > 8000 
                    ? scriptContent.slice(0, 8000) + '\n\n[Transcript truncated...]' 
                    : scriptContent;
                contextParts.push(`## Transcript\n${truncatedScript}`);
            }
            
            context = contextParts.join('\n\n');
        }
    }

    // 5. Build system prompt with context
    let systemPrompt: string;
    if (context) {
        systemPrompt = `You are VibeDigest Assistant, an AI helper for video content analysis.
Your role is to answer questions about the video content provided below.
Be concise, helpful, and accurate. Base your answers strictly on the provided context.

${context}`;
        console.log('[API /chat] Using context-based prompt, context length:', context.length);
    } else if (taskId && taskId !== '00000000-0000-0000-0000-000000000000') {
        // Task exists but no outputs yet - video is being processed
        systemPrompt = `You are VibeDigest Assistant, an AI helper for video content analysis.

⚠️ IMPORTANT: This video is still being processed. The transcript and summary are not available yet.
Please inform the user that they should wait for the video processing to complete before asking questions about the content.
You can answer general questions, but cannot provide information about the video content until processing is finished.`;
        console.log('[API /chat] Using processing-mode prompt (no completed outputs yet)');
    } else {
        // Standalone chat mode - no video context
        systemPrompt = `You are VibeDigest Assistant, an AI helper.
You are in standalone chat mode without any specific video context.
Answer the user's questions helpfully and accurately.`;
        console.log('[API /chat] Using standalone prompt (no taskId)');
    }

    // 6. Extract latest user message content for saving
    const latestUserMessage = messages.filter((m) => m.role === 'user').pop();
    
    // 7. Save user message to DB (async, don't block stream) - only if threadId provided
    if (threadId && latestUserMessage) {
        if (latestUserMessage.content) {
            // FIX: await to ensure persistence
            await supabase
                .from('chat_messages')
                .insert({
                    thread_id: threadId,
                    role: 'user',
                    content: latestUserMessage.content,
                });

            await supabase
                .from('chat_threads')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', threadId);
        }
    }

    // 8. Stream response using AI SDK v6
    const coreMessages = convertToCoreMessages(messages);
    const result = streamText({
        model: openai.chat(MODEL_NAME),
        system: systemPrompt,
        messages: coreMessages,
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
                            prompt: `User message: ${latestUserMessage.content}\nAssistant response: ${text}`,
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
    return result.toDataStreamResponse();
}
