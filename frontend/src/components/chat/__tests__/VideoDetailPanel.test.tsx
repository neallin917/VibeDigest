import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { VideoDetailPanel } from '../VideoDetailPanel'

// Mock Supabase
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()
const mockLimit = vi.fn()

const mockSupabase = {
  from: vi.fn(() => ({
    select: mockSelect,
  })),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  })),
  removeChannel: vi.fn(),
}

vi.mock('@/lib/supabase', () => ({
  createClient: () => mockSupabase,
}))

// Mock VideoPlayer (since it has complex dependencies like ReactPlayer)
vi.mock('@/components/tasks/shared/VideoPlayer', () => ({
  VideoPlayer: () => <div data-testid="video-player">Video Player Stub</div>
}))

describe('VideoDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default chain setup
    mockSelect.mockReturnThis()
    mockEq.mockReturnThis()
    mockSingle.mockResolvedValue({ data: { 
      id: 'task-123', 
      video_title: 'Test Video', 
      video_url: 'https://youtu.be/test',
      status: 'completed' 
    }})
    mockLimit.mockResolvedValue({ data: [] }) // Default no summary
  })

  it('renders loading state initially', () => {
    // When no task data yet
    mockSingle.mockResolvedValue({ data: null })
    render(<VideoDetailPanel taskId="task-123" />)
    // Should be empty or loading spinner depending on implementation
    // Current impl returns null if !task
    expect(screen.queryByText('Context Panel')).not.toBeInTheDocument()
  })

  it('renders task info and video player', async () => {
    render(<VideoDetailPanel taskId="task-123" />)
    
    await waitFor(() => {
      expect(screen.getByText('Context Panel')).toBeInTheDocument()
      expect(screen.getByTestId('video-player')).toBeInTheDocument()
    })
  })

  it('renders structured summary content (Insights, Actions, Risks)', async () => {
    const summaryContent = {
      overview: "An overview of the test video.",
      keypoints: [
        { title: "Key Insight 1", detail: "Detail 1", startSeconds: 10 }
      ],
      action_items: [
        { content: "Action 1", priority: "high" }
      ],
      risks: [
        { content: "Risk 1", severity: "medium" }
      ]
    }

    mockLimit.mockResolvedValue({ data: [{
      kind: 'summary',
      status: 'completed',
      content: JSON.stringify(summaryContent)
    }]})

    render(<VideoDetailPanel taskId="task-123" />)

    await waitFor(() => {
      // Check sections exist
      expect(screen.getByText('Key Insight')).toBeInTheDocument()
      expect(screen.getByText('Action Items')).toBeInTheDocument()
      expect(screen.getByText('Risks & Warnings')).toBeInTheDocument()
      
      // Check content
      expect(screen.getByText('Key Insight 1')).toBeInTheDocument()
      expect(screen.getByText('Action 1')).toBeInTheDocument()
      expect(screen.getByText('Risk 1')).toBeInTheDocument()
    })
  })

  it('handles empty summary gracefully', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'task-123', status: 'completed' } })
    mockLimit.mockResolvedValue({ data: [] }) // No summary output found

    render(<VideoDetailPanel taskId="task-123" />)

    await waitFor(() => {
      expect(screen.getByText('No summary available.')).toBeInTheDocument()
    })
  })
})
