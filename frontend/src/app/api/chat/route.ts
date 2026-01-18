import { createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToCoreMessages, generateText, Message, tool } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Create OpenAI-compatible provider with custom baseURL (for local LLM)
const openai = createOpenAI({
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
});

// Model name from environment (default to gemini-3-flash for custom LLM)
const MODEL_NAME = process.env.OPENAI_MODEL || 'gemini-3-flash';

export const maxDuration = 30;

export async function POST(req: Request) {
    // Parse request body
    const body = await req.json();
    const messages = (body?.messages || []) as Message[];
    
    // Extract taskId from URL query parameter
    const url = new URL(req.url);
    const taskId = url.searchParams.get('taskId');
    const threadId = body?.threadId;

    // Validate messages
    if (!messages || messages.length === 0) {
        return new Response(JSON.stringify({ error: 'Missing required field: messages' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Initialize Supabase client
    const supabase = await createClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Build context from task data (RAG)
    let context = '';
    
    if (taskId && taskId !== '00000000-0000-0000-0000-000000000000') {
        // Fetch task metadata
        const { data: task } = await supabase
            .from('tasks')
            .select('video_title, video_url, status, progress')
            .eq('id', taskId)
            .single();

        // Fetch completed outputs
        const { data: outputs } = await supabase
            .from('task_outputs')
            .select('kind, content, status')
            .eq('task_id', taskId)
            .in('kind', ['script', 'summary', 'summary_source']);

        const completedOutputs = outputs?.filter(o => o.status === 'completed') || [];

        if (task) {
            const contextParts: string[] = [];
            
            if (task.video_title) contextParts.push(`Video Title: ${task.video_title}`);
            if (task.video_url) contextParts.push(`Video URL: ${task.video_url}`);
            if (task.status) contextParts.push(`Task Status: ${task.status} (${task.progress || 0}%)`);

            if (completedOutputs.length > 0) {
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
            }
            
            context = contextParts.join('\n\n');
        }
    }

    // Build system prompt
    let systemPrompt = `You are VibeDigest Assistant, an AI helper for video content analysis.

IMPORTANT: You MUST use tools proactively to provide accurate, up-to-date information. 

When a taskId is provided:
- ALWAYS call get_task_status first to check current progress
- If processing is complete, call get_task_outputs to retrieve the transcript and summary
- Use this real data to answer questions about the video content

When users provide video URLs:
- Use preview_video to show them what will be processed
- Use create_task if they want to proceed with processing

Your available tools:
- get_task_status: Check current processing status and progress
- get_task_outputs: Retrieve transcripts, summaries, and other processed content
- create_task: Start processing a new video URL
- preview_video: Get video metadata without full processing

Never make up information about video content. Always use tools to get real data before answering.`;
    
    if (context) {
        systemPrompt += `\n\nCURRENT VIDEO CONTEXT:\n${context}\n\nYou can use the above context to answer questions, but also use tools to get the latest status if needed.`;
    } else if (taskId && taskId !== '00000000-0000-0000-0000-000000000000') {
        systemPrompt += `\n\nCURRENT TASK: ${taskId}\nThe user is asking about a specific task. Use get_task_status to check progress, then get_task_outputs if completed.`;
    } else {
        systemPrompt += `\n\nNo specific task context. Use tools when users mention videos or ask about processing status.`;
    }

    // Save user message to database
    const latestUserMessage = messages.filter(m => m.role === 'user').pop();
    
    if (threadId && latestUserMessage?.content) {
        await supabase.from('chat_messages').insert({
            thread_id: threadId,
            role: 'user',
            content: latestUserMessage.content,
        });

        await supabase.from('chat_threads')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', threadId);
    }

    // Stream AI response with tools
    const coreMessages = convertToCoreMessages(messages);
    
    const result = streamText({
        model: openai.chat(MODEL_NAME),
        system: systemPrompt,
        messages: coreMessages,
        toolChoice: 'auto', // Let AI decide when to use tools
        experimental_toolCallTagging: true,
        tools: {
            get_task_status: tool({
                description: "Get the current processing status and progress of a video task",
                parameters: z.object({
                    taskId: z.string().describe("The ID of the task to check"),
                }),
                execute: async ({ taskId }) => {
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
                        updated_at: data.updated_at,
                    };
                },
            }),
            get_task_outputs: tool({
                description: "Get the processed content (transcript, summary) for a specific task",
                parameters: z.object({
                    taskId: z.string().describe("The ID of the task"),
                    kinds: z.array(z.enum(['script', 'summary', 'summary_source', 'audio'])).optional()
                        .describe("Specific output kinds to retrieve. If not provided, returns all completed outputs."),
                }),
                execute: async ({ taskId, kinds }) => {
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
                    videoUrl: z.string().url().describe("The video URL to process"),
                    summaryLanguage: z.string().default('zh').describe("Target language for summary (default: zh)"),
                }),
                execute: async ({ videoUrl, summaryLanguage }) => {
                    if (!user?.id) {
                        return { error: 'Authentication required' };
                    }
                    
                    try {
                        const authHeader = req.headers.get('authorization');
                        
                        const response = await fetch(`${process.env.BACKEND_URL}/api/process-video`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...(authHeader && { 'Authorization': authHeader }),
                            },
                            body: JSON.stringify({
                                video_url: videoUrl,
                                summary_language: summaryLanguage,
                            }),
                        });
                        
                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            return { 
                                error: 'Failed to create task', 
                                details: errorData.detail || 'Unknown error',
                                status: response.status 
                            };
                        }
                        
                        const data = await response.json();
                        
                        return {
                            taskId: data.task_id,
                            status: 'started',
                            message: data.message || 'Task created successfully',
                            videoUrl,
                            summaryLanguage,
                        };
                    } catch (error) {
                        return { 
                            error: 'Failed to create task', 
                            details: error instanceof Error ? error.message : 'Unknown error'
                        };
                    }
                },
            }),
            preview_video: tool({
                description: "Get video metadata (title, thumbnail, duration) without processing the video",
                parameters: z.object({
                    url: z.string().url().describe("The video URL to preview"),
                }),
                execute: async ({ url }) => {
                    try {
                        const authHeader = req.headers.get('authorization');
                        
                        const response = await fetch(`${process.env.BACKEND_URL}/api/preview-video`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                ...(authHeader && { 'Authorization': authHeader }),
                            },
                            body: new URLSearchParams({ url }),
                        });
                        
                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            return { 
                                error: 'Failed to preview video', 
                                details: errorData.detail || 'Unknown error',
                                status: response.status 
                            };
                        }
                        
                        return await response.json();
                    } catch (error) {
                        return { 
                            error: 'Failed to preview video', 
                            details: error instanceof Error ? error.message : 'Unknown error'
                        };
                    }
                },
            }),
        },
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
