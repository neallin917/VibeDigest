# 数据库设计 (Database Schema): Chat Module

## 1. 核心表结构 (Tables)

### 1.1 `chat_threads`
存储会话元数据。

```sql
CREATE TYPE public.chat_thread_status AS ENUM ('active', 'deleted');

CREATE TABLE public.chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    status public.chat_thread_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_chat_threads_list ON public.chat_threads(user_id, task_id, updated_at DESC);
```

### 1.2 `chat_messages` (NEW)
存储对话历史 (User & Assistant)。

```sql
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for retrieving history in chronological order
CREATE INDEX idx_chat_messages_thread_id ON public.chat_messages(thread_id, created_at ASC);
```

## 2. 安全策略 (RLS)
所有表启用 RLS。

### `chat_threads` & `chat_messages`
-   **Policy**: User can select/insert/update/delete their own data.
-   **Expression**: `auth.uid() = user_id` (Note: `chat_messages` needs join or verification via thread ownership).

```sql
-- chat_messages specific RLS (via thread ownership)
CREATE POLICY "Users can manage messages of their threads"
ON public.chat_messages
USING (
    EXISTS (
        SELECT 1 FROM public.chat_threads
        WHERE id = chat_messages.thread_id
        AND user_id = auth.uid()
    )
);
```
