# 数据库设计 (Database Schema): Chat Module

本文档定义了 Chat Module 所需的数据库表结构。我们使用 PostgreSQL (Via Supabase)。

## 1. 核心表结构 (Tables)

### 1.1 `chat_threads`
存储会话的元数据，是业务层的主表。

```sql
-- 定义会话状态枚举 (保留 archived 以防未来需要，但目前逻辑仅区分 deleted)
CREATE TYPE public.chat_thread_status AS ENUM ('active', 'archived', 'deleted');

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

-- 索引与约束

-- 1. 核心列表索引：查询某用户某任务下的所有可见会话 (非 deleted)
--    按 updated_at 倒序排列 (Sidebar展示顺序)
CREATE INDEX idx_chat_threads_list_visible 
ON public.chat_threads(user_id, task_id, updated_at DESC)
WHERE status != 'deleted';

-- 2. 移除唯一性约束：允许每个 Task 下有多个 Active Threads (支持 Sidebar 列表)
-- (原 idx_unique_active_thread 被移除)

-- 3. 历史查询索引：查询归档记录
CREATE INDEX idx_chat_threads_archived_lookup 
ON public.chat_threads(user_id, task_id, updated_at DESC);
```

### 1.2 `langgraph_checkpoints` (由 LangGraph 自动管理)
(无需手动创建，但需知晓 `thread_id` 对应 `chat_threads.id`)

## 2. 安全策略 (RLS Policies)

必须启用 Row Level Security (RLS) 以保护用户隐私。

```sql
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

-- 通用策略：用户只能操作自己的 records
CREATE POLICY "Users can fully manage own threads" 
ON public.chat_threads
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 特殊说明：LangGraph Checkpoint 表 (langgraph_checkpoints, langgraph_writes 等)
-- 这些表包含敏感对话数据。
-- 必须确保 POSTGRES 权限配置中，仅 service_role 可读写这些表。
-- 禁止 authenticated (登录用户) 和 anon (匿名用户) 角色对这些表拥有 SELECT/INSERT/UPDATE/DELETE 权限。
-- 客户端数据访问必须经由 API 层代理。
```

## 3. 触发器 (Triggers)

### 3.1 自动更新 `updated_at`
后端 API 在写入消息时应尽量显式更新 `updated_at`，但保留 DB 触发器作为保底或处理 pure metadata updates (如重命名)。

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_threads_updated_at
    BEFORE UPDATE ON public.chat_threads
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
```
