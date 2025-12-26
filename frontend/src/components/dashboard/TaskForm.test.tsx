import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TaskForm } from './TaskForm'
import { ApiClient } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { vi } from 'vitest'

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

        // Check Router Redirect
        await waitFor(() => {
            expect(pushMock).toHaveBeenCalledWith('/tasks/task-123')
        })
    })

    it('handles empty submission', async () => {
        render(<TaskForm />)
        const button = screen.getByRole('button', { name: 'Generate' })
        fireEvent.click(button)

        // Should not call API
        expect(ApiClient.processVideo).not.toHaveBeenCalled()
    })
})
