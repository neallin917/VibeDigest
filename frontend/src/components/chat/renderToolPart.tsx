import { GetTaskStatusTool, GetTaskOutputsTool, UnknownTool } from './tools'

type RenderableToolPart = {
  type?: string
  toolCallId?: string
  id?: string
  state?: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  input?: unknown
  output?: unknown
  errorText?: string
  toolName?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// Helper function to render tool parts using AI SDK v6 standard UIMessage types
export function renderToolPart(
  part: unknown,
  index: number,
  onOpenPanel?: (taskId: string) => void,
  options?: { hasGetTaskStatus?: boolean }
) {
  if (!isRecord(part)) return null
  const toolPart = part as RenderableToolPart

  if (!toolPart.type?.startsWith('tool-') && toolPart.type !== 'dynamic-tool') {
    return null
  }

  const toolCallId = toolPart.toolCallId || toolPart.id
  const resolvedToolCallId = toolCallId ?? `tool-${index}`
  const state = toolPart.state ?? 'input-available'
  const args = toolPart.input
  const result = toolPart.output
  const errorText = toolPart.errorText

  let toolName = ''
  if (toolPart.type === 'dynamic-tool') {
    toolName = toolPart.toolName || ''
  } else {
    toolName = toolPart.type.replace('tool-', '')
  }

  switch (toolName) {
    case 'get_task_status':
      return (
        <GetTaskStatusTool
          key={resolvedToolCallId}
          toolCallId={resolvedToolCallId}
          state={state}
          input={args as { taskId: string } | undefined}
          output={result as {
            taskId: string
            status: 'pending' | 'processing' | 'completed' | 'failed'
            progress?: number
            video_title?: string
            thumbnail_url?: string
            video_url?: string
            error_message?: string
            error?: string
          } | undefined}
          errorText={errorText}
          onViewClick={onOpenPanel}
        />
      )

    case 'create_task':
      if (options?.hasGetTaskStatus) return null
      if (!isRecord(result) || typeof result.taskId !== 'string') return null
      return (
        <GetTaskStatusTool
          key={resolvedToolCallId}
          toolCallId={resolvedToolCallId}
          state="output-available"
          output={{
            taskId: result.taskId,
            status: 'pending',
            progress: 0,
            video_url: typeof result.videoUrl === 'string' ? result.videoUrl : undefined
          }}
          errorText={errorText}
          onViewClick={onOpenPanel}
        />
      )

    case 'preview_video':
      return null

    case 'get_task_outputs':
      return (
        <GetTaskOutputsTool
          key={resolvedToolCallId}
          toolCallId={resolvedToolCallId}
          state={state}
          input={args as { taskId: string; kinds?: string[] } | undefined}
          output={result as {
            taskId: string
            outputs: { kind: string; content: string; status: string }[]
            count: number
            error?: string
          } | undefined}
          errorText={errorText}
        />
      )

    default:
      return (
        <UnknownTool
          key={resolvedToolCallId}
          toolName={toolName}
          toolCallId={resolvedToolCallId}
          state={state}
          input={args}
          output={result}
          errorText={errorText}
        />
      )
  }
}
