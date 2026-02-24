import { z } from 'zod';
import { tool } from 'ai';
import { env } from '@/env';
import { extractUrl, findLastUrlInMessages } from '../utils';
import type { ToolContext } from '../types';

const API_BASE_URL = env.BACKEND_API_URL || 'http://127.0.0.1:8000';

export const previewVideoSchema = z.object({
    video_url: z
        .string()
        .describe(
            'REQUIRED: Complete Video URL (YouTube, Bilibili, Apple Podcasts, etc). Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        ),
});

export function createPreviewVideoTool(ctx: ToolContext) {
    return tool({
        description:
            "Fetch video metadata (title, thumbnail, duration). IMPORTANT: Pass URL in 'video_url' parameter ONLY.",
        inputSchema: previewVideoSchema,
        execute: async (args: z.infer<typeof previewVideoSchema>) => {
            console.log('[API/Chat] preview_video args:', JSON.stringify(args));

            let fallbackSource: string | null = null;
            let cleanUrl = extractUrl(args.video_url);

            if (!cleanUrl) {
                console.log('[API/Chat] No valid URL in args, checking history...');
                cleanUrl = findLastUrlInMessages(ctx.messages);
                if (cleanUrl) fallbackSource = 'message_history';
            }

            if (fallbackSource) {
                console.warn(
                    `[API/Chat] URL fallback: source=${fallbackSource}, tool=preview_video, args=${JSON.stringify(args)}`
                );
            }

            if (!cleanUrl) {
                console.error('[API/Chat] Invalid URL in preview_video:', JSON.stringify(args));
                return {
                    error: 'No valid URL found in input or history. Please provide a valid YouTube URL.',
                };
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/preview-video`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        Authorization: `Bearer ${ctx.accessToken}`,
                    },
                    body: new URLSearchParams({ url: cleanUrl }),
                });
                const data = await response.json();
                if (!response.ok) {
                    return {
                        error: 'Failed to preview video',
                        details: data.detail || 'Unknown error',
                        status: response.status,
                    };
                }
                if (data?.title || data?.thumbnail) {
                    ctx.setPreviewCache({
                        url: cleanUrl,
                        title: data.title,
                        thumbnail: data.thumbnail,
                    });
                }
                return data;
            } catch (error) {
                return {
                    error: 'Failed to preview video',
                    details: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        },
    });
}
