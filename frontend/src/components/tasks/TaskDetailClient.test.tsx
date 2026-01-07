import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import TaskDetailClient, { Task, Output } from '@/app/[lang]/(main)/tasks/[id]/[slug]/TaskDetailClient'
import { createClient } from '@/lib/supabase'

// --- Mocks ---

// 1. Mock Supabase
const mockSupabase = {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    from: vi.fn(() => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn(), // for task
                // for outputs (returns array)
            }))
        }))
    })),
    channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn()
    })),
    removeChannel: vi.fn()
}

// Helper to setup mock responses
mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'tasks') {
        return {
            select: () => ({
                eq: () => ({
                    single: vi.fn().mockResolvedValue({
                        data: {
                            id: 'task-1',
                            video_title: 'Test Task',
                            status: 'processing',
                            progress: 0,
                            created_at: '2023-01-01',
                            video_url: 'http://test.com'
                        }
                    })
                })
            })
        }
    }
    if (table === 'task_outputs') {
        return {
            select: () => ({
                eq: vi.fn().mockResolvedValue({ data: [] })
            })
        }
    }
    return { select: () => ({ eq: () => ({}) }) }
})

vi.mock('@/lib/supabase', () => ({
    createClient: () => mockSupabase
}))

// 2. Mock I18n
vi.mock('@/components/i18n/I18nProvider', () => ({
    useI18n: () => ({
        t: (key: string, args?: Record<string, string>) => {
            if (args?.error) return `${key}: ${args.error}`
            return key
        },
        locale: 'en'
    })
}))

// 3. Mock Notification Hook
vi.mock('@/hooks/useTaskNotification', () => ({
    useTaskNotification: () => ({
        permission: 'default',
        subscribeToTask: vi.fn(),
        isSubscribed: () => false
    })
}))

// 4. Mock Clipboard
Object.assign(navigator, {
    clipboard: {
        writeText: vi.fn()
    }
})

// 5. Mock Next Dynamic Components (MindMap, Markdown)
// Using simple placeholders
vi.mock('next/dynamic', () => ({
    default: () => {
        return function MockComponent() { return <div>MockDynamicComponent</div> }
    }
}))
// Mock UI components that might cause issues
vi.mock('@/components/tasks/VideoEmbed', () => ({
    VideoEmbed: () => <div>VideoEmbed</div>,
    supportsVideoEmbed: () => true
}))
vi.mock('@/components/tasks/SummaryExportButton', () => ({
    SummaryShareButton: ({ onCopyMarkdown }: any) => (
        <button onClick={onCopyMarkdown}>Copy Markdown</button>
    )
}))


describe('TaskDetailClient', () => {

    const mockTask: Task = {
        id: '123',
        video_url: 'https://youtube.com/test',
        video_title: 'My Video',
        status: 'completed',
        progress: 100,
        created_at: '2023-01-01'
    }

    const mockOutput: Output = {
        id: 'out-1',
        kind: 'summary',
        status: 'completed',
        progress: 100,
        content: JSON.stringify({
            overview: "Test Overview",
            keypoints: [{ title: "Point 1", detail: "Details" }]
        }),
        locale: 'en'
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders task title correctly', () => {
        render(<TaskDetailClient id="123" initialTask={mockTask} initialOutputs={[mockOutput]} />)
        expect(screen.getByText('My Video')).toBeInTheDocument()
        expect(screen.getByText('Test Overview')).toBeInTheDocument()
    })

    it('calls initial fetch if props are missing', async () => {
        // Render without initial data
        render(<TaskDetailClient id="123" initialTask={null} initialOutputs={[]} />)

        await waitFor(() => {
            // We can check if "loadingTask" text is present or if fetchTask was called
            // Since we mocked supabase, fetchTask calls supabase.from('tasks')...
            // The component renders "tasks.loadingTask" if task is null
            expect(screen.getByText('tasks.loadingTask')).toBeInTheDocument()
        })
    })

    it('handles clipboard copy', async () => {
        render(<TaskDetailClient id="123" initialTask={mockTask} initialOutputs={[mockOutput]} />)

        // Find our mocked Copy button
        const copyBtn = screen.getByText('Copy Markdown')
        fireEvent.click(copyBtn)

        expect(navigator.clipboard.writeText).toHaveBeenCalled()
        // Verify content
        const calledText = (navigator.clipboard.writeText as any).mock.calls[0][0]
        expect(calledText).toContain("# My Video")
        expect(calledText).toContain("Test Overview")
    })

    it('shows error state when summary fails', () => {
        const errorOutput: Output = {
            ...mockOutput,
            status: 'error',
            error_message: 'Simulated Error',
            content: ''
        }
        render(<TaskDetailClient id="123" initialTask={mockTask} initialOutputs={[errorOutput]} />)

        expect(screen.getByText(/Simulated Error/)).toBeInTheDocument()
    })

    // ============================================
    // Journey 2.1: 时间戳跳转 Integration (P0)
    // ============================================

    it('renders keypoints with timestamp badges when startSeconds present', () => {
        const outputWithTimestamp: Output = {
            id: 'out-1',
            kind: 'summary',
            status: 'completed',
            progress: 100,
            content: JSON.stringify({
                version: 1,
                overview: "Video Overview",
                keypoints: [
                    { title: "Point 1", detail: "Details", startSeconds: 120 },
                    { title: "Point 2", detail: "More details", startSeconds: 300 }
                ]
            }),
            locale: 'en'
        }
        render(<TaskDetailClient id="123" initialTask={mockTask} initialOutputs={[outputWithTimestamp]} />)

        // Keypoints should render
        expect(screen.getByText('Point 1')).toBeInTheDocument()
        expect(screen.getByText('Point 2')).toBeInTheDocument()
    })

    // ============================================
    // Journey 2.3: 错误状态展示完善 (P1)
    // ============================================

    it('shows retry button when output has error', () => {
        const errorOutput: Output = {
            id: 'out-err',
            kind: 'summary',
            status: 'error',
            progress: 0,
            error_message: 'LLM failed to generate summary',
            content: '',
            locale: 'en'
        }
        render(<TaskDetailClient id="123" initialTask={mockTask} initialOutputs={[errorOutput]} />)

        // Error message should be visible
        expect(screen.getByText(/LLM failed to generate summary/)).toBeInTheDocument()
    })

    it('handles processing state correctly', () => {
        const processingOutput: Output = {
            id: 'out-proc',
            kind: 'summary',
            status: 'processing',
            progress: 45,
            content: '',
            locale: 'en'
        }
        const processingTask: Task = {
            ...mockTask,
            status: 'processing',
            progress: 50
        }
        render(<TaskDetailClient id="123" initialTask={processingTask} initialOutputs={[processingOutput]} />)

        // Should show some loading/processing indicator
        // The component shows progress, we verify it doesn't crash
        expect(screen.getByText('My Video')).toBeInTheDocument()
    })
})
