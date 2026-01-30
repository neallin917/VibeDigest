import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { NextRequest } from 'next/server'

// --- Mocks ---

// 1. Mock Supabase Server Client
// --- Mocks ---

const {
    mockGetUser,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockEq,
    mockIn,
    mockSingle,
    mockOrder,
    mockFrom,
    mockStreamText,
    mockConvertToModelMessages,
    mockGetSession,
} = vi.hoisted(() => {
    return {
        // Supabase mocks
        mockGetUser: vi.fn(),
        mockGetSession: vi.fn(),
        mockSelect: vi.fn(),
        mockInsert: vi.fn(),
        mockUpdate: vi.fn(),
        mockEq: vi.fn(),
        mockIn: vi.fn(),
        mockSingle: vi.fn(),
        mockOrder: vi.fn(),
        mockFrom: vi.fn(),

        // AI SDK mocks
        mockStreamText: vi.fn(),
        mockConvertToModelMessages: vi.fn(),
    }
})

// Chainable mock implementation (applied after hoisting)
mockFrom.mockImplementation(((table: string) => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
})) as any)

// Default successful responses (Moved to beforeEach)

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => ({
        auth: {
            getUser: mockGetUser,
            getSession: mockGetSession
        },
        from: mockFrom
    }))
}))

vi.mock('ai', async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...(actual as any),
        streamText: mockStreamText,
        convertToModelMessages: mockConvertToModelMessages,
    }
})

// 3. Mock OpenAI SDK
vi.mock('@ai-sdk/openai', () => ({
    createOpenAI: vi.fn(() => ({
        chat: vi.fn()
    }))
}))

// --- Tests ---

describe('POST /api/chat', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        // Default Auth: User is logged in
        mockGetUser.mockResolvedValue({
            data: { user: { id: 'test-user-id' } },
            error: null
        })
        mockGetSession.mockResolvedValue({
            data: { session: { user: { id: 'test-user-id' }, access_token: 'valid-token' } },
            error: null
        })

        // Setup chain returns
        mockSelect.mockImplementation((args) => {
            return {
                eq: vi.fn((k, v) => {
                    return { single: mockSingle, order: mockOrder };
                }),
                in: mockIn
            };
        })
        mockUpdate.mockReturnValue({
            eq: vi.fn().mockResolvedValue({})
        })
        mockEq.mockImplementation((k, v) => {
            return { single: mockSingle, order: mockOrder };
        })
        mockIn.mockReturnValue({ single: mockSingle, order: mockOrder })

        // Default successful responses
        mockSingle.mockResolvedValue({ data: null, error: null })
        mockOrder.mockResolvedValue({ data: [], error: null })
        mockInsert.mockResolvedValue({ error: null })

        // Default: Mock streamText response
        mockStreamText.mockReturnValue({
            consumeStream: vi.fn(),
            toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response('mock stream'))
        })

        mockConvertToModelMessages.mockResolvedValue([])
    })

    it('returns 401 if user is not authenticated', async () => {
        // Setup: No user
        mockGetUser.mockResolvedValue({ data: { user: null }, error: 'No session' })
        mockGetSession.mockResolvedValue({ data: { session: null }, error: 'No session' })

        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            body: JSON.stringify({ message: { content: 'hello' } })
        })

        const res = await POST(req)

        expect(res.status).toBe(401)
        expect(await res.json()).toEqual(expect.objectContaining({ error: 'Unauthorized' }))
    })

    it('calls streamText with correct model and messages', async () => {
        // Setup: Thread lookup returns nothing (new thread)
        mockEq.mockReturnValue({ single: mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } }) })

        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                message: { content: 'Hello AI' },
                threadId: 'thread-123'
            })
        })

        const res = await POST(req)

        expect(res.status).toBe(200)
        expect(mockStreamText).toHaveBeenCalled()

        // Verify system prompt contains default instruction
        const callArgs = mockStreamText.mock.calls[0][0]
        expect(callArgs.system).toContain('You are VibeDigest Assistant')
    })

    it('injects RAG context when taskId is provided', async () => {
        const taskId = 'task-123'

        // Setup: Task lookup success
        // We need to carefully mock the chain for specific tables

        // Reset specific mock implementations for this test
        mockFrom.mockImplementation(((table: string) => {
            if (table === 'tasks') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: {
                                    video_title: 'Test Video',
                                    video_url: 'http://yt.com/1',
                                    status: 'completed',
                                    progress: 100
                                },
                                error: null
                            })
                        })
                    })
                }
            }
            if (table === 'task_outputs') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            in: vi.fn().mockResolvedValue({
                                data: [
                                    { kind: 'summary_source', content: 'This is a summary.', status: 'completed' },
                                    { kind: 'script', content: 'This is a transcript.', status: 'completed' }
                                ],
                                error: null
                            })
                        })
                    })
                }
            }
            // Default fallback
            return {
                select: mockSelect,
                insert: mockInsert,
                update: mockUpdate
            }
        }) as any)

        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                message: { content: 'What is the video about?' },
                threadId: 'thread-123',
                taskId: taskId
            })
        })

        await POST(req)

        const callArgs = mockStreamText.mock.calls[0][0]
        expect(callArgs.system).toContain('CURRENT VIDEO CONTEXT')
        expect(callArgs.system).toContain('Test Video')
        expect(callArgs.system).toContain('This is a summary.')
        expect(callArgs.system).toContain('This is a transcript.')
    })

    it('persists new thread if it does not exist', async () => {
        // Setup: Thread lookup returns "Not Found"
        mockFrom.mockImplementation(((table: string) => {
            if (table === 'chat_threads') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
                        })
                    }),
                    insert: mockInsert
                }
            }
            return { select: mockSelect, insert: mockInsert }
        }) as any)

        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                message: { content: 'New Thread' },
                threadId: 'new-thread-id'
            })
        })

        await POST(req)

        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
            id: 'new-thread-id',
            user_id: 'test-user-id',
            title: 'New Chat'
        }))
    })

    it('handles persistence in onFinish callback', async () => {
        // This test is tricky because onFinish is a callback.
        // We can simulate calling it manually if we capture it from the mock call.

        const req = new NextRequest('http://localhost/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                message: { content: 'Hello' },
                threadId: 'thread-123'
            })
        })

        await POST(req)

        // Capture the toUIMessageStreamResponse options
        const streamTextResult = mockStreamText.mock.results[0].value
        const toUIMessageCall = streamTextResult.toUIMessageStreamResponse.mock.calls[0][0]

        expect(toUIMessageCall).toHaveProperty('onFinish')

        // Execute onFinish manually
        const finalMessages = [
            { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date() },
            { id: 'msg-2', role: 'assistant', content: 'Hi there', createdAt: new Date() }
        ]

        // Reset mocks to track insertions
        mockInsert.mockClear()

        // Mock checking if message exists (return null so it inserts)
        mockSingle.mockResolvedValue({ data: null })

        await toUIMessageCall.onFinish({ messages: finalMessages })

        // Should try to insert messages
        // We expect at least one insert call for the chat_messages table
        // Note: The implementation iterates and inserts individually
        expect(mockInsert).toHaveBeenCalled()

        // Since we didn't mock the specific table for the second pass in detail in this specific test block (relies on global mock),
        // we just verify that insert was called. 
        // For more rigor, we'd set up the mockFrom to differentiate 'chat_messages' table calls.
    })
})
