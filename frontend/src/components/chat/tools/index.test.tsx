import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import {
  GetTaskStatusTool,
  CreateTaskTool,
  PreviewVideoTool,
  GetTaskOutputsTool,
  UnknownTool
} from './index'

vi.mock('@/components/i18n/I18nProvider', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en',
  }),
}))

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockChannel = vi.fn()
const mockOn = vi.fn()
const mockSubscribe = vi.fn()
const mockRemoveChannel = vi.fn()

const queryBuilder = {
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
}

mockSelect.mockReturnValue(queryBuilder)
mockEq.mockReturnValue(queryBuilder)

const mockSupabase = {
  from: vi.fn(() => queryBuilder),
  channel: mockChannel,
  removeChannel: mockRemoveChannel
}

vi.mock('@/lib/supabase', () => ({
  createClient: () => mockSupabase
}))

describe('Chat Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockChannel.mockReturnValue({
      on: mockOn,
      subscribe: mockSubscribe
    })
    mockOn.mockReturnThis()
    mockSubscribe.mockReturnThis()
  })

  describe('GetTaskStatusTool', () => {
    it('renders loading state', () => {
      render(
        <GetTaskStatusTool
          toolCallId="1"
          state="input-available"
          input={{ taskId: '123' }}
        />
      )
      expect(screen.getByText(/Checking task status/)).toBeInTheDocument()
    })

    it('renders error state', () => {
      render(
        <GetTaskStatusTool
          toolCallId="1"
          state="output-available"
          output={{ 
              taskId: '123', 
              status: 'failed', 
              error: 'Something went wrong' 
          }}
        />
      )
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('renders output-error state', () => {
        render(
          <GetTaskStatusTool
            toolCallId="1"
            state="output-error"
            errorText="Network error"
          />
        )
        expect(screen.getByText(/Failed to get task status: Network error/)).toBeInTheDocument()
    })

    it('fetches task and subscribes to updates', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: '123',
          status: 'processing',
          progress: 50,
          video_title: 'Test Video',
          thumbnail_url: 'thumb.jpg'
        }
      })

      render(
        <GetTaskStatusTool
          toolCallId="1"
          state="output-available"
          input={{ taskId: '123' }}
          output={{ taskId: '123', status: 'pending' }}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Test Video')).toBeInTheDocument()
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks')
      expect(mockEq).toHaveBeenCalledWith('id', '123')
      expect(mockChannel).toHaveBeenCalledWith('task_status_123')
      expect(mockOn).toHaveBeenCalled()
    })

    it('updates when realtime event occurs', async () => {
      mockSingle.mockResolvedValue({
        data: { id: '123', status: 'pending', progress: 0 }
      })

      let onChangeCallback: any
      mockOn.mockImplementation((event, filter, cb) => {
        onChangeCallback = cb
        return { subscribe: mockSubscribe, on: mockOn }
      })

      render(
        <GetTaskStatusTool
          toolCallId="1"
          state="output-available"
          input={{ taskId: '123' }}
          output={{ taskId: '123', status: 'pending' }}
        />
      )

      await waitFor(() => {
        const queuedElements = screen.getAllByText('Queued')
        expect(queuedElements.length).toBeGreaterThan(0)
      })

      act(() => {
        if (onChangeCallback) {
          onChangeCallback({
            new: {
              id: '123',
              status: 'processing',
              progress: 45,
              video_title: 'Processing Video'
            }
          })
        }
      })

      await waitFor(() => {
        expect(screen.getByText('Processing')).toBeInTheDocument()
        expect(screen.getByText('Processing Video')).toBeInTheDocument()
      })
    })

    it('shows View Summary button when completed', async () => {
        mockSingle.mockResolvedValue({
            data: { id: '123', status: 'completed', progress: 100, video_title: 'Done' }
        })
        const onViewClick = vi.fn()

        render(
            <GetTaskStatusTool
              toolCallId="1"
              state="output-available"
              output={{ taskId: '123', status: 'completed' }}
              onViewClick={onViewClick}
            />
        )

        await waitFor(() => {
            expect(screen.getByText('View Summary')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByText('View Summary'))
        expect(onViewClick).toHaveBeenCalledWith('123')
    })
  })

  describe('CreateTaskTool', () => {
    it('renders input state', () => {
      render(
        <CreateTaskTool
          toolCallId="1"
          state="input-available"
          input={{ video_url: 'https://youtube.com/v/123' }}
        />
      )
      expect(screen.getByText(/Starting video processing for/)).toBeInTheDocument()
    })

    it('renders success state', () => {
      const onViewClick = vi.fn()
      render(
        <CreateTaskTool
          toolCallId="1"
          state="output-available"
          output={{ taskId: '123', message: 'Created', videoUrl: 'http://video' }}
          onViewClick={onViewClick}
        />
      )
      expect(screen.getByText('Created')).toBeInTheDocument()
      expect(screen.getByText('http://video')).toBeInTheDocument()
      
      fireEvent.click(screen.getByText('View Progress'))
      expect(onViewClick).toHaveBeenCalledWith('123')
    })

    it('renders error state', () => {
        render(
          <CreateTaskTool
            toolCallId="1"
            state="output-available"
            output={{ error: 'Creation failed', details: 'Invalid URL' }}
          />
        )
        expect(screen.getByText('Failed to create task')).toBeInTheDocument()
        expect(screen.getByText('Invalid URL')).toBeInTheDocument()
    })
  })

  describe('PreviewVideoTool', () => {
    it('renders loading state', () => {
      render(
        <PreviewVideoTool
          toolCallId="1"
          state="input-available"
          input={{ video_url: 'http://test' }}
        />
      )
      expect(screen.getByText(/Fetching video info/)).toBeInTheDocument()
    })

    it('renders video info', () => {
      render(
        <PreviewVideoTool
          toolCallId="1"
          state="output-available"
          output={{ title: 'Cool Video', duration: '10:00', channel: 'Test Channel' }}
        />
      )
      expect(screen.getByText('Cool Video')).toBeInTheDocument()
      expect(screen.getByText('10:00')).toBeInTheDocument()
      expect(screen.getByText('Test Channel')).toBeInTheDocument()
    })

    it('renders error', () => {
        render(
            <PreviewVideoTool
              toolCallId="1"
              state="output-available"
              output={{ error: 'Not found' }}
            />
        )
        expect(screen.getByText('Not found')).toBeInTheDocument()
    })
  })

  describe('GetTaskOutputsTool', () => {
    it('renders loading', () => {
        render(
            <GetTaskOutputsTool
              toolCallId="1"
              state="input-available"
              input={{ taskId: '1', kinds: ['summary'] }}
            />
        )
        expect(screen.getByText(/Retrieving content/)).toBeInTheDocument()
    })

    it('renders output count', () => {
        render(
            <GetTaskOutputsTool
              toolCallId="1"
              state="output-available"
              output={{ taskId: '1', outputs: [], count: 3 }}
            />
        )
        expect(screen.getByText('Retrieved 3 output(s)')).toBeInTheDocument()
    })
  })

  describe('UnknownTool', () => {
    it('renders running state', () => {
        render(
            <UnknownTool
              toolCallId="1"
              toolName="mystery_tool"
              state="input-available"
            />
        )
        expect(screen.getByText('Running: mystery_tool...')).toBeInTheDocument()
    })

    it('renders completed state', () => {
        render(
            <UnknownTool
              toolCallId="1"
              toolName="mystery_tool"
              state="output-available"
            />
        )
        expect(screen.getByText('Completed: mystery_tool')).toBeInTheDocument()
    })
  })
})
