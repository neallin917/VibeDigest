-- 12_chat_module.sql

-- 0. Create Tasks Table (Local Dev Fix)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- Removed REFERENCES auth.users for local dev
  video_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  progress INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  video_title TEXT,
  thumbnail_url TEXT,
  is_demo BOOLEAN DEFAULT FALSE
);

-- 1. Create Status Enum
DO $$ BEGIN
    CREATE TYPE public.chat_thread_status AS ENUM ('active', 'archived', 'deleted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Threads Table
CREATE TABLE IF NOT EXISTS public.chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Removed REFERENCES auth.users(id) for local dev
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE, -- Restored FK to tasks since we created it
    title TEXT NOT NULL DEFAULT 'New Chat',
    status public.chat_thread_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Indexes
-- List index: query visible threads for a user's task, sorted by recent activity
CREATE INDEX IF NOT EXISTS idx_chat_threads_list_visible 
ON public.chat_threads(user_id, task_id, updated_at DESC)
WHERE status != 'deleted';

-- 4. RLS Policies
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can fully manage own threads" ON public.chat_threads;

CREATE POLICY "Users can fully manage own threads" 
ON public.chat_threads
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 5. Auto-update updated_at Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_chat_threads_updated_at ON public.chat_threads;
CREATE TRIGGER update_chat_threads_updated_at
    BEFORE UPDATE ON public.chat_threads
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
