import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TaskForm } from './TaskForm'
import { ApiClient } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// 1. Mock Next.js Router
const pushMock = vi.fn()
const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: pushMock,
        refresh: refreshMock,
    }),
}))

// 2. Mock Supabase (Auth)
const getSessionMock = vi.fn().mockResolvedValue({
    data: {
        session: { access_token: 'mock-token' }
    }
})
vi.mock('@/lib/supabase', () => ({
    createClient: () => ({
        auth: {
            getSession: getSessionMock
        }
    })
}))

// 3. Mock API Client
vi.mock('@/lib/api', () => ({
    ApiClient: {
        processVideo: vi.fn()
    }
}))

// 4. Mock I18n
vi.mock('@/components/i18n/I18nProvider', () => ({
    useI18n: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                "taskForm.generate": "Generate",
                "taskForm.processing": "Processing...",
                "taskForm.urlPlaceholder": "Enter video URL",
                "taskForm.summaryLanguage": "Summary Language"
            }
            return map[key] || key
        },
        locale: 'en'
    })
}))

describe('TaskForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders correctly', () => {
        render(<TaskForm />)
        expect(screen.getByPlaceholderText('Enter video URL')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument()
    })

    it('submits form with valid URL', async () => {
        // Setup API mock response
        vi.mocked(ApiClient.processVideo).mockResolvedValue({ task_id: 'task-123', message: 'Success' })

        render(<TaskForm />)

        // Type URL
        const input = screen.getByPlaceholderText('Enter video URL')
        fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=test' } })

        // Click Submit
        const button = screen.getByRole('button', { name: 'Generate' })
        fireEvent.click(button)

        // Assert Processing State (Optional, checking text change)
        // Note: React state updates might happen too fast or wrapped in act(), 
        // but we can check the API call.

        await waitFor(() => {
            expect(ApiClient.processVideo).toHaveBeenCalledTimes(1)
        })

        // Check args
        const formDataArg = vi.mocked(ApiClient.processVideo).mock.calls[0][0]
        expect(formDataArg).toBeInstanceOf(FormData)
        expect(formDataArg.get('video_url')).toBe('https://youtube.com/watch?v=test')
        expect(formDataArg.get('summary_language')).toBe('en')

        // Check Router Redirect (locale-prefixed route)
        await waitFor(() => {
            expect(pushMock).toHaveBeenCalledWith('/en/tasks/task-123')
        })
    })

    it('handles empty submission', async () => {
        render(<TaskForm />)
        const button = screen.getByRole('button', { name: 'Generate' })
        fireEvent.click(button)

        // Should not call API
        expect(ApiClient.processVideo).not.toHaveBeenCalled()
    })

    // ============================================
    // Journey 1.3: 配额耗尽处理 (P0)
    // ============================================

    it('shows quota exceeded dialog when API returns 403', async () => {
        // Mock API to throw quota exceeded error
        vi.mocked(ApiClient.processVideo).mockRejectedValue(
            new Error('Quota exceeded: You have reached your limit')
        )

        render(<TaskForm />)

        // Type valid URL and submit
        const input = screen.getByPlaceholderText('Enter video URL')
        fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=test' } })
        fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

        // Wait for dialog to appear
        await waitFor(() => {
            expect(screen.getByText('taskForm.quotaExceeded.title')).toBeInTheDocument()
        })

        // Verify upgrade button exists
        expect(screen.getByText('taskForm.quotaExceeded.confirm')).toBeInTheDocument()
    })

    it('navigates to pricing page when upgrade button clicked', async () => {
        vi.mocked(ApiClient.processVideo).mockRejectedValue(
            new Error('insufficient credits')
        )

        render(<TaskForm />)

        const input = screen.getByPlaceholderText('Enter video URL')
        fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=test' } })
        fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

        await waitFor(() => {
            expect(screen.getByText('taskForm.quotaExceeded.title')).toBeInTheDocument()
        })

        // Click upgrade button
        fireEvent.click(screen.getByText('taskForm.quotaExceeded.confirm'))

        await waitFor(() => {
            expect(pushMock).toHaveBeenCalledWith('/en/settings/pricing')
        })
    })

    it('shows URL help dialog for invalid URL format', async () => {
        render(<TaskForm />)

        // Type invalid URL
        const input = screen.getByPlaceholderText('Enter video URL')
        fireEvent.change(input, { target: { value: 'not-a-valid-url' } })
        fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

        // Should show URL help dialog, not make API call
        await waitFor(() => {
            expect(screen.getByText('taskForm.urlHelp.title')).toBeInTheDocument()
        })
        expect(ApiClient.processVideo).not.toHaveBeenCalled()
    })
})
