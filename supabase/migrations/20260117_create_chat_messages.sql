-- Migration: Create chat_messages table
-- Purpose: Store chat history (messages) for each thread

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for retrieving history in chronological order
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON public.chat_messages(thread_id, created_at ASC);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage messages of their own threads
CREATE POLICY "Users can manage messages of their threads"
ON public.chat_messages
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.chat_threads
        WHERE id = chat_messages.thread_id
        AND user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.chat_threads
        WHERE id = chat_messages.thread_id
        AND user_id = auth.uid()
    )
);
