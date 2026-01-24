import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { VideoDetailPanel } from '../VideoDetailPanel'

// Define mocks
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockIn = vi.fn()
const mockSingle = vi.fn()
const mockLimit = vi.fn()

// Chainable query builder
const queryBuilder = {
  select: mockSelect,
  eq: mockEq,
  in: mockIn,
  single: mockSingle,
  limit: mockLimit,
}

// Setup chain return values
mockSelect.mockReturnValue(queryBuilder)
mockEq.mockReturnValue(queryBuilder)
mockIn.mockReturnValue(queryBuilder)
mockLimit.mockReturnValue(queryBuilder)
// mockSingle is terminal, returns Promise
// mockIn is terminal in the component usage?
// Component: await supabase.from(...).in(...)
// So mockIn must return a Promise, NOT queryBuilder, if it's the last call.
// BUT, in Supabase JS, .in() returns a PostgrestFilterBuilder which IS awaitable (thenable).
// So returning queryBuilder is fine IF queryBuilder has a .then method or if we return a Promise directly.
// The component awaits the result of .in().
// If mockIn returns queryBuilder, and queryBuilder is NOT a Promise, `await` will return queryBuilder itself.
// The component expects `{ data }`.
// So queryBuilder must look like the response OR mockIn must return the response.

// The component code:
// const { data: outputs } = await supabase...in(...)
// This means the result of the chain must have a `data` property.

// FIX: Make mockIn return a Promise that resolves to the response object.
// We can't make it return queryBuilder AND a Promise easily unless queryBuilder IS a Promise (thenable).
// Since the component stops at .in(), we should make mockIn return the Promise.

mockIn.mockImplementation(() => Promise.resolve({ data: [] }))
mockSingle.mockImplementation(() => Promise.resolve({ data: null }))
mockLimit.mockImplementation(() => Promise.resolve({ data: [] }))

const mockSupabase = {
  from: vi.fn(() => queryBuilder),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  })),
  removeChannel: vi.fn(),
}

vi.mock('@/lib/supabase', () => ({
  createClient: () => mockSupabase,
}))

vi.mock('@/components/tasks/shared/VideoPlayer', () => ({
  VideoPlayer: () => <div data-testid="video-player">Video Player Stub</div>
}))

describe('VideoDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset default behaviors
    mockSelect.mockReturnValue(queryBuilder)
    mockEq.mockReturnValue(queryBuilder)
    // mockIn is the terminal call in fetching outputs
    mockIn.mockResolvedValue({ data: [] })

    // mockSingle is the terminal call in fetching task
    mockSingle.mockResolvedValue({
      data: {
        id: 'task-123',
        video_title: 'Test Video',
        video_url: 'https://youtu.be/test',
        status: 'completed'
      }
    })
  })

  it('renders loading state initially', () => {
    mockSingle.mockResolvedValue({ data: null })
    render(<VideoDetailPanel taskId="task-123" />)
    expect(screen.queryByText('Context Panel')).not.toBeInTheDocument()
  })

  it('renders task info and video player', async () => {
    render(<VideoDetailPanel taskId="task-123" />)

    await waitFor(() => {
      expect(screen.getByText('Context Panel')).toBeInTheDocument()
      expect(screen.getByTestId('video-player')).toBeInTheDocument()
    })
  })

  it('renders structured summary content (Insights)', async () => {
    const summaryContent = {
      overview: "An overview of the test video.",
      keypoints: [
        { title: "Key Insight 1", detail: "Detail 1", startSeconds: 10 }
      ]
    }

    mockIn.mockResolvedValue({
      data: [{
        kind: 'summary',
        status: 'completed',
        content: JSON.stringify(summaryContent)
      }]
    })

    render(<VideoDetailPanel taskId="task-123" />)

    await waitFor(() => {
      expect(screen.getByText('Key Insight 1')).toBeInTheDocument()
      expect(screen.getByText('An overview of the test video.')).toBeInTheDocument()
    })
  })

  it('handles non-JSON text summary (Markdown fallback)', async () => {
    const markdownSummary = "# Video Summary\nThis is a markdown summary."

    mockIn.mockResolvedValue({
      data: [{
        kind: 'summary',
        status: 'completed',
        content: markdownSummary
      }]
    })

    render(<VideoDetailPanel taskId="task-123" />)

    await waitFor(() => {
      expect(screen.getByText(/This is a markdown summary/)).toBeInTheDocument()
      expect(screen.queryByText('Insight 1')).not.toBeInTheDocument()
    })
  })

  it('handles malformed JSON by treating as text', async () => {
    const malformedJson = "{ keypoints: [ ... incomplete"

    mockIn.mockResolvedValue({
      data: [{
        kind: 'summary',
        status: 'completed',
        content: malformedJson
      }]
    })

    render(<VideoDetailPanel taskId="task-123" />)

    await waitFor(() => {
      expect(screen.getByText(malformedJson)).toBeInTheDocument()
    })
  })

  it('handles empty summary gracefully', async () => {
    mockIn.mockResolvedValue({ data: [] })

    render(<VideoDetailPanel taskId="task-123" />)

    await waitFor(() => {
      expect(screen.getByText(/No summary available/i)).toBeInTheDocument()
    })
  })
})
