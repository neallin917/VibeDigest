-- 13_chat_messages.sql

-- 1. Create Messages Table
-- Uses JSONB for content to support AI SDK v6 "parts" (text, tool calls, images)
-- Uses atomic append-only persistence (no full transcript rewriting)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id TEXT PRIMARY KEY, -- Changed from UUID to TEXT to support AI SDK string IDs
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool', 'data')),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for efficient querying
-- Frequent query: Get all messages for a thread, ordered by time
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created 
ON public.chat_messages(thread_id, created_at);

-- Support looking up specific message if needed
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id 
ON public.chat_messages(thread_id, id);

-- 3. RLS Policies
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow users to view messages from their own threads
CREATE POLICY "Users can view messages in own threads" 
ON public.chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_threads
    WHERE chat_threads.id = chat_messages.thread_id
    AND chat_threads.user_id = auth.uid()
  )
);

-- Allow users to insert messages into their own threads
CREATE POLICY "Users can insert messages into own threads" 
ON public.chat_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_threads
    WHERE chat_threads.id = chat_messages.thread_id
    AND chat_threads.user_id = auth.uid()
  )
);
