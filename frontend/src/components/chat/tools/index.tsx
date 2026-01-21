'use client'

/**
 * Tool UI Components for AI SDK v6 Generative UI
 * 
 * Each tool has a dedicated UI component that renders based on its state:
 * - input-streaming: Tool inputs are being streamed
 * - input-available: Tool inputs are ready, execution pending
 * - output-available: Tool execution completed successfully
 * - output-error: Tool execution failed
 */

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Play,
  Video,
  FileText,
  Search,
  Sparkles,
  Clock,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

// ============================================================================
// Type Definitions
// ============================================================================

type ToolState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error'

interface BaseToolPartProps<I = unknown, O = unknown> {
  toolCallId: string
  state: ToolState
  input?: I
  output?: O
  errorText?: string
}

// ============================================================================
// get_task_status Tool UI
// ============================================================================

interface TaskStatusInput {
  taskId: string
}

interface TaskStatusOutput {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  video_title?: string
  thumbnail_url?: string
  video_url?: string
  error_message?: string
  error?: string
}

interface GetTaskStatusToolProps extends BaseToolPartProps<TaskStatusInput, TaskStatusOutput> {
  onViewClick?: (taskId: string) => void
}

export function GetTaskStatusTool({
  toolCallId,
  state,
  input,
  output,
  errorText,
  onViewClick
}: GetTaskStatusToolProps) {
  switch (state) {
    case 'input-streaming':
    case 'input-available':
      return (
        <div className="flex items-center gap-2 my-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span>Checking task status{input?.taskId ? ` for ${input.taskId.slice(0, 8)}...` : '...'}</span>
        </div>
      )

    case 'output-available':
      if (output?.error) {
        return (
          <div className="flex items-center gap-2 my-2 text-sm text-red-500">
            <AlertCircle className="w-4 h-4" />
            <span>{output.error}</span>
          </div>
        )
      }

      const status = output?.status || 'unknown'
      const progress = output?.progress || 0

      return (
        <Card className={cn(
          "w-full max-w-sm overflow-hidden my-3 border transition-all",
          "bg-white/50 border-white/40 shadow-sm",
          "dark:bg-white/5 dark:border-white/10"
        )}>
          {/* Thumbnail */}
          <div className="relative aspect-video bg-black/50">
            {output?.thumbnail_url ? (
              <Image
                src={output.thumbnail_url}
                alt={output.video_title || "Video"}
                fill
                unoptimized
                className="object-cover opacity-80"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Video className="w-8 h-8 opacity-20" />
              </div>
            )}

            {/* Status Overlay */}
            {status === 'processing' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="bg-black/60 backdrop-blur-sm rounded-full p-3">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            <h3 className="font-medium text-sm line-clamp-2 leading-snug text-slate-800 dark:text-slate-200">
              {output?.video_title || output?.video_url || 'Untitled Video'}
            </h3>

            {/* Status Indicator */}
            <div className="flex items-center gap-2 text-xs">
              {status === 'processing' && (
                <>
                  <Clock className="w-3 h-3 text-blue-500 animate-pulse" />
                  <span className="text-blue-500">Processing...</span>
                  <span className="text-muted-foreground">{progress}%</span>
                </>
              )}
              {status === 'pending' && (
                <>
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span className="text-amber-500">Pending</span>
                </>
              )}
              {status === 'completed' && (
                <>
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-500">Ready</span>
                </>
              )}
              {status === 'failed' && (
                <>
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  <span className="text-red-500">Failed</span>
                </>
              )}
            </div>

            {/* Progress Bar */}
            {status === 'processing' && (
              <Progress value={progress} className="h-1 bg-slate-200 dark:bg-white/10" />
            )}

            {/* Action Button */}
            {status === 'completed' && onViewClick && output?.taskId && (
              <Button
                onClick={() => onViewClick(output.taskId)}
                className="w-full h-8 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                View Summary
              </Button>
            )}
          </div>
        </Card>
      )

    case 'output-error':
      return (
        <div className="flex items-center gap-2 my-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" />
          <span>Failed to get task status: {errorText || 'Unknown error'}</span>
        </div>
      )

    default:
      return null
  }
}

// ============================================================================
// create_task Tool UI
// ============================================================================

interface CreateTaskInput {
  videoUrl: string
  summaryLanguage?: string
}

interface CreateTaskOutput {
  taskId?: string
  status?: string
  message?: string
  videoUrl?: string
  error?: string
  details?: string | Record<string, unknown>
}

interface CreateTaskToolProps extends BaseToolPartProps {
  input?: CreateTaskInput
  output?: CreateTaskOutput
  onViewClick?: (taskId: string) => void
}

export function CreateTaskTool({
  toolCallId,
  state,
  input,
  output,
  errorText,
  onViewClick
}: CreateTaskToolProps) {
  switch (state) {
    case 'input-streaming':
      return (
        <div className="flex items-center gap-2 my-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
          <span>Preparing to process video...</span>
        </div>
      )

    case 'input-available':
      return (
        <div className="flex items-center gap-2 my-2 text-sm text-blue-500">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span>Starting video processing for: {input?.videoUrl?.slice(0, 40)}...</span>
        </div>
      )

    case 'output-available':
      if (output?.error) {
        // Handle details that might be an object (e.g., Pydantic validation errors)
        const detailsText = output.details
          ? (typeof output.details === 'string' ? output.details : JSON.stringify(output.details))
          : null;
        return (
          <div className="my-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">Failed to create task</span>
            </div>
            {detailsText && (
              <p className="mt-1 text-xs text-red-500">{detailsText}</p>
            )}
          </div>
        )
      }

      return (
        <div className="my-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20">
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium">{output?.message || 'Task created successfully!'}</span>
          </div>
          {output?.videoUrl && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 truncate">
              {output.videoUrl}
            </p>
          )}
          {output?.taskId && onViewClick && (
            <Button
              onClick={() => onViewClick(output.taskId!)}
              variant="outline"
              size="sm"
              className="mt-3 h-7 text-xs"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View Progress
            </Button>
          )}
        </div>
      )

    case 'output-error':
      return (
        <div className="flex items-center gap-2 my-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" />
          <span>Failed to create task: {errorText || 'Unknown error'}</span>
        </div>
      )

    default:
      return null
  }
}

// ============================================================================
// preview_video Tool UI
// ============================================================================

interface PreviewVideoInput {
  url: string
}

interface PreviewVideoOutput {
  title?: string
  thumbnail?: string
  duration?: string
  channel?: string
  error?: string
  details?: string | Record<string, unknown>
}

interface PreviewVideoToolProps extends BaseToolPartProps {
  input?: PreviewVideoInput
  output?: PreviewVideoOutput
}

export function PreviewVideoTool({
  toolCallId,
  state,
  input,
  output,
  errorText
}: PreviewVideoToolProps) {
  switch (state) {
    case 'input-streaming':
    case 'input-available':
      return (
        <div className="flex items-center gap-2 my-2 text-sm text-slate-500 dark:text-slate-400">
          <Search className="w-4 h-4 animate-pulse text-blue-500" />
          <span>Fetching video info{input?.url ? ` from ${new URL(input.url).hostname}...` : '...'}</span>
        </div>
      )

    case 'output-available':
      if (output?.error) {
        const previewErrorText = typeof output.error === 'string' ? output.error : JSON.stringify(output.error);
        return (
          <div className="flex items-center gap-2 my-2 text-sm text-red-500">
            <AlertCircle className="w-4 h-4" />
            <span>{previewErrorText}</span>
          </div>
        )
      }

      return (
        <Card className={cn(
          "w-full max-w-sm overflow-hidden my-3 border transition-all",
          "bg-white/50 border-white/40 shadow-sm",
          "dark:bg-white/5 dark:border-white/10"
        )}>
          {/* Thumbnail */}
          <div className="relative aspect-video bg-black/50">
            {output?.thumbnail ? (
              <Image
                src={output.thumbnail}
                alt={output.title || "Video"}
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Play className="w-8 h-8 opacity-20" />
              </div>
            )}
            {output?.duration && (
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                {output.duration}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4 space-y-2">
            <h3 className="font-medium text-sm line-clamp-2 leading-snug text-slate-800 dark:text-slate-200">
              {output?.title || 'Untitled Video'}
            </h3>
            {output?.channel && (
              <p className="text-xs text-muted-foreground">{output.channel}</p>
            )}
          </div>
        </Card>
      )

    case 'output-error':
      return (
        <div className="flex items-center gap-2 my-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" />
          <span>Failed to preview video: {errorText || 'Unknown error'}</span>
        </div>
      )

    default:
      return null
  }
}

// ============================================================================
// get_task_outputs Tool UI
// ============================================================================

interface GetTaskOutputsInput {
  taskId: string
  kinds?: string[]
}

interface TaskOutput {
  kind: string
  content: string
  status: string
}

interface GetTaskOutputsOutput {
  taskId: string
  outputs: TaskOutput[]
  count: number
  error?: string
}

interface GetTaskOutputsToolProps extends BaseToolPartProps {
  input?: GetTaskOutputsInput
  output?: GetTaskOutputsOutput
}

export function GetTaskOutputsTool({
  toolCallId,
  state,
  input,
  output,
  errorText
}: GetTaskOutputsToolProps) {
  switch (state) {
    case 'input-streaming':
    case 'input-available':
      return (
        <div className="flex items-center gap-2 my-2 text-sm text-slate-500 dark:text-slate-400">
          <FileText className="w-4 h-4 animate-pulse text-blue-500" />
          <span>Retrieving content{input?.kinds ? ` (${input.kinds.join(', ')})` : ''}...</span>
        </div>
      )

    case 'output-available':
      if (output?.error) {
        return (
          <div className="flex items-center gap-2 my-2 text-sm text-red-500">
            <AlertCircle className="w-4 h-4" />
            <span>{output.error}</span>
          </div>
        )
      }

      return (
        <div className="my-2 text-sm text-emerald-600 dark:text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>Retrieved {output?.count || 0} output(s)</span>
          </div>
        </div>
      )

    case 'output-error':
      return (
        <div className="flex items-center gap-2 my-2 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" />
          <span>Failed to get outputs: {errorText || 'Unknown error'}</span>
        </div>
      )

    default:
      return null
  }
}

// ============================================================================
// Fallback for unknown tools
// ============================================================================

interface UnknownToolProps extends BaseToolPartProps {
  toolName: string
}

export function UnknownTool({
  toolCallId,
  toolName,
  state,
  input,
  output,
  errorText
}: UnknownToolProps) {
  switch (state) {
    case 'input-streaming':
    case 'input-available':
      return (
        <div className="flex items-center gap-2 my-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 px-3 py-2 rounded-md border border-slate-100 dark:border-white/5 w-fit">
          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
          <span className="font-medium">Running: {toolName}...</span>
        </div>
      )

    case 'output-available':
      return (
        <div className="flex items-center gap-2 my-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10 px-3 py-2 rounded-md border border-emerald-100/50 dark:border-emerald-500/20 w-fit">
          <CheckCircle className="w-3 h-3" />
          <span className="font-medium">Completed: {toolName}</span>
        </div>
      )

    case 'output-error':
      return (
        <div className="flex items-center gap-2 my-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 px-3 py-2 rounded-md border border-red-100 dark:border-red-900/20 w-fit">
          <AlertCircle className="w-3 h-3" />
          <span className="font-medium">Failed: {toolName}</span>
        </div>
      )

    default:
      return null
  }
}
