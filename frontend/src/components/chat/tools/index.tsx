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
  FileText,
  Search,
  Sparkles,
  Clock,
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'

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
  const [liveTask, setLiveTask] = useState<TaskStatusOutput | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!output?.taskId || output?.error) return

    let isActive = true

    const fetchTask = async () => {
      const { data } = await supabase
        .from('tasks')
        .select('id,status,progress,video_title,thumbnail_url,video_url,error_message,updated_at')
        .eq('id', output.taskId)
        .single()

      if (data && isActive) {
        setLiveTask({
          taskId: data.id,
          status: data.status,
          progress: data.progress || 0,
          video_title: data.video_title || undefined,
          thumbnail_url: data.thumbnail_url || undefined,
          video_url: data.video_url || undefined,
          error_message: data.error_message || undefined
        })
      }
    }

    fetchTask()

    const channel = supabase
      .channel(`task_status_${output.taskId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `id=eq.${output.taskId}`
      }, (payload) => {
        const next = payload.new as any
        if (!next || !isActive) return
        setLiveTask({
          taskId: next.id,
          status: next.status,
          progress: next.progress || 0,
          video_title: next.video_title || undefined,
          thumbnail_url: next.thumbnail_url || undefined,
          video_url: next.video_url || undefined,
          error_message: next.error_message || undefined
        })
      })
      .subscribe()

    return () => {
      isActive = false
      supabase.removeChannel(channel)
    }
  }, [output?.taskId, output?.error, supabase])

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

      const effectiveOutput = liveTask || output
      const status = effectiveOutput?.status || 'unknown'
      const progress = effectiveOutput?.progress || 0
      const rawTitle = effectiveOutput?.video_title?.trim()
      const displayTitle = rawTitle && rawTitle.toLowerCase() !== 'unknown'
        ? rawTitle
        : effectiveOutput?.video_url
          ? (() => {
              try {
                return new URL(effectiveOutput.video_url).hostname
              } catch {
                return 'Video task'
              }
            })()
          : 'Video task'
      const planSteps = [
        {
          key: 'queued',
          label: 'Queued',
          description: 'We verified the URL and prepared the workflow.',
          minProgress: 0
        },
        {
          key: 'ingest',
          label: 'Fetch source data',
          description: 'Collect metadata and pull the best available transcript.',
          minProgress: 15
        },
        {
          key: 'transcribe',
          label: 'Transcribe audio',
          description: 'Generate a clean, timestamped transcript for analysis.',
          minProgress: 30
        },
        {
          key: 'summarize',
          label: 'Summarize content',
          description: 'Create an accurate, structured summary for quick reading.',
          minProgress: 70
        },
        {
          key: 'finalize',
          label: 'Finalize outputs',
          description: 'Prepare the final assets and make them ready to view.',
          minProgress: 90
        }
      ]
      const resolvedProgress = status === 'completed' ? 100 : progress
      const activeStepIndex = status === 'failed'
        ? -1
        : planSteps.reduce((acc, step, idx) => (resolvedProgress >= step.minProgress ? idx : acc), 0)
      const completedCount = status === 'completed'
        ? planSteps.length
        : Math.max(activeStepIndex, 0)
      const progressValue = Math.round((completedCount / planSteps.length) * 100)

      return (
        <Card className={cn(
          "w-full max-w-none overflow-hidden my-3 border transition-all",
          "bg-white/60 border-white/50 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)]",
          "dark:bg-zinc-900/60 dark:border-white/10 dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)]"
        )}>
          {/* Content */}
          <div className="p-4 space-y-3">
            <h3 className="font-medium text-sm line-clamp-2 leading-snug text-slate-800 dark:text-slate-200">
              {displayTitle}
            </h3>

            {/* Status Indicator */}
            <div className="flex items-center gap-2 text-xs">
              {status === 'processing' && (
                <>
                  <Clock className="w-3 h-3 text-blue-500 animate-pulse" />
                  <span className="text-blue-500">Processing</span>
                </>
              )}
              {status === 'pending' && (
                <>
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span className="text-amber-500">Queued</span>
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

            {/* Plan Steps */}
            <div className="rounded-md border border-white/40 bg-white/30 dark:border-white/10 dark:bg-white/5">
              <div className="px-3 py-2 border-b border-white/30 dark:border-white/10">
                <div className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Processing Plan</div>
                <div className="text-xs text-slate-500 dark:text-zinc-400">Step-by-step progress for this task</div>
                {status !== 'failed' && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs text-slate-500 dark:text-zinc-400">
                      {completedCount} of {planSteps.length} complete
                    </div>
                    <Progress value={progressValue} className="h-1 bg-slate-200/80 dark:bg-white/10" />
                  </div>
                )}
              </div>
              <div className="px-3 py-2">
                <div className="relative">
                  <div className="absolute left-2.5 top-2 bottom-2 w-px bg-slate-200/70 dark:bg-white/10" />
                  <div className="space-y-3">
                    {planSteps.map((step, index) => {
                      const isDone = status === 'completed' || (activeStepIndex > index)
                      const isActive = status !== 'failed' && activeStepIndex === index && status !== 'completed'
                      const circleClassName = cn(
                        "relative z-10 w-5 h-5 rounded-full flex items-center justify-center border text-[10px] bg-white/90 dark:bg-black/40",
                        isDone && "bg-emerald-500 border-emerald-500 text-white",
                        isActive && "border-emerald-400 text-emerald-400",
                        !isDone && !isActive && "border-slate-300 text-slate-400 dark:border-white/15 dark:text-zinc-500"
                      )
                      const labelClassName = cn(
                        "text-xs",
                        isDone && "text-slate-800 dark:text-zinc-200",
                        isActive && "text-emerald-400",
                        !isDone && !isActive && "text-slate-500 dark:text-zinc-400"
                      )

                      return (
                        <div key={step.key} className="flex items-start gap-3">
                          <div className={circleClassName}>
                            {isDone ? <CheckCircle className="w-3 h-3" /> : <span>{index + 1}</span>}
                          </div>
                          <div className="space-y-0.5">
                            <div className={labelClassName}>{step.label}</div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                              {step.description}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

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
  video_url?: string
  videoUrl?: string
  url?: string
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
  // Robust fallback for URL display
  const displayUrl = input?.video_url || input?.videoUrl || input?.url;

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
          <span>Starting video processing for: {displayUrl?.slice(0, 40)}...</span>
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
  video_url?: string
  videoUrl?: string
  url?: string
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
  // Robust fallback for URL display
  const displayUrl = input?.video_url || input?.videoUrl || input?.url;

  switch (state) {
    case 'input-streaming':
    case 'input-available':
      return (
        <div className="flex items-center gap-2 my-2 text-sm text-slate-500 dark:text-slate-400">
          <Search className="w-4 h-4 animate-pulse text-blue-500" />
          <span>Fetching video info{displayUrl ? (() => {
            try {
              return ` from ${new URL(displayUrl).hostname}...`;
            } catch {
              return '...';
            }
          })() : '...'}</span>
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
          "bg-white/60 border-white/50 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)]",
          "dark:bg-zinc-900/60 dark:border-white/10 dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.3)]"
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
