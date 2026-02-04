import { GetTaskStatusTool, GetTaskOutputsTool, UnknownTool } from './tools'

// Helper function to render tool parts using AI SDK v6 standard UIMessage types
export function renderToolPart(
  part: any,
  index: number,
  onOpenPanel?: (taskId: string) => void,
  options?: { hasGetTaskStatus?: boolean }
) {
  if (!part.type.startsWith('tool-') && part.type !== 'dynamic-tool') {
    return null
  }

  const toolCallId = part.toolCallId || part.id
  const state = part.state
  const args = part.input
  const result = part.output
  const errorText = part.errorText

  let toolName = ''
  if (part.type === 'dynamic-tool') {
    toolName = part.toolName
  } else {
    toolName = part.type.replace('tool-', '')
  }

  switch (toolName) {
    case 'get_task_status':
      return (
        <GetTaskStatusTool
          key={toolCallId || index}
          toolCallId={toolCallId}
          state={state}
          input={args}
          output={result}
          errorText={errorText}
          onViewClick={onOpenPanel}
        />
      )

    case 'create_task':
      if (options?.hasGetTaskStatus) return null
      if (!result?.taskId) return null
      return (
        <GetTaskStatusTool
          key={toolCallId || index}
          toolCallId={toolCallId}
          state="output-available"
          output={{
            taskId: result.taskId,
            status: 'pending',
            progress: 0,
            video_url: result.videoUrl
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
          key={toolCallId || index}
          toolCallId={toolCallId}
          state={state}
          input={args}
          output={result}
          errorText={errorText}
        />
      )

    default:
      return (
        <UnknownTool
          key={toolCallId || index}
          toolName={toolName}
          toolCallId={toolCallId}
          state={state}
          input={args}
          output={result}
          errorText={errorText}
        />
      )
  }
}
