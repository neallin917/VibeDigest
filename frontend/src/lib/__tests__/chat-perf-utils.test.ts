import { describe, it, expect } from 'vitest'
import {
  checkHasRenderableAssistant,
  checkHasTaskStatusForActiveTask,
  partsAreEqual,
} from '../chat-perf-utils'
import type { UIMessage } from 'ai'

// Helper to build a UIMessage quickly
function msg(
  role: UIMessage['role'],
  parts: UIMessage['parts'],
  id = 'msg-1'
): UIMessage {
  return { id, role, parts }
}

// ---------------------------------------------------------------------------
// checkHasRenderableAssistant
// ---------------------------------------------------------------------------
describe('checkHasRenderableAssistant', () => {
  it('returns true when assistant message has text content', () => {
    const messages: UIMessage[] = [
      msg('assistant', [{ type: 'text', text: 'Hello world' }]),
    ]
    expect(checkHasRenderableAssistant(messages)).toBe(true)
  })

  it('returns false when messages is empty', () => {
    expect(checkHasRenderableAssistant([])).toBe(false)
  })

  it('returns false when only user messages exist', () => {
    const messages: UIMessage[] = [
      msg('user', [{ type: 'text', text: 'Hi' }]),
    ]
    expect(checkHasRenderableAssistant(messages)).toBe(false)
  })

  it('returns false when only preview_video tool parts', () => {
    const messages: UIMessage[] = [
      msg('assistant', [
        { type: 'tool-preview_video', toolCallId: 'tc1', state: 'result', args: {}, output: {} } as any,
      ]),
    ]
    expect(checkHasRenderableAssistant(messages)).toBe(false)
  })

  it('returns false when create_task has no taskId output', () => {
    const messages: UIMessage[] = [
      msg('assistant', [
        { type: 'tool-create_task', toolCallId: 'tc1', state: 'result', args: {}, output: {} } as any,
      ]),
    ]
    expect(checkHasRenderableAssistant(messages)).toBe(false)
  })

  it('returns true when create_task has taskId in output', () => {
    const messages: UIMessage[] = [
      msg('assistant', [
        {
          type: 'tool-create_task',
          toolCallId: 'tc1',
          state: 'result',
          args: {},
          output: { taskId: 'task-123' },
        } as any,
      ]),
    ]
    expect(checkHasRenderableAssistant(messages)).toBe(true)
  })

  it('returns true for get_task_status tool', () => {
    const messages: UIMessage[] = [
      msg('assistant', [
        {
          type: 'tool-get_task_status',
          toolCallId: 'tc1',
          state: 'result',
          args: {},
          output: { taskId: 't1' },
        } as any,
      ]),
    ]
    expect(checkHasRenderableAssistant(messages)).toBe(true)
  })

  it('returns false when assistant text is only whitespace', () => {
    const messages: UIMessage[] = [
      msg('assistant', [{ type: 'text', text: '   ' }]),
    ]
    expect(checkHasRenderableAssistant(messages)).toBe(false)
  })

  it('returns true for dynamic-tool type with renderable toolName', () => {
    const messages: UIMessage[] = [
      msg('assistant', [
        { type: 'dynamic-tool', toolName: 'get_task_status', toolCallId: 'tc1', state: 'result', args: {}, output: {} } as any,
      ]),
    ]
    expect(checkHasRenderableAssistant(messages)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// checkHasTaskStatusForActiveTask
// ---------------------------------------------------------------------------
describe('checkHasTaskStatusForActiveTask', () => {
  it('returns false when activeTaskId is null', () => {
    const messages: UIMessage[] = [
      msg('assistant', [
        {
          type: 'tool-get_task_status',
          toolCallId: 'tc1',
          state: 'result',
          args: {},
          output: { taskId: 'task-1' },
        } as any,
      ]),
    ]
    expect(checkHasTaskStatusForActiveTask(messages, null)).toBe(false)
  })

  it('returns false when no matching task in messages', () => {
    const messages: UIMessage[] = [
      msg('user', [{ type: 'text', text: 'hello' }]),
    ]
    expect(checkHasTaskStatusForActiveTask(messages, 'task-1')).toBe(false)
  })

  it('returns true when get_task_status matches activeTaskId', () => {
    const messages: UIMessage[] = [
      msg('assistant', [
        {
          type: 'tool-get_task_status',
          toolCallId: 'tc1',
          state: 'result',
          input: { taskId: 'task-1' },
          output: { taskId: 'task-1' },
        } as any,
      ]),
    ]
    expect(checkHasTaskStatusForActiveTask(messages, 'task-1')).toBe(true)
  })

  it('returns true when create_task output matches activeTaskId', () => {
    const messages: UIMessage[] = [
      msg('assistant', [
        {
          type: 'tool-create_task',
          toolCallId: 'tc1',
          state: 'result',
          args: {},
          output: { taskId: 'task-1' },
        } as any,
      ]),
    ]
    expect(checkHasTaskStatusForActiveTask(messages, 'task-1')).toBe(true)
  })

  it('returns false when task IDs do not match', () => {
    const messages: UIMessage[] = [
      msg('assistant', [
        {
          type: 'tool-get_task_status',
          toolCallId: 'tc1',
          state: 'result',
          input: { taskId: 'task-2' },
          output: { taskId: 'task-2' },
        } as any,
      ]),
    ]
    expect(checkHasTaskStatusForActiveTask(messages, 'task-1')).toBe(false)
  })

  it('returns true when dynamic-tool get_task_status matches', () => {
    const messages: UIMessage[] = [
      msg('assistant', [
        {
          type: 'dynamic-tool',
          toolName: 'get_task_status',
          toolCallId: 'tc1',
          state: 'result',
          input: { taskId: 'task-1' },
          output: { taskId: 'task-1' },
        } as any,
      ]),
    ]
    expect(checkHasTaskStatusForActiveTask(messages, 'task-1')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// partsAreEqual  (Cycle 2: shallow parts comparison)
// ---------------------------------------------------------------------------
describe('partsAreEqual', () => {
  it('returns true for identical parts arrays (same reference)', () => {
    const parts: UIMessage['parts'] = [{ type: 'text', text: 'hello' }]
    expect(partsAreEqual(parts, parts)).toBe(true)
  })

  it('returns false when parts count differs', () => {
    const prev: UIMessage['parts'] = [{ type: 'text', text: 'a' }]
    const next: UIMessage['parts'] = [
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
    ]
    expect(partsAreEqual(prev, next)).toBe(false)
  })

  it('returns false when text content changes', () => {
    const prev: UIMessage['parts'] = [{ type: 'text', text: 'hello' }]
    const next: UIMessage['parts'] = [{ type: 'text', text: 'world' }]
    expect(partsAreEqual(prev, next)).toBe(false)
  })

  it('returns true when text content is identical (different refs)', () => {
    const prev: UIMessage['parts'] = [{ type: 'text', text: 'hello' }]
    const next: UIMessage['parts'] = [{ type: 'text', text: 'hello' }]
    expect(partsAreEqual(prev, next)).toBe(true)
  })

  it('returns false when part type changes', () => {
    const prev: UIMessage['parts'] = [{ type: 'text', text: 'x' }]
    const next: UIMessage['parts'] = [
      { type: 'tool-create_task', toolCallId: 'tc1', state: 'result', args: {}, output: {} } as any,
    ]
    expect(partsAreEqual(prev, next)).toBe(false)
  })

  it('returns true when tool part is same reference', () => {
    const toolPart = {
      type: 'tool-get_task_status',
      toolCallId: 'tc1',
      state: 'result',
      args: {},
      output: { taskId: 't1' },
    } as any
    const prev: UIMessage['parts'] = [toolPart]
    const next: UIMessage['parts'] = [toolPart]
    expect(partsAreEqual(prev, next)).toBe(true)
  })

  it('returns false when tool parts differ by reference', () => {
    const prev: UIMessage['parts'] = [
      { type: 'tool-get_task_status', toolCallId: 'tc1', state: 'result', args: {}, output: { taskId: 't1' } } as any,
    ]
    const next: UIMessage['parts'] = [
      { type: 'tool-get_task_status', toolCallId: 'tc1', state: 'result', args: {}, output: { taskId: 't1' } } as any,
    ]
    // Different object references => false (by design for O(1) comparison)
    expect(partsAreEqual(prev, next)).toBe(false)
  })

  it('handles empty parts arrays', () => {
    expect(partsAreEqual([], [])).toBe(true)
  })
})
