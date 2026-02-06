import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatPageClient } from '../ChatPageClient'

let currentSearchParams = new URLSearchParams()
const replaceMock = vi.fn()
const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => currentSearchParams.get(key),
    toString: () => currentSearchParams.toString()
  }),
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
    prefetch: vi.fn()
  }),
  usePathname: () => '/en/chat'
}))

vi.mock('@/components/layout/AppSidebarContext', () => ({
  AppSidebarProvider: ({ children }: { children: any }) => <>{children}</>
}))

vi.mock('@/components/layout/AppSidebar', () => ({
  AppSidebar: () => <div data-testid="sidebar" />
}))

vi.mock('../ChatWorkspace', () => ({
  ChatWorkspace: (props: any) => (
    <div
      data-testid="workspace"
      data-thread-id={props.activeThreadId || ''}
      data-task-id={props.activeTaskId || ''}
    >
      <button onClick={() => props.onSelectTask('task-b')}>Select Task B</button>
    </div>
  )
}))

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  } as Response
}

describe('ChatPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentSearchParams = new URLSearchParams()
    replaceMock.mockImplementation((url: string) => {
      const [, query = ''] = url.split('?')
      currentSearchParams = new URLSearchParams(query)
    })
  })

  it('reuses the latest thread when entering with task and no threadId', async () => {
    currentSearchParams = new URLSearchParams('task=task-a')
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url === '/api/chat/threads') return jsonResponse([])
      if (url === '/api/threads?taskId=task-a') {
        return jsonResponse([{ id: 'thread-a', title: 'A', updated_at: '2026-02-06T00:00:00Z' }])
      }
      if (url === '/api/chat/threads/thread-a/messages') return jsonResponse([])
      throw new Error(`Unexpected fetch URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ChatPageClient />)

    await waitFor(() => {
      expect(screen.getByTestId('workspace')).toHaveAttribute('data-thread-id', 'thread-a')
      expect(screen.getByTestId('workspace')).toHaveAttribute('data-task-id', 'task-a')
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/threads?taskId=task-a')
    expect(replaceMock).toHaveBeenCalledWith('/en/chat?task=task-a&threadId=thread-a', { scroll: false })
  })

  it('keeps reusing the same latest thread for repeated same-task entry', async () => {
    currentSearchParams = new URLSearchParams('task=task-a')
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      if (url === '/api/chat/threads') return jsonResponse([])
      if (url === '/api/threads?taskId=task-a') {
        return jsonResponse([{ id: 'thread-a', title: 'A', updated_at: '2026-02-06T00:00:00Z' }])
      }
      if (url === '/api/chat/threads/thread-a/messages') return jsonResponse([])
      if (url === '/api/threads' && init?.method === 'POST') {
        return jsonResponse({ id: 'new-thread', title: 'New Chat', updated_at: '2026-02-06T00:00:00Z' })
      }
      throw new Error(`Unexpected fetch URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { unmount } = render(<ChatPageClient />)
    await waitFor(() => {
      expect(screen.getByTestId('workspace')).toHaveAttribute('data-thread-id', 'thread-a')
    })
    unmount()

    render(<ChatPageClient />)
    await waitFor(() => {
      expect(screen.getByTestId('workspace')).toHaveAttribute('data-thread-id', 'thread-a')
    })

    const postCalls = fetchMock.mock.calls.filter(([url, init]) => {
      return url === '/api/threads' && (init as RequestInit | undefined)?.method === 'POST'
    })
    expect(postCalls).toHaveLength(0)
  })

  it('switches to the target task latest thread instead of reusing current thread', async () => {
    currentSearchParams = new URLSearchParams('task=task-a')
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url === '/api/chat/threads') return jsonResponse([])
      if (url === '/api/threads?taskId=task-a') {
        return jsonResponse([{ id: 'thread-a', title: 'A', updated_at: '2026-02-06T00:00:00Z' }])
      }
      if (url === '/api/threads?taskId=task-b') {
        return jsonResponse([{ id: 'thread-b', title: 'B', updated_at: '2026-02-06T00:00:00Z' }])
      }
      if (url === '/api/chat/threads/thread-a/messages') return jsonResponse([])
      if (url === '/api/chat/threads/thread-b/messages') return jsonResponse([])
      throw new Error(`Unexpected fetch URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ChatPageClient />)

    await waitFor(() => {
      expect(screen.getByTestId('workspace')).toHaveAttribute('data-thread-id', 'thread-a')
    })

    fireEvent.click(screen.getByText('Select Task B'))

    await waitFor(() => {
      expect(screen.getByTestId('workspace')).toHaveAttribute('data-thread-id', 'thread-b')
      expect(screen.getByTestId('workspace')).toHaveAttribute('data-task-id', 'task-b')
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/threads?taskId=task-b')
    expect(replaceMock).toHaveBeenCalledWith('/en/chat?task=task-b&threadId=thread-b', { scroll: false })
  })
})
