import { z } from 'zod';
import { tool } from 'ai';
import { env } from '@/env';
import { extractUrl } from '../utils';
import type { ToolContext } from '../types';

const API_BASE_URL = env.BACKEND_API_URL || 'http://127.0.0.1:8000';

export const taskStatusSchema = z.object({
    taskId: z.string().describe('The ID of the task to check'),
});

export function createGetTaskStatusTool(ctx: ToolContext) {
    return tool({
        description: 'Get the current processing status and progress of a video task',
        inputSchema: taskStatusSchema,
        execute: async ({ taskId }: z.infer<typeof taskStatusSchema>) => {
            // 1. Try Direct Database Access (Fastest)
            const { data, error } = await ctx.supabase
                .from('tasks')
                .select('*')
                .eq('id', taskId)
                .single();

            if (data) {
                if (data.user_id !== ctx.user?.id && !data.is_demo) {
                    return { error: 'Access denied', taskId };
                }
                const normalizedTaskUrl = extractUrl(data.video_url || '');
                const canUsePreview = Boolean(
                    ctx.previewCache && normalizedTaskUrl && ctx.previewCache.url === normalizedTaskUrl
                );
                const previewTitle = canUsePreview ? ctx.previewCache?.title : undefined;
                const previewThumbnail = canUsePreview ? ctx.previewCache?.thumbnail : undefined;
                const normalizedTitle =
                    data.video_title && data.video_title !== 'Unknown'
                        ? data.video_title
                        : previewTitle;

                return {
                    taskId: data.id,
                    status: data.status,
                    progress: data.progress,
                    video_title: normalizedTitle,
                    thumbnail_url: data.thumbnail_url || previewThumbnail,
                    video_url: data.video_url,
                    error_message: data.error_message,
                    created_at: data.created_at,
                    updated_at: data.updated_at,
                };
            }

            // 2. Fallback: Try Backend API
            if (ctx.user?.id && ctx.accessToken) {
                try {
                    console.warn(`[API/Chat] Task ${taskId} not found in DB, trying Backend API fallback...`);
                    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/status`, {
                        headers: {
                            Authorization: `Bearer ${ctx.accessToken}`,
                        },
                    });

                    if (response.ok) {
                        const apiData = await response.json();
                        console.log(`[API/Chat] Task ${taskId} recovered via Backend API`);
                        return {
                            taskId: apiData.id,
                            status: apiData.status,
                            progress: apiData.progress,
                            video_title: apiData.video_title,
                            thumbnail_url: apiData.thumbnail_url,
                            video_url: apiData.video_url,
                            error_message: apiData.error,
                            created_at: apiData.created_at,
                            updated_at: apiData.updated_at,
                            source: 'backend_api_fallback',
                        };
                    }
                } catch (apiError) {
                    console.error(`[API/Chat] Backend API fallback failed for ${taskId}:`, apiError);
                }
            }

            return { error: 'Task not found', taskId };
        },
    });
}
