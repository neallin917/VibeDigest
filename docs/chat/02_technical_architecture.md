# 技术架构设计: Chat & Thread Management

## 1. 系统概览 (Overview)
本设计旨在构建一个轻量级、响应式的聊天系统。系统完全基于 **Next.js AI SDK (v6)** 构建，移除独立的 Python Backend 和 LangGraph 服务，利用 **Next.js API Routes** 处理业务逻辑与 LLM 交互，使用 **Supabase** 进行数据持久化。

## 2. 技术栈 (Tech Stack)
-   **Frontend**: Next.js (App Router), `ai` (Vercel AI SDK), `@ai-sdk/openai`, TanStack Query.
-   **Backend**: Next.js API Routes (Serverless / Edge Compatible).
-   **Database**: Supabase (PostgreSQL) - 存储 `chat_threads`, `chat_messages`, `tasks`, `task_outputs`.

## 3. 核心组件设计 (Component Design)

### 3.1. 数据库模型 (Database Schema)
-   **`chat_threads`**: 会话元数据 (User, Task, Title, UpdatedAt).
-   **`chat_messages`**: 消息历史 (ThreadID, Role, Content).
-   **`task_outputs`**: 源数据 (Transcription, Summary)，用于 RAG 上下文注入。

### 3.2. 后端架构 (Backend Architecture)
**Endpoint**: `app/api/chat/route.ts`

-   **Runtime**: Node.js / Edge.
-   **Logic**:
    1.  **Auth**: 校验 Supabase Token.
    2.  **Context Retrieval**: 根据 `taskId` 查询 `task_outputs` 表，获取 `transcription` 或 `summary`。
    3.  **Prompt Engineering**: 将 Context 注入 System Prompt ("You are a helpful assistant... Context: ...").
    4.  **Streaming**: 使用 `streamText` 调用 OpenAI。
    5.  **Persistence (onFinish)**:
        -   异步保存用户消息 (`role: user`) 到 `chat_messages`.
        -   异步保存 AI 响应 (`role: assistant`) 到 `chat_messages`.
        -   更新 `chat_threads.updated_at`.

### 3.3. 前端架构 (Frontend Architecture)
**Component**: `AssistantChat.tsx`

-   **Hook**: `useChat` (from `ai/react`).
-   **State Management**:
    -   `messages`: 实时存储当前会话消息。
    -   `threadId`: 当前激活的会话 ID。
-   **Initialization**:
    -   加载时通过 `initialMessages` 属性注入历史记录 (client fetch).

## 4. 数据流 (Data Flow)

### 场景 1: 发送消息
1.  用户输入消息。
2.  Frontend 调用 `useChat.append()`.
3.  Request: `POST /api/chat` (Body: `{ messages, taskId, threadId }`).
4.  Backend:
    -   Fetch Context (Video Summary).
    -   Call LLM (Streaming).
    -   Save to DB (Async).
5.  Frontend: 实时显示 Stream 结果。

### 场景 2: 切换会话
1.  用户点击 Sidebar 历史会话。
2.  Frontend `setThreadId(id)`.
3.  Fetch History: `GET /api/threads/{id}/messages`.
4.  Reset `useChat` state via `initialMessages`.

## 5. 安全性设计 (Security)
-   **RLS**: 数据库层启用 RLS，确保用户只能访问自己的会话和任务数据。
-   **API Auth**: Next.js 根据 Headers 校验 Supabase Authenticated User.
